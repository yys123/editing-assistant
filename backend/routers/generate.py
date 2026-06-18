from fastapi import APIRouter, HTTPException, Depends
from models import GenerationRequest, BatchGenerationRequest, AiIntegrationRequest
from services.generator import generate_section_draft, generate_multi_section_draft, generate_ai_integration_answer

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


@router.post("/batch-draft")
async def generate_batch_draft(req: BatchGenerationRequest):
    if not req.disease.strip():
        raise HTTPException(400, "请提供疾病名称")
    if not req.sections or len(req.sections) < 2:
        raise HTTPException(400, "联合生成至少需要选择2个章节")
    for item in req.sections:
        if not item.section.strip() or not item.gap_description.strip():
            raise HTTPException(400, "每个章节必须包含章节名称和改进要求")

    try:
        result = await generate_multi_section_draft(req)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"联合生成失败: {str(e)}")


@router.post("/ai-integration")
async def generate_ai_integration(req: AiIntegrationRequest):
    if not req.user_request.strip():
        raise HTTPException(400, "请输入问题或要求")

    try:
        result = await generate_ai_integration_answer(req)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"AI整合失败: {str(e)}")
