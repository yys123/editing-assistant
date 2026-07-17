import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const outdir = join(process.cwd(), '.tmp-tests', `reference-docs-test-${process.pid}`)
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, 'referenceDocs.mjs')

await esbuild.build({
  entryPoints: ['src/utils/referenceDocs.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
})

try {
  const { buildReferenceDocAddition } = await import(pathToFileURL(outfile).href)

  const result = buildReferenceDocAddition(
    [{ filename: 'existing.md', text: 'A', char_count: 1 }],
    [
      { filename: 'existing.md', text: 'A2', char_count: 2 },
      { filename: 'new.md', text: 'B', char_count: 1 },
      { filename: 'new.md', text: 'B2', char_count: 2 },
    ],
  )

  assert.deepEqual(result.docs.map(doc => doc.filename), ['existing.md', 'new.md'])
  assert.equal(result.added, 1)
  assert.equal(result.duplicates, 2)

  console.log('referenceDocs tests passed')
} finally {
  await rm(outdir, { recursive: true, force: true })
}
