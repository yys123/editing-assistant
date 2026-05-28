import { useState, useEffect } from 'react'
import { ReferenceDoc, RefEvalResult, RefEvalItemResult } from '../types'
import { apiFetch } from '../api'

interface Props {
  disease: string
  referenceDocs: ReferenceDoc[]
  refEvalResult: RefEvalResult | null
  setRefEvalResult: (r: RefEvalResult | null) => void
  refEvalStandardOverride?: string
  onBack: () => void
}

const RATING_COLORS: Record<string, { bg: string; color: string }> = {
  '强烈推荐': { bg: 'var(--dui-success-container)', color: 'var(--dui-success)' },
  '推荐':     { bg: 'var(--dui-primary-container)', color: 'var(--dui-primary)' },
  '可用':     { bg: 'var(--dui-warning-container)', color: 'var(--dui-warning)' },
  '建议替换': { bg: 'var(--dui-danger-container)',  color: 'var(--dui-danger)' },
  '高':       { bg: 'var(--dui-success-container)', color: 'var(--dui-success)' },
  '中':       { bg: 'var(--dui-warning-container)', color: 'var(--dui-warning)' },
  '低':       { bg: 'var(--dui-danger-container)',  color: 'var(--dui-danger)' },
  '最新':     { bg: 'var(--dui-success-container)', color: 'var(--dui-success)' },
  '较新':     { bg: 'var(--dui-primary-container)', color: 'var(--dui-primary)' },
  '陈旧':     { bg: 'var(--dui-danger-container)',  color: 'var(--dui-danger)' },
}

function RatingBadge({ text }: { text: string }) {
  const style = RATING_COLORS[text] || { bg: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface)' }
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
      background: style.bg, color: style.color,
    }}>
      {text}
    </span>
  )
}

function RefItemCard({ item, index }: { item: RefEvalItemResult; index: number }) {
  const [collapsed, setCollapsed] = useState(false)
  const recColor = RATING_COLORS[item.overall_recommendation] || { bg: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface)' }
  return (
    <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px 18px',
          background: recColor.bg,
          borderBottom: collapsed ? 'none' : `1px solid ${recColor.color}22`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 6,
          background: recColor.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 500, flexShrink: 0,
        }}>
          {index + 1}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)', wordBreak: 'break-all' }}>
            {item.filename}
          </div>
          <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>{item.summary}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <RatingBadge text={item.overall_recommendation} />
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-on-surface-variant)', transition: 'transform 0.2s', transform: collapsed ? 'none' : 'rotate(180deg)' }}>expand_more</span>
        </div>
      </div>
      {!collapsed && (
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, background: 'var(--m3-surface-container-lowest)' }}>
          <div style={{ background: 'var(--m3-surface-container-low)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 4, fontWeight: 500 }}>权威性</div>
            <RatingBadge text={item.authority_rating} />
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--m3-on-surface-variant)', lineHeight: 1.5 }}>{item.authority_note}</div>
          </div>
          <div style={{ background: 'var(--m3-surface-container-low)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 4, fontWeight: 500 }}>证据等级</div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--m3-on-surface)' }}>{item.evidence_level}</span>
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--m3-on-surface-variant)', lineHeight: 1.5 }}>{item.evidence_note}</div>
          </div>
          <div style={{ background: 'var(--m3-surface-container-low)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 4, fontWeight: 500 }}>时效性</div>
            <RatingBadge text={item.timeliness_rating} />
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--m3-on-surface-variant)', lineHeight: 1.5 }}>{item.timeliness_note}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StepRefReview({
  disease, referenceDocs, refEvalResult, setRefEvalResult,
  refEvalStandardOverride, onBack,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runEval = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/analyze/ref-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disease,
          reference_docs: referenceDocs,
          ref_eval_standard_text: refEvalStandardOverride || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '评估失败')
      setRefEvalResult(data as RefEvalResult)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!refEvalResult && referenceDocs.length > 0) {
      runEval()
    }
  }, [])

  if (referenceDocs.length === 0) {
    return (
      <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--m3-on-surface-variant)', opacity: 0.4, display: 'block', marginBottom: 12 }}>menu_book</span>
        <div style={{ fontWeight: 500, marginBottom: 8, color: 'var(--m3-on-surface)' }}>未上传参考文献</div>
        <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)' }}>
          当前未上传任何参考文献。可通过底部导航栏跳过此步骤继续，或返回上一步上传参考文献。
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 500, color: 'var(--m3-on-surface)' }}>正在评估 {referenceDocs.length} 篇参考文献...</div>
        <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginTop: 6 }}>AI 正在从权威性、证据等级、时效性等维度审核，通常需要 15-30 秒</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="section-card">
        <div style={{ padding: '12px 16px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
          {error}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-m3-outline" onClick={onBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            返回
          </button>
          <button className="btn-gradient" onClick={runEval}>重试</button>
        </div>
      </div>
    )
  }

  if (!refEvalResult) return null

  const evalResult = refEvalResult
  const hasIssues = evalResult.coverage_gaps.length > 0 || evalResult.suggestions.length > 0

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          参考文献审核
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          AI 从权威性、证据等级、时效性等维度评估参考文献质量
        </p>
      </div>

      {/* Overall assessment */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>assignment</span>
          <span style={{ fontWeight: 500, fontSize: 16, color: 'var(--m3-on-surface)' }}>审核结果</span>
          <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>（{disease} · {evalResult.item_evaluations.length} 篇）</span>
          <button className="btn-m3-outline" style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 12px' }} onClick={runEval}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            重新评估
          </button>
        </div>
        <div style={{ background: 'var(--m3-surface-container-low)', borderRadius: 8, padding: '14px 18px', marginBottom: 14, lineHeight: 1.7, fontSize: 13, color: 'var(--m3-on-surface)' }}>
          {evalResult.overall_assessment}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: hasIssues ? 14 : 0 }}>
          <div style={{ background: 'var(--m3-surface-container-low)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4, color: 'var(--m3-on-surface)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>fact_check</span>
              内容覆盖面
            </div>
            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', lineHeight: 1.6 }}>{evalResult.comprehensiveness}</div>
          </div>
          <div style={{ background: 'var(--m3-surface-container-low)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4, color: 'var(--m3-on-surface)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>language</span>
              本地化适用性
            </div>
            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', lineHeight: 1.6 }}>{evalResult.localization}</div>
          </div>
        </div>

        {hasIssues && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {evalResult.coverage_gaps.length > 0 && (
              <div style={{ background: 'var(--dui-warning-container)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6, color: 'var(--dui-warning)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>warning</span>
                  建议补充
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {evalResult.coverage_gaps.map((g, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--dui-warning)', marginBottom: 2 }}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {evalResult.suggestions.length > 0 && (
              <div style={{ background: 'var(--dui-primary-container)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6, color: 'var(--dui-primary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>lightbulb</span>
                  改进建议
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {evalResult.suggestions.map((s, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--dui-primary)', marginBottom: 2 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Per-doc evaluations */}
      <div style={{ display: 'grid', gap: 10 }}>
        {evalResult.item_evaluations.map((item, i) => (
          <RefItemCard key={i} item={item} index={i} />
        ))}
      </div>

    </div>
  )
}
