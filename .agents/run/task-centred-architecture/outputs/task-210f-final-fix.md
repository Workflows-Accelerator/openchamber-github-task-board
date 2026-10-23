# Task 210f Output: Final Fix Round

## Status: completed

## Evidence:
- `npm run typecheck`: PASS (0 errors)
- `npm run build`: PASS (`service/main.js` 31.3kb rebuilt; `panel/main.js` byte-identical — no diff)
- `node --test`: PASS — 467 / 467 (463 pre-existing + 4 new, zero regressions)
- `node --check service/main.js`: PASS
- Red-first confirmation: the 4 new tests failed BEFORE the fix for the expected reasons (2x AssertionError on missing `.corrupted.*.bak` backup, 2x TypeError on the missing service acquire/release capability), then passed after.
- Commit SHA on `feat/stage2b-pilot-coordinator`: `a09115c` — `fix(service): reject array lease shapes and release held leases on shutdown (ADV-2E-01)`
- Files changed: `service/lease-store.ts`, `service/main.ts`, `service/main.js` (rebuilt bundle), `test/stage2b-pilot-coordinator.test.js`

## Per-fix resolution:
- **ADV-2E-01: RESOLVED** — `LeaseStore` shape validation now requires `leases` to be a plain object (`typeof x === 'object' && x !== null && !Array.isArray(x)`, shared helper `isPlainLeasesMap`) in BOTH load paths (`init()` and `loadFromDisk()`), so `{"leases":[]}` / `{"leases":[{...}]}` take the forensic-backup path before reset and are never re-keyed to numeric keys or silently overwritten.
  - Tests: `Part 6: Store treats array-valued leases as wrong shape and backs up before reset (ADV-2E-01)` (init path, both array variants: byte-identical `.corrupted.<timestamp>.bak` created, store reset to `{version:1, leases:{}}`, no re-keyed entries) and `Part 6: loadFromDisk rejects array-valued leases and never re-keys entries to "0" (ADV-2E-01)` (mutation-triggered `loadFromDisk` path: array payload backed up byte-identical before overwrite, prior legit lease survives, on-disk keys exactly `['org/repo#1','org/repo#2']` — no `'0'` key).
- **releaseHeldLeases dead stub: RESOLVED** — `CoordinatorService` now has a per-instance `ownerId`, a public `acquireLease(...)` that acquires through the store and tracks the lease in `heldLeases`, and a `releaseHeldLeases()` that actually calls `leaseStore.releaseLease(...)` for every tracked lease plus any store lease still owned by this instance (ownerId match), then clears local bookkeeping. SIGINT/SIGTERM shutdown via `stop()` therefore releases held leases immediately; other owners' leases are never touched (single-writer safety).
  - Tests: `Part 6: CoordinatorService releases held leases on shutdown instead of waiting for TTL (PLAN-STAGE2B invariant 4)` (service-path acquire, `stop()`, `getLease()` returns null immediately despite a 600s TTL, released lease gone from disk) and `Part 6: shutdown releases same-owner store leases but never another owner's lease` (same-owner lease acquired outside bookkeeping is released via the ownerId sweep; `other-worker`'s lease survives).

## Documented residuals (NOT fixed, by design):
- **ADV-2E-02** (Low): refused writes mutate in-memory state before throwing (phantom lease / extended `expiresAt` / deleted-in-memory lease in corrupt-plus-unbackupable state only; TTL-bounded).
- **ADV-2E-03** (Low): forensic backup name is `.corrupted.<Date.now()>.bak` only (same-millisecond collision overwrites the earlier copy; transient read errors on valid files also create `.corrupted.*` backups, unbounded growth while the fault persists).
- **ADV-2E-04** (Low): `loadFromDisk` reports a `SyntaxError` as `read error (unknown)` in its log/backup reason (cosmetic).
- **ADV-2E-05** (Low): `CoordinatorService.start()` fails hard when the `init()` reset write fails after a successful backup (deliberate startup-availability change, no change requested).
- **ADV-2C-06, ADV-2C-09, ADV-2C-10** (prior residuals): unchanged — ADV-2C-10 is the known `npm test` (462) vs `node --test` (463→467) test-discovery discrepancy.
- **ADV-2B-03, ADV-2B-05, ADV-2B-08** (prior residuals): unchanged.

## Notes:
- Scope held to the two fixes: shape-check predicate (+ shared helper) in `service/lease-store.ts`; ownerId/tracked-lease bookkeeping and the real release in `service/main.ts`; 4 regression tests. No other refactors.
- `releaseHeldLeases` wraps each release in try/catch and logs failures rather than aborting shutdown mid-way; bookkeeping is cleared after the release pass as specified.
