import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const outdir = join(process.cwd(), '.tmp-tests', `clinic-master-panel-test-${process.pid}`)
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, 'ClinicMasterPanel.mjs')

await esbuild.build({
  entryPoints: ['src/components/ClinicMasterPanel.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  external: ['react'],
  logLevel: 'silent',
})

try {
  const {
    buildClinicMasterReferenceAddition,
    buildClinicMasterCitationDisplay,
    getClinicMasterReferenceChunkId,
    formatClinicMasterReferenceAddition,
    formatClinicMasterDebug,
    formatClinicMasterMetadata,
    formatReadyCountdown,
    getClinicMasterAutoRefreshDelay,
    buildClinicMasterRecommendedGuides,
    formatClinicMasterGuideMeta,
    shouldShowClinicMasterGuideData,
    formatClinicMasterResultSummary,
    formatClinicMasterHistorySummary,
    shouldShowClinicMasterResultPanel,
    getClinicMasterInitialQuestion,
    clinicMasterHistoryToggleLabel,
    shouldShowClinicMasterHistoryList,
    buildClinicMasterAnswerDisplay,
    buildClinicMasterGuideNameParts,
    buildClinicMasterReferenceDetailDisplay,
    shouldShowClinicMasterGuidesWhenCollapsed,
    clinicMasterCollapseAllLabel,
    shouldUseClinicMasterMaterialAsChunk,
    shouldUseClinicMasterMaterialAsReference,
    clinicMasterMaterialToConfirmedChunk,
    shouldShowClinicMasterMaterialCard,
    shouldShowClinicMasterMaterialInline,
    shouldShowClinicMasterMetadata,
    shouldShowClinicMasterResults,
  } = await import(pathToFileURL(outfile).href)

  assert.equal(
    formatReadyCountdown('2026-07-09T15:16:00', new Date('2026-07-09T15:14:04').getTime()),
    '约 1 分 56 秒后自动获取结果',
  )
  assert.equal(
    formatReadyCountdown('2026-07-09T15:14:04', new Date('2026-07-09T15:14:04').getTime()),
    '正在获取结果',
  )
  assert.equal(formatReadyCountdown('', new Date('2026-07-09T15:14:04').getTime()), '约 2 分钟后自动获取结果')
  assert.equal(
    getClinicMasterAutoRefreshDelay('2026-07-09T15:16:00', new Date('2026-07-09T15:14:04').getTime()),
    116000,
  )
  assert.equal(
    getClinicMasterAutoRefreshDelay('2026-07-09T15:14:04', new Date('2026-07-09T15:14:04').getTime()),
    0,
  )
  assert.equal(getClinicMasterAutoRefreshDelay('', new Date('2026-07-09T15:14:04').getTime()), 120000)
  assert.equal(shouldShowClinicMasterMaterialInline('answer'), true)
  assert.equal(shouldShowClinicMasterMaterialInline('reference'), false)
  assert.equal(shouldShowClinicMasterMaterialInline('reference_detail'), false)
  assert.equal(shouldShowClinicMasterMaterialCard('answer'), true)
  assert.equal(shouldShowClinicMasterMaterialCard('reference'), true)
  assert.equal(shouldShowClinicMasterMaterialCard('chat_detail'), true)
  assert.equal(shouldShowClinicMasterMaterialCard('reference_detail'), false)
  assert.equal(shouldUseClinicMasterMaterialAsChunk('answer'), true)
  assert.equal(shouldUseClinicMasterMaterialAsChunk('reference'), true)
  assert.equal(shouldUseClinicMasterMaterialAsChunk('reference_detail'), true)
  assert.equal(shouldUseClinicMasterMaterialAsChunk('chat_detail'), false)
  assert.equal(shouldUseClinicMasterMaterialAsReference('answer'), true)
  assert.equal(shouldUseClinicMasterMaterialAsReference('reference_detail'), true)
  assert.equal(shouldUseClinicMasterMaterialAsReference('reference'), false)
  assert.equal(shouldUseClinicMasterMaterialAsReference('chat_detail'), false)
  const referenceAdditionMaterials = [
    {
      id: 'answer-add',
      type: 'answer',
      title: '临床回答',
      text: '回答正文',
      sourceLabel: 'ClinMaster 回答',
      selectedByDefault: true,
    },
    {
      id: 'detail-add',
      type: 'reference_detail',
      title: '文献详情',
      text: '详情正文',
      sourceLabel: 'ClinMaster 文献详情',
      selectedByDefault: true,
    },
    {
      id: 'reference-add',
      type: 'reference',
      title: '参考列表',
      text: '列表正文',
      sourceLabel: 'ClinMaster 参考列表',
      selectedByDefault: true,
    },
    {
      id: 'chat-add',
      type: 'chat_detail',
      title: '对话',
      text: '对话正文',
      sourceLabel: 'ClinMaster 对话',
      selectedByDefault: true,
    },
    {
      id: 'blank-add',
      type: 'answer',
      title: '空回答',
      text: '   ',
      sourceLabel: 'ClinMaster 回答',
      selectedByDefault: true,
    },
    {
      id: 'unselected-detail',
      type: 'reference_detail',
      title: '未勾选详情',
      text: '不应加入',
      sourceLabel: 'ClinMaster 文献详情',
      selectedByDefault: false,
    },
  ]
  const referenceAddition = buildClinicMasterReferenceAddition(
    referenceAdditionMaterials,
    new Set(['answer-add', 'detail-add', 'reference-add', 'blank-add']),
  )
  assert.deepEqual(
    referenceAddition.docs.map(doc => doc.filename),
    ['ClinMaster-临床回答.md', 'ClinMaster-文献详情.md'],
  )
  assert.deepEqual(referenceAddition.docs.map(doc => doc.text), ['回答正文', '详情正文'])
  assert.equal(referenceAddition.added, 2)
  assert.equal(referenceAddition.unusable, 1)
  assert.equal(formatClinicMasterReferenceAddition({ added: 1, duplicates: 1, unusable: 1 }), '已加入 1 条；跳过重复 1 条；无可用正文 1 条')
  assert.equal(formatClinicMasterReferenceAddition({ added: 0, duplicates: 2, unusable: 0 }), '已加入 0 条；跳过重复 2 条')
  assert.equal(shouldShowClinicMasterMetadata('answer'), false)
  assert.equal(shouldShowClinicMasterMetadata('reference'), true)
  assert.equal(shouldShowClinicMasterMetadata('chat_detail'), true)
  assert.equal(shouldShowClinicMasterMetadata('reference_detail'), false)
  assert.equal(shouldShowClinicMasterResults(0, 0), false)
  assert.equal(shouldShowClinicMasterResults(1, 0), true)
  assert.equal(shouldShowClinicMasterResults(0, 1), true)
  assert.equal(shouldShowClinicMasterGuideData(), false)
  assert.equal(formatClinicMasterResultSummary(1, 0), '回答 1')
  assert.equal(formatClinicMasterResultSummary(1, 8), '回答 1 · 推荐指南 8')
  assert.equal(formatClinicMasterResultSummary(0, 8), '推荐指南 8')
  assert.equal(formatClinicMasterHistorySummary('2026-07-10T15:12:46'), '提问时间：2026-07-10 15:12')
  assert.equal(shouldShowClinicMasterResultPanel(false, 1, 8), true)
  assert.equal(shouldShowClinicMasterResultPanel(true, 1, 8), false)
  assert.equal(getClinicMasterInitialQuestion('隐匿性阴茎（儿童）'), '')
  assert.equal(shouldShowClinicMasterHistoryList(2, false), true)
  assert.equal(shouldShowClinicMasterHistoryList(2, true), false)
  assert.equal(shouldShowClinicMasterHistoryList(0, false), false)
  assert.equal(clinicMasterHistoryToggleLabel(false), '折叠历史')
  assert.equal(clinicMasterHistoryToggleLabel(true), '展开历史')
  const answerDisplay = buildClinicMasterAnswerDisplay(
    '[H1] ClinMaster 回答：隐匿性阴茎（儿童）的国内外指南\n\n'
      + '问题：隐匿性阴茎（儿童）的国内外指南\n\n'
      + '回答：\n'
      + '### 指南概览\n\n'
      + '以下为 **核心指南** 与共识 [ref:1](chunk-a)。',
  )
  assert.deepEqual(answerDisplay, {
    question: '隐匿性阴茎（儿童）的国内外指南',
    text: '指南概览\n\n以下为 核心指南 与共识 [ref:1](chunk-a)。',
  })
  assert.doesNotMatch(answerDisplay.text, /\[H1\]|###|\*\*/)
  assert.deepEqual(
    buildClinicMasterGuideNameParts('以下列出：\n《隐匿性阴茎诊断与治疗专家共识》（2026年）'),
    [
      { type: 'text', text: '以下列出：\n' },
      { type: 'guide_name', text: '《隐匿性阴茎诊断与治疗专家共识》' },
      { type: 'text', text: '（2026年）' },
    ],
  )
  const detailDisplay = buildClinicMasterReferenceDetailDisplay(
    '[H1] ClinMaster 文献详情：指南\n\n'
      + '### 诊断\n\n'
      + '**隐匿性阴茎** 可按体征判断。',
  )
  assert.equal(detailDisplay, '诊断\n\n隐匿性阴茎 可按体征判断。')
  assert.doesNotMatch(detailDisplay, /\[H1\]|###|\*\*/)
  assert.equal(shouldShowClinicMasterGuidesWhenCollapsed(false, 8), false)
  assert.equal(shouldShowClinicMasterGuidesWhenCollapsed(true, 8), true)
  assert.equal(shouldShowClinicMasterGuidesWhenCollapsed(true, 0), false)
  assert.equal(clinicMasterCollapseAllLabel(false), '收回')
  assert.equal(clinicMasterCollapseAllLabel(true), '展开内容')
  assert.equal(
    getClinicMasterReferenceChunkId({
      id: 'detail-1',
      type: 'reference_detail',
      title: '文献详情 1',
      text: '详情正文',
      sourceLabel: 'ClinMaster 文献详情',
      selectedByDefault: true,
      metadata: {
        detail_request: {
          chunkIds: '2-84915-7076294f67c2cc8d',
        },
      },
    }),
    '2-84915-7076294f67c2cc8d',
  )
  assert.deepEqual(
    clinicMasterMaterialToConfirmedChunk({
      id: 'answer-1',
      type: 'answer',
      title: '隐匿性阴茎回答',
      text: '临床决策回答正文',
      sourceLabel: 'ClinMaster 回答',
      selectedByDefault: true,
    }, 8, 1),
    {
      chunk_id: 'clinic-master-answer-answer-1',
      source_id: 8,
      source_filename: 'ClinMaster-回答-隐匿性阴茎回答.md',
      title_path: '临床决策 / 回答 / 隐匿性阴茎回答',
      text: '临床决策回答正文',
      source_ref_ids: [],
      selected_by: 'user',
    },
  )

  const citationDisplay = buildClinicMasterCitationDisplay(
    '第一条依据 [ref:1](chunk-a)，第二条仍来自 ref1 [ref:1](chunk-b)。',
    [
      {
        id: 'detail-a',
        type: 'reference_detail',
        title: '指南详情 A',
        text: 'A 正文',
        sourceLabel: 'ClinMaster 文献详情',
        selectedByDefault: true,
        metadata: { detail_request: { chunkIds: 'chunk-a' } },
      },
      {
        id: 'detail-b',
        type: 'reference_detail',
        title: '指南详情 B',
        text: 'B 正文',
        sourceLabel: 'ClinMaster 文献详情',
        selectedByDefault: true,
        metadata: { detail_request: { chunkIds: 'chunk-b' } },
      },
    ],
  )
  assert.deepEqual(
    citationDisplay.citations.map(citation => ({
      label: citation.label,
      refNumber: citation.refNumber,
      chunkId: citation.chunkId,
      detailTitle: citation.detail?.title,
    })),
    [
      { label: '1-1', refNumber: '1', chunkId: 'chunk-a', detailTitle: '指南详情 A' },
      { label: '1-2', refNumber: '1', chunkId: 'chunk-b', detailTitle: '指南详情 B' },
    ],
  )
  assert.deepEqual(
    citationDisplay.parts.map(part => part.type === 'citation' ? `[${part.citation.label}]` : part.text),
    ['第一条依据 ', '[1-1]', '，第二条仍来自 ref1 ', '[1-2]', '。'],
  )

  const adjacentCitationDisplay = buildClinicMasterCitationDisplay(
    '连续引用 [ref:1](chunk-a)[ref:1](chunk-b)。',
    [],
  )
  assert.deepEqual(
    adjacentCitationDisplay.parts.map(part => part.type === 'citation' ? `[${part.citation.label}]` : part.text),
    ['连续引用 ', '[1-1]', '、', '[1-2]', '。'],
  )

  const recommendedGuides = buildClinicMasterRecommendedGuides([
    {
      id: 'answer-1',
      type: 'answer',
      title: '回答',
      text: '回答正文',
      sourceLabel: 'ClinMaster 回答',
      selectedByDefault: true,
      metadata: { question: '问题' },
    },
    {
      id: 'reference-1',
      type: 'reference',
      title: 'CSCO 指南',
      text: '指南一摘要',
      sourceLabel: 'ClinMaster 参考列表',
      selectedByDefault: true,
      metadata: { reference: { chunkIds: 'chunk-a' } },
    },
    {
      id: 'detail-1',
      type: 'reference_detail',
      title: '文献详情',
      text: '详情正文',
      sourceLabel: 'ClinMaster 文献详情',
      selectedByDefault: true,
      metadata: { detail_request: { chunkIds: 'chunk-a' } },
    },
    {
      id: 'reference-2',
      type: 'reference',
      title: 'NCCN 指南',
      text: '指南二摘要',
      sourceLabel: 'ClinMaster 参考列表',
      selectedByDefault: false,
      metadata: { reference: { id: 'chunk-b' } },
    },
  ])
  assert.deepEqual(recommendedGuides, [
    {
      id: 'reference-1',
      number: 1,
      title: 'CSCO 指南',
      text: '指南一摘要',
      sourceLabel: 'ClinMaster 参考列表',
      chunkId: 'chunk-a',
    },
    {
      id: 'reference-2',
      number: 2,
      title: 'NCCN 指南',
      text: '指南二摘要',
      sourceLabel: 'ClinMaster 参考列表',
      chunkId: 'chunk-b',
    },
  ])

  const guidesFromReferenceDetails = buildClinicMasterRecommendedGuides([
    {
      id: 'answer-only',
      type: 'answer',
      title: '回答',
      text: '回答正文',
      sourceLabel: 'ClinMaster 回答',
      selectedByDefault: true,
      metadata: { question: '问题' },
    },
    {
      id: 'detail-only-1',
      type: 'reference_detail',
      title: '指南详情 1',
      text: '详情正文不应作为推荐列表正文',
      sourceLabel: 'ClinMaster 文献详情',
      selectedByDefault: true,
      metadata: {
        reference: {
          referenceId: 'ref-1',
          title: '一、包皮的发生、解剖与病理生理',
          mainTitle: '隐匿性阴茎诊断与治疗专家共识',
          makerName: '中国性学会私密整形与产业分会',
          sourceName: '指南',
          mainId: 84915,
          publishTime: '2026.04.29',
          linkUrl: 'https://newdrugs.dxy.cn/pc/guide/test',
        },
        detail_request: { chunkIds: 'ref-1' },
      },
    },
    {
      id: 'detail-only-duplicate',
      type: 'reference_detail',
      title: '指南详情重复切片',
      text: '重复切片正文',
      sourceLabel: 'ClinMaster 文献详情',
      selectedByDefault: true,
      metadata: {
        reference: {
          id: 'ref-duplicate',
          mainId: 84915,
          mainTitle: '隐匿性阴茎诊断与治疗专家共识',
          makerName: '中国性学会私密整形与产业分会',
          sourceName: '指南',
          publishTime: '2026.04.29',
          linkUrl: 'https://newdrugs.dxy.cn/pc/guide/test',
        },
        detail_request: { chunkIds: 'ref-duplicate' },
      },
    },
    {
      id: 'detail-only-2',
      type: 'reference_detail',
      title: '指南详情 2',
      text: '详情正文二',
      sourceLabel: 'ClinMaster 文献详情',
      selectedByDefault: true,
      metadata: {
        reference: {
          id: 'ref-2',
          mainTitle: '不应展示的诊疗方案',
          makerName: '诊疗方案机构',
          sourceName: '诊疗方案',
          publishTime: '2026',
        },
      },
    },
  ])
  assert.deepEqual(
    guidesFromReferenceDetails.map(guide => ({
      id: guide.id,
      number: guide.number,
      title: guide.title,
      makerName: guide.makerName,
      linkUrl: guide.linkUrl,
      sourceName: guide.sourceName,
      publishTime: guide.publishTime,
      sourceLabel: guide.sourceLabel,
      chunkId: guide.chunkId,
    })),
    [
      {
        id: 'detail-only-1',
        number: 1,
        title: '隐匿性阴茎诊断与治疗专家共识',
        makerName: '中国性学会私密整形与产业分会',
        linkUrl: 'https://newdrugs.dxy.cn/pc/guide/test',
        sourceName: '指南',
        publishTime: '2026.04.29',
        sourceLabel: 'ClinMaster 参考资料',
        chunkId: 'ref-1',
      },
    ],
  )
  assert.deepEqual(formatClinicMasterGuideMeta(guidesFromReferenceDetails[0]), ['类型：指南', '发表日期：2026.04.29'])
  assert.match(guidesFromReferenceDetails[0].text, /referenceId：ref-1/)
  assert.match(guidesFromReferenceDetails[0].text, /mainTitle：隐匿性阴茎诊断与治疗专家共识/)
  assert.doesNotMatch(guidesFromReferenceDetails[0].text, /详情正文不应作为推荐列表正文/)

  const debugText = formatClinicMasterDebug({
    errors: [{
      stage: 'reference_detail',
      detail: {
        request: {
          url: 'https://ai.dxy.net/japi/platform/100000017',
          params: { chunkIds: 'chunk-1', sign: '61a9d675...9e876ec7' },
        },
        response: { success: false, message: '请求已失效' },
      },
    }],
  })
  assert.match(debugText, /100000017/)
  assert.match(debugText, /chunk-1/)
  assert.match(debugText, /请求已失效/)
  assert.doesNotMatch(debugText, /appSignKey/)

  const metadataText = formatClinicMasterMetadata({
    detail_request: {
      endpoint: '/japi/platform/100000017',
      chatId: 'chat-1',
      chunkIds: '2-84915-7076294f67c2cc8d',
    },
    detail_text_candidates: [
      { path: 'results.items[0].content', length: 1024, preview: '接口返回正文片段' },
    ],
  })
  assert.match(metadataText, /100000017/)
  assert.match(metadataText, /2-84915-7076294f67c2cc8d/)
  assert.match(metadataText, /results\.items\[0\]\.content/)

  const source = await readFile('src/components/ClinicMasterPanel.tsx', 'utf8')
  assert.match(source, /clinic-master-add-references/)
  assert.match(source, /addButtonLabel/)
  assert.match(source, /onAddReferenceDocs\(addition\.docs\)/)

  console.log('ClinicMasterPanel tests passed')
} finally {
  await rm(join(process.cwd(), '.tmp-tests'), { recursive: true, force: true })
}
