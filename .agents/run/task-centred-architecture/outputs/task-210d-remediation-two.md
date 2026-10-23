# Task 210d Output: Second Remediation (ADV-2C-*)

## Status: completed

## Evidence:
- `npm run typecheck`: PASS (0 errors)
- `npm run build`: PASS (panel 610.6kb, service 29.7kb; `service/main.js` bundle rebuilt and committed, panel bundle unchanged)
- `node --test`: PASS — 463 / 463; `test/stage2b-pilot-coordinator.test.js` 49 / 49 (10 new regression tests, all red-first against the Task 210c probe failure modes)
- `npm test`: PASS — 462 / 462 (ADV-2C-10 discovery discrepancy, pre-existing)
- `node --check service/main.js`: PASS (shipped bundle Node-20 clean)
- Commit `656500b` on `feat/stage2b-pilot-coordinator`

## Per-finding resolution:
- **ADV-2C-01: RESOLVED** (tests: `reconcileTaskState polls without overwriting attention for non-completed sessions on verification tasks (ADV-2C-01)` — `failed`/`blocked-permission`/`blocked-question` on a `verification` task return `poll` with `needs-review` untouched; `reconcileTaskState releases done/archive and closed tasks for every liveness state (ADV-2C-01, ADV-2C-08)`). Terminal and awaiting-human guards now run BEFORE the liveness switch in `service/reconciler.ts`, so no liveness state can mutate a `done`/`archive`/closed task or overwrite a human attention flag. Attention can no longer flap as liveness alternates.
- **ADV-2C-02: RESOLVED** (test: `reconcileTaskState prefers live issue phase over stale lease phase (ADV-2C-02)` — issue `planning` + stale lease `execution` + completed session -> `poll`, not `advance` to `verification`; issue `execution` + stale lease `done` + completed session -> `advance`, not `release`). `currentPhase = issuePhase || leasePhase`: live issue metadata always outranks the lease's claim-time snapshot; the lease phase is a fallback only.
- **ADV-2C-03: RESOLVED** (tests: `Store backs up valid-JSON-but-wrong-shape files before reset (ADV-2C-03)` — `null`, `42`, `{"leases":null}` each backed up before reset; `Store backs up prior file on read errors before resetting state (ADV-2C-03)` — simulated `EIO` read failure preserves the valid prior file in a `.corrupted.<timestamp>.bak` before reset; `CoordinatorService.start() initializes lease store and preserves corrupted state forensically (ADV-2C-03)` — the shipped service now loads through `init()`, reproducing the 210c dead-code probe against `CoordinatorService` itself). Backups now trigger on ANY load failure (read error, `SyntaxError`, wrong shape) in both `init()` and `loadFromDisk()`.
- **ADV-2C-04: RESOLVED** (test: `computeIssueSha normalizes bare CR and mixed line endings to LF digests (ADV-2C-04)`; trailing-whitespace strictness: deliberate). `computeIssueSha` normalizes with `/\r\n?/g` covering `\r\n`, bare `\r`, and mixed endings. Trailing whitespace is deliberately NOT normalized: a false match there could clobber a real edit, while a false CAS conflict aborts safely (asserted in the same test).
- **ADV-2C-05: RESOLVED** (test: `reconcileTaskState does not discard open human decisions (ADV-2C-05)` — completed session + phase `execution` + `needs-decision`/`needs-permission`/`needs-review` -> `poll`, no advance, no attention mutation; also blocks re-escalation over an open decision). Any non-`'none'` attention means "await human" for every liveness state; `advance` is reachable only from `exploration`/`execution` with attention `'none'`.
- **ADV-2C-07: RESOLVED** (test: `Store never destroys prior state when the backup itself fails (ADV-2C-07)` — simulated `EACCES` on `copyFile`: `init()` resolves (no crash-loop), the failure is logged via `console.error`, the corrupted file stays byte-identical on disk, and subsequent writes are refused (`Refusing to overwrite lease store: ...`) until a backup succeeds). Never destroys prior state without a successful backup.
- **ADV-2C-08: RESOLVED** (tests: terminal test above covers `archive` in the guard so `archive` + completed no longer polls forever; `reconcileTaskState polls on missing or empty issue data instead of advancing (ADV-2C-08)` — null/empty/phase-less issues return `poll` / `No issue data` instead of defaulting to `advance` to `planning`). `planning -> execution` remains human-only (intended, unchanged).

## Test expectation changes (documented):
Two existing assertions encoded behavior the Task 210c findings now forbid; expectations legitimately changed (behavior changes, not loosened):
1. `reconcileTaskState respects phase from TaskLease when available` -> retitled `reconcileTaskState falls back to TaskLease phase when the issue carries no phase (ADV-2C-02 fallback)`: the fixture's issue phase was removed so the lease snapshot is exercised as fallback only. The old fixture (issue `draft` + stale lease `execution` -> `advance`) was exactly the ADV-2C-02 probe failure; the corrected expectation is covered by the new ADV-2C-02 regression test.
2. ADV-2B-01 idempotency test, tick 2 reason string `Awaiting human review` -> `Awaiting human verification` (the reason string specified by the Task 210d step 1 guard; action and semantics unchanged).

## Document-only residuals:
- **ADV-2C-06** (pre-existing): the test suite needs Node >= 22.18 / >= 23.6 for TypeScript type stripping (`.ts` runtime imports); the shipped `service/main.js` bundle is self-contained and Node-20 clean.
- **ADV-2C-09**: eligibility edges (`attention: ''` passes the attention guard but fails `isEligiblePhase`; `isExplicitV2: 'true'` string and top-level `isExplicitV2` rejected) — conservative direction (fewer claims), documented residual only.
- **ADV-2C-10** (pre-existing): `node --test` counts `test/test-app-harness.js` as a test (463) while `npm test`'s glob excludes it (462).

## Not advanced (unchanged, out of scope):
- ADV-2B-03 (cross-process concurrency), ADV-2B-05 (in-memory drift on disk failure), ADV-2B-08 (clock skew).
