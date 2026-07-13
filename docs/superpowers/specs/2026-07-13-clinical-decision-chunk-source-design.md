# Clinical Decision Chunk Source Integration Design

## Goal

Add a clinical decision chunk database to the upload page's existing reference-source module.

Editors can query chunks by guide id or DOI, inspect the returned chunk content, select individual chunks or add all usable chunks, and append each selected chunk as an independent `ReferenceDoc` for the existing downstream workflow.

## Context

The upload page already supports:

- Local reference file upload.
- Online guide database search and full-guide addition.
- A `ReferenceDoc` contract with `filename`, `text`, and `char_count` that is consumed by later review, analysis, chunk-confirmation, and generation steps.

The new API shown in the supplied screenshots is a separate clinical decision chunk list endpoint:

- Method: `GET`
- Production path: `/open-sign-api/article-quality/chunk/list`
- Query parameters:
  - `guideId`: optional numeric guide id.
  - `doi`: optional DOI string.
- At least one of `guideId` or `doi` must be supplied by this application.
- The response contains chunk documents under `data.results.docs`.

This integration is not the existing Clinic Master conversational clinical-decision integration. The route names, models, UI labels, and API helpers must keep the two features separate.

## Confirmed Product Decisions

- Place the entry in `上传数据 → 参考数据源`.
- Add a dedicated `临床决策切片库` button beside `对接指南数据库`.
- The guide and clinical-decision panels are mutually exclusive: opening one closes the other.
- Support direct query by guide id or DOI; either field is sufficient.
- When both fields are filled, send both to the external endpoint.
- Allow individual selection, multi-selection, select-all, `加入已选`, and `全部加入参考数据源`.
- Add every selected chunk as an independent reference-source card.
- Preserve `chunkId` for traceability and duplicate prevention.
- Every guide search result exposes a `查询切片` action that opens the clinical-decision panel with its guide id prefilled.

## Scope

In scope:

- A backend proxy endpoint using the existing guide API signing configuration and signing algorithm.
- Validation and normalization of the external chunk response.
- Frontend API helpers and chunk-to-reference mapping.
- A new clinical-decision chunk panel in the upload reference-source module.
- Selective and bulk addition of usable chunks.
- Duplicate detection by `chunkId` without changing the shared `ReferenceDoc` type.
- Backend tests, frontend tests, and build verification.

Out of scope:

- Keyword or semantic search, because the provided endpoint accepts only guide id and DOI.
- Automatic AI querying or automatic chunk selection.
- A new persistence table or conversation state.
- Changes to downstream reference review, analysis, or generation contracts.
- Replacing the existing full-guide database integration.
- Merging this feature with Clinic Master chat queries.

## Recommended Architecture

The frontend calls a local authenticated backend endpoint. The backend validates the query, signs the external request using the existing guide credentials, calls the fixed clinical-decision chunk endpoint, validates the success envelope, and returns a normalized response.

This follows the current guide database proxy pattern and keeps credentials, signing, CORS handling, and external response quirks outside the browser.

## Backend Design

### Configuration and Signing

Reuse the existing guide API authentication configuration and add a dedicated endpoint base:

- `guide_app_id`.
- `guide_app_name` when required by the existing signed API helper.
- `guide_app_sign_key`.
- Existing timestamp, nonce, sorted parameter serialization, and SHA-1 signing behavior.
- `clinical_decision_chunk_api_base`, defaulting to `https://newdrugs.dxy.cn/open-sign-api/article-quality/chunk`.

The signing key remains server-side and must never be included in the outgoing query or error payload.

Do not append the chunk path to `guide_api_base`: that existing setting ends in `/article-quality/guide`, while the chunk endpoint is its sibling under `/article-quality/chunk`. The dedicated base makes production and custom/test deployments explicit. Append only the relative path `list` to `clinical_decision_chunk_api_base`. Production resolves to:

```text
https://newdrugs.dxy.cn/open-sign-api/article-quality/chunk/list
```

### Local Endpoint

Add:

```text
GET /api/article/clinical-decision-chunks?guide_id={id}&doi={doi}
```

Rules:

