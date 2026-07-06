# Priority Guideline Primary Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make user-selected “重点指南” visibly and verifiably act as primary evidence during AI integration and quality review.

**Architecture:** Keep the existing request fields and citation pipeline, but split selected references into primary guideline evidence and supplementary evidence at prompt construction time. Add a small response metadata object for AI integration so the backend can report whether priority guidelines were used, and surface that status in the frontend without changing legacy records.

**Tech Stack:** FastAPI/Pydantic backend, Python `unittest`, React + TypeScript frontend, Node `--experimental-strip-types` utility tests.

---

## File Structure

- Modify `backend/models.py`
  - Add `PriorityGuidelineUsage`.
  - Extend `AiIntegrationResponse` with `priority_guideline_usage`.
- Modify `backend/services/generator.py`
  - Build a dedicated priority guideline evidence block for AI integration.
  - Build supplementary reference block from non-priority or non-duplicated chunks.
  - Parse and infer priority guideline usage.
  - Return usage metadata.
- Modify `backend/services/analyzer.py`
  - Rename prompt wording from “本章节重点指南” to “重点指南主证据区”.
  - Strengthen quality-review guidance that priority guideline evidence should be used first when available.
- Modify `backend/tests/test_ai_integration.py`
  - Cover priority evidence block construction.
  - Cover usage status inference.
  - Cover no-priority compatibility.
- Modify `backend/tests/test_analyzer.py`
  - Cover strengthened quality-review priority guideline prompt text.
- Modify `frontend/src/types/index.ts`
  - Add `PriorityGuidelineUsage` type.
  - Add `priorityGuidelineUsage?: PriorityGuidelineUsage` to `AiIntegrationRecord`.
- Create `frontend/src/utils/priorityGuidelineUsage.ts`
  - Map backend status to display label and CSS tone.
- Create `frontend/src/utils/priorityGuidelineUsage.test.mjs`
  - Test status-label mapping and legacy empty states.
- Modify `frontend/src/components/StepAiIntegration.tsx`
  - Save `priority_guideline_usage` from backend as `priorityGuidelineUsage`.
  - Show a compact status near AI integration results/history.
- Modify `frontend/src/index.css`
  - Add minimal styles for the compact priority guideline status.

## Task 1: Backend Response Model

**Files:**
- Modify: `backend/models.py`
- Test: `backend/tests/test_ai_integration.py`

- [ ] **Step 1: Write the failing model test**

Add to `backend/tests/test_ai_integration.py`:

```py
    async def test_ai_integration_returns_priority_guideline_usage_metadata(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return (
                "## 修订后正文\n"
                "治疗方案应以重点指南为准[2]。\n\n"
                "## 重点指南使用情况\n"
                "- 已采用：参考数据源 2：重点指南.pdf，用于治疗方案，引用：[2]\n\n"
                "## 修改说明\n"
                "- 按重点指南修订治疗方案。"
            )

        result = await generate_ai_integration_answer(
            AiIntegrationRequest(
                disease="测试病种",
                user_request="修订治疗方案",
                reference_inputs=[
                    ReferenceInput(id=1, filename="普通综述.pdf", text="普通资料。"),
                    ReferenceInput(id=2, filename="重点指南.pdf", text="治疗方案应以重点指南为准。"),
                ],
                priority_reference_ids=[2],
            ),
            text_generator=fake_generate_text,
        )

        self.assertIsNotNone(result.priority_guideline_usage)
        self.assertEqual(result.priority_guideline_usage.status, "used")
        self.assertIn("参考数据源 2", result.priority_guideline_usage.used_sources[0])
```

- [ ] **Step 2: Run the failing test**

Run: `cd backend && python3 -m unittest tests.test_ai_integration.AiIntegrationTests.test_ai_integration_returns_priority_guideline_usage_metadata -v`

Expected: FAIL because `AiIntegrationResponse` has no `priority_guideline_usage`.

- [ ] **Step 3: Add backend models**

In `backend/models.py`, add near `AiIntegrationResponse`:

```py
class PriorityGuidelineUsage(BaseModel):
    status: str = "not_configured"  # not_configured/used/not_covered/not_used/unknown
    used_sources: List[str] = []
    warnings: List[str] = []
```

Then extend:

```py
class AiIntegrationResponse(BaseModel):
    answer: str
    revision_text: str = ""
    change_summary: List[str] = []
    references_used: List[str] = []
    reference_anchors: List[ReferenceAnchor] = []
    priority_guideline_usage: Optional[PriorityGuidelineUsage] = None
```

