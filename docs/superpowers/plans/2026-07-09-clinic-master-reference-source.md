# ClinMaster Reference Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clinic Master as a manually queried evidence source for upload-page reference data and AI integration chunk confirmation.

**Architecture:** Build a dedicated backend Clinic Master client/router with its own signing and two-minute delayed refresh state machine. Normalize returned answer/reference materials into `ReferenceDoc`-compatible items, then expose shared frontend API helpers and a reusable query panel that is wired into the upload page and AI integration page.

**Tech Stack:** FastAPI, Pydantic settings, `httpx`, Python `unittest`, React + TypeScript, existing frontend API test runner, existing `ReferenceDoc` and `ChunkConfirmationPanel` contracts.

---

## File Structure

- Create `backend/services/clinic_master.py`: Clinic Master signing, request construction, external client methods, assistant message selection, reference-detail fetching helpers, and material normalization.
- Create `backend/routers/clinic_master.py`: authenticated local query endpoints, in-memory query state, two-minute refresh enforcement, and response models.
- Modify `backend/config.py`: add Clinic Master settings.
- Modify `backend/main.py`: register the Clinic Master router.
- Create `backend/tests/test_clinic_master.py`: service and router tests with fake `httpx.AsyncClient`.
- Modify `frontend/src/api.ts`: add Clinic Master types, API helpers, and material-to-reference-doc mapper.
- Modify `frontend/src/api.test.mjs`: add API helper and mapper tests.
- Create `frontend/src/components/ClinicMasterPanel.tsx`: reusable query/result/selection panel for both product surfaces.
- Modify `frontend/src/components/StepUpload.tsx`: add panel to reference data-source area and append selected docs to global `referenceDocs`.
- Modify `frontend/src/components/StepAiIntegration.tsx`: add panel to AI integration, maintain local Clinic Master docs, include them in chunk confirmation and record citation snapshots.
- Modify `frontend/src/types/index.ts`: extend `AiIntegrationRecord` with a reference-doc snapshot field.
- Modify `frontend/src/index.css`: style the shared panel using existing design tokens.

Do not alter existing `guide/ncd` signing logic. Do not replace `ReferenceDoc`, `ReferenceInput`, or `ConfirmedReferenceChunk`.

---

### Task 1: Backend Signing And Config

**Files:**
- Create: `backend/services/clinic_master.py`
- Modify: `backend/config.py`
- Test: `backend/tests/test_clinic_master.py`

- [ ] **Step 1: Write failing signature tests**

Add `backend/tests/test_clinic_master.py` with tests like:

```python
import re
import unittest
from unittest.mock import patch

from services import clinic_master


class ClinicMasterSigningTests(unittest.TestCase):
    def test_generate_signature_matches_reference_example(self):
        params = {
            "appId": 1001,
            "timestamp": 1742050000,
            "nonce": "6a8d2f3e",
            "question": "hello",
            "stream": False,
        }

        result = clinic_master.generate_signature(params, "test-key")

        self.assertEqual(result, "892a5dd8950d6d2c4a4216f4545dd2e2fa81f3b7")

    def test_signed_params_use_seconds_hyphenated_uuid_and_do_not_send_key(self):
        fake_uuid = "9f3f0d15-35a0-4b31-bf44-5c9d4c4d2e2a"
        settings = type("Settings", (), {
            "clinic_master_app_id": "app-1",
            "clinic_master_app_sign_key": "secret-key",
        })()

        with (
            patch.object(clinic_master, "settings", settings),
            patch.object(clinic_master.time, "time", return_value=1742050000.9),
            patch.object(clinic_master.uuid, "uuid4", return_value=fake_uuid),
        ):
            params = clinic_master.signed_params({"question": "hello", "optional": None})

        self.assertEqual(params["timestamp"], 1742050000)
        self.assertEqual(params["nonce"], fake_uuid)
        self.assertRegex(params["nonce"], r"^[0-9a-f-]{36}$")
        self.assertNotIn("appSignKey", params)
        self.assertIn("sign", params)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterSigningTests -v`

Expected: FAIL because `services.clinic_master` does not exist.

- [ ] **Step 3: Add config fields**

In `backend/config.py`, add:

```python
clinic_master_openapi_host: str = ""
clinic_master_app_id: str = ""
clinic_master_app_sign_key: str = ""
clinic_master_result_delay_seconds: int = 120
clinic_master_timeout_seconds: int = 30
```

- [ ] **Step 4: Implement signing helpers**

Create `backend/services/clinic_master.py` with:

```python
import hashlib
import time
import uuid
from typing import Any

from fastapi import HTTPException

from config import settings


def _value_to_sign_string(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return "[" + ", ".join(_value_to_sign_string(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(
            f"{key}={_value_to_sign_string(item)}" for key, item in value.items()
        ) + "}"
    return str(value)


def build_signature_plaintext(params: dict, app_sign_key: str) -> str:
    sign_params = {**params, "appSignKey": app_sign_key}
    sign_params.pop("sign", None)
    parts = []
    for key in sorted(sign_params):
        value = sign_params[key]
        if value is None:
            continue
        parts.append(f"{key}={_value_to_sign_string(value)}")
    return "&".join(parts)


def generate_signature(params: dict, app_sign_key: str) -> str:
    plaintext = build_signature_plaintext(params, app_sign_key)
    return hashlib.sha1(plaintext.encode("utf-8")).hexdigest()


def signed_params(params: dict) -> dict:
    app_id = str(getattr(settings, "clinic_master_app_id", "") or "").strip()
    sign_key = str(getattr(settings, "clinic_master_app_sign_key", "") or "").strip()
    if not app_id or not sign_key:
        raise HTTPException(500, "Clinic Master 凭证未配置: appId/appSignKey")
    request_params = {key: value for key, value in params.items() if value is not None}
    request_params["appId"] = app_id
    request_params["timestamp"] = int(time.time())
    request_params["nonce"] = str(uuid.uuid4())
    request_params["sign"] = generate_signature(request_params, sign_key)
    return request_params
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterSigningTests -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/config.py backend/services/clinic_master.py backend/tests/test_clinic_master.py
git commit -m "feat: add ClinMaster signing helpers"
```

---

### Task 2: Backend Client Methods

**Files:**
- Modify: `backend/services/clinic_master.py`
- Test: `backend/tests/test_clinic_master.py`

- [ ] **Step 1: Write failing client tests**

Add fake async client tests that verify:

- `create_chat()` calls `{host}/openapi/p/chat/stream`.
- `get_chat_references()` sends assistant `messageId`.
- `get_reference_detail()` posts to `{host}/japi/platform/100000017` with form data.
- External requests do not include `appSignKey`.

Use a fake client:

```python
class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def json(self):
        return self._payload


class FakeAsyncClient:
    calls = []
    responses = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        return self.responses.pop(0)

    async def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        return self.responses.pop(0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterClientTests -v`

Expected: FAIL because client methods are missing.

- [ ] **Step 3: Implement external request helpers**

In `backend/services/clinic_master.py`, add:

- `openapi_host()`
- `_openapi_url(path: str)`
- `_japi_url(path: str)`
- `_safe_params(params: dict)`
- `_extract_payload(response, label: str)`
- async `create_chat(question: str, request_id: str)`
- async `get_chat_detail(chat_id: str | None, request_id: str | None)`
- async `get_chat_references(message_id: str)`
- async `get_reference_detail(reference_payload: dict)`

Implementation notes:

- Use `httpx.AsyncClient(timeout=settings.clinic_master_timeout_seconds)`.
- For `/openapi/p/**`, put system and business params in one JSON body for POST.
- For `/japi/platform/100000017`, use `data=signed_params(...)` and header `Content-Type: application/x-www-form-urlencoded`.
- Keep method signatures flexible enough for the actual Clinic Master response ids.
- Raise `HTTPException(502, {...})` for non-2xx or non-JSON responses with masked request diagnostics.

