export type ReviewFullscreenFontSize = 'small' | 'medium' | 'large'

export const DEFAULT_REVIEW_FULLSCREEN_FONT_SIZE: ReviewFullscreenFontSize = 'medium'

export const REVIEW_FULLSCREEN_FONT_SIZES: Array<{ value: ReviewFullscreenFontSize; label: string }> = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
]

export interface ReviewFullscreenFontScale {
  body: number
  sourceSubheading: number
  sourceHeading: number
  issueBody: number
  supportingText: number
  lineHeight: number
  issueLineHeight: number
}

const REVIEW_FULLSCREEN_FONT_SCALE: Record<ReviewFullscreenFontSize, ReviewFullscreenFontScale> = {
  small: {
    body: 13,
    sourceSubheading: 13,
    sourceHeading: 14,
    issueBody: 13,
    supportingText: 12,
    lineHeight: 1.9,
    issueLineHeight: 1.75,
  },
  medium: {
    body: 15,
    sourceSubheading: 15,
    sourceHeading: 16,
    issueBody: 15,
    supportingText: 14,
    lineHeight: 1.85,
    issueLineHeight: 1.7,
  },
  large: {
    body: 17,
    sourceSubheading: 17,
    sourceHeading: 18,
    issueBody: 17,
    supportingText: 16,
    lineHeight: 1.8,
    issueLineHeight: 1.65,
  },
}

export function getReviewFullscreenFontScale(size: string): ReviewFullscreenFontScale {
  if (size === 'small' || size === 'medium' || size === 'large') return REVIEW_FULLSCREEN_FONT_SCALE[size]
  return REVIEW_FULLSCREEN_FONT_SCALE[DEFAULT_REVIEW_FULLSCREEN_FONT_SIZE]
}
