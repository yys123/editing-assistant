# AI Integration Citation Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically verify whether each clickable citation in an AI integration result is semantically supported by the citation detail it opens.

**Architecture:** Add a focused backend citation verification service that extracts cited answer sentences, maps them to `ReferenceAnchor` evidence, asks the text model for structured relevance judgments, and returns non-blocking metadata on `AiIntegrationResponse`. Extend the existing AI integration history UI to save that metadata, summarize it near the answer, and show per-citation judgments in `AiCitationPanel`.

**Tech Stack:** FastAPI/Pydantic backend, existing `services.text_llm.generate_text`, Python `unittest`, React/TypeScript frontend, existing source-level `.mjs` tests, CSS in `frontend/src/index.css`.

---

## File Structure

- Modify `backend/models.py`
  - Add `CitationVerificationItem` and `CitationVerificationResult`.
  - Add optional `citation_verification` to `AiIntegrationResponse`.
- Create `backend/services/citation_verification.py`
  - Own citation occurrence extraction, anchor selection, internal prompt input records, prompt construction, AI JSON parsing, status aggregation, and failure fallback.
- Modify `backend/services/generator.py`
  - Import the new verifier and call it after citation rewriting.
- Create `backend/tests/test_citation_verification.py`
  - Focused unit tests for extraction, anchor mapping, AI parsing, fallback, limits, and duplicate `anchor_key` behavior.
- Modify `backend/tests/test_ai_integration.py`
  - Integration tests for `generate_ai_integration_answer()` returning citation verification, and guard existing fakes against the second verification call where needed.
- Modify `frontend/src/types/index.ts`
  - Add citation verification interfaces and optional `citationVerification` on `AiIntegrationRecord`.
- Create `frontend/src/utils/citationVerification.ts`
  - UI display helpers for summary tone, severity ordering, and matching verification items to a clicked anchor.
- Create `frontend/src/utils/citationVerification.test.mjs`
  - Source-level tests for summary and matching behavior.
- Modify `frontend/src/components/StepAiIntegration.tsx`
  - Save `data.citation_verification`, show status strip, and pass matching verification items to `AiCitationPanel`.
- Modify `frontend/src/components/StepAiIntegrationCitationPanel.test.mjs`
  - Source-level component assertions for status strip and panel wiring.
- Modify `frontend/src/index.css`
  - Add restrained styles for citation verification summary and panel detail.

## Task 1: Backend Response Models

**Files:**
- Modify: `backend/models.py`
- Test: `backend/tests/test_citation_verification.py`

- [ ] **Step 1: Write the failing model test**

Create `backend/tests/test_citation_verification.py` with this initial test:

```python
import unittest

from models import CitationVerificationItem, CitationVerificationResult, AiIntegrationResponse


class CitationVerificationModelTests(unittest.TestCase):
    def test_ai_integration_response_accepts_citation_verification(self):
        result = AiIntegrationResponse(
            answer="治疗建议[1-3]。",
            citation_verification=CitationVerificationResult(
                status="needs_review",
                items=[
                    CitationVerificationItem(
                        citation_key="1-3",
                        anchor_key="1-3",
                        sentence="治疗建议[1-3]。",
                        source_label="参考数据源 1：指南.pdf",
                        quote="指南原文。",
                        status="weak",
                        reason="引用主题相关但缺少关键限定。",
                    )
                ],
                warnings=["部分引用需要人工确认。"],
            ),
        )

        self.assertEqual(result.citation_verification.status, "needs_review")
        self.assertEqual(result.citation_verification.items[0].citation_key, "1-3")
```

- [ ] **Step 2: Run the test to verify RED**

Run from `backend/`:

```bash
python3 -m unittest tests.test_citation_verification.CitationVerificationModelTests.test_ai_integration_response_accepts_citation_verification -v
```

Expected: FAIL with `ImportError` or `NameError` because the citation verification models do not exist.

- [ ] **Step 3: Add minimal models**

In `backend/models.py`, near `PriorityGuidelineUsage` and `AiIntegrationResponse`, add:

```python
class CitationVerificationItem(BaseModel):
    citation_key: str
    anchor_key: str = ""
    sentence: str = ""
    source_label: str = ""
    quote: str = ""
    status: str = "unverified"
    reason: str = ""


class CitationVerificationResult(BaseModel):
    status: str = "not_run"
    items: List[CitationVerificationItem] = []
    warnings: List[str] = []
```

