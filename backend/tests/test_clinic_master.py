import os
import unittest
from unittest.mock import patch

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


if __name__ == "__main__":
    unittest.main()
