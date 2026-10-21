# Stage 1 Verification Walkthrough

## Answer First
Stage 1 Contract Shell is complete, verified, and ready for human validation gate approval. The dual-mode parser eliminates cross-counting on multi-section markdown issues, introduces a 4-axis orthogonal state model (`phase`, `attention`, `liveness`, `dependencyState`), provides attention queue grouping primitives, and maintains 100% backward compatibility with existing Kanban column projection and regression suites (386/386 tests pass in ~65s).

Visible State: Step 7 of 7 complete. Stage 1 verification ladder, adversarial fuzzing, and code checkpointing are finished.

Deliverables Completed:
- Section-scoped checklist parsing in `panel/core.ts` (`parseAcceptanceCriteria`, `parseSubtasks`, `parseOpenQuestions`, `parseHumanTasks`, `parseTestPlan`)
- 4-axis orthogonal state metadata resolution and dual-mode projection (`resolveV2Metadata`, `resolveIssueColumn`, `normalizeGithubIssues`)
- Human attention grouping and filtering primitives (`groupIssuesByAttention`, `filterIssuesByAttention`)
- 26-test Stage 1 test suite covering unit contracts, hostile fuzzing, and real-world Issue #26 integration
- Clean regression across all 360 pre-existing tests with zero breaking changes

## Empirical Evidence

### Level 0: Syntax and Type Safety
- **Command:** `node --check test/stage1-dual-mode-and-scoping.test.js && npm run typecheck`
- **Exit Code:** `0`
- **Result:** Zero syntax errors; TypeScript compiler (`tsc --noEmit`) validates all exports, types, and interfaces without errors or warnings.

### Level 1: Import and Symbol Resolution
- **Command:** `node --input-type=module -e "import * as core from './panel/core.ts'; console.log('Imported', Object.keys(core).length, 'symbols');"`
- **Exit Code:** `0`
- **Result:** ESM imports resolve cleanly with zero circular dependencies or runtime warnings. All core symbols (`WorkflowPhase`, `HumanAttention`, `ExecutionLiveness`, `DependencyState`, `V2IssueMetadata`, `parseAcceptanceCriteria`, `parseSubtasks`, `resolveV2Metadata`, `resolveIssueColumn`, `groupIssuesByAttention`, `filterIssuesByAttention`) export as expected.

### Level 2: Unit and Scoping Contracts
- **Command:** `node --test test/stage1-dual-mode-and-scoping.test.js`
- **Exit Code:** `0`
- **Result:** 26 of 26 tests passed in 542ms.
- **Coverage Highlights:**
  - Section scoping: checklist extraction strictly bounds to target headings and halts at next section heading.
  - Legacy fallback: issues without explicit subtasks headings fall back cleanly while excluding Acceptance Criteria and Test Plan items.
  - Line index fidelity: `lineIndex` accurately references original markdown lines, enabling atomic checkbox updates via `updateSubtaskInMarkdown`.
  - Orthogonality: `phase` changes do not perturb `attention`, and vice-versa.
  - Session and dependency derivation: idle sessions with permissions transition cleanly; blocker issues map accurately.

### Level 3: Integration Proof (Real 50 KB Issue #26 Proposal Body)
- **Command:** `node --test --test-name-pattern="L3 integration" test/stage1-dual-mode-and-scoping.test.js`
- **Exit Code:** `0`
- **Result:** Successfully parsed real 50 KB proposal specification ("All work runs from the task board") with exact section isolation:
  - `parseFriendlyTitle`: `"All Work Runs on the Board"` (subtitle: `null`)
  - `parseAcceptanceCriteria`: Exactly 15 items extracted under `### Acceptance Criteria:`
  - `parseSubtasks`: Exactly 26 actionable subtasks extracted under `### Actionable Subtasks Checklist:`. Cross-counting completely eliminated (reduced from legacy 58 to 26).
  - `parseOpenQuestions`: Exactly 5 questions (Q1–Q5)
  - `parseHumanTasks`: Exactly 5 human tasks
  - `parseTestPlan`: Exactly 17 issue test plan items, 0 batch tests
  - Cross-contamination: 0 overlapping items across all extracted sets.
  - `resolveV2Metadata`: `phase: 'draft'`, `attention: 'needs-decision'`, `liveness: 'idle'`, `dependencyState: 'ready'`, `isExplicitV2: false`.
  - `resolveIssueColumn`: Maps to `'draft'` Kanban column.
  - `groupIssuesByAttention`: Partitioned directly into `'needs-decision'` action queue.

### Adversarial and Hostile Disproval Suite
- **Fenced Code Blocks:** Checkboxes inside triple backticks and tildes (`markdown`, `yaml`, `typescript`) are strictly ignored across all parsers.
- **Heading Variations:** Extra spaces, missing colons, heading levels 1–6, and casing (`### acceptance criteria:`, `## Subtasks`, `#### Actionable Subtasks Checklist`) parse robustly.
- **Large Payload Performance:** Parsed 5,000 checkboxes across mixed sections in ~40ms across all 5 parsers with zero catastrophic backtracking.
- **Deterministic Precedence:** Conflicting labels resolve deterministically (`attention:needs-permission` > `needs-decision` > `needs-review` > `none`; `phase:done` > ... > `phase:draft`).
- **CRLF & BOM Defensiveness:** Trailing `\r` stripped before regex matching in markdown mutators; exact `\r\n` line endings preserved during checkbox toggling; UTF-8 BOM (`\uFEFF`) safely stripped; non-string inputs safely handled.

