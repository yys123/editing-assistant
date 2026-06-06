import asyncio
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from models import (
    QAItem, NeedsAnalysis, QualityReport, FullAnalysisResult,
    ArticleSection, SectionAnalysis, ParsedArticle, GapAnalysis,
    NeedCluster, NeedSectionMapping, ReferenceDoc,
)
from services.analyzer import (
    evaluate_article_quality, analyze_user_needs, generate_iteration_plan,
    analyze_section, analyze_gap, generate_plan_from_gap,
    classify_user_needs, map_needs_to_sections, analyze_section_needs_gap,
    suggest_unmapped_placements,
)
from services.ref_evaluator import evaluate_references

from auth import get_current_user

router = APIRouter(prefix="/api/analyze", tags=["analyze"], dependencies=[Depends(get_current_user)])


# ── Step 2: Reference evaluation ──────────────────────────────────────────────

class RefEvalRequest(BaseModel):
    disease: str
    reference_docs: List[ReferenceDoc]
    ref_eval_standard_text: Optional[str] = None


@router.post("/ref-eval")
async def run_ref_evaluation(req: RefEvalRequest):
    """Step 2: Evaluate reference documents against quality criteria."""
    if not req.reference_docs:
        raise HTTPException(400, "请提供至少一篇参考文献")
    try:
        result = await evaluate_references(
            req.disease, req.reference_docs, req.ref_eval_standard_text
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"参考文献评估失败: {str(e)}")


# ── New 7-step endpoints ──────────────────────────────────────────────────────

class SectionAnalyzeRequest(BaseModel):
    disease: str
    article_entry_type: Optional[str] = None
    section: ArticleSection
    article_outline: List[str] = []   # all top-level section headings in the full article
    quality_standard_text: Optional[str] = None
    content_spec_text: Optional[str] = None
    reference_texts: List[str] = []
    priority_reference_texts: List[str] = []


@router.post("/section")
async def analyze_single_section(req: SectionAnalyzeRequest):
    """Step 3: Analyze a single article section."""
    from services.standards import get_quality_standard, get_content_spec
    try:
        quality_std = get_quality_standard(req.quality_standard_text, entry_type=req.article_entry_type)
        content_spec = get_content_spec(req.content_spec_text)
        result = await analyze_section(
            req.disease, req.section, quality_std, content_spec, req.reference_texts,
            priority_reference_texts=req.priority_reference_texts,
            article_outline=req.article_outline,
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"章节分析失败: {str(e)}")


# ── New 3-phase user needs analysis endpoints ─────────────────────────────────

class NeedsClassifyRequest(BaseModel):
    disease: str
    qa_items: List[QAItem]


@router.post("/needs-classify")
async def needs_classify(req: NeedsClassifyRequest):
    """Phase 4-1: Classify all Q&A into need clusters."""
    try:
        clusters = await classify_user_needs(req.disease, req.qa_items)
        return {"clusters": [c.model_dump() for c in clusters]}
    except Exception as e:
        raise HTTPException(500, f"需求分类失败: {str(e)}")


class NeedsMapRequest(BaseModel):
    disease: str
    clusters: List[NeedCluster]
    sections: List[ArticleSection]


@router.post("/needs-map")
async def needs_map(req: NeedsMapRequest):
    """Phase 4-2: Map need clusters to article sections."""
    try:
        mappings = await map_needs_to_sections(req.disease, req.clusters, req.sections)
        return {"mappings": [m.model_dump() for m in mappings]}
    except Exception as e:
        raise HTTPException(500, f"需求映射失败: {str(e)}")


class SectionNeedsGapRequest(BaseModel):
    disease: str
    section: ArticleSection
    section_analysis: Optional[SectionAnalysis] = None
    mapped_clusters: List[NeedCluster] = []
    all_mappings: List[NeedSectionMapping] = []


@router.post("/needs-section-gap")
async def needs_section_gap(req: SectionNeedsGapRequest):
    """Phase 4-3: Analyze needs gap for a single section."""
    try:
        result = await analyze_section_needs_gap(
            req.disease, req.section, req.section_analysis, req.mapped_clusters,
            all_mappings=req.all_mappings,
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"章节需求分析失败: {str(e)}")


class NeedsPlacementRequest(BaseModel):
    disease: str
    unmapped_clusters: List[NeedCluster]
    sections: List[ArticleSection]


@router.post("/needs-placement")
async def needs_placement(req: NeedsPlacementRequest):
    """Phase 4-4: Generate placement suggestions for unmapped clusters."""
    try:
        placements = await suggest_unmapped_placements(req.disease, req.unmapped_clusters, req.sections)
        return {"placements": placements}
    except Exception as e:
        raise HTTPException(500, f"位置建议生成失败: {str(e)}")


class GapAnalyzeRequest(BaseModel):
    disease: str
    qa_items: List[QAItem] = []
    section_analyses: List[SectionAnalysis]
    parsed_article: ParsedArticle


@router.post("/gap")
async def run_gap_analysis(req: GapAnalyzeRequest):
    """Step 4: Run gap analysis from QA + section analyses."""
    try:
        result = await analyze_gap(
            req.disease, req.qa_items, req.section_analyses, req.parsed_article
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"差距分析失败: {str(e)}")


class PlanFromGapRequest(BaseModel):
    disease: str
    section_analyses: List[SectionAnalysis]
    gap_analysis: GapAnalysis
    parsed_article: Optional[ParsedArticle] = None


@router.post("/plan-from-gap")
async def generate_plan_from_gap_endpoint(req: PlanFromGapRequest):
    """Step 5: Generate iteration plan from confirmed quality issues + need gaps."""
    try:
        items = await generate_plan_from_gap(
            req.disease, req.section_analyses, req.gap_analysis, req.parsed_article
        )
        return {"gap_items": [g.model_dump() for g in items]}
    except Exception as e:
        raise HTTPException(500, f"计划生成失败: {str(e)}")


# ── Legacy endpoints (kept for backward compatibility) ───────────────────────

class AnalyzeRequest(BaseModel):
    disease: str
    article_content: str
    qa_items: List[QAItem] = []


class PlanRequest(BaseModel):
    disease: str
    quality_report: QualityReport
    needs_analysis: NeedsAnalysis


@router.post("/full")
async def run_full_analysis(req: AnalyzeRequest):
    if not req.disease.strip():
        raise HTTPException(400, "请提供疾病名称")
    if not req.article_content.strip():
        raise HTTPException(400, "请提供词条内容")
    try:
        if req.qa_items:
            quality_report, needs_analysis = await asyncio.gather(
                evaluate_article_quality(req.disease, req.article_content),
                analyze_user_needs(req.disease, req.qa_items)
            )
        else:
            quality_report = await evaluate_article_quality(req.disease, req.article_content)
            needs_analysis = NeedsAnalysis(disease=req.disease, total_qa_count=0, clusters=[])

        return FullAnalysisResult(
            quality_report=quality_report,
            needs_analysis=needs_analysis
        ).model_dump()
    except Exception as e:
        raise HTTPException(500, f"分析失败: {str(e)}")


@router.post("/plan")
async def generate_plan(req: PlanRequest):
    try:
        plan = await generate_iteration_plan(req.disease, req.quality_report, req.needs_analysis)
        return plan.model_dump()
    except Exception as e:
        raise HTTPException(500, f"计划生成失败: {str(e)}")


@router.post("/quality")
async def run_quality_eval(req: AnalyzeRequest):
    try:
        report = await evaluate_article_quality(req.disease, req.article_content)
        return report.model_dump()
    except Exception as e:
        raise HTTPException(500, f"质量评估失败: {str(e)}")