- [ ] **Step 4: Return placeholder metadata**

In `backend/services/generator.py`, import `PriorityGuidelineUsage` from `models`.

In `generate_ai_integration_answer()`, before returning:

```py
    priority_guideline_usage = PriorityGuidelineUsage(
        status="not_configured" if not priority_ids else "unknown",
    )
```

Add `priority_guideline_usage=priority_guideline_usage` to `AiIntegrationResponse(...)`.

- [ ] **Step 5: Run the test and confirm it now fails for status**

Run: `cd backend && python3 -m unittest tests.test_ai_integration.AiIntegrationTests.test_ai_integration_returns_priority_guideline_usage_metadata -v`

Expected: FAIL with expected `"used"` but got `"unknown"`.

## Task 2: Priority Guideline Usage Inference

**Files:**
- Modify: `backend/services/generator.py`
- Test: `backend/tests/test_ai_integration.py`

- [ ] **Step 1: Add failing status tests**

Add tests:

```py
    async def test_ai_integration_marks_priority_guideline_not_used_when_no_priority_citation(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "## 修订后正文\n仅引用普通资料[1]。\n\n## 修改说明\n- 未使用重点指南。"

        result = await generate_ai_integration_answer(
            AiIntegrationRequest(
                disease="测试病种",
                user_request="修订",
                reference_inputs=[
                    ReferenceInput(id=1, filename="普通综述.pdf", text="普通资料。"),
                    ReferenceInput(id=2, filename="重点指南.pdf", text="重点资料。"),
                ],
                priority_reference_ids=[2],
            ),
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.priority_guideline_usage.status, "not_used")
        self.assertTrue(result.priority_guideline_usage.warnings)

    async def test_ai_integration_marks_priority_guideline_not_configured_without_priority_ids(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "普通回答。"

        result = await generate_ai_integration_answer(
            AiIntegrationRequest(disease="测试病种", user_request="修订"),
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.priority_guideline_usage.status, "not_configured")
```

- [ ] **Step 2: Run failing tests**

Run: `cd backend && python3 -m unittest tests.test_ai_integration.AiIntegrationTests -v`

Expected: FAIL on new priority guideline status behavior.

- [ ] **Step 3: Implement helper functions**

Add to `backend/services/generator.py` near AI integration parsing helpers:

```py
_PRIORITY_USAGE_SECTION_RE = re.compile(
    r"(?ims)^##\s*重点指南使用情况\s*\n(?P<body>.*?)(?=^##\s+|\Z)"
)


def _extract_priority_usage_section(text: str) -> str:
    match = _PRIORITY_USAGE_SECTION_RE.search(text or "")
    return match.group("body").strip() if match else ""


def _priority_reference_citation_pattern(priority_source_ids: set[int]) -> re.Pattern | None:
    if not priority_source_ids:
        return None
    ids = "|".join(str(source_id) for source_id in sorted(priority_source_ids))
    return re.compile(rf"[\[［【]\s*(?:{ids})(?:\s*[-–—]\s*\d+)?\s*[\]］】]")


def _infer_priority_guideline_usage(
    text: str,
    priority_source_ids: set[int],
    references_by_id: dict[int, str],
) -> PriorityGuidelineUsage:
    if not priority_source_ids:
        return PriorityGuidelineUsage(status="not_configured")

    usage_section = _extract_priority_usage_section(text)
    combined = f"{text or ''}\n{usage_section}"
    citation_pattern = _priority_reference_citation_pattern(priority_source_ids)
    used_ids = set()
    if citation_pattern:
        for match in citation_pattern.finditer(combined):
            numeric = re.search(r"\d+", match.group(0))
            if numeric:
                used_ids.add(int(numeric.group(0)))

    used_sources = [
        f"参考数据源 {source_id}：{references_by_id.get(source_id, '')}".rstrip("：")
        for source_id in sorted(used_ids)
    ]
    if used_sources:
        return PriorityGuidelineUsage(status="used", used_sources=used_sources)
    if "未覆盖" in usage_section or "没有覆盖" in usage_section:
        return PriorityGuidelineUsage(status="not_covered")
    return PriorityGuidelineUsage(
        status="not_used",
        warnings=["本次回答未检测到重点指南引用，请人工核查或重新生成。"],
    )
```

- [ ] **Step 4: Wire inference into AI integration**

