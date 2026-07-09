# ClinMaster Reference Source Integration Design

## Goal

Integrate Clinic Master, also called clinical decision data, as a controllable evidence source for Editing Assistant.

The first release should let editors manually query Clinic Master, review the returned answer and references, choose which materials to use, and then feed only selected materials into the existing reference-source and chunk-confirmation workflow.

Two product surfaces are in scope:

- Upload page reference data sources: users enter a disease or clinical question, Clinic Master returns an answer and reference documents, and selected materials are appended to the existing `ReferenceDoc[]`.
- AI integration page: users manually query Clinic Master, manually select returned materials into the current AI integration candidate pool, confirm chunks, and then use those chunks in AI integration.

## Context

The app already has an online guide data-source integration and a separate old entry database integration in `backend/routers/article.py`. Those use the older `guide/ncd` signed API shape and should not be reused for Clinic Master signing.

Clinic Master uses a different OpenAPI contract:

- `POST /openapi/p/chat/stream` to create or continue a chat.
- `GET or POST /openapi/p/chat/detail` to fetch conversation detail.
- `GET or POST /openapi/p/chat/reference` to fetch reference documents. The `messageId` must be the assistant message id.
- `POST /japi/platform/100000017` to fetch reference detail with `application/x-www-form-urlencoded`.

The provided Clinic Master OpenAPI skill defines its own signature rules:

- Use `{openapiHost}/openapi/p/{path}` for OpenAPI routes.
- Include `appId`, second-level Unix `timestamp`, unique `nonce`, and `sign`.
- Generate `sign` by removing `sign`, injecting `appSignKey`, sorting parameter names, skipping top-level null values, joining `key=value` pairs with `&`, and SHA-1 hashing the UTF-8 bytes.
- Do not send `appSignKey` over HTTP.
- Avoid duplicate parameter names between query and body.

The user also confirmed two integration-specific requirements:

- After sending a question, wait 2 minutes before fetching chat detail, reference lists, or reference details, because Clinic Master needs time to generate complete results.
- Client-generated ids must use UUID strings with hyphens, for example `str(uuid.uuid4())`.

## Scope

In scope:

- A dedicated backend Clinic Master client and router.
- Secure configuration for Clinic Master host, app id, and signing key.
- A two-phase query flow: create chat first, fetch results after the 2-minute readiness window.
- Normalization of Clinic Master answer, chat detail, references, and reference details into selectable materials.
- Conversion of selected materials into `ReferenceDoc` objects.
- Upload page UI to add selected Clinic Master materials to global reference data sources.
- AI integration page UI to add selected Clinic Master materials to a per-run candidate pool before chunk confirmation.
- Tests for signing, delayed-result behavior, normalization, and front-end API helpers.

Out of scope:

- Automatically querying Clinic Master when the user clicks AI integration send.
- Automatically adding all Clinic Master materials without user selection.
- Treating Clinic Master answers as direct replacement article content.
- Persisting Clinic Master conversations in a new database.
- Building a separate Clinic Master chunking system.
- Changing the existing `ReferenceDoc`, `ReferenceInput`, or `ConfirmedReferenceChunk` downstream contracts unless a narrow compatibility field becomes necessary.

## Recommended Approach

Use a dedicated Clinic Master service that produces ordinary reference documents.

The backend should hide Clinic Master signing, waiting rules, response quirks, and reference-detail fetching behind local authenticated endpoints. Both frontend surfaces consume the same local API and receive the same selectable material model.

After the user selects materials, the frontend maps them to `ReferenceDoc`:

```ts
{
  filename: string
  text: string
  char_count: number
}
```

This keeps all downstream review, chunk confirmation, citation anchoring, and AI integration behavior aligned with existing code.

## Backend Design

### Configuration

Add settings:

- `clinic_master_openapi_host`
- `clinic_master_app_id`
- `clinic_master_app_sign_key`
- `clinic_master_result_delay_seconds`, default `120`
- `clinic_master_timeout_seconds`, default `30`

The signing key should only be read server-side. Debug endpoints must mask it and should not expose signature plaintext containing the raw key.

### Modules

Create `backend/services/clinic_master.py` for the external client:

- `generate_signature(params, app_sign_key)`
- `signed_params(params)`
- `create_chat(question, request_id)`
- `get_chat_detail(chat_id or conversation identifiers)`
- `get_chat_references(assistant_message_id)`
- `get_reference_detail(reference_id or payload)`
- `normalize_materials(chat_result)`

Create `backend/routers/clinic_master.py` mounted under `/api/clinic-master`:

- `POST /api/clinic-master/queries`
- `GET /api/clinic-master/queries/{query_id}`
- `POST /api/clinic-master/queries/{query_id}/refresh`

