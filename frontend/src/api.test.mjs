import assert from 'node:assert/strict'
import {
  clinicalDecisionChunksToReferenceDoc,
  clinicalDecisionChunkToReferenceDoc,
  clinicMasterMaterialToReferenceDoc,
  createClinicMasterQuery,
  fetchEntryDetail,
  fetchGuideDetail,
  getClinicMasterQuery,
  guideDetailToReferenceDoc,
  referenceDocContainsClinicalDecisionChunk,
  refreshClinicMasterQuery,
  safeJson,
  searchClinicalDecisionChunks,
  searchEntries,
  searchGuides,
  searchReferenceChunks,
} from './api.ts'

globalThis.localStorage = {
  getItem() {
    return null
  },
  setItem() {},
  removeItem() {},
}
globalThis.window = { location: { reload() {} } }

const backendUnavailable = new Response(
  'Backend 8102 is unavailable: connect ECONNREFUSED 127.0.0.1:8102',
  { status: 502, statusText: 'Bad Gateway' },
)

await assert.rejects(
  () => safeJson(backendUnavailable),
  /后端服务暂不可用.*8102/,
)

const validJson = new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

assert.deepEqual(await safeJson(validJson), { ok: true })

const fetchCalls = []
const consoleErrors = []
const originalConsoleError = console.error
console.error = (...args) => {
  consoleErrors.push(args)
}
globalThis.fetch = async (url, options = {}) => {
  fetchCalls.push({ url, options })
  if (url.startsWith('/api/article/guides/search')) {
    return new Response(JSON.stringify({
      items: [{ id: 12, title: '2型糖尿病基层诊疗指南' }],
    }), { status: 200 })
  }
  if (url === '/api/article/guides/12') {
    return new Response(JSON.stringify({
      id: 12,
      title: '指南标题',
      content: '<p>这里是指南详情内容</p>',
    }), { status: 200 })
  }
  if (url === '/api/article/guides/85527') {
    return new Response(JSON.stringify({
      detail: {
        message: '指南详情内容为空',
        dataKeys: ['content'],
        stringFields: [{
          path: 'data.content',
          length: 972998,
          preview: '<div data-core-wrapper="content"><div class="core-relations my-3"></div><div id=',
        }],
      },
    }), { status: 502 })
  }
  if (url.startsWith('/api/article/entries/search')) {
    return new Response(JSON.stringify({
      items: [{ id: 21, name: '2型糖尿病' }],
    }), { status: 200 })
  }
  if (url === '/api/article/entries/21') {
    return new Response(JSON.stringify({
      id: 21,
      name: '2型糖尿病',
      content: '<p>这里是词条详情内容</p>',
    }), { status: 200 })
  }
  if (url.startsWith('/api/article/clinical-decision-chunks')) {
    if (url.includes('error-case')) {
      return new Response(JSON.stringify({}), { status: 500 })
    }
    return new Response(JSON.stringify({
      items: [{
        id: '31',
        main_id: 'guide-2026',
        main_title: '指南主标题',
        title: '临床问题标题',
        chunk_id: 'chunk-001',
        content_text: '推荐正文',
        usable: true,
      }],
      num_found: 1,
      num_returned: 1,
    }), { status: 200 })
  }
  if (url === '/api/generate/reference-chunks/search') {
    return new Response(JSON.stringify({
      chunks: [{
        chunk_id: 'R1-C001',
        source_id: 1,
        source_filename: '糖尿病指南.md',
        title_path: '诊断 / 标准',
        text: 'HbA1c 可用于糖尿病诊断。',
        context_before: '',
        context_after: '',
        paragraph_index: 1,
        source_ref_ids: ['8'],
        score: 12,
        reason: '命中：诊断、HbA1c',
      }],
    }), { status: 200 })
  }
  if (url === '/api/clinic-master/queries' && options.method === 'POST') {
    const body = JSON.parse(options.body)
    if (body.question === '错误') {
      return new Response(JSON.stringify({
        detail: {
          message: 'Clinic Master 创建对话请求失败',
          request: { url: 'https://ai.dxy.net/openapi/p/chat/stream' },
          response: { success: false, message: '签名错误' },
        },
      }), { status: 502 })
    }
    return new Response(JSON.stringify({
      query_id: '9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a',
      status: 'pending',
      question: '糖尿病',
      created_at: '2026-07-09T10:00:00',
      ready_at: '2026-07-09T10:02:00',
      materials: [],
      warnings: [],
    }), { status: 200 })
  }
  if (url === '/api/clinic-master/queries/9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a' && (!options.method || options.method === 'GET')) {
    return new Response(JSON.stringify({
      query_id: '9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a',
      status: 'pending',
      question: '糖尿病',
      created_at: '2026-07-09T10:00:00',
      ready_at: '2026-07-09T10:02:00',
      materials: [],
      warnings: [],
    }), { status: 200 })
  }
  if (url === '/api/clinic-master/queries/9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a/refresh' && options.method === 'POST') {
    return new Response(JSON.stringify({
      query_id: '9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a',
      status: 'ready',
      question: '糖尿病',
      created_at: '2026-07-09T10:00:00',
      ready_at: '2026-07-09T10:02:00',
      materials: [{
        id: 'material-1',
        type: 'answer',
        title: '糖尿病/诊断:回答',
        text: 'ClinMaster 回答内容',
        sourceLabel: 'ClinMaster 回答',
        selectedByDefault: true,
      }],
      warnings: [],
    }), { status: 200 })
  }
  throw new Error(`unexpected fetch: ${url}`)
}

