import type { CitationVerificationItem, CitationVerificationResult, ReferenceAnchor } from '../types'

export type CitationVerificationTone = 'success' | 'warning' | 'danger' | 'neutral'

const REVIEW_STATUSES = new Set(['weak', 'mismatch', 'unverifiable', 'unverified'])
const STATUS_RANK: Record<string, number> = {
  mismatch: 4,
  weak: 3,
  unverifiable: 2,
  unverified: 1,
  supported: 0,
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

export function getCitationVerificationItemsForAnchor(
  result: CitationVerificationResult | undefined | null,
  anchor: Pick<ReferenceAnchor, 'citation_key' | 'anchor_key'>,
): CitationVerificationItem[] {
  if (!result?.items?.length) return []
  const activeKey = anchor.anchor_key ?? anchor.citation_key
  const exact = result.items.filter(item => (item.anchor_key || item.citation_key) === activeKey)
  if (exact.length > 0) return exact
  return result.items.filter(item => item.citation_key === anchor.citation_key)
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
