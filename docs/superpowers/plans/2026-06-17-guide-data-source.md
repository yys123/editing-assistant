# Guide Data Source Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an online guide search/detail integration that appends selected guide content to the existing reference data source list.

**Architecture:** The backend owns communication with the fixed online host `newdrugs.dxy.cn` and exposes normalized local endpoints under `/api/article/guides`. The frontend uses small API helpers and keeps the upload page state shape unchanged by converting guide detail content into `ReferenceDoc`.

**Tech Stack:** FastAPI, httpx, Pydantic, React 18, TypeScript, Vite, Node test scripts.

---

## File Structure

- Modify `backend/routers/article.py`: add guide proxy models, external request helper, search endpoint, detail endpoint.
- Create `backend/tests/test_guide_data_source.py`: backend tests with mocked `httpx.AsyncClient`.
- Modify `frontend/src/api.ts`: add guide types, API helper functions, and reference-doc mapper.
- Modify `frontend/src/api.test.mjs`: add frontend helper tests using a mocked `fetch`.
- Modify `frontend/src/components/StepUpload.tsx`: add the guide search panel and append selected guide details to `referenceDocs`.

## Task 1: Backend Guide Proxy

**Files:**
- Modify: `backend/routers/article.py`
- Test: `backend/tests/test_guide_data_source.py`

- [ ] **Step 1: Write failing backend tests**

Create tests that monkeypatch `article.httpx.AsyncClient` and call:

```python
await article.search_guides("糖尿病")
await article.get_guide_detail(12)
```

Verify search maps `data` to `{"items": [{"id": 12, "title": "..."}]}` and detail maps `data.content` to `{"id": 12, "title": "...", "content": "..."}`.

- [ ] **Step 2: Run tests to verify red**

Run: `cd backend && python3 -m unittest tests.test_guide_data_source -v`

Expected: FAIL because guide functions are not implemented.

- [ ] **Step 3: Implement minimal backend code**

Add `httpx` import, response models, `GUIDE_API_BASE`, `_fetch_guide_api`, `_guide_items_from_response`, `search_guides`, and `get_guide_detail`.

- [ ] **Step 4: Run backend tests to verify green**

Run: `cd backend && python3 -m unittest tests.test_guide_data_source -v`

Expected: PASS.

## Task 2: Frontend API Helpers

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/api.test.mjs`

- [ ] **Step 1: Write failing frontend tests**

Mock `globalThis.fetch` and verify:

```js
await searchGuides('糖尿病')
await fetchGuideDetail(12)
guideDetailToReferenceDoc({ id: 12, title: '标题', content: '<p>内容</p>' })
```

- [ ] **Step 2: Run tests to verify red**

Run: `cd frontend && node --experimental-strip-types src/api.test.mjs`

Expected: FAIL because helper functions are not exported.

- [ ] **Step 3: Implement minimal helpers**

Add exported guide interfaces and helper functions using `apiFetch` and `safeJson`.

- [ ] **Step 4: Run frontend tests to verify green**

Run: `cd frontend && node --experimental-strip-types src/api.test.mjs`

Expected: PASS.

## Task 3: Upload Page UI

**Files:**
- Modify: `frontend/src/components/StepUpload.tsx`

- [ ] **Step 1: Add UI state and handlers**

Add state for panel visibility, keyword, search results, loading flags, selected guide id, and guide error.

- [ ] **Step 2: Add reference card controls**

Place a "对接数据源" button in the "参考数据源" card. When open, render input, search button, result list, and add buttons.

- [ ] **Step 3: Wire selected detail to `referenceDocs`**

On selection, fetch detail, convert to `ReferenceDoc`, and append to the existing list.

- [ ] **Step 4: Run TypeScript build**

Run: `cd frontend && npm run build`

Expected: PASS.

## Task 4: Final Verification

- [ ] **Step 1: Run backend tests**

Run: `cd backend && python3 -m unittest tests.test_guide_data_source -v`

- [ ] **Step 2: Run frontend tests**

Run: `cd frontend && node --experimental-strip-types src/api.test.mjs`

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`

- [ ] **Step 4: Inspect git diff**

Run: `git diff -- backend/routers/article.py backend/tests/test_guide_data_source.py frontend/src/api.ts frontend/src/api.test.mjs frontend/src/components/StepUpload.tsx docs/superpowers/specs/2026-06-17-guide-data-source-design.md docs/superpowers/plans/2026-06-17-guide-data-source.md`
