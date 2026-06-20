import type { ReferenceAnchor, ReferenceDoc } from '../types'

export type CitationLink = {
  key: string
  label: string
}

export type CitationResolver = (token: string, context?: string) => CitationLink | null

type ReferenceSentence = {
  text: string
  paragraphIndex: number
  sentenceIndex: number
  start: number
  end: number
}

export function normalizeCitationToken(token: string): string {
  return token
    .trim()
    .replace(/^Q/i, 'Q')
    .replace(/^R/i, 'R')
    .replace(/-C/i, '-C')
    .replace(/[［【\[\]］】]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .trim()
}

export function splitCitationTokens(inner: string): string[] {
  return inner.split(/\s*[、,，]\s*/).map(normalizeCitationToken).filter(Boolean)
}

function expandBareNumericRangeToken(token: string): string[] {
  const match = token.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!match) return [token]
  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end - start > 50) {
    return [token]
  }
  const expanded: string[] = []
  for (let value = start; value <= end; value++) expanded.push(String(value))
  return expanded
}

function sentenceAround(text: string, index: number): string {
  const before = text.slice(0, index)
  const after = text.slice(index)
  const beforeMatch = before.match(/[。！？!?；;\n]\s*[^。！？!?；;\n]*$/)
  const start = beforeMatch ? before.length - beforeMatch[0].replace(/^[。！？!?；;\n]\s*/, '').length : 0
  const afterMatch = after.match(/[。！？!?；;\n]/)
  const end = afterMatch ? index + (afterMatch.index ?? 0) + 1 : text.length
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

function resolveCitationToken(token: string, context: string, resolveCitation: CitationResolver) {
  const direct = resolveCitation(token, context)
  if (direct) return [{ token, link: direct }]
  const expanded = expandBareNumericRangeToken(token)
  if (expanded.length === 1) return [{ token, link: null }]
  const expandedResolved = expanded.map(expandedToken => ({
    token: expandedToken,
    link: resolveCitation(expandedToken, context),
  }))
  return expandedResolved.some(item => item.link) ? expandedResolved : [{ token, link: null }]
}

function formatResolvedCitationItems(items: { token: string; link: CitationLink | null }[]): string {
  if (!items.some(item => item.link)) return ''
  if (items.length === 1) {
    const item = items[0]
    return item.link ? `[[${item.link.label}]](#citation-${item.link.key})` : `[${item.token}]`
  }
  const inner = items.map(({ token, link }) => (
    link ? `[${link.label}](#citation-${link.key})` : token
  )).join('、')
  return `[${inner}]`
}

export function linkifyCitationMarkers(content: string, resolveCitation: CitationResolver): string {
  const citationToken = String.raw`(?:R\d+\s*[-–—]\s*C\d+|Q?\d+|\d+\s*[-–—]\s*\d+)`
  const citationMarker = String.raw`\^?(?:<sup>)?[\[［【](?:${citationToken}(?:\s*[、,，]\s*${citationToken})*)[\]］】](?:<\/sup>)?`
  const citationClusterRe = new RegExp(String.raw`${citationMarker}(?:\s*[、,，]?\s*${citationMarker})*`, 'gi')
  const citationGroupRe = new RegExp(String.raw`\^?(?:<sup>)?[\[［【](${citationToken}(?:\s*[、,，]\s*${citationToken})*)[\]］】](?:<\/sup>)?`, 'gi')
  return content.replace(citationClusterRe, (full: string, offset: number) => {
    const context = sentenceAround(content, offset)
    const resolved = []
    citationGroupRe.lastIndex = 0
    for (let match = citationGroupRe.exec(full); match; match = citationGroupRe.exec(full)) {
      const tokens = splitCitationTokens(match[1])
      resolved.push(...tokens.flatMap(token => resolveCitationToken(token, context, resolveCitation)))
    }
    return formatResolvedCitationItems(resolved) || full
  })
}

function splitReferenceParagraphs(text: string): string[] {
  const paragraphs = (text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const stripped = (text || '').trim()
  return paragraphs.length > 0 ? paragraphs : stripped ? [stripped] : []
}

function splitSentenceFragments(paragraph: string, paragraphIndex: number): ReferenceSentence[] {
  const fragments: ReferenceSentence[] = []
  let start = -1
  let sentenceIndex = 0
  const push = (end: number) => {
    if (start < 0) return
    const text = paragraph.slice(start, end).replace(/\s+/g, ' ').trim()
    if (text) {
      fragments.push({ text, paragraphIndex, sentenceIndex, start, end })
      sentenceIndex += 1
    }
    start = -1
  }

  for (let i = 0; i < paragraph.length; i++) {
    const char = paragraph[i]
    if (start < 0 && !/\s/.test(char)) start = i
    if (start < 0) continue

    const next = paragraph[i + 1] || ''
    const isCjkTerminator = /[。！？!?；;]/.test(char)
    const isEnglishPeriod = char === '.' && (!next || /\s/.test(next))
    const isLineBreak = char === '\n'
    if (isCjkTerminator || isEnglishPeriod || isLineBreak) {
      push(i + 1)
    }
  }
  push(paragraph.length)
  return fragments
}

function sentenceContext(
  sentences: ReferenceSentence[],
  targetIndex: number,
  beforeCount = 2,
  afterCount = 2,
) {
  return {
    context_before: sentences.slice(Math.max(0, targetIndex - beforeCount), targetIndex).map(s => s.text).join('\n').trim(),
    context_after: sentences.slice(targetIndex + 1, targetIndex + 1 + afterCount).map(s => s.text).join('\n').trim(),
  }
}

function normalizeSearchText(text: string): string {
  return text
    .replace(/\^?(?:<sup>)?[\[［【](?:R\d+\s*[-–—]\s*C\d+|Q?\d+|\d+\s*[-–—]\s*\d+)(?:\s*[、,，]\s*(?:R\d+\s*[-–—]\s*C\d+|Q?\d+|\d+\s*[-–—]\s*\d+))*[\]］】](?:<\/sup>)?/gi, ' ')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function searchTokens(text: string): Set<string> {
  const normalized = normalizeSearchText(text)
  const tokens = new Set<string>()
  for (const token of normalized.split(/\s+/)) {
    if (token.length >= 2) tokens.add(token)
  }
  const compact = normalized.replace(/\s+/g, '')
  for (let i = 0; i < compact.length - 1; i++) {
    tokens.add(compact.slice(i, i + 2))
  }
  return tokens
}

function sentenceOverlapScore(query: string, candidate: string): number {
  const queryTokens = searchTokens(query)
  if (queryTokens.size === 0) return 0
  const candidateTokens = searchTokens(candidate)
  let score = 0
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) score += token.length > 2 ? 2 : 1
  }
  return score / Math.max(1, Math.sqrt(candidateTokens.size))
}

function anchorSearchText(anchor: ReferenceAnchor): string {
  return [
    anchor.quote,
    anchor.context_before,
    anchor.context_after,
    anchor.title_path ?? '',
  ].filter(Boolean).join('\n')
}

function bestAnchorForContext(anchors: ReferenceAnchor[], context = ''): ReferenceAnchor | undefined {
  if (anchors.length <= 1 || !context.trim()) return anchors[0]
  let best = anchors[0]
  let bestScore = -1
  anchors.forEach(anchor => {
    const score = sentenceOverlapScore(context, anchorSearchText(anchor))
    if (score > bestScore) {
      bestScore = score
      best = anchor
    }
  })
  return best
}

export function mergeReferenceAnchors(...groups: ReferenceAnchor[][]): ReferenceAnchor[] {
  const unique = new Map<string, ReferenceAnchor>()
  groups.flat().forEach(anchor => {
    const fingerprint = [
      anchor.citation_key,
      anchor.source_id,
      anchor.source_filename,
      anchor.source_ref_id,
      anchor.chunk_id ?? '',
      anchor.title_path ?? '',
      anchor.quote,
      anchor.context_before,
      anchor.context_after,
      anchor.paragraph_index,
    ].join('\u0001')
    if (!unique.has(fingerprint)) unique.set(fingerprint, { ...anchor })
  })

  const anchors = Array.from(unique.values())
  const counts = new Map<string, number>()
  anchors.forEach(anchor => {
    counts.set(anchor.citation_key, (counts.get(anchor.citation_key) ?? 0) + 1)
  })
  const seen = new Map<string, number>()
  return anchors.map(anchor => {
    const count = counts.get(anchor.citation_key) ?? 0
    if (count <= 1) return { ...anchor, anchor_key: anchor.anchor_key ?? anchor.citation_key }
    const index = (seen.get(anchor.citation_key) ?? 0) + 1
    seen.set(anchor.citation_key, index)
    return { ...anchor, anchor_key: anchor.anchor_key ?? `${anchor.citation_key}~${index}` }
  })
}

export function buildReferenceAnchorFromSourceDoc(
  doc: ReferenceDoc,
  sourceId: number,
  query = '',
): ReferenceAnchor {
  const paragraphs = splitReferenceParagraphs(doc.text)
  const sentences = paragraphs.flatMap((paragraph, paragraphIndex) => splitSentenceFragments(paragraph, paragraphIndex))
  let targetIndex = 0
  if (query.trim() && sentences.length > 0) {
    let bestScore = 0
    sentences.forEach((sentence, index) => {
      const score = sentenceOverlapScore(query, sentence.text)
      if (score > bestScore) {
        bestScore = score
        targetIndex = index
      }
    })
  }
  const target = sentences[targetIndex]
  const context = target ? sentenceContext(sentences, targetIndex) : { context_before: '', context_after: '' }
  return {
    citation_key: String(sourceId),
    source_id: sourceId,
    source_filename: doc.filename,
    source_ref_id: '',
    quote: target?.text || doc.text.replace(/\s+/g, ' ').trim().slice(0, 300),
    context_before: context.context_before,
    context_after: context.context_after,
    paragraph_index: target?.paragraphIndex ?? -1,
  }
}

function expandSourceRefIds(raw: string): string[] {
  const refIds: string[] = []
  for (const part of raw.split(/[,，、;；]\s*/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const range = trimmed.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && end - start <= 50) {
        for (let i = start; i <= end; i++) refIds.push(String(i))
      }
      continue
    }
    if (/^\d+$/.test(trimmed)) refIds.push(String(Number(trimmed)))
  }
  return [...new Set(refIds)]
}