In `generate_ai_integration_answer()`, after `rewritten_answer` and `rewritten_revision_text` are computed:

```py
    references_by_id = {ref.id: ref.filename for ref in req.reference_inputs}
    priority_guideline_usage = _infer_priority_guideline_usage(
        f"{rewritten_answer}\n{rewritten_revision_text}",
        priority_ids,
        references_by_id,
    )
```

Pass it into `AiIntegrationResponse`.

- [ ] **Step 5: Run backend AI integration tests**

Run: `cd backend && python3 -m unittest tests.test_ai_integration -v`

Expected: PASS.

## Task 3: AI Integration Primary Evidence Prompt

**Files:**
- Modify: `backend/services/generator.py`
- Test: `backend/tests/test_ai_integration.py`

- [ ] **Step 1: Strengthen existing prompt tests**

Update `test_builds_answer_from_question_selected_references_and_original_content` to assert:

```py
self.assertIn("## 重点指南主证据区", calls[0]["prompt"])
self.assertIn("## 普通参考资料补充区", calls[0]["prompt"])
self.assertLess(
    calls[0]["prompt"].index("## 重点指南主证据区"),
    calls[0]["prompt"].index("## 普通参考资料补充区"),
)
self.assertIn("必须包含“## 重点指南使用情况”区块", calls[0]["prompt"])
```

Update `test_ai_integration_forces_priority_reference_chunks_into_prompt` to assert the priority-only sentence is inside the primary evidence section:

```py
primary_start = captured["prompt"].index("## 重点指南主证据区")
supplementary_start = captured["prompt"].index("## 普通参考资料补充区")
self.assertIn("PRIORITY_ONLY_SENTENCE_XYZ", captured["prompt"][primary_start:supplementary_start])
```

- [ ] **Step 2: Run failing tests**

Run: `cd backend && python3 -m unittest tests.test_ai_integration.AiIntegrationTests.test_builds_answer_from_question_selected_references_and_original_content tests.test_ai_integration.AiIntegrationTests.test_ai_integration_forces_priority_reference_chunks_into_prompt -v`

Expected: FAIL because prompt still uses “已选择参考文献” and “重点指南清单”.

- [ ] **Step 3: Add primary/supplementary formatting helpers**

In `backend/services/generator.py`, add:

```py
def _partition_reference_chunks_by_priority(
    chunks: list[ReferenceChunk],
    priority_source_ids: set[int],
) -> tuple[list[ReferenceChunk], list[ReferenceChunk]]:
    priority_chunks = [chunk for chunk in chunks if chunk.source_id in priority_source_ids]
    supplementary_chunks = [chunk for chunk in chunks if chunk.source_id not in priority_source_ids]
    return priority_chunks, supplementary_chunks
```

In `generate_ai_integration_answer()`:

```py
    priority_chunks, supplementary_chunks = _partition_reference_chunks_by_priority(
        reference_chunks,
        priority_ids,
    )
    primary_reference_text = (
        "（未设置重点指南）"
        if not priority_ids
        else _format_reference_chunks(priority_chunks, priority_ids)
    )
    supplementary_reference_text = (
        "（未选择普通参考资料）"
        if not supplementary_chunks
        else _format_reference_chunks(supplementary_chunks, priority_ids)
    )
```

- [ ] **Step 4: Rewrite the prompt sections**

Replace:

```md
## 已选择参考文献
...

## 重点指南清单
...
```

with:

```md
## 重点指南主证据区
{primary_reference_text}

## 普通参考资料补充区
{supplementary_reference_text}
```

Update answer requirements:

```md
- 若“重点指南主证据区”中有相关证据，必须以重点指南作为主体依据；普通参考资料补充区只能补充重点指南未覆盖的内容。
- 若普通参考资料与重点指南不一致，必须说明冲突，并采用重点指南结论，除非用户明确要求比较不同资料。
- 必须包含“## 重点指南使用情况”区块；若重点指南覆盖了本次任务，列出采用的参考数据源和引用标记；若未覆盖，明确写“重点指南未覆盖”并说明使用了哪些普通资料补充。
```

- [ ] **Step 5: Run backend AI integration tests**

Run: `cd backend && python3 -m unittest tests.test_ai_integration -v`

Expected: PASS.

## Task 4: Quality Review Priority Guideline Prompt

**Files:**
- Modify: `backend/services/analyzer.py`
- Test: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Add failing tests for priority block wording**

Add to `backend/tests/test_analyzer.py`:

