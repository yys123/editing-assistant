import assert from 'node:assert/strict'
import {
  buildNeedsAnalysisSection,
  getNeedsAnalysisTargetSections,
} from './needsAnalysisSections.ts'

const parsedArticle = {
  sections: [
    { id: 'treat', heading: '治疗', content: '', word_count: 2, level: 1 },
    { id: 'modes', heading: '三、 常见血液净化治疗模式', content: '模式总览。', word_count: 5, level: 2 },
    { id: 'hp', heading: '(二) 血液灌流（HP）', content: '', word_count: 4, level: 3 },
    { id: 'hp-principle', heading: '1、 原理', content: '血液灌流通过吸附剂清除毒物。', word_count: 14, level: 3 },
    { id: 'hp-indication', heading: '2、 适应证', content: '适用于脂溶性高、易与白蛋白结合的药物急性中毒。', word_count: 24, level: 3 },
    { id: 'choice', heading: '四、 血液净化治疗模式的选择', content: '', word_count: 5, level: 2 },
    { id: 'pk', heading: '1、 药代动力学原则', content: '应根据Vd、蛋白结合率和分子量选择模式。', word_count: 18, level: 3 },
  ],
  total_words: 72,
}

const section = buildNeedsAnalysisSection(parsedArticle, parsedArticle.sections[1])

assert.equal(section.id, 'modes')
assert.equal(section.heading, '三、 常见血液净化治疗模式')
assert.match(section.content, /^模式总览。/)
assert.match(section.content, /## \(二\) 血液灌流（HP）/)
assert.match(section.content, /## 1、 原理\n血液灌流通过吸附剂清除毒物。/)
assert.match(section.content, /## 2、 适应证\n适用于脂溶性高、易与白蛋白结合的药物急性中毒。/)
assert.doesNotMatch(section.content, /药代动力学原则/)
assert.ok(section.word_count > parsedArticle.sections[1].word_count)

const sameLevelSubsections = buildNeedsAnalysisSection(parsedArticle, parsedArticle.sections[2])

assert.equal(sameLevelSubsections.id, 'hp')
assert.match(sameLevelSubsections.content, /^## 1、 原理/)
assert.match(sameLevelSubsections.content, /血液灌流通过吸附剂清除毒物。/)
assert.match(sameLevelSubsections.content, /## 2、 适应证/)
assert.match(sameLevelSubsections.content, /适用于脂溶性高、易与白蛋白结合的药物急性中毒。/)
assert.doesNotMatch(sameLevelSubsections.content, /药代动力学原则/)

const targetSections = getNeedsAnalysisTargetSections(parsedArticle)

assert.deepEqual(
  targetSections.map(section => section.id),
  ['modes', 'choice'],
)
assert.match(targetSections[0].content, /血液灌流通过吸附剂清除毒物。/)
assert.match(targetSections[1].content, /应根据Vd、蛋白结合率和分子量选择模式。/)
assert.doesNotMatch(targetSections[0].content, /药代动力学原则/)

const parserLevelMismatchArticle = {
  sections: [
    { id: 'diagnosis', heading: '诊断', content: '', word_count: 2, level: 1 },
    { id: 'risk', heading: '一、 急性中毒风险及病情评估', content: '风险总述。', word_count: 8, level: 3 },
    { id: 'risk-assessment', heading: '（一）风险评估', content: '评估总述。', word_count: 8, level: 3 },
    { id: 'what', heading: '(1) What：中毒的药物', content: '识别中毒药物。', word_count: 8, level: 3 },
    { id: 'who', heading: '(2) Who：患者因素', content: '评估患者基础情况。', word_count: 9, level: 3 },
    { id: 'toxin', heading: '2、 根据特异性表现识别中毒药物', content: '根据特异性表现判断毒物。', word_count: 12, level: 3 },
    { id: 'treatment', heading: '二、 血液净化治疗', content: '治疗总述。', word_count: 8, level: 3 },
    { id: 'hp', heading: '（一）血液灌流', content: '血液灌流内容。', word_count: 8, level: 3 },
  ],
  total_words: 63,
}

const mismatchTargets = getNeedsAnalysisTargetSections(parserLevelMismatchArticle)

assert.deepEqual(
  mismatchTargets.map(section => section.id),
  ['risk', 'treatment'],
)
assert.match(mismatchTargets[0].content, /识别中毒药物。/)
assert.match(mismatchTargets[0].content, /根据特异性表现判断毒物。/)
assert.doesNotMatch(mismatchTargets[0].content, /血液灌流内容。/)
assert.match(mismatchTargets[1].content, /血液灌流内容。/)

console.log('needsAnalysisSections tests passed')
