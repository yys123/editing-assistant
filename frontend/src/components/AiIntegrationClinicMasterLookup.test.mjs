import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import * as esbuild from 'esbuild'

const outdir = join(process.cwd(), '.tmp-tests', `ai-integration-clinic-master-lookup-test-${process.pid}`)
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, 'AiIntegrationClinicMasterLookup.mjs')

await esbuild.build({
  entryPoints: ['src/components/AiIntegrationClinicMasterLookup.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  external: ['react'],
  logLevel: 'silent',
})

try {
  const source = await readFile('src/components/AiIntegrationClinicMasterLookup.tsx', 'utf8')

  assert.match(source, /buildReferenceDocAddition/)
  assert.match(source, /onAddReferenceDocs=\{addReferenceDocs\}/)
  assert.match(source, /addButtonLabel="加入数据源"/)
  assert.match(source, /historyStorageKey="clinic-master-ai-integration-history"/)
  assert.match(source, /collapsibleSearch/)
  assert.match(source, /defaultSearchCollapsed/)

  console.log('AiIntegrationClinicMasterLookup tests passed')
} finally {
  await rm(outdir, { recursive: true, force: true })
}