```py
class PriorityGuidelinePromptTests(unittest.TestCase):
    def test_priority_reference_block_declares_primary_evidence(self):
        block = analyzer._build_priority_reference_block(
            ["### 参考数据源 2：重点指南\n诊断标准应包括A。"],
            section_heading="诊断",
            section_content="原文诊断内容。",
        )

        self.assertIn("重点指南主证据区", block)
        self.assertIn("主判断依据", block)
        self.assertIn("必须优先引用重点指南", block)
```

- [ ] **Step 2: Run failing test**

Run: `cd backend && python3 -m unittest tests.test_analyzer.PriorityGuidelinePromptTests -v`

Expected: FAIL because current wording says “本章节重点指南（冲突处理规则）”.

- [ ] **Step 3: Update `_build_priority_reference_block()` wording**

In `backend/services/analyzer.py`, change the returned heading and rule text to:

```py
    return (
        "\n\n## ⚠️ 重点指南主证据区（本章节主判断依据）\n"
        "以下资料由用户标记为本章节重点指南，是本章节质量评审的主判断依据。"
        "标题中的「参考数据源 N」为上传时的固定全局序号，即使作为重点指南也必须沿用该编号。"
        "若其他参考数据源与重点指南观点不一致，或推荐、分期、剂量、疗程、适应证、禁忌证等不一致，"
        "请以重点指南为准；只有当重点指南未覆盖相关问题时，才参考其他资料。"
        "报告 missing_content、accuracy 或 outdated 问题时，若重点指南区包含相关依据，必须优先引用重点指南作为 guideline_evidence；"
        "source字段统一写「参考数据源 N：文件名」，不要写「重点指南 N」。"
        "若下方只提供了相关片段，仅可基于可见片段判断指南依据。\n"
        + "\n---\n".join(refs_for_prompt)
    )
```

- [ ] **Step 4: Run analyzer tests**

Run: `cd backend && python3 -m unittest tests.test_analyzer.PriorityGuidelinePromptTests -v`

Expected: PASS.

## Task 5: Frontend Types and Utility

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/utils/priorityGuidelineUsage.ts`
- Create: `frontend/src/utils/priorityGuidelineUsage.test.mjs`

- [ ] **Step 1: Write failing frontend utility test**

Create `frontend/src/utils/priorityGuidelineUsage.test.mjs`:

```js
import assert from 'node:assert/strict'
import { getPriorityGuidelineUsageDisplay } from './priorityGuidelineUsage.ts'

assert.equal(getPriorityGuidelineUsageDisplay(undefined), null)

assert.deepEqual(
  getPriorityGuidelineUsageDisplay({ status: 'used', used_sources: ['参考数据源 2：指南'] }),
  { label: '已优先采用重点指南', tone: 'success', detail: '参考数据源 2：指南' },
)

assert.equal(
  getPriorityGuidelineUsageDisplay({ status: 'not_covered' })?.label,
  '重点指南未覆盖，已使用普通资料补充',
)

assert.equal(
  getPriorityGuidelineUsageDisplay({ status: 'not_used', warnings: ['未检测到重点指南引用'] })?.tone,
  'warning',
)

assert.equal(
  getPriorityGuidelineUsageDisplay({ status: 'unknown' })?.label,
  '无法判断重点指南使用情况',
)

console.log('priority guideline usage tests passed')
```

- [ ] **Step 2: Run failing utility test**

Run: `cd frontend && node --experimental-strip-types src/utils/priorityGuidelineUsage.test.mjs`

Expected: FAIL because the utility does not exist.

- [ ] **Step 3: Add frontend types**

In `frontend/src/types/index.ts`:

```ts
export type PriorityGuidelineUsageStatus =
  | 'not_configured'
  | 'used'
  | 'not_covered'
  | 'not_used'
  | 'unknown'

export interface PriorityGuidelineUsage {
  status: PriorityGuidelineUsageStatus
  used_sources?: string[]
  warnings?: string[]
}
```

Add to `AiIntegrationRecord`:

```ts
priorityGuidelineUsage?: PriorityGuidelineUsage
```

- [ ] **Step 4: Add display utility**

Create `frontend/src/utils/priorityGuidelineUsage.ts`:

```ts
import type { PriorityGuidelineUsage } from '../types'

export type PriorityGuidelineUsageTone = 'success' | 'info' | 'warning' | 'neutral'

export interface PriorityGuidelineUsageDisplay {
  label: string
  tone: PriorityGuidelineUsageTone
  detail?: string
}

