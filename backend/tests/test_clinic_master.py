import os
from datetime import datetime
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("gemini_api_key", "test-gemini-key")

from services import clinic_master


class ClinicMasterSigningTests(unittest.TestCase):
    def test_generate_signature_matches_reference_example(self):
        params = {
            "appId": 1001,
            "timestamp": 1742050000,
            "nonce": "6a8d2f3e",
            "question": "hello",
            "stream": False,
        }

        result = clinic_master.generate_signature(params, "test-key")

        self.assertEqual(result, "892a5dd8950d6d2c4a4216f4545dd2e2fa81f3b7")

    def test_signed_params_use_seconds_hyphenated_uuid_and_do_not_send_key(self):
        fake_uuid = "9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a"
        settings = type("Settings", (), {
            "clinic_master_app_id": "app-1",
            "clinic_master_app_sign_key": "secret-key",
        })()

        with (
            patch.object(clinic_master, "settings", settings),
            patch.object(clinic_master.time, "time", return_value=1742050000.9),
            patch.object(clinic_master.uuid, "uuid4", return_value=fake_uuid),
        ):
            params = clinic_master.signed_params({"question": "hello", "optional": None})

        self.assertEqual(params["timestamp"], 1742050000)
        self.assertEqual(params["nonce"], fake_uuid)
        self.assertRegex(params["nonce"], r"^[0-9a-f-]{36}$")
        self.assertNotIn("appSignKey", params)
        self.assertIn("sign", params)


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

    async def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        return self.responses.pop(0)

    async def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        return self.responses.pop(0)


class ClinicMasterClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        FakeAsyncClient.calls = []
        FakeAsyncClient.responses = []
        self.settings = type("Settings", (), {
            "clinic_master_openapi_host": "https://clinic-master.test",
            "clinic_master_app_id": "app-1",
            "clinic_master_app_sign_key": "secret-key",
            "clinic_master_timeout_seconds": 9,
        })()

    async def test_create_chat_posts_signed_json_to_stream_endpoint(self):
        FakeAsyncClient.responses = [FakeResponse({"code": "success", "data": {"chatId": "chat-1"}})]

        with (
            patch.object(clinic_master, "settings", self.settings),
            patch.object(clinic_master.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(clinic_master.time, "time", return_value=1742050000),
            patch.object(clinic_master.uuid, "uuid4", return_value="9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a"),
        ):
            result = await clinic_master.create_chat("糖尿病怎么诊断？", request_id="query-1")

        self.assertEqual(result["data"]["chatId"], "chat-1")
        method, url, kwargs = FakeAsyncClient.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "https://clinic-master.test/openapi/p/chat/stream")
        self.assertEqual(kwargs["json"]["question"], "糖尿病怎么诊断？")
        self.assertEqual(kwargs["json"]["requestId"], "query-1")
        self.assertIn("sign", kwargs["json"])
        self.assertNotIn("appSignKey", kwargs["json"])

    async def test_get_chat_references_sends_assistant_message_id(self):
        FakeAsyncClient.responses = [FakeResponse({"code": "success", "data": []})]

        with (
            patch.object(clinic_master, "settings", self.settings),
            patch.object(clinic_master.httpx, "AsyncClient", FakeAsyncClient),
        ):
            await clinic_master.get_chat_references("assistant-message-1")

        method, url, kwargs = FakeAsyncClient.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "https://clinic-master.test/openapi/p/chat/reference")
        self.assertEqual(kwargs["json"]["messageId"], "assistant-message-1")
        self.assertNotIn("appSignKey", kwargs["json"])

    async def test_get_reference_detail_uses_form_urlencoded_post(self):
        FakeAsyncClient.responses = [FakeResponse({"code": "success", "data": {"title": "参考文献"}})]

        with (
            patch.object(clinic_master, "settings", self.settings),
            patch.object(clinic_master.httpx, "AsyncClient", FakeAsyncClient),
        ):
            result = await clinic_master.get_reference_detail({"referenceId": "ref-1"})

        self.assertEqual(result["data"]["title"], "参考文献")
        method, url, kwargs = FakeAsyncClient.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "https://clinic-master.test/japi/platform/100000017")
        self.assertEqual(kwargs["data"]["referenceId"], "ref-1")
        self.assertEqual(kwargs["headers"]["Content-Type"], "application/x-www-form-urlencoded")
        self.assertIn("sign", kwargs["data"])
        self.assertNotIn("appSignKey", kwargs["data"])


class ClinicMasterRouterStateTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from routers import clinic_master as clinic_master_router

        clinic_master_router._query_store.clear()
        self.router = clinic_master_router
        self.settings = type("Settings", (), {
            "clinic_master_result_delay_seconds": 120,
        })()

    async def test_create_query_returns_pending_hyphenated_uuid_and_ready_at(self):
        fake_uuid = "9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a"
        create_chat = AsyncMock(return_value={"code": "success", "data": {"chatId": "chat-1"}})

        with (
            patch.object(self.router.uuid, "uuid4", return_value=fake_uuid),
            patch.object(self.router.time, "time", return_value=1742050000),
            patch.object(self.router, "settings", self.settings),
            patch.object(self.router.clinic_master_service, "create_chat", create_chat),
        ):
            result = await self.router.create_query(
                self.router.ClinicMasterQueryRequest(question="糖尿病怎么诊断？")
            )

        self.assertEqual(result["query_id"], fake_uuid)
        self.assertEqual(result["status"], "pending")
        self.assertEqual(result["materials"], [])
        self.assertEqual(result["warnings"], [])
        self.assertRegex(result["query_id"], r"^[0-9a-f-]{36}$")
        self.assertGreater(
            datetime.fromisoformat(result["ready_at"]),
            datetime.fromisoformat(result["created_at"]),
        )
        create_chat.assert_awaited_once_with("糖尿病怎么诊断？", request_id=fake_uuid)

    async def test_refresh_before_ready_at_does_not_call_external_detail_apis(self):
        fake_uuid = "9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a"

        with (
            patch.object(self.router.uuid, "uuid4", return_value=fake_uuid),
            patch.object(self.router.time, "time", return_value=1742050000),
            patch.object(self.router, "settings", self.settings),
            patch.object(self.router.clinic_master_service, "create_chat", AsyncMock(return_value={"data": {}})),
        ):
            await self.router.create_query(self.router.ClinicMasterQueryRequest(question="糖尿病"))

        get_detail = AsyncMock()
        with (
            patch.object(self.router.time, "time", return_value=1742050060),
            patch.object(self.router.clinic_master_service, "get_chat_detail", get_detail),
        ):
            result = await self.router.refresh_query(fake_uuid)

        self.assertEqual(result["status"], "pending")
        get_detail.assert_not_called()

    async def test_get_query_returns_cached_state_without_external_calls(self):
        fake_uuid = "9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a"
        with (
            patch.object(self.router.uuid, "uuid4", return_value=fake_uuid),
            patch.object(self.router.time, "time", return_value=1742050000),
            patch.object(self.router, "settings", self.settings),
            patch.object(self.router.clinic_master_service, "create_chat", AsyncMock(return_value={"data": {}})),
        ):
            await self.router.create_query(self.router.ClinicMasterQueryRequest(question="糖尿病"))

        with patch.object(self.router.clinic_master_service, "get_chat_detail", AsyncMock()) as get_detail:
            result = await self.router.get_query(fake_uuid)

        self.assertEqual(result["query_id"], fake_uuid)
        self.assertEqual(result["status"], "pending")
        get_detail.assert_not_called()

    async def test_unknown_query_returns_404(self):
        with self.assertRaises(Exception) as ctx:
            await self.router.get_query("missing-query")

        self.assertEqual(getattr(ctx.exception, "status_code", None), 404)


if __name__ == "__main__":
    unittest.main()
