import { useEffect, useMemo, useState } from 'react'
import {
  clinicMasterMaterialToReferenceDoc,
  createClinicMasterQuery,
  refreshClinicMasterQuery,
  type ClinicMasterMaterial,
  type ClinicMasterQueryResponse,
} from '../api'
import type { ConfirmedReferenceChunk, ReferenceDoc } from '../types'

interface ClinicMasterPanelProps {
  title: string
  placeholder: string
  addButtonLabel: string
  defaultQuestion?: string
  historyStorageKey?: string
  onAddReferenceDocs?: (docs: ReferenceDoc[]) => ClinicMasterReferenceAdditionStats | void
  showRecommendedGuides?: boolean
  confirmedChunkSourceIdBase?: number
  onConfirmReferenceChunks?: (chunks: ConfirmedReferenceChunk[]) => void
}

interface ClinicMasterReferenceAdditionStats {
  added: number
  duplicates: number
}

interface ClinicMasterReferenceAddition extends ClinicMasterReferenceAdditionStats {
  docs: ReferenceDoc[]
  unusable: number
}

interface ClinicMasterHistoryItem {
  id: string
  createdAt: string
  response: ClinicMasterQueryResponse
}

export type ClinicMasterCitation = {
  id: string
  label: string
  refNumber: string
  occurrence: number
  chunkId: string
  detail?: ClinicMasterMaterial
}

export type ClinicMasterCitationDisplayPart =
  | { type: 'text'; text: string }
  | { type: 'citation'; citation: ClinicMasterCitation }

export type ClinicMasterCitationDisplay = {
  parts: ClinicMasterCitationDisplayPart[]
  citations: ClinicMasterCitation[]
}

export type ClinicMasterAnswerDisplay = {
  question: string
  text: string
}

export type ClinicMasterGuideNamePart =
  | { type: 'text'; text: string }
  | { type: 'guide_name'; text: string }

export type ClinicMasterRecommendedGuide = {
  id: string
  number: number
  title: string
  text: string
  sourceLabel: string
  chunkId: string
  makerName?: string
  linkUrl?: string
  sourceName?: string
  publishTime?: string
}

export function formatReadyCountdown(value: string, nowMs = Date.now()) {
  if (!value) return '约 2 分钟后自动获取结果'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '约 2 分钟后自动获取结果'
  const seconds = Math.max(0, Math.ceil((date.getTime() - nowMs) / 1000))
  if (seconds <= 0) return '正在获取结果'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes <= 0) return `约 ${remainingSeconds} 秒后自动获取结果`
  if (remainingSeconds === 0) return `约 ${minutes} 分钟后自动获取结果`
  return `约 ${minutes} 分 ${remainingSeconds} 秒后自动获取结果`
}

export function getClinicMasterAutoRefreshDelay(value: string, nowMs = Date.now()) {
  if (!value) return 120000
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 120000
  return Math.max(0, date.getTime() - nowMs)
}

export function materialTypeLabel(type: ClinicMasterMaterial['type']) {
  if (type === 'answer') return '回答'
  if (type === 'chat_detail') return '对话'
  if (type === 'reference_detail') return '文献详情'
  return '参考列表'
}

function materialTypeIcon(type: ClinicMasterMaterial['type']) {
  if (type === 'answer') return 'psychology_alt'
  if (type === 'reference_detail') return 'article'
  if (type === 'chat_detail') return 'chat'
  return 'format_list_bulleted'
}

function materialTypeTone(type: ClinicMasterMaterial['type']) {
  if (type === 'answer') return 'answer'
  if (type === 'reference_detail') return 'detail'
  if (type === 'chat_detail') return 'chat'
  return 'reference'
}

export function shouldShowClinicMasterMaterialInline(type: ClinicMasterMaterial['type']) {
  return type === 'answer'
}

export function shouldShowClinicMasterMaterialCard(type: ClinicMasterMaterial['type']) {
  return type !== 'reference_detail'
}

export function shouldUseClinicMasterMaterialAsChunk(type: ClinicMasterMaterial['type']) {
  return type === 'answer' || type === 'reference' || type === 'reference_detail'
}

export function shouldUseClinicMasterMaterialAsReference(type: ClinicMasterMaterial['type']) {
  return type === 'answer' || type === 'reference_detail'
}

export function buildClinicMasterReferenceAddition(
  materials: ClinicMasterMaterial[],
  selectedIds: Set<string>,
): ClinicMasterReferenceAddition {
  const docs: ReferenceDoc[] = []
  let unusable = 0
  for (const material of materials) {
    if (!selectedIds.has(material.id) || !shouldUseClinicMasterMaterialAsReference(material.type)) continue
    if (!material.text.trim()) {
      unusable += 1
      continue
    }
    docs.push(clinicMasterMaterialToReferenceDoc(material, docs.length + 1))
  }
  return { docs, added: docs.length, duplicates: 0, unusable }
}

