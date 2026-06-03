import logging
import time

import httpx

from config import settings

_log = logging.getLogger(__name__)


def _build_messages(prompt: str, system_instruction: str = None) -> list:
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})
    return messages


async def generate_text_with_deepseek(
    prompt: str,
    system_instruction: str = None,
    context: str = "unknown",
) -> str:
    if not settings.deepseek_api_key:
        raise ValueError("未配置 DEEPSEEK_API_KEY")

    url = settings.deepseek_base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": settings.deepseek_model,
        "messages": _build_messages(prompt, system_instruction),
    }
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }

    started_at = time.perf_counter()
    async with httpx.AsyncClient(timeout=60.0) as client:
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
        "gemini_call context=%s model=%s prompt_tokens=%s output_tokens=%s total_tokens=%s elapsed_ms=%s prompt_chars=%s",
        context,
        settings.deepseek_model,
        usage.get("prompt_tokens"),
        usage.get("completion_tokens"),
        usage.get("total_tokens"),
        elapsed_ms,
        len(prompt),
    )

    if not text:
        raise ValueError("模型返回了空响应，请重试")
    return text