Then extend `AiIntegrationResponse`:

```python
class AiIntegrationResponse(BaseModel):
    answer: str
    revision_text: str = ""
    change_summary: List[str] = []
    references_used: List[str] = []
    reference_anchors: List[ReferenceAnchor] = []
    priority_guideline_usage: Optional[PriorityGuidelineUsage] = None
    citation_verification: Optional[CitationVerificationResult] = None
```

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```bash
python3 -m unittest tests.test_citation_verification.CitationVerificationModelTests.test_ai_integration_response_accepts_citation_verification -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_citation_verification.py
git commit -m "feat: add citation verification response models"
```

## Task 2: Citation Extraction and Anchor Mapping

**Files:**
- Create: `backend/services/citation_verification.py`
- Modify: `backend/tests/test_citation_verification.py`

- [ ] **Step 1: Write failing extraction tests**

Append tests:

```python
from models import ReferenceAnchor
from services.citation_verification import build_citation_verification_inputs


class CitationVerificationExtractionTests(unittest.TestCase):
    def test_builds_input_from_cited_sentence_and_anchor(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="乌司奴单抗诱导缓解者建议第16周后复查内镜[3]。",
                context_before="前文。",
                context_after="后文。",
                paragraph_index=0,
            )
        ]

        result = build_citation_verification_inputs(
            "乌司奴单抗诱导缓解者，首次内镜复查不早于第16周[1-3]。",
            anchors,
        )

        self.assertEqual(len(result.items), 1)
        item = result.items[0]
        self.assertEqual(item.citation_key, "1-3")
        self.assertEqual(item.anchor_key, "1-3")
        self.assertIn("第16周", item.sentence)
        self.assertIn("参考数据源 1：指南.pdf", item.source_label)
        self.assertIn("复查内镜", item.quote)

    def test_unmatched_citation_becomes_unverifiable_without_ai(self):
        result = build_citation_verification_inputs("缺少可点击详情[9-99]。", [])

        self.assertEqual(result.items[0].citation_key, "9-99")
        self.assertEqual(result.items[0].status, "unverifiable")
        self.assertIn("未找到可点击详情", result.items[0].reason)

    def test_grouped_citations_create_one_item_per_token(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南A.pdf",
                source_ref_id="3",
                quote="治疗建议A[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            ),
            ReferenceAnchor(
                citation_key="2-6",
                source_id=2,
                source_filename="指南B.pdf",
                source_ref_id="6",
                quote="治疗建议B[6]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            ),
        ]

        result = build_citation_verification_inputs("治疗建议需要综合判断[1-3、2-6]。", anchors)

        self.assertEqual([item.citation_key for item in result.items], ["1-3", "2-6"])

    def test_duplicate_citation_keys_get_stable_anchor_keys(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-47",
                source_id=1,
                source_filename="高钾血症指南.pdf",
                source_ref_id="47",
                quote="高糖加胰岛素可促进钾离子进入细胞内[47]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            ),
            ReferenceAnchor(
                citation_key="1-47",
                source_id=1,
                source_filename="高钾血症指南.pdf",
                source_ref_id="47",
                quote="碳酸氢钠适用于合并代谢性酸中毒的患者[47]。",
                context_before="",
                context_after="",
                paragraph_index=1,
            ),
        ]

        result = build_citation_verification_inputs(
            "合并代谢性酸中毒时可考虑碳酸氢钠[1-47]。",
            anchors,
        )

        self.assertEqual(result.items[0].anchor_key, "1-47~2")
        self.assertIn("碳酸氢钠", result.items[0].quote)

    def test_limit_adds_warning_and_truncates_items(self):
        text = " ".join(f"结论{index}[{index}]" for index in range(1, 6))

        result = build_citation_verification_inputs(text, [], limit=2)

        self.assertEqual(len(result.items), 2)
        self.assertEqual(len(result.ai_inputs), 0)
        self.assertTrue(result.warnings)

    def test_repeated_same_anchor_keeps_separate_ai_inputs(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = build_citation_verification_inputs(
            "第16周后复查内镜[1-3]。另一个不同结论也引用同一证据[1-3]。",
            anchors,
        )

        self.assertEqual(len(result.items), 2)
        self.assertEqual(len(result.ai_inputs), 2)
        self.assertNotEqual(result.ai_inputs[0].input_id, result.ai_inputs[1].input_id)
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
python3 -m unittest tests.test_citation_verification.CitationVerificationExtractionTests -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'services.citation_verification'`.

