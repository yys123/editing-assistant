import assert from 'node:assert/strict'
import { getNextAiIntegrationActiveId } from './aiIntegrationHistory.ts'

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

console.log('ai integration history tests passed')
