# Deep Verification Result

**Task:** Independent hostile review of issue #28, commit 29d1634 against 7013bd9
**Status:** FAIL
**Timestamp:** 2026-10-23
**Spec:** FAIL
**Quality:** NEEDS-FIXES
**Machine verdict:** HALT

### Executed Levels
- **L0 Static:** PASS. `npm run typecheck` exit 0; `npm run build` exit 0. Build left tracked status clean (byte-identical generated output). Logs `/tmp/opencode/issue28-review-typecheck.log`, `/tmp/opencode/issue28-review-build.log`.
- **L1 Unit:** PASS existing regressions: `npm test` exit 0, 475 passed, zero failures/skips; `node --test test/current-board.test.js test/d12-origins-cache.test.js test/v2-binding-and-ratelimit.test.js` exit 0, 23 passed, zero failures/skips. Logs `/tmp/opencode/issue28-review-suite.log`, `/tmp/opencode/issue28-review-targeted.log`.
- **L2 Integration:** NOT RUN against live host/GitHub; shipped bundle runs with synthetic recording boundary only.
- **L3 The User's Way:** NOT VERIFIED. Local Obscura fixture DOM evaluation ran, but screenshot blank and refresh unfinished; no installed-host or responsive/focus proof.
- **L4 Hostile Review:** FAIL: two unresolved Moderate concurrency findings, reproduced independently on shipped bundle.
- **L5 Human Validation:** AWAITING HUMAN; no integration branch/preview approved by this reviewer.

### Empirical Evidence

Canonical read: `gh issue view 28 --repo Workflows-Accelerator/openchamber-github-task-board --json title,body,state,url` exit 0; OPEN, acceptance requires current opening requests, authoritative completed membership, obsolete-response rejection, useful partial/error state and preserved editing.

`node /tmp/opencode/issue28-review-probes.mjs` exit 0; raw output `/tmp/opencode/issue28-review-probes.log`:
```
PASS A-B-A: final membership/cache [3], no writes
DEFECT successful explicit PATCH undone by delayed full response: display=old, persistent cache=old
DEFECT completed incremental during page-two wait undone by full snapshot
PASS failure then empty retry recovery
```
Probe deliberately asserts observed defect states: exit 0 is reproduction success, NOT correctness success. Source `/tmp/opencode/issue28-review-probes.mjs`. No production tokens or network writes.

Browser command:
```
obscura fetch http://127.0.0.1:8938/ --allow-private-network --wait 3 --eval "JSON.stringify({fresh:document.querySelector('iframe').contentDocument.getElementById('boardFreshness').textContent,calls:window.calls})" -s /tmp/opencode/issue28-desktop.png
```
Exit 0. Source fixture `/tmp/opencode/issue28-browser-server.py`, raw log `/tmp/opencode/issue28-browser-desktop.log`; unchanged built panel served in iframe. DOM reports `owner/a · Refreshing — cached data is provisional · No completed full sync`. Screenshot `/tmp/opencode/issue28-desktop.png` inspected: blank background. Cannot establish finished refresh, desktop/narrow layout, focus or console health. Browser observations are fixture/engine-limited, not a product blank-screen finding. No real credential file read; synthetic file responses only.

### Hostile Findings (L4)

1. **R1 Moderate, unresolved:** older full GET overwrites successful concurrent body edit and persists old data. `panel/main.ts:1431-1436,1539-1547,1987-2021`; status-edit exposure also visible at `2032-2082`. Minimum remediation: field/mutation admission or bounded invalidation/revalidation preserving authoritative membership; add deferred body/status edit tests.
2. **R2 Moderate, unresolved:** incremental admitted while full page 2 waits is later overwritten by full snapshot; watermark regresses to full start. `panel/main.ts:1475-1480,1431-1439,1775-1791,1808-1809,1831`. Minimum remediation: coordinate full/incremental publication with per-issue versions/generation and tests, without reverting to merge-only membership.

