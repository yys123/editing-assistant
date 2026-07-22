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
  source: 'quality_eval' | 'user_needs' | 'both' | 'manual' | string
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
  reference_anchors?: ReferenceAnchor[]
}

export interface ReferenceAnchor {
  citation_key: string
  anchor_key?: string
  source_id: number
  source_filename: string
  source_ref_id: string
  chunk_id?: string
  title_path?: string
  quote: string
  context_before: string
  context_after: string
  paragraph_index: number
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

export type PriorityGuidelineUsageStatus =
  | 'not_configured'
  | 'used'
  | 'not_covered'
  | 'not_used'
  | 'unknown'

export interface PriorityGuidelineUsage {
  status: PriorityGuidelineUsageStatus
  used_sources?: string[]
  warnings?: string[]
}

export type CitationVerificationStatus = 'passed' | 'needs_review' | 'not_run' | 'failed'
export type CitationVerificationItemStatus =
  | 'supported'
  | 'weak'
  | 'mismatch'
  | 'unverifiable'
  | 'unverified'

export interface CitationVerificationItem {
  citation_key: string
  anchor_key?: string
  sentence: string
  source_label: string
  quote: string
  status: CitationVerificationItemStatus
  reason: string
}

export interface CitationVerificationResult {
  status: CitationVerificationStatus
  items: CitationVerificationItem[]
  warnings?: string[]
}

export type CitationOccurrenceReviewStatus = 'confirmed' | 'rejected'

export interface CitationReviewAction {
  id: string
  review_status: CitationOccurrenceReviewStatus
  occurrence_key: string
  citation_key: string
  anchor_key?: string
  sentence: string
  verification_status?: CitationVerificationItemStatus | null
  reviewed_at: string
}

export interface AiIntegrationRecord {
  id: string
  request: string
  answer: string
  revisionText?: string
  changeSummary?: string[]
  referencesUsed: string[]
  referenceAnchors?: ReferenceAnchor[]
  linkedIssues?: AiIntegrationLinkedIssue[]
  confirmedReferenceChunks?: ConfirmedReferenceChunk[]
  referenceDocsSnapshot?: ReferenceDoc[]
  clinicMasterReferenceDocs?: ReferenceDoc[]
  selectedReferences: string[]
  priorityReferences: string[]
  referenceMode?: 'full' | 'confirmed_chunks'
  priorityGuidelineUsage?: PriorityGuidelineUsage
  citationVerification?: CitationVerificationResult
  citationOccurrenceReviews?: Record<string, CitationOccurrenceReviewStatus>
  citationReviewActions?: CitationReviewAction[]
  originalScope: 'all' | 'sections' | 'none'
  selectedSectionIds: string[]
  originalContentSnapshot?: string
  createdAt: string
}

export type AiIntegrationIssueSource = 'quality_review' | 'user_needs'

export type AiIntegrationIssueType =
  | SectionIssue['issue_type']
  | 'user_need_missing'
  | 'user_need_partial'

export interface AiIntegrationLinkedIssue {
  id: string
  source?: AiIntegrationIssueSource
  section_id: string
  section_heading: string
  issue_type: AiIntegrationIssueType
  severity: SectionIssue['severity']
  description: string
  examples: string[]
  reviewer_note?: string
  anchors?: IssueAnchor[]
  guideline_evidence?: GuidelineEvidence[]
  status: SectionIssue['status']
  qa_frequency?: number
  revision_suggestion?: string
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

export interface ReferenceInput {
  id: number
  filename: string
  text: string
}

export interface ReferenceChunkCandidate {
  chunk_id: string
  source_id: number
  source_filename: string
  title_path: string
  text: string
  context_before: string
  context_after: string
  paragraph_index: number
  source_ref_ids: string[]
  score: number
  reason: string
}

export interface ConfirmedReferenceChunk {
  chunk_id: string
  source_id: number
  source_filename: string
  title_path: string
  text: string
  source_ref_ids: string[]
  selected_by?: string
}

export interface ReferenceChunkSearchRequest {
  task_type: 'quality_review' | 'ai_integration' | 'user_needs' | string
  disease: string
  query: string
  reference_inputs: ReferenceInput[]
  priority_reference_ids?: number[]
  limit?: number
  return_all?: boolean
}

export interface ReferenceChunkSearchResponse {
  chunks: ReferenceChunkCandidate[]
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

export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
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
  workflowVersion?: number
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
  aiIntegrationHistory?: AiIntegrationRecord[]
  // Legacy field
  plan?: IterationPlan | null
  // Ownership
  owner_id?: string
  owner_email?: string
}
