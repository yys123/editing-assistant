# Clinical Decision Chunk Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clinical decision chunk database to the upload page so editors can query by guide id or DOI and add selected chunks as independent reference data sources.

**Architecture:** Extend the existing authenticated article router with a dedicated chunk API base and a signed proxy endpoint that normalizes external `data.results.docs`. Add typed frontend API/mapping helpers and a focused `ClinicalDecisionChunkPanel` component; keep `StepUpload` responsible only for panel switching, guide-id prefill, and appending new `ReferenceDoc` objects.

**Tech Stack:** FastAPI, Pydantic settings, httpx, Python `unittest`, React 18, TypeScript, Node assertion tests, esbuild, Vite.

---

## Execution Preconditions

- Use `@using-git-worktrees` before implementation. The current primary workspace contains unrelated user changes; create an isolated worktree from commit `f26a449` or a later commit that contains this plan.
- Immediately after creating the implementation worktree, run `git rev-parse HEAD` and record that exact hash as `IMPLEMENTATION_BASE_COMMIT` for the final diff review.
- Use `@test-driven-development` for every behavior change: write the test, run it and observe the expected failure, then implement the minimum production code.
- Preserve the existing Clinic Master routes and UI. This feature uses `clinical-decision-chunks`, never `/api/clinic-master`.
- Do not change `ReferenceDoc` in `frontend/src/types/index.ts`.
- Consult the approved spec: `docs/superpowers/specs/2026-07-13-clinical-decision-chunk-source-design.md`.

## File Structure

### Backend

- Modify `backend/config.py`
  - Own the new `clinical_decision_chunk_api_base` setting.
- Modify `backend/routers/article.py`
  - Own external URL selection, signed fetching, response normalization, validation, and the local endpoint.
- Create `backend/tests/test_clinical_decision_chunks.py`
  - Own focused tests for endpoint validation, signing/URL mapping, normalization, and upstream errors.

No new router is needed because `backend/main.py` already mounts `article.router`.

### Frontend

- Modify `frontend/src/api.ts`
  - Own public chunk types, local endpoint calls, chunk-to-`ReferenceDoc` mapping, and exact-marker duplicate detection.
- Modify `frontend/src/api.test.mjs`
  - Own API URL, validation, mapping, sanitization, and duplicate-detection tests.
- Create `frontend/src/components/ClinicalDecisionChunkPanel.tsx`
  - Own query inputs, loading/errors, result expansion, selection, select-all, bulk addition, and addition summaries.
- Create `frontend/src/components/ClinicalDecisionChunkPanel.test.mjs`
  - Own pure addition/summary tests and component bundle verification.
- Modify `frontend/src/components/StepUpload.tsx`
  - Own the sibling entry button, mutual panel exclusion, guide-result prefill, and reference-doc append callback.
- Create `frontend/src/components/StepUploadClinicalDecision.test.mjs`
  - Own focused integration guards for the new entry, guide-result action, and panel wiring.
- Modify `frontend/src/index.css`
  - Own panel/result styling and responsive layout.

---

### Task 1: Normalize Clinical Decision Chunk Responses

**Files:**
- Create: `backend/tests/test_clinical_decision_chunks.py`
- Modify: `backend/routers/article.py:200-330, 650-735`

- [ ] **Step 1: Write failing normalization tests**

Create the test file with a focused class that calls a not-yet-existing normalizer:

