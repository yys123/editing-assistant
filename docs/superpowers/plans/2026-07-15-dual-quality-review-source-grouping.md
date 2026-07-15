# Dual Quality Review Source Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second common-content review pass to content quality review and show both review sources as grouped issues.

**Architecture:** Keep the existing section quality review as the primary guideline review path, then append a bounded common review pass that only inspects section text. Preserve the existing `SectionAnalysis.issues` API shape by adding an optional/defaulted `review_source` field, then group by that field in the review UI and carry it into AI integration issue text/history.

**Tech Stack:** FastAPI, Pydantic, Python `unittest`, React 18, TypeScript, existing Node strip-types utility tests, Vite build.

---

## Execution Preconditions

- Use `@using-git-worktrees` before implementation if the main workspace has unrelated edits.
- Before the first implementation edit, run `git rev-parse HEAD` and record the value as `IMPLEMENTATION_BASE_COMMIT`.
- Use `@test-driven-development` for every behavior change: write the failing test, run it, implement the minimum code, then run it green.
- Consult the approved spec: `docs/superpowers/specs/2026-07-15-dual-quality-review-source-grouping-design.md`.
- Do not change the outer shape of `/api/analyze/section`; it still returns `SectionAnalysis` with an `issues` array.
- Do not make the common review use uploaded references, priority guides, confirmed chunks, quality standard text, or content spec text.
- Keep commits focused. Do not revert unrelated user changes.

## File Structure

### Backend

- Modify `backend/models.py`
  - Own the new `SectionIssue.review_source` default field.
- Modify `backend/services/analyzer.py`
  - Own review source constants, source tagging, common review prompt, common review chunking, common review failure fallback, cross-source dedupe, and combined summary.
- Modify `backend/tests/test_analyzer.py`
  - Own focused tests for source defaults, common prompt isolation, source tagging, fallback, long-section chunking, and cross-source dedupe.
- Optionally modify `backend/tests/test_issue_anchors.py`
  - Only if the implementation changes anchor filtering behavior.

### Frontend

- Modify `frontend/src/types/index.ts`
  - Own optional `review_source` on `SectionIssue` and `AiIntegrationLinkedIssue`.
- Create `frontend/src/utils/reviewSources.ts`
  - Own source labels, legacy defaulting, grouping, counts, and guideline-evidence warning rules.
- Create `frontend/src/utils/reviewSources.test.mjs`
  - Own pure tests for grouping, counts, defaults, and common-review warning behavior.
- Modify `frontend/src/components/StepSectionAnalysis.tsx`
  - Own grouped rendering under each section while preserving current issue-card controls.
- Modify `frontend/src/utils/aiIntegrationIssues.ts`
  - Own propagation of `review_source` into linked issues and request text.
- Modify `frontend/src/utils/aiIntegrationIssues.test.mjs`
  - Own tests for source propagation and `【来源】` request lines.
- Modify `frontend/src/components/StepAiIntegration.tsx`
  - Own visible source labels in selected issue panels and history.
- Modify `frontend/src/components/StepExpertReview.tsx`
  - Own default `review_source` for manually added issues if they construct `SectionIssue` objects.

---

### Task 1: Add Review Source To Shared Issue Models

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/services/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Write the failing backend model/default test**

Add to `backend/tests/test_analyzer.py`:

```python
class SectionIssueReviewSourceTests(unittest.TestCase):
    def test_section_issue_defaults_to_guideline_review_source(self):
        issue = SectionIssue(
            issue_type="style",
            description="术语不统一。",
            severity="low",
        )

        self.assertEqual(issue.review_source, "guideline_review")

    def test_build_section_issue_preserves_review_source(self):
        issue = analyzer._build_section_issue({
            "issue_type": "accuracy",
            "description": "用量单位疑似错误。",
            "severity": "medium",
            "review_source": "common_review",
        })

        self.assertEqual(issue.review_source, "common_review")
```

- [ ] **Step 2: Run the backend test and verify RED**

Run:

```bash
PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_analyzer.SectionIssueReviewSourceTests -v
```

Expected: FAIL because `SectionIssue.review_source` does not exist or `_build_section_issue` does not preserve it.

- [ ] **Step 3: Add the backend field and constants**

In `backend/models.py`, add:

```python
review_source: str = "guideline_review"  # guideline_review/common_review
```

In `backend/services/analyzer.py`, add near constants:

```python
GUIDELINE_REVIEW_SOURCE = "guideline_review"
COMMON_REVIEW_SOURCE = "common_review"


def _mark_review_source(issues: List[SectionIssue], source: str) -> List[SectionIssue]:
    for issue in issues:
        issue.review_source = source
    return issues
```

Update `_build_section_issue()` so it passes:

```python
review_source=item.get("review_source", GUIDELINE_REVIEW_SOURCE),
```

- [ ] **Step 4: Add frontend optional types**

In `frontend/src/types/index.ts`, add:

```ts
export type ReviewSource = 'guideline_review' | 'common_review'
```

Add `review_source?: ReviewSource | string` to `SectionIssue` and `AiIntegrationLinkedIssue`.

- [ ] **Step 5: Run the backend test and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/models.py backend/services/analyzer.py backend/tests/test_analyzer.py frontend/src/types/index.ts
git commit -m "feat: add quality review source field"
```

---

### Task 2: Add The Common Review Prompt Boundary

**Files:**
- Modify: `backend/services/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing prompt-isolation and tagging tests**

Add to `backend/tests/test_analyzer.py`:

```python
class CommonContentReviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_common_review_does_not_include_guideline_or_standard_inputs(self):
        prompts = {}

        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            prompts[context] = prompt
            return {
                "common_review_summary": "发现一处重复表述。",
                "issues": [{
                    "issue_type": "style",
                    "description": "同一句治疗建议重复出现。",
                    "severity": "low",
                    "examples": ["重复治疗建议"],
                    "anchors": [{"quote": "重复治疗建议", "heading_hint": "治疗"}],
                    "deduction_score": 0.5,
                    "is_key_content": False,
                }],
            }

        section = ArticleSection(
            id="s1",
            heading="治疗",
            content="重复治疗建议。重复治疗建议。",
            word_count=14,
            level=1,
        )

        with patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            issues, summary = await analyzer._review_common_content_issues(
                "测试疾病",
                section,
                article_outline=["治疗"],
            )

        self.assertIn("section_common_review", prompts)
        self.assertNotIn("参考数据源", prompts["section_common_review"])
        self.assertNotIn("质量标准", prompts["section_common_review"])
        self.assertNotIn("内容规范", prompts["section_common_review"])
        self.assertEqual(summary, "发现一处重复表述。")
        self.assertEqual(issues[0].review_source, "common_review")
        self.assertEqual(issues[0].issue_type, "style")
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_analyzer.CommonContentReviewTests.test_common_review_does_not_include_guideline_or_standard_inputs -v
```

Expected: FAIL because `_review_common_content_issues` does not exist.

- [ ] **Step 3: Implement `_review_common_content_issues()` for short sections**

Add helper functions in `backend/services/analyzer.py` near other section review helpers:

```python
COMMON_REVIEW_OUTPUT_LIMIT = 10


def _build_article_outline_block(article_outline: Optional[List[str]]) -> str:
    if not article_outline:
        return ""
    return "\n\n## 完整词条一级章节大纲\n" + "\n".join(f"- {heading}" for heading in article_outline)
```

Then implement:

```python
async def _review_common_content_issues(
    disease: str,
    section: ArticleSection,
    article_outline: Optional[List[str]] = None,
) -> Tuple[List[SectionIssue], str]:
    prompt = f"""请对【{disease}】知识库词条「{section.heading}」章节做一次通用内容巡检。

## 章节原文内容
{section.content[:SECTION_PROMPT_MAX_CHARS]}
{_build_article_outline_block(article_outline)}

本次巡检不使用上传指南数据。只检查章节原文中可定位的常见问题：
1. 错别字、别字、明显病句、标点或单位书写异常
2. 内容重复、段落重复、同一观点反复出现
3. 前后矛盾，例如适应证、禁忌证、年龄、人群、频次等描述不一致
4. 表达不清或临床表述不合理
5. 药物名称、用法、用量、给药频次、疗程、单位等明显风险

严格约束：
- 不得把上传指南缺失当作问题
- 不得因为没有看到指南依据而报告内容缺失
- 对复杂医学争议、指南版本差异、需要最新证据才能判断的问题，只能在描述中提示建议人工核对，不得输出为确定错误
- accuracy/style/outdated/structure 问题必须提供 anchors，quote 必须逐字摘录自章节原文
- 药物用法用量问题必须说明风险点；若只是疑似问题，severity 不超过 medium
- 最多输出{COMMON_REVIEW_OUTPUT_LIMIT}条最重要、最可定位的问题

以JSON格式输出：
{{
  "common_review_summary": "通用巡检摘要",
  "issues": [
    {{
      "issue_type": "style",
      "description": "具体问题描述",
      "severity": "low",
      "examples": ["原文片段或说明"],
      "anchors": [
        {{"quote": "章节原文中的连续片段", "heading_hint": "所在小标题，可为空"}}
      ],
      "deduction_score": 0.5,
      "is_key_content": false
    }}
  ]
}}

issue_type取值：accuracy / outdated / structure / style。只有本章节已写内容因位置造成误解时才使用structure。若无问题，输出 {{"common_review_summary": "未发现通用巡检问题。", "issues": []}}"""

    data = await generate_json(
        prompt,
        SYSTEM_PROMPT,
        context="section_common_review",
        text_generator=generate_text,
    )
    issues = [_build_section_issue(item) for item in data.get("issues", []) if isinstance(item, dict)]
    _mark_review_source(issues, COMMON_REVIEW_SOURCE)
    return issues, data.get("common_review_summary") or "通用巡检完成。"
```