- [ ] **Step 3: Implement extraction helpers**

Create `backend/services/citation_verification.py` with these public functions and helper shape:

```python
import json
import re
from dataclasses import dataclass
from typing import Awaitable, Callable

from models import CitationVerificationItem, CitationVerificationResult, ReferenceAnchor
from services.text_llm import generate_text

MAX_CITATION_VERIFICATION_ITEMS = 40
REVIEW_STATUSES = {"weak", "mismatch", "unverifiable", "unverified"}
VALID_ITEM_STATUSES = {"supported", "weak", "mismatch", "unverifiable", "unverified"}


@dataclass
class CitationVerificationInput:
    input_id: str
    item: CitationVerificationItem
    context_before: str = ""
    context_after: str = ""


@dataclass
class VerificationBuildResult:
    items: list[CitationVerificationItem]
    ai_inputs: list[CitationVerificationInput]
    warnings: list[str]


def build_citation_verification_inputs(
    text: str,
    reference_anchors: list[ReferenceAnchor],
    limit: int = MAX_CITATION_VERIFICATION_ITEMS,
) -> VerificationBuildResult:
    return _build_inputs_from_text(text, reference_anchors, limit)
```

Implementation requirements:

- Implement `_build_inputs_from_text()` in the same file; it should contain the regex scan, anchor matching, deduplication, limit handling, and `VerificationBuildResult` construction.
- Use a regex that handles bracketed groups such as `[1-3]`, `[1-3、2-6]`, `[0-18]`, and `[R1-C001]`.
- Use a local sentence helper similar to `generator._answer_sentence_around_citation()` so the item `sentence` includes the citation marker.
- Build stable anchor keys by counting duplicate `citation_key` values in `reference_anchors`:

```python
def _anchors_with_keys(reference_anchors: list[ReferenceAnchor]) -> list[tuple[str, ReferenceAnchor]]:
    counts: dict[str, int] = {}
    for anchor in reference_anchors:
        counts[anchor.citation_key] = counts.get(anchor.citation_key, 0) + 1
    seen: dict[str, int] = {}
    keyed = []
    for anchor in reference_anchors:
        if counts.get(anchor.citation_key, 0) <= 1:
            keyed.append((anchor.citation_key, anchor))
            continue
        index = seen.get(anchor.citation_key, 0) + 1
        seen[anchor.citation_key] = index
        keyed.append((f"{anchor.citation_key}~{index}", anchor))
    return keyed
```

- Match exact `citation_key`, exact computed `anchor_key`, or `chunk_id`.
- If multiple anchors match one token, choose the anchor with the highest overlap score against the answer sentence. A compact token-overlap helper copied from the existing `_normalize_search_text` / `_overlap_score` pattern is acceptable.
- Return unmatched citation tokens as `CitationVerificationItem(status="unverifiable", reason="未找到可点击详情，请人工核查。")`.
- Only matched anchors should be included in `ai_inputs`; each `CitationVerificationInput` carries a stable per-occurrence `input_id`, the returned item, and the anchor `context_before` and `context_after` for prompt construction.
- `input_id` must distinguish repeated uses of the same clickable anchor in different answer sentences. A deterministic value such as `v1`, `v2`, `v3` in scan order is sufficient because it is only used within one verification request.
- `source_label` should include the title path when present, for example `参考数据源 1：指南.pdf｜标题路径：诱导缓解治疗`.
- Deduplicate by `(sentence, citation_key, quote)`.
- If more than `limit` items are found, keep the first `limit`, add warning `引用数量超过 40 条，仅核对前 40 条。`, and do not send truncated items to AI.

- [ ] **Step 4: Run extraction tests to verify GREEN**

Run:

```bash
python3 -m unittest tests.test_citation_verification.CitationVerificationExtractionTests -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/citation_verification.py backend/tests/test_citation_verification.py
git commit -m "feat: map ai integration citations to anchors"
```

## Task 3: AI Citation Relevance Verification Service

**Files:**
- Modify: `backend/services/citation_verification.py`
- Modify: `backend/tests/test_citation_verification.py`

