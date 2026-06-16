import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from services import ai_audit
from services import deepseek
from services import gemini
from services import text_llm
from services import utils


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
        mock_gemini.assert_awaited_once_with(
            "prompt",
            "sys",
            context="ctx",
            runtime_config={"text_model_provider": "gemini"},
        )

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

    async def test_section_review_deepseek_uses_stable_low_temperature(self):
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
            result = await text_llm.generate_text("prompt", "sys", context="section_analysis")

        self.assertEqual(result, "ok")
        sent_config = mock_deepseek.await_args.kwargs["runtime_config"]
        self.assertEqual(sent_config["deepseek_temperature"], 0.2)
        self.assertEqual(sent_config["deepseek_top_p"], 0.9)
        self.assertEqual(runtime_config["deepseek_temperature"], 0.7)

    async def test_rejects_unknown_provider(self):
        with patch(
            "services.text_llm.get_effective_text_config",
            return_value={"text_model_provider": "bad-provider"},
        ):
            with self.assertRaises(ValueError):
                await text_llm.generate_text("prompt")

    async def test_generate_json_retries_malformed_json(self):
        calls = []

        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            calls.append({
                "prompt": prompt,
                "system_instruction": system_instruction,
                "context": context,
            })
            if len(calls) == 1:
                return '{"issues":[{"description":"严重程度没有加引号", "severity": high}]}'
            self.assertIn("不是合法JSON", prompt)
            self.assertIn("只输出JSON对象", prompt)
            return '{"issues":[]}'

        result = await text_llm.generate_json(
            "原始任务",
            "系统提示",
            context="section_analysis",
            text_generator=fake_generate_text,
        )

        self.assertEqual(result, {"issues": []})
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["context"], "section_analysis")
        self.assertEqual(calls[1]["context"], "section_analysis_json_retry")

    async def test_extract_json_repairs_missing_comma_after_anchor_object(self):
        text = """{
  "issues": [
    {
      "issue_type": "missing_content",
      "severity": "medium",
      "examples": ["低中危风险（10-15%） | T3a"],
      "anchors": [
        {"quote": "低中危风险（10-15%） | T3a", "heading_hint": "1、 2025 ATA 指南[⁷⁰⁶]复发风险评估见表 14。"}
      ]
      "guideline_evidence": []
    }
  ]
}"""

        result = utils.extract_json(text)

        self.assertEqual(
            result["issues"][0]["anchors"][0]["quote"],
            "低中危风险（10-15%） | T3a",
        )

    async def test_extract_json_repairs_missing_comma_after_examples_array(self):
        text = """{
  "issues": [
    {
      "issue_type": "missing_content",
      "examples": [
        "章节内容仅提及\\"儿童DTC术后须接受甲状腺激素治疗\\"，未给出具体TSH抑制目标。"
      ]
      "anchors": [
        {"quote": "儿童DTC术后须接受甲状腺激素治疗。", "heading_hint": "初始手术治疗"}
      ]
    }
  ]
}"""

        result = utils.extract_json(text)

        self.assertEqual(
            result["issues"][0]["anchors"][0]["heading_hint"],
            "初始手术治疗",
        )

    async def test_extract_json_repairs_missing_comma_after_number_literal(self):
        text = """{
  "issues": [
    {
      "deduction_score": 3.0
      "is_key_content": true
    }
  ]
}"""

        result = utils.extract_json(text)

        self.assertEqual(result["issues"][0]["deduction_score"], 3.0)
        self.assertTrue(result["issues"][0]["is_key_content"])

    async def test_extract_json_repairs_missing_comma_between_issue_objects(self):
        text = """{
  "issues": [
    {
      "deduction_score": 3.0,
      "is_key_content": true
    }
    {
      "deduction_score": 1.0,
      "is_key_content": false
    }
  ]
}"""

        result = utils.extract_json(text)

        self.assertEqual(len(result["issues"]), 2)
        self.assertFalse(result["issues"][1]["is_key_content"])

    async def test_extract_json_repairs_same_line_missing_comma_between_evidence_objects(self):
        text = """{
  "issues": [
    {
      "guideline_evidence": [
        {"source": "参考数据源 12", "quote": "Excellent: Nonstimulated Tg <2.5"} {"source": "参考数据源 12", "quote": "Biochemically incomplete: Nonstimulated Tg >5"}
      ]
    }
  ]
}"""

        result = utils.extract_json(text)

        self.assertEqual(len(result["issues"][0]["guideline_evidence"]), 2)
        self.assertIn("Biochemically incomplete", result["issues"][0]["guideline_evidence"][1]["quote"])