- Trim both inputs.
- Reject the request with HTTP 400 when both are empty.
- Validate `guide_id` as a positive integer when supplied.
- Forward `guide_id` as external parameter `guideId`.
- Forward `doi` unchanged apart from surrounding whitespace removal.
- When both are supplied, forward both.
- Use the shared signed request helper and fixed chunk-list path.
- Treat a non-success external code/status, non-object payload, or missing result container as an upstream response error.

### Normalized Response

Return a stable local response:

```ts
interface ClinicalDecisionChunkSearchResponse {
  items: ClinicalDecisionChunk[]
  num_found: number
  num_returned: number
}

interface ClinicalDecisionChunk {
  id: string
  main_id: string
  main_title: string
  title: string
  chunk_id: string
  content_text: string
  usable: boolean
}
```

Normalization from the screenshot response:

- `id` ← `docs[].id`
- `main_id` ← `docs[].mainId`
- `main_title` ← `docs[].mainTitle`
- `title` ← `docs[].title`
- `chunk_id` ← `docs[].chunkId`
- `content_text` ← `docs[].contentText`
- `usable` is true only when `chunk_id` and trimmed `content_text` are both non-empty.
- `num_found` ← `results.numFound`, falling back to the normalized item count.
- `num_returned` ← `results.numReturn`, falling back to the normalized item count.

Identifiers may arrive as strings or numbers and should be normalized to strings. Missing titles receive concise fallback labels, but missing `chunkId` or blank content makes the item unusable.

The backend should preserve unusable items in the response so the UI can explain why they cannot be added.

## Frontend API and Mapping

Add types and helpers in `frontend/src/api.ts`:

- `ClinicalDecisionChunk`
- `ClinicalDecisionChunkSearchResponse`
- `searchClinicalDecisionChunks({ guideId, doi })`
- `clinicalDecisionChunkToReferenceDoc(chunk)`
- `referenceDocContainsClinicalDecisionChunk(referenceDoc, chunkId)`

The search helper:

- Performs local empty-input validation.
- Builds the local query string using `guide_id` and `doi`.
- Uses authenticated `apiFetch` and existing structured error parsing.
- Reports a concise Chinese fallback error: `临床决策切片查询失败`.

### ReferenceDoc Mapping

Each usable chunk becomes one `ReferenceDoc` without changing the shared type:

```ts
{
  filename: `临床决策切片-${safeMainId}-${safeTitle}-${safeChunkId}.md`,
  text: `[H1] ${mainTitle}\n[H2] ${title}\n[临床决策切片ID] ${chunkId}\n\n${contentText}`,
  char_count: text.length,
}
```

Filename components must be trimmed, length-limited, and sanitized for invalid path characters.

Duplicate detection scans existing reference documents for the exact marker:

```text
[临床决策切片ID] {chunkId}
```

This keeps traceability across step navigation and history-compatible state without introducing an optional metadata field to every `ReferenceDoc` consumer.

## Upload Page UI

### Entry Placement

In the `参考数据源` action row:

- Keep `对接指南数据库`.
- Add `临床决策切片库` as a sibling button.
- Opening the clinical-decision panel closes the guide panel.
- Opening the guide panel closes the clinical-decision panel.
- Update the explanatory copy to mention local files, the guide database, and the clinical-decision chunk database.

### Query Form

The expanded clinical-decision panel contains:

- `指南 ID` input.
- `DOI` input.
- Help text: `指南 ID、DOI 填写任意一项即可`.
- `查询切片` action.

Pressing Enter in either field triggers the same search action when the form is valid.

Every guide database result exposes a `查询切片` action. Choosing it:

- Closes the guide panel.
- Opens the clinical-decision panel.
- Prefills the result guide id.
- Does not query until the user explicitly submits, so the user can review or add a DOI first.

### Result List

After a successful search:

- Show the returned count.
- Show one row per normalized chunk.
- Display `title`, `main_title`, and `chunk_id`.
- Display a shortened `content_text` preview with an expand/collapse control.
- Give usable rows a checkbox.
- Show `暂无正文，不能加入` for blank `content_text` and disable selection.
- Show `缺少 chunkId，不能加入` when traceability is unavailable.

