import assert from 'node:assert/strict'
import {
  clinicalDecisionChunkToReferenceDoc,
  fetchEntryDetail,
  fetchGuideDetail,
  guideDetailToReferenceDoc,
  referenceDocContainsClinicalDecisionChunk,
  safeJson,
  searchClinicalDecisionChunks,
  searchEntries,
  searchGuides,
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

assert.equal(
  guideDetailToReferenceDoc({
    id: 3921,
    title: '指南/名称:2026',
    content: 'content',
  }).filename,
  '3921-指南_名称_2026',
)

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
  fetchCalls[4].url,
  '/api/article/clinical-decision-chunks?guide_id=guide-2026&doi=10.1234%2Fabc+def',
)

await searchClinicalDecisionChunks({ guideId: ' guide-only ' })
assert.equal(fetchCalls[5].url, '/api/article/clinical-decision-chunks?guide_id=guide-only')

await searchClinicalDecisionChunks({ doi: ' 10.1234/doi-only ' })
assert.equal(fetchCalls[6].url, '/api/article/clinical-decision-chunks?doi=10.1234%2Fdoi-only')

await assert.rejects(
  () => searchClinicalDecisionChunks({ guideId: '   ', doi: '\t' }),
  /请填写指南 ID 或 DOI/,
)
assert.equal(fetchCalls.length, 7)

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
  filename: '临床决策切片-guide_id_2026-临床_问题_标题_-chunk_001.md',
  text: '[H1] 指南主标题\n[H2] 临床/问题:标题?\n[临床决策切片ID] chunk/001\n\n推荐正文',
  char_count: '[H1] 指南主标题\n[H2] 临床/问题:标题?\n[临床决策切片ID] chunk/001\n\n推荐正文'.length,
})

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
  `临床决策切片-guide-长标题-${`chunk-${'x'.repeat(100)}`.slice(0, 80)}.md`,
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
  filename: '临床决策切片-unknown-未命名切片-chunk-035.md',
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
