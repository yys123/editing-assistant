# AI Integration Chunk Selection State Design

## Goal

Make AI integration chunk filtering explicit and reversible: the filter button is disabled when no question is entered, exiting the filter screen must not change confirmed chunk state, and users can see and switch whether the next AI integration request uses confirmed chunks or all selected data sources.

## Current Context

`frontend/src/components/StepAiIntegration.tsx` owns the AI integration request state. It already tracks selected reference data sources, confirmed reference chunks, and `referenceMode` (`full` or `confirmed_chunks`). `frontend/src/components/ChunkConfirmationPanel.tsx` owns the chunk search UI and currently writes auto-selected recommended chunks through `onChange` as soon as search completes.

## Requirements

- The AI integration `AI筛选切片` button must be visually disabled and unclickable when the user request is blank.
- The button must also stay disabled if no reference data source is selected.
- Opening `AI筛选切片` creates a draft selection for the fullscreen filter UI.
- Clicking `退出` in the fullscreen filter UI closes the filter without changing the previously confirmed chunks or `referenceMode`.
- Clicking `确认切片` commits the draft chunks to AI integration state. If the draft contains at least one chunk, `referenceMode` switches to `confirmed_chunks`; if the draft is empty, `referenceMode` stays or returns to `full`.
- AI integration must show a compact status message telling users whether the next request will use confirmed chunks or all selected data sources.
- AI integration must provide a switch button for toggling between confirmed chunks and all selected data source full text.
- If no confirmed chunks exist, the switch-to-chunks action must not silently enable chunk mode.

## Design

`StepAiIntegration` will keep the authoritative state:

- `guidelineReferenceChunks`: last confirmed chunk selection.
- `referenceMode`: whether the next AI request uses confirmed chunks or full selected reference text.
- `draftGuidelineReferenceChunks`: temporary chunks owned by the open filter session.

When the user opens AI filtering, `draftGuidelineReferenceChunks` starts empty and the existing confirmed state remains untouched. `ChunkConfirmationPanel` reads and writes only the draft during the fullscreen session. `退出` closes the panel and resets the draft without calling the confirm handler. `确认切片` copies the draft into `guidelineReferenceChunks`, sets `referenceMode` to `confirmed_chunks` only when the draft has chunks, and closes the panel.

The existing parent reset points that make confirmed chunks stale (`setAllRefs`, `clearRefs`, `toggleRef`, `togglePriorityRef`, user request changes, linked issue changes) will also clear draft chunks and close the panel.

The status strip will live below the AI integration input. It will say either:

- `当前已选择切片：X 个`
- `当前没选择切片：使用选中的所有数据源（N 个）`

The adjacent switch button will be labeled `不选择切片` when chunk mode is active, and `选择已确认切片` when full selected data source mode is active. It toggles back to confirmed chunks only when at least one confirmed chunk exists.

The fullscreen filter exit control is labeled `退出`; the confirm control remains labeled `确认切片`.

## Testing

Use the existing lightweight frontend source tests:

- Extend `frontend/src/components/StepAiIntegrationClinicMaster.test.mjs` to assert disabled gating, draft chunk state, exit wiring, status text, and mode switch text.
- Extend `frontend/src/components/ChunkConfirmationPanel.test.mjs` to assert the panel supports an exit action and does not route exit through confirm.
- Run the targeted tests, then run the full frontend build.
