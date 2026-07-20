import assert from 'node:assert/strict'
import {
  getCitationVerificationDisplay,
  getCitationVerificationItemsForAnchor,
  getCitationVerificationPanelDisplay,
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

console.log('citationVerification utility tests passed')
