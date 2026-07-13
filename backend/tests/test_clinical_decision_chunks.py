import unittest

from fastapi import HTTPException

from routers import article


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


if __name__ == "__main__":
    unittest.main()