- [ ] **Step 1: Write failing verifier tests**

Append async tests:

```python
class CitationVerificationServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_verify_supported_items_returns_passed(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertEqual(context, "ai_integration_citation_verification")
            self.assertIn('"citation_key": "1-3"', prompt)
            return '{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"原文直接支持。"}]}'

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "第16周后复查内镜[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "passed")
        self.assertEqual(result.items[0].status, "supported")
        self.assertEqual(result.items[0].reason, "原文直接支持。")

    async def test_verify_review_items_returns_needs_review(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return '{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"mismatch","reason":"引用说复查，句子说用药。"}]}'

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "应立即增加免疫抑制剂剂量[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "needs_review")
        self.assertEqual(result.items[0].status, "mismatch")

    async def test_verify_failure_does_not_raise(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            raise RuntimeError("LLM unavailable")

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="证据。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "结论[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "failed")
        self.assertTrue(result.warnings)

    async def test_verify_accepts_fenced_json(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return '```json\n{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"支持。"}]}\n```'

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="证据。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "结论[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "passed")

    async def test_verify_invalid_json_returns_failed_result(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "不是 JSON"

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="证据。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "结论[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "failed")

    async def test_verify_repeated_same_anchor_uses_input_id_to_merge(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn('"input_id": "v1"', prompt)
            self.assertIn('"input_id": "v2"', prompt)
            return (
                '{"items":['
                '{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"第一句支持。"},'
                '{"input_id":"v2","citation_key":"1-3","anchor_key":"1-3","status":"mismatch","reason":"第二句不支持。"}'
                ']}'
            )

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "第16周后复查内镜[1-3]。另一个不同结论也引用同一证据[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "needs_review")
        self.assertEqual(result.items[0].reason, "第一句支持。")
        self.assertEqual(result.items[1].reason, "第二句不支持。")
```

- [ ] **Step 2: Run verifier tests to verify RED**

Run:

```bash
python3 -m unittest tests.test_citation_verification.CitationVerificationServiceTests -v
```

Expected: FAIL because `verify_ai_integration_citations` is not implemented.

- [ ] **Step 3: Implement verifier**

Add:

```python
async def verify_ai_integration_citations(
    text: str,
    reference_anchors: list[ReferenceAnchor],
    *,
    text_generator: Callable[..., Awaitable[str]] = generate_text,
    limit: int = MAX_CITATION_VERIFICATION_ITEMS,
) -> CitationVerificationResult:
    build = build_citation_verification_inputs(text, reference_anchors, limit=limit)
    if not build.items:
        return CitationVerificationResult(status="not_run", warnings=["未检测到可核对的引用。"])
    if not build.ai_inputs:
        return _result_from_items(build.items, build.warnings)
    prompt = _build_verification_prompt(build.ai_inputs)
    try:
        raw = await text_generator(prompt, CITATION_VERIFICATION_SYSTEM_PROMPT, context="ai_integration_citation_verification")
        judged = _parse_verification_response(raw)
    except Exception:
        return CitationVerificationResult(status="failed", items=build.items, warnings=[*build.warnings, "引用核对未完成，请人工检查。"])
    merged = _merge_judgments(build.items, build.ai_inputs, judged)
    return _result_from_items(merged, build.warnings)
```

Prompt JSON payload should include only compact evidence:

```json
{
  "items": [
    {
      "input_id": "v1",
      "citation_key": "1-3",
      "anchor_key": "1-3",
      "sentence": "乌司奴单抗诱导缓解者，首次内镜复查不早于第16周[1-3]。",
      "source_label": "参考数据源 1：指南.pdf",
      "quote": "乌司奴单抗诱导缓解者建议第16周后复查内镜[3]。",
      "context_before": "治疗前应评估疾病活动度。",
      "context_after": "后续复查频率需结合症状调整。"
    }
  ]
}
```

Parser requirements:

