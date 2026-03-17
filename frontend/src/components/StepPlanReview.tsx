import React, { useState, useEffect, useMemo } from 'react'
import { SectionAnalysis, GapAnalysis, GapItem, DraftRecord, ParsedArticle } from '../types'

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
      const res = await fetch('/api/analyze/plan-from-gap', {
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

  const priorityColors: Record<string, string> = { P0: 'var(--red)', P1: 'var(--orange)', P2: 'var(--blue)' }
  const priorityBg: Record<string, string> = { P0: 'var(--red-light)', P1: 'var(--orange-light)', P2: 'var(--blue-light)' }
  const coverageBg: Record<string, string> = { partial: 'var(--orange-light)', missing: 'var(--red-light)' }
  const coverageColor: Record<string, string> = { partial: 'var(--orange)', missing: 'var(--red)' }
  const coverageLabel: Record<string, string> = { partial: '部分覆盖', missing: '未覆盖' }
  const severityColor: Record<string, string> = { high: 'var(--red)', medium: 'var(--orange)', low: 'var(--blue)' }
  const severityLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
  const issueTypeLabel: Record<string, string> = {
    missing_content: '内容缺失',
    structure: '结构问题',
    accuracy: '准确性',
    outdated: '内容过时',
    style: '表达风格',
  }
  const issueTypeBg: Record<string, string> = {
    missing_content: 'var(--red-light)',
    accuracy: 'var(--red-light)',
    outdated: 'var(--orange-light)',
    structure: 'var(--blue-light)',
    style: '#f5f3ff',
  }
  const issueTypeColor: Record<string, string> = {
    missing_content: 'var(--red)',
    accuracy: 'var(--red)',
    outdated: 'var(--orange)',
    structure: 'var(--blue)',
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
    const subHeadingColor = depth === 1 ? 'var(--gray-700)' : 'var(--gray-500)'
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
            <span style={{ color: 'var(--gray-300)', fontSize: 10 }}>{'▸'}</span>
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
              border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)',
              background: 'white', marginBottom: 6,
            }}>
              {/* Reorder */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button className="btn btn-sm"
                  style={{ padding: '1px 5px', color: 'var(--gray-400)', fontSize: 10 }}
                  onClick={() => moveItem(i, i - 1)} disabled={i === 0} title="上移">▲</button>
                <button className="btn btn-sm"
                  style={{ padding: '1px 5px', color: 'var(--gray-400)', fontSize: 10 }}
                  onClick={() => moveItem(i, i + 1)} disabled={i >= gapItems.length - 1} title="下移">▼</button>
              </div>

              {/* Priority badge */}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                flexShrink: 0, alignSelf: 'flex-start', marginTop: 1,
                background: priorityBg[g.priority] ?? 'var(--gray-100)',
                color: priorityColors[g.priority] ?? 'var(--gray-700)',
              }}>{g.priority}</span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingIdx === i ? (
                  <div>
                    <textarea className="textarea" value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      style={{ minHeight: 80, fontSize: 12, marginBottom: 6 }} />
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-primary" onClick={() => saveEdit(i)}>保存</button>
                      <button className="btn btn-sm btn-outline" onClick={() => setEditingIdx(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.8 }}>
                    {g.description}
                  </div>
                )}
                {g.qa_frequency ? (
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                    用户提问约 {g.qa_frequency} 次
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignSelf: 'flex-start' }}>
                {generated ? (
                  <button className="btn btn-sm btn-green" style={{ fontSize: 11 }}
                    onClick={() => onNext(g)} title="已生成，点击查看">✓ 已生成</button>
                ) : (
                  <button className="btn btn-sm btn-outline" style={{ fontSize: 11 }}
                    onClick={() => onNext(g)}>生成</button>
                )}
                {editingIdx !== i && (
                  <button className="btn btn-sm btn-outline" style={{ fontSize: 11 }}
                    onClick={() => startEdit(i)}>编辑</button>
                )}
                <button className="btn btn-sm"
                  style={{ fontSize: 11, color: 'var(--red)', padding: '2px 8px' }}
                  onClick={() => remove(i)} title="删除此条">✕</button>
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
    <div className="loading">
      <div className="spinner" />
      <div>正在生成迭代计划...</div>
      <div className="text-sm text-muted">AI 正在综合质量问题和用户需求，按章节结构生成改进任务</div>
    </div>
  )

  if (error) return (
    <div className="card">
      <div className="alert alert-error">{error}</div>
      <div className="flex gap-2">
        <button className="btn btn-outline" onClick={onBack}>← 返回需求分析</button>
        <button className="btn btn-primary" onClick={generate}>重试</button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
          {confirmedIssues} 质量问题
        </span>
        <span style={{ background: 'var(--orange-light)', color: 'var(--orange)', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
          {confirmedNeeds} 需求问题
        </span>
        <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
          {gapItems.length} 计划任务
        </span>
        <button className="btn btn-outline btn-sm" onClick={generate} style={{ marginLeft: 'auto' }}>
          重新生成计划
        </button>
      </div>

      {/* Plan — section-grouped */}
      <div className="card">
        <div className="card-title">
          <span className="icon" style={{ background: '#f0fdf4' }}>📋</span>
          内容迭代计划
          <span className="tag text-muted">按章节顺序排列，可编辑、删除</span>
        </div>

        {gapItems.length === 0 && (
          <div className="text-muted text-sm" style={{ padding: '20px 0', textAlign: 'center' }}>
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
                  fontSize: 13, fontWeight: 700, color: 'var(--gray-800)',
                  borderBottom: '2px solid var(--gray-200)',
                  paddingBottom: 6, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {sectionName}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)' }}>
                    {indices.length} 项
                  </span>
                </div>
                {renderTreeNode(tree, 0)}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn btn-outline btn-sm" onClick={addTask}>+ 补充任务</button>
        </div>
      </div>

      {/* Collapsible audit summary */}
      <div className="card" style={{ marginTop: 12 }}>
        <button
          onClick={() => setAuditExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none',
            border: 'none', cursor: 'pointer', width: '100%', padding: 0,
            fontSize: 14, fontWeight: 600, color: 'var(--gray-700)',
          }}
        >
          <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: auditExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          已确认问题汇总
          <span className="text-muted text-sm" style={{ fontWeight: 400 }}>（第3、4步确认的问题）</span>
        </button>

        {auditExpanded && (
          <div style={{ marginTop: 16 }}>
            {auditSections.length === 0 ? (
              <div style={{ color: '#16a34a', fontSize: 13, padding: '8px 0' }}>✓ 所有问题已处理</div>
            ) : (
              auditSections.map(({ sa, issues, needs }) => (
                <div key={sa.section_id} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gray-800)' }}>
                    {sa.section_heading}
                  </div>

                  {issues.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>质量问题</div>
                      {issues.map(issue => (
                        <div key={issue.id} style={{
                          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px',
                          background: 'var(--gray-50)', borderRadius: 6, marginBottom: 4, fontSize: 12,
                        }}>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                            background: issueTypeBg[issue.issue_type] ?? 'var(--gray-100)',
                            color: issueTypeColor[issue.issue_type] ?? 'var(--gray-600)',
                          }}>{issueTypeLabel[issue.issue_type] ?? issue.issue_type}</span>
                          <span style={{ flex: 1, color: 'var(--gray-700)' }}>{issue.description}</span>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                            color: severityColor[issue.severity] ?? 'var(--gray-600)',
                            background: 'white', border: `1px solid ${severityColor[issue.severity] ?? 'var(--gray-300)'}`,
                          }}>{severityLabel[issue.severity] ?? issue.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {needs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>用户需求</div>
                      {needs.map((nc, j) => (
                        <div key={j} style={{
                          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px',
                          background: 'var(--gray-50)', borderRadius: 6, marginBottom: 4, fontSize: 12,
                        }}>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                            background: coverageBg[nc.coverage_level] ?? 'var(--gray-100)',
                            color: coverageColor[nc.coverage_level] ?? 'var(--gray-600)',
                          }}>{coverageLabel[nc.coverage_level] ?? nc.coverage_level}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{nc.topic}</div>
                            {nc.revision_suggestion && (
                              <div style={{ color: 'var(--gray-500)', marginTop: 2 }}>{nc.revision_suggestion}</div>
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

      <div className="flex justify-between items-center mt-4">
        <button className="btn btn-outline" onClick={onBack}>← 返回需求分析</button>
        <div className="flex gap-2 items-center">
          <span className="text-muted text-sm">
            {draftHistory.length > 0
              ? `已生成 ${draftHistory.length} / ${gapItems.length} 条稿件`
              : '点击各条目的「生成」按钮开始生成稿件'}
          </span>
          {draftHistory.length > 0 && (
            <button className="btn btn-primary" onClick={() => onNext(draftHistory[draftHistory.length - 1].gap)}>
              开始生成内容 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