- [ ] **Step 4: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterClientTests -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/clinic_master.py backend/tests/test_clinic_master.py
git commit -m "feat: add ClinMaster OpenAPI client"
```

---

### Task 3: Backend Query Router And Delay State

**Files:**
- Create: `backend/routers/clinic_master.py`
- Modify: `backend/main.py`
- Modify: `backend/services/clinic_master.py`
- Test: `backend/tests/test_clinic_master.py`

- [ ] **Step 1: Write failing router state tests**

Add tests for:

- `create_query()` returns a hyphenated `query_id`, `pending`, empty materials, and `ready_at`.
- `refresh_query()` before `ready_at` does not call detail/reference methods.
- `get_query()` returns cached state without external calls.
- Unknown `query_id` returns 404.

Example assertions:

```python
self.assertEqual(result["status"], "pending")
self.assertEqual(result["materials"], [])
self.assertRegex(result["query_id"], r"^[0-9a-f-]{36}$")
self.assertGreater(result["ready_at"], result["created_at"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterRouterStateTests -v`

Expected: FAIL because router does not exist.

- [ ] **Step 3: Implement router models and in-memory store**

In `backend/routers/clinic_master.py`, add:

- `ClinicMasterQueryRequest`
- `ClinicMasterMaterial`
- `ClinicMasterQueryResponse`
- `_query_store: dict[str, dict]`
- `POST /queries`
- `GET /queries/{query_id}`
- `POST /queries/{query_id}/refresh`

Use ISO strings for `created_at` and `ready_at`.

`POST /queries` should:

1. Validate nonblank question.
2. Generate `query_id = str(uuid.uuid4())`.
3. Call `clinic_master.create_chat(question, request_id=query_id)`.
4. Store external response metadata server-side.
5. Return `pending`.

`refresh` should return cached `pending` if called early.

- [ ] **Step 4: Register router**

Modify `backend/main.py`:

```python
from routers import article, qa, analyze, generate, history, standards, auth, admin, utd, clinic_master
...
app.include_router(clinic_master.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterRouterStateTests -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/routers/clinic_master.py backend/tests/test_clinic_master.py
git commit -m "feat: add ClinMaster query state API"
```

---

### Task 4: Backend Refresh Normalization

**Files:**
- Modify: `backend/services/clinic_master.py`
- Modify: `backend/routers/clinic_master.py`
- Test: `backend/tests/test_clinic_master.py`

- [ ] **Step 1: Write failing refresh tests**

Add tests for:

- Assistant message selection uses the latest message with `roleType == "assistant"`.
- Ready refresh calls detail, reference list, and reference detail.
- Partial reference-detail failures produce `warnings` and still return usable materials.
- HTML detail content is normalized into structured text.
- Empty answer and empty references return `status: "empty"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterRefreshTests -v`

Expected: FAIL because refresh normalization is incomplete.

- [ ] **Step 3: Implement response extraction helpers**

In `backend/services/clinic_master.py`, add focused helpers:

- `extract_assistant_message_id(detail_payload: dict) -> str`
- `extract_answer_text(detail_payload: dict, stream_payload: dict | None) -> str`
- `extract_reference_items(reference_payload: dict) -> list[dict]`
- `normalize_materials(question: str, answer: str, detail_payload: dict, references: list[dict], detail_results: list[dict]) -> list[dict]`

Use tolerant field extraction similar to existing guide code, but keep it local to Clinic Master.

- [ ] **Step 4: Reuse structured reference normalization**

If `backend/routers/article.py` exposes `_normalize_reference_source_text`, import it carefully or move the helper into a shared service later only if necessary. First implementation can import the existing helper to avoid duplicating HTML normalization:

```python
from routers.article import _normalize_reference_source_text
```

If this creates import-cycle trouble, create `backend/services/reference_source_text.py` and move the helper there in the same task, updating existing article imports and tests.

- [ ] **Step 5: Implement ready refresh**

In `backend/routers/clinic_master.py`, when `now >= ready_at`:

1. Fetch chat detail.
2. Select assistant message id.
3. Fetch references.
4. Fetch each reference detail independently.
5. Normalize materials.
6. Store final response in `_query_store`.
7. Return `ready`, `empty`, or `failed`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master.ClinicMasterRefreshTests -v`

Expected: PASS.

- [ ] **Step 7: Run backend regression tests**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_guide_data_source backend.tests.test_reference_chunks -v`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/services/clinic_master.py backend/routers/clinic_master.py backend/tests/test_clinic_master.py
git commit -m "feat: normalize ClinMaster query materials"
```

---

### Task 5: Frontend API Helpers

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/api.test.mjs`

- [ ] **Step 1: Write failing frontend API tests**

In `frontend/src/api.test.mjs`, add tests for:

- `createClinicMasterQuery("糖尿病")` posts to `/api/clinic-master/queries`.
- `getClinicMasterQuery(queryId)` gets `/api/clinic-master/queries/{id}`.
- `refreshClinicMasterQuery(queryId)` posts to `/api/clinic-master/queries/{id}/refresh`.
- `clinicMasterMaterialToReferenceDoc()` sanitizes filenames and preserves char count.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && node src/api.test.mjs`

Expected: FAIL because helpers are missing.

- [ ] **Step 3: Add API types and helpers**

In `frontend/src/api.ts`, add:

```ts
export type ClinicMasterQueryStatus = 'pending' | 'ready' | 'empty' | 'failed'

export interface ClinicMasterMaterial {
  id: string
  type: 'answer' | 'chat_detail' | 'reference' | 'reference_detail'
  title: string
  text: string
  sourceLabel: string
  selectedByDefault: boolean
  metadata?: Record<string, unknown>
}

export interface ClinicMasterQueryResponse {
  query_id: string
  status: ClinicMasterQueryStatus
  question: string
  created_at: string
  ready_at: string
  materials: ClinicMasterMaterial[]
  warnings: string[]
  error?: string
}
```

Add the three API helpers and a mapper:

```ts
export function clinicMasterMaterialToReferenceDoc(material: ClinicMasterMaterial, fallbackIndex = 1): ReferenceDoc {
  const safeTitle = (material.title || `${material.sourceLabel || 'ClinMaster'}-${fallbackIndex}`)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 120)
  return {
    filename: `ClinMaster-${safeTitle || fallbackIndex}.md`,
    text: material.text,
    char_count: material.text.length,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && node src/api.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.test.mjs
git commit -m "feat: add ClinMaster frontend API helpers"
```

---

### Task 6: Shared Frontend Query Panel

**Files:**
- Create: `frontend/src/components/ClinicMasterPanel.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/api.test.mjs` plus build

- [ ] **Step 1: Create reusable panel component**

Create `ClinicMasterPanel.tsx` with props:

```ts
interface ClinicMasterPanelProps {
  title: string
  placeholder: string
  addButtonLabel: string
  defaultQuestion?: string
  onAddReferenceDocs: (docs: ReferenceDoc[]) => void
}
```

Component behavior:

- Local `question`, `query`, `selectedMaterialIds`, `loading`, and `error` state.
- `查询临床决策` calls `createClinicMasterQuery`.
- Pending state shows `ready_at` and a conservative countdown label.
- `获取结果` calls `refreshClinicMasterQuery`.
- Materials render as checkboxes using `selectedByDefault`.
- `加入...` maps selected materials to docs and calls `onAddReferenceDocs`.

- [ ] **Step 2: Add duplicate protection**

Within the component, dedupe selected docs by material id before mapping. Leave parent-level filename dedupe for each page-specific context.

- [ ] **Step 3: Add CSS**

In `frontend/src/index.css`, add `clinic-master-*` classes using existing tokens. Keep the panel compact and consistent with guide/reference panels.

- [ ] **Step 4: Run build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ClinicMasterPanel.tsx frontend/src/index.css
git commit -m "feat: add ClinMaster query panel"
```

---

### Task 7: Upload Page Integration

**Files:**
- Modify: `frontend/src/components/StepUpload.tsx`
- Test: frontend build

- [ ] **Step 1: Wire panel into reference data-source card**

Import `ClinicMasterPanel` and render it near the guide database panel in the "参考数据源" section.

Use:

```tsx
<ClinicMasterPanel
  title="临床决策"
  placeholder="输入疾病或临床问题"
  addButtonLabel="加入参考数据源"
  defaultQuestion={disease}
  onAddReferenceDocs={(docs) => setReferenceDocs([...referenceDocs, ...dedupeDocs(docs)])}
/>
```

Implement a small local helper if needed:

```ts
function appendUniqueReferenceDocs(current: ReferenceDoc[], additions: ReferenceDoc[]) {
  const existing = new Set(current.map(doc => doc.filename))
  return [...current, ...additions.filter(doc => !existing.has(doc.filename))]
}
```

- [ ] **Step 2: Verify upload page state behavior**

Manual code check:

- Adding ClinMaster docs does not clear uploaded files.
- Adding ClinMaster docs does not trigger chunk confirmation on upload page.
- Existing guide database behavior is unchanged.

- [ ] **Step 3: Run build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StepUpload.tsx
git commit -m "feat: add ClinMaster upload reference source"
```

---

### Task 8: AI Integration Local Candidate Pool

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Test: frontend build and existing AI integration utility tests

- [ ] **Step 1: Extend record type**

In `frontend/src/types/index.ts`, extend `AiIntegrationRecord` with:

```ts
referenceDocsSnapshot?: ReferenceDoc[]
clinicMasterReferenceDocs?: ReferenceDoc[]
```

`referenceDocsSnapshot` is the preferred source for historical citation rendering because it preserves source ids exactly as used during generation.

- [ ] **Step 2: Add local ClinMaster docs state**

In `StepAiIntegration.tsx`, add:

```ts
const [clinicMasterReferenceDocs, setClinicMasterReferenceDocs] = useState<ReferenceDoc[]>([])
const effectiveReferenceDocs = useMemo(
  () => [...referenceDocs, ...clinicMasterReferenceDocs],
  [referenceDocs, clinicMasterReferenceDocs],
)
```

Update selected reference initialization and effects carefully so global `referenceDocs` changes do not wipe manually added ClinMaster docs unexpectedly.

- [ ] **Step 3: Render ClinMasterPanel**

Place `ClinicMasterPanel` near the reference selection card with:

```tsx
<ClinicMasterPanel
  title="临床决策"
  placeholder="输入本次 AI 整合需要补充判断的临床问题"
  addButtonLabel="加入本次候选资料"
  defaultQuestion={userRequest || disease}
  onAddReferenceDocs={(docs) => {
    setClinicMasterReferenceDocs(prev => appendUniqueReferenceDocs(prev, docs))
    setSelectedRefs(prev => [...new Set([...prev, ...docs.map(doc => doc.filename)])])
    setConfirmedReferenceChunks([])
  }}
/>
```

- [ ] **Step 4: Use effective docs everywhere in current run**

Replace current-run uses of `referenceDocs` with `effectiveReferenceDocs` for:

- Reference selector display.
- `selectedRefs` all/clear/toggle logic.
- `ChunkConfirmationPanel`.
- `reference_inputs`.
- `priority_reference_ids`.
- Citation anchor building for the active record when no snapshot exists.

Be careful: source ids must be based on the same effective docs order used to send `reference_inputs`.

- [ ] **Step 5: Store snapshots in records**

When creating an `AiIntegrationRecord`, include:

```ts
referenceDocsSnapshot: effectiveReferenceDocs,
clinicMasterReferenceDocs,
```

When rendering an active record, compute:

```ts
const activeRecordReferenceDocs = activeRecord?.referenceDocsSnapshot ?? effectiveReferenceDocs
```

Use `activeRecordReferenceDocs` for citation anchors so history remains stable.

- [ ] **Step 6: Run frontend checks**

Run: `cd frontend && node src/api.test.mjs && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/StepAiIntegration.tsx
git commit -m "feat: add ClinMaster AI integration evidence pool"
```

---

### Task 9: End-To-End Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run focused backend tests**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_clinic_master backend.tests.test_guide_data_source backend.tests.test_reference_chunks -v`

Expected: PASS.

- [ ] **Step 2: Run existing AI integration backend tests**

Run: `PYTHONPATH=backend python3 -m unittest backend.tests.test_ai_integration -v`

Expected: PASS.

- [ ] **Step 3: Run frontend tests and build**

Run: `cd frontend && node src/api.test.mjs && npm run build`

Expected: PASS.

- [ ] **Step 4: Optional local smoke check**

If a local server is running, manually verify:

- Upload page can create a ClinMaster query, shows a pending countdown, and does not fetch details early.
- After the delay, refresh returns selectable materials.
- Selected upload-page materials appear as reference data-source cards.
- AI integration can add ClinMaster materials locally without mutating upload-page `referenceDocs`.
- Chunk confirmation includes ClinMaster docs and final AI integration can cite selected chunks.

- [ ] **Step 5: Review diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only planned ClinMaster files and necessary integration files changed.

- [ ] **Step 6: Final commit if needed**

If the implementation is complete and any verification-only adjustments remain:

```bash
git add backend frontend docs/superpowers/plans/2026-07-09-clinic-master-reference-source.md
git commit -m "feat: integrate ClinMaster reference source"
```
