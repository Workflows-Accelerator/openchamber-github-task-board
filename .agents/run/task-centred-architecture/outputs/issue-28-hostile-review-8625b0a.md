# Independent hostile review — 8625b0a (issue #28 review-race fix)

**Task:** falsify or confirm that `8625b0a` closes the two reviewed #28 races (R1 body/status edit vs older full response, R2 incremental vs older full snapshot/watermark) without new correctness, memory or membership defects; grade for integration.
**Reviewed:** base `88d3970`, code change `8625b0a`, branch HEAD `658e970` (docs only on top).
**Identity:** supplied and actual model Engineer, provider/model `9router/engineer`. Independent session; the competing worktree `.worktrees/team-dev-issue-28-review-races` was not read.
**Timestamp:** 2026-10-23.

## Verdicts

| Verdict | Result |
| --- | --- |
| Spec vs issue #28 acceptance criteria | **PASS** (all five criteria verified; see mapping) |
| Reviewed-race closure | **PARTIAL** — R1 normal, in-flight and failure paths PASS; R2 PASS up to 400 concurrent admissions, **recurrence above the cap (F1)** |
| Quality | **NEEDS-FIXES** |
| Machine verdict | **PROCEED-WITH-CONDITIONS** — F1 fixed with a regression before any integration/L5 batch; F2/F3 are separate follow-up issues |

The fix is directionally correct and materially better than `88d3970`. It is not ready to integrate as-is because the new 400-key cap is reachable by a single legal incremental scan and, once exceeded, silently reverts both fields and membership protection (F1).

## Findings

Severity: Critical / High / Moderate / Low. "Proven" means reproduced on the shipped bundle with a command below.

### F1 — Moderate (proven, introduced by 8625b0a): admission cap is below one incremental scan and eviction ignores pending writes

**Anchors:** `panel/main.ts:1440-1442` (TTL 5 min, cap 400, map), `1459-1473` (prune + oldest-first eviction, no `pending` check), `1493-1505` (`finishWrite` cannot re-register an evicted key), `1521-1529` (protection test), `1587-1601` (publication), `1951-1959` (admission of every changed incremental issue).

`syncIncrementalRepoIssues` may return up to `MAX_ISSUES_PER_REPO = 1000` changed issues (`panel/core.ts:3985`, `4093`, `4139-4144`). One such scan calls `admitIssueRecord` for every fresh object (`panel/main.ts:1956-1958`). With 500 changed issues and a paged full refresh in flight:

- `issueWriteTrackers` grows past 400; the cap evicts the oldest 100 keys (`1467-1473`), which are 100 of the admissions just made.
- A later older full snapshot then overwrites those issues' fields and can drop newly created members; the cache is written with the older values.
- Eviction also removes keys with `pending > 0`, so a **successful in-flight user edit is clobbered** while its PATCH is unresolved. `finishWrite(true)` cannot restore the deleted key because it only mutates the detached group map (`1493-1505`).

Reproduced:

```
node /tmp/opencode/r28v2-probe.mjs s3_cap
S3 CAP: issue1='incremental new' issue400='incremental new' issue500='old body' count=500
S3 DEFECT admissions beyond cap 400 are evicted and clobbered by the older full snapshot

node /tmp/opencode/r28v2-probe.mjs s3b_pendingEvicted
S3b CAP+PENDING: issue500='old body' (expected 'user in-flight edit')
S3b DEFECT cap eviction ignores pending writes and clobbers a successful in-flight edit
```

Observed eviction order: oldest `time` first (ties: insertion order of the merged result, which `mergeIssuePages` sorts by descending issue number). So with a single descending scan the highest-numbered 100 admissions go first; pending records are eligible. Both display and `cached_issues_owner/a` hold the clobbered values. Reachability: >400 issues changed since the last idle sync (mass close/relabel/import) plus an overlapping full refresh; a user edit concurrent with that scan loses its published value until a later completed full refresh. No GitHub write is lost.

