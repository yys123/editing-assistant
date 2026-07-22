import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile('src/components/AdminSettingsModal.tsx', 'utf8')
const cssSource = await readFile('src/index.css', 'utf8')

assert.match(
  source,
  /\/api\/admin\/ai-integration-citation-stats/,
  'admin settings should load AI integration citation statistics from the admin endpoint',
)
assert.match(
  source,
  /AI整合引用统计/,
  'admin settings should render an AI integration citation statistics section',
)
assert.match(
  source,
  /confirmed_issue_ratio/,
  'admin citation statistics should display the confirmed-problem ratio',
)
assert.match(
  source,
  /confirmed_ok_ratio/,
  'admin citation statistics should display the confirmed-ok ratio',
)
assert.match(
  source,
  /unconfirmed_ratio/,
  'admin citation statistics should display the unconfirmed ratio',
)
assert.match(
  source,
  /summary_mode\s*===\s*'total_ratio'/,
  'admin citation statistics should support total-ratio-only rows',
)
assert.match(
  source,
  /占参考文献总数/,
  'auto-deleted mismatch citations should show their share of all citations',
)
assert.match(
  source,
  /auto_deleted_citation_ratio/,
  'admin citation statistics should expose the total auto-deleted citation ratio',
)
assert.match(
  source,
  /自动删除比例/,
  'admin citation statistics should show the auto-deleted ratio in the metric summary',
)
assert.match(
  cssSource,
  /\.admin-citation-stat-row/,
  'admin citation statistic rows should have dedicated CSS',
)

console.log('AdminSettingsModal tests passed')