- Strip Markdown fences using the same idea as `generator._strip_markdown_fence`.
- Accept only `items` arrays.
- Normalize unknown statuses to `unverified`.
- Prompt instructions must explicitly require the model to echo each item's `input_id` in the response.
- Merge judgments by `input_id`; `_merge_judgments()` must receive both public `build.items` and internal `build.ai_inputs` so it can map each AI judgment back to the correct public item. If a legacy or malformed AI response omits `input_id`, fall back to `(anchor_key or citation_key, sentence, quote)` when those fields are available; otherwise leave that item as `unverified`.
- Preserve the original `sentence`, `source_label`, and `quote` from build items; AI may only replace `status` and `reason`.
- Use `CitationVerificationInput.context_before` and `CitationVerificationInput.context_after` only in the prompt payload; do not add them to public `CitationVerificationItem` responses.
- Aggregate result status:
  - `failed` only for whole-call failure.
  - `needs_review` if any item status is in `weak/mismatch/unverifiable/unverified`.
  - `passed` if all items are `supported`.
  - `not_run` only when no items exist.

- [ ] **Step 4: Run verifier tests to verify GREEN**

Run:

```bash
python3 -m unittest tests.test_citation_verification.CitationVerificationServiceTests -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/citation_verification.py backend/tests/test_citation_verification.py
git commit -m "feat: verify ai integration citation relevance"
```

## Task 4: Integrate Verification Into AI Integration Generation

**Files:**
- Modify: `backend/services/generator.py`
- Modify: `backend/tests/test_ai_integration.py`

- [ ] **Step 1: Write failing integration tests**

Add tests to `backend/tests/test_ai_integration.py`:

```python
    async def test_ai_integration_returns_citation_verification_metadata(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            if context == "ai_integration_citation_verification":
                return '{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"证据直接支持。"}]}'
            return (
                "## 修订后正文\n"
                "乌司奴单抗诱导缓解者，首次内镜复查不早于第16周[1-3]。\n\n"
                "## 修改说明\n"
                "- 补充复查时间。"
            )

        result = await generate_ai_integration_answer(
            AiIntegrationRequest(
                disease="克罗恩病",
                user_request="补充复查时间",
                reference_inputs=[
                    ReferenceInput(
                        id=1,
                        filename="克罗恩病指南.pdf",
                        text="乌司奴单抗诱导缓解者建议第16周后复查内镜[3]。",
                    ),
                ],
            ),
            text_generator=fake_generate_text,
        )

        self.assertIsNotNone(result.citation_verification)
        self.assertEqual(result.citation_verification.status, "passed")
        self.assertEqual(result.citation_verification.items[0].status, "supported")

    async def test_ai_integration_keeps_answer_when_citation_verification_fails(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            if context == "ai_integration_citation_verification":
                raise RuntimeError("verification failed")
            return "## 修订后正文\n治疗建议[1-3]。\n\n## 修改说明\n- 测试。"

        result = await generate_ai_integration_answer(
            AiIntegrationRequest(
                disease="测试病种",
                user_request="测试",
                reference_inputs=[
                    ReferenceInput(id=1, filename="指南.pdf", text="治疗建议[3]。"),
                ],
            ),
            text_generator=fake_generate_text,
        )

        self.assertIn("治疗建议", result.answer)
        self.assertEqual(result.citation_verification.status, "failed")
```

- [ ] **Step 2: Run integration tests to verify RED**

Run:

```bash
python3 -m unittest tests.test_ai_integration.AiIntegrationTests.test_ai_integration_returns_citation_verification_metadata tests.test_ai_integration.AiIntegrationTests.test_ai_integration_keeps_answer_when_citation_verification_fails -v
```

Expected: FAIL because `generate_ai_integration_answer()` does not populate `citation_verification`.

- [ ] **Step 3: Call verifier from generator**

In `backend/services/generator.py`:

```python
from services.citation_verification import verify_ai_integration_citations
```

After `priority_guideline_usage` is computed:

```python
    verification_text = rewritten_revision_text or rewritten_answer
    citation_verification = await verify_ai_integration_citations(
        verification_text,
        reference_anchors,
        text_generator=text_generator,
    )
```

Add to response:

```python
        citation_verification=citation_verification,
```

Update existing fake generators that assert the main prompt so they handle the verifier context first:

```python
async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
    if context == "ai_integration_citation_verification":
        return '{"items":[]}'
    self.assertIn("原词条证据1｜引用标记：[0-79]", prompt)
    return "高钾血症急危重症需要紧急处理[0-79]。"
```

- [ ] **Step 4: Run backend AI integration tests**

Run:

```bash
python3 -m unittest tests.test_ai_integration -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/generator.py backend/tests/test_ai_integration.py
git commit -m "feat: attach citation verification to ai integration"
```

