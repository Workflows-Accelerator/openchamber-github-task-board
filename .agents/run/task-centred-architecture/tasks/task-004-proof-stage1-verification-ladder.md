<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage1-contract-shell
Branch: feat/stage1-contract-shell
Base commit: 98eb0e3
Files: test/stage1-dual-mode-and-scoping.test.js
Test command: node --test test/stage1-dual-mode-and-scoping.test.js && node --test
Do not touch: panel/labels.ts, panel/main.ts, docs/issue-body-contract.md, package.json
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Execute and record the complete automated verification ladder (L0-L3) proving Stage 1 section scoping, dual-mode metadata, and attention grouping operate deterministically with zero regressions.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-001-section-scoped-parser.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-002-dual-mode-4axis-metadata.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-003-attention-grouping.md]
</context_files>
<skills>
[@.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@.agents/skills/verify/evidence/assertion-contracts/SKILL.md]
[@.agents/skills/verify/evidence/verify-and-stop/SKILL.md]
</skills>
<owned_paths>
test/stage1-dual-mode-and-scoping.test.js
.agents/run/task-centred-architecture/outputs/task-004-stage1-proof.md
</owned_paths>
<depends_on>
task-001, task-002, task-003
</depends_on>
<steps>
1. Review test/stage1-dual-mode-and-scoping.test.js across L0 (syntax), L1 (import/build), L2 (unit logic), L3 (integration with Issue #26 body).
2. Execute command: node --test test/stage1-dual-mode-and-scoping.test.js.
3. Execute full regression suite: node --test.
4. Record test durations, pass/fail counts, and assertion evidence in .agents/run/task-centred-architecture/outputs/task-004-stage1-proof.md.
</steps>
<criteria>
- L0 through L3 verification levels pass completely.
- test/stage1-dual-mode-and-scoping.test.js has 0 failures.
- Baseline test suite (all 360 existing tests) passes 100%.
- Output file contains direct empirical test receipts.
</criteria>
<verification>
node --test test/stage1-dual-mode-and-scoping.test.js && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-004-stage1-proof.md:
# Task 004 Output: Stage 1 Verification Ladder
## Status: completed | failed
## Level Evidence:
- L0 Syntax: PASS
- L1 Import/Types: PASS
- L2 Unit: PASS
- L3 Integration (Issue #26): PASS
## Regression Suite:
- node --test: PASS (360+ tests)
## Receipt:
- Test output log and timing
</output>
