import React, { useState, useEffect, useMemo } from 'react'
import { SectionAnalysis, GapAnalysis, GapItem, DraftRecord, ParsedArticle } from '../types'
import { apiFetch } from '../api'

interface Props {
  disease: string
  parsedArticle: ParsedArticle | null
  sectionAnalyses: SectionAnalysis[]
  gapAnalysis: GapAnalysis
  gapItems: GapItem[]
  setGapItems: (items: GapItem[]) => void
  draftHistory: DraftRecord[]
  onNext: (gap: GapItem) => void
  onBack: () => void
}

// Split section path into parts
function sectionParts(s: string): string[] {
  return s.split(' > ').map(p => p.trim()).filter(Boolean)
}

// Tree node for hierarchical display
interface TreeNode {
  label: string
  itemIndices: number[]          // gap item indices directly under this node
  children: Map<string, TreeNode>
}

function buildSectionTree(indices: number[], gapItems: GapItem[]): TreeNode {
  const root: TreeNode = { label: '', itemIndices: [], children: new Map() }
  for (const idx of indices) {
    const parts = sectionParts(gapItems[idx].section)
    // parts[0] is the top-level group key (already separated by groupedItems), skip it
    let node = root
    for (const part of parts.slice(1)) {
      if (!node.children.has(part)) {
        node.children.set(part, { label: part, itemIndices: [], children: new Map() })
      }
      node = node.children.get(part)!
    }
    node.itemIndices.push(idx)
  }
  return root
}

