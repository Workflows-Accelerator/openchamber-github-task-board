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
