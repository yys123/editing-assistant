import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { QAItem, GapItem, GeneratedDraft, DraftRecord, ReferenceDoc, ParsedArticle } from '../types'
import { apiFetch } from '../api'

interface Props {
  disease: string
  articleContent: string
  parsedArticle?: ParsedArticle | null
  qaItems: QAItem[]
  referenceDocs?: ReferenceDoc[]
  selectedGap: GapItem | null
  draftHistory: DraftRecord[]
  onAddDraft: (record: DraftRecord) => void
  onUpdateDraft: (id: string, editedContent: string) => void
  onBack: () => void
}

/**
 * Extract the content of the section (and its children) matching the gap section path.
 * gap.section may be like "诊断 > 实验室检查" or just "基础知识".
 */
function extractSectionContent(parsedArticle: ParsedArticle | null | undefined, gapSection: string): string {
  if (!parsedArticle) return ''
  const parts = gapSection.split(' > ').map(s => s.trim())
  const sections = parsedArticle.sections
  const leafHeading = parts[parts.length - 1]

  // Find the index of the target section
  let targetIdx = -1
  if (parts.length === 1) {
    targetIdx = sections.findIndex(s => s.heading === leafHeading)
  } else {
    const parentHeading = parts[parts.length - 2]
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].heading !== leafHeading) continue
      // Walk back to find parent
      for (let j = i - 1; j >= 0; j--) {
        if (sections[j].level < sections[i].level) {
          if (sections[j].heading === parentHeading) targetIdx = i
          break
        }
      }
      if (targetIdx >= 0) break
    }
    // Fallback: match by leaf heading alone
    if (targetIdx < 0) targetIdx = sections.findIndex(s => s.heading === leafHeading)
  }

  if (targetIdx < 0) return ''

  const target = sections[targetIdx]
  let combined = target.content

  // Include immediate child sections
  for (let i = targetIdx + 1; i < sections.length; i++) {
    if (sections[i].level <= target.level) break
    const prefix = '#'.repeat(sections[i].level - target.level + 1)
    combined += `\n\n${prefix} ${sections[i].heading}`
    if (sections[i].content.trim()) combined += '\n' + sections[i].content
  }

  return combined
}

/**
 * Normalize the "参考文献" section at the end of generated content:
 * ensure each reference ([1], [2], [Q1], etc.) starts on its own line as a list item.
 *
 * Handles heading variants: "### 参考文献", "## 参考文献", plain "参考文献"
 * Handles ref markers: [1], [Q1], [10-41], etc.
 */