The first endpoint creates a local query envelope and sends the Clinic Master question. It returns immediately with:

- `query_id`: local UUID with hyphens.
- `status`: `pending`.
- `ready_at`: current server time plus 120 seconds.
- External identifiers returned by Clinic Master only when safe to expose.

The refresh endpoint checks the 2-minute rule. If called early, it returns `status: pending` and does not call detail/reference endpoints. If the query is ready, it fetches chat detail, reference list, reference details, and returns normalized selectable materials.

For the first release, local query state can live in memory, matching existing chunk-upload state patterns. If process restarts matter later, this can move to SQLite.

### Local API Contract

Use an explicit local response model so both frontend surfaces share the same state machine:

```ts
type ClinicMasterQueryStatus = 'pending' | 'ready' | 'empty' | 'failed'

interface ClinicMasterQueryResponse {
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

`POST /queries` should return this shape with `status: 'pending'` and an empty `materials` array. `GET /queries/{query_id}` returns the cached shape without external calls. `POST /queries/{query_id}/refresh` is the only endpoint allowed to fetch Clinic Master details and references.

The router should keep external Clinic Master ids in server-side state when possible. If an id must be returned for debugging, it should be treated as metadata and never be required by the frontend to build later Clinic Master requests.

### UUID Requirements

Any id generated by the app for Clinic Master requests or local query tracking should use the canonical hyphenated UUID format:

```py
str(uuid.uuid4())
```

This applies to local `query_id` and any client request id sent to Clinic Master when the external API expects an id. The `nonce` may also use a hyphenated UUID unless Clinic Master explicitly rejects hyphens.

### Result Delay

The backend is responsible for enforcing the 2-minute delay. Frontend timers are only for user feedback.

Rules:

- `POST /queries` records `created_at` and `ready_at`.
- `GET /queries/{query_id}` returns cached state only.
- `POST /queries/{query_id}/refresh` returns early if `now < ready_at`.
- Once `now >= ready_at`, refresh fetches details and transitions to `ready`, `empty`, or `failed`.
- A refresh may be retried if Clinic Master still has incomplete data after 2 minutes. The UI should surface this as "not ready yet" or a retriable failure, depending on response shape.

The initial `chat/stream` call should be used only to submit the question and capture whatever identifiers or immediate answer fragments Clinic Master returns. The backend should not block the user for the full 2-minute generation window inside `POST /queries`; the waiting window is represented by `ready_at` and handled by refresh.

### Material Normalization

Normalize Clinic Master output into a frontend-facing model:

```ts
interface ClinicMasterMaterial {
  id: string
  type: 'answer' | 'chat_detail' | 'reference' | 'reference_detail'
  title: string
  text: string
  sourceLabel: string
  selectedByDefault: boolean
  metadata?: Record<string, unknown>
}
```

Suggested material behavior:

- `answer`: the final assistant answer, if available. Selected by default only if it contains substantive text.
- `chat_detail`: conversation detail summary or assistant message transcript. Not selected by default if it duplicates `answer`.
- `reference`: reference document summaries from `/chat/reference`. Selected by default when text is substantial.
- `reference_detail`: full detail from `/japi/platform/100000017`. Selected by default when available and not blank.

Convert selected materials to `ReferenceDoc` with stable, readable filenames:

- `ClinMaster-回答-{shortQuestion}.md`
- `ClinMaster-参考-{index}-{title}.md`
- `ClinMaster-文献详情-{index}-{title}.md`

The `text` should preserve structure where possible:

```md
[H1] ClinMaster 回答：糖尿病诊断标准

问题：...

回答：
...

