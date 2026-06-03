# DeepSeek Text Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a switchable DeepSeek text provider for backend text generation while keeping Gemini dedicated to image analysis.

**Architecture:** Keep Gemini-specific logic in `backend/services/gemini.py`, add a DeepSeek-only text client, and introduce a small `text_llm.py` routing layer controlled by `TEXT_MODEL_PROVIDER`. Update business services to depend on the shared text entry point so provider switching is configuration-only.

**Tech Stack:** Python, FastAPI backend, `pydantic-settings`, `httpx`, `google-generativeai`, `unittest`

---

## File Map

- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/config.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/.env.example`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/.env`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/requirements.txt`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/gemini.py`
- Create: `/Users/dxy/Documents/IT/editing-assistant/backend/services/deepseek.py`
- Create: `/Users/dxy/Documents/IT/editing-assistant/backend/services/text_llm.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/analyzer.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/generator.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/ref_evaluator.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/section_parser.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/tests/test_section_parser.py`
- Create: `/Users/dxy/Documents/IT/editing-assistant/backend/tests/test_text_llm.py`

### Task 1: Lock Provider Settings With Tests

**Files:**
- Create: `/Users/dxy/Documents/IT/editing-assistant/backend/tests/test_text_llm.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/config.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/.env.example`

- [ ] **Step 1: Write the failing routing/config tests**

Add `backend/tests/test_text_llm.py` with coverage for:

```python
import unittest
from unittest.mock import AsyncMock, patch

from services import text_llm


class TextLlmRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_routes_to_gemini_when_provider_is_gemini(self):
        with patch("services.text_llm.settings.text_model_provider", "gemini"), \
             patch("services.text_llm.generate_text_with_gemini", new=AsyncMock(return_value="ok")) as mock_gemini:
            result = await text_llm.generate_text("prompt", "sys", context="ctx")
        self.assertEqual(result, "ok")
        mock_gemini.assert_awaited_once_with("prompt", "sys", context="ctx")

    async def test_routes_to_deepseek_when_provider_is_deepseek(self):
        with patch("services.text_llm.settings.text_model_provider", "deepseek"), \
             patch("services.text_llm.generate_text_with_deepseek", new=AsyncMock(return_value="ok")) as mock_deepseek:
            result = await text_llm.generate_text("prompt", "sys", context="ctx")
        self.assertEqual(result, "ok")
        mock_deepseek.assert_awaited_once_with("prompt", "sys", context="ctx")

    async def test_rejects_unknown_provider(self):
        with patch("services.text_llm.settings.text_model_provider", "bad-provider"):
            with self.assertRaises(ValueError):
                await text_llm.generate_text("prompt")
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest tests.test_text_llm -v
```

Expected: FAIL because `services.text_llm` and provider-aware settings do not exist yet.

- [ ] **Step 3: Extend configuration with provider-aware settings**

Update `backend/config.py` to add:

```python
class Settings(BaseSettings):
    text_model_provider: str = "gemini"
    gemini_api_key: str
    cors_origins: str = "http://localhost:5177"
    gemini_model: str = "gemini-3-flash-preview"
    gemini_proxy: str = ""
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"
```

Update `backend/.env.example` to document:

```dotenv
TEXT_MODEL_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
CORS_ORIGINS=http://localhost:5177
```

- [ ] **Step 4: Add the minimal text router to satisfy the tests**

Create `backend/services/text_llm.py` with:

```python
from config import settings
from services.deepseek import generate_text_with_deepseek
from services.gemini import generate_text_with_gemini


async def generate_text(prompt: str, system_instruction: str = None, context: str = "unknown") -> str:
    provider = settings.text_model_provider.strip().lower()
    if provider == "gemini":
        return await generate_text_with_gemini(prompt, system_instruction, context=context)
    if provider == "deepseek":
        return await generate_text_with_deepseek(prompt, system_instruction, context=context)
    raise ValueError(f"Unsupported TEXT_MODEL_PROVIDER: {settings.text_model_provider}")
```

- [ ] **Step 5: Run the routing test to verify it passes**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest tests.test_text_llm -v
```

Expected: PASS

- [ ] **Step 6: Commit the config and routing baseline**

```bash
git add backend/config.py backend/.env.example backend/tests/test_text_llm.py backend/services/text_llm.py
git commit -m "feat: add text provider routing config"
```

### Task 2: Add DeepSeek Text Client Without Touching Vision

**Files:**
- Create: `/Users/dxy/Documents/IT/editing-assistant/backend/services/deepseek.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/requirements.txt`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/tests/test_text_llm.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/gemini.py`

- [ ] **Step 1: Expand tests to define DeepSeek behavior**

Add test coverage for:

```python
class DeepSeekClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_deepseek_combines_system_and_user_messages(self):
        ...

    async def test_deepseek_raises_on_empty_text(self):
        ...
```

Mock the HTTP client instead of calling the network. Assert that:

- system instruction becomes a `system` message when present
- prompt becomes a `user` message
- successful responses return stripped text
- empty content raises `ValueError`