assert.deepEqual(await searchGuides('糖尿病'), {
  items: [{ id: 12, title: '2型糖尿病基层诊疗指南' }],
})
assert.equal(fetchCalls[0].url, '/api/article/guides/search?keyword=%E7%B3%96%E5%B0%BF%E7%97%85')

assert.deepEqual(await fetchGuideDetail(12), {
  id: 12,
  title: '指南标题',
  content: '<p>这里是指南详情内容</p>',
})
assert.equal(fetchCalls[1].url, '/api/article/guides/12')

assert.deepEqual(await searchEntries('糖尿病'), {
  items: [{ id: 21, name: '2型糖尿病' }],
})
assert.equal(fetchCalls[2].url, '/api/article/entries/search?keyword=%E7%B3%96%E5%B0%BF%E7%97%85')

assert.deepEqual(await fetchEntryDetail(21), {
  id: 21,
  name: '2型糖尿病',
  content: '<p>这里是词条详情内容</p>',
})
assert.equal(fetchCalls[3].url, '/api/article/entries/21')

assert.deepEqual(
  await searchReferenceChunks({
    task_type: 'ai_integration',
    disease: '糖尿病',
    query: '诊断 HbA1c',
    reference_inputs: [{ id: 1, filename: '糖尿病指南.md', text: 'HbA1c 可用于糖尿病诊断。' }],
    priority_reference_ids: [1],
    limit: 5,
  }),
  {
    chunks: [{
      chunk_id: 'R1-C001',
      source_id: 1,
      source_filename: '糖尿病指南.md',
      title_path: '诊断 / 标准',
      text: 'HbA1c 可用于糖尿病诊断。',
      context_before: '',
      context_after: '',
      paragraph_index: 1,
      source_ref_ids: ['8'],
      score: 12,
      reason: '命中：诊断、HbA1c',
    }],
  },
)
assert.equal(fetchCalls[4].url, '/api/generate/reference-chunks/search')
assert.equal(fetchCalls[4].options.method, 'POST')
assert.equal(fetchCalls[4].options.headers.get('Content-Type'), 'application/json')
assert.equal(JSON.parse(fetchCalls[4].options.body).query, '诊断 HbA1c')

await searchReferenceChunks({
  task_type: 'reference_review',
  disease: '糖尿病',
  query: '',
  reference_inputs: [{ id: 1, filename: '糖尿病指南.md', text: 'HbA1c 可用于糖尿病诊断。' }],
  return_all: true,
})
assert.equal(fetchCalls[5].url, '/api/generate/reference-chunks/search')
assert.equal(JSON.parse(fetchCalls[5].options.body).return_all, true)

