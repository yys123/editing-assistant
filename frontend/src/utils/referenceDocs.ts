import type { ReferenceDoc } from '../types'

export interface ReferenceDocAdditionResult {
  docs: ReferenceDoc[]
  added: number
  duplicates: number
}

export type ReferenceDocAdditionStats = Pick<ReferenceDocAdditionResult, 'added' | 'duplicates'>

export function buildReferenceDocAddition(current: ReferenceDoc[], additions: ReferenceDoc[]): ReferenceDocAdditionResult {
  const existing = new Set(current.map(doc => doc.filename))
  const accepted: ReferenceDoc[] = []
  let duplicates = 0
  for (const doc of additions) {
    if (existing.has(doc.filename)) {
      duplicates += 1
      continue
    }
    existing.add(doc.filename)
    accepted.push(doc)
  }
  return { docs: [...current, ...accepted], added: accepted.length, duplicates }
}
