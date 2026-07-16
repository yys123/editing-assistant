# AI Integration Compact Query Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement visual option A for AI integration: polished chunk scope controls and a default-collapsed clinical decision query dock.

**Architecture:** Keep the new ClinicMaster collapse behavior opt-in through props. AI integration passes the props, while other ClinicMaster usages keep the existing layout.

**Tech Stack:** React 18, TypeScript, Vite, existing Node `assert` source tests.

---

### Task 1: Red Tests

- [ ] Add source assertions in `StepAiIntegrationClinicMaster.test.mjs` for `collapsibleSearch`, `defaultSearchCollapsed`, and the `ai-reference-scope-*` classes.
- [ ] Add source/CSS assertions in `ClinicMasterPanel.test.mjs` for `collapsibleSearch`, `searchCollapsed`, `clinic-master-dock`, `展开查询`, and `收起查询`.
- [ ] Run the two tests and confirm they fail for missing implementation.

### Task 2: Implement UI

- [ ] Add optional collapse props to `StepGuideLookup` and `ClinicMasterPanel`.
- [ ] Render a collapsed ClinicMaster dock when enabled and collapsed.
- [ ] Add an expanded-mode collapse action.
- [ ] Pass collapsed props from AI integration.
- [ ] Replace inline chunk switch styling with dedicated classes.
- [ ] Add CSS for the new AI scope strip and ClinicMaster dock.

### Task 3: Verify

- [ ] Run `cd frontend && node src/components/StepAiIntegrationClinicMaster.test.mjs`.
- [ ] Run `cd frontend && node src/components/ClinicMasterPanel.test.mjs`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run `git diff --check`.