assert.deepEqual(
  await createClinicMasterQuery('糖尿病'),
  {
    query_id: '9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a',
    status: 'pending',
    question: '糖尿病',
    created_at: '2026-07-09T10:00:00',
    ready_at: '2026-07-09T10:02:00',
    materials: [],
    warnings: [],
  },
)
assert.equal(fetchCalls[6].url, '/api/clinic-master/queries')
assert.equal(fetchCalls[6].options.method, 'POST')
assert.equal(fetchCalls[6].options.headers.get('Content-Type'), 'application/json')
assert.equal(JSON.parse(fetchCalls[6].options.body).question, '糖尿病')

await assert.rejects(
  () => createClinicMasterQuery('错误'),
  /Clinic Master 创建对话请求失败/,
)
assert.equal(consoleErrors.at(-1)[0], '[ClinicMaster API error]')
assert.equal(consoleErrors.at(-1)[1].url, '/api/clinic-master/queries')
assert.equal(consoleErrors.at(-1)[1].status, 502)
assert.equal(consoleErrors.at(-1)[1].data.detail.response.message, '签名错误')

assert.equal(
  (await getClinicMasterQuery('9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a')).status,
  'pending',
)
assert.equal(fetchCalls[8].url, '/api/clinic-master/queries/9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a')

assert.equal(
  (await refreshClinicMasterQuery('9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a')).materials[0].title,
  '糖尿病/诊断:回答',
)
assert.equal(fetchCalls[9].url, '/api/clinic-master/queries/9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a/refresh')
assert.equal(fetchCalls[9].options.method, 'POST')

assert.deepEqual(
  clinicMasterMaterialToReferenceDoc({
    id: 'material-1',
    type: 'answer',
    title: '糖尿病/诊断:回答',
    text: 'ClinMaster 回答内容',
    sourceLabel: 'ClinMaster 回答',
    selectedByDefault: true,
  }),
  {
    filename: 'ClinMaster-糖尿病_诊断_回答.md',
    text: 'ClinMaster 回答内容',
    char_count: 15,
  },
)

assert.deepEqual(
  clinicMasterMaterialToReferenceDoc({
    id: 'answer-structured',
    type: 'answer',
    title: '儿童隐匿性阴茎的分型',
    text: '[H1] ClinMaster 回答：儿童隐匿性阴茎的分型\n\n'
      + '问题：儿童隐匿性阴茎的分型\n\n'
      + '回答：\n'
      + '**目前儿童隐匿性阴茎尚无统一的分型标准。** 为便于临床评估，主要包括以下几种：\n\n'
      + '**1. 基于阴茎显露程度的三型分法（专家共识推荐）**\n'
      + '该共识推荐根据阴茎外观严重程度分为三型：\n'
      + '*   **轻型（部分阴茎体型）**：外观可见部分阴茎体。\n'
      + '*   **中型（阴茎头型）**：隐约可见阴茎头。\n\n'
      + '**总结**：上述分型方法各有侧重。',
    sourceLabel: 'ClinMaster 回答',
    selectedByDefault: true,
  }).text,
  '[H1] ClinMaster 回答：儿童隐匿性阴茎的分型\n\n'
    + '问题：儿童隐匿性阴茎的分型\n\n'
    + '回答：\n'
    + '目前儿童隐匿性阴茎尚无统一的分型标准。 为便于临床评估，主要包括以下几种：\n\n'
    + '[H2] 1. 基于阴茎显露程度的三型分法（专家共识推荐）\n'
    + '该共识推荐根据阴茎外观严重程度分为三型：\n'
    + '*   轻型（部分阴茎体型）：外观可见部分阴茎体。\n'
    + '*   中型（阴茎头型）：隐约可见阴茎头。\n\n'
    + '[H2] 总结\n'
    + '上述分型方法各有侧重。',
)

