import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { ReferenceAnchor, SessionRecord, Step } from '../types'
import {
  buildReferenceAnchorsFromDocs,
  createCitationResolver,
  formatCitationSourceLabel,
  linkifyCitationMarkers,
  mergeReferenceAnchors,
} from '../utils/citations'
import { filterHistorySessions, isOwnHistorySession } from '../utils/historyFilters'
import { markdownRemarkPlugins } from '../utils/markdown'

const STEP_LABELS: Record<number, string> = {
  1: '上传数据', 2: '参考文献审核', 3: '内容解析',
  4: '内容质量评审', 5: '用户需求分析', 6: '审核与迭代计划', 7: '生成稿件', 8: 'AI整合',
}

const STEP_ICONS: Record<number, string> = {
  1: 'cloud_upload', 2: 'library_books', 3: 'psychology',
  4: 'fact_check', 5: 'group', 6: 'edit_note', 7: 'auto_awesome', 8: 'hub',
}

const TOTAL_STEPS = 8

interface Props {
  sessions: SessionRecord[]
  currentUserId: string
  isAdmin?: boolean
  loading?: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onClone: (id: string) => void
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

function HistoryCitationPanel({
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

export default function HistoryView({ sessions, currentUserId, isAdmin, loading, onClose, onDelete, onClone, onResume }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'analysis' | 'drafts'>('analysis')
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null)
  const [activeCitationKey, setActiveCitationKey] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const filteredSessions = useMemo(
    () => filterHistorySessions(sessions, currentUserId, onlyMine),
    [sessions, currentUserId, onlyMine],
  )
  const sorted = useMemo(
    () => [...filteredSessions].sort((a, b) => b.id.localeCompare(a.id)),
    [filteredSessions],
  )
  const ownTaskCount = useMemo(
    () => sessions.filter(s => isOwnHistorySession(s, currentUserId)).length,
    [sessions, currentUserId],
  )

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
  const expandedDraftRecord = selected?.draftHistory.find(record => record.id === expandedDraft) ?? null
  const referenceAnchors = useMemo(() => {
    return mergeReferenceAnchors(
      buildReferenceAnchorsFromDocs(selected?.referenceDocs ?? []),
      expandedDraftRecord?.draft.reference_anchors ?? [],
    )
  }, [expandedDraftRecord?.draft.reference_anchors, selected?.referenceDocs])
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
  const renderedExpandedDraftContent = useMemo(
    () => expandedDraftRecord
      ? linkifyCitationMarkers(expandedDraftRecord.editedContent, resolveCitation)
      : '',
    [expandedDraftRecord?.editedContent, resolveCitation],
  )

  useEffect(() => {
    if (selectedId && !sorted.some(s => s.id === selectedId)) {
      setSelectedId(null)
      setExpandedDraft(null)
    }
  }, [selectedId, sorted])

  useEffect(() => {
    setActiveCitationKey(null)
  }, [selectedId, expandedDraft])

  useEffect(() => {
    if (activeCitationKey && !citationKeySet.has(activeCitationKey)) {
      setActiveCitationKey(null)
    }
  }, [activeCitationKey, citationKeySet])

  const handleSelect = (id: string) => {
    setSelectedId(prev => prev === id ? null : id)
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

  const handleClone = (id: string, disease: string) => {
    if (confirm(`确认复制「${disease || '该任务'}」为新的任务副本？`)) {
      onClone(id)
    }
  }

  // Stats
  const totalTasks = filteredSessions.length
  const completedTasks = filteredSessions.filter(s => (s.draftHistory?.length ?? 0) > 0).length
  const inProgressTasks = totalTasks - completedTasks

  return (
    <div>
      {/* Page header */}
      <div className="history-page-header">
        <div>
          <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 4 }}>
            任务历史
          </h2>
          <p style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)' }}>
            查看和管理所有编辑审评任务
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className={`btn-m3-outline ${onlyMine ? 'active' : ''}`}
            onClick={() => setOnlyMine(v => !v)}
            title={onlyMine ? '显示全部任务' : '只显示自己创建的任务'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {onlyMine ? 'person_check' : 'person'}
            </span>
            {onlyMine ? `我的任务 (${ownTaskCount})` : '只看我的'}
          </button>
          <button className="btn-m3-outline" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            返回工作台
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="history-stat-inline" style={{ borderLeftColor: 'var(--m3-primary)' }}>
          <span className="history-stat-inline-value" style={{ color: 'var(--m3-primary)' }}>{totalTasks}</span>
          <span className="history-stat-inline-label">全部任务</span>
        </div>
        <div className="history-stat-inline" style={{ borderLeftColor: 'var(--m3-tertiary)' }}>
          <span className="history-stat-inline-value" style={{ color: 'var(--m3-tertiary)' }}>{completedTasks}</span>
          <span className="history-stat-inline-label">已完成</span>
        </div>
        <div className="history-stat-inline" style={{ borderLeftColor: 'var(--m3-secondary)' }}>
          <span className="history-stat-inline-value" style={{ color: 'var(--m3-secondary)' }}>{inProgressTasks}</span>
          <span className="history-stat-inline-label">进行中</span>
        </div>
      </div>

      <div>
          <div className="history-task-list">
            {/* Column header */}
            <div className="history-task-header">
              <span style={{ flex: 2 }}>任务名称</span>
              <span style={{ flex: 1 }}>状态</span>
              <span style={{ flex: 1 }}>进度</span>
              <span style={{ flex: 1 }}>更新时间</span>
              <span style={{ width: isAdmin ? 156 : 120, textAlign: 'right' }}>操作</span>
            </div>

            {loading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--m3-on-surface-variant)', fontSize: 13 }}>
                <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
                加载中...
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--m3-on-surface-variant)', fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.4 }}>inbox</span>
                {onlyMine ? '暂无自己创建的任务' : '暂无历史记录'}
              </div>
            ) : sorted.map(s => {
              const isSelected = s.id === selectedId
              const hasDrafts = (s.draftHistory?.length ?? 0) > 0
              const isOwn = isOwnHistorySession(s, currentUserId)
              const canEdit = isOwn || !!isAdmin
              return (
                <div key={s.id}>
                  <div
                    className={`history-task-row ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelect(s.id)}
                  >
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: hasDrafts ? 'var(--m3-tertiary)' : 'var(--m3-on-surface-variant)' }}>
                        {hasDrafts ? 'check_circle' : 'description'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--m3-on-surface)' }}>
                          {s.disease || '（未命名）'}
                        </div>
                        {s.owner_email && !isOwn && (
                          <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 1 }}>by {s.owner_email}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 999,
                        background: hasDrafts ? 'var(--dui-success-container)' : 'var(--dui-primary-container)',
                        color: hasDrafts ? 'var(--m3-tertiary)' : 'var(--m3-primary)',
                      }}>
                        {hasDrafts ? '已完成' : '进行中'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      {s.currentStep && (
                        <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
                          步骤 {s.currentStep}/{TOTAL_STEPS}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
                      {formatDateTime(s.updatedAt || s.id)}
                    </div>
                    <div style={{ width: isAdmin ? 156 : 120, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button
                        className="btn-m3-icon"
                        onClick={e => copyLink(s.id, e)}
                        title="复制链接"
                        style={{ width: 28, height: 28 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: copiedId === s.id ? 'var(--m3-tertiary)' : undefined }}>
                          {copiedId === s.id ? 'check' : 'link'}
                        </span>
                      </button>
                      <button
                        className="btn-m3-icon"
                        onClick={e => { e.stopPropagation(); onResume(s) }}
                        title={canEdit ? '继续编辑' : '查看'}
                        style={{ width: 28, height: 28 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {canEdit ? 'edit' : 'visibility'}
                        </span>
                      </button>
                      {isAdmin && (
                        <button
                          className="btn-m3-icon"
                          onClick={e => { e.stopPropagation(); handleClone(s.id, s.disease) }}
                          title="复制为新任务"
                          style={{ width: 28, height: 28 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                        </button>
                      )}
                      {canEdit && (
                        <button
                          className="btn-m3-icon"
                          onClick={e => { e.stopPropagation(); handleDelete(s.id, s.disease) }}
                          title="删除"
                          style={{ width: 28, height: 28 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--m3-error)' }}>delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isSelected && selected && (
                    <div style={{ padding: '16px 20px', background: 'var(--m3-surface-container-lowest)', borderBottom: '0.5px solid var(--dui-divider)' }}>
                      {/* Detail header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 16, color: 'var(--m3-on-surface)' }}>{selected.disease || '（未命名）'}</div>
                          <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 4 }}>
                            创建于 {new Date(selected.id).toLocaleString('zh-CN')}
                            {selected.updatedAt !== selected.id && ` · 最后更新 ${formatDateTime(selected.updatedAt)}`}
                            {selected.owner_email && ` · ${selected.owner_email}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {selected.owner_id && selected.owner_id !== currentUserId && (
                            <span style={{ fontSize: 12, color: 'var(--dui-warning)', background: 'var(--dui-warning-container)', padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>
                              {isAdmin ? '管理员编辑他人任务' : '他人任务'}
                            </span>
                          )}
                          <a
                            className="btn-m3-outline"
                            href={getSessionUrl(selected.id)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: 'none', fontSize: 12, padding: '5px 12px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                            新窗口
                          </a>
                          <button className="btn-gradient" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => onResume(selected)}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                              {selected.owner_id && selected.owner_id !== currentUserId && !isAdmin ? 'visibility' : 'edit'}
                            </span>
                            {selected.owner_id && selected.owner_id !== currentUserId && !isAdmin ? '查看' : '继续编辑'}
                          </button>
                        </div>
                      </div>

                      {/* Step indicator */}
                      {selected.currentStep && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                          {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map(n => (
                            <div key={n} style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: n < selected.currentStep! ? 'var(--dui-success-container)' : n === selected.currentStep ? 'var(--dui-primary-container)' : 'var(--m3-surface-container-low)',
                              color: n < selected.currentStep! ? 'var(--m3-tertiary)' : n === selected.currentStep ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: n < selected.currentStep! ? "'FILL' 1" : "'FILL' 0" }}>
                                {n < selected.currentStep! ? 'check_circle' : STEP_ICONS[n]}
                              </span>
                              {STEP_LABELS[n]}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Stats row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                        {[
                          { label: 'Q&A', value: selected.qaCount || '—', icon: 'forum' },
                          { label: '章节', value: selected.parsedArticle?.sections.length ?? selected.plan?.gap_items.length ?? '—', icon: 'view_list' },
                          { label: '稿件', value: (selected.draftHistory?.length ?? 0) || '—', icon: 'draft' },
                          { label: '文献', value: (selected.referenceDocs?.length ?? 0) || '—', icon: 'menu_book' },
                        ].map(stat => (
                          <div key={stat.label} className="section-card" style={{ textAlign: 'center', padding: '12px 0' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)', marginBottom: 2 }}>{stat.icon}</span>
                            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--m3-primary)' }}>{stat.value}</div>
                            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Tabs + content */}
                      <div className="section-card" style={{ padding: 0 }}>
                        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--dui-divider)' }}>
                          {(['analysis', 'drafts'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => setTab(t)}
                              style={{
                                padding: '10px 20px',
                                fontSize: 13, fontWeight: tab === t ? 600 : 400,
                                color: tab === t ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                                background: 'none', border: 'none',
                                borderBottom: tab === t ? '2px solid var(--m3-primary)' : '2px solid transparent',
                                marginBottom: -2, cursor: 'pointer',
                              }}
                            >
                              {t === 'analysis' ? '分析报告' : `生成稿件 (${selected.draftHistory?.length ?? 0})`}
                            </button>
                          ))}
                        </div>

                        <div style={{ padding: '16px 20px' }}>
                          {/* Analysis tab */}
                          {tab === 'analysis' && (() => {
                            const sa = selected.sectionAnalyses ?? []
                            const ga = selected.gapAnalysis
                            const gi = selected.gapItems ?? []
                            const hasNew = sa.length > 0 || !!ga || gi.length > 0
                            const hasLegacy = !!selected.plan

                            if (!hasNew && !hasLegacy) return (
                              <div style={{ color: 'var(--m3-on-surface-variant)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 28, display: 'block', marginBottom: 6, opacity: 0.4 }}>analytics</span>
                                该任务未完成分析步骤
                              </div>
                            )

                            if (hasNew) return (
                              <div>
                                {sa.length > 0 && (() => {
                                  const allIssues = sa.flatMap(s => s.issues.filter(i => i.status !== 'rejected'))
                                  const high = allIssues.filter(i => i.severity === 'high').length
                                  const med  = allIssues.filter(i => i.severity === 'medium').length
                                  const low  = allIssues.filter(i => i.severity === 'low').length
                                  return (
                                    <div style={{ marginBottom: 20 }}>
                                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10, color: 'var(--m3-on-surface)' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>fact_check</span>
                                        内容质量评审 · 共 {allIssues.length} 个问题
                                      </div>
                                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                        {[['高', high, 'var(--dui-danger)', 'var(--dui-danger-container)'], ['中', med, 'var(--dui-warning)', 'var(--dui-warning-container)'], ['低', low, 'var(--dui-primary)', 'var(--dui-primary-container)']].map(([label, count, color, bg]) => (
                                          <span key={label as string} style={{ fontSize: 12, fontWeight: 500, padding: '3px 12px', borderRadius: 999, color: color as string, background: bg as string }}>
                                            {label} {count as number}
                                          </span>
                                        ))}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {sa.filter(s => s.issues.some(i => i.status !== 'rejected')).map((s, i) => {
                                          const active = s.issues.filter(i => i.status !== 'rejected')
                                          return (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--m3-surface-container-low)', borderRadius: 6, fontSize: 12 }}>
                                              <span style={{ color: 'var(--m3-on-surface)', fontWeight: 500 }}>{s.section_heading}</span>
                                              <span style={{ color: 'var(--dui-warning)', fontWeight: 500 }}>{active.length} 个问题</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })()}

                                {ga && ga.clusters.length > 0 && (
                                  <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10, color: 'var(--m3-on-surface)' }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>group</span>
                                      用户需求分析 · {ga.clusters.length} 类需求 · {ga.total_qa_count} 条Q&A
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {ga.clusters.slice(0, 6).map((c, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 12px', background: 'var(--m3-surface-container-low)', borderRadius: 6, fontSize: 12 }}>
                                          <span style={{ fontWeight: 500, color: c.frequency > 100 ? 'var(--dui-danger)' : c.frequency > 50 ? 'var(--dui-warning)' : 'var(--dui-text-sub)', minWidth: 36 }}>{c.frequency}次</span>
                                          <span style={{ flex: 1, color: 'var(--m3-on-surface)' }}>{c.topic}</span>
                                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: c.covered_in_kb ? 'var(--m3-tertiary)' : 'var(--m3-error)' }}>
                                            {c.covered_in_kb ? 'check_circle' : 'cancel'}
                                          </span>
                                        </div>
                                      ))}
                                      {ga.clusters.length > 6 && <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', paddingLeft: 12 }}>+{ga.clusters.length - 6} 类...</div>}
                                    </div>
                                  </div>
                                )}

                                {gi.length > 0 && (
                                  <div>
                                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10, color: 'var(--m3-on-surface)' }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>edit_note</span>
                                      迭代计划 · {gi.length} 条
                                      <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: 'var(--m3-on-surface-variant)' }}>
                                        P0: {gi.filter(g => g.priority === 'P0').length} &nbsp; P1: {gi.filter(g => g.priority === 'P1').length} &nbsp; P2: {gi.filter(g => g.priority === 'P2').length}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {gi.map((gap, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'var(--m3-surface-container-low)', borderRadius: 6 }}>
                                          <span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.priority}</span>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--m3-on-surface)' }}>{gap.section}</div>
                                            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>{gap.description}</div>
                                          </div>
                                          {(selected.draftHistory ?? []).some(d => d.gap.section === gap.section) && (
                                            <span style={{ fontSize: 12, color: 'var(--m3-tertiary)', background: 'var(--dui-success-container)', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                              <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: -2 }}>check</span> 已生成
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )

                            // Legacy plan display
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
                                      <div key={d.label} style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--m3-surface-container-low)', borderRadius: 8, minWidth: 64 }}>
                                        <div className={`score ${scoreClass(d.score)}`} style={{ fontSize: 16, fontWeight: 500, display: 'block', marginBottom: 2 }}>{d.score}/5</div>
                                        <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>{d.label}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ padding: '12px 16px', background: 'var(--m3-surface-container-low)', borderRadius: 8, fontSize: 13, color: 'var(--m3-on-surface)', marginBottom: 16, lineHeight: 1.6 }}>
                                  {qr.summary}
                                </div>
                                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10, color: 'var(--m3-on-surface)' }}>迭代缺口计划 ({gap_items.length} 条)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {gap_items.map((gap, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'var(--m3-surface-container-low)', borderRadius: 6 }}>
                                      <span className={`priority priority-${gap.priority.toLowerCase()}`}>{gap.priority}</span>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--m3-on-surface)' }}>{gap.section}</div>
                                        <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>{gap.description}</div>
                                      </div>
                                      {(selected.draftHistory ?? []).some(d => d.gap.section === gap.section) && (
                                        <span style={{ fontSize: 12, color: 'var(--m3-tertiary)', background: 'var(--dui-success-container)', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                          <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: -2 }}>check</span> 已生成
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}

                          {/* Drafts tab */}
                          {tab === 'drafts' && (selected.draftHistory?.length ?? 0) === 0 && (
                            <div style={{ color: 'var(--m3-on-surface-variant)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 28, display: 'block', marginBottom: 6, opacity: 0.4 }}>draft</span>
                              该任务未生成稿件
                            </div>
                          )}
                          {tab === 'drafts' && (selected.draftHistory ?? []).map(record => (
                            <div key={record.id} style={{ marginBottom: 10 }}>
                              <div
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 14px', background: 'var(--m3-surface-container-low)',
                                  borderRadius: expandedDraft === record.id ? '8px 8px 0 0' : '8px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setExpandedDraft(expandedDraft === record.id ? null : record.id)}
                              >
                                <span className={`priority priority-${record.gap.priority.toLowerCase()}`}>{record.gap.priority}</span>
                                <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--m3-on-surface)' }}>{record.gap.section}</span>
                                <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', flex: 1 }}>{record.gap.description}</span>
                                <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
                                  {new Date(record.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-on-surface-variant)', transition: 'transform 0.2s', transform: expandedDraft === record.id ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                              </div>
                              {expandedDraft === record.id && (
                                <div style={{ border: '0.5px solid var(--dui-divider)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '16px 20px' }}>
                                  {record.draft.key_changes.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                      {record.draft.key_changes.map((c, j) => (
                                        <span key={j} style={{ padding: '3px 10px', background: 'var(--dui-primary-container)', color: 'var(--m3-primary)', borderRadius: 999, fontSize: 12, fontWeight: 500 }}>{c}</span>
                                      ))}
                                    </div>
                                  )}
                                  <div className={`draft-preview-shell${activeCitation && record.id === expandedDraft ? ' has-citation-panel' : ''}`}>
                                    <div className="md" style={{ fontSize: 13, lineHeight: 1.7 }}>
                                      <ReactMarkdown remarkPlugins={markdownRemarkPlugins} components={markdownComponents}>
                                        {record.id === expandedDraft ? renderedExpandedDraftContent : record.editedContent}
                                      </ReactMarkdown>
                                    </div>
                                    {activeCitation && record.id === expandedDraft && (
                                      <HistoryCitationPanel
                                        anchor={activeCitation}
                                        onClose={() => setActiveCitationKey(null)}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Footer info */}
            {sorted.length > 0 && (
              <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--m3-on-surface-variant)', textAlign: 'center', borderTop: '0.5px solid var(--dui-divider)' }}>
                共 {filteredSessions.length} 条记录{onlyMine && sessions.length !== filteredSessions.length ? ` · 已隐藏 ${sessions.length - filteredSessions.length} 条他人任务` : ''}
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