The result toolbar provides:

- Select all usable chunks.
- A live selected count.
- `加入已选`, disabled when nothing usable is selected.
- `全部加入参考数据源`, operating on all usable returned chunks regardless of the current checkbox selection.

### Addition Behavior

For both selective and bulk addition:

1. Ignore unusable chunks.
2. Skip chunks whose `chunkId` already exists in `referenceDocs`.
3. Convert remaining chunks to independent `ReferenceDoc` objects.
4. Append them to the current reference-source list.
5. Preserve the query results so the user can inspect what was added.
6. Show a concise result summary, for example: `已加入 3 条；跳过重复 1 条；无正文 1 条`.

A new query clears previous results, selections, and query-level notices. It must not remove already-added reference documents.

Existing reference cards retain their current view and delete behavior. Clinical-decision chunk cards are independently viewable and removable because each chunk is a separate `ReferenceDoc`.

## State Model

Add upload-page-local state for:

- Panel open/closed.
- Guide id input.
- DOI input.
- Loading state.
- Error message.
- Search results.
- Selected chunk ids.
- Addition summary.

No new global application state is required. Only successfully added chunks enter the existing `referenceDocs` state.

## Data Flow

1. User opens `临床决策切片库`.
2. User enters a guide id, DOI, or both.
3. Frontend validates that at least one field is present.
4. Frontend calls the local backend endpoint.
5. Backend validates inputs and generates the existing guide-style signature.
6. Backend calls the external chunk list endpoint.
7. Backend validates and normalizes `data.results.docs`.
8. Frontend displays usable and unusable chunks with clear states.
9. User selects individual chunks or chooses the bulk action.
10. Frontend skips unusable and duplicate chunks.
11. Frontend maps accepted chunks into independent `ReferenceDoc` objects.
12. Existing downstream workflow consumes those documents without special handling.

## Error Handling

- Both query inputs empty: local frontend validation; backend also returns HTTP 400.
- Invalid guide id: show `指南 ID 必须为正整数`.
- Empty result: show `未查询到相关切片`.
- Request in progress: disable repeated query submission.
- External timeout/network failure: backend returns a 502-style safe error; frontend shows a retriable Chinese message.
- External authentication/signature failure: report a safe endpoint/configuration summary without the signing key or signature source.
- Unexpected response structure: backend reports an upstream format error and logs safe top-level keys for diagnosis.
- Blank content: display the row but prevent addition.
- Missing `chunkId`: display the row but prevent addition.
- Duplicate addition: skip it and include it in the addition summary rather than treating it as an error.

## Testing

### Backend

Add focused tests covering:

- Rejecting requests without guide id or DOI.
- Rejecting a non-positive or malformed guide id.
- Correct external parameter mapping from `guide_id` to `guideId`.
- DOI-only, guide-id-only, and combined queries.
- Reuse of the existing signing fields and exclusion of `appSignKey` from the outgoing request.
- Normalization of screenshot-shaped `data.results.docs`.
- Numeric/string identifier normalization.
- Blank content and missing `chunkId` producing `usable: false`.
- Empty results.
- Non-success external envelopes and malformed response containers.

### Frontend

Add focused tests covering:

- Query URL construction for guide id, DOI, and both.
- Empty-query validation.
- Chunk-to-`ReferenceDoc` filename and structured text mapping.
- Filename sanitization.
- Exact `chunkId` duplicate detection.
- Select-all operating only on usable chunks.
- Selective addition and bulk addition summaries.
- Query reset behavior without deleting previously added references.

### Verification

Run:

- Relevant backend unit tests.
- Frontend API/component tests.
- Full frontend production build.
- A final diff review confirming unrelated dirty-worktree changes were not overwritten or staged.

## Implementation Constraints

- Follow existing article router, API helper, and upload-page styling patterns.
- Keep changes narrowly scoped to this feature.
- Add the dedicated `clinical_decision_chunk_api_base` setting; do not infer it by appending to `guide_api_base`.
- Do not modify or remove existing Clinic Master behavior.
- Do not change the shared `ReferenceDoc` contract for this release.
- Preserve all unrelated user changes in the existing dirty worktree.
