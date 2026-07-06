# DeepSeek Thinking Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DeepSeek thinking mode enabled by default while preserving the existing admin switch and non-thinking fallback.

**Architecture:** This is a narrow default-policy change. Backend settings and runtime defaults become explicit, the existing DeepSeek request builder continues to own payload branching, and the admin UI default mirrors the backend default.

**Tech Stack:** Python `unittest`, FastAPI/Pydantic settings, React/TypeScript admin settings modal.

---

## File Structure

- Modify: `backend/config.py`
  - Add explicit DeepSeek thinking settings so environment variables can control them.
- Modify: `backend/services/admin_runtime.py`
  - Change runtime default for `deepseek_thinking_type` to `enabled`.
  - Change compatibility fallback in `_base_text_config()` to `enabled`.
- Modify: `backend/tests/test_admin_features.py`
  - Add tests proving missing runtime config fields merge to enabled.
  - Extend effective-config tests with explicit thinking settings.
- Modify: `backend/tests/test_text_llm.py`
  - Change default DeepSeek payload expectation from disabled to enabled.
  - Keep existing explicit enabled and sampling-omission test.
  - Add explicit disabled-path assertion if needed.
- Modify: `frontend/src/components/AdminSettingsModal.tsx`
  - Change empty/default UI config to enabled.
  - Update helper copy.

## Task 1: Backend Runtime Defaults

**Files:**
- Modify: `backend/tests/test_admin_features.py`
- Modify: `backend/config.py`
- Modify: `backend/services/admin_runtime.py`

- [ ] **Step 1: Write failing admin-runtime tests**

Add assertions showing:

```python
loaded = admin_runtime.load_runtime_config()
self.assertEqual(loaded["deepseek_thinking_type"], "enabled")
self.assertEqual(loaded["deepseek_reasoning_effort"], "high")
```

Also ensure `_base_text_config()` and `get_effective_text_config()` can read explicit settings:

```python
self.assertEqual(user_effective["deepseek_thinking_type"], "enabled")
self.assertEqual(admin_effective["deepseek_thinking_type"], "enabled")
```

- [ ] **Step 2: Run admin tests to verify it fails**

Run:

```bash
cd backend
GEMINI_API_KEY=dummy python3 -m unittest tests.test_admin_features
```

Expected: FAIL because current default is `disabled`.

- [ ] **Step 3: Implement backend defaults**

In `backend/config.py`, add:

```python
deepseek_thinking_type: str = "enabled"
deepseek_reasoning_effort: str = "high"
```

In `backend/services/admin_runtime.py`:

```python
"deepseek_thinking_type": "enabled",
```

and:

```python
"deepseek_thinking_type": getattr(settings, "deepseek_thinking_type", "enabled"),
```

- [ ] **Step 4: Run admin tests to verify pass**

Run:

```bash
cd backend
GEMINI_API_KEY=dummy python3 -m unittest tests.test_admin_features
```

Expected: PASS.

## Task 2: DeepSeek Payload Defaults

**Files:**
- Modify: `backend/tests/test_text_llm.py`

- [ ] **Step 1: Write failing DeepSeek payload test update**

Change the default DeepSeek fake settings in `test_generate_text_with_deepseek_uses_chat_completions_payload`:

```python
deepseek_thinking_type="enabled",
```

Assert:

```python
self.assertEqual(payload["thinking"], {"type": "enabled"})
self.assertEqual(payload["reasoning_effort"], "high")
self.assertNotIn("temperature", payload)
self.assertNotIn("top_p", payload)
self.assertNotIn("presence_penalty", payload)
self.assertNotIn("frequency_penalty", payload)
```

Add or preserve an explicit disabled-path test that sends `runtime_config={"deepseek_thinking_type": "disabled"}` and asserts sampling parameters are still sent.

- [ ] **Step 2: Run text LLM tests to verify the test protects behavior**

Run:

```bash
cd backend
GEMINI_API_KEY=dummy python3 -m unittest tests.test_text_llm
```

Expected: PASS if the existing request builder already handles enabled thinking mode correctly. This test still protects the new default behavior.

- [ ] **Step 3: Make minimal payload changes only if needed**

Do not rewrite `backend/services/deepseek.py` unless tests expose a real mismatch. The existing request builder already omits sampling params when thinking mode is enabled.

- [ ] **Step 4: Run text LLM tests to verify pass**

Run:

```bash
cd backend
GEMINI_API_KEY=dummy python3 -m unittest tests.test_text_llm
```

Expected: PASS.

## Task 3: Admin UI Default

**Files:**
- Modify: `frontend/src/components/AdminSettingsModal.tsx`

- [ ] **Step 1: Update UI default config**

Change:

```tsx
deepseek_thinking_type: 'enabled',
```

- [ ] **Step 2: Update helper copy**

Keep the current warning placement and mention that DeepSeek's official default is thinking mode enabled:

```tsx
DeepSeek 官方默认开启思考模式。开启时，temperature、top_p、presence_penalty、frequency_penalty 不生效，后端会自动不发送这些参数。
```

- [ ] **Step 3: Run TypeScript build if dependencies are available**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. If `node_modules` is unavailable in the worktree, report that frontend build was not run and verify by targeted code inspection.

## Task 4: Final Verification and Commit

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
cd backend
GEMINI_API_KEY=dummy python3 -m unittest tests.test_admin_features tests.test_text_llm
```

Expected: PASS.

- [ ] **Step 2: Review diff**

Run:

```bash
git diff -- backend/config.py backend/services/admin_runtime.py backend/tests/test_admin_features.py backend/tests/test_text_llm.py frontend/src/components/AdminSettingsModal.tsx
```

Expected: Only default-policy, tests, and UI copy changes.

- [ ] **Step 3: Commit**

Run:

```bash
git add backend/config.py backend/services/admin_runtime.py backend/tests/test_admin_features.py backend/tests/test_text_llm.py frontend/src/components/AdminSettingsModal.tsx docs/superpowers/plans/2026-07-06-deepseek-thinking-mode.md
git commit -m "Enable DeepSeek thinking mode by default"
```
