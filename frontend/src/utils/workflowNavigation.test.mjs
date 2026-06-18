import assert from 'node:assert/strict'
import {
  canOpenWorkflowStep,
  createEmptyGapAnalysis,
} from './workflowNavigation.ts'

assert.equal(
  canOpenWorkflowStep(5, {
    disease: '糖尿病',
    articleContent: '原文',
    hasParsedArticle: true,
    hasGapAnalysis: false,
    draftHistoryCount: 0,
    gapItemsCount: 0,
  }),
  true,
)

assert.equal(
  canOpenWorkflowStep(6, {
    disease: '糖尿病',
    articleContent: '原文',
    hasParsedArticle: true,
    hasGapAnalysis: false,
    draftHistoryCount: 0,
    gapItemsCount: 0,
  }),
  true,
)

assert.deepEqual(createEmptyGapAnalysis(0), {
  clusters: [],
  total_qa_count: 0,
  section_mappings: [],
  section_gaps: [],
  unmet_needs: [],
  optimization_suggestions: [],
})

console.log('workflowNavigation tests passed')
