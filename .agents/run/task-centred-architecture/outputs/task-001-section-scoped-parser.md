# Task 001 Output: Section-Scoped Checklist Parsing

## Status: completed

## Evidence:
- Test suite `test/stage1-dual-mode-and-scoping.test.js`:
  - 8/8 tests pass (duration ~300ms)
  - `parseAcceptanceCriteria extracts checkboxes under ### Acceptance Criteria: and stops at next heading`: pass
  - `parseAcceptanceCriteria handles aliases, whitespace, CRLF, BOM, and code fences`: pass
  - `parseSubtasks strictly scopes to ### Actionable Subtasks Checklist: and legacy aliases`: pass
  - `zero cross-counting across all standard markdown checklist sections`: pass
  - `legacy fallback: unsectioned raw markdown retains subtask checklist parsing`: pass
  - `fallback exclusion: body with Acceptance Criteria or Test Plan but NO subtasks section produces 0 subtasks`: pass
  - `lineIndex accuracy allows updateSubtaskInMarkdown to toggle target checkbox cleanly`: pass
  - `normalizeGithubIssues attaches acceptanceCriteria and isolates subtasks`: pass
- Full regression test run:
  - Command: `node --test test/stage1-dual-mode-and-scoping.test.js && node --test`
  - Result: 368 tests passed, 0 failed, 0 skipped. All 360 baseline tests + 8 new scoping tests pass green.

## Changes:
- `panel/core.ts`:
  - Added `acceptanceCriteria?: Subtask[]` to `Issue` interface.
  - Defined `acceptanceCriteriaSectionRegex` and `subtasksSectionRegex` matching canonical headings and legacy aliases (`### Actionable Subtasks Checklist:`, `### Subtasks:`, `## Subtasks:`, `### Tasks`).
  - Added `parseAcceptanceCriteria(body: string | null | undefined): Subtask[]` to isolate acceptance criteria checkboxes bounded by the next heading (`## ` or `### `), ignoring code fences and handling BOM/CRLF cleanly.
  - Refactored `parseSubtasks(body: string | null | undefined): Subtask[]` with dual-mode isolation:
    1. Explicit subtasks section mode: when standard subtask sections exist, strictly extract checkboxes within that section and halt at the next heading.
    2. Fallback mode: when no explicit subtasks section exists, collect top-level checkboxes while strictly excluding checkboxes belonging to Acceptance Criteria, Open Questions, Human Tasks, and Test Plan sections.
  - Updated `normalizeGithubIssues` to parse and attach `acceptanceCriteria` when present.
- `test/stage1-dual-mode-and-scoping.test.js`:
  - New test file with 8 test cases verifying section isolation, zero cross-counting, legacy fallback, and line index accuracy.

## Verification:
- Executed `node --test test/stage1-dual-mode-and-scoping.test.js && node --test`.
- Verified 0 cross-counting: an issue containing Acceptance Criteria, Subtasks, Open Questions, Human Tasks, Test Plan (Issue), and Test Plan (Batch) partitions checkboxes strictly into their respective fields with zero cross-contamination.
