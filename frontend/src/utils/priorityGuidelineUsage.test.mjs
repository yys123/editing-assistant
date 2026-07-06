import assert from 'node:assert/strict'
import { getPriorityGuidelineUsageDisplay } from './priorityGuidelineUsage.ts'

assert.equal(getPriorityGuidelineUsageDisplay(undefined), null)

assert.deepEqual(
  getPriorityGuidelineUsageDisplay({ status: 'used', used_sources: ['参考数据源 2：指南'] }),
  { label: '已优先采用重点指南', tone: 'success', detail: '参考数据源 2：指南' },
)

assert.equal(
  getPriorityGuidelineUsageDisplay({ status: 'not_covered' })?.label,
  '重点指南未覆盖，已使用普通资料补充',
)

assert.equal(
  getPriorityGuidelineUsageDisplay({ status: 'not_used', warnings: ['未检测到重点指南引用'] })?.tone,
  'warning',
)

assert.equal(
  getPriorityGuidelineUsageDisplay({ status: 'unknown' })?.label,
  '无法判断重点指南使用情况',
)

console.log('priority guideline usage tests passed')
