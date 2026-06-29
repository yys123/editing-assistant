import assert from 'node:assert/strict'
import { canCompareAiIntegrationRecord, getAiIntegrationDisplayText, getAiIntegrationRevisionText, getNextAiIntegrationActiveId } from './aiIntegrationHistory.ts'

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

const nestedRevisionAnswer = [
  '## 修订后正文',
  '',
  '## 基础知识',
  '',
  '我国横断面研究结果显示，CKD患病率为8.2%~10.8%，知晓率仅10%。',
  '',
  '## 修改说明',
  '',
  '- 补充 CKD 知晓率具体数据。',
].join('\n')

assert.equal(
  getAiIntegrationRevisionText({
    answer: nestedRevisionAnswer,
    revisionText: '',
  }),
  '## 基础知识\n\n我国横断面研究结果显示，CKD患病率为8.2%~10.8%，知晓率仅10%。',
)

assert.equal(
  getAiIntegrationDisplayText({
    answer: nestedRevisionAnswer,
    revisionText: '',
  }),
  '## 基础知识\n\n我国横断面研究结果显示，CKD患病率为8.2%~10.8%，知晓率仅10%。',
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

assert.equal(
  canCompareAiIntegrationRecord({
    answer: nestedRevisionAnswer,
    originalContentSnapshot: '原文',
    originalScope: 'sections',
    revisionText: '',
  }),
  true,
)

console.log('ai integration history tests passed')
