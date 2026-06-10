import type { IssueAnchor, SectionIssue } from '../types'

export interface LocatableIssueAnchor extends IssueAnchor {
  index: number
  label: string
}

export function getLocatableIssueAnchors(anchors: IssueAnchor[] | undefined): LocatableIssueAnchor[] {
  return (anchors ?? [])
    .map((anchor, index) => ({ ...anchor, index }))
    .filter((anchor): anchor is IssueAnchor & { index: number; line_start: number } =>
      typeof anchor.line_start === 'number',
    )
    .map(anchor => {
      const heading = anchor.heading_hint?.trim()
      const quote = anchor.quote?.trim()
      const text = heading || quote || `定位 ${anchor.index + 1}`
      const compact = text.replace(/\s+/g, ' ')
      return {
        ...anchor,
        label: `定位 ${anchor.index + 1}${compact ? `：${compact.slice(0, 18)}${compact.length > 18 ? '...' : ''}` : ''}`,
      }
    })
}

function compactText(text: string) {
  return text.replace(/\s+/g, '').trim()
}

function splitNumberedExampleItems(examples: string[] | undefined) {
  const items: Array<{ number: number; text: string }> = []
  for (const example of examples ?? []) {
    const pattern = /(?:^|[；;]\s*)(\d+)[.、]\s*([^；;]+)/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(example)) !== null) {
      const text = match[2].trim()
      if (text) items.push({ number: Number(match[1]), text })
    }
  }
  return items
}

function extractSearchTokens(text: string) {
  const tokens = text.match(/[A-Za-z][A-Za-z0-9-]*|[\u4e00-\u9fff]{2,}/g) ?? []
  return Array.from(new Set(tokens.map(token => token.trim()).filter(token => token.length >= 2)))
}

function longestCommonCjkRunLength(a: string, b: string) {
  const left = Array.from(a)
  const right = Array.from(b)
  let best = 0

  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      let len = 0
      while (
        i + len < left.length
        && j + len < right.length
        && left[i + len] === right[j + len]
        && /[\u4e00-\u9fff]/.test(left[i + len])
      ) {
        len += 1
      }
      if (len > best) best = len
    }
  }

  return best
}

function scoreTextAgainstExample(text: string, example: string) {
  const compact = compactText(text)
  const tokens = extractSearchTokens(example)
  return tokens.reduce((score, token) => {
    const tokenCompact = compactText(token)
    if (!tokenCompact) return score
    if (compact.includes(tokenCompact)) return score + Math.min(tokenCompact.length, 8)
    if (/^[\u4e00-\u9fff]+$/.test(tokenCompact)) {
      const commonLength = longestCommonCjkRunLength(compact, tokenCompact)
      if (commonLength >= 4) return score + Math.min(commonLength, 8)
    }
    return score
  }, 0)
}

function hasRequiredAcronyms(text: string, example: string) {
  const compact = compactText(text).toUpperCase()
  const acronyms = extractSearchTokens(example)
    .filter(token => /[A-Za-z]/.test(token) && token.length >= 3)
    .map(token => compactText(token).toUpperCase())

  if (acronyms.length < 2) return true
  return acronyms.every(token => compact.includes(token))
}

function relabelAnchor(anchor: LocatableIssueAnchor, number: number, text: string): LocatableIssueAnchor {
  const compact = text.replace(/\s+/g, ' ').trim()
  return {
    ...anchor,
    label: `定位 ${number}${compact ? `：${compact.slice(0, 18)}${compact.length > 18 ? '...' : ''}` : ''}`,
  }
}

function anchorSearchText(anchor: Pick<IssueAnchor, 'heading_hint' | 'quote'>) {
  return `${anchor.heading_hint ?? ''} ${anchor.quote ?? ''}`.trim()
}

function isSearchableAnchorText(text: string) {
  const compact = compactText(text)
  return compact.length >= 4 || /[\u4e00-\u9fff]{2,}/.test(compact)
}

function resolveAnchorLine(anchor: LocatableIssueAnchor, sectionContent: string): LocatableIssueAnchor {
  if (!sectionContent.trim()) return anchor

  const lines = sectionContent.split('\n')
  const searchTexts = [anchor.quote, anchor.heading_hint]
    .map(text => text?.trim() ?? '')
    .filter(text => text && isSearchableAnchorText(text))

  for (const searchText of searchTexts) {
    const compactSearchText = compactText(searchText)
    const matchedLine = lines.findIndex(line => {
      const compactLine = compactText(line)
      if (!compactLine) return false
      return compactLine.includes(compactSearchText) || compactSearchText.includes(compactLine)
    })

    if (matchedLine >= 0) {
      return {
        ...anchor,
        line_start: matchedLine,
        line_end: matchedLine,
      }
    }
  }

  return anchor
}

