import assert from 'node:assert/strict'
import {
  haveSectionAnalysisIdsChanged,
  remapSectionAnalysesToCurrentSections,
} from './sectionAnalysisCompatibility.ts'

const staleAnalyses = [
  {
    section_id: 'old-treatment-id',
    section_heading: '治疗',
    issues: [{ id: 'issue-1', status: 'ai' }],
    analysis_source_hash: 'old-hash',
    analysis_parser_version: 5,
  },
]

const remapped = remapSectionAnalysesToCurrentSections(staleAnalyses, [
  { id: 'new-diagnosis-id', heading: '诊断' },
  { id: 'new-treatment-id', heading: '治疗' },
])

assert.equal(remapped[0].section_id, 'new-treatment-id')
assert.equal(remapped[0].section_heading, '治疗')
assert.equal(remapped[0].issues[0].id, 'issue-1')
assert.equal(remapped[0].analysis_parser_version, 5)
assert.equal(haveSectionAnalysisIdsChanged(staleAnalyses, remapped), true)

const unchanged = remapSectionAnalysesToCurrentSections(remapped, [
  { id: 'new-treatment-id', heading: '治疗' },
])

assert.equal(unchanged[0], remapped[0])
assert.equal(haveSectionAnalysisIdsChanged(remapped, unchanged), false)

console.log('sectionAnalysisCompatibility tests passed')
