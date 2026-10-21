<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage1-contract-shell
Branch: feat/stage1-contract-shell
Base commit: 98eb0e3 (clean)
Files: panel/core.ts, test/stage1-dual-mode-and-scoping.test.js
Test command: node --test test/stage1-dual-mode-and-scoping.test.js && node --test
Do not touch: panel/labels.ts, panel/main.ts, docs/issue-body-contract.md, package.json
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Implement section-scoped checklist parsing in panel/core.ts to isolate Acceptance Criteria, Subtasks, and Test Plan checkboxes, eliminating cross-counting while preserving unstructured fallback.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
</context_files>
<skills>
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/build/discipline/incremental-implementation/SKILL.md]
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
</skills>
<owned_paths>
panel/core.ts
test/stage1-dual-mode-and-scoping.test.js
.agents/run/task-centred-architecture/outputs/task-001-section-scoped-parser.md
</owned_paths>
<depends_on>
none
</depends_on>
<steps>
1. In panel/core.ts, create parseAcceptanceCriteria(body: string): Subtask[] targeting "### Acceptance Criteria:" headings.
2. Refactor parseSubtasks(body: string): Subtask[] to isolate checkboxes strictly under "### Actionable Subtasks Checklist:" (and legacy aliases "### Subtasks:", "## Subtasks:") when section headings exist.
3. If no recognized section headers are found in the markdown body, retain fallback behavior collecting top-level checkboxes. When recognized section headers are present, strictly exclude checkboxes belonging to Acceptance Criteria, Open Questions, Human Tasks, and Test Plan.
4. Add acceptanceCriteria?: Subtask[] to Issue interface and normalizeGithubIssues.
5. Ensure section boundary parsing halts extraction upon reaching the next heading (## or ###).
6. Author test/stage1-dual-mode-and-scoping.test.js covering isolated section extractions, zero cross-counting, legacy fallback, and line index accuracy.
7. Run tests to confirm zero regressions: node --test test/stage1-dual-mode-and-scoping.test.js && node --test.
8. Write output summary to .agents/run/task-centred-architecture/outputs/task-001-section-scoped-parser.md.
</steps>
<criteria>
- parseAcceptanceCriteria extracts checkboxes from ### Acceptance Criteria: cleanly.
- parseSubtasks extracts checkboxes ONLY from ### Actionable Subtasks Checklist: when sections exist.
- Checkboxes under ### Acceptance Criteria: are NOT counted in parseSubtasks.
- Checkboxes under ## Test Plan (Issue) / ## Test Plan (Batch) are NOT counted in parseSubtasks.
- Legacy unstructured markdown bodies without headers still extract checkboxes via parseSubtasks.
- Baseline test suite remains 100% passing (360/360 pass).
</criteria>
<verification>
node --test test/stage1-dual-mode-and-scoping.test.js && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-001-section-scoped-parser.md:
# Task 001 Output: Section-Scoped Checklist Parsing
## Status: completed | failed
## Evidence:
- Test output for test/stage1-dual-mode-and-scoping.test.js
- Full regression test run summary
## Changes:
- Modified files and key functions added/refactored
## Verification:
- Exact commands executed and confirmation of 0 cross-counting
</output>
