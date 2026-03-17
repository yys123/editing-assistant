import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { QAItem, GapItem, GeneratedDraft, DraftRecord, ReferenceDoc } from '../types'

interface Props {
  disease: string
  articleContent: string
  qaItems: QAItem[]
  referenceDocs?: ReferenceDoc[]
  selectedGap: GapItem | null
  draftHistory: DraftRecord[]
  onAddDraft: (record: DraftRecord) => void
  onUpdateDraft: (id: string, editedContent: string) => void
  onBack: () => void
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function StepGenerate({
  disease, articleContent, qaItems, referenceDocs = [],
  selectedGap, draftHistory, onAddDraft, onUpdateDraft, onBack
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Index into draftHistory of the currently viewed record
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'diff' | 'edit' | 'preview'>('diff')

  const activeRecord = draftHistory.find(r => r.id === activeId) ?? draftHistory[draftHistory.length - 1] ?? null

  const generate = async (gap: GapItem) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease,
          section: gap.section,
          gap_description: gap.description,
          original_content: articleContent.slice(0, 500),
          qa_references: qaItems.slice(0, 50),
          article_context: articleContent.slice(0, 3000),
          reference_texts: referenceDocs.map(d => d.text),
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '生成失败')
      const draft = data as GeneratedDraft
      const record: DraftRecord = {
        id: `${gap.section}-${Date.now()}`,
        gap,
        draft,
        editedContent: draft.generated_content,
        generatedAt: new Date().toISOString()
      }
      onAddDraft(record)
      setActiveId(record.id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedGap) {
      // No new gap selected, just show most recent history
      if (draftHistory.length > 0) setActiveId(draftHistory[draftHistory.length - 1].id)
      return
    }
    // Check if this gap already has a draft
    const existing = draftHistory.find(
      r => r.gap.section === selectedGap.section && r.gap.priority === selectedGap.priority
    )
    if (existing) {
      setActiveId(existing.id)
    } else {
      generate(selectedGap)
    }
  }, [])

  const handleRegenerate = () => {
    const gap = activeRecord?.gap ?? selectedGap
    if (gap) generate(gap)
  }

  const handleEditChange = (val: string) => {
    if (activeRecord) onUpdateDraft(activeRecord.id, val)
  }

  const exportMarkdown = () => {
    if (!activeRecord) return
    const content = `# ${disease} — ${activeRecord.gap.section}\n\n${activeRecord.editedContent}`
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${disease}_${activeRecord.gap.section}_draft.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = () => {
    if (activeRecord) navigator.clipboard.writeText(activeRecord.editedContent)
  }

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <div>正在生成「{(activeRecord?.gap ?? selectedGap)?.section}」内容...</div>
      <div className="text-sm text-muted">AI 正在结合 Q&A 数据和词条上下文撰写，通常需要 30-60 秒</div>
    </div>
  )

  if (error) return (
    <div className="card">
      <div className="alert alert-error">{error}</div>
      <div className="flex gap-2">
        <button className="btn btn-outline" onClick={onBack}>← 返回</button>
        <button className="btn btn-primary" onClick={handleRegenerate}>重试</button>
      </div>
    </div>
  )

  if (!activeRecord) return null

  const { gap, draft } = activeRecord

  return (
    <div style={{ display: 'grid', gridTemplateColumns: draftHistory.length > 1 ? '220px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>

      {/* History sidebar — only visible when >1 record */}
      {draftHistory.length > 1 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 16 }}>
          <div style={{ padding: '12px 14px', fontWeight: 600, fontSize: 12, color: 'var(--gray-500)', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
            历史稿件 ({draftHistory.length})
          </div>
          {draftHistory.map(r => (
            <div
              key={r.id}
              onClick={() => setActiveId(r.id)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--gray-100)',
                background: r.id === activeId ? 'var(--blue-light)' : 'white',
                borderLeft: r.id === activeId ? '3px solid var(--blue)' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span className={`priority priority-${r.gap.priority.toLowerCase()}`}>{r.gap.priority}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: r.id === activeId ? 'var(--blue)' : 'var(--gray-900)' }}>
                  {r.gap.section}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{formatTime(r.generatedAt)}</div>
            </div>
          ))}
          <div style={{ padding: '10px 14px' }}>
            <button className="btn btn-outline btn-sm" style={{ width: '100%' }} onClick={onBack}>
              ← 返回分析
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div>
        {/* Header */}
        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.priority}</span>
              <span style={{ fontWeight: 600 }}>{disease} — {gap.section}</span>
              <span className="text-muted text-sm">{gap.description}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" onClick={handleRegenerate}>重新生成</button>
              <button className="btn btn-sm btn-outline" onClick={copyToClipboard}>复制</button>
              <button className="btn btn-sm btn-green" onClick={exportMarkdown}>导出 Markdown</button>
            </div>
          </div>
        </div>

        {/* Key changes */}
        {draft.key_changes.length > 0 && (
          <div className="card" style={{ padding: '14px 20px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>主要改动点</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {draft.key_changes.map((c, i) => (
                <span key={i} style={{ padding: '3px 10px', background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 4, fontSize: 12 }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View tabs */}
        <div className="card">
          <div className="tabs">
            <div className={`tab ${view === 'diff' ? 'active' : ''}`} onClick={() => setView('diff')}>对比视图</div>
            <div className={`tab ${view === 'edit' ? 'active' : ''}`} onClick={() => setView('edit')}>编辑稿件</div>
            <div className={`tab ${view === 'preview' ? 'active' : ''}`} onClick={() => setView('preview')}>预览效果</div>
          </div>

          {view === 'diff' && (
            <div className="diff-container">
              <div className="diff-panel">
                <div className="diff-panel-header original">原词条内容</div>
                <div className="diff-content text-muted" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {draft.original_content || '（该章节暂无内容）'}
                </div>
              </div>
              <div className="diff-panel">
                <div className="diff-panel-header generated">AI 生成稿件</div>
                <div className="diff-content md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeRecord.editedContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {view === 'edit' && (
            <div>
              <div className="text-sm text-muted mb-2">在下方直接编辑稿件内容（支持 Markdown）：</div>
              <textarea
                className="editor-textarea"
                value={activeRecord.editedContent}
                onChange={e => handleEditChange(e.target.value)}
              />
            </div>
          )}

          {view === 'preview' && (
            <div className="diff-content md" style={{ maxHeight: 'none', minHeight: 300 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeRecord.editedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* References */}
        {draft.references_used.length > 0 && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>引用来源</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {draft.references_used.map((r, i) => (
                <span key={i} className="tag">{r}</span>
              ))}
            </div>
          </div>
        )}

        {draftHistory.length <= 1 && (
          <div className="flex justify-between items-center mt-4">
            <button className="btn btn-outline" onClick={onBack}>← 返回分析</button>
            <div className="flex gap-2">
              <button className="btn btn-outline" onClick={copyToClipboard}>复制内容</button>
              <button className="btn btn-green" onClick={exportMarkdown}>导出 Markdown 稿件</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
