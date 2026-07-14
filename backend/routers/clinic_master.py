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
    debug: Optional[Dict[str, Any]] = None


def _iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp).isoformat()


def _delay_seconds() -> int:
    return int(getattr(settings, "clinic_master_result_delay_seconds", 0) or 0)


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
        "debug": state.get("debug"),
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


def _redact_debug_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "***" if key == "appSignKey" else _redact_debug_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_debug_value(item) for item in value]
    return value


def _exception_debug(stage: str, exc: Exception, context: Optional[dict] = None) -> dict:
    return {
        "stage": stage,
        "message": _exception_message(exc),
        "detail": _redact_debug_value(getattr(exc, "detail", None) or str(exc)),
        "context": _redact_debug_value(context or {}),
    }


def _append_warning_once(warnings: List[str], warning: str):
    if warning not in warnings:
        warnings.append(warning)


def _chat_detail_warning(exc: Exception) -> str:
    message = _exception_message(exc)
    if "/chat/detail" in message or "请求失败 (400)" in message:
        return "Clinic Master 对话详情接口暂不可用，已使用流式回答继续；参考文档列表将基于流式 messageId 尝试获取。"
    return f"Clinic Master 对话详情获取失败，已使用流式回答继续。错误：{message}"


def _reference_detail_warning(failure_count: int, messages: List[str]) -> str:
    if any("请求已失效" in message for message in messages):
        reason = "接口返回“请求已失效”"
    elif messages:
        reason = messages[0]
    else:
        reason = "外部详情接口未返回可用内容"
    return f"{failure_count} 条参考文献详情暂不可用（{reason}），已保留可用的参考摘要。"


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
    debug = {"errors": []}
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
            _append_warning_once(warnings, _chat_detail_warning(exc))
            debug["errors"].append(
                _exception_debug(
                    "chat_detail",
                    exc,
                    {"chatId": chat_id, "requestId": query_id},
                )
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
                _append_warning_once(warnings, f"Clinic Master 参考文档列表获取失败: {_exception_message(exc)}")
                debug["errors"].append(
                    _exception_debug(
                        "chat_references",
                        exc,
                        {"messageId": assistant_message_id},
                    )
                )
            reference_detail_failures: List[str] = []
            for item in references:
                try:
                    detail_chat_id = chat_id or query_id
                    detail_chunk_ids = clinic_master_service._reference_chunk_id(item)
                    payload = await clinic_master_service.get_reference_detail(chat_id or query_id, item)
                    detail_results.append({
                        "reference": item,
                        "payload": payload,
                        "request": {
                            "endpoint": "/japi/platform/100000017",
                            "chatId": detail_chat_id,
                            "chunkIds": detail_chunk_ids,
                        },
                    })
                except Exception as exc:
                    reference_detail_failures.append(_exception_message(exc))
                    debug["errors"].append(
                        _exception_debug(
                            "reference_detail",
                            exc,
                            {
                                "chatId": chat_id or query_id,
                                "reference": item,
                            },
                        )
                    )
            if reference_detail_failures:
                _append_warning_once(
                    warnings,
                    _reference_detail_warning(len(reference_detail_failures), reference_detail_failures),
                )
        elif answer.strip():
            _append_warning_once(warnings, "Clinic Master 未返回 assistant messageId，无法获取参考文档列表")

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
        state["debug"] = debug if debug["errors"] else None
    except Exception as exc:
        state["status"] = "failed"
        state["error"] = str(exc)
        state["warnings"] = warnings
        debug["errors"].append(_exception_debug("refresh", exc, {"queryId": query_id}))
        state["debug"] = debug
    return _public_response(state)
