import assert from 'node:assert/strict'
import {
  getHistoryProgress,
  getVisibleWorkflowSteps,
} from './historyProgress.ts'

const visibleSteps = getVisibleWorkflowSteps()

assert.deepEqual(
  visibleSteps.map(step => step.key),
  [1, 2, 3, 4, 5, 6, 9],
)

assert.equal(visibleSteps[1].label, 'AI查指南')

assert.deepEqual(
  getHistoryProgress(9),
  {
    current: 7,
    total: 7,
  },
)

assert.deepEqual(
  getHistoryProgress(7),
  {
    current: 6,
    total: 7,
  },
)

assert.deepEqual(
  getHistoryProgress(undefined),
  {
    current: null,
    total: 7,
  },
)

console.log('historyProgress tests passed')
