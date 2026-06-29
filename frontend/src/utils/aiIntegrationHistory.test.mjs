import assert from 'node:assert/strict'
import { canCompareAiIntegrationRecord, getAiIntegrationDisplayText, getNextAiIntegrationActiveId } from './aiIntegrationHistory.ts'

const records = [
  { id: 'r1' },
  { id: 'r2' },
  { id: 'r3' },
]

assert.equal(
  getNextAiIntegrationActiveId(records, 'r2', 'r2'),
  'r3',
)

assert.equal(
  getNextAiIntegrationActiveId(records, 'r3', 'r3'),
  'r2',
)

assert.equal(
  getNextAiIntegrationActiveId(records, 'r1', 'r3'),
  'r3',
)

assert.equal(
  getNextAiIntegrationActiveId([{ id: 'r1' }], 'r1', 'r1'),
  null,
)

assert.equal(
  getAiIntegrationDisplayText({
    answer: '## 修订后正文\n旧展示',
    revisionText: '清洁修订正文',
  }),
  '清洁修订正文',
)

assert.equal(
  getAiIntegrationDisplayText({
    answer: '完整回答',
    revisionText: '   ',
  }),
  '完整回答',
)

assert.equal(
  canCompareAiIntegrationRecord({
    originalContentSnapshot: '原文',
    originalScope: 'sections',
    revisionText: '修订正文',
  }),
  true,
)

assert.equal(
  canCompareAiIntegrationRecord({
    originalContentSnapshot: '原文',
    originalScope: 'none',
    revisionText: '修订正文',
  }),
  false,
)

assert.equal(
  canCompareAiIntegrationRecord({
    originalContentSnapshot: '原文',
    originalScope: 'all',
    revisionText: '',
  }),
  false,
)

console.log('ai integration history tests passed')