- [ ] **Step 4: Run the prompt-isolation test and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: add common content review prompt"
```

---

### Task 3: Support Common Review Chunking And Deduplication

**Files:**
- Modify: `backend/services/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing long-section chunking test**

Add to `CommonContentReviewTests`:

```python
    async def test_common_review_reuses_section_chunking_for_long_sections(self):
        contexts = []

        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            contexts.append(context)
            return {
                "common_review_summary": "分块巡检完成。",
                "issues": [{
                    "issue_type": "style",
                    "description": "重复表达。",
                    "severity": "low",
                    "examples": ["重复表达"],
                    "anchors": [{"quote": "重复表达", "heading_hint": "治疗"}],
                    "deduction_score": 0.5,
                    "is_key_content": False,
                }],
            }

        section = ArticleSection(
            id="s1",
            heading="治疗",
            content=("重复表达。\n\n" + "长正文。" * 30000),
            word_count=130000,
            level=1,
        )

        with patch.object(analyzer, "CHUNK_THRESHOLD", 1000), \
             patch.object(analyzer, "CHUNK_SIZE", 700), \
             patch.object(analyzer, "CHUNK_OVERLAP", 50), \
             patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            issues, summary = await analyzer._review_common_content_issues(
                "测试疾病",
                section,
                article_outline=["治疗"],
            )

        self.assertGreater(contexts.count("section_common_review"), 1)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].review_source, "common_review")
        self.assertIn("分块巡检", summary)
```

- [ ] **Step 2: Run the long-section test and verify RED**

Run:

```bash
PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_analyzer.CommonContentReviewTests.test_common_review_reuses_section_chunking_for_long_sections -v
```

Expected: FAIL because common review currently only runs once.

- [ ] **Step 3: Extract a chunk helper**

Refactor the prompt body into:

```python
async def _review_common_content_chunk(
    disease: str,
    section: ArticleSection,
    article_outline: Optional[List[str]],
    chunk_note: str = "",
) -> Tuple[List[SectionIssue], str]:
    ...
```

Include `chunk_note` in the prompt:

```python
chunk_note_text = f"\n\n提示：{chunk_note}" if chunk_note else ""
```

For long sections, `_review_common_content_issues()` should:

1. Split with `_split_into_chunks(section.content, CHUNK_SIZE, CHUNK_OVERLAP)`.
2. Create chunk `ArticleSection` objects.
3. Call `_review_common_content_chunk()` for each chunk with `第{i}/{total}段`.
4. Concatenate summaries.
5. Deduplicate with `_dedupe_common_issues()`.

- [ ] **Step 4: Implement deterministic common dedupe**

Add:

```python
def _primary_anchor_key(issue: SectionIssue) -> str:
    for anchor in issue.anchors or []:
        if anchor.quote:
            return re.sub(r"\s+", "", anchor.quote)
    return ""


def _dedupe_common_issues(issues: List[SectionIssue]) -> List[SectionIssue]:
    kept: List[SectionIssue] = []
    seen: set[tuple[str, str]] = set()
    for issue in issues:
        anchor_key = _primary_anchor_key(issue)
        key = (issue.issue_type, anchor_key or re.sub(r"\s+", "", issue.description or "")[:80])
        if key in seen:
            continue
        seen.add(key)
        kept.append(issue)
    return kept
```

