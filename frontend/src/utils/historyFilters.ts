import type { SessionRecord } from '../types'

export function isOwnHistorySession(session: Pick<SessionRecord, 'owner_id'>, currentUserId: string) {
  return !session.owner_id || session.owner_id === currentUserId
}

export function filterHistorySessions<T extends Pick<SessionRecord, 'owner_id'>>(
  sessions: T[],
  currentUserId: string,
  onlyMine: boolean,
) {
  if (!onlyMine) return sessions
  return sessions.filter(session => isOwnHistorySession(session, currentUserId))
}
