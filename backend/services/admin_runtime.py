import json
from pathlib import Path

from auth import get_current_user_context
from config import settings

CONFIG_PATH = Path(__file__).parent.parent / "data" / "admin_runtime_config.json"

DEFAULT_CONFIG = {
    "scope": "admin_only",
    "text_model_provider": "",
    "deepseek_model": "",
    "deepseek_base_url": "",
    "deepseek_temperature": None,
    "deepseek_top_p": None,
    "deepseek_max_tokens": None,
    "deepseek_context_window_tokens": None,
    "gemini_context_window_tokens": None,
}


def _base_text_config() -> dict:
    return {
        "text_model_provider": settings.text_model_provider,
        "deepseek_model": settings.deepseek_model,
        "deepseek_base_url": settings.deepseek_base_url,
        "deepseek_temperature": settings.deepseek_temperature,
        "deepseek_top_p": settings.deepseek_top_p,
        "deepseek_max_tokens": settings.deepseek_max_tokens,
        "deepseek_context_window_tokens": getattr(settings, "deepseek_context_window_tokens", 64000),
        "gemini_context_window_tokens": getattr(settings, "gemini_context_window_tokens", 1000000),
    }


def load_runtime_config() -> dict:
    if not CONFIG_PATH.exists():
        return dict(DEFAULT_CONFIG)
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return dict(DEFAULT_CONFIG)
    return {**DEFAULT_CONFIG, **data}


def save_runtime_config(payload: dict) -> dict:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {**DEFAULT_CONFIG, **payload}
    CONFIG_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return data


def get_effective_text_config(user: dict = None) -> dict:
    user = user if user is not None else get_current_user_context()
    runtime = load_runtime_config()
    effective = _base_text_config()
    scope = runtime.get("scope") or "admin_only"
    is_admin = bool(user and user.get("is_admin"))
    should_apply = scope == "global" or (scope == "admin_only" and is_admin)
    if not should_apply:
        return effective

    for key in effective.keys():
        value = runtime.get(key)
        if value not in (None, ""):
            effective[key] = value
    return effective


def get_admin_runtime_payload() -> dict:
    runtime = load_runtime_config()
    defaults = _base_text_config()
    return {
        "config": runtime,
        "defaults": defaults,
        "has_deepseek_api_key": bool(settings.deepseek_api_key),
    }
