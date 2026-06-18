import { useState, useEffect } from 'react'
import { ParsedArticle } from '../types'
import { isSummarySection } from './StepSectionAnalysis'
import { apiFetch } from '../api'
import {
  ARTICLE_PARSE_CACHE_VERSION,
  buildArticleParseSource,
  getArticleParseCacheKey,
} from '../utils/parseCache'

interface Props {
  articleContent: string
  articleParseContent?: string
  parsedArticle: ParsedArticle | null
  parsedArticleSourceHash?: string
  parsedArticleParserVersion?: number
  setParsedArticle: (a: ParsedArticle, sourceHash: string, parserVersion: number) => void
  onBack: () => void
}

export default function StepSectionPreview({
  articleContent,
  articleParseContent,
  parsedArticle,
  parsedArticleSourceHash,
  parsedArticleParserVersion,
  setParsedArticle,
  onBack,
}: Props) {
  const expectedSourceHash = getArticleParseCacheKey(articleContent, articleParseContent)
  const hasValidParsedArticle = !!parsedArticle
    && parsedArticleSourceHash === expectedSourceHash
    && parsedArticleParserVersion === ARTICLE_PARSE_CACHE_VERSION
  const [loading, setLoading] = useState(!hasValidParsedArticle)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const parse = async () => {
    setLoading(true)
    setError('')
    try {
      const structuredContent = buildArticleParseSource(articleContent, articleParseContent)
      const sourceHash = getArticleParseCacheKey(articleContent, articleParseContent)
      const res = await apiFetch('/api/article/parse-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_content: structuredContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '解析失败')
      setParsedArticle(data as ParsedArticle, sourceHash, ARTICLE_PARSE_CACHE_VERSION)
      setExpanded(new Set())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasValidParsedArticle) parse()
  }, [expectedSourceHash, hasValidParsedArticle])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (loading) return (
    <div className="section-card" style={{ textAlign: 'center', padding: 48 }}>
      <div className="spinner" style={{ margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 500, color: 'var(--m3-on-surface)' }}>正在解析词条内容结构...</div>
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
          返回
        </button>
        <button className="btn-gradient" onClick={parse}>重试</button>
      </div>
    </div>
  )

  if (!parsedArticle) return null

  const levelColor: Record<number, string> = { 1: 'var(--dui-primary)', 2: 'var(--dui-warning)', 3: 'var(--dui-text-sub)' }
  const levelLabel: Record<number, string> = { 1: 'H1', 2: 'H2', 3: 'H3' }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          内容解析
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          AI 自动解析词条结构，确认章节划分后进入质量审评
        </p>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>account_tree</span>
          <span style={{ fontWeight: 500, fontSize: 16, color: 'var(--m3-on-surface)' }}>解析结果</span>
          <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999, background: 'var(--dui-primary-container)', color: 'var(--m3-primary)', fontWeight: 500 }}>
            {parsedArticle.sections.length} 个章节
          </span>
          <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
            字数 {parsedArticle.total_words} 字
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={() => {
                const nonEmpty = parsedArticle.sections.filter(s => s.content.trim())
                setExpanded(new Set(nonEmpty.map(s => s.id)))
              }}
            >
              展开全部
            </button>
            <button
              className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={() => setExpanded(new Set())}
            >
              收起全部
            </button>
            <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={parse}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              重新解析
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 16px', background: 'var(--dui-primary-container)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--m3-on-surface-variant)', lineHeight: 1.7 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6, color: 'var(--m3-primary)' }}>info</span>
          点击章节标题可展开查看原始内容。确认无误后点击「确认内容 · 开始分析」。
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
              <div key={sec.id} style={{ borderRadius: 6, transition: 'background 0.1s' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    paddingLeft: 12 + indent,
                    cursor: isEmpty ? 'default' : 'pointer',
                    borderRadius: 6,
                    background: isOpen ? 'var(--dui-primary-container)' : 'transparent',
                  }}
                  onClick={() => !isEmpty && toggle(sec.id)}
                >
                  <span style={{
                    fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
                    flexShrink: 0,
                    background: `${levelColor[sec.level] ?? 'var(--m3-on-surface-variant)'}15`,
                    color: levelColor[sec.level] ?? 'var(--m3-on-surface-variant)',
                  }}>
                    {levelLabel[sec.level] ?? `H${sec.level}`}
                  </span>

                  <span style={{
                    fontWeight: sec.level === 1 ? 700 : sec.level === 2 ? 600 : 500,
                    fontSize: sec.level === 1 ? 14 : 13,
                    color: 'var(--m3-on-surface)',
                    flex: 1,
                  }}>
                    {sec.heading}
                  </span>

                  {isSummary && (
                    <span style={{
                      fontSize: 12, padding: '2px 8px', borderRadius: 999,
                      background: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface-variant)', flexShrink: 0,
                    }}>
                      概要参考
                    </span>
                  )}

                  {!isEmpty && (
                    <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', flexShrink: 0 }}>
                      {sec.word_count} 字
                    </span>
                  )}

                  {!isEmpty && (
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-on-surface-variant)', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                  )}
                </div>

                {isOpen && !isEmpty && (
                  <div style={{
                    marginLeft: 12 + indent + 28,
                    marginRight: 12,
                    marginBottom: 8,
                    padding: '12px 16px',
                    background: 'var(--m3-surface-container-low)',
                    border: '0.5px solid var(--dui-divider)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--m3-on-surface)',
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

    </div>
  )
}