class AiRequestLogTests(unittest.TestCase):
    def test_save_ai_request_payload_writes_local_json(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(
            ai_audit, "REQUEST_LOG_DIR", Path(tmp)
        ), patch.object(
            ai_audit, "get_current_user_context", return_value={"id": "user-1"}
        ):
            path = ai_audit.save_ai_request_payload(
                context="section_analysis",
                provider="deepseek",
                model="deepseek-chat",
                audit={"prompt_chars": 12},
                request={"messages": [{"role": "user", "content": "hello"}]},
            )

            saved = Path(path)
            data = json.loads(saved.read_text(encoding="utf-8"))

        self.assertTrue(path)
        self.assertEqual(data["user_id"], "user-1")
        self.assertEqual(data["context"], "section_analysis")
        self.assertEqual(data["provider"], "deepseek")
        self.assertEqual(data["audit"]["prompt_chars"], 12)
        self.assertEqual(data["request"]["messages"][0]["content"], "hello")


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


class _RaisingAsyncClient:
    def __init__(self, exc):
        self.exc = exc
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        self.calls.append({"url": url, "headers": headers, "json": json})
        raise self.exc


class DeepSeekClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._request_log_patcher = patch.object(
            deepseek.ai_audit,
            "save_ai_request_payload",
            return_value="/tmp/ai-request.json",
        )
        self._request_log_patcher.start()

    def tearDown(self):
        self._request_log_patcher.stop()

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
            deepseek_presence_penalty=0,
            deepseek_frequency_penalty=0,
            deepseek_response_format="text",
            deepseek_thinking_type="disabled",
            deepseek_reasoning_effort="high",
            deepseek_timeout_seconds=60,
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
        self.assertEqual(fake_client.calls[0]["json"]["thinking"], {"type": "disabled"})
        self.assertEqual(fake_client.calls[0]["json"]["presence_penalty"], 0)
        self.assertEqual(fake_client.calls[0]["json"]["frequency_penalty"], 0)

    async def test_deepseek_thinking_mode_skips_sampling_params(self):
        fake_client = _FakeAsyncClient(
            {
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            }
        )
        fake_settings = SimpleNamespace(
            deepseek_api_key="secret",
            deepseek_model="deepseek-chat",
            deepseek_base_url="https://api.deepseek.com",
            deepseek_temperature=0.7,
            deepseek_top_p=1.0,
            deepseek_max_tokens=0,
            deepseek_presence_penalty=0,
            deepseek_frequency_penalty=0,
            deepseek_response_format="text",
            deepseek_thinking_type="disabled",
            deepseek_reasoning_effort="high",
            deepseek_timeout_seconds=60,
        )
        fake_httpx = SimpleNamespace(AsyncClient=lambda **kwargs: fake_client)
        runtime_config = {
            "deepseek_thinking_type": "enabled",
            "deepseek_reasoning_effort": "max",
            "deepseek_temperature": 0.2,
            "deepseek_top_p": 0.4,
            "deepseek_presence_penalty": 1.0,
            "deepseek_frequency_penalty": 1.0,
        }

        with patch.object(deepseek, "settings", fake_settings, create=True), patch.object(
            deepseek, "httpx", fake_httpx, create=True
        ):
            await deepseek.generate_text_with_deepseek("user prompt", runtime_config=runtime_config)

        payload = fake_client.calls[0]["json"]
        self.assertEqual(payload["thinking"], {"type": "enabled"})
        self.assertEqual(payload["reasoning_effort"], "max")
        self.assertNotIn("temperature", payload)
        self.assertNotIn("top_p", payload)
        self.assertNotIn("presence_penalty", payload)
        self.assertNotIn("frequency_penalty", payload)

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

    async def test_deepseek_raises_when_output_hits_length_limit(self):
        fake_client = _FakeAsyncClient(
            {
                "choices": [
                    {
                        "message": {"content": '{"issues":[{"description":"半截JSON"'},
                        "finish_reason": "length",
                    }
                ],
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 8192,
                    "total_tokens": 8292,
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
            deepseek_presence_penalty=0,
            deepseek_frequency_penalty=0,
            deepseek_response_format="text",
            deepseek_thinking_type="disabled",
            deepseek_reasoning_effort="high",
            deepseek_timeout_seconds=60,
            deepseek_context_window_tokens=64000,
        )
        fake_httpx = SimpleNamespace(AsyncClient=lambda **kwargs: fake_client)

        with patch.object(deepseek, "settings", fake_settings, create=True), patch.object(
            deepseek, "httpx", fake_httpx, create=True
        ):
            with self.assertRaisesRegex(ValueError, "输出被模型截断"):
                await deepseek.generate_text_with_deepseek("user prompt")

    async def test_deepseek_timeout_error_includes_message_when_exception_string_is_empty(self):
        fake_client = _RaisingAsyncClient(deepseek.httpx.ReadTimeout(""))
        fake_settings = SimpleNamespace(
            deepseek_api_key="secret",
            deepseek_model="deepseek-chat",
            deepseek_base_url="https://api.deepseek.com",
            deepseek_temperature=0.7,
            deepseek_top_p=1.0,
            deepseek_max_tokens=32768,
            deepseek_presence_penalty=0,
            deepseek_frequency_penalty=0,
            deepseek_response_format="text",
            deepseek_thinking_type="disabled",
            deepseek_reasoning_effort="high",
            deepseek_timeout_seconds=60,
            deepseek_context_window_tokens=64000,
        )
        fake_httpx = SimpleNamespace(
            AsyncClient=lambda **kwargs: fake_client,
            TimeoutException=deepseek.httpx.TimeoutException,
            ReadTimeout=deepseek.httpx.ReadTimeout,
        )

        with patch.object(deepseek, "settings", fake_settings, create=True), patch.object(
            deepseek, "httpx", fake_httpx, create=True
        ), patch.object(deepseek.ai_audit, "record_ai_call") as mock_record:
            with self.assertRaisesRegex(ValueError, "DeepSeek 请求超时"):
                await deepseek.generate_text_with_deepseek("user prompt")

        self.assertIn("DeepSeek 请求超时", mock_record.call_args.kwargs["error"])


class GeminiClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._request_log_patcher = patch.object(
            gemini.ai_audit,
            "save_ai_request_payload",
            return_value="/tmp/ai-request.json",
        )
        self._request_log_patcher.start()

    def tearDown(self):
        self._request_log_patcher.stop()

    async def test_gemini_raises_when_output_hits_max_tokens(self):
        class FakeModel:
            def generate_content(self, prompt):
                candidate = SimpleNamespace(finish_reason=SimpleNamespace(name="MAX_TOKENS"))
                usage = SimpleNamespace(
                    prompt_token_count=100,
                    candidates_token_count=8192,
                    total_token_count=8292,
                )
                return SimpleNamespace(
                    candidates=[candidate],
                    usage_metadata=usage,
                    text='{"issues":[{"description":"半截JSON"',
                )

        with patch.object(gemini, "get_model", return_value=FakeModel()), patch.object(
            gemini.ai_audit,
            "raise_if_context_exceeded",
            return_value={
                "prompt_chars": 100,
                "estimated_prompt_tokens": 100,
                "context_window_tokens": 1000000,
                "context_usage_ratio": 0.0001,
                "warning": "",
            },
        ), patch.object(gemini.ai_audit, "record_ai_call"):
            with self.assertRaisesRegex(ValueError, "输出被模型截断"):
                await gemini.generate_text_with_gemini("user prompt")


if __name__ == "__main__":
    unittest.main()