```python
import unittest

from routers import article


class ClinicalDecisionChunkNormalizationTests(unittest.TestCase):
    def test_normalizes_screenshot_response_and_marks_usable_items(self):
        payload = {
            "message": "成功",
            "code": "success",
            "data": {
                "results": {
                    "numFound": 2,
                    "numReturn": 2,
                    "docs": [
                        {
                            "id": 11629322,
                            "mainId": 238,
                            "mainTitle": "Comparative Effectiveness",
                            "title": "Abstract",
                            "chunkId": "7-238-1-0",
                            "contentText": "切片正文",
                        },
                        {
                            "id": "11629323",
                            "mainId": "238",
                            "mainTitle": "Comparative Effectiveness",
                            "title": "Results",
                            "chunkId": "7-238-2-0",
                            "contentText": "",
                        },
                    ],
                }
            },
            "status": "200",
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(result["num_found"], 2)
        self.assertEqual(result["num_returned"], 2)
        self.assertEqual(result["items"][0]["id"], "11629322")
        self.assertEqual(result["items"][0]["main_id"], "238")
        self.assertTrue(result["items"][0]["usable"])
        self.assertFalse(result["items"][1]["usable"])

    def test_missing_chunk_id_is_preserved_but_unusable(self):
        payload = {
            "code": "success",
            "data": {"results": {"docs": [{"title": "Conclusion", "contentText": "正文"}]}},
            "status": "200",
        }

        result = article._clinical_decision_chunks_from_response(payload)

        self.assertEqual(result["items"][0]["title"], "Conclusion")
        self.assertEqual(result["items"][0]["chunk_id"], "")
        self.assertFalse(result["items"][0]["usable"])

    def test_rejects_non_200_status_and_missing_results_container(self):
        with self.assertRaisesRegex(Exception, "临床决策切片数据源请求失败"):
            article._clinical_decision_chunks_from_response({
                "code": "failed",
                "status": "200",
                "data": {"results": {"docs": []}},
            })

        with self.assertRaisesRegex(Exception, "临床决策切片数据源请求失败"):
            article._clinical_decision_chunks_from_response({"code": "success", "status": "500"})

        with self.assertRaisesRegex(Exception, "返回格式异常"):
            article._clinical_decision_chunks_from_response({"code": "success", "status": "200", "data": {}})
```

- [ ] **Step 2: Run the tests and verify the RED state**

Run:

```bash
GEMINI_API_KEY=dummy PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_clinical_decision_chunks.ClinicalDecisionChunkNormalizationTests -v
```

Expected: FAIL because `article._clinical_decision_chunks_from_response` does not exist.

- [ ] **Step 3: Implement the minimal normalizer**

Add focused helpers near the existing guide response helpers in `backend/routers/article.py`:

```python
def _clinical_decision_text(value, fallback: str = "") -> str:
    if value is None:
        return fallback
    return str(value).strip()


def _clinical_decision_chunks_from_response(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(502, "临床决策切片数据源返回格式异常")

    code = _clinical_decision_text(payload.get("code")).lower()
    if code and code != "success":
        raise HTTPException(502, "临床决策切片数据源请求失败")

    status = _clinical_decision_text(payload.get("status"))
    if status and status != "200":
        raise HTTPException(502, "临床决策切片数据源请求失败")

    data = payload.get("data")
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, dict):
        raise HTTPException(502, "临床决策切片数据源返回格式异常")

    docs = results.get("docs", [])
    if not isinstance(docs, list):
        raise HTTPException(502, "临床决策切片数据源返回格式异常")

    items = []
    for raw in docs:
        if not isinstance(raw, dict):
            continue
        chunk_id = _clinical_decision_text(raw.get("chunkId"))
        content_text = _clinical_decision_text(raw.get("contentText"))
        title = _clinical_decision_text(raw.get("title"), "未命名切片") or "未命名切片"
        main_title = _clinical_decision_text(raw.get("mainTitle"), "未命名临床决策资料") or "未命名临床决策资料"
        items.append({
            "id": _clinical_decision_text(raw.get("id")),
            "main_id": _clinical_decision_text(raw.get("mainId")),
            "main_title": main_title,
            "title": title,
            "chunk_id": chunk_id,
            "content_text": content_text,
            "usable": bool(chunk_id and content_text),
        })

    def result_count(key: str) -> int:
        try:
            return int(results.get(key))
        except (TypeError, ValueError):
            return len(items)

    return {
        "items": items,
        "num_found": result_count("numFound"),
        "num_returned": result_count("numReturn"),
    }
```

- [ ] **Step 4: Run the normalization tests and verify GREEN**

Run the command from Step 2.

Expected: all `ClinicalDecisionChunkNormalizationTests` pass.

- [ ] **Step 5: Commit the normalization boundary**

```bash
git add backend/routers/article.py backend/tests/test_clinical_decision_chunks.py
git commit -m "test: define clinical decision chunk normalization"
```

---

### Task 2: Add the Signed Backend Proxy Endpoint

**Files:**
- Modify: `backend/config.py:20-38`
- Modify: `backend/routers/article.py:190-330, 650-735`
- Modify: `backend/tests/test_clinical_decision_chunks.py`

- [ ] **Step 1: Add failing endpoint and signing tests**

Extend the test file with reusable fake HTTP classes and endpoint tests:

