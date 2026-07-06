type NumberingPrefix =
  | { kind: 'chinese-section'; value: string }
  | { kind: 'parenthesized'; value: string }
  | { kind: 'arabic'; value: string }
  | { kind: 'alpha'; value: string }
  | { kind: 'roman'; value: string }

const CHINESE_NUMERAL_PATTERN = '[零一二三四五六七八九十百千万]+'

function normalizeNumberingSource(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .trimStart()
}

function parseLeadingNumberingPrefix(text: string): NumberingPrefix | null {
  const source = normalizeNumberingSource(text)

  let match = source.match(new RegExp(`^\\((${CHINESE_NUMERAL_PATTERN}|\\d+)\\)\\s*`))
  if (match) return { kind: 'parenthesized', value: match[1] }

  match = source.match(new RegExp(`^(${CHINESE_NUMERAL_PATTERN})[、.．]\\s*`))
  if (match) return { kind: 'chinese-section', value: match[1] }

  match = source.match(/^(\d+)(?:[、)]\s*|[.．](?!\d)\s*)/)
  if (match) return { kind: 'arabic', value: match[1] }

  match = source.match(/^([a-zA-Z])(?:[、)]\s*|[.．](?!\d)\s*)/)
  if (match) return { kind: 'alpha', value: match[1].toLowerCase() }

  match = source.match(/^([IVXLCDM]+)(?:[、)]\s*|[.．](?!\d)\s*)/i)
  if (match) return { kind: 'roman', value: match[1].toUpperCase() }

  return null
}

export function shouldPrependRecoveredNumbering(elementText: string, prefix: string) {
  const current = parseLeadingNumberingPrefix(elementText)
  const recovered = parseLeadingNumberingPrefix(prefix)
  if (!current || !recovered) return true
  return false
}
