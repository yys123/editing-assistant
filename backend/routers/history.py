from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Body, Depends
import db
from auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
def get_sessions(user: dict = Depends(get_current_user)):
    try:
        return db.list_sessions()
    except Exception as e:
        raise HTTPException(500, f"读取历史记录失败: {str(e)}")


@router.put("/{session_id}")
def save_session(session_id: str, record: Dict[str, Any] = Body(...), user: dict = Depends(get_current_user)):
    try:
        # Check ownership: if session exists, only owner can update
        existing_owner = db.get_session_owner(session_id)
        if existing_owner and existing_owner != user["id"]:
            raise HTTPException(403, "无权修改他人的会话")
        updated_at = record.get("updatedAt", record.get("id", ""))
        disease = record.get("disease", "")
        db.upsert_session(session_id, user["id"], updated_at, disease, record)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"保存历史记录失败: {str(e)}")


@router.delete("/{session_id}")
def remove_session(session_id: str, user: dict = Depends(get_current_user)):
    try:
        deleted = db.delete_session(session_id, user["id"])
        if not deleted:
            existing_owner = db.get_session_owner(session_id)
            if existing_owner:
                raise HTTPException(403, "无权删除他人的会话")
            raise HTTPException(404, "会话不存在")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"删除历史记录失败: {str(e)}")
