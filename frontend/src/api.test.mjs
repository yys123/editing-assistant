import assert from 'node:assert/strict'
import {
  fetchEntryDetail,
  fetchGuideDetail,
  guideDetailToReferenceDoc,
  safeJson,
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

console.log('api tests passed')
