import assert from 'node:assert/strict'
import {
  buildReferenceAnchorFromSourceDoc,
  buildReferenceAnchorsFromDocs,
  createCitationResolver,
  linkifyCitationMarkers,
} from './citations.ts'

const anchors = buildReferenceAnchorsFromDocs([
  {
    filename: '指南A.pdf',
    text: [
      '前文背景。',
      '治疗推荐来自随机研究[3]和长期随访[5, 8]。',
      '后文补充。',
    ].join('\n\n'),
    char_count: 40,
  },
  {
    filename: '指南B.pdf',
    text: '另一条证据支持同样结论[5-6]。',
    char_count: 20,
  },
])

const byKey = new Map(anchors.map(anchor => [anchor.citation_key, anchor]))
assert.deepEqual(
  [...byKey.keys()],
  ['1-3', '1-5', '1-8', '2-5', '2-6'],
)
assert.equal(byKey.get('1-3')?.source_id, 1)
assert.equal(byKey.get('1-3')?.source_ref_id, '3')
assert.equal(byKey.get('1-3')?.context_before, '前文背景。')
assert.equal(byKey.get('1-3')?.context_after, '后文补充。')
assert.match(byKey.get('1-3')?.quote ?? '', /治疗推荐/)

const sentenceAnchors = buildReferenceAnchorsFromDocs([
  {
    filename: '句子级指南.pdf',
    text: '前一句说明。AI真正参考这一句[12]。后一句说明。再后一条说明。',
    char_count: 40,
  },
])
assert.equal(sentenceAnchors[0].quote, 'AI真正参考这一句[12]。')
assert.equal(sentenceAnchors[0].context_before, '前一句说明。')
assert.equal(sentenceAnchors[0].context_after, '后一句说明。\n再后一条说明。')

const sourceAnchor = buildReferenceAnchorFromSourceDoc(
  {
    filename: '整合指南.pdf',
    text: '无关背景。乌司奴单抗诱导缓解建议在第16周后复查内镜。其他内容。',
    char_count: 60,
  },
  1,
  '使用乌司奴单抗诱导缓解者，首次内镜复查不早于第16周[1]。',
)
assert.equal(sourceAnchor.quote, '乌司奴单抗诱导缓解建议在第16周后复查内镜。')

const citationKeys = new Set([...byKey.keys()])
const linked = linkifyCitationMarkers('推荐治疗方案[1-3、1-5、2-6]，未定位[9]。', (token) => (
  citationKeys.has(token) ? { key: token, label: token } : null
))

assert.equal(
  linked,
  '推荐治疗方案[[1-3]](#citation-1-3)、[[1-5]](#citation-1-5)、[[2-6]](#citation-2-6)，未定位[9]。',
)

const enDashResolver = createCitationResolver([
  {
    citation_key: '1',
    source_id: 1,
    source_filename: '指南A.pdf',
    source_ref_id: '',
    quote: '资料摘要',
    context_before: '',
    context_after: '',
    paragraph_index: -1,
  },
  {
    citation_key: '1-22',
    source_id: 1,
    source_filename: '指南A.pdf',
    source_ref_id: '22',
    quote: '证据段落',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
])
assert.equal(
  linkifyCitationMarkers('参考数据源编号[1]。', enDashResolver),
  '参考数据源编号[[1]](#citation-1)。',
)
assert.equal(
  linkifyCitationMarkers('常见原因包括[1–22]。', enDashResolver),
  '常见原因包括[[1-22]](#citation-1-22)。',
)

const chunkResolver = createCitationResolver([
  {
    citation_key: 'R1-C001',
    source_id: 1,
    source_filename: '指南A.pdf',
    source_ref_id: '3',
    chunk_id: 'R1-C001',
    title_path: '诱导缓解治疗',
    quote: '诱导缓解治疗推荐使用药物A。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
])
assert.equal(
  linkifyCitationMarkers('诱导缓解治疗可使用药物A[R1-C001]。', chunkResolver),
  '诱导缓解治疗可使用药物A[[1-3]](#citation-R1-C001)。',
)

const sourceOnlyChunkResolver = createCitationResolver([
  {
    citation_key: 'R3-C055',
    source_id: 3,
    source_filename: '指南C.pdf',
    source_ref_id: '',
    chunk_id: 'R3-C055',
    title_path: '高钾血症的病因',
    quote: '高钾血症的根本原因是钾摄入与排泄失衡。',
    context_before: '',
    context_after: '',
    paragraph_index: 54,
  },
])
assert.equal(
  linkifyCitationMarkers('根本原因是失衡[R3-C055]。', sourceOnlyChunkResolver),
  '根本原因是失衡[[3]](#citation-R3-C055)。',
)

console.log('citation tests passed')
