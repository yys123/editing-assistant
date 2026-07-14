# Guideline Chunk Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first version of guideline chunk confirmation for content quality review and AI integration, while leaving user needs analysis as a future extension.

**Architecture:** Add a shared backend chunk selection service and API, extend downstream request models to accept confirmed chunks, and add a reusable frontend confirmation panel. AI integration and section quality review use confirmed chunks when present; legacy automatic selection remains as a fallback.

**Tech Stack:** FastAPI, Pydantic, Python service tests, React + TypeScript, existing frontend utility tests.

---

### Task 1: Shared Backend Chunk Service

**Files:**
- Create: `backend/services/reference_chunks.py`
- Test: `backend/tests/test_reference_chunks.py`

- [ ] **Step 1: Write failing tests**
  - Test stable chunk ids and title paths.
  - Test priority source boosting.
  - Test fallback chunks when query has no match.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `cd backend && python3 -m pytest tests/test_reference_chunks.py -q`
  - Expected: FAIL because `services.reference_chunks` does not exist.

- [ ] **Step 3: Implement minimal chunk service**
  - Add `ReferenceChunkCandidate` and search helpers.
  - Reuse simple paragraph/title splitting and token overlap scoring.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `cd backend && python3 -m pytest tests/test_reference_chunks.py -q`
  - Expected: PASS.

### Task 2: Backend Models And Search API

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routers/generate.py`
- Test: `backend/tests/test_reference_chunks.py`

- [ ] **Step 1: Write failing API/model tests**
  - Test `/api/generate/reference-chunks/search` returns chunk candidates.
  - Test model serialization for confirmed chunks.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `cd backend && python3 -m pytest tests/test_reference_chunks.py -q`
  - Expected: FAIL because models/API are missing.

- [ ] **Step 3: Add models and endpoint**
  - Add `ConfirmedReferenceChunk`, `ReferenceChunkSearchRequest`, and `ReferenceChunkSearchResponse`.
  - Add endpoint under existing generate router to avoid new router wiring.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `cd backend && python3 -m pytest tests/test_reference_chunks.py -q`
  - Expected: PASS.

### Task 3: AI Integration Uses Confirmed Chunks

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/services/generator.py`
- Test: `backend/tests/test_ai_integration.py`

- [ ] **Step 1: Write failing tests**
  - Test confirmed chunks appear in AI integration prompt.
  - Test unconfirmed reference text is not injected when confirmed chunks are present.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `cd backend && python3 -m pytest tests/test_ai_integration.py -q`
  - Expected: FAIL because AI integration ignores confirmed chunks.

- [ ] **Step 3: Implement confirmed chunk path**
  - Extend `AiIntegrationRequest` with `confirmed_reference_chunks`.
  - Format confirmed chunks into the existing priority/supplementary evidence sections.
  - Keep automatic selection when no confirmed chunks are supplied.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `cd backend && python3 -m pytest tests/test_ai_integration.py -q`
  - Expected: PASS.

### Task 4: Section Quality Review Uses Confirmed Chunks

**Files:**
- Modify: `backend/routers/analyze.py`
- Modify: `backend/services/analyzer.py`
- Test: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing tests**
  - Test confirmed chunks are included in section analysis prompt.
  - Test original full reference text is not used when confirmed chunks are supplied.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `cd backend && python3 -m pytest tests/test_analyzer.py -q`
  - Expected: FAIL because section analysis ignores confirmed chunks.

- [ ] **Step 3: Implement confirmed chunk path**
  - Extend `SectionAnalyzeRequest`.
  - Add optional `confirmed_reference_chunks` to `analyze_section`.
  - Build quality review reference block from confirmed chunks when present.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `cd backend && python3 -m pytest tests/test_analyzer.py -q`
  - Expected: PASS.

### Task 5: Frontend API And Types

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api.ts`
- Test: `frontend/src/api.test.mjs`

- [ ] **Step 1: Write failing frontend API tests**
  - Test `searchReferenceChunks()` request payload and response passthrough.

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `cd frontend && node src/api.test.mjs`
  - Expected: FAIL because helper/types are missing.

- [ ] **Step 3: Add types and API helper**
  - Add `ReferenceChunkCandidate` and `ConfirmedReferenceChunk`.
  - Add `searchReferenceChunks()`.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `cd frontend && node src/api.test.mjs`
  - Expected: PASS.

### Task 6: Frontend Confirmation Panel And Integration

**Files:**
- Create: `frontend/src/components/ChunkConfirmationPanel.tsx`
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Modify: `frontend/src/components/StepSectionAnalysis.tsx`
- Modify: `frontend/src/index.css`
- Test: focused frontend utility/API tests plus build

- [ ] **Step 1: Add minimal component and wire AI integration**
  - Search candidate chunks from selected references.
  - Allow users to confirm recommended chunks.
  - Send confirmed chunks to AI integration request.

- [ ] **Step 2: Wire section analysis**
  - Search candidates per section/group.
  - Send confirmed chunks to section analysis request.

- [ ] **Step 3: Verify frontend**
  - Run: `cd frontend && npm run build`
  - Expected: PASS.

### Task 7: Final Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run backend focused tests**
  - Run: `cd backend && python3 -m pytest tests/test_reference_chunks.py tests/test_ai_integration.py tests/test_analyzer.py -q`
  - Expected: PASS.

- [ ] **Step 2: Run frontend focused tests and build**
  - Run: `cd frontend && node src/api.test.mjs && npm run build`
  - Expected: PASS.

- [ ] **Step 3: Review git diff**
  - Run: `git status --short`
  - Run: `git diff --stat`
  - Expected: Only planned files changed.
