# AI Integration Source Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI integration “compare original” view that defaults to clean revised text and shows only the changed original/revised passages with right-side change markup.

**Architecture:** Extend the backend AI integration response with a parseable `revision_text` contract, then store that field in AI integration history records. Add a focused frontend diff utility that maps large original snapshots to only changed revised blocks, and wire it into `StepAiIntegration` with a clean/diff view toggle.

**Tech Stack:** FastAPI/Pydantic backend, Python `unittest`, React 18, TypeScript, ReactMarkdown, Node `--experimental-strip-types` utility tests, Vite build.

---

## File Structure

- Modify `backend/models.py`: add response fields `revision_text` and `change_summary`.
- Modify `backend/services/generator.py`: add AI integration output parsing helpers, require a `修订后正文` output section, rewrite citations in both full answer and revision text.
- Modify `backend/tests/test_ai_integration.py`: add parser/output contract tests and update existing expectations for the new optional fields.
- Modify `frontend/src/types/index.ts`: add `revisionText` and `changeSummary` to `AiIntegrationRecord`.
- Create `frontend/src/utils/aiIntegrationDiff.ts`: pure block matching and token diff logic.
- Create `frontend/src/utils/aiIntegrationDiff.test.mjs`: tests for changed-only blocks, inserts, replacements, no-diff behavior, and low-confidence handling.
- Modify `frontend/src/components/StepAiIntegration.tsx`: save new fields, render clean revised text by default, add compare toggle and diff view.
- Modify `frontend/src/index.css`: styles for the two-column diff view and mobile stacking.

---

### Task 1: Backend Response Contract

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/services/generator.py`
- Test: `backend/tests/test_ai_integration.py`

- [ ] **Step 1: Write failing backend tests for structured revision output**

Add tests to `backend/tests/test_ai_integration.py`:

```py
async def test_ai_integration_extracts_revision_text_and_change_summary(self):
    async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
        self.assertIn("## 修订后正文", prompt)
        self.assertIn("修订后正文应是可直接粘贴到词条中的清洁文本", prompt)
        return (
            "## 修订后正文\n"
            "急性中毒患者约占同期急诊患者的2.7%~3.6%[1]。\n\n"
            "## 修改说明\n"
            "- 补充国内急诊占比数据。\n"
            "- 保留原有疾病负担描述。"
        )

    req = AiIntegrationRequest(
        disease="急性中毒",
        user_request="补充流行病学数据",
        original_content="急性中毒是常见急症。",
        reference_inputs=[
            ReferenceInput(
                id=1,
                filename="急性中毒指南.pdf",
                text="急性中毒患者约占同期急诊患者的2.7%~3.6%。",
            ),
        ],
    )

    result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

    self.assertIn("## 修订后正文", result.answer)
    self.assertEqual(result.revision_text, "急性中毒患者约占同期急诊患者的2.7%~3.6%[1]。")
    self.assertEqual(result.change_summary, ["补充国内急诊占比数据。", "保留原有疾病负担描述。"])
```

Add a backward compatibility test:

```py
async def test_ai_integration_keeps_plain_answer_when_revision_section_missing(self):
    async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
        return "仅基于问题回答。"

    result = await generate_ai_integration_answer(
        AiIntegrationRequest(disease="克罗恩病", user_request="帮我拟一个章节提纲"),
        text_generator=fake_generate_text,
    )

    self.assertEqual(result.answer, "仅基于问题回答。")
    self.assertEqual(result.revision_text, "")
    self.assertEqual(result.change_summary, [])
```

- [ ] **Step 2: Run backend tests to verify they fail**

Run: `cd backend && python3 -m unittest tests.test_ai_integration -v`

Expected: FAIL because `AiIntegrationResponse` does not expose `revision_text` or `change_summary`, and the prompt does not yet contain the new output contract.

- [ ] **Step 3: Extend Pydantic response model**

In `backend/models.py`, update `AiIntegrationResponse`:

```py
class AiIntegrationResponse(BaseModel):
    answer: str
    revision_text: str = ""
    change_summary: List[str] = []
    references_used: List[str] = []
    reference_anchors: List[ReferenceAnchor] = []
