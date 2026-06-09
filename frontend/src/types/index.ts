export interface QAItem {
  question: string
  answer?: string
  evidence?: string
}

// === Quality Report — 4-dimension standard (legacy) ===

export interface IssueItem {
  id: string
  description: string
  severity: 'high' | 'medium' | 'low'
  examples: string[]
  reviewer_note: string
  status: 'ai' | 'confirmed' | 'added' | 'rejected'
}

export interface DimOneReport {
  score: number
  key_missing: IssueItem[]
  nonkey_missing: IssueItem[]
  source_missing: IssueItem[]
  reviewer_comment: string
  approved: boolean
}

export interface DimTwoReport {
  score: number
  clinical_thinking: IssueItem[]
  integration_logic: IssueItem[]
  reviewer_comment: string
  approved: boolean
}

export interface DimThreeReport {
  score: number
  errors: IssueItem[]
  outdated: IssueItem[]
  unreasonable: IssueItem[]
  reviewer_comment: string
  approved: boolean
}

export interface DimFourReport {
  score: number
  redundancy: IssueItem[]
  format_issues: IssueItem[]
  language_issues: IssueItem[]
  reviewer_comment: string
  approved: boolean
}

export interface QualityReport {
  disease: string
  overall_score: number
  dim_one: DimOneReport
  dim_two: DimTwoReport
  dim_three: DimThreeReport
  dim_four: DimFourReport
  summary: string
  reviewer_comment: string
}

export interface NeedCluster {
  topic: string
  frequency: number
  representative_questions: string[]
  covered_in_kb: boolean
  coverage_notes: string
  placement_suggestion?: string
}

export interface NeedsAnalysis {
  disease: string
  total_qa_count: number
  clusters: NeedCluster[]
}

export interface GapItem {
  priority: 'P0' | 'P1' | 'P2'
  section: string
  description: string
  source: string
  qa_frequency?: number
}

export interface FullAnalysisResult {
  quality_report: QualityReport
  needs_analysis: NeedsAnalysis
}

export interface IterationPlan {
  disease: string
  quality_report: QualityReport
  needs_analysis: NeedsAnalysis
  gap_items: GapItem[]
}

export interface GeneratedDraft {
  section: string
  original_content: string
  generated_content: string
  key_changes: string[]
  references_used: string[]
}

export interface DraftRecord {
  id: string
  gap: GapItem
  draft: GeneratedDraft
  editedContent: string
  generatedAt: string
  batchId?: string          // 联合生成时共享同一个 batchId
}

export interface BatchGeneratedDraft {
  drafts: GeneratedDraft[]
  coordination_notes: string
}

// === New 7-step workflow types ===

export interface ArticleSection {
  id: string
  heading: string
  content: string
  word_count: number
  level: number
}

export interface ParsedArticle {
  sections: ArticleSection[]
  total_words: number
}

export interface SectionIssue {
  id: string
  issue_type: 'missing_content' | 'structure' | 'accuracy' | 'outdated' | 'style'
  description: string
  severity: 'high' | 'medium' | 'low'
  examples: string[]
  anchors?: IssueAnchor[]
  guideline_evidence?: GuidelineEvidence[]
  reviewer_note: string
  status: 'ai' | 'confirmed' | 'added' | 'rejected'
  deduction_score?: number
  is_key_content?: boolean
}

export interface IssueAnchor {
  quote: string
  start?: number | null
  end?: number | null
  line_start?: number | null
  line_end?: number | null
  heading_hint?: string
  match_mode?: string
}

export interface GuidelineEvidence {
  source: string
  quote: string
  relevance?: string
}

export interface SectionAnalysis {
  section_id: string
  section_heading: string
  issues: SectionIssue[]
  verification_summary?: string
  analysis_source_hash?: string
  analysis_parser_version?: number
}

export interface NeedSectionMapping {
  section_id: string
  section_heading: string
  cluster_topics: string[]
  relevance: 'high' | 'medium' | 'low'
}

export interface NeedCoverage {
  topic: string
  coverage_level: 'full' | 'partial' | 'missing'
  qa_frequency: number
  representative_questions: string[]
  revision_suggestion: string
  status?: 'ai' | 'confirmed' | 'rejected'
  reviewer_note?: string
}

export interface SectionNeedsGap {
  section_id: string
  section_heading: string
  need_coverages: NeedCoverage[]
  gap_items: GapItem[]
  coverage_assessment: string
}

export interface GapAnalysis {
  clusters: NeedCluster[]
  total_qa_count: number
  section_mappings: NeedSectionMapping[]
  section_gaps: SectionNeedsGap[]
  unmet_needs: GapItem[]
  optimization_suggestions: string[]
}

export interface ReferenceDoc {
  filename: string
  text: string
  char_count: number
}

export interface RefEvalItemResult {
  filename: string
  authority_rating: string
  authority_note: string
  evidence_level: string
  evidence_note: string
  timeliness_rating: string
  timeliness_note: string
  overall_recommendation: string
  summary: string
}

export interface RefEvalResult {
  item_evaluations: RefEvalItemResult[]
  comprehensiveness: string
  localization: string
  overall_assessment: string
  coverage_gaps: string[]
  suggestions: string[]
}

export interface StandardsOverride {
  qualityText?: string
  specText?: string
  refEvalText?: string
}

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ArticleEntryType = 'disease' | 'non_disease' | 'tumor'

export interface User {
  id: string
  email: string
  display_name: string
  is_admin?: boolean
}

export interface SessionRecord {
  id: string
  updatedAt: string
  disease: string
  articleEntryType?: ArticleEntryType
  articleSnippet: string
  articleContent?: string
  articleParseContent?: string
  articleRichHtml?: string
  qaCount: number
  qaItems?: QAItem[]
  currentStep?: Step
  // New fields
  parsedArticle?: ParsedArticle | null
  parsedArticleSourceHash?: string
  parsedArticleParserVersion?: number
  sectionAnalyses?: SectionAnalysis[]
  sectionReferenceSelections?: Record<string, string[]>
  sectionPriorityReferenceSelections?: Record<string, string[]>
  gapAnalysis?: GapAnalysis | null
  gapItems?: GapItem[]
  referenceDocs?: ReferenceDoc[]
  refEvalResult?: RefEvalResult | null
  draftHistory: DraftRecord[]
  // Legacy field
  plan?: IterationPlan | null
  // Ownership
  owner_id?: string
  owner_email?: string
}
