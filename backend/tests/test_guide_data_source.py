import hashlib
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from routers import article


class FakeGuideResponse:
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


class GuideDataSourceTests(unittest.IsolatedAsyncioTestCase):
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
            ),
        )
        self.settings_patch.start()

    def tearDown(self):
        self.settings_patch.stop()

    def guide_params(self, **params):
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

    async def test_search_guides_normalizes_external_items(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": [
                    {"id": 12, "title": "2型糖尿病基层诊疗指南"},
                    {"id": "13", "title": "糖尿病足指南"},
                ],
            })
        ]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.search_guides("糖尿病")

        self.assertEqual(
            result,
            {
                "items": [
                    {"id": 12, "title": "2型糖尿病基层诊疗指南"},
                    {"id": 13, "title": "糖尿病足指南"},
                ]
            },
        )
        self.assertEqual(
            FakeAsyncClient.calls,
            [
                (
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/guide/search",
                    self.guide_params(keyword="糖尿病"),
                )
            ],
        )

    async def test_get_guide_detail_requires_content(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": {"content": "<p>这里是指南详情内容</p>", "title": "指南标题"},
            })
        ]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.get_guide_detail(12)

        self.assertEqual(
            result,
            {
                "id": 12,
                "title": "指南标题",
                "content": "<p>这里是指南详情内容</p>",
            },
        )
        self.assertEqual(
            FakeAsyncClient.calls,
            [
                (
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/guide/detail",
                    self.guide_params(id=12),
                )
            ],
        )

    async def test_get_guide_detail_accepts_alternate_content_fields(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": {
                    "guideName": "嵌套字段指南",
                    "detail": {"htmlContent": "<h1>嵌套详情内容</h1>"},
                },
            })
        ]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.get_guide_detail(12)

        self.assertEqual(
            result,
            {
                "id": 12,
                "title": "嵌套字段指南",
                "content": "<h1>嵌套详情内容</h1>",
            },
        )

    async def test_guide_api_requires_credentials(self):
        with patch.object(
            article,
            "settings",
            SimpleNamespace(guide_app_id="", guide_app_sign_key="", guide_app_name=""),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await article._fetch_guide_api("search", {"keyword": "糖尿病"})

        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("appId", ctx.exception.detail)
        self.assertIn("appSignKey", ctx.exception.detail)
        self.assertNotIn("appName", ctx.exception.detail)

    async def test_guide_api_does_not_require_app_name_for_signature(self):
        with patch.object(
            article,
            "settings",
            SimpleNamespace(
                guide_app_id="test-app-id",
                guide_app_sign_key="test-sign-key",
                guide_app_name="",
            ),
        ):
            with (
                patch.object(article.time, "time", return_value=1700000000.123),
                patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
            ):
                result = article._guide_api_params({"keyword": "糖尿病"})

        self.assertEqual(result, self.guide_params(keyword="糖尿病"))
        self.assertNotIn("appName", result)

    async def test_get_guide_detail_rejects_blank_content(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": {"content": "  "},
            })
        ]

        with patch.object(article.httpx, "AsyncClient", FakeAsyncClient):
            with self.assertRaises(HTTPException) as ctx:
                await article.get_guide_detail(12)

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail["message"], "指南详情内容为空")
        self.assertEqual(ctx.exception.detail["dataKeys"], ["content"])
        self.assertEqual(ctx.exception.detail["stringFields"][0]["path"], "data.content")

    async def test_debug_config_route_precedes_detail_route(self):
        guide_paths = [
            route.path
            for route in article.router.routes
            if route.path.startswith("/api/article/guides/")
        ]

        self.assertLess(
            guide_paths.index("/api/article/guides/debug-config"),
            guide_paths.index("/api/article/guides/{guide_id}"),
        )

    async def test_search_entries_normalizes_external_items(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": {"list": [
                    {"id": 21, "name": "2型糖尿病"},
                    {"id": "22", "title": "糖尿病足"},
                ]},
            })
        ]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.search_entries("糖尿病")

        self.assertEqual(
            result,
            {
                "items": [
                    {"id": 21, "name": "2型糖尿病"},
                    {"id": 22, "name": "糖尿病足"},
                ]
            },
        )
        self.assertEqual(
            FakeAsyncClient.calls,
            [
                (
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/ncd/search",
                    self.guide_params(keyword="糖尿病"),
                )
            ],
        )

    async def test_get_entry_detail_requires_content(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": {"content": "<p>这里是词条详情内容</p>", "name": "词条标题"},
            })
        ]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.get_entry_detail(21)

        self.assertEqual(
            result,
            {
                "id": 21,
                "name": "词条标题",
                "content": "<p>这里是词条详情内容</p>",
            },
        )
        self.assertEqual(
            FakeAsyncClient.calls,
            [
                (
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/ncd/detail",
                    self.guide_params(id=21),
                )
            ],
        )

    async def test_get_entry_detail_joins_structured_field_modules(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": {
                    "name": "2型糖尿病",
                    "fieldList": [
                        {"fieldName": "基础知识", "content": "<p>基础知识内容</p>"},
                        {"fieldName": "诊断", "content": "<p>诊断内容</p>"},
                    ],
                },
            })
        ]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.get_entry_detail(21)

        self.assertEqual(result["id"], 21)
        self.assertEqual(result["name"], "2型糖尿病")
        self.assertIn('<p class="rich-editor-module-heading">基础知识</p><p>基础知识内容</p>', result["content"])
        self.assertIn('<p class="rich-editor-module-heading">诊断</p><p>诊断内容</p>', result["content"])
        self.assertLess(result["content"].index("基础知识"), result["content"].index("诊断"))

    async def test_get_entry_detail_omits_empty_structured_modules(self):
        FakeAsyncClient.responses = [
            FakeGuideResponse({
                "code": "success",
                "message": "成功",
                "data": {
                    "name": "慢性肾脏病矿物质和骨异常",
                    "fieldList": [
                        {"fieldName": "慢性肾脏病矿物质和骨异常"},
                        {"fieldName": "基础知识", "content": "<p>基础知识内容</p>"},
                    ],
                },
            })
        ]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.get_entry_detail(21)

        self.assertEqual(result["name"], "慢性肾脏病矿物质和骨异常")
        self.assertNotIn(
            '<p class="rich-editor-module-heading">慢性肾脏病矿物质和骨异常</p>',
            result["content"],
        )
        self.assertIn('<p class="rich-editor-module-heading">基础知识</p>', result["content"])

    async def test_entry_debug_config_route_precedes_detail_route(self):
        entry_paths = [
            route.path
            for route in article.router.routes
            if route.path.startswith("/api/article/entries/")
        ]

        self.assertLess(
            entry_paths.index("/api/article/entries/debug-config"),
            entry_paths.index("/api/article/entries/{entry_id}"),
        )

    async def test_entry_debug_config_reports_ncd_base_url(self):
        with (
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.debug_entry_config()

        self.assertEqual(
            result["baseUrl"],
            "https://newdrugs-test.dxy.net/open-sign-api/article-quality/ncd",
        )
        self.assertEqual(result["sampleRequestParams"]["keyword"], "debug")


if __name__ == "__main__":
    unittest.main()
