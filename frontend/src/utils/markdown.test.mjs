import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { markdownRemarkPlugins } from './markdown.ts'

const html = renderToStaticMarkup(
  React.createElement(
    ReactMarkdown,
    { remarkPlugins: markdownRemarkPlugins },
    '静脉注射可在1~3 min起效，持续30~60 min。',
  ),
)

assert.equal(html.includes('<del>'), false)
assert.match(html, /1~3 min/)
assert.match(html, /30~60 min/)

console.log('markdown tests passed')
