<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Files under review: service/reconciler.ts, service/lease-store.ts, service/cas.ts, service/main.ts, test/stage2b-pilot-coordinator.test.js (changes in commit 656500b)
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Conduct a hostile review of any edits or changes that the Task 210d remediation (commit 656500b) made to figure out what might have been missed or what might be broken. Don't assume that what was done is right. This is a BOUNDED final pass over the 210d diff only — not a re-review of all Stage 2B. If a prior finding's fix is verified by an empirically reproducing probe, do not re-litigate it.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210c-remediation-hostile-review.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210d-remediation-two.md]
</context_files>
<skills>
[@.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<owned_paths>
.agents/run/task-centred-architecture/outputs/task-210e-final-hostile-review.md
</owned_paths>
<depends_on>
task-210d
</depends_on>
<steps>
1. Inspect the 210d diff: `git show 656500b` in the worktree.
2. Re-run the EXACT Task 210c probe failure modes against the fixed code (empirically, via scripts under /tmp/opencode or the test suite):
   - `failed` / `blocked-permission` / `blocked-question` sessions on `verification` tasks: must return `poll` without overwriting `needs-review`.
   - Any liveness state on `done`/`archive`/closed tasks: must return `release`, zero attention mutation.
   - Issue `planning` + stale lease `execution` + completed session: must return `poll`, not advance to `verification`.
   - `completed` + `execution` + `attention: 'needs-decision'`: must return `poll`, question not discarded.
   - Read-error and wrong-shape load failures: prior file preserved (backed up or byte-identical), never silently overwritten.
   - Bare `\r` and mixed-ending bodies: digests equal LF-normalized body.
3. Hostile-check the 210d fixes themselves:
   - The two CHANGED test expectations: were they legitimately changed for behavior the findings forbid, or quietly weakened to keep tests green? Check both.
   - `saveToDisk` refusal mode (ADV-2C-07): when writes are refused because no backup succeeded, is there a recovery path, or can the store permanently lock out legitimate writes (availability defect)? Probe a backup-fails-then-backup-succeeds sequence.
   - `service/main.ts` `.js` -> `.ts` import specifiers: does the shipped bundle stay self-contained (`node --check service/main.js` + import without type stripping) and does `npm run build` remain deterministic?
   - Guard ordering: confirm the hoisted terminal/awaiting-human guards cannot now wrongly block a legitimate `execution` -> `verification` advance or a clean release of expired-lease tasks.
   - Any NEW defect introduced by the 210d diff that was not in 210c's findings.
4. Execute `npm run typecheck && npm run build && node --test`.
5. Emit verdict `PROCEED` | `PROCEED-WITH-CONDITIONS` | `HALT` to `.agents/run/task-centred-architecture/outputs/task-210e-final-hostile-review.md`.
   - BOUNDING RULE: only Moderate-or-higher behavioral defects block merge (verdict HALT or conditions). Low/cosmetic residuals must be recorded as documented residuals instead of conditions.
</steps>
<criteria>
- Each 210c probe failure mode empirically re-verified against the fixed code.
- Changed test expectations adjudicated (legitimate vs weakened).
- Refusal-mode recovery path probed.
- Explicit verdict with the bounding rule applied.
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-210e-final-hostile-review.md:
# Task 210e Output: Final Hostile Review (Third Pass, Bounded)
## Verdict: PROCEED | PROCEED-WITH-CONDITIONS | HALT
## 210c Probe Re-Verification:
| Probe | Result |
## Findings (if any):
| ID | Severity | File:Line | Description | Disposition |
## Adjudications:
- Changed test expectation 1: LEGITIMATE / WEAKENED
- Changed test expectation 2: LEGITIMATE / WEAKENED
- Refusal-mode recovery: PASS / FAIL
## Test Verification:
- Total tests passed: X / Y
</output>
