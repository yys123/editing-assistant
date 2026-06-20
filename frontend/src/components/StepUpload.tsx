import { useEffect, useRef, useState } from 'react'
import { ArticleEntryType, QAItem, ReferenceDoc, StandardsOverride } from '../types'
import {
  chunkedUpload,
  fetchEntryDetail,
  fetchGuideDetail,
  guideDetailToReferenceDoc,
  searchEntries,
  searchGuides,
  type EntryDetail,
  type EntrySearchItem,
  type GuideSearchItem,
} from '../api'
import { articleContentToStructuredMarkers } from '../utils/articleStructure'

interface Props {
  disease: string
  setDisease: (v: string) => void
  articleEntryType: ArticleEntryType
  setArticleEntryType: (v: ArticleEntryType) => void
  articleContent: string
  setArticleContent: (v: string) => void
  setArticleParseContent: (v: string) => void
  articleRichHtml: string
  setArticleRichHtml: (v: string) => void
  qaItems: QAItem[]
  setQaItems: (items: QAItem[]) => void
  referenceDocs: ReferenceDoc[]
  setReferenceDocs: (docs: ReferenceDoc[]) => void
  standardsOverride: StandardsOverride
  setStandardsOverride: (s: StandardsOverride) => void
  onNext: () => void
}

type ArticleTab = 'file' | 'text'

const ARTICLE_ENTRY_TYPE_OPTIONS: Array<{ value: ArticleEntryType; label: string; icon: string }> = [
  { value: 'disease', label: '疾病词条', icon: 'local_hospital' },
  { value: 'non_disease', label: '非疾病词条', icon: 'article' },
  { value: 'tumor', label: '肿瘤词条', icon: 'biotech' },
]

const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'OL', 'P', 'SECTION', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'UL'])
const INLINE_TAGS = new Set(['B', 'BR', 'EM', 'I', 'STRONG', 'SUP', 'SUB'])
const FIGURE_NOTE_CLASS = 'rich-editor-figure-note'
const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ',
}
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', i: 'ᵢ', o: 'ₒ', r: 'ᵣ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
  h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ',
}
interface NumberingState {
  sectionCounters: Record<number, number>
  orderedCounters: Record<string, number>
}

function scriptText(text: string, script: 'sup' | 'sub') {
  const compact = text.replace(/\s+/g, '')
  if (!compact) return ''
  const map = script === 'sup' ? SUPERSCRIPT_MAP : SUBSCRIPT_MAP
  const converted = Array.from(compact).map(char => map[char] ?? char).join('')
  if (converted !== compact) return converted
  return `${script === 'sup' ? '^' : '_'}(${compact})`
}

function isReferenceSupText(text: string) {
  return /^\d+(?:[,，\-~～至]\d+)*$/.test(text.replace(/\s+/g, ''))
}

function nearestTextBefore(node: Node) {
  let current: Node | null = node
  while (current) {
    let sibling = current.previousSibling
    while (sibling) {
      const text = sibling.textContent || ''
      if (text) return text
      sibling = sibling.previousSibling
    }
    current = current.parentNode
  }
  return ''
}

function nearestTextAfter(node: Node) {
  let current: Node | null = node
  while (current) {
    let sibling = current.nextSibling
    while (sibling) {
      const text = sibling.textContent || ''
      if (text) return text
      sibling = sibling.nextSibling
    }
    current = current.parentNode
  }
  return ''
}

function looksLikeReferenceSup(node: HTMLElement) {
  const compact = (node.textContent || '').replace(/\s+/g, '')
  if (!isReferenceSupText(compact)) return false

  const before = nearestTextBefore(node).trimEnd()
  const after = nearestTextAfter(node).trimStart()
  const prevChar = before ? before.charAt(before.length - 1) : ''
  const nextChar = after ? after.charAt(0) : ''

  // Keep scientific notation and units as visual superscripts, e.g. 10^9/L.
  if (prevChar && /[\d×*/+\-=]/.test(prevChar)) return false
  if (nextChar && /[A-Za-z0-9/]/.test(nextChar)) return false
  return true
}

