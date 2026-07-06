export function normalizeModuleHeading(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/^[#*\-—_\s]+|[#*\-—_\s]+$/g, '')
    .replace(/^【(.+)】$/, '$1')
    .replace(/^［(.+)］$/, '$1')
    .replace(/^\[(.+)\]$/, '$1')
    .replace(/^（(.+)）$/, '$1')
    .replace(/^\((.+)\)$/, '$1')
    .replace(/字段$/, '')
}

export function normalizeEntryTitleText(text: string) {
  return normalizeModuleHeading(text).replace(/[：:。；;，,]+$/g, '')
}

export function isEntryTitleText(text: string, entryName: string) {
  const title = normalizeEntryTitleText(text)
  const name = normalizeEntryTitleText(entryName)
  return Boolean(title && name && title === name)
}

export function isStructuredContentHeading(line: string) {
  const text = line.trim()
  if (!text) return false
  return /^(?:[一二三四五六七八九十百]+、|[（(][一二三四五六七八九十百\d]+[）)]|\d+[、.])\S+/.test(text)
}

const ENTRY_MODULE_HEADINGS = new Set([
  '基础知识',
  '定义',
  '概述',
  '病因',
  '发病机制',
  '病理生理',
  '临床表现',
  '症状',
  '体征',
  '病史',
  '检查',
  '辅助检查',
  '诊断',
  '鉴别诊断',
  '治疗',
  '预后',
  '预防',
  '并发症',
  '参考文献',
])

export function isEntryTitleCandidate(text: string) {
  const title = normalizeEntryTitleText(text)
  if (!title || title.length > 40) return false
  if (ENTRY_MODULE_HEADINGS.has(title)) return false
  return !isStructuredContentHeading(text)
}

export function extractLeadingEntryTitleFromText(text: string) {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return { title: '', text: '' }

  const lines = normalized.split('\n')
  const firstContentIndex = lines.findIndex(line => line.trim())
  if (firstContentIndex < 0) return { title: '', text: normalized }

  const firstLine = lines[firstContentIndex].trim()
  if (!isEntryTitleCandidate(firstLine)) return { title: '', text: normalized }

  lines.splice(firstContentIndex, 1)
  return {
    title: normalizeEntryTitleText(firstLine),
    text: lines.join('\n').trim(),
  }
}

export function resolveEntryLibraryDiseaseName(entryName: string, leadingTitle: string) {
  const title = normalizeEntryTitleText(leadingTitle)
  return title || entryName.trim()
}
