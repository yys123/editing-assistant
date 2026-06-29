import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { AiIntegrationLinkedIssue, AiIntegrationRecord, GapAnalysis, ParsedArticle, ReferenceAnchor, ReferenceDoc, SectionAnalysis } from '../types'
import { apiFetch, safeJson } from '../api'
import {
  buildReferenceAnchorFromSourceDoc,
  buildReferenceAnchorsFromDocs,
  buildFallbackOriginalCitationAnchors,
  buildOriginalContentAnchorsFromSources,
  CITATION_GROUP_PATTERN,
  createCitationResolver,
  formatCitationSourceLabel,
  linkifyCitationMarkers,
  mergeReferenceAnchors,
  splitCitationTokens,
} from '../utils/citations'
import { getAiIntegrationDisplayText, getNextAiIntegrationActiveId } from '../utils/aiIntegrationHistory'
import {
  buildAiIntegrationIssueRequest,
  collectAiIntegrationLinkedIssues,
  collectNeedsAnalysisLinkedIssues,
  getLinkedIssuePanelLayout,
  issueSeverityLabel,
  issueTypeLabel,
  sectionIdsForLinkedIssues,
} from '../utils/aiIntegrationIssues'
import { markdownRemarkPlugins } from '../utils/markdown'

interface Props {
  disease: string
  articleContent: string
  parsedArticle?: ParsedArticle | null
  sectionAnalyses?: SectionAnalysis[]
  gapAnalysis?: GapAnalysis | null
  referenceDocs?: ReferenceDoc[]
  history: AiIntegrationRecord[]
  onAddRecord: (record: AiIntegrationRecord) => void
  onDeleteRecord: (id: string) => void
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

function linkedIssueKey(issue: AiIntegrationLinkedIssue) {
  return `${issue.source ?? 'quality_review'}:${issue.section_id}:${issue.id}`
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
  const citationGroupRe = new RegExp(CITATION_GROUP_PATTERN, 'gi')
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

export default function StepAiIntegration({
  disease, articleContent, parsedArticle, sectionAnalyses = [], gapAnalysis = null, referenceDocs = [], history, onAddRecord, onDeleteRecord,
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
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<string[]>([])
  const [expandedIssueSections, setExpandedIssueSections] = useState<Record<string, boolean>>({})

  const reviewIssueSectionOrder = useMemo(
    () => parsedArticle?.sections.map(section => section.id) ?? [],
    [parsedArticle],
  )
  const reviewIssues = useMemo(
    () => collectAiIntegrationLinkedIssues(sectionAnalyses, { sectionOrder: reviewIssueSectionOrder }),
    [sectionAnalyses, reviewIssueSectionOrder],
  )
  const needsIssues = useMemo(
    () => collectNeedsAnalysisLinkedIssues(gapAnalysis),
    [gapAnalysis],
  )
  const allLinkedIssues = useMemo(
    () => [...reviewIssues, ...needsIssues],
    [reviewIssues, needsIssues],
  )

  useEffect(() => {
    setSelectedRefs(referenceDocs.map(doc => doc.filename))
    setPriorityRefs(prev => prev.filter(name => referenceDocs.some(doc => doc.filename === name)))
  }, [referenceDocs])

  useEffect(() => {
    setSelectedIssueKeys(prev => {
      const validKeys = new Set(allLinkedIssues.map(linkedIssueKey))
      const next = prev.filter(key => validKeys.has(key))
      return next.length === prev.length ? prev : next
    })
  }, [allLinkedIssues])

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
  const selectedIssueKeySet = useMemo(() => new Set(selectedIssueKeys), [selectedIssueKeys])
  const selectedLinkedIssues = useMemo(
    () => allLinkedIssues.filter(issue => selectedIssueKeySet.has(linkedIssueKey(issue))),
    [allLinkedIssues, selectedIssueKeySet],
  )
  const selectedReviewIssues = useMemo(
    () => reviewIssues.filter(issue => selectedIssueKeySet.has(linkedIssueKey(issue))),
    [reviewIssues, selectedIssueKeySet],
  )
  const selectedNeedsIssues = useMemo(
    () => needsIssues.filter(issue => selectedIssueKeySet.has(linkedIssueKey(issue))),
    [needsIssues, selectedIssueKeySet],
  )
  const reviewIssuesBySection = useMemo(() => {
    const groups = new Map<string, { heading: string; issues: AiIntegrationLinkedIssue[] }>()
    for (const issue of reviewIssues) {
      const key = `quality_review:${issue.section_id}`
      const group = groups.get(key) ?? { heading: issue.section_heading, issues: [] }
      group.issues.push(issue)
      groups.set(key, group)
    }
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }))
  }, [reviewIssues])
  const needsIssuesBySection = useMemo(() => {
    const groups = new Map<string, { heading: string; issues: AiIntegrationLinkedIssue[] }>()
    for (const issue of needsIssues) {
      const key = `user_needs:${issue.section_id}`
      const group = groups.get(key) ?? { heading: issue.section_heading, issues: [] }
      group.issues.push(issue)
      groups.set(key, group)
    }
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }))
  }, [needsIssues])
  const activeRecord = activeId ? history.find(r => r.id === activeId) ?? null : null
  const activeRecordSelectedRefSet = useMemo(
    () => new Set(activeRecord?.selectedReferences ?? []),
    [activeRecord?.selectedReferences],
  )
  const referenceAnchors = useMemo(() => {
    if (!activeRecord) return []
    const currentOriginalContent = activeRecord.originalScope === 'none'
      ? ''
      : activeRecord.originalScope === 'sections'
        ? buildSectionContent(parsedArticle, activeRecord.selectedSectionIds ?? [])
        : articleContent
    const originalContentSources = activeRecord.originalScope === 'none'
      ? []
      : [
        activeRecord.originalContentSnapshot ?? '',
        currentOriginalContent,
        articleContent,
      ]
    const selectedSourceIds = new Set<number>()
    referenceDocs.forEach((doc, index) => {
      if (activeRecordSelectedRefSet.has(doc.filename)) selectedSourceIds.add(index + 1)
    })
    const sourceAnchors = buildSourceAnchors(referenceDocs, activeRecordSelectedRefSet, activeRecord.answer)
    const internalAnchors = buildReferenceAnchorsFromDocs(referenceDocs)
      .filter(anchor => selectedSourceIds.has(anchor.source_id))
    const originalAnchors = buildOriginalContentAnchorsFromSources(...originalContentSources)
    const mergedAnchors = mergeReferenceAnchors(
      originalAnchors,
      activeRecord.referenceAnchors ?? [],
    )
    return mergeReferenceAnchors(
      mergedAnchors,
      buildFallbackOriginalCitationAnchors(activeRecord.answer, mergedAnchors),
      sourceAnchors,
      internalAnchors,
    )
  }, [activeRecord, activeRecordSelectedRefSet, articleContent, parsedArticle, referenceDocs])
  const citationKeySet = useMemo(
    () => new Set(referenceAnchors.map(anchor => anchor.anchor_key ?? anchor.citation_key)),
    [referenceAnchors],
  )
  const activeCitation = referenceAnchors.find(anchor => (anchor.anchor_key ?? anchor.citation_key) === activeCitationKey) ?? null
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
  const activeDisplayText = getAiIntegrationDisplayText(activeRecord)
  const renderedAnswer = useMemo(
    () => activeRecord ? linkifyCitationMarkers(activeDisplayText, resolveCitation) : '',
    [activeDisplayText, activeRecord, resolveCitation],
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

  const toggleReviewIssue = (issue: AiIntegrationLinkedIssue) => {
    const key = linkedIssueKey(issue)
    setSelectedIssueKeys(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key])
  }

  const clearLinkedIssues = () => {
    setSelectedIssueKeys([])
  }

  const toggleIssueSection = (key: string) => {
    setExpandedIssueSections(prev => ({ ...prev, [key]: !(prev[key] ?? true) }))
  }

  const isIssueSectionExpanded = (key: string) => expandedIssueSections[key] ?? false

  const generateRequestFromIssues = (
    issues: AiIntegrationLinkedIssue[],
    sourceLabel: string,
    emptyMessage: string,
  ) => {
    if (issues.length === 0) {
      setError(emptyMessage)
      return
    }
    setUserRequest(buildAiIntegrationIssueRequest(issues, { sourceLabel }))
    const nextSectionIds = sectionIdsForLinkedIssues(issues)
    if (parsedArticle && nextSectionIds.length > 0) {
      setOriginalScope('sections')
      setSelectedSectionIds(nextSectionIds)
    }
    setError('')
  }

  const deleteRecord = (id: string) => {
    const nextActiveId = getNextAiIntegrationActiveId(history, id, activeId)
    onDeleteRecord(id)
    setActiveId(nextActiveId)
  }

  const toggleRecord = (id: string) => {
    setActiveId(prev => prev === id ? null : id)
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
        revisionText: data.revision_text || '',
        changeSummary: Array.isArray(data.change_summary) ? data.change_summary : [],
        referencesUsed: data.references_used || [],
        referenceAnchors: data.reference_anchors || [],
        selectedReferences: selectedRefs,
        priorityReferences: priorityRefs,
        linkedIssues: selectedLinkedIssues,
        originalScope,
        selectedSectionIds,
        originalContentSnapshot: originalContent,
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

      {reviewIssues.length > 0 && (
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>fact_check</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--m3-on-surface)' }}>质量评审问题</span>
            <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
              已选 {selectedReviewIssues.length} 个
            </span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" style={{ padding: '3px 10px', fontSize: 12, color: 'var(--gray-500)' }} onClick={clearLinkedIssues}>清空</button>
              <button className="btn-m3-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => generateRequestFromIssues(selectedReviewIssues, '内容质量评审问题', '请选择要带入 AI 整合的质量评审问题')}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_fix_high</span>
                生成整合要求
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...getLinkedIssuePanelLayout(reviewIssues.length).outer }}>
            {reviewIssuesBySection.map(({ key: groupKey, heading, issues }) => {
              const expanded = isIssueSectionExpanded(groupKey)
              const layout = getLinkedIssuePanelLayout(issues.length)
              const groupIssueKeys = issues.map(linkedIssueKey)
              const selectedInGroup = groupIssueKeys.filter(key => selectedIssueKeySet.has(key)).length
              return (
              <div key={groupKey} style={{ border: '0.5px solid var(--dui-divider)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => toggleIssueSection(groupKey)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '7px 10px',
                    background: 'var(--m3-surface-container-low)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--m3-on-surface-variant)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>chevron_right</span>
                    <span style={{ fontWeight: 600, color: 'var(--m3-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{heading}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, color: 'var(--m3-on-surface-variant)' }}>
                    <span>{issues.length} 个问题</span>
                    {selectedInGroup > 0 && <span style={{ color: 'var(--m3-primary)' }}>已选 {selectedInGroup}</span>}
                  </span>
                </button>
                {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, ...layout.inner }}>
                  {issues.map(issue => {
                    const key = linkedIssueKey(issue)
                    const checked = selectedIssueKeySet.has(key)
                    const severityColor = issue.severity === 'high' ? 'var(--dui-danger)' : issue.severity === 'medium' ? 'var(--dui-warning)' : 'var(--dui-primary)'
                    return (
                      <label
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '8px 10px',
                          borderTop: '0.5px solid var(--dui-divider)',
                          cursor: 'pointer',
                          background: checked ? 'var(--dui-primary-container)' : '#fff',
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReviewIssue(issue)}
                          style={{ marginTop: 3, flexShrink: 0 }}
                        />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ color: severityColor, fontWeight: 600 }}>{issueSeverityLabel(issue.severity)}优先</span>
                            <span style={{ color: 'var(--m3-on-surface-variant)' }}>{issueTypeLabel(issue.issue_type)}</span>
                          </span>
                          <span style={{ display: 'block', color: 'var(--m3-on-surface)', lineHeight: 1.65, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {issue.description}
                          </span>
                          {issue.reviewer_note && (
                            <span style={{ display: 'block', marginTop: 3, color: 'var(--m3-primary)', lineHeight: 1.5 }}>
                              备注：{issue.reviewer_note}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      )}

      {needsIssues.length > 0 && (
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>groups</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--m3-on-surface)' }}>用户需求问题</span>
            <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
              已选 {selectedNeedsIssues.length} 个
            </span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" style={{ padding: '3px 10px', fontSize: 12, color: 'var(--gray-500)' }} onClick={clearLinkedIssues}>清空</button>
              <button className="btn-m3-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => generateRequestFromIssues(selectedNeedsIssues, '用户需求分析问题', '请选择要带入 AI 整合的用户需求问题')}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_fix_high</span>
                生成整合要求
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...getLinkedIssuePanelLayout(needsIssues.length).outer }}>
            {needsIssuesBySection.map(({ key: groupKey, heading, issues }) => {
              const expanded = isIssueSectionExpanded(groupKey)
              const layout = getLinkedIssuePanelLayout(issues.length)
              const groupIssueKeys = issues.map(linkedIssueKey)
              const selectedInGroup = groupIssueKeys.filter(key => selectedIssueKeySet.has(key)).length
              return (
              <div key={groupKey} style={{ border: '0.5px solid var(--dui-divider)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => toggleIssueSection(groupKey)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '7px 10px',
                    background: 'var(--m3-surface-container-low)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--m3-on-surface-variant)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>chevron_right</span>
                    <span style={{ fontWeight: 600, color: 'var(--m3-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{heading}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, color: 'var(--m3-on-surface-variant)' }}>
                    <span>{issues.length} 个问题</span>
                    {selectedInGroup > 0 && <span style={{ color: 'var(--m3-primary)' }}>已选 {selectedInGroup}</span>}
                  </span>
                </button>
                {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, ...layout.inner }}>
                  {issues.map(issue => {
                    const key = linkedIssueKey(issue)
                    const checked = selectedIssueKeySet.has(key)
                    const severityColor = issue.severity === 'high' ? 'var(--dui-danger)' : issue.severity === 'medium' ? 'var(--dui-warning)' : 'var(--dui-primary)'
                    return (
                      <label
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '8px 10px',
                          borderTop: '0.5px solid var(--dui-divider)',
                          cursor: 'pointer',
                          background: checked ? 'var(--dui-primary-container)' : '#fff',
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReviewIssue(issue)}
                          style={{ marginTop: 3, flexShrink: 0 }}
                        />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                            <span style={{ color: severityColor, fontWeight: 600 }}>{issueSeverityLabel(issue.severity)}优先</span>
                            <span style={{ color: 'var(--m3-on-surface-variant)' }}>{issueTypeLabel(issue.issue_type)}</span>
                            {issue.qa_frequency != null && (
                              <span style={{ color: 'var(--m3-on-surface-variant)' }}>{issue.qa_frequency} 次提问</span>
                            )}
                          </span>
                          <span style={{ display: 'block', color: 'var(--m3-on-surface)', lineHeight: 1.65, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {issue.description}
                          </span>
                          {(issue.examples ?? []).length > 0 && (
                            <span style={{ display: 'block', marginTop: 3, color: 'var(--m3-on-surface-variant)', lineHeight: 1.5 }}>
                              示例：{issue.examples.slice(0, 2).join('；')}
                            </span>
                          )}
                          {issue.reviewer_note && (
                            <span style={{ display: 'block', marginTop: 3, color: 'var(--m3-primary)', lineHeight: 1.5 }}>
                              备注：{issue.reviewer_note}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      )}

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
          {originalScope === 'sections' && parsedArticle && (
            <button
              type="button"
              className="btn-m3-outline"
              onClick={() => setSelectedSectionIds([])}
              disabled={selectedSectionIds.length === 0}
              style={{
                fontSize: 12,
                padding: '5px 12px',
                color: selectedSectionIds.length > 0 ? 'var(--gray-500)' : 'var(--gray-400)',
                cursor: selectedSectionIds.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              全部取消
            </button>
          )}
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

      {history.length > 0 && (
        <div className="section-card">
          <div className="ai-history-section-header">
            <div>
              <div className="ai-history-title">问答记录</div>
              <div className="ai-history-subtitle">{history.length} 条记录，点击问题展开查看回答</div>
            </div>
          </div>

          <div className="ai-history-list">
            {[...history].reverse().map(record => {
              const expanded = activeRecord?.id === record.id
              return (
                <article key={record.id} className={`ai-history-item${expanded ? ' expanded' : ''}`}>
                  <div className="ai-history-item-header">
                    <button
                      type="button"
                      className="ai-history-question"
                      onClick={() => toggleRecord(record.id)}
                      aria-expanded={expanded}
                    >
                      <span className="material-symbols-outlined ai-history-chevron" style={{ fontSize: 18 }}>
                        {expanded ? 'expand_less' : 'expand_more'}
                      </span>
                      <span className="ai-history-question-text">{record.request}</span>
                    </button>
                    <div className="ai-history-actions">
                      <span className="ai-history-meta">{formatTime(record.createdAt)}</span>
                      <button
                        type="button"
                        className="btn-m3-icon ai-history-delete"
                        onClick={() => deleteRecord(record.id)}
                        aria-label="删除问答记录"
                        title="删除问答记录"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="ai-history-answer">
                      {(record.linkedIssues?.length ?? 0) > 0 && (
                        <div style={{
                          marginBottom: 12,
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'var(--m3-surface-container-low)',
                          border: '0.5px solid var(--dui-divider)',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
                            关联问题 {record.linkedIssues?.length ?? 0} 个
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {record.linkedIssues?.map(issue => (
                              <div key={linkedIssueKey(issue)} style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', lineHeight: 1.55 }}>
                                <span style={{ fontWeight: 600, color: 'var(--m3-on-surface)' }}>{issue.section_heading}</span>
                                <span style={{ margin: '0 6px', color: 'var(--gray-400)' }}>·</span>
                                <span>{issueSeverityLabel(issue.severity)}优先</span>
                                <span style={{ margin: '0 6px', color: 'var(--gray-400)' }}>·</span>
                                <span>{issueTypeLabel(issue.issue_type)}</span>
                                <span style={{ margin: '0 6px', color: 'var(--gray-400)' }}>·</span>
                                <span>{issue.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className={`draft-preview-shell${activeCitation ? ' has-citation-panel' : ''}`}>
                        <div className="diff-content md draft-preview-content" style={{ maxHeight: 'none', minHeight: 160 }}>
                          <ReactMarkdown remarkPlugins={markdownRemarkPlugins} components={markdownComponents}>
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
                      {record.referencesUsed.length > 0 && (
                        <div className="ai-history-reference-list">
                          {record.referencesUsed.map((ref, index) => (
                            <span key={`${ref}-${index}`} className="ai-history-reference">
                              {ref}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
