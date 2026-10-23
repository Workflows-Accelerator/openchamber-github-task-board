<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Files: service/lease-store.ts, service/main.ts, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Final bounded fix round (per the manager's bounding rule: this is the LAST remediation before merge regardless): fix ADV-2E-01 (array-valued `leases` shape check bypass) and close the PLAN-STAGE2B clean-shutdown invariant by making `releaseHeldLeases` actually release leases. Everything else is documented residual.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210e-final-hostile-review.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
</context_files>
<skills>
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
</skills>
<owned_paths>
service/lease-store.ts
service/main.ts
test/stage2b-pilot-coordinator.test.js
.agents/run/task-centred-architecture/outputs/task-210f-final-fix.md
</owned_paths>
<depends_on>
task-210e
</depends_on>
<steps>
1. **ADV-2E-01 (service/lease-store.ts):** The shape check accepts array-valued `leases` (`typeof [] === 'object'`), so `{"leases":[...]}` loads with entries re-keyed to `'0'` and is silently overwritten without forensic backup, falsifying the "backups trigger on ANY wrong shape" claim.
   - Reject arrays explicitly in BOTH load paths (`init()` and `loadFromDisk()`, lines ~93 and ~159): a valid state requires `leases` to be a plain object (`typeof x === 'object' && x !== null && !Array.isArray(x)`).
   - Red-first regression test: `{"leases":[]}` and `{"leases":[{"issueNumber":1}]}` must be treated as wrong-shape — backed up to `.corrupted.<timestamp>.bak` before reset, never silently re-keyed or overwritten.
2. **Clean-shutdown invariant (service/main.ts:120-126):** `CoordinatorService.releaseHeldLeases` logs releases but never calls `releaseLease` (dead stub). PLAN-STAGE2B invariant #4 requires SIGINT/SIGTERM to release held leases.
   - Make `releaseHeldLease(s)` actually call `leaseStore.releaseLease(...)` for each lease this coordinator instance holds (ownerId match), then clear local bookkeeping.
   - Red-first regression test: acquire a lease through the service path, call stop()/releaseHeldLeases(), assert `getLease()` returns null immediately (not waiting for TTL expiry).
3. Everything else from Task 210e is DOCUMENTED RESIDUAL — do NOT fix: ADV-2E-02 (phantom in-memory lease after refused writes), ADV-2E-03 (same-ms backup-name collision, spurious `.corrupted.` backups), ADV-2E-04 (log label inaccuracy), ADV-2E-05 (fail-fast startup change), plus prior residuals ADV-2C-06/09/10, ADV-2B-03/05/08. List them in the output.
4. Verify: `npm run typecheck && npm run build && node --test` (all green, zero regressions) and `node --check service/main.js`.
5. Commit to `feat/stage2b-pilot-coordinator`: `fix(service): reject array lease shapes and release held leases on shutdown (ADV-2E-01)`.
6. Emit output to `.agents/run/task-centred-architecture/outputs/task-210f-final-fix.md`.
</steps>
<criteria>
- Array-valued `leases` treated as wrong-shape in every load path, backed up before reset (red-first test passes).
- Held leases are actually released on shutdown (red-first test passes).
- Full suite green; shipped bundle self-contained.
- Scope strictly limited to the two fixes; no opportunistic refactors.
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-210f-final-fix.md:
# Task 210f Output: Final Fix Round
## Status: completed | failed
## Evidence:
- Typecheck / build / full suite results
- Commit SHA on feat/stage2b-pilot-coordinator
## Per-fix resolution:
- ADV-2E-01: RESOLVED (test: ...)
- releaseHeldLeases dead stub: RESOLVED (test: ...)
## Documented residuals (NOT fixed, by design):
- ADV-2E-02, ADV-2E-03, ADV-2E-04, ADV-2E-05, ADV-2C-06, ADV-2C-09, ADV-2C-10, ADV-2B-03, ADV-2B-05, ADV-2B-08
</output>