```python
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def json(self):
        return self.payload


class FakeAsyncClient:
    calls = []
    responses = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        self.calls.append((url, params))
        return self.responses.pop(0)


class ClinicalDecisionChunkEndpointTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        FakeAsyncClient.calls = []
        FakeAsyncClient.responses = []
        self.settings_patch = patch.object(
            article,
            "settings",
            SimpleNamespace(
                guide_app_id="test-app-id",
                guide_app_sign_key="test-sign-key",
                guide_app_name="test-app-name",
                clinical_decision_chunk_api_base=(
                    "https://newdrugs-test.dxy.net/open-sign-api/article-quality/chunk"
                ),
            ),
        )
        self.settings_patch.start()

    def tearDown(self):
        self.settings_patch.stop()

    async def test_requires_guide_id_or_doi(self):
        with self.assertRaises(HTTPException) as error:
            await article.search_clinical_decision_chunks(None, None)
        self.assertEqual(error.exception.status_code, 400)

    async def test_rejects_invalid_guide_id(self):
        with self.assertRaisesRegex(HTTPException, "指南 ID 必须为正整数"):
            await article.search_clinical_decision_chunks("0", None)

    async def test_forwards_both_filters_to_dedicated_chunk_base(self):
        FakeAsyncClient.responses = [FakeResponse({
            "code": "success",
            "status": "200",
            "data": {"results": {"numFound": 0, "numReturn": 0, "docs": []}},
        })]

        with (
            patch.object(article.httpx, "AsyncClient", FakeAsyncClient),
            patch.object(article.time, "time", return_value=1700000000.123),
            patch.object(article.secrets, "randbelow", side_effect=[1, 2, 3, 4, 5, 6, 7, 8]),
        ):
            result = await article.search_clinical_decision_chunks("238", " 10.1000/test ")

        self.assertEqual(result["items"], [])
        url, params = FakeAsyncClient.calls[0]
        self.assertEqual(
            url,
            "https://newdrugs-test.dxy.net/open-sign-api/article-quality/chunk/list",
        )
        self.assertEqual(params["guideId"], "238")
        self.assertEqual(params["doi"], "10.1000/test")
        self.assertEqual(params["appId"], "test-app-id")
        self.assertNotIn("appSignKey", params)
        self.assertIn("sign", params)

    async def test_non_object_json_becomes_safe_502(self):
        FakeAsyncClient.responses = [FakeResponse(["unexpected", "payload"])]

        with patch.object(article.httpx, "AsyncClient", FakeAsyncClient):
            with self.assertRaises(HTTPException) as error:
                await article.search_clinical_decision_chunks("238", None)

        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(error.exception.detail["message"], "临床决策切片数据源返回格式异常")
```

Also add DOI-only and guide-id-only cases so query omission is explicit.

- [ ] **Step 2: Run the endpoint tests and verify the RED state**

Run:

```bash
GEMINI_API_KEY=dummy PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_clinical_decision_chunks.ClinicalDecisionChunkEndpointTests -v
```

Expected: FAIL because the setting, base helper, fetch helper, and endpoint do not exist.

- [ ] **Step 3: Add the dedicated configuration setting**

In `backend/config.py` add:

```python
clinical_decision_chunk_api_base: str = (
    "https://newdrugs.dxy.cn/open-sign-api/article-quality/chunk"
)
```

Do not derive this by appending to `guide_api_base`.

- [ ] **Step 4: Implement the fetch helper and endpoint**

First harden the shared `_fetch_signed_api` immediately after `response.json()` and before `payload.get(...)`, so every signed source returns a safe 502 for valid JSON that is not an object:

```python
if not isinstance(payload, dict):
    raise HTTPException(
        502,
        {
            "message": f"{label}数据源返回格式异常",
            "config": _signed_config_summary(base_url),
            "request": {"url": url, "params": safe_params},
            "response": payload,
        },
    )
```

Then extend the existing typing import to `from typing import Dict, List, Optional` and add the clinical-decision helpers and endpoint to `backend/routers/article.py`:

```python
def _clinical_decision_chunk_base_url() -> str:
    return getattr(
        settings,
        "clinical_decision_chunk_api_base",
        "https://newdrugs.dxy.cn/open-sign-api/article-quality/chunk",
    ).rstrip("/")


async def _fetch_clinical_decision_chunk_api(params: dict) -> dict:
    return await _fetch_signed_api(
        "临床决策切片",
        _clinical_decision_chunk_base_url(),
        "list",
        params,
    )


@router.get("/clinical-decision-chunks")
async def search_clinical_decision_chunks(
    guide_id: Optional[str] = Query(None),
    doi: Optional[str] = Query(None),
):
    normalized_guide_id = (guide_id or "").strip()
    normalized_doi = (doi or "").strip()
    if not normalized_guide_id and not normalized_doi:
        raise HTTPException(400, "请填写指南 ID 或 DOI")

    if normalized_guide_id:
        if not normalized_guide_id.isdigit() or int(normalized_guide_id) <= 0:
            raise HTTPException(400, "指南 ID 必须为正整数")

    payload = await _fetch_clinical_decision_chunk_api({
        "guideId": normalized_guide_id or None,
        "doi": normalized_doi or None,
    })
    return _clinical_decision_chunks_from_response(payload)
```

Place the static endpoint before `@router.get("/guides/{guide_id}")` for readability, although FastAPI's exact static route remains distinct.

- [ ] **Step 5: Run endpoint and guide regression tests**

Run:

```bash
GEMINI_API_KEY=dummy PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_clinical_decision_chunks \
  backend.tests.test_guide_data_source -v
```

Expected: PASS with no network access and no guide regression.

- [ ] **Step 6: Commit the backend proxy**

```bash
git add backend/config.py backend/routers/article.py backend/tests/test_clinical_decision_chunks.py
git commit -m "feat: proxy clinical decision chunk queries"
```

---

### Task 3: Add Frontend API, Mapping, and Duplicate Detection

**Files:**
- Modify: `frontend/src/api.ts:1-260`
- Modify: `frontend/src/api.test.mjs`

- [ ] **Step 1: Add failing frontend API and mapping tests**

Update imports in `frontend/src/api.test.mjs` and add a fetch branch for `/api/article/clinical-decision-chunks`. Add assertions equivalent to:

```javascript
assert.deepEqual(
  await searchClinicalDecisionChunks({ guideId: '238', doi: '10.1000/test' }),
  {
    items: [{
      id: '11629322',
      main_id: '238',
      main_title: 'Comparative Effectiveness',
      title: 'Abstract',
      chunk_id: '7-238-1-0',
      content_text: '切片正文',
      usable: true,
    }],
    num_found: 1,
    num_returned: 1,
  },
)
assert.equal(
  fetchCalls.at(-1).url,
  '/api/article/clinical-decision-chunks?guide_id=238&doi=10.1000%2Ftest',
)

await assert.rejects(
  () => searchClinicalDecisionChunks({ guideId: ' ', doi: '' }),
  /请填写指南 ID 或 DOI/,
)

const chunk = {
  id: '11629322',
  main_id: '238',
  main_title: 'Comparative Effectiveness',
  title: 'Abstract/Methods',
  chunk_id: '7-238-1-0',
  content_text: '切片正文',
  usable: true,
}
const doc = clinicalDecisionChunkToReferenceDoc(chunk)
assert.equal(doc.filename, '临床决策切片-238-Abstract_Methods-7-238-1-0.md')
assert.match(doc.text, /^\[H1\] Comparative Effectiveness/)
assert.match(doc.text, /\[临床决策切片ID\] 7-238-1-0/)
assert.equal(referenceDocContainsClinicalDecisionChunk(doc, '7-238-1-0'), true)
assert.equal(referenceDocContainsClinicalDecisionChunk(doc, '7-238-1'), false)
```

Also test guide-id-only and DOI-only URL construction.

- [ ] **Step 2: Run the API test and verify the RED state**

Run:

```bash
cd frontend && node --experimental-strip-types src/api.test.mjs
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement typed API helpers**

Add to `frontend/src/api.ts`:

```typescript
export interface ClinicalDecisionChunk {
  id: string
  main_id: string
  main_title: string
  title: string
  chunk_id: string
  content_text: string
  usable: boolean
}

export interface ClinicalDecisionChunkSearchResponse {
  items: ClinicalDecisionChunk[]
  num_found: number
  num_returned: number
}

