import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile('src/components/StepUpload.tsx', 'utf8')
const panelSource = await readFile('src/components/ClinicalDecisionChunkPanel.tsx', 'utf8')
const css = await readFile('src/index.css', 'utf8')

assert.match(source, /ClinicalDecisionChunkPanel/)
assert.match(source, /临床决策切片库/)
assert.match(source, /查询切片/)
assert.match(source, /setGuidePanelOpen\(false\)/)
assert.match(source, /setClinicalDecisionPanelOpen\(false\)/)
assert.match(source, /onAddReferenceDocs/)
assert.match(css, /\.clinical-decision-chunk-panel/)
assert.match(css, /\.guide-library-result-actions/)
assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.clinical-decision-chunk-query\s*\{[\s\S]*grid-template-columns: 1fr;/)
assert.doesNotMatch(panelSource, /gridTemplateColumns:\s*['"]minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+auto['"]/)

console.log('StepUpload clinical decision integration test passed')
