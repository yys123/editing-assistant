import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AiIntegrationRecord, ParsedArticle, ReferenceAnchor, ReferenceDoc } from '../types'
import { apiFetch, safeJson } from '../api'
import {
  buildReferenceAnchorFromSourceDoc,
  buildReferenceAnchorsFromDocs,
  createCitationResolver,
  linkifyCitationMarkers,
  splitCitationTokens,
} from '../utils/citations'

interface Props {
  disease: string
  articleContent: string
  parsedArticle?: ParsedArticle | null
  referenceDocs?: ReferenceDoc[]
  history: AiIntegrationRecord[]
  onAddRecord: (record: AiIntegrationRecord) => void
}

type OriginalScope = 'all' | 'sections' | 'none'

function buildSectionContent(parsedArticle: ParsedArticle | null | undefined, selectedIds: string[]) {
  if (!parsedArticle || selectedIds.length === 0) return ''
  const selected = new Set(selectedIds)
  return parsedArticle.sections
    .filter(section => selected.has(section.id))
    .map(section => {
      const prefix = section.level <= 1 ? '##' : section.level === 2 ? '###' : '####'
      return `${prefix} ${section.heading}\n${section.content}`.trim()
    })
    .join('\n\n')
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function answerSentenceAround(text: string, index: number) {
  const before = text.slice(0, index)
  const after = text.slice(index)
  const beforeMatch = before.match(/[。！？!?；;\n]\s*[^。！？!?；;\n]*$/)
  const start = beforeMatch ? before.length - beforeMatch[0].replace(/^[。！？!?；;\n]\s*/, '').length : 0
  const afterMatch = after.match(/[。！？!?；;\n]/)
  const end = afterMatch ? index + (afterMatch.index ?? 0) + 1 : text.length
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

function sourceCitationQueries(answer: string) {
  const queries = new Map<string, string[]>()
  const citationGroupRe = /\^?(?:<sup>)?[\[［【]((?:R\d+\s*[-–—]\s*C\d+|Q?\d+|\d+\s*[-–—]\s*\d+)(?:\s*[、,，]\s*(?:R\d+\s*[-–—]\s*C\d+|Q?\d+|\d+\s*[-–—]\s*\d+))*)[\]］】](?:<\/sup>)?/gi
  let match: RegExpExecArray | null
  while ((match = citationGroupRe.exec(answer)) !== null) {
    const sentence = answerSentenceAround(answer, match.index)
    for (const token of splitCitationTokens(match[1])) {
      if (!/^\d+$/.test(token)) continue
      const list = queries.get(token) ?? []
      list.push(sentence)
      queries.set(token, list)
    }
  }
  return new Map([...queries].map(([key, values]) => [key, values.join(' ')]))
}

function buildSourceAnchors(
  referenceDocs: ReferenceDoc[],
  selectedFilenames: Set<string>,
  answer: string,
): ReferenceAnchor[] {
  const queries = sourceCitationQueries(answer)
  return referenceDocs.flatMap((doc, index) => {
    if (!selectedFilenames.has(doc.filename)) return []
    const sourceId = index + 1
    return [buildReferenceAnchorFromSourceDoc(doc, sourceId, queries.get(String(sourceId)) ?? '')]
  })
}

function AiCitationPanel({
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
          <div className="citation-panel-source">参考数据源 {anchor.source_id}：{anchor.source_filename}</div>
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

export default function StepAiIntegration({
  disease, articleContent, parsedArticle, referenceDocs = [], history, onAddRecord,
}: Props) {
  const [userRequest, setUserRequest] = useState('')
  const [selectedRefs, setSelectedRefs] = useState<string[]>(() => referenceDocs.map(d => d.filename))
  const [priorityRefs, setPriorityRefs] = useState<string[]>([])
  const [originalScope, setOriginalScope] = useState<OriginalScope>('all')
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(() => parsedArticle?.sections.map(s => s.id) ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(history[history.length - 1]?.id ?? null)
  const [activeCitationKey, setActiveCitationKey] = useState<string | null>(null)

  useEffect(() => {
    setSelectedRefs(referenceDocs.map(doc => doc.filename))
    setPriorityRefs(prev => prev.filter(name => referenceDocs.some(doc => doc.filename === name)))
  }, [referenceDocs])

  useEffect(() => {
    if (!parsedArticle) return
    setSelectedSectionIds(prev => {
      const validIds = new Set(parsedArticle.sections.map(section => section.id))
      const kept = prev.filter(id => validIds.has(id))
      return kept.length > 0 ? kept : parsedArticle.sections.map(section => section.id)
    })
  }, [parsedArticle])

  const selectedRefSet = useMemo(() => new Set(selectedRefs), [selectedRefs])
  const priorityRefSet = useMemo(() => new Set(priorityRefs), [priorityRefs])
  const activeRecord = history.find(r => r.id === activeId) ?? history[history.length - 1] ?? null
  const activeRecordSelectedRefSet = useMemo(
    () => new Set(activeRecord?.selectedReferences ?? []),
    [activeRecord?.selectedReferences],
  )
  const referenceAnchors = useMemo(() => {
    if (!activeRecord) return []
    const merged = new Map<string, ReferenceAnchor>()
    for (const anchor of activeRecord.referenceAnchors ?? []) {
      merged.set(anchor.citation_key, anchor)
    }
    const selectedSourceIds = new Set<number>()
    referenceDocs.forEach((doc, index) => {
      if (activeRecordSelectedRefSet.has(doc.filename)) selectedSourceIds.add(index + 1)
    })
    const sourceAnchors = buildSourceAnchors(referenceDocs, activeRecordSelectedRefSet, activeRecord.answer)
    const internalAnchors = buildReferenceAnchorsFromDocs(referenceDocs)
      .filter(anchor => selectedSourceIds.has(anchor.source_id))
    for (const anchor of sourceAnchors) {
      if (!merged.has(anchor.citation_key)) merged.set(anchor.citation_key, anchor)
    }
    for (const anchor of internalAnchors) {
      if (!merged.has(anchor.citation_key)) merged.set(anchor.citation_key, anchor)
    }
    return Array.from(merged.values())
  }, [activeRecord, activeRecordSelectedRefSet, referenceDocs])
  const citationKeySet = useMemo(
    () => new Set(referenceAnchors.map(anchor => anchor.citation_key)),
    [referenceAnchors],
  )
  const activeCitation = referenceAnchors.find(anchor => anchor.citation_key === activeCitationKey) ?? null
  const resolveCitation = useMemo(
    () => createCitationResolver(referenceAnchors),
    [referenceAnchors],
  )
  const markdownComponents = useMemo<Components>(() => ({
    a({ href, children }) {
      if (href?.startsWith('#citation-')) {
        const citationKey = href.slice('#citation-'.length)
        return (
          <button
            type="button"
            className={`citation-link${citationKey === activeCitationKey ? ' active' : ''}`}
            onClick={() => setActiveCitationKey(citationKey)}
          >
            {children}
          </button>
        )
      }
      return <a href={href}>{children}</a>
    },
  }), [activeCitationKey])
  const renderedAnswer = useMemo(
    () => activeRecord ? linkifyCitationMarkers(activeRecord.answer, resolveCitation) : '',
    [activeRecord, resolveCitation],
  )

  useEffect(() => {
    setActiveCitationKey(null)
  }, [activeRecord?.id])

  useEffect(() => {
    if (activeCitationKey && !citationKeySet.has(activeCitationKey)) {
      setActiveCitationKey(null)
    }
  }, [activeCitationKey, citationKeySet])

  const originalContent = useMemo(() => {
    if (originalScope === 'none') return ''
    if (originalScope === 'sections') return buildSectionContent(parsedArticle, selectedSectionIds)
    return articleContent
  }, [articleContent, originalScope, parsedArticle, selectedSectionIds])

  const setAllRefs = () => {
    setSelectedRefs(referenceDocs.map(d => d.filename))
    setPriorityRefs(prev => prev.filter(name => referenceDocs.some(d => d.filename === name)))
  }

  const clearRefs = () => {
    setSelectedRefs([])
    setPriorityRefs([])
  }

  const toggleRef = (filename: string) => {
    setSelectedRefs(prev => {
      const next = prev.includes(filename) ? prev.filter(name => name !== filename) : [...prev, filename]
      setPriorityRefs(priorityPrev => priorityPrev.filter(name => next.includes(name)))
      return next
    })
  }

  const togglePriorityRef = (filename: string) => {
    if (!selectedRefSet.has(filename)) return
    setPriorityRefs(prev => prev.includes(filename) ? prev.filter(name => name !== filename) : [...prev, filename])
  }

  const toggleSection = (id: string) => {
    setSelectedSectionIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const runIntegration = async () => {
    const request = userRequest.trim()
    if (!request) {
      setError('请输入问题或要求')
      return
    }

    setLoading(true)
    setError('')
    try {
      const referenceInputs = referenceDocs
        .map((doc, index) => ({ doc, id: index + 1 }))
        .filter(item => selectedRefSet.has(item.doc.filename))
        .map(item => ({
          id: item.id,
          filename: item.doc.filename,
          text: item.doc.text,
        }))
      const priorityReferenceIds = referenceDocs
        .map((doc, index) => ({ doc, id: index + 1 }))
        .filter(item => selectedRefSet.has(item.doc.filename) && priorityRefSet.has(item.doc.filename))
        .map(item => item.id)

      const res = await apiFetch('/api/generate/ai-integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease,
          user_request: request,
          original_content: originalContent,
          reference_inputs: referenceInputs,
          priority_reference_ids: priorityReferenceIds,
        }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.detail || 'AI整合失败')

      const record: AiIntegrationRecord = {
        id: `ai-integration-${Date.now()}`,
        request,
        answer: data.answer || '',
        referencesUsed: data.references_used || [],
        referenceAnchors: data.reference_anchors || [],
        selectedReferences: selectedRefs,
        priorityReferences: priorityRefs,
        originalScope,
        selectedSectionIds,
        createdAt: new Date().toISOString(),
      }
      onAddRecord(record)
      setActiveId(record.id)
    } catch (e: any) {
      setError(e.message || 'AI整合失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          AI整合
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          基于已上传资料和词条内容回答编辑问题
        </p>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <textarea
            className="m3-input"
            value={userRequest}
            onChange={e => setUserRequest(e.target.value)}
            placeholder="输入问题或要求"
            style={{ minHeight: 96, resize: 'vertical', flex: 1, lineHeight: 1.7 }}
          />
          <button className="btn-gradient" onClick={runIntegration} disabled={loading} style={{ minWidth: 120, justifyContent: 'center' }}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>}
            发送
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
            {error}
          </div>
        )}
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>library_books</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--m3-on-surface)' }}>参考文献</span>
          <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
            已选 {selectedRefs.length} / {referenceDocs.length}，重点指南 {priorityRefs.length}
          </span>
          {referenceDocs.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button className="btn btn-sm" style={{ padding: '3px 10px', fontSize: 12, color: 'var(--m3-primary)' }} onClick={setAllRefs}>全选</button>
              <button className="btn btn-sm" style={{ padding: '3px 10px', fontSize: 12, color: 'var(--gray-500)' }} onClick={clearRefs}>清空</button>
            </div>
          )}
        </div>

        {referenceDocs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)' }}>未上传参考文献</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 8,
            maxHeight: 220,
            overflowY: 'auto',
            paddingRight: 4,
          }}>
            {referenceDocs.map((doc, refIndex) => {
              const checked = selectedRefSet.has(doc.filename)
              const priority = priorityRefSet.has(doc.filename)
              return (
                <label
                  key={`${doc.filename}-${refIndex}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    minWidth: 0,
                    padding: '7px 10px',
                    borderRadius: 10,
                    border: `0.5px solid ${checked ? 'var(--m3-primary)' : 'var(--dui-divider)'}`,
                    background: priority ? 'var(--dui-warning-container)' : checked ? 'var(--dui-primary-container)' : 'var(--m3-surface-container-low)',
                    color: checked ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                  title={`${doc.filename} · ${doc.char_count} 字符`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRef(doc.filename)}
                    style={{ margin: '2px 0 0', flexShrink: 0 }}
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', lineHeight: 1.45, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {refIndex + 1}. {doc.filename}
                    </span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: priority ? 'var(--dui-warning)' : checked ? 'var(--m3-primary)' : 'var(--gray-400)' }}>
                      {doc.char_count.toLocaleString()} 字符
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={!checked}
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      togglePriorityRef(doc.filename)
                    }}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      padding: '3px 8px',
                      fontSize: 11,
                      cursor: checked ? 'pointer' : 'not-allowed',
                      flexShrink: 0,
                      background: priority ? 'var(--dui-warning)' : 'var(--m3-surface-container-highest)',
                      color: priority ? '#fff' : checked ? 'var(--dui-warning)' : 'var(--gray-400)',
                      opacity: checked ? 1 : 0.55,
                    }}
                    title={checked ? '设为重点指南' : '请先选中该参考文献'}
                  >
                    {priority ? '重点' : '设重点'}
                  </button>
                </label>
              )
            })}
          </div>
        )}
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>article</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--m3-on-surface)' }}>原词条内容</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: originalScope === 'sections' && parsedArticle ? 12 : 0 }}>
          {[
            { key: 'all' as const, label: '全文' },
            { key: 'sections' as const, label: '按章节' },
            { key: 'none' as const, label: '不带入' },
          ].map(item => (
            <button
              key={item.key}
              className={originalScope === item.key ? 'btn-gradient' : 'btn-m3-outline'}
              onClick={() => setOriginalScope(item.key)}
              disabled={item.key === 'sections' && !parsedArticle}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              {item.label}
            </button>
          ))}
          <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', alignSelf: 'center' }}>
            {originalContent ? `${originalContent.length.toLocaleString()} 字符` : '未选择'}
          </span>
        </div>
        {originalScope === 'sections' && parsedArticle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
            {parsedArticle.sections.map(section => (
              <label
                key={section.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: selectedSectionIds.includes(section.id) ? 'var(--dui-primary-container)' : 'var(--m3-surface-container-low)',
                  color: selectedSectionIds.includes(section.id) ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                <input type="checkbox" checked={selectedSectionIds.includes(section.id)} onChange={() => toggleSection(section.id)} />
                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{section.heading}</span>
                <span style={{ color: 'var(--gray-400)' }}>{section.word_count} 字</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {activeRecord && (
        <div className="section-card">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {history.map(record => (
              <button
                key={record.id}
                onClick={() => setActiveId(record.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  background: record.id === activeRecord.id ? 'linear-gradient(135deg, var(--dui-primary), var(--dui-primary-soft))' : 'var(--dui-surface-soft)',
                  color: record.id === activeRecord.id ? 'white' : 'var(--m3-on-surface)',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {formatTime(record.createdAt)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--m3-on-surface)', marginBottom: 8 }}>
            {activeRecord.request}
          </div>
          <div className={`draft-preview-shell${activeCitation ? ' has-citation-panel' : ''}`}>
            <div className="diff-content md draft-preview-content" style={{ maxHeight: 'none', minHeight: 160 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {renderedAnswer}
              </ReactMarkdown>
            </div>
            {activeCitation && (
              <AiCitationPanel
                anchor={activeCitation}
                onClose={() => setActiveCitationKey(null)}
              />
            )}
          </div>
          {activeRecord.referencesUsed.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {activeRecord.referencesUsed.map((ref, index) => (
                <span key={`${ref}-${index}`} style={{ padding: '3px 10px', background: 'var(--dui-surface-soft)', color: 'var(--dui-text-sub)', borderRadius: 999, fontSize: 12 }}>
                  {ref}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
