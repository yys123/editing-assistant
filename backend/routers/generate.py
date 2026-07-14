from fastapi import APIRouter, HTTPException, Depends
from models import (
    GenerationRequest,
    BatchGenerationRequest,
    AiIntegrationRequest,
    ReferenceChunkSearchRequest,
)
from services.generator import generate_section_draft, generate_multi_section_draft, generate_ai_integration_answer
from services.guideline_chunk_usage import build_guideline_chunk_query, get_guideline_chunk_search_policy
from services.reference_chunks import list_reference_chunks, search_reference_chunks

from auth import get_current_user

router = APIRouter(prefix="/api/generate", tags=["generate"], dependencies=[Depends(get_current_user)])


# Temporarily disabled: draft generation.
# @router.post("/draft")
# async def generate_draft(req: GenerationRequest):
#     if not req.disease.strip() or not req.section.strip():
#         raise HTTPException(400, "请提供疾病名称和章节名称")
#     if not req.gap_description.strip():
#         raise HTTPException(400, "请提供改进要求描述")
#
#     try:
#         draft = await generate_section_draft(req)
#         return draft.model_dump()
#     except Exception as e:
#         raise HTTPException(500, f"内容生成失败: {str(e)}")
#
#
# Temporarily disabled: batch draft generation.
# @router.post("/batch-draft")
# async def generate_batch_draft(req: BatchGenerationRequest):
#     if not req.disease.strip():
#         raise HTTPException(400, "请提供疾病名称")
#     if not req.sections or len(req.sections) < 2:
#         raise HTTPException(400, "联合生成至少需要选择2个章节")
#     for item in req.sections:
#         if not item.section.strip() or not item.gap_description.strip():
#             raise HTTPException(400, "每个章节必须包含章节名称和改进要求")
#
#     try:
#         result = await generate_multi_section_draft(req)
#         return result.model_dump()
#     except Exception as e:
#         raise HTTPException(500, f"联合生成失败: {str(e)}")


@router.post("/ai-integration")
async def generate_ai_integration(req: AiIntegrationRequest):
    if not req.user_request.strip():
        raise HTTPException(400, "请输入问题或要求")

    try:
        result = await generate_ai_integration_answer(req)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"AI整合失败: {str(e)}")


@router.post("/reference-chunks/search")
async def search_reference_chunk_candidates(req: ReferenceChunkSearchRequest):
    query = build_guideline_chunk_query(req.disease, req.query, task_type=req.task_type).strip()
    policy = get_guideline_chunk_search_policy(req.query, task_type=req.task_type)
    if not query and not req.return_all:
        raise HTTPException(400, "请输入检索内容")

    try:
        if req.return_all:
            chunks = list_reference_chunks(
                req.reference_inputs,
                limit=max(1, req.limit) if req.limit else None,
            )
        else:
            chunks = search_reference_chunks(
                req.reference_inputs,
                query,
                priority_reference_ids=set(req.priority_reference_ids or []),
                preferred_title_terms=policy.preferred_keywords,
                excluded_title_terms=policy.excluded_title_keywords,
                limit=max(1, min(req.limit or 30, 100)),
            )
        return {"chunks": [chunk.model_dump() for chunk in chunks]}
    except Exception as e:
        raise HTTPException(500, f"指南切片检索失败: {str(e)}")
