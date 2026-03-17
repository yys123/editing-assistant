import { useState, useEffect } from 'react'
import {
  QAItem, SectionAnalysis, ParsedArticle, GapAnalysis,
  NeedCluster, NeedSectionMapping, SectionNeedsGap, GapItem, NeedCoverage,
} from '../types'

type Phase = 'classifying' | 'mapping' | 'analyzing' | 'done'

interface Props {
  disease: string
  qaItems: QAItem[]
  sectionAnalyses: SectionAnalysis[]
  parsedArticle: ParsedArticle
  gapAnalysis: GapAnalysis | null
  setGapAnalysis: (g: GapAnalysis) => void
  onNext: () => void
  onBack: () => void
}

const COVERAGE_CONFIG = {
  full:    { label: '已覆盖', color: 'var(--green)',  bg: '#f0fdf4', icon: '✓' },
  partial: { label: '需完善', color: 'var(--orange)', bg: '#fff7ed', icon: '◑' },
  missing: { label: '待补充', color: 'var(--red)',    bg: '#fff1f1', icon: '✗' },
} as const

// ── NeedCard sub-component ────────────────────────────────────────────────────
interface SectionEntry { sectionId: string; sectionHeading: string; coverage: NeedCoverage }

function NeedCard({ cluster, sections, missingCount, partialCount, fullCount, isSatisfied, borderColor, defaultOpen, expandedKey, setExpandedKey, onUpdateCoverage, onUpdateCluster }: {
  cluster: NeedCluster
  sections: SectionEntry[]
  missingCount: number
  partialCount: number
  fullCount: number
  isSatisfied: boolean
  borderColor: string
  defaultOpen: boolean
  expandedKey: string | null
  setExpandedKey: (k: string | null) => void
  onUpdateCoverage: (sectionId: string, topic: string, changes: Partial<NeedCoverage>) => void
  onUpdateCluster: (topic: string, changes: Partial<NeedCluster>) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [qExpanded, setQExpanded] = useState(false)
  const sortedSections = [
    ...sections.filter(s => s.coverage.coverage_level === 'missing' && s.coverage.status !== 'rejected'),
    ...sections.filter(s => s.coverage.coverage_level === 'partial'  && s.coverage.status !== 'rejected'),
    ...sections.filter(s => s.coverage.coverage_level === 'full'),
    ...sections.filter(s => s.coverage.status === 'rejected'),
  ]

  return (
    <div style={{ border: `1px solid var(--gray-200)`, borderLeft: `3px solid ${borderColor}`, borderRadius: 'var(--radius)', background: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
          background: isSatisfied ? 'var(--gray-50)' : borderColor === 'var(--red)' ? '#fffafa' : borderColor === 'var(--orange)' ? '#fffef8' : 'white' }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)', flex: 1 }}>{cluster.topic}</span>
        {cluster.frequency > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 3,
            background: cluster.frequency > 100 ? '#fff1f1' : cluster.frequency > 50 ? '#fff7ed' : 'var(--gray-100)',
            color: cluster.frequency > 100 ? 'var(--red)' : cluster.frequency > 50 ? 'var(--orange)' : 'var(--gray-500)' }}>
            {cluster.frequency} 次提问
          </span>
        )}
        {/* Coverage counts (exclude rejected) */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {missingCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fff1f1', color: 'var(--red)' }}>✗ {missingCount}</span>}
          {partialCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fff7ed', color: 'var(--orange)' }}>◑ {partialCount}</span>}
          {fullCount > 0    && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#f0fdf4', color: 'var(--green)', fontWeight: isSatisfied ? 700 : 400 }}>✓ {fullCount}</span>}
          {sections.length === 0 && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>未映射到章节</span>}
        </div>
        <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 4 }}>{open ? '▾' : '▸'}</span>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--gray-100)' }}>
          {sections.length === 0 ? (
            <div style={{ padding: '12px 14px' }}>
              {(() => {
                const placementKey = `placement::${cluster.topic}`
                const isEditingPlacement = expandedKey === placementKey
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ width: 3, height: 12, background: 'var(--orange)', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)' }}>当前词条暂无对应章节</span>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>建议新增内容或在现有章节中补充</span>
                    </div>
                    {isEditingPlacement ? (
                      <div>
                        <textarea
                          value={cluster.placement_suggestion ?? ''}
                          onChange={e => onUpdateCluster(cluster.topic, { placement_suggestion: e.target.value })}
                          autoFocus
                          rows={4}
                          style={{ width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 4,
                            border: '1px solid var(--gray-300)', resize: 'vertical', lineHeight: 1.6,
                            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: '2px 10px' }}
                            onClick={() => setExpandedKey(null)}>保存</button>
                          <button className="btn btn-sm btn-outline" style={{ fontSize: 11, padding: '2px 10px' }}
                            onClick={() => setExpandedKey(null)}>取消</button>
                        </div>
                      </div>
                    ) : cluster.placement_suggestion ? (
                      <div
                        onClick={() => setExpandedKey(placementKey)}
                        style={{ padding: '8px 12px', borderRadius: 6, background: 'white',
                          border: '1px solid var(--gray-100)', borderLeftWidth: 3, borderLeftColor: 'var(--orange)',
                          fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.7, cursor: 'text' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', marginRight: 6 }}>修订建议</span>
                        {cluster.placement_suggestion}
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--gray-400)' }}>✏</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>暂无修订建议</span>
                        <button className="btn btn-sm btn-outline" style={{ fontSize: 11, padding: '1px 8px' }}
                          onClick={() => setExpandedKey(placementKey)}>+ 添加建议</button>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          ) : (
            <>
              {/* Representative questions */}
              {cluster.representative_questions.length > 0 && (
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)', marginRight: 2 }}>问题示例：</span>
                  {(qExpanded ? cluster.representative_questions : cluster.representative_questions.slice(0, 3)).map((q, qi) => (
                    <span key={qi} style={{ fontSize: 11, color: 'var(--gray-600)', lineHeight: 1.5,
                      padding: '2px 8px', borderRadius: 3, background: 'var(--gray-50)', border: '1px solid var(--gray-100)' }}>
                      「{q}」
                    </span>
                  ))}
                  {cluster.representative_questions.length > 3 && (
                    <button
                      onClick={e => { e.stopPropagation(); setQExpanded(v => !v) }}
                      style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
                    >
                      {qExpanded ? '收起' : `+${cluster.representative_questions.length - 3} 更多`}
                    </button>
                  )}
                </div>
              )}
              {/* Per-section rows */}
              {sortedSections.map((item, idx) => {
                const cfg = COVERAGE_CONFIG[item.coverage.coverage_level as keyof typeof COVERAGE_CONFIG]
                const isLast = idx === sortedSections.length - 1
                const isDimmed = item.coverage.coverage_level === 'full'
                const isRejected = item.coverage.status === 'rejected'
                const isConfirmed = item.coverage.status === 'confirmed'
                const rowKey = `${item.sectionId}::${cluster.topic}`
                const isExpanded = expandedKey === rowKey
                const [editText, setEditText] = [item.coverage.revision_suggestion, (v: string) =>
                  onUpdateCoverage(item.sectionId, cluster.topic, { revision_suggestion: v })]

                const rowBg = isRejected ? 'var(--gray-50)' : isDimmed ? 'var(--gray-50)'
                  : item.coverage.coverage_level === 'missing' ? '#fffbfb' : '#fffdf8'

                return (
                  <div key={item.sectionId} style={{
                    padding: '8px 14px',
                    borderBottom: isLast ? 'none' : '1px solid var(--gray-100)',
                    background: rowBg,
                    opacity: isRejected ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {/* Section heading pill */}
                      <div style={{ flexShrink: 0, paddingTop: 2, width: 130, overflow: 'hidden' }}>
                        <span style={{ display: 'block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                          background: 'var(--gray-100)', color: 'var(--gray-600)', whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.sectionHeading}
                        </span>
                      </div>
                      {/* Coverage badge */}
                      <div style={{ flexShrink: 0, paddingTop: 2, width: 68 }}>
                        <span style={{ display: 'block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                          background: isRejected ? 'var(--gray-100)' : cfg.bg,
                          color: isRejected ? 'var(--gray-400)' : cfg.color, textAlign: 'center',
                          textDecoration: isRejected ? 'line-through' : 'none' }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>

                      {/* Suggestion / textarea */}
                      {!isDimmed && (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isExpanded ? (
                            <div>
                              <textarea
                                value={item.coverage.revision_suggestion}
                                onChange={e => setEditText(e.target.value)}
                                autoFocus
                                rows={3}
                                style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 4,
                                  border: `1px solid var(--gray-300)`, resize: 'vertical', lineHeight: 1.6,
                                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                              />
                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button
                                  className="btn btn-sm btn-primary"
                                  style={{ fontSize: 11, padding: '2px 10px' }}
                                  onClick={() => setExpandedKey(null)}
                                >保存</button>
                                <button
                                  className="btn btn-sm btn-outline"
                                  style={{ fontSize: 11, padding: '2px 10px' }}
                                  onClick={() => setExpandedKey(null)}
                                >取消</button>
                              </div>
                            </div>
                          ) : (
                            item.coverage.revision_suggestion ? (
                              <div
                                onClick={() => !isRejected && setExpandedKey(isExpanded ? null : rowKey)}
                                style={{ padding: '6px 10px', borderRadius: 4, background: 'white',
                                  border: `1px solid var(--gray-100)`, borderLeftWidth: 3,
                                  borderLeftColor: isRejected ? 'var(--gray-300)' : cfg.color,
                                  fontSize: 12, lineHeight: 1.7, cursor: isRejected ? 'default' : 'text',
                                  textDecoration: isRejected ? 'line-through' : 'none',
                                  color: isRejected ? 'var(--gray-400)' : 'var(--gray-700)' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, marginRight: 6,
                                    color: isRejected ? 'var(--gray-400)' : cfg.color }}>
                                    {item.coverage.coverage_level === 'missing' ? '建议补充' : '建议完善'}
                                  </span>
                                  {item.coverage.revision_suggestion}
                                  {!isRejected && (
                                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--gray-400)' }}>✏</span>
                                  )}
                                </div>
                            ) : null
                          )}
                        </div>
                      )}

                      {/* Action buttons — only for non-full items */}
                      {!isDimmed && (
                        <div style={{ flexShrink: 0, display: 'flex', gap: 4, paddingTop: 2, alignItems: 'center' }}>
                          {isRejected ? (
                            <button
                              className="btn btn-sm btn-outline"
                              style={{ fontSize: 11, padding: '1px 8px', color: 'var(--gray-500)' }}
                              onClick={() => onUpdateCoverage(item.sectionId, cluster.topic, { status: 'ai' })}
                            >恢复</button>
                          ) : isConfirmed ? (
                            <>
                              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ 已确认</span>
                              <button
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: 11, padding: '1px 8px' }}
                                onClick={() => onUpdateCoverage(item.sectionId, cluster.topic, { status: 'ai' })}
                              >撤销</button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-sm"
                                style={{ fontSize: 11, padding: '1px 8px', background: '#f0fdf4',
                                  color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 4 }}
                                onClick={() => onUpdateCoverage(item.sectionId, cluster.topic, { status: 'confirmed' })}
                              >确认</button>
                              <button
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: 11, padding: '1px 8px', color: 'var(--gray-400)' }}
                                onClick={() => onUpdateCoverage(item.sectionId, cluster.topic, { status: 'rejected' })}
                              >排除</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── SectionIndex sub-component ────────────────────────────────────────────────
import { ArticleSection } from '../types'

function SectionIndex({ level1Sections, displayGaps, sectionErrors, retrySectionGap }: {
  level1Sections: ArticleSection[]
  displayGaps: SectionNeedsGap[]
  sectionErrors: Record<string, string>
  retrySectionGap: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', fontSize: 13,
          fontWeight: 600, color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span>{open ? '▾' : '▸'}</span> 按章节查看
        <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 12 }}>各章节需求覆盖一览</span>
      </button>
      {open && (
        <div className="card" style={{ marginTop: 8 }}>
          <table className="table">
            <thead>
              <tr>
                <th>章节</th>
                <th style={{ textAlign: 'center', color: 'var(--red)' }}>✗ 待补充</th>
                <th style={{ textAlign: 'center', color: 'var(--orange)' }}>◑ 需完善</th>
                <th style={{ textAlign: 'center', color: 'var(--green)' }}>✓ 已覆盖</th>
              </tr>
            </thead>
            <tbody>
              {level1Sections.map((section, i) => {
                const sg = displayGaps.find(g => g.section_id === section.id)
                const coverages = (sg?.need_coverages ?? []).filter(nc => nc.status !== 'rejected')
                const mc = coverages.filter(nc => nc.coverage_level === 'missing').length
                const pc = coverages.filter(nc => nc.coverage_level === 'partial').length
                const fc = coverages.filter(nc => nc.coverage_level === 'full').length
                const hasError = !!sectionErrors[section.id]
                const rowBg = hasError ? '#fff8f8' : mc > 0 ? '#fff8f8' : pc > 0 ? '#fffdf8' : 'white'
                return (
                  <tr key={section.id} style={{ background: rowBg }}>
                    <td style={{ fontWeight: 500 }}>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', marginRight: 8 }}>{i + 1}</span>
                      {section.heading}
                      {hasError && (
                        <button className="btn btn-sm" style={{ marginLeft: 8, padding: '1px 8px', color: 'var(--blue)', fontSize: 11 }}
                          onClick={() => retrySectionGap(section.id)}>重试</button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{mc > 0 ? <span style={{ fontWeight: 700, color: 'var(--red)' }}>{mc}</span> : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{pc > 0 ? <span style={{ fontWeight: 700, color: 'var(--orange)' }}>{pc}</span> : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{fc > 0 ? <span style={{ color: 'var(--green)' }}>{fc}</span> : coverages.length === 0 ? <span style={{ color: 'var(--gray-300)', fontSize: 11 }}>无需求</span> : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function StepGapAnalysis({
  disease, qaItems, sectionAnalyses, parsedArticle,
  gapAnalysis, setGapAnalysis, onNext, onBack,
}: Props) {
  const [phase, setPhase] = useState<Phase>(gapAnalysis ? 'done' : 'classifying')
  const [error, setError] = useState('')
  const [clusters, setClusters] = useState<NeedCluster[]>(gapAnalysis?.clusters ?? [])
  const [mappings, setMappings] = useState<NeedSectionMapping[]>(gapAnalysis?.section_mappings ?? [])
  const [sectionGaps, setSectionGaps] = useState<SectionNeedsGap[]>(gapAnalysis?.section_gaps ?? [])
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [analyzeTotal, setAnalyzeTotal] = useState(0)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // ── Update a single NeedCoverage in gapAnalysis ───────────────────────────
  const updateNeedCoverage = (sectionId: string, topic: string, changes: Partial<NeedCoverage>) => {
    if (!gapAnalysis) return
    setGapAnalysis({
      ...gapAnalysis,
      section_gaps: gapAnalysis.section_gaps.map(sg =>
        sg.section_id !== sectionId ? sg : {
          ...sg,
          need_coverages: sg.need_coverages.map(nc =>
            nc.topic !== topic ? nc : { ...nc, ...changes }
          ),
        }
      ),
    })
  }

  // ── Update a cluster's placement_suggestion ───────────────────────────────
  const updateCluster = (topic: string, changes: Partial<NeedCluster>) => {
    if (!gapAnalysis) return
    setGapAnalysis({
      ...gapAnalysis,
      clusters: gapAnalysis.clusters.map(c => c.topic !== topic ? c : { ...c, ...changes }),
    })
  }

  // ── Phase 1: classify ────────────────────────────────────────────────────────
  const runClassify = async (): Promise<NeedCluster[]> => {
    if (!qaItems.length) return []
    const res = await fetch('/api/analyze/needs-classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disease, qa_items: qaItems }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || '需求分类失败')
    return data.clusters as NeedCluster[]
  }

  // ── Phase 2: map ─────────────────────────────────────────────────────────────
  const runMap = async (cls: NeedCluster[]): Promise<NeedSectionMapping[]> => {
    const res = await fetch('/api/analyze/needs-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disease, clusters: cls, sections: parsedArticle.sections }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || '需求映射失败')
    return data.mappings as NeedSectionMapping[]
  }

  // ── Phase 3: per-section gap (only sections with mapped clusters) ─────────────
  const runSectionGap = async (
    cls: NeedCluster[],
    maps: NeedSectionMapping[],
  ): Promise<SectionNeedsGap[]> => {
    const sectionsWithNeeds = parsedArticle.sections.filter(s => {
      const m = maps.find(m => m.section_id === s.id)
      return m && m.cluster_topics.length > 0
    })
    setAnalyzeProgress(0)
    setAnalyzeTotal(sectionsWithNeeds.length)

    // Pre-fill empty results for sections without needs
    const resultMap = new Map<string, SectionNeedsGap>()
    for (const s of parsedArticle.sections) {
      const m = maps.find(m => m.section_id === s.id)
      if (!m || m.cluster_topics.length === 0) {
        resultMap.set(s.id, { section_id: s.id, section_heading: s.heading, need_coverages: [], gap_items: [], coverage_assessment: '' })
      }
    }

    let completed = 0
    await Promise.all(
      sectionsWithNeeds.map(async section => {
        const mapping = maps.find(m => m.section_id === section.id)
        const mappedClusters = cls.filter(c => mapping?.cluster_topics.includes(c.topic))
        const sectionAnalysis = sectionAnalyses.find(a => a.section_id === section.id) ?? null
        try {
          const res = await fetch('/api/analyze/needs-section-gap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disease, section, section_analysis: sectionAnalysis, mapped_clusters: mappedClusters, all_mappings: maps }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.detail || '分析失败')
          resultMap.set(section.id, data as SectionNeedsGap)
        } catch (e: any) {
          setSectionErrors(prev => ({ ...prev, [section.id]: e.message }))
          resultMap.set(section.id, { section_id: section.id, section_heading: section.heading, need_coverages: [], gap_items: [], coverage_assessment: '' })
        }
        completed++
        setAnalyzeProgress(completed)
      })
    )

    return parsedArticle.sections.map(s => resultMap.get(s.id)!).filter(Boolean)
  }

  // ── Assemble ──────────────────────────────────────────────────────────────────
  const assemble = (cls: NeedCluster[], maps: NeedSectionMapping[], gaps: SectionNeedsGap[]): GapAnalysis => {
    const allGapItems: GapItem[] = gaps.flatMap(g => g.gap_items)
    allGapItems.sort((a, b) => ({ P0: 0, P1: 1, P2: 2 }[a.priority] ?? 3) - ({ P0: 0, P1: 1, P2: 2 }[b.priority] ?? 3))
    return { clusters: cls, total_qa_count: qaItems.length, section_mappings: maps, section_gaps: gaps, unmet_needs: allGapItems, optimization_suggestions: [] }
  }

  // ── Run all ───────────────────────────────────────────────────────────────────
  const runAll = async () => {
    setError('')
    setSectionErrors({})
    setClusters([])
    setMappings([])
    setSectionGaps([])
    try {
      setPhase('classifying')
      const cls = await runClassify()
      setClusters(cls)

      setPhase('mapping')
      const maps = await runMap(cls)
      setMappings(maps)

      setPhase('analyzing')
      const gaps = await runSectionGap(cls, maps)
      setSectionGaps(gaps)

      const result = assemble(cls, maps, gaps)

      // Detect clusters not covered by any section_gap need_coverages
      const coveredTopics = new Set(gaps.flatMap(g => (g.need_coverages ?? []).map(nc => nc.topic)))
      const unmapped = cls.filter(c => !coveredTopics.has(c.topic))
      if (unmapped.length > 0) {
        try {
          const res = await fetch('/api/analyze/needs-placement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disease, unmapped_clusters: unmapped, sections: parsedArticle.sections }),
          })
          if (res.ok) {
            const data = await res.json()
            const placements: Record<string, string> = data.placements ?? {}
            result.clusters = result.clusters.map(c =>
              placements[c.topic] != null ? { ...c, placement_suggestion: placements[c.topic] } : c
            )
          }
        } catch { /* non-fatal, proceed without suggestions */ }
      }

      setGapAnalysis(result)
      setPhase('done')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const retrySectionGap = async (sectionId: string) => {
    const section = parsedArticle.sections.find(s => s.id === sectionId)
    if (!section) return
    setSectionErrors(prev => { const n = { ...prev }; delete n[sectionId]; return n })
    const mapping = mappings.find(m => m.section_id === sectionId)
    const mappedClusters = clusters.filter(c => mapping?.cluster_topics.includes(c.topic))
    const sectionAnalysis = sectionAnalyses.find(a => a.section_id === sectionId) ?? null
    try {
      const res = await fetch('/api/analyze/needs-section-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disease, section, section_analysis: sectionAnalysis, mapped_clusters: mappedClusters }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '分析失败')
      const newResult = data as SectionNeedsGap
      const newGaps = sectionGaps.map(sg => sg.section_id === sectionId ? newResult : sg)
      setSectionGaps(newGaps)
      setGapAnalysis(assemble(clusters, mappings, newGaps))
    } catch (e: any) {
      setSectionErrors(prev => ({ ...prev, [sectionId]: e.message }))
    }
  }

  useEffect(() => { if (!gapAnalysis) runAll() }, [])

  // ── Phase bar ─────────────────────────────────────────────────────────────────
  const phases: { key: Phase; label: string }[] = [
    { key: 'classifying', label: '需求分类' },
    { key: 'mapping',     label: '章节映射' },
    { key: 'analyzing',   label: '逐章对比' },
    { key: 'done',        label: '分析完成' },
  ]
  const phaseIdx = phases.findIndex(p => p.key === phase)

  const PhaseBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, padding: '10px 20px', background: 'white', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', fontSize: 12 }}>
      {phases.map((p, i) => (
        <div key={p.key} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: i < phaseIdx ? 'var(--green)' : i === phaseIdx ? 'var(--blue)' : 'var(--gray-400)', fontWeight: i === phaseIdx ? 700 : 400 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: i < phaseIdx ? 'var(--green)' : i === phaseIdx ? 'var(--blue)' : 'var(--gray-200)', color: i <= phaseIdx ? 'white' : 'var(--gray-400)' }}>
              {i < phaseIdx ? '✓' : i + 1}
            </div>
            {p.label}
          </div>
          {i < phases.length - 1 && <div style={{ width: 32, height: 1, background: i < phaseIdx ? 'var(--green)' : 'var(--gray-200)', margin: '0 8px' }} />}
        </div>
      ))}
    </div>
  )

  // ── Loading states ────────────────────────────────────────────────────────────
  if (error) return (
    <div className="card">
      <div className="alert alert-error">{error}</div>
      <div className="flex gap-2">
        <button className="btn btn-outline" onClick={onBack}>← 返回</button>
        <button className="btn btn-primary" onClick={runAll}>重新开始</button>
      </div>
    </div>
  )

  if (phase === 'classifying') return (
    <div><PhaseBar />
      <div className="loading">
        <div className="spinner" />
        <div>正在分析 {qaItems.length} 条问答，识别用户需求类型...</div>
        <div className="text-sm text-muted">AI 正在对所有问题进行聚类与分类</div>
      </div>
    </div>
  )

  if (phase === 'mapping') return (
    <div><PhaseBar />
      <div className="loading">
        <div className="spinner" />
        <div>正在建立需求-章节映射...</div>
        <div className="text-sm text-muted">已识别 {clusters.length} 类需求，正在与章节结构对应</div>
        {clusters.length > 0 && (
          <div style={{ marginTop: 16, maxWidth: 500, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--gray-700)' }}>已识别需求类型：</div>
            {clusters.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 4, display: 'flex', gap: 8 }}>
                <span style={{ color: c.frequency > 100 ? 'var(--red)' : c.frequency > 50 ? 'var(--orange)' : 'var(--gray-500)', fontWeight: 600, minWidth: 40 }}>{c.frequency}次</span>
                {c.topic}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (phase === 'analyzing') return (
    <div><PhaseBar />
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
        <div style={{ fontWeight: 600, marginBottom: 8 }}>正在逐章节分析需求覆盖情况...</div>
        <div className="text-sm text-muted" style={{ marginBottom: 20 }}>
          {analyzeProgress} / {analyzeTotal} 个章节完成（跳过无对应需求的章节）
        </div>
        <div style={{ width: 300, margin: '0 auto', height: 6, background: 'var(--gray-200)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${analyzeTotal > 0 ? (analyzeProgress / analyzeTotal) * 100 : 0}%`, background: 'var(--blue)', transition: 'width 0.3s ease' }} />
        </div>
      </div>
    </div>
  )

  if (phase !== 'done' || !gapAnalysis) return null

  // ── Done: compute enriched clusters (need-centric, sorted by urgency) ─────────
  const displayClusters = gapAnalysis.clusters
  const displayGaps = gapAnalysis.section_gaps

  // Build needSectionMap: topic → all sections that have coverage data for it
  const needSectionMap = new Map<string, Array<{ sectionId: string; sectionHeading: string; coverage: NeedCoverage }>>()
  for (const sg of displayGaps) {
    for (const nc of (sg.need_coverages ?? [])) {
      if (!needSectionMap.has(nc.topic)) needSectionMap.set(nc.topic, [])
      needSectionMap.get(nc.topic)!.push({ sectionId: sg.section_id, sectionHeading: sg.section_heading, coverage: nc })
    }
  }

  // Enrich clusters — counts exclude rejected items
  const enrichedClusters = displayClusters.map(c => {
    const sections = needSectionMap.get(c.topic) ?? []
    const mc = sections.filter(s => s.coverage.coverage_level === 'missing' && s.coverage.status !== 'rejected').length
    const pc = sections.filter(s => s.coverage.coverage_level === 'partial'  && s.coverage.status !== 'rejected').length
    const fc = sections.filter(s => s.coverage.coverage_level === 'full').length
    return { cluster: c, sections, missingCount: mc, partialCount: pc, fullCount: fc, urgencyScore: (mc * 2 + pc) * c.frequency }
  }).sort((a, b) => b.urgencyScore - a.urgencyScore || b.cluster.frequency - a.cluster.frequency)

  // Stats for the top bar
  const totalMissing = enrichedClusters.reduce((acc, e) => acc + e.missingCount, 0)
  const totalPartial = enrichedClusters.reduce((acc, e) => acc + e.partialCount, 0)
  const totalConfirmed = displayGaps.reduce((acc, sg) =>
    acc + (sg.need_coverages ?? []).filter(nc => nc.status === 'confirmed').length, 0)
  const allSatisfied = enrichedClusters.every(e => e.missingCount === 0 && e.partialCount === 0)

  // Level-1 sections for the section index
  const level1Sections = parsedArticle.sections.filter(s => s.level === 1)

  return (
    <div>
      <PhaseBar />

      {/* Stats row + re-analyze button */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Q&A 总量',  value: qaItems.length || gapAnalysis.total_qa_count, color: 'var(--blue)' },
          { label: '需求类型',  value: displayClusters.length,  color: 'var(--blue)' },
          { label: '待补充',    value: totalMissing,             color: 'var(--red)' },
          { label: '需完善',    value: totalPartial,             color: 'var(--orange)' },
          { label: '已确认',    value: totalConfirmed,           color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 0' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 20px' }}>
          {Object.keys(sectionErrors).length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--red)' }}>{Object.keys(sectionErrors).length} 个章节失败</span>
          )}
          <button className="btn btn-sm btn-outline" onClick={runAll}>重新分析</button>
        </div>
      </div>

      {/* ── PRIMARY: need-centric view ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 13, color: 'var(--gray-700)' }}>
        需求分析结论
        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--gray-400)' }}>按紧迫度排序，展示每类需求在各章节的覆盖情况和修改建议</span>
      </div>

      {allSatisfied && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>✓ 所有用户需求已全面覆盖</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {enrichedClusters.map(({ cluster, sections, missingCount, partialCount, fullCount }) => {
          const isSatisfied = missingCount === 0 && partialCount === 0
          const borderColor = missingCount > 0 ? 'var(--red)' : partialCount > 0 ? 'var(--orange)' : 'var(--gray-200)'
          const defaultOpen = !isSatisfied
          return (
            <NeedCard
              key={cluster.topic}
              cluster={cluster}
              sections={sections}
              missingCount={missingCount}
              partialCount={partialCount}
              fullCount={fullCount}
              isSatisfied={isSatisfied}
              borderColor={borderColor}
              defaultOpen={defaultOpen}
              expandedKey={expandedKey}
              setExpandedKey={setExpandedKey}
              onUpdateCoverage={updateNeedCoverage}
              onUpdateCluster={updateCluster}
            />
          )
        })}
      </div>

      {/* ── SECONDARY: section index (collapsed by default) ───────────────────── */}
      <SectionIndex
        level1Sections={level1Sections}
        displayGaps={displayGaps}
        sectionErrors={sectionErrors}
        retrySectionGap={retrySectionGap}
      />

      <div className="flex justify-between items-center mt-4">
        <button className="btn btn-outline" onClick={onBack}>← 返回</button>
        <button className="btn btn-primary" onClick={onNext}>下一步：审核与迭代计划 →</button>
      </div>
    </div>
  )
}