```

- [ ] **Step 4: Add parser helpers in `backend/services/generator.py`**

Add helpers near the AI integration functions:

```py
def _strip_markdown_fence(text: str) -> str:
    value = (text or "").strip()
    if value.startswith("```"):
        value = re.sub(r"^```(?:json|markdown|md)?\s*", "", value, flags=re.IGNORECASE)
        value = re.sub(r"\s*```$", "", value)
    return value.strip()


def _parse_bullet_summary(text: str) -> list[str]:
    items = []
    for line in (text or "").splitlines():
        item = re.sub(r"^\s*[-*]\s+", "", line).strip()
        if item:
            items.append(item)
    return items


def _parse_ai_integration_output(raw_answer: str) -> tuple[str, str, list[str]]:
    answer = (raw_answer or "").strip()
    stripped = _strip_markdown_fence(answer)
    try:
        parsed = json.loads(stripped)
        revision = str(parsed.get("revision_text") or parsed.get("修订后正文") or "").strip()
        summary_value = parsed.get("change_summary") or parsed.get("修改说明") or []
        if isinstance(summary_value, str):
            summary = _parse_bullet_summary(summary_value)
        elif isinstance(summary_value, list):
            summary = [str(item).strip() for item in summary_value if str(item).strip()]
        else:
            summary = []
        return answer, revision, summary
    except Exception:
        pass

    revision_match = re.search(
        r"(?ims)^##\s*修订后正文\s*\n(?P<body>.*?)(?=^##\s+|\Z)",
        answer,
    )
    summary_match = re.search(
        r"(?ims)^##\s*修改说明\s*\n(?P<body>.*?)(?=^##\s+|\Z)",
        answer,
    )
    revision = revision_match.group("body").strip() if revision_match else ""
    summary = _parse_bullet_summary(summary_match.group("body")) if summary_match else []
    return answer, revision, summary
```

- [ ] **Step 5: Add a reusable citation rewrite helper**

In `backend/services/generator.py`, extract the existing citation rewrite sequence into a helper:

```py
def _rewrite_ai_integration_citations(
    text: str,
    reference_chunks: list,
    original_anchors: list,
    reference_anchors: list,
    reference_source_ids: set[int],
) -> str:
    rewritten = _rewrite_internal_chunk_citations((text or "").strip(), reference_chunks)
    rewritten = _rewrite_original_content_citations(
        rewritten,
        original_anchors,
        reference_source_ids,
        {anchor.citation_key for anchor in reference_anchors if anchor.source_id != 0},
    )
    return _rewrite_source_only_citations_to_source_refs(
        rewritten,
        [anchor for anchor in reference_anchors if anchor.source_id != 0],
    )
```

If Python typing complains about anonymous `list`, omit detailed parameter annotations and keep the function local/simple.

- [ ] **Step 6: Update the AI integration prompt contract**

In `generate_ai_integration_answer`, append output format requirements under `## 回答要求`:

```text
- 必须包含“## 修订后正文”区块，区块内只放可直接粘贴到词条中的清洁修订正文。
- 不要把修改说明、证据不足提示、待确认事项混入“修订后正文”。
- 必须包含“## 修改说明”区块，用 Markdown 无序列表简要说明本次修改了哪些内容。
```

- [ ] **Step 7: Parse and return new fields**

Replace the final rewrite block in `generate_ai_integration_answer`:

```py
parsed_answer, revision_text, change_summary = _parse_ai_integration_output(answer)
reference_source_ids = {ref.id for ref in req.reference_inputs}

rewritten_answer = _rewrite_ai_integration_citations(
    parsed_answer,
    reference_chunks,
    original_anchors,
    reference_anchors,
    reference_source_ids,
)
rewritten_revision_text = _rewrite_ai_integration_citations(
    revision_text,
    reference_chunks,
    original_anchors,
    reference_anchors,
    reference_source_ids,
) if revision_text else ""

return AiIntegrationResponse(
    answer=rewritten_answer,
    revision_text=rewritten_revision_text,
    change_summary=change_summary,
    references_used=references_used,
    reference_anchors=reference_anchors,
)
```

- [ ] **Step 8: Run backend tests**

Run: `cd backend && python3 -m unittest tests.test_ai_integration -v`

Expected: PASS.

