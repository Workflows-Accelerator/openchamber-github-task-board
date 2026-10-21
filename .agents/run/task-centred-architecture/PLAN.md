# Stage 1 Implementation Plan: Canonical Markdown Schema & v1 Read Compatibility

## Summary
Stage 1 implements dual-mode reading and section-scoped checklist parsing in `panel/core.ts` for the task-centred architecture. It enables OpenChamber GitHub Task Board to read both legacy v1 issues (using `status:*` labels) and proposed v2 issues (using 4-axis orthogonal metadata: Phase, Attention, Liveness, Dependencies) without modifying existing issues on GitHub or altering write paths. It isolates checkboxes across Markdown sections (`Acceptance Criteria`, `Subtasks`, `Open Questions`, `Human Tasks`, `Test Plan`) to prevent cross-counting.

---

## Architectural Strategy

### 1. Dual-Mode Metadata Engine
- **v1 Legacy Compatibility:**
  Existing repositories use 8 status labels: `status:draft`, `status:backlog`, `status:todo`, `status:planned`, `status:in-progress`, `status:needs-human`, `status:in-review`, `status:done`.
  The dual-mode parser maps these into the 4-axis orthogonal state model when v2 metadata is absent:
  - `status:draft` / `status:backlog` -> Phase: `draft`, Attention: `none` (or `needs-decision` if open questions exist)
  - `status:todo` / `status:planned` -> Phase: `planning`, Attention: `none`
  - `status:in-progress` -> Phase: `execution`, Attention: `none`
  - `status:in-review` -> Phase: `verification`, Attention: `none`
  - `status:needs-human` -> Phase: preserved / `execution`, Attention: `needs-review` or `needs-decision`
  - `status:done` -> Phase: `done`, Attention: `none`
  `resolveIssueColumn(issue, session)` remains fully supported for existing Kanban views and passes all 360 baseline tests.

- **v2 Four-Axis Orthogonal State Model:**
  Tasks track four independent dimensions:
  1. **Workflow Phase (Work Maturity):** `draft` -> `exploration` -> `alignment` -> `planning` -> `execution` -> `verification` -> `human_verification` -> `publication` -> `done` (plus `archive`). Represented via `phase:*` labels or parsed body metadata.
  2. **Human Attention (Action Queue):** `none`, `needs-decision`, `needs-permission`, `needs-review`. Driven directly by actionable checkboxes in `### Human Tasks:` and `### Open Questions:`, or explicit `attention:*` labels. Orthogonal to phase: a task awaiting human input keeps its phase.
  3. **Execution Liveness (Operational State):** `idle`, `running`, `retrying`, `failed`, `completed`. Derived from active OpenChamber session tracking and runtime metadata; never conflated with human blocking.
  4. **Dependency State (Graph State):** `ready`, `blocked-by-dependency`. Derived from `parseIssueDependencies` / `Blocked by #N` links / GitHub native dependencies.

### 2. Section-Scoped Checklist Parsing
- **Problem:**
  `parseSubtasks(body)` in `panel/core.ts` currently collects every checkbox (`- [ ]` / `- [x]`) outside `Open Questions` and `Human Tasks`. Because `### Acceptance Criteria:` and `## Test Plan` use checkboxes, `parseSubtasks` treats Acceptance Criteria and Test Plan items as subtasks, causing severe cross-counting.
- **Solution:**
  - Define strict section header delimiters matching `docs/issue-body-contract.md`:
    - `### Acceptance Criteria:` -> parsed into `issue.acceptanceCriteria` via `parseAcceptanceCriteria(body)`
    - `### Actionable Subtasks Checklist:` -> parsed into `issue.subtasks` via `parseSubtasks(body)`
    - `### Open Questions:` -> parsed into `issue.openQuestions` via `parseOpenQuestions(body)`
    - `### Human Tasks:` -> parsed into `issue.humanTasks` via `parseHumanTasks(body)`
    - `## Test Plan (Issue)` / `## Test Plan (Batch)` -> parsed into `issue.testPlan` via `parseTestPlan(body)`
  - **Section Isolation Boundary:**
    Each parser stops at the next markdown heading (`## ` or `### `), preventing section spillover.
  - **Backward Compatibility Fallback:**
    If an issue body has NO section headers at all (raw informal todo markdown), `parseSubtasks` retains legacy behavior collecting top-level checkboxes. When standard section headers are present, it strictly bounds extraction to `### Actionable Subtasks Checklist:` (and legacy aliases like `### Subtasks:`).

### 3. Human Attention Queue Grouping Primitives
- Add `groupIssuesByAttention(issues: Issue[]): Record<HumanAttention, Issue[]>` to `panel/core.ts`.
- Groups issues by Attention state (`needs-decision`, `needs-permission`, `needs-review`, `none`) independently of workflow phase.
- An issue in `phase:exploration` with unanswered questions appears in `needs-decision`; an issue in `phase:execution` requesting deployment appears in `needs-permission`; an issue in `phase:verification` awaiting sign-off appears in `needs-review`.

---

## Phased Execution Order

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Section-Scoped Parsing (Task 001)                  │
│ - Strict header scoping for Acceptance Criteria & Subtasks  │
│ - Zero cross-counting between sections                      │
│ - Backward fallback for unsectioned legacy issues           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Dual-Mode 4-Axis Metadata (Task 002)               │
│ - Types: WorkflowPhase, HumanAttention, ExecutionLiveness   │
│ - resolveV2Metadata: v2 extraction + v1 fallback projection │
│ - Preserve resolveIssueColumn 100% backward compatible      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Attention Grouping & UI Primitives (Task 003)       │
│ - groupIssuesByAttention helper                             │
│ - Attention queue extraction & badge support                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Verification, Adversarial Fuzz & Gate (Tasks 004-7)│
│ - Automated unit & integration tests in test/               │
│ - Adversarial fuzz test with edge cases and malformed bodies│
│ - Commit state checkpoint and human validation walkthrough  │
└─────────────────────────────────────────────────────────────┘
```

---

## Scope & Boundaries

### Allowed Paths
- `panel/core.ts` (parsing, types, metadata resolution, grouping)
- `test/stage1-dual-mode-and-scoping.test.js` (new verification suite)

### MUST-NOT-TOUCH
- Live GitHub issue state: zero writes, mutations, or migrations to remote issues.
- `panel/main.ts` DOM rendering loop: keep intact until parser primitives are proven.
- `panel/labels.ts` write-back reconciler: Stage 1 is strictly read-only compatibility.
- Existing 360 tests in `test/`: all must pass with zero regressions.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Legacy Breakage:** Section scoping breaks issues without headers | Existing unsectioned user issues lose subtasks | Implement fallback: if no known section headers exist, collect unstructured checkboxes as subtasks. |
| **Status Desynchronization:** v2 phase mapping conflicts with v1 columns | UI columns show unexpected issue counts | `resolveIssueColumn` preserves exact v1 resolution when v2 labels are absent; maps v2 phases to closest v1 equivalent. |
| **Checkbox Cross-Counting:** Mutators toggle checkboxes at wrong line indices | Checkbox clicks edit unintended lines | Keep `lineIndex` tracked per subtask item relative to original body string. |
