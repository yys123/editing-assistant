import React, { useState, useEffect, useMemo } from 'react'
import { ArticleSection, ParsedArticle, SectionAnalysis, SectionIssue, ReferenceDoc, StandardsOverride } from '../types'
import { apiFetch } from '../api'

interface Props {
  disease: string
  parsedArticle: ParsedArticle
  sectionAnalyses: SectionAnalysis[]
  setSectionAnalyses: (analyses: SectionAnalysis[]) => void
  referenceDocs: ReferenceDoc[]
  standardsOverride: StandardsOverride
}

// Summary/overview sections that should NOT be analyzed as independent chapters.
// Their content is merged as contextual background into the adjacent real section.
const SUMMARY_HEADINGS = ['更新要点', '诊断要点', '治疗要点']
export function isSummarySection(heading: string): boolean {
  return SUMMARY_HEADINGS.some(p => heading.includes(p))
}

interface AnalysisGroup {
  representative: ArticleSection
  childSections: ArticleSection[]
  combinedContent: string
}

function buildAnalysisGroups(sections: ArticleSection[]): AnalysisGroup[] {
  const groups: AnalysisGroup[] = []
  let currentGroup: AnalysisGroup | null = null
  // Buffer for summary content that appears before any real group has been created
  let pendingSummary = ''

  for (const section of sections) {
    if (isSummarySection(section.heading)) {
      // Editorial summaries — excluded from quality review entirely
      continue
    }

    if (section.level === 1) {
      const baseContent = (pendingSummary ? pendingSummary + '\n\n' : '') + section.content
      pendingSummary = ''
      currentGroup = {
        representative: section,
        childSections: [],
        combinedContent: baseContent,
      }
      groups.push(currentGroup)
    } else {
      if (currentGroup) {
        currentGroup.childSections.push(section)
        const prefix = section.level === 2 ? '##' : '###'
        currentGroup.combinedContent += `\n\n${prefix} ${section.heading}`
        if (section.content.trim()) {
          currentGroup.combinedContent += `\n${section.content}`
        }
      } else {
        // Orphan non-level-1 section with no parent — create a group for it
        currentGroup = {
          representative: section,
          childSections: [],
          combinedContent: (pendingSummary ? pendingSummary + '\n\n' : '') + section.content,
        }
        pendingSummary = ''
        groups.push(currentGroup)
      }
    }
  }

  return groups
}

// === 4-dimension scoring system ===

// D1=内容全面 D2=内容准确 D3=结构合理 D4=内容精炼流畅
const DIM_CONFIG: Record<number, { label: string; hasKeyContent: boolean }> = {
  1: { label: '内容全面', hasKeyContent: true },
  2: { label: '内容准确', hasKeyContent: true },
  3: { label: '结构合理', hasKeyContent: false },
  4: { label: '内容精炼流畅', hasKeyContent: false },
}

const TYPE_TO_DIM: Record<string, number> = {
  missing_content: 1,
  accuracy: 2,
  outdated: 2,
  structure: 3,
  style: 4,
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  missing_content: '内容缺失',
  structure: '结构问题',
  accuracy: '内容不准确',
  outdated: '内容陈旧',
  style: '语言/格式',
}

interface DimStat {
  issues: number
  keyDeduction: number
  totalDeduction: number
}

function computeDimStats(sectionAnalyses: SectionAnalysis[]): Record<number, DimStat> {
  const stats: Record<number, DimStat> = {
    1: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
    2: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
    3: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
    4: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
  }
  for (const sa of sectionAnalyses) {
    for (const issue of sa.issues) {
      if (issue.status === 'rejected') continue
      const dim = TYPE_TO_DIM[issue.issue_type] ?? 1
      const deduction = issue.deduction_score ?? 1
      stats[dim].issues++
      stats[dim].totalDeduction += deduction
      if (dim === 1 && issue.is_key_content) stats[dim].keyDeduction += deduction
      if (dim === 2 && issue.severity === 'high') stats[dim].keyDeduction += deduction
    }
  }
  return stats
}

