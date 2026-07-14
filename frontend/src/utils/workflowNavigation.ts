import type { GapAnalysis, Step } from '../types'

export interface WorkflowStepContext {
  disease: string
  articleContent: string
  hasParsedArticle: boolean
  hasGapAnalysis: boolean
  draftHistoryCount: number
  gapItemsCount: number
}

export function createEmptyGapAnalysis(totalQaCount: number): GapAnalysis {
  return {
    clusters: [],
    total_qa_count: totalQaCount,
    section_mappings: [],
    section_gaps: [],
    unmet_needs: [],
    optimization_suggestions: [],
  }
}

export function canOpenWorkflowStep(step: Step, context: WorkflowStepContext): boolean {
  if (step === 1) return true
  if (step === 2) return !!(context.disease && context.articleContent)
  if (step === 3) return !!(context.disease && context.articleContent)
  if (step === 4) return !!(context.disease && context.articleContent)
  if (step === 5) return context.hasParsedArticle
  if (step === 6) return context.hasParsedArticle
  // Temporarily disabled: review/iteration plan and draft generation.
  if (step === 7) return false
  if (step === 8) return false
  if (step === 9) return !!(context.disease && context.articleContent)
  return false
}
