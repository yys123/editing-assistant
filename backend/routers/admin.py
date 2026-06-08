from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from services.admin_runtime import get_admin_runtime_payload, save_runtime_config
import db

router = APIRouter(prefix="/api/admin", tags=["admin"])


class RuntimeConfigRequest(BaseModel):
    scope: Literal["admin_only", "global"] = "admin_only"
    text_model_provider: Literal["gemini", "deepseek"] = "deepseek"
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_temperature: Optional[float] = None
    deepseek_top_p: Optional[float] = None
    deepseek_max_tokens: Optional[int] = None
    deepseek_presence_penalty: Optional[float] = None
    deepseek_frequency_penalty: Optional[float] = None
    deepseek_response_format: Literal["text", "json_object"] = "text"
    deepseek_thinking_type: Literal["disabled", "enabled"] = "disabled"
    deepseek_reasoning_effort: Literal["high", "max"] = "high"
    deepseek_timeout_seconds: Optional[int] = None
    deepseek_context_window_tokens: Optional[int] = None
    gemini_context_window_tokens: Optional[int] = None


def _require_admin(user: dict):
    if not user.get("is_admin"):
        raise HTTPException(403, "仅管理员可访问")


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
        "items": db.list_ai_call_logs(limit),
    }
