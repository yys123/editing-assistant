import json
from pathlib import Path
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from services.admin_runtime import get_admin_runtime_payload, save_runtime_config
from services import admin_activity
from services.ai_audit import REQUEST_LOG_DIR
import db

router = APIRouter(prefix="/api/admin", tags=["admin"])


class RuntimeConfigRequest(BaseModel):
    scope: Literal["admin_only", "global"] = "admin_only"
    text_model_provider: Literal["gemini", "deepseek"] = "deepseek"
    deepseek_model: str = "deepseek-v4-flash"
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_temperature: Optional[float] = None
    deepseek_top_p: Optional[float] = None
    deepseek_max_tokens: Optional[int] = None
    deepseek_presence_penalty: Optional[float] = None
    deepseek_frequency_penalty: Optional[float] = None
    deepseek_response_format: Literal["text", "json_object"] = "text"
    deepseek_thinking_type: Literal["disabled", "enabled"] = "enabled"
    deepseek_reasoning_effort: Literal["high", "max"] = "high"
    deepseek_timeout_seconds: Optional[int] = None
    deepseek_context_window_tokens: Optional[int] = None
    gemini_context_window_tokens: Optional[int] = None


def _require_admin(user: dict):
    if not user.get("is_admin"):
        raise HTTPException(403, "仅管理员可访问")


def _path_is_inside(path: Path, base_dir: Path) -> bool:
    try:
        path.relative_to(base_dir)
        return True
    except ValueError:
        return False


def _request_log_path_is_readable(request_log_path: str) -> bool:
    request_log_path = (request_log_path or "").strip()
    if not request_log_path:
        return False
    base_dir = REQUEST_LOG_DIR.resolve()
    path = Path(request_log_path).resolve()
    return (
        _path_is_inside(path, base_dir)
        and path.suffix.lower() == ".json"
        and path.is_file()
    )


def _sanitize_ai_call_log(log: dict) -> dict:
    sanitized = dict(log)
    if not _request_log_path_is_readable(sanitized.get("request_log_path", "")):
        sanitized["request_log_path"] = ""
    return sanitized


def _format_request_part(value) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def _extract_prompt_text(payload: dict) -> str:
    request = payload.get("request") if isinstance(payload, dict) else {}
    if not isinstance(request, dict):
        return ""

    parts = []
    system_instruction = request.get("system_instruction")
    prompt = request.get("prompt")
    if system_instruction:
        parts.append(f"[system]\n{_format_request_part(system_instruction)}")
    if prompt:
        parts.append(f"[user]\n{_format_request_part(prompt)}")

    provider_payload = request.get("payload")
    if isinstance(provider_payload, dict):
        messages = provider_payload.get("messages")
        if isinstance(messages, list):
            for message in messages:
                if not isinstance(message, dict):
                    continue
                role = message.get("role") or "message"
                content = _format_request_part(message.get("content"))
                if content:
                    parts.append(f"[{role}]\n{content}")

    return "\n\n".join(parts)


@router.get("/runtime-config")
def get_runtime_config(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return get_admin_runtime_payload()


@router.put("/runtime-config")
def update_runtime_config(req: RuntimeConfigRequest, user: dict = Depends(get_current_user)):
    _require_admin(user)
    saved = save_runtime_config(req.model_dump())
    return {
        "ok": True,
        **get_admin_runtime_payload(),
        "config": saved,
    }


@router.get("/ai-call-logs")
def get_ai_call_logs(limit: int = 100, user: dict = Depends(get_current_user)):
    _require_admin(user)
    return {
        "summary": db.summarize_ai_call_logs(),
        "items": [_sanitize_ai_call_log(log) for log in db.list_ai_call_logs(limit)],
    }


@router.get("/activity")
def get_activity(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return admin_activity.snapshot()


@router.get("/ai-call-logs/{log_id}/request-payload")
def get_ai_call_request_payload(log_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
    log = db.get_ai_call_log(log_id)
    if not log:
        raise HTTPException(404, "AI 调用日志不存在")

    request_log_path = (log.get("request_log_path") or "").strip()
    if not request_log_path:
        raise HTTPException(404, "该记录没有保存请求原始数据")

    base_dir = REQUEST_LOG_DIR.resolve()
    path = Path(request_log_path).resolve()
    if not _path_is_inside(path, base_dir) or path.suffix.lower() != ".json":
        raise HTTPException(403, "请求原始数据路径无效")
    if not path.is_file():
        raise HTTPException(404, "请求原始数据文件不存在")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"请求原始数据不是有效 JSON：{exc}") from exc

    return {
        "log": log,
        "prompt": _extract_prompt_text(payload),
        "payload": payload,
        "raw_json": json.dumps(payload, ensure_ascii=False, indent=2, default=str),
    }
