# Structured Reference Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize local HTML reference uploads and online guide library details as structured Markdown-like reference text.

**Architecture:** Add a shared backend normalization helper for reference source text. Route both local HTML reference uploads and guide detail normalization through it while keeping `ReferenceDoc` and guide API response shapes unchanged.

**Tech Stack:** FastAPI, Python `unittest`, existing BeautifulSoup-based scraper utilities.

---

### Task 1: Add Failing Backend Tests

**Files:**
- Modify: `backend/tests/test_guide_data_source.py`

- [x] **Step 1: Add tests for structured local HTML reference extraction**

Add a test that calls `article._extract_reference_source_text()` with HTML containing preface text, an `h2`, a paragraph with a superscript citation, and asserts the output contains the preface, `[H2]` heading, normalized citation marker, and no raw tags.

- [x] **Step 2: Add tests for guide fallback content normalization**

Add a test case where fallback `content` is Markdown-like text and assert the guide detail endpoint returns structured headings instead of raw unprocessed Markdown.

- [x] **Step 3: Run targeted tests and verify they fail**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_guide_data_source -v`

Expected: at least one new test fails because local HTML still uses plain text extraction or fallback Markdown is not normalized consistently.

### Task 2: Implement Shared Structured Reference Normalization

**Files:**
- Modify: `backend/routers/article.py`

- [x] **Step 1: Add a helper**

Add `_normalize_reference_source_text(content: str) -> str` that:

- Returns `parse_html_structured(content, preserve_leading_text=True).strip()` for HTML.
- Returns `_normalize_guide_detail_content(content)` or equivalent Markdown-aware output for non-HTML.
- Falls back to cleaned original text when structured parsing returns blank.

- [x] **Step 2: Use helper for local HTML reference files**

Update `_extract_reference_source_text()` so `.html/.htm` reference uploads use the helper instead of `parse_html_to_text()`.

- [x] **Step 3: Use helper for online guide detail output**

Update `get_guide_detail()` normalization so the selected guide content passes through the same helper.

- [x] **Step 4: Run targeted tests and verify they pass**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_guide_data_source -v`

Expected: all tests in the file pass.

### Task 3: Run Focused Regression Checks

**Files:**
- Verify only

- [x] **Step 1: Run reference chunk tests**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_reference_chunks -v`

Expected: all tests pass.

- [x] **Step 2: Inspect git diff**

Run: `git diff -- backend/routers/article.py backend/tests/test_guide_data_source.py docs/superpowers/plans/2026-07-08-structured-reference-source.md`

Expected: diff only contains the planned structured reference source changes.