function referenceSupText(node: HTMLElement) {
  return `[${(node.textContent || '').replace(/\s+/g, '')}]`
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

function keyPointCardType(node: HTMLElement) {
  if (!node.classList.contains('dxy-card')) return ''
  const text = cleanElementText(node).replace(/\s+/g, '')
  if (text.startsWith('诊断要点：') || text.startsWith('诊断要点:')) return 'diagnosis'
  if (text.startsWith('治疗要点：') || text.startsWith('治疗要点:')) return 'treatment'
  return ''
}

function hasClassPrefix(node: HTMLElement, prefix: string) {
  return Array.from(node.classList).some(name => name.startsWith(prefix))
}

function hasClassName(node: HTMLElement, name: string) {
  return Array.from(node.classList).includes(name)
}

function findDescendantWithClassPrefix(node: HTMLElement, prefix: string) {
  return Array.from(node.querySelectorAll('*')).find(
    (child): child is HTMLElement => child instanceof HTMLElement && hasClassPrefix(child, prefix),
  )
}

function findDescendantWithClassName(node: HTMLElement, name: string) {
  return Array.from(node.querySelectorAll('*')).find(
    (child): child is HTMLElement => child instanceof HTMLElement && hasClassName(child, name),
  )
}

function isSourceFieldModuleHeading(node: HTMLElement) {
  return hasClassPrefix(node, 'field-card-fieldName')
}

function isSourceFieldCard(node: HTMLElement) {
  return hasClassPrefix(node, 'field-card___')
}

function isSourceExpertModuleHeading(node: HTMLElement) {
  return hasClassPrefix(node, 'titleName___')
}

function splitTrailingNumberedHeading(text: string) {
  const match = text.trim().match(/^(.+[。；;：:])\s+(\d+[、.．]\s*\S.*)$/)
  if (!match) return null
  const heading = match[2].trim()
  if (heading.length > 36) return null
  return { body: match[1].trim(), heading }
}

function figureNoteToPlainText(text: string) {
  const clean = normalizeEditorText(text)
  if (!clean) return ''
  const split = splitTrailingNumberedHeading(clean)
  if (split) return `[图注] ${split.body}\n${split.heading}\n`
  return `[图注] ${clean}\n`
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
    if (tag === 'IMG') {
      const alt = node.getAttribute('alt') || node.getAttribute('title') || ''
      return `<p class="${FIGURE_NOTE_CLASS}">[图片]${alt ? ` ${escapeHtml(alt)}` : ''}</p>`
    }
    if (!children && tag !== 'BR') return ''
    if (tag === 'BR') return '<br>'
    const attrs = safeNumberingAttrs(node)
    const cardType = keyPointCardType(node)
    if (cardType) {
      return `<div class="rich-editor-keypoint-card" data-keypoint-card="${cardType}">${children}</div>`
    }
    if (node.classList.contains('rich-editor-module-heading')) {
      return `<p class="rich-editor-module-heading">${children}</p>`
    }
    if (isSourceExpertModuleHeading(node)) {
      const heading = node.querySelector('h1,h2,h3')
      const headingHtml = heading
        ? Array.from(heading.childNodes).map(walk).join('')
        : children
      return `<p class="rich-editor-expert-module-candidate">${headingHtml}</p>`
    }
    if (isSourceFieldCard(node)) {
      const fieldName = findDescendantWithClassPrefix(node, 'field-card-fieldName')
      const content = findDescendantWithClassName(node, 'ck-content')
      if (fieldName) {
        const headingHtml = `<p class="rich-editor-module-heading">${Array.from(fieldName.childNodes).map(walk).join('')}</p>`
        const contentHtml = content ? Array.from(content.childNodes).map(walk).join('') : ''
        return headingHtml + contentHtml
      }
    }
    if (isSourceFieldModuleHeading(node)) {
      return `<p class="rich-editor-module-heading">${children}</p>`
    }
    if (tag === 'FIGCAPTION') return `<p class="${FIGURE_NOTE_CLASS}">${children}</p>`
    if (tag === 'FIGURE') return `<div>${children}</div>`
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
        return escapeHtml(line)
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

function normalizeEntryTitleText(text: string) {
  return normalizeModuleHeading(text).replace(/[：:。；;，,]+$/g, '')
}

function entryDetailDisplayName(detail: EntryDetail, entry: EntrySearchItem) {
  const detailName = (detail.name || '').trim()
  if (detailName && detailName !== `词条-${detail.id}`) return detailName
  return entry.name.trim()
}

function isEntryTitleText(text: string, entryName: string) {
  const title = normalizeEntryTitleText(text)
  const name = normalizeEntryTitleText(entryName)
  return Boolean(title && name && title === name)
}

function stripLeadingEntryTitleFromText(text: string, entryName: string) {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized || !entryName.trim()) return normalized
  const lines = normalized.split('\n')
  const firstContentIndex = lines.findIndex(line => line.trim())
  if (firstContentIndex < 0) return normalized
  if (!isEntryTitleText(lines[firstContentIndex], entryName)) return normalized
  lines.splice(firstContentIndex, 1)
  return normalizeEditorText(lines.join('\n'))
}

function isModuleElement(node: Node) {
  if (!(node instanceof HTMLElement)) return false
  return node.classList.contains('rich-editor-module-heading')
}

function isIgnorableModuleBodyNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return !(node.textContent || '').trim()
  if (!(node instanceof HTMLElement)) return true
  if (node.matches('br')) return true
  if (node.matches('[data-keypoint-card]')) return true
  return !cleanElementText(node)
}

function removeEmptyModuleElements(editor: HTMLElement) {
  const nodes = Array.from(editor.childNodes)
  const removals: Node[] = []

  nodes.forEach((node, index) => {
    if (!isModuleElement(node)) return
    let cursor = index + 1
    while (cursor < nodes.length && !isModuleElement(nodes[cursor])) {
      cursor += 1
    }
    const body = nodes.slice(index + 1, cursor)
    if (body.every(isIgnorableModuleBodyNode)) {
      removals.push(node)
    }
  })

  removals.forEach(node => node.parentNode?.removeChild(node))
  return removals.length
}

function applyCuckooExpertReviewModules(editor: HTMLElement) {
  let convertedCount = 0
  editor.querySelectorAll('.rich-editor-expert-module-candidate').forEach(node => {
    if (!(node instanceof HTMLElement)) return
    const heading = cleanElementText(node)
    if (!heading) return
    node.innerHTML = escapeHtml(heading)
    node.classList.remove('rich-editor-expert-module-candidate')
    node.classList.add('rich-editor-module-heading')
    convertedCount += 1
  })
  return convertedCount
}

