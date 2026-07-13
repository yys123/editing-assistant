import hashlib
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from routers import article


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def json(self):
        return self._payload


class FakeAsyncClient:
    calls = []
    responses = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        self.calls.append((url, params))
        return self.responses.pop(0)


class ClinicalDecisionChunkNormalizationTests(unittest.TestCase):
    def test_normalizes_screenshot_shaped_response(self):
        payload = {
            "code": "Success",
            "status": 200,
            "data": {
                "results": {
                    "numFound": 12,
                    "numReturn": 1,
                    "docs": [
                        {
                            "id": 101,
                            "mainId": 202,
                            "mainTitle": "  中国高血压临床决策  ",
                            "title": "  降压治疗  ",
                            "chunkId": 303,
                            "contentText": "  推荐优先使用长效降压药。  ",
                        }
                    ],
                }
            },
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(result["num_found"], 12)
        self.assertEqual(result["num_returned"], 1)
        self.assertEqual(
            result["items"],
            [
                {
                    "id": "101",
                    "main_id": "202",
                    "main_title": "中国高血压临床决策",
                    "title": "降压治疗",
                    "chunk_id": "303",
                    "content_text": "推荐优先使用长效降压药。",
                    "usable": True,
                }
            ],
        )

    def test_preserves_missing_chunk_id_as_unusable(self):
        payload = {
            "data": {
                "results": {
                    "numFound": 1,
                    "numReturn": 1,
                    "docs": [
                        {
                            "id": "doc-1",
                            "mainId": "main-1",
                            "mainTitle": " ",
                            "title": None,
                            "contentText": "可展示但不可选用的内容",
                        }
                    ],
                }
            }
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(
            result["items"][0],
            {
                "id": "doc-1",
                "main_id": "main-1",
                "main_title": "未命名临床决策资料",
                "title": "未命名切片",
                "chunk_id": "",
                "content_text": "可展示但不可选用的内容",
                "usable": False,
            },
        )

    def test_preserves_blank_content_text_as_unusable(self):
        payload = {
            "data": {
                "results": {
                    "numFound": 1,
                    "numReturn": 1,
                    "docs": [
                        {
                            "id": "doc-2",
                            "mainId": "main-2",
                            "mainTitle": "高血压临床决策",
                            "title": "生活方式干预",
                            "chunkId": "chunk-2",
                            "contentText": "   ",
                        }
                    ],
                }
            }
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(result["items"][0]["chunk_id"], "chunk-2")
        self.assertEqual(result["items"][0]["content_text"], "")
        self.assertFalse(result["items"][0]["usable"])

    def test_rejects_non_success_code_even_with_status_200(self):
        with self.assertRaises(HTTPException) as ctx:
            article._clinical_decision_chunks_from_response(
                {"code": "failed", "status": 200, "data": {"results": {"docs": []}}}
            )

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "临床决策切片数据源请求失败")

    def test_rejects_non_200_status(self):
        with self.assertRaises(HTTPException) as ctx:
            article._clinical_decision_chunks_from_response(
                {"code": "success", "status": 500, "data": {"results": {"docs": []}}}
            )

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "临床决策切片数据源请求失败")

    def test_rejects_invalid_response_envelopes(self):
        invalid_payloads = (
            None,
            {},
            {"data": {}},
            {"data": {"results": {"docs": {}}}},
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(HTTPException) as ctx:
                    article._clinical_decision_chunks_from_response(payload)

                self.assertEqual(ctx.exception.status_code, 502)
                self.assertEqual(ctx.exception.detail, "临床决策切片数据源返回格式异常")

    def test_invalid_counts_fall_back_to_normalized_item_count(self):
        payload = {
            "data": {
                "results": {
                    "numFound": "not-a-count",
                    "numReturn": None,
                    "docs": [
                        {"chunkId": "chunk-1", "contentText": "内容一"},
                        {"chunkId": "chunk-2", "contentText": "内容二"},
                    ],
                }
            }
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(result["num_found"], 2)
        self.assertEqual(result["num_returned"], 2)

    def test_malformed_numeric_counts_fall_back_to_normalized_item_count(self):
        for malformed_count in (True, 1.5, float("inf"), -1):
            with self.subTest(malformed_count=malformed_count):
                payload = {
                    "data": {
                        "results": {
                            "numFound": malformed_count,
                            "numReturn": malformed_count,
                            "docs": [
                                {"chunkId": "chunk-1", "contentText": "内容一"},
                                {"chunkId": "chunk-2", "contentText": "内容二"},
                            ],
                        }
                    }
                }

                result = article._clinical_decision_chunks_from_response(payload)

                self.assertEqual(result["num_found"], 2)
                self.assertEqual(result["num_returned"], 2)

    def test_accepts_nonnegative_integer_like_counts(self):
        payload = {
            "data": {
                "results": {
                    "numFound": "12",
                    "numReturn": 2.0,
                    "docs": [
                        {"chunkId": "chunk-1", "contentText": "内容一"},
                        {"chunkId": "chunk-2", "contentText": "内容二"},
                    ],
                }
            }
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(result["num_found"], 12)
        self.assertEqual(result["num_returned"], 2)

    def test_skips_non_dict_docs_entries(self):
        payload = {
            "data": {
                "results": {
                    "numFound": "invalid",
                    "numReturn": "invalid",
                    "docs": [
                        None,
                        "invalid",
                        {"id": 7, "chunkId": "chunk-7", "contentText": "有效内容"},
                    ],
                }
            }
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["id"], "7")
        self.assertEqual(result["num_found"], 1)
        self.assertEqual(result["num_returned"], 1)


class ClinicalDecisionChunkEndpointTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        FakeAsyncClient.calls = []
        FakeAsyncClient.responses = []
        self.settings_patch = patch.object(
            article,
            "settings",
            SimpleNamespace(
                guide_app_id="test-app-id",
                guide_app_sign_key="test-sign-key",
                guide_app_name="test-app-name",
                guide_api_base="https://newdrugs-test.dxy.net/open-sign-api/article-quality/guide",
                ncd_api_base="https://newdrugs-test.dxy.net/open-sign-api/article-quality/ncd",
                clinical_decision_chunk_api_base=(
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/chunk/"
                ),
            ),
        )
        self.settings_patch.start()

    def tearDown(self):
        self.settings_patch.stop()

    def signed_params(self, **params):
        sign_params = {
            **params,
            "appId": "test-app-id",
            "appSignKey": "test-sign-key",
            "timestamp": "1700000000123",
            "noncestr": "12345678",
        }
        sign_params = {key: str(value) for key, value in sign_params.items()}
        sign_source = "&".join(f"{key}={sign_params[key]}" for key in sorted(sign_params))
        return {
            **{key: value for key, value in sign_params.items() if key != "appSignKey"},
            "sign": hashlib.sha1(sign_source.encode("utf-8")).hexdigest(),
        }

    async def fetch_chunks(self, payload, guide_id=None, doi=None):
        FakeAsyncClient.responses = [FakeResponse(payload)]
        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            return await article.search_clinical_decision_chunks(guide_id=guide_id, doi=doi)

    async def test_requires_guide_id_or_doi(self):
        for guide_id, doi in ((None, None), (" ", "\t")):
            with self.subTest(guide_id=guide_id, doi=doi):
                with self.assertRaises(HTTPException) as ctx:
                    await article.search_clinical_decision_chunks(guide_id=guide_id, doi=doi)

                self.assertEqual(ctx.exception.status_code, 400)
                self.assertEqual(ctx.exception.detail, "请填写指南 ID 或 DOI")

    async def test_rejects_non_positive_and_malformed_guide_id(self):
        for guide_id in ("0", "abc"):
            with self.subTest(guide_id=guide_id):
                with self.assertRaises(HTTPException) as ctx:
                    await article.search_clinical_decision_chunks(guide_id=guide_id, doi=None)

                self.assertEqual(ctx.exception.status_code, 400)
                self.assertEqual(ctx.exception.detail, "指南 ID 必须为正整数")

    async def test_guide_id_only_maps_to_guide_id_and_omits_doi(self):
        result = await self.fetch_chunks(
            {"code": "success", "status": 200, "data": {"results": {"docs": []}}},
            guide_id=" 42 ",
            doi=" ",
        )

        self.assertEqual(result, {"items": [], "num_found": 0, "num_returned": 0})
        self.assertEqual(
            FakeAsyncClient.calls,
            [
                (
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/chunk/list",
                    self.signed_params(guideId="42"),
                )
            ],
        )
        self.assertNotIn("doi", FakeAsyncClient.calls[0][1])

    async def test_doi_only_omits_guide_id_and_trims_doi(self):
        await self.fetch_chunks(
            {"code": "success", "status": 200, "data": {"results": {"docs": []}}},
            guide_id=None,
            doi=" 10.1000/example ",
        )

        self.assertEqual(
            FakeAsyncClient.calls,
            [
                (
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/chunk/list",
                    self.signed_params(doi="10.1000/example"),
                )
            ],
        )
        self.assertNotIn("guideId", FakeAsyncClient.calls[0][1])

    async def test_both_filters_use_chunk_endpoint_signed_params_and_normalize_empty_results(self):
        result = await self.fetch_chunks(
            {
                "code": "success",
                "status": 200,
                "data": {"results": {"numFound": 0, "numReturn": 0, "docs": []}},
            },
            guide_id="77",
            doi="10.1000/both",
        )

        self.assertEqual(result, {"items": [], "num_found": 0, "num_returned": 0})
        self.assertEqual(
            FakeAsyncClient.calls,
            [
                (
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/chunk/list",
                    self.signed_params(guideId="77", doi="10.1000/both"),
                )
            ],
        )
        params = FakeAsyncClient.calls[0][1]
        self.assertIn("appId", params)
        self.assertIn("sign", params)
        self.assertNotIn("appSignKey", params)

    async def test_non_object_json_from_proxy_path_reports_502_format_error(self):
        with self.assertRaises(HTTPException) as ctx:
            await self.fetch_chunks([], guide_id="42")

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail["message"], "临床决策切片数据源返回格式异常")


if __name__ == "__main__":
    unittest.main()
