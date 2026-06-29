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

const ckdOriginal = [
  '## 五、流行病学',
  '1、据报道，全球 CKD 患病率约 10%~15%，CKD 1~2 期为 5.0%，3 期为 3.9%，4 期为 0.16%，5 期为 0.07%；据估计有 6.98 亿 CKD 患者，其中 1/3 在我国和印度[1]。',
  '2、我国 CKD 患病率为 8.2%~13.8%[378-379,456]。合并有糖尿病和高血压的患者其 CKD 的发病率更是高达 13.9% 和 11.3%，且 CKD 占比随着年龄的增长而增加。我国 CKD 患者有 1.32 亿。与发达国家不同，我国 CKD 早期阶段（即 CKD 1~2 期）的患者比例高达 84.3%，而 CKD 3 期患者仅占 14.8%[2]。此外，我国 CKD 的知晓率和诊断率普遍较低，与其高患病率形成鲜明对比[2]。',
].join('\n')

const ckdRevised = [
  '## 五、流行病学',
  '- **全球负担：** 据报道，全球 CKD 患病率约 10%~15%，CKD 1~2 期为 5.0%，3 期为 3.9%，4 期为 0.16%，5 期为 0.07%；据估计有 6.98 亿 CKD 患者，其中 1/3 在我国和印度[1]。',
  '- **中国负担：** 我国 CKD 患病率为 8.2%~13.8%[378-379,456]。合并有糖尿病和高血压的患者其 CKD 的发病率更是高达 13.9% 和 11.3%，且 CKD 占比随着年龄的增长而增加。我国 CKD 患者有 1.32 亿。与发达国家不同，我国 CKD 早期阶段（即 CKD 1~2 期）的患者比例高达 84.3%，而 CKD 3 期患者仅占 14.8%[2]。此外，我国 CKD 的知晓率和诊断率普遍较低，与其高患病率形成鲜明对比[2]。一项基于 2018–2019 年数据的调查显示，我国成人 CKD 患病率为 8.2%[2-1]。',
].join('\n')

const ckdDiff = buildAiIntegrationDiff(ckdOriginal, ckdRevised)
const chinaBlock = ckdDiff.blocks.find(block => block.revisedText.includes('中国负担'))
assert.ok(chinaBlock)
assert.equal(chinaBlock.matchType, 'matched')
assert.match(chinaBlock.originalText, /我国 CKD 患病率为 8\.2%~13\.8%/)
assert.doesNotMatch(chinaBlock.originalText, /全球 CKD 患病率约/)

console.log('ai integration diff tests passed')