export default function StepPlanReview({
  disease, parsedArticle, sectionAnalyses, gapAnalysis,
  gapItems, setGapItems, draftHistory, onNext, onBack
}: Props) {
  const isGenerated = (g: GapItem) =>
    draftHistory.some(r => r.gap.section === g.section && r.gap.priority === g.priority)

  const [loading, setLoading] = useState(gapItems.length === 0)
  const [error, setError] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [auditExpanded, setAuditExpanded] = useState(false)

  // Stats
  const confirmedIssues = sectionAnalyses.reduce((n, sa) =>
    n + sa.issues.filter(i => i.status !== 'rejected').length, 0)
  const confirmedNeeds = gapAnalysis.section_gaps.reduce((n, sg) =>
    n + (sg.need_coverages ?? []).filter(nc =>
      nc.coverage_level !== 'full' && nc.status !== 'rejected'
    ).length, 0)

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/analyze/plan-from-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease,
          section_analyses: sectionAnalyses,
          gap_analysis: gapAnalysis,
          parsed_article: parsedArticle,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '生成失败')
      setGapItems(data.gap_items as GapItem[])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (gapItems.length === 0) generate()
  }, [])

  const remove = (i: number) => {
    setGapItems(gapItems.filter((_, j) => j !== i))
  }

  const startEdit = (i: number) => {
    setEditingIdx(i)
    setEditValue(gapItems[i].description)
  }

  const saveEdit = (i: number) => {
    const arr = [...gapItems]
    arr[i] = { ...arr[i], description: editValue }
    setGapItems(arr)
    setEditingIdx(null)
  }

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= gapItems.length) return
    const arr = [...gapItems]
    ;[arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]]
    setGapItems(arr)
  }

  const addTask = () => {
    const newItem: GapItem = {
      priority: 'P2',
      section: '补充',
      description: '（请填写任务描述）',
      source: 'manual',
    }
    const newIdx = gapItems.length
    setGapItems([...gapItems, newItem])
    setEditingIdx(newIdx)
    setEditValue(newItem.description)
  }

  // Section order from parsedArticle (level-1 headings in document order)
  const sectionOrder = useMemo(() => {
    if (!parsedArticle) return []
    return parsedArticle.sections
      .filter(s => s.level === 1)
      .map(s => s.heading)
  }, [parsedArticle])

  // Group gap items by top-level section, preserving item order within each group
  const groupedItems = useMemo(() => {
    const groupMap = new Map<string, number[]>()
    gapItems.forEach((g, i) => {
      const top = sectionParts(g.section)[0] ?? g.section
      if (!groupMap.has(top)) groupMap.set(top, [])
      groupMap.get(top)!.push(i)
    })
    return [...groupMap.entries()].sort(([a], [b]) => {
      const ai = sectionOrder.indexOf(a)
      const bi = sectionOrder.indexOf(b)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [gapItems, sectionOrder])

  const priorityColors: Record<string, string> = { P0: 'var(--m3-error)', P1: '#e65100', P2: 'var(--m3-primary)' }
  const priorityBg: Record<string, string> = { P0: '#fee2e2', P1: '#fff7ed', P2: '#dbeafe' }
  const coverageBg: Record<string, string> = { partial: '#fff7ed', missing: '#fee2e2' }
  const coverageColor: Record<string, string> = { partial: '#e65100', missing: 'var(--m3-error)' }
  const coverageLabel: Record<string, string> = { partial: '部分覆盖', missing: '未覆盖' }
  const severityColor: Record<string, string> = { high: 'var(--m3-error)', medium: '#e65100', low: 'var(--m3-primary)' }
  const severityLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
  const issueTypeLabel: Record<string, string> = {
    missing_content: '内容缺失',
    structure: '结构问题',
    accuracy: '准确性',
    outdated: '内容过时',
    style: '表达风格',
  }
  const issueTypeBg: Record<string, string> = {
    missing_content: '#fee2e2',
    accuracy: '#fee2e2',
    outdated: '#fff7ed',
    structure: '#dbeafe',
    style: '#f5f3ff',
  }
  const issueTypeColor: Record<string, string> = {
    missing_content: 'var(--m3-error)',
    accuracy: 'var(--m3-error)',
    outdated: '#e65100',
    structure: 'var(--m3-primary)',
    style: '#7c3aed',
  }

  // Audit: sections with at least one non-rejected finding
  const auditSections = sectionAnalyses.map(sa => {
    const issues = sa.issues.filter(i => i.status !== 'rejected')
    const sectionGap = gapAnalysis.section_gaps.find(sg => sg.section_id === sa.section_id)
    const needs = (sectionGap?.need_coverages ?? []).filter(nc =>
      nc.coverage_level !== 'full' && nc.status !== 'rejected'
    )
    return { sa, issues, needs }
  }).filter(({ issues, needs }) => issues.length > 0 || needs.length > 0)

  // Recursive renderer for sub-section tree nodes
  const renderTreeNode = (node: TreeNode, depth: number): React.ReactNode => {
    const hasItems = node.itemIndices.length > 0
    const hasChildren = node.children.size > 0
    if (!hasItems && !hasChildren) return null

    const subHeadingSize = depth === 1 ? 12 : 11
    const subHeadingColor = depth === 1 ? 'var(--m3-on-surface)' : 'var(--m3-on-surface-variant)'
    const indentPx = (depth - 1) * 16

    return (
      <div key={node.label}>
        {/* Sub-section heading (depth >= 1) */}
        {depth >= 1 && node.label && (
          <div style={{
            marginLeft: indentPx,
            marginTop: depth === 1 ? 10 : 6,
            marginBottom: 4,
            fontSize: subHeadingSize,
            fontWeight: 600,
            color: subHeadingColor,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--m3-on-surface-variant)', fontSize: 14 }}>chevron_right</span>
            {node.label}
          </div>
        )}

        {/* Items directly under this node */}
        {node.itemIndices.map(i => {
          const g = gapItems[i]
          const generated = isGenerated(g)
          return (
            <div key={i} style={{
              marginLeft: depth >= 1 ? indentPx + 12 : 0,
              display: 'flex', gap: 10, padding: '10px 12px',
              border: '1px solid var(--m3-outline-variant)', borderRadius: 10,
              background: 'white', marginBottom: 6,
            }}>
              {/* Reorder */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button
                  style={{ padding: '1px 5px', color: 'var(--m3-on-surface-variant)', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  onClick={() => moveItem(i, i - 1)} disabled={i === 0} title="上移">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_drop_up</span>
                </button>
                <button
                  style={{ padding: '1px 5px', color: 'var(--m3-on-surface-variant)', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  onClick={() => moveItem(i, i + 1)} disabled={i >= gapItems.length - 1} title="下移">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_drop_down</span>
                </button>
              </div>

              {/* Priority badge */}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                flexShrink: 0, alignSelf: 'flex-start', marginTop: 1,
                background: priorityBg[g.priority] ?? 'var(--m3-surface-container-low)',
                color: priorityColors[g.priority] ?? 'var(--m3-on-surface)',
              }}>{g.priority}</span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingIdx === i ? (
                  <div>
                    <textarea value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      style={{ minHeight: 80, fontSize: 12, marginBottom: 6, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--m3-outline-variant)', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-gradient" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => saveEdit(i)}>保存</button>
                      <button className="btn-m3-outline" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setEditingIdx(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--m3-on-surface)', lineHeight: 1.8 }}>
                    {g.description}
                  </div>
                )}
                {g.qa_frequency ? (
                  <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', marginTop: 3 }}>
                    用户提问约 {g.qa_frequency} 次
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignSelf: 'flex-start' }}>
                {generated ? (
                  <button style={{ fontSize: 11, padding: '3px 10px', background: '#dcfce7', color: '#166534', border: '1px solid #166534', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                    onClick={() => onNext(g)} title="已生成，点击查看">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span> 已生成
                  </button>
                ) : (
                  <button className="btn-m3-outline" style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => onNext(g)}>生成</button>
                )}
                {editingIdx !== i && (
                  <button className="btn-m3-outline" style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => startEdit(i)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span> 编辑
                  </button>
                )}
                <button
                  style={{ fontSize: 11, color: 'var(--m3-error)', padding: '3px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}
                  onClick={() => remove(i)} title="删除此条">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
            </div>
          )
        })}

        {/* Recurse into children */}
        {[...node.children.values()].map(child => renderTreeNode(child, depth + 1))}
      </div>
    )
  }

  if (loading) return (
    <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
      <div className="spinner" style={{ margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 600, color: 'var(--m3-on-surface)' }}>正在生成迭代计划...</div>
      <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginTop: 6 }}>AI 正在综合质量问题和用户需求，按章节结构生成改进任务</div>
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
          返回需求分析
        </button>
        <button className="btn-gradient" onClick={generate}>重试</button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 700, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          审核与迭代计划
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          综合质量审评和需求分析结果，生成内容改进任务
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ background: '#dbeafe', color: 'var(--m3-primary)', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
          {confirmedIssues} 质量问题
        </span>
        <span style={{ background: '#fff7ed', color: '#e65100', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
          {confirmedNeeds} 需求问题
        </span>
        <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>
          {gapItems.length} 计划任务
        </span>
        <button className="btn-m3-outline" onClick={generate} style={{ marginLeft: 'auto', fontSize: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          重新生成计划
        </button>
      </div>

      {/* Plan — section-grouped */}
      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>checklist</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--m3-on-surface)' }}>内容迭代计划</span>
          <span style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>按章节顺序排列，可编辑、删除</span>
        </div>

        {gapItems.length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--m3-on-surface-variant)' }}>
            暂无改进任务
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groupedItems.map(([sectionName, indices]) => {
            const tree = buildSectionTree(indices, gapItems)
            return (
              <div key={sectionName}>
                {/* Level-1 section heading */}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--m3-on-surface)',
                  borderBottom: '2px solid var(--m3-outline-variant)',
                  paddingBottom: 6, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {sectionName}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--m3-on-surface-variant)' }}>
                    {indices.length} 项
                  </span>
                </div>
                {renderTreeNode(tree, 0)}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn-m3-outline" style={{ fontSize: 12 }} onClick={addTask}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            补充任务
          </button>
        </div>
      </div>

      {/* Collapsible audit summary */}
      <div className="section-card" style={{ marginTop: 12 }}>
        <button
          onClick={() => setAuditExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none',
            border: 'none', cursor: 'pointer', width: '100%', padding: 0,
            fontSize: 14, fontWeight: 600, color: 'var(--m3-on-surface)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, transition: 'transform 0.2s', transform: auditExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
          已确认问题汇总
          <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>（第3、4步确认的问题）</span>
        </button>

        {auditExpanded && (
          <div style={{ marginTop: 16 }}>
            {auditSections.length === 0 ? (
              <div style={{ color: 'var(--m3-tertiary)', fontSize: 13, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span> 所有问题已处理</div>
            ) : (
              auditSections.map(({ sa, issues, needs }) => (
                <div key={sa.section_id} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--m3-on-surface)' }}>
                    {sa.section_heading}
                  </div>

                  {issues.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>质量问题</div>
                      {issues.map(issue => (
                        <div key={issue.id} style={{
                          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px',
                          background: 'var(--m3-surface-container-low)', borderRadius: 8, marginBottom: 4, fontSize: 12,
                        }}>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 6, flexShrink: 0,
                            background: issueTypeBg[issue.issue_type] ?? 'var(--m3-surface-container-low)',
                            color: issueTypeColor[issue.issue_type] ?? 'var(--m3-on-surface-variant)',
                          }}>{issueTypeLabel[issue.issue_type] ?? issue.issue_type}</span>
                          <span style={{ flex: 1, color: 'var(--m3-on-surface)' }}>{issue.description}</span>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 6, flexShrink: 0,
                            color: severityColor[issue.severity] ?? 'var(--m3-on-surface-variant)',
                            background: 'white', border: `1px solid ${severityColor[issue.severity] ?? 'var(--m3-outline-variant)'}`,
                          }}>{severityLabel[issue.severity] ?? issue.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {needs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>用户需求</div>
                      {needs.map((nc, j) => (
                        <div key={j} style={{
                          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px',
                          background: 'var(--m3-surface-container-low)', borderRadius: 8, marginBottom: 4, fontSize: 12,
                        }}>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 6, flexShrink: 0,
                            background: coverageBg[nc.coverage_level] ?? 'var(--m3-surface-container-low)',
                            color: coverageColor[nc.coverage_level] ?? 'var(--m3-on-surface-variant)',
                          }}>{coverageLabel[nc.coverage_level] ?? nc.coverage_level}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--m3-on-surface)' }}>{nc.topic}</div>
                            {nc.revision_suggestion && (
                              <div style={{ color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>{nc.revision_suggestion}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  )
}
