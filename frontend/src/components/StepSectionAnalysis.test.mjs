import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const outdir = join(process.cwd(), '.tmp-tests', `step-section-analysis-test-${process.pid}`)
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, 'StepSectionAnalysis.mjs')

await esbuild.build({
  entryPoints: ['src/components/StepSectionAnalysis.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  external: ['react'],
  logLevel: 'silent',
})

try {
  const { buildSectionAnalysisReferencePayload } = await import(pathToFileURL(outfile).href)

  const selectedReferences = [
    { filename: '整篇指南.md', text: '整篇指南正文', char_count: 6 },
  ]

  const payload = buildSectionAnalysisReferencePayload({
    allReferenceDocs: selectedReferences,
    selectedReferenceDocs: selectedReferences,
    priorityReferenceDocs: selectedReferences,
    confirmedChunks: [],
  })

  assert.deepEqual(payload.confirmed_reference_chunks, [])
  assert.equal(payload.reference_texts.length, 1)
  assert.match(payload.reference_texts[0], /### 参考数据源 1/)
  assert.match(payload.reference_texts[0], /整篇指南正文/)
  assert.equal(payload.priority_reference_texts.length, 1)
  assert.match(payload.priority_reference_texts[0], /重点指南/)

  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/StepSectionAnalysis.tsx', 'utf8'))
  assert.match(source, /chunkSearchBaselinesByGroup/)
  assert.match(source, /beginQualityReviewChunkSearch/)
  assert.match(source, /discardQualityReviewChunkSearch/)
  assert.match(source, /confirmQualityReviewChunkSearch/)
  assert.match(source, /onSearchStart=\{\(\) => beginQualityReviewChunkSearch\(group\.representative\.id\)\}/)
  assert.match(source, /exitLabel="退出"/)
  assert.match(source, /confirmLabel="确认切片"/)
  assert.match(source, /onExit=\{\(\) => discardQualityReviewChunkSearch\(group\.representative\.id\)\}/)
  assert.match(source, /onConfirm=\{\(\) => confirmQualityReviewChunkSearch\(group\.representative\.id\)\}/)

  console.log('StepSectionAnalysis tests passed')
} finally {
  await rm(join(process.cwd(), '.tmp-tests'), { recursive: true, force: true })
}
