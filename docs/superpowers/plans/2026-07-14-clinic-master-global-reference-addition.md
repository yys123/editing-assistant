# Clinic Master Global Reference Addition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selected Clinic Master answers and literature details to the global reference-source list from AI integration without automatically running AI integration or bypassing the normal reference-selection workflow.

**Architecture:** `ClinicMasterPanel` filters and converts selected eligible materials, while `StepGuideLookup` owns duplicate-safe merging into `referenceDocs`. `StepAiIntegration` is rewired to the application-level reference state and stops injecting Clinic Master selections as temporary confirmed chunks, so the existing reference checkbox and chunk-confirmation flow remains the only path into an AI integration request.

**Tech Stack:** React 18, TypeScript, Node `assert`, esbuild-based component tests, Vite.

---

## File Map

- Modify `frontend/src/components/ClinicMasterPanel.tsx`: material eligibility, conversion, addition notice, and `加入数据源` action.
- Modify `frontend/src/components/ClinicMasterPanel.test.mjs`: test eligible types, selected conversion, blank-content handling, and notice formatting.
- Modify `frontend/src/components/StepGuideLookup.tsx`: expose duplicate-safe merge results to the panel.
- Create `frontend/src/components/StepGuideLookup.test.mjs`: test global merge and duplicate counting.
- Modify `frontend/src/components/StepAiIntegration.tsx`: use global reference addition and remove the temporary Clinic Master chunk path.
- Modify `frontend/src/App.tsx`: pass the guarded global reference updater into AI integration.
- Create `frontend/src/components/StepAiIntegrationClinicMaster.test.mjs`: assert the integration wiring and absence of the temporary direct-chunk path.

The target production files already contain pre-existing uncommitted user work. Do not commit production-file changes from this plan, because doing so would also capture unrelated existing edits. Preserve all existing modifications and report the final focused diff instead.

### Task 1: Clinic Master Material Addition Logic and UI

**Files:**
- Modify: `frontend/src/components/ClinicMasterPanel.test.mjs`
- Modify: `frontend/src/components/ClinicMasterPanel.tsx`

- [ ] **Step 1: Write failing tests for reference eligibility and conversion**

Extend the component test imports with:

```js
buildClinicMasterReferenceAddition,
formatClinicMasterReferenceAddition,
shouldUseClinicMasterMaterialAsReference,
```

Add fixtures covering `answer`, `reference_detail`, `reference`, `chat_detail`, and blank-text answer materials. Assert:

```js
assert.equal(shouldUseClinicMasterMaterialAsReference('answer'), true)
assert.equal(shouldUseClinicMasterMaterialAsReference('reference_detail'), true)
assert.equal(shouldUseClinicMasterMaterialAsReference('reference'), false)
assert.equal(shouldUseClinicMasterMaterialAsReference('chat_detail'), false)

const addition = buildClinicMasterReferenceAddition(materials, new Set(['answer-1', 'detail-1', 'reference-1', 'blank-1']))
assert.equal(addition.docs.length, 2)
assert.equal(addition.unusable, 1)
assert.match(addition.docs[0].filename, /^ClinMaster-/)
assert.equal(formatClinicMasterReferenceAddition({ added: 1, duplicates: 1, unusable: 1 }), '已加入 1 条；跳过重复 1 条；无可用正文 1 条')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd frontend && node src/components/ClinicMasterPanel.test.mjs
```

Expected: FAIL because the three exported helpers do not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

In `ClinicMasterPanel.tsx`:

