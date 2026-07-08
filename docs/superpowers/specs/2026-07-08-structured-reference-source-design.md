# Structured Reference Source Design

## Goal

Make local HTML reference files and online guide library details enter the workflow as structured Markdown-like reference sources instead of flattened plain text.

The main outcome is that downstream reference review, section quality review, guide chunk confirmation, and AI integration can preserve source headings, lists, tables, and citation markers well enough to select evidence by section rather than by one long text blob.

## Context

The upload page already stores all reference data sources as `ReferenceDoc` objects:

```ts
{
  filename: string
  text: string
  char_count: number
}
```

Downstream code then converts those objects into `ReferenceInput` items with stable source IDs. The reference chunk service already understands Markdown-style headings such as `## 诊断` and uses them to build `title_path` values.

The gap is at ingestion:

- Local reference HTML currently goes through `parse_html_to_text()`, which extracts readable text but may flatten structural cues.
- Online guide detail normalization already handles some HTML and Markdown-like `body` fields, but the output format is mixed across source fields.

## Scope

In scope:

- Normalize local `.html/.htm` reference uploads into a consistent structured text format.
- Normalize online guide detail content into the same structured text format regardless of whether the external field is HTML, Markdown-like text, parsed PDF text, or plain text.
- Preserve headings, paragraphs, lists, tables, and inline citation markers where the existing parser can identify them.
- Keep the public `ReferenceDoc` shape unchanged.
- Keep downstream request payloads unchanged.

Out of scope:

- Changing PDF or Word extraction behavior.
- Adding a vector database or semantic search engine.
- Fetching or updating external guideline versions automatically.
- Building a full Markdown renderer in the frontend.
- Guaranteeing perfect reconstruction of every HTML visual layout.

## Recommended Approach

Use a single backend helper for structured reference text normalization.

The helper should accept raw content plus a source hint and return text in the system's existing structured format:

```md
[H1] 指南标题

[H2] 诊断

诊断标准包括……

- 条目一
- 条目二

| 指标 | 推荐 |
| --- | --- |
| HbA1c | 可用于诊断 |
```

This format matches current parser behavior and requires minimal downstream change. It is Markdown-like enough for chunking, review prompts, and human preview, while staying compatible with existing `[H2]` heading handling in the codebase.

## Data Flow

### Local HTML Reference Upload

1. User uploads `.html` or `.htm` in the reference data source area.
2. Backend decodes the file.
3. Backend normalizes HTML through the structured HTML parser instead of flattening it to plain text.
4. Backend returns the same `ReferenceDoc` object with structured `text`.
5. Frontend displays the document as before.

### Online Guide Library

1. User searches the online guide library and selects a guide.
2. Backend fetches guide detail through the existing signed proxy.
3. Backend chooses the best available content field using the existing priority order:
   - `guide_body.content`
   - `guide_body.body`
   - active `guide_parse_text.process_context`
   - `ai_en_body`
   - fallback content fields
4. Backend normalizes the chosen content:
   - HTML is parsed into structured text.
   - Markdown-like text is converted or preserved with heading structure.
   - Plain text is preserved with cleanup.
5. Frontend maps the result to `ReferenceDoc` as it does today.

## Parser Rules

The structured reference parser should:

- Convert `h1-h6` to `[H1]` through `[H6]` headings.
- Preserve paragraphs as separate blocks.
- Preserve list items as separate lines with a list marker when possible.
- Convert simple HTML tables to Markdown tables using the existing table extraction behavior.
- Preserve numeric citation markers normalized by the existing citation logic, such as `[64,65,66]`.
- Remove scripts, styles, navigation, forms, and other non-content nodes.
- Preserve leading preface text before the first heading, because guide articles often contain title, society, journal, and abstract metadata before the first formal section.

## Error Handling

- If structured parsing returns blank text, return the existing parse failure error.
- If online guide detail has no usable content field, keep the existing 502 response with diagnostic field summaries.
- If a source is plain text and has no recognizable headings, keep it as cleaned text rather than forcing artificial headings.

## Compatibility

The change should not alter external API shapes:

- `GET /api/article/guides/{guide_id}` still returns `{ id, title, content }`.
- Reference uploads still return `ReferenceDoc[]`.
- Frontend state remains `referenceDocs: ReferenceDoc[]`.
- Downstream review and generation payloads remain unchanged.

Existing reference chunking becomes more effective because the text contains clearer heading boundaries.

## Implementation Notes

- Reuse `parse_html_structured(..., preserve_leading_text=True)` for reference HTML normalization where possible.
- Keep `parse_html_to_text()` available for callers that truly want plain text.
- Add a small helper in `backend/routers/article.py` or `backend/services/scraper.py` so local HTML references and guide detail normalization share the same behavior.
- Update the reference upload UI copy from `.pdf .doc .docx .html` only if the implementation also adds `.md`; otherwise keep the current accepted formats.

## Testing

Backend tests should cover:

- Local reference HTML with headings returns `[H2]` style structure.
- Local reference HTML preserves preface text before the first heading.
- Local reference HTML preserves citation markers and removes HTML tags.
- Online guide detail with Markdown-like `body` returns structured headings.
- Online guide detail with HTML content returns structured headings.
- Blank or unsupported content still returns the existing error behavior.

Frontend tests are only needed if UI copy or accepted extensions change.

## Open Decisions

None. The first implementation should normalize HTML and online guide library content only, as requested.
