import type { ReferenceAnchor, ReferenceDoc } from '../types'

export type CitationLink = {
  key: string
  label: string
}

export type CitationResolver = (token: string) => CitationLink | null

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

export function linkifyCitationMarkers(content: string, resolveCitation: CitationResolver): string {
  const citationToken = String.raw`(?:R\d+\s*[-–—]\s*C\d+|Q?\d+|\d+\s*[-–—]\s*\d+)`
  const citationGroupRe = new RegExp(String.raw`\^?(?:<sup>)?[\[［【](${citationToken}(?:\s*[、,，]\s*${citationToken})*)[\]］】](?:<\/sup>)?`, 'gi')
  return content.replace(citationGroupRe, (_full, inner: string) => {
    const tokens = splitCitationTokens(inner)
    const links = tokens.map(resolveCitation)
    if (!links.some(Boolean)) return `[${tokens.join('、')}]`
    return tokens.map((token, index) => {
      const link = links[index]
      return link ? `[[${link.label}]](#citation-${link.key})` : `[${token}]`
    }).join('、')
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
  const citationKeySet = new Set(referenceAnchors.map(anchor => anchor.citation_key))
  const anchorByKey = new Map(referenceAnchors.map(anchor => [anchor.citation_key, anchor]))
  const firstBySourceRef = new Map<string, string>()
  const sortedAnchors = [...referenceAnchors].sort((a, b) =>
    a.source_id - b.source_id || a.paragraph_index - b.paragraph_index
  )
  for (const anchor of sortedAnchors) {
    if (!firstBySourceRef.has(anchor.source_ref_id)) {
      firstBySourceRef.set(anchor.source_ref_id, anchor.citation_key)
    }
  }

  return (rawToken: string) => {
    const token = normalizeCitationToken(rawToken)
    if (/^Q\d+$/i.test(token)) return null
    if (/^R\d+-C\d+$/i.test(token) && citationKeySet.has(token)) {
      const anchor = anchorByKey.get(token)
      const sourceRefIds = (anchor?.source_ref_id || '').split(/[,，、;；\s]+/).filter(Boolean)
      const label = sourceRefIds.length > 0
        ? `${anchor?.source_id ?? token.match(/^R(\d+)-C/i)?.[1]}-${sourceRefIds[sourceRefIds.length - 1]}`
        : String(anchor?.source_id ?? token.match(/^R(\d+)-C/i)?.[1] ?? token)
      return { key: token, label }
    }
    if (citationKeySet.has(token)) return { key: token, label: token }
    if (/^\d+$/.test(token)) {
      const key = firstBySourceRef.get(String(Number(token)))
      if (key) return { key, label: key }
    }
    return null
  }
}
