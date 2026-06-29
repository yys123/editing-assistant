import assert from 'node:assert/strict'
import {
  buildAiIntegrationIssueRequest,
  collectAiIntegrationLinkedIssues,
  collectNeedsAnalysisLinkedIssues,
  getLinkedIssuePanelLayout,
  sectionIdsForLinkedIssues,
} from './aiIntegrationIssues.ts'

const sectionAnalyses = [
  {
    section_id: 's1',
    section_heading: '流行病学',
    issues: [
      {
        id: 'i1',
        issue_type: 'missing_content',
        description: '缺少国内急性中毒急诊占比数据。',
        severity: 'high',
        examples: ['原文仅描述疾病负担，未给出急诊占比。'],
        anchors: [{ quote: '急性中毒是常见急症' }],
        guideline_evidence: [{ source: '指南A', quote: '急性中毒患者约占同期急诊患者的2.7%~3.6%。', relevance: '补充流行病学数据' }],
        reviewer_note: '需要优先补充国内数据',
        status: 'confirmed',
      },
      {
        id: 'i2',
        issue_type: 'style',
        description: '语言略啰嗦。',
        severity: 'low',
        examples: [],
        reviewer_note: '',
        status: 'rejected',
      },
    ],
  },
  {
    section_id: 's2',
    section_heading: '治疗',
    issues: [
      {
        id: 'i3',
        issue_type: 'outdated',
        description: '治疗推荐可能过时。',
        severity: 'medium',
        examples: ['仍使用旧版药物推荐。'],
        reviewer_note: '',
        status: 'added',
      },
      {
        id: 'i4',
        issue_type: 'accuracy',
        description: 'AI 待确认问题。',
        severity: 'high',
        examples: [],
        reviewer_note: '',
        status: 'ai',
      },
    ],
  },
]

const linkedIssues = collectAiIntegrationLinkedIssues(sectionAnalyses)

assert.deepEqual(
  linkedIssues.map(issue => issue.id),
  ['i1', 'i3'],
)

assert.equal(linkedIssues[0].section_heading, '流行病学')
assert.equal(linkedIssues[0].reviewer_note, '需要优先补充国内数据')
assert.equal(linkedIssues[0].guideline_evidence?.[0].source, '指南A')

assert.deepEqual(
  collectAiIntegrationLinkedIssues(sectionAnalyses, { includeUnconfirmed: true }).map(issue => issue.id),
  ['i1', 'i3', 'i4'],
)

assert.deepEqual(
  collectAiIntegrationLinkedIssues([...sectionAnalyses].reverse(), { sectionOrder: ['s1', 's2'] }).map(issue => issue.id),
  ['i1', 'i3'],
)

assert.deepEqual(
  sectionIdsForLinkedIssues([linkedIssues[0], linkedIssues[1]]),
  ['s1', 's2'],
)

const request = buildAiIntegrationIssueRequest([linkedIssues[0], linkedIssues[1]])

assert.match(request, /请根据以下内容质量评审问题/)
assert.match(request, /尽量不更改原词条中与本问题无关的内容/)
assert.match(request, /如果属于缺失内容，仅补充与该问题直接相关的内容/)
assert.match(request, /尽量不改变原词条既有框架和内容顺序/)
assert.match(request, /除非本次评审问题本身就是要求调整结构、框架或顺序/)
assert.match(request, /【章节】流行病学/)
assert.match(request, /【类型】缺失内容/)
assert.match(request, /【优先级】高/)
assert.match(request, /【人工备注】需要优先补充国内数据/)
assert.match(request, /【指南依据】指南A：急性中毒患者约占同期急诊患者的2.7%~3.6%。/)
assert.match(request, /【章节】治疗/)
assert.match(request, /最后简要列出“已解决的问题”和“仍需人工确认的问题”/)

const gapAnalysis = {
  clusters: [],
  total_qa_count: 68,
  section_mappings: [],
  section_gaps: [
    {
      section_id: 's3',
      section_heading: '血液净化',
      coverage_assessment: '部分覆盖',
      gap_items: [],
      need_coverages: [
        {
          topic: '急性中毒的血液净化模式选择',
          coverage_level: 'missing',
          qa_frequency: 42,
          representative_questions: ['急性中毒患者什么时候需要血液净化？'],
          revision_suggestion: '补充血液灌流、血液透析和 CRRT 的适用情境。',
          status: 'confirmed',
          reviewer_note: '这条要直接进入整合',
        },
        {
          topic: '中毒后随访',
          coverage_level: 'partial',
          qa_frequency: 8,
          representative_questions: ['出院后多久随访？'],
          revision_suggestion: '补充随访时间。',
          status: 'rejected',
        },
        {
          topic: '洗胃适应证',
          coverage_level: 'full',
          qa_frequency: 18,
          representative_questions: ['哪些患者需要洗胃？'],
          revision_suggestion: '',
          status: 'confirmed',
        },
      ],
    },
  ],
  unmet_needs: [],
  optimization_suggestions: [],
}

const needsIssues = collectNeedsAnalysisLinkedIssues(gapAnalysis)

assert.deepEqual(
  needsIssues.map(issue => issue.id),
  ['need:s3:急性中毒的血液净化模式选择'],
)
assert.equal(needsIssues[0].source, 'user_needs')
assert.equal(needsIssues[0].issue_type, 'user_need_missing')
assert.equal(needsIssues[0].severity, 'high')
assert.equal(needsIssues[0].reviewer_note, '这条要直接进入整合')

const needsRequest = buildAiIntegrationIssueRequest(needsIssues, { sourceLabel: '用户需求分析问题' })

assert.match(needsRequest, /请根据以下用户需求分析问题/)
assert.match(needsRequest, /结合真实用户问答需求/)
assert.match(needsRequest, /【类型】用户需求缺失/)
assert.match(needsRequest, /【需求频次】42 次提问/)
assert.match(needsRequest, /急性中毒患者什么时候需要血液净化/)
assert.match(needsRequest, /补充血液灌流、血液透析和 CRRT 的适用情境/)

assert.deepEqual(getLinkedIssuePanelLayout(2), {
  outer: { overflowY: 'visible' },
  inner: { maxHeight: 'none', overflowY: 'visible' },
})

assert.deepEqual(getLinkedIssuePanelLayout(6), {
  outer: { overflowY: 'visible' },
  inner: { maxHeight: 360, overflowY: 'auto' },
})

console.log('ai integration issue tests passed')