- [ ] **Step 9: Commit backend contract**

```bash
git add backend/models.py backend/services/generator.py backend/tests/test_ai_integration.py
git commit -m "feat: return ai integration revision text"
```

---

### Task 2: Frontend History Data Wiring

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/StepAiIntegration.tsx`

- [ ] **Step 1: Extend frontend history type**

In `frontend/src/types/index.ts`, add:

```ts
revisionText?: string
changeSummary?: string[]
```

to `AiIntegrationRecord` immediately after `answer`.

- [ ] **Step 2: Save backend response fields**

In `frontend/src/components/StepAiIntegration.tsx`, update record creation in `runIntegration`:

```ts
const record: AiIntegrationRecord = {
  id: `ai-integration-${Date.now()}`,
  request,
  answer: data.answer || '',
  revisionText: data.revision_text || '',
  changeSummary: Array.isArray(data.change_summary) ? data.change_summary : [],
  referencesUsed: data.references_used || [],
  // existing fields...
}
```

- [ ] **Step 3: Prefer clean revision text for default rendering**

Add a memo near `renderedAnswer`:

```ts
const activeDisplayText = activeRecord?.revisionText?.trim() || activeRecord?.answer || ''
const renderedAnswer = useMemo(
  () => activeRecord ? linkifyCitationMarkers(activeDisplayText, resolveCitation) : '',
  [activeDisplayText, activeRecord, resolveCitation],
)
```

Keep `answer` in records for full output and citation fallback behavior.

- [ ] **Step 4: Run TypeScript build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit frontend data wiring**

```bash
git add frontend/src/types/index.ts frontend/src/components/StepAiIntegration.tsx
git commit -m "feat: store ai integration revision text"
```

---

### Task 3: Frontend Diff Utility

**Files:**
- Create: `frontend/src/utils/aiIntegrationDiff.ts`
- Test: `frontend/src/utils/aiIntegrationDiff.test.mjs`

- [ ] **Step 1: Write failing utility tests**

Create `frontend/src/utils/aiIntegrationDiff.test.mjs`:

```js
import assert from 'node:assert/strict'
import { buildAiIntegrationDiff } from './aiIntegrationDiff.ts'

const original = [
  '## 流行病学',
  '急性中毒是常见急症，疾病负担较重。',
  '',
  '## 治疗',
  '治疗应根据毒物类型和患者状态选择。',
].join('\n')

const revised = [
  '## 流行病学',
  '急性中毒是常见急症，患者约占同期急诊患者的2.7%~3.6%，疾病负担较重。',
].join('\n')

const diff = buildAiIntegrationDiff(original, revised)

assert.equal(diff.blocks.length, 1)
assert.equal(diff.blocks[0].heading, '流行病学')
assert.match(diff.blocks[0].originalText, /急性中毒是常见急症/)
assert.match(diff.blocks[0].revisedText, /2.7%~3.6%/)
assert.ok(diff.blocks[0].revisedTokens.some(token => token.type === 'insert' && token.text.includes('2.7%')))

const unchanged = buildAiIntegrationDiff('## 诊断\n内容相同。', '## 诊断\n内容相同。')
assert.equal(unchanged.blocks.length, 0)

const inserted = buildAiIntegrationDiff('', '## 随访\n新增随访建议。')
assert.equal(inserted.blocks.length, 1)
assert.equal(inserted.blocks[0].matchType, 'insert')
assert.equal(inserted.blocks[0].originalText, '')

const lowConfidence = buildAiIntegrationDiff('## 诊断\n诊断依据。', '## 治疗\n治疗方案完全不同。')
assert.equal(lowConfidence.blocks.length, 1)
assert.equal(lowConfidence.blocks[0].matchType, 'insert')

