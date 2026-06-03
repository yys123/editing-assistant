import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from services import deepseek
from services import text_llm


class TextLlmRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_routes_to_gemini_when_provider_is_gemini(self):
        with patch(
            "services.text_llm.get_effective_text_config",
            return_value={"text_model_provider": "gemini"},
        ), patch(
            "services.text_llm.generate_text_with_gemini",
            new=AsyncMock(return_value="ok"),
        ) as mock_gemini:
            result = await text_llm.generate_text("prompt", "sys", context="ctx")

        self.assertEqual(result, "ok")
        mock_gemini.assert_awaited_once_with("prompt", "sys", context="ctx")

    async def test_routes_to_deepseek_when_provider_is_deepseek(self):
        runtime_config = {
            "text_model_provider": "deepseek",
            "deepseek_model": "deepseek-chat",
            "deepseek_base_url": "https://api.deepseek.com",
            "deepseek_temperature": 0.7,
            "deepseek_top_p": 1.0,
            "deepseek_max_tokens": 0,
        }
        with patch(
            "services.text_llm.get_effective_text_config",
            return_value=runtime_config,
        ), patch(
            "services.text_llm.generate_text_with_deepseek",
            new=AsyncMock(return_value="ok"),
        ) as mock_deepseek:
            result = await text_llm.generate_text("prompt", "sys", context="ctx")

        self.assertEqual(result, "ok")
        mock_deepseek.assert_awaited_once_with(
            "prompt",
            "sys",
            context="ctx",
            runtime_config=runtime_config,
        )

    async def test_rejects_unknown_provider(self):
        with patch(
            "services.text_llm.get_effective_text_config",
            return_value={"text_model_provider": "bad-provider"},
        ):
            with self.assertRaises(ValueError):
                await text_llm.generate_text("prompt")


class _FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class _FakeAsyncClient:
    def __init__(self, response_payload):
        self.response_payload = response_payload
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return _FakeResponse(self.response_payload)


class DeepSeekClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_deepseek_combines_system_and_user_messages(self):
        fake_client = _FakeAsyncClient(
            {
                "choices": [
                    {
                        "message": {"content": "  deepseek output  "},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 12,
                    "completion_tokens": 4,
                    "total_tokens": 16,
                },
            }
        )

        fake_settings = SimpleNamespace(
            deepseek_api_key="secret",
            deepseek_model="deepseek-chat",
            deepseek_base_url="https://api.deepseek.com",
            deepseek_temperature=0.7,
            deepseek_top_p=1.0,
            deepseek_max_tokens=0,
        )
        fake_httpx = SimpleNamespace(AsyncClient=lambda **kwargs: fake_client)

        with patch.object(deepseek, "settings", fake_settings, create=True), patch.object(
            deepseek, "httpx", fake_httpx, create=True
        ):
            result = await deepseek.generate_text_with_deepseek(
                "user prompt", "system prompt", context="ctx"
            )

        self.assertEqual(result, "deepseek output")
        self.assertEqual(len(fake_client.calls), 1)
        self.assertEqual(fake_client.calls[0]["url"], "https://api.deepseek.com/chat/completions")
        self.assertEqual(
            fake_client.calls[0]["json"]["messages"],
            [
                {"role": "system", "content": "system prompt"},
                {"role": "user", "content": "user prompt"},
            ],
        )

    async def test_deepseek_raises_on_empty_text(self):
        fake_client = _FakeAsyncClient(
            {
                "choices": [
                    {
                        "message": {"content": "   "},
                        "finish_reason": "stop",
                    }
                ]
            }
        )

        fake_settings = SimpleNamespace(
            deepseek_api_key="secret",
            deepseek_model="deepseek-chat",
            deepseek_base_url="https://api.deepseek.com",
            deepseek_temperature=0.7,
            deepseek_top_p=1.0,
            deepseek_max_tokens=0,
        )
        fake_httpx = SimpleNamespace(AsyncClient=lambda **kwargs: fake_client)

        with patch.object(deepseek, "settings", fake_settings, create=True), patch.object(
            deepseek, "httpx", fake_httpx, create=True
        ):
            with self.assertRaises(ValueError):
                await deepseek.generate_text_with_deepseek("user prompt")


if __name__ == "__main__":
    unittest.main()
