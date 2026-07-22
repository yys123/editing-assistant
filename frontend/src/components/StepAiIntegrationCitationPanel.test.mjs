import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stepSource = await readFile('src/components/StepAiIntegration.tsx', 'utf8')
const appSource = await readFile('src/App.tsx', 'utf8')
const typesSource = await readFile('src/types/index.ts', 'utf8')
const cssSource = await readFile('src/index.css', 'utf8')

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return cssSource.match(new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? ''
}

assert.match(
  stepSource,
  /className="citation-panel ai-integration-citation-panel"/,
  'AI integration citation details should use a dedicated viewport-pinned panel class',
)
assert.match(
  stepSource,
  /draft-preview-shell ai-integration-citation-shell/,
  'AI integration result shell should be marked for citation-specific layout',
)
assert.match(
  stepSource,
  /citationVerification:\s*data\.citation_verification/,
  'AI integration records should save citation verification metadata from the backend',
)
assert.match(
  stepSource,
  /getCitationVerificationDisplay/,
  'AI integration history should compute a citation verification summary',
)
assert.match(
  stepSource,
  /getCitationVerificationDisplayForOccurrences/,
  'AI integration history should count only visible unconfirmed citation occurrences',
)
assert.match(
  stepSource,
  /getCitationVerificationMarkerStatus/,
  'AI integration answer citations should compute marker status for inline highlighting',
)
assert.match(
  stepSource,
  /citation-verification-status/,
  'AI integration history should render a citation verification status strip',
)
assert.match(
  stepSource,
  /getCitationVerificationItemsForAnchor/,
  'AI citation panel should receive verification items for the active anchor',
)
assert.match(
  stepSource,
  /verificationItems=\{activeCitationVerificationItems\}/,
  'AI citation panel should receive active citation verification items',
)
assert.match(
  stepSource,
  /citation-verification-panel/,
  'AI citation panel should render citation verification detail',
)
assert.match(
  stepSource,
  /className="citation-panel-scroll"/,
  'AI citation panel should wrap long citation detail content in a dedicated scroll area',
)
assert.match(
  stepSource,
  /className="citation-panel-scroll"[\s\S]*className="citation-context"[\s\S]*citation-verification-panel[\s\S]*className="citation-occurrence-actions"/,
  'AI citation panel should keep citation context and verification details scrollable above the fixed review actions',
)
assert.match(
  stepSource,
  /citation-link-\$\{citationStatus\}/,
  'problematic answer citation markers should receive a status-specific class',
)
assert.match(
  stepSource,
  /复制待核对信息/,
  'citation verification detail should provide a manual review action',
)
assert.match(
  stepSource,
  /copyCitationVerificationReview/,
  'manual review action should copy the citation verification context',
)
assert.match(
  stepSource,
  /确认有问题，删除此处引用/,
  'citation verification detail should let users remove only the active citation occurrence',
)
assert.match(
  stepSource,
  /确认没问题/,
  'citation verification detail should let users mark the active citation occurrence as reviewed ok',
)
assert.match(
  stepSource,
  /removeCitationOccurrence/,
  'citation deletion should be delegated to the occurrence-scoped citation utility',
)
assert.match(
  stepSource,
  /onUpdateRecord/,
  'AI integration should receive an update callback for persisting citation review actions',
)
assert.match(
  appSource,
  /updateAiIntegrationRecord/,
  'App should update a single AI integration history record after citation review actions',
)
assert.match(
  typesSource,
  /citationOccurrenceReviews\?:/,
  'AI integration records should persist per-occurrence manual review state',
)
assert.match(
  typesSource,
  /citationReviewActions\?:/,
  'AI integration records should persist citation review audit actions for admin statistics',
)
assert.match(
  stepSource,
  /appendCitationReviewAction/,
  'AI integration should append a durable audit action when users review a citation occurrence',
)
assert.match(
  stepSource,
  /buildCitationOccurrenceReviewsForDisplay/,
  'AI integration should derive visible occurrence review state from durable audit actions',
)
assert.match(
  stepSource,
  /findCitationOccurrenceForAnchor/,
  'AI citation panel should recover an occurrence when a repeated or suffixed citation opens without a current occurrence key',
)
assert.match(
  stepSource,
  /activeCitationOccurrenceKeyForReview/,
  'AI citation review actions should use the recovered occurrence key when the clicked key is missing or stale',
)
assert.match(
  stepSource,
  /appendCitationReviewAction\([\s\S]*'confirmed'\)/,
  'confirming a citation as ok should be recorded as a confirmed review action',
)
assert.match(
  stepSource,
  /appendCitationReviewAction\([\s\S]*'rejected'\)/,
  'deleting a citation as problematic should be recorded as a rejected review action',
)
assert.match(
  cssSource,
  /\.citation-verification-status/,
  'citation verification status strip should have CSS',
)
assert.match(
  cssSource,
  /\.citation-verification-panel/,
  'citation verification panel detail should have CSS',
)
assert.match(
  cssSource,
  /\.citation-link-mismatch/,
  'mismatched citations should have a visible inline highlight style',
)
assert.match(
  cssSource,
  /\.citation-link-weak/,
  'weakly supported citations should have a visible inline highlight style',
)
assert.match(
  cssSource,
  /\.citation-link-unverifiable/,
  'unverifiable citations should have a visible inline highlight style',
)
assert.match(
  cssSource,
  /\.citation-link-confirmed/,
  'manually confirmed citations should turn green',
)
assert.match(
  cssSource,
  /\.citation-verification-actions/,
  'manual citation verification actions should have CSS',
)

