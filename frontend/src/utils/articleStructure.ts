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

  const lines = normalizedText.split('\n')
  const hasExplicitMarkers = hasStructuredMarkers(normalizedText)
  if (!hasExplicitMarkers) return normalizedText

  let insideModule = false
  let hasLevel2InModule = false

  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return line

    const markerMatch = trimmed.match(/^\[H([123])\]\s+(.+)$/)
    if (markerMatch) {
      insideModule = Number(markerMatch[1]) === 1 || insideModule
      hasLevel2InModule = Number(markerMatch[1]) === 2 ? true : Number(markerMatch[1]) === 1 ? false : hasLevel2InModule
      return line
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