function formatReferences(content: string): string {
  // Find the LAST occurrence of a line that is a "参考文献" heading
  // Matches: "### 参考文献", "## 参考文献", "参考文献", "**参考文献**"
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

  // Split heading line from body
  const newlineIdx = refSection.indexOf('\n')
  if (newlineIdx < 0) return content
  const headingLine = refSection.slice(0, newlineIdx).trim()
  const body = refSection.slice(newlineIdx + 1).trim()
  if (!body) return content

  // Ensure heading is a markdown heading
  const heading = headingLine.startsWith('#') ? headingLine : `### ${headingLine.replace(/\*+/g, '').trim()}`

  // Ref marker pattern: [1], [Q1], [10-41], etc.
  const refMarker = /\[(?:Q?\d+(?:-\d+)?)\]/

  // First, join all body text into a single string, then split by ref markers
  const bodyOneLine = body.replace(/\n/g, ' ').replace(/\s+/g, ' ')

  // Split keeping markers: produces ["", "[1]", " text...", "[2]", " text...", ...]
  const parts = bodyOneLine.split(/(\[(?:Q?\d+(?:-\d+)?)\])/).filter(Boolean)

  const entries: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue
    if (refMarker.test(part) && part.length <= 10) {
      // This is a ref marker — combine with the next part (the description)
      const desc = (i + 1 < parts.length) ? parts[i + 1].trim() : ''
      // Strip leading list markers from desc
      const cleanDesc = desc.replace(/^[-•·]\s*/, '')
      entries.push(`${part} ${cleanDesc}`.trim())
      i++ // skip desc part
    } else if (entries.length === 0) {
      // Text before first marker — could be "(见原文)" etc, skip or add as-is
      if (part.length > 2) entries.push(part)
    }
    // else: already consumed as part of a marker+desc pair
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
  selectedGap, draftHistory, onAddDraft, onUpdateDraft, onBack
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatingGap, setGeneratingGap] = useState<GapItem | null>(null)
  // Index into draftHistory of the currently viewed record
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'diff' | 'edit' | 'preview'>('diff')

  const activeRecord = draftHistory.find(r => r.id === activeId) ?? draftHistory[draftHistory.length - 1] ?? null

  const generate = async (gap: GapItem) => {
    setGeneratingGap(gap)
    setLoading(true)
    setError('')
    // Extract the actual content of the target section from the parsed article
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
      setGeneratingGap(null)
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
    <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
      <div className="spinner" style={{ margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 600, color: 'var(--m3-on-surface)' }}>正在生成「{generatingGap?.section}」内容...</div>
      <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginTop: 6 }}>AI 正在结合 Q&A 数据和词条上下文撰写，通常需要 30-60 秒</div>
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

  if (!activeRecord) return null

  const { gap, draft } = activeRecord

  return (
    <div style={{ display: 'grid', gridTemplateColumns: draftHistory.length > 1 ? '220px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>

      {/* History sidebar — only visible when >1 record */}
      {draftHistory.length > 1 && (
        <div className="section-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 16 }}>
          <div style={{ padding: '12px 14px', fontWeight: 600, fontSize: 12, color: 'var(--m3-on-surface-variant)', borderBottom: '1px solid var(--m3-outline-variant)', background: 'var(--m3-surface-container-low)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>history</span>
            历史稿件 ({draftHistory.length})
          </div>
          {draftHistory.map(r => (
            <div
              key={r.id}
              onClick={() => setActiveId(r.id)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--m3-outline-variant)',
                background: r.id === activeId ? 'rgba(0,84,205,0.06)' : 'white',
                borderLeft: r.id === activeId ? '3px solid var(--m3-primary)' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: r.gap.priority === 'P0' ? '#fee2e2' : r.gap.priority === 'P1' ? '#fff7ed' : '#dbeafe', color: r.gap.priority === 'P0' ? 'var(--m3-error)' : r.gap.priority === 'P1' ? '#e65100' : 'var(--m3-primary)' }}>{r.gap.priority}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: r.id === activeId ? 'var(--m3-primary)' : 'var(--m3-on-surface)' }}>
                  {r.gap.section}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>{formatTime(r.generatedAt)}</div>
            </div>
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
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, flexShrink: 0, background: gap.priority === 'P0' ? '#fee2e2' : gap.priority === 'P1' ? '#fff7ed' : '#dbeafe', color: gap.priority === 'P0' ? 'var(--m3-error)' : gap.priority === 'P1' ? '#e65100' : 'var(--m3-primary)' }}>{gap.priority}</span>
                <span style={{ fontWeight: 600, color: 'var(--m3-on-surface)' }}>{disease} — {gap.section}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', lineHeight: 1.5 }}>{gap.description}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={handleRegenerate}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                重新生成
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
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--m3-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>edit_note</span>
              主要改动点
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {draft.key_changes.map((c, i) => (
                <span key={i} style={{ padding: '3px 10px', background: 'rgba(0,84,205,0.08)', color: 'var(--m3-primary)', borderRadius: 999, fontSize: 12 }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View tabs */}
        <div className="section-card">
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--m3-outline-variant)', marginBottom: 16 }}>
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
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--m3-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>menu_book</span>
              引用来源
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {draft.references_used.map((r, i) => (
                <span key={i} style={{ padding: '3px 10px', background: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface-variant)', borderRadius: 999, fontSize: 12, border: '1px solid var(--m3-outline-variant)' }}>{r}</span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
