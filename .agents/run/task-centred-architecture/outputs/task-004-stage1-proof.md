# Task 004 Output: Stage 1 Verification Ladder

## Status: completed

## Level Evidence:
- L0 Syntax: PASS
  - Command: `node --check test/stage1-dual-mode-and-scoping.test.js && npm run typecheck`
  - Exit code: `0`
  - Result: Zero syntax errors, zero TypeScript compilation or typing errors (`tsc --noEmit`).
- L1 Import/Types: PASS
  - Command: `node --input-type=module -e "import * as core from './panel/core.ts'; console.log('Imported', Object.keys(core).length, 'symbols');"`
  - Exit code: `0`
  - Result: All types and functions (`WorkflowPhase`, `HumanAttention`, `ExecutionLiveness`, `DependencyState`, `V2IssueMetadata`, `parseAcceptanceCriteria`, `parseSubtasks`, `resolveV2Metadata`, `resolveIssueColumn`, `groupIssuesByAttention`, `filterIssuesByAttention`) import cleanly and resolve without circular dependencies or runtime warnings.
- L2 Unit: PASS
  - Command: `node --test test/stage1-dual-mode-and-scoping.test.js`
  - Exit code: `0`
  - Result: 19 unit test cases covering all 4 axes, phase/attention orthogonality, v1 fallback projection, session liveness/dependency derivations, Kanban column resolution, attention grouping, attention filtering, section-scoped checklist extraction, alias handling, whitespace/CRLF/BOM/fence resilience, fallback mode without subtasks, lineIndex accuracy, and defensive inputs.
