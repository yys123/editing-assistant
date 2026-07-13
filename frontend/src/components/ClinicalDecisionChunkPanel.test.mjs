import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const testDir = path.dirname(new URL(import.meta.url).pathname)
const bundlePath = path.join(testDir, '.ClinicalDecisionChunkPanel.test-bundle.mjs')

try {
  await esbuild.build({
    entryPoints: [path.join(testDir, 'ClinicalDecisionChunkPanel.tsx')],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'],
    logLevel: 'silent',
  })

  const panelModule = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`)
  const {
    buildClinicalDecisionChunkAddition,
    default: ClinicalDecisionChunkPanel,
    formatClinicalDecisionChunkAddition,
    selectableClinicalDecisionChunkIds,
  } = panelModule

  const currentDocs = [{
    filename: 'existing.md',
    text: '[H1] Existing\n[临床决策切片ID] chunk-existing\n\n正文',
    char_count: 44,
  }]

  const newChunk = {
    id: '1',
    main_id: 'guide-1',
    main_title: '指南一',
    title: '新切片',
    chunk_id: 'chunk-new',
    content_text: '新正文',
    usable: true,
  }
  const duplicateChunk = {
    id: '2',
    main_id: 'guide-1',
    main_title: '指南一',
    title: '重复切片',
    chunk_id: 'chunk-existing',
    content_text: '重复正文',
    usable: true,
  }
  const blankContentChunk = {
    id: '3',
    main_id: 'guide-1',
    main_title: '指南一',
    title: '空正文',
    chunk_id: 'chunk-blank',
    content_text: '   ',
    usable: true,
  }

  const addition = buildClinicalDecisionChunkAddition(currentDocs, [
    newChunk,
    duplicateChunk,
    blankContentChunk,
  ])
  assert.equal(addition.docs.length, 1)
  assert.equal(addition.added, 1)
  assert.equal(addition.duplicates, 1)
  assert.equal(addition.unusable, 1)
  assert.equal(
    formatClinicalDecisionChunkAddition(addition),
    '已加入 1 条；跳过重复 1 条；无可用正文 1 条',
  )
  assert.deepEqual(
    selectableClinicalDecisionChunkIds([newChunk, duplicateChunk, blankContentChunk]),
    ['chunk-new', 'chunk-existing'],
  )

  const batchDuplicate = buildClinicalDecisionChunkAddition([], [
    { ...newChunk, id: '4', title: '批内一', chunk_id: 'chunk-batch' },
    { ...newChunk, id: '5', title: '批内二', chunk_id: 'chunk-batch' },
  ])
  assert.equal(batchDuplicate.docs.length, 1)
  assert.equal(batchDuplicate.added, 1)
  assert.equal(batchDuplicate.duplicates, 1)
  assert.equal(batchDuplicate.unusable, 0)

  assert.deepEqual(
    selectableClinicalDecisionChunkIds([
      newChunk,
      { ...newChunk, id: '6', chunk_id: '   ' },
      { ...newChunk, id: '7', content_text: '\n\t' },
      { ...newChunk, id: '8', usable: false },
    ]),
    ['chunk-new'],
  )

  assert.equal(typeof ClinicalDecisionChunkPanel, 'function')
} finally {
  await rm(bundlePath, { force: true })
}

console.log('ClinicalDecisionChunkPanel tests passed')