export async function searchClinicalDecisionChunks(input: {
  guideId?: string
  doi?: string
}): Promise<ClinicalDecisionChunkSearchResponse> {
  const guideId = (input.guideId || '').trim()
  const doi = (input.doi || '').trim()
  if (!guideId && !doi) throw new Error('请填写指南 ID 或 DOI')

  const params = new URLSearchParams()
  if (guideId) params.set('guide_id', guideId)
  if (doi) params.set('doi', doi)
  const res = await apiFetch(`/api/article/clinical-decision-chunks?${params.toString()}`)
  const data = await safeJson(res)
  if (!res.ok) throw new Error(errorMessage(data, '临床决策切片查询失败'))
  return data
}
```

- [ ] **Step 4: Implement mapping and exact-marker dedupe**

Add:

```typescript
function safeClinicalDecisionFilenamePart(value: string, fallback: string) {
  return (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 80) || fallback
}

export function clinicalDecisionChunkToReferenceDoc(chunk: ClinicalDecisionChunk): ReferenceDoc {
  if (!chunk.usable || !chunk.chunk_id.trim() || !chunk.content_text.trim()) {
    throw new Error('该临床决策切片暂无可用正文')
  }
  const mainId = safeClinicalDecisionFilenamePart(chunk.main_id, 'unknown')
  const title = safeClinicalDecisionFilenamePart(chunk.title, '未命名切片')
  const chunkId = safeClinicalDecisionFilenamePart(chunk.chunk_id, 'unknown')
  const text = [
    `[H1] ${chunk.main_title || '未命名临床决策资料'}`,
    `[H2] ${chunk.title || '未命名切片'}`,
    `[临床决策切片ID] ${chunk.chunk_id}`,
    '',
    chunk.content_text.trim(),
  ].join('\n')
  return {
    filename: `临床决策切片-${mainId}-${title}-${chunkId}.md`,
    text,
    char_count: text.length,
  }
}

export function referenceDocContainsClinicalDecisionChunk(doc: ReferenceDoc, chunkId: string) {
  const marker = `[临床决策切片ID] ${chunkId.trim()}`
  return doc.text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .some(line => line.trim() === marker)
}
```

- [ ] **Step 5: Run the API tests and verify GREEN**

Run the command from Step 2.

Expected: PASS, including all pre-existing API tests.

- [ ] **Step 6: Commit the frontend data boundary**

```bash
git add frontend/src/api.ts frontend/src/api.test.mjs
git commit -m "feat: add clinical decision chunk API helpers"
```

---

### Task 4: Build the Selectable Chunk Panel

**Files:**
- Create: `frontend/src/components/ClinicalDecisionChunkPanel.tsx`
- Create: `frontend/src/components/ClinicalDecisionChunkPanel.test.mjs`

- [ ] **Step 1: Write failing pure-behavior and bundle tests**

Use the existing esbuild test pattern from `ClinicMasterPanel.test.mjs`. Bundle the new component, import its pure exports, and test:

```javascript
const currentDocs = [{
  filename: 'existing.md',
  text: '[临床决策切片ID] chunk-existing\n\n正文',
  char_count: 30,
}]

const chunks = [
  {
    id: '1', main_id: '238', main_title: 'Guide', title: 'A',
    chunk_id: 'chunk-new', content_text: '新正文', usable: true,
  },
  {
    id: '2', main_id: '238', main_title: 'Guide', title: 'B',
    chunk_id: 'chunk-existing', content_text: '重复正文', usable: true,
  },
  {
    id: '3', main_id: '238', main_title: 'Guide', title: 'C',
    chunk_id: 'chunk-empty', content_text: '', usable: false,
  },
]

const result = buildClinicalDecisionChunkAddition(currentDocs, chunks)
assert.equal(result.docs.length, 1)
assert.equal(result.added, 1)
assert.equal(result.duplicates, 1)
assert.equal(result.unusable, 1)
assert.equal(
  formatClinicalDecisionChunkAddition(result),
  '已加入 1 条；跳过重复 1 条；无可用正文 1 条',
)
assert.deepEqual(selectableClinicalDecisionChunkIds(chunks), ['chunk-new', 'chunk-existing'])
```

The test should also bundle `ClinicalDecisionChunkPanel.tsx`, proving JSX and imports compile.

- [ ] **Step 2: Run the panel test and verify the RED state**

Run:

```bash
cd frontend && node src/components/ClinicalDecisionChunkPanel.test.mjs
```

Expected: FAIL because the component and pure helpers do not exist.

- [ ] **Step 3: Implement pure selection/addition helpers**

At the top of the new component export:

```typescript
export interface ClinicalDecisionChunkAdditionResult {
  docs: ReferenceDoc[]
  added: number
  duplicates: number
  unusable: number
}