console.log('ai integration diff tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --experimental-strip-types src/utils/aiIntegrationDiff.test.mjs`

Expected: FAIL because `aiIntegrationDiff.ts` does not exist.

- [ ] **Step 3: Implement diff types and block splitting**

Create `frontend/src/utils/aiIntegrationDiff.ts`:

```ts
export type DiffTokenType = 'equal' | 'insert' | 'delete'
export type AiIntegrationDiffMatchType = 'matched' | 'insert'

export interface DiffToken {
  text: string
  type: DiffTokenType
}

export interface AiIntegrationDiffBlock {
  id: string
  heading?: string
  originalText: string
  revisedText: string
  originalTokens: DiffToken[]
  revisedTokens: DiffToken[]
  similarity: number
  matchType: AiIntegrationDiffMatchType
}

export interface AiIntegrationDiffResult {
  blocks: AiIntegrationDiffBlock[]
}
```

Implement helpers in the same file:

```ts
type TextBlock = {
  id: string
  heading?: string
  text: string
  searchable: string
}

function normalizeText(text: string) {
  return (text || '').replace(/\s+/g, '').toLowerCase()
}

function splitBlocks(text: string): TextBlock[] {
  const lines = (text || '').split(/\r?\n/)
  const blocks: TextBlock[] = []
  let heading = ''
  let buffer: string[] = []
  let index = 0

  const flush = () => {
    const body = buffer.join('\n').trim()
    if (body) {
      blocks.push({
        id: `b${index++}`,
        heading: heading || undefined,
        text: body,
        searchable: normalizeText(`${heading}\n${body}`),
      })
    }
    buffer = []
  }

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/)
    if (headingMatch) {
      flush()
      heading = headingMatch[1].trim()
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    buffer.push(line)
  }
  flush()
  return blocks
}
```

- [ ] **Step 4: Implement similarity and token diff**

Use a simple character n-gram Dice score for block matching and LCS for token markup:

```ts
function bigrams(value: string) {
  const text = normalizeText(value)
  if (text.length <= 1) return text ? [text] : []
  const grams: string[] = []
  for (let i = 0; i < text.length - 1; i += 1) grams.push(text.slice(i, i + 2))
  return grams
}

function similarity(a: string, b: string) {
  const left = bigrams(a)
  const right = bigrams(b)
  if (left.length === 0 || right.length === 0) return 0
  const counts = new Map<string, number>()
  for (const item of left) counts.set(item, (counts.get(item) ?? 0) + 1)
  let overlap = 0
  for (const item of right) {
    const count = counts.get(item) ?? 0
    if (count > 0) {
      overlap += 1
      counts.set(item, count - 1)
    }
  }
  return (2 * overlap) / (left.length + right.length)
}

function tokenize(text: string) {
  return (text || '').match(/[\u4e00-\u9fff]|[A-Za-z0-9.%~+-]+|\s+|[^\s]/g) ?? []
}
```

Then implement `diffTokens(original, revised)` with a standard dynamic-programming LCS. Return separate `originalTokens` and `revisedTokens` arrays where deletions appear in `originalTokens` and insertions appear in `revisedTokens`.

- [ ] **Step 5: Implement `buildAiIntegrationDiff`**

```ts
export function buildAiIntegrationDiff(originalText: string, revisionText: string): AiIntegrationDiffResult {
  const originalBlocks = splitBlocks(originalText)
  const revisedBlocks = splitBlocks(revisionText)
  const usedOriginalIds = new Set<string>()
  const blocks: AiIntegrationDiffBlock[] = []

  revisedBlocks.forEach((revisedBlock, index) => {
    const candidates = originalBlocks
      .filter(block => !usedOriginalIds.has(block.id))
      .map(block => ({
        block,
        score: similarity(block.searchable, revisedBlock.searchable),
      }))
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    const sameHeadingBonus = best?.block.heading && best.block.heading === revisedBlock.heading ? 0.08 : 0
    const score = best ? Math.min(1, best.score + sameHeadingBonus) : 0

    if (!best || score < 0.28) {
      blocks.push({
        id: `diff-${index}`,
        heading: revisedBlock.heading,
        originalText: '',
        revisedText: revisedBlock.text,
        originalTokens: [],
        revisedTokens: [{ text: revisedBlock.text, type: 'insert' }],
        similarity: score,
        matchType: 'insert',
      })
      return
    }

    usedOriginalIds.add(best.block.id)
    const tokenDiff = diffTokens(best.block.text, revisedBlock.text)
    const changed = tokenDiff.originalTokens.some(token => token.type === 'delete')
      || tokenDiff.revisedTokens.some(token => token.type === 'insert')
    if (!changed) return

    blocks.push({
      id: `diff-${index}`,
      heading: revisedBlock.heading || best.block.heading,
      originalText: best.block.text,
      revisedText: revisedBlock.text,
      originalTokens: tokenDiff.originalTokens,
      revisedTokens: tokenDiff.revisedTokens,
      similarity: score,
      matchType: 'matched',
    })
  })

  return { blocks }
}
```

- [ ] **Step 6: Run utility test**

Run: `cd frontend && node --experimental-strip-types src/utils/aiIntegrationDiff.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit diff utility**

```bash
git add frontend/src/utils/aiIntegrationDiff.ts frontend/src/utils/aiIntegrationDiff.test.mjs
git commit -m "feat: add ai integration diff utility"
```

---

### Task 4: Diff View UI

**Files:**
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/utils/aiIntegrationDiff.test.mjs`

- [ ] **Step 1: Import the diff utility**

In `frontend/src/components/StepAiIntegration.tsx`:

```ts
import { buildAiIntegrationDiff, type DiffToken } from '../utils/aiIntegrationDiff'
```

- [ ] **Step 2: Add compare state**

Inside `StepAiIntegration`:

```ts
const [compareRecordId, setCompareRecordId] = useState<string | null>(null)
```

Add helper:

```ts
const toggleCompareRecord = (id: string) => {
  setCompareRecordId(prev => prev === id ? null : id)
}
```

Reset compare state when deleting a record:

```ts
setCompareRecordId(prev => prev === id ? null : prev)
```

- [ ] **Step 3: Add token rendering helper**

Near `AiCitationPanel`, add:

```tsx
function DiffTokenList({ tokens, side }: { tokens: DiffToken[]; side: 'original' | 'revised' }) {
  return (
    <>
      {tokens.map((token, index) => {
        const className = token.type === 'equal'
          ? 'ai-diff-token'
          : token.type === 'insert'
            ? 'ai-diff-token ai-diff-token-insert'
            : 'ai-diff-token ai-diff-token-delete'
        if (side === 'revised' && token.type === 'delete') return null
        if (side === 'original' && token.type === 'insert') return null
        return <span key={`${index}-${token.type}`} className={className}>{token.text}</span>
      })}
    </>
  )
}
```

- [ ] **Step 4: Add diff view component**

Add a small local component in `StepAiIntegration.tsx`:

```tsx
function AiIntegrationDiffView({
  originalText,
  revisionText,
}: {
  originalText: string
  revisionText: string
}) {
  const diff = useMemo(() => buildAiIntegrationDiff(originalText, revisionText), [originalText, revisionText])

  if (!originalText.trim()) {
    return <div className="ai-diff-empty">本条记录没有可对比的原文快照</div>
  }
  if (!revisionText.trim()) {
    return <div className="ai-diff-empty">本条记录没有可对比的修订正文</div>
  }
  if (diff.blocks.length === 0) {
    return <div className="ai-diff-empty">未发现明显正文差异</div>
  }

  return (
    <div className="ai-diff-view">
      <div className="ai-diff-note">仅显示发生变化的段落</div>
      <div className="ai-diff-grid ai-diff-grid-header">
        <div>原文相关片段</div>
        <div>修订后正文</div>
      </div>
      {diff.blocks.map(block => (
        <section key={block.id} className="ai-diff-block">
          {block.heading && <div className="ai-diff-heading">{block.heading}</div>}
          <div className="ai-diff-grid">
            <div className="ai-diff-panel ai-diff-panel-original">
              {block.originalTokens.length > 0
                ? <DiffTokenList tokens={block.originalTokens} side="original" />
                : <span className="ai-diff-muted">原文无对应段落</span>}
            </div>
            <div className="ai-diff-panel ai-diff-panel-revised">
              <DiffTokenList tokens={block.revisedTokens} side="revised" />
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Add the compare button in expanded history records**

Inside the expanded record header area in `StepAiIntegration.tsx`, compute:

```ts
const canCompare = Boolean(record.originalContentSnapshot?.trim() && record.revisionText?.trim() && record.originalScope !== 'none')
const comparing = compareRecordId === record.id
```

Add a button before the answer body:

```tsx
{canCompare && (
  <button
    type="button"
    className="btn-m3-outline ai-history-compare"
    onClick={() => toggleCompareRecord(record.id)}
  >
    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
      {comparing ? 'article' : 'difference'}
    </span>
    {comparing ? '返回清洁版' : '对比原文'}
  </button>
)}
```

- [ ] **Step 6: Switch body rendering**

In the expanded answer body:

```tsx
{comparing ? (
  <AiIntegrationDiffView
    originalText={record.originalContentSnapshot ?? ''}
    revisionText={record.revisionText ?? ''}
  />
) : (
  <div className={`draft-preview-shell${activeCitation ? ' has-citation-panel' : ''}`}>
    ...
  </div>
)}
```

Keep the existing citation panel only in clean mode for the first implementation. Diff markup and citation popovers can be unified later.

- [ ] **Step 7: Add CSS styles**

In `frontend/src/index.css`, near existing `.ai-history-*` styles:

```css
.ai-history-compare {
  margin-bottom: 12px;
  padding: 5px 12px;
  font-size: 12px;
}
.ai-diff-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-diff-note {
  font-size: 12px;
  color: var(--m3-on-surface-variant);
}
.ai-diff-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}
.ai-diff-grid-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--m3-on-surface);
}
.ai-diff-block {
  border: 0.5px solid var(--dui-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--dui-surface);
}
.ai-diff-heading {
  padding: 8px 10px;
  background: var(--m3-surface-container-low);
  font-size: 12px;
  font-weight: 600;
  color: var(--m3-on-surface);
}
.ai-diff-panel {
  min-height: 72px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ai-diff-panel-original {
  border-right: 0.5px solid var(--dui-divider);
  color: var(--m3-on-surface-variant);
}
.ai-diff-panel-revised {
  color: var(--m3-on-surface);
}
.ai-diff-token-insert {
  background: rgba(46, 125, 50, 0.16);
  color: #1b5e20;
  border-radius: 3px;
  padding: 0 2px;
}
.ai-diff-token-delete {
  background: rgba(198, 40, 40, 0.12);
  color: #b3261e;
  border-radius: 3px;
  padding: 0 2px;
  text-decoration: line-through;
}
.ai-diff-muted,
.ai-diff-empty {
  color: var(--m3-on-surface-variant);
  font-size: 13px;
}
.ai-diff-empty {
  padding: 16px;
  border: 0.5px solid var(--dui-divider);
  border-radius: 8px;
  background: var(--m3-surface-container-low);
}
```

Inside the existing `@media (max-width: 980px)` block, add:

```css
.ai-diff-grid {
  grid-template-columns: minmax(0, 1fr);
}
.ai-diff-panel-original {
  border-right: none;
  border-bottom: 0.5px solid var(--dui-divider);
}
```

- [ ] **Step 8: Run frontend tests/build**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/aiIntegrationDiff.test.mjs
cd frontend && node --experimental-strip-types src/utils/aiIntegrationHistory.test.mjs
cd frontend && node --experimental-strip-types src/utils/aiIntegrationIssues.test.mjs
cd frontend && npm run build
```

Expected: all PASS.

- [ ] **Step 9: Commit diff UI**

```bash
git add frontend/src/components/StepAiIntegration.tsx frontend/src/index.css
git commit -m "feat: show ai integration source diff"
```

---

### Task 5: End-to-End Verification

**Files:**
- Existing backend and frontend tests/build.

- [ ] **Step 1: Run backend AI integration tests**

Run: `cd backend && python3 -m unittest tests.test_ai_integration -v`

Expected: PASS.

- [ ] **Step 2: Run focused frontend utility tests**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/aiIntegrationDiff.test.mjs
cd frontend && node --experimental-strip-types src/utils/aiIntegrationHistory.test.mjs
cd frontend && node --experimental-strip-types src/utils/aiIntegrationIssues.test.mjs
```

Expected: all PASS.

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run: `git diff --stat HEAD`

Expected: only intended backend, frontend, tests, and plan files changed.

- [ ] **Step 5: Final commit if any verification-only fixes were needed**

If verification required extra fixes:

```bash
git add backend frontend docs/superpowers/plans/2026-06-29-ai-integration-source-diff.md
git commit -m "fix: verify ai integration source diff"
```

Otherwise no commit is needed.