- Import `clinicMasterMaterialToReferenceDoc` from `../api`.
- Export `shouldUseClinicMasterMaterialAsReference(type)`, true only for `answer` and `reference_detail`.
- Export `buildClinicMasterReferenceAddition(materials, selectedIds)` returning `{ docs, unusable }`.
- Exclude unselected, ineligible, and blank-text records.
- Export `formatClinicMasterReferenceAddition({ added, duplicates, unusable })` with the exact Chinese notice fragments from the spec.
- Update the `onAddReferenceDocs` callback contract to return `{ added, duplicates } | void`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
cd frontend && node src/components/ClinicMasterPanel.test.mjs
```

Expected: `ClinicMasterPanel tests passed`.

- [ ] **Step 5: Write a failing source-contract assertion for the button**

In `ClinicMasterPanel.test.mjs`, read `ClinicMasterPanel.tsx` and assert the source contains:

```js
assert.match(source, /clinic-master-add-references/)
assert.match(source, /addButtonLabel/)
assert.match(source, /onAddReferenceDocs\(addition\.docs\)/)
```

Run the focused test and expect FAIL because the action is not rendered.

- [ ] **Step 6: Render the addition action and notice**

In `ClinicMasterPanel`:

- Destructure `addButtonLabel` and `onAddReferenceDocs`.
- Add `additionNotice` state and clear it when creating, refreshing, or opening a different query.
- When global addition is available, make `answer` and `reference_detail` the visible/selectable result materials.
- Initialize default selections using the same eligibility rule.
- Compute the selected usable addition with `useMemo`.
- Render a `clinic-master-add-references` action row containing selected usable count and the button.
- Disable the button when no usable selected material exists.
- On click, call `onAddReferenceDocs(addition.docs)`, combine returned duplicate counts with the local unusable count, and show the formatted notice.
- Do not call any AI integration API.

- [ ] **Step 7: Run the focused test again**

Run:

```bash
cd frontend && node src/components/ClinicMasterPanel.test.mjs
```

Expected: PASS.

### Task 2: Duplicate-Safe Global Reference Merge

**Files:**
- Create: `frontend/src/components/StepGuideLookup.test.mjs`
- Modify: `frontend/src/components/StepGuideLookup.tsx`

- [ ] **Step 1: Write a failing test for merge statistics**

Bundle `StepGuideLookup.tsx`, import `buildReferenceDocAddition`, and assert:

```js
const result = buildReferenceDocAddition(
  [{ filename: 'existing.md', text: 'A', char_count: 1 }],
  [
    { filename: 'existing.md', text: 'A2', char_count: 2 },
    { filename: 'new.md', text: 'B', char_count: 1 },
    { filename: 'new.md', text: 'B2', char_count: 2 },
  ],
)

