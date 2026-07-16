import { useEffect, useState } from 'react'
import type { ConfirmedReferenceChunk, ReferenceDoc } from '../types'
import ClinicMasterPanel from './ClinicMasterPanel'

export interface ReferenceDocAdditionResult {
  docs: ReferenceDoc[]
  added: number
  duplicates: number
}

export type ReferenceDocAdditionStats = Pick<ReferenceDocAdditionResult, 'added' | 'duplicates'>

interface Props {
  disease: string
  referenceDocs: ReferenceDoc[]
  setReferenceDocs?: (docs: ReferenceDoc[]) => void
  onAddReferenceDocs?: (docs: ReferenceDoc[]) => ReferenceDocAdditionStats | void
  onDeleteReferenceDoc?: (index: number) => void
  title?: string
  description?: string
  placeholder?: string
  addButtonLabel?: string
  historyStorageKey?: string
  listTitle?: string
  listEmptyText?: string
  showHeader?: boolean
  showReferenceList?: boolean
  showRecommendedGuides?: boolean
  confirmedChunkSourceIdBase?: number
  onConfirmReferenceChunks?: (chunks: ConfirmedReferenceChunk[]) => void
  collapsibleSearch?: boolean
  defaultSearchCollapsed?: boolean
  collapsedTitle?: string
  collapsedDescription?: string
}

export function buildReferenceDocAddition(current: ReferenceDoc[], additions: ReferenceDoc[]): ReferenceDocAdditionResult {
  const existing = new Set(current.map(doc => doc.filename))
  const accepted: ReferenceDoc[] = []
  let duplicates = 0
  for (const doc of additions) {
    if (existing.has(doc.filename)) {
      duplicates += 1
      continue
    }
    existing.add(doc.filename)
    accepted.push(doc)
  }
  return { docs: [...current, ...accepted], added: accepted.length, duplicates }
}

export default function StepGuideLookup({
  disease,
  referenceDocs,
  setReferenceDocs,
  onAddReferenceDocs,
  onDeleteReferenceDoc,
  title = 'AI查指南',
  description = '用 AI 检索临床指南与相关资料',
  placeholder = '输入想要检索什么指南（请完整表述）',
  addButtonLabel = '加入参考数据源',
  historyStorageKey = 'clinic-master-reference-source-history',
  listTitle = '当前参考数据源',
  listEmptyText = '暂无参考数据源',
  showHeader = true,
  showReferenceList = false,
  showRecommendedGuides = true,
  confirmedChunkSourceIdBase = 1,
  onConfirmReferenceChunks,
  collapsibleSearch = false,
  defaultSearchCollapsed = false,
  collapsedTitle,
  collapsedDescription,
}: Props) {
  const [viewingReference, setViewingReference] = useState<{ doc: ReferenceDoc; index: number } | null>(null)

  useEffect(() => {
    if (!viewingReference) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewingReference(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewingReference])

  const addReferenceDocs = (docs: ReferenceDoc[]) => {
    if (onAddReferenceDocs) {
      return onAddReferenceDocs(docs) ?? { added: docs.length, duplicates: 0 }
    }
    const result = buildReferenceDocAddition(referenceDocs, docs)
    setReferenceDocs?.(result.docs)
    return { added: result.added, duplicates: result.duplicates }
  }

  const deleteReferenceDoc = (index: number) => {
    if (onDeleteReferenceDoc) {
      onDeleteReferenceDoc(index)
      return
    }
    setReferenceDocs?.(referenceDocs.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div>
      {showHeader && <div style={{ marginBottom: 28 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          {description}
        </p>
      </div>}

      <div className="grid-12" style={{ gap: 20 }}>
        <div className={showReferenceList ? 'col-span-8' : 'col-span-12'}>
          <ClinicMasterPanel
            title={title}
            placeholder={placeholder}
            addButtonLabel={addButtonLabel}
            historyStorageKey={historyStorageKey}
            onAddReferenceDocs={addReferenceDocs}
            showRecommendedGuides={showRecommendedGuides}
            confirmedChunkSourceIdBase={confirmedChunkSourceIdBase}
            onConfirmReferenceChunks={onConfirmReferenceChunks}
            collapsibleSearch={collapsibleSearch}
            defaultSearchCollapsed={defaultSearchCollapsed}
            collapsedTitle={collapsedTitle}
            collapsedDescription={collapsedDescription}
          />
        </div>

        {showReferenceList && <div className="col-span-4">
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>menu_book</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)' }}>{listTitle}</div>
                <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>
                  已加入 {referenceDocs.length} 个资料
                </div>
              </div>
            </div>

            {referenceDocs.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--m3-on-surface-variant)', fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 30, display: 'block', marginBottom: 8, opacity: 0.45 }}>inbox</span>
                {listEmptyText}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {referenceDocs.map((doc, index) => (
                  <div key={`${doc.filename}-${index}`} className="reference-source-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>description</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="reference-source-name" title={doc.filename}>{doc.filename}</div>
                      <div className="reference-source-meta">{doc.char_count.toLocaleString()} 字符</div>
                    </div>
                    <button
                      type="button"
                      className="btn-m3-icon"
                      title="查看"
                      onClick={() => setViewingReference({ doc, index })}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                    </button>
                    <button
                      type="button"
                      className="btn-m3-icon"
                      title="删除"
                      onClick={() => deleteReferenceDoc(index)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--m3-error)' }}>delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>}
      </div>

      {viewingReference && (
        <div className="modal-overlay" onClick={() => setViewingReference(null)}>
          <div className="modal-card" style={{ width: 'min(900px, 92vw)', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 4 }}>
                  参考数据源 {viewingReference.index + 1}
                </div>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--m3-on-surface)' }}>
                  {viewingReference.doc.filename} · {viewingReference.doc.char_count.toLocaleString()} 字符
                </h3>
              </div>
              <button
                type="button"
                className="btn-m3-icon"
                onClick={() => setViewingReference(null)}
                aria-label="关闭"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ overflow: 'auto', border: '1px solid var(--dui-divider)', borderRadius: 8 }}>
              <pre style={{ margin: 0, padding: 14, borderRadius: 8, background: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{viewingReference.doc.text.trim() || '暂无可查看的解析文本'}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