- [ ] **Step 5: Run the long-section test and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/services/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: chunk common content review"
```

---

### Task 4: Wire Both Review Sources Into `analyze_section`

**Files:**
- Modify: `backend/services/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing integration test for successful dual review**

Add to `CommonContentReviewTests`:

```python
    async def test_analyze_section_returns_guideline_and_common_review_issues(self):
        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            if context == "section_analysis":
                return {"issues": [{
                    "issue_type": "missing_content",
                    "description": "缺少诊断标准。",
                    "severity": "high",
                    "examples": [],
                    "anchors": [{"quote": "诊断", "heading_hint": "诊断"}],
                    "guideline_evidence": [{
                        "source": "参考数据源 1：指南",
                        "quote": "诊断标准应包括A。",
                        "relevance": "支持缺失判断。",
                    }],
                    "deduction_score": 3.0,
                    "is_key_content": True,
                }]}
            if context == "section_issue_verify":
                return {"verification_summary": "指南评审问题属实。", "issues": [{
                    "issue_type": "missing_content",
                    "description": "缺少诊断标准。",
                    "severity": "high",
                    "examples": [],
                    "anchors": [{"quote": "诊断", "heading_hint": "诊断"}],
                    "guideline_evidence": [{
                        "source": "参考数据源 1：指南",
                        "quote": "诊断标准应包括A。",
                        "relevance": "支持缺失判断。",
                    }],
                    "deduction_score": 3.0,
                    "is_key_content": True,
                }]}
            if context == "section_common_review":
                return {"common_review_summary": "发现错别字。", "issues": [{
                    "issue_type": "style",
                    "description": "“诊段”疑似错别字。",
                    "severity": "low",
                    "examples": ["诊段"],
                    "anchors": [{"quote": "诊段", "heading_hint": "诊断"}],
                    "deduction_score": 0.5,
                    "is_key_content": False,
                }]}
            return {"issues": []}

        section = ArticleSection(
            id="s1",
            heading="诊断",
            content="诊断内容。诊段。",
            word_count=8,
            level=1,
        )

        with patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            result = await analyzer.analyze_section(
                "测试疾病",
                section,
                "质量标准",
                "内容规范",
                ["### 参考数据源 1：指南\n诊断标准应包括A。"],
            )

        self.assertEqual(
            [issue.review_source for issue in result.issues],
            ["guideline_review", "common_review"],
        )
        self.assertIn("指南评审", result.verification_summary)
        self.assertIn("通用巡检", result.verification_summary)
```

- [ ] **Step 2: Write failing fallback test**

Add:

```python
    async def test_common_review_failure_returns_guideline_review_with_summary_warning(self):
        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            if context == "section_analysis":
                return {"issues": [{
                    "issue_type": "style",
                    "description": "术语不统一。",
                    "severity": "low",
                    "examples": ["HbA1c"],
                    "anchors": [{"quote": "HbA1c", "heading_hint": "诊断"}],
                    "deduction_score": 0.5,
                    "is_key_content": False,
                }]}
            if context == "section_issue_verify":
                return {"verification_summary": "指南评审问题属实。", "issues": [{
                    "issue_type": "style",
                    "description": "术语不统一。",
                    "severity": "low",
                    "examples": ["HbA1c"],
                    "anchors": [{"quote": "HbA1c", "heading_hint": "诊断"}],
                    "deduction_score": 0.5,
                    "is_key_content": False,
                }]}
            if context == "section_common_review":
                raise RuntimeError("common review failed")
            return {"issues": []}

        section = ArticleSection(id="s1", heading="诊断", content="HbA1c。", word_count=6, level=1)

        with patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            result = await analyzer.analyze_section("糖尿病", section, "质量标准", "内容规范", [])

        self.assertEqual(len(result.issues), 1)
        self.assertEqual(result.issues[0].review_source, "guideline_review")
        self.assertIn("通用巡检失败", result.verification_summary)
```

- [ ] **Step 3: Write failing test for guideline-clean sections**

Add:

```python
    async def test_analyze_section_runs_common_review_when_guideline_review_is_empty(self):
        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            if context == "section_analysis":
                return {"issues": []}
            if context == "section_common_review":
                return {"common_review_summary": "发现错别字。", "issues": [{
                    "issue_type": "style",
                    "description": "“诊段”疑似错别字。",
                    "severity": "low",
                    "examples": ["诊段"],
                    "anchors": [{"quote": "诊段", "heading_hint": "诊断"}],
                    "deduction_score": 0.5,
                    "is_key_content": False,
                }]}
            return {"issues": []}

        section = ArticleSection(
            id="s1",
            heading="诊断",
            content="诊段。",
            word_count=3,
            level=1,
        )

        with patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            result = await analyzer.analyze_section("测试疾病", section, "质量标准", "内容规范", [])

        self.assertEqual(len(result.issues), 1)
        self.assertEqual(result.issues[0].review_source, "common_review")
        self.assertIn("指南评审：核验后保留 0 项", result.verification_summary)
        self.assertIn("通用巡检：补充发现 1 项", result.verification_summary)
```

- [ ] **Step 4: Write failing cross-source dedupe test**

Add to `backend/tests/test_analyzer.py`:

```python
class CrossSourceIssueDedupeTests(unittest.TestCase):
    def test_cross_source_dedupe_prefers_guideline_issue_with_same_anchor(self):
        guideline_issue = SectionIssue(
            issue_type="accuracy",
            description="剂量与指南不一致。",
            severity="high",
            anchors=[analyzer.IssueAnchor(quote="每日 500 mg", heading_hint="治疗")],
            guideline_evidence=[analyzer.GuidelineEvidence(
                source="参考数据源 1：指南",
                quote="推荐每日 250 mg。",
                relevance="证明剂量不一致。",
            )],
            review_source="guideline_review",
        )
        common_issue = SectionIssue(
            issue_type="accuracy",
            description="每日 500 mg 疑似剂量风险，建议人工核对。",
            severity="medium",
            anchors=[analyzer.IssueAnchor(quote="每日 500 mg", heading_hint="治疗")],
            review_source="common_review",
        )

        issues, removed = analyzer._dedupe_cross_source_issues([guideline_issue], [common_issue])

        self.assertEqual(removed, 1)
        self.assertEqual(issues, [guideline_issue])
```

- [ ] **Step 5: Run integration and dedupe tests and verify RED**

Run:

```bash
PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_analyzer.CommonContentReviewTests.test_analyze_section_returns_guideline_and_common_review_issues \
  backend.tests.test_analyzer.CommonContentReviewTests.test_common_review_failure_returns_guideline_review_with_summary_warning \
  backend.tests.test_analyzer.CommonContentReviewTests.test_analyze_section_runs_common_review_when_guideline_review_is_empty \
  backend.tests.test_analyzer.CrossSourceIssueDedupeTests -v
```

Expected: FAIL because `analyze_section()` does not call common review and `_dedupe_cross_source_issues()` does not exist.

- [ ] **Step 6: Add source-aware finalization helpers**

Add in `backend/services/analyzer.py`:

```python
def _filter_section_issues(
    issues: List[SectionIssue],
    section_content: str,
    evidence_reference_texts: List[str],
) -> List[SectionIssue]:
    issues = _drop_false_table_body_missing_issues(issues, section_content)
    issues = _drop_false_covered_missing_content_issues(issues, section_content)
    issues = _drop_false_numbering_and_reference_style_issues(issues, section_content)
    issues = _drop_false_rome_v_unpublished_issues(issues, evidence_reference_texts)
    _attach_issue_anchors(issues, section_content)
    issues = _drop_false_abbreviation_full_name_issues(issues)
    issues = _drop_unlocated_required_anchor_issues(issues)
    return issues


def _dedupe_cross_source_issues(
    guideline_issues: List[SectionIssue],
    common_issues: List[SectionIssue],
) -> Tuple[List[SectionIssue], int]:
    kept_common: List[SectionIssue] = []
    removed = 0
    guideline_keys = {(issue.issue_type, _primary_anchor_key(issue)) for issue in guideline_issues if _primary_anchor_key(issue)}
    for issue in common_issues:
        key = (issue.issue_type, _primary_anchor_key(issue))
        if key[1] and key in guideline_keys:
            removed += 1
            continue
        kept_common.append(issue)
    return [*guideline_issues, *kept_common], removed


def _combined_review_summary(
    guideline_summary: str,
    guideline_count: int,
    common_summary: str,
    common_count: int,
    duplicate_count: int = 0,
    common_failed: bool = False,
) -> str:
    parts = [
        f"指南评审：核验后保留 {guideline_count} 项。" + (f" {guideline_summary}" if guideline_summary else ""),
    ]
    if common_failed:
        parts.append("通用巡检失败，建议重新分析该章节。")
    else:
        parts.append(f"通用巡检：补充发现 {common_count} 项。" + (f" {common_summary}" if common_summary else ""))
        parts.append(f"合并去重：删除 {duplicate_count} 项重复问题，最终保留 {guideline_count + common_count - duplicate_count} 项。")
    return "\n".join(parts)
```

