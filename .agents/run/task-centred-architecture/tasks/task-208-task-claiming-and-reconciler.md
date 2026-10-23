<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Base commit: 9d4f8da
Files: service/task-claim.ts, service/reconciler.ts, service/session-watcher.ts, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && node --test test/stage2b-pilot-coordinator.test.js
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Implement the opt-in task claiming engine (service/task-claim.ts), session liveness watcher (service/session-watcher.ts), and lifecycle reconciler (service/reconciler.ts) connecting task phases and attention states to agent session outcomes.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator/service/types.ts]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator/service/lease-store.ts]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator/service/cas.ts]
[@/workspace/extensions/github-task-board/panel/core.ts]
</context_files>
<skills>
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/build/discipline/incremental-implementation/SKILL.md]
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
</skills>
<owned_paths>
service/task-claim.ts
service/session-watcher.ts
service/reconciler.ts
test/stage2b-pilot-coordinator.test.js
.agents/run/task-centred-architecture/outputs/task-208-reconciler.md
</owned_paths>
<depends_on>
task-207
</depends_on>
<steps>
1. Create `service/task-claim.ts`:
   - Implement `isTaskEligibleForPilot(issue: any): boolean`:
     - Checks if task is opt-in for automated coordinator handling:
       - Has label `coordinator:pilot` OR has `v2Metadata.phase` matching `'exploration'` or `'execution'` with `attention === 'none'`.
       - Must not be `phase: 'done'` or closed.
   - Implement `claimPilotTask(issue: any, repo: string, leaseStore: LeaseStore, workerId: string): Promise<ClaimResult>`:
     - Verifies eligibility.
     - Computes `claimedSha = computeIssueSha(issue.body)`.
     - Calls `leaseStore.acquireLease(repo, issue.number, workerId, claimedSha, issue.v2Metadata?.phase || 'exploration')`.
2. Create `service/session-watcher.ts`:
   - Implement `inspectSessionLiveness(session: any): SessionLivenessState`:
     - Returns `{ state: 'running' | 'completed' | 'failed' | 'blocked-permission' | 'blocked-question' | 'idle', details?: string }`.
     - Recognizes:
       - Session has pending permissions -> `'blocked-permission'`
       - Session has pending questions -> `'blocked-question'`
       - Session ended/stopped with exit code 0 or completed state -> `'completed'`
       - Session error/failed -> `'failed'`
       - Session actively busy/running -> `'running'`
       - Else -> `'idle'`
3. Create `service/reconciler.ts`:
   - Implement `reconcileTaskState(issue: any, session: any, lease: TaskLease): ReconciliationAction`:
     - Inspects session liveness via `inspectSessionLiveness(session)`.
     - When session is `blocked-permission`:
       - Emits `{ action: 'escalate', targetAttention: 'needs-permission', reason: 'Linked session blocked on tool permissions' }`.
     - When session is `blocked-question`:
       - Emits `{ action: 'escalate', targetAttention: 'needs-decision', reason: 'Linked session waiting for human response' }`.
     - When session is `completed`:
       - If task was in `phase: 'exploration'`, advances to `phase: 'planning'` (or `attention: 'needs-review'`).
       - If task was in `phase: 'execution'`, advances to `phase: 'verification'`, `attention: 'needs-review'`.
       - Emits `{ action: 'advance', targetPhase: ..., targetAttention: 'needs-review', reason: 'Worker completed execution cleanly' }`.
     - When session is `failed`:
       - Emits `{ action: 'escalate', targetAttention: 'needs-decision', reason: 'Worker session failed or crashed: ' + session.error }`.
     - When session is `running`:
       - Emits `{ action: 'poll', reason: 'Worker session actively progressing' }`.
4. In `test/stage2b-pilot-coordinator.test.js`, add comprehensive tests for:
   - `isTaskEligibleForPilot`: includes eligible tasks, rejects non-pilot/done/unlabeled tasks.
   - `claimPilotTask`: acquires lease and computes accurate baseline SHA.
   - `inspectSessionLiveness`: accurately classifies running, blocked-permission, blocked-question, completed, and failed sessions.
   - `reconcileTaskState`:
     - Session blocked on permission -> targetAttention `needs-permission`.
     - Session blocked on question -> targetAttention `needs-decision`.
     - Session completed -> targetPhase advanced and targetAttention `needs-review`.
     - Session failed -> targetAttention `needs-decision`.
5. Run `npm run typecheck && node --test test/stage2b-pilot-coordinator.test.js` to verify 100% green.
6. Emit structured output to `.agents/run/task-centred-architecture/outputs/task-208-reconciler.md`.
</steps>
<criteria>
- Opt-in task eligibility is strictly bounded (never touches random or done issues).
- Session watcher categorizes all OpenChamber session states.
- Reconciler maps session completions and blocks to orthogonal 4-axis transitions cleanly.
- Tests pass cleanly.
</criteria>
<verification>
npm run typecheck && node --test test/stage2b-pilot-coordinator.test.js
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-208-reconciler.md:
# Task 208 Output: Task Claiming & Reconciler
## Status: completed | failed
## Evidence:
- Typecheck output
- Test run output for test/stage2b-pilot-coordinator.test.js
## Changes:
- Modified files and key functions implemented
## Verification:
- Exact test assertions verified
</output>