**Minimum concrete remediation:** make the cap unable to drop a record that can still matter. Concretely: raise `MAX_ISSUE_WRITE_TRACKERS` to at least `MAX_ISSUES_PER_REPO` (1000) so one scan cannot evict its own admissions, and never evict keys with `pending > 0` (skip them; evict settled oldest). Add one regression: paged full refresh in flight + 500-issue incremental + in-flight body edit on a key that would previously be evicted, asserting displayed and cached edit survive. Longer term, a per-repo incremental admission watermark would remove the per-issue cap dependency entirely.

### F2 — Moderate (proven, pre-existing, separate issue): an issue created during a refresh is dropped by the older publication

**Anchors:** `panel/main.ts:7738-7764` (`submitNewIssue` merges locally, no admission record; second creator path `7077-7100`), `1587-1601` (publication replaces membership), `1580-1583` (only protected local rows survive).

```
node /tmp/opencode/r28v2-probe.mjs s7_creation
S7 CREATION: visible before publication=true; after=[1]; cache=[1]
S7 DEFECT issue created during refresh is dropped from board and cache (unwired creation path)
```

Same on `88d3970` (pre-existing). Ruling: **separate follow-up**, not a `8625b0a` regression and outside the literal acceptance text (the criteria require editing controls to stay *available*; they do). It is the same class as R2 membership, so it should be filed as an issue and wired to the admission helper.

### F3 — Moderate (proven, pre-existing, separate issue): label/archive write surfaces still lose to an older refresh

**Anchors:** archive `panel/main.ts:2408-2412`; tag add/remove `5845-5847`, `5873-5875`; drawer priority `8607-8610`; drawer status `none` `8637-8639`; complexity `8665-8668`. None calls `trackIssueWrite`.

```
node /tmp/opencode/r28v2-probe.mjs s5_archive
S5 ARCHIVE: before refresh={"state":"closed","labels":["archived","status:draft"]}; after={"state":"open","labels":[]} cache={"state":"open","labels":[]}
S5 DEFECT archive edit undone by older full response (unwired write path)

node /tmp/opencode/r28v2-probe.mjs s6_priority
S6 PRIORITY: before=["priority:high"] after=[]
S6 DEFECT priority label edit undone by older full response (unwired write path)
```

Same on `88d3970`. The builder disclosed these paths. Ruling: **separate follow-up**, outside the accepted R1 anchors (`updateIssueBody`, `updateIssueStatus`, incremental admission) and outside #28's literal criteria. The helper is reusable, so the follow-up is small.

### F4 — Low (proven): TTL expiry can still clobber a successful edit during a very slow refresh

**Anchors:** `panel/main.ts:1440`, `1459-1466`, `1526`.

Expiry is lazy (only pruned inside `trackIssueWrite`/`admitIssueRecord`), so a record survives past 5 minutes unless another write or admission runs. When one does, a refresh that started >5 minutes earlier can still be in flight and then publishes over the edit. Reproduced with a fake monotonic clock (`S2`): issue 1 body reverted to `old body` in board and cache after its record was pruned; issue 2's newer record survived. Requires a refresh lasting >5 minutes (rate-limit backoff/retries) plus another write. Pre-existing outcome on `88d3970` was worse (everything clobbered), so this is a designed bound, not a regression. Consider pruning at publication (`protectedIssueGroups`) or a per-repo admission watermark if the bound must disappear.

### F5 — Low (proven, pre-existing): failure of an older status write reverts a newer successful retry

**Anchor:** `panel/main.ts:2256-2266`.

Two moves of the same issue, the older PATCH fails after the newer succeeded: the failure revert restores the older `prevState`/`prevLabels` and wipes the newer `status:in-progress`. Reproduced (`S4`): after newer success `open/status:in-progress`, after older failure `open/[]`. Identical on `88d3970`, so not introduced; the new `findIssueRecord` revert widens it to the published record. Low: concurrent same-issue moves only, server state still correct, next refresh repairs.

### F6 — Low (proven, design caveat): a failed body save stays pinned for the in-flight refresh

**Anchors:** `1500-1502` (record kept when the write started after the refresh did), `2168-2200` (body failure does not revert the optimistic text).

