import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { QAItem, GapItem, GeneratedDraft, DraftRecord, ReferenceDoc, ParsedArticle, BatchGeneratedDraft, ReferenceAnchor } from '../types'
import { apiFetch } from '../api'
import { getGenerationOriginalContent } from '../utils/generationScope'
import { extractSectionContent } from '../utils/sectionContent'
import { markdownRemarkPlugins } from '../utils/markdown'
import {
  buildReferenceAnchorsFromDocs,
  CITATION_GROUP_PATTERN,
  CITATION_MARKER_PATTERN,
  createCitationResolver,
  formatCitationSourceLabel,
  linkifyCitationMarkers,
  mergeReferenceAnchors,
  splitCitationTokens,
  type CitationResolver,
} from '../utils/citations'

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

  const refMarker = new RegExp(CITATION_MARKER_PATTERN, 'i')
  const bodyOneLine = body.replace(/\n/g, ' ').replace(/\s+/g, ' ')
  const parts = bodyOneLine.split(new RegExp(`(${CITATION_MARKER_PATTERN})`, 'i')).filter(Boolean)

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

function renderTextWithCitationButtons({
  text,
  resolveCitation,
  activeCitationKey,
  onCitationClick,
}: {
  text: string
  resolveCitation: CitationResolver
  activeCitationKey: string | null
  onCitationClick: (key: string) => void
}) {
  const groupRe = new RegExp(CITATION_GROUP_PATTERN, 'gi')
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = groupRe.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const tokens = splitCitationTokens(match[1])
    const links = tokens.map(token => resolveCitation(token, text))
    if (links.some(Boolean)) {
      tokens.forEach((token, index) => {
        if (index > 0) nodes.push('、')
        const link = links[index]
        if (link) {
          nodes.push(
            <button
              key={`${match?.index}-${token}-${index}`}
              type="button"
              className={`citation-link${link.key === activeCitationKey ? ' active' : ''}`}
              onClick={() => onCitationClick(link.key)}
            >
              [{link.label}]
            </button>,
          )
        } else {
          nodes.push(`[${token}]`)
        }
      })
    } else {
      nodes.push(`[${tokens.join('、')}]`)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function CitationEvidencePanel({
  anchor,
  onClose,
}: {
  anchor: ReferenceAnchor
  onClose: () => void
}) {
  return (
    <aside className="citation-panel" aria-label="引用定位">
      <div className="citation-panel-header">
        <div>
          <div className="citation-panel-title">[{anchor.citation_key}]</div>
          <div className="citation-panel-source">{formatCitationSourceLabel(anchor)}</div>
          {anchor.title_path && <div className="citation-panel-source">{anchor.title_path}</div>}
        </div>
        <button type="button" className="btn-m3-icon" onClick={onClose} aria-label="关闭引用定位">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <div className="citation-context">
        {anchor.context_before && <p className="citation-context-muted">{anchor.context_before}</p>}
        <p className="citation-context-quote">{anchor.quote}</p>
        {anchor.context_after && <p className="citation-context-muted">{anchor.context_after}</p>}
      </div>
    </aside>
  )
}

type DiffPart = {
  type: 'same' | 'added' | 'removed'
  value: string
}

const MAX_WORD_DIFF_TOKENS = 3000
const MAX_LINE_DIFF_TOKENS = 1200
const MAX_DIFF_CELLS = 4_000_000

function tokenizeWords(text: string): string[] {
  const tokens: string[] = []
  let current = ''
  let currentKind: 'latin' | 'space' | 'other' | null = null

  const flush = () => {
    if (current) tokens.push(current)
    current = ''
    currentKind = null
  }

  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0
    const isCjk =
      (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff)
    if (isCjk) {
      flush()
      tokens.push(char)
      continue
    }

    const kind = /\s/.test(char)
      ? 'space'
      : /[A-Za-z0-9_]/.test(char)
        ? 'latin'
        : 'other'
    if (kind !== currentKind || kind === 'other') flush()
    current += char
    currentKind = kind
  }
  flush()
  return tokens
}

function tokenizeLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+/g) || []
}

