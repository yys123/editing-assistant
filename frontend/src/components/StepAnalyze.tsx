import { useState, useEffect } from 'react'
import { QAItem, IterationPlan, GapItem, DraftRecord, IssueItem, QualityReport, FullAnalysisResult, DimOneReport, DimTwoReport, DimThreeReport, DimFourReport } from '../types'
import { apiFetch } from '../api'

type AnalyzePhase = 'analyzing' | 'reviewing' | 'planning' | 'done'
type DimKey = 'dim_one' | 'dim_two' | 'dim_three' | 'dim_four'

interface Props {
  disease: string
  articleContent: string
  qaItems: QAItem[]
  plan: IterationPlan | null
  setPlan: (p: IterationPlan) => void
  selectedGap: GapItem | null
  setSelectedGap: (g: GapItem) => void
  draftHistory: DraftRecord[]
  onNext: () => void
  onBack: () => void
}

function scoreClass(s: number) {
  if (s >= 4) return 'score-high'
  if (s >= 3) return 'score-mid'
  return 'score-low'
}

const SEV_CONFIG = {
  high:   { label: '高', bg: 'var(--red-light)',    color: 'var(--red)' },
  medium: { label: '中', bg: 'var(--orange-light)', color: 'var(--orange)' },
  low:    { label: '低', bg: 'var(--blue-light)',   color: 'var(--blue)' },
}

// ─── IssueRow ─────────────────────────────────────────────────────────────────

interface IssueRowProps {
  issue: IssueItem
  expanded: boolean
  onToggle: () => void
  onUpdate: (changes: Partial<IssueItem>) => void
  onDelete?: () => void
}

function IssueRow({ issue, expanded, onToggle, onUpdate, onDelete }: IssueRowProps) {
  const sev = SEV_CONFIG[issue.severity] ?? SEV_CONFIG.medium
  const isRejected = issue.status === 'rejected'
  const isConfirmed = issue.status === 'confirmed'
  const isAdded = issue.status === 'added'

  const cycleSeverity = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next: Record<string, 'high' | 'medium' | 'low'> = { high: 'medium', medium: 'low', low: 'high' }
    onUpdate({ severity: next[issue.severity] })
  }

  return (
    <div className={`issue-row${isRejected ? ' rejected' : ''}${isConfirmed ? ' confirmed' : ''}${isAdded ? ' added' : ''}`}>
      <div className="issue-row-header" onClick={onToggle}>
        <span
          className="severity-badge"
          style={{ background: sev.bg, color: sev.color }}
          onClick={cycleSeverity}
          title="点击切换优先级"
        >
          {sev.label}
        </span>
        {isAdded && <span style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 500, flexShrink: 0 }}>专家补充</span>}
        {isConfirmed && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500, flexShrink: 0 }}>已确认</span>}
        <span className="issue-description">{issue.description || '（点击展开填写问题描述）'}</span>
        {issue.reviewer_note && <span style={{ fontSize: 12, color: 'var(--gray-500)', flexShrink: 0 }}>💬</span>}
        <div className="issue-actions" onClick={e => e.stopPropagation()}>
          {!isRejected && !isConfirmed && (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--green-light)', color: 'var(--green)' }}
              onClick={() => onUpdate({ status: 'confirmed' })}
              title="确认此问题"
            >✓ 确认</button>
          )}
          {isConfirmed && (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--green-light)', color: 'var(--green)' }}
              onClick={() => onUpdate({ status: 'ai' })}
            >✓ 已确认</button>
          )}
          {!isRejected ? (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--red-light)', color: 'var(--red)' }}
              onClick={() => onUpdate({ status: 'rejected' })}
              title="标记为无效（不纳入计划）"
            >✕ 排除</button>
          ) : (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--gray-100)', color: 'var(--gray-500)' }}
              onClick={() => onUpdate({ status: 'ai' })}
            >恢复</button>
          )}
          {onDelete && (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', color: 'var(--red)' }}
              onClick={onDelete}
              title="删除此条目"
            >删除</button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="issue-expanded">
          <textarea
            className="textarea"
            value={issue.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="描述发现的问题..."
            style={{ minHeight: 56, marginBottom: 8, fontSize: 13 }}
          />
          {issue.examples.length > 0 && (
            <div className="text-sm text-muted" style={{ marginBottom: 8 }}>
              AI示例：{issue.examples.join('；')}
            </div>
          )}
          <input
            className="input"
            value={issue.reviewer_note}
            onChange={e => onUpdate({ reviewer_note: e.target.value })}
            placeholder="审核备注（可选，会传递给计划生成）..."
            style={{ fontSize: 12 }}
          />
        </div>
      )}
    </div>
  )
}