The builder report says failure drops the record; it only drops it relative to refreshes that start after the write. A refresh already in flight keeps the failed draft in board and cache until a later full refresh starts (`CROSSING-FAIL`). Defensible as "do not discard typed text", but the report's claim is imprecise and the error toast is the only signal. No action required for #28.

### Verified, not defects

- **Watermark:** `max(startedAt, existing)` is monotonic over real request starts; it cannot exceed wall clock in production and cannot permanently freeze fields. `S9` confirms no regression below an admitted incremental claim; subsequent full refreshes advance it. Backward clock jumps only extend protection (safe direction); forward jumps affect TTL as F4. Artificially future test watermarks are test-only.
- **Membership resurrection:** a row admitted during a refresh survives that publication; the next completed full snapshot removes it (`S8`: retention `[1,500]`, later full `[1]`, cache `[1]`). Retention is bounded by the next full refresh, not by the TTL timer, but it represents newer information than the snapshot and does not leak tracker state into storage.
- **Empty snapshot:** the existing "successful empty refresh clears membership" regression still passes (test 1) because no admissions exist; when a newer admission exists, keeping that row is the correct conflict resolution, not a violation.
- **Memory:** tracker map bounded (400 keys × ≤4 groups), no timers, no per-issue history list, no storage of tracker state. Pending records never TTL-expire but the cap still bounds the map; an exception between `trackIssueWrite` and its `try` block would pin a pending key until eviction — not proven reachable.
- **Repo scoping:** keys are `repo#number` lowercased; repo switch during an in-flight edit does not contaminate the new repo (`S11`: board `[2]`, cache B `[2]`, cache A `[1]`).
- **Refresh read-only:** all refresh tests assert GET-only; chaos fuzz counted mutating host calls equal to explicit PATCH attempts (0 extra).

## Red-first confirmation (independent)

Reverted only `panel/main.ts` and `panel/main.js` to `88d3970`, rebuilt, ran the committed tests:

```
git checkout 88d3970 -- panel/main.ts panel/main.js && npm run build   # exit 0
node --test test/current-board.test.js                                  # exit 1
# tests 16  pass 9  fail 7
```

Failures are exactly the 7 new tests, for the reviewed reasons (`/tmp/opencode/r28v2-red.log`): `new saved body` vs `old body`; `closed` vs `open`; `incremental new` vs `old body`; issue 500 `false !== true`; `crossing write` vs `old body`; `draft that fails` vs `old body`; `closed` vs `open`. Restored with `git checkout HEAD -- panel/main.ts panel/main.js` and rebuilt; `git status --short` clean and `cmp` confirms the bundle matches HEAD.

The same probes on the old bundle: R1 body/status and R2 fail; fuzz `seeds=20 failed=20` (`/tmp/opencode/r28v2-fuzz-old.log`) versus `seeds=100 failed=0` on `8625b0a`. The fuzz is therefore discriminating, not tautological.

## Adversarial fuzz

`/tmp/opencode/r28v2-fuzz.mjs` (100 seeds, exit 0, `FUZZ seeds=100 failed=0`, log `/tmp/opencode/r28v2-fuzz-100.log`): 120-issue repo, paged full refresh (100 + 20, page 2 deferred), random interleaving of body edits, status edits, in-flight PATCH acks crossing publication, incremental scans (including a new issue) and older snapshot completion. At each older publication it asserts, for every snapshot member: displayed body/state/labels equal the latest local write that started after the refresh or was pending, else snapshot values; membership keeps admitted new issues; persistent cache equals board fields and membership. It then performs an authoritative refresh started after all writes and asserts board equals server.

`/tmp/opencode/r28v2-fuzz2.mjs` (30 seeds, exit 0, `CHAOS-FUZZ seeds=30 failed=0`, log `/tmp/opencode/r28v2-fuzz2-30.log`): adds 30% PATCH failure, repository switch A↔B during a paged refresh, incremental scans per repo; asserts no cross-repository contamination in board or cache, convergence to server truth after a post-quiescence full refresh, and no unintended mutations.

Limits: body/status single-issue edits, no cap/TTL-scale seeds, no comments/labels/tag surfaces (those are F2/F3), harness-level only. The fuzz does not cover installed-host timing or real network reordering.

