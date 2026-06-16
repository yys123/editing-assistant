import assert from 'node:assert/strict'
import { filterHistorySessions, isOwnHistorySession } from './historyFilters.ts'

const sessions = [
  { id: '2026-06-16T01:00:00Z', disease: '自己的任务', owner_id: 'user-1', draftHistory: [] },
  { id: '2026-06-16T02:00:00Z', disease: '他人的任务', owner_id: 'user-2', draftHistory: [] },
  { id: '2026-06-16T03:00:00Z', disease: '旧版任务', draftHistory: [] },
]

assert.equal(isOwnHistorySession(sessions[0], 'user-1'), true)
assert.equal(isOwnHistorySession(sessions[1], 'user-1'), false)
assert.equal(isOwnHistorySession(sessions[2], 'user-1'), true)

assert.deepEqual(
  filterHistorySessions(sessions, 'user-1', true).map(s => s.disease),
  ['自己的任务', '旧版任务'],
)

assert.deepEqual(
  filterHistorySessions(sessions, 'user-1', false).map(s => s.disease),
  ['自己的任务', '他人的任务', '旧版任务'],
)

console.log('historyFilters tests passed')
