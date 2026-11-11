# V3-6 — Canvas drag P0: root cause, fix, proof

Date: 2026-11-11
Branch: `feat/board-v3` (worktree `team-dev-board-v3`)
Base: `5b46807` (deployed release `0e6d237-20261111` is byte-identical to it)
Scope: the Canvas drag must persist and survive a reload. No GitHub repository was mutated.

---

## 1. Root cause

`GitHubClient.updateIssue()` sent an `If-Match` header on the issue `PATCH`, and GitHub refuses
*any* unsafe request that carries a conditional header, before authorization and before applying
anything:

```
PATCH https://api.github.com/repos/.../issues/{n}
If-Match: W/"e7c0…"
→ 400 {"message":"Bad Request",
       "errors":["Conditional request headers are not allowed in unsafe requests unless supported by the endpoint"]}
```

Nothing was written, so the drag never persisted. The failure was then *misclassified*:
`kindForStatus()` did not handle `400`, so it fell through to `'server'`; `writeIssue()` turns
`'server'` into `502 write_outcome_unknown`; the client maps `write_outcome_unknown` to the text the
user saw. One defect, two mistakes: an unsupported header on the write, and a definite refusal
reported as an unknown outcome.

Failing condition: every canvas write (and every other issue PATCH) against real GitHub, since
`af62a4e`. Local fakes did not reproduce it because they only enforced `If-Match` when
`honorIfMatch: true`, which made the wrong client behaviour look correct.

### Evidence that the header is the trigger, not the issue

Read-only probes against the live API (no body applied, no issue modified):

| Request | Result |
|---|---|
| `PATCH /repos/Workflows-Accelerator/openchamber-github-task-board/issues/99999999` with `If-Match` | `400` conditional-header error |
| same, without `If-Match` | `404` |
| `PATCH /repos/nodejs/node/issues/1` with `If-Match` | `400` conditional-header error |
| same, without `If-Match` | `403` (permission) |

The 400 is emitted before authorization and before existence checks, so it applies to every real
issue, not just a synthetic one. GitHub issue GET returns a **weak** ETag (`W/"…"`), and issue
updates do not support conditional writes, so the protection cannot be kept as `If-Match`. It was
already provided by the server's fingerprint pre-check (`409 conflict`) and the post-write
re-read/verify.

### Evidence at HTTP level on the pre-fix code

Real Chromium, fake GitHub that now models the real refusal, `5b46807`:

```
PUT /api/issues/5/canvas   → 502
{"error":"write_outcome_unknown","message":"Outcome unknown — check the issue on GitHub"}
card snapped back 380px,520px → 380px,520px   notice: "Outcome unknown — check the issue on GitHub."
persisted marker: none
```

Screenshots: `screenshots/before-*-2-after-drag.png`.

> Note: a pre-fix run against the *old* fake returned 200 and persisted, which is exactly why the
> defect reached production. The fake was corrected first; see §3.

---

## 2. Fix

| File:line | Change |
|---|---|
| `web/server/github.ts:257-264` | removed the `etag` request option and the `if-match` header emission; comment records GitHub's refusal. `if-none-match` (conditional **reads**, supported) is untouched. |
| `web/server/github.ts:543` | `updateIssue(number, patch)` no longer takes an `etag`. |
| `web/server/app.ts:2266, 2434, 2606` | the three call sites (order batch, rebalance, main write) stop passing `{ etag }`. |
| `web/server/github.ts:148` | `kindForStatus()` maps `400 → 'invalid'`: GitHub answers 400 before applying, so it is a definite refusal, never an unknown outcome. |
| `web/server/app.ts:2615-2627` | new branch before the network/server branch: `400 → HttpError(400, 'write_rejected', "GitHub rejected the write; nothing was saved (<upstream reason>)")`, preferring GitHub's `errors[]` text, else `message`. |
| `web/public/app.js:685-691, 868-874` | seven EN + FR strings for canvas failures (`canvas_save_rejected/conflict/forbidden/rate_limited/signed_out/unknown/timeout`), same i18n dictionary pattern. |
| `web/public/app.js:2767-2795` | `canvasMoveFailureMessage(err, dict)` names the cause and the HTTP status; `write_outcome_unknown` keeps its own "outcome unknown" wording. Replaces the old "English passthrough, otherwise generic" branch at the card-move catch (`app.js:2872`). |

The `412 → 409` branch is kept as a gateway-level defence even though real GitHub never emits 412
for these writes.

Nothing silently discards a move: on any failure the card snaps back (`executeSaveIssueCanvas`
restores the previous position) and the notice now names what failed.
Example, EN: *"Canvas position not saved: GitHub rejected the write (400). The card stayed where it
was."* FR: *"Position non enregistrée : GitHub a refusé l’écriture (400). La carte est restée à sa place."*

### Test-side correction (the reason the suite passed on broken code)

| File:line | Change |
|---|---|
| `web/tests/fake-github.mjs:503-516` | a `PATCH` carrying `if-match` is now refused with GitHub's exact 400 unless `honorIfMatch` is set (models a gateway that supports preconditions). Previously the header was ignored, hiding the bug. |
| `web/tests/canvas.test.mjs:203,314,771`, `web/tests/simple-views.test.mjs:82`, `web/tests/issue-48-browser-verify.mjs:18` | removed `honorIfMatch: true`: those fixtures only tolerated a header the product must never send. |
| `web/tests/simple-views.test.mjs:108` | `assert.ok(patchCalls[0].ifMatch)` → `assert.equal(..., undefined)`: the expectation legitimately inverted because GitHub rejects that header. The stale-write protection is still asserted (409 on the next line). |
| `web/tests/github.test.mjs:62-80` | test renamed *unconditional* PATCH; asserts the read still returns an ETag **and** the write sends no `If-Match`. |

