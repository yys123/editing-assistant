import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { QAItem, GapItem, GeneratedDraft, DraftRecord, ReferenceDoc, ParsedArticle, BatchGeneratedDraft } from '../types'
import { apiFetch } from '../api'

interface Props {
  disease: string
  articleContent: string
  parsedArticle?: ParsedArticle | null
  qaItems: QAItem[]
  referenceDocs?: ReferenceDoc[]
  selectedGap: GapItem | null
  selectedGaps?: GapItem[]         // 联合生成多选
  batchProgress?: { running: boolean; done: number; total: number; failed: number }
  draftHistory: DraftRecord[]
  onAddDraft: (record: DraftRecord) => void
  onUpdateDraft: (id: string, editedContent: string) => void
  onBack: () => void
}

/**
 * Extract the content of the section (and its children) matching the gap section path.
 */
export function extractSectionContent(parsedArticle: ParsedArticle | null | undefined, gapSection: string): string {
  if (!parsedArticle) return ''
  const parts = gapSection.split(' > ').map(s => s.trim())
  const sections = parsedArticle.sections
  const leafHeading = parts[parts.length - 1]

  let targetIdx = -1
  if (parts.length === 1) {
    targetIdx = sections.findIndex(s => s.heading === leafHeading)
  } else {
    const parentHeading = parts[parts.length - 2]
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].heading !== leafHeading) continue
      for (let j = i - 1; j >= 0; j--) {
        if (sections[j].level < sections[i].level) {
          if (sections[j].heading === parentHeading) targetIdx = i
          break
        }
      }
      if (targetIdx >= 0) break
    }
    if (targetIdx < 0) targetIdx = sections.findIndex(s => s.heading === leafHeading)
  }

  if (targetIdx < 0) return ''

  const target = sections[targetIdx]
  let combined = target.content

  for (let i = targetIdx + 1; i < sections.length; i++) {
    if (sections[i].level <= target.level) break
    const prefix = '#'.repeat(sections[i].level - target.level + 1)
    combined += `\n\n${prefix} ${sections[i].heading}`
    if (sections[i].content.trim()) combined += '\n' + sections[i].content
  }

  return combined
}

/**
 * Normalize the "参考文献" section at the end of generated content.
 */