## Task 5: Frontend Types and Display Helpers

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/utils/citationVerification.ts`
- Create: `frontend/src/utils/citationVerification.test.mjs`

- [ ] **Step 1: Write failing frontend utility test**

Create `frontend/src/utils/citationVerification.test.mjs`:

```js
import assert from 'node:assert/strict'
import {
  getCitationVerificationDisplay,
  getCitationVerificationItemsForAnchor,
  getCitationVerificationPanelDisplay,
} from './citationVerification.ts'

const passed = getCitationVerificationDisplay({ status: 'passed', items: [], warnings: [] })
assert.equal(passed?.label, '引用核对通过')
assert.equal(passed?.tone, 'success')

const needsReview = getCitationVerificationDisplay({
  status: 'needs_review',
  items: [
    { citation_key: '1-3', anchor_key: '1-3', status: 'supported', sentence: '', source_label: '', quote: '', reason: '' },
    { citation_key: '1-4', anchor_key: '1-4', status: 'mismatch', sentence: '', source_label: '', quote: '', reason: '不匹配' },
  ],
  warnings: [],
})
assert.equal(needsReview?.label, '引用核对发现 1 处需人工确认')
assert.equal(needsReview?.tone, 'danger')

const items = getCitationVerificationItemsForAnchor({
  status: 'needs_review',
  warnings: [],
  items: [
    { citation_key: '1-47', anchor_key: '1-47~1', status: 'supported', sentence: 'A', source_label: '', quote: '', reason: 'A ok' },
    { citation_key: '1-47', anchor_key: '1-47~2', status: 'mismatch', sentence: 'B', source_label: '', quote: '', reason: 'B bad' },
  ],
}, { citation_key: '1-47', anchor_key: '1-47~2' })
assert.equal(items.length, 1)
assert.equal(items[0].reason, 'B bad')

const panel = getCitationVerificationPanelDisplay(items)
assert.equal(panel?.tone, 'danger')
assert.equal(panel?.label, '引用可能不匹配')

console.log('citationVerification utility tests passed')
```

- [ ] **Step 2: Run test to verify RED**

Run from `frontend/`:

```bash
node src/utils/citationVerification.test.mjs
```

Expected: FAIL because `citationVerification.ts` does not exist.

- [ ] **Step 3: Add frontend types**

In `frontend/src/types/index.ts`, near `PriorityGuidelineUsage`, add:

```ts
export type CitationVerificationStatus = 'passed' | 'needs_review' | 'not_run' | 'failed'
export type CitationVerificationItemStatus =
  | 'supported'
  | 'weak'
  | 'mismatch'
  | 'unverifiable'
  | 'unverified'

export interface CitationVerificationItem {
  citation_key: string
  anchor_key?: string
  sentence: string
  source_label: string
  quote: string
  status: CitationVerificationItemStatus
  reason: string
}

export interface CitationVerificationResult {
  status: CitationVerificationStatus
  items: CitationVerificationItem[]
  warnings?: string[]
}
```

Extend `AiIntegrationRecord`:

```ts
citationVerification?: CitationVerificationResult
```

- [ ] **Step 4: Implement utility helpers**

Create `frontend/src/utils/citationVerification.ts`:

```ts
import type { CitationVerificationItem, CitationVerificationResult, ReferenceAnchor } from '../types'

export type CitationVerificationTone = 'success' | 'warning' | 'danger' | 'neutral'

const REVIEW_STATUSES = new Set(['weak', 'mismatch', 'unverifiable', 'unverified'])
const STATUS_RANK: Record<string, number> = {
  mismatch: 4,
  weak: 3,
  unverifiable: 2,
  unverified: 1,
  supported: 0,
}

export function getCitationVerificationDisplay(result?: CitationVerificationResult | null) {
  if (!result || result.status === 'not_run') return null
  if (result.status === 'failed') {
    return { label: '引用核对未完成，请人工检查', tone: 'warning' as const, detail: (result.warnings ?? []).join('；') }
  }
  const reviewCount = (result.items ?? []).filter(item => REVIEW_STATUSES.has(item.status)).length
  if (reviewCount === 0) return { label: '引用核对通过', tone: 'success' as const }
  return { label: `引用核对发现 ${reviewCount} 处需人工确认`, tone: 'danger' as const }
}

