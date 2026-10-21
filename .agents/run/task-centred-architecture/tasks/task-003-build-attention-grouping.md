<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage1-contract-shell
Branch: feat/stage1-contract-shell
Base commit: 98eb0e3
Files: panel/core.ts, test/stage1-dual-mode-and-scoping.test.js
Test command: node --test test/stage1-dual-mode-and-scoping.test.js && node --test
Do not touch: panel/labels.ts, panel/main.ts, docs/issue-body-contract.md, package.json
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Implement groupIssuesByAttention and attention filtering primitives in panel/core.ts to organize issues into action queues orthogonally to workflow phase.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-002-dual-mode-4axis-metadata.md]
</context_files>
<skills>
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/design/contracts/api-and-interface-design/SKILL.md]
[@.agents/skills/build/discipline/incremental-implementation/SKILL.md]
</skills>
<owned_paths>
panel/core.ts
test/stage1-dual-mode-and-scoping.test.js
.agents/run/task-centred-architecture/outputs/task-003-attention-grouping.md
</owned_paths>
<depends_on>
task-002
</depends_on>
<steps>
1. In panel/core.ts, implement groupIssuesByAttention(issues: Issue[], sessionIndex?: Map<number, any>): Record<HumanAttention, Issue[]>.
2. Implement filterIssuesByAttention(issues: Issue[], attention: HumanAttention, sessionIndex?: Map<number, any>): Issue[].
3. Ensure defensive handling for empty lists, null/undefined properties, and issues without attention tags.
4. Author comprehensive unit tests in test/stage1-dual-mode-and-scoping.test.js proving orthogonal grouping across diverse phases.
5. Verify test pass: node --test test/stage1-dual-mode-and-scoping.test.js && node --test.
6. Write output summary to .agents/run/task-centred-architecture/outputs/task-003-attention-grouping.md.
</steps>
<criteria>
- groupIssuesByAttention partitions issues into needs-decision, needs-permission, needs-review, and none.
- Grouping is completely orthogonal to workflow phase.
- Defensive handling against malformed inputs.
- Full regression test suite remains 100% passing (360/360 pass).
</criteria>
<verification>
node --test test/stage1-dual-mode-and-scoping.test.js && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-003-attention-grouping.md:
# Task 003 Output: Human Attention Grouping Primitives
## Status: completed | failed
## Evidence:
- Test output for test/stage1-dual-mode-and-scoping.test.js
- Full regression test run summary
## Changes:
- Modified files and key functions added
## Verification:
- Exact commands executed and confirmation of orthogonal grouping
</output>
