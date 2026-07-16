# AI Integration Chunk Selection State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI integration chunk filtering disabled when no question is entered, reversible through an exit button, and explicit about whether confirmed chunks or all selected data sources are used.

**Architecture:** `StepAiIntegration` remains the authoritative owner of confirmed chunk state and request mode. `ChunkConfirmationPanel` gets a separate cancel/exit callback so fullscreen draft edits can be discarded by the parent instead of committed.

**Tech Stack:** React 18, TypeScript, Vite, Node `assert` tests, existing CSS utility classes.

---

## File Structure

- Modify: `frontend/src/components/StepAiIntegration.tsx`
  - Add draft chunk state and commit/discard handlers.
  - Add mode status text and switch button.
  - Preserve the existing button placement near `发送`.
- Modify: `frontend/src/components/ChunkConfirmationPanel.tsx`
  - Add optional exit callback/label for fullscreen.
  - Keep confirm behavior separate from exit behavior.
- Modify: `frontend/src/index.css`
  - Add disabled styling for `.btn-m3-outline`.
- Modify: `frontend/src/components/StepAiIntegrationClinicMaster.test.mjs`
  - Assert AI integration state wiring and UI copy.
- Modify: `frontend/src/components/ChunkConfirmationPanel.test.mjs`
  - Assert exit button support and separation from confirm.

### Task 1: Tests For AI Integration Chunk State

- [ ] **Step 1: Write failing source assertions**

Add assertions to `frontend/src/components/StepAiIntegrationClinicMaster.test.mjs` for:

- `draftGuidelineReferenceChunks`
- `setDraftGuidelineReferenceChunks([])` when opening or discarding
- `exitLabel="退出"`
- `onExit={...}`
- status copy `当前已选择切片：X 个` and `当前没选择切片：使用选中的所有数据源（N 个）`
- switch button copy `不选择切片` and `选择已确认切片`
- the switch-to-chunks control remaining disabled when no confirmed chunks exist

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node src/components/StepAiIntegrationClinicMaster.test.mjs`

Expected: the test fails because the new draft state and exit/status wiring do not exist yet.

- [ ] **Step 3: Implement minimal AI integration state changes**

Update `StepAiIntegration.tsx` to:

- Add draft state.
- Use draft state as `ChunkConfirmationPanel` value while open.
- Commit draft only in `onConfirm`.
- Return to `full` mode when confirming an empty draft.
- Discard draft in `onExit`.
- Render status and switch controls.
- Keep switch-to-chunks disabled unless confirmed chunks exist.
- Clear draft chunks and close the panel at stale-state reset points: reference changes, priority changes, request changes, linked issue changes, and reference-doc resets.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && node src/components/StepAiIntegrationClinicMaster.test.mjs`.

Expected: source assertions pass.

### Task 2: Tests For Chunk Panel Exit Behavior

- [ ] **Step 1: Write failing source/render assertions**

Add assertions to `frontend/src/components/ChunkConfirmationPanel.test.mjs` for:

- `exitLabel`
- `onExit`
- `setFullscreen(false)` followed by `onExit?.()`
- confirm still calls `onConfirm?.()`

- [ ] **Step 2: Run test to verify it fails**

Run: `node src/components/ChunkConfirmationPanel.test.mjs` from `frontend`.

Expected: the test fails because exit props are missing.

- [ ] **Step 3: Implement minimal panel changes**

Update `ChunkConfirmationPanel.tsx` props and fullscreen header actions to show an exit button when `onExit` is provided.

- [ ] **Step 4: Run test to verify it passes**

Run: `node src/components/ChunkConfirmationPanel.test.mjs` from `frontend`.

Expected: panel tests pass.

### Task 3: Disabled Styling And Verification

- [ ] **Step 1: Add CSS assertion**

Extend an existing frontend source test to assert `.btn-m3-outline:disabled` has disabled styling.

- [ ] **Step 2: Implement disabled styling**

Update `frontend/src/index.css` with `.btn-m3-outline:hover:not(:disabled)` and `.btn-m3-outline:disabled` rules.

- [ ] **Step 3: Run targeted tests**

Run:

```bash
cd frontend
node src/components/StepAiIntegrationClinicMaster.test.mjs
node src/components/ChunkConfirmationPanel.test.mjs
```

- [ ] **Step 4: Run build**

Run: `npm --prefix frontend run build` from the repository root, or `npm run build` from `frontend`.

Expected: TypeScript and Vite build complete with exit code 0.
