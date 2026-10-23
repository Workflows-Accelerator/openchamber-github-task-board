# Task 210b Output: Hostile Conditions Remediation

## Status: completed

## Evidence:
- `npm run typecheck`: PASS (0 errors)
- `npm run build`: PASS (panel 610.6kb, service 26.9kb)
- `node --test test/stage2b-pilot-coordinator.test.js`: PASS (39/39)
- `node --test`: PASS (453/453)
- Commit `d6050be` on `feat/stage2b-pilot-coordinator`

## Remediated Findings:
- **ADV-2B-01** (Idempotency): `reconcileTaskState` now guards against double-advance — `done` -> release, `verification`/`needs-review` -> poll, only `exploration`->`planning` and `execution`->`verification` advance.
- **ADV-2B-02** (CRLF Normalization): `computeIssueSha` normalizes `\r\n`->`\n` before SHA-256 digest. Duplicated function removed from `task-claim.ts`; imports from `cas.ts`.
- **ADV-2B-04** (Opt-In Scoping): `isTaskEligibleForPilot` requires `hasPilotLabel || (isEligiblePhase && isExplicitV2 === true)`. Legacy `status:in-progress` issues rejected.
- **ADV-2B-06** (Corrupted Store Backup): `init()` copies corrupted `leases.json` to `.corrupted.<timestamp>.bak` before reset.
- **ADV-2B-07** (Deduplication): 140-line private `inspectSession` removed from `reconciler.ts`; imports `inspectSessionLiveness` from `session-watcher.ts`.

## New Tests (4 added, 39 Stage 2B total):
- CRLF/LF digest equality
- Reconciliation idempotency (tick 1 advance -> tick 2 poll -> tick 3 release)
- Legacy task rejection
- Corrupted file forensic backup

## Changes:
- service/cas.ts — CRLF normalization in computeIssueSha
- service/task-claim.ts — import from cas.ts, explicit opt-in eligibility
- service/reconciler.ts — deduplication, idempotency guard
- service/lease-store.ts — corrupted file forensic backup
- test/stage2b-pilot-coordinator.test.js — 4 new tests
- tsconfig.json — allowImportingTsExtensions + noEmit (required for .ts cross-file imports under Node type stripping)
- service/main.js — rebuilt bundle

## Learning:
- Node.js type stripping cannot resolve `./cas.js` to `cas.ts` at runtime; used `.ts` extensions in runtime cross-file imports + `allowImportingTsExtensions: true` in tsconfig.

## Not advanced (per PROCEED-WITH-CONDITIONS scope):
- ADV-2B-03 (cross-process concurrency), ADV-2B-05 (in-memory drift on disk failure), ADV-2B-08 (clock skew)
