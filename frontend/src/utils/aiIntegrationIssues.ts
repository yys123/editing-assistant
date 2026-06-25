import type { AiIntegrationIssueType, AiIntegrationLinkedIssue, GapAnalysis, SectionAnalysis, SectionIssue } from '../types'

const ISSUE_TYPE_LABELS: Record<AiIntegrationIssueType, string> = {
  missing_content: '缺失内容',
  structure: '结构问题',
  accuracy: '准确性问题',
  outdated: '时效性问题',
  style: '语言格式',
  user_need_missing: '用户需求缺失',
  user_need_partial: '用户需求需完善',
}

const SEVERITY_LABELS: Record<SectionIssue['severity'], string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export function issueTypeLabel(issueType: AiIntegrationIssueType | string): string {
  return ISSUE_TYPE_LABELS[issueType as AiIntegrationIssueType] ?? issueType
}

export function issueSeverityLabel(severity: SectionIssue['severity'] | string): string {
  return SEVERITY_LABELS[severity as SectionIssue['severity']] ?? severity
}

export function collectAiIntegrationLinkedIssues(
  sectionAnalyses: SectionAnalysis[] = [],
  options: { includeUnconfirmed?: boolean } = {},
): AiIntegrationLinkedIssue[] {
  const allowedStatuses = options.includeUnconfirmed
    ? new Set<SectionIssue['status']>(['confirmed', 'added', 'ai'])
    : new Set<SectionIssue['status']>(['confirmed', 'added'])

  return sectionAnalyses.flatMap(analysis =>
    (analysis.issues ?? [])
      .filter(issue => allowedStatuses.has(issue.status))
      .map(issue => ({
        id: issue.id,
        source: 'quality_review' as const,
        section_id: analysis.section_id,
        section_heading: analysis.section_heading,
        issue_type: issue.issue_type,
        severity: issue.severity,
        description: issue.description,
        examples: issue.examples ?? [],
        reviewer_note: issue.reviewer_note,
        anchors: issue.anchors,
        guideline_evidence: issue.guideline_evidence,
        status: issue.status,
      })),
  )
}

export function collectNeedsAnalysisLinkedIssues(
  gapAnalysis: GapAnalysis | null | undefined,
): AiIntegrationLinkedIssue[] {
  if (!gapAnalysis) return []

  return (gapAnalysis.section_gaps ?? []).flatMap(sectionGap =>
    (sectionGap.need_coverages ?? [])
      .filter(coverage =>
        coverage.status === 'confirmed'
        && (coverage.coverage_level === 'missing' || coverage.coverage_level === 'partial')
      )
      .map(coverage => ({
        id: `need:${sectionGap.section_id}:${coverage.topic}`,
        source: 'user_needs' as const,
        section_id: sectionGap.section_id,
        section_heading: sectionGap.section_heading,
        issue_type: coverage.coverage_level === 'missing' ? 'user_need_missing' as const : 'user_need_partial' as const,
        severity: coverage.coverage_level === 'missing' ? 'high' as const : 'medium' as const,
        description: coverage.revision_suggestion?.trim()
          ? `${coverage.topic}：${coverage.revision_suggestion.trim()}`
          : coverage.topic,
        examples: coverage.representative_questions ?? [],
        reviewer_note: coverage.reviewer_note,
        status: 'confirmed' as const,
        qa_frequency: coverage.qa_frequency,
        revision_suggestion: coverage.revision_suggestion,
      })),
  )
}

export function sectionIdsForLinkedIssues(issues: AiIntegrationLinkedIssue[]): string[] {
  return [...new Set(issues.map(issue => issue.section_id).filter(Boolean))]
}

export function buildAiIntegrationIssueRequest(
  issues: AiIntegrationLinkedIssue[],
  options: { sourceLabel?: string } = {},
): string {
  const sourceLabel = options.sourceLabel ?? '内容质量评审问题'
  const isNeedsRequest = sourceLabel.includes('用户需求')
  const issueBlocks = issues.map((issue, index) => {
    const lines = [
      `${index + 1}. 【章节】${issue.section_heading}`,
      `   【类型】${issueTypeLabel(issue.issue_type)}`,
      `   【优先级】${issueSeverityLabel(issue.severity)}`,
      `   【问题】${issue.description}`,
    ]
    if (issue.qa_frequency != null) {
      lines.push(`   【需求频次】${issue.qa_frequency} 次提问`)
    }
    const examples = [
      ...(issue.examples ?? []),
      ...(issue.anchors ?? []).map(anchor => anchor.quote).filter(Boolean),
    ].filter(Boolean)
    if (examples.length > 0) {
      lines.push(`   【原文例句】${examples.join('；')}`)
    }
    if (issue.reviewer_note?.trim()) {
      lines.push(`   【人工备注】${issue.reviewer_note.trim()}`)
    }
    const evidence = (issue.guideline_evidence ?? [])
      .map(item => {
        const source = item.source ? `${item.source}：` : ''
        const relevance = item.relevance ? `（${item.relevance}）` : ''
        return `${source}${item.quote}${relevance}`
      })
      .filter(Boolean)
    if (evidence.length > 0) {
      lines.push(`   【指南依据】${evidence.join('；')}`)
    }
    return lines.join('\n')
  })

  return [
    `请根据以下${sourceLabel}，结合原词条内容和已选参考文献，生成可直接用于修订的整合内容。`,
    '',
    '要求：',
    '1. 尽量不更改原词条中与本问题无关的内容；如果属于缺失内容，仅补充与该问题直接相关的内容，最多调整少量上下文衔接措辞；',
    '2. 尽量不改变原词条既有框架和内容顺序，除非本次评审问题本身就是要求调整结构、框架或顺序；',
    isNeedsRequest
      ? '3. 优先解决高频、未覆盖或仅部分覆盖的真实用户问答需求；'
      : '3. 优先解决高优先级和准确性/过时类问题；',
    '4. 保留原词条中正确且仍适用的内容；',
    '5. 对新增或修订的事实性内容标注引用；',
    '6. 若证据不足，请明确说明哪些问题暂不能解决；',
    '7. 最后简要列出“已解决的问题”和“仍需人工确认的问题”。',
    ...(isNeedsRequest ? ['8. 结合真实用户问答需求组织补充内容，避免泛泛扩写。'] : []),
    '',
    '待解决问题：',
    issueBlocks.join('\n\n'),
  ].join('\n')
}
