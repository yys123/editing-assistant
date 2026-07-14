# Clinic Master Global Reference Addition Design

## Goal

Allow editors to add selected Clinic Master clinical-decision answers and literature details to the application's global reference-source list from the AI integration page.

After addition, these items behave like uploaded documents and guide sources: they appear in the same reference list, participate in the existing reference-selection and chunk-confirmation workflow, and can be selected or deselected by the user before AI integration.

## Context

The AI integration page already embeds `StepGuideLookup`, which renders `ClinicMasterPanel`. Clinic Master query results can be selected, and the component contract already carries an `addButtonLabel` and `onAddReferenceDocs` callback. However, `ClinicMasterPanel` does not currently render an addition action or call the callback.

The current AI integration implementation also treats selected Clinic Master materials as a separate, temporary confirmed-chunk collection. That behavior does not match the requested global-source model: Clinic Master materials should first become ordinary `ReferenceDoc` entries and then follow the same downstream path as guides and other reference sources.

## Confirmed Product Decisions

- Add a button labeled `加入数据源` to the Clinic Master result area.
- The button adds all currently selected eligible materials in one action.
- Eligible material types are:
  - `answer` (clinical-decision answer)
  - `reference_detail` (literature detail)
- Do not add `reference` list records or `chat_detail` records.
- Added materials enter the global `referenceDocs` collection and appear together with guides and uploaded reference files.
- Clicking `加入数据源` does not start AI integration.
- Addition does not make the source mandatory for AI integration. The user retains the normal reference checkbox controls and may deselect it before submitting the AI integration request.
- Repeated addition skips duplicates.
- Show a concise result notice including added and duplicate counts.

## Scope

In scope:

- Render and enable the Clinic Master `加入数据源` action.
- Convert selected answers and literature details into `ReferenceDoc` objects.
- Connect the AI integration page's Clinic Master panel to the application-level reference-source state.
- Remove the AI integration page's temporary direct Clinic Master confirmed-chunk path so added Clinic Master materials use the standard reference workflow.
- Preserve existing query, history, result display, and manual reference selection behavior.
- Add focused frontend tests and run the frontend build.

Out of scope:

- Automatically running AI integration.
- Automatically making an added source a priority guide.
- Backend API or database changes.
- Adding chat transcripts or reference-list summary records as sources.
- Redesigning the reference-source list or chunk-confirmation UI.

## Recommended Architecture

Use `referenceDocs` as the single source of truth for material that may be used by AI integration.

`ClinicMasterPanel` owns query-result selection and converts only selected eligible materials. It emits the converted documents through `onAddReferenceDocs`. `StepGuideLookup` keeps its existing role as the adapter that merges additions into the current reference list with filename-based duplicate prevention. `StepAiIntegration` receives a reference-list update callback from `App` and passes the real global list and callback into `StepGuideLookup`.

Once added, Clinic Master documents flow through the existing path:

```text
Clinic Master query result
  -> select answer/literature detail
  -> 加入数据源
  -> global referenceDocs
  -> AI integration reference checkbox
  -> standard chunk confirmation
  -> user submits AI integration explicitly
```

The query-result checkbox is therefore an addition selection, not a hidden shortcut that injects temporary chunks directly into the AI request.

## Component Changes

### `ClinicMasterPanel`

- Receive and use the existing `addButtonLabel` and `onAddReferenceDocs` props.
- Define a pure eligibility rule that returns true only for `answer` and `reference_detail`.
- When reference addition is available, keep eligible literature-detail materials visible and selectable alongside answers.
- Render an action row beneath or above the material list with:
  - selected eligible count;
  - `加入数据源` button;
  - disabled state when no eligible material is selected.
- On click:
  1. Filter the current query materials to selected eligible items.
  2. Convert each item with the existing `clinicMasterMaterialToReferenceDoc` helper.
  3. Send the converted documents to `onAddReferenceDocs`.
  4. Display an addition notice.
- Do not call the AI integration endpoint or submit the AI integration form.

### `StepGuideLookup`

- Continue merging additions into `referenceDocs` through its existing append-and-deduplicate adapter.
- Return addition statistics to the panel, or otherwise provide enough information for the panel to report how many documents were added versus skipped.
- Duplicate identity remains the generated `ReferenceDoc.filename`, matching the component's existing global merge behavior.

### `StepAiIntegration`

- Accept a callback that updates the application-level `referenceDocs` state.
- Pass the actual `referenceDocs` collection and update callback to the embedded `StepGuideLookup`.
- Use the button label `加入数据源`.
- Stop passing Clinic Master query selections directly through `onConfirmReferenceChunks`.
- Remove the separate `clinicMasterReferenceChunks` state and do not append it directly to the AI request.
- Continue using the existing reference checkbox list. A newly added document follows the same default-selection behavior as any other newly available reference, and the user can uncheck it.
- Continue using the existing guideline/reference chunk-confirmation panel before AI integration submission.

### `App`

- Pass the existing guarded reference-state updater to `StepAiIntegration`.
- No new persistence contract is required because session persistence already stores `referenceDocs`.

## ReferenceDoc Mapping

Reuse `clinicMasterMaterialToReferenceDoc(material, fallbackIndex)` from `frontend/src/api.ts`.

The generated document contains:

- a sanitized `ClinMaster-...md` filename;
- the material's full text;
- `char_count` derived from the text length.

Answers and literature details remain independent reference documents. This lets the user include one, both, or neither in a later AI integration request.

## Duplicate and Notice Behavior

Duplicate checks occur before updating global state.

The result notice uses concise Chinese copy:

- `已加入 2 条`
- `已加入 1 条；跳过重复 1 条`
- `已加入 0 条；跳过重复 2 条`

The button remains available after addition so the user can select a different material. Duplicate prevention makes repeated clicks safe.

## Error Handling

- Disable the button when no eligible material is selected.
- Ignore selected records whose type is not eligible.
- If an eligible material has empty text, exclude it from conversion and report it as unavailable rather than adding an empty source.
- Query and refresh failures continue to use the existing Clinic Master error UI.
- Reference addition is local state manipulation and does not require a new network error state.

## Testing

Add or extend frontend tests to verify:

- Only `answer` and `reference_detail` are eligible for global addition.
- Selected answers and literature details convert into `ReferenceDoc` entries.
- Unselected and ineligible materials are excluded.
- Empty eligible materials are excluded.
- Duplicate filenames are skipped when merging into the global reference list.
- The AI integration component wires the Clinic Master panel to global reference addition and no longer uses the temporary Clinic Master confirmed-chunk path.
- Existing Clinic Master display helpers remain green.
- The frontend production build succeeds.

## Success Criteria

1. On the AI integration page, an editor can query Clinic Master and select an answer, a literature detail, or both.
2. Clicking `加入数据源` adds all selected eligible items to the same global reference list as guides.
3. Duplicate clicks do not create duplicate sources.
4. No AI integration request is started by the addition action.
5. The added sources can be selected or deselected using the standard AI integration reference controls.
6. AI integration uses added Clinic Master sources only through the normal global reference and chunk-confirmation workflow.