[H2] 参考资料
...
```

If reference detail contains HTML, reuse the existing structured reference normalization helper so downstream chunking can detect headings and citation markers.

## Frontend Design

### Shared API Helpers

Add API helpers in `frontend/src/api.ts`:

- `createClinicMasterQuery(question)`
- `getClinicMasterQuery(queryId)`
- `refreshClinicMasterQuery(queryId)`
- `clinicMasterMaterialToReferenceDoc(material, fallbackIndex)`

The helper should use authenticated `apiFetch`, parse structured backend errors through existing `safeJson`, and produce clear Chinese error messages.

### Upload Page Reference Source Entry

Add a "对接临床决策" panel beside the existing guide database entry in the reference data-source card.

Flow:

1. User enters disease or clinical question.
2. User clicks "查询临床决策".
3. UI shows pending state with `ready_at` countdown or "约 2 分钟后可获取结果".
4. After 2 minutes, user clicks "获取结果" or UI offers a refresh action.
5. UI displays selectable Clinic Master materials.
6. User selects materials and clicks "加入参考数据源".
7. Selected materials are appended to the existing `referenceDocs` state.

This should not automatically start chunk confirmation on the upload page. Existing later workflow steps will consume the new reference docs naturally.

### AI Integration Entry

Add a "查询临床决策" panel in AI integration near the current reference selection area.

Flow:

1. User enters a clinical question and clicks "查询临床决策".
2. Query enters pending state for 2 minutes.
3. User refreshes results when ready.
4. User manually selects returned materials.
5. User clicks "加入本次候选资料".
6. Selected materials are merged into an AI-integration-local reference pool.
7. The existing reference selector and `ChunkConfirmationPanel` include both global `referenceDocs` and local Clinic Master docs.
8. User confirms chunks, then sends AI integration.

The local Clinic Master docs should be saved into the `AiIntegrationRecord` or otherwise be available for citation rendering after the record is created. Without this, historical citation anchors may point to sources that no longer exist in the global `referenceDocs` array.

### State Model for AI Integration

Keep global upload-page `referenceDocs` unchanged when a user adds Clinic Master material only inside AI integration. Use local state such as:

```ts
const [clinicMasterReferenceDocs, setClinicMasterReferenceDocs] = useState<ReferenceDoc[]>([])
const effectiveReferenceDocs = [...referenceDocs, ...clinicMasterReferenceDocs]
```

All AI integration selection, chunk search, `reference_inputs`, `priority_reference_ids`, and citation rendering for the active record should use the effective docs for that record. Records should store a snapshot of the effective docs or at least the Clinic Master docs that were local to the run.

## Data Flow

### Upload Page

1. User queries Clinic Master.
2. Backend creates query and calls chat stream.
3. Backend returns `pending` with `ready_at`.
4. After 2 minutes, frontend refreshes.
5. Backend fetches detail, references, and reference details.
6. Backend returns selectable materials.
7. User selects materials.
8. Frontend maps selected materials to `ReferenceDoc[]`.
9. Docs are appended to upload-page `referenceDocs`.

### AI Integration

1. User queries Clinic Master manually.
2. Backend follows the same pending and refresh flow.
3. User selects materials into local AI integration reference docs.
4. Existing chunk search runs against effective docs.
5. User confirms chunks.
6. AI integration request sends confirmed chunks and effective reference inputs.
7. AI integration record stores selected references, confirmed chunks, and local Clinic Master docs needed for citation history.

## Error Handling

- Missing Clinic Master credentials: backend returns a 500 configuration error with masked config summary.
- External HTTP failure: backend returns a 502-style error with endpoint label and safe request summary.
- Signature failure: backend includes safe diagnostic fields, never `appSignKey`.
- Early refresh: backend returns `pending`, not an error.
- No assistant message id after readiness: backend returns a retriable `pending` or `empty` state with a message explaining Clinic Master has not produced a usable answer yet.
- No references: backend still returns answer material if available.
- Reference detail failure: backend returns available materials and marks failed details in warnings instead of failing the whole query, unless every material is blank.
- Duplicate selected materials: frontend deduplicates by material id or filename.

## Testing

Backend tests:

- Signature generation matches the provided example.
- Signing skips top-level null values and never sends `appSignKey`.
- Generated local query ids use hyphenated UUIDs.
- Refresh before `ready_at` does not call detail/reference endpoints.
- Refresh after `ready_at` calls detail, reference list, and reference detail endpoints in the expected order.
- Assistant `messageId` selection uses `roleType=assistant`.
- Form-urlencoded reference-detail requests are sent correctly.
- Normalization returns answer, reference, and detail materials with nonblank text.
- Partial reference-detail failures return warnings and usable materials.

Frontend tests:

- API helpers call the expected local endpoints.
- Material-to-`ReferenceDoc` mapping creates stable filenames and character counts.
- Upload page appends only selected ClinMaster materials.
- AI integration local ClinicMaster docs participate in reference selection and chunk confirmation.
- AI integration records retain local ClinicMaster docs for citation rendering.

Verification:

- Run focused backend tests for Clinic Master and existing guide/reference chunk behavior.
- Run frontend API tests and TypeScript build.

## Rollout Notes

The first release should be enabled only when Clinic Master credentials are configured. If configuration is absent, the UI can show the panel with a clear configuration error after click, or hide/disable it based on a lightweight debug/config endpoint.

The 2-minute waiting rule is part of the product contract. Avoid background polling that silently hammers Clinic Master. A single manual refresh after the countdown is enough for the first release; automatic refresh can be added later with conservative intervals.

## Open Decisions

None for the first implementation. The approved behavior is manual query, 2-minute wait, manual result refresh, manual material selection, and existing chunk confirmation before AI integration.