type Rating = 'excellent' | 'pass' | 'fail'

function getDimRating(dim: number, stat: DimStat, totalWords: number): Rating {
  const per10k = (v: number) => totalWords > 0 ? (v / totalWords) * 10000 : v
  const keyPer = per10k(stat.keyDeduction)
  const totalPer = per10k(stat.totalDeduction)

  // D1 内容全面 & D2 内容准确: both have key-content sub-scoring
  if (dim === 1 || dim === 2) {
    if (keyPer < 4 || totalPer < 8) return 'excellent'
    if (keyPer < 8 || totalPer < 15) return 'pass'
    return 'fail'
  }
  // D3 结构合理: total only, stricter excellent threshold
  if (dim === 3) {
    if (totalPer < 5) return 'excellent'
    if (totalPer < 15) return 'pass'
    return 'fail'
  }
  // D4 精炼流畅
  if (totalPer < 10) return 'excellent'
  if (totalPer < 20) return 'pass'
  return 'fail'
}

const RATING_CONFIG: Record<Rating, { label: string; color: string; bg: string }> = {
  excellent: { label: '优秀', color: 'var(--green)', bg: 'var(--green-light)' },
  pass: { label: '合格', color: 'var(--blue)', bg: 'var(--blue-light)' },
  fail: { label: '待改进', color: 'var(--orange)', bg: 'var(--orange-light)' },
}

