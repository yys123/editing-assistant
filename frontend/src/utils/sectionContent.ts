import type { DraftRecord, ParsedArticle } from '../types'

export function countChineseWords(text: string): number {
  const clean = text
    .replace(/\[H\d\]|\[图片\]|\[表格\]|\[图注\]|\[表格标题\]|\[图片内容\]/g, '')
    .replace(/\^\[\d[\d,，\-~～至]*\]/g, '')
    .replace(/[［\[][⁰¹²³⁴⁵⁶⁷⁸⁹⁻,，\-~～至]+[］\]]/g, '')
    .replace(/[［\[]\d[\d,，\-~～至]*[］\]]/g, '')
    .replace(/\|[-|: ]+\|/g, '')
    .replace(/\|/g, ' ')

  let count = 0
  const chars = Array.from(clean)
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i]
    if (/\s/u.test(char)) continue
    if (/[A-Za-z0-9]/.test(char)) {
      while (i + 1 < chars.length && /[A-Za-z0-9]/.test(chars[i + 1])) i += 1
      count += 1
      continue
    }
    count += 1
  }
  return count
}

export function normalizeSectionHeading(heading: string): string {
  let normalized = heading
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()

  while (normalized) {
    const next = normalized
      .replace(/^第[一二三四五六七八九十百千万\d]+[章节篇部分]\s*/, '')
      .replace(/^[（(][一二三四五六七八九十百千万\d]+[）)]\s*/, '')
      .replace(/^(?:[一二三四五六七八九十百千万]+|\d+)[、.．]\s*/, '')
      .replace(/^\d+[）)]\s*/, '')
      .trim()
    if (next === normalized) break
    normalized = next
  }

  return normalized.replace(/[：:]\s*$/, '').trim().toLocaleLowerCase()
}

function headingsMatch(actual: string, expected: string): boolean {
  return normalizeSectionHeading(actual) === normalizeSectionHeading(expected)
}

/**
 * Extract the content of the section (and its children) matching the gap section path.
 */
export function extractSectionContent(parsedArticle: ParsedArticle | null | undefined, gapSection: string): string {
  if (!parsedArticle) return ''
  const parts = gapSection.split(' > ').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return ''

  const sections = parsedArticle.sections
  const leafHeading = parts[parts.length - 1]

  let targetIdx = -1
  if (parts.length === 1) {
    targetIdx = sections.findIndex(s => headingsMatch(s.heading, leafHeading))
  } else {
    const parentHeading = parts[parts.length - 2]
    for (let i = 0; i < sections.length; i++) {
      if (!headingsMatch(sections[i].heading, leafHeading)) continue
      for (let j = i - 1; j >= 0; j--) {
        if (sections[j].level < sections[i].level) {
          if (headingsMatch(sections[j].heading, parentHeading)) targetIdx = i
          break
        }
      }
      if (targetIdx >= 0) break
    }
    if (targetIdx < 0) targetIdx = sections.findIndex(s => headingsMatch(s.heading, leafHeading))
  }

  if (targetIdx < 0) return ''

  const target = sections[targetIdx]
  let combined = target.content

  for (let i = targetIdx + 1; i < sections.length; i++) {
    if (sections[i].level <= target.level) break
    const prefix = '#'.repeat(sections[i].level - target.level + 1)
    combined += `\n\n${prefix} ${sections[i].heading}`
    if (sections[i].content.trim()) combined += '\n' + sections[i].content
  }

  return combined
}

export function backfillDraftOriginalContent(
  draftHistory: DraftRecord[],
  parsedArticle: ParsedArticle | null | undefined,
): DraftRecord[] {
  if (!parsedArticle) return draftHistory

  let changed = false
  const next = draftHistory.map(record => {
    if (record.draft.original_content?.trim()) return record
    const originalContent = extractSectionContent(parsedArticle, record.gap.section)
    if (!originalContent.trim()) return record

    changed = true
    return {
      ...record,
      draft: {
        ...record.draft,
        original_content: originalContent,
      },
    }
  })

  return changed ? next : draftHistory
}
