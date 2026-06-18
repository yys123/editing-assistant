# Guide Data Source Integration Design

## Goal

Add a guide data source entry point to the upload page so editors can search the online guide database by guide name, select a guide, and add its detail content as an existing reference data source.

## Context

The upload page already stores reference inputs as `ReferenceDoc` objects with `filename`, `text`, and `char_count`. Downstream steps read those objects for reference evaluation, section analysis, and draft generation. The new guide integration should produce the same object shape so the rest of the workflow remains unchanged.

## External Endpoints

Use the online data source only:

- Search: `https://newdrugs.dxy.cn/open-sign-api/article-quality/guide/search`
- Detail: `https://newdrugs.dxy.cn/open-sign-api/article-quality/guide/detail`

The search endpoint accepts query parameter `keyword` and returns up to 10 guide results. Each result includes at least `id` and `title`.

The detail endpoint accepts query parameter `id` and returns `data.content`, which may be HTML rich text.

## Architecture

The frontend calls local backend endpoints under `/api/article/guides`. The backend proxies requests to `newdrugs.dxy.cn` with `httpx`, validates response shape, and normalizes error messages. This keeps browser CORS and external response quirks out of the React component.

The frontend adds a compact search panel in the existing "参考数据源" card. Selecting a result fetches its detail and appends a `ReferenceDoc`:

```ts
{
  filename: `指南数据源-${title}.html`,
  text: content,
  char_count: content.length
}
```

## Components

- `backend/routers/article.py`
  - Add request/response models for guide search and detail.
  - Add `GET /api/article/guides/search?keyword=...`.
  - Add `GET /api/article/guides/{guide_id}`.
  - Keep the external host fixed to `newdrugs.dxy.cn`.

- `frontend/src/api.ts`
  - Add `searchGuides(keyword)` and `fetchGuideDetail(id)` helpers.
  - Add `guideDetailToReferenceDoc(detail)` mapper.

- `frontend/src/components/StepUpload.tsx`
  - Add a "对接数据源" button in the reference data source card.
  - Show a small search panel with input, loading/error states, and result rows.
  - Add selected guide detail content to `referenceDocs`.

## Error Handling

- Empty keyword: frontend shows a local validation message.
- Empty search result: frontend shows "未检索到指南".
- External HTTP failure: backend returns a 502-style FastAPI error with a concise message.
- Detail content missing or blank: backend returns 502; frontend shows the message and does not append a reference.

## Testing

- Backend unit tests validate query validation, external response normalization, and detail-to-reference content handling with mocked `httpx.AsyncClient`.
- Frontend API tests validate helper request URLs and `guideDetailToReferenceDoc` mapping.
- Build verification ensures TypeScript and Vite accept the UI changes.
