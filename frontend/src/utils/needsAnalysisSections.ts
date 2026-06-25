import type { ArticleSection, ParsedArticle } from '../types'
import { countChineseWords } from './sectionContent.ts'

function inferNumberedHeadingLevel(heading: string): number | null {
  const text = heading.trim()
  if (/^[一二三四五六七八九十百千万]+[、.．]\s*/.test(text)) return 2
  if (/^[（(][一二三四五六七八九十百千万]+[）)]/.test(text)) return 3
  if (/^\d+[、.．]\s*/.test(text)) return 4
  if (/^[（(]\d+[）)]/.test(text)) return 5
  if (/^\d+[）)]/.test(text)) return 5
  return null
}

function effectiveSectionLevel(section: ArticleSection): number {
  return inferNumberedHeadingLevel(section.heading) ?? section.level
}

function appendSectionContent(combined: string, target: ArticleSection, section: ArticleSection): string {
  const prefix = '#'.repeat(Math.max(2, effectiveSectionLevel(section) - effectiveSectionLevel(target) + 1))
  let next = `${combined}\n\n${prefix} ${section.heading}`
  if (section.content.trim()) next += `\n${section.content}`
  return next
}

function buildSubtreeContent(sections: ArticleSection[], targetIndex: number): string {
  const target = sections[targetIndex]
  let combined = target.content

  for (let i = targetIndex + 1; i < sections.length; i += 1) {
    const section = sections[i]
    if (effectiveSectionLevel(section) <= effectiveSectionLevel(target)) break
    combined = appendSectionContent(combined, target, section)
  }

  return combined.trim()
}

export function buildNeedsAnalysisSection(
  parsedArticle: ParsedArticle,
  section: ArticleSection,
): ArticleSection {
  const targetIndex = parsedArticle.sections.findIndex(s => s.id === section.id)
  if (targetIndex < 0) return section

  const content = buildSubtreeContent(parsedArticle.sections, targetIndex)
  return {
    ...section,
    content,
    word_count: countChineseWords(section.heading) + countChineseWords(content),
  }
}

export function getNeedsAnalysisTargetSections(parsedArticle: ParsedArticle): ArticleSection[] {
  const numberedH2Sections = parsedArticle.sections.filter(section => inferNumberedHeadingLevel(section.heading) === 2)
  if (numberedH2Sections.length) {
    return numberedH2Sections.map(section => buildNeedsAnalysisSection(parsedArticle, section))
  }

  const h2Sections = parsedArticle.sections.filter(section => section.level === 2)
  const targets = h2Sections.length ? h2Sections : parsedArticle.sections.filter(section => section.level === 1)
  return targets.map(section => buildNeedsAnalysisSection(parsedArticle, section))
}
