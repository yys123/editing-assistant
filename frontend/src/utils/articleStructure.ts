function hasStructuredMarkers(text: string) {
  return /^\[H[123]\]\s+.+$/m.test(text)
}

function isLevel2Heading(text: string) {
  return /^[一二三四五六七八九十百]+、\s*\S+/.test(text.trim())
}

function isLevel3Heading(text: string) {
  const trimmed = text.trim()
  if (isLongArabicListItem(trimmed)) return false
  if (/^\d+[、.)]\s*\S+/.test(trimmed)) return true
  return /^[（(][一二三四五六七八九十百\d]+[）)]\s*\S+/.test(trimmed)
}

function isLongArabicListItem(text: string) {
  const trimmed = text.trim()
  return /^\d+[、.)]\s*\S+/.test(trimmed) && trimmed.length > 36
}

function isFigureOrTableCaptionLine(text: string) {
  return /^(?:\[图注\]|\[图片\]|(?:图|表)\s*\d+\s*\S*|[ivxlcdm]+\.\s+\S+)/i.test(text.trim())
}

function splitInlineLevel3Heading(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^((?:\[图注\]\s*)?.+[。；;：:])\s+((?:[（(][一二三四五六七八九十百\d]+[）)]|\d+[、.)])\s*\S.*)$/)
  if (!match) return null
  const [, body, heading] = match
  if (/^\d+[、.)]/.test(heading.trim()) && heading.trim().length > 36) return null
  return { body, heading }
}

function splitCaptionTrailingLevel3Heading(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^((?:图|表)\s*\d+[^\n]*?\]?)\s*((?:[（(][一二三四五六七八九十百\d]+[）)]|\d+[、.)])\s*\S.*)$/)
  if (!match) return null
  const [, body, heading] = match
  return { body: body.trim(), heading: heading.trim() }
}

export function articleContentToStructuredMarkers(text: string) {
  const normalizedText = text.replace(/\r\n?/g, '\n')

  const lines = normalizedText.split('\n')
  const hasExplicitMarkers = hasStructuredMarkers(normalizedText)
  if (!hasExplicitMarkers) return normalizedText

  let insideModule = false
  let hasLevel2InModule = false
  let prevNonEmptyLine = ''

  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return line

    const markerMatch = trimmed.match(/^\[H([123])\]\s+(.+)$/)
    if (markerMatch) {
      const markerLevel = Number(markerMatch[1])
      const markerText = markerMatch[2].trim()
      if (markerLevel === 3 && isLongArabicListItem(markerText)) {
        prevNonEmptyLine = markerText
        return markerText
      }
      insideModule = markerLevel === 1 || insideModule
      hasLevel2InModule = markerLevel === 2 ? true : markerLevel === 1 ? false : hasLevel2InModule
      prevNonEmptyLine = trimmed
      return line
    }

    if (!insideModule) return line

    if (isLevel2Heading(trimmed)) {
      hasLevel2InModule = true
      return `[H2] ${trimmed}`
    }

    if (hasLevel2InModule && isLevel3Heading(trimmed)) {
      prevNonEmptyLine = `[H3] ${trimmed}`
      return `[H3] ${trimmed}`
    }

    const captionLevel3InModule = splitCaptionTrailingLevel3Heading(trimmed)
    if (captionLevel3InModule) {
      prevNonEmptyLine = `[H3] ${captionLevel3InModule.heading}`
      return `${captionLevel3InModule.body}\n[H3] ${captionLevel3InModule.heading}`
    }

    const inlineLevel3 = splitInlineLevel3Heading(trimmed)
    if (inlineLevel3) {
      prevNonEmptyLine = `[H3] ${inlineLevel3.heading}`
      return `${inlineLevel3.body}\n[H3] ${inlineLevel3.heading}`
    }

    if (isFigureOrTableCaptionLine(prevNonEmptyLine) && isLevel3Heading(trimmed)) {
      prevNonEmptyLine = `[H3] ${trimmed}`
      return `[H3] ${trimmed}`
    }

    const captionLevel3 = splitCaptionTrailingLevel3Heading(trimmed)
    if (captionLevel3) {
      prevNonEmptyLine = `[H3] ${captionLevel3.heading}`
      return `${captionLevel3.body}\n[H3] ${captionLevel3.heading}`
    }

    prevNonEmptyLine = trimmed
    return line
  }).join('\n')
}
