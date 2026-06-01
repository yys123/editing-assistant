const TOP_LEVEL_MODULES = new Set(['基础知识', '诊断', '鉴别诊断', '治疗', '控制目标', '经典用药', '预后', '预防'])

function normalizeModuleHeading(text: string) {
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

function isTopLevelModuleHeading(text: string) {
  return TOP_LEVEL_MODULES.has(normalizeModuleHeading(text))
}

function hasStructuredMarkers(text: string) {
  return /^\[H[123]\]\s+.+$/m.test(text)
}

function isLevel2Heading(text: string) {
  return /^[一二三四五六七八九十百]+、\s*\S+/.test(text.trim())
}

function isLevel3Heading(text: string) {
  return /^(?:[（(][一二三四五六七八九十百\d]+[）)]|\d+[、.)])\s*\S+/.test(text.trim())
}

export function articleContentToStructuredMarkers(text: string) {
  const normalizedText = text.replace(/\r\n?/g, '\n')
  if (hasStructuredMarkers(normalizedText)) return normalizedText

  const lines = normalizedText.split('\n')
  if (!lines.some(line => isTopLevelModuleHeading(line))) return normalizedText

  let insideModule = false
  let hasLevel2InModule = false

  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return line

    if (isTopLevelModuleHeading(trimmed)) {
      insideModule = true
      hasLevel2InModule = false
      return `[H1] ${trimmed}`
    }

    if (!insideModule) return line

    if (isLevel2Heading(trimmed)) {
      hasLevel2InModule = true
      return `[H2] ${trimmed}`
    }

    if (hasLevel2InModule && isLevel3Heading(trimmed)) {
      return `[H3] ${trimmed}`
    }

    return line
  }).join('\n')
}