Keep `_drop_out_of_scope_disease_issues()` in the guideline path before final cross-source merge, because it is disease-specific and currently used by existing guideline review. Apply common filtering without guideline-source evidence sanitization.

- [ ] **Step 7: Wire normal and long-section paths**

In both branches of `analyze_section()`:

1. After guideline review is verified/filtered, call `_mark_review_source(guideline_issues, GUIDELINE_REVIEW_SOURCE)`.
2. Run `_review_common_content_issues()` in `try/except`.
3. Filter common issues with `_filter_section_issues(common_issues, section.content, evidence_reference_texts)`.
4. Run `_dedupe_cross_source_issues()`.
5. Return combined issues and `_combined_review_summary(...)`.

Preserve current behavior when guideline review fails: the exception still propagates to the router.

Important: remove or bypass the existing early return that returns `SectionAnalysis(..., issues=[])` when guideline review finds no issues. A guideline-clean section still must run common review and may return common-review issues.

For summary counts, pass the pre-dedupe common issue count into `_combined_review_summary()` and pass the duplicate count returned by `_dedupe_cross_source_issues()`. This keeps “通用巡检：补充发现 Y 项” as the raw common-review finding count and “最终保留 N 项” as the post-dedupe total.

- [ ] **Step 8: Run integration and dedupe tests and verify GREEN**

Run the command from Step 5.

Expected: PASS.

- [ ] **Step 9: Run broader backend analyzer tests**

Run:

```bash
PYTHONPATH=backend python3 -m unittest backend.tests.test_analyzer -v
```

Expected: PASS. If unrelated failures appear, document them before proceeding.

- [ ] **Step 10: Commit**

```bash
git add backend/services/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: combine guideline and common section reviews"
```

---

### Task 5: Add Frontend Review Source Utilities

**Files:**
- Create: `frontend/src/utils/reviewSources.ts`
- Create: `frontend/src/utils/reviewSources.test.mjs`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Write failing utility tests**

Create `frontend/src/utils/reviewSources.test.mjs`:

```js
import assert from 'node:assert/strict'
import {
  groupIssuesByReviewSource,
  reviewSourceLabel,
  shouldShowGuidelineEvidenceWarning,
} from './reviewSources.ts'

const issues = [
  { id: 'old', issue_type: 'accuracy', status: 'ai', severity: 'high', description: '旧数据', examples: [] },
  { id: 'guide-rejected', review_source: 'guideline_review', issue_type: 'style', status: 'rejected', severity: 'low', description: '排除项', examples: [] },
  { id: 'common', review_source: 'common_review', issue_type: 'accuracy', status: 'ai', severity: 'medium', description: '通用巡检项', examples: [] },
]

const groups = groupIssuesByReviewSource(issues)

assert.equal(reviewSourceLabel('guideline_review'), '指南评审')
assert.equal(reviewSourceLabel('common_review'), '通用巡检')
assert.deepEqual(groups.map(group => group.source), ['guideline_review', 'common_review'])
assert.deepEqual(groups[0].issues.map(issue => issue.id), ['old', 'guide-rejected'])
assert.equal(groups[0].activeCount, 1)
assert.equal(groups[0].totalCount, 2)
assert.equal(groups[1].activeCount, 1)
assert.equal(groups[1].title, '通用巡检 1 项')
assert.equal(shouldShowGuidelineEvidenceWarning(issues[0]), true)
assert.equal(shouldShowGuidelineEvidenceWarning(issues[2]), false)

console.log('review source tests passed')
```

- [ ] **Step 2: Run utility test and verify RED**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/reviewSources.test.mjs
```

Expected: FAIL because `reviewSources.ts` does not exist.

- [ ] **Step 3: Implement `reviewSources.ts`**

```ts
import type { ReviewSource, SectionIssue } from '../types'

export const GUIDELINE_REVIEW_SOURCE = 'guideline_review' as const
export const COMMON_REVIEW_SOURCE = 'common_review' as const