const aiShellRule = cssSource.match(/\.ai-integration-citation-shell\.has-citation-panel\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
assert.match(
  aiShellRule,
  /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+var\(--ai-integration-citation-panel-width\)/,
  'AI integration results should reserve an invisible right-side safe lane for the fixed citation panel',
)
assert.doesNotMatch(
  aiShellRule,
  /minmax\(280px,\s*34%\)/,
  'AI integration citation safe lane should share the fixed panel width instead of the old approximate column',
)

const panelRule = cssSource.match(/\.ai-integration-citation-panel\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
assert.match(panelRule, /position:\s*fixed/, 'AI integration citation panel should stay fixed in the viewport on desktop')
assert.match(panelRule, /top:\s*calc\(var\(--header-height\) \+ 16px\)/, 'desktop panel should sit below the fixed app header')
assert.match(panelRule, /right:\s*24px/, 'desktop panel should stay inside the visible app gutter')
assert.match(panelRule, /width:\s*var\(--ai-integration-citation-panel-width\)/, 'desktop panel width should match the reserved result safe lane')
assert.match(panelRule, /max-height:\s*calc\(100vh - var\(--header-height\) - 32px\)/, 'desktop panel should fit within the viewport')
assert.match(panelRule, /z-index:\s*35/, 'fixed panel should layer above the long AI result content')
assert.match(panelRule, /display:\s*flex/, 'AI integration citation panel should be a flex column so only the detail body scrolls')
assert.match(panelRule, /flex-direction:\s*column/, 'AI integration citation panel should stack header, body, and actions vertically')
assert.match(panelRule, /overflow:\s*hidden/, 'AI integration citation panel should clip to the viewport while its inner body scrolls')

const panelHeaderRule = cssRule('.citation-panel-header')
assert.match(panelHeaderRule, /flex-shrink:\s*0/, 'citation panel header should remain visible while long citation details scroll')

const panelScrollRule = cssRule('.citation-panel-scroll')
assert.match(panelScrollRule, /flex:\s*1 1 auto/, 'citation panel detail area should fill the remaining panel height')
assert.match(panelScrollRule, /min-height:\s*0/, 'citation panel detail area should be allowed to shrink inside the fixed-height panel')
assert.match(panelScrollRule, /overflow-y:\s*auto/, 'citation panel detail area should scroll vertically when content is too long')

const occurrenceActionsRule = cssRule('.citation-occurrence-actions')
assert.match(occurrenceActionsRule, /flex-shrink:\s*0/, 'citation review action buttons should stay visible below the scrollable detail area')

assert.match(
  cssSource,
  /@media \(max-width: 980px\)[\s\S]*\.ai-integration-citation-panel\s*\{[\s\S]*position:\s*fixed[\s\S]*top:\s*auto[\s\S]*bottom:\s*16px[\s\S]*left:\s*16px[\s\S]*right:\s*16px/,
  'narrow screens should show AI integration citation details as a bottom sheet',
)

const expandedHistoryRule = cssSource.match(/\.ai-history-item\.expanded\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
assert.match(
  expandedHistoryRule,
  /border-color:\s*var\(--dui-divider\)/,
  'expanded AI integration records should avoid the prominent purple outer border when citation panels float',
)
assert.doesNotMatch(
  expandedHistoryRule,
  /rgba\(119,\s*83,\s*255,\s*0\.35\)/,
  'expanded AI integration records should not draw the purple outer boundary shown next to the floating panel',
)

console.log('StepAiIntegration citation panel tests passed')