Full explanations, reproduction sequence and scope qualifications: `.agents/run/task-centred-architecture/outputs/issue-28-hostile-review.md`.

### Human Review Brief (L5)

Batch/preview not assigned by reviewer. After fixes and integration authorization, open board with configured same repository; expect current request and provisional notice. Refresh empty repository; expect zero rows after complete success. During slow refresh save a task body/move a row; expect accepted edits not to revert. Simulate later-page outage and retry; expect preserved useful rows, warning and correct full-success timestamp. Test narrow layout and focus.

### Failures & Blind Spots

- Explicit body-edit and incremental/full races fail; source code left unchanged.
- Installed-host authenticated requests/subscriptions, real activation/remount behavior, real GitHub response comparison, narrow screenshots, focus retention and L5 NOT RUN.
- Existing reconciliation can write labels; not universally read-only. Recording A-B-A fixture observed zero writes, explicit-edit fixture exactly one intentionally requested synthetic PATCH.
- `python` server attempt exit 127; first browser navigation exit 1 connection refused. `python3` fixed serving. Obscura DOM navigation succeeded; visual proof did not.
- Provider/model actual and supplied identity: Engineer / 9router/engineer. Same model identity does not imply builder's session or human independence.

---

## Remediation pass — R1/R2 review-race fix (appended; prior findings kept)

**Status:** remediation implemented and proven on the shipped bundle; fresh independent hostile review still required. Supplied and actual identity: Engineer, `9router/engineer`.

**Changed source paths:** `panel/main.ts`, generated `panel/main.js`, `test/current-board.test.js`. Report: `.agents/run/task-centred-architecture/outputs/issue-28-review-race-fix.md`.

### Red-first (before source patch, shipped bundle = HEAD `88d3970`)
`node --test test/current-board.test.js` exit 1 — 9 existing tests passed, 7 new regressions failed at the race assertions (`/tmp/opencode/issue28-fix-red.log`): R1 body (`new saved body` → `old body`), R1 status (`closed` → `open`), R2 fields (`incremental new` → `old body`), R2 membership (issue 500 dropped), R1 in-flight crossing write (`crossing write` → `old body`), failed body edit clobbered during pending write, failed status move clobbered during pending write.

### Green
- `node --test test/current-board.test.js` — exit 0, 16 passed (`/tmp/opencode/issue28-fix-current-board.log`).
- `node --test test/current-board.test.js test/d12-origins-cache.test.js test/v2-binding-and-ratelimit.test.js` — exit 0, 30 passed, 0 failed/skipped (`/tmp/opencode/issue28-fix-targeted.log`).
- `npm run typecheck` — exit 0 (`/tmp/opencode/issue28-fix-typecheck.log`).
- `npm run build` — exit 0 (`/tmp/opencode/issue28-fix-build.log`).
- `npm test` — exit 0, 482 passed, 0 failed/skipped (`/tmp/opencode/issue28-fix-suite.log`).
- `git diff --check` — exit 0.

### Probe re-run (synthetic)
`node /tmp/opencode/issue28-review-probes.mjs` exit 1, now failing exactly on its own defect assertion for R2 (`actual 'incremental new'`, expected `'old'`), i.e. R2 no longer reproduces (`/tmp/opencode/issue28-fix-probes-after.log`). Its R1 fixture returns a PATCH payload without `status`, so that probe's PATCH is rejected (`Host request result was empty`) and it measures a failed write; the permanent R1 regressions use a genuine 2xx PATCH.

### Boundaries
- All evidence above is synthetic recording-host/unit level (L0/L1/L4-shipped-bundle). No credential file read, no live GitHub request or mutation, no installed activation.
- Real-browser (Obscura iframe) and installed-host L3/L5 remain **NOT RUN / AWAITING HUMAN**; the earlier blank screenshot is still not visual proof and is not relabelled.
- Residuals: archive/tag/priority/complexity label PATCHes and issue creation are not wired to the admission helper; All Projects aggregation unchanged per scope; All Projects and label-surface races therefore remain outside this correction.

