import logging
import time

import httpx

from config import settings
from services import ai_audit

_log = logging.getLogger(__name__)


def _build_messages(prompt: str, system_instruction: str = None) -> list:
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})
    return messages


def _get_param(runtime_config: dict, key: str, fallback):
    if runtime_config is None:
        return fallback
    value = runtime_config.get(key)
    return fallback if value in (None, "") else value


async def generate_text_with_deepseek(
    prompt: str,
    system_instruction: str = None,
    context: str = "unknown",
    runtime_config: dict = None,
) -> str:
    if not settings.deepseek_api_key:
        raise ValueError("未配置 DEEPSEEK_API_KEY")

    model = _get_param(runtime_config, "deepseek_model", settings.deepseek_model)
    base_url = _get_param(runtime_config, "deepseek_base_url", settings.deepseek_base_url)
    temperature = _get_param(runtime_config, "deepseek_temperature", settings.deepseek_temperature)
    top_p = _get_param(runtime_config, "deepseek_top_p", settings.deepseek_top_p)
    max_tokens = _get_param(runtime_config, "deepseek_max_tokens", settings.deepseek_max_tokens)
    presence_penalty = _get_param(runtime_config, "deepseek_presence_penalty", getattr(settings, "deepseek_presence_penalty", 0))
    frequency_penalty = _get_param(runtime_config, "deepseek_frequency_penalty", getattr(settings, "deepseek_frequency_penalty", 0))
    response_format = _get_param(runtime_config, "deepseek_response_format", getattr(settings, "deepseek_response_format", "text"))
    thinking_type = _get_param(runtime_config, "deepseek_thinking_type", getattr(settings, "deepseek_thinking_type", "disabled"))
    reasoning_effort = _get_param(runtime_config, "deepseek_reasoning_effort", getattr(settings, "deepseek_reasoning_effort", "high"))
    timeout_seconds = _get_param(runtime_config, "deepseek_timeout_seconds", getattr(settings, "deepseek_timeout_seconds", 60))
    context_window = _get_param(
        runtime_config,
        "deepseek_context_window_tokens",
        getattr(settings, "deepseek_context_window_tokens", 64000),
    )
    audit = ai_audit.raise_if_context_exceeded(
        "deepseek", model, context, prompt, system_instruction,
        context_window_tokens=context_window,
    )

    url = str(base_url).rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "messages": _build_messages(prompt, system_instruction),
    }
    if thinking_type in {"enabled", "disabled"}:
        payload["thinking"] = {"type": thinking_type}
    if thinking_type == "enabled":
        if reasoning_effort in {"high", "max"}:
            payload["reasoning_effort"] = reasoning_effort
    else:
        payload["temperature"] = temperature
        payload["top_p"] = top_p
        if presence_penalty not in (None, ""):
            payload["presence_penalty"] = presence_penalty
        if frequency_penalty not in (None, ""):
            payload["frequency_penalty"] = frequency_penalty
    if max_tokens:
        payload["max_tokens"] = max_tokens
    if response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }

    started_at = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=float(timeout_seconds or 60)) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)

        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise ValueError("DeepSeek 返回了空响应，请重试")

        choice = choices[0]
        finish_reason = str(choice.get("finish_reason", "")).lower()
        if finish_reason and finish_reason not in {"stop", "length"}:
            raise ValueError(f"DeepSeek 生成异常终止（finish_reason={finish_reason})")

        message = choice.get("message") or {}
        text = (message.get("content") or "").strip()

        usage = data.get("usage") or {}
        _log.info(
            "llm_call context=%s provider=deepseek model=%s prompt_tokens=%s output_tokens=%s total_tokens=%s elapsed_ms=%s prompt_chars=%s warning=%s",
            context,
            model,
            usage.get("prompt_tokens"),
            usage.get("completion_tokens"),
            usage.get("total_tokens"),
            elapsed_ms,
            audit["prompt_chars"],
            audit["warning"],
        )

        if not text:
            raise ValueError("模型返回了空响应，请重试")

        ai_audit.record_ai_call(
            context=context,
            provider="deepseek",
            model=model,
            prompt_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
            elapsed_ms=elapsed_ms,
            status="success",
            **audit,
        )
        return text
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        ai_audit.record_ai_call(
            context=context,
            provider="deepseek",
            model=model,
            elapsed_ms=elapsed_ms,
            status="error",
            error=str(e)[:500],
            **audit,
        )
        raise
