# Task 003 Output: Human Attention Grouping Primitives

## Status: completed

## Evidence:
- Unit test suite `test/stage1-dual-mode-and-scoping.test.js`:
  - 19/19 tests pass (duration ~425ms)
  - `parseAcceptanceCriteria extracts checkboxes under ### Acceptance Criteria: and stops at next heading`: pass
  - `parseAcceptanceCriteria handles aliases, whitespace, CRLF, BOM, and code fences`: pass
  - `parseSubtasks strictly scopes to ### Actionable Subtasks Checklist: and legacy aliases`: pass
  - `zero cross-counting across all standard markdown checklist sections`: pass
  - `legacy fallback: unsectioned raw markdown retains subtask checklist parsing`: pass
  - `fallback exclusion: body with Acceptance Criteria or Test Plan but NO subtasks section produces 0 subtasks`: pass
  - `lineIndex accuracy allows updateSubtaskInMarkdown to toggle target checkbox cleanly`: pass
  - `normalizeGithubIssues attaches acceptanceCriteria and isolates subtasks`: pass
  - `resolveV2Metadata correctly parses explicit v2 labels for all 4 axes`: pass
  - `resolveV2Metadata preserves orthogonality: phase is unaffected by attention state`: pass
  - `resolveV2Metadata correctly projects v1 status labels when v2 metadata is absent`: pass
  - `resolveV2Metadata derives liveness and dependencyState from linked session and body dependencies`: pass
  - `resolveIssueColumn preserves exact v1 behavior and projects v2 issues into Kanban columns`: pass
  - `normalizeGithubIssues attaches v2Metadata with zero undefined fields`: pass
  - `groupIssuesByAttention partitions issues into needs-decision, needs-permission, needs-review, and none`: pass
  - `groupIssuesByAttention preserves orthogonality across diverse workflow phases`: pass
  - `groupIssuesByAttention derives attention from linked sessions via sessionIndex`: pass
  - `filterIssuesByAttention filters issues by specified attention state`: pass
  - `groupIssuesByAttention and filterIssuesByAttention defend against empty, null, undefined, and malformed inputs`: pass
- Full regression test run:
  - Command: `node --test test/stage1-dual-mode-and-scoping.test.js && node --test`
  - Result: 379 tests passed, 0 failed, 0 skipped. All 360 baseline tests + 8 task-001 tests + 6 task-002 tests + 5 new task-003 attention grouping tests pass green.

## Changes:
- `panel/core.ts`:
  - Added `groupIssuesByAttention(issues: Issue[], sessionIndex?: Map<number, any> | any): Record<HumanAttention, Issue[]>`:
    - Partitions issues into 4 orthogonal attention queues: `'needs-decision'`, `'needs-permission'`, `'needs-review'`, and `'none'`.
    - Resolves linked session dynamically from `sessionIndex` (supporting `Map<number, any>`, repo-keyed `Map<string, any>`, or object/array lookups) and resolves attention via `resolveV2Metadata`.
    - Completely defensive against null, undefined, non-array inputs, primitives, and missing issue properties.
  - Added `filterIssuesByAttention(issues: Issue[], attention: HumanAttention, sessionIndex?: Map<number, any> | any): Issue[]`:
    - Filters issues by matching human attention action queue.
    - Defensively validates target attention against allowed `HumanAttention` values (`'needs-decision' | 'needs-permission' | 'needs-review' | 'none'`).
    - Handles malformed inputs, returning an empty array on invalid attention or empty collections.
  - Augmented `resolveV2Metadata`:
    - Added property checks for `issue.attention` / `issue.phase` and explicit `issue.v2Metadata` to guarantee explicit v2 state is preserved even on bare issue objects without a populated `labels` array.
- `test/stage1-dual-mode-and-scoping.test.js`:
  - Added 5 comprehensive unit tests verifying partitioning across all 4 attention states, orthogonality across diverse workflow phases (`exploration`, `alignment`, `planning`, `execution`, `verification`, `publication`, `done`, `archive`), sessionIndex attribution, filtering, and defensive edge cases.

## Verification:
- Executed `node --test test/stage1-dual-mode-and-scoping.test.js && node --test`.
- Confirmed full orthogonality: issues across any workflow phase (such as exploration, planning, execution, verification, publication) are grouped into their proper action queues (`needs-decision`, `needs-permission`, `needs-review`, `none`) independently of phase.
- Confirmed backward compatibility and 100% test pass rate across all 379 tests.
