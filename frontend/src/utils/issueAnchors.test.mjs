import assert from 'node:assert/strict'
import { getIssueLocatorAnchors, getLocatableIssueAnchors } from './issueAnchors.ts'

const anchors = getLocatableIssueAnchors([
  { quote: 'MRI缩写错误，标准应为MRI', line_start: 2, line_end: 2 },
  { quote: '没有位置的片段' },
  { quote: 'HHT 和 CM-AVM 在第二、六章节重复给出全称', heading_hint: 'HHT 和 CM-AVM', line_start: 8 },
])

assert.equal(anchors.length, 2)
assert.equal(anchors[0].index, 0)
assert.equal(anchors[0].label, '定位 1：MRI缩写错误，标准应为MRI')
assert.equal(anchors[1].index, 2)
assert.equal(anchors[1].label, '定位 3：HHT 和 CM-AVM')

const inferred = getIssueLocatorAnchors({
  id: 'issue-1',
  issue_type: 'style',
  description: '专业名词缩写及补全全称格式不规范。',
  severity: 'low',
  examples: ['1. 核磁共振缩写写为MR（标准应为MRI）；2. HHT和CM-AVM在第二、第六章节重复给出全称；3. CM-AVM1型格式不统一。'],
  anchors: [
    { quote: '核磁共振检查（magnetic resonance，MR）', line_start: 3, line_end: 3 },
    { quote: 'CM-AVM1 型', line_start: 9, line_end: 9 },
  ],
  reviewer_note: '',
  status: 'ai',
}, [
  '分类及病因',
  '遗传性出血性毛细血管扩张症（hereditary hemorrhagic telangiectasia，HHT）和毛细血管畸形-动静脉畸形（CM-AVM）属于家族遗传性AVM。',
  '疾病分类',
  '核磁共振检查（magnetic resonance，MR）结果提示异常。',
  '其他内容',
  'CM-AVM1 型可见相关基因亚型。',
].join('\n'))

assert.equal(inferred.length, 3)
assert.equal(inferred[0].line_start, 3)
assert.equal(inferred[0].label.startsWith('定位 1：核磁共振缩写写为MR'), true)
assert.equal(inferred[1].line_start, 1)
assert.equal(inferred[1].label.startsWith('定位 2：HHT和CM-AVM'), true)
assert.equal(inferred[2].line_start, 5)
assert.equal(inferred[2].label.startsWith('定位 3：CM-AVM1型'), true)

const deduped = getIssueLocatorAnchors({
  id: 'issue-2',
  issue_type: 'style',
  description: '存在非同类错别字（“粗粉”应为“铝粉”）及常用缩写（如PVA）首次出现未补全中英文全称的问题。',
  severity: 'low',
  examples: ['粗粉（X 线显影）', 'PVA 颗粒'],
  anchors: [
    { quote: '由乙烯醇共聚物（ethylene-vinyl alcohol copolymer）制成', line_start: 0, line_end: 0 },
    { quote: '目前常用的栓塞材料包括 PVA 颗粒', line_start: 1, line_end: 1 },
    { quote: '粗粉（X 线显影）', line_start: 0, line_end: 0 },
  ],
  reviewer_note: '',
  status: 'ai',
}, [
  '粗粉（X 线显影）',
  'PVA 颗粒',
].join('\n'))

assert.equal(deduped.length, 2)
assert.equal(deduped[0].line_start, 0)
assert.equal(deduped[0].quote, '粗粉（X 线显影）')
assert.equal(deduped[1].line_start, 1)

console.log('issueAnchors tests passed')
