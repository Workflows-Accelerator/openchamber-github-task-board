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
<goal>Compile a comprehensive, human-readable verification walkthrough presenting empirical evidence for Stage 1 completion prior to human validation gate.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-004-stage1-proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-005-adversarial-fuzz.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-006-commit-checkpoint.md]
</context_files>
<skills>
[@.agents/skills/verify/evidence/verify-and-stop/SKILL.md]
[@.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<owned_paths>
.agents/run/task-centred-architecture/outputs/task-007-validation-walkthrough.md
</owned_paths>
<depends_on>
task-006
</depends_on>
<steps>
1. Ingest receipts from tasks 004, 005, and 006.
2. Structure the validation summary:
   - What shipped: summary of dual-mode parsing, section scoping, and attention grouping.
   - Proof: L0-L3 verification results, adversarial results, and full regression status.
   - Exact side-by-side comparison on Issue #26 showing before/after cross-counting resolution.
   - Stated unknowns: what was NOT tested or verified (e.g. DOM live render, write reconciler).
   - Human acceptance checklist.
3. Write deliverable to .agents/run/task-centred-architecture/outputs/task-007-validation-walkthrough.md.
</steps>
<criteria>
- Clear answer-first report format.
- Empirical command outputs included.
- Explicit human acceptance criteria.
</criteria>
<verification>
test -f .agents/run/task-centred-architecture/outputs/task-007-validation-walkthrough.md
</verification>
<output>
Emit structured walkthrough in .agents/run/task-centred-architecture/outputs/task-007-validation-walkthrough.md:
# Stage 1 Verification Walkthrough
## Answer First
[State of Stage 1 deliverable]
## Empirical Evidence
[Commands, test outcomes, timings]
## Side-by-Side Issue #26 Parsing Comparison
[Before vs After]
## Blind Spots & Unverified Scope
[Explicit list]
## Human Acceptance Checklist
[Checklist for lead approval]
</output>
