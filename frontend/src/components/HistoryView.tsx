import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SessionRecord, Step } from '../types'

const STEP_LABELS: Record<number, string> = {
  1: '上传数据', 2: '内容解析', 3: '质量分析',
  4: '用户需求分析', 5: '专家审核', 6: '迭代计划', 7: '生成稿件',
}

interface Props {
  sessions: SessionRecord[]
  loading?: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onResume: (session: SessionRecord) => void
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function scoreClass(s: number) {
  if (s >= 4) return 'score-high'
  if (s >= 3) return 'score-mid'
  return 'score-low'
}

function getSessionUrl(id: string) {
  return `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(id)}`
}

export default function HistoryView({ sessions, loading, onClose, onDelete, onResume }: Props) {
  const sorted = [...sessions].sort((a, b) => b.id.localeCompare(a.id))
  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null)
  const [tab, setTab] = useState<'analysis' | 'drafts'>('analysis')
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = getSessionUrl(id)
    const finish = () => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000) }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(finish).catch(() => fallbackCopy(url, finish))
    } else {
      fallbackCopy(url, finish)
    }
  }

  const fallbackCopy = (text: string, onDone: () => void) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    onDone()
  }

  const selected = sorted.find(s => s.id === selectedId) ?? null

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setTab('analysis')
    setExpandedDraft(null)
  }

  const handleDelete = (id: string, disease: string) => {
    if (confirm(`确认删除「${disease || '该任务'}」的历史记录？`)) {
      onDelete(id)
      const next = sorted.find(s => s.id !== id)
      setSelectedId(next?.id ?? null)
    }
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <div style={{ fontWeight: 600, fontSize: 15 }}>历史任务记录</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>共 {sessions.length} 条</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>关闭</button>
        </div>
      </div>

      <div className="history-layout">
        {/* Left: session list */}
        <div className="history-list">
          {loading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
              <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
              加载中...
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
              暂无历史记录
            </div>
          ) : sorted.map(s => (
            <div
              key={s.id}
              className={`history-item ${s.id === selectedId ? 'active' : ''}`}
              onClick={() => handleSelect(s.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: s.id === selectedId ? 'var(--blue)' : 'var(--gray-900)' }}>
                  {s.disease || '（未命名）'}
                </div>
                {s.currentStep && (
                  <span style={{ fontSize: 10, color: 'var(--blue)', background: 'var(--blue-light)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                    步骤{s.currentStep}
                  </span>
                )}
                {!s.currentStep && s.plan && (
                  <span className={`score ${scoreClass(s.plan.quality_report.overall_score)}`} style={{ fontSize: 10, flexShrink: 0 }}>
                    {s.plan.quality_report.overall_score.toFixed(1)}/5
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                {formatDateTime(s.id)}
                {(s.draftHistory?.length ?? 0) > 0 && ` · ${s.draftHistory.length} 份稿件`}
                {s.qaCount > 0 && ` · ${s.qaCount} 条Q&A`}
              </div>
              {s.articleSnippet && (
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                  {s.articleSnippet}
                </div>
              )}
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 10, padding: '1px 7px', color: copiedId === s.id ? 'var(--green)' : 'var(--gray-400)', background: 'transparent' }}
                  onClick={e => copyLink(s.id, e)}
                  title="复制任务链接"
                >
                  {copiedId === s.id ? '✓ 已复制' : '🔗 复制链接'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail */}
        <div className="history-detail">
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--gray-500)', fontSize: 13 }}>
              选择左侧任务查看详情
            </div>
          ) : (
            <div>
              {/* Detail header */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.disease || '（未命名）'}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                      创建于 {new Date(selected.id).toLocaleString('zh-CN')}
                      {selected.updatedAt !== selected.id && ` · 最后更新 ${formatDateTime(selected.updatedAt)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {selected.plan && (
                      <span className={`score ${scoreClass(selected.plan.quality_report.overall_score)}`}>
                        质量 {selected.plan.quality_report.overall_score.toFixed(1)}/5
                      </span>
                    )}
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: copiedId === selected.id ? 'var(--green)' : 'var(--gray-600)' }}
                      onClick={e => copyLink(selected.id, e)}
                      title={getSessionUrl(selected.id)}
                    >
                      {copiedId === selected.id ? '✓ 已复制' : '🔗 复制链接'}
                    </button>
                    <a
                      className="btn btn-outline btn-sm"
                      href={getSessionUrl(selected.id)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      新窗口打开
                    </a>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onResume(selected)}
                      title={selected.articleContent ? '恢复完整数据并继续编辑' : '词条内容未保存，仅可查看分析结果'}
                    >
                      继续编辑
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--red)', borderColor: '#fca5a5' }}
                      onClick={() => handleDelete(selected.id, selected.disease)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>

              {/* Step indicator for new sessions */}
              {selected.currentStep && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                  {([1,2,3,4,5,6,7] as number[]).map(n => (
                    <div key={n} style={{
                      padding: '4px 10px', borderRadius: 4, fontSize: 12,
                      background: n < selected.currentStep! ? 'var(--green-light)' : n === selected.currentStep ? 'var(--blue-light)' : 'var(--gray-100)',
                      color: n < selected.currentStep! ? 'var(--green)' : n === selected.currentStep ? 'var(--blue)' : 'var(--gray-400)',
                      fontWeight: n === selected.currentStep ? 700 : 400,
                    }}>
                      {n < selected.currentStep! ? '✓' : n} {STEP_LABELS[n]}
                    </div>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Q&A 数量', value: selected.qaCount || '—' },
                  { label: '章节数量', value: selected.parsedArticle?.sections.length ?? selected.plan?.gap_items.length ?? '—' },
                  { label: '生成稿件', value: (selected.draftHistory?.length ?? 0) || '—' },
                  { label: '参考文献', value: (selected.referenceDocs?.length ?? 0) || '—' },
                ].map(stat => (
                  <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs + content */}
              <div className="card">
                <div className="tabs">
                  <div className={`tab ${tab === 'analysis' ? 'active' : ''}`} onClick={() => setTab('analysis')}>
                    分析报告
                  </div>
                  <div className={`tab ${tab === 'drafts' ? 'active' : ''}`} onClick={() => setTab('drafts')}>
                    生成稿件 ({selected.draftHistory?.length ?? 0})
                  </div>
                </div>

                {/* Analysis tab — new 7-step workflow */}
                {tab === 'analysis' && (() => {
                  const sa = selected.sectionAnalyses ?? []
                  const ga = selected.gapAnalysis
                  const gi = selected.gapItems ?? []
                  const hasNew = sa.length > 0 || !!ga || gi.length > 0
                  const hasLegacy = !!selected.plan

                  if (!hasNew && !hasLegacy) return (
                    <div style={{ color: 'var(--gray-500)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
                      该任务未完成分析步骤
                    </div>
                  )

                  // ── New workflow display ──────────────────────────────────
                  if (hasNew) return (
                    <div>
                      {/* Section quality summary */}
                      {sa.length > 0 && (() => {
                        const allIssues = sa.flatMap(s => s.issues.filter(i => i.status !== 'rejected'))
                        const high = allIssues.filter(i => i.severity === 'high').length
                        const med  = allIssues.filter(i => i.severity === 'medium').length
                        const low  = allIssues.filter(i => i.severity === 'low').length
                        return (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                              内容质量审评 · 共 {allIssues.length} 个问题
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                              {[['高', high, 'var(--red)', 'var(--red-light)'], ['中', med, 'var(--orange)', 'var(--orange-light)'], ['低', low, 'var(--blue)', 'var(--blue-light)']].map(([label, count, color, bg]) => (
                                <span key={label as string} style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 4, color: color as string, background: bg as string }}>
                                  {label} {count as number}
                                </span>
                              ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {sa.filter(s => s.issues.some(i => i.status !== 'rejected')).map((s, i) => {
                                const active = s.issues.filter(i => i.status !== 'rejected')
                                return (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                                    <span style={{ color: 'var(--gray-700)', fontWeight: 500 }}>{s.section_heading}</span>
                                    <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{active.length} 个问题</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Gap analysis clusters */}
                      {ga && ga.clusters.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                            用户需求分析 · {ga.clusters.length} 类需求 · {ga.total_qa_count} 条Q&A
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {ga.clusters.slice(0, 6).map((c, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 10px', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                                <span style={{ fontWeight: 600, color: c.frequency > 100 ? 'var(--red)' : c.frequency > 50 ? 'var(--orange)' : 'var(--gray-600)', minWidth: 36 }}>{c.frequency}次</span>
                                <span style={{ flex: 1, color: 'var(--gray-700)' }}>{c.topic}</span>
                                <span style={{ color: c.covered_in_kb ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{c.covered_in_kb ? '✓' : '✗'}</span>
                              </div>
                            ))}
                            {ga.clusters.length > 6 && <div style={{ fontSize: 11, color: 'var(--gray-400)', paddingLeft: 10 }}>+{ga.clusters.length - 6} 类...</div>}
                          </div>
                        </div>
                      )}

                      {/* Gap items / iteration plan */}
                      {gi.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                            迭代计划 · {gi.length} 条
                            <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 400, color: 'var(--gray-500)' }}>
                              P0: {gi.filter(g => g.priority === 'P0').length} &nbsp; P1: {gi.filter(g => g.priority === 'P1').length} &nbsp; P2: {gi.filter(g => g.priority === 'P2').length}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {gi.map((gap, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                                <span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.priority}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: 12 }}>{gap.section}</div>
                                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{gap.description}</div>
                                </div>
                                {(selected.draftHistory ?? []).some(d => d.gap.section === gap.section) && (
                                  <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-light)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>✓ 已生成</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )

                  // ── Legacy plan display ───────────────────────────────────
                  const { quality_report: qr, gap_items } = selected.plan!
                  const dims = qr.dim_one ? [
                    { label: '内容全面', score: qr.dim_one?.score },
                    { label: '结构合理', score: qr.dim_two?.score },
                    { label: '内容准确', score: qr.dim_three?.score },
                    { label: '精炼流畅', score: qr.dim_four?.score },
                  ] : []
                  return (
                    <div>
                      {dims.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                          {dims.map(d => d.score != null && (
                            <div key={d.label} style={{ textAlign: 'center', padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, minWidth: 64 }}>
                              <div className={`score ${scoreClass(d.score)}`} style={{ fontSize: 15, fontWeight: 700, display: 'block', marginBottom: 2 }}>{d.score}/5</div>
                              <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>{d.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--gray-700)', marginBottom: 16 }}>
                        {qr.summary}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>迭代缺口计划 ({gap_items.length} 条)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {gap_items.map((gap, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                            <span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.priority}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{gap.section}</div>
                              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{gap.description}</div>
                            </div>
                            {(selected.draftHistory ?? []).some(d => d.gap.section === gap.section) && (
                              <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-light)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>✓ 已生成</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Drafts tab */}
                {tab === 'drafts' && (selected.draftHistory?.length ?? 0) === 0 && (
                  <div style={{ color: 'var(--gray-500)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
                    该任务未生成稿件
                  </div>
                )}
                {tab === 'drafts' && (selected.draftHistory ?? []).map(record => (
                  <div key={record.id} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', background: 'var(--gray-50)',
                        borderRadius: expandedDraft === record.id ? '8px 8px 0 0' : 'var(--radius)',
                        cursor: 'pointer', border: '1px solid var(--gray-200)',
                      }}
                      onClick={() => setExpandedDraft(expandedDraft === record.id ? null : record.id)}
                    >
                      <span className={`priority priority-${record.gap.priority.toLowerCase()}`}>{record.gap.priority}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{record.gap.section}</span>
                      <span style={{ fontSize: 12, color: 'var(--gray-500)', flex: 1 }}>{record.gap.description}</span>
                      <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                        {new Date(record.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--blue)' }}>{expandedDraft === record.id ? '▲' : '▼'}</span>
                    </div>
                    {expandedDraft === record.id && (
                      <div style={{ border: '1px solid var(--gray-200)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '16px 20px' }}>
                        {record.draft.key_changes.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                            {record.draft.key_changes.map((c, j) => (
                              <span key={j} style={{ padding: '2px 8px', background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 4, fontSize: 11 }}>{c}</span>
                            ))}
                          </div>
                        )}
                        <div className="md" style={{ fontSize: 13, lineHeight: 1.7 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{record.editedContent}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