export function selectableClinicalDecisionChunkIds(chunks: ClinicalDecisionChunk[]) {
  return chunks
    .filter(chunk => chunk.usable && chunk.chunk_id.trim() && chunk.content_text.trim())
    .map(chunk => chunk.chunk_id)
}

export function buildClinicalDecisionChunkAddition(
  currentDocs: ReferenceDoc[],
  chunks: ClinicalDecisionChunk[],
): ClinicalDecisionChunkAdditionResult {
  const seen = new Set<string>()
  for (const chunk of chunks) {
    if (chunk.chunk_id && currentDocs.some(doc =>
      referenceDocContainsClinicalDecisionChunk(doc, chunk.chunk_id)
    )) seen.add(chunk.chunk_id)
  }

  const docs: ReferenceDoc[] = []
  let duplicates = 0
  let unusable = 0
  for (const chunk of chunks) {
    if (!chunk.usable || !chunk.chunk_id.trim() || !chunk.content_text.trim()) {
      unusable += 1
      continue
    }
    if (seen.has(chunk.chunk_id)) {
      duplicates += 1
      continue
    }
    seen.add(chunk.chunk_id)
    docs.push(clinicalDecisionChunkToReferenceDoc(chunk))
  }
  return { docs, added: docs.length, duplicates, unusable }
}

export function formatClinicalDecisionChunkAddition(result: ClinicalDecisionChunkAdditionResult) {
  const parts = [`已加入 ${result.added} 条`]
  if (result.duplicates) parts.push(`跳过重复 ${result.duplicates} 条`)
  if (result.unusable) parts.push(`无可用正文 ${result.unusable} 条`)
  return parts.join('；')
}
```

- [ ] **Step 4: Implement the controlled panel component**

Use this public interface:

```typescript
interface ClinicalDecisionChunkPanelProps {
  initialGuideId?: string
  referenceDocs: ReferenceDoc[]
  onAddReferenceDocs: (docs: ReferenceDoc[]) => void
}
```

The component must own:

```typescript
const [guideId, setGuideId] = useState(initialGuideId || '')
const [doi, setDoi] = useState('')
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')
const [items, setItems] = useState<ClinicalDecisionChunk[]>([])
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
const [notice, setNotice] = useState('')
```

Implement these behaviors:

- `runSearch` clears old results/selections/notices before calling `searchClinicalDecisionChunks`.
- Empty results show `未查询到相关切片`.
- The default selection after search is empty; the user explicitly chooses chunks or uses the all action.
- Select-all selects only `selectableClinicalDecisionChunkIds(items)`.
- `加入已选` passes selected matching items to `buildClinicalDecisionChunkAddition`.
- `全部加入参考数据源` passes all returned items to the same helper.
- Call `onAddReferenceDocs(result.docs)` only when `result.docs.length > 0`.
- Keep results after addition and show `formatClinicalDecisionChunkAddition(result)`.
- Unusable rows remain visible with `暂无正文，不能加入` or `缺少 chunkId，不能加入`.
- Preview uses a fixed character slice when collapsed and the full text when expanded.
- Enter in either input triggers `runSearch`.
- Query buttons are disabled while `loading`; `加入已选` is disabled when selection is empty.

Use existing material-symbol icons and CSS class names beginning with `clinical-decision-chunk-`.

- [ ] **Step 5: Run the panel tests and verify GREEN**

Run the command from Step 2.

Expected: PASS with the component bundle created and removed by the test.

- [ ] **Step 6: Commit the panel behavior**

```bash
git add \
  frontend/src/components/ClinicalDecisionChunkPanel.tsx \
  frontend/src/components/ClinicalDecisionChunkPanel.test.mjs
git commit -m "feat: add selectable clinical decision chunk panel"
```

---

### Task 5: Integrate the Panel into Upload Reference Sources

**Files:**
- Modify: `frontend/src/components/StepUpload.tsx:1-20, 1135-1185, 1740-1860`
- Create: `frontend/src/components/StepUploadClinicalDecision.test.mjs`
- Modify: `frontend/src/index.css:1330-1610, 2380-2450`

- [ ] **Step 1: Write a failing integration guard test**

Create a small source-level test, following `ChunkConfirmationPanel.test.mjs`, that reads `StepUpload.tsx` and `index.css`:

```javascript
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile('src/components/StepUpload.tsx', 'utf8')
const css = await readFile('src/index.css', 'utf8')