---

## Independent hostile review — `8625b0a` (appended; prior findings kept)

**Status:** FAIL for integration readiness (quality NEEDS-FIXES); Spec PASS against #28 acceptance criteria; reviewed-race closure PARTIAL. **Machine verdict:** PROCEED-WITH-CONDITIONS — fix F1 and re-review before L5. Supplied and actual model: Engineer, `9router/engineer`. Full report: `.agents/run/task-centred-architecture/outputs/issue-28-hostile-review-8625b0a.md`.

### Verdict detail
- R1 (body edit, status edit, in-flight write crossing publication, failed write release) independently PASS on the shipped bundle. R2 PASS up to 400 concurrent admissions; watermark non-regression PASS.
- Spec mapping: AC1 PASS, AC2 PASS (creation exception F2 separate), AC3 PASS, AC4 PASS, AC5 PASS (GET-only refresh, explicit PATCH only, editing controls available).
- **F1 Moderate (introduced, gating):** cap 400 is below one incremental scan (up to `MAX_ISSUES_PER_REPO` = 1000, `panel/core.ts:3985`); cap eviction ignores `pending`, so a 500-issue incremental during a paged refresh evicts 100 admissions and can evict a successful in-flight edit, which an older full publication then clobbers in board and cache (`panel/main.ts:1440-1442,1459-1473,1493-1505,1521-1529,1587-1601,1951-1959`). `S3` and `S3b` reproduce.
- **F2 Moderate (pre-existing, separate):** issue created during a refresh is dropped by the older publication (`panel/main.ts:7738-7764`, second path `7077-7100`); `S7`.
- **F3 Moderate (pre-existing, separate):** archive/tag/priority/status-none/complexity label PATCHes still clobbered (`panel/main.ts:2408-2412,5845-5847,5873-5875,8607-8610,8637-8639,8665-8668`); `S5`, `S6`.
- **F4 Low:** 5-minute TTL expiry + lazy prune can clobber a successful edit only if a refresh lasts >5 min and another write triggers prune; `S2`.
- **F5 Low (pre-existing):** failure of an older status write reverts a newer successful retry (`2256-2266`); `S4`.
- **F6 Low (design caveat):** a failed body save stays pinned for the already in-flight refresh only; the report's "failure drops the record" is imprecise.
- Verified not defects: watermark max() (no permanent freeze), membership retention bounded by next completed full snapshot, no unbounded tracker growth, repo-scoped keys, refresh read-only.

### Minimum remediation for F1
Raise `MAX_ISSUE_WRITE_TRACKERS` to at least `MAX_ISSUES_PER_REPO` (1000) so one incremental scan cannot evict its own admissions, and exclude `pending > 0` keys from cap eviction; add a regression with paged refresh + 500-issue incremental + in-flight edit on the evicted key. File F2/F3 separately; F4-F6 documented residuals.

### Evidence
- L0: `npm run typecheck` exit 0; `npm run build` exit 0; `git status --short` empty; bundle matches HEAD. Logs `/tmp/opencode/r28v2-typecheck.log`, `/tmp/opencode/r28v2-build.log`.
- L1: `node --test test/current-board.test.js` exit 0, 16 pass (`/tmp/opencode/r28v2-current-board-final.log`); `npm test` exit 0, 482 pass, 0 fail/skipped (`/tmp/opencode/r28v2-suite.log`).
- Red-first: reverted `panel/main.ts`/`panel/main.js` to `88d3970`, rebuilt, `node --test test/current-board.test.js` exit 1, 9 pass / 7 fail for the reviewed reasons (`/tmp/opencode/r28v2-red.log`); restored and rebuilt clean.
- L4 probes: `node /tmp/opencode/r28v2-probe.mjs all` exit 0 (`/tmp/opencode/r28v2-probes-final.log`); R1/R2 core PASS (`/tmp/opencode/r28v2-core-final.log`).
- Fuzz: `node /tmp/opencode/r28v2-fuzz.mjs 100` exit 0, 0 failed (`/tmp/opencode/r28v2-fuzz-100.log`); same fuzz on `88d3970` 20/20 failed. Chaos fuzz with PATCH failures and repo switch: 30/30 pass (`/tmp/opencode/r28v2-fuzz2-30.log`).
- Hygiene: `git diff --check` exit 0.