function diffTokenParts(oldTokens: string[], newTokens: string[], maxTokens: number): DiffPart[] | null {
  if (oldTokens.length + newTokens.length > maxTokens) return null
  const width = newTokens.length + 1
  const cells = (oldTokens.length + 1) * width
  if (cells > MAX_DIFF_CELLS) return null

  const table = new Uint32Array(cells)
  for (let i = oldTokens.length - 1; i >= 0; i--) {
    for (let j = newTokens.length - 1; j >= 0; j--) {
      const idx = i * width + j
      table[idx] = oldTokens[i] === newTokens[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const parts: DiffPart[] = []
  const push = (type: DiffPart['type'], value: string) => {
    const last = parts[parts.length - 1]
    if (last?.type === type) last.value += value
    else parts.push({ type, value })
  }

  let i = 0
  let j = 0
  while (i < oldTokens.length && j < newTokens.length) {
    if (oldTokens[i] === newTokens[j]) {
      push('same', oldTokens[i])
      i++
      j++
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      push('removed', oldTokens[i++])
    } else {
      push('added', newTokens[j++])
    }
  }
  while (i < oldTokens.length) push('removed', oldTokens[i++])
  while (j < newTokens.length) push('added', newTokens[j++])
  return parts
}

function diffTextParts(oldText: string, newText: string): DiffPart[] {
  return diffTokenParts(tokenizeWords(oldText), tokenizeWords(newText), MAX_WORD_DIFF_TOKENS)
    || diffTokenParts(tokenizeLines(oldText), tokenizeLines(newText), MAX_LINE_DIFF_TOKENS)
    || [
      { type: 'removed', value: oldText },
      { type: 'added', value: newText },
    ]
}

function DiffPaneContent({
  parts,
  side,
  resolveCitation,
  activeCitationKey,
  onCitationClick,
}: {
  parts: DiffPart[]
  side: 'original' | 'generated'
  resolveCitation?: CitationResolver
  activeCitationKey?: string | null
  onCitationClick?: (key: string) => void
}) {
  const visibleParts = parts.filter(part => side === 'original' ? part.type !== 'added' : part.type !== 'removed')
  if (!visibleParts.some(part => part.value.trim())) return <span>-</span>

  return (
    <>
      {visibleParts.map((part, index) => {
        const children = side === 'generated' && resolveCitation && onCitationClick
          ? renderTextWithCitationButtons({
            text: part.value,
            resolveCitation,
            activeCitationKey: activeCitationKey ?? null,
            onCitationClick,
          })
          : part.value
        return (
          <span
            key={index}
            className={part.type === 'added' ? 'diff-token-added' : part.type === 'removed' ? 'diff-token-removed' : undefined}
          >
            {children}
          </span>
        )
      })}
    </>
  )
}

function CompareDiffView({
  original,
  generated,
  resolveCitation,
  activeCitationKey,
  onCitationClick,
}: {
  original: string
  generated: string
  resolveCitation: CitationResolver
  activeCitationKey: string | null
  onCitationClick: (key: string) => void
}) {
  const parts = useMemo(() => diffTextParts(original, generated), [original, generated])

  return (
    <div className="diff-container">
      <div className="diff-panel">
        <div className="diff-panel-header original">原词条内容</div>
        <div className="diff-content diff-text-content">
          <DiffPaneContent parts={parts} side="original" />
        </div>
      </div>
      <div className="diff-panel">
        <div className="diff-panel-header generated">AI 生成稿件</div>
        <div className="diff-content diff-text-content">
          <DiffPaneContent
            parts={parts}
            side="generated"
            resolveCitation={resolveCitation}
            activeCitationKey={activeCitationKey}
            onCitationClick={onCitationClick}
          />
        </div>
      </div>
    </div>
  )
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
  const [activeCitationKey, setActiveCitationKey] = useState<string | null>(null)
  // 联合生成协调说明
  const [coordinationNotes, setCoordinationNotes] = useState('')

  const isBatchMode = selectedGaps.length >= 2
  const isBatchRunning = batchProgress?.running ?? false

  const activeRecord = draftHistory.find(r => r.id === activeId) ?? draftHistory[draftHistory.length - 1] ?? null
  const referenceAnchors = useMemo(() => {
    return mergeReferenceAnchors(
      buildReferenceAnchorsFromDocs(referenceDocs),
      activeRecord?.draft.reference_anchors ?? [],
    )
  }, [activeRecord?.draft.reference_anchors, referenceDocs])
  const citationKeySet = useMemo(
    () => new Set(referenceAnchors.map(anchor => anchor.anchor_key ?? anchor.citation_key)),
    [referenceAnchors],
  )
  const activeCitation = referenceAnchors.find(anchor => (anchor.anchor_key ?? anchor.citation_key) === activeCitationKey) ?? null
  const resolveCitation = useMemo<CitationResolver>(
    () => createCitationResolver(referenceAnchors),
    [referenceAnchors],
  )
  const handleCitationClick = (citationKey: string) => {
    setActiveCitationKey(citationKey)
  }
  const markdownComponents = useMemo<Components>(() => ({
    a({ href, children }) {
      if (href?.startsWith('#citation-')) {
        const citationKey = href.slice('#citation-'.length)
        const isActive = citationKey === activeCitationKey
        return (
          <button
            type="button"
            className={`citation-link${isActive ? ' active' : ''}`}
            onClick={() => {
              handleCitationClick(citationKey)
            }}
          >
            {children}
          </button>
        )
      }
      return <a href={href}>{children}</a>
    },
  }), [activeCitationKey])
  const renderedDraftContent = useMemo(
    () => activeRecord ? linkifyCitationMarkers(formatReferences(activeRecord.editedContent), resolveCitation) : '',
    [activeRecord?.editedContent, resolveCitation],
  )

  useEffect(() => {
    setActiveCitationKey(null)
  }, [activeRecord?.id])

  useEffect(() => {
    if (activeCitationKey && !citationKeySet.has(activeCitationKey)) {
      setActiveCitationKey(null)
    }
  }, [activeCitationKey, citationKeySet])

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
          original_content: getGenerationOriginalContent(sectionContent, articleContent),
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
  const originalContent = draft.original_content || extractSectionContent(parsedArticle, gap.section)

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
            <div className={`draft-preview-shell${activeCitation ? ' has-citation-panel' : ''}`}>
              <CompareDiffView
                original={originalContent || '（该章节暂无内容）'}
                generated={formatReferences(activeRecord.editedContent)}
                resolveCitation={resolveCitation}
                activeCitationKey={activeCitationKey}
                onCitationClick={handleCitationClick}
              />
              {activeCitation && (
                <CitationEvidencePanel
                  anchor={activeCitation}
                  onClose={() => setActiveCitationKey(null)}
                />
              )}
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
            <div className={`draft-preview-shell${activeCitation ? ' has-citation-panel' : ''}`}>
              <div className="diff-content md draft-preview-content" style={{ maxHeight: 'none', minHeight: 300 }}>
                <ReactMarkdown remarkPlugins={markdownRemarkPlugins} components={markdownComponents}>
                  {renderedDraftContent}
                </ReactMarkdown>
              </div>
              {activeCitation && (
                <CitationEvidencePanel
                  anchor={activeCitation}
                  onClose={() => setActiveCitationKey(null)}
                />
              )}
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