export function getCitationVerificationItemsForAnchor(
  result: CitationVerificationResult | undefined | null,
  anchor: Pick<ReferenceAnchor, 'citation_key' | 'anchor_key'>,
): CitationVerificationItem[] {
  if (!result?.items?.length) return []
  const activeKey = anchor.anchor_key ?? anchor.citation_key
  const exact = result.items.filter(item => (item.anchor_key || item.citation_key) === activeKey)
  if (exact.length > 0) return exact
  return result.items.filter(item => item.citation_key === anchor.citation_key)
}

export function getCitationVerificationPanelDisplay(items: CitationVerificationItem[]) {
  if (items.length === 0) return null
  const worst = [...items].sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0))[0]
  if (worst.status === 'mismatch') return { label: '引用可能不匹配', tone: 'danger' as const }
  if (worst.status === 'weak') return { label: '引用支撑较弱', tone: 'warning' as const }
  if (worst.status === 'unverifiable' || worst.status === 'unverified') return { label: '引用无法判断', tone: 'warning' as const }
  return { label: '引用核对通过', tone: 'success' as const }
}
```

- [ ] **Step 5: Run utility test to verify GREEN**

Run:

```bash
node src/utils/citationVerification.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/utils/citationVerification.ts frontend/src/utils/citationVerification.test.mjs
git commit -m "feat: add citation verification frontend helpers"
```

## Task 6: Frontend AI Integration UI Wiring

**Files:**
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Modify: `frontend/src/components/StepAiIntegrationCitationPanel.test.mjs`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Write failing source-level component assertions**

Extend `frontend/src/components/StepAiIntegrationCitationPanel.test.mjs` with assertions:

```js
assert.match(
  stepSource,
  /citationVerification:\s*data\.citation_verification/,
  'AI integration records should save citation verification metadata from the backend',
)
assert.match(
  stepSource,
  /getCitationVerificationDisplay/,
  'AI integration history should compute a citation verification summary',
)
assert.match(
  stepSource,
  /citation-verification-status/,
  'AI integration history should render a citation verification status strip',
)
assert.match(
  stepSource,
  /getCitationVerificationItemsForAnchor/,
  'AI citation panel should receive verification items for the active anchor',
)
assert.match(
  stepSource,
  /verificationItems=\{activeCitationVerificationItems\}/,
  'AI citation panel should receive active citation verification items',
)
assert.match(
  stepSource,
  /citation-verification-panel/,
  'AI citation panel should render citation verification detail',
)
assert.match(
  cssSource,
  /\.citation-verification-status/,
  'citation verification status strip should have CSS',
)
assert.match(
  cssSource,
  /\.citation-verification-panel/,
  'citation verification panel detail should have CSS',
)
```

- [ ] **Step 2: Run component source test to verify RED**

Run from `frontend/`:

```bash
node src/components/StepAiIntegrationCitationPanel.test.mjs
```

Expected: FAIL because the component has no citation verification wiring.

- [ ] **Step 3: Update `StepAiIntegration.tsx`**

Imports:

```ts
import type { CitationVerificationItem } from '../types'
import {
  getCitationVerificationDisplay,
  getCitationVerificationItemsForAnchor,
  getCitationVerificationPanelDisplay,
} from '../utils/citationVerification'
```

Change `AiCitationPanel` props:

```tsx
function AiCitationPanel({
  anchor,
  verificationItems = [],
  onClose,
}: {
  anchor: ReferenceAnchor
  verificationItems?: CitationVerificationItem[]
  onClose: () => void
}) {
  const verificationDisplay = getCitationVerificationPanelDisplay(verificationItems)
  return (
    <aside className="citation-panel ai-integration-citation-panel" aria-label="引用定位">
      {/* keep the existing header and citation context rendering, then add the verification block below */}
    </aside>
  )
}
```

Inside the panel, below the quote/context block:

```tsx
{verificationDisplay && (
  <div className={`citation-verification-panel ${verificationDisplay.tone}`}>
    <div className="citation-verification-panel-title">
      <span className="material-symbols-outlined">fact_check</span>
      <span>{verificationDisplay.label}</span>
    </div>
    {verificationItems.map((item, index) => (
      <div key={`${item.anchor_key || item.citation_key}-${index}`} className="citation-verification-panel-item">
        {item.sentence && <div className="citation-verification-sentence">{item.sentence}</div>}
        {item.reason && <div className="citation-verification-reason">{item.reason}</div>}
      </div>
    ))}
  </div>
)}
```

When saving the record:

```ts
citationVerification: data.citation_verification,
```

Near `priorityGuidelineDisplay`:

```ts
const citationVerificationDisplay = getCitationVerificationDisplay(record.citationVerification)
```

Render after `priorityGuidelineDisplay`:

```tsx
{citationVerificationDisplay && (
  <div className={`citation-verification-status ${citationVerificationDisplay.tone}`}>
    <span className="material-symbols-outlined">fact_check</span>
    <span>{citationVerificationDisplay.label}</span>
    {citationVerificationDisplay.detail && <small>{citationVerificationDisplay.detail}</small>}
  </div>
)}
```

Compute active panel items:

```ts
const activeCitationVerificationItems = useMemo(
  () => activeCitation && activeRecord
    ? getCitationVerificationItemsForAnchor(activeRecord.citationVerification, activeCitation)
    : [],
  [activeCitation, activeRecord],
)
```

Pass:

```tsx
<AiCitationPanel
  anchor={activeCitation}
  verificationItems={activeCitationVerificationItems}
  onClose={() => setActiveCitationKey(null)}
