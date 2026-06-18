import assert from 'node:assert/strict'
import { getGenerationOriginalContent } from './generationScope.ts'

const fullArticle = [
  '基础知识',
  '这段不属于当前修改任务。',
  '三、诊断',
  '（一）低钾血症的诊断',
  '血钾低于 3.5 mmol/L。',
].join('\n')

assert.equal(
  getGenerationOriginalContent('血钾低于 3.5 mmol/L。', fullArticle),
  '血钾低于 3.5 mmol/L。',
)

assert.equal(
  getGenerationOriginalContent('', fullArticle),
  '',
)

assert.equal(
  getGenerationOriginalContent('   ', fullArticle),
  '',
)

console.log('generationScope tests passed')