### Boundaries
All evidence is shipped-bundle/recording-host synthetic (L0/L1/L4); no credential or live GitHub request, no installed-host activation. L3 and L5 remain **NOT RUN / AWAITING HUMAN**; no merge, push, close or deploy. F1 is a concurrency-scale defect proven only in the recording harness (deterministic timing), not on a live host.

---

## F1 remediation — `74038a3` (appended; prior findings kept)

**Status:** F1 fixed on the shipped bundle; bounded independent re-review is next. Supplied and actual model: Engineer, `9router/engineer`. Report: `.agents/run/task-centred-architecture/outputs/issue-28-f1-fix.md`.

### Change
- Soft cap `MAX_ISSUE_WRITE_TRACKERS = MAX_ISSUES_PER_REPO * 2` = 2000 (one scan can admit 1000, so the cap holds the current and one concurrent scan).
- Eviction is oldest-first and only removes unpinned records. Pinned = `pending > 0`, or a settled admission newer than the start of the only publication that can still commit for that repository. Hard ceiling 4000: if every record is pinned, the older publication is abandoned (`obsoleteIssueSnapshotEpochs`) and the map is trimmed to 2000; publication/streaming then leave freshness `stale`.
- TTL unchanged, but a record still needed by a live publication is not expired until that publication ends; pruning now also happens on write settlement, at publication and in the fetch `finally`. Keys remain lower-cased `repo#number`; state stays in memory only.

### Regressions (shipped bundle, `test/current-board.test.js`)
1. paged full refresh + 500-issue incremental + pending body edit keeps the edit before and after the older publication and after PATCH settlement;
2. pending edit survives 2000 admissions and the older publication (pinned under cap pressure);
3. settled edit survives 2000 protected admissions (2001 > soft cap, every record pinned) and the older publication.

### Red-first
On `8625b0a` source/bundle with the new test file: `node --test test/current-board.test.js` exit 1, 16 pass / 3 fail, each failing at the F1 assertion (`old body` for the edited field), `/tmp/opencode/f1-red.log`. After the fix: 19 pass, 0 fail.

### Evidence
- L0: `npm run typecheck` exit 0; `npm run build` exit 0; `git status --short` empty; bundle byte-identical to `HEAD:panel/main.js`.
- L1: `node --test test/current-board.test.js` exit 0, 19 pass; `npm test` exit 0, 485 pass, 0 fail/skipped (`/tmp/opencode/f1-suite.log`); `git diff --check` exit 0.
- Hard-ceiling probe: `node /tmp/opencode/f1-hard.mjs` exit 0; 5 scans, 5001 issues, settled edit survives, older publication abandoned and freshness `stale` (`/tmp/opencode/f1-hard.log`).

### Boundaries and residual risk
- Synthetic recording-host/shipped-bundle evidence only; no credential, live GitHub request, installed activation, push, merge, close or deploy. L3/L5 remain **NOT RUN / AWAITING HUMAN**.
- The hard ceiling is proved by the synthetic probe rather than a committed test; triggering it requires five scans for one repository during a single stalled refresh. F2/F3 remain separate; F4-F6 unchanged.
- The 500/2000-issue fixtures exceed the host's 64 KB per-key storage limit, so F1 tests 1 and 3 assert displayed state; cache is asserted by the pre-existing R1 tests and F1 test 2 (whose publication membership is small).
