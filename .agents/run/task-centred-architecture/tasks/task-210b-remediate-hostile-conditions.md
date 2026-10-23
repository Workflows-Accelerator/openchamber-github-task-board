<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Files: service/cas.ts, service/task-claim.ts, service/reconciler.ts, service/session-watcher.ts, service/lease-store.ts, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && npm run build && node --test test/stage2b-pilot-coordinator.test.js && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Remediate the adversarial conditions identified in Task 210 hostile review (ADV-2B-01 idempotency guard, ADV-2B-02 CRLF normalization, ADV-2B-04 explicit opt-in scoping, ADV-2B-06 corrupted file backup, ADV-2B-07 session watcher deduplication), verify with tests, rebuild bundles, and achieve a clean PROCEED verdict.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator/service/cas.ts]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator/service/task-claim.ts]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator/service/reconciler.ts]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator/service/lease-store.ts]
</context_files>
<skills>
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<owned_paths>
service/cas.ts
service/task-claim.ts
service/reconciler.ts
service/lease-store.ts
service/main.ts
test/stage2b-pilot-coordinator.test.js
.agents/run/task-centred-architecture/outputs/task-210b-remediation.md
</owned_paths>
<depends_on>
task-210
</depends_on>
<steps>
1. In `service/cas.ts`:
   - In `computeIssueSha`: normalize CRLF before hashing: `const normalized = (body ?? '').replace(/\r\n/g, '\n');`
   - In `verifyIssueCas`: ensure comparison handles normalized CRLF digests seamlessly.
2. In `service/task-claim.ts`:
   - Remove duplicated `computeIssueSha` definition and import `computeIssueSha` from `./cas.js`.
   - Update `isTaskEligibleForPilot`: require explicit opt-in:
     - Must have label `'coordinator:pilot'` OR explicit v2 metadata (`issue.v2Metadata?.isExplicitV2 === true` with active phase `'exploration'` or `'execution'` and `attention === 'none'`). Legacy unmigrated issues without explicit v2 or pilot labels must return `false`.
3. In `service/reconciler.ts`:
   - Deduplicate session inspection: import `inspectSessionLiveness` from `./session-watcher.js` instead of duplicating private inspection logic.
   - Fix ADV-2B-01 idempotency:
     - If current task is already in `phase: 'verification'` or `phase: 'done'`, or has `attention: 'needs-review'`, do NOT advance further!
     - When session is `completed`:
       - If task was in `phase: 'exploration'`, return `{ action: 'advance', targetPhase: 'planning', targetAttention: 'needs-review', reason: ... }`.
       - If task was in `phase: 'execution'`, return `{ action: 'advance', targetPhase: 'verification', targetAttention: 'needs-review', reason: ... }`.
       - If task is already in `verification`, return `{ action: 'poll', reason: 'Awaiting human review' }`.
       - If task is already in `done`, return `{ action: 'release', reason: 'Task is complete' }`.
4. In `service/lease-store.ts`:
   - In `init()`: when catching `SyntaxError` from corrupted JSON, backup the corrupted file to `${this.filePath}.corrupted.${Date.now()}.bak` via `fs.promises.copyFile` or `rename` before initializing the empty state.
5. In `test/stage2b-pilot-coordinator.test.js`:
   - Add tests:
     - CRLF vs LF SHA-256 consistency: `computeIssueSha("A\r\nB") === computeIssueSha("A\nB")`.
     - Reconciliation idempotency: tick 1 advances `execution` -> `verification`; tick 2 with same completed session returns `action: 'poll'` and does NOT advance to `done`.
     - Legacy task rejection: task with only legacy label `status:in-progress` (without explicit v2 or pilot label) returns `isTaskEligibleForPilot(task) === false`.
     - Corrupted file backup: verify `.corrupted.<timestamp>.bak` file is created when corrupted store is initialized.
6. Verify and compile:
   - `npm run typecheck`
   - `npm run build`
   - `node --test test/stage2b-pilot-coordinator.test.js`
   - `node --test` (all 449+ tests pass)
7. Commit changes to `feat/stage2b-pilot-coordinator`:
   `fix(service): resolve ADV-2B-01, ADV-2B-02, ADV-2B-04, ADV-2B-06, and ADV-2B-07 hostile conditions`
8. Emit output to `.agents/run/task-centred-architecture/outputs/task-210b-remediation.md`.
</steps>
<criteria>
- ADV-2B-01, ADV-2B-02, ADV-2B-04, ADV-2B-06, and ADV-2B-07 are remediated.
- Tests verify CRLF equality, reconciliation idempotency, legacy exclusion, and forensic backup.
- Full test suite passes 100%.
- Both bundles rebuilt cleanly.
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-210b-remediation.md:
# Task 210b Output: Hostile Conditions Remediation
## Status: completed | failed
## Evidence:
- Typecheck output
- Bundle builds output
- Full test suite output (all tests green)
- Commit SHA on feat/stage2b-pilot-coordinator
## Remediated Findings:
- ADV-2B-01 (Idempotency): RESOLVED
- ADV-2B-02 (CRLF Normalization): RESOLVED
- ADV-2B-04 (Opt-In Scoping): RESOLVED
- ADV-2B-06 (Corrupted Store Backup): RESOLVED
- ADV-2B-07 (Deduplication): RESOLVED
</output>