/>
```

- [ ] **Step 4: Add CSS**

Add near existing AI integration citation panel styles:

```css
.citation-verification-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  border: 0.5px solid var(--dui-divider);
  background: var(--m3-surface-container-low);
  font-size: 12px;
  color: var(--m3-on-surface);
}
.citation-verification-status.success { background: var(--dui-success-container); color: var(--dui-success); }
.citation-verification-status.warning { background: var(--dui-warning-container); color: var(--dui-warning); }
.citation-verification-status.danger { background: var(--dui-danger-container); color: var(--dui-danger); }
.citation-verification-status small { color: inherit; opacity: 0.82; }

.citation-verification-panel {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 0.5px solid var(--dui-divider);
  background: var(--m3-surface-container-low);
}
.citation-verification-panel.success { background: var(--dui-success-container); color: var(--dui-success); }
.citation-verification-panel.warning { background: var(--dui-warning-container); color: var(--dui-warning); }
.citation-verification-panel.danger { background: var(--dui-danger-container); color: var(--dui-danger); }
.citation-verification-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}
.citation-verification-panel-item {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
}
.citation-verification-sentence {
  color: var(--m3-on-surface);
}
.citation-verification-reason {
  margin-top: 3px;
  color: inherit;
}
```

- [ ] **Step 5: Run component source test to verify GREEN**

Run:

```bash
node src/components/StepAiIntegrationCitationPanel.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/StepAiIntegration.tsx frontend/src/components/StepAiIntegrationCitationPanel.test.mjs frontend/src/index.css
git commit -m "feat: show ai integration citation verification"
```

## Task 7: Final Verification

**Files:**
- Verify all modified backend and frontend files.

- [ ] **Step 1: Run focused backend tests**

Run from `backend/`:

```bash
python3 -m unittest tests.test_citation_verification tests.test_ai_integration -v
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend source tests**

Run from `frontend/`:

```bash
node src/utils/citationVerification.test.mjs
node src/components/StepAiIntegrationCitationPanel.test.mjs
```

Expected: both PASS.

- [ ] **Step 3: Run frontend build**

Run from `frontend/`:

```bash
npm run build
```

Expected: PASS with TypeScript and Vite build complete.

- [ ] **Step 4: Inspect git diff**

Run from repo root:

```bash
git status --short
git diff --stat
```

Expected: only intentional files are modified.

- [ ] **Step 5: Final commit if needed**

If previous task commits were made exactly as written and `git status --short` is clean, skip this step. If final verification fixes left uncommitted changes, commit only those changes:

```bash
git add backend/models.py backend/services/citation_verification.py backend/services/generator.py backend/tests/test_citation_verification.py backend/tests/test_ai_integration.py frontend/src/types/index.ts frontend/src/utils/citationVerification.ts frontend/src/utils/citationVerification.test.mjs frontend/src/components/StepAiIntegration.tsx frontend/src/components/StepAiIntegrationCitationPanel.test.mjs frontend/src/index.css
git commit -m "feat: verify ai integration citations"
```