No assertion was dropped or loosened; two expectations were inverted because the previous contract
was the defect.

---

## 3. Regression tests

New file `web/tests/v3-6-canvas-persistence.test.mjs` (8 tests):

1. canvas write round-trips through the real server + fake GitHub; re-read returns the position.
2. write issued right after a conditional `304` GET persists, and the stale ETag no longer
   revalidates after the write.
3. second drag updates the single marker and keeps the body byte-stable otherwise.
4. stale fingerprint → `409 conflict`, nothing written, no PATCH dispatched.
5. GitHub `400` → `400 write_rejected` with the upstream reason, never `write_outcome_unknown`.
6. genuinely unknown upstream outcome (gateway commits then returns unreadable 5xx) still →
   `502 write_outcome_unknown`.
7. the fake refuses conditional unsafe requests exactly like GitHub.
8. client: the seven named-cause keys exist in EN and FR, the helper exists, the old English-only
   passthrough is gone.

Pre-fix proof (`5b46807` extracted with `git archive` to `/tmp/opencode/v36-prefix`, same test file
and corrected fake):

```
# tests 8  # pass 3  # fail 5
not ok 1  (502 write_outcome_unknown)
not ok 2  (502 …)
not ok 3  (502 …)
ok     4  (409 path already correct)
not ok 5  (502 instead of 400 write_rejected)
ok     6  (unknown outcome path already correct)
ok     7  (fake contract)
not ok 8  (EN/FR keys absent)
```

Log: `logs/prefix-5b46807-tests.log`.

---

## 4. Real Chromium proof

Harness: `/tmp/opencode/v36-proof.mjs` (copied logic below), fake GitHub + real server, desktop
`1280x900` mouse drag and phone `390x844` CDP touch drag. Asserts: the DOM position after a **full
reload** equals the DOM position right after the drop; the card actually moved; the persisted
`board-canvas` marker carries exactly those coordinates; no notice; zero console errors.

After the fix (both viewports PASS, exit 0):

| Viewport | Drop (world) | DOM after reload | Persisted marker |
|---|---|---|---|
| desktop 1280x900 | `470,590` | `470px,590px` | `<!-- board-canvas: {"x":470,"y":590} ;sep=2 -->` |
| phone 390x844 | `116,560` | `116px,560px` | `<!-- board-canvas: {"x":116,"y":560,"notes":[{"id":"n1","x":136,"y":740,…}]} -->` (note moved with the card) |

Before the fix, the same harness (same fake, `5b46807`) fails on both viewports:
`502`, notice *"Outcome unknown — check the issue on GitHub."*, card back at `380px,520px`,
no marker.

Artifacts:

- `screenshots/before-desktop-1280x900-1-before-drag.png`, `…-2-after-drag.png`, `…-3-after-reload.png`
- `screenshots/before-phone-390x844-*.png`
- `screenshots/after-desktop-1280x900-*.png`, `screenshots/after-phone-390x844-*.png`
- `before-proof-report.json`, `after-proof-report.json`

---

## 5. Suites (sequential, `feat/board-v3` + fix)

| Suite | Result | Log |
|---|---|---|
| `npm test` | **618 / 618 pass**, exit 0 | `logs/npm-test.log` |
| `node --test --test-timeout=30000 web/tests/*.test.mjs` | **609 / 609 pass**, exit 0 | `logs/web-tests.log` |
| `npm run typecheck` | exit 0 | `logs/typecheck.log` |
| esbuild bundle → `/tmp/opencode/v3-server-check.mjs` | exit 0, 224.6 kb | `logs/esbuild.log` |
| `node scripts/generate-delivery-smoke.mjs` | 9 / 9 sections PASS, exit 0 | `logs/smoke.log`, `smoke/smoke.json` |

Two host-contention flakes were observed and are not code regressions:

- `npm test` first run: `test/stage1-dual-mode-and-scoping.test.js` "5,000 checkboxes <50ms" measured
  63.82ms at load average 9.1 on 4 cores; the file passes alone (26/26) and `npm test` then passed
  618/618 at normal load.
- `web/tests/*` first run: `app.test.mjs` and `validation-provenance.test.mjs` hit the 30s
  *file* timeout during the same load spike; both pass alone and the full suite then passed 609/609
  in 32.8s.

Forbidden areas verified unchanged: `git diff 5b46807..HEAD -- panel service` is empty; the dot-grid
formula in `web/public/app.js` is not in the diff (`grep -i dot` over the app.js diff returns
nothing); `/workspace/releases/**`, `/workspace/code/openchamber-config/**` and
`/workspace/.openchamber-data/**` were not written; no secret was printed.

---

## 6. Not verified

- **The deployed release still contains the bug.** `https://board.workflows.ac` runs
  `0e6d237-20261111`; deploying this commit is a separate reviewed step. The fix is proven against a
  real server + real Chromium, not against the live deployment.
- **No real drag was attempted on the live board**, to avoid mutating the user's GitHub issues.
  The real-GitHub 400 was proven with read-only probes that were rejected before any write.
- The user's exact phone/browser was not available; the phone proof uses headless Chromium with
  iPhone-sized viewport and CDP touch events, not iOS Safari.
- GitHub Enterprise/gateway deployments that *do* support `If-Match` on issue updates lose that
  optional precondition; the fingerprint `409` guard remains for all deployments.
