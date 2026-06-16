import math
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import db
from auth import get_current_user_context
from config import settings

REQUEST_LOG_DIR = Path(__file__).parent.parent / "data" / "ai_requests"


def estimate_prompt_tokens(text: str) -> int:
    """Conservative token estimate without provider tokenizers.

    CJK characters are close to one token each; ASCII text is roughly four chars
    per token. This is only for preflight risk detection. Provider usage remains
    the source of truth after successful calls.
    """
    if not text:
        return 0
    cjk = 0
    ascii_chars = 0
    other = 0
    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            cjk += 1
        elif ord(ch) < 128:
            ascii_chars += 1
        else:
            other += 1
    return int(math.ceil(cjk + other * 0.8 + ascii_chars / 4))


def get_context_window_tokens(provider: str, model: str = "") -> Optional[int]:
    provider = (provider or "").strip().lower()
    if provider == "gemini":
        return settings.gemini_context_window_tokens
    if provider == "deepseek":
        return settings.deepseek_context_window_tokens
    return None


def context_warning(estimated_tokens: int, context_window_tokens: Optional[int]) -> str:
    if not context_window_tokens:
        return ""
    ratio = estimated_tokens / context_window_tokens
    if ratio > 1:
        return "over_context_window"
    if ratio >= 0.8:
        return "near_context_window"
    return ""


def current_user_id() -> Optional[str]:
    user = get_current_user_context()
    return user.get("id") if user else None


def _safe_slug(value: str, fallback: str = "unknown") -> str:
    slug = re.sub(r"[^a-zA-Z0-9_.-]+", "_", value or "").strip("._-")
    return (slug or fallback)[:80]


def save_ai_request_payload(
    *,
    context: str,
    provider: str,
    model: str,
    request: dict,
    audit: dict = None,
) -> str:
    """Best-effort local snapshot of the exact payload sent to the AI provider."""
    try:
        now = datetime.now(timezone.utc)
        call_id = uuid.uuid4().hex
        day_dir = REQUEST_LOG_DIR / now.strftime("%Y-%m-%d")
        day_dir.mkdir(parents=True, exist_ok=True)
        filename = (
            f"{now.strftime('%H%M%S_%f')}_"
            f"{_safe_slug(context)}_{_safe_slug(provider)}_{call_id[:8]}.json"
        )
        payload = {
            "id": call_id,
            "created_at": now.isoformat(),
            "user_id": current_user_id(),
            "context": context or "unknown",
            "provider": provider or "unknown",
            "model": model or "unknown",
            "audit": audit or {},
            "request": request,
        }
        path = day_dir / filename
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
        return str(path)
    except Exception:
        return ""


def record_ai_call(**entry) -> None:
    """Best-effort logging; AI calls must not fail because audit logging failed."""
    try:
        db.insert_ai_call_log({**entry, "user_id": entry.get("user_id") or current_user_id()})
    except Exception:
        return


def build_preflight(
    provider: str,
    model: str,
    prompt: str,
    system_instruction: str = None,
    context_window_tokens: Optional[int] = None,
) -> dict:
    full_prompt = f"{system_instruction or ''}\n{prompt or ''}"
    estimated = estimate_prompt_tokens(full_prompt)
    window = context_window_tokens or get_context_window_tokens(provider, model)
    ratio = (estimated / window) if window else None
    warning = context_warning(estimated, window)
    return {
        "prompt_chars": len(full_prompt),
        "estimated_prompt_tokens": estimated,
        "context_window_tokens": window,
        "context_usage_ratio": ratio,
        "warning": warning,
    }


def raise_if_context_exceeded(
    provider: str,
    model: str,
    context: str,
    prompt: str,
    system_instruction: str = None,
    context_window_tokens: Optional[int] = None,
) -> dict:
    preflight = build_preflight(
        provider, model, prompt, system_instruction,
        context_window_tokens=context_window_tokens,
    )
    if preflight["warning"] == "over_context_window":
        record_ai_call(
            context=context,
            provider=provider,
            model=model,
            status="context_over_limit",
            error=(
                f"估算输入 {preflight['estimated_prompt_tokens']} tokens，"
                f"超过模型上下文 {preflight['context_window_tokens']} tokens"
            ),
            **preflight,
        )
        raise ValueError(
            "本次发送给模型的内容可能超过上下文限制："
            f"估算 {preflight['estimated_prompt_tokens']} tokens，"
            f"模型上限 {preflight['context_window_tokens']} tokens。"
            "请减少参考资料或调大分批策略。"
        )
    return preflight
