export type AiIntegrationHistoryLike = {
  id: string
}

export type AiIntegrationDisplayLike = {
  answer?: string
  revisionText?: string
}

export function getAiIntegrationDisplayText(record: AiIntegrationDisplayLike | null | undefined) {
  return record?.revisionText?.trim() || record?.answer || ''
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
