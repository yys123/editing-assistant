# DeepSeek Thinking Mode Design

## Goal

Make DeepSeek thinking mode reliably available from the existing admin settings, with safe defaults and tests that prove the backend sends the expected API payload.

## Context

The admin settings modal already exposes a thinking mode switch and effort selector. The backend also already maps those fields into the DeepSeek request payload:

- `deepseek_thinking_type` -> `thinking.type`
- `deepseek_reasoning_effort` -> `reasoning_effort`

The current gap is default behavior. Existing runtime configuration may omit `deepseek_thinking_type`, and the backend default falls back to `disabled`, so the application can explicitly turn off thinking mode even though DeepSeek's current documentation says the official default is enabled.

DeepSeek's Chinese Thinking Mode documentation describes:

- OpenAI-format toggle: `{"thinking": {"type": "enabled/disabled"}}`
- effort control: `{"reasoning_effort": "high/max"}`
- default thinking toggle: `enabled`
- default effort for normal requests: `high`
- unsupported sampling parameters in thinking mode: `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`
- final answer returned in `content`, with chain-of-thought content returned in `reasoning_content`

Because this project sends raw JSON through `httpx`, the backend can put `thinking` directly in the request body. The `extra_body` wrapper in the documentation only applies when using the OpenAI SDK.

## Requirements

- Keep the existing admin UI controls for thinking mode.
- Make thinking mode enabled by default for DeepSeek requests.
- Preserve the ability for admins to explicitly disable thinking mode.
- Send `reasoning_effort` only when thinking mode is enabled.
- Do not send `temperature`, `top_p`, `presence_penalty`, or `frequency_penalty` when thinking mode is enabled.
- Preserve current DeepSeek audit logging of the outgoing request payload so admins can verify whether thinking mode was enabled.
- Add focused tests for default config and DeepSeek payload behavior.

## Non-Goals

- Do not expose or display `reasoning_content` in the product UI in this iteration.
- Do not change business prompts.
- Do not add tool-calling support or multi-round reasoning-content replay.
- Do not replace the current admin settings modal with a new settings system.
- Do not remove the non-thinking mode path.

## Recommended Approach

Use a small default-policy update rather than a new feature surface.

The UI already has the needed controls, and the backend request builder already has the right branching shape. The implementation should make the default state match DeepSeek's current documented behavior, then verify the payload with tests.

## Configuration Design

### Backend Settings

Extend `backend/config.py` with explicit settings:

- `deepseek_thinking_type: str = "enabled"`
- `deepseek_reasoning_effort: str = "high"`

This lets environment variables control the setting naturally and removes reliance on `getattr(..., "disabled")` fallbacks.

### Runtime Defaults

Update `backend/services/admin_runtime.py`:

- `DEFAULT_CONFIG["deepseek_thinking_type"] = "enabled"`
- keep `DEFAULT_CONFIG["deepseek_reasoning_effort"] = "high"`
- `_base_text_config()` should read the explicit settings and default to `enabled` only as a compatibility fallback.

When an existing runtime config file lacks `deepseek_thinking_type`, `load_runtime_config()` should merge in the new default and surface `enabled` to the admin UI.

### Current Runtime Config

Update the existing runtime config file to include:

- `"deepseek_thinking_type": "enabled"`
- `"deepseek_reasoning_effort": "high"`

This avoids a deployment where the code default changes but the current saved admin config still omits the explicit field.

## Model Name Design

Keep model migration separate from the thinking-mode default unless the user chooses to combine them.

The safest first change is to preserve the current model value and only change thinking-mode behavior. That keeps the blast radius small.

A follow-up migration can change defaults from `deepseek-chat` to `deepseek-v4-flash` or `deepseek-v4-pro`, since DeepSeek's model page describes the older `deepseek-chat` and `deepseek-reasoner` names as compatibility aliases. That migration should be tested separately because it may change output quality, latency, cost, and token limits.

## Request Payload Design

Keep the current `backend/services/deepseek.py` request structure:

- Always send `thinking` when `deepseek_thinking_type` is either `enabled` or `disabled`.
- If thinking is enabled:
  - send `reasoning_effort` when it is `high` or `max`
  - omit sampling parameters that DeepSeek says do not apply in thinking mode
- If thinking is disabled:
  - send existing sampling parameters as today

This preserves explicit admin intent. If the admin selects disabled, the backend sends `{"thinking": {"type": "disabled"}}` rather than relying on provider defaults.

## Admin UI Design

Keep the existing controls:

- thinking mode select: off/on
- effort select: high/max
- disable sampling controls when thinking mode is enabled

Small UI updates:

- set `EMPTY_CONFIG.deepseek_thinking_type` to `enabled`
- keep `EMPTY_CONFIG.deepseek_reasoning_effort` as `high`
- update the help text to mention that DeepSeek's official default is thinking mode enabled, and that sampling parameters are ignored in that mode

No layout changes are needed.

## Reasoning Content Design

Do not persist or display `reasoning_content` in this iteration.

Rationale:

- the product only needs final generated text for current workflows
- logging chain-of-thought content may significantly increase request/response log size
- exposing chain-of-thought creates additional privacy and review concerns
- the current app does not use DeepSeek tool calls, so it does not need to replay `reasoning_content` in later turns

The backend may add internal debug logging later if a concrete diagnostic need appears.

## Error Handling

No new user-facing errors are required.

The existing request path already handles:

- missing API key
- HTTP failures
- empty choices
- truncated output
- empty final content

If DeepSeek rejects a thinking-mode payload, the existing `response.raise_for_status()` path should surface the provider error. Tests should reduce this risk by asserting the request shape against documented parameters.

## Testing Strategy

### Backend Unit Tests

Update `backend/tests/test_admin_features.py` or the closest existing admin-runtime test to assert:

- base/default effective config includes `deepseek_thinking_type == "enabled"`
- existing runtime config that omits the field receives the merged default

Update `backend/tests/test_text_llm.py` DeepSeek tests to assert:

- default DeepSeek payload sends `thinking: {"type": "enabled"}`
- default DeepSeek payload sends `reasoning_effort: "high"`
- thinking mode omits `temperature`, `top_p`, `presence_penalty`, and `frequency_penalty`
- disabled thinking mode still sends sampling parameters

### Frontend Test Scope

No new frontend test is required unless the project already has direct tests around the admin settings modal defaults. The frontend change is a simple default value update, while the backend runtime config remains the source of truth after loading admin settings.

### Manual Verification

Use the admin AI request log view to inspect a recent DeepSeek request payload and confirm:

```json
{
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high"
}
```

Also confirm sampling parameters are absent while thinking mode is enabled.

## Rollback

Rollback is configuration-first:

- set thinking mode to disabled in the admin settings
- or set `DEEPSEEK_THINKING_TYPE=disabled` in environment configuration

Because the non-thinking request path remains intact, rollback should not require code changes.

## Risks

- Thinking mode may increase latency and output-token usage.
- Output style may change enough to affect downstream JSON parsing or section review prompts.
- Current tests may assume the default DeepSeek payload includes sampling parameters.
- Existing saved runtime configs can mask code defaults unless they are merged or explicitly updated.

## Open Decisions

- Whether to migrate the default model to `deepseek-v4-flash` in the same implementation or keep that as a follow-up.
- Whether to add response-side logging for `reasoning_content` later for diagnostics.
