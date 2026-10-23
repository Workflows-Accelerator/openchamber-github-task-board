<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Files: service/reconciler.ts, service/lease-store.ts, service/cas.ts, service/main.ts, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Remediate the second-pass hostile review findings (ADV-2C-01 through ADV-2C-05, ADV-2C-07, ADV-2C-08) in the Stage 2B coordinator, each with a targeted regression test that reproduces the exact probe failure mode from the Task 210c review, then rebuild bundles and keep the full suite green.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210c-remediation-hostile-review.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210b-remediation.md]
</context_files>
<skills>
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
</skills>
<owned_paths>
service/reconciler.ts
service/lease-store.ts
service/cas.ts
service/main.ts
test/stage2b-pilot-coordinator.test.js
.agents/run/task-centred-architecture/outputs/task-210d-remediation-two.md
</owned_paths>
<depends_on>
task-210c
</depends_on>
<steps>
1. **ADV-2C-01 + ADV-2C-05 + ADV-2C-08 (service/reconciler.ts):** Reorder guards so terminal/awaiting-human protection applies to EVERY liveness state, not only `completed`:
   - BEFORE the liveness switch: if phase is `'done'` or `'archive'` (or issue is closed) -> `{ action: 'release', reason: 'Task is complete' }` for every liveness state.
   - Before the liveness switch: if phase is `'verification'` OR attention is any non-`'none'` value (including `'needs-review'`, `'needs-decision'`, `'needs-permission'`) -> `{ action: 'poll', reason: 'Awaiting human verification' }` for every liveness state. This must also stop `failed`/`blocked-*` sessions from overwriting `needs-review`.
   - Guard missing/empty issue: return `{ action: 'poll', reason: 'No issue data' }`.
   - In the `completed` branch, `advance` is only reachable when phase is `'exploration'` or `'execution'` AND attention is `'none'`.
2. **ADV-2C-02 (service/reconciler.ts):** Fix phase precedence: `currentPhase = issuePhase || leasePhase` — live issue metadata always outranks the lease's claim-time snapshot.
3. **ADV-2C-03 + ADV-2C-07 (service/lease-store.ts, service/main.ts):**
   - `CoordinatorService.start()` must call `this.leaseStore.init()` before the first tick.
   - In the store's load path: back up the prior file on ANY load failure (read error, `SyntaxError`, valid-JSON-but-wrong-shape) before resetting state — not only on `SyntaxError`.
   - If the backup itself fails: log the failure (`console.error` or equivalent) and SKIP the destructive reset (do not overwrite the unreadable/corrupted file; operate on empty in-memory state and make no destructive write). Never destroy prior state without a successful backup.
4. **ADV-2C-04 (service/cas.ts):** Normalize ALL line endings before digest: `replace(/\r\n?/g, '\n')` (covers `\r\n`, bare `\r`, mixed). Do NOT trim trailing whitespace — a false match there could clobber a real edit; false conflicts abort safely (deliberate decision, record it in the output).
5. **Regression tests (test/stage2b-pilot-coordinator.test.js)** — each must reproduce the exact Task 210c probe failure mode and pass after the fix:
   - `failed` / `blocked-permission` / `blocked-question` sessions on a task in `verification` -> `action: 'poll'` and `needs-review` NOT overwritten.
   - Same liveness states on `done`/`archive` tasks -> `action: 'release'`, no attention mutation.
   - Issue `planning` + stale lease `execution` + completed session -> `action: 'poll'` (NOT advance to `verification`).
   - `completed` session + phase `execution` + `attention: 'needs-decision'` -> `action: 'poll'` (open question not discarded).
   - Read-error load (simulate unreadable file) -> prior file preserved on disk (backed up or untouched), no silent overwrite.
   - Wrong-shape JSON (`null`, `42`, `{"leases":null}`) -> backed up before reset.
   - Bare-`\r` and mixed-ending bodies digest equal to LF-normalized body.
6. Verify and compile: `npm run typecheck && npm run build && node --test` (all tests green, zero regressions).
7. Commit to `feat/stage2b-pilot-coordinator`: `fix(service): harden reconciler guards, lease load backup, and digest normalization (ADV-2C-01..08)`.
8. Emit output to `.agents/run/task-centred-architecture/outputs/task-210d-remediation-two.md` including a residual note for the document-only findings ADV-2C-06 (test suite needs Node >= 22.18 for `.ts` type stripping; shipped bundle is Node-20 clean), ADV-2C-09 (conservative-direction eligibility edges), ADV-2C-10 (test discovery discrepancy).
</steps>
<criteria>
- Terminal/awaiting-human guards apply to all liveness states; no liveness state can mutate a `done`/`archive` task or overwrite `needs-review`.
- Live issue phase always outranks lease phase.
- Shipped CoordinatorService backs up prior lease state on any load failure and never destroys state without a successful backup.
- All line-ending variants digest identically; trailing whitespace deliberately strict.
- Full suite green with the new regression tests reproducing each probe failure mode.
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-210d-remediation-two.md:
# Task 210d Output: Second Remediation (ADV-2C-*)
## Status: completed | failed
## Evidence:
- Typecheck / build / full suite results
- Commit SHA on feat/stage2b-pilot-coordinator
## Per-finding resolution:
- ADV-2C-01: RESOLVED (test: ...)
- ADV-2C-02: RESOLVED (test: ...)
- ADV-2C-03: RESOLVED (test: ...)
- ADV-2C-04: RESOLVED (test: ...; trailing-whitespace strictness: deliberate)
- ADV-2C-05: RESOLVED (test: ...)
- ADV-2C-07: RESOLVED (test: ...)
- ADV-2C-08: RESOLVED (test: ...)
## Document-only residuals:
- ADV-2C-06, ADV-2C-09, ADV-2C-10
</output>