export function formatClinicMasterReferenceAddition(result: Pick<ClinicMasterReferenceAddition, 'added' | 'duplicates' | 'unusable'>) {
  const parts = [`已加入 ${result.added} 条`]
  if (result.duplicates) parts.push(`跳过重复 ${result.duplicates} 条`)
  if (result.unusable) parts.push(`无可用正文 ${result.unusable} 条`)
  return parts.join('；')
}

export function shouldShowClinicMasterMetadata(type: ClinicMasterMaterial['type']) {
  return type !== 'answer' && type !== 'reference_detail'
}

export function shouldShowClinicMasterResults(visibleMaterialCount: number, recommendedGuideCount: number) {
  return visibleMaterialCount > 0 || recommendedGuideCount > 0
}

export function formatClinicMasterResultSummary(answerCount: number, recommendedGuideCount: number) {
  const parts: string[] = []
  if (answerCount > 0) parts.push(`回答 ${answerCount}`)
  if (recommendedGuideCount > 0) parts.push(`推荐指南 ${recommendedGuideCount}`)
  return parts.join(' · ')
}

export function formatClinicMasterHistorySummary(createdAt: string) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    `提问时间：${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(' ')
}

export function shouldShowClinicMasterResultPanel(allCollapsed: boolean, visibleMaterialCount: number, recommendedGuideCount: number) {
  return !allCollapsed && shouldShowClinicMasterResults(visibleMaterialCount, recommendedGuideCount)
}

export function shouldShowClinicMasterGuideData() {
  return false
}

export function getClinicMasterInitialQuestion(_defaultQuestion = '') {
  return ''
}

export function shouldShowClinicMasterHistoryList(historyCount: number, collapsed: boolean) {
  return historyCount > 0 && !collapsed
}

export function clinicMasterHistoryToggleLabel(collapsed: boolean) {
  return collapsed ? '展开历史' : '折叠历史'
}

function stripClinicMasterMarkdown(text: string) {
  return text
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\[H\d+\]\s*/g, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildClinicMasterAnswerDisplay(text: string): ClinicMasterAnswerDisplay {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n')
  const normalizedLines = [...lines]
  let question = ''

  const firstContentIndex = normalizedLines.findIndex(line => line.trim())
  if (firstContentIndex >= 0) {
    const titleMatch = normalizedLines[firstContentIndex].trim().match(/^\[H\d+\]\s*ClinMaster\s*回答[:：]\s*(.+)$/)
    if (titleMatch) {
      question = titleMatch[1].trim()
      normalizedLines.splice(firstContentIndex, 1)
    }
  }

  const questionIndex = normalizedLines.findIndex(line => /^问题[:：]/.test(line.trim()))
  if (questionIndex >= 0) {
    const questionText = normalizedLines[questionIndex].trim().replace(/^问题[:：]\s*/, '').trim()
    if (questionText) question = questionText
    normalizedLines.splice(questionIndex, 1)
  }

  const answerLabelIndex = normalizedLines.findIndex(line => /^回答[:：]\s*$/.test(line.trim()))
  if (answerLabelIndex >= 0) normalizedLines.splice(answerLabelIndex, 1)

  return {
    question: stripClinicMasterMarkdown(question),
    text: stripClinicMasterMarkdown(normalizedLines.join('\n')),
  }
}

export function buildClinicMasterGuideNameParts(text: string): ClinicMasterGuideNamePart[] {
  const parts: ClinicMasterGuideNamePart[] = []
  const guideNamePattern = /《[^》\n]+》/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = guideNamePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'guide_name', text: match[0] })
    lastIndex = guideNamePattern.lastIndex
  }

  if (lastIndex < text.length) parts.push({ type: 'text', text: text.slice(lastIndex) })
  return parts
}

export function buildClinicMasterReferenceDetailDisplay(text: string) {
  return stripClinicMasterMarkdown(text)
    .replace(/^ClinMaster\s*文献详情[:：][^\n]*(\n+|$)/, '')
    .trim()
}

export function shouldShowClinicMasterGuidesWhenCollapsed(expanded: boolean, guideCount: number) {
  return expanded && guideCount > 0
}

export function clinicMasterCollapseAllLabel(allCollapsed: boolean) {
  return allCollapsed ? '展开内容' : '收回'
}

function safeClinicMasterChunkPart(value: string, fallback: string) {
  return (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 120) || fallback
}

export function clinicMasterMaterialToConfirmedChunk(
  material: ClinicMasterMaterial,
  sourceId: number,
  fallbackIndex = 1,
): ConfirmedReferenceChunk {
  const typeLabel = materialTypeLabel(material.type)
  const safeTitle = safeClinicMasterChunkPart(material.title, `${typeLabel}-${fallbackIndex}`)
  const safeId = safeClinicMasterChunkPart(material.id, String(fallbackIndex))
  return {
    chunk_id: `clinic-master-${material.type}-${safeId}`,
    source_id: sourceId,
    source_filename: `ClinMaster-${typeLabel}-${safeTitle}.md`,
    title_path: `临床决策 / ${typeLabel} / ${material.title || `${typeLabel}-${fallbackIndex}`}`,
    text: material.text,
    source_ref_ids: [],
    selected_by: 'user',
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringField(value: unknown, keys: string[]): string {
  const record = asRecord(value)
  if (!record) return ''
  for (const key of keys) {
    const field = record[key]
    if (typeof field === 'string' && field.trim()) return field.trim()
    if (typeof field === 'number') return String(field)
  }
  return ''
}

function formatClinicMasterReferenceRecord(value: unknown): string {
  const record = asRecord(value)
  if (!record) return ''
  return Object.entries(record)
    .filter(([, field]) => field !== null && field !== undefined && String(field).trim())
    .map(([key, field]) => {
      if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') {
        return `${key}：${field}`
      }
      try {
        return `${key}：${JSON.stringify(field)}`
      } catch {
        return `${key}：${String(field)}`
      }
    })
    .join('\n')
}

function getClinicMasterReferenceRecord(material: Pick<ClinicMasterMaterial, 'metadata'>): Record<string, unknown> | null {
  const metadata = asRecord(material.metadata)
  return asRecord(metadata?.reference)
}

function shouldIncludeClinicMasterGuide(reference: Record<string, unknown> | null) {
  return stringField(reference, ['sourceName', 'source_name']) !== '诊疗方案'
}

function hasClinicMasterGuideDisplayFields(reference: Record<string, unknown> | null) {
  return Boolean(stringField(reference, [
    'mainTitle',
    'main_title',
    'makerName',
    'maker_name',
    'sourceName',
    'source_name',
    'linkUrl',
    'link_url',
    'url',
    'publishTime',
    'publish_time',
  ]))
}

function clinicMasterGuideTitle(reference: Record<string, unknown> | null, fallback: string) {
  return stringField(reference, [
    'mainTitle',
    'main_title',
    'title',
    'name',
    'docTitle',
    'doc_title',
    'referenceTitle',
    'reference_title',
  ]) || fallback
}

function clinicMasterGuideIdentity(reference: Record<string, unknown> | null, title: string, chunkId: string, text: string) {
  const linkUrl = stringField(reference, ['linkUrl', 'link_url', 'url'])
  if (linkUrl) return `link:${linkUrl}`
  const mainId = stringField(reference, ['mainId', 'main_id'])
  if (mainId) return `main:${mainId}`
  const makerName = stringField(reference, ['makerName', 'maker_name'])
  const sourceName = stringField(reference, ['sourceName', 'source_name'])
  const mainTitle = stringField(reference, ['mainTitle', 'main_title'])
  if (mainTitle || makerName || sourceName) return `guide:${mainTitle || title}\n${makerName}\n${sourceName}`
  return chunkId || `${title}\n${text}`
}

export function formatClinicMasterGuideMeta(guide: Pick<ClinicMasterRecommendedGuide, 'sourceName' | 'publishTime'>) {
  const items: string[] = []
  if (guide.sourceName) items.push(`类型：${guide.sourceName}`)
  if (guide.publishTime) items.push(`发表日期：${guide.publishTime}`)
  return items
}

export function getClinicMasterReferenceChunkId(material: Pick<ClinicMasterMaterial, 'metadata'>): string {
  const metadata = asRecord(material.metadata)
  if (!metadata) return ''
  const detailRequestChunkId = stringField(metadata.detail_request, ['chunkIds', 'chunkId'])
  if (detailRequestChunkId) return detailRequestChunkId
  const referenceChunkId = stringField(metadata.reference, ['chunkIds', 'chunkId', 'id', 'referenceId', 'reference_id'])
  if (referenceChunkId) return referenceChunkId
  return stringField(metadata, ['chunkIds', 'chunkId'])
}

export function buildClinicMasterCitationDisplay(
  text: string,
  detailMaterials: ClinicMasterMaterial[],
): ClinicMasterCitationDisplay {
  const detailsByChunkId = new Map<string, ClinicMasterMaterial>()
  for (const material of detailMaterials) {
    const chunkId = getClinicMasterReferenceChunkId(material)
    if (chunkId && !detailsByChunkId.has(chunkId)) detailsByChunkId.set(chunkId, material)
  }

  const parts: ClinicMasterCitationDisplayPart[] = []
  const citations: ClinicMasterCitation[] = []
  const counts = new Map<string, number>()
  const citationPattern = /\[ref:(\d+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = citationPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    } else if (parts[parts.length - 1]?.type === 'citation') {
      parts.push({ type: 'text', text: '、' })
    }
    const refNumber = match[1]
    const chunkId = match[2].trim()
    const occurrence = (counts.get(refNumber) ?? 0) + 1
    counts.set(refNumber, occurrence)
    const citation: ClinicMasterCitation = {
      id: `${refNumber}-${occurrence}-${chunkId}`,
      label: `${refNumber}-${occurrence}`,
      refNumber,
      occurrence,
      chunkId,
      detail: detailsByChunkId.get(chunkId),
    }
    citations.push(citation)
    parts.push({ type: 'citation', citation })
    lastIndex = citationPattern.lastIndex
  }

  if (lastIndex < text.length) parts.push({ type: 'text', text: text.slice(lastIndex) })
  return { parts, citations }
}

export function buildClinicMasterRecommendedGuides(materials: ClinicMasterMaterial[]): ClinicMasterRecommendedGuide[] {
  const guides: Omit<ClinicMasterRecommendedGuide, 'number'>[] = []
  const seen = new Set<string>()
  const addGuide = (guide: Omit<ClinicMasterRecommendedGuide, 'number'>, reference: Record<string, unknown> | null) => {
  const key = clinicMasterGuideIdentity(reference, guide.title, guide.chunkId, guide.text)
    if (seen.has(key)) return
    seen.add(key)
    guides.push(guide)
  }

  for (const material of materials) {
    if (material.type !== 'reference') continue
    const reference = getClinicMasterReferenceRecord(material)
    if (!shouldIncludeClinicMasterGuide(reference)) continue
    const makerName = stringField(reference, ['makerName', 'maker_name'])
    const linkUrl = stringField(reference, ['linkUrl', 'link_url', 'url'])
    const sourceName = stringField(reference, ['sourceName', 'source_name'])
    const publishTime = stringField(reference, ['publishTime', 'publish_time', 'publishedAt', 'published_at'])
    addGuide({
      id: material.id,
      title: clinicMasterGuideTitle(reference, material.title),
      text: hasClinicMasterGuideDisplayFields(reference) ? formatClinicMasterReferenceRecord(reference) : material.text,
      sourceLabel: material.sourceLabel,
      chunkId: getClinicMasterReferenceChunkId(material),
      ...(makerName ? { makerName } : {}),
      ...(linkUrl ? { linkUrl } : {}),
      ...(sourceName ? { sourceName } : {}),
      ...(publishTime ? { publishTime } : {}),
    }, reference)
  }

  for (const material of materials) {
    if (material.type !== 'reference_detail') continue
    const reference = getClinicMasterReferenceRecord(material)
    if (!reference) continue
    if (!shouldIncludeClinicMasterGuide(reference)) continue
    const chunkId = getClinicMasterReferenceChunkId(material)
    const makerName = stringField(reference, ['makerName', 'maker_name'])
    const linkUrl = stringField(reference, ['linkUrl', 'link_url', 'url'])
    const sourceName = stringField(reference, ['sourceName', 'source_name'])
    const publishTime = stringField(reference, ['publishTime', 'publish_time', 'publishedAt', 'published_at'])
    addGuide({
      id: material.id,
      title: clinicMasterGuideTitle(reference, material.title),
      text: formatClinicMasterReferenceRecord(reference),
      sourceLabel: 'ClinMaster 参考资料',
      chunkId,
      ...(makerName ? { makerName } : {}),
      ...(linkUrl ? { linkUrl } : {}),
      ...(sourceName ? { sourceName } : {}),
      ...(publishTime ? { publishTime } : {}),
    }, reference)
  }

  return guides.map((guide, index) => ({
    ...guide,
    number: index + 1,
  }))
}

function logClinicMasterResult(label: string, data: ClinicMasterQueryResponse) {
  if (data.status === 'failed' || data.error || data.warnings.length > 0 || data.debug) {
    console.warn(`[ClinicMaster ${label}]`, data)
  }
}

export function formatClinicMasterDebug(debug: ClinicMasterQueryResponse['debug']) {
  if (!debug) return ''
  try {
    return JSON.stringify(debug, null, 2)
  } catch {
    return String(debug)
  }
}

export function formatClinicMasterMetadata(metadata: ClinicMasterMaterial['metadata']) {
  if (!metadata) return ''
  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return String(metadata)
  }
}

function readHistory(storageKey: string): ClinicMasterHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, 20) : []
  } catch {
    return []
  }
}

function writeHistory(storageKey: string, history: ClinicMasterHistoryItem[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 20)))
  } catch {
    // Ignore storage quota/private mode failures; current-page state still works.
  }
}

function ClinicMasterAnswerTextParts({ text }: { text: string }) {
  return (
    <>
      {buildClinicMasterGuideNameParts(text).map((part, index) => (
        part.type === 'guide_name'
          ? <strong key={index} className="clinic-master-answer-guide-name">{part.text}</strong>
          : <span key={index}>{part.text}</span>
      ))}
    </>
  )
}

function ClinicMasterAnswerReferenceView({
  answer,
  detailMaterials,
  collapsed,
}: {
  answer: ClinicMasterMaterial
  detailMaterials: ClinicMasterMaterial[]
  collapsed: boolean
}) {
  const answerDisplay = useMemo(() => buildClinicMasterAnswerDisplay(answer.text), [answer.text])
  const display = useMemo(
    () => buildClinicMasterCitationDisplay(answerDisplay.text, detailMaterials),
    [answerDisplay.text, detailMaterials],
  )
  const [activeCitationId, setActiveCitationId] = useState<string | null>(display.citations[0]?.id ?? null)

  useEffect(() => {
    if (display.citations.length === 0) {
      if (activeCitationId) setActiveCitationId(null)
      return
    }
    if (!activeCitationId || !display.citations.some(citation => citation.id === activeCitationId)) {
      setActiveCitationId(display.citations[0].id)
    }
  }, [activeCitationId, display.citations])

  const activeCitation = display.citations.find(citation => citation.id === activeCitationId) ?? display.citations[0] ?? null
  const activeReferenceText = activeCitation?.detail ? buildClinicMasterReferenceDetailDisplay(activeCitation.detail.text) : ''

  if (display.citations.length === 0) {
    return (
      <div className="clinic-master-answer-readable">
        {answerDisplay.question && (
          <div className="clinic-master-answer-question">
            <strong>问题：</strong>
            <span>{answerDisplay.question}</span>
          </div>
        )}
        {!collapsed && (
          <pre className="clinic-master-material-inline-text">
            <ClinicMasterAnswerTextParts text={answerDisplay.text} />
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="clinic-master-answer-reference-view">
      <div className="clinic-master-answer-pane">
        {answerDisplay.question && (
          <div className="clinic-master-answer-question">
            <strong>问题：</strong>
            <span>{answerDisplay.question}</span>
          </div>
        )}
        {!collapsed && (
          <div className="clinic-master-answer-text">
            {display.parts.map((part, index) => {
              if (part.type === 'text') return <ClinicMasterAnswerTextParts key={index} text={part.text} />
              const active = part.citation.id === activeCitation?.id
              return (
                <button
                  key={part.citation.id}
                  type="button"
                  className={`clinic-master-citation-link${active ? ' active' : ''}${part.citation.detail ? '' : ' missing'}`}
                  title={part.citation.detail ? `查看文献详情：${part.citation.detail.title}` : `未找到文献详情：${part.citation.chunkId}`}
                  onClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    setActiveCitationId(part.citation.id)
                  }}
                >
                  [{part.citation.label}]
                </button>
              )
            })}
          </div>
        )}
      </div>
      <aside className="clinic-master-reference-pane" aria-label="参考文献详情">
        <div className="clinic-master-reference-pane-head">
          <div>
            <div className="clinic-master-reference-pane-kicker">参考文献</div>
            <div className="clinic-master-reference-pane-title">
              {activeCitation?.detail?.title ?? '未找到文献详情'}
            </div>
          </div>
          {activeCitation && <span className="clinic-master-reference-pane-label">[{activeCitation.label}]</span>}
        </div>
        {activeCitation?.detail ? (
          <>
            <div className="clinic-master-reference-pane-meta">
              {activeCitation.detail.sourceLabel} · {activeCitation.chunkId}
            </div>
            {!collapsed && <pre className="clinic-master-reference-pane-text">{activeReferenceText}</pre>}
          </>
        ) : (
          <div className="clinic-master-reference-pane-empty">
            该引用对应的文献详情尚未返回：{activeCitation?.chunkId}
          </div>
        )}
      </aside>
    </div>
  )
}

export default function ClinicMasterPanel({
  addButtonLabel,
  placeholder,
  defaultQuestion = '',
  historyStorageKey = 'clinic-master-query-history',
  onAddReferenceDocs,
  showRecommendedGuides = true,
  confirmedChunkSourceIdBase = 1,
  onConfirmReferenceChunks,
}: ClinicMasterPanelProps) {
  const [question, setQuestion] = useState(() => getClinicMasterInitialQuestion(defaultQuestion))
  const [query, setQuery] = useState<ClinicMasterQueryResponse | null>(null)
  const [history, setHistory] = useState<ClinicMasterHistoryItem[]>(() => readHistory(historyStorageKey))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())
  const [allCollapsed, setAllCollapsed] = useState(false)
  const [guidesExpanded, setGuidesExpanded] = useState(true)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [additionNotice, setAdditionNotice] = useState('')

  useEffect(() => {
    if (query?.status !== 'pending') return
    setNowMs(Date.now())
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [query?.status, query?.ready_at])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const readyCountdown = query ? formatReadyCountdown(query.ready_at, nowMs) : '约 2 分钟后自动获取结果'
  const debugText = useMemo(() => formatClinicMasterDebug(query?.debug), [query?.debug])
  const groupedMaterials = useMemo(() => {
    const materials = query?.materials ?? []
    return {
      answer: materials.filter(material => material.type === 'answer'),
      references: materials.filter(material => material.type === 'reference'),
      details: materials.filter(material => material.type === 'reference_detail'),
      other: materials.filter(material => !['answer', 'reference', 'reference_detail'].includes(material.type)),
    }
  }, [query?.materials])
  const selectableMaterials = useMemo(
    () => (query?.materials ?? []).filter(material => (
      onConfirmReferenceChunks
        ? shouldUseClinicMasterMaterialAsChunk(material.type)
        : onAddReferenceDocs
          ? shouldUseClinicMasterMaterialAsReference(material.type)
          : shouldShowClinicMasterMaterialCard(material.type)
    )),
    [onAddReferenceDocs, onConfirmReferenceChunks, query?.materials],
  )
  const visibleMaterials = useMemo(
    () => onConfirmReferenceChunks
      ? selectableMaterials
      : onAddReferenceDocs
        ? selectableMaterials
        : (query?.materials ?? []).filter(material => shouldShowClinicMasterMaterialCard(material.type)),
    [onAddReferenceDocs, onConfirmReferenceChunks, query?.materials, selectableMaterials],
  )
  const recommendedGuides = useMemo(
    () => showRecommendedGuides ? buildClinicMasterRecommendedGuides(query?.materials ?? []) : [],
    [query?.materials, showRecommendedGuides],
  )
  const confirmedChunks = useMemo(
    () => {
      if (!onConfirmReferenceChunks || !query || query.status === 'pending') return []
      return selectableMaterials
        .map((material, index) => ({ material, sourceId: confirmedChunkSourceIdBase + index }))
        .filter(item => selectedIdSet.has(item.material.id))
        .map((item, index) => clinicMasterMaterialToConfirmedChunk(item.material, item.sourceId, index + 1))
    },
    [confirmedChunkSourceIdBase, onConfirmReferenceChunks, query, selectableMaterials, selectedIdSet],
  )
  const referenceAddition = useMemo(
    () => buildClinicMasterReferenceAddition(query?.materials ?? [], selectedIdSet),
    [query?.materials, selectedIdSet],
  )

  useEffect(() => {
    if (!onConfirmReferenceChunks) return
    onConfirmReferenceChunks(confirmedChunks)
  }, [confirmedChunks, onConfirmReferenceChunks])

  const saveHistoryItem = (data: ClinicMasterQueryResponse) => {
    if (data.status === 'pending' && data.materials.length === 0 && data.warnings.length === 0 && !data.error) return
    const item: ClinicMasterHistoryItem = {
      id: data.query_id,
      createdAt: new Date().toISOString(),
      response: data,
    }
    setHistory(prev => {
      const next = [item, ...prev.filter(entry => entry.id !== item.id)].slice(0, 20)
      writeHistory(historyStorageKey, next)
      return next
    })
  }

  const createQuery = async () => {
    const normalized = question.trim()
    if (!normalized) {
      setError('请输入临床决策问题')
      return
    }
    setLoading(true)
    setError('')
    setAdditionNotice('')
    try {
      const data = await createClinicMasterQuery(normalized)
      logClinicMasterResult('create response', data)
      setQuery(data)
      setSelectedIds([])
      setAllCollapsed(false)
      setGuidesExpanded(true)
    } catch (e: any) {
      console.error('[ClinicMaster create exception]', e)
      setError(e.message || '临床决策查询失败')
    } finally {
      setLoading(false)
    }
  }

  const refreshQuery = async (queryId = query?.query_id) => {
    if (!queryId) return
    setLoading(true)
    setError('')
    setAdditionNotice('')
    try {
      const data = await refreshClinicMasterQuery(queryId)
      logClinicMasterResult('refresh response', data)
      setQuery(data)
      setSelectedIds(data.materials.filter(item => (
        item.selectedByDefault && (
          onConfirmReferenceChunks
            ? shouldUseClinicMasterMaterialAsChunk(item.type)
            : onAddReferenceDocs
              ? shouldUseClinicMasterMaterialAsReference(item.type)
              : shouldShowClinicMasterMaterialCard(item.type)
        )
      )).map(item => item.id))
      saveHistoryItem(data)
      setAllCollapsed(false)
      setGuidesExpanded(true)
      if (data.status === 'empty' && data.materials.length === 0) {
        setError('临床决策暂未返回可用资料，可稍后再获取')
      } else if (data.status === 'failed') {
        setError(data.error || '临床决策结果获取失败')
      }
    } catch (e: any) {
      console.error('[ClinicMaster refresh exception]', e)
      setError(e.message || '临床决策结果获取失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (query?.status !== 'pending' || loading) return
    const timer = window.setTimeout(() => {
      void refreshQuery(query.query_id)
    }, getClinicMasterAutoRefreshDelay(query.ready_at))
    return () => window.clearTimeout(timer)
  }, [query?.query_id, query?.ready_at, query?.status, loading])

  const toggleMaterial = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const openHistoryItem = (item: ClinicMasterHistoryItem) => {
    setQuery(item.response)
    setQuestion(item.response.question)
    setSelectedIds(item.response.materials.filter(material => (
      material.selectedByDefault && (
    onConfirmReferenceChunks
          ? shouldUseClinicMasterMaterialAsChunk(material.type)
          : onAddReferenceDocs
            ? shouldUseClinicMasterMaterialAsReference(material.type)
            : shouldShowClinicMasterMaterialCard(material.type)
      )
    )).map(material => material.id))
    setError('')
    setAdditionNotice('')
    setAllCollapsed(false)
    setGuidesExpanded(true)
  }

  const addReferenceDocs = () => {
    if (!onAddReferenceDocs) return
    const addition = buildClinicMasterReferenceAddition(query?.materials ?? [], selectedIdSet)
    const result = onAddReferenceDocs(addition.docs) ?? {
      added: addition.added,
      duplicates: addition.duplicates,
    }
    setAdditionNotice(formatClinicMasterReferenceAddition({
      added: result.added,
      duplicates: result.duplicates,
      unusable: addition.unusable,
    }))
  }

  const toggleAllCollapsed = () => {
    setAllCollapsed(prev => {
      const next = !prev
      if (next) setGuidesExpanded(false)
      return next
    })
  }

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => {
      const next = prev.filter(item => item.id !== id)
      writeHistory(historyStorageKey, next)
      return next
    })
    if (query?.query_id === id) {
      setQuery(null)
      setSelectedIds([])
      setAdditionNotice('')
    }
  }

  return (
    <div className="clinic-master-panel">
      <div className={`clinic-master-layout${history.length > 0 ? ' has-history' : ''}${historyCollapsed ? ' history-collapsed' : ''}`}>
        <div className="clinic-master-main">
          <div className="clinic-master-search">
            <span className="material-symbols-outlined">search</span>
            <input
              value={question}
              placeholder={placeholder}
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') createQuery()
              }}
            />
            <button type="button" disabled={loading} onClick={createQuery}>
              {loading && !query ? '查询中' : '查询临床决策'}
            </button>
          </div>

          {query?.status === 'pending' && (
            <div className="clinic-master-pending">
              <span className="material-symbols-outlined">hourglass_top</span>
              <span>{readyCountdown}</span>
            </div>
          )}

          {error && (
            <div className="clinic-master-error">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          {(query?.warnings ?? []).length > 0 && (
            <div className="clinic-master-warning">
              <span className="material-symbols-outlined">info</span>
              <span className="clinic-master-warning-content">
                <span>{query?.warnings.join('；')}</span>
                {debugText && (
                  <details className="clinic-master-debug">
                    <summary>查看调试详情</summary>
                    <pre>{debugText}</pre>
                  </details>
                )}
              </span>
            </div>
          )}

          {shouldShowClinicMasterResultPanel(allCollapsed, visibleMaterials.length, recommendedGuides.length) && (
            <div className="clinic-master-results">
              <div className="clinic-master-results-head">
                <span>{formatClinicMasterResultSummary(groupedMaterials.answer.length, recommendedGuides.length)}</span>
                <button type="button" className="clinic-master-collapse-all" onClick={toggleAllCollapsed}>
                  <span className="material-symbols-outlined">{allCollapsed ? 'unfold_more' : 'unfold_less'}</span>
                  {clinicMasterCollapseAllLabel(allCollapsed)}
                </button>
              </div>
              {recommendedGuides.length > 0 && (
                <section className="clinic-master-guide-list-section" aria-label="推荐指南列表">
                  <div className="clinic-master-guide-list-head">
                    <div>
                      <span className="clinic-master-guide-list-kicker">推荐指南列表</span>
                      <strong>{recommendedGuides.length} 条指南</strong>
                    </div>
                    <button
                      type="button"
                      className="clinic-master-guide-toggle"
                      onClick={() => {
                        setAllCollapsed(false)
                        setGuidesExpanded(prev => !prev)
                      }}
                    >
                      <span className="material-symbols-outlined">{guidesExpanded ? 'expand_less' : 'expand_more'}</span>
                      {guidesExpanded ? '收起列表' : '展开列表'}
                    </button>
                  </div>
                  {shouldShowClinicMasterGuidesWhenCollapsed(guidesExpanded && !allCollapsed, recommendedGuides.length) && (
                    <div className="clinic-master-guide-list">
                      {recommendedGuides.map(guide => (
                        <article key={guide.id} className="clinic-master-guide-item">
                          <div className="clinic-master-guide-number">{guide.number}、</div>
                          <div className="clinic-master-guide-main">
                            <div className="clinic-master-guide-title-row">
                              {guide.linkUrl ? (
                                <a
                                  className="clinic-master-guide-title"
                                  href={guide.linkUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {guide.title}
                                </a>
                              ) : (
                                <div className="clinic-master-guide-title">{guide.title}</div>
                              )}
                              {guide.makerName && <span className="clinic-master-guide-maker">{guide.makerName}</span>}
                            </div>
                            <div className="clinic-master-guide-meta">
                              {formatClinicMasterGuideMeta(guide).map(item => <span key={item}>{item}</span>)}
                            </div>
                            {shouldShowClinicMasterGuideData() && guide.text && (
                              <details className="clinic-master-guide-data">
                                <summary>查看数据</summary>
                                <pre className="clinic-master-guide-text">{guide.text}</pre>
                              </details>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
              <div className="clinic-master-materials">
                {onAddReferenceDocs && (
                  <div className="clinic-master-add-references">
                    <span>已选可加入 {referenceAddition.docs.length} 条</span>
                    <button
                      type="button"
                      disabled={referenceAddition.docs.length === 0}
                      onClick={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        addReferenceDocs()
                      }}
                    >
                      <span className="material-symbols-outlined">playlist_add</span>
                      {addButtonLabel}
                    </button>
                    {additionNotice && <span className="clinic-master-add-notice">{additionNotice}</span>}
                  </div>
                )}
                {visibleMaterials.map(material => {
                  const checked = selectedIdSet.has(material.id)
                  const metadataText = formatClinicMasterMetadata(material.metadata)
                  return (
                    <label key={material.id} className={`clinic-master-material ${checked ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMaterial(material.id)}
                      />
                        <span className="clinic-master-material-main">
                          <span className="clinic-master-material-title">
                            <b className={`clinic-master-material-badge ${materialTypeTone(material.type)}`}>
                              <span className="material-symbols-outlined">{materialTypeIcon(material.type)}</span>
                              {materialTypeLabel(material.type)}
                            </b>
                            {material.title}
                          </span>
                          <span className="clinic-master-material-meta">
                            {material.sourceLabel} · {material.text.length.toLocaleString()} 字符
                          </span>
                          {shouldShowClinicMasterMaterialInline(material.type) ? (
                            <ClinicMasterAnswerReferenceView answer={material} detailMaterials={groupedMaterials.details} collapsed={allCollapsed} />
                          ) : (
                            <details className="clinic-master-material-preview" onClick={event => event.stopPropagation()}>
                              <summary>查看内容</summary>
                              <pre>{material.text}</pre>
                            </details>
                          )}
                          {metadataText && shouldShowClinicMasterMetadata(material.type) && (
                            <details className="clinic-master-material-preview" onClick={event => event.stopPropagation()}>
                              <summary>查看接口原始数据</summary>
                              <pre>{metadataText}</pre>
                            </details>
                          )}
                        </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <aside className={`clinic-master-history${historyCollapsed ? ' collapsed' : ''}`} aria-label="历史结果">
            <div className="clinic-master-history-head">
              <span className="clinic-master-history-heading">历史结果</span>
              <span className="clinic-master-history-count">{history.length} 条</span>
              <button
                type="button"
                className="clinic-master-history-toggle"
                aria-expanded={!historyCollapsed}
                onClick={() => setHistoryCollapsed(prev => !prev)}
                title={clinicMasterHistoryToggleLabel(historyCollapsed)}
              >
                <span className="material-symbols-outlined">{historyCollapsed ? 'chevron_left' : 'chevron_right'}</span>
                <span>{clinicMasterHistoryToggleLabel(historyCollapsed)}</span>
              </button>
            </div>
            {shouldShowClinicMasterHistoryList(history.length, historyCollapsed) && (
              <div className="clinic-master-history-list">
                {history.map(item => (
                    <div key={item.id} className={`clinic-master-history-item ${query?.query_id === item.id ? 'active' : ''}`}>
                      <button type="button" onClick={() => openHistoryItem(item)}>
                        <span className="clinic-master-history-title">{item.response.question}</span>
                        <span className="clinic-master-history-meta">
                          {formatClinicMasterHistorySummary(item.createdAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="clinic-master-history-delete"
                        onClick={() => deleteHistoryItem(item.id)}
                        title="删除历史结果"
                        aria-label="删除历史结果"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
