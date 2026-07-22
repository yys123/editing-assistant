import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import * as esbuild from 'esbuild'

const outdir = join(process.cwd(), '.tmp-tests', `step-guide-lookup-test-${process.pid}`)
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, 'StepGuideLookup.mjs')

await esbuild.build({
  entryPoints: ['src/components/StepGuideLookup.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  external: ['react'],
  logLevel: 'silent',
})

try {
  const source = await readFile('src/components/StepGuideLookup.tsx', 'utf8')

  assert.match(source, /historyStorageKey="clinic-master-guide-lookup-history"/)
  assert.match(source, /placeholder = '输入想要检索什么指南（请完整表述），如“慢性肾脏病的国内外指南”'/)
  assert.doesNotMatch(source, /ReferenceDoc/)
  assert.doesNotMatch(source, /referenceDocs/)
  assert.doesNotMatch(source, /setReferenceDocs/)
  assert.doesNotMatch(source, /showReferenceList/)
  assert.doesNotMatch(source, /onAddReferenceDocs/)
  assert.doesNotMatch(source, /addButtonLabel/)
  assert.doesNotMatch(source, /加入参考数据源/)

  console.log('StepGuideLookup tests passed')
} finally {
  await rm(outdir, { recursive: true, force: true })
}