assert.match(source, /ClinicalDecisionChunkPanel/)
assert.match(source, /临床决策切片库/)
assert.match(source, /查询切片/)
assert.match(source, /setGuidePanelOpen\(false\)/)
assert.match(source, /setClinicalDecisionPanelOpen\(false\)/)
assert.match(source, /onAddReferenceDocs/)
assert.match(css, /\.clinical-decision-chunk-panel/)
assert.match(css, /\.guide-library-result-actions/)
```

- [ ] **Step 2: Run the integration test and verify the RED state**

Run:

```bash
cd frontend && node src/components/StepUploadClinicalDecision.test.mjs
```

Expected: FAIL because the panel is not wired into `StepUpload` and styles do not exist.

- [ ] **Step 3: Add upload-page state and imports**

Import the component and add:

```typescript
const [clinicalDecisionPanelOpen, setClinicalDecisionPanelOpen] = useState(false)
const [clinicalDecisionGuideId, setClinicalDecisionGuideId] = useState('')
```

Add a focused handler:

```typescript
const openClinicalDecisionChunks = (guideId = '') => {
  setClinicalDecisionGuideId(guideId)
  setGuidePanelOpen(false)
  setGuideError('')
  setClinicalDecisionPanelOpen(true)
}
```

- [ ] **Step 4: Add sibling entry buttons with mutual exclusion**

Keep the two connectors grouped before the local-file note:

```tsx
<div className="reference-source-connectors">
  <button
    type="button"
    className={`guide-library-toggle ${guidePanelOpen ? 'active' : ''}`}
    onClick={() => {
      const nextOpen = !guidePanelOpen
      setGuidePanelOpen(nextOpen)
      if (nextOpen) setClinicalDecisionPanelOpen(false)
      setGuideError('')
    }}
  >
    <span className="material-symbols-outlined">database_search</span>
    对接指南数据库
  </button>
  <button
    type="button"
    className={`guide-library-toggle ${clinicalDecisionPanelOpen ? 'active' : ''}`}
    onClick={() => {
      const nextOpen = !clinicalDecisionPanelOpen
      setClinicalDecisionPanelOpen(nextOpen)
      if (nextOpen) {
        setClinicalDecisionGuideId('')
        setGuidePanelOpen(false)
      }
    }}
  >
    <span className="material-symbols-outlined">view_list</span>
    临床决策切片库
  </button>
</div>
```

Update the helper text to mention both online sources.

- [ ] **Step 5: Add the guide-result `查询切片` action**

Wrap guide row actions:

```tsx
<div className="guide-library-result-actions">
  <button
    type="button"
    className="guide-library-chunk-btn"
    onClick={() => openClinicalDecisionChunks(String(guide.id))}
  >
    <span className="material-symbols-outlined">segment</span>
    查询切片
  </button>
  <button
    type="button"
    className="guide-library-add-btn"
    disabled={guideDetailLoadingId !== null}
    onClick={() => addGuideSource(guide)}
  >
    <span className="material-symbols-outlined">
      {guideDetailLoadingId === guide.id ? 'hourglass_top' : 'add'}
    </span>
    {guideDetailLoadingId === guide.id ? '添加中' : '添加全文'}
  </button>
</div>
```

- [ ] **Step 6: Render the panel and append accepted docs**

Immediately after the guide panel:

```tsx
{clinicalDecisionPanelOpen && (
  <ClinicalDecisionChunkPanel
    initialGuideId={clinicalDecisionGuideId}
    referenceDocs={referenceDocs}
    onAddReferenceDocs={docs => setReferenceDocs([...referenceDocs, ...docs])}
  />
)}
```

The component is unmounted while closed, so opening from a guide result initializes the input from the latest guide id without another global state contract.

- [ ] **Step 7: Add desktop and mobile styles**

Add CSS for:

- `.reference-source-connectors`: wrapping horizontal entry buttons.
- `.clinical-decision-chunk-panel`: same surface language as `.guide-library-panel` without copying inline styles.
- `.clinical-decision-chunk-query`: two inputs plus query button on desktop, one column on mobile.
- `.clinical-decision-chunk-toolbar`: select-all and the two add actions.
- `.clinical-decision-chunk-result`: checkbox, metadata, preview, and expand action.
- `.clinical-decision-chunk-result.is-unusable`: muted state.
- `.clinical-decision-chunk-notice` and error/empty states.
- `.guide-library-result-actions` and `.guide-library-chunk-btn`.

Reuse existing DUI CSS variables. Do not introduce hard-coded feature colors; responsive rules go inside the existing `@media (max-width: 720px)` block.

- [ ] **Step 8: Run focused frontend tests and build**

Run:

```bash
cd frontend && \
node --experimental-strip-types src/api.test.mjs && \
node src/components/ClinicalDecisionChunkPanel.test.mjs && \
node src/components/StepUploadClinicalDecision.test.mjs && \
npm run build
```

Expected: all Node tests pass; TypeScript and Vite exit 0.

- [ ] **Step 9: Commit the upload-page integration**

```bash
git add \
  frontend/src/components/StepUpload.tsx \
  frontend/src/components/StepUploadClinicalDecision.test.mjs \
  frontend/src/index.css
