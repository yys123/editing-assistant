import assert from 'node:assert/strict'
import { articleContentToStructuredMarkers } from './articleStructure.ts'

const epoInlineHeading = [
  '[H1] 基础知识',
  '[H2] 四、 发病机制',
  '肾性贫血的发病机制复杂，涉及 EPO 生成及活性异常、铁稳态失衡及微环境因素等，详见图 17。',
  '图 17 肾性贫血的发病机制注：红色箭头表示抑制作用，蓝色箭头表示刺激作用。 EPO，促红细胞生成素；HIF-PHI，缺氧诱导因子-脯氨酰羟化酶抑制剂。 1、 EPO 生成不足及活性降低',
  '(1) EPO 减少：慢性肾脏病患者由于肾脏损伤，导致肾脏产生 EPO 减少。',
].join('\n')

const structured = articleContentToStructuredMarkers(epoInlineHeading)

assert.match(
  structured,
  /抑制剂。\n\[H3\] 1、 EPO 生成不足及活性降低/,
)
assert.match(structured, /^\[H3\] \(1\) EPO 减少：/m)

const captionFollowedByHeading = [
  '[H1] 诊断',
  '[H3] 2、铁受限性红细胞生成',
  '在 CKD 患者中，由于较高的炎症状态，表现为低转铁蛋白饱和度以及伴有正常细胞血红蛋白的贫血[892]。',
  '图 16 不同铁状态下的机制[892]',
  '3、 营养不良',
  'CKD 患者由于饮食控制、食欲减退引起营养不良。',
].join('\n')

const captionStructured = articleContentToStructuredMarkers(captionFollowedByHeading)

assert.match(captionStructured, /图 16 不同铁状态下的机制\[892\]\n\[H3\] 3、 营养不良/)

const inlineCaptionRemarkHeading = [
  '[H1] 治疗',
  'xiii. EMA 建议患者年龄在 65 岁以上且没有可供选择的治疗药物时，该药物可作为保留方案。 2、 手术治疗策略',
  '严重的 CD 并发症、内科治疗无效、CD 相关癌变的患者需要外科手术。',
].join('\n')

const inlineCaptionRemarkStructured = articleContentToStructuredMarkers(inlineCaptionRemarkHeading)

assert.match(
  inlineCaptionRemarkStructured,
  /保留方案。\n\[H3\] 2、 手术治疗策略/,
)

const separatedFigureNoteHeading = [
  '[H1] 治疗',
  '[图注] xiii. EMA 建议患者年龄在 65 岁以上且没有可供选择的治疗药物时，该药物可作为保留方案。',
  '2、 手术治疗策略',
  '严重的 CD 并发症、内科治疗无效、CD 相关癌变的患者需要外科手术。',
].join('\n')

const separatedFigureNoteStructured = articleContentToStructuredMarkers(separatedFigureNoteHeading)

assert.match(
  separatedFigureNoteStructured,
  /\[图注\] xiii[\s\S]*保留方案。\n\[H3\] 2、 手术治疗策略/,
)

console.log('articleStructure tests passed')
