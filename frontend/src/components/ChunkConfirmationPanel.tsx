import { useEffect, useMemo, useState } from 'react'
import { searchReferenceChunks } from '../api'
import type { ConfirmedReferenceChunk, ReferenceChunkCandidate, ReferenceDoc } from '../types'

interface Props {
  taskType: 'quality_review' | 'ai_integration'
  disease: string
  query: string
  referenceDocs: ReferenceDoc[]
  selectedReferenceNames: string[]
  priorityReferenceNames?: string[]
  value: ConfirmedReferenceChunk[]
  onChange: (chunks: ConfirmedReferenceChunk[]) => void
  compact?: boolean
  autoSearchOnMount?: boolean
  triggerLabel?: string
  fullscreenTitle?: string
  confirmLabel?: string
  exitLabel?: string
  onConfirm?: () => void
  onExit?: () => void
  onSearchStart?: () => void
}

interface ChunkSourceGroup {
  sourceId: number
  sourceFilename: string
  chunks: ReferenceChunkCandidate[]
}

export function recommendedChunkSearchLimit(taskType: Props['taskType'], compact = false): number {
  if (taskType === 'quality_review') return compact ? 40 : 60
  return compact ? 12 : 24
}

export function recommendedChunkAutoConfirmLimit(taskType: Props['taskType'], compact = false): number {
  if (taskType === 'quality_review') return compact ? 40 : 60
  return compact ? 5 : 8
}

function toConfirmed(chunk: ReferenceChunkCandidate): ConfirmedReferenceChunk {
  return {
    chunk_id: chunk.chunk_id,
    source_id: chunk.source_id,
    source_filename: chunk.source_filename,
    title_path: chunk.title_path,
    text: chunk.text,
    source_ref_ids: chunk.source_ref_ids ?? [],
    selected_by: 'user',
  }
}

function chunkKey(chunk: ReferenceChunkCandidate): string {
  return `${chunk.source_id}:${chunk.chunk_id}:${chunk.paragraph_index}`
}

function mergeChunkCandidates(
  allChunks: ReferenceChunkCandidate[],
  recommendedChunks: ReferenceChunkCandidate[],
): ReferenceChunkCandidate[] {
  const recommendedById = new Map(recommendedChunks.map(chunk => [chunk.chunk_id, chunk]))
  const merged = allChunks.map(chunk => {
    const recommended = recommendedById.get(chunk.chunk_id)
    return recommended
      ? { ...chunk, score: recommended.score, reason: recommended.reason || '推荐：符合当前模块规则' }
      : { ...chunk, score: 0, reason: '未推荐：未命中当前模块推荐规则' }
  })
  const seen = new Set(merged.map(chunk => chunk.chunk_id))
  for (const chunk of recommendedChunks) {
    if (!seen.has(chunk.chunk_id)) {
      merged.unshift({ ...chunk, reason: chunk.reason || '推荐：符合当前模块规则' })
    }
  }
  return merged
}

export function chunkDisplayTitle(chunk: ReferenceChunkCandidate): string {
  const titlePath = (chunk.title_path || '').trim()
  if (titlePath) {
    const parts = titlePath.split('/').map(part => part.trim()).filter(Boolean)
    return parts[parts.length - 1] || titlePath
  }
  return '未识别小标题'
}

export function groupChunksBySource(chunks: ReferenceChunkCandidate[]): ChunkSourceGroup[] {
  const groupBySource = new Map<number, ChunkSourceGroup>()
  for (const chunk of chunks) {
    const existing = groupBySource.get(chunk.source_id)
    if (existing) {
      existing.chunks.push(chunk)
      continue
    }
    groupBySource.set(chunk.source_id, {
      sourceId: chunk.source_id,
      sourceFilename: chunk.source_filename,
      chunks: [chunk],
    })
  }
  return Array.from(groupBySource.values())
}

