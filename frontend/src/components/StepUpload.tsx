import { useEffect, useRef, useState } from 'react'
import { QAItem, ReferenceDoc, StandardsOverride } from '../types'
import { apiFetch, safeJson, chunkedUpload } from '../api'

interface Props {
  disease: string
  setDisease: (v: string) => void
  articleContent: string
  setArticleContent: (v: string) => void
  qaItems: QAItem[]
  setQaItems: (items: QAItem[]) => void
  referenceDocs: ReferenceDoc[]
  setReferenceDocs: (docs: ReferenceDoc[]) => void
  standardsOverride: StandardsOverride
  setStandardsOverride: (s: StandardsOverride) => void
  onNext: () => void
}

type ArticleTab = 'file' | 'text'

const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'OL', 'P', 'SECTION', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'UL'])
const INLINE_TAGS = new Set(['B', 'BR', 'EM', 'I', 'STRONG'])
const TOP_LEVEL_MODULES = new Set(['基础知识', '诊断', '鉴别诊断', '治疗', '控制目标', '经典用药', '预后', '预防'])

interface NumberingState {
  sectionCounters: Record<number, number>
  orderedCounters: Record<string, number>
}

function normalizeEditorText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function safeNumberingAttrs(node: HTMLElement) {
  const attrs: string[] = []
  const sectionIndex = node.getAttribute('data-section-index')
  const orderedIndex = node.getAttribute('data-orderedlist-index')

  if (sectionIndex && /^\d+$/.test(sectionIndex)) {
    attrs.push(`data-section-index="${sectionIndex}"`)
  }
  if (orderedIndex && /^\d+$/.test(orderedIndex)) {
    attrs.push(`data-orderedlist-index="${orderedIndex}"`)
  }

  return attrs.length ? ` ${attrs.join(' ')}` : ''
}

function htmlToSafeEditorHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '')
    }
    if (!(node instanceof HTMLElement)) return ''
    const tag = node.tagName
    const children = Array.from(node.childNodes).map(walk).join('')
    if (!children && tag !== 'BR') return ''
    if (tag === 'BR') return '<br>'
    const attrs = safeNumberingAttrs(node)
    if (tag === 'DIV') return `<p${attrs}>${children}</p>`
    if (tag === 'H4' || tag === 'H5' || tag === 'H6') return `<h3${attrs}>${children}</h3>`
    if (BLOCK_TAGS.has(tag) || INLINE_TAGS.has(tag)) {
      return `<${tag.toLowerCase()}${attrs}>${children}</${tag.toLowerCase()}>`
    }
    return children
  }

  return Array.from(doc.body.childNodes).map(walk).join('')
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function textToEditorHtml(text: string) {
  if (!text) return ''
  return text
    .split(/\n{2,}/)
    .map(block => {
      const lines = block.split('\n').map(line => {
        const escaped = escapeHtml(line)
        return isTopLevelModuleHeading(line)
          ? `<span class="rich-editor-module-heading">${escaped}</span>`
          : escaped
      })
      return `<p>${lines.join('<br>')}</p>`
    })
    .join('')
}

function hasRecoveredNumbering(html: string) {
  return /\sdata-(section-index|orderedlist-index)=["']?\d+/i.test(html)
}

function listPrefix(type: 'ol' | 'ul', index: number, depth: number) {
  if (type === 'ul') return '- '
  return depth <= 1 ? `${index}、` : `（${index}）`
}

function chineseNumber(num: number) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (num <= 10) return num === 10 ? '十' : digits[num]
  if (num < 20) return `十${digits[num - 10]}`
  if (num < 100) {
    const ten = Math.floor(num / 10)
    const one = num % 10
    return `${digits[ten]}十${one ? digits[one] : ''}`
  }
  return String(num)
}

function alphaNumber(num: number) {
  let n = num
  let text = ''
  while (n > 0) {
    n -= 1
    text = String.fromCharCode(97 + (n % 26)) + text
    n = Math.floor(n / 26)
  }
  return text || 'a'
}

