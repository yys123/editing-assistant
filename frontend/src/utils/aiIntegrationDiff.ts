export type DiffTokenType = 'equal' | 'insert' | 'delete'
export type AiIntegrationDiffMatchType = 'matched' | 'insert'

export interface DiffToken {
  text: string
  type: DiffTokenType
}

export interface AiIntegrationDiffBlock {
  id: string
  heading?: string
  originalText: string
  revisedText: string
  originalTokens: DiffToken[]
  revisedTokens: DiffToken[]
  similarity: number
  matchType: AiIntegrationDiffMatchType
}

export interface AiIntegrationDiffResult {
  blocks: AiIntegrationDiffBlock[]
}

type TextBlock = {
  id: string
  heading?: string
  text: string
  searchable: string
}

type TokenDiff = {
  originalTokens: DiffToken[]
  revisedTokens: DiffToken[]
}

function normalizeText(text: string) {
  return (text || '').replace(/\s+/g, '').toLowerCase()
}

function splitBlocks(text: string): TextBlock[] {
  const lines = (text || '').split(/\r?\n/)
  const blocks: TextBlock[] = []
  let heading = ''
  let buffer: string[] = []
  let index = 0

  const flush = () => {
    const body = buffer.join('\n').trim()
    if (body) {
      blocks.push({
        id: `b${index++}`,
        heading: heading || undefined,
        text: body,
        searchable: normalizeText(`${heading}\n${body}`),
      })
    }
    buffer = []
  }

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/)
    if (headingMatch) {
      flush()
      heading = headingMatch[1].trim()
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    buffer.push(line)
  }
  flush()
  return blocks
}

function bigrams(value: string) {
  const text = normalizeText(value)
  if (text.length <= 1) return text ? [text] : []
  const grams: string[] = []
  for (let i = 0; i < text.length - 1; i += 1) grams.push(text.slice(i, i + 2))
  return grams
}

function similarity(a: string, b: string) {
  const left = bigrams(a)
  const right = bigrams(b)
  if (left.length === 0 || right.length === 0) return 0
  const counts = new Map<string, number>()
  for (const item of left) counts.set(item, (counts.get(item) ?? 0) + 1)
  let overlap = 0
  for (const item of right) {
    const count = counts.get(item) ?? 0
    if (count > 0) {
      overlap += 1
      counts.set(item, count - 1)
    }
  }
  return (2 * overlap) / (left.length + right.length)
}

function tokenize(text: string) {
  return (text || '').match(/[\u4e00-\u9fff]|[A-Za-z0-9.%~+-]+|\s+|[^\s]/g) ?? []
}

function compactTokens(tokens: DiffToken[]) {
  const compacted: DiffToken[] = []
  for (const token of tokens) {
    const previous = compacted[compacted.length - 1]
    if (previous && previous.type === token.type) {
      previous.text += token.text
    } else {
      compacted.push({ ...token })
    }
  }
  return compacted
}

function diffTokens(original: string, revised: string): TokenDiff {
  const left = tokenize(original)
  const right = tokenize(revised)
  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0))

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const originalTokens: DiffToken[] = []
  const revisedTokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      originalTokens.push({ text: left[i], type: 'equal' })
      revisedTokens.push({ text: right[j], type: 'equal' })
      i += 1
      j += 1
    } else if (j < right.length && (i >= left.length || dp[i][j + 1] >= dp[i + 1][j])) {
      revisedTokens.push({ text: right[j], type: 'insert' })
      j += 1
    } else if (i < left.length) {
      originalTokens.push({ text: left[i], type: 'delete' })
      i += 1
    }
  }

  return {
    originalTokens: compactTokens(originalTokens),
    revisedTokens: compactTokens(revisedTokens),
  }
}

export function buildAiIntegrationDiff(originalText: string, revisionText: string): AiIntegrationDiffResult {
  const originalBlocks = splitBlocks(originalText)
  const revisedBlocks = splitBlocks(revisionText)
  const usedOriginalIds = new Set<string>()
  const blocks: AiIntegrationDiffBlock[] = []

  revisedBlocks.forEach((revisedBlock, index) => {
    const candidates = originalBlocks
      .filter(block => !usedOriginalIds.has(block.id))
      .map(block => ({
        block,
        score: similarity(block.searchable, revisedBlock.searchable),
      }))
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    const sameHeadingBonus = best?.block.heading && best.block.heading === revisedBlock.heading ? 0.08 : 0
    const score = best ? Math.min(1, best.score + sameHeadingBonus) : 0

    if (!best || score < 0.28) {
      blocks.push({
        id: `diff-${index}`,
        heading: revisedBlock.heading,
        originalText: '',
        revisedText: revisedBlock.text,
        originalTokens: [],
        revisedTokens: [{ text: revisedBlock.text, type: 'insert' }],
        similarity: score,
        matchType: 'insert',
      })
      return
    }

    usedOriginalIds.add(best.block.id)
    const tokenDiff = diffTokens(best.block.text, revisedBlock.text)
    const changed = tokenDiff.originalTokens.some(token => token.type === 'delete')
      || tokenDiff.revisedTokens.some(token => token.type === 'insert')
    if (!changed) return

    blocks.push({
      id: `diff-${index}`,
      heading: revisedBlock.heading || best.block.heading,
      originalText: best.block.text,
      revisedText: revisedBlock.text,
      originalTokens: tokenDiff.originalTokens,
      revisedTokens: tokenDiff.revisedTokens,
      similarity: score,
      matchType: 'matched',
    })
  })

  return { blocks }
}
