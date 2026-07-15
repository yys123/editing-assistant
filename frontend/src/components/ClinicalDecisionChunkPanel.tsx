import { useEffect, useMemo, useState } from 'react'
import {
  type ClinicalDecisionChunk,
  clinicalDecisionChunksToReferenceDoc,
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

export function buildClinicalDecisionChunkAddition(
  currentDocs: ReferenceDoc[],
  chunks: ClinicalDecisionChunk[],
): ClinicalDecisionChunkAdditionResult {
  const addableChunks: ClinicalDecisionChunk[] = []
  const seenChunkIds = new Set<string>()
  let duplicates = 0
  let unusable = 0

  for (const chunk of chunks) {
    const chunkId = normalizedChunkId(chunk)
    const contentText = normalizedContentText(chunk)
    if (!chunk.usable || !chunkId || !contentText) {
      unusable += 1
      continue
    }

    const alreadyExists = currentDocs.some(doc =>
      referenceDocContainsClinicalDecisionChunk(doc, chunkId),
    )
    if (alreadyExists || seenChunkIds.has(chunkId)) {
      duplicates += 1
      continue
    }

    addableChunks.push(chunk)
    seenChunkIds.add(chunkId)
  }

  const docs = addableChunks.length > 0 ? [clinicalDecisionChunksToReferenceDoc(addableChunks)] : []
  return { docs, added: addableChunks.length, duplicates, unusable }
}

export function formatClinicalDecisionChunkAddition(result: ClinicalDecisionChunkAdditionResult) {
  const parts = result.docs.length > 0
    ? [`已加入 ${result.docs.length} 个参考数据源，包含 ${result.added} 条切片`]
    : ['没有可加入的切片']
  if (result.duplicates) parts.push(`跳过重复 ${result.duplicates} 条`)
  if (result.unusable) parts.push(`无可用正文 ${result.unusable} 条`)
  return parts.join('；')
}

export interface ClinicalDecisionChunkPanelProps {
  initialGuideId?: string
  referenceDocs: ReferenceDoc[]
  onAddReferenceDocs: (docs: ReferenceDoc[]) => void
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
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setGuideId(initialGuideId || '')
  }, [initialGuideId])

  const additionPreview = useMemo(
    () => buildClinicalDecisionChunkAddition(referenceDocs, items),
    [referenceDocs, items],
  )

  const runSearch = async () => {
    const queryGuideId = guideId
    const queryDoi = doi
    setLoading(true)
    setError('')
    setNotice('')
    setItems([])
    setGuideId('')
    setDoi('')

    try {
      const result = await searchClinicalDecisionChunks({ guideId: queryGuideId, doi: queryDoi })
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

  const addChunks = () => {
    const result = buildClinicalDecisionChunkAddition(referenceDocs, items)
    if (result.docs.length > 0) onAddReferenceDocs(result.docs)
    setNotice(formatClinicalDecisionChunkAddition(result))
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

      <div className="clinical-decision-chunk-query" style={{ display: 'grid', gap: 10, alignItems: 'end' }}>
        <label className="clinical-decision-chunk-field" style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
          指南 ID
          <input
            className="clinical-decision-chunk-input"
            value={guideId}
            onChange={event => setGuideId(event.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder="如84915"
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
            className="clinical-decision-chunk-add-button"
            type="button"
            onClick={addChunks}
            disabled={additionPreview.added === 0}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, verticalAlign: -3, marginRight: 5 }}>library_add</span>
            加入参考数据源
          </button>
        </div>
      )}
    </section>
  )
}
