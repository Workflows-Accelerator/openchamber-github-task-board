# Task 208 Output: Task Claiming & Reconciler

## Status: completed

## Evidence:
- `npm run typecheck`:
```
> openchamber-github-task-board@1.2.1 typecheck
> tsc --noEmit
```
(Exit code: 0, 0 errors)

- Test run output for `node --test test/stage2b-pilot-coordinator.test.js`:
```
TAP version 13
# Subtest: Part 1: Manifest declares openchamber.contributes.service host service
ok 1 - Part 1: Manifest declares openchamber.contributes.service host service
# Subtest: Part 1: loadCoordinatorConfig respects defaults and overrides
ok 2 - Part 1: loadCoordinatorConfig respects defaults and overrides
# Subtest: Part 2: computeIssueSha computes deterministic SHA-256 digests
ok 3 - Part 2: computeIssueSha computes deterministic SHA-256 digests
# Subtest: Part 2: computeIssueSha handles empty, null, and undefined values deterministically
ok 4 - Part 2: computeIssueSha handles empty, null, and undefined values deterministically
# Subtest: Part 2: verifyIssueCas verifies baseline hash match and detects divergence
ok 5 - Part 2: verifyIssueCas verifies baseline hash match and detects divergence
# Subtest: Part 2: CasManager utility class matches functional exports
ok 6 - Part 2: CasManager utility class matches functional exports
# Subtest: Part 3: acquireLease claims available task and records metadata
ok 7 - Part 3: acquireLease claims available task and records metadata
# Subtest: Part 3: Mutual Exclusion: second worker fails to acquire leased task
ok 8 - Part 3: Mutual Exclusion: second worker fails to acquire leased task
# Subtest: Part 3: Same owner can re-acquire and update active lease
ok 9 - Part 3: Same owner can re-acquire and update active lease
# Subtest: Part 4: renewHeartbeat extends lease expiration for owner
ok 10 - Part 4: renewHeartbeat extends lease expiration for owner
# Subtest: Part 4: TTL expiration allows reclamation by a new worker
ok 11 - Part 4: TTL expiration allows reclamation by a new worker
# Subtest: Part 5: releaseLease allows immediate takeover by another worker
ok 12 - Part 5: releaseLease allows immediate takeover by another worker
# Subtest: Part 5: pruneExpired removes only expired leases and leaves active ones
ok 13 - Part 5: pruneExpired removes only expired leases and leaves active ones
# Subtest: Part 6: Leases are atomically serialized to disk with version: 1 schema
ok 14 - Part 6: Leases are atomically serialized to disk with version: 1 schema
# Subtest: Part 6: Independent LeaseStore instances synchronize through disk file
ok 15 - Part 6: Independent LeaseStore instances synchronize through disk file
# Subtest: Part 6: Store recovers gracefully from corrupted disk file
ok 16 - Part 6: Store recovers gracefully from corrupted disk file
# Subtest: Part 6: Rapid concurrent writes do not race or corrupt lease file
ok 17 - Part 6: Rapid concurrent writes do not race or corrupt lease file
# Subtest: Part 7: isTaskEligibleForPilot correctly identifies eligible tasks
ok 18 - Part 7: isTaskEligibleForPilot correctly identifies eligible tasks
# Subtest: Part 7: isTaskEligibleForPilot strictly rejects closed, terminal, non-pilot, or attention-demanding tasks
ok 19 - Part 7: isTaskEligibleForPilot strictly rejects closed, terminal, non-pilot, or attention-demanding tasks
# Subtest: Part 7: claimPilotTask verifies eligibility, computes baseline SHA, and acquires lease
ok 20 - Part 7: claimPilotTask verifies eligibility, computes baseline SHA, and acquires lease
# Subtest: Part 7: claimPilotTask rejects ineligible tasks and handles invalid input
ok 21 - Part 7: claimPilotTask rejects ineligible tasks and handles invalid input
# Subtest: Part 8: inspectSessionLiveness accurately classifies running sessions
ok 22 - Part 8: inspectSessionLiveness accurately classifies running sessions
# Subtest: Part 8: inspectSessionLiveness accurately classifies blocked-permission sessions
ok 23 - Part 8: inspectSessionLiveness accurately classifies blocked-permission sessions
# Subtest: Part 8: inspectSessionLiveness accurately classifies blocked-question sessions
ok 24 - Part 8: inspectSessionLiveness accurately classifies blocked-question sessions
# Subtest: Part 8: inspectSessionLiveness accurately classifies completed sessions
ok 25 - Part 8: inspectSessionLiveness accurately classifies completed sessions
# Subtest: Part 8: inspectSessionLiveness accurately classifies failed sessions
ok 26 - Part 8: inspectSessionLiveness accurately classifies failed sessions
# Subtest: Part 8: inspectSessionLiveness handles idle, empty, and null sessions gracefully
ok 27 - Part 8: inspectSessionLiveness handles idle, empty, and null sessions gracefully
# Subtest: Part 9: reconcileTaskState escalates blocked-permission session to needs-permission
ok 28 - Part 9: reconcileTaskState escalates blocked-permission session to needs-permission
# Subtest: Part 9: reconcileTaskState escalates blocked-question session to needs-decision
ok 29 - Part 9: reconcileTaskState escalates blocked-question session to needs-decision
# Subtest: Part 9: reconcileTaskState advances completed exploration session to planning with needs-review
ok 30 - Part 9: reconcileTaskState advances completed exploration session to planning with needs-review
# Subtest: Part 9: reconcileTaskState advances completed execution session to verification with needs-review
ok 31 - Part 9: reconcileTaskState advances completed execution session to verification with needs-review
# Subtest: Part 9: reconcileTaskState respects phase from TaskLease when available
ok 32 - Part 9: reconcileTaskState respects phase from TaskLease when available
# Subtest: Part 9: reconcileTaskState escalates failed session to needs-decision with failure details
ok 33 - Part 9: reconcileTaskState escalates failed session to needs-decision with failure details
# Subtest: Part 9: reconcileTaskState polls actively running or idle sessions
ok 34 - Part 9: reconcileTaskState polls actively running or idle sessions
# Subtest: Part 9: CoordinatorReconciler class wrapper delegates cleanly
ok 35 - Part 9: CoordinatorReconciler class wrapper delegates cleanly
1..35
# tests 35
# suites 0
# pass 35
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

- Full test suite `npm test`: 448 tests passing (100% PASS).

## Changes:
- `service/types.ts`:
  - Updated `SessionLivenessState` to include `'blocked-permission'` and `'blocked-question'`.
  - Updated `SessionLivenessInfo` with optional `sessionId`, `updatedAt`, `reason`, and `details`.
- `service/task-claim.ts`:
  - Implemented `isTaskEligibleForPilot(issue)`: validates opt-in scope (explicit `coordinator:pilot` label or active workflow phases `exploration`/`execution` with `attention === 'none'`), strictly rejecting closed, terminal (`done`/`archive`), and attention-blocked issues.
  - Implemented `claimPilotTask(issue, repo, leaseStore, workerId, ttlMs)`: checks eligibility, computes baseline SHA-256 issue body digest, and acquires lease via `LeaseStore`.
  - Implemented `TaskClaimEngine` class wrapper for stateful lease management.
- `service/session-watcher.ts`:
  - Implemented `inspectSessionLiveness(session)`: detects `blocked-permission`, `blocked-question`, `failed`, `completed`, `running`, and `idle` states from OpenChamber session fields (`pendingPermissions`, `pendingQuestions`, `activity`, `status`, `error`, `exitCode`, `busy`).
  - Implemented `SessionWatcher` class wrapper.
- `service/reconciler.ts`:
  - Implemented `reconcileTaskState(issue, session, lease)`: maps session outcomes to orthogonal 4-axis metadata transitions (`needs-permission`, `needs-decision`, `advance` to `planning`/`verification` with `needs-review`, `failed` error escalation, and `poll`).
  - Implemented `CoordinatorReconciler` class wrapper.
- `service/main.ts`:
  - Exported `task-claim`, `session-watcher`, and `reconciler` modules.
  - Wired `leaseStore` and periodic expired lease pruning to `CoordinatorService`.
- `test/stage2b-pilot-coordinator.test.js`:
  - Added Part 7 (Tests 18-21): Opt-in task eligibility filter and claiming engine.
  - Added Part 8 (Tests 22-27): Session liveness watcher state classification.
  - Added Part 9 (Tests 28-35): Lifecycle reconciler state transitions.

## Verification:
- All 35 Stage 2B tests passing cleanly.
- `npm run typecheck` passes with zero diagnostics.
- `npm run build:service` produces bundled ESM service `service/main.js`.
- Full project test suite `npm test` passes 448/448 tests green.
