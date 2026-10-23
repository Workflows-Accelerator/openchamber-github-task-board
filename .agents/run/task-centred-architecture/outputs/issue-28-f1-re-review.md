# Independent hostile re-review — 74038a3 (issue #28 F1 remediation)

**Task:** Bounded re-review: decide whether `74038a3` closes F1 from the hostile review of `8625b0a` without introducing new correctness, memory, or membership defects; evaluate hard ceiling and eviction predicates; confirm regression surface; grade for integration.
**Reviewed:** commit `74038a3` (fix), parent `e3fb381`, delta against `8625b0a`, branch HEAD `df0d324` (docs only).
**Files under review:** delta `8625b0a..74038a3` in `panel/main.ts`, `panel/main.js`, `test/current-board.test.js`, and `.agents/run/task-centred-architecture/outputs/issue-28-f1-fix.md`.
**Identity:** supplied and actual model Engineer, provider/model `9router/engineer`. Independent session; competing worktree `.worktrees/team-dev-issue-28-review-races` not accessed.
**Timestamp:** 2026-10-23.

---

## Verdicts

| Verdict | Result |
| --- | --- |
| F1 closure | **CLOSED** (verified independently on shipped bundle in display and cache) |
| Hard-ceiling & eviction safety | **PASS** (memory bounded at 4000; publication safely abandoned without wedging) |
| Quality | **APPROVED** |
| Machine verdict | **PROCEED** (clear for batched integration / L5 human validation) |

The repair at `74038a3` cleanly and comprehensively resolves gating finding F1. It does not introduce any new defect or regress previously verified invariants.

---

## Findings

### F1 — Closed (was Moderate on 8625b0a)

**Prior anchor:** `panel/main.ts:1440-1473`.
**Repair anchors:** `panel/main.ts:1444-1528` (soft cap 2000 = `MAX_ISSUES_PER_REPO * 2`, hard ceiling 4000 = `MAX_ISSUES_PER_REPO * 4`, pinning predicate `issueRecordIsPinned`, unpinned oldest-first trim, and epoch abandonment `obsoleteIssueSnapshotEpochs`), `1530-1558`, `1640-1647`, `1673-1710`, `1724-1730`, `1805-1815`.

1. **Eviction and Pinning Correctness:**
   - Soft cap `MAX_ISSUE_WRITE_TRACKERS = 2000` accommodates two full 1000-issue incremental scans (`MAX_ISSUES_PER_REPO`) concurrently without evicting freshly admitted keys.
   - `issueRecordIsPinned(key, groups)` pins any tracker with `tracker.pending > 0` (unresolved user writes) and any settled record where `latestWriteTime(groups) > publishableIssueSnapshotStart(repo)`.
   - `publishableIssueSnapshotStart(repo)` keys strictly to the active stream epoch for that repository (`entry.repo.toLowerCase() === repo.toLowerCase()`). A repository switch unpins previous-repo settled records for snapshot protection while keeping pending writes pinned.
   - Pinned records are explicitly skipped during `trimIssueWriteTrackers`: `if (issueRecordIsPinned(key, groups)) continue`. They cannot be evicted under soft-cap pressure.
   - In `pruneIssueWriteTrackers()`, TTL expiry ignores records where `tracker.pending > 0` or where `neededNow = start !== null && tracker.time > start`. Once the in-flight snapshot terminates, `issueSnapshotStarts.delete(epoch)` runs in `fetchIssues`'s `finally` block, allowing expired records to be reclaimed on the next prune.

2. **F1 Scenario Independent Reproduction:**
   - Independent probe `/tmp/opencode/f1-rereview-probe.mjs` (`S1`, `S1b`):
     - `S1`: Paged full refresh in flight + 500-issue incremental scan + concurrent in-flight body edit on issue 1. The edit survived through admissions, survived the older snapshot completion, and survived PATCH settlement in the displayed board state.
     - `S1b`: In-flight edit + incremental scan sized within the host's 64 KiB storage value ceiling (`GUEST_STORAGE_VALUE_BYTES = 65536`). Persistent cache `cached_issues_owner/a` preserved the edit both before and after snapshot publication.
   - Probe `S2`: Settled edit followed by two 1000-issue scans (2000 admissions, overflow > 2000 soft cap). The older settled edit survived the snapshot publication without clobbering.

3. **Hard Ceiling Evaluation:**
   - When tracker map exceeds `MAX_ISSUE_WRITE_TRACKERS_HARD = 4000`, `obsoleteIssueSnapshotEpochs.add(activeStreamEpoch)` marks the in-flight publication obsolete and trims unpinned records to 2000.
   - Aborting the publication is safe and honest: `publishIssueSnapshot` renders freshness as `'stale'`, leaves board membership and fields untouched, and does not advance sync timestamps or watermarks.
   - In `streamRemainingPages` and `fetchIssues`, multiple checkpoints check `obsoleteIssueSnapshotEpochs.has(epoch)` and exit early.
   - The board is not wedged in stale: when the aborted fetch completes, `obsoleteIssueSnapshotEpochs.delete(epoch)` cleans up in `finally`. The subsequent fetch runs under a new epoch and recovers freshness to `'complete'` (`S3` probe verified).
   - Memory is strictly bounded: no growth past 4000 entries.