assert.deepEqual(result.docs.map(doc => doc.filename), ['existing.md', 'new.md'])
assert.equal(result.added, 1)
assert.equal(result.duplicates, 2)
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd frontend && node src/components/StepGuideLookup.test.mjs
```

Expected: FAIL because `buildReferenceDocAddition` is not exported.

- [ ] **Step 3: Implement merge results and return them to the panel**

Replace the private array-only append helper with:

```ts
export function buildReferenceDocAddition(current: ReferenceDoc[], additions: ReferenceDoc[]) {
  const existing = new Set(current.map(doc => doc.filename))
  const accepted: ReferenceDoc[] = []
  let duplicates = 0
  for (const doc of additions) {
    if (existing.has(doc.filename)) {
      duplicates += 1
      continue
    }
    existing.add(doc.filename)
    accepted.push(doc)
  }
  return { docs: [...current, ...accepted], added: accepted.length, duplicates }
}
```

Update `addReferenceDocs` to return `{ added, duplicates }`. For the normal `setReferenceDocs` path, apply `result.docs`. If a custom callback is supplied and returns no statistics, fall back to `{ added: docs.length, duplicates: 0 }`.

- [ ] **Step 4: Run both component tests**

Run:

```bash
cd frontend && node src/components/StepGuideLookup.test.mjs && node src/components/ClinicMasterPanel.test.mjs
```

Expected: both PASS.

### Task 3: Wire AI Integration to Global References

**Files:**
- Create: `frontend/src/components/StepAiIntegrationClinicMaster.test.mjs`
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write failing source-contract tests**

Read both production source files and assert:

```js
assert.match(stepSource, /setReferenceDocs:\s*\(docs:\s*ReferenceDoc\[\]\)\s*=>\s*void/)
assert.match(stepSource, /referenceDocs=\{effectiveReferenceDocs\}/)
assert.match(stepSource, /setReferenceDocs=\{setReferenceDocs\}/)
assert.match(stepSource, /addButtonLabel="加入数据源"/)
assert.doesNotMatch(stepSource, /clinicMasterReferenceChunks/)
assert.doesNotMatch(stepSource, /onConfirmReferenceChunks=\{setClinicMasterReferenceChunks\}/)
assert.match(appSource, /setReferenceDocs=\{handleSetReferenceDocs\}/)
```

- [ ] **Step 2: Run the source-contract test and verify RED**

Run:

```bash
cd frontend && node src/components/StepAiIntegrationClinicMaster.test.mjs
```

Expected: FAIL because AI integration is still using temporary Clinic Master chunks and has no reference updater prop.

- [ ] **Step 3: Implement the global-state wiring**

In `StepAiIntegration.tsx`:

- Add required prop `setReferenceDocs: (docs: ReferenceDoc[]) => void` and destructure it.
- Remove `clinicMasterReferenceChunks` state.
- Define `confirmedReferenceChunks` as `guidelineReferenceChunks` only.
- Remove `clinicMasterReferenceInputs` and send `referenceInputs` directly.
- Remove the Clinic Master-specific selection summary.
- Configure embedded `StepGuideLookup` with:

```tsx
referenceDocs={effectiveReferenceDocs}
setReferenceDocs={setReferenceDocs}
showRecommendedGuides={false}
placeholder="输入本次 AI 整合需要补充判断的临床问题"
addButtonLabel="加入数据源"
historyStorageKey="clinic-master-ai-integration-history"
showHeader={false}
```

- Do not pass `onConfirmReferenceChunks` or a temporary source-id base.

In `App.tsx`, pass `setReferenceDocs={handleSetReferenceDocs}` to `StepAiIntegration`.

- [ ] **Step 4: Run the wiring test and focused component tests**

Run:

```bash
cd frontend && node src/components/StepAiIntegrationClinicMaster.test.mjs && node src/components/StepGuideLookup.test.mjs && node src/components/ClinicMasterPanel.test.mjs
```

Expected: all PASS.

### Task 4: Full Verification

**Files:**
- Verify all files changed in Tasks 1-3.

- [ ] **Step 1: Run every frontend `.test.mjs` file**

Run:

```bash
cd frontend && for test_file in $(find src -name '*.test.mjs' -print | sort); do node "$test_file" || exit 1; done
```

Expected: every test script exits successfully.

- [ ] **Step 2: Run the production build**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript compilation and Vite production build succeed.

- [ ] **Step 3: Check formatting and focused diff**

Run:

```bash
git diff --check -- frontend/src/components/ClinicMasterPanel.tsx frontend/src/components/ClinicMasterPanel.test.mjs frontend/src/components/StepGuideLookup.tsx frontend/src/components/StepGuideLookup.test.mjs frontend/src/components/StepAiIntegration.tsx frontend/src/components/StepAiIntegrationClinicMaster.test.mjs frontend/src/App.tsx
git diff -- frontend/src/components/ClinicMasterPanel.tsx frontend/src/components/ClinicMasterPanel.test.mjs frontend/src/components/StepGuideLookup.tsx frontend/src/components/StepGuideLookup.test.mjs frontend/src/components/StepAiIntegration.tsx frontend/src/components/StepAiIntegrationClinicMaster.test.mjs frontend/src/App.tsx
```

Expected: no whitespace errors; diff contains only the scoped feature changes layered on top of the user's existing work.

- [ ] **Step 4: Report completion without committing mixed production files**

Summarize the button behavior, global-source wiring, tests, and build result. Explicitly note that production files were left uncommitted because they already contained user changes before this task.