### Full Regression Suite
- **Command:** `node --test`
- **Exit Code:** `0`
- **Result:** 386 of 386 tests passed in ~64.9s (360 baseline tests + 26 Stage 1 tests, 0 failures, 0 skipped).

## Side-by-Side Issue #26 Parsing Comparison

The following table contrasts legacy v1 behavior with the Stage 1 Contract Shell on the 50 KB Issue #26 proposal specification:

| Extraction / Resolution Axis | Legacy v1 Parser | Stage 1 Contract Shell | Impact / Delta |
| :--- | :--- | :--- | :--- |
| **Friendly Title** | "All Work Runs on the Board" | "All Work Runs on the Board" | Preserved; backward compatible |
| **Acceptance Criteria** | 0 extracted (no dedicated parser; ignored or counted as subtasks) | 15 items extracted under `### Acceptance Criteria:` | Cleanly isolated into `issue.acceptanceCriteria` |
| **Subtask Count** | **58 subtasks** (cross-counted: 15 AC + 17 test plan + 26 subtasks) | **26 subtasks** (strictly scoped to `### Actionable Subtasks Checklist:`) | **Eliminated 32 false subtasks** (-55% noise) |
| **Test Plan Items** | Bleeds 17 items into general subtasks | 17 items parsed into `testPlan.issueTests`; 0 in subtasks | Zero cross-section contamination |
| **Open Questions** | 5 questions (Q1–Q5) | 5 questions isolated under `### Open Questions:` | Drives `attention: 'needs-decision'` queue |
| **Human Tasks** | 5 human tasks | 5 human tasks isolated under `### Human Tasks:` | Available for dedicated attention queue |
| **Cross-Contamination** | High: all checklist items lumped into subtasks | **Zero**: set intersection between subtasks, AC, test plan, and questions is 0 | Complete section boundary enforcement |
| **State Representation** | 1-dimensional: `status:draft` | 4-axis orthogonal model: `phase: 'draft'`, `attention: 'needs-decision'`, `liveness: 'idle'`, `dependencyState: 'ready'` | Orthogonal separation of workflow phase and human attention |
| **Kanban Column Mapping** | `'draft'` | `'draft'` | Identical column placement; seamless backward compatibility |
| **Attention Queue Routing** | Not supported (single status bucket) | Routed into `'needs-decision'` action queue | Instant visibility for items blocked on decisions |

## Blind Spots & Unverified Scope

The following items are intentionally outside the scope of Stage 1 and remain unverified at this gate:

1. **DOM and UI Rendering:** Stage 1 implements the contract shell in `panel/core.ts`. Visual card rendering, 4-axis badge chips, and attention tab elements in `panel/main.ts` and `panel/index.html` belong to Stage 2 and have not been rendered in the browser DOM.
2. **Live GitHub Network Write Round-Trips:** In-memory string mutators (`updateSubtaskInMarkdown`, `answerOpenQuestionInMarkdown`) are verified with unit tests for LF and CRLF line endings, but live HTTP PATCH network round-trips against a remote GitHub repository are not exercised.
3. **Multi-Repository Attention Aggregate UI:** While `groupIssuesByAttention` processes issues across multiple repositories in memory, multi-repository UI rollup interactions, cross-project filtering controls, and background debouncing remain UI concerns for later stages.
4. **Subtask Reordering and Drag-and-Drop:** Checkbox toggle updates preserve line indices, but reordering subtasks by dragging lines in the issue markdown is not supported.
5. **Arbitrary Non-Standard Headings:** Headings outside the documented alias catalog (e.g., `### My Unstandardized Checklist`) are safely ignored by scoped parsers and fall back without crashing.

## Human Acceptance Checklist

Lead approval is required on the following criteria before opening Stage 2 work:

- [ ] **Regression Invariance:** Confirm that full test suite passes with zero regressions (386/386 tests pass).
- [ ] **Section Scoping Precision:** Confirm that Issue #26 extracts exactly 26 subtasks and 15 acceptance criteria without cross-counting.
- [ ] **Orthogonal Model Integrity:** Confirm that 4-axis metadata separates `phase` from `attention` while preserving legacy v1 Kanban column mapping.
- [ ] **Adversarial Resilience:** Confirm that fenced code blocks, Windows CRLF line endings, and conflicting label precedence resolve cleanly without crashes.
- [ ] **Gate Approval:** Approve proceeding from Stage 1 Contract Shell to Stage 2 UI Surface Integration.

Next Action: Review the checklist above and approve Stage 1 completion to unlock Stage 2 implementation (estimated time: 2 minutes).