export default function StepSectionAnalysis({
  disease, parsedArticle, sectionAnalyses, setSectionAnalyses,
  referenceDocs, standardsOverride
}: Props) {
  // Per-section loading/error state; analysing=true means in-flight
  const [analysing, setAnalysing] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Accumulates results as parallel analyses complete
  const resultsRef = React.useRef<SectionAnalysis[]>([])

  // Manual review state
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const updateIssue = (sectionId: string, issueId: string, changes: Partial<SectionIssue>) => {
    setSectionAnalyses(sectionAnalyses.map((sa: SectionAnalysis) =>
      sa.section_id !== sectionId ? sa : {
        ...sa,
        issues: sa.issues.map((i: SectionIssue) => i.id !== issueId ? i : { ...i, ...changes }),
      }
    ))
  }

  const referenceTexts = referenceDocs.map(d => d.text)
  const groups = useMemo(() => buildAnalysisGroups(parsedArticle.sections), [parsedArticle.sections])

  const analyzeGroup = async (group: AnalysisGroup): Promise<SectionAnalysis> => {
    const mergedSection: ArticleSection = {
      ...group.representative,
      content: group.combinedContent,
      word_count: group.combinedContent.length,
    }
    const res = await apiFetch('/api/analyze/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disease,
        section: mergedSection,
        article_outline: parsedArticle.sections
          .filter(s => s.level === 1 && !isSummarySection(s.heading))
          .map(s => s.heading),
        quality_standard_text: standardsOverride.qualityText ?? null,
        content_spec_text: standardsOverride.specText ?? null,
        reference_texts: referenceTexts,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || '分析失败')
    return data as SectionAnalysis
  }

  const runAll = async () => {
    // Mark all as analysing and clear previous results
    const allAnalysing: Record<string, boolean> = {}
    groups.forEach(g => { allAnalysing[g.representative.id] = true })
    setAnalysing(allAnalysing)
    setErrors({})
    setSectionAnalyses([])

    // Analyze each section independently so results appear progressively
    resultsRef.current = []
    await Promise.all(
      groups.map(async group => {
        const id = group.representative.id
        try {
          const result = await analyzeGroup(group)
          resultsRef.current = [...resultsRef.current.filter(a => a.section_id !== id), result]
          setSectionAnalyses([...resultsRef.current])
        } catch (e: any) {
          setErrors(prev => ({ ...prev, [id]: e.message }))
          const placeholder: SectionAnalysis = { section_id: id, section_heading: group.representative.heading, issues: [] }
          resultsRef.current = [...resultsRef.current.filter(a => a.section_id !== id), placeholder]
          setSectionAnalyses([...resultsRef.current])
        } finally {
          setAnalysing(prev => { const n = { ...prev }; delete n[id]; return n })
        }
      })
    )
  }

  const retryGroup = async (groupId: string) => {
    const group = groups.find(g => g.representative.id === groupId)
    if (!group) return
    setErrors(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setAnalysing(prev => ({ ...prev, [groupId]: true }))
    try {
      const result = await analyzeGroup(group)
      setSectionAnalyses(sectionAnalyses.map(a => a.section_id === groupId ? result : a))
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [groupId]: e.message }))
    } finally {
      setAnalysing(prev => { const n = { ...prev }; delete n[groupId]; return n })
    }
  }

  useEffect(() => {
    if (sectionAnalyses.length === 0) runAll()
  }, [])

  const anyAnalysing = Object.keys(analysing).length > 0
  const doneCount = groups.length - Object.keys(analysing).length
  const totalIssues = sectionAnalyses.reduce((acc, a) => acc + a.issues.filter(i => i.status !== 'rejected').length, 0)
  const failedCount = Object.keys(errors).length

  const dimStats = computeDimStats(sectionAnalyses)

  const overallRating: Rating | null = useMemo(() => {
    if (sectionAnalyses.length === 0) return null
    const ratings = [1, 2, 3, 4].map(d => getDimRating(d, dimStats[d], parsedArticle.total_words))
    if (ratings.every(r => r === 'excellent')) return 'excellent'
    if (ratings.every(r => r !== 'fail')) return 'pass'
    return 'fail'
  }, [dimStats, sectionAnalyses, parsedArticle.total_words])

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          内容质量审评
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          AI 逐章节审核内容质量，识别问题并给出改进建议
        </p>
      </div>

      {/* Control bar */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {anyAnalysing ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)' }}>正在并行分析…</span>
              <span style={{ color: 'var(--m3-on-surface-variant)', fontSize: 13 }}>
                {doneCount} / {groups.length} 个章节组完成
              </span>
            </>
          ) : (
            <>
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)' }}>内容质量审评完成</span>
              <span style={{ color: 'var(--m3-tertiary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 4 }}>check_circle</span>
                {groups.length} 个章节组已分析
              </span>
            </>
          )}
          {totalIssues > 0 && <span style={{ color: 'var(--dui-warning)' }}>共发现 {totalIssues} 个问题</span>}
          {failedCount > 0 && <span style={{ color: 'var(--m3-error)' }}>{failedCount} 个章节失败</span>}
          <button className="btn-m3-outline" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 14px' }} onClick={runAll}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            重新分析全部
          </button>
        </div>
      </div>

      {/* Section detail */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)' }}>
        章节详情
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {groups.map((group, i) => {
          const analysis = sectionAnalyses.find(a => a.section_id === group.representative.id)
          const hasError = !!errors[group.representative.id]
          const allIssues = analysis?.issues ?? []
          const issues = allIssues.filter(issue => issue.status !== 'rejected')
          const totalChars = group.combinedContent.length
          const childCount = group.childSections.length

          const isAnalysing = !!analysing[group.representative.id]
          const headerBg = isAnalysing ? 'var(--gray-50)' : issues.length > 0 ? 'var(--orange-light)' : 'var(--gray-50)'
          const borderColor = hasError ? 'var(--dui-danger)' : issues.length > 0 ? 'var(--dui-warning)' : 'var(--dui-divider)'

          // Always show split view (original content always visible);
          // right panel shows spinner while analysing, issues when done
          const showSplit = isAnalysing || allIssues.length > 0 || hasError

          return (
            <div key={group.representative.id} style={{
              border: `0.5px solid ${borderColor}`,
              borderRadius: 'var(--dui-radius-card)',
              background: hasError ? 'var(--dui-danger-container)' : 'var(--dui-surface)',
              overflow: 'hidden',
            }}>
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: headerBg,
                borderBottom: showSplit ? '1px solid var(--gray-200)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--gray-400)', minWidth: 20 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{group.representative.heading}</span>
                  {childCount > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>
                      含 {group.childSections.map(s => s.heading).slice(0, 3).join('、')}
                      {childCount > 3 ? ` 等 ${childCount} 个子章节` : ` 共 ${childCount} 个子章节`}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{totalChars} 字</span>
                {isAnalysing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>分析中…</span>
                  </div>
                )}
                {!isAnalysing && !hasError && (
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: issues.length > 0 ? 'var(--orange)' : 'var(--green)',
                  }}>
                    {issues.length > 0 ? `${issues.length} 个问题` : '✓ 无问题'}
                  </span>
                )}
                {hasError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--red)' }}>分析失败</span>
                    <button
                      className="btn btn-sm"
                      style={{ padding: '2px 8px', color: 'var(--blue)' }}
                      onClick={() => retryGroup(group.representative.id)}
                    >重试</button>
                  </div>
                )}
              </div>

              {/* Split view: always shown so original content is visible */}
              {showSplit && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
                  {/* Left: original content */}
                  <div style={{
                    borderRight: '0.5px solid var(--dui-divider)',
                    display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 500,
                      color: 'var(--gray-500)', background: 'var(--gray-50)',
                      borderBottom: '0.5px solid var(--dui-divider)',
                    }}>
                      原文内容
                    </div>
                    <div style={{
                      padding: '10px 12px',
                      maxHeight: 400, overflowY: 'auto',
                      fontSize: 12, lineHeight: 1.9, color: 'var(--gray-700)',
                    }}>
                      {group.combinedContent.split('\n').map((line, li) => {
                        if (line.startsWith('### ')) return (
                          <div key={li} style={{ fontWeight: 500, color: 'var(--gray-800)', margin: '8px 0 2px', fontSize: 12 }}>
                            {line.slice(4)}
                          </div>
                        )
                        if (line.startsWith('## ')) return (
                          <div key={li} style={{ fontWeight: 500, color: 'var(--gray-900)', margin: '10px 0 3px', fontSize: 13, borderBottom: '0.5px solid var(--dui-divider)', paddingBottom: 2 }}>
                            {line.slice(3)}
                          </div>
                        )
                        if (!line.trim()) return <div key={li} style={{ height: 6 }} />
                        return <div key={li} style={{ marginBottom: 2 }}>{line}</div>
                      })}
                    </div>
                  </div>

                  {/* Right: issues or per-section loading state */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 500,
                      color: isAnalysing ? 'var(--gray-400)' : hasError ? 'var(--red)' : issues.length > 0 ? 'var(--orange)' : 'var(--green)',
                      background: 'var(--gray-50)',
                      borderBottom: '0.5px solid var(--dui-divider)',
                    }}>
                      {isAnalysing ? '分析中…' : hasError ? '分析失败' : issues.length > 0 ? `发现问题（${issues.length} 项）` : '✓ 无问题'}
                    </div>

                    {isAnalysing && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: 10, color: 'var(--gray-400)', fontSize: 13 }}>
                        <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                        AI 正在审核此章节…
                      </div>
                    )}

                    {hasError && (
                      <div style={{ fontSize: 12, color: 'var(--red)', padding: '12px 14px' }}>
                        {errors[group.representative.id]}
                      </div>
                    )}

                    {!isAnalysing && !hasError && issues.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', padding: '16px 14px' }}>
                        本章节未发现问题
                      </div>
                    )}

                    {!isAnalysing && allIssues.length > 0 && (
                      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {allIssues.map((issue, j) => {
                          const dim = TYPE_TO_DIM[issue.issue_type] ?? 1
                          const sevColor = issue.severity === 'high' ? 'var(--red)' : issue.severity === 'medium' ? 'var(--orange)' : 'var(--blue)'
                          const sevBg = issue.severity === 'high' ? 'var(--red-light)' : issue.severity === 'medium' ? 'var(--orange-light)' : 'var(--blue-light)'
                          const isRejected = issue.status === 'rejected'
                          const isConfirmed = issue.status === 'confirmed'
                          const isExpanded = expandedId === issue.id
                          return (
                            <div key={j} style={{
                              background: isRejected ? 'var(--gray-50)' : 'white',
                              border: isRejected
                                ? '1px solid var(--gray-200)'
                                : isConfirmed
                                  ? '1px solid var(--green)'
                                  : `0.5px solid ${issue.severity === 'high' ? 'var(--dui-danger)' : issue.severity === 'medium' ? 'var(--dui-warning)' : 'var(--dui-primary)'}`,
                              borderRadius: 6, padding: '8px 10px',
                              opacity: isRejected ? 0.5 : 1,
                            }}>
                              {/* Tags + actions row */}
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: isRejected ? 'var(--gray-100)' : sevBg, color: isRejected ? 'var(--gray-400)' : sevColor }}>
                                  {issue.severity === 'high' ? '高优先' : issue.severity === 'medium' ? '中优先' : '低优先'}
                                </span>
                                <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: 'var(--gray-200)', color: 'var(--gray-600)' }}>
                                  {ISSUE_TYPE_LABELS[issue.issue_type] ?? issue.issue_type}
                                </span>
                                <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                                  D{dim} {DIM_CONFIG[dim].label}
                                </span>
                                {(dim === 1) && (
                                  <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: issue.is_key_content ? 'var(--dui-warning-container)' : 'var(--dui-surface-soft)', color: issue.is_key_content ? 'var(--dui-warning)' : 'var(--dui-text-sub)' }}>
                                    {issue.is_key_content ? '重点内容' : '非重点内容'}
                                  </span>
                                )}
                                {(dim === 2) && (
                                  <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: issue.severity === 'high' ? 'var(--dui-warning-container)' : 'var(--dui-surface-soft)', color: issue.severity === 'high' ? 'var(--dui-warning)' : 'var(--dui-text-sub)' }}>
                                    {issue.severity === 'high' ? '重点内容' : '非重点内容'}
                                  </span>
                                )}
                                {(issue.deduction_score ?? 0) > 0 && (
                                  <span style={{ fontSize: 12, fontWeight: 500, color: isRejected ? 'var(--gray-400)' : 'var(--red)', marginLeft: 'auto' }}>
                                    -{issue.deduction_score}分
                                  </span>
                                )}
                                {/* Action buttons */}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                  {isConfirmed && (
                                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green)', padding: '1px 6px' }}>✓ 已确认</span>
                                  )}
                                  {!isRejected && !isConfirmed && (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--green-light)', color: 'var(--green)' }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'confirmed' })}>
                                      ✓ 确认
                                    </button>
                                  )}
                                  {isConfirmed && (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12 }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'ai' })}>
                                      撤销
                                    </button>
                                  )}
                                  {!isRejected ? (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--red-light)', color: 'var(--red)' }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'rejected' })}>
                                      ✕ 排除
                                    </button>
                                  ) : (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--gray-100)', color: 'var(--gray-500)' }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'ai' })}>
                                      恢复
                                    </button>
                                  )}
                                  <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, color: 'var(--blue)' }}
                                    onClick={() => setExpandedId(isExpanded ? null : issue.id)}>
                                    {isExpanded ? '收起' : '编辑'}
                                  </button>
                                </div>
                              </div>
                              {/* Description — editable when expanded, read-only otherwise */}
                              {isExpanded ? (
                                <textarea
                                  className="textarea"
                                  value={issue.description}
                                  onChange={e => updateIssue(group.representative.id, issue.id, { description: e.target.value })}
                                  style={{ minHeight: 56, fontSize: 12, marginTop: 2, marginBottom: 4 }}
                                  autoFocus
                                />
                              ) : (
                                <div style={{ fontSize: 12, color: isRejected ? 'var(--gray-400)' : 'var(--gray-800)', lineHeight: 1.7,
                                  textDecoration: isRejected ? 'line-through' : 'none' }}>
                                  {issue.description}
                                </div>
                              )}
                              {/* Examples */}
                              {!isExpanded && issue.examples && issue.examples.length > 0 && (
                                <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {issue.examples.map((ex, ei) => (
                                    <div key={ei} style={{
                                      fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.6,
                                      background: 'var(--gray-50)', borderRadius: 3, padding: '3px 7px',
                                      borderLeft: `2px solid ${isRejected ? 'var(--gray-300)' : sevColor}`,
                                    }}>
                                      {ex}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!isAnalysing && analysis?.verification_summary && (
                      <div style={{
                        margin: '0 10px 8px',
                        padding: '6px 10px',
                        background: 'var(--blue-light)',
                        borderRadius: 4,
                        fontSize: 12,
                        color: 'var(--gray-600)',
                        lineHeight: 1.7,
                        borderLeft: '3px solid var(--dui-primary)',
                      }}>
                        <span style={{ fontWeight: 500, color: 'var(--blue)' }}>二次核验：</span>
                        {analysis.verification_summary}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quality Verdict Panel */}
      {(() => {
        const p10k = (v: number) =>
          parsedArticle.total_words > 0 ? v / parsedArticle.total_words * 10000 : v

        const keyPer = (dim: number) => p10k(dimStats[dim].keyDeduction)
        const totPer = (dim: number) => p10k(dimStats[dim].totalDeduction)

        const fmtN = (v: number) => v > 0 ? `${v.toFixed(1)}分` : '—'
        const numVal = (v: number | null) => v !== null
          ? <span style={{ fontFamily: 'monospace', color: v > 0 ? 'var(--orange)' : 'var(--gray-400)' }}>{fmtN(v)}</span>
          : <span style={{ color: 'var(--gray-200)' }}>—</span>

        const d1Excel = keyPer(1) < 4 || totPer(1) < 8
        const d1Pass  = keyPer(1) < 8 || totPer(1) < 15
        const d2Excel = keyPer(2) < 4 || totPer(2) < 8
        const d2Pass  = keyPer(2) < 8 || totPer(2) < 15

        // Per-dimension data.
        // D1 内容全面 & D2 内容准确: twoRow (key + total)
        // D3 结构合理 & D4 精炼流畅: single row (total only)
        const dimGroups = [
          {
            dim: 1, twoRow: true,
            criterion1: ['重点扣分 < 4分/万字（优秀）', '重点扣分 < 8分/万字（合格）'],
            criterion2: ['累积扣分 < 8分/万字（优秀）', '累积扣分 < 15分/万字（合格）'],
            keyPerVal: keyPer(1), totPerVal: totPer(1),
            excellentPass: d1Excel, passingPass: d1Pass,
          },
          {
            dim: 2, twoRow: true,
            criterion1: ['重点扣分 < 4分/万字（优秀）', '重点扣分 < 8分/万字（合格）'],
            criterion2: ['累积扣分 < 8分/万字（优秀）', '累积扣分 < 15分/万字（合格）'],
            keyPerVal: keyPer(2), totPerVal: totPer(2),
            excellentPass: d2Excel, passingPass: d2Pass,
          },
          {
            dim: 3, twoRow: false,
            criterion1: ['累积扣分 < 5分/万字（优秀）', '累积扣分 < 15分/万字（合格）'],
            criterion2: undefined,
            keyPerVal: null, totPerVal: totPer(3),
            excellentPass: totPer(3) < 5, passingPass: totPer(3) < 15,
          },
          {
            dim: 4, twoRow: false,
            criterion1: ['累积扣分 < 10分/万字（优秀）', '累积扣分 < 20分/万字（合格）'],
            criterion2: undefined,
            keyPerVal: null, totPerVal: totPer(4),
            excellentPass: totPer(4) < 10, passingPass: totPer(4) < 20,
          },
        ]

        const TH = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
          <th style={{
            padding: '8px 8px', fontSize: 12, fontWeight: 500, color: 'var(--gray-600)',
            background: 'var(--gray-50)', borderBottom: '0.5px solid var(--dui-divider)',
            whiteSpace: 'nowrap', textAlign: center ? 'center' : 'left',
          }}>{children}</th>
        )

        const GB = '2px solid var(--gray-200)'  // group bottom border
        const SB = '1px solid var(--gray-100)'  // sub-row separator

        return (
          <div className="section-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: -4, marginRight: 6 }}>analytics</span>
                审评结论
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  总字数：{parsedArticle.total_words.toLocaleString()} 字
                  （{(parsedArticle.total_words / 10000).toFixed(4)} 万字）
                </span>
                {overallRating && (
                  <span style={{
                    fontSize: 13, fontWeight: 500, padding: '3px 12px', borderRadius: 4,
                    background: RATING_CONFIG[overallRating].bg,
                    color: RATING_CONFIG[overallRating].color,
                  }}>
                    综合评级：{RATING_CONFIG[overallRating].label}
                  </span>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <colgroup>
                  <col style={{ width: 100 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 52 }} />
                  <col style={{ width: 52 }} />
                </colgroup>
                <thead>
                  <tr>
                    <TH>审核维度</TH>
                    <TH>判定标准</TH>
                    <TH center>重点扣分/万字</TH>
                    <TH center>累积扣分/万字</TH>
                    <TH center>优秀</TH>
                    <TH center>合格</TH>
                  </tr>
                </thead>
                <tbody>
                  {dimGroups.map(g => {
                    const rs = g.twoRow ? 2 : 1
                    // Verdict: excellent→优秀✓合格empty; pass-only→优秀empty合格✓; fail→优秀empty合格✗
                    const excellentMark = g.excellentPass
                      ? <span style={{ color: 'var(--green)', fontWeight: 500, fontSize: 16 }}>✓</span>
                      : null
                    const passingMark = g.excellentPass ? null
                      : g.passingPass
                        ? <span style={{ color: 'var(--green)', fontWeight: 500, fontSize: 16 }}>✓</span>
                        : <span style={{ color: 'var(--red)', fontWeight: 500, fontSize: 16 }}>✗</span>

                    const dimTdStyle: React.CSSProperties = {
                      padding: '8px 8px', verticalAlign: 'middle', fontSize: 12,
                      fontWeight: 500, textAlign: 'center',
                      background: 'var(--gray-50)',
                      borderRight: '0.5px solid var(--dui-divider)',
                      borderBottom: GB,
                    }
                    const numTdStyle: React.CSSProperties = {
                      padding: '8px 8px', verticalAlign: 'middle',
                      textAlign: 'center', borderBottom: GB,
                    }
                    const verdictTdStyle: React.CSSProperties = {
                      padding: '8px 8px', verticalAlign: 'middle',
                      textAlign: 'center', borderBottom: GB,
                    }

                    return (
                      <React.Fragment key={g.dim}>
                        <tr>
                          <td rowSpan={rs} style={dimTdStyle}>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 2 }}>维度{g.dim}</div>
                            {DIM_CONFIG[g.dim].label}
                          </td>
                          <td style={{
                            padding: '8px 8px', verticalAlign: 'middle',
                            borderBottom: g.twoRow ? SB : GB,
                          }}>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.8 }}>
                              {g.criterion1.map((l, j) => <div key={j}>{l}</div>)}
                            </div>
                          </td>
                          <td rowSpan={rs} style={numTdStyle}>{numVal(g.keyPerVal)}</td>
                          <td rowSpan={rs} style={numTdStyle}>{numVal(g.totPerVal)}</td>
                          <td rowSpan={rs} style={verdictTdStyle}>{excellentMark}</td>
                          <td rowSpan={rs} style={verdictTdStyle}>{passingMark}</td>
                        </tr>
                        {g.twoRow && g.criterion2 && (
                          <tr>
                            <td style={{
                              padding: '8px 8px', verticalAlign: 'middle',
                              background: 'var(--gray-50)', borderBottom: GB,
                            }}>
                              <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.8 }}>
                                {g.criterion2.map((l, j) => <div key={j}>{l}</div>)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