export default function ChunkConfirmationPanel({
  taskType,
  disease,
  query,
  referenceDocs,
  selectedReferenceNames,
  priorityReferenceNames = [],
  value,
  onChange,
  compact = false,
  autoSearchOnMount = false,
  triggerLabel = '筛选切片',
  fullscreenTitle = '筛选指南切片',
  confirmLabel = '退出全屏',
  exitLabel = '退出',
  onConfirm,
  onExit,
  onSearchStart,
}: Props) {
  const [candidates, setCandidates] = useState<ReferenceChunkCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeChunkKey, setActiveChunkKey] = useState('')
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set())
  const [fullscreen, setFullscreen] = useState(false)

  const selectedNameSet = useMemo(() => new Set(selectedReferenceNames), [selectedReferenceNames])
  const priorityNameSet = useMemo(() => new Set(priorityReferenceNames), [priorityReferenceNames])
  const selectedChunkIds = useMemo(() => new Set(value.map(chunk => chunk.chunk_id)), [value])
  const selectedDocs = useMemo(
    () => referenceDocs
      .map((doc, index) => ({ doc, id: index + 1 }))
      .filter(item => selectedNameSet.has(item.doc.filename)),
    [referenceDocs, selectedNameSet],
  )
  const activeChunk = useMemo(
    () => candidates.find(chunk => chunkKey(chunk) === activeChunkKey) ?? candidates[0],
    [activeChunkKey, candidates],
  )

  const runSearch = async () => {
    if (selectedDocs.length === 0) {
      setError('请先选择参考文献')
      return
    }
    onSearchStart?.()
    setLoading(true)
    setError('')
    try {
      const baseRequest = {
        task_type: taskType,
        disease,
        query,
        reference_inputs: selectedDocs.map(item => ({
          id: item.id,
          filename: item.doc.filename,
          text: item.doc.text,
        })),
        priority_reference_ids: selectedDocs
          .filter(item => priorityNameSet.has(item.doc.filename))
          .map(item => item.id),
      }
      const [recommendedData, allData] = await Promise.all([
        searchReferenceChunks({
          ...baseRequest,
          limit: recommendedChunkSearchLimit(taskType, compact),
        }),
        searchReferenceChunks({
          ...baseRequest,
          query: '',
          return_all: true,
        }),
      ])
      const recommendedIdSet = new Set(recommendedData.chunks.map(chunk => chunk.chunk_id))
      const mergedChunks = mergeChunkCandidates(allData.chunks, recommendedData.chunks)
      setRecommendedIds(recommendedIdSet)
      setCandidates(mergedChunks)
      setActiveChunkKey(mergedChunks[0] ? chunkKey(mergedChunks[0]) : '')
      setFullscreen(true)
      onChange(recommendedData.chunks.slice(0, recommendedChunkAutoConfirmLimit(taskType, compact)).map(toConfirmed))
    } catch (e: any) {
      setError(e.message || '指南切片检索失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!autoSearchOnMount) return
    runSearch()
    // Run once when the panel is opened for explicit search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleChunk = (chunk: ReferenceChunkCandidate) => {
    if (selectedChunkIds.has(chunk.chunk_id)) {
      onChange(value.filter(item => item.chunk_id !== chunk.chunk_id))
    } else {
      onChange([...value, toConfirmed(chunk)])
    }
  }

  const renderChunkList = () => (
    candidates.length > 0 ? (
      <div className="chunk-confirm-list">
        {groupChunksBySource(candidates).map(group => {
          const groupSelectedCount = group.chunks.filter(chunk => selectedChunkIds.has(chunk.chunk_id)).length
          const groupRecommendedCount = group.chunks.filter(chunk => recommendedIds.has(chunk.chunk_id)).length
          return (
            <div key={group.sourceId} className="chunk-confirm-source-group">
              <div className="chunk-confirm-source-title">
                <div className="chunk-confirm-source-main">
                  <span className="chunk-confirm-source-index">参考数据源 {group.sourceId}</span>
                  <span className="chunk-confirm-source-file">{group.sourceFilename}</span>
                </div>
                <div className="chunk-confirm-source-stats">
                  <span>{groupSelectedCount} 已选</span>
                  <span>{groupRecommendedCount} 推荐</span>
                  <span>{group.chunks.length} 全部</span>
                </div>
              </div>
              <div className="chunk-confirm-source-chunks">
                {group.chunks.map(chunk => {
                  const checked = selectedChunkIds.has(chunk.chunk_id)
                  const recommended = recommendedIds.has(chunk.chunk_id)
                  const currentChunkKey = chunkKey(chunk)
                  const active = currentChunkKey === (activeChunk ? chunkKey(activeChunk) : activeChunkKey)
                  return (
                    <div key={`${group.sourceId}:${chunk.chunk_id}:${chunk.paragraph_index}`} className={`chunk-confirm-item ${checked ? 'selected' : ''} ${active ? 'active' : ''}`}>
                    <div className="chunk-confirm-row">
                      <input type="checkbox" checked={checked} onChange={() => toggleChunk(chunk)} />
                      <div className="chunk-confirm-body">
                        <button
                          type="button"
                          className="chunk-confirm-toggle"
                          onClick={() => setActiveChunkKey(currentChunkKey)}
                          aria-pressed={active}
                        >
                          <span className="chunk-confirm-title-line">
                            <span className="chunk-confirm-code">{chunk.chunk_id}</span>
                            <span className="chunk-confirm-name">{chunkDisplayTitle(chunk)}</span>
                            <span className={`chunk-confirm-badge ${recommended ? 'recommended' : ''}`}>
                              {recommended ? '推荐' : '未推荐'}
                            </span>
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
                })}
              </div>
            </div>
          )
        })}
      </div>
    ) : null
  )

  const renderChunkPreview = () => (
    activeChunk ? (
      <div className="chunk-confirm-preview">
        <div className="chunk-confirm-preview-head">
          <div className="chunk-confirm-preview-title">
            <span className="chunk-confirm-code">{activeChunk.chunk_id}</span>
            <span>{chunkDisplayTitle(activeChunk)}</span>
          </div>
          <div className="chunk-confirm-preview-meta">
            参考数据源 {activeChunk.source_id} · {activeChunk.source_filename}
          </div>
        </div>
        <div className="chunk-confirm-preview-text">{activeChunk.text}</div>
        <div className="chunk-confirm-preview-reason">
          {activeChunk.reason || `相关性 ${activeChunk.score.toFixed(1)}`}
        </div>
      </div>
    ) : (
      <div className="chunk-confirm-preview-empty">从左侧目录选择一个切片查看详情</div>
    )
  )

  const renderPanel = () => (
    <div className={`chunk-confirm-panel ${compact ? 'compact' : ''}`}>
      <div className="chunk-confirm-head">
        <div>
          <div className="chunk-confirm-title">指南切片</div>
          <div className="chunk-confirm-meta">
            已确认 {value.length} 个切片{candidates.length > 0 ? ` / 共 ${candidates.length} 个切片` : ''}
          </div>
        </div>
        <div className="chunk-confirm-actions">
          <button type="button" className="btn btn-sm" onClick={() => onChange([])}>清空</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={loading || selectedDocs.length === 0} onClick={runSearch}>
            {loading ? '筛选中' : triggerLabel}
          </button>
        </div>
      </div>

      {error && <div className="chunk-confirm-error">{error}</div>}
    </div>
  )

  return (
    <>
      {renderPanel()}
      {fullscreen && candidates.length > 0 && (
        <div className="chunk-confirm-fullscreen-overlay">
          <div className="chunk-confirm-panel fullscreen">
            <div className="chunk-confirm-head">
              <div>
                <div className="chunk-confirm-title">{fullscreenTitle}</div>
                <div className="chunk-confirm-meta">
                  已确认 {value.length} 个切片 / 共 {candidates.length} 个切片
                </div>
              </div>
              <div className="chunk-confirm-actions">
                <button type="button" className="btn btn-sm" onClick={() => onChange([])}>清空</button>
                {onExit && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setFullscreen(false)
                      onExit?.()
                    }}
                  >
                    {exitLabel}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setFullscreen(false)
                    onConfirm?.()
                  }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
            <div className="chunk-confirm-layout">
              <div className="chunk-confirm-directory">
                {renderChunkList()}
              </div>
              {renderChunkPreview()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