export type ReviewSourceGroup = {
  source: ReviewSource
  label: string
  title: string
  issues: SectionIssue[]
  activeCount: number
  totalCount: number
}

export function reviewSourceOfIssue(issue: Pick<SectionIssue, 'review_source'>): ReviewSource {
  return issue.review_source === COMMON_REVIEW_SOURCE ? COMMON_REVIEW_SOURCE : GUIDELINE_REVIEW_SOURCE
}

export function reviewSourceLabel(source: string | undefined): string {
  return source === COMMON_REVIEW_SOURCE ? '通用巡检' : '指南评审'
}

export function groupIssuesByReviewSource(issues: SectionIssue[]): ReviewSourceGroup[] {
  const sources: ReviewSource[] = [GUIDELINE_REVIEW_SOURCE, COMMON_REVIEW_SOURCE]
  return sources.map(source => {
    const grouped = issues.filter(issue => reviewSourceOfIssue(issue) === source)
    const activeCount = grouped.filter(issue => issue.status !== 'rejected').length
    const label = reviewSourceLabel(source)
    return {
      source,
      label,
      title: grouped.length > activeCount ? `${label} ${activeCount}/${grouped.length} 项` : `${label} ${activeCount} 项`,
      issues: grouped,
      activeCount,
      totalCount: grouped.length,
    }
  })
}

export function shouldShowGuidelineEvidenceWarning(issue: SectionIssue): boolean {
  return reviewSourceOfIssue(issue) === GUIDELINE_REVIEW_SOURCE
    && ['missing_content', 'accuracy', 'outdated'].includes(issue.issue_type)
    && (issue.guideline_evidence ?? []).length === 0
}
```

- [ ] **Step 4: Run utility test and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/utils/reviewSources.ts frontend/src/utils/reviewSources.test.mjs
git commit -m "feat: add review source utilities"
```

---

### Task 6: Group Issues In The Section Review UI

**Files:**
- Modify: `frontend/src/components/StepSectionAnalysis.tsx`
- Modify: `frontend/src/utils/reviewSources.test.mjs`

- [ ] **Step 1: Add a pure rendering-data test**

Extend `frontend/src/utils/reviewSources.test.mjs` to verify empty groups remain available:

```js
const onlyGuideGroups = groupIssuesByReviewSource([
  { id: 'guide', review_source: 'guideline_review', issue_type: 'style', status: 'ai', severity: 'low', description: '术语', examples: [] },
])

assert.deepEqual(onlyGuideGroups.map(group => group.title), ['指南评审 1 项', '通用巡检 0 项'])
assert.equal(onlyGuideGroups[1].issues.length, 0)
```

- [ ] **Step 2: Run test and verify current behavior**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/reviewSources.test.mjs
```

Expected: PASS if Task 5 implementation already includes empty source groups. If it fails, adjust `groupIssuesByReviewSource()` before touching UI.

- [ ] **Step 3: Import grouping helpers**

In `frontend/src/components/StepSectionAnalysis.tsx`, import:

```ts
import { groupIssuesByReviewSource, shouldShowGuidelineEvidenceWarning } from '../utils/reviewSources'
```

- [ ] **Step 4: Replace inline guideline evidence warning logic**

In both issue-list rendering locations, replace:

```ts
const shouldShowGuidelineEvidence = ['missing_content', 'accuracy', 'outdated'].includes(issue.issue_type)
```

with:

```ts
const shouldShowGuidelineEvidence = ['missing_content', 'accuracy', 'outdated'].includes(issue.issue_type)
const shouldShowMissingEvidenceWarning = shouldShowGuidelineEvidenceWarning(issue)
```

Then render the “未提供指南原文依据” warning only when `shouldShowMissingEvidenceWarning` is true. Still render existing evidence cards when `guidelineEvidence.length > 0`.

- [ ] **Step 5: Group the desktop issue list**

Where the desktop view currently maps `allIssues.map(...)`, replace the outer map with:

```tsx
{groupIssuesByReviewSource(allIssues).map(sourceGroup => (
  <div key={sourceGroup.source} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <div style={{ fontSize: reviewFontScale.supportingText, fontWeight: 600, color: 'var(--gray-600)', padding: '4px 2px' }}>
      {sourceGroup.title}
    </div>
    {sourceGroup.issues.length === 0 ? (
      <div style={{ fontSize: reviewFontScale.supportingText, color: 'var(--gray-400)', padding: '6px 2px' }}>
        未发现{sourceGroup.label}问题
      </div>
    ) : (
      sourceGroup.issues.map((issue, j) => /* existing issue card */)
    )}
  </div>
))}
```

Keep the existing issue card body intact; only wrap it in groups.

- [ ] **Step 6: Group the fullscreen/mobile issue list**

Apply the same grouping pattern to the second `allIssues.map(...)` block later in `StepSectionAnalysis.tsx`.

- [ ] **Step 7: Run frontend utility tests**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/reviewSources.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Run TypeScript build check**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/StepSectionAnalysis.tsx frontend/src/utils/reviewSources.test.mjs
git commit -m "feat: group section review issues by source"
```