assert.deepEqual(
  clinicMasterMaterialToReferenceDoc({
    id: 'detail-structured',
    type: 'reference_detail',
    title: '文献 · 儿童隐匿性阴茎手术疗效评估的研究进展 · 一、隐匿性阴茎的诊断、分型 · 2025,46(01):86-90',
    text: '[H1] ClinMaster 文献详情：文献 · 儿童隐匿性阴茎手术疗效评估的研究进展 · 一、隐匿性阴茎的诊断、分型 · 2025,46(01):86-90\n\n'
      + '隐匿性阴茎是儿童常见的外生殖器疾病 ^[ ] ^。需要及时手术干预 ^[ , , , ] ^。\n'
      + '## 一、隐匿性阴茎的诊断、分型\n'
      + '### （一）诊断\n'
      + '诊断标准包括外观短小。',
    sourceLabel: 'ClinMaster 文献详情',
    selectedByDefault: true,
  }).text,
  '[H1] ClinMaster 文献详情：文献 · 儿童隐匿性阴茎手术疗效评估的研究进展 · 一、隐匿性阴茎的诊断、分型 · 2025,46(01):86-90\n\n'
    + '隐匿性阴茎是儿童常见的外生殖器疾病。需要及时手术干预。\n'
    + '[H2] 一、隐匿性阴茎的诊断、分型\n'
    + '[H3] （一）诊断\n'
    + '诊断标准包括外观短小。',
)

assert.deepEqual(
  guideDetailToReferenceDoc({
    id: 12,
    title: '指南标题',
    content: '<p>这里是指南详情内容</p>',
  }),
  {
    filename: '12-指南标题',
    text: '<p>这里是指南详情内容</p>',
    char_count: 16,
  },
)

console.error = originalConsoleError

assert.equal(
  guideDetailToReferenceDoc({
    id: 3921,
    title: '指南/名称:2026',
    content: 'content',
  }).filename,
  '3921-指南_名称_2026',
)

await assert.rejects(
  () => fetchGuideDetail(85527),
  {
    message: '指南详情内容为空，请到指南数据库pdf解析全文后再检索~',
  },
)
assert.equal(fetchCalls.at(-1).url, '/api/article/guides/85527')

const clinicalChunkFetchStart = fetchCalls.length

assert.deepEqual(await searchClinicalDecisionChunks({
  guideId: ' guide-2026 ',
  doi: ' 10.1234/abc def ',
}), {
  items: [{
    id: '31',
    main_id: 'guide-2026',
    main_title: '指南主标题',
    title: '临床问题标题',
    chunk_id: 'chunk-001',
    content_text: '推荐正文',
    usable: true,
  }],
  num_found: 1,
  num_returned: 1,
})
assert.equal(
  fetchCalls[clinicalChunkFetchStart].url,
  '/api/article/clinical-decision-chunks?guide_id=guide-2026&doi=10.1234%2Fabc+def',
)

await searchClinicalDecisionChunks({ guideId: ' guide-only ' })
assert.equal(fetchCalls[clinicalChunkFetchStart + 1].url, '/api/article/clinical-decision-chunks?guide_id=guide-only')

await searchClinicalDecisionChunks({ doi: ' 10.1234/doi-only ' })
assert.equal(fetchCalls[clinicalChunkFetchStart + 2].url, '/api/article/clinical-decision-chunks?doi=10.1234%2Fdoi-only')

await assert.rejects(
  () => searchClinicalDecisionChunks({ guideId: '   ', doi: '\t' }),
  /请填写指南 ID 或 DOI/,
)
assert.equal(fetchCalls.length, clinicalChunkFetchStart + 3)

await assert.rejects(
  () => searchClinicalDecisionChunks({ guideId: 'error-case' }),
  /临床决策切片查询失败/,
)

const mappedChunk = clinicalDecisionChunkToReferenceDoc({
  id: '32',
  main_id: ' guide/id:2026 ',
  main_title: '指南主标题',
  title: '临床/问题:标题?',
  chunk_id: ' chunk/001 ',
  content_text: '\n  推荐正文  \n',
  usable: true,
})
assert.deepEqual(mappedChunk, {
  filename: '临床决策切片-guide_id_2026-临床_问题_标题_-chunk_001',
  text: '[H1] 指南主标题\n[H2] 临床/问题:标题?\n[临床决策切片ID] chunk/001\n\n推荐正文',
  char_count: '[H1] 指南主标题\n[H2] 临床/问题:标题?\n[临床决策切片ID] chunk/001\n\n推荐正文'.length,
})

