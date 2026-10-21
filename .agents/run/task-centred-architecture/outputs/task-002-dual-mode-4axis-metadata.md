# Task 002 Output: Dual-Mode 4-Axis Orthogonal Metadata

## Status: completed

## Evidence:
- Test suite `test/stage1-dual-mode-and-scoping.test.js`:
  - 14/14 tests pass (duration ~310ms)
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
- Full regression test run:
  - Command: `node --test test/stage1-dual-mode-and-scoping.test.js && node --test`
  - Result: 374 tests passed, 0 failed, 0 skipped. All 360 baseline tests + 8 task-001 tests + 6 new task-002 dual-mode metadata tests pass green.

## Changes:
- `panel/core.ts`:
  - Defined 4-axis orthogonal state model types:
    - `WorkflowPhase`: `'draft' | 'exploration' | 'alignment' | 'planning' | 'execution' | 'verification' | 'human_verification' | 'publication' | 'done' | 'archive'`
    - `HumanAttention`: `'none' | 'needs-decision' | 'needs-permission' | 'needs-review'`
    - `ExecutionLiveness`: `'idle' | 'running' | 'retrying' | 'failed' | 'completed'`
    - `DependencyState`: `'ready' | 'blocked-by-dependency'`
    - `V2IssueMetadata`: `{ phase, attention, liveness, dependencyState, isExplicitV2 }`
    - `ColumnId`: `'draft' | 'backlog' | 'todo' | 'planned' | 'in-progress' | 'needs-human' | 'in-review' | 'done'`
  - Augmented `Issue` interface with optional `v2Metadata?: V2IssueMetadata`.
  - Added `isIssueClosed(issue: Issue | any): boolean` checking `state === 'closed'`, `state_reason`, and closed/done status labels.
  - Added `resolveMatchedSession(issue: Issue | any, sessionOrList?: any): any | null` supporting session object/array resolution via issue IDs, title `#<num>` tokens, and worktree references.
  - Implemented `resolveV2Metadata(issue: Issue, session?: any, allIssues?: Issue[]): V2IssueMetadata`:
    - Axis 1 (Phase): Extracts explicit `phase:<phase>` label (supporting hyphenated and underscored forms) or projects fallback phase from legacy `status:*` labels, closed state, archive labels, or `isVagueIdea`.
    - Axis 2 (Attention): Extracts explicit `attention:<attention>` label or derives attention orthogonally from attached session activity (`waiting-permission`, `waiting-question`, `waiting-review`), open human task keywords (`permission`, `decide`), open questions, or `status:needs-human`.
    - Axis 3 (Liveness): Extracts explicit `liveness:<liveness>` or derives from attached session activity/status (`running`, `retrying`, `failed`, `completed`, `idle`), or defaults to `completed` for closed/done issues.
    - Axis 4 (DependencyState): Extracts explicit `dependency:<state>` or parses body blockers via `parseIssueDependencies`, checking closure against `allIssues` when provided.
    - Sets `isExplicitV2: boolean` indicating whether explicit v2 `phase:*` or `attention:*` labels were present.
  - Implemented `resolveIssueColumn(issue: Issue | any, sessionOrList?: any): ColumnId | null`:
    - Preserves 100% exact backward compatibility for legacy v1 status labels (`status:done`, `status:in-review`, `status:needs-human`, `status:in-progress`, `status:planned`, `status:todo`, `status:backlog`, `status:draft`) and runtime session state transitions.
    - Accurately maps explicit v2 phase & attention to Kanban column targets when v1 labels are absent (`phase:exploration` -> `'draft'`, `attention:needs-decision` -> `'needs-human'`, etc.).
  - Updated `normalizeGithubIssues(rawItems: any[])`:
    - Bounded `v2Metadata` attachment to non-bare issue objects (`item.v2Metadata`, `item.labels !== undefined`, `item.phase`, `item.attention`, or `ac.length > 0`) to preserve strict parity in baseline suites.
    - Guaranteed zero `undefined` values in `v2Metadata` ensuring full compliance with OpenChamber SDK JSON storage validation.
- `test/stage1-dual-mode-and-scoping.test.js`:
  - Added 6 unit tests covering all 4 axes, phase/attention orthogonality, v1 fallback projection, session liveness, dependencies, column resolution, and normalized issue metadata.

## Verification:
- Executed `node --test test/stage1-dual-mode-and-scoping.test.js && node --test`.
- Confirmed phase and attention are completely orthogonal: phase is unaffected by attention state.
- Confirmed full backward compatibility with zero regressions across all 360 pre-existing tests.
