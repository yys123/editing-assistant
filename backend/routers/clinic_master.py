import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from config import settings
from services import clinic_master as clinic_master_service


router = APIRouter(
    prefix="/api/clinic-master",
    tags=["clinic-master"],
    dependencies=[Depends(get_current_user)],
)

_query_store: Dict[str, dict] = {}


class ClinicMasterQueryRequest(BaseModel):
    question: str


class ClinicMasterMaterial(BaseModel):
    id: str
    type: str
    title: str
    text: str
    sourceLabel: str
    selectedByDefault: bool = False
    metadata: Optional[Dict[str, Any]] = None


class ClinicMasterQueryResponse(BaseModel):
    query_id: str
    status: str
    question: str
    created_at: str
    ready_at: str
    materials: List[ClinicMasterMaterial] = []
    warnings: List[str] = []
    error: Optional[str] = None


def _iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp).isoformat()


def _delay_seconds() -> int:
    return int(getattr(settings, "clinic_master_result_delay_seconds", 120) or 120)


def _public_response(state: dict) -> dict:
    return {
        "query_id": state["query_id"],
        "status": state["status"],
        "question": state["question"],
        "created_at": state["created_at"],
        "ready_at": state["ready_at"],
        "materials": state.get("materials", []),
        "warnings": state.get("warnings", []),
        "error": state.get("error"),
    }


def _get_state(query_id: str) -> dict:
    state = _query_store.get(query_id)
    if not state:
        raise HTTPException(404, "ClinMaster 查询不存在或已过期")
    return state


def _exception_message(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict):
        return str(detail.get("message") or detail.get("response") or detail)
    if detail:
        return str(detail)
    return str(exc)


@router.post("/queries")
async def create_query(req: ClinicMasterQueryRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(400, "请输入临床决策问题")

    query_id = str(uuid.uuid4())
    created_ts = time.time()
    ready_ts = created_ts + _delay_seconds()
    stream_payload = await clinic_master_service.create_chat(question, request_id=query_id)
    state = {
        "query_id": query_id,
        "status": "pending",
        "question": question,
        "created_at": _iso(created_ts),
        "ready_at": _iso(ready_ts),
        "created_ts": created_ts,
        "ready_ts": ready_ts,
        "stream_payload": stream_payload,
        "materials": [],
        "warnings": [],
        "error": None,
    }
    _query_store[query_id] = state
    return _public_response(state)


@router.get("/queries/{query_id}")
async def get_query(query_id: str):
    return _public_response(_get_state(query_id))


@router.post("/queries/{query_id}/refresh")
async def refresh_query(query_id: str):
    state = _get_state(query_id)
    if time.time() < state["ready_ts"]:
        return _public_response(state)

    warnings = list(state.get("warnings", []))
    try:
        stream_payload = state.get("stream_payload") or {}
        stream_data = stream_payload.get("data") if isinstance(stream_payload, dict) else {}
        chat_id = stream_data.get("chatId") if isinstance(stream_data, dict) else None
        try:
            detail_payload = await clinic_master_service.get_chat_detail(
                chat_id=chat_id,
                request_id=query_id,
            )
        except Exception as exc:
            detail_payload = {}
            warnings.append(
                "Clinic Master 对话详情获取失败，已仅使用流式回答；"
                f"参考文档列表需要开通 /chat/detail 访问权限。错误：{_exception_message(exc)}"
            )
        answer = clinic_master_service.extract_answer_text(detail_payload, stream_payload)
        assistant_message_id = (
            clinic_master_service.extract_assistant_message_id(detail_payload)
            or (stream_data.get("newAssistantMessageId") if isinstance(stream_data, dict) else None)
        )
        references = []
        detail_results = []
        if assistant_message_id:
            try:
                reference_payload = await clinic_master_service.get_chat_references(assistant_message_id)
                references = clinic_master_service.extract_reference_items(reference_payload)
            except Exception as exc:
                references = []
                warnings.append(f"Clinic Master 参考文档列表获取失败: {_exception_message(exc)}")
            for item in references:
                try:
                    payload = await clinic_master_service.get_reference_detail(chat_id or query_id, item)
                    detail_results.append({"reference": item, "payload": payload})
                except Exception as exc:
                    title = item.get("title") or item.get("name") or item.get("referenceId") or "参考文献"
                    warnings.append(f"{title} 详情获取失败: {exc}")
        elif answer.strip():
            warnings.append("Clinic Master 未返回 assistant messageId，无法获取参考文档列表")

        materials = clinic_master_service.normalize_materials(
            state["question"],
            answer,
            detail_payload,
            references,
            detail_results,
        )
        state["materials"] = materials
        state["warnings"] = warnings
        state["status"] = "ready" if materials else "empty"
        state["error"] = None
    except Exception as exc:
        state["status"] = "failed"
        state["error"] = str(exc)
        state["warnings"] = warnings
    return _public_response(state)