function resetNumberingForModule(state: NumberingState) {
  state.sectionCounters = {}
  state.orderedCounters = {}
}

function isModuleKeyPointHeading(line: string, moduleName: '诊断' | '治疗') {
  const normalized = line
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/^[#*\-—_\s]+|[#*\-—_\s]+$/g, '')
    .replace(/[：:]+$/, '')
  return normalized === `${moduleName}要点`
}

function keyPointHeadingFromLine(line: string) {
  const normalized = line
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/^[#*\-—_\s]+/, '')
  if (normalized.startsWith('诊断要点：') || normalized.startsWith('诊断要点:')) return '诊断'
  if (normalized.startsWith('治疗要点：') || normalized.startsWith('治疗要点:')) return '治疗'
  return ''
}

function isKeyPointDetailLine(line: string) {
  const text = line.trim()
  if (!text) return true
  return /^(?:\d+[、.)]|[（(]\d+[）)]|[a-zA-Z][、.)]|[①②③④⑤⑥⑦⑧⑨⑩])/.test(text)
}

function isStructuredContentHeading(line: string) {
  const text = line.trim()
  if (!text) return false
  return /^(?:[一二三四五六七八九十百]+、|[（(][一二三四五六七八九十百\d]+[）)]|\d+[、.])\S+/.test(text)
}

function isEntryFieldHeadingCandidate(node: HTMLElement) {
  if (!/^H[12]$/.test(node.tagName)) return false
  const text = cleanElementText(node)
  if (!text || text.length > 40) return false
  return !isStructuredContentHeading(text)
}

function replaceElementTag(element: HTMLElement, tagName: string) {
  const replacement = document.createElement(tagName)
  Array.from(element.attributes).forEach(attr => replacement.setAttribute(attr.name, attr.value))
  while (element.firstChild) replacement.appendChild(element.firstChild)
  element.replaceWith(replacement)
  return replacement
}

function normalizeEntryLibraryEditorHtml(html: string, entryName: string) {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const firstContentNode = Array.from(doc.body.childNodes).find(node => {
    return node instanceof HTMLElement ? cleanElementText(node) : Boolean((node.textContent || '').trim())
  })

  if (firstContentNode instanceof HTMLElement && isEntryTitleText(cleanElementText(firstContentNode), entryName)) {
    firstContentNode.remove()
  }

  doc.body.querySelectorAll('h1,h2').forEach(node => {
    if (!(node instanceof HTMLElement) || !isEntryFieldHeadingCandidate(node)) return
    const heading = replaceElementTag(node, 'p')
    heading.classList.add('rich-editor-module-heading')
  })

  return doc.body.innerHTML
}

function isKeyPointBlockBoundary(line: string) {
  return isStructuredContentHeading(line)
}

function removeKeyPointCardsFromEditor(editor: HTMLElement) {
  let removedCount = 0
  editor.querySelectorAll('[data-keypoint-card]').forEach(card => {
    card.remove()
    removedCount += 1
  })
  return removedCount
}

function directNodeText(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (!(node instanceof HTMLElement)) return ''
  return cleanElementText(node)
}

function isBlankEditorNode(node: Node) {
  return !directNodeText(node).trim()
}

function isKeyPointDomBoundary(node: Node) {
  if (isModuleElement(node)) return true
  const text = directNodeText(node)
  return isKeyPointBlockBoundary(text)
}

function removeDiagnosisTreatmentKeyPointsFromEditor(editor: HTMLElement) {
  const nodes = Array.from(editor.childNodes)
  const removals = new Set<Node>()
  let removedCount = 0

  const markKeyPointBodyForRemoval = (startIndex: number) => {
    let cursor = startIndex
    while (cursor < nodes.length && !isKeyPointDomBoundary(nodes[cursor])) {
      removals.add(nodes[cursor])
      cursor += 1
    }
    return cursor
  }

  for (let i = 0; i < nodes.length;) {
    const node = nodes[i]
    const text = directNodeText(node)

    if (keyPointHeadingFromLine(text)) {
      removals.add(node)
      removedCount += 1
      i = markKeyPointBodyForRemoval(i + 1)
      continue
    }

    const moduleName = normalizeModuleHeading(text)
    if (moduleName !== '诊断' && moduleName !== '治疗') {
      i += 1
      continue
    }

    let cursor = i + 1
    const whitespaceAfterModule: Node[] = []
    while (cursor < nodes.length && isBlankEditorNode(nodes[cursor])) {
      whitespaceAfterModule.push(nodes[cursor])
      cursor += 1
    }

    if (cursor >= nodes.length || !isModuleKeyPointHeading(directNodeText(nodes[cursor]), moduleName)) {
      i += 1
      continue
    }

    whitespaceAfterModule.forEach(n => removals.add(n))
    removals.add(nodes[cursor])
    removedCount += 1
    i = markKeyPointBodyForRemoval(cursor + 1)
  }

  removals.forEach(node => node.parentNode?.removeChild(node))
  return removedCount
}

function closestEditableBlock(node: Node | null, root: HTMLElement) {
  let current = node instanceof HTMLElement ? node : node?.parentElement
  while (current && current !== root) {
    if (/^(H1|H2|H3|H4|H5|H6|P|DIV|LI)$/i.test(current.tagName)) {
      return current
    }
    current = current.parentElement
  }
  return null
}

