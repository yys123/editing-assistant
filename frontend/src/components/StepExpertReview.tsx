import { useState } from 'react'
import { SectionAnalysis, SectionIssue, GapAnalysis, NeedCoverage } from '../types'
import IssueRow from './IssueRow'

interface Props {
  sectionAnalyses: SectionAnalysis[]
  setSectionAnalyses: (analyses: SectionAnalysis[]) => void
  gapAnalysis: GapAnalysis | null
  onNext: () => void
  onBack: () => void
}

const COVERAGE_CONFIG = {
  full:    { label: '已覆盖', color: 'var(--green)',  bg: '#f0fdf4', icon: '✓' },
  partial: { label: '需完善', color: 'var(--orange)', bg: '#fff7ed', icon: '◑' },
  missing: { label: '待补充', color: 'var(--red)',    bg: '#fff1f1', icon: '✗' },
} as const

export default function StepExpertReview({ sectionAnalyses, setSectionAnalyses, gapAnalysis, onNext, onBack }: Props) {
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Build lookups from Step 4 data
  const sectionGapMap = new Map(
    (gapAnalysis?.section_gaps ?? []).map(sg => [sg.section_id, sg])
  )
  const clusterFreqMap = new Map(
    (gapAnalysis?.clusters ?? []).map(c => [c.topic, c.frequency])
  )

  // ── Issue mutations ───────────────────────────────────────────────────────
  const updateIssue = (sectionId: string, issueId: string, changes: Partial<SectionIssue>) => {
    setSectionAnalyses(sectionAnalyses.map(sa =>
      sa.section_id !== sectionId ? sa : {
        ...sa,
        issues: sa.issues.map(i => i.id !== issueId ? i : { ...i, ...changes }),
      }
    ))
  }

  const addIssue = (sectionId: string) => {
    const newId = `added-${Date.now()}`
    const newIssue: SectionIssue = {
      id: newId, issue_type: 'missing_content', description: '',
      severity: 'medium', examples: [], reviewer_note: '', status: 'added',
    }
    setSectionAnalyses(sectionAnalyses.map(sa =>
      sa.section_id !== sectionId ? sa : { ...sa, issues: [...sa.issues, newIssue] }
    ))
    setExpandedIssueId(newId)
  }

  const removeIssue = (sectionId: string, issueId: string) => {
    setSectionAnalyses(sectionAnalyses.map(sa =>
      sa.section_id !== sectionId ? sa : {
        ...sa, issues: sa.issues.filter(i => i.id !== issueId),
      }
    ))
  }

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Global stats ─────────────────────────────────────────────────────────
  const totalQuality = sectionAnalyses.reduce((acc, sa) =>
    acc + sa.issues.filter(i => i.status !== 'rejected').length, 0)
  const totalConfirmed = sectionAnalyses.reduce((acc, sa) =>
    acc + sa.issues.filter(i => i.status === 'confirmed' || i.status === 'added').length, 0)
  const totalMissing = (gapAnalysis?.section_gaps ?? []).reduce((acc, sg) =>
    acc + (sg.need_coverages ?? []).filter(nc => nc.coverage_level === 'missing').length, 0)
  const totalPartial = (gapAnalysis?.section_gaps ?? []).reduce((acc, sg) =>
    acc + (sg.need_coverages ?? []).filter(nc => nc.coverage_level === 'partial').length, 0)

  return (
    <div>
      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: '章节数',     value: sectionAnalyses.length, color: 'var(--blue)' },
          { label: '质量问题',   value: totalQuality,            color: 'var(--orange)' },
          { label: '待补充需求', value: totalMissing,            color: 'var(--red)' },
          { label: '需完善需求', value: totalPartial,            color: 'var(--orange)' },
          { label: '已确认/补充', value: totalConfirmed,         color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Section cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {sectionAnalyses.map((sa, idx) => {
          const activeQuality = sa.issues.filter(i => i.status !== 'rejected')
          const sg = sectionGapMap.get(sa.section_id)
          const needCoverages: NeedCoverage[] = (sg?.need_coverages ?? []).filter(
            nc => nc.coverage_level !== 'full' && nc.status !== 'rejected'
          )
          const missingCount = needCoverages.filter(nc => nc.coverage_level === 'missing').length
          const partialCount = needCoverages.filter(nc => nc.coverage_level === 'partial').length
          const hasHighPrio = activeQuality.some(i => i.severity === 'high')
          const hasAnything = activeQuality.length > 0 || needCoverages.length > 0

          const borderColor = (hasHighPrio || missingCount > 0) ? 'var(--red)'
            : (activeQuality.length > 0 || partialCount > 0) ? 'var(--orange)'
            : 'var(--gray-200)'

          const isCollapsed = collapsedSections.has(sa.section_id)

          return (
            <div key={sa.section_id} style={{
              border: '1px solid var(--gray-200)',
              borderLeft: `3px solid ${borderColor}`,
              borderRadius: 'var(--radius)',
              background: 'white',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div
                onClick={() => toggleSection(sa.section_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
                  background: !hasAnything ? 'var(--gray-50)' : 'white',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--gray-400)', minWidth: 18 }}>{idx + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)', flex: 1 }}>
                  {sa.section_heading}
                </span>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {activeQuality.length > 0 && (
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10,
                      background: 'var(--orange-light)', color: 'var(--orange)', fontWeight: 600 }}>
                      质量 {activeQuality.length}
                    </span>
                  )}
                  {missingCount > 0 && (
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10,
                      background: '#fff1f1', color: 'var(--red)', fontWeight: 600 }}>
                      ✗ {missingCount}
                    </span>
                  )}
                  {partialCount > 0 && (
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10,
                      background: '#fff7ed', color: 'var(--orange)', fontWeight: 600 }}>
                      ◑ {partialCount}
                    </span>
                  )}
                  {!hasAnything && (
                    <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ 无问题</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{isCollapsed ? '▸' : '▾'}</span>
              </div>

              {!isCollapsed && (
                <div style={{ borderTop: '1px solid var(--gray-100)' }}>

                  {/* ── 内容质量问题（Step 3）─────────────────────────── */}
                  {sa.issues.length > 0 && (
                    <div style={{
                      borderBottom: needCoverages.length > 0 ? '1px solid var(--gray-100)' : 'none',
                    }}>
                      <div style={{ padding: '8px 14px 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 3, height: 12, background: 'var(--orange)', borderRadius: 2,
                          display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)' }}>
                          内容质量问题
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                          {activeQuality.length} 项有效
                          {sa.issues.length - activeQuality.length > 0 &&
                            `，${sa.issues.length - activeQuality.length} 项已排除`}
                        </span>
                      </div>
                      <div style={{ padding: '4px 14px 10px' }}>
                        {sa.issues.map(issue => (
                          <IssueRow
                            key={issue.id}
                            issue={issue}
                            expanded={expandedIssueId === issue.id}
                            onToggle={() => setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)}
                            onUpdate={changes => updateIssue(sa.section_id, issue.id, changes)}
                            onDelete={issue.status === 'added' ? () => removeIssue(sa.section_id, issue.id) : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 用户需求覆盖（Step 4）────────────────────────────── */}
                  {needCoverages.length > 0 && (
                    <div>
                      <div style={{ padding: '8px 14px 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 3, height: 12, background: 'var(--blue)', borderRadius: 2,
                          display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)' }}>
                          用户需求覆盖
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                          {[
                            missingCount > 0 ? `${missingCount} 待补充` : '',
                            partialCount > 0 ? `${partialCount} 需完善` : '',
                          ].filter(Boolean).join('，')}
                        </span>
                      </div>
                      <div style={{ padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {needCoverages.map((nc, j) => {
                          const cfg = COVERAGE_CONFIG[nc.coverage_level as keyof typeof COVERAGE_CONFIG]
                          const freq = clusterFreqMap.get(nc.topic)
                          return (
                            <div key={j} style={{
                              border: '1px solid var(--gray-100)',
                              borderLeft: `3px solid ${cfg.color}`,
                              borderRadius: 6, padding: '8px 12px',
                              background: 'white',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                                marginBottom: nc.revision_suggestion ? 6 : 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
                                  background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
                                  {cfg.icon} {cfg.label}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', flex: 1 }}>
                                  {nc.topic}
                                </span>
                                {freq != null && (
                                  <span style={{ fontSize: 11, color: 'var(--gray-400)', flexShrink: 0 }}>
                                    约 {freq} 次提问
                                  </span>
                                )}
                              </div>
                              {nc.revision_suggestion && (
                                <div style={{
                                  fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.7,
                                  padding: '5px 10px', borderRadius: 4,
                                  border: '1px solid var(--gray-100)',
                                  borderLeftWidth: 3, borderLeftColor: cfg.color,
                                  background: 'white',
                                }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginRight: 6 }}>
                                    {nc.coverage_level === 'missing' ? '建议补充' : '建议完善'}
                                  </span>
                                  {nc.revision_suggestion}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empty */}
                  {sa.issues.length === 0 && needCoverages.length === 0 && (
                    <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--gray-400)' }}>
                      本章节无质量问题，用户需求已全面覆盖
                    </div>
                  )}

                  {/* Add issue */}
                  <div style={{ padding: '8px 14px', borderTop: '1px solid var(--gray-100)' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => addIssue(sa.section_id)}>
                      + 补充质量问题
                    </button>
                  </div>

                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between items-center mt-4">
        <button className="btn btn-outline" onClick={onBack}>← 返回</button>
        <button className="btn btn-primary" onClick={onNext}>
          确认审核 · 生成迭代计划 →
        </button>
      </div>
    </div>
  )
}