export function buildReferenceAnchorsFromDocs(referenceDocs: ReferenceDoc[]): ReferenceAnchor[] {
  const anchors: ReferenceAnchor[] = []
  const seen = new Set<string>()
  const inlineRefRe = /[\[［【]([0-9][0-9\s,，、;；\-–—]*)[\]］】]/g

  referenceDocs.forEach((doc, docIndex) => {
    const sourceId = docIndex + 1
    const paragraphs = splitReferenceParagraphs(doc.text)
    const sentenceGroups = paragraphs.map((paragraph, paragraphIndex) => splitSentenceFragments(paragraph, paragraphIndex))
    const allSentences = sentenceGroups.flat()
    paragraphs.forEach((paragraph, paragraphIndex) => {
      inlineRefRe.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = inlineRefRe.exec(paragraph)) !== null) {
        const matchIndex = match.index
        const sourceRefIds = expandSourceRefIds(match[1])
        const paragraphSentences = sentenceGroups[paragraphIndex] ?? []
        const localSentence = paragraphSentences.find(sentence => matchIndex >= sentence.start && matchIndex < sentence.end)
          ?? paragraphSentences[0]
        const sentenceIndex = localSentence ? allSentences.indexOf(localSentence) : -1
        const context = sentenceIndex >= 0
          ? sentenceContext(allSentences, sentenceIndex)
          : { context_before: '', context_after: '' }
        const quote = localSentence?.text || paragraph.replace(/\s+/g, ' ').trim()
        for (const sourceRefId of sourceRefIds) {
          const citationKey = `${sourceId}-${sourceRefId}`
          if (seen.has(citationKey)) continue
          seen.add(citationKey)
          anchors.push({
            citation_key: citationKey,
            source_id: sourceId,
            source_filename: doc.filename,
            source_ref_id: sourceRefId,
            quote,
            context_before: context.context_before,
            context_after: context.context_after,
            paragraph_index: paragraphIndex,
          })
        }
      }
    })
  })

  return anchors
}