function closestModuleHeading(node: Node | null, root: HTMLElement) {
  let current = node instanceof HTMLElement ? node : node?.parentElement
  while (current && current !== root) {
    if (current.classList.contains('rich-editor-module-heading')) return current
    current = current.parentElement
  }
  return null
}

function placeCaretInside(element: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function isEmptyParagraph(node: HTMLElement | null) {
  if (!node || node.tagName !== 'P') return false
  return !cleanElementText(node)
}

function prepareBlockPasteInsertion(editor: HTMLElement, html: string) {
  if (!/<(?:div|h[1-6]|p|section|table|ul|ol)\b/i.test(html)) return
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const moduleHeading = closestModuleHeading(selection.anchorNode, editor)
  if (moduleHeading) {
    const range = document.createRange()
    range.setStartAfter(moduleHeading)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    return
  }

  const block = closestEditableBlock(selection.anchorNode, editor)
  if (!block || !isEmptyParagraph(block)) return

  const range = document.createRange()
  range.setStartBefore(block)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  block.remove()
}

function insertHtmlAtSelection(html: string) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  range.deleteContents()
  const fragment = range.createContextualFragment(html)
  const lastNode = fragment.lastChild
  range.insertNode(fragment)

  if (lastNode) {
    const nextRange = document.createRange()
    nextRange.setStartAfter(lastNode)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
  }
  return true
}

