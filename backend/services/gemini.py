import os
import asyncio
import logging
import time
from datetime import date
import google.generativeai as genai
from config import settings
from services import ai_audit

# Use REST transport so HTTP_PROXY / HTTPS_PROXY env vars are respected.
# Do not force a local proxy by default: if that port is not running, every
# Gemini request fails before reaching Google. Set GEMINI_PROXY explicitly when
# a local network proxy is required, for example http://127.0.0.1:7890.
if settings.gemini_proxy:
    os.environ.setdefault("HTTPS_PROXY", settings.gemini_proxy)
    os.environ.setdefault("HTTP_PROXY", settings.gemini_proxy)

genai.configure(api_key=settings.gemini_api_key, transport="rest")

_model_cache: dict = {}
_log = logging.getLogger(__name__)


def _date_prefix() -> str:
    """Return a one-line current-date notice to inject into every system instruction."""
    today = date.today()
    return f"【系统当前日期：{today.year}年{today.month:02d}月{today.day:02d}日】"


def _build_system_instruction(system_instruction: str = None) -> str:
    date_line = _date_prefix()
    return f"{date_line}\n{system_instruction}" if system_instruction else date_line


def get_model(system_instruction: str = None) -> genai.GenerativeModel:
    """Return a cached GenerativeModel, always prepending today's date to the
    system instruction so the model never draws stale temporal conclusions."""
    full_instruction = _build_system_instruction(system_instruction)
    # Cache key includes the date so the model object refreshes each day.
    key = full_instruction
    if key not in _model_cache:
        _model_cache[key] = genai.GenerativeModel(
            settings.gemini_model,
            system_instruction=full_instruction,
        )
    return _model_cache[key]


async def analyze_image(image_bytes: bytes, mime_type: str, caption: str = "") -> str:
    """Use Gemini vision to extract content from a medical figure (flowchart, diagram, etc.).

    Returns extracted text content, or empty string on failure.
    """
    model = get_model()
    caption_hint = f"「{caption}」" if caption else "（无标题）"
    prompt_parts = [
        {"mime_type": mime_type, "data": image_bytes},
        (
            f"这是一张医学图表，标题为 {caption_hint}。"
            "请提取图中所有文字内容，按逻辑顺序整理输出。"
            "如果是流程图，按步骤描述流程；如果是表格，按行列整理；如果是其他类型，提取所有关键信息。"
            "只输出提取到的内容，不要描述图的格式或添加额外说明。"
        ),
    ]

    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(None, model.generate_content, prompt_parts)
        if not response.candidates:
            return ""
        text = response.text
        return text.strip() if text else ""
    except Exception:
        return ""


async def generate_text_with_gemini(
    prompt: str,
    system_instruction: str = None,
    context: str = "unknown",
    runtime_config: dict = None,
) -> str:
    model = get_model(system_instruction)
    loop = asyncio.get_event_loop()
    context_window = None
    if runtime_config:
        context_window = runtime_config.get("gemini_context_window_tokens")
    audit = ai_audit.raise_if_context_exceeded(
        "gemini", settings.gemini_model, context, prompt, system_instruction,
        context_window_tokens=context_window,
    )
    request_log_path = ai_audit.save_ai_request_payload(
        context=context,
        provider="gemini",
        model=settings.gemini_model,
        audit=audit,
        request={
            "system_instruction": _build_system_instruction(system_instruction),
            "prompt": prompt,
        },
    )
    started_at = time.perf_counter()
    try:
        response = await loop.run_in_executor(None, model.generate_content, prompt)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        usage = getattr(response, "usage_metadata", None)
        prompt_tokens = getattr(usage, "prompt_token_count", None)
        output_tokens = getattr(usage, "candidates_token_count", None)
        total_tokens = getattr(usage, "total_token_count", None)
        _log.info(
            "llm_call context=%s provider=gemini model=%s prompt_tokens=%s output_tokens=%s total_tokens=%s elapsed_ms=%s prompt_chars=%s warning=%s",
            context,
            settings.gemini_model,
            prompt_tokens,
            output_tokens,
            total_tokens,
            elapsed_ms,
            audit["prompt_chars"],
            audit["warning"],
        )

        # Handle blocked prompt
        if not response.candidates:
            block_reason = getattr(getattr(response, 'prompt_feedback', None), 'block_reason', 'unknown')
            raise ValueError(f"请求被模型拒绝（block_reason={block_reason}）")

        candidate = response.candidates[0]
        finish = candidate.finish_reason.name if hasattr(candidate.finish_reason, 'name') else str(candidate.finish_reason)
        if finish in ('MAX_TOKENS', '2'):
            raise ValueError(
                "Gemini 输出被模型截断（finish_reason=MAX_TOKENS，"
                f"output_tokens={output_tokens}）。"
                "请减少单次分析内容或提高模型输出上限后重试。"
            )
        if finish not in ('STOP', '1'):
            raise ValueError(f"生成异常终止（finish_reason={finish}）")

        text = response.text
        if not text or not text.strip():
            raise ValueError("模型返回了空响应，请重试")

        ai_audit.record_ai_call(
            context=context,
            provider="gemini",
            model=settings.gemini_model,
            prompt_tokens=prompt_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            elapsed_ms=elapsed_ms,
            status="success",
            request_log_path=request_log_path,
            **audit,
        )
        return text
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        ai_audit.record_ai_call(
            context=context,
            provider="gemini",
            model=settings.gemini_model,
            elapsed_ms=elapsed_ms,
            status="error",
            error=str(e)[:500],
            request_log_path=request_log_path,
            **audit,
        )
        raise
