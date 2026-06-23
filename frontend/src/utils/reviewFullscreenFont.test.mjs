import assert from 'node:assert/strict'
import {
  DEFAULT_REVIEW_FULLSCREEN_FONT_SIZE,
  REVIEW_FULLSCREEN_FONT_SIZES,
  getReviewFullscreenFontScale,
} from './reviewFullscreenFont.ts'

assert.equal(DEFAULT_REVIEW_FULLSCREEN_FONT_SIZE, 'medium')
assert.deepEqual(REVIEW_FULLSCREEN_FONT_SIZES.map(option => option.value), ['small', 'medium', 'large'])
assert.deepEqual(REVIEW_FULLSCREEN_FONT_SIZES.map(option => option.label), ['小', '中', '大'])

const small = getReviewFullscreenFontScale('small')
const medium = getReviewFullscreenFontScale('medium')
const large = getReviewFullscreenFontScale('large')

assert.equal(small.body, 13)
assert.equal(small.sourceSubheading, 13)
assert.equal(small.sourceHeading, 14)
assert.equal(small.issueBody, 13)
assert.equal(small.supportingText, 12)
assert.equal(small.lineHeight, 1.9)
assert.equal(small.issueLineHeight, 1.75)

assert.ok(medium.body > small.body)
assert.ok(medium.sourceHeading > small.sourceHeading)
assert.ok(medium.issueBody > small.issueBody)
assert.ok(medium.supportingText > small.supportingText)

assert.ok(large.body > medium.body)
assert.ok(large.sourceHeading > medium.sourceHeading)
assert.ok(large.issueBody > medium.issueBody)
assert.ok(large.supportingText > medium.supportingText)
assert.deepEqual(getReviewFullscreenFontScale('unknown'), medium)

console.log('reviewFullscreenFont tests passed')