function nodeToPlainText(node: Node, state: NumberingState, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (!(node instanceof HTMLElement)) return ''

  const tag = node.tagName
  if (tag === 'BR') return '\n'
  if (tag === 'SUP' || tag === 'SUB') {
    if (tag === 'SUP' && looksLikeReferenceSup(node)) return referenceSupText(node)
    return scriptText(node.textContent || '', tag === 'SUP' ? 'sup' : 'sub')
  }

  const elementText = cleanElementText(node)
  if (node.classList.contains(FIGURE_NOTE_CLASS)) {
    return figureNoteToPlainText(elementText)
  }

  const sectionIndex = node.getAttribute('data-section-index')
  if (sectionIndex) {
    const level = Number(sectionIndex)
    if (!Number.isNaN(level) && elementText) {
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

function structuredLevelForElement(node: HTMLElement) {
  if (node.classList.contains('rich-editor-module-heading')) return 1

  const sectionIndex = node.getAttribute('data-section-index')
  if (sectionIndex && /^[123]$/.test(sectionIndex)) return Number(sectionIndex)

  if (node.tagName === 'H1') return 1
  if (node.tagName === 'H2') return 2
  if (node.tagName === 'H3') return 3
  return 0
}

function hasStructuredDescendant(node: HTMLElement) {
  return Boolean(node.querySelector('.rich-editor-module-heading,[data-section-index],h1,h2,h3'))
}

function nodeToStructuredText(node: Node, state: NumberingState, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (!(node instanceof HTMLElement)) return ''

  const tag = node.tagName
  if (tag === 'BR') return '\n'

  const explicitLevel = structuredLevelForElement(node)
  if (explicitLevel) {
    const plain = nodeToPlainText(node, state, listDepth).trim()
    if (plain) {
      if (explicitLevel === 1) resetNumberingForModule(state)
      return `[H${explicitLevel}] ${plain}\n`
    }
  }

  if (hasStructuredDescendant(node)) {
    return Array.from(node.childNodes).map(child => nodeToStructuredText(child, state, listDepth)).join('')
  }

  return nodeToPlainText(node, state, listDepth)
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

function editorToStructuredText(editor: HTMLElement) {
  const state: NumberingState = { sectionCounters: {}, orderedCounters: {} }
  const structured = normalizeEditorText(Array.from(editor.childNodes).map(node => nodeToStructuredText(node, state)).join(''))
  return articleContentToStructuredMarkers(structured.includes('[H1]') ? structured : editorToPlainText(editor))
}

function editorHtmlToPlainText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const state: NumberingState = { sectionCounters: {}, orderedCounters: {} }
  return normalizeEditorText(Array.from(doc.body.childNodes).map(node => nodeToPlainText(node, state)).join(''))
}

function editorHtmlToStructuredText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const state: NumberingState = { sectionCounters: {}, orderedCounters: {} }
  const structured = normalizeEditorText(Array.from(doc.body.childNodes).map(node => nodeToStructuredText(node, state)).join(''))
  return articleContentToStructuredMarkers(structured.includes('[H1]') ? structured : editorHtmlToPlainText(html))
}

function prependTextToElement(element: HTMLElement, text: string) {
  element.insertBefore(document.createTextNode(text), element.firstChild)
}

function resetNumberingIfModuleElement(element: HTMLElement, state: NumberingState) {
  if (
    isModuleElement(element) ||
    element.classList.contains('rich-editor-expert-module-candidate')
  ) {
    resetNumberingForModule(state)
  }
}

function recoverNumberingInEditorHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const state: NumberingState = { sectionCounters: {}, orderedCounters: {} }

  const walk = (node: Node) => {
    if (!(node instanceof HTMLElement)) return

    const sectionIndex = node.getAttribute('data-section-index')
    const orderedIndex = node.getAttribute('data-orderedlist-index')
    const elementText = cleanElementText(node)

    if (sectionIndex && elementText) {
      const level = Number(sectionIndex)
      if (!Number.isNaN(level)) {
        resetNumberingIfModuleElement(node, state)
        state.sectionCounters[level] = (state.sectionCounters[level] || 0) + 1
        Object.keys(state.sectionCounters).forEach(key => {
          if (Number(key) > level) state.sectionCounters[Number(key)] = 0
        })
        state.orderedCounters = {}
        prependTextToElement(node, `${sectionPrefix(level, state.sectionCounters[level])} `)
      }
      node.removeAttribute('data-section-index')
      return
    }

    if (orderedIndex && elementText) {
      Object.keys(state.orderedCounters).forEach(key => {
        if (Number(key) > Number(orderedIndex)) state.orderedCounters[key] = 0
      })
      state.orderedCounters[orderedIndex] = (state.orderedCounters[orderedIndex] || 0) + 1
      prependTextToElement(node, `${orderedPrefix(orderedIndex, state.orderedCounters[orderedIndex])} `)
      node.removeAttribute('data-orderedlist-index')
      return
    }

    resetNumberingIfModuleElement(node, state)
    Array.from(node.childNodes).forEach(walk)
  }

  Array.from(doc.body.childNodes).forEach(walk)
  return doc.body.innerHTML
}

function RichPasteEditor({
  value,
  richHtml,
  onChange,
  onStructuredChange,
  onRichHtmlChange,
}: {
  value: string
  richHtml: string
  onChange: (value: string) => void
  onStructuredChange: (value: string) => void
  onRichHtmlChange: (value: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [cuckooExpertMode, setCuckooExpertMode] = useState(false)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (document.activeElement === editor) return
    if (richHtml && editor.innerHTML !== richHtml) {
      editor.innerHTML = richHtml
      return
    }
    if (editorToPlainText(editor) !== normalizeEditorText(value)) {
      editor.innerHTML = textToEditorHtml(value)
    }
  }, [value, richHtml])

  const syncFromEditor = () => {
    const editor = editorRef.current
    if (!editor) return
    onChange(editorToPlainText(editor))
    onStructuredChange(editorToStructuredText(editor))
    onRichHtmlChange(editor.innerHTML)
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
      ? recoverNumberingInEditorHtml(safeHtml)
      : safeHtml || normalizeEditorText(plain)
    if (!insertable) return
    e.preventDefault()
    const editor = editorRef.current
    if (editor && safeHtml) prepareBlockPasteInsertion(editor, insertable)
    if (safeHtml) {
      insertHtmlAtSelection(insertable)
    } else {
      document.execCommand('insertText', false, insertable)
    }
    if (cuckooExpertMode && editorRef.current) {
      applyCuckooExpertReviewModules(editorRef.current)
    }
    syncFromEditor()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    const editor = editorRef.current
    if (!editor) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const moduleHeading = closestModuleHeading(selection.anchorNode, editor)
    if (!moduleHeading) return

    e.preventDefault()
    const paragraph = document.createElement('p')
    paragraph.appendChild(document.createElement('br'))
    moduleHeading.parentNode?.insertBefore(paragraph, moduleHeading.nextSibling)
    placeCaretInside(paragraph)
    syncFromEditor()
  }

  const clearFormatting = () => {
    const editor = editorRef.current
    if (!editor) return
    const text = editorToPlainText(editor)
    editor.innerHTML = textToEditorHtml(text)
    onChange(text)
    onRichHtmlChange(editor.innerHTML)
  }

  const removeEmptyModules = () => {
    const editor = editorRef.current
    if (!editor) return
    removeEmptyModuleElements(editor)
    onChange(editorToPlainText(editor))
    onStructuredChange(editorToStructuredText(editor))
    onRichHtmlChange(editor.innerHTML)
  }

  const removeDiagnosisTreatmentKeyPoints = () => {
    const editor = editorRef.current
    if (!editor) return
    const removedCards = removeKeyPointCardsFromEditor(editor)
    if (!removedCards) removeDiagnosisTreatmentKeyPointsFromEditor(editor)
    onChange(editorToPlainText(editor))
    onStructuredChange(editorToStructuredText(editor))
    onRichHtmlChange(editor.innerHTML)
  }

  const toggleCuckooExpertReview = () => {
    const editor = editorRef.current
    const nextMode = !cuckooExpertMode
    setCuckooExpertMode(nextMode)
    if (nextMode && editor) {
      applyCuckooExpertReviewModules(editor)
      onChange(editorToPlainText(editor))
      onStructuredChange(editorToStructuredText(editor))
      onRichHtmlChange(editor.innerHTML)
    }
  }

  const markSelectionAsModule = () => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const selectedText = selection.toString().trim()
    if (selectedText) {
      document.execCommand(
        'insertHTML',
        false,
        `<p><span class="rich-editor-module-heading">${escapeHtml(selectedText)}</span></p>`,
      )
    } else {
      const block = closestEditableBlock(selection.anchorNode, editor)
      if (block) {
        block.classList.add('rich-editor-module-heading')
      }
    }

    syncFromEditor()
  }

  const clearAll = () => {
    if (editorRef.current) editorRef.current.innerHTML = ''
    onChange('')
    onStructuredChange('')
    onRichHtmlChange('')
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
        <button
          type="button"
          className={`rich-editor-tool cuckoo ${cuckooExpertMode ? 'active' : ''}`}
          title={cuckooExpertMode ? '已启用布谷鸟专家审核模块识别' : '点击后按布谷鸟专家审核页面格式识别模块标题'}
          aria-pressed={cuckooExpertMode}
          onClick={toggleCuckooExpertReview}
        >
          <span className="rich-editor-tool-dot" aria-hidden="true" />
          布谷鸟专家审核
        </button>
        <button type="button" className="rich-editor-tool accent" title="将选中内容或当前行标记为模块标题" onClick={markSelectionAsModule}>标记模块</button>
        <button type="button" className="rich-editor-tool accent" title="删除没有正文内容的模块" onClick={removeEmptyModules}>删除空模块</button>
        <button type="button" className="rich-editor-tool accent" title="删除诊断/治疗模块开头的要点卡片" onClick={removeDiagnosisTreatmentKeyPoints}>删除要点</button>
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
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

export default function StepUpload({
  disease, setDisease, articleEntryType, setArticleEntryType,
  articleContent, setArticleContent, setArticleParseContent,
  articleRichHtml, setArticleRichHtml,
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
  const [entryPanelOpen, setEntryPanelOpen] = useState(false)
  const [entryKeyword, setEntryKeyword] = useState('')
  const [entryResults, setEntryResults] = useState<EntrySearchItem[]>([])
  const [entryLoading, setEntryLoading] = useState(false)
  const [entryDetailLoadingId, setEntryDetailLoadingId] = useState<number | null>(null)
  const [entryError, setEntryError] = useState('')
  const [guidePanelOpen, setGuidePanelOpen] = useState(false)
  const [guideKeyword, setGuideKeyword] = useState('')
  const [guideResults, setGuideResults] = useState<GuideSearchItem[]>([])
  const [guideLoading, setGuideLoading] = useState(false)
  const [guideDetailLoadingId, setGuideDetailLoadingId] = useState<number | null>(null)
  const [guideError, setGuideError] = useState('')
  const [viewingReference, setViewingReference] = useState<{ doc: ReferenceDoc; index: number } | null>(null)

  const articleInputRef = useRef<HTMLInputElement>(null)
  const qaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const qualityStdInputRef = useRef<HTMLInputElement>(null)
  const contentSpecInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!viewingReference) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewingReference(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewingReference])

  const loadFromFile = async (file: File) => {
    setArticleError('')
    setArticleUploading(true)
    setArticleProgress(0)
    try {
      const data = await chunkedUpload(file, 'article', {}, setArticleProgress)
      setArticleContent(data.content)
      setArticleParseContent('')
      setArticleRichHtml('')
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
    const allResults: ReferenceDoc[] = []
    const failedFiles: string[] = []
    const fileArr = Array.from(files)
    try {
      for (let fi = 0; fi < fileArr.length; fi++) {
        const f = fileArr[fi]
        try {
          const data = await chunkedUpload(f, 'pdf', { filenames: [f.name] }, (pct) => {
            // 多文件时计算整体进度：已完成的文件 + 当前文件进度
            const overall = Math.round(((fi + pct / 100) / fileArr.length) * 100)
            setPdfProgress(overall)
          })
          allResults.push(...(data as ReferenceDoc[]))
        } catch (e: any) {
          failedFiles.push(`${f.name}：${e.message || '解析失败'}`)
          setPdfProgress(Math.round(((fi + 1) / fileArr.length) * 100))
        }
      }
      if (allResults.length > 0) {
        setReferenceDocs([...referenceDocs, ...allResults])
      }
      if (failedFiles.length > 0) {
        setPdfError(`已跳过 ${failedFiles.length} 篇解析失败的参考数据源：${failedFiles.join('；')}`)
      }
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

  const runEntrySearch = async () => {
    const keyword = entryKeyword.trim()
    if (!keyword) {
      setEntryError('请输入词条名称')
      setEntryResults([])
      return
    }
    setEntryLoading(true)
    setEntryError('')
    try {
      const data = await searchEntries(keyword)
      setEntryResults(data.items)
      if (data.items.length === 0) {
        setEntryError('未检索到词条')
      }
    } catch (e: any) {
      setEntryResults([])
      setEntryError(e.message || '词条检索失败')
    } finally {
      setEntryLoading(false)
    }
  }

  const pasteEntryContent = async (entry: EntrySearchItem) => {
    setEntryDetailLoadingId(entry.id)
    setEntryError('')
    try {
      const detail = await fetchEntryDetail(entry.id)
      const entryName = entryDetailDisplayName(detail, entry)
      const content = detail.content || ''
      if (!content.trim()) {
        throw new Error('词条详情内容为空')
      }
      const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(content)
      const entryContent = looksLikeHtml ? content : stripLeadingEntryTitleFromText(content, entryName)
      const richHtml = looksLikeHtml ? htmlToSafeEditorHtml(entryContent) : textToEditorHtml(entryContent)
      const numberingRecoveredHtml = richHtml && hasRecoveredNumbering(richHtml)
        ? recoverNumberingInEditorHtml(richHtml)
        : richHtml
      const normalizedHtml = normalizeEntryLibraryEditorHtml(numberingRecoveredHtml, entryName)
      const plainText = editorHtmlToPlainText(normalizedHtml)
      setArticleContent(plainText)
      setArticleParseContent(editorHtmlToStructuredText(normalizedHtml))
      setArticleRichHtml(normalizedHtml)
      setDisease(entryName)
      setArticleTab('text')
    } catch (e: any) {
      setEntryError(e.message || '词条详情获取失败')
    } finally {
      setEntryDetailLoadingId(null)
    }
  }

  const runGuideSearch = async () => {
    const keyword = guideKeyword.trim()
    if (!keyword) {
      setGuideError('请输入指南名称')
      setGuideResults([])
      return
    }
    setGuideLoading(true)
    setGuideError('')
    try {
      const data = await searchGuides(keyword)
      setGuideResults(data.items)
      if (data.items.length === 0) {
        setGuideError('未检索到指南')
      }
    } catch (e: any) {
      setGuideResults([])
      setGuideError(e.message || '指南检索失败')
    } finally {
      setGuideLoading(false)
    }
  }

  const addGuideSource = async (guide: GuideSearchItem) => {
    setGuideDetailLoadingId(guide.id)
    setGuideError('')
    try {
      const detail = await fetchGuideDetail(guide.id)
      const detailTitle = detail.title?.trim()
      const fallbackTitle = `指南-${guide.id}`
      const doc = guideDetailToReferenceDoc({
        ...detail,
        title: detailTitle && detailTitle !== fallbackTitle ? detailTitle : guide.title,
      })
      setReferenceDocs([...referenceDocs, doc])
    } catch (e: any) {
      setGuideError(e.message || '指南详情获取失败')
    } finally {
      setGuideDetailLoadingId(null)
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
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 8 }}>
                词条类型
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {ARTICLE_ENTRY_TYPE_OPTIONS.map(option => {
                  const active = articleEntryType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setArticleEntryType(option.value)}
                      style={{
                        border: `1px solid ${active ? 'var(--m3-primary)' : 'var(--dui-divider)'}`,
                        background: active ? 'var(--dui-primary-container)' : 'var(--m3-surface-container-lowest)',
                        color: active ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                        borderRadius: 12,
                        padding: '10px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 19 }}>{option.icon}</span>
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
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
                  若不上传，系统会按当前词条类型使用对应的内置质量审评标准和内容要求规范。
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
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '0.5px solid var(--dui-divider)', alignItems: 'center' }}>
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
              <button
                type="button"
                className="btn-m3-outline"
                style={{ marginLeft: 'auto', marginBottom: 6, fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => {
                  setEntryPanelOpen(!entryPanelOpen)
                  setEntryError('')
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>database_search</span>
                词条库粘贴
              </button>
            </div>

            {entryPanelOpen && (
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, border: '0.5px solid var(--dui-divider)', background: 'var(--m3-surface-container-low)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="m3-input"
                    value={entryKeyword}
                    placeholder="输入词条名称"
                    onChange={e => setEntryKeyword(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') runEntrySearch()
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-m3-outline"
                    disabled={entryLoading}
                    onClick={runEntrySearch}
                    style={{ minWidth: 72 }}
                  >
                    {entryLoading ? '检索中' : '检索'}
                  </button>
                </div>
                {entryError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--m3-error)' }}>
                    {entryError}
                  </div>
                )}
                {entryResults.length > 0 && (
                  <div style={{ marginTop: 10, border: '0.5px solid var(--dui-divider)', borderRadius: 8, overflow: 'hidden', background: 'var(--dui-surface)' }}>
                    {entryResults.map((entry, index) => (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderTop: index === 0 ? 'none' : '0.5px solid var(--dui-divider)',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-primary)' }}>article</span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--m3-on-surface)', overflowWrap: 'anywhere' }}>
                          {entry.name}
                        </div>
                        <button
                          type="button"
                          className="btn-m3-outline"
                          disabled={entryDetailLoadingId !== null}
                          onClick={() => pasteEntryContent(entry)}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          {entryDetailLoadingId === entry.id ? '粘贴中' : '粘贴'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
              <RichPasteEditor
                value={articleContent}
                richHtml={articleRichHtml}
                onChange={setArticleContent}
                onStructuredChange={setArticleParseContent}
                onRichHtmlChange={setArticleRichHtml}
              />
            )}

            {articleContent && articleTab !== 'text' && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--dui-success-container)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--m3-tertiary)', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>check_circle</span>
                  已加载词条内容（{articleContent.length} 字符）
                </span>
                <button
                  className="btn-m3-outline"
                  style={{ fontSize: 12, padding: '4px 12px', color: 'var(--m3-error)' }}
                  onClick={() => {
                    setArticleContent('')
                    setArticleParseContent('')
                    setArticleRichHtml('')
                  }}
                >
                  清除
                </button>
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

          {/* Reference data sources */}
          <div className="section-card">
            <div className="reference-source-head">
              <div className="reference-source-title">
                <span className="reference-source-title-icon material-symbols-outlined">menu_book</span>
                <div>
                  <div className="reference-source-title-row">
                    <span>参考数据源</span>
                    <span className="reference-source-optional">可选</span>
                  </div>
                  <p>上传本地文件，或从指南数据库检索后追加为参考资料</p>
                </div>
              </div>
            </div>

            <div className="reference-source-action-row">
              <button
                type="button"
                className={`guide-library-toggle ${guidePanelOpen ? 'active' : ''}`}
                onClick={() => {
                  setGuidePanelOpen(!guidePanelOpen)
                  setGuideError('')
                }}
              >
                <span className="material-symbols-outlined">database_search</span>
                对接指南数据库
              </button>
              <div className="reference-source-upload-note">
                <span className="material-symbols-outlined">upload_file</span>
                <div>
                  <strong>本地参考文件</strong>
                  <span>PDF/Word 将完整解析；后续环节按场景截取或筛选使用</span>
                </div>
              </div>
            </div>

            {guidePanelOpen && (
              <div className="guide-library-panel">
                <div className="guide-library-visual" aria-hidden="true">
                  <span className="material-symbols-outlined">auto_stories</span>
                  <div className="guide-library-bars">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="guide-library-content">
                  <div className="guide-library-kicker">
                    <span className="material-symbols-outlined">verified</span>
                    线上指南库
                  </div>
                  <div className="guide-library-search">
                    <span className="material-symbols-outlined">search</span>
                    <input
                      value={guideKeyword}
                      placeholder="输入指南名称，请尽可能准确、完整输入"
                      onChange={e => setGuideKeyword(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') runGuideSearch()
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="guide-library-search-btn"
                    disabled={guideLoading}
                    onClick={runGuideSearch}
                  >
                    <span className="material-symbols-outlined">{guideLoading ? 'hourglass_top' : 'travel_explore'}</span>
                    {guideLoading ? '检索中' : '检索'}
                  </button>
                  {guideError && (
                    <div className="guide-library-error">
                      <span className="material-symbols-outlined">error</span>
                      <span>{guideError}</span>
                    </div>
                  )}
                  {guideResults.length > 0 && (
                    <div className="guide-library-results">
                      <div className="guide-library-results-head">
                        <span>{guideResults.length} 条匹配指南</span>
                        <span>选择后将加入参考数据源</span>
                      </div>
                      {guideResults.map((guide, index) => (
                        <div className="guide-library-result" key={guide.id}>
                          <div className="guide-library-result-rank">{String(index + 1).padStart(2, '0')}</div>
                          <span className="guide-library-result-icon material-symbols-outlined">article</span>
                          <div className="guide-library-result-title">
                            {guide.title}
                          </div>
                          <button
                            type="button"
                            className="guide-library-add-btn"
                            disabled={guideDetailLoadingId !== null}
                            onClick={() => addGuideSource(guide)}
                          >
                            <span className="material-symbols-outlined">{guideDetailLoadingId === guide.id ? 'hourglass_top' : 'add'}</span>
                            {guideDetailLoadingId === guide.id ? '添加中' : '添加'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!guideError && guideResults.length === 0 && (
                    <div className="guide-library-empty">
                      <span className="material-symbols-outlined">tips_and_updates</span>
                      支持按指南标题关键词检索
                    </div>
                  )}
                </div>
              </div>
            )}

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
                <span style={{ fontSize: 12, color: 'var(--m3-outline)' }}>.pdf .doc .docx .html</span>
                <input ref={pdfInputRef} type="file" accept=".pdf,.doc,.docx,.html,.htm" multiple style={{ display: 'none' }} onChange={e => {
                  if (e.target.files?.length) loadPdfFiles(e.target.files)
                }} />
              </div>

              {/* Existing docs */}
              {referenceDocs.map((doc, i) => (
                <div key={i} className="pdf-item-card reference-source-card" title={doc.filename}>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`确定删除参考数据源「${doc.filename}」吗？`)) {
                        setReferenceDocs(referenceDocs.filter((_, j) => j !== i))
                      }
                    }}
                    className="pdf-item-delete reference-source-delete"
                    title={`删除参考数据源：${doc.filename}`}
                    aria-label={`删除参考数据源：${doc.filename}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--m3-error)' }}>close</span>
                  </button>
                  <div className="reference-source-main">
                    <span className="material-symbols-outlined" style={{ fontSize: 28, flexShrink: 0, color: doc.filename.toLowerCase().endsWith('.pdf') ? 'var(--dui-danger)' : 'var(--dui-primary)' }}>
                      {doc.filename.toLowerCase().endsWith('.pdf')
                        ? 'picture_as_pdf'
                        : (doc.filename.toLowerCase().endsWith('.doc') || doc.filename.toLowerCase().endsWith('.docx')) ? 'description' : 'language'}
                    </span>
                    <div className="reference-source-text">
                      <div className="reference-source-index">参考数据源 {i + 1}</div>
                      <div className="reference-source-name" title={doc.filename}>{doc.filename}</div>
                    </div>
                  </div>
                  <div className="reference-source-meta">
                    {doc.char_count.toLocaleString()} 字符
                  </div>
                  <div style={{ paddingLeft: 38 }}>
                    <button
                      type="button"
                      className="btn-m3-outline"
                      onClick={() => setViewingReference({ doc, index: i })}
                      style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>visibility</span>
                      查看全文
                    </button>
                  </div>
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

      {viewingReference && (
        <div className="modal-overlay" onClick={() => setViewingReference(null)}>
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(1000px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 48px)',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--m3-outline-variant)' }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--m3-on-surface)' }}>
                  参考数据源 {viewingReference.index + 1}
                </h3>
                <div style={{ marginTop: 5, fontSize: 12, color: 'var(--m3-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {viewingReference.doc.filename} · {viewingReference.doc.char_count.toLocaleString()} 字符
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingReference(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                title="关闭"
                aria-label="关闭全文查看"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--m3-on-surface-variant)' }}>close</span>
              </button>
            </div>
            <div style={{ padding: 20, overflow: 'auto', minHeight: 320 }}>
              <pre style={{ margin: 0, padding: 14, borderRadius: 8, background: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{viewingReference.doc.text.trim() || '暂无可查看的解析文本'}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