export function createCitationResolver(referenceAnchors: ReferenceAnchor[]): CitationResolver {
  const anchors = mergeReferenceAnchors(referenceAnchors)
  const anchorsByCitationKey = new Map<string, ReferenceAnchor[]>()
  for (const anchor of anchors) {
    const list = anchorsByCitationKey.get(anchor.citation_key) ?? []
    list.push(anchor)
    anchorsByCitationKey.set(anchor.citation_key, list)
  }
  const firstBySourceRef = new Map<string, string>()
  const sortedAnchors = [...anchors].sort((a, b) =>
    a.source_id - b.source_id || a.paragraph_index - b.paragraph_index
  )
  for (const anchor of sortedAnchors) {
    if (!firstBySourceRef.has(anchor.source_ref_id)) {
      firstBySourceRef.set(anchor.source_ref_id, anchor.anchor_key ?? anchor.citation_key)
    }
  }

  return (rawToken: string, context = '') => {
    const token = normalizeCitationToken(rawToken)
    if (/^Q\d+$/i.test(token)) return null
    if (/^R\d+-C\d+$/i.test(token) && anchorsByCitationKey.has(token)) {
      const anchor = bestAnchorForContext(anchorsByCitationKey.get(token) ?? [], context)
      const sourceRefIds = (anchor?.source_ref_id || '').split(/[,，、;；\s]+/).filter(Boolean)
      const label = sourceRefIds.length > 0
        ? sourceRefIds
          .map(sourceRefId => `${anchor?.source_id ?? token.match(/^R(\d+)-C/i)?.[1]}-${sourceRefId}`)
          .join('、')
        : String(anchor?.source_id ?? token.match(/^R(\d+)-C/i)?.[1] ?? token)
      return anchor ? { key: anchor.anchor_key ?? anchor.citation_key, label } : null
    }
    if (anchorsByCitationKey.has(token)) {
      const anchor = bestAnchorForContext(anchorsByCitationKey.get(token) ?? [], context)
      return anchor ? { key: anchor.anchor_key ?? anchor.citation_key, label: token } : null
    }
    if (/^\d+$/.test(token)) {
      const key = firstBySourceRef.get(String(Number(token)))
      if (key) return { key, label: String(Number(token)) }
    }
    return null
  }
}