function formatReferences(content: string): string {
  const refRe = /^(#{1,4}\s*参考文献.*|\*{0,2}参考文献\*{0,2}\s*)$/gm
  let lastMatch: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = refRe.exec(content)) !== null) {
    lastMatch = m
  }
  if (!lastMatch) return content

  const headingIdx = lastMatch.index
  const before = content.slice(0, headingIdx)
  const refSection = content.slice(headingIdx)

  const newlineIdx = refSection.indexOf('\n')
  if (newlineIdx < 0) return content
  const headingLine = refSection.slice(0, newlineIdx).trim()
  const body = refSection.slice(newlineIdx + 1).trim()
  if (!body) return content

  const heading = headingLine.startsWith('#') ? headingLine : `### ${headingLine.replace(/\*+/g, '').trim()}`

  const refMarker = /\[(?:Q?\d+(?:-\d+)?)\]/
  const bodyOneLine = body.replace(/\n/g, ' ').replace(/\s+/g, ' ')
  const parts = bodyOneLine.split(/(\[(?:Q?\d+(?:-\d+)?)\])/).filter(Boolean)

  const entries: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue
    if (refMarker.test(part) && part.length <= 10) {
      const desc = (i + 1 < parts.length) ? parts[i + 1].trim() : ''
      const cleanDesc = desc.replace(/^[-•·]\s*/, '')
      entries.push(`${part} ${cleanDesc}`.trim())
      i++
    } else if (entries.length === 0) {
      if (part.length > 2) entries.push(part)
    }
  }

  if (entries.length === 0) return content
  const formattedBody = entries.map(e => `- ${e}`).join('\n')
  return before + heading + '\n\n' + formattedBody + '\n'
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function StepGenerate({
  disease, articleContent, parsedArticle, qaItems, referenceDocs = [],
  selectedGap, selectedGaps = [], batchProgress, draftHistory, onAddDraft, onUpdateDraft, onBack
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatingLabel, setGeneratingLabel] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'diff' | 'edit' | 'preview'>('diff')
  // 联合生成协调说明
  const [coordinationNotes, setCoordinationNotes] = useState('')

  const isBatchMode = selectedGaps.length >= 2
  const isBatchRunning = batchProgress?.running ?? false

  const activeRecord = draftHistory.find(r => r.id === activeId) ?? draftHistory[draftHistory.length - 1] ?? null

  // --- Single section generation ---
  const generate = async (gap: GapItem) => {
    setGeneratingLabel(gap.section)
    setLoading(true)
    setError('')
    const sectionContent = extractSectionContent(parsedArticle, gap.section)
    try {
      const res = await apiFetch('/api/generate/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease,
          section: gap.section,
          gap_description: gap.description,
          original_content: sectionContent || articleContent,
          qa_references: qaItems.slice(0, 50),
          article_context: articleContent.slice(0, 6000),
          reference_inputs: referenceDocs.map((d, i) => ({
            id: i + 1,
            filename: d.filename,
            text: d.text,
          })),
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
      setGeneratingLabel('')
    }
  }

  // --- Multi-section batch generation ---
  const generateBatch = async (gaps: GapItem[]) => {
    const sectionLabels = gaps.map(g => g.section).join('、')
    setGeneratingLabel(sectionLabels)
    setLoading(true)
    setError('')
    setCoordinationNotes('')

    const sections = gaps.map(g => ({
      section: g.section,
      gap_description: g.description,
      original_content: extractSectionContent(parsedArticle, g.section) || '',
    }))

    try {
      const res = await apiFetch('/api/generate/batch-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease,
          sections,
          qa_references: qaItems.slice(0, 50),
          article_context: articleContent.slice(0, 6000),
          reference_inputs: referenceDocs.map((d, i) => ({
            id: i + 1,
            filename: d.filename,
            text: d.text,
          })),
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '联合生成失败')

      const result = data as BatchGeneratedDraft
      setCoordinationNotes(result.coordination_notes || '')

      const batchId = `batch-${Date.now()}`
      let firstId = ''

      for (const draft of result.drafts) {
        // Find the matching gap for this draft
        const matchGap = gaps.find(g => g.section === draft.section) || gaps[0]
        const record: DraftRecord = {
          id: `${draft.section}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          gap: matchGap,
          draft,
          editedContent: draft.generated_content,
          generatedAt: new Date().toISOString(),
          batchId,
        }
        onAddDraft(record)
        if (!firstId) firstId = record.id
      }
      if (firstId) setActiveId(firstId)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setGeneratingLabel('')
    }
  }

  useEffect(() => {
    if (isBatchMode) {
      // 联合生成模式
      const allGenerated = selectedGaps.every(g =>
        draftHistory.some(r => r.gap.section === g.section && r.gap.priority === g.priority)
      )
      if (!allGenerated) {
        generateBatch(selectedGaps)
      } else if (draftHistory.length > 0) {
        setActiveId(draftHistory[draftHistory.length - 1].id)
      }
      return
    }

    // 批量并行模式由 App 驱动，这里只需展示已有结果
    if (isBatchRunning || (!selectedGap && !isBatchMode)) {
      if (draftHistory.length > 0) setActiveId(draftHistory[draftHistory.length - 1].id)
      return
    }

    if (!selectedGap) return
    const existing = draftHistory.find(
      r => r.gap.section === selectedGap.section && r.gap.priority === selectedGap.priority
    )
    if (existing) {
      setActiveId(existing.id)
    } else {
      generate(selectedGap)
    }
  }, [])

  // 批量并行运行时，自动追踪最新生成的稿件
  useEffect(() => {
    if (isBatchRunning && draftHistory.length > 0) {
      setActiveId(draftHistory[draftHistory.length - 1].id)
    }
  }, [draftHistory.length, isBatchRunning])

  const handleRegenerate = () => {
    if (isBatchMode) {
      generateBatch(selectedGaps)
    } else {
      const gap = activeRecord?.gap ?? selectedGap
      if (gap) generate(gap)
    }
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

  // Get batch-related drafts for the current batch
  const batchDrafts = activeRecord?.batchId
    ? draftHistory.filter(r => r.batchId === activeRecord.batchId)
    : []

  if (loading) return (
    <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
      <div className="spinner" style={{ margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 500, color: 'var(--m3-on-surface)' }}>
        {isBatchMode
          ? '正在联合生成多个章节内容...'
          : `正在生成「${generatingLabel}」内容...`}
      </div>
      <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginTop: 6 }}>
        {isBatchMode
          ? `AI 正在协调 ${selectedGaps.length} 个章节的内容，确保跨章节一致性，通常需要 60-120 秒`
          : 'AI 正在结合 Q&A 数据和词条上下文撰写，通常需要 30-60 秒'}
      </div>
      {isBatchMode && (
        <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {selectedGaps.map((g, i) => (
            <span key={i} style={{ padding: '3px 10px', background: 'var(--dui-primary-container)', color: 'var(--m3-primary)', borderRadius: 999, fontSize: 12 }}>
              {g.section}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  if (error) return (
    <div className="section-card">
      <div style={{ padding: '12px 16px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
        {error}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-m3-outline" onClick={onBack}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          返回
        </button>
        <button className="btn-gradient" onClick={handleRegenerate}>重试</button>
      </div>
    </div>
  )

  if (!activeRecord) {
    // 批量并行正在后台运行但尚无结果
    if (isBatchRunning && batchProgress) return (
      <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 500, color: 'var(--m3-on-surface)' }}>
          批量生成进行中 {batchProgress.done}/{batchProgress.total}
        </div>
        <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginTop: 6 }}>
          生成完成的稿件将自动出现在下方，您也可以切换到其他步骤继续操作
        </div>
        <div style={{ marginTop: 16, maxWidth: 400, margin: '16px auto 0' }}>
          <div style={{ height: 6, background: 'var(--m3-surface-container-low)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.3s', width: `${(batchProgress.done / batchProgress.total) * 100}%`, background: 'var(--m3-primary)' }} />
          </div>
        </div>
      </div>
    )
    return null
  }

  const { gap, draft } = activeRecord

  return (
    <div>
      {/* App-level batch progress banner */}
      {isBatchRunning && batchProgress && (
        <div style={{
          padding: '10px 16px', marginBottom: 10, borderRadius: 10,
          background: 'var(--dui-primary-container)', border: '0.5px solid var(--dui-primary)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface)' }}>
            批量生成中 {batchProgress.done}/{batchProgress.total}
          </span>
          {batchProgress.failed > 0 && (
            <span style={{ fontSize: 12, color: 'var(--m3-error)' }}>（{batchProgress.failed} 失败）</span>
          )}
          <div style={{ flex: 1, height: 4, background: 'var(--m3-surface-container-low)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, transition: 'width 0.3s', width: `${(batchProgress.done / batchProgress.total) * 100}%`, background: 'var(--m3-primary)' }} />
          </div>
        </div>
      )}

      {/* Batch coordination notes */}
      {coordinationNotes && batchDrafts.length > 0 && (
        <div className="section-card" style={{ padding: '12px 16px', background: 'var(--dui-primary-container)', borderLeft: '3px solid var(--m3-primary)', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>merge</span>
            <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--m3-on-surface)' }}>跨章节协调说明</span>
            <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>（{batchDrafts.length} 个章节联合生成）</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', lineHeight: 1.7 }}>
            {coordinationNotes}
          </div>
        </div>
      )}

      {/* History tabs */}
      {draftHistory.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {draftHistory.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', height: 32, borderRadius: 100, cursor: 'pointer',
                border: 'none',
                background: r.id === activeId
                  ? 'linear-gradient(135deg, var(--dui-primary), var(--dui-primary-soft))'
                  : 'var(--dui-surface-soft)',
                transition: 'filter 0.15s, background 0.15s',
              }}
            >
              {r.batchId && (
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: r.id === activeId ? 'rgba(255,255,255,0.75)' : 'var(--m3-primary)' }}>merge</span>
              )}
              <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 8px', borderRadius: 999, background: r.id === activeId ? 'rgba(255,255,255,0.25)' : r.gap.priority === 'P0' ? 'var(--dui-danger-container)' : r.gap.priority === 'P1' ? 'var(--dui-warning-container)' : 'var(--dui-primary-container)', color: r.id === activeId ? 'white' : r.gap.priority === 'P0' ? 'var(--dui-danger)' : r.gap.priority === 'P1' ? 'var(--dui-warning)' : 'var(--dui-primary)' }}>{r.gap.priority}</span>
              <span style={{ fontWeight: 500, fontSize: 13, color: r.id === activeId ? 'white' : 'var(--m3-on-surface)' }}>
                {r.gap.section}
              </span>
              <span style={{ fontSize: 12, color: r.id === activeId ? 'rgba(255,255,255,0.75)' : 'var(--m3-on-surface-variant)' }}>{formatTime(r.generatedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div>
        {/* Header */}
        <div className="section-card" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 10px', borderRadius: 999, flexShrink: 0, background: gap.priority === 'P0' ? 'var(--dui-danger-container)' : gap.priority === 'P1' ? 'var(--dui-warning-container)' : 'var(--dui-primary-container)', color: gap.priority === 'P0' ? 'var(--dui-danger)' : gap.priority === 'P1' ? 'var(--dui-warning)' : 'var(--dui-primary)' }}>{gap.priority}</span>
                <span style={{ fontWeight: 500, color: 'var(--m3-on-surface)' }}>{disease} — {gap.section}</span>
                {activeRecord.batchId && (
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--dui-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>merge</span>
                    联合生成
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', lineHeight: 1.5 }}>{gap.description}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={handleRegenerate}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                {activeRecord.batchId ? '重新联合生成' : '重新生成'}
              </button>
              <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={copyToClipboard}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                复制
              </button>
              <button className="btn-gradient" style={{ fontSize: 12, padding: '4px 12px' }} onClick={exportMarkdown}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                导出 Markdown
              </button>
            </div>
          </div>
        </div>

        {/* Key changes */}
        {draft.key_changes.length > 0 && (
          <div className="section-card" style={{ padding: '14px 20px' }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8, color: 'var(--m3-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>edit_note</span>
              主要改动点
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {draft.key_changes.map((c, i) => (
                <span key={i} style={{ padding: '3px 10px', background: 'var(--dui-primary-container)', color: 'var(--m3-primary)', borderRadius: 999, fontSize: 12 }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View tabs */}
        <div className="section-card">
          <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--dui-divider)', marginBottom: 16 }}>
            {[
              { key: 'diff' as const, label: '对比视图', icon: 'compare' },
              { key: 'edit' as const, label: '编辑稿件', icon: 'edit' },
              { key: 'preview' as const, label: '预览效果', icon: 'visibility' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 16px', fontSize: 13, fontWeight: view === t.key ? 600 : 400,
                  color: view === t.key ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: view === t.key ? '2px solid var(--m3-primary)' : '2px solid transparent',
                  marginBottom: -2,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {view === 'diff' && (
            <div className="diff-container">
              <div className="diff-panel">
                <div className="diff-panel-header original">原词条内容</div>
                <div className="diff-content md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {draft.original_content || '（该章节暂无内容）'}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="diff-panel">
                <div className="diff-panel-header generated">AI 生成稿件</div>
                <div className="diff-content md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {formatReferences(activeRecord.editedContent)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {view === 'edit' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginBottom: 8 }}>在下方直接编辑稿件内容（支持 Markdown）：</div>
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
                {formatReferences(activeRecord.editedContent)}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* References */}
        {draft.references_used.length > 0 && (
          <div className="section-card">
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8, color: 'var(--m3-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>menu_book</span>
              引用来源
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {draft.references_used.map((r, i) => (
                <span key={i} style={{ padding: '3px 10px', background: 'var(--dui-surface-soft)', color: 'var(--dui-text-sub)', borderRadius: 999, fontSize: 12 }}>{r}</span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
