import type { PriorityGuidelineUsage } from '../types'

export type PriorityGuidelineUsageTone = 'success' | 'info' | 'warning' | 'neutral'

export interface PriorityGuidelineUsageDisplay {
  label: string
  tone: PriorityGuidelineUsageTone
  detail?: string
}

export function getPriorityGuidelineUsageDisplay(
  usage?: PriorityGuidelineUsage | null,
): PriorityGuidelineUsageDisplay | null {
  if (!usage || usage.status === 'not_configured') return null
  const detail = [
    ...(usage.used_sources ?? []),
    ...(usage.warnings ?? []),
  ].filter(Boolean).join('；')
  if (usage.status === 'used') {
    return { label: '已优先采用重点指南', tone: 'success', detail }
  }
  if (usage.status === 'not_covered') {
    return { label: '重点指南未覆盖，已使用普通资料补充', tone: 'info', detail }
  }
  if (usage.status === 'not_used') {
    return { label: '未检测到重点指南引用，建议重新生成或人工核查', tone: 'warning', detail }
  }
  return { label: '无法判断重点指南使用情况', tone: 'neutral', detail }
}
