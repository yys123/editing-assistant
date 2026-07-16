# AI Integration Compact Query Layout Design

## Goal

Apply visual option A from the browser mockup: make the chunk selection switch look like a polished status action, and keep the ClinicMaster query module collapsed by default inside AI integration until the user chooses to expand it.

## Design

- The AI integration chunk status row becomes a compact scope strip:
  - a soft status pill for `当前已选择切片：X 个` or `当前没选择切片：使用选中的所有数据源（N 个）`
  - a larger, clearer pill button for `不选择切片` / `选择已确认切片`
- The switch button uses dedicated AI integration classes instead of generic outline button sizing.
- `ClinicMasterPanel` gets optional collapsible-query props.
- `StepGuideLookup` passes those props through.
- AI integration enables the collapsed mode for its embedded clinical decision query.
- The collapsed state renders a single dock row with title `查询临床决策资料`, a short description, a history count, and an `展开查询` button.
- When expanded, the existing search/history/results UI is preserved and gains a `收起查询` action.

## Testing

- Extend existing source tests to assert the new AI integration classes and ClinicMaster collapsible props.
- Extend ClinicMaster tests to assert collapsed dock labels and CSS classes exist.
- Run targeted frontend tests and the Vite build.
