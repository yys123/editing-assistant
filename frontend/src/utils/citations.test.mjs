import assert from 'node:assert/strict'
import {
  buildReferenceAnchorFromSourceDoc,
  buildReferenceAnchorsFromDocs,
  buildFallbackOriginalCitationAnchors,
  buildOriginalContentAnchors,
  buildOriginalContentAnchorsFromSources,
  createCitationResolver,
  formatCitationSourceLabel,
  linkifyCitationMarkers,
  mergeReferenceAnchors,
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

const unicodeSuperscriptAnchors = buildReferenceAnchorsFromDocs([
  {
    filename: '隐匿性阴茎指南.pdf',
    text: 'Hadidi et al.²⁷ suggested that abnormal attachment points can cause CCP. Patients may have infection²¹, ³⁴ and so forth. 白细胞计数为 10⁹/L，面积单位为 cm²。',
    char_count: 80,
  },
])
assert.deepEqual(
  unicodeSuperscriptAnchors.map(anchor => anchor.citation_key),
  ['1-27', '1-21', '1-34'],
)

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
  '推荐治疗方案[[1-3](#citation-1-3)、[1-5](#citation-1-5)、[2-6](#citation-2-6)]，未定位[9]。',
)

assert.equal(
  linkifyCitationMarkers('推荐治疗方案[1-3][2-6]。', (token) => (
    citationKeys.has(token) ? { key: token, label: token } : null
  )),
  '推荐治疗方案[[1-3](#citation-1-3)、[2-6](#citation-2-6)]。',
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

const unresolvedSourceRefLikeRangeResolver = createCitationResolver([
  {
    citation_key: '3',
    source_id: 3,
    source_filename: '重点指南C.pdf',
    source_ref_id: '',
    quote: '资料摘要',
    context_before: '',
    context_after: '',
    paragraph_index: -1,
  },
  ...Array.from({ length: 25 }, (_, index) => {
    const sourceRefId = String(index + 3)
    return {
      citation_key: `1-${sourceRefId}`,
      source_id: 1,
      source_filename: '重点指南A.pdf',
      source_ref_id: sourceRefId,
      quote: `源内参考文献 ${sourceRefId}`,
      context_before: '',
      context_after: '',
      paragraph_index: index,
    }
  }),
])
assert.equal(
  linkifyCitationMarkers('附着异常导致阴茎隐匿[3-27]。', unresolvedSourceRefLikeRangeResolver),
  '附着异常导致阴茎隐匿[3-27]。',
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

const multiRefChunkResolver = createCitationResolver([
  {
    citation_key: 'R4-C001',
    source_id: 4,
    source_filename: '高钾血症管理规范.pdf',
    source_ref_id: '3,32,33',
    chunk_id: 'R4-C001',
    title_path: '慢性肾脏病急性高钾血症的治疗',
    quote: '在等待准备透析时推荐口服环硅酸锆钠散等降钾措施。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
])
assert.equal(
  linkifyCitationMarkers('可联合口服环硅酸锆钠等降钾措施[R4-C001]。', multiRefChunkResolver),
  '可联合口服环硅酸锆钠等降钾措施[[4-3、4-32、4-33]](#citation-R4-C001)。',
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

const repeatedCitationAnchors = mergeReferenceAnchors([
  {
    citation_key: '1-47',
    source_id: 1,
    source_filename: '高钾血症指南.pdf',
    source_ref_id: '47',
    quote: '10%葡萄糖液500 mL加10 IU普通胰岛素静脉滴注，持续1小时以上，可在30~60分钟内起效[47]。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
  {
    citation_key: '1-47',
    source_id: 1,
    source_filename: '高钾血症指南.pdf',
    source_ref_id: '47',
    quote: '如果患者合并代谢性酸中毒，可静脉注射碳酸氢钠，通过H+-Na+交换促进钾离子进入细胞内[47]。',
    context_before: '',
    context_after: '',
    paragraph_index: 1,
  },
  {
    citation_key: '1-47',
    source_id: 1,
    source_filename: '高钾血症指南.pdf',
    source_ref_id: '47',
    quote: 'β-肾上腺素能受体兴奋剂可使钾离子转移至细胞内，通常30 min内起效[47]。',
    context_before: '',
    context_after: '',
    paragraph_index: 2,
  },
])
const repeatedCitationResolver = createCitationResolver(repeatedCitationAnchors)
assert.deepEqual(
  repeatedCitationAnchors.map(anchor => anchor.anchor_key),
  ['1-47~1', '1-47~2', '1-47~3'],
)
assert.equal(
  linkifyCitationMarkers('高糖+胰岛素可在30~60分钟内起效[1-47]。碳酸氢钠适用于合并代谢性酸中毒的患者[1-47]。', repeatedCitationResolver),
  '高糖+胰岛素可在30~60分钟内起效[[1-47]](#citation-1-47~1)。碳酸氢钠适用于合并代谢性酸中毒的患者[[1-47]](#citation-1-47~2)。',
)

const bareSourceRefResolver = createCitationResolver([
  {
    citation_key: '1-146',
    source_id: 1,
    source_filename: '流程图指南.pdf',
    source_ref_id: '146',
    quote: '图4 急性高钾血症处理流程图[146]。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
  {
    citation_key: '1-147',
    source_id: 1,
    source_filename: '流程图指南.pdf',
    source_ref_id: '147',
    quote: '图4 急性高钾血症处理流程图续[147]。',
    context_before: '',
    context_after: '',
    paragraph_index: 1,
  },
  {
    citation_key: '1-149',
    source_id: 1,
    source_filename: '流程图指南.pdf',
    source_ref_id: '149',
    quote: '急性高钾血症处理流程图补充说明[149]。',
    context_before: '',
    context_after: '',
    paragraph_index: 2,
  },
])
assert.equal(
  linkifyCitationMarkers('急性高钾血症处理流程图[146-147]、[149]。', bareSourceRefResolver),
  '急性高钾血症处理流程图[[146](#citation-1-146)、[147](#citation-1-147)、[149](#citation-1-149)]。',
)

assert.equal(
  formatCitationSourceLabel({
    citation_key: '0-18',
    source_id: 0,
    source_filename: '原词条内容',
    source_ref_id: '18',
    quote: '原词条句子[18]。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  }),
  '原词条内容',
)

const originalContentResolver = createCitationResolver([
  {
    citation_key: '0-146',
    source_id: 0,
    source_filename: '原词条内容',
    source_ref_id: '146',
    quote: '急性高钾血症的处理流程见图4[146]。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
  {
    citation_key: '0-147',
    source_id: 0,
    source_filename: '原词条内容',
    source_ref_id: '147',
    quote: '急性高钾血症的处理流程续图[147]。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
  {
    citation_key: '0-149',
    source_id: 0,
    source_filename: '原词条内容',
    source_ref_id: '149',
    quote: '处理流程补充说明[149]。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
])
assert.equal(
  linkifyCitationMarkers('流程见图4[0-146、0-147、0-149]。', originalContentResolver),
  '流程见图4[[0-146](#citation-0-146)、[0-147](#citation-0-147)、[0-149](#citation-0-149)]。',
)

assert.equal(
  linkifyCitationMarkers('需要用药监测[0-17]。', token => (
    /^\d+$/.test(token) && token !== '0' ? { key: `1-${token}`, label: token } : null
  )),
  '需要用药监测[0-17]。',
)

const hashOriginalAnchors = buildOriginalContentAnchors(
  '中心静脉滴注时需密切监测血钾<a href="#R17">17</a>。',
)
assert.deepEqual(
  hashOriginalAnchors.map(anchor => anchor.citation_key),
  ['0-17'],
)

const fallbackOriginalAnchors = buildFallbackOriginalCitationAnchors('需要用药监测[0-17]。', [])
assert.deepEqual(
  fallbackOriginalAnchors.map(anchor => anchor.citation_key),
  ['0-17'],
)
assert.equal(
  fallbackOriginalAnchors[0].source_filename,
  '原词条内容（未定位）',
)
assert.equal(
  linkifyCitationMarkers('需要用药监测[0-17]。', createCitationResolver(fallbackOriginalAnchors)),
  '需要用药监测[[0-17]](#citation-0-17)。',
)

const rebuiltOriginalAnchors = buildOriginalContentAnchors(
  '急性高钾血症的处理应遵循“三步走”策略，具体流程见图4[146–147,149]。',
)
assert.deepEqual(
  rebuiltOriginalAnchors.map(anchor => anchor.citation_key),
  ['0-146', '0-147', '0-149'],
)
assert.equal(
  linkifyCitationMarkers('流程见图4[146-147,149]。', createCitationResolver(rebuiltOriginalAnchors)),
  '流程见图4[[0-146](#citation-0-146)、[0-147](#citation-0-147)、[0-149](#citation-0-149)]。',
)

const originalSmallRangeAnchors = buildOriginalContentAnchors(
  'NMO复发率及致残率高[1-3]。2015年制定了新的NMOSD诊断标准[4]。',
)
assert.deepEqual(
  originalSmallRangeAnchors.map(anchor => anchor.citation_key),
  ['0-1', '0-2', '0-3', '0-4'],
)
assert.equal(
  linkifyCitationMarkers('NMO复发率及致残率高[1-3]，诊断标准见[4]。', createCitationResolver(originalSmallRangeAnchors)),
  'NMO复发率及致残率高[[0-1](#citation-0-1)、[0-2](#citation-0-2)、[0-3](#citation-0-3)]，诊断标准见[[0-4]](#citation-0-4)。',
)

const superscriptCitationResolver = createCitationResolver([
  {
    citation_key: '1-3',
    source_id: 1,
    source_filename: 'NMO指南.pdf',
    source_ref_id: '3',
    quote: 'NMO是一种免疫介导的炎性脱髓鞘疾病[3]。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
  {
    citation_key: '4',
    source_id: 4,
    source_filename: '诊断标准.pdf',
    source_ref_id: '',
    quote: '2015年制定了新的NMOSD诊断标准。',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
  },
])
assert.equal(
  linkifyCitationMarkers('NMO是一种免疫介导的炎性脱髓鞘疾病[¹⁻³]。诊断标准见[⁴]。', superscriptCitationResolver),
  'NMO是一种免疫介导的炎性脱髓鞘疾病[[1-3]](#citation-1-3)。诊断标准见[[4]](#citation-4)。',
)

const originalSuperscriptRangeAnchors = buildOriginalContentAnchors(
  'NMO复发率及致残率高[¹⁻³]。2015年制定了新的NMOSD诊断标准[⁴]。',
)
assert.deepEqual(
  originalSuperscriptRangeAnchors.map(anchor => anchor.citation_key),
  ['0-1', '0-2', '0-3', '0-4'],
)

const supplementedOriginalAnchors = buildOriginalContentAnchorsFromSources(
  '旧记录快照没有这条参考文献。',
  '鉴于上述原因，2015年国际NMO诊断小组制定了新的NMOSD诊断标准，取消了NMO的单独定义，将NMO整合入更广义的NMOSD疾病范畴中[5]。',
)
const supplementedFallbackAnchors = buildFallbackOriginalCitationAnchors(
  '鉴于上述原因，2015年国际NMO诊断小组制定了新的NMOSD诊断标准，取消了NMO的单独定义，将NMO整合入更广义的NMOSD疾病范畴中[0-5]。',
  supplementedOriginalAnchors,
)
assert.equal(
  supplementedOriginalAnchors.find(anchor => anchor.citation_key === '0-5')?.source_filename,
  '原词条内容',
)
assert.deepEqual(
  supplementedFallbackAnchors.map(anchor => anchor.citation_key),
  [],
)

console.log('citation tests passed')
