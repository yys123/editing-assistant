from fastapi import APIRouter, HTTPException, Depends
from models import GenerationRequest
from services.generator import generate_section_draft

from auth import get_current_user

router = APIRouter(prefix="/api/generate", tags=["generate"], dependencies=[Depends(get_current_user)])


@router.post("/draft")
async def generate_draft(req: GenerationRequest):
    if not req.disease.strip() or not req.section.strip():
        raise HTTPException(400, "请提供疾病名称和章节名称")
    if not req.gap_description.strip():
        raise HTTPException(400, "请提供改进要求描述")

    try:
        draft = await generate_section_draft(req)
        return draft.model_dump()
    except Exception as e:
        raise HTTPException(500, f"内容生成失败: {str(e)}")
