# Task 210b Output: Hostile Conditions Remediation

## Status: completed

## Evidence:
- **Typecheck:** `npm run typecheck` PASS (0 errors)
- **Bundle builds:** `npm run build` PASS (panel/main.js 610.6kb, service/main.js 26.9kb)
- **Full test suite:** `node --test` 453/453 PASS (100%, 0 failures, 0 skipped)
- **Stage 2B suite:** `node --test test/stage2b-pilot-coordinator.test.js` 39/39 PASS
- **Commit:** `d6050be` on `feat/stage2b-pilot-coordinator`

## Remediated Findings:

### ADV-2B-01 (Reconciliation Idempotency): RESOLVED
- `service/reconciler.ts`: `reconcileTaskState` now guards against double-advance. When a completed session is encountered:
  - `phase: 'done'` (issue or lease) returns `{ action: 'release', reason: 'Task is complete' }`.
  - `phase: 'verification'` (issue or lease) or `attention: 'needs-review'` returns `{ action: 'poll', reason: 'Awaiting human review' }`.
  - `phase: 'exploration'` advances to `planning` + `needs-review`.
  - `phase: 'execution'` advances to `verification` + `needs-review`.
- Test: `Part 9: reconcileTaskState is idempotent: tick 1 advances execution to verification, tick 2 polls (ADV-2B-01)`.

### ADV-2B-02 (CRLF Normalization): RESOLVED
- `service/cas.ts`: `computeIssueSha` now normalizes `\r\n` to `\n` before SHA-256 digest computation: `(body ?? '').replace(/\r\n/g, '\n')`.
- `service/task-claim.ts`: Removed duplicated `computeIssueSha` definition; imports from `./cas.ts`.
- Test: `Part 2: computeIssueSha normalizes CRLF and LF newlines to identical digests (ADV-2B-02)`.

### ADV-2B-04 (Explicit Opt-In Scoping): RESOLVED
- `service/task-claim.ts`: `isTaskEligibleForPilot` now requires `hasPilotLabel || (isEligiblePhase && isExplicitV2 === true)`. Legacy issues with only `status:in-progress` are strictly rejected.
- Tests: `Part 7: isTaskEligibleForPilot correctly identifies eligible tasks with explicit opt-in (ADV-2B-04)` and `Part 7: isTaskEligibleForPilot strictly rejects legacy and un-migrated tasks (ADV-2B-04)`.

### ADV-2B-06 (Corrupted Store Backup): RESOLVED
- `service/lease-store.ts`: `init()` now backs up corrupted JSON files to `${filePath}.corrupted.${Date.now()}.bak` via `fs.promises.copyFile` before resetting state.
- Test: `Part 6: Store backs up corrupted disk file to .corrupted.<timestamp>.bak on init (ADV-2B-06)`.

### ADV-2B-07 (Session Inspection Deduplication): RESOLVED
- `service/reconciler.ts`: Removed 140-line private `inspectSession` function. Now imports `inspectSessionLiveness` from `./session-watcher.ts`.

## Files Changed:
- `service/cas.ts` — CRLF normalization in `computeIssueSha`
- `service/task-claim.ts` — import from `cas.ts`, explicit opt-in eligibility
- `service/reconciler.ts` — deduplication, idempotency guard
- `service/lease-store.ts` — corrupted file forensic backup
- `test/stage2b-pilot-coordinator.test.js` — 4 new tests (ADV-2B-01, ADV-2B-02, ADV-2B-04, ADV-2B-06)
- `tsconfig.json` — `allowImportingTsExtensions: true`, `noEmit: true` (required for `.ts` cross-file imports in service modules loaded by Node.js type stripping)
- `service/main.js` — rebuilt bundle