function romanNumber(num: number) {
  const map: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let n = num
  let text = ''
  for (const [value, symbol] of map) {
    while (n >= value) {
      text += symbol
      n -= value
    }
  }
  return text || 'I'
}

function sectionPrefix(level: number, count: number) {
  if (level === 1) return `${chineseNumber(count)}、`
  if (level === 2) return `(${chineseNumber(count)})`
  if (level === 3) return `${count}、`
  return `${count}.`
}

function orderedPrefix(styleIndex: string, count: number) {
  const styles: Record<string, string> = {
    '1': `${count}、`,
    '2': `(${count})`,
    '3': `${count})`,
    '4': `${count}.`,
    '5': `${alphaNumber(count)}.`,
    '6': `${romanNumber(count)}.`,
  }
  return styles[styleIndex] || `${count}.`
}

function cleanElementText(node: HTMLElement) {
  return (node.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeModuleHeading(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/^[#*\-—_\s]+|[#*\-—_\s]+$/g, '')
    .replace(/^【(.+)】$/, '$1')
    .replace(/^［(.+)］$/, '$1')
    .replace(/^\[(.+)\]$/, '$1')
    .replace(/^（(.+)）$/, '$1')
    .replace(/^\((.+)\)$/, '$1')
    .replace(/字段$/, '')
}

function isTopLevelModuleHeading(text: string) {
  return TOP_LEVEL_MODULES.has(normalizeModuleHeading(text))
}

function markEditorModuleHeadings(root: HTMLElement) {
  const blockSelector = 'h1,h2,h3,h4,h5,h6,p,div,li'
  root.querySelectorAll(blockSelector).forEach(node => {
    if (!(node instanceof HTMLElement)) return
    const directText = Array.from(node.childNodes)
      .filter(child => child.nodeType === Node.TEXT_NODE || child.nodeName === 'BR')
      .map(child => child.textContent || '')
      .join('')
      .trim()
    const fullText = cleanElementText(node)
    node.classList.toggle(
      'rich-editor-module-heading',
      isTopLevelModuleHeading(directText || fullText),
    )
  })
}

function resetNumberingForModule(state: NumberingState) {
  state.sectionCounters = {}
  state.orderedCounters = {}
}

function nodeToPlainText(node: Node, state: NumberingState, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (!(node instanceof HTMLElement)) return ''

  const tag = node.tagName
  if (tag === 'BR') return '\n'

  const elementText = cleanElementText(node)

  const sectionIndex = node.getAttribute('data-section-index')
  if (sectionIndex) {
    const level = Number(sectionIndex)
    if (!Number.isNaN(level) && elementText) {
      if (isTopLevelModuleHeading(elementText)) resetNumberingForModule(state)
      state.sectionCounters[level] = (state.sectionCounters[level] || 0) + 1
      Object.keys(state.sectionCounters).forEach(key => {
        if (Number(key) > level) state.sectionCounters[Number(key)] = 0
      })
      state.orderedCounters = {}
      return `${sectionPrefix(level, state.sectionCounters[level])} ${elementText}\n`
    }
  }

  const orderedIndex = node.getAttribute('data-orderedlist-index')
  if (orderedIndex) {
    if (elementText) {
      Object.keys(state.orderedCounters).forEach(key => {
        if (Number(key) > Number(orderedIndex)) state.orderedCounters[key] = 0
      })
      state.orderedCounters[orderedIndex] = (state.orderedCounters[orderedIndex] || 0) + 1
      return `${orderedPrefix(orderedIndex, state.orderedCounters[orderedIndex])} ${elementText}\n`
    }
  }

  if (tag === 'OL' || tag === 'UL') {
    let index = Number(node.getAttribute('start') || '1')
    const type = tag === 'OL' ? 'ol' : 'ul'
    return Array.from(node.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'LI')
      .map(li => {
        const prefix = listPrefix(type, index++, listDepth + 1)
        return `${prefix}${liToPlainText(li, state, listDepth + 1)}`
      })
      .join('\n') + '\n'
  }

  const content = Array.from(node.childNodes).map(child => nodeToPlainText(child, state, listDepth)).join('')
  if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV'].includes(tag)) {
    if (isTopLevelModuleHeading(elementText)) {
      resetNumberingForModule(state)
    }
    return content.trim() ? `${content.trim()}\n` : ''
  }
  if (tag === 'TR') {
    return `${content.trim()}\n`
  }
  if (tag === 'TD' || tag === 'TH') {
    return `${content.trim()} | `
  }
  return content
}

function liToPlainText(li: HTMLElement, state: NumberingState, depth: number) {
  const parts: string[] = []
  const nestedLists: string[] = []

  li.childNodes.forEach(child => {
    if (child instanceof HTMLElement && (child.tagName === 'OL' || child.tagName === 'UL')) {
      nestedLists.push(nodeToPlainText(child, state, depth).trim())
    } else {
      parts.push(nodeToPlainText(child, state, depth))
    }
  })

  const main = normalizeEditorText(parts.join(''))
  const nested = nestedLists.filter(Boolean).join('\n')
  return nested ? `${main}\n${nested}` : main
}

function editorToPlainText(editor: HTMLElement) {
  const state: NumberingState = { sectionCounters: {}, orderedCounters: {} }
  return normalizeEditorText(Array.from(editor.childNodes).map(node => nodeToPlainText(node, state)).join(''))
}

function editorHtmlToPlainText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const state: NumberingState = { sectionCounters: {}, orderedCounters: {} }
  return normalizeEditorText(Array.from(doc.body.childNodes).map(node => nodeToPlainText(node, state)).join(''))
}

function RichPasteEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (document.activeElement === editor) return
    if (editorToPlainText(editor) !== normalizeEditorText(value)) {
      editor.innerHTML = textToEditorHtml(value)
      markEditorModuleHeadings(editor)
    }
  }, [value])

  const syncFromEditor = () => {
    const editor = editorRef.current
    if (editor) onChange(editorToPlainText(editor))
  }

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, commandValue)
    syncFromEditor()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html')
    const plain = e.clipboardData.getData('text/plain')
    const safeHtml = html ? htmlToSafeEditorHtml(html) : ''
    const insertable = safeHtml && hasRecoveredNumbering(safeHtml)
      ? textToEditorHtml(editorHtmlToPlainText(safeHtml))
      : safeHtml || normalizeEditorText(plain)
    if (!insertable) return
    e.preventDefault()
    document.execCommand(safeHtml ? 'insertHTML' : 'insertText', false, insertable)
    if (editorRef.current) markEditorModuleHeadings(editorRef.current)
    syncFromEditor()
  }

  const clearFormatting = () => {
    const editor = editorRef.current
    if (!editor) return
    const text = editorToPlainText(editor)
    editor.innerHTML = textToEditorHtml(text)
    markEditorModuleHeadings(editor)
    onChange(text)
  }

  const clearAll = () => {
    if (editorRef.current) editorRef.current.innerHTML = ''
    onChange('')
  }

  return (
    <div className="rich-editor-wrap">
      <div className="rich-editor-toolbar" aria-label="富文本编辑工具栏">
        <button type="button" className="rich-editor-tool" title="二级标题" onClick={() => runCommand('formatBlock', 'h2')}>H2</button>
        <button type="button" className="rich-editor-tool" title="三级标题" onClick={() => runCommand('formatBlock', 'h3')}>H3</button>
        <button type="button" className="rich-editor-tool icon" title="加粗" onClick={() => runCommand('bold')}>
          <span className="material-symbols-outlined">format_bold</span>
        </button>
        <button type="button" className="rich-editor-tool icon" title="项目符号列表" onClick={() => runCommand('insertUnorderedList')}>
          <span className="material-symbols-outlined">format_list_bulleted</span>
        </button>
        <button type="button" className="rich-editor-tool icon" title="编号列表" onClick={() => runCommand('insertOrderedList')}>
          <span className="material-symbols-outlined">format_list_numbered</span>
        </button>
        <button type="button" className="rich-editor-tool" title="清除格式" onClick={clearFormatting}>清除格式</button>
        <button type="button" className="rich-editor-tool danger" title="清空内容" onClick={clearAll}>清空</button>
        <span className="rich-editor-count">{value.length.toLocaleString()} 字符</span>
      </div>
      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="直接粘贴词条全文内容..."
        onInput={syncFromEditor}
        onBlur={syncFromEditor}
        onPaste={handlePaste}
      />
    </div>
  )
}

