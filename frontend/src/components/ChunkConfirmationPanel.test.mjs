import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const outdir = join(process.cwd(), '.tmp-tests', `chunk-confirm-panel-test-${process.pid}`)
await mkdir(outdir, { recursive: true })
const outfile = join(outdir, 'ChunkConfirmationPanel.mjs')

await esbuild.build({
  entryPoints: ['src/components/ChunkConfirmationPanel.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  external: ['react', 'react-dom', 'react-dom/server'],
  logLevel: 'silent',
})

try {
  const {
    default: ChunkConfirmationPanel,
    chunkDisplayTitle,
    groupChunksBySource,
    recommendedChunkAutoConfirmLimit,
    recommendedChunkSearchLimit,
  } = await import(pathToFileURL(outfile).href)

  assert.equal(chunkDisplayTitle({
    chunk_id: 'R2-C001',
    source_id: 2,
    source_filename: 'paper.html',
    title_path: 'Concealed penis: A review of multilevel classification and surgical reconstruction techniques / Abstract',
    text: 'Abstract text',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
    source_ref_ids: [],
    score: 0,
    reason: '',
  }), 'Abstract')
  assert.equal(chunkDisplayTitle({
    chunk_id: 'R1-C001',
    source_id: 1,
    source_filename: '指南.html',
    title_path: '一、包皮的发生、解剖与病理生理',
    text: '正文',
    context_before: '',
    context_after: '',
    paragraph_index: 0,
    source_ref_ids: [],
    score: 0,
    reason: '',
  }), '一、包皮的发生、解剖与病理生理')

  const grouped = groupChunksBySource([
    {
      chunk_id: 'R1-C001',
      source_id: 1,
      source_filename: '指南A.md',
      title_path: '一、基础知识',
      text: '正文A1',
      context_before: '',
      context_after: '',
      paragraph_index: 0,
      source_ref_ids: [],
      score: 0,
      reason: '',
    },
    {
      chunk_id: 'R2-C001',
      source_id: 2,
      source_filename: '指南B.md',
      title_path: 'Disease / Abstract',
      text: '正文B1',
      context_before: '',
      context_after: '',
      paragraph_index: 0,
      source_ref_ids: [],
      score: 0,
      reason: '',
    },
    {
      chunk_id: 'R1-C002',
      source_id: 1,
      source_filename: '指南A.md',
      title_path: '二、诊断',
      text: '正文A2',
      context_before: '',
      context_after: '',
      paragraph_index: 1,
      source_ref_ids: [],
      score: 0,
      reason: '',
    },
  ])
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].sourceId, 1)
  assert.equal(grouped[0].sourceFilename, '指南A.md')
  assert.deepEqual(grouped[0].chunks.map(chunk => chunk.chunk_id), ['R1-C001', 'R1-C002'])
  assert.equal(grouped[1].sourceId, 2)
  assert.deepEqual(grouped[1].chunks.map(chunk => chunk.chunk_id), ['R2-C001'])

  assert.equal(recommendedChunkSearchLimit('quality_review', true), 40)
  assert.equal(recommendedChunkAutoConfirmLimit('quality_review', true), 40)
  assert.equal(recommendedChunkSearchLimit('ai_integration', false), 24)
  assert.equal(recommendedChunkAutoConfirmLimit('ai_integration', false), 8)

  const html = renderToStaticMarkup(React.createElement(ChunkConfirmationPanel, {
    taskType: 'quality_review',
    disease: '糖尿病',
    query: '诊断',
    referenceDocs: [{ filename: '糖尿病指南.md', text: '## 诊断\nHbA1c 可用于诊断。', char_count: 20 }],
    selectedReferenceNames: ['糖尿病指南.md'],
    priorityReferenceNames: [],
    value: [],
    onChange: () => {},
    compact: true,
  }))

  assert.doesNotMatch(html, /全屏筛选/)
  assert.doesNotMatch(html, /aria-label="全屏查看指南切片"/)
  assert.doesNotMatch(html, /chunk-confirm-list/)
  assert.doesNotMatch(html, /展开切片列表/)
  assert.doesNotMatch(html, /确认推荐/)
  assert.doesNotMatch(html, /查看上下文|收起上下文/)

  const source = await readFile('src/components/ChunkConfirmationPanel.tsx', 'utf-8')
  const css = await readFile('src/index.css', 'utf-8')
  assert.match(source, /return_all:\s*true/)
  assert.match(source, /mergeChunkCandidates/)
  assert.match(source, /chunkDisplayTitle/)
  assert.match(source, /chunk-confirm-toggle/)
  assert.match(source, /activeChunkKey/)
  assert.match(source, /chunk-confirm-layout/)
  assert.match(source, /chunk-confirm-directory/)
  assert.match(source, /chunk-confirm-preview/)
  assert.match(source, /chunk-confirm-preview-empty/)
  assert.match(source, /groupChunksBySource/)
  assert.match(source, /chunk-confirm-source-group/)
  assert.match(source, /chunk-confirm-source-title/)
  assert.match(source, /chunk-confirm-code/)
  assert.match(source, /\$\{group\.sourceId\}:\$\{chunk\.chunk_id\}:\$\{chunk\.paragraph_index\}/)
  assert.match(source, /groupSelectedCount/)
  assert.match(source, /groupRecommendedCount/)
  assert.match(source, /推荐/)
  assert.match(source, /未推荐/)
  assert.doesNotMatch(source, /完整列表/)
  assert.match(source, /setFullscreen\(true\)/)
  assert.match(source, /chunk-confirm-fullscreen-overlay/)
  assert.match(source, /退出全屏/)
  assert.match(source, /exitLabel\?: string/)
  assert.match(source, /onExit\?: \(\) => void/)
  assert.match(source, /onSearchStart\?: \(\) => void/)
  assert.match(source, /exitLabel = '退出'/)
  assert.match(source, /onExit\?\.\(\)/)
  assert.match(source, /onSearchStart\?\.\(\)/)
  assert.match(source, /onSearchStart\?\.\(\)[\s\S]*searchReferenceChunks/)
  assert.match(source, /setFullscreen\(false\)[\s\S]*onExit\?\.\(\)/)
  assert.match(source, /setFullscreen\(false\)[\s\S]*onConfirm\?\.\(\)/)
  assert.doesNotMatch(source, /全屏筛选|aria-label="全屏查看指南切片"/)
  assert.doesNotMatch(source, /listExpanded|setListExpanded/)
  assert.doesNotMatch(source, /确认推荐|selectRecommended/)
  assert.doesNotMatch(source, /查看上下文|收起上下文/)
  assert.match(css, /height:\s*calc\(100vh - 48px\)/)
  assert.match(css, /overscroll-behavior:\s*contain/)
  assert.match(css, /grid-template-columns:\s*minmax\(360px, 0\.95fr\) minmax\(360px, 1\.05fr\)/)
  assert.match(css, /\.chunk-confirm-list\s*{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s)
  assert.match(css, /\.chunk-confirm-source-group\s*{[^}]*overflow:\s*visible/s)
  assert.match(css, /\.chunk-confirm-directory\s*{[^}]*overflow-y:\s*auto/s)
  assert.match(css, /chunk-confirm-directory/)
  assert.match(css, /chunk-confirm-preview/)

  console.log('ChunkConfirmationPanel tests passed')
} finally {
  await rm(join(process.cwd(), '.tmp-tests'), { recursive: true, force: true })
}