function issueContextText(issue: SectionIssue) {
  return [
    issue.description,
    ...(issue.examples ?? []),
    issue.reviewer_note,
  ].filter(Boolean).join(' ')
}

function scoreAnchorPreference(anchor: LocatableIssueAnchor, issue: SectionIssue, sectionContent: string) {
  const lines = sectionContent.split('\n')
  const line = lines[anchor.line_start] ?? ''
  const anchorText = anchorSearchText(anchor)
  const compactQuote = compactText(anchor.quote ?? '')
  const compactLine = compactText(line)
  const exactLineScore = compactQuote && compactLine.includes(compactQuote)
    ? 80 + Math.min(compactQuote.length, 40)
    : 0
  const lineScore = anchorText ? scoreTextAgainstExample(line, anchorText) : 0
  const issueScore = anchorText ? scoreTextAgainstExample(anchorText, issueContextText(issue)) : 0

  return exactLineScore + lineScore + issueScore * 2
}

function dedupeAnchorsByPosition(
  anchors: LocatableIssueAnchor[],
  issue: SectionIssue,
  sectionContent: string,
): LocatableIssueAnchor[] {
  const byLine = new Map<number, { anchor: LocatableIssueAnchor; order: number; score: number }>()

  anchors.forEach((anchor, order) => {
    const line = anchor.line_start
    const score = scoreAnchorPreference(anchor, issue, sectionContent)
    const existing = byLine.get(line)
    if (!existing || score > existing.score) {
      byLine.set(line, { anchor, order: existing?.order ?? order, score })
    }
  })

  return Array.from(byLine.values())
    .sort((left, right) => left.order - right.order)
    .map(item => item.anchor)
}

function inferAnchorFromExample(
  example: { number: number; text: string },
  sectionContent: string,
  usedLines: Set<number>,
): LocatableIssueAnchor | null {
  const lines = sectionContent.split('\n')
  let best: { line: number; score: number } | null = null

  lines.forEach((line, index) => {
    if (!line.trim()) return
    const score = scoreTextAgainstExample(line, example.text)
    if (score <= 0) return
    if (!best || score > best.score) best = { line: index, score }
  })

  if (!best || best.score < 4 || usedLines.has(best.line)) return null
  usedLines.add(best.line)
  return {
    index: 1000 + example.number,
    quote: lines[best.line].trim(),
    line_start: best.line,
    line_end: best.line,
    heading_hint: '',
    match_mode: 'inferred',
    label: relabelAnchor({ index: 1000 + example.number, quote: '', line_start: best.line, label: '' }, example.number, example.text).label,
  }
}

export function getIssueLocatorAnchors(issue: SectionIssue, sectionContent: string): LocatableIssueAnchor[] {
  const explicitAnchors = getLocatableIssueAnchors(issue.anchors)
    .map(anchor => resolveAnchorLine(anchor, sectionContent))
  const exampleItems = splitNumberedExampleItems(issue.examples)
  if (!exampleItems.length) return dedupeAnchorsByPosition(explicitAnchors, issue, sectionContent)

  const usedExplicitIndexes = new Set<number>()
  const usedLines = new Set<number>()
  const ordered: LocatableIssueAnchor[] = []

  for (const item of exampleItems) {
    let bestExplicit: { anchor: LocatableIssueAnchor; score: number } | null = null
    for (const anchor of explicitAnchors) {
      if (usedExplicitIndexes.has(anchor.index)) continue
      if (!hasRequiredAcronyms(`${anchor.heading_hint ?? ''} ${anchor.quote ?? ''}`, item.text)) continue
      const score = scoreTextAgainstExample(`${anchor.heading_hint ?? ''} ${anchor.quote ?? ''}`, item.text)
      if (score <= 0) continue
      if (!bestExplicit || score > bestExplicit.score) bestExplicit = { anchor, score }
    }

    if (bestExplicit && bestExplicit.score >= 4) {
      usedExplicitIndexes.add(bestExplicit.anchor.index)
      if (typeof bestExplicit.anchor.line_start === 'number') usedLines.add(bestExplicit.anchor.line_start)
      ordered.push(relabelAnchor(bestExplicit.anchor, item.number, item.text))
      continue
    }

    const inferred = inferAnchorFromExample(item, sectionContent, usedLines)
    if (inferred) ordered.push(inferred)
  }

  for (const anchor of explicitAnchors) {
    if (!usedExplicitIndexes.has(anchor.index)) ordered.push(anchor)
  }

  return dedupeAnchorsByPosition(ordered, issue, sectionContent)
}
