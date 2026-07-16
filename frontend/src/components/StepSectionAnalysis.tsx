import React, { useEffect, useState, useMemo } from 'react'
import { ArticleEntryType, ArticleSection, ConfirmedReferenceChunk, ParsedArticle, SectionAnalysis, SectionIssue, ReferenceDoc, StandardsOverride } from '../types'
import { apiFetch, safeJson } from '../api'
import ChunkConfirmationPanel from './ChunkConfirmationPanel'
import {
  haveSectionAnalysisIdsChanged,
  remapSectionAnalysesToCurrentSections,
} from '../utils/sectionAnalysisCompatibility'
import { getIssueLocatorAnchors, LocatableIssueAnchor } from '../utils/issueAnchors'
import { countChineseWords } from '../utils/sectionContent'
import {
  DEFAULT_REVIEW_FULLSCREEN_FONT_SIZE,
  REVIEW_FULLSCREEN_FONT_SIZES,
  ReviewFullscreenFontSize,
  getReviewFullscreenFontScale,
} from '../utils/reviewFullscreenFont'

interface Props {
  disease: string
  articleEntryType: ArticleEntryType
  parsedArticle: ParsedArticle
  parsedArticleSourceHash: string
  parsedArticleParserVersion?: number
  sectionAnalyses: SectionAnalysis[]
  setSectionAnalyses: (analyses: SectionAnalysis[]) => void
  sectionReferenceSelections: Record<string, string[]>
  setSectionReferenceSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  sectionPriorityReferenceSelections: Record<string, string[]>
  setSectionPriorityReferenceSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  referenceDocs: ReferenceDoc[]
  standardsOverride: StandardsOverride
}

// Summary/overview sections that should NOT be analyzed as independent chapters.
// Their content is merged as contextual background into the adjacent real section.
const SUMMARY_HEADINGS = ['更新要点', '诊断要点', '治疗要点']
const MAX_SECTION_ANALYSIS_CONCURRENCY = 3
const NO_REFERENCES_SELECTED = '__none__'

function getSourceLineBaseStyle(isActiveLine: boolean): React.CSSProperties {
  return {
    background: isActiveLine ? '#FFE0B8' : 'transparent',
    borderLeft: `3px solid ${isActiveLine ? 'var(--dui-warning)' : 'transparent'}`,
    borderRadius: 4,
    boxShadow: isActiveLine
      ? 'inset 0 0 0 1px rgba(188, 76, 0, 0.28), 0 1px 6px rgba(188, 76, 0, 0.16)'
      : 'none',
    padding: isActiveLine ? '2px 6px 2px 7px' : '0 4px 0 7px',
    marginLeft: -7,
    transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
  }
}

export function isSummarySection(heading: string): boolean {
  return SUMMARY_HEADINGS.some(p => heading.includes(p))
}

function formatReferenceForPrompt(doc: ReferenceDoc, index: number, isPriority = false) {
  const marker = isPriority ? '（重点指南）' : ''
  return `### 参考数据源 ${index + 1}${marker}\n文件名：${doc.filename}\n\n${doc.text}`
}

interface SectionAnalysisReferencePayloadParams {
  allReferenceDocs: ReferenceDoc[]
  selectedReferenceDocs: ReferenceDoc[]
  priorityReferenceDocs: ReferenceDoc[]
  confirmedChunks: ConfirmedReferenceChunk[]
}

export function buildSectionAnalysisReferencePayload({
  allReferenceDocs,
  selectedReferenceDocs,
  priorityReferenceDocs,
  confirmedChunks,
}: SectionAnalysisReferencePayloadParams) {
  const selectedReferenceNameSet = new Set(selectedReferenceDocs.map(doc => doc.filename))
  const confirmed_reference_chunks = (confirmedChunks ?? [])
    .filter(chunk => selectedReferenceNameSet.has(chunk.source_filename))
  const formatSelectedReference = (doc: ReferenceDoc, isPriority = false) => {
    const index = allReferenceDocs.findIndex(item => item.filename === doc.filename)
    return formatReferenceForPrompt(doc, index >= 0 ? index : 0, isPriority)
  }

  if (confirmed_reference_chunks.length > 0) {
    return {
      reference_texts: [],
      priority_reference_texts: [],
      confirmed_reference_chunks,
    }
  }

  return {
    reference_texts: selectedReferenceDocs.map(doc => formatSelectedReference(doc)),
    priority_reference_texts: priorityReferenceDocs.map(doc => formatSelectedReference(doc, true)),
    confirmed_reference_chunks,
  }
}

interface AnalysisGroup {
  representative: ArticleSection
  childSections: ArticleSection[]
  combinedContent: string
}

function getAnalysisGroupWordCount(group: AnalysisGroup): number {
  return countChineseWords(`${group.representative.heading}\n${group.combinedContent}`)
}

function buildAnalysisGroups(sections: ArticleSection[]): AnalysisGroup[] {
  const groups: AnalysisGroup[] = []
  let currentGroup: AnalysisGroup | null = null
  // Buffer for summary content that appears before any real group has been created
  let pendingSummary = ''

  for (const section of sections) {
    if (isSummarySection(section.heading)) {
      // Editorial summaries — excluded from quality review entirely
      continue
    }

    if (section.level === 1) {
      const baseContent = (pendingSummary ? pendingSummary + '\n\n' : '') + section.content
      pendingSummary = ''
      currentGroup = {
        representative: section,
        childSections: [],
        combinedContent: baseContent,
      }
      groups.push(currentGroup)
    } else {
      if (currentGroup) {
        currentGroup.childSections.push(section)
        const prefix = section.level === 2 ? '##' : '###'
        currentGroup.combinedContent += `\n\n${prefix} ${section.heading}`
        if (section.content.trim()) {
          currentGroup.combinedContent += `\n${section.content}`
        }
      } else {
        // Orphan non-level-1 section with no parent — create a group for it
        currentGroup = {
          representative: section,
          childSections: [],
          combinedContent: (pendingSummary ? pendingSummary + '\n\n' : '') + section.content,
        }
        pendingSummary = ''
        groups.push(currentGroup)
      }
    }
  }

  return groups
}

export function getSectionAnalysisTargetIds(sections: ArticleSection[]): string[] {
  return buildAnalysisGroups(sections).map(group => group.representative.id)
}

// === 4-dimension scoring system ===

// D1=内容全面 D2=结构合理 D3=内容准确 D4=内容精炼流畅
const DIM_CONFIG: Record<number, { label: string; hasKeyContent: boolean }> = {
  1: { label: '内容全面', hasKeyContent: true },
  2: { label: '结构合理', hasKeyContent: false },
  3: { label: '内容准确', hasKeyContent: true },
  4: { label: '内容精炼流畅', hasKeyContent: false },
}

const TYPE_TO_DIM: Record<string, number> = {
  missing_content: 1,
  structure: 2,
  accuracy: 3,
  outdated: 3,
  style: 4,
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  missing_content: '内容缺失',
  structure: '结构问题',
  accuracy: '内容不准确',
  outdated: '内容陈旧',
  style: '语言/格式',
}

interface DimStat {
  issues: number
  keyDeduction: number
  totalDeduction: number
}

function computeDimStats(sectionAnalyses: SectionAnalysis[]): Record<number, DimStat> {
  const stats: Record<number, DimStat> = {
    1: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
    2: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
    3: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
    4: { issues: 0, keyDeduction: 0, totalDeduction: 0 },
  }
  for (const sa of sectionAnalyses) {
    for (const issue of sa.issues) {
      if (issue.status === 'rejected') continue
      const dim = TYPE_TO_DIM[issue.issue_type] ?? 1
      const deduction = issue.deduction_score ?? 1
      stats[dim].issues++
      stats[dim].totalDeduction += deduction
      if (dim === 1 && issue.is_key_content) stats[dim].keyDeduction += deduction
      if (dim === 3 && issue.severity === 'high') stats[dim].keyDeduction += deduction
    }
  }
  return stats
}

type Rating = 'excellent' | 'pass' | 'fail'