- [ ] **Step 2: Run the focused DeepSeek tests and confirm they fail**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest tests.test_text_llm -v
```

Expected: FAIL because the DeepSeek client implementation does not exist.

- [ ] **Step 3: Add the DeepSeek client dependency if needed**

Prefer reusing `httpx`, which is already present in `backend/requirements.txt`, instead of pulling in a larger SDK. Do not add a new dependency unless the existing HTTP client proves insufficient.

- [ ] **Step 4: Implement the DeepSeek text client**

Create `backend/services/deepseek.py` with an async function shaped like:

```python
async def generate_text_with_deepseek(
    prompt: str,
    system_instruction: str = None,
    context: str = "unknown",
) -> str:
    ...
```

Implementation requirements:

- read `deepseek_api_key`, `deepseek_model`, and `deepseek_base_url` from settings
- POST to `/chat/completions`
- send OpenAI-compatible messages
- log provider, model, elapsed time, prompt chars, and usage fields when present
- raise a clear error on missing API key, empty output, or malformed response

- [ ] **Step 5: Rename Gemini text function but keep image analysis intact**

Refactor `backend/services/gemini.py`:

- preserve `analyze_image(...)`
- move the current text implementation into `generate_text_with_gemini(...)`
- keep date-prefix behavior for Gemini text calls

If compatibility helps the transition, keep a thin temporary alias:

```python
async def generate_text(...):
    return await generate_text_with_gemini(...)
```

Only remove the alias after all imports and tests have migrated.

- [ ] **Step 6: Run the DeepSeek and routing tests**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest tests.test_text_llm -v
```

Expected: PASS

- [ ] **Step 7: Commit the provider implementations**

```bash
git add backend/services/deepseek.py backend/services/gemini.py backend/tests/test_text_llm.py backend/requirements.txt
git commit -m "feat: add deepseek text client"
```

### Task 3: Migrate Business Text Callers to the Shared Entry Point

**Files:**
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/analyzer.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/generator.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/ref_evaluator.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/services/section_parser.py`
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/tests/test_section_parser.py`

- [ ] **Step 1: Update the section parser test to patch the new import path**

Change:

```python
with patch("services.gemini.generate_text", side_effect=fake_generate_text):
```

To:

```python
with patch("services.section_parser.generate_text", side_effect=fake_generate_text):
```

Or another equivalent path that matches the final import shape inside `section_parser.py`.

- [ ] **Step 2: Run the section parser test to confirm it fails if imports are still old**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest tests.test_section_parser -v
```

Expected: FAIL or still patch the wrong symbol until call sites are migrated.

- [ ] **Step 3: Migrate service imports to `services.text_llm`**

Update these files to import the shared text entry point:

```python
from services.text_llm import generate_text
```

Files:

- `backend/services/analyzer.py`
- `backend/services/generator.py`
- `backend/services/ref_evaluator.py`
- `backend/services/section_parser.py`

For `section_parser.py`, prefer a module-level import instead of an inner import unless there is a proven cycle.

- [ ] **Step 4: Remove the transitional Gemini text alias if no callers remain**

Verify with:

```bash
rg -n "services\\.gemini\\.generate_text|from services\\.gemini import generate_text" /Users/dxy/Documents/IT/editing-assistant/backend /Users/dxy/Documents/IT/editing-assistant/backend/tests
```

If no caller remains, remove the old alias from `gemini.py`.

- [ ] **Step 5: Run the affected tests**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest tests.test_section_parser tests.test_text_llm -v
```

Expected: PASS

- [ ] **Step 6: Commit the call-site migration**

```bash
git add backend/services/analyzer.py backend/services/generator.py backend/services/ref_evaluator.py backend/services/section_parser.py backend/tests/test_section_parser.py backend/services/gemini.py
git commit -m "refactor: route text generation through text llm"
```

### Task 4: Switch Local Env to DeepSeek and Run Verification

**Files:**
- Modify: `/Users/dxy/Documents/IT/editing-assistant/backend/.env`

- [ ] **Step 1: Update local environment values**

Set:

```dotenv
TEXT_MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_real_key
DEEPSEEK_MODEL=deepseek-chat
```

Keep:

```dotenv
GEMINI_API_KEY=...
```

because image analysis still depends on Gemini.

- [ ] **Step 2: Verify backend imports under DeepSeek mode**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
TEXT_MODEL_PROVIDER=deepseek python3 -c "from services.text_llm import generate_text; print('ok')"
```

Expected: prints `ok`

- [ ] **Step 3: Run the targeted backend test suite**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest tests.test_text_llm tests.test_section_parser -v
```

Expected: PASS

- [ ] **Step 4: Run a broader backend discovery pass**

Run:

```bash
cd /Users/dxy/Documents/IT/editing-assistant/backend
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Expected: PASS

- [ ] **Step 5: Commit the local provider switch if desired**

Only do this if the repository is intended to keep the local `.env` change under version control:

```bash
git add backend/.env
git commit -m "chore: switch local text provider to deepseek"
```

If `.env` should remain personal-only, skip the commit and document the manual setting in the final handoff.

## Notes for Execution

- Prefer `httpx` over introducing a new DeepSeek SDK.
- Keep Gemini image handling untouched unless a test proves the split caused a regression.
- Do not rewrite prompts during this work.
- Preserve existing log field names where practical so current operational logs remain comparable.
