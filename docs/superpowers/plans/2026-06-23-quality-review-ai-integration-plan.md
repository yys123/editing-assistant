# Quality Review AI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let confirmed quality review issues feed directly into AI integration as selectable task context.

**Architecture:** Keep the first implementation front-end focused. Add a small pure utility for extracting/formatting linked issues, pass section analyses into `StepAiIntegration`, and store selected issue snapshots on AI integration history records.

**Tech Stack:** React, TypeScript, existing Node strip-types utility tests, Vite build.

---

### Task 1: Linked Issue Utilities

**Files:**
- Create: `frontend/src/utils/aiIntegrationIssues.ts`
- Test: `frontend/src/utils/aiIntegrationIssues.test.mjs`
- Modify: `frontend/src/types/index.ts`

- [x] Write failing tests for extracting non-rejected issues, generating request text, and mapping selected issues to section ids.
- [x] Implement minimal utility functions and types.
- [x] Run the utility tests.

### Task 2: AI Integration UI Wiring

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/StepAiIntegration.tsx`
- Modify: `frontend/src/components/HistoryView.tsx`

- [x] Pass `sectionAnalyses` into AI integration.
- [x] Add a quality review issue panel with selection, high-priority selection, clear, and generate request actions.
- [x] Save `linkedIssues` on new AI integration records.
- [x] Display linked issue summaries in AI integration history.

### Task 3: Verification

**Files:**
- Existing frontend tests/build.

- [x] Run `node --experimental-strip-types src/utils/aiIntegrationIssues.test.mjs`.
- [x] Run related existing utility tests.
- [x] Run `npm run build`.