function getDimRating(dim: number, stat: DimStat, totalWords: number): Rating {
  const per10k = (v: number) => totalWords > 0 ? (v / totalWords) * 10000 : v
  const keyPer = per10k(stat.keyDeduction)
  const totalPer = per10k(stat.totalDeduction)

  // D1 内容全面 & D3 内容准确: both have key-content sub-scoring
  if (dim === 1 || dim === 3) {
    if (keyPer < 5 || totalPer < 10) return 'excellent'
    if (keyPer < 10 || totalPer < 20) return 'pass'
    return 'fail'
  }
  // D2 结构合理 & D4 精炼流畅: total only
  if (dim === 2) {
    if (totalPer < 10) return 'excellent'
    if (totalPer < 20) return 'pass'
    return 'fail'
  }
  // D4 精炼流畅
  if (totalPer < 10) return 'excellent'
  if (totalPer < 20) return 'pass'
  return 'fail'
}

const RATING_CONFIG: Record<Rating, { label: string; color: string; bg: string }> = {
  excellent: { label: '优秀', color: 'var(--green)', bg: 'var(--green-light)' },
  pass: { label: '合格', color: 'var(--blue)', bg: 'var(--blue-light)' },
  fail: { label: '待改进', color: 'var(--orange)', bg: 'var(--orange-light)' },
}

