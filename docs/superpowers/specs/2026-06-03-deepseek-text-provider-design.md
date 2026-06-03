# DeepSeek Text Provider Design

## Goal

Allow the backend to switch text generation between Gemini and DeepSeek via local configuration, while keeping image analysis on Gemini only.

## Context

The current backend routes all LLM work through `backend/services/gemini.py`. That file currently owns two distinct responsibilities:

- text generation for article parsing and downstream analysis
- image analysis for uploaded figures

The requested change is intentionally temporary and low-risk: test DeepSeek's text quality without disturbing the working image-analysis path.

## Requirements

- Add a local configuration switch for text provider selection.
- Support DeepSeek official API for text generation.
- Keep Gemini available for text generation so the project can switch back quickly.
- Keep Gemini as the only provider for image analysis.
- Avoid changing business-layer prompt construction and call sites where possible.
- Preserve existing logging and error semantics closely enough that downstream services do not need to change.

## Non-Goals

- Rewriting business prompts.
- Replacing Gemini image analysis.
- Building a full multi-provider abstraction for every modality.
- Refactoring unrelated backend services.

## Recommended Approach

Use a split-by-capability provider design:

- Gemini remains the vision provider.
- Text generation gains a provider switch.
- Upstream business services continue calling one shared `generate_text(...)` entry point.

This keeps the change narrow, reversible, and compatible with the current code layout.

## Configuration Design

`backend/config.py` should be extended with provider-aware settings:

- `text_model_provider: str = "gemini"`
- `gemini_api_key: str`
- `gemini_model: str = "gemini-3-flash-preview"`
- `gemini_proxy: str = ""`
- `deepseek_api_key: str = ""`
- `deepseek_model: str = "deepseek-chat"`
- optional `deepseek_base_url: str = "https://api.deepseek.com"`

`backend/.env.example` should document the new keys:

- `TEXT_MODEL_PROVIDER=gemini`
- `GEMINI_API_KEY=...`
- `DEEPSEEK_API_KEY=...`
- `DEEPSEEK_MODEL=deepseek-chat`

`backend/.env` can then be switched locally to:

- `TEXT_MODEL_PROVIDER=deepseek`
- `DEEPSEEK_API_KEY=...`

Gemini credentials must stay present because image analysis will still depend on them.

## File Boundary Design

### `backend/services/gemini.py`

Keep Gemini-specific implementation details here:

- Gemini client setup
- date-prefixed system instruction behavior
- Gemini text implementation
- Gemini image analysis implementation

This file should stop being the global routing layer for all text generation.

### `backend/services/deepseek.py`

Add a focused DeepSeek text client module responsible for:

- DeepSeek API client setup
- converting `system_instruction` and `prompt` into DeepSeek chat messages
- returning plain text output
- exposing usage/logging metadata when available
- translating provider-specific failures into project-friendly exceptions

This module should not implement image analysis.

### `backend/services/text_llm.py`

Add a small routing module that exports the shared text entry point:

- `generate_text(prompt: str, system_instruction: str | None = None, context: str = "unknown") -> str`

Routing behavior:

- if `TEXT_MODEL_PROVIDER=gemini`, delegate to Gemini text generation
- if `TEXT_MODEL_PROVIDER=deepseek`, delegate to DeepSeek text generation
- otherwise raise a clear configuration error

This becomes the single import target for business-layer text calls.

## Call-Site Changes

Update current text consumers to import from `text_llm.py` instead of `gemini.py`:

- `backend/services/analyzer.py`
- `backend/services/generator.py`
- `backend/services/ref_evaluator.py`
- `backend/services/section_parser.py`
- any tests patching `services.gemini.generate_text`

No prompt content changes are expected.

`backend/routers/article.py` and any image-analysis callers should continue using Gemini-backed image logic.

## Logging Design

Preserve the current operational visibility as closely as practical.

Each text provider should log:

- `context`
- provider/model name
- elapsed milliseconds
- prompt length
- token usage when the provider exposes it

If DeepSeek usage fields differ from Gemini's shape, logs may normalize missing fields to `None` rather than inventing fake values.

## Error Handling Design

Business services currently expect `generate_text(...)` to either return non-empty text or raise an exception.

The DeepSeek path should keep that contract:

- empty or whitespace-only output raises a user-facing error
- abnormal finish states raise a provider error
- configuration omissions raise a clear startup/runtime configuration error

Error wording does not need to be byte-for-byte identical to Gemini, but it should remain concise and actionable.

## Testing Strategy

Use the smallest verification loop that proves routing and compatibility.

### Unit tests

- add or update tests for provider routing in `text_llm.py`
- add DeepSeek-path tests with mocked client responses
- update existing tests that patch `generate_text(...)` so they patch the new import path

### Smoke verification

- confirm settings load correctly from `backend/.env`
- confirm the backend imports successfully with `TEXT_MODEL_PROVIDER=deepseek`
- run the backend test subset covering services that depend on `generate_text(...)`

## Risks

- Existing tests may patch the old module path and silently stop intercepting calls after the import move.
- DeepSeek usage metadata may not map one-to-one with Gemini's current logging fields.
- If Gemini API key validation happens eagerly at import time, the project must still tolerate Gemini being present only for image analysis.

## Rollback

Rollback is configuration-first:

- set `TEXT_MODEL_PROVIDER=gemini`
- keep DeepSeek settings in place or remove them later

Because the call sites stay on one shared text interface, rollback should not require business-code edits.