export function getPriorityGuidelineUsageDisplay(
  usage?: PriorityGuidelineUsage | null,
): PriorityGuidelineUsageDisplay | null {
  if (!usage || usage.status === 'not_configured') return null
  const detail = [
    ...(usage.used_sources ?? []),
    ...(usage.warnings ?? []),
  ].filter(Boolean).join('；')
  if (usage.status === 'used') {
    return { label: '已优先采用重点指南', tone: 'success', detail }
  }
  if (usage.status === 'not_covered') {
    return { label: '重点指南未覆盖，已使用普通资料补充', tone: 'info', detail }
  }
  if (usage.status === 'not_used') {
    return { label: '未检测到重点指南引用，建议重新生成或人工核查', tone: 'warning', detail }
  }
  return { label: '无法判断重点指南使用情况', tone: 'neutral', detail }
}
```

- [ ] **Step 5: Run utility test**

Run: `cd frontend && node --experimental-strip-types src/utils/priorityGuidelineUsage.test.mjs`

Expected: PASS.

## Task 6: Frontend AI Integration Status Display

**Files:**
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/utils/priorityGuidelineUsage.test.mjs`

- [ ] **Step 1: Save backend usage metadata**

In `frontend/src/components/StepAiIntegration.tsx`, import:

```ts
import { getPriorityGuidelineUsageDisplay } from '../utils/priorityGuidelineUsage'
```

When creating `record`, map backend snake case to frontend camel case:

```ts
priorityGuidelineUsage: data.priority_guideline_usage,
```

- [ ] **Step 2: Render compact status for active record**

Near where `activeDisplayText` is shown, compute:

```ts
const activePriorityGuidelineDisplay = getPriorityGuidelineUsageDisplay(
  activeRecord?.priorityGuidelineUsage,
)
```

Render near the answer/history header:

```tsx
{activePriorityGuidelineDisplay && (
  <div className={`priority-guideline-status ${activePriorityGuidelineDisplay.tone}`}>
    <span className="material-symbols-outlined">policy</span>
    <span>{activePriorityGuidelineDisplay.label}</span>
    {activePriorityGuidelineDisplay.detail && (
      <small>{activePriorityGuidelineDisplay.detail}</small>
    )}
  </div>
)}
```

If the exact location differs, place it adjacent to the active answer actions so users see it before reading the AI result.

- [ ] **Step 3: Add minimal CSS**

In `frontend/src/index.css`:

```css
.priority-guideline-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
}

.priority-guideline-status small {
  color: inherit;
  opacity: 0.82;
}

.priority-guideline-status.success {
  background: #ecfdf3;
  color: #166534;
}

.priority-guideline-status.info {
  background: #eff6ff;
  color: #1d4ed8;
}

.priority-guideline-status.warning {
  background: #fffbeb;
  color: #92400e;
}

.priority-guideline-status.neutral {
  background: #f3f4f6;
  color: #374151;
}
```

- [ ] **Step 4: Run frontend tests/build**

Run: `cd frontend && node --experimental-strip-types src/utils/priorityGuidelineUsage.test.mjs`

Expected: PASS.

Run: `cd frontend && npm run build`

Expected: PASS.

## Task 7: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run backend focused tests**

Run: `cd backend && python3 -m unittest tests.test_ai_integration tests.test_analyzer -v`

Expected: PASS.

- [ ] **Step 2: Run frontend focused tests**

Run: `cd frontend && node --experimental-strip-types src/utils/priorityGuidelineUsage.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 4: Inspect git diff**

Run: `git diff -- backend/models.py backend/services/generator.py backend/services/analyzer.py backend/tests/test_ai_integration.py backend/tests/test_analyzer.py frontend/src/types/index.ts frontend/src/utils/priorityGuidelineUsage.ts frontend/src/utils/priorityGuidelineUsage.test.mjs frontend/src/components/StepAiIntegration.tsx frontend/src/index.css`

Expected: only priority guideline primary evidence changes are present.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/services/generator.py backend/services/analyzer.py backend/tests/test_ai_integration.py backend/tests/test_analyzer.py frontend/src/types/index.ts frontend/src/utils/priorityGuidelineUsage.ts frontend/src/utils/priorityGuidelineUsage.test.mjs frontend/src/components/StepAiIntegration.tsx frontend/src/index.css
git commit -m "feat: enforce priority guideline evidence flow"
```