const mappedChunkBatch = clinicalDecisionChunksToReferenceDoc([
  {
    id: '32',
    main_id: ' guide/id:2026 ',
    main_title: '指南主标题',
    title: '临床/问题:标题?',
    chunk_id: ' chunk/001 ',
    content_text: '\n  推荐正文  \n',
    usable: true,
  },
  {
    id: '33',
    main_id: 'guide/id:2026',
    main_title: '指南主标题',
    title: '第二个问题',
    chunk_id: 'chunk/002',
    content_text: '第二段正文',
    usable: true,
  },
])
assert.deepEqual(mappedChunkBatch, {
  filename: '临床决策切片-guide_id_2026-指南主标题',
  text: '[H1] 指南主标题\n\n[H2] 临床/问题:标题?\n[临床决策切片ID] chunk/001\n\n推荐正文\n\n[H2] 第二个问题\n[临床决策切片ID] chunk/002\n\n第二段正文',
  char_count: '[H1] 指南主标题\n\n[H2] 临床/问题:标题?\n[临床决策切片ID] chunk/001\n\n推荐正文\n\n[H2] 第二个问题\n[临床决策切片ID] chunk/002\n\n第二段正文'.length,
})

assert.throws(
  () => clinicalDecisionChunksToReferenceDoc([
    {
      id: '34',
      main_id: 'guide',
      main_title: '指南主标题',
      title: '空正文',
      chunk_id: 'chunk-empty',
      content_text: ' ',
      usable: true,
    },
  ]),
  /没有可加入的临床决策切片/,
)

assert.equal(
  clinicalDecisionChunkToReferenceDoc({
    id: 33,
    main_id: 'guide',
    main_title: '指南主标题',
    title: '长标题',
    chunk_id: `chunk-${'x'.repeat(100)}`,
    content_text: '正文',
    usable: true,
  }).filename,
  `临床决策切片-guide-长标题-${`chunk-${'x'.repeat(100)}`.slice(0, 80)}`,
)

const blankFallbackChunk = clinicalDecisionChunkToReferenceDoc({
  id: '35',
  main_id: '   ',
  main_title: '   ',
  title: '   ',
  chunk_id: ' chunk-035 ',
  content_text: '  正文  ',
  usable: true,
})
assert.deepEqual(blankFallbackChunk, {
  filename: '临床决策切片-unknown-未命名切片-chunk-035',
  text: '[H1] 未命名临床决策资料\n[H2] 未命名切片\n[临床决策切片ID] chunk-035\n\n正文',
  char_count: '[H1] 未命名临床决策资料\n[H2] 未命名切片\n[临床决策切片ID] chunk-035\n\n正文'.length,
})

for (const invalidChunk of [
  { usable: false, chunk_id: 'chunk-002', content_text: '正文' },
  { usable: true, chunk_id: '   ', content_text: '正文' },
  { usable: true, chunk_id: 'chunk-002', content_text: '   ' },
]) {
  assert.throws(
    () => clinicalDecisionChunkToReferenceDoc({
      id: 34,
      main_id: 'guide',
      main_title: '指南主标题',
      title: '标题',
      ...invalidChunk,
    }),
    /该临床决策切片暂无可用正文/,
  )
}

assert.equal(
  referenceDocContainsClinicalDecisionChunk({
    filename: 'ref.md',
    text: '前文\r\n[临床决策切片ID] chunk-001\r\n后文',
    char_count: 0,
  }, ' chunk-001 '),
  true,
)
assert.equal(
  referenceDocContainsClinicalDecisionChunk({
    filename: 'ref.md',
    text: '[临床决策切片ID] chunk-001-extra\n[临床决策切片ID] achunk-001',
    char_count: 0,
  }, 'chunk-001'),
  false,
)

console.log('api tests passed')