git commit -m "feat: expose clinical decision chunks in upload sources"
```

---

### Task 6: Verify the Complete Feature and User Flow

**Files:**
- Verify only; modify earlier files only if a test reveals a defect.

- [ ] **Step 1: Run the complete relevant backend suite**

Run:

```bash
GEMINI_API_KEY=dummy PYTHONPATH=backend python3 -m unittest \
  backend.tests.test_clinical_decision_chunks \
  backend.tests.test_guide_data_source -v
```

Expected: PASS, zero failures/errors.

- [ ] **Step 2: Run all relevant frontend tests**

Run:

```bash
cd frontend && \
node --experimental-strip-types src/api.test.mjs && \
node src/components/ClinicalDecisionChunkPanel.test.mjs && \
node src/components/StepUploadClinicalDecision.test.mjs
```

Expected: PASS, zero assertion failures.

- [ ] **Step 3: Run the production build**

Run:

```bash
cd frontend && npm run build
```

Expected: `tsc` and `vite build` exit 0.

- [ ] **Step 4: Perform browser flow verification**

Use `@browser:control-in-app-browser` or `@playwright` against the local app and verify:

1. `参考数据源` shows sibling guide and clinical-decision entry buttons.
2. Opening either panel closes the other.
3. Clicking `查询切片` on a guide result opens the clinical panel with the guide id prefilled.
4. Empty query shows local validation.
5. A mocked or reachable successful response renders usable and unusable rows.
6. Select-all excludes unusable rows.
7. `加入已选` adds only selected, non-duplicate chunks.
8. `全部加入参考数据源` reports added, duplicate, and unusable counts.
9. Added chunks appear as independent cards and can be viewed/deleted individually.
10. The layout stacks cleanly at 720px or narrower.

Capture a screenshot only if it helps document a visual defect or the final handoff.

- [ ] **Step 5: Review the final diff and working tree**

Run:

```bash
git status --short
git diff --check
git diff --stat <IMPLEMENTATION_BASE_COMMIT>..HEAD
```

Replace `<IMPLEMENTATION_BASE_COMMIT>` with the exact hash recorded immediately after worktree creation. Expected: only the planned feature files are changed/committed in the isolated worktree; no unrelated primary-workspace files appear.

- [ ] **Step 6: Apply `@verification-before-completion`**

Re-run any command needed to support the final completion claim. Report exact test/build results, not expectations.

- [ ] **Step 7: Final integration commit only if verification required fixes**

If verification caused code changes:

```bash
git add <only-files-fixed-during-verification>
git commit -m "fix: finalize clinical decision chunk source"
```

If verification required no code changes, do not create an empty commit.

---

## Completion Checklist

- [ ] Dedicated configured chunk base ends in `/article-quality/chunk`; requests append only `/list`.
- [ ] Existing guide credentials and signature helper are reused without exposing `appSignKey`.
- [ ] Local endpoint validates guide id/DOI and normalizes screenshot-shaped responses.
- [ ] Empty content and missing `chunkId` remain visible but unusable.
- [ ] Frontend supports guide-id-only, DOI-only, and combined queries.
- [ ] Each accepted chunk becomes one independent `ReferenceDoc` with an exact chunk marker.
- [ ] Duplicate detection is exact and works across step navigation.
- [ ] Users can select individually, multi-select, select all, add selected, or add all.
- [ ] Guide results expose required `查询切片` prefill behavior.
- [ ] Guide and clinical-decision panels are mutually exclusive.
- [ ] Existing Clinic Master behavior and shared `ReferenceDoc` type are unchanged.
- [ ] Relevant backend tests, frontend tests, build, browser flow, and diff review pass.
