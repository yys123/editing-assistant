import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const stepSource = await readFile('src/components/StepAiIntegration.tsx', 'utf8')
const cssSource = await readFile('src/index.css', 'utf8')

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
  cssSource,
  /\.citation-verification-status/,
  'citation verification status strip should have CSS',
)
assert.match(
  cssSource,
  /\.citation-verification-panel/,
  'citation verification panel detail should have CSS',
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
