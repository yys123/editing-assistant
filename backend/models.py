from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
import uuid


# === New 7-step workflow models ===

class ArticleSection(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    heading: str
    content: str
    word_count: int       # Chinese character count (each char ≈ 1 word)
    level: int            # 1/2/3
    image_count: int = 0  # number of [图片] markers in this section
    table_count: int = 0  # number of [表格] markers in this section


class ParsedArticle(BaseModel):
    sections: List[ArticleSection]
    total_words: int   # sum of section word_counts (Chinese chars, refs excluded)


class SectionIssue(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    issue_type: str  # missing_content/structure/accuracy/outdated/style
    description: str
    severity: str = "medium"
    examples: List[str] = []
    reviewer_note: str = ""
    status: str = "ai"  # ai/confirmed/added/rejected
    deduction_score: float = 1.0
    is_key_content: bool = False


class SectionAnalysis(BaseModel):
    section_id: str
    section_heading: str
    issues: List[SectionIssue] = []


class NeedSectionMapping(BaseModel):
    section_id: str
    section_heading: str
    cluster_topics: List[str] = []
    relevance: str = "medium"  # high/medium/low


class NeedCoverage(BaseModel):
    topic: str
    coverage_level: str = "partial"  # "full" | "partial" | "missing"
    qa_frequency: int = 0
    representative_questions: List[str] = []
    revision_suggestion: str = ""  # empty when coverage_level == "full"
    status: str = "ai"             # "ai" | "confirmed" | "rejected"
    reviewer_note: str = ""


class SectionNeedsGap(BaseModel):
    section_id: str
    section_heading: str
    need_coverages: List[NeedCoverage] = []
    gap_items: List["GapItem"] = []      # derived from need_coverages, used by step 6
    coverage_assessment: str = ""


class GapAnalysis(BaseModel):
    clusters: List["NeedCluster"] = []
    total_qa_count: int = 0
    section_mappings: List[NeedSectionMapping] = []
    section_gaps: List[SectionNeedsGap] = []
    unmet_needs: List["GapItem"] = []
    optimization_suggestions: List[str] = []


class ReferenceDoc(BaseModel):
    filename: str
    text: str
    char_count: int


class StandardsOverride(BaseModel):
    quality_standard_text: Optional[str] = None
    content_spec_text: Optional[str] = None


class ArticleInputType(str, Enum):
    url = "url"
    file = "file"
    text = "text"


class QAItem(BaseModel):
    question: str
    answer: Optional[str] = None
    evidence: Optional[str] = None


# === Quality Report — 4-dimension standard ===

class IssueItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    description: str
    severity: str = "medium"  # "high" | "medium" | "low"
    examples: List[str] = []
    reviewer_note: str = ""
    status: str = "ai"  # "ai" | "confirmed" | "added" | "rejected"


class DimOneReport(BaseModel):
    """维度一：内容全面"""
    score: int = 3
    key_missing: List[IssueItem] = []      # 重点内容缺失
    nonkey_missing: List[IssueItem] = []   # 非重点内容缺失
    source_missing: List[IssueItem] = []   # 数据源缺失
    reviewer_comment: str = ""
    approved: bool = False


class DimTwoReport(BaseModel):
    """维度二：结构合理"""
    score: int = 3
    clinical_thinking: List[IssueItem] = []  # 临床思维
    integration_logic: List[IssueItem] = []   # 整合逻辑
    reviewer_comment: str = ""
    approved: bool = False


class DimThreeReport(BaseModel):
    """维度三：内容准确"""
    score: int = 3
    errors: List[IssueItem] = []        # 内容错误
    outdated: List[IssueItem] = []      # 内容陈旧
    unreasonable: List[IssueItem] = []  # 内容不合理
    reviewer_comment: str = ""
    approved: bool = False


class DimFourReport(BaseModel):
    """维度四：内容精炼流畅"""
    score: int = 3
    redundancy: List[IssueItem] = []      # 重复冗余
    format_issues: List[IssueItem] = []   # 格式问题
    language_issues: List[IssueItem] = [] # 语言问题
    reviewer_comment: str = ""
    approved: bool = False


class QualityReport(BaseModel):
    disease: str
    overall_score: float
    dim_one: DimOneReport
    dim_two: DimTwoReport
    dim_three: DimThreeReport
    dim_four: DimFourReport
    summary: str
    reviewer_comment: str = ""


# === Needs Analysis ===

class NeedCluster(BaseModel):
    topic: str
    frequency: int
    representative_questions: List[str]
    covered_in_kb: bool
    coverage_notes: str
    placement_suggestion: str = ""  # for clusters not mapped to any existing section


class NeedsAnalysis(BaseModel):
    disease: str
    total_qa_count: int
    clusters: List[NeedCluster]


# === Gap / Iteration Plan ===

class GapItem(BaseModel):
    priority: str  # P0/P1/P2
    section: str
    description: str
    source: str   # "quality_eval" | "user_needs" | "both"
    qa_frequency: Optional[int] = None


class IterationPlan(BaseModel):
    disease: str
    quality_report: QualityReport
    needs_analysis: NeedsAnalysis
    gap_items: List[GapItem]


class FullAnalysisResult(BaseModel):
    """Returned by /api/analyze/full — quality + needs, before plan generation."""
    quality_report: QualityReport
    needs_analysis: NeedsAnalysis


# === Generation ===

class GenerationRequest(BaseModel):
    disease: str
    section: str
    gap_description: str
    original_content: str
    qa_references: List[QAItem]
    article_context: str
    reference_texts: List[str] = []


class GeneratedDraft(BaseModel):
    section: str
    original_content: str
    generated_content: str
    key_changes: List[str]
    references_used: List[str]