## Test quality

- Tests load the shipped bundle via `test/test-app-harness.js` (reads `panel/main.js`), so they exercise the artifact users get.
- Assertions are user-visible state (board issue objects, labels, cache key `cached_issues_owner/a`, watermark map), not private bookkeeping; they are not tautological (old bundle fails 7/7).
- Refresh read-only is asserted (`assert.equal(payload.method, 'GET')`) and PATCH counts are checked in the R1 test.
- Gaps: no cap/TTL boundary test; no concurrent-publication failure test (test 15 only proves release for refreshes started *after* the failure); no creation/label-surface durability; no repo-switch-plus-edit combination in the committed suite.
- No assertion was relaxed or deleted; 482-suite count is 475 prior + 7 new.

## Executed evidence (all on final tree)

| Step | Command | Result |
| --- | --- | --- |
| L0 typecheck | `npm run typecheck` | exit 0 (`/tmp/opencode/r28v2-typecheck.log`) |
| L0 build | `npm run build` | exit 0; `git status --short` empty; bundle byte-identical to HEAD (`/tmp/opencode/r28v2-build.log`) |
| L1 current board | `node --test test/current-board.test.js` | exit 0, 16 pass, 0 fail (`/tmp/opencode/r28v2-current-board-final.log`) |
| L1 full suite | `npm test` | exit 0, 482 pass, 0 fail/skip (`/tmp/opencode/r28v2-suite.log`) |
| Red-first | rebuild at `88d3970`, `node --test test/current-board.test.js` | exit 1, 9 pass, 7 fail (`/tmp/opencode/r28v2-red.log`) |
| L4 probes | `node /tmp/opencode/r28v2-probe.mjs all` | exit 0; R1/R2 core PASS, F1/F4/F5/F2/F3 reproduce (`/tmp/opencode/r28v2-probes-final.log`) |
| L4 core | `node /tmp/opencode/r28v2-core.mjs` | exit 0; R1 body/status/R2 `PASS` (`/tmp/opencode/r28v2-core-final.log`) |
| Fuzz | `node /tmp/opencode/r28v2-fuzz.mjs 100` | exit 0, 0 failed (`/tmp/opencode/r28v2-fuzz-100.log`) |
| Chaos fuzz | `node /tmp/opencode/r28v2-fuzz2.mjs 30` | exit 0, 0 failed (`/tmp/opencode/r28v2-fuzz2-30.log`) |
| Hygiene | `git diff --check` | exit 0 |

## Spec mapping (issue #28, OPEN, read via `gh issue view 28`)

1. *Opening requests current data even with the same repository selected* — PASS: existing startup regression (1 request, cached provisional text), unchanged and green.
2. *Completed full refresh removes absent issues including empty without discarding unseen later pages* — PASS: empty-refresh regression; page-two provisional/failure regressions; `S8` membership retention/removal. F1 can drop admitted rows only beyond the cap; F2 drops a newly created row (separate).
3. *Old-repository/superseded responses cannot change the new repository, cache or freshness* — PASS: A→B→A, overlapping refresh, superseded incremental tests; `S11`; 30-seed chaos fuzz.
4. *Failure/incomplete pagination preserves useful data and identifies stale/partial* — PASS: four existing failure/partial regressions unchanged.
5. *Refresh tests prove intended requests and display without unintended mutations; editing controls remain available* — PASS: GET-only assertions, explicit PATCH counts, body/status edits still work; chaos fuzz mutation count.

## Human validation (L5) and blind spots

L5 NOT RUN / AWAITING HUMAN. No integration branch, preview, merge, push or deployment performed. Not covered: installed-host authenticated requests and subscriptions, actual activation/remount, real GitHub response ordering/latency, narrow layout, focus retention, visual jank. L4 is AI grading AI and does not authorise merge.

## Recommendation

Do not send this commit to L5 yet. Fix F1 (cap ≥ maximum incremental scan, never evict pending, regression test), re-run the suite and this probe set, then integrate. File F2 (creation) and F3 (archive/tag/priority/complexity/status-none label writes) as separate issues; F4-F6 are documented residuals, not blockers.
