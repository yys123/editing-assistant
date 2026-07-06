import assert from 'node:assert/strict'
import {
  extractLeadingEntryTitleFromText,
  isEntryTitleText,
  resolveEntryLibraryDiseaseName,
} from './entryLibraryTitle.ts'

assert.equal(isEntryTitleText('急性肾盂肾炎', '急性肾盂肾炎'), true)
assert.equal(isEntryTitleText('急性肾盂肾炎：', '急性肾盂肾炎'), true)

const extracted = extractLeadingEntryTitleFromText([
  '',
  '急性肾盂肾炎',
  '',
  '基础知识',
  '一、概述',
].join('\n'))

assert.deepEqual(extracted, {
  title: '急性肾盂肾炎',
  text: '基础知识\n一、概述',
})

assert.deepEqual(extractLeadingEntryTitleFromText('一、概述\n正文'), {
  title: '',
  text: '一、概述\n正文',
})
assert.deepEqual(extractLeadingEntryTitleFromText('基础知识\n一、概述'), {
  title: '',
  text: '基础知识\n一、概述',
})

assert.equal(
  resolveEntryLibraryDiseaseName('急性肾盂肾炎发炎', '急性肾盂肾炎'),
  '急性肾盂肾炎',
)
assert.equal(resolveEntryLibraryDiseaseName('急性肾盂肾炎', ''), '急性肾盂肾炎')

console.log('entryLibraryTitle tests passed')
