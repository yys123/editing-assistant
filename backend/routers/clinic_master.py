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

    state["status"] = "empty"
    state["warnings"] = ["Clinic Master 结果尚未获取"]
    return _public_response(state)
