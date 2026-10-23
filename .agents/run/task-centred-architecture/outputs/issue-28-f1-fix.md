# F1 fix — admission cap and eviction under a large incremental scan (issue #28)

**Task:** close the gating F1 from the independent hostile review of `8625b0a`: the admission-record cap (400) was below one incremental scan (`MAX_ISSUES_PER_REPO` = 1000) and eviction ignored pending writes, so a 500-issue scan during a paged refresh could evict its own admissions and a successful in-flight edit.
**Branch:** `fix/issue-28-current-board`. **Commit:** `74038a3` (`fix(panel): keep issue tracker cap above one incremental scan (#28)`), parent `e3fb381`.
**Changed:** `panel/main.ts`, generated `panel/main.js`, `test/current-board.test.js` only.
**Identity:** supplied and actual model Engineer, provider/model `9router/engineer`.
**Timestamp:** 2026-10-23.

## Chosen bound and eviction rule

- **Soft cap `MAX_ISSUE_WRITE_TRACKERS = MAX_ISSUES_PER_REPO * 2` = 2000.** One scan admits at most 1000 changed issues (`panel/core.ts:3985`, `4093`, `4139-4144`); 2000 holds the current scan plus one concurrent scan. The previous 400 was less than half a single scan.
- **Pinned records are never evicted.** A record is pinned when any group has `pending > 0`, or when its latest write is newer than the start of the only publication that can still commit (the newest `fetchIssues` epoch for that same repository). Pending writes and settled admissions that an older snapshot could still overwrite therefore survive cap pressure.
- **Eviction is oldest-first among unpinned records only.** `trimIssueWriteTrackers` sorts unpinned keys by `latestWriteTime` and deletes exactly the excess. Ties keep insertion order (stable sort).
- **Protected overflow.** If every remaining record is pinned, the map is allowed above the soft cap; nothing pinned is dropped.
- **Hard ceiling `MAX_ISSUE_WRITE_TRACKERS_HARD = MAX_ISSUES_PER_REPO * 4` = 4000.** At the hard ceiling the older in-flight publication is abandoned (`obsoleteIssueSnapshotEpochs`) and the map is trimmed to the soft cap. Publication, streaming and the first-page path all check the abandoned epoch and leave freshness `stale` instead of publishing. This keeps correctness and bounds memory: pending records are still never evicted, and only settled records whose protecting publication has been abandoned are dropped.
- **TTL.** Five-minute expiry is unchanged, except a record still needed by a live in-flight publication is not expired until that publication ends; `pruneIssueWriteTrackers()` now also runs on write settlement, at publication and in the fetch `finally`, so stale records expire promptly after protection ends.
- **Keys.** `issueWriteKey` is unchanged: lower-cased `repo#number`, so repository and issue keys still cannot collide. No new storage or timers; the tracker state remains in memory only.
- **Repo scope.** Snapshot starts are keyed by fetch epoch and repository; only the active non-all-projects publication pins records for its own repository. A repository switch cannot pin records for the new repo.

## Why the reviewer's proposed minimum was insufficient

The review proposed "raise the cap to at least 1000 and never evict `pending > 0`". Simulating one further step shows that is not enough: two scans can admit 2000 settled records for the same repository while one older publication is in flight. With a 1000 cap the oldest settled records — including a *successful*, no-longer-pending edit — are evicted and then clobbered by the older publication. Regression 19 is exactly that case (an already-settled edit plus 2000 protected admissions). The implemented alternative keeps the larger 2×scan cap and, more importantly, treats settled admissions as pinned while a publication that started before them can still commit, with the hard-ceiling abandonment as the bounded overflow behaviour.

## Regressions added (`test/current-board.test.js`)

1. `a 500-issue incremental scan cannot evict an in-flight edit before an older full snapshot` — paged full refresh in flight, 500-issue incremental, pending body edit. Asserts the edit is still shown after admissions, after the older publication publishes, and after the PATCH settles.
2. `a pending write is never evicted under tracker cap pressure` — pending edit, 2000 admissions, then an older publication. Asserts the pinned edit survives both cap pressure and publication, and the cache (publication membership is small here, so the host storage limit is not hit).
3. `an overflow of protected tracker records does not clobber a successful edit` — settled edit plus 2000 admissions admitted after the refresh started (2001 > soft cap, all pinned), then the older publication. Asserts the edit survives.

All three observe user-visible board state on the shipped bundle. The 500/2000-issue fixtures exceed the host's 64 KB per-key storage limit, so the first and third tests assert displayed state; persistent cache is asserted for the second test and by the pre-existing R1 tests. This is a synthetic-host limit, not an F1 behaviour.

## Red-first

On `8625b0a` (old source and old bundle, new test file), `node --test test/current-board.test.js` exits 1: 16 pass, the three new tests fail on the F1 assertions (`/tmp/opencode/f1-red.log`):
- test 17: `an older full snapshot must not undo the edit after cap pressure` → `old body`;
- test 18: `the pending edit survives the older publication` → `old body`;
- test 19: `protected overflow must keep a settled edit through an older publication` → `old body`.

After the fix the same file is 19/19 green.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0; `git status --short` empty; `cmp` bundle vs `HEAD:panel/main.js` matches |
| Current board | `node --test test/current-board.test.js` | exit 0, 19 pass, 0 fail |
| Red-first | checkout `8625b0a` `panel/main.ts`/`panel/main.js`, run current-board | exit 1, 16 pass, 3 fail (F1 only) |
| Full suite | `npm test` | exit 0, 485 pass, 0 fail/skipped (`/tmp/opencode/f1-suite.log`) |
| Hygiene | `git diff --check` | exit 0 |
| Hard-ceiling probe | `node /tmp/opencode/f1-hard.mjs` | exit 0; 5 scans / 5001 issues, edit survives, publication abandoned, freshness `stale` (`/tmp/opencode/f1-hard.log`) |

## Residual risk

- The hard ceiling is exercised by a synthetic probe, not a committed regression, to keep the committed addition to the three requested cases. It requires five full scans for one repository while a single refresh is stalled; after it fires the older refresh is intentionally abandoned and the board stays stale until the next full refresh succeeds.
- F2 (creation during refresh), F3 (archive/tag/priority/complexity/status-none label surfaces), F4 (TTL vs very long refresh; narrowed but not removed), F5 (older status-write failure), F6 (failed body save pinned for the in-flight refresh) are unchanged and remain separate, as the review recommended.
- L3/L5 remain NOT RUN / AWAITING HUMAN. All evidence is recording-host/unit level on the shipped bundle; no credential, live GitHub request, installed-host activation, push, merge or deploy.

**Machine verdict:** F1 remediation complete on the shipped bundle; ready for bounded independent re-review.