4. **Evaluation of Author's Claim vs Reviewer Proposal:**
   - The hostile review proposed: "raise cap to 1000 and never evict `pending > 0`".
   - The repair author claimed this minimum was insufficient because two scans (or one scan + one settled edit) could admit settled records while a refresh is in flight; a 1000 cap would evict the settled edit once its PATCH resolved (`pending === 0`).
   - Ruling: **The author's claim is mathematically and empirically correct.** Test 19 and probe `S2` prove that if only `pending > 0` were pinned, settled user edits and earlier incremental admissions would be evicted by subsequent incremental scans before an older stalled snapshot completes. Protecting `latestWriteTime > start` correctly closes this second-order race.

### F2–F6 Residuals Confirmation

- **F2 (issue created during refresh dropped):** Unchanged, pre-existing; remains separate follow-up outside #28 scope.
- **F3 (label/archive write surfaces unwired):** Unchanged, pre-existing; remains separate follow-up outside #28 scope.
- **F4 (TTL vs stalled refresh > 5 min):** Materially narrowed by `neededNow` check (records needed by in-flight refresh outlive 5 min TTL until fetch ends); residual edge cases outside #28 scope.
- **F5 (failure of older status write reverts newer retry):** Unchanged, pre-existing; remains separate follow-up outside #28 scope.
- **F6 (failed body edit pinned during crossing refresh):** Unchanged, pre-existing design caveat; remains outside #28 scope.

---

## Red-First Confirmation (Independent)

Reverted `panel/main.ts` and `panel/main.js` to `8625b0a`, rebuilt, and ran `node --test test/current-board.test.js`:
- Tests 1–16: **PASS**
- Tests 17–19 (the 3 F1 regressions): **FAIL** (exit 1; `/tmp/opencode/f1rr-red.log`):
  - Test 17 (500-issue scan + pending edit): `AssertionError: 'old body' !== 'in-flight user edit'`
  - Test 18 (2000 admissions + pending edit): `AssertionError: 'old body' !== 'pending edit survives'`
  - Test 19 (overflow of protected admissions + settled edit): `AssertionError: 'old body' !== 'protected edit'`
- Restored `HEAD` (`74038a3`), rebuilt, confirmed byte-identical to `HEAD:panel/main.js`.
- All 19 tests in `test/current-board.test.js` pass on `74038a3`.

---

## Regression Surface Verification

1. **Repository Switch:** Switched between `owner/a` and `owner/b` during in-flight edit and refresh; verified repo B displays only its own issues, cache A is not polluted, and superseded A response does not commit (`S5` probe, test 3).
2. **Empty Snapshot Deletion:** Authoritative deletion on empty repository verified (`verify-regressions.mjs`, test 1).
3. **Superseded Refresh:** Slower older fetch cannot publish over newer completed fetch (`verify-regressions.mjs`, test 4).
4. **Watermark Monotonicity:** `repoSyncWatermarks` never regresses below admitted incremental coverage (`verify-regressions.mjs`, test 12).
5. **Failed-PATCH Release:** Failed optimistic edit reverts and later refresh restores server truth (`verify-regressions.mjs`, test 15).
6. **Core Red-First Races:** R1 body edit, R1 status edit, and R2 incremental fields verified green (`verify-regressions.mjs`, tests 10, 11, 12).
7. **Adversarial Fuzzing:**
   - `/tmp/opencode/r28v2-fuzz.mjs 100`: exit 0, 100 seeds passed, 0 failures (`/tmp/opencode/f1rr-fuzz100.log`).
   - `/tmp/opencode/r28v2-fuzz2.mjs 30` (chaos fuzz with PATCH failure & repo switch): exit 0, 30 seeds passed, 0 failures (`/tmp/opencode/f1rr-fuzz2-30.log`).

---

## Executed Evidence Summary

| Step | Command | Result |
| --- | --- | --- |
| L0 Static Typecheck | `npm run typecheck` | exit 0 |
| L0 Build & Bundle Parity | `npm run build && cmp -s panel/main.js <(git show HEAD:panel/main.js)` | exit 0; byte-identical to HEAD |
| L1 Targeted Regressions | `node --test test/current-board.test.js` | exit 0, 19 passed, 0 failed |
| L1 Full Test Suite | `npm test` | exit 0, 485 passed, 0 failed, 0 skipped |
| Red-first | Revert `main.ts`/`main.js` to `8625b0a`, rebuild, run `current-board.test.js` | exit 1 (16 pass, 3 fail on F1 assertions) |
| Independent Probe | `node /tmp/opencode/f1-rereview-probe.mjs` | exit 0, 30 checks passed, 0 failed |
| Regression Checks | `node /tmp/opencode/verify-regressions.mjs` | exit 0, all regression checks passed |
| Adversarial Fuzz | `node /tmp/opencode/r28v2-fuzz.mjs 100` | exit 0, 100/100 seeds passed |
| Chaos Fuzz | `node /tmp/opencode/r28v2-fuzz2.mjs 30` | exit 0, 30/30 seeds passed |
| Hygiene | `git diff --check` | exit 0 |

---

## Boundaries & Integration Recommendation

- All evidence is shipped-bundle / recording-host execution (L0/L1/L4).
- In accordance with team policy, L3 installed-host testing and L5 human validation remain **AWAITING HUMAN**.
- F1 is completely closed. No standing blockers remain on branch `fix/issue-28-current-board`.
- **Recommendation:** Proceed to merge `fix/issue-28-current-board` into the integration branch for batched human review (L5).
