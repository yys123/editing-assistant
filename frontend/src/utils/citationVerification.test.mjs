import assert from 'node:assert/strict'
import {
  getCitationVerificationDisplay,
  getCitationVerificationDisplayForOccurrences,
  getCitationVerificationItemsForAnchor,
  getCitationVerificationMarkerStatus,
  getCitationVerificationPanelDisplay,
  getCitationVerificationStatusLabel,
  hasReviewCitationVerificationItems,
} from './citationVerification.ts'

const passed = getCitationVerificationDisplay({ status: 'passed', items: [], warnings: [] })
assert.equal(passed?.label, '引用核对通过')
assert.equal(passed?.tone, 'success')

const needsReview = getCitationVerificationDisplay({
  status: 'needs_review',
  items: [
    { citation_key: '1-3', anchor_key: '1-3', status: 'supported', sentence: '', source_label: '', quote: '', reason: '' },
    { citation_key: '1-4', anchor_key: '1-4', status: 'mismatch', sentence: '', source_label: '', quote: '', reason: '不匹配' },
  ],
  warnings: [],
})
assert.equal(needsReview?.label, '引用核对发现 1 处需人工确认')
assert.equal(needsReview?.tone, 'danger')

const items = getCitationVerificationItemsForAnchor({
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '1-47', anchor_key: '1-47~1', status: 'supported', sentence: 'A', source_label: '', quote: '', reason: 'A ok' },
    { citation_key: '1-47', anchor_key: '1-47~2', status: 'mismatch', sentence: 'B', source_label: '', quote: '', reason: 'B bad' },
  ],
}, { citation_key: '1-47', anchor_key: '1-47~2' })
assert.equal(items.length, 1)
assert.equal(items[0].reason, 'B bad')

const panel = getCitationVerificationPanelDisplay(items)
assert.equal(panel?.tone, 'danger')
assert.equal(panel?.label, '引用可能不匹配')

const markerStatus = getCitationVerificationMarkerStatus({
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '2-8', anchor_key: '2-8~1', status: 'supported', sentence: '', source_label: '', quote: '', reason: '' },
    { citation_key: '2-8', anchor_key: '2-8~2', status: 'weak', sentence: '', source_label: '', quote: '', reason: '支撑较弱' },
    { citation_key: '3-5', anchor_key: '3-5', status: 'mismatch', sentence: '', source_label: '', quote: '', reason: '不匹配' },
  ],
}, '2-8~2')
assert.equal(markerStatus, 'weak')
assert.equal(getCitationVerificationStatusLabel(markerStatus), '支撑较弱')
assert.equal(hasReviewCitationVerificationItems(items), true)
assert.equal(getCitationVerificationMarkerStatus({ status: 'passed', items: [], warnings: [] }, '2-8~2'), null)

const repeatedAnchorResult = {
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '1-3', anchor_key: '1-3', status: 'supported', sentence: '第一句[1-3]。', source_label: '', quote: '', reason: '' },
    { citation_key: '1-3', anchor_key: '1-3', status: 'mismatch', sentence: '第二句[1-3]。', source_label: '', quote: '', reason: '第二句不支持' },
  ],
}
assert.equal(getCitationVerificationMarkerStatus(repeatedAnchorResult, '1-3', '第一句[1-3]。'), null)
assert.equal(getCitationVerificationMarkerStatus(repeatedAnchorResult, '1-3', '第二句[1-3]。'), 'mismatch')
assert.equal(
  getCitationVerificationItemsForAnchor(repeatedAnchorResult, { citation_key: '1-3', anchor_key: '1-3' }, '第二句[1-3]。').length,
  1,
)

const suffixedAnchorResult = {
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '1-13', anchor_key: '1-13', status: 'weak', sentence: '定义内容[1-13、1-14]。', source_label: '', quote: '', reason: '支撑较弱' },
    { citation_key: '1-14', anchor_key: '1-14', status: 'unverifiable', sentence: '定义内容[1-13、1-14]。', source_label: '', quote: '', reason: '无法判断' },
  ],
}
assert.equal(getCitationVerificationMarkerStatus(suffixedAnchorResult, '1-13~2', '定义内容[1-13、1-14]。'), 'weak')
assert.equal(getCitationVerificationMarkerStatus(suffixedAnchorResult, '1-14~3', '定义内容[1-13、1-14]。'), 'unverifiable')

const visibleOccurrenceDisplay = getCitationVerificationDisplayForOccurrences({
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '4', anchor_key: '4', status: 'weak', sentence: '补充关键描述[4]。', source_label: '', quote: '', reason: '支撑较弱' },
    { citation_key: '2-2', anchor_key: '2-2', status: 'mismatch', sentence: '已删除引用所在句[2-2]。', source_label: '', quote: '', reason: '不匹配' },
  ],
}, [
  { occurrence_key: 'citation-occurrence-0', citation_key: '4', token: '4', label: '4', sentence: '补充关键描述[4]。' },
], { 'citation-occurrence-0': 'confirmed' })
assert.equal(visibleOccurrenceDisplay?.label, '引用核对通过')
assert.equal(visibleOccurrenceDisplay?.tone, 'success')

const duplicatedVisibleOccurrenceDisplay = getCitationVerificationDisplayForOccurrences({
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '4', anchor_key: '4', status: 'weak', sentence: '同一句里第一个结论[4]，第二个结论[4]。', source_label: '', quote: '', reason: '支撑较弱' },
  ],
}, [
  { occurrence_key: 'citation-occurrence-0', citation_key: '4', token: '4', label: '4', sentence: '同一句里第一个结论[4]，第二个结论[4]。' },
  { occurrence_key: 'citation-occurrence-1', citation_key: '4', token: '4', label: '4', sentence: '同一句里第一个结论[4]，第二个结论[4]。' },
])
assert.equal(duplicatedVisibleOccurrenceDisplay?.label, '引用核对发现 2 处需人工确认')

const partiallyConfirmedDuplicatedOccurrenceDisplay = getCitationVerificationDisplayForOccurrences({
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '4', anchor_key: '4', status: 'weak', sentence: '同一句里第一个结论[4]，第二个结论[4]。', source_label: '', quote: '', reason: '支撑较弱' },
  ],
}, [
  { occurrence_key: 'citation-occurrence-0', citation_key: '4', token: '4', label: '4', sentence: '同一句里第一个结论[4]，第二个结论[4]。' },
  { occurrence_key: 'citation-occurrence-1', citation_key: '4', token: '4', label: '4', sentence: '同一句里第一个结论[4]，第二个结论[4]。' },
], { 'citation-occurrence-0': 'confirmed' })
assert.equal(partiallyConfirmedDuplicatedOccurrenceDisplay?.label, '引用核对发现 1 处需人工确认')

console.log('citationVerification utility tests passed')