- L3 Integration (Issue #26): PASS
  - Command: `node --test --test-name-pattern="L3 integration" test/stage1-dual-mode-and-scoping.test.js`
  - Exit code: `0`
  - Empirical Evidence with real 50 KB Issue #26 proposal body (`All work runs from the task board`):
    - `parseFriendlyTitle(body)`: `{ title: 'All Work Runs on the Board', subtitle: null }`
    - `parseAcceptanceCriteria(body)`: exactly 15 items extracted under `### Acceptance Criteria:`
    - `parseSubtasks(body)`: strictly 26 subtasks extracted under `### Actionable Subtasks Checklist:`. In contrast to legacy v1 which cross-counted 58 items (15 AC + 17 test plan + 26 subtasks), the Stage 1 scoped parser isolates subtasks to exactly 26.
    - `parseOpenQuestions(body)`: exactly 5 open questions (Q1 to Q5)
    - `parseHumanTasks(body)`: exactly 5 human tasks
    - `parseTestPlan(body)`: 17 issue test plan items, 0 batch tests
    - Section Isolation: 0 cross-contamination between AC, Subtasks, Questions, Human Tasks, and Test Plan items
    - `resolveV2Metadata(issue26)`:
      - `phase`: `'draft'` (projected from `status:draft`)
      - `attention`: `'needs-decision'` (driven by open questions Q1-Q5 awaiting decisions)
      - `liveness`: `'idle'`
      - `dependencyState`: `'ready'`
      - `isExplicitV2`: `false`
    - `resolveIssueColumn(issue26)`: `'draft'`
    - `groupIssuesByAttention([issue26])`: Issue #26 partitioned into `'needs-decision'` action queue
    - `normalizeGithubIssues([issue26])`: attaches `acceptanceCriteria` (15 items), `subtasks` (26 items), `v2Metadata` with zero undefined fields

## Regression Suite:
- node --test: PASS (360+ tests)
  - Exit code: `0`
  - Total tests passed: 380 (360 pre-existing baseline tests + 20 Stage 1 tests)
  - Total tests failed: 0
  - Total tests skipped: 0
  - Total duration: ~64.7s

## Receipt:
```text
TAP version 13
# Subtest: parseAcceptanceCriteria extracts checkboxes under ### Acceptance Criteria: and stops at next heading
ok 1 - parseAcceptanceCriteria extracts checkboxes under ### Acceptance Criteria: and stops at next heading
  ---
  duration_ms: 3.082956
  type: 'test'
  ...
# Subtest: parseAcceptanceCriteria handles aliases, whitespace, CRLF, BOM, and code fences
ok 2 - parseAcceptanceCriteria handles aliases, whitespace, CRLF, BOM, and code fences
  ---
  duration_ms: 1.739159
  type: 'test'
  ...
# Subtest: parseSubtasks strictly scopes to ### Actionable Subtasks Checklist: and legacy aliases
ok 3 - parseSubtasks strictly scopes to ### Actionable Subtasks Checklist: and legacy aliases
  ---
  duration_ms: 1.446825
  type: 'test'
  ...
# Subtest: zero cross-counting across all standard markdown checklist sections
ok 4 - zero cross-counting across all standard markdown checklist sections
  ---
  duration_ms: 2.378309
  type: 'test'
  ...
# Subtest: legacy fallback: unsectioned raw markdown retains subtask checklist parsing
ok 5 - legacy fallback: unsectioned raw markdown retains subtask checklist parsing
  ---
  duration_ms: 0.449488
  type: 'test'
  ...
# Subtest: fallback exclusion: body with Acceptance Criteria or Test Plan but NO subtasks section produces 0 subtasks
ok 6 - fallback exclusion: body with Acceptance Criteria or Test Plan but NO subtasks section produces 0 subtasks
  ---
  duration_ms: 0.397504
  type: 'test'
  ...
# Subtest: lineIndex accuracy allows updateSubtaskInMarkdown to toggle target checkbox cleanly
ok 7 - lineIndex accuracy allows updateSubtaskInMarkdown to toggle target checkbox cleanly
  ---
  duration_ms: 0.715391
  type: 'test'
  ...
# Subtest: normalizeGithubIssues attaches acceptanceCriteria and isolates subtasks
ok 8 - normalizeGithubIssues attaches acceptanceCriteria and isolates subtasks
  ---
  duration_ms: 4.521588
  type: 'test'
  ...
# Subtest: resolveV2Metadata correctly parses explicit v2 labels for all 4 axes
ok 9 - resolveV2Metadata correctly parses explicit v2 labels for all 4 axes
  ---
  duration_ms: 1.596888
  type: 'test'
  ...
# Subtest: resolveV2Metadata preserves orthogonality: phase is unaffected by attention state
ok 10 - resolveV2Metadata preserves orthogonality: phase is unaffected by attention state
  ---
  duration_ms: 2.264633
  type: 'test'
  ...
# Subtest: resolveV2Metadata correctly projects v1 status labels when v2 metadata is absent
ok 11 - resolveV2Metadata correctly projects v1 status labels when v2 metadata is absent
  ---
  duration_ms: 0.701123
  type: 'test'
  ...
# Subtest: resolveV2Metadata derives liveness and dependencyState from linked session and body dependencies
ok 12 - resolveV2Metadata derives liveness and dependencyState from linked session and body dependencies
  ---
  duration_ms: 0.926049
  type: 'test'
  ...
# Subtest: resolveIssueColumn preserves exact v1 behavior and projects v2 issues into Kanban columns
ok 13 - resolveIssueColumn preserves exact v1 behavior and projects v2 issues into Kanban columns
  ---
  duration_ms: 0.821089
  type: 'test'
  ...
# Subtest: normalizeGithubIssues attaches v2Metadata with zero undefined fields
ok 14 - normalizeGithubIssues attaches v2Metadata with zero undefined fields
  ---
  duration_ms: 0.477809
  type: 'test'
  ...
# Subtest: groupIssuesByAttention partitions issues into needs-decision, needs-permission, needs-review, and none
ok 15 - groupIssuesByAttention partitions issues into needs-decision, needs-permission, needs-review, and none
  ---
  duration_ms: 0.359138
  type: 'test'
  ...
# Subtest: groupIssuesByAttention preserves orthogonality across diverse workflow phases
ok 16 - groupIssuesByAttention preserves orthogonality across diverse workflow phases
  ---
  duration_ms: 0.735274
  type: 'test'
  ...
# Subtest: groupIssuesByAttention derives attention from linked sessions via sessionIndex
ok 17 - groupIssuesByAttention derives attention from linked sessions via sessionIndex
  ---
  duration_ms: 0.516811
  type: 'test'
  ...
# Subtest: filterIssuesByAttention filters issues by specified attention state
ok 18 - filterIssuesByAttention filters issues by specified attention state
  ---
  duration_ms: 0.315798
  type: 'test'
  ...
# Subtest: groupIssuesByAttention and filterIssuesByAttention defend against empty, null, undefined, and malformed inputs
ok 19 - groupIssuesByAttention and filterIssuesByAttention defend against empty, null, undefined, and malformed inputs
  ---
  duration_ms: 0.330068
  type: 'test'
  ...
# Subtest: L3 integration: parse real Issue #26 body with zero cross-counting and accurate 4-axis projection
ok 20 - L3 integration: parse real Issue #26 body with zero cross-counting and accurate 4-axis projection
  ---
  duration_ms: 6.842729
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 333.298304
```

### Full Regression Suite Summary:
```text
1..380
# tests 380
# suites 0
# pass 380
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 64659.880082
```
