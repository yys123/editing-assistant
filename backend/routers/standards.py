from fastapi import APIRouter, Depends
from services.standards import REF_EVAL_STANDARD, get_content_spec as resolve_content_spec, get_quality_standard as resolve_quality_standard

from auth import get_current_user

router = APIRouter(prefix="/api/standards", tags=["standards"], dependencies=[Depends(get_current_user)])


@router.get("/quality")
def get_quality_standard(entry_type: str = "disease"):
    text = resolve_quality_standard(entry_type=entry_type)
    return {"text": text, "char_count": len(text)}


@router.get("/spec")
def get_content_spec(entry_type: str = "disease"):
    text = resolve_content_spec(entry_type=entry_type)
    return {"text": text, "char_count": len(text)}


@router.get("/ref-eval")
def get_ref_eval_standard():
    return {"text": REF_EVAL_STANDARD, "char_count": len(REF_EVAL_STANDARD)}