// ─── SubcatSection ─────────────────────────────────────────────────────────────

interface SubcatProps {
  label: string
  issues: IssueItem[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onUpdateIssue: (id: string, changes: Partial<IssueItem>) => void
  onAddIssue: () => void
  onRemoveIssue: (id: string) => void
}

function SubcatSection({ label, issues, expandedId, setExpandedId, onUpdateIssue, onAddIssue, onRemoveIssue }: SubcatProps) {
  const active = issues.filter(i => i.status !== 'rejected').length
  return (
    <div className="review-subcat">
      <div className="review-subcat-header">
        <span>{label}</span>
        <span style={{ color: active > 0 ? 'var(--orange)' : 'var(--green)', fontWeight: 500 }}>
          {active > 0 ? `${active} 个问题` : '无问题'}
        </span>
      </div>
      {issues.length === 0 && (
        <div className="text-sm text-muted" style={{ padding: '4px 0 8px' }}>AI未发现问题</div>
      )}
      {issues.map(issue => (
        <IssueRow
          key={issue.id}
          issue={issue}
          expanded={expandedId === issue.id}
          onToggle={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
          onUpdate={changes => onUpdateIssue(issue.id, changes)}
          onDelete={issue.status === 'added' ? () => onRemoveIssue(issue.id) : undefined}
        />
      ))}
      <button className="btn btn-sm btn-outline" style={{ marginTop: 4 }} onClick={onAddIssue}>
        + 补充问题
      </button>
    </div>
  )
}

// ─── DimCard ───────────────────────────────────────────────────────────────────

interface DimCardProps {
  dimKey: DimKey
  title: string
  description: string
  dim: DimOneReport | DimTwoReport | DimThreeReport | DimFourReport
  subcats: { key: string; label: string }[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onUpdateIssue: (subcatKey: string, id: string, changes: Partial<IssueItem>) => void
  onAddIssue: (subcatKey: string) => void
  onRemoveIssue: (subcatKey: string, id: string) => void
  onUpdateDim: (changes: Partial<DimOneReport | DimTwoReport | DimThreeReport | DimFourReport>) => void
}

function DimCard({ title, description, dim, subcats, expandedId, setExpandedId, onUpdateIssue, onAddIssue, onRemoveIssue, onUpdateDim }: DimCardProps) {
  const [showComment, setShowComment] = useState(false)
  const totalActive = subcats.reduce((acc, s) => {
    const issues = (dim as any)[s.key] as IssueItem[]
    return acc + issues.filter((i: IssueItem) => i.status !== 'rejected').length
  }, 0)

  return (
    <div className={`dim-card${dim.approved ? ' approved' : ''}`}>
      <div className="dim-card-header">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--gray-900)', marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>评分</span>
            <select
              value={dim.score}
              onChange={e => onUpdateDim({ score: parseInt(e.target.value) } as any)}
              style={{ padding: '2px 4px', border: '0.5px solid var(--dui-divider)', borderRadius: 4, fontSize: 13, fontWeight: 500 }}
            >
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>/5</span>
          </div>
          {totalActive > 0 && (
            <span style={{ background: 'var(--orange-light)', color: 'var(--orange)', padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 500 }}>
              {totalActive} 项问题
            </span>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: dim.approved ? 'var(--green)' : 'var(--gray-500)' }}>
            <input
              type="checkbox"
              checked={dim.approved}
              onChange={e => onUpdateDim({ approved: e.target.checked } as any)}
              style={{ cursor: 'pointer' }}
            />
            {dim.approved ? '✓ 已审核' : '标记审核完成'}
          </label>
        </div>
      </div>

      <div className="dim-card-body">
        {subcats.map(s => (
          <SubcatSection
            key={s.key}
            label={s.label}
            issues={(dim as any)[s.key] as IssueItem[]}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onUpdateIssue={(id, changes) => onUpdateIssue(s.key, id, changes)}
            onAddIssue={() => onAddIssue(s.key)}
            onRemoveIssue={id => onRemoveIssue(s.key, id)}
          />
        ))}

        <div style={{ borderTop: '0.5px solid var(--dui-divider)', paddingTop: 10, marginTop: 4 }}>
          {showComment || dim.reviewer_comment ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-700)', marginBottom: 4 }}>审核意见：</div>
              <textarea
                className="textarea"
                value={dim.reviewer_comment}
                onChange={e => onUpdateDim({ reviewer_comment: e.target.value } as any)}
                placeholder="对该维度的整体审核意见（会传递给计划生成参考）..."
                style={{ minHeight: 56, fontSize: 12 }}
              />
            </div>
          ) : (
            <button
              className="btn btn-sm btn-outline"
              style={{ fontSize: 12 }}
              onClick={() => setShowComment(true)}
            >
              + 添加审核意见
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StepAnalyze({ disease, articleContent, qaItems, plan, setPlan, selectedGap, setSelectedGap, draftHistory, onNext, onBack }: Props) {
  const [phase, setPhase] = useState<AnalyzePhase>('analyzing')
  const [error, setError] = useState('')
  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null)
  const [localQuality, setLocalQuality] = useState<QualityReport | null>(null)
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null)

  useEffect(() => {
    if (plan) {
      setLocalQuality(plan.quality_report)
      setPhase('done')
    } else {
      runAnalysis()
    }
  }, [])

  // ── API calls ────────────────────────────────────────────────────────────────

  const runAnalysis = async () => {
    setPhase('analyzing')
    setError('')
    try {
      const res = await apiFetch('/api/analyze/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disease, article_content: articleContent, qa_items: qaItems })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '分析失败')
      setAnalysisResult(data as FullAnalysisResult)
      setLocalQuality(data.quality_report)
      setPhase('reviewing')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleGeneratePlan = async () => {
    if (!localQuality || !analysisResult) return
    setPhase('planning')
    setError('')
    try {
      const res = await apiFetch('/api/analyze/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease,
          quality_report: localQuality,
          needs_analysis: analysisResult.needs_analysis
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '计划生成失败')
      setPlan(data as IterationPlan)
      setPhase('done')
    } catch (e: any) {
      setError(e.message)
      setPhase('reviewing')
    }
  }

  // ── State helpers ─────────────────────────────────────────────────────────────

  const updateIssue = (dimKey: DimKey, subcatKey: string, issueId: string, changes: Partial<IssueItem>) => {
    setLocalQuality(prev => {
      if (!prev) return prev
      const dim = prev[dimKey] as any
      return {
        ...prev,
        [dimKey]: {
          ...dim,
          [subcatKey]: (dim[subcatKey] as IssueItem[]).map(item =>
            item.id === issueId ? { ...item, ...changes } : item
          )
        }
      }
    })
  }

  const addIssue = (dimKey: DimKey, subcatKey: string) => {
    const newId = `added-${Date.now()}`
    const newIssue: IssueItem = {
      id: newId,
      description: '',
      severity: 'medium',
      examples: [],
      reviewer_note: '',
      status: 'added'
    }
    setLocalQuality(prev => {
      if (!prev) return prev
      const dim = prev[dimKey] as any
      return {
        ...prev,
        [dimKey]: {
          ...dim,
          [subcatKey]: [...(dim[subcatKey] as IssueItem[]), newIssue]
        }
      }
    })
    setExpandedIssueId(newId)
  }

  const removeIssue = (dimKey: DimKey, subcatKey: string, issueId: string) => {
    setLocalQuality(prev => {
      if (!prev) return prev
      const dim = prev[dimKey] as any
      return {
        ...prev,
        [dimKey]: {
          ...dim,
          [subcatKey]: (dim[subcatKey] as IssueItem[]).filter(i => i.id !== issueId)
        }
      }
    })
  }

  const updateDim = (dimKey: DimKey, changes: object) => {
    setLocalQuality(prev => {
      if (!prev) return prev
      return { ...prev, [dimKey]: { ...(prev[dimKey] as any), ...changes } }
    })
  }

  // ── Phase progress bar ────────────────────────────────────────────────────────

  const phases = [
    { key: 'analyzing', label: 'AI 分析' },
    { key: 'reviewing', label: '专家审核' },
    { key: 'planning',  label: '生成计划' },
    { key: 'done',      label: '选择迭代项' },
  ]
  const phaseIdx = phases.findIndex(p => p.key === phase)

  const PhaseBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, padding: '10px 20px', background: 'white', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', fontSize: 12 }}>
      {phases.map((p, i) => (
        <div key={p.key} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            color: i < phaseIdx ? 'var(--green)' : i === phaseIdx ? 'var(--blue)' : 'var(--gray-400)',
            fontWeight: i === phaseIdx ? 700 : 400,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500,
              background: i < phaseIdx ? 'var(--green)' : i === phaseIdx ? 'var(--blue)' : 'var(--gray-200)',
              color: i <= phaseIdx ? 'white' : 'var(--gray-400)',
            }}>
              {i < phaseIdx ? '✓' : i + 1}
            </div>
            {p.label}
          </div>
          {i < phases.length - 1 && (
            <div style={{ width: 32, height: 1, background: i < phaseIdx ? 'var(--green)' : 'var(--gray-200)', margin: '0 8px' }} />
          )}
        </div>
      ))}
    </div>
  )

  // ── Render phases ──────────────────────────────────────────────────────────────

  if (phase === 'analyzing') return (
    <div>
      <PhaseBar />
      {error ? (
        <div className="card">
          <div className="alert alert-error">{error}</div>
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={onBack}>返回</button>
            <button className="btn btn-primary" onClick={runAnalysis}>重试</button>
          </div>
        </div>
      ) : (
        <div className="loading">
          <div className="spinner" />
          <div>AI 正在分析词条质量，请稍候...</div>
          <div className="text-sm text-muted" style={{ textAlign: 'center' }}>
            正在按四维评估标准（内容全面 / 结构合理 / 内容准确 / 内容精炼）逐项分析
            {qaItems.length > 0 && '，同时分析用户需求'}
            <br />通常需要 30-60 秒
          </div>
        </div>
      )}
    </div>
  )

  if ((phase === 'reviewing' || phase === 'planning') && !localQuality) return null

  if (phase === 'reviewing' && localQuality) {
    const qr = localQuality
    const needs = analysisResult?.needs_analysis
    const approvedCount = [qr.dim_one, qr.dim_two, qr.dim_three, qr.dim_four].filter(d => d.approved).length

    return (
      <div>
        <PhaseBar />

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        {/* Overall summary */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="card-title" style={{ marginBottom: 8 }}>
                <span className="icon" style={{ background: 'var(--dui-primary-container)' }}>📊</span>
                AI 质量评估结果 — {disease}
                <span className={`score ${scoreClass(qr.overall_score)}`}>{qr.overall_score.toFixed(1)} / 5.0</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.6 }}>{qr.summary}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {[
                { label: '内容全面', score: qr.dim_one.score },
                { label: '结构合理', score: qr.dim_two.score },
                { label: '内容准确', score: qr.dim_three.score },
                { label: '精炼流畅', score: qr.dim_four.score },
              ].map(d => (
                <div key={d.label} style={{ textAlign: 'center', padding: '8px 10px', border: '0.5px solid var(--dui-divider)', borderRadius: 8, minWidth: 64 }}>
                  <div className={`score ${scoreClass(d.score)}`} style={{ fontSize: 16, fontWeight: 500, display: 'block', marginBottom: 4 }}>{d.score}/5</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '0.5px solid var(--dui-divider)', marginTop: 12, paddingTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-700)', marginBottom: 4 }}>专家总体意见：</div>
            <textarea
              className="textarea"
              value={qr.reviewer_comment}
              onChange={e => setLocalQuality(prev => prev ? { ...prev, reviewer_comment: e.target.value } : prev)}
              placeholder="可填写对本次分析的整体补充意见..."
              style={{ minHeight: 48, fontSize: 12 }}
            />
          </div>
        </div>

        {/* Review instructions */}
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <strong>专家审核说明：</strong>请逐项核查 AI 发现的问题。可以确认、排除（不纳入计划）、补充 AI 遗漏的问题，并调整各维度评分。完成后点击「确认审核 · 生成迭代计划」。
        </div>

        {/* Dimension cards */}
        <DimCard
          dimKey="dim_one"
          title="维度一：内容全面"
          description="重点内容缺失 / 非重点内容缺失 / 数据源缺失"
          dim={qr.dim_one}
          subcats={[
            { key: 'key_missing', label: '重点内容缺失（定义、临床表现、辅助检查、诊断、治疗）' },
            { key: 'nonkey_missing', label: '非重点内容缺失（分类、机制、预后、预防等）' },
            { key: 'source_missing', label: '数据源缺失' },
          ]}
          expandedId={expandedIssueId}
          setExpandedId={setExpandedIssueId}
          onUpdateIssue={(sub, id, ch) => updateIssue('dim_one', sub, id, ch)}
          onAddIssue={sub => addIssue('dim_one', sub)}
          onRemoveIssue={(sub, id) => removeIssue('dim_one', sub, id)}
          onUpdateDim={ch => updateDim('dim_one', ch)}
        />

        <DimCard
          dimKey="dim_two"
          title="维度二：结构合理"
          description="临床思维流程 / 内容整合逻辑"
          dim={qr.dim_two}
          subcats={[
            { key: 'clinical_thinking', label: '临床思维（章节顺序是否符合临床工作流程）' },
            { key: 'integration_logic', label: '整合逻辑（相关内容归类是否合理，标题是否准确）' },
          ]}
          expandedId={expandedIssueId}
          setExpandedId={setExpandedIssueId}
          onUpdateIssue={(sub, id, ch) => updateIssue('dim_two', sub, id, ch)}
          onAddIssue={sub => addIssue('dim_two', sub)}
          onRemoveIssue={(sub, id) => removeIssue('dim_two', sub, id)}
          onUpdateDim={ch => updateDim('dim_two', ch)}
        />

        <DimCard
          dimKey="dim_three"
          title="维度三：内容准确"
          description="内容错误 / 内容陈旧 / 内容合理性"
          dim={qr.dim_three}
          subcats={[
            { key: 'errors', label: '内容错误（文本性错误影响句意，如数据误写）' },
            { key: 'outdated', label: '内容陈旧（未引用最新指南或权威数据）' },
            { key: 'unreasonable', label: '内容不合理（自洽性问题、多源融合不清晰等）' },
          ]}
          expandedId={expandedIssueId}
          setExpandedId={setExpandedIssueId}
          onUpdateIssue={(sub, id, ch) => updateIssue('dim_three', sub, id, ch)}
          onAddIssue={sub => addIssue('dim_three', sub)}
          onRemoveIssue={(sub, id) => removeIssue('dim_three', sub, id)}
          onUpdateDim={ch => updateDim('dim_three', ch)}
        />

        <DimCard
          dimKey="dim_four"
          title="维度四：内容精炼流畅"
          description="重复冗余 / 格式问题 / 语言问题"
          dim={qr.dim_four}
          subcats={[
            { key: 'redundancy', label: '重复冗余（重复文本、未精简的研究内容）' },
            { key: 'format_issues', label: '格式问题（图表/超链不当、格式不一致、名词不统一）' },
            { key: 'language_issues', label: '语言问题（机翻痕迹、错别字、语言不流畅）' },
          ]}
          expandedId={expandedIssueId}
          setExpandedId={setExpandedIssueId}
          onUpdateIssue={(sub, id, ch) => updateIssue('dim_four', sub, id, ch)}
          onAddIssue={sub => addIssue('dim_four', sub)}
          onRemoveIssue={(sub, id) => removeIssue('dim_four', sub, id)}
          onUpdateDim={ch => updateDim('dim_four', ch)}
        />

        {/* Needs analysis (read-only) */}
        {needs && needs.total_qa_count > 0 && (
          <div className="card">
            <div className="card-title">
              <span className="icon" style={{ background: 'var(--dui-warning-container)' }}>💬</span>
              用户需求分析
              <span className="tag">共 {needs.total_qa_count} 条问答</span>
              <span className="tag text-muted">仅供参考</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>需求主题</th>
                  <th>频次</th>
                  <th>知识库覆盖</th>
                  <th>说明</th>
                  <th>代表性问题</th>
                </tr>
              </thead>
              <tbody>
                {needs.clusters.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{c.topic}</td>
                    <td>
                      <span style={{ fontWeight: 500, color: c.frequency > 100 ? 'var(--red)' : c.frequency > 50 ? 'var(--orange)' : 'var(--gray-700)' }}>
                        {c.frequency}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: c.covered_in_kb ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                        {c.covered_in_kb ? '✓ 已覆盖' : '✗ 未覆盖'}
                      </span>
                    </td>
                    <td className="text-muted">{c.coverage_notes}</td>
                    <td className="text-muted text-sm">
                      {c.representative_questions.slice(0, 2).map((q, j) => (
                        <div key={j} style={{ marginBottom: 2 }}>· {q}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex justify-between items-center mt-4">
          <button className="btn btn-outline" onClick={onBack}>← 返回修改输入</button>
          <div className="flex items-center gap-3">
            {approvedCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--green)' }}>
                {approvedCount}/4 个维度已标记审核
              </span>
            )}
            <button className="btn btn-primary" onClick={handleGeneratePlan}>
              确认审核 · 生成迭代计划 →
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'planning') return (
    <div>
      <PhaseBar />
      <div className="loading">
        <div className="spinner" />
        <div>根据审核结果生成迭代优先级计划...</div>
        <div className="text-sm text-muted">AI 正在综合质量评估和用户需求，生成结构化改进任务</div>
      </div>
    </div>
  )

  if (phase === 'done' && plan) {
    const { quality_report: qr, needs_analysis: na, gap_items } = plan

    return (
      <div>
        <PhaseBar />

        {/* Quality summary bar */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 500 }}>{disease} 质量评估</div>
            <span className={`score ${scoreClass(qr.overall_score)}`}>{qr.overall_score.toFixed(1)} / 5.0</span>
            {[
              { label: '内容全面', s: qr.dim_one.score },
              { label: '结构合理', s: qr.dim_two.score },
              { label: '内容准确', s: qr.dim_three.score },
              { label: '精炼流畅', s: qr.dim_four.score },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--gray-500)' }}>{d.label}</span>
                <span className={`score ${scoreClass(d.s)}`} style={{ fontSize: 12 }}>{d.s}/5</span>
              </div>
            ))}
            <button
              className="btn btn-sm btn-outline"
              style={{ marginLeft: 'auto' }}
              onClick={() => setPhase('reviewing')}
            >
              重新调整分析
            </button>
          </div>
          {qr.summary && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--gray-700)', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 6 }}>
              {qr.summary}
            </div>
          )}
        </div>

        {/* Needs summary */}
        {na.total_qa_count > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>
              <span className="icon" style={{ background: 'var(--dui-warning-container)' }}>💬</span>
              用户需求分析
              <span className="tag">共 {na.total_qa_count} 条问答</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>需求主题</th><th>频次</th><th>知识库覆盖</th><th>代表性问题</th>
                </tr>
              </thead>
              <tbody>
                {na.clusters.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{c.topic}</td>
                    <td><span style={{ fontWeight: 500, color: c.frequency > 100 ? 'var(--red)' : c.frequency > 50 ? 'var(--orange)' : 'var(--gray-700)' }}>{c.frequency}</span></td>
                    <td><span style={{ color: c.covered_in_kb ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{c.covered_in_kb ? '✓' : '✗'}</span></td>
                    <td className="text-muted text-sm">{c.representative_questions[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Gap items */}
        <div className="card">
          <div className="card-title">
            <span className="icon" style={{ background: 'var(--dui-success-container)' }}>📋</span>
            迭代优先级计划
            <span className="tag">{gap_items.length} 个改进任务</span>
            <span className="tag text-muted">选择一项进行内容生成</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {gap_items.map((g, i) => {
              const hasDraft = draftHistory.some(r => r.gap.section === g.section && r.gap.priority === g.priority)
              return (
                <div
                  key={i}
                  className={`gap-item ${selectedGap === g ? 'selected' : ''}`}
                  onClick={() => setSelectedGap(g)}
                >
                  <div className="gap-item-header">
                    <span className={`priority priority-${g.priority.toLowerCase()}`}>{g.priority}</span>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{g.section}</span>
                    {g.qa_frequency && <span className="tag">用户提问 {g.qa_frequency} 次</span>}
                    <span className="tag text-muted">
                      {{ quality_eval: '质量评估', user_needs: '用户需求', both: '两者均有' }[g.source] || g.source}
                    </span>
                    {hasDraft && (
                      <span style={{ padding: '1px 8px', background: 'var(--green-light)', color: 'var(--green)', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>✓ 已生成</span>
                    )}
                  </div>
                  <div className="gap-item-desc">{g.description}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <button className="btn btn-outline" onClick={onBack}>← 返回</button>
          <button className="btn btn-primary" onClick={onNext} disabled={!selectedGap}>
            {selectedGap
              ? (draftHistory.some(r => r.gap.section === selectedGap.section && r.gap.priority === selectedGap.priority)
                ? `查看「${selectedGap.section}」稿件 →`
                : `生成「${selectedGap.section}」内容 →`)
              : '请先选择一个迭代项'}
          </button>
        </div>
      </div>
    )
  }

  // Error state (analyzing failed and phase didn't change)
  if (error) return (
    <div className="card">
      <div className="alert alert-error">{error}</div>
      <div className="flex gap-2">
        <button className="btn btn-outline" onClick={onBack}>返回</button>
        <button className="btn btn-primary" onClick={runAnalysis}>重试</button>
      </div>
    </div>
  )

  return null
}
