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
  const secondNewChunk = {
    id: '4',
    main_id: 'guide-1',
    main_title: '指南一',
    title: '第二个新切片',
    chunk_id: 'chunk-new-2',
    content_text: '第二段正文',
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
    secondNewChunk,
    duplicateChunk,
    blankContentChunk,
  ])
  assert.equal(addition.docs.length, 1)
  assert.equal(addition.added, 2)
  assert.equal(addition.duplicates, 1)
  assert.equal(addition.unusable, 1)
  assert.equal(addition.docs[0].filename, '临床决策切片-guide-1-指南一')
  assert.match(addition.docs[0].text, /\[H2\] 新切片/)
  assert.match(addition.docs[0].text, /\[临床决策切片ID\] chunk-new/)
  assert.match(addition.docs[0].text, /\[H2\] 第二个新切片/)
  assert.match(addition.docs[0].text, /\[临床决策切片ID\] chunk-new-2/)
  assert.doesNotMatch(addition.docs[0].text, /chunk-existing/)
  assert.doesNotMatch(addition.docs[0].text, /chunk-blank/)
  assert.equal(
    formatClinicalDecisionChunkAddition(addition),
    '已加入 1 个参考数据源，包含 2 条切片；跳过重复 1 条；无可用正文 1 条',
  )

  const batchDuplicate = buildClinicalDecisionChunkAddition([], [
    { ...newChunk, id: '4', title: '批内一', chunk_id: 'chunk-batch' },
    { ...newChunk, id: '5', title: '批内二', chunk_id: 'chunk-batch' },
  ])
  assert.equal(batchDuplicate.docs.length, 1)
  assert.equal(batchDuplicate.added, 1)
  assert.equal(batchDuplicate.duplicates, 1)
  assert.equal(batchDuplicate.unusable, 0)

  const noUsableAddition = buildClinicalDecisionChunkAddition([], [
    { ...newChunk, id: '6', chunk_id: '   ' },
    { ...newChunk, id: '7', content_text: '\n\t' },
    { ...newChunk, id: '8', usable: false },
  ])
  assert.equal(noUsableAddition.docs.length, 0)
  assert.equal(noUsableAddition.added, 0)
  assert.equal(noUsableAddition.unusable, 3)

  const source = await import('node:fs/promises').then(fs => fs.readFile(path.join(testDir, 'ClinicalDecisionChunkPanel.tsx'), 'utf8'))
  assert.match(source, /placeholder="如84915"/)
  assert.match(source, /setGuideId\(''\)/)
  assert.match(source, /setDoi\(''\)/)
  assert.match(source, /加入参考数据源/)
  assert.doesNotMatch(source, /加入已选/)
  assert.doesNotMatch(source, /全选可加入/)
  assert.doesNotMatch(source, /全部加入参考数据源/)
  assert.doesNotMatch(source, /clinical-decision-chunk-checkbox/)
  assert.doesNotMatch(source, /clinical-decision-chunk-results/)
  assert.doesNotMatch(source, /clinical-decision-chunk-row/)
  assert.doesNotMatch(source, /items\.map/)

  assert.equal(typeof ClinicalDecisionChunkPanel, 'function')
} finally {
  await rm(bundlePath, { force: true })
}

console.log('ClinicalDecisionChunkPanel tests passed')
