import type { CitationOccurrenceReviewStatus, CitationVerificationItem, CitationVerificationItemStatus, CitationVerificationResult, ReferenceAnchor } from '../types'

export type CitationVerificationTone = 'success' | 'warning' | 'danger' | 'neutral'

type CitationVerificationOccurrenceLike = {
  occurrence_key: string
  citation_key: string
  sentence: string
}

const REVIEW_STATUSES = new Set<CitationVerificationItemStatus>(['weak', 'mismatch', 'unverifiable', 'unverified'])
const STATUS_RANK: Record<string, number> = {
  mismatch: 4,
  weak: 3,
  unverifiable: 2,
  unverified: 1,
  supported: 0,
}
const STATUS_LABELS: Record<CitationVerificationItemStatus, string> = {
  supported: '核对通过',
  weak: '支撑较弱',
  mismatch: '引用不匹配',
  unverifiable: '无法判断',
  unverified: '未完成核对',
}

function stripCitationAnchorSuffix(key: string) {
  return key.replace(/~\d+$/, '')
}

function citationItemKeys(item: CitationVerificationItem) {
  return [item.anchor_key, item.citation_key].filter(Boolean) as string[]
}

function itemMatchesCitationKey(item: CitationVerificationItem, citationKey: string, { allowBaseFallback = false } = {}) {
  const keys = citationItemKeys(item)
  if (keys.some(key => key === citationKey)) return true
  if (!allowBaseFallback) return false
  const baseKey = stripCitationAnchorSuffix(citationKey)
  return keys.some(key => stripCitationAnchorSuffix(key) === baseKey)
}

export function hasReviewCitationVerificationItems(items: CitationVerificationItem[]) {
  return items.some(item => REVIEW_STATUSES.has(item.status))
}

export function getCitationVerificationStatusLabel(status?: CitationVerificationItemStatus | null) {
  return status ? STATUS_LABELS[status] ?? '需人工确认' : ''
}

export function getCitationVerificationDisplay(result?: CitationVerificationResult | null) {
  if (!result || result.status === 'not_run') return null
  if (result.status === 'failed') {
    return {
      label: '引用核对未完成，请人工检查',
      tone: 'warning' as const,
      detail: (result.warnings ?? []).filter(Boolean).join('；'),
    }
  }
  const reviewCount = (result.items ?? []).filter(item => REVIEW_STATUSES.has(item.status)).length
  if (reviewCount === 0) return { label: '引用核对通过', tone: 'success' as const }
  return { label: `引用核对发现 ${reviewCount} 处需人工确认`, tone: 'danger' as const }
}

export function getCitationVerificationDisplayForOccurrences(
  result: CitationVerificationResult | undefined | null,
  occurrences: CitationVerificationOccurrenceLike[],
  occurrenceReviews: Record<string, CitationOccurrenceReviewStatus> = {},
) {
  if (!result || result.status === 'not_run' || result.status === 'failed') {
    return getCitationVerificationDisplay(result)
  }
  const reviewItems = (result.items ?? []).filter(item => REVIEW_STATUSES.has(item.status))
  const reviewCount = occurrences.filter(occurrence => (
    occurrenceReviews[occurrence.occurrence_key] !== 'confirmed'
    && reviewItems.some(item => (
      occurrence.sentence === item.sentence
      && itemMatchesCitationKey(item, occurrence.citation_key, { allowBaseFallback: true })
    ))
  )).length
  if (reviewCount === 0) return { label: '引用核对通过', tone: 'success' as const }
  return { label: `引用核对发现 ${reviewCount} 处需人工确认`, tone: 'danger' as const }
}

export function getCitationVerificationItemsForAnchor(
  result: CitationVerificationResult | undefined | null,
  anchor: Pick<ReferenceAnchor, 'citation_key' | 'anchor_key'>,
  sentence?: string,
): CitationVerificationItem[] {
  if (!result?.items?.length) return []
  const activeKey = anchor.anchor_key ?? anchor.citation_key
  const exact = result.items.filter(item => (
    itemMatchesCitationKey(item, activeKey)
    && (!sentence || item.sentence === sentence)
  ))
  if (exact.length > 0) return exact
  return result.items.filter(item => (
    itemMatchesCitationKey(item, anchor.citation_key, { allowBaseFallback: true })
    && (!sentence || item.sentence === sentence)
  ))
}

export function getCitationVerificationMarkerStatus(
  result: CitationVerificationResult | undefined | null,
  citationKey: string,
  sentence?: string,
): CitationVerificationItemStatus | null {
  if (!result?.items?.length || !citationKey) return null
  const reviewItemsForSentence = result.items
    .filter(item => REVIEW_STATUSES.has(item.status))
    .filter(item => !sentence || item.sentence === sentence)
  const exact = reviewItemsForSentence.filter(item => itemMatchesCitationKey(item, citationKey))
  const reviewItems = exact.length > 0
    ? exact
    : reviewItemsForSentence.filter(item => itemMatchesCitationKey(item, citationKey, { allowBaseFallback: true }))
  if (reviewItems.length === 0) return null
  const worst = [...reviewItems].sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0))[0]
  return worst.status
}

export function getCitationVerificationPanelDisplay(items: CitationVerificationItem[]) {
  if (items.length === 0) return null
  const worst = [...items].sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0))[0]
  if (worst.status === 'mismatch') return { label: '引用可能不匹配', tone: 'danger' as const }
  if (worst.status === 'weak') return { label: '引用支撑较弱', tone: 'warning' as const }
  if (worst.status === 'unverifiable' || worst.status === 'unverified') {
    return { label: '引用无法判断', tone: 'warning' as const }
  }
  return { label: '引用核对通过', tone: 'success' as const }
}
