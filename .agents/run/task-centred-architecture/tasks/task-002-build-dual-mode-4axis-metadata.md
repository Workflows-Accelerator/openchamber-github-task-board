<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage1-contract-shell
Branch: feat/stage1-contract-shell
Base commit: 98eb0e3 (clean base before task 001 edits)
Files: panel/core.ts, test/stage1-dual-mode-and-scoping.test.js
Test command: node --test test/stage1-dual-mode-and-scoping.test.js && node --test
Do not touch: panel/labels.ts, panel/main.ts, docs/issue-body-contract.md, package.json
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Implement the 4-axis orthogonal state model in panel/core.ts supporting proposed v2 metadata and automatic fallback projection for legacy v1 status labels with 100% backward compatibility.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-001-section-scoped-parser.md]
</context_files>
<skills>
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/design/contracts/api-and-interface-design/SKILL.md]
[@.agents/skills/build/discipline/incremental-implementation/SKILL.md]
</skills>
<owned_paths>
panel/core.ts
test/stage1-dual-mode-and-scoping.test.js
.agents/run/task-centred-architecture/outputs/task-002-dual-mode-4axis-metadata.md
</owned_paths>
<depends_on>
task-001
</depends_on>
<steps>
1. In panel/core.ts, define WorkflowPhase, HumanAttention, ExecutionLiveness, DependencyState, and V2IssueMetadata types.
2. Augment Issue interface with optional v2Metadata?: V2IssueMetadata.
3. Implement resolveV2Metadata(issue: Issue, session?: any): V2IssueMetadata:
   - Extracts explicit phase:<phase> label if present; falls back to projecting v1 status:<status> label into workflow phase.
   - Extracts explicit attention:<attention> label if present; falls back to checking openQuestions and humanTasks.
   - Derives liveness from linked session state.
   - Derives dependencyState from parseIssueDependencies / blockers.
4. Ensure resolveIssueColumn(issue: Issue, session?: any) preserves exact v1 behavior for all existing tests, resolving v2 phase/attention to v1 columns when v1 labels are absent.
5. Populate v2Metadata in normalizeGithubIssues(rawItems: any[]).
6. Add unit tests to test/stage1-dual-mode-and-scoping.test.js.
7. Run verification commands: node --test test/stage1-dual-mode-and-scoping.test.js && node --test.
8. Write output summary to .agents/run/task-centred-architecture/outputs/task-002-dual-mode-4axis-metadata.md.
</steps>
<criteria>
- resolveV2Metadata correctly parses explicit v2 labels (phase:exploration, attention:needs-decision, etc.).
- resolveV2Metadata correctly projects v1 status labels when v2 labels are absent.
- Human attention is orthogonal to workflow phase.
- resolveIssueColumn preserves 100% backward compatibility for all existing v1 tests.
- Baseline test suite remains 100% passing (360/360 pass).
</criteria>
<verification>
node --test test/stage1-dual-mode-and-scoping.test.js && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-002-dual-mode-4axis-metadata.md:
# Task 002 Output: Dual-Mode 4-Axis Orthogonal Metadata
## Status: completed | failed
## Evidence:
- Test output for test/stage1-dual-mode-and-scoping.test.js
- Full regression test run summary
## Changes:
- Modified files and key functions added/refactored
## Verification:
- Exact commands executed and confirmation of orthogonal state resolution
</output>
