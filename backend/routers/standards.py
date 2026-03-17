from fastapi import APIRouter
from services.standards import QUALITY_STANDARD, CONTENT_SPEC

router = APIRouter(prefix="/api/standards", tags=["standards"])


@router.get("/quality")
def get_quality_standard():
    return {"text": QUALITY_STANDARD, "char_count": len(QUALITY_STANDARD)}


@router.get("/spec")
def get_content_spec():
    return {"text": CONTENT_SPEC, "char_count": len(CONTENT_SPEC)}
