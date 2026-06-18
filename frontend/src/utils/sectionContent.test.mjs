import assert from 'node:assert/strict'
import {
  backfillDraftOriginalContent,
  countChineseWords,
  extractSectionContent,
  normalizeSectionHeading,
} from './sectionContent.ts'

const parsedArticle = {
  sections: [
    { id: 'diagnosis', heading: '诊断', content: '', word_count: 0, level: 1 },
    { id: 'clinical', heading: '一、 临床表现', content: '核心表现概述。', word_count: 8, level: 2 },
    { id: 'history', heading: '(一) 病史', content: '病史采集内容。', word_count: 8, level: 3 },
    { id: 'scale', heading: '二、 量表评估', content: '量表内容。', word_count: 6, level: 2 },
  ],
  total_words: 22,
}

assert.equal(normalizeSectionHeading('一、 临床表现'), '临床表现')
assert.equal(normalizeSectionHeading('(一) 病史'), '病史')

assert.equal(
  countChineseWords('儿童ADHD 10%^[1-3]\n[图片] 图1\n| --- | --- |\n治疗和随访。'),
  13,
)
assert.equal(countChineseWords('高钾血症[¹³⁻¹⁴] CKD患者'), 7)

const extracted = extractSectionContent(parsedArticle, '诊断 > 临床表现')
assert.match(extracted, /^核心表现概述。/)
assert.match(extracted, /## \(一\) 病史\n病史采集内容。/)
assert.doesNotMatch(extracted, /量表内容/)

const draftHistory = [{
  id: 'draft-1',
  gap: {
    priority: 'P1',
    section: '诊断 > 临床表现',
    description: '补充临床表现',
    source: 'manual',
  },
  draft: {
    section: '诊断 > 临床表现',
    original_content: '',
    generated_content: '生成稿件。',
    key_changes: [],
    references_used: [],
  },
  editedContent: '生成稿件。',
  generatedAt: '2026-06-18T00:00:00.000Z',
}]

const restored = backfillDraftOriginalContent(draftHistory, parsedArticle)
assert.notEqual(restored, draftHistory)
assert.match(restored[0].draft.original_content, /核心表现概述。/)

console.log('sectionContent tests passed')
