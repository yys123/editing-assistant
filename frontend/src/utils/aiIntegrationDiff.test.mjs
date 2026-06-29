import assert from 'node:assert/strict'
import { buildAiIntegrationDiff } from './aiIntegrationDiff.ts'

const original = [
  '## 流行病学',
  '急性中毒是常见急症，疾病负担较重。',
  '',
  '## 治疗',
  '治疗应根据毒物类型和患者状态选择。',
].join('\n')

const revised = [
  '## 流行病学',
  '急性中毒是常见急症，患者约占同期急诊患者的2.7%~3.6%，疾病负担较重。',
].join('\n')

const diff = buildAiIntegrationDiff(original, revised)

assert.equal(diff.blocks.length, 1)
assert.equal(diff.blocks[0].heading, '流行病学')
assert.match(diff.blocks[0].originalText, /急性中毒是常见急症/)
assert.match(diff.blocks[0].revisedText, /2.7%~3.6%/)
assert.ok(diff.blocks[0].revisedTokens.some(token => token.type === 'insert' && token.text.includes('2.7%')))

const unchanged = buildAiIntegrationDiff('## 诊断\n内容相同。', '## 诊断\n内容相同。')
assert.equal(unchanged.blocks.length, 0)

const inserted = buildAiIntegrationDiff('', '## 随访\n新增随访建议。')
assert.equal(inserted.blocks.length, 1)
assert.equal(inserted.blocks[0].matchType, 'insert')
assert.equal(inserted.blocks[0].originalText, '')

const lowConfidence = buildAiIntegrationDiff('## 诊断\n诊断依据。', '## 治疗\n治疗方案完全不同。')
assert.equal(lowConfidence.blocks.length, 1)
assert.equal(lowConfidence.blocks[0].matchType, 'insert')

console.log('ai integration diff tests passed')
