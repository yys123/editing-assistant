function hasStructuredMarkers(text: string) {
  return /^\[H[123]\]\s+.+$/m.test(text)
}

function isLevel2Heading(text: string) {
  return /^[一二三四五六七八九十百]+、\s*\S+/.test(text.trim())
}

function isLevel3Heading(text: string) {
  return /^(?:[（(][一二三四五六七八九十百\d]+[）)]|\d+[、.)])\s*\S+/.test(text.trim())
}

function splitInlineLevel3Heading(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.+[。；;：:])\s+((?:[（(][一二三四五六七八九十百\d]+[）)]|\d+[、.)])\s*\S.*)$/)
  if (!match) return null
  const [, body, heading] = match
  return { body, heading }
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

    if (hasLevel2InModule) {
      const inlineLevel3 = splitInlineLevel3Heading(trimmed)
      if (inlineLevel3) {
        return `${inlineLevel3.body}\n[H3] ${inlineLevel3.heading}`
      }
    }

    return line
  }).join('\n')
}