---

### Task 7: Carry Review Sources Into AI Integration

**Files:**
- Modify: `frontend/src/utils/aiIntegrationIssues.ts`
- Modify: `frontend/src/utils/aiIntegrationIssues.test.mjs`
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Modify: `frontend/src/components/StepExpertReview.tsx`

- [ ] **Step 1: Write failing AI integration utility tests**

Extend the first `sectionAnalyses` fixture in `frontend/src/utils/aiIntegrationIssues.test.mjs`:

```js
review_source: 'common_review',
```

on one confirmed or added issue. Add assertions:

```js
assert.equal(linkedIssues[0].review_source, 'common_review')

const sourceRequest = buildAiIntegrationIssueRequest([linkedIssues[0]])
assert.match(sourceRequest, /【来源】通用巡检/)
```

Also add a legacy issue without `review_source` and assert request includes `【来源】指南评审`.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/aiIntegrationIssues.test.mjs
```

Expected: FAIL because linked issues do not carry `review_source` and request text lacks source lines.

- [ ] **Step 3: Preserve review source in linked issues**

In `frontend/src/utils/aiIntegrationIssues.ts`, import:

```ts
import { reviewSourceLabel, reviewSourceOfIssue } from './reviewSources'
```

In `collectAiIntegrationLinkedIssues()`, add:

```ts
review_source: reviewSourceOfIssue(issue),
```

In `buildAiIntegrationIssueRequest()`, add after `【章节】`:

```ts
`   【来源】${reviewSourceLabel(issue.review_source)}`,
```

- [ ] **Step 4: Show source labels in AI integration UI**

In `frontend/src/components/StepAiIntegration.tsx`, import `reviewSourceLabel` and show a small source label wherever linked quality issues are listed:

```tsx
<span>{reviewSourceLabel(issue.review_source)}</span>
```

Apply this to:

- The selectable quality review issue panel.
- The selected issue preview area.
- The history linked issue summary.

- [ ] **Step 5: Default manually added expert-review issues**

In `frontend/src/components/StepExpertReview.tsx`, when constructing a new `SectionIssue`, set:

```ts
review_source: 'guideline_review',
```

- [ ] **Step 6: Run AI integration utility test and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 7: Run related frontend utility tests**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/reviewSources.test.mjs
cd frontend && node --experimental-strip-types src/utils/aiIntegrationIssues.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/utils/aiIntegrationIssues.ts frontend/src/utils/aiIntegrationIssues.test.mjs frontend/src/components/StepAiIntegration.tsx frontend/src/components/StepExpertReview.tsx
git commit -m "feat: include review source in AI integration issues"
```

---

### Task 8: Full Verification And Regression Pass

**Files:**
- Existing backend and frontend tests/build.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_analyzer \
  backend.tests.test_issue_anchors \
  backend.tests.test_text_llm -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend focused tests**

Run:

```bash
cd frontend && node --experimental-strip-types src/utils/reviewSources.test.mjs
cd frontend && node --experimental-strip-types src/utils/aiIntegrationIssues.test.mjs
cd frontend && node --experimental-strip-types src/utils/issueAnchors.test.mjs
cd frontend && node --experimental-strip-types src/utils/sectionAnalysisCompatibility.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git log --oneline --decorate -12
git diff --stat <IMPLEMENTATION_BASE_COMMIT>..HEAD
```

Expected: clean working tree, with changes limited to backend review logic/tests, frontend review source grouping, AI integration issue source labels, and this plan if not already committed.

- [ ] **Step 5: Final commit if verification required small fixes**

If verification required additional fixes:

```bash
git status --short
# Stage only the actual files changed by the verification fix.
git commit -m "fix: stabilize dual quality review grouping"
```

Expected: no uncommitted changes after the commit.
