from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Body
import db

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
def get_sessions():
    try:
        return db.list_sessions()
    except Exception as e:
        raise HTTPException(500, f"读取历史记录失败: {str(e)}")


@router.put("/{session_id}")
def save_session(session_id: str, record: Dict[str, Any] = Body(...)):
    try:
        updated_at = record.get("updatedAt", record.get("id", ""))
        disease = record.get("disease", "")
        db.upsert_session(session_id, updated_at, disease, record)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, f"保存历史记录失败: {str(e)}")


@router.delete("/{session_id}")
def remove_session(session_id: str):
    try:
        db.delete_session(session_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, f"删除历史记录失败: {str(e)}")
