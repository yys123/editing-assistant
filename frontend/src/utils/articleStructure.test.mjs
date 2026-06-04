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

console.log('articleStructure tests passed')
