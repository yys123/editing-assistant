import { useEffect, useMemo, useState } from 'react'
import {
  type ClinicalDecisionChunk,
  clinicalDecisionChunkToReferenceDoc,
  referenceDocContainsClinicalDecisionChunk,
  searchClinicalDecisionChunks,
} from '../api'
import type { ReferenceDoc } from '../types'

export interface ClinicalDecisionChunkAdditionResult {
  docs: ReferenceDoc[]
  added: number
  duplicates: number
  unusable: number
}

function normalizedChunkId(chunk: ClinicalDecisionChunk) {
  return String(chunk.chunk_id ?? '').trim()
}

function normalizedContentText(chunk: ClinicalDecisionChunk) {
  return String(chunk.content_text ?? '').trim()
}

function isSelectableClinicalDecisionChunk(chunk: ClinicalDecisionChunk) {
  return Boolean(chunk.usable && normalizedChunkId(chunk) && normalizedContentText(chunk))
}

export function selectableClinicalDecisionChunkIds(chunks: ClinicalDecisionChunk[]) {
  return chunks
    .filter(isSelectableClinicalDecisionChunk)
    .map(chunk => normalizedChunkId(chunk))
}

export function buildClinicalDecisionChunkAddition(
  currentDocs: ReferenceDoc[],
  chunks: ClinicalDecisionChunk[],
): ClinicalDecisionChunkAdditionResult {
  const docs: ReferenceDoc[] = []
  let duplicates = 0
  let unusable = 0

  for (const chunk of chunks) {
    const chunkId = normalizedChunkId(chunk)
    const contentText = normalizedContentText(chunk)
    if (!chunk.usable || !chunkId || !contentText) {
      unusable += 1
      continue
    }

    const alreadyExists = [...currentDocs, ...docs].some(doc =>
      referenceDocContainsClinicalDecisionChunk(doc, chunkId),
    )
    if (alreadyExists) {
      duplicates += 1
      continue
    }

    docs.push(clinicalDecisionChunkToReferenceDoc(chunk))
  }

  return { docs, added: docs.length, duplicates, unusable }
}

export function formatClinicalDecisionChunkAddition(result: ClinicalDecisionChunkAdditionResult) {
  const parts = [`已加入 ${result.added} 条`]
  if (result.duplicates) parts.push(`跳过重复 ${result.duplicates} 条`)
  if (result.unusable) parts.push(`无可用正文 ${result.unusable} 条`)
  return parts.join('；')
}

export interface ClinicalDecisionChunkPanelProps {
  initialGuideId?: string
  referenceDocs: ReferenceDoc[]
  onAddReferenceDocs: (docs: ReferenceDoc[]) => void
}

const PREVIEW_LENGTH = 160

function chunkDisplayTitle(chunk: ClinicalDecisionChunk) {
  return String(chunk.title ?? '').trim() || '未命名切片'
}

function unusableReason(chunk: ClinicalDecisionChunk) {
  if (!normalizedChunkId(chunk)) return '缺少 chunkId，不能加入'
  if (!chunk.usable || !normalizedContentText(chunk)) return '暂无正文，不能加入'
  return ''
}

