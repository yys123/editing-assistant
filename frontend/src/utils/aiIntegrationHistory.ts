export type AiIntegrationHistoryLike = {
  id: string
}

export type AiIntegrationDisplayLike = {
  answer?: string
  revisionText?: string
}

export type AiIntegrationCompareLike = {
  answer?: string
  originalContentSnapshot?: string
  originalScope?: string
  revisionText?: string
}

export function extractAiIntegrationRevisionText(answer: string | null | undefined) {
  const text = (answer || '').trim()
  const match = text.match(
    /^##\s*修订后正文\s*\n(?<body>[\s\S]*?)(?=\n##\s*(?:修改说明|已解决的问题|仍需人工确认的问题|待确认事项|参考文献)\s*(?:\n|$)|$)/i,
  )
  return match?.groups?.body?.trim() ?? ''
}

export function getAiIntegrationRevisionText(record: AiIntegrationDisplayLike | null | undefined) {
  return record?.revisionText?.trim() || extractAiIntegrationRevisionText(record?.answer)
}

export function getAiIntegrationDisplayText(record: AiIntegrationDisplayLike | null | undefined) {
  return getAiIntegrationRevisionText(record) || record?.answer || ''
}

export function canCompareAiIntegrationRecord(record: AiIntegrationCompareLike | null | undefined) {
  return Boolean(
    record?.originalContentSnapshot?.trim()
    && getAiIntegrationRevisionText(record)
    && record?.originalScope !== 'none',
  )
}

export function getNextAiIntegrationActiveId(
  history: AiIntegrationHistoryLike[],
  deletedId: string,
  activeId: string | null,
) {
  const remaining = history.filter(record => record.id !== deletedId)
  if (remaining.length === 0) return null
  if (activeId && activeId !== deletedId && remaining.some(record => record.id === activeId)) {
    return activeId
  }

  const deletedIndex = history.findIndex(record => record.id === deletedId)
  const fallbackIndex = Math.min(Math.max(deletedIndex, 0), remaining.length - 1)
  return remaining[fallbackIndex]?.id ?? remaining[remaining.length - 1]?.id ?? null
}
