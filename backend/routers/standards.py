from fastapi import APIRouter, Depends
from services.standards import QUALITY_STANDARD, CONTENT_SPEC, REF_EVAL_STANDARD

from auth import get_current_user

router = APIRouter(prefix="/api/standards", tags=["standards"], dependencies=[Depends(get_current_user)])


@router.get("/quality")
def get_quality_standard():
    return {"text": QUALITY_STANDARD, "char_count": len(QUALITY_STANDARD)}


@router.get("/spec")
def get_content_spec():
    return {"text": CONTENT_SPEC, "char_count": len(CONTENT_SPEC)}


@router.get("/ref-eval")
def get_ref_eval_standard():
    return {"text": REF_EVAL_STANDARD, "char_count": len(REF_EVAL_STANDARD)}