export default function StepUpload({
  disease, setDisease, articleContent, setArticleContent,
  qaItems, setQaItems, referenceDocs, setReferenceDocs,
  standardsOverride, setStandardsOverride, onNext
}: Props) {
  const [articleTab, setArticleTab] = useState<ArticleTab>('file')
  const [articleError, setArticleError] = useState('')
  const [qaLoading, setQaLoading] = useState(false)
  const [qaError, setQaError] = useState('')
  const [qaCount, setQaCount] = useState(qaItems.length)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [articleProgress, setArticleProgress] = useState(0)
  const [articleUploading, setArticleUploading] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(0)
  const [showStandardsPanel, setShowStandardsPanel] = useState(true)
  const [standardsLoading, setStandardsLoading] = useState(false)

  const articleInputRef = useRef<HTMLInputElement>(null)
  const qaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const qualityStdInputRef = useRef<HTMLInputElement>(null)
  const contentSpecInputRef = useRef<HTMLInputElement>(null)

  const loadFromFile = async (file: File) => {
    setArticleError('')
    setArticleUploading(true)
    setArticleProgress(0)
    try {
      const data = await chunkedUpload(file, 'article', {}, setArticleProgress)
      setArticleContent(data.content)
    } catch (e: any) {
      setArticleError(e.message)
    } finally {
      setArticleUploading(false)
      setArticleProgress(0)
    }
  }

  const loadQaFile = async (file: File) => {
    setQaLoading(true)
    setQaError('')
    try {
      const data = await chunkedUpload(file, 'qa')
      setQaItems(data.items)
      setQaCount(data.count)
    } catch (e: any) {
      setQaError(e.message)
    } finally {
      setQaLoading(false)
    }
  }

  const loadPdfFiles = async (files: FileList) => {
    setPdfLoading(true)
    setPdfError('')
    setPdfProgress(0)
    try {
      const allResults: any[] = []
      const fileArr = Array.from(files)
      for (let fi = 0; fi < fileArr.length; fi++) {
        const f = fileArr[fi]
        const data = await chunkedUpload(f, 'pdf', { filenames: [f.name] }, (pct) => {
          // 多文件时计算整体进度：已完成的文件 + 当前文件进度
          const overall = Math.round(((fi + pct / 100) / fileArr.length) * 100)
          setPdfProgress(overall)
        })
        allResults.push(...data)
      }
      setReferenceDocs([...referenceDocs, ...allResults])
    } catch (e: any) {
      setPdfError(e.message)
    } finally {
      setPdfLoading(false)
      setPdfProgress(0)
    }
  }

  const loadStandardFile = async (file: File, type: 'quality' | 'spec') => {
    setStandardsLoading(true)
    try {
      const data = await chunkedUpload(file, 'standard', { standard_type: type })
      if (type === 'quality') {
        setStandardsOverride({ ...standardsOverride, qualityText: data.text })
      } else {
        setStandardsOverride({ ...standardsOverride, specText: data.text })
      }
    } catch (e: any) {
      // silently fail
    } finally {
      setStandardsLoading(false)
    }
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          数据上传
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          上传疾病词条内容、参考文献和问答数据，开始编辑审评流程
        </p>
      </div>

      <div className="grid-12" style={{ gap: 20 }}>
        {/* ── Left Column: Disease + Standards ── */}
        <div className="col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Disease name */}
          <div className="section-card-accent">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>local_hospital</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)' }}>疾病名称</span>
            </div>
            <input
              className="m3-input"
              placeholder="输入疾病名称，例如：2型糖尿病"
              value={disease}
              onChange={e => setDisease(e.target.value)}
            />
          </div>

          {/* Standards override */}
          <div className="section-card">
            <div
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: 'space-between' }}
              onClick={() => setShowStandardsPanel(!showStandardsPanel)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-on-surface-variant)' }}>tune</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)' }}>评审标准</span>
                {(standardsOverride.qualityText || standardsOverride.specText) && (
                  <span style={{ fontSize: 12, color: 'var(--m3-primary)', background: 'var(--dui-primary-container)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>已自定义</span>
                )}
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-on-surface-variant)', transition: 'transform 0.2s', transform: showStandardsPanel ? 'rotate(180deg)' : 'none' }}>expand_more</span>
            </div>

            {showStandardsPanel && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 14 }}>
                  若不上传，使用内置的「内容质量审评标准3.0」和「内容要求规范」。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: '12px', background: 'var(--m3-surface-container-low)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--m3-on-surface)' }}>质量审评标准</div>
                    <button
                      className="btn-m3-outline" style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => qualityStdInputRef.current?.click()}
                      disabled={standardsLoading}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                      {standardsOverride.qualityText ? '重新上传' : '上传自定义标准'}
                    </button>
                    <input ref={qualityStdInputRef} type="file" accept=".txt,.md,.pdf" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) loadStandardFile(f, 'quality')
                    }} />
                    {standardsOverride.qualityText && (
                      <button className="btn-m3-outline" style={{ marginLeft: 6, fontSize: 12, padding: '5px 12px', color: 'var(--m3-error)' }}
                        onClick={() => setStandardsOverride({ ...standardsOverride, qualityText: undefined })}>
                        恢复内置
                      </button>
                    )}
                  </div>
                  <div style={{ padding: '12px', background: 'var(--m3-surface-container-low)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--m3-on-surface)' }}>内容要求规范</div>
                    <button
                      className="btn-m3-outline" style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => contentSpecInputRef.current?.click()}
                      disabled={standardsLoading}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                      {standardsOverride.specText ? '重新上传' : '上传自定义规范'}
                    </button>
                    <input ref={contentSpecInputRef} type="file" accept=".txt,.md,.pdf" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) loadStandardFile(f, 'spec')
                    }} />
                    {standardsOverride.specText && (
                      <button className="btn-m3-outline" style={{ marginLeft: 6, fontSize: 12, padding: '5px 12px', color: 'var(--m3-error)' }}
                        onClick={() => setStandardsOverride({ ...standardsOverride, specText: undefined })}>
                        恢复内置
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Article content + QA ── */}
        <div className="col-span-8" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Article input */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>description</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)' }}>知识库词条内容</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '0.5px solid var(--dui-divider)' }}>
              {(['file', 'text'] as ArticleTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setArticleTab(t)}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: articleTab === t ? 600 : 400,
                    color: articleTab === t ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                    background: 'none',
                    border: 'none',
                    borderBottom: articleTab === t ? '2px solid var(--m3-primary)' : '2px solid transparent',
                    marginBottom: -2,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>
                    {t === 'file' ? 'upload_file' : 'edit'}
                  </span>
                  {{ file: '文件上传', text: '直接粘贴' }[t]}
                </button>
              ))}
            </div>

            {articleTab === 'file' && (
              <div>
                <div
                  className="m3-upload-zone"
                  onClick={() => articleInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                  onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('drag-over')
                    const f = e.dataTransfer.files[0]
                    if (f) loadFromFile(f)
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--m3-primary)', opacity: 0.7 }}>cloud_upload</span>
                  <p style={{ fontSize: 13, color: 'var(--m3-on-surface)', fontWeight: 500, marginTop: 4 }}>
                    {articleUploading ? `上传中 ${articleProgress}%...` : '点击或拖拽上传词条文件'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>支持 .html .htm .txt .md 格式</p>
                  <input ref={articleInputRef} type="file" accept=".html,.htm,.txt,.md" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) loadFromFile(f)
                  }} />
                </div>
                {articleError && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, fontSize: 13 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                    {articleError}
                  </div>
                )}
              </div>
            )}

            {articleTab === 'text' && (
              <RichPasteEditor value={articleContent} onChange={setArticleContent} />
            )}

            {articleContent && articleTab !== 'text' && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--dui-success-container)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--m3-tertiary)', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>check_circle</span>
                  已加载词条内容（{articleContent.length} 字符）
                </span>
                <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px', color: 'var(--m3-error)' }} onClick={() => setArticleContent('')}>清除</button>
              </div>
            )}
          </div>

          {/* Q&A upload */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-secondary)' }}>forum</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)' }}>Q&A 问答数据</span>
              <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', background: 'var(--m3-surface-container-low)', padding: '2px 8px', borderRadius: 4 }}>可选</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 12 }}>
              上传筛选后的相关疾病问答列表（CSV / Excel），支持列：问题、回答（可选）、证据来源（可选）
            </p>
            <div
              className="m3-upload-zone"
              onClick={() => qaInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.classList.remove('drag-over')
                const f = e.dataTransfer.files[0]
                if (f) loadQaFile(f)
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--m3-secondary)', opacity: 0.7 }}>table_chart</span>
              <p style={{ fontSize: 13, color: 'var(--m3-on-surface)', fontWeight: 500, marginTop: 4 }}>{qaLoading ? '解析中...' : '点击或拖拽上传 CSV / Excel 文件'}</p>
              <input ref={qaInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0]
                if (f) loadQaFile(f)
              }} />
            </div>
            {qaError && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                {qaError}
              </div>
            )}
            {qaCount > 0 && (
              <div style={{ marginTop: 10, padding: '12px 16px', background: 'var(--dui-success-container)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--m3-tertiary)', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>check_circle</span>
                  已加载 {qaCount} 条问答数据
                </span>
                <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px', color: 'var(--m3-error)' }} onClick={() => { setQaItems([]); setQaCount(0) }}>清除</button>
              </div>
            )}
            {qaItems.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 8 }}>数据预览（前5条）：</div>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--dui-divider)' }}>
                  <table className="m3-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>问题</th>
                        {qaItems[0]?.answer && <th>回答摘要</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {qaItems.slice(0, 5).map((item, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--m3-on-surface-variant)' }}>{i + 1}</td>
                          <td>{item.question}</td>
                          {item.answer && <td style={{ color: 'var(--m3-on-surface-variant)' }}>{item.answer.slice(0, 80)}...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Reference PDFs */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-tertiary)' }}>menu_book</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)' }}>参考文献 PDF 库</span>
              <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', background: 'var(--m3-surface-container-low)', padding: '2px 8px', borderRadius: 4 }}>可选</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 14 }}>
              上传参考文件（指南、综述等），AI分析时将引用其内容（每文件截取前6000字符）
            </p>

            <div className="pdf-grid">
              {/* Add card */}
              <div
                className="pdf-add-card"
                onClick={() => pdfInputRef.current?.click()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--m3-primary)', opacity: 0.6 }}>
                  {pdfLoading ? 'hourglass_empty' : 'note_add'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', fontWeight: 500 }}>
                  {pdfLoading ? (pdfProgress > 0 ? `上传中 ${pdfProgress}%` : '解析中...') : '添加文件'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--m3-outline)' }}>.pdf .html .htm</span>
                <input ref={pdfInputRef} type="file" accept=".pdf,.html,.htm" multiple style={{ display: 'none' }} onChange={e => {
                  if (e.target.files?.length) loadPdfFiles(e.target.files)
                }} />
              </div>

              {/* Existing docs */}
              {referenceDocs.map((doc, i) => (
                <div key={i} className="pdf-item-card">
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: doc.filename.toLowerCase().endsWith('.pdf') ? 'var(--dui-danger)' : 'var(--dui-primary)' }}>
                    {doc.filename.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'language'}
                  </span>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--m3-on-surface)', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.3 }}>
                    {doc.filename.length > 30 ? doc.filename.slice(0, 27) + '...' : doc.filename}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>{doc.char_count} 字符</div>
                  <button
                    onClick={() => setReferenceDocs(referenceDocs.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '50%',
                      width: 22, height: 22, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.15s',
                    }}
                    className="pdf-item-delete"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--m3-error)' }}>close</span>
                  </button>
                </div>
              ))}
            </div>
            {pdfError && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                {pdfError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
