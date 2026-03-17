import { useState, useEffect } from 'react'
import { ParsedArticle } from '../types'
import { isSummarySection } from './StepSectionAnalysis'

interface Props {
  articleContent: string
  parsedArticle: ParsedArticle | null
  setParsedArticle: (a: ParsedArticle) => void
  onNext: () => void
  onBack: () => void
}

export default function StepSectionPreview({ articleContent, parsedArticle, setParsedArticle, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(!parsedArticle)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const parse = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/article/parse-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_content: articleContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '解析失败')
      setParsedArticle(data as ParsedArticle)
      setExpanded(new Set())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!parsedArticle) parse()
  }, [])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <div>正在解析词条内容结构...</div>
    </div>
  )

  if (error) return (
    <div className="card">
      <div className="alert alert-error">{error}</div>
      <div className="flex gap-2">
        <button className="btn btn-outline" onClick={onBack}>← 返回</button>
        <button className="btn btn-primary" onClick={parse}>重试</button>
      </div>
    </div>
  )

  if (!parsedArticle) return null

  const levelColor: Record<number, string> = { 1: 'var(--blue)', 2: 'var(--orange)', 3: 'var(--gray-500)' }
  const levelLabel: Record<number, string> = { 1: 'H1', 2: 'H2', 3: 'H3' }

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span className="icon" style={{ background: '#f0fdf4' }}>📑</span>
          内容解析结果
          <span className="tag">{parsedArticle.sections.length} 个章节</span>
          <span className="tag text-muted">共 {parsedArticle.total_words} 字</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const nonEmpty = parsedArticle.sections.filter(s => s.content.trim())
                setExpanded(new Set(nonEmpty.map(s => s.id)))
              }}
            >
              展开全部
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setExpanded(new Set())}
            >
              收起全部
            </button>
          </div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          以下为词条自动解析的内容结构，点击章节标题可展开查看原始内容。确认无误后点击「确认内容 · 开始分析」。
          若章节拆分有误，可返回调整原文格式（建议使用 Markdown 标题 ## / ###）。
          <br />
          <span style={{ fontSize: 12 }}>
            标记为「概要参考」的章节（更新要点、诊断要点、治疗要点）将作为背景信息并入相邻章节，不独立分析。
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {parsedArticle.sections.map((sec) => {
            const isEmpty = !sec.content.trim()
            const isOpen = expanded.has(sec.id)
            const isSummary = isSummarySection(sec.heading)
            const indent = (sec.level - 1) * 20

            return (
              <div key={sec.id} style={{
                borderRadius: 4,
                border: '1px solid transparent',
                transition: 'background 0.1s',
              }}>
                {/* Header row */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px',
                    paddingLeft: 10 + indent,
                    cursor: isEmpty ? 'default' : 'pointer',
                    borderRadius: 4,
                    background: isOpen ? 'var(--blue-light)' : 'transparent',
                  }}
                  onClick={() => !isEmpty && toggle(sec.id)}
                >
                  {/* Level badge */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    flexShrink: 0,
                    background: `${levelColor[sec.level] ?? 'var(--gray-400)'}22`,
                    color: levelColor[sec.level] ?? 'var(--gray-500)',
                  }}>
                    {levelLabel[sec.level] ?? `H${sec.level}`}
                  </span>

                  {/* Heading */}
                  <span style={{
                    fontWeight: sec.level === 1 ? 700 : sec.level === 2 ? 600 : 500,
                    fontSize: sec.level === 1 ? 14 : 13,
                    color: 'var(--gray-900)',
                    flex: 1,
                  }}>
                    {sec.heading}
                  </span>

                  {/* Summary badge */}
                  {isSummary && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: 'var(--gray-100)', color: 'var(--gray-500)', flexShrink: 0,
                    }}>
                      概要参考·不独立分析
                    </span>
                  )}

                  {/* Word count — only if non-empty */}
                  {!isEmpty && (
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', flexShrink: 0 }}>
                      {sec.word_count} 字
                    </span>
                  )}

                  {/* Expand toggle — only if has content */}
                  {!isEmpty && (
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', flexShrink: 0 }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  )}
                </div>

                {/* Expanded content */}
                {isOpen && !isEmpty && (
                  <div style={{
                    marginLeft: 10 + indent + 28,
                    marginRight: 10,
                    marginBottom: 8,
                    padding: '10px 14px',
                    background: 'var(--gray-50)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--gray-700)',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 400,
                    overflowY: 'auto',
                  }}>
                    {sec.content}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-between items-center mt-4">
        <button className="btn btn-outline" onClick={onBack}>← 返回修改</button>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={parse}>重新解析</button>
          <button className="btn btn-primary" onClick={onNext}>
            确认内容 · 开始分析 →
          </button>
        </div>
      </div>
    </div>
  )
}