export default function StepSectionAnalysis({
  disease, articleEntryType, parsedArticle, parsedArticleSourceHash, parsedArticleParserVersion, sectionAnalyses, setSectionAnalyses,
  sectionReferenceSelections, setSectionReferenceSelections,
  sectionPriorityReferenceSelections, setSectionPriorityReferenceSelections,
  referenceDocs, standardsOverride
}: Props) {
  // Per-section loading/error state; analysing=true means in-flight
  const [analysing, setAnalysing] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Accumulates results as parallel analyses complete
  const resultsRef = React.useRef<SectionAnalysis[]>([])
  resultsRef.current = sectionAnalyses

  // Manual review state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeAnchor, setActiveAnchor] = useState<{ groupId: string; issueId: string; anchorIndex: number; lineStart: number; lineEnd: number } | null>(null)
  const [fullscreenGroupId, setFullscreenGroupId] = useState<string | null>(null)
  const [reviewFontSize, setReviewFontSize] = useState<ReviewFullscreenFontSize>(DEFAULT_REVIEW_FULLSCREEN_FONT_SIZE)
  const [confirmedChunksByGroup, setConfirmedChunksByGroup] = useState<Record<string, ConfirmedReferenceChunk[]>>({})
  const sourceLineRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!fullscreenGroupId) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreenGroupId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenGroupId])

  const updateIssue = (sectionId: string, issueId: string, changes: Partial<SectionIssue>) => {
    setSectionAnalyses(sectionAnalyses.map((sa: SectionAnalysis) =>
      sa.section_id !== sectionId ? sa : {
        ...sa,
        issues: sa.issues.map((i: SectionIssue) => i.id !== issueId ? i : { ...i, ...changes }),
      }
    ))
  }

  const groups = useMemo(() => buildAnalysisGroups(parsedArticle.sections), [parsedArticle.sections])
  const analysisTargets = useMemo(
    () => groups.map(group => ({
      id: group.representative.id,
      heading: group.representative.heading,
    })),
    [groups],
  )

  useEffect(() => {
    const remapped = remapSectionAnalysesToCurrentSections(sectionAnalyses, analysisTargets)
    if (haveSectionAnalysisIdsChanged(sectionAnalyses, remapped)) {
      setSectionAnalyses(remapped)
    }
  }, [analysisTargets, sectionAnalyses, setSectionAnalyses])

  const currentGroupIds = useMemo(() => new Set(groups.map(g => g.representative.id)), [groups])
  const visibleAnalyses = useMemo(
    () => sectionAnalyses.filter(a => currentGroupIds.has(a.section_id)),
    [currentGroupIds, sectionAnalyses],
  )
  const staleAnalysisIds = useMemo(() => new Set(
    visibleAnalyses
      .filter(a =>
        a.analysis_source_hash !== parsedArticleSourceHash
        || a.analysis_parser_version !== parsedArticleParserVersion,
      )
      .map(a => a.section_id),
  ), [visibleAnalyses, parsedArticleSourceHash, parsedArticleParserVersion])

  const stampAnalysis = (analysis: SectionAnalysis): SectionAnalysis => ({
    ...analysis,
    analysis_source_hash: parsedArticleSourceHash,
    analysis_parser_version: parsedArticleParserVersion,
  })

  const locateIssue = (group: AnalysisGroup, issue: SectionIssue, anchor?: LocatableIssueAnchor) => {
    const groupId = group.representative.id
    const targetAnchor = anchor ?? getIssueLocatorAnchors(issue, group.combinedContent)[0]
    if (typeof targetAnchor?.line_start !== 'number') return
    const lastLine = Math.max(group.combinedContent.split('\n').length - 1, 0)
    const lineStart = Math.min(Math.max(targetAnchor.line_start, 0), lastLine)
    const lineEnd = typeof targetAnchor.line_end === 'number'
      ? Math.min(Math.max(targetAnchor.line_end, lineStart), lastLine)
      : lineStart
    setActiveAnchor({ groupId, issueId: issue.id, anchorIndex: targetAnchor.index, lineStart, lineEnd })
    requestAnimationFrame(() => {
      const scope = fullscreenGroupId === groupId ? 'fullscreen' : 'main'
      const target = sourceLineRefs.current[`${scope}:${groupId}:${lineStart}`]
        ?? sourceLineRefs.current[`main:${groupId}:${lineStart}`]
        ?? sourceLineRefs.current[`fullscreen:${groupId}:${lineStart}`]
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

  const getSelectedReferenceNames = (groupId: string) => {
    const saved = sectionReferenceSelections[groupId]
    if (!saved) return referenceDocs.map(d => d.filename)
    if (saved.includes(NO_REFERENCES_SELECTED)) return []
    return saved
  }
  const getSelectedReferenceDocs = (groupId: string) => {
    const selected = new Set(getSelectedReferenceNames(groupId))
    return referenceDocs.filter(d => selected.has(d.filename))
  }
  const setGroupReferenceNames = (groupId: string, names: string[]) => {
    setSectionReferenceSelections(prev => {
      const next = { ...prev }
      if (names.length === 0) {
        next[groupId] = [NO_REFERENCES_SELECTED]
      } else {
        next[groupId] = names
      }
      return next
    })
    setSectionPriorityReferenceSelections(prev => {
      const allowed = new Set(names)
      const current = prev[groupId] ?? []
      const kept = current.filter(filename => allowed.has(filename))
      if (kept.length === current.length) return prev
      const next = { ...prev }
      if (kept.length === 0) delete next[groupId]
      else next[groupId] = kept
      return next
    })
  }
  const toggleGroupReference = (groupId: string, filename: string) => {
    const selected = new Set(getSelectedReferenceNames(groupId))
    if (selected.has(filename)) selected.delete(filename)
    else selected.add(filename)
    setGroupReferenceNames(groupId, Array.from(selected))
  }
  const getPriorityReferenceNames = (groupId: string) => {
    const selected = new Set(getSelectedReferenceNames(groupId))
    return (sectionPriorityReferenceSelections[groupId] ?? []).filter(filename => selected.has(filename))
  }
  const getPriorityReferenceDocs = (groupId: string) => {
    const priority = new Set(getPriorityReferenceNames(groupId))
    return referenceDocs.filter(d => priority.has(d.filename))
  }
  const togglePriorityReference = (groupId: string, filename: string) => {
    const selected = new Set(getSelectedReferenceNames(groupId))
    if (!selected.has(filename)) return
    setSectionPriorityReferenceSelections(prev => {
      const current = new Set(prev[groupId] ?? [])
      if (current.has(filename)) current.delete(filename)
      else current.add(filename)
      const next = { ...prev }
      const names = Array.from(current)
      if (names.length === 0) delete next[groupId]
      else next[groupId] = names
      return next
    })
  }

  const analyzeGroup = async (group: AnalysisGroup): Promise<SectionAnalysis> => {
    const mergedSection: ArticleSection = {
      ...group.representative,
      content: group.combinedContent,
      word_count: getAnalysisGroupWordCount(group),
    }
    const selectedReferenceDocs = getSelectedReferenceDocs(group.representative.id)
    const referencePayload = buildSectionAnalysisReferencePayload({
      allReferenceDocs: referenceDocs,
      selectedReferenceDocs,
      priorityReferenceDocs: getPriorityReferenceDocs(group.representative.id),
      confirmedChunks: confirmedChunksByGroup[group.representative.id] ?? [],
    })
    const res = await apiFetch('/api/analyze/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disease,
        article_entry_type: articleEntryType,
        section: mergedSection,
        article_outline: parsedArticle.sections
          .filter(s => s.level === 1 && !isSummarySection(s.heading))
          .map(s => s.heading),
        quality_standard_text: standardsOverride.qualityText ?? null,
        content_spec_text: standardsOverride.specText ?? null,
        ...referencePayload,
      }),
    })
    const data = await safeJson(res)
    if (!res.ok) throw new Error(data.detail || '分析失败')
    return data as SectionAnalysis
  }

  const runAll = async () => {
    // Mark all as analysing and clear previous results
    const allAnalysing: Record<string, boolean> = {}
    groups.forEach(g => { allAnalysing[g.representative.id] = true })
    setAnalysing(allAnalysing)
    setErrors({})
    setSectionAnalyses([])

    // Analyze sections with limited concurrency so Gemini RPM/TPM limits are less likely to trip.
    resultsRef.current = []
    let cursor = 0
    const inFlight = new Set<Promise<void>>()

    const runGroup = async (group: AnalysisGroup) => {
      const id = group.representative.id
      try {
        const result = stampAnalysis(await analyzeGroup(group))
        resultsRef.current = [...resultsRef.current.filter(a => a.section_id !== id), result]
        setSectionAnalyses([...resultsRef.current])
      } catch (e: any) {
        setErrors(prev => ({ ...prev, [id]: e.message }))
        const placeholder: SectionAnalysis = { section_id: id, section_heading: group.representative.heading, issues: [] }
        resultsRef.current = [...resultsRef.current.filter(a => a.section_id !== id), placeholder]
        setSectionAnalyses([...resultsRef.current])
      } finally {
        setAnalysing(prev => { const n = { ...prev }; delete n[id]; return n })
      }
    }

    const launchNext = () => {
      const group = groups[cursor]
      cursor += 1
      const task = runGroup(group).finally(() => inFlight.delete(task))
      inFlight.add(task)
    }

    while (cursor < groups.length || inFlight.size > 0) {
      while (cursor < groups.length && inFlight.size < MAX_SECTION_ANALYSIS_CONCURRENCY) {
        launchNext()
      }
      if (inFlight.size > 0) await Promise.race(inFlight)
    }
  }

  const analyzeSingleGroup = async (groupId: string) => {
    const group = groups.find(g => g.representative.id === groupId)
    if (!group) return
    setErrors(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setAnalysing(prev => ({ ...prev, [groupId]: true }))
    try {
      const result = stampAnalysis(await analyzeGroup(group))
      resultsRef.current = [...resultsRef.current.filter(a => a.section_id !== groupId), result]
      setSectionAnalyses([...resultsRef.current])
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [groupId]: e.message }))
    } finally {
      setAnalysing(prev => { const n = { ...prev }; delete n[groupId]; return n })
    }
  }

  const anyAnalysing = Object.keys(analysing).length > 0
  const analysedCount = groups.filter(g => visibleAnalyses.some(a => a.section_id === g.representative.id)).length
  const totalIssues = visibleAnalyses.reduce((acc, a) => acc + a.issues.filter(i => i.status !== 'rejected').length, 0)
  const failedCount = Object.keys(errors).length
  const hasStaleAnalyses = staleAnalysisIds.size > 0
  const isComplete = analysedCount >= groups.length && groups.length > 0 && !anyAnalysing && failedCount === 0 && !hasStaleAnalyses

  const dimStats = computeDimStats(visibleAnalyses)

  const overallRating: Rating | null = useMemo(() => {
    if (visibleAnalyses.length === 0) return null
    const ratings = [1, 2, 3, 4].map(d => getDimRating(d, dimStats[d], parsedArticle.total_words))
    if (ratings.every(r => r === 'excellent')) return 'excellent'
    if (ratings.every(r => r !== 'fail')) return 'pass'
    return 'fail'
  }, [dimStats, visibleAnalyses, parsedArticle.total_words])

  const fullscreenGroup = fullscreenGroupId ? groups.find(g => g.representative.id === fullscreenGroupId) ?? null : null
  const reviewFontScale = getReviewFullscreenFontScale(reviewFontSize)
  const renderFontSizeControl = (ariaLabel: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>字体</span>
      <div
        role="group"
        aria-label={ariaLabel}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          borderRadius: 6,
          background: 'var(--m3-surface-container-low)',
          border: '0.5px solid var(--dui-divider)',
        }}
      >
        {REVIEW_FULLSCREEN_FONT_SIZES.map(option => {
          const active = reviewFontSize === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setReviewFontSize(option.value)}
              aria-pressed={active}
              style={{
                minWidth: 32,
                height: 26,
                padding: '0 10px',
                border: 'none',
                borderRadius: 4,
                background: active ? 'var(--dui-surface)' : 'transparent',
                color: active ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          内容质量评审
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          AI 逐章节审核内容质量，识别问题并给出改进建议
        </p>
        <p style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginTop: 6 }}>
          进入本页不会自动调用 AI。请选择需要审评的章节，点击“开始分析”后才会运行。
        </p>
      </div>

      {/* Control bar */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {anyAnalysing ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)' }}>正在分析已选择章节…</span>
              <span style={{ color: 'var(--m3-on-surface-variant)', fontSize: 13 }}>
                已完成 {analysedCount} / {groups.length} 个章节组
              </span>
            </>
          ) : isComplete ? (
            <>
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)' }}>内容质量评审完成</span>
              <span style={{ color: 'var(--m3-tertiary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 4 }}>check_circle</span>
                {analysedCount} / {groups.length} 个章节组已分析
              </span>
            </>
          ) : (
            <>
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)' }}>请选择章节开始内容质量评审</span>
              <span style={{ color: 'var(--m3-tertiary)' }}>
                已分析 {analysedCount} / {groups.length} 个章节组
              </span>
            </>
          )}
          {totalIssues > 0 && <span style={{ color: 'var(--dui-warning)' }}>共发现 {totalIssues} 个问题</span>}
          {failedCount > 0 && <span style={{ color: 'var(--m3-error)' }}>{failedCount} 个章节失败</span>}
          <button
            className="btn-m3-outline"
            style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 14px' }}
            onClick={runAll}
            disabled={anyAnalysing}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
            {analysedCount > 0 ? '重新分析全部' : '分析全部'}
          </button>
        </div>
      </div>

      {hasStaleAnalyses && (
        <div className="section-card" style={{ marginBottom: 16, borderColor: 'var(--dui-warning)', background: 'var(--dui-warning-container)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--dui-warning)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, marginTop: 1 }}>warning</span>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              内容已经重新解析，当前有 {staleAnalysisIds.size} 个章节的审评结果基于旧解析，暂时仅供参考。
              请重新分析这些章节后再进入下一步。
            </div>
          </div>
        </div>
      )}

      {/* Section detail */}
      <div style={{
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)' }}>
          章节详情
        </span>
        {renderFontSizeControl('评审内容字体大小')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {groups.map((group, i) => {
          const analysis = sectionAnalyses.find(a => a.section_id === group.representative.id)
          const hasError = !!errors[group.representative.id]
          const hasAnalysis = !!analysis
          const allIssues = analysis?.issues ?? []
          const issues = allIssues.filter(issue => issue.status !== 'rejected')
          const totalWords = getAnalysisGroupWordCount(group)
          const selectedRefNames = getSelectedReferenceNames(group.representative.id)
          const selectedRefCount = getSelectedReferenceDocs(group.representative.id).length
          const priorityRefNames = getPriorityReferenceNames(group.representative.id)
          const priorityRefCount = priorityRefNames.length
          const isStale = staleAnalysisIds.has(group.representative.id)

          const isAnalysing = !!analysing[group.representative.id]
          const headerBg = isAnalysing ? 'var(--gray-50)' : isStale ? 'var(--dui-warning-container)' : issues.length > 0 ? 'var(--orange-light)' : 'var(--gray-50)'
          const borderColor = hasError ? 'var(--dui-danger)' : isStale ? 'var(--dui-warning)' : issues.length > 0 ? 'var(--dui-warning)' : 'var(--dui-divider)'

          // Always show split view (original content always visible);
          // right panel shows spinner while analysing, issues when done
          const showSplit = isAnalysing || hasAnalysis || hasError

          return (
            <div key={group.representative.id} style={{
              border: `0.5px solid ${borderColor}`,
              borderRadius: 'var(--dui-radius-card)',
              background: hasError ? 'var(--dui-danger-container)' : 'var(--dui-surface)',
              overflow: 'hidden',
            }}>
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: headerBg,
                borderBottom: showSplit ? '1px solid var(--gray-200)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--gray-400)', minWidth: 20 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{group.representative.heading}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{totalWords} 字</span>
                {isAnalysing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>分析中…</span>
                  </div>
                )}
                <span style={{
                  fontSize: 12,
                  color: selectedRefCount > 0 ? 'var(--m3-primary)' : 'var(--gray-500)',
                  background: 'var(--m3-surface-container-low)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}>
                  参考文献 {selectedRefCount}/{referenceDocs.length}
                </span>
                {priorityRefCount > 0 && (
                  <span style={{
                    fontSize: 12,
                    color: 'var(--dui-warning)',
                    background: 'var(--dui-warning-container)',
                    borderRadius: 999,
                    padding: '2px 8px',
                  }}>
                    重点指南 {priorityRefCount}
                  </span>
                )}
                {isStale && !isAnalysing && (
                  <span style={{
                    fontSize: 12,
                    color: 'var(--dui-warning)',
                    background: 'var(--dui-warning-container)',
                    borderRadius: 999,
                    padding: '2px 8px',
                  }}>
                    旧结果
                  </span>
                )}
                {!isAnalysing && !hasError && hasAnalysis && (
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: isStale ? 'var(--dui-warning)' : issues.length > 0 ? 'var(--orange)' : 'var(--green)',
                  }}>
                    {isStale ? '需重新分析' : issues.length > 0 ? `${issues.length} 个问题` : '✓ 无问题'}
                  </span>
                )}
                {!isAnalysing && !hasError && !hasAnalysis && (
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>未分析</span>
                )}
                {showSplit && (
                  <button
                    className="btn-m3-outline"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setFullscreenGroupId(group.representative.id)}
                    title="全屏查看该字段原文与问题"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>fullscreen</span>
                    全屏
                  </button>
                )}
                {!isAnalysing && !hasError && (
                  <button
                    className="btn-m3-outline"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => analyzeSingleGroup(group.representative.id)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                      {hasAnalysis ? 'refresh' : 'play_arrow'}
                    </span>
                    {hasAnalysis ? '重新分析' : '开始分析'}
                  </button>
                )}
                {hasError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--red)' }}>分析失败</span>
                    <button
                      className="btn btn-sm"
                      style={{ padding: '2px 8px', color: 'var(--blue)' }}
                      onClick={() => analyzeSingleGroup(group.representative.id)}
                    >重试</button>
                  </div>
                )}
              </div>

              <div style={{
                padding: '10px 14px 12px',
                borderBottom: showSplit ? '1px solid var(--gray-200)' : 'none',
                background: 'var(--m3-surface-container-lowest)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: referenceDocs.length > 0 ? 8 : 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--m3-on-surface)' }}>
                    本章节参考文献
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
                    已选 {selectedRefCount} / {referenceDocs.length}，重点指南 {priorityRefCount}
                  </span>
                  {referenceDocs.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                      <button
                        className="btn btn-sm"
                        style={{ padding: '3px 10px', fontSize: 12, color: 'var(--m3-primary)' }}
                        onClick={() => setGroupReferenceNames(group.representative.id, referenceDocs.map(d => d.filename))}
                      >
                        全选
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ padding: '3px 10px', fontSize: 12, color: 'var(--gray-500)' }}
                        onClick={() => setGroupReferenceNames(group.representative.id, [])}
                      >
                        清空
                      </button>
                    </div>
                  )}
                </div>
                {referenceDocs.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>未上传参考文献，将不带参考文献分析</span>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 8,
                    maxHeight: 170,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}>
                    {referenceDocs.map((doc, refIndex) => {
                      const checked = selectedRefNames.includes(doc.filename)
                      const isPriority = priorityRefNames.includes(doc.filename)
                      return (
                        <label
                          key={`${doc.filename}-${refIndex}`}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            minWidth: 0,
                            padding: '7px 10px',
                            borderRadius: 10,
                            border: `0.5px solid ${checked ? 'var(--m3-primary)' : 'var(--dui-divider)'}`,
                            background: isPriority ? 'var(--dui-warning-container)' : checked ? 'var(--dui-primary-container)' : 'var(--m3-surface-container-low)',
                            color: checked ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                          title={`${doc.filename} · ${doc.char_count} 字符`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroupReference(group.representative.id, doc.filename)}
                            style={{ margin: '2px 0 0', flexShrink: 0 }}
                          />
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{
                              display: 'block',
                              lineHeight: 1.45,
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}>
                              {refIndex + 1}. {doc.filename}
                            </span>
                            <span style={{
                              display: 'block',
                              marginTop: 2,
                              fontSize: 11,
                              color: isPriority ? 'var(--dui-warning)' : checked ? 'var(--m3-primary)' : 'var(--gray-400)',
                            }}>
                              {doc.char_count.toLocaleString()} 字符
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={!checked}
                            onClick={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              togglePriorityReference(group.representative.id, doc.filename)
                            }}
                            style={{
                              border: 'none',
                              borderRadius: 999,
                              padding: '3px 8px',
                              fontSize: 11,
                              cursor: checked ? 'pointer' : 'not-allowed',
                              flexShrink: 0,
                              background: isPriority ? 'var(--dui-warning)' : 'var(--m3-surface-container-highest)',
                              color: isPriority ? '#fff' : checked ? 'var(--dui-warning)' : 'var(--gray-400)',
                              opacity: checked ? 1 : 0.55,
                            }}
                            title={checked ? '设为本章节重点指南；冲突时以重点指南为准' : '请先选中该参考文献'}
                          >
                            {isPriority ? '重点' : '设重点'}
                          </button>
                        </label>
                      )
                    })}
                  </div>
                )}
                {referenceDocs.length > 0 && selectedRefNames.length > 0 && (
                  <ChunkConfirmationPanel
                    taskType="quality_review"
                    disease={disease}
                    query={`${group.representative.heading}\n${group.combinedContent.slice(0, 2000)}`}
                    referenceDocs={referenceDocs}
                    selectedReferenceNames={selectedRefNames}
                    priorityReferenceNames={priorityRefNames}
                    value={confirmedChunksByGroup[group.representative.id] ?? []}
                    onChange={chunks => setConfirmedChunksByGroup(prev => ({
                      ...prev,
                      [group.representative.id]: chunks,
                    }))}
                    compact
                  />
                )}
              </div>

              {/* Split view: always shown so original content is visible */}
              {showSplit && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  height: 'clamp(420px, calc(100vh - 240px), 760px)',
                  minWidth: 0,
                }}>
                  {/* Left: original content */}
                  <div style={{
                    borderRight: '0.5px solid var(--dui-divider)',
                    display: 'flex', flexDirection: 'column',
                    minHeight: 0, minWidth: 0,
                  }}>
                    <div style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 500,
                      color: 'var(--gray-500)', background: 'var(--gray-50)',
                      borderBottom: '0.5px solid var(--dui-divider)',
                    }}>
                      原文内容
                    </div>
                    <div style={{
                      padding: '10px 12px',
                      flex: 1, minHeight: 0, overflowY: 'auto',
                      fontSize: reviewFontScale.body, lineHeight: reviewFontScale.lineHeight, color: 'var(--gray-700)',
                    }}>
                      {group.combinedContent.split('\n').map((line, li) => {
                        const isActiveLine = activeAnchor?.groupId === group.representative.id
                          && li >= activeAnchor.lineStart
                          && li <= activeAnchor.lineEnd
                        const lineBaseStyle = getSourceLineBaseStyle(isActiveLine)
                        const lineRef = (node: HTMLDivElement | null) => {
                          sourceLineRefs.current[`main:${group.representative.id}:${li}`] = node
                        }
                        if (line.startsWith('### ')) return (
                          <div ref={lineRef} key={li} style={{ ...lineBaseStyle, fontWeight: 500, color: 'var(--gray-800)', marginTop: 8, marginBottom: 2, fontSize: reviewFontScale.sourceSubheading }}>
                            {line.slice(4)}
                          </div>
                        )
                        if (line.startsWith('## ')) return (
                          <div ref={lineRef} key={li} style={{ ...lineBaseStyle, fontWeight: 500, color: 'var(--gray-900)', marginTop: 10, marginBottom: 3, fontSize: reviewFontScale.sourceHeading, borderBottom: '0.5px solid var(--dui-divider)', paddingBottom: 2 }}>
                            {line.slice(3)}
                          </div>
                        )
                        if (!line.trim()) return <div ref={lineRef} key={li} style={{ height: 6 }} />
                        return <div ref={lineRef} key={li} style={{ ...lineBaseStyle, marginBottom: 2 }}>{line}</div>
                      })}
                    </div>
                  </div>

                  {/* Right: issues or per-section loading state */}
                  <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                    <div style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 500,
                      color: isAnalysing ? 'var(--gray-400)' : hasError ? 'var(--red)' : isStale ? 'var(--dui-warning)' : issues.length > 0 ? 'var(--orange)' : 'var(--green)',
                      background: 'var(--gray-50)',
                      borderBottom: '0.5px solid var(--dui-divider)',
                    }}>
                      {isAnalysing ? '分析中…' : hasError ? '分析失败' : isStale ? '旧审评结果（请重新分析）' : issues.length > 0 ? `发现问题（${issues.length} 项）` : '✓ 无问题'}
                    </div>

                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                      {isAnalysing && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: 10, color: 'var(--gray-400)', fontSize: reviewFontScale.body }}>
                          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                          AI 正在审核此章节…
                        </div>
                      )}

                      {hasError && (
                        <div style={{ fontSize: reviewFontScale.supportingText, color: 'var(--red)', padding: '12px 14px' }}>
                          {errors[group.representative.id]}
                        </div>
                      )}

                      {!isAnalysing && !hasError && issues.length === 0 && (
                        <div style={{ fontSize: reviewFontScale.supportingText, color: 'var(--gray-400)', padding: '16px 14px' }}>
                          本章节未发现问题
                        </div>
                      )}

                      {!isAnalysing && allIssues.length > 0 && (
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {allIssues.map((issue, j) => {
                            const dim = TYPE_TO_DIM[issue.issue_type] ?? 1
                            const sevColor = issue.severity === 'high' ? 'var(--red)' : issue.severity === 'medium' ? 'var(--orange)' : 'var(--blue)'
                            const sevBg = issue.severity === 'high' ? 'var(--red-light)' : issue.severity === 'medium' ? 'var(--orange-light)' : 'var(--blue-light)'
                            const isRejected = issue.status === 'rejected'
                            const isConfirmed = issue.status === 'confirmed'
                            const isExpanded = expandedId === issue.id
                            const locatableAnchors = getIssueLocatorAnchors(issue, group.combinedContent)
                            const hasAnchor = locatableAnchors.length > 0
                            const guidelineEvidence = issue.guideline_evidence ?? []
                            const shouldShowGuidelineEvidence = ['missing_content', 'accuracy', 'outdated'].includes(issue.issue_type)
                            return (
                              <div key={j} style={{
                                background: isRejected ? 'var(--gray-50)' : 'white',
                                border: isRejected
                                  ? '1px solid var(--gray-200)'
                                  : isConfirmed
                                    ? '1px solid var(--green)'
                                    : `0.5px solid ${issue.severity === 'high' ? 'var(--dui-danger)' : issue.severity === 'medium' ? 'var(--dui-warning)' : 'var(--dui-primary)'}`,
                                borderRadius: 6, padding: '8px 10px',
                                opacity: isRejected ? 0.5 : 1,
                              }}>
                                {/* Tags + actions row */}
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: isRejected ? 'var(--gray-100)' : sevBg, color: isRejected ? 'var(--gray-400)' : sevColor }}>
                                    {issue.severity === 'high' ? '高优先' : issue.severity === 'medium' ? '中优先' : '低优先'}
                                  </span>
                                  <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: 'var(--gray-200)', color: 'var(--gray-600)' }}>
                                    {ISSUE_TYPE_LABELS[issue.issue_type] ?? issue.issue_type}
                                  </span>
                                  <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                                    D{dim} {DIM_CONFIG[dim].label}
                                  </span>
                                  {(dim === 1) && (
                                    <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: issue.is_key_content ? 'var(--dui-warning-container)' : 'var(--dui-surface-soft)', color: issue.is_key_content ? 'var(--dui-warning)' : 'var(--dui-text-sub)' }}>
                                      {issue.is_key_content ? '重点内容' : '非重点内容'}
                                    </span>
                                  )}
                                  {(dim === 2) && (
                                    <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: issue.severity === 'high' ? 'var(--dui-warning-container)' : 'var(--dui-surface-soft)', color: issue.severity === 'high' ? 'var(--dui-warning)' : 'var(--dui-text-sub)' }}>
                                      {issue.severity === 'high' ? '重点内容' : '非重点内容'}
                                    </span>
                                  )}
                                  {(issue.deduction_score ?? 0) > 0 && (
                                    <span style={{ fontSize: 12, fontWeight: 500, color: isRejected ? 'var(--gray-400)' : 'var(--red)', marginLeft: 'auto' }}>
                                      -{issue.deduction_score}分
                                    </span>
                                  )}
                                  {/* Action buttons */}
                                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                    {hasAnchor && (
                                      <button type="button" className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, color: 'var(--dui-warning)' }}
                                        onClick={() => locateIssue(group, issue, locatableAnchors[0])}
                                        title="定位到左侧原文">
                                        {locatableAnchors.length > 1 ? `定位 ${locatableAnchors.length}处` : '定位'}
                                      </button>
                                    )}
                                    {isConfirmed && (
                                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green)', padding: '1px 6px' }}>✓ 已确认</span>
                                    )}
                                    {!isRejected && !isConfirmed && (
                                      <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--green-light)', color: 'var(--green)' }}
                                        onClick={() => updateIssue(group.representative.id, issue.id, { status: 'confirmed' })}>
                                        ✓ 确认
                                      </button>
                                    )}
                                    {isConfirmed && (
                                      <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12 }}
                                        onClick={() => updateIssue(group.representative.id, issue.id, { status: 'ai' })}>
                                        撤销
                                      </button>
                                    )}
                                    {!isRejected ? (
                                      <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--red-light)', color: 'var(--red)' }}
                                        onClick={() => updateIssue(group.representative.id, issue.id, { status: 'rejected' })}>
                                        ✕ 排除
                                      </button>
                                    ) : (
                                      <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--gray-100)', color: 'var(--gray-500)' }}
                                        onClick={() => updateIssue(group.representative.id, issue.id, { status: 'ai' })}>
                                        恢复
                                      </button>
                                    )}
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, color: 'var(--blue)' }}
                                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}>
                                      {isExpanded ? '收起' : '编辑'}
                                    </button>
                                  </div>
                                </div>
                                {/* Description — editable when expanded, read-only otherwise */}
                                {isExpanded ? (
                                  <textarea
                                    className="textarea"
                                    value={issue.description}
                                    onChange={e => updateIssue(group.representative.id, issue.id, { description: e.target.value })}
                                    style={{ minHeight: 56, fontSize: reviewFontScale.issueBody, marginTop: 2, marginBottom: 4 }}
                                    autoFocus
                                  />
                                ) : (
                                  <div style={{ fontSize: reviewFontScale.issueBody, color: isRejected ? 'var(--gray-400)' : 'var(--gray-800)', lineHeight: reviewFontScale.issueLineHeight,
                                    textDecoration: isRejected ? 'line-through' : 'none' }}>
                                    {issue.description}
                                  </div>
                                )}
                                {!isExpanded && locatableAnchors.length > 1 && (
                                  <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {locatableAnchors.map(anchor => {
                                      const isActiveAnchor = activeAnchor?.groupId === group.representative.id
                                        && activeAnchor.issueId === issue.id
                                        && activeAnchor.anchorIndex === anchor.index
                                      return (
                                        <button
                                          type="button"
                                          key={anchor.index}
                                          className="btn btn-sm"
                                          style={{
                                            padding: '2px 8px',
                                            fontSize: 12,
                                            color: isActiveAnchor ? 'var(--m3-primary)' : 'var(--dui-warning)',
                                            background: isActiveAnchor ? 'var(--dui-primary-container)' : 'var(--m3-surface-container-low)',
                                            border: `0.5px solid ${isActiveAnchor ? 'var(--m3-primary)' : 'var(--dui-divider)'}`,
                                          }}
                                          onClick={() => locateIssue(group, issue, anchor)}
                                          title={anchor.quote || anchor.heading_hint || anchor.label}
                                        >
                                          {anchor.label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                                {/* Examples */}
                                {!isExpanded && issue.examples && issue.examples.length > 0 && (
                                  <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {issue.examples.map((ex, ei) => (
                                      <div key={ei} style={{
                                        fontSize: reviewFontScale.supportingText, color: 'var(--gray-600)', lineHeight: 1.6,
                                        background: 'var(--gray-50)', borderRadius: 3, padding: '3px 7px',
                                        borderLeft: `2px solid ${isRejected ? 'var(--gray-300)' : sevColor}`,
                                      }}>
                                        {ex}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {!isExpanded && shouldShowGuidelineEvidence && (
                                  <div style={{
                                    marginTop: 6,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 5,
                                  }}>
                                    {guidelineEvidence.length === 0 && (
                                      <div style={{
                                        fontSize: reviewFontScale.supportingText,
                                        color: isRejected ? 'var(--gray-400)' : 'var(--dui-warning)',
                                        lineHeight: 1.65,
                                        background: isRejected ? 'var(--gray-50)' : 'var(--dui-warning-container)',
                                        borderRadius: 4,
                                        padding: '5px 8px',
                                        borderLeft: `2px solid ${isRejected ? 'var(--gray-300)' : 'var(--dui-warning)'}`,
                                      }}>
                                        <span style={{ fontWeight: 500 }}>指南依据：</span>
                                        未提供指南原文依据，请重新分析该章节。
                                      </div>
                                    )}
                                    {guidelineEvidence.map((evidence, ei) => (
                                      <div key={ei} style={{
                                        fontSize: reviewFontScale.supportingText,
                                        color: isRejected ? 'var(--gray-400)' : 'var(--gray-700)',
                                        lineHeight: 1.65,
                                        background: isRejected ? 'var(--gray-50)' : 'var(--dui-primary-container)',
                                        borderRadius: 4,
                                        padding: '5px 8px',
                                        borderLeft: `2px solid ${isRejected ? 'var(--gray-300)' : 'var(--dui-primary)'}`,
                                      }}>
                                        <div style={{ fontWeight: 500, color: isRejected ? 'var(--gray-400)' : 'var(--dui-primary)', marginBottom: 2 }}>
                                          指南依据：{evidence.source || '未标明来源'}
                                        </div>
                                        {evidence.quote && (
                                          <div style={{ whiteSpace: 'pre-wrap' }}>{evidence.quote}</div>
                                        )}
                                        {evidence.relevance && (
                                          <div style={{ marginTop: 3, color: isRejected ? 'var(--gray-400)' : 'var(--gray-600)' }}>
                                            {evidence.relevance}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {!isAnalysing && analysis?.verification_summary && (
                        <div style={{
                          margin: '0 10px 8px',
                          padding: '6px 10px',
                          background: 'var(--blue-light)',
                          borderRadius: 4,
                          fontSize: reviewFontScale.supportingText,
                          color: 'var(--gray-600)',
                          lineHeight: 1.7,
                          borderLeft: '3px solid var(--dui-primary)',
                        }}>
                          <span style={{ fontWeight: 500, color: 'var(--blue)' }}>二次核验：</span>
                          {analysis.verification_summary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {fullscreenGroup && (() => {
        const group = fullscreenGroup
        const analysis = sectionAnalyses.find(a => a.section_id === group.representative.id)
        const allIssues = analysis?.issues ?? []
        const issues = allIssues.filter(issue => issue.status !== 'rejected')
        const hasError = !!errors[group.representative.id]
        const isAnalysing = !!analysing[group.representative.id]
        const isStale = staleAnalysisIds.has(group.representative.id)

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            padding: 18,
          }}>
            <div style={{
              background: 'var(--dui-surface)',
              borderRadius: 8,
              boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              flex: 1,
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                padding: '12px 16px',
                borderBottom: '0.5px solid var(--dui-divider)',
                background: 'var(--m3-surface-container-lowest)',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--m3-primary)' }}>fullscreen</span>
                <div style={{ minWidth: 220, flex: '1 1 260px' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--m3-on-surface)' }}>{group.representative.heading}</div>
                  <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>
                    {getAnalysisGroupWordCount(group)} 字 · {isAnalysing ? '分析中' : hasError ? '分析失败' : isStale ? '旧审评结果' : `${issues.length} 个有效问题`}
                  </div>
                </div>
                {renderFontSizeControl('全屏内容字体大小')}
                <button
                  className="btn-m3-outline"
                  style={{ padding: '5px 12px', fontSize: 12 }}
                  onClick={() => setFullscreenGroupId(null)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close_fullscreen</span>
                  退出全屏
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
                minHeight: 0,
                flex: 1,
                overflow: 'hidden',
              }}>
                <div style={{ borderRight: '0.5px solid var(--dui-divider)', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                  <div style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--gray-600)',
                    background: 'var(--gray-50)',
                    borderBottom: '0.5px solid var(--dui-divider)',
                  }}>
                    原文内容
                  </div>
                  <div style={{
                    padding: '12px 16px',
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    fontSize: reviewFontScale.body,
                    lineHeight: reviewFontScale.lineHeight,
                    color: 'var(--gray-700)',
                  }}>
                    {group.combinedContent.split('\n').map((line, li) => {
                      const isActiveLine = activeAnchor?.groupId === group.representative.id
                        && li >= activeAnchor.lineStart
                        && li <= activeAnchor.lineEnd
                      const lineBaseStyle = getSourceLineBaseStyle(isActiveLine)
                      const lineRef = (node: HTMLDivElement | null) => {
                        sourceLineRefs.current[`fullscreen:${group.representative.id}:${li}`] = node
                      }
                      if (line.startsWith('### ')) return (
                        <div ref={lineRef} key={li} style={{ ...lineBaseStyle, fontWeight: 600, color: 'var(--gray-800)', marginTop: 10, marginBottom: 3, fontSize: reviewFontScale.sourceSubheading }}>
                          {line.slice(4)}
                        </div>
                      )
                      if (line.startsWith('## ')) return (
                        <div ref={lineRef} key={li} style={{ ...lineBaseStyle, fontWeight: 600, color: 'var(--gray-900)', marginTop: 12, marginBottom: 4, fontSize: reviewFontScale.sourceHeading, borderBottom: '0.5px solid var(--dui-divider)', paddingBottom: 3 }}>
                          {line.slice(3)}
                        </div>
                      )
                      if (!line.trim()) return <div ref={lineRef} key={li} style={{ height: 7 }} />
                      return <div ref={lineRef} key={li} style={{ ...lineBaseStyle, marginBottom: 2 }}>{line}</div>
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                  <div style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: isAnalysing ? 'var(--gray-500)' : hasError ? 'var(--red)' : isStale ? 'var(--dui-warning)' : issues.length > 0 ? 'var(--orange)' : 'var(--green)',
                    background: 'var(--gray-50)',
                    borderBottom: '0.5px solid var(--dui-divider)',
                  }}>
                    {isAnalysing ? '分析中…' : hasError ? '分析失败' : isStale ? '旧审评结果（请重新分析）' : issues.length > 0 ? `发现问题（${issues.length} 项）` : '无问题'}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px' }}>
                    {isAnalysing && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', gap: 10, color: 'var(--gray-400)', fontSize: reviewFontScale.body }}>
                        <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                        AI 正在审核此章节…
                      </div>
                    )}
                    {hasError && <div style={{ fontSize: reviewFontScale.supportingText, color: 'var(--red)', padding: '8px 2px' }}>{errors[group.representative.id]}</div>}
                    {!isAnalysing && !hasError && allIssues.length === 0 && (
                      <div style={{ fontSize: reviewFontScale.body, color: 'var(--gray-400)', padding: '16px 4px' }}>本章节未发现问题</div>
                    )}
                    {!isAnalysing && !hasError && allIssues.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {allIssues.map((issue, j) => {
                          const dim = TYPE_TO_DIM[issue.issue_type] ?? 1
                          const sevColor = issue.severity === 'high' ? 'var(--red)' : issue.severity === 'medium' ? 'var(--orange)' : 'var(--blue)'
                          const sevBg = issue.severity === 'high' ? 'var(--red-light)' : issue.severity === 'medium' ? 'var(--orange-light)' : 'var(--blue-light)'
                          const isRejected = issue.status === 'rejected'
                          const isConfirmed = issue.status === 'confirmed'
                          const locatableAnchors = getIssueLocatorAnchors(issue, group.combinedContent)
                          const hasAnchor = locatableAnchors.length > 0
                          const guidelineEvidence = issue.guideline_evidence ?? []
                          const shouldShowGuidelineEvidence = ['missing_content', 'accuracy', 'outdated'].includes(issue.issue_type)
                          return (
                            <div key={j} style={{
                              background: isRejected ? 'var(--gray-50)' : 'white',
                              border: isRejected
                                ? '1px solid var(--gray-200)'
                                : isConfirmed
                                  ? '1px solid var(--green)'
                                  : `0.5px solid ${issue.severity === 'high' ? 'var(--dui-danger)' : issue.severity === 'medium' ? 'var(--dui-warning)' : 'var(--dui-primary)'}`,
                              borderRadius: 6,
                              padding: '9px 11px',
                              opacity: isRejected ? 0.55 : 1,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 3, background: isRejected ? 'var(--gray-100)' : sevBg, color: isRejected ? 'var(--gray-400)' : sevColor }}>
                                  {issue.severity === 'high' ? '高优先' : issue.severity === 'medium' ? '中优先' : '低优先'}
                                </span>
                                <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: 'var(--gray-200)', color: 'var(--gray-600)' }}>
                                  {ISSUE_TYPE_LABELS[issue.issue_type] ?? issue.issue_type}
                                </span>
                                <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                                  D{dim} {DIM_CONFIG[dim].label}
                                </span>
                                {(issue.deduction_score ?? 0) > 0 && (
                                  <span style={{ fontSize: 12, fontWeight: 500, color: isRejected ? 'var(--gray-400)' : 'var(--red)', marginLeft: 'auto' }}>
                                    -{issue.deduction_score}分
                                  </span>
                                )}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                  {hasAnchor && (
                                    <button type="button" className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, color: 'var(--dui-warning)' }}
                                      onClick={() => locateIssue(group, issue, locatableAnchors[0])}>
                                      {locatableAnchors.length > 1 ? `定位 ${locatableAnchors.length}处` : '定位'}
                                    </button>
                                  )}
                                  {!isRejected && !isConfirmed && (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--green-light)', color: 'var(--green)' }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'confirmed' })}>
                                      确认
                                    </button>
                                  )}
                                  {isConfirmed && (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12 }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'ai' })}>
                                      撤销
                                    </button>
                                  )}
                                  {!isRejected ? (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--red-light)', color: 'var(--red)' }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'rejected' })}>
                                      排除
                                    </button>
                                  ) : (
                                    <button className="btn btn-sm" style={{ padding: '1px 8px', fontSize: 12, background: 'var(--gray-100)', color: 'var(--gray-500)' }}
                                      onClick={() => updateIssue(group.representative.id, issue.id, { status: 'ai' })}>
                                      恢复
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: reviewFontScale.issueBody, color: isRejected ? 'var(--gray-400)' : 'var(--gray-800)', lineHeight: reviewFontScale.issueLineHeight, textDecoration: isRejected ? 'line-through' : 'none' }}>
                                {issue.description}
                              </div>
                              {locatableAnchors.length > 1 && (
                                <div style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                  {locatableAnchors.map(anchor => {
                                    const isActiveAnchor = activeAnchor?.groupId === group.representative.id
                                      && activeAnchor.issueId === issue.id
                                      && activeAnchor.anchorIndex === anchor.index
                                    return (
                                      <button
                                        type="button"
                                        key={anchor.index}
                                        className="btn btn-sm"
                                        style={{
                                          padding: '2px 8px',
                                          fontSize: 12,
                                          color: isActiveAnchor ? 'var(--m3-primary)' : 'var(--dui-warning)',
                                          background: isActiveAnchor ? 'var(--dui-primary-container)' : 'var(--m3-surface-container-low)',
                                          border: `0.5px solid ${isActiveAnchor ? 'var(--m3-primary)' : 'var(--dui-divider)'}`,
                                        }}
                                        onClick={() => locateIssue(group, issue, anchor)}
                                        title={anchor.quote || anchor.heading_hint || anchor.label}
                                      >
                                        {anchor.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                              {issue.examples && issue.examples.length > 0 && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {issue.examples.map((ex, ei) => (
                                    <div key={ei} style={{
                                      fontSize: reviewFontScale.supportingText,
                                      color: 'var(--gray-600)',
                                      lineHeight: 1.65,
                                      background: 'var(--gray-50)',
                                      borderRadius: 4,
                                      padding: '4px 8px',
                                      borderLeft: `2px solid ${isRejected ? 'var(--gray-300)' : sevColor}`,
                                    }}>
                                      {ex}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {shouldShowGuidelineEvidence && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {guidelineEvidence.length === 0 && (
                                    <div style={{
                                      fontSize: reviewFontScale.supportingText,
                                      color: isRejected ? 'var(--gray-400)' : 'var(--dui-warning)',
                                      lineHeight: 1.65,
                                      background: isRejected ? 'var(--gray-50)' : 'var(--dui-warning-container)',
                                      borderRadius: 4,
                                      padding: '5px 8px',
                                      borderLeft: `2px solid ${isRejected ? 'var(--gray-300)' : 'var(--dui-warning)'}`,
                                    }}>
                                      <span style={{ fontWeight: 500 }}>指南依据：</span>
                                      未提供指南原文依据，请重新分析该章节。
                                    </div>
                                  )}
                                  {guidelineEvidence.map((evidence, ei) => (
                                    <div key={ei} style={{
                                      fontSize: reviewFontScale.supportingText,
                                      color: isRejected ? 'var(--gray-400)' : 'var(--gray-700)',
                                      lineHeight: 1.65,
                                      background: isRejected ? 'var(--gray-50)' : 'var(--dui-primary-container)',
                                      borderRadius: 4,
                                      padding: '5px 8px',
                                      borderLeft: `2px solid ${isRejected ? 'var(--gray-300)' : 'var(--dui-primary)'}`,
                                    }}>
                                      <div style={{ fontWeight: 500, color: isRejected ? 'var(--gray-400)' : 'var(--dui-primary)', marginBottom: 2 }}>
                                        指南依据：{evidence.source || '未标明来源'}
                                      </div>
                                      {evidence.quote && <div style={{ whiteSpace: 'pre-wrap' }}>{evidence.quote}</div>}
                                      {evidence.relevance && (
                                        <div style={{ marginTop: 3, color: isRejected ? 'var(--gray-400)' : 'var(--gray-600)' }}>{evidence.relevance}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {!isAnalysing && analysis?.verification_summary && (
                      <div style={{
                        marginTop: 8,
                        padding: '7px 10px',
                        background: 'var(--blue-light)',
                        borderRadius: 4,
                        fontSize: reviewFontScale.supportingText,
                        color: 'var(--gray-600)',
                        lineHeight: 1.7,
                        borderLeft: '3px solid var(--dui-primary)',
                      }}>
                        <span style={{ fontWeight: 500, color: 'var(--blue)' }}>二次核验：</span>
                        {analysis.verification_summary}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Quality Verdict Panel */}
      {visibleAnalyses.length > 0 && (() => {
        const p10k = (v: number) =>
          parsedArticle.total_words > 0 ? v / parsedArticle.total_words * 10000 : v

        const keyPer = (dim: number) => p10k(dimStats[dim].keyDeduction)
        const totPer = (dim: number) => p10k(dimStats[dim].totalDeduction)

        const fmtN = (v: number) => v > 0 ? `${v.toFixed(1)}分` : '—'
        const numVal = (v: number | null) => v !== null
          ? <span style={{ fontFamily: 'monospace', color: v > 0 ? 'var(--orange)' : 'var(--gray-400)' }}>{fmtN(v)}</span>
          : <span style={{ color: 'var(--gray-200)' }}>—</span>

        const d1Excel = keyPer(1) < 5 || totPer(1) < 10
        const d1Pass  = keyPer(1) < 10 || totPer(1) < 20
        const d3Excel = keyPer(3) < 5 || totPer(3) < 10
        const d3Pass  = keyPer(3) < 10 || totPer(3) < 20

        // Per-dimension data.
        // D1 内容全面 & D3 内容准确: twoRow (key + total)
        // D2 结构合理 & D4 精炼流畅: single row (total only)
        const dimGroups = [
          {
            dim: 1, twoRow: true,
            criterion1: ['重点扣分 < 5分/万字（优秀）', '重点扣分 < 10分/万字（合格）'],
            criterion2: ['累积扣分 < 10分/万字（优秀）', '累积扣分 < 20分/万字（合格）'],
            keyPerVal: keyPer(1), totPerVal: totPer(1),
            excellentPass: d1Excel, passingPass: d1Pass,
          },
          {
            dim: 2, twoRow: false,
            criterion1: ['累积扣分 < 10分/万字（优秀）', '累积扣分 < 20分/万字（合格）'],
            criterion2: undefined,
            keyPerVal: null, totPerVal: totPer(2),
            excellentPass: totPer(2) < 10, passingPass: totPer(2) < 20,
          },
          {
            dim: 3, twoRow: true,
            criterion1: ['重点扣分 < 5分/万字（优秀）', '重点扣分 < 10分/万字（合格）'],
            criterion2: ['累积扣分 < 10分/万字（优秀）', '累积扣分 < 20分/万字（合格）'],
            keyPerVal: keyPer(3), totPerVal: totPer(3),
            excellentPass: d3Excel, passingPass: d3Pass,
          },
          {
            dim: 4, twoRow: false,
            criterion1: ['累积扣分 < 10分/万字（优秀）', '累积扣分 < 20分/万字（合格）'],
            criterion2: undefined,
            keyPerVal: null, totPerVal: totPer(4),
            excellentPass: totPer(4) < 10, passingPass: totPer(4) < 20,
          },
        ]

        const TH = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
          <th style={{
            padding: '8px 8px', fontSize: 12, fontWeight: 500, color: 'var(--gray-600)',
            background: 'var(--gray-50)', borderBottom: '0.5px solid var(--dui-divider)',
            whiteSpace: 'nowrap', textAlign: center ? 'center' : 'left',
          }}>{children}</th>
        )

        const GB = '2px solid var(--gray-200)'  // group bottom border
        const SB = '1px solid var(--gray-100)'  // sub-row separator

        return (
          <div className="section-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--m3-on-surface)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: -4, marginRight: 6 }}>analytics</span>
                审评结论（基于已分析章节）
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  总字数：{parsedArticle.total_words.toLocaleString()} 字
                  （{(parsedArticle.total_words / 10000).toFixed(4)} 万字）
                </span>
                {overallRating && (
                  <span style={{
                    fontSize: 13, fontWeight: 500, padding: '3px 12px', borderRadius: 4,
                    background: RATING_CONFIG[overallRating].bg,
                    color: RATING_CONFIG[overallRating].color,
                  }}>
                    综合评级：{RATING_CONFIG[overallRating].label}
                  </span>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <colgroup>
                  <col style={{ width: 100 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 52 }} />
                  <col style={{ width: 52 }} />
                </colgroup>
                <thead>
                  <tr>
                    <TH>审核维度</TH>
                    <TH>判定标准</TH>
                    <TH center>重点扣分/万字</TH>
                    <TH center>累积扣分/万字</TH>
                    <TH center>优秀</TH>
                    <TH center>合格</TH>
                  </tr>
                </thead>
                <tbody>
                  {dimGroups.map(g => {
                    const rs = g.twoRow ? 2 : 1
                    // Verdict: excellent→优秀✓合格empty; pass-only→优秀empty合格✓; fail→优秀empty合格✗
                    const excellentMark = g.excellentPass
                      ? <span style={{ color: 'var(--green)', fontWeight: 500, fontSize: 16 }}>✓</span>
                      : null
                    const passingMark = g.excellentPass ? null
                      : g.passingPass
                        ? <span style={{ color: 'var(--green)', fontWeight: 500, fontSize: 16 }}>✓</span>
                        : <span style={{ color: 'var(--red)', fontWeight: 500, fontSize: 16 }}>✗</span>

                    const dimTdStyle: React.CSSProperties = {
                      padding: '8px 8px', verticalAlign: 'middle', fontSize: 12,
                      fontWeight: 500, textAlign: 'center',
                      background: 'var(--gray-50)',
                      borderRight: '0.5px solid var(--dui-divider)',
                      borderBottom: GB,
                    }
                    const numTdStyle: React.CSSProperties = {
                      padding: '8px 8px', verticalAlign: 'middle',
                      textAlign: 'center', borderBottom: GB,
                    }
                    const verdictTdStyle: React.CSSProperties = {
                      padding: '8px 8px', verticalAlign: 'middle',
                      textAlign: 'center', borderBottom: GB,
                    }

                    return (
                      <React.Fragment key={g.dim}>
                        <tr>
                          <td rowSpan={rs} style={dimTdStyle}>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 2 }}>维度{g.dim}</div>
                            {DIM_CONFIG[g.dim].label}
                          </td>
                          <td style={{
                            padding: '8px 8px', verticalAlign: 'middle',
                            borderBottom: g.twoRow ? SB : GB,
                          }}>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.8 }}>
                              {g.criterion1.map((l, j) => <div key={j}>{l}</div>)}
                            </div>
                          </td>
                          <td rowSpan={rs} style={numTdStyle}>{numVal(g.keyPerVal)}</td>
                          <td rowSpan={rs} style={numTdStyle}>{numVal(g.totPerVal)}</td>
                          <td rowSpan={rs} style={verdictTdStyle}>{excellentMark}</td>
                          <td rowSpan={rs} style={verdictTdStyle}>{passingMark}</td>
                        </tr>
                        {g.twoRow && g.criterion2 && (
                          <tr>
                            <td style={{
                              padding: '8px 8px', verticalAlign: 'middle',
                              background: 'var(--gray-50)', borderBottom: GB,
                            }}>
                              <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.8 }}>
                                {g.criterion2.map((l, j) => <div key={j}>{l}</div>)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