export default function ClinicalDecisionChunkPanel({
  initialGuideId,
  referenceDocs,
  onAddReferenceDocs,
}: ClinicalDecisionChunkPanelProps) {
  const [guideId, setGuideId] = useState(initialGuideId || '')
  const [doi, setDoi] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<ClinicalDecisionChunk[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setGuideId(initialGuideId || '')
  }, [initialGuideId])

  const selectableIds = useMemo(() => selectableClinicalDecisionChunkIds(items), [items])
  const allSelectableSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id))

  const runSearch = async () => {
    setLoading(true)
    setError('')
    setNotice('')
    setItems([])
    setSelectedIds(new Set())
    setExpandedIds(new Set())

    try {
      const result = await searchClinicalDecisionChunks({ guideId, doi })
      const nextItems = result.items || []
      setItems(nextItems)
      if (nextItems.length === 0) setNotice('未查询到相关切片')
    } catch (e: any) {
      setError(e?.message || '临床决策切片查询失败')
    } finally {
      setLoading(false)
    }
  }

  const handleQueryKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !loading) {
      event.preventDefault()
      runSearch()
    }
  }

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(selectableIds))
  }

  const toggleSelectedId = (chunkId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(chunkId)) next.delete(chunkId)
      else next.add(chunkId)
      return next
    })
  }

  const toggleExpandedId = (chunkId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(chunkId)) next.delete(chunkId)
      else next.add(chunkId)
      return next
    })
  }

  const addChunks = (chunks: ClinicalDecisionChunk[]) => {
    const result = buildClinicalDecisionChunkAddition(referenceDocs, chunks)
    if (result.docs.length > 0) onAddReferenceDocs(result.docs)
    setNotice(formatClinicalDecisionChunkAddition(result))
  }

  const addSelectedChunks = () => {
    addChunks(items.filter(chunk => selectedIds.has(normalizedChunkId(chunk))))
  }

  return (
    <section className="clinical-decision-chunk-panel" style={{ display: 'grid', gap: 14 }}>
      <div className="clinical-decision-chunk-header" style={{ display: 'grid', gap: 6 }}>
        <div className="clinical-decision-chunk-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>clinical_notes</span>
          临床决策切片
        </div>
        <div className="clinical-decision-chunk-subtitle" style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)' }}>
          按指南 ID 或 DOI 查询可加入参考数据源的临床决策正文。
        </div>
      </div>

      <div className="clinical-decision-chunk-query" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
        <label className="clinical-decision-chunk-field" style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
          指南 ID
          <input
            className="clinical-decision-chunk-input"
            value={guideId}
            onChange={event => setGuideId(event.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder="例如 guide-2026"
            style={{ minWidth: 0, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--m3-outline-variant)' }}
          />
        </label>
        <label className="clinical-decision-chunk-field" style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
          DOI
          <input
            className="clinical-decision-chunk-input"
            value={doi}
            onChange={event => setDoi(event.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder="例如 10.1234/example"
            style={{ minWidth: 0, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--m3-outline-variant)' }}
          />
        </label>
        <button
          className="clinical-decision-chunk-query-button"
          type="button"
          onClick={runSearch}
          disabled={loading}
          style={{ padding: '9px 14px', borderRadius: 8, border: 0, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17, verticalAlign: -3, marginRight: 5 }}>
            {loading ? 'hourglass_top' : 'search'}
          </span>
          {loading ? '查询中' : '查询'}
        </button>
      </div>

      {error && (
        <div className="clinical-decision-chunk-error" style={{ color: 'var(--m3-error)', fontSize: 13 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 5 }}>error</span>
          {error}
        </div>
      )}

      {notice && (
        <div className="clinical-decision-chunk-notice" style={{ color: 'var(--m3-on-surface-variant)', fontSize: 13 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 5 }}>info</span>
          {notice}
        </div>
      )}

      {items.length > 0 && (
        <div className="clinical-decision-chunk-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="clinical-decision-chunk-select-all-button"
            type="button"
            onClick={toggleSelectAll}
            disabled={selectableIds.length === 0}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, verticalAlign: -3, marginRight: 5 }}>
              {allSelectableSelected ? 'check_box' : 'select_all'}
            </span>
            {allSelectableSelected ? '清空选择' : '全选可加入'}
          </button>
          <button
            className="clinical-decision-chunk-add-selected-button"
            type="button"
            onClick={addSelectedChunks}
            disabled={selectedIds.size === 0}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, verticalAlign: -3, marginRight: 5 }}>playlist_add</span>
            加入已选
          </button>
          <button
            className="clinical-decision-chunk-add-all-button"
            type="button"
            onClick={() => addChunks(items)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, verticalAlign: -3, marginRight: 5 }}>library_add</span>
            全部加入参考数据源
          </button>
        </div>
      )}

      <div className="clinical-decision-chunk-results" style={{ display: 'grid', gap: 10 }}>
        {items.map((chunk, index) => {
          const chunkId = normalizedChunkId(chunk)
          const contentText = normalizedContentText(chunk)
          const selectable = isSelectableClinicalDecisionChunk(chunk)
          const expanded = chunkId ? expandedIds.has(chunkId) : false
          const previewText = expanded ? contentText : contentText.slice(0, PREVIEW_LENGTH)
          const rowKey = chunk.id || chunkId || `clinical-decision-chunk-${index}`
          const reason = unusableReason(chunk)

          return (
            <article
              className="clinical-decision-chunk-row"
              key={rowKey}
              style={{ border: '1px solid var(--m3-outline-variant)', borderRadius: 10, padding: 12, display: 'grid', gap: 9 }}
            >
              <div className="clinical-decision-chunk-row-header" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input
                  className="clinical-decision-chunk-checkbox"
                  type="checkbox"
                  checked={chunkId ? selectedIds.has(chunkId) : false}
                  disabled={!selectable}
                  onChange={() => chunkId && toggleSelectedId(chunkId)}
                  aria-label={`选择 ${chunkDisplayTitle(chunk)}`}
                  style={{ marginTop: 3 }}
                />
                <div className="clinical-decision-chunk-row-title-wrap" style={{ flex: 1, minWidth: 0 }}>
                  <div className="clinical-decision-chunk-row-title" style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                    {chunkDisplayTitle(chunk)}
                  </div>
                  <div className="clinical-decision-chunk-row-meta" style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 3 }}>
                    {chunk.main_title || '未命名临床决策资料'} · {chunkId || '缺少 chunkId'}
                  </div>
                </div>
                {contentText && chunkId && (
                  <button
                    className="clinical-decision-chunk-expand-button"
                    type="button"
                    onClick={() => toggleExpandedId(chunkId)}
                    aria-expanded={expanded}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: -4 }}>
                      {expanded ? 'expand_less' : 'expand_more'}
                    </span>
                    {expanded ? '收起' : '展开'}
                  </button>
                )}
              </div>

              {reason ? (
                <div className="clinical-decision-chunk-unusable" style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 5 }}>block</span>
                  {reason}
                </div>
              ) : (
                <div className="clinical-decision-chunk-preview" style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
                  {previewText}
                  {!expanded && contentText.length > PREVIEW_LENGTH ? '…' : ''}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
