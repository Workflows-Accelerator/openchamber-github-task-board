# V3-7 — hostile L4 review of V3-5 (sign-in hotfix) and V3-6 (canvas write fix)

Date: 2026-11-11
Branch: `feat/board-v3` (worktree `team-dev-board-v3`)
Reviewed commits: `0e6d237` (V3-5), `274c152` (V3-6 fix), `2ae7f9d` / `5b46807` (evidence)
Review diff: `6826bc8..2ae7f9d`, plus the V3-7 fix commit on top
No GitHub repository was mutated. All GitHub behaviour was modelled by `web/tests/fake-github.mjs`.

---

## 1. Verdicts

| Commit | Spec | Quality |
|---|---|---|
| V3-5 sign-in hotfix (`0e6d237`) | **PASS** | **APPROVED** |
| V3-6 canvas-write fix (`274c152`, evidence `2ae7f9d`) | **PASS** | **APPROVED after one P1 fix** (V3-7) |

Zero open P0/P1 after the V3-7 fix. Eight P2 findings are reported, not fixed (§7).

---

## 2. Claims under attack, adjudicated

### Claim 1 — root cause: `If-Match` on the issue PATCH
**Substantiated.** `git log -S"if-match" -- web/server/github.ts` shows exactly two commits: `af62a4e`
added `headers['if-match'] = options.etag` and `274c152` removed it. The header was therefore sent on
every issue PATCH for the whole life of the web board.

Caveat: "no issue write has ever reached GitHub" is true for PATCH-based writes only. Create-issue
(POST) and dependency add/remove (POST/DELETE) never carried the header and worked. The pre-fix
harness (`data/v37-writepaths-before.json`) reproduces exactly that split: 8 of 11 product write paths
returned `502 write_outcome_unknown`; 3 succeeded.

The claim that real GitHub refuses the header rests on the read-only probes recorded in
`verifications/V3-6/proof.md` and the earlier A2 finding (`verifications/A2/proof.md:153`). I did not
re-probe the live API: the brief forbids real GitHub mutations, and a PATCH probe is a write request.

### Claim 2 — misclassification produced "Outcome unknown"
**Confirmed.** At `5b46807`, `kindForStatus()` has no `400` case, so a 400 falls through to `'server'`;
`writeIssue()` maps `kind === 'server'` to `HttpError(502, 'write_outcome_unknown')`. The pre-fix run
returns exactly `{"error":"write_outcome_unknown","message":"Outcome unknown — check the issue on GitHub"}`.

### Claim 3 — the fix
**Confirmed, with one gap.** `If-Match` support was removed from the shared `request()` option type,
so no caller can send it again (`web/server/github.ts:241-264`, `:543-558`). `400 -> 'invalid'`
(`github.ts:148`) and the new `write_rejected` branch (`app.ts:2615-2627`) behave as described.

Gap found and fixed: the client's `api()` converted every 5xx response into `write_outcome_unknown`
*before* looking at the server's error code. The board maps a rejected GitHub token to 502
(`github_unauthorized`) and a rate limit to 503 (`github_rate_limited`), so the two new named messages
(`canvas_save_signed_out`, `canvas_save_rate_limited`) were unreachable and both causes still showed
"the outcome is unknown". Measured in real Chromium before the fix: 401 and 429 both produced
"Canvas position not saved: the outcome is unknown. Refresh before dragging again." Fixed in
`web/public/app.js:418` (§6).

### Claim 4 — the old fake hid the bug
**Confirmed.** `honorIfMatch` defaulted to `false` and the fake ignored the header unless it was set,
so a header GitHub rejects passed every local test. The fake now refuses any `PATCH` carrying
`if-match` with GitHub's exact body (`fake-github.mjs:502-516`) before applying anything, and still
models a precondition-supporting gateway behind `honorIfMatch`.

### Claim 5 — regression suite fails 5/8 on the base commit
**Reproduced exactly.** `5b46807` extracted with `git archive`, the new test file and corrected fake
copied in (`/tmp/opencode/v37-prefix`, log `data/v37-prefix-tests.log`):

```
not ok 1  (502 instead of 200)     ok     4  (409 path already correct)
not ok 2  (502 instead of 200)     ok     6  (unknown outcome already correct)
not ok 3  (502 instead of 200)     ok     7  (fake contract)
not ok 5  (502 instead of 400)     not ok 8  (EN/FR keys absent)
# tests 8  # pass 3  # fail 5
```

The failures are the product defect (502 / missing strings), not a fixture artefact: test 4, 6 and 7
pass on the same tree, and the fake contract test passes independently.

### Claim 6 — nothing else changed
**Confirmed.** `git diff 6826bc8..2ae7f9d -- panel service` is empty. The dot-grid formula is not in
the `app.js` diff (`git diff … | grep -i dot` returns nothing). No file under
`/workspace/releases`, `/workspace/code/openchamber-config` or `/workspace/.openchamber-data` was
written. Suites: see §9.

---

## 3. Write-path table

Every product write, exercised through the real server against the fake GitHub, on the pre-fix tree
(`5b46807` + corrected fake) and on the fixed tree. Script `scripts/v37-writepaths.mjs`, data
`data/v37-writepaths-before.json` and `data/v37-writepaths-fixed.json`.

| Product write | Request | Broken before | Working after | How proven |
|---|---|---|---|---|
| Create task | `POST /api/issues` | no (POST, no conditional header) | yes, 201 | harness + `simple-views.test.mjs` create |
| Status change | `POST /api/issues/:n/status` → PATCH | **yes — 502 unknown** | yes, 200, label applied | harness + `canvas.test.mjs` / `simple-views.test.mjs` |
| Draft title/description edit | `PUT /api/issues/:n/draft` → PATCH | **yes — 502 unknown** | yes, 200, body+order kept | harness + `simple-views.test.mjs:103` |
| Draft reorder / marker | `PUT /api/issues/:n/order` → PATCH | **yes — 502 unknown** | yes, 200, order 1500 written | harness + `simple-views.test.mjs` |
| Section (overview) edit | `PUT /api/issues/:n/section` → PATCH | **yes — 502 unknown** | yes, 200, section text replaced | harness |
| Human-task toggle | `POST /api/issues/:n/human-tasks/:i/toggle` → PATCH | **yes — 502 unknown** | yes, 200, `- [x]` written | harness |
| Canvas drag | `PUT /api/issues/:n/canvas` → PATCH | **yes — 502 unknown, card snapped back** | yes, 200; survives full reload | harness, `v3-6-canvas-persistence.test.mjs` 1-3, real Chromium drag (§8) |
| Sticky note / note text | `PUT /api/issues/:n/canvas` (notes) → PATCH | **yes — 502 unknown** | yes, 200, note in marker | harness |
| Reopen | `POST /api/issues/:n/reopen` → PATCH | **yes — 502 unknown** | yes, 200, open + `status:backlog` | harness |
| Dependency add | `POST /api/issues/:n/dependencies/blocked_by` | no (POST) | yes, 201 | harness + `fake-github` dependency surface |
| Dependency remove | `DELETE …/blocked_by/:id` | no (DELETE) | yes, 200 | harness |
| Priority | — | — | not a board write | The board only links to GitHub: `app.js:5845-5849` ("Set on GitHub"). Nothing to fix. |

Pre-fix summary: 8/11 board writes were dead; create and the two dependency calls worked.

---

## 4. Concurrency after removing `If-Match`

Mechanism, read in the code and proven end to end (`scripts/v37-concurrency.mjs`,
`data/v37-concurrency.json`):

1. **Fingerprint pre-check** — the client sends the 64-hex `issueFingerprint` of its last read; the
   server re-reads the issue inside the write and compares (`app.ts:1971-1985`). A mismatch is a
   `409 conflict` and no PATCH is sent.
2. **Per-issue serialisation** — every write runs inside `withIssueLock(issueKey(...))`, so two
   requests for the same issue on one board server cannot interleave (`app.ts:2733-2743`).
3. **Post-write verification** — the issue is re-read and the patched fields compared; a mismatch is
   `502 write_outcome_unknown` (`app.ts:2630-2728`).

Measured: two tabs saving the same card with the same fingerprint → `200` + `409`, exactly one PATCH.
Drag racing a status change → `200` + `409`. A section-clearing write racing a note write → `200` +
`409`. The loser writes nothing and its card/note state is restored.

**What is no longer protected:** the PATCH itself carries no precondition, so an *external* writer
(GitHub web UI, another board instance, a bot) that lands in the millisecond window between the
server's fresh read and the PATCH has its change overwritten; the board's post-write check only
compares the fields it wrote, so it does not detect the clobber. Proven by injecting a write in that
window (`beforePatchHook`): the external body edit is gone and the canvas write still returns 200.
The in-process lock also does not cover a second board process, though the deployment runs one.

Residual risk in one sentence: a *different* client editing the same issue in the same few
milliseconds as a board write can silently lose its body/title/label change; two board tabs and any
slower race are caught by the fingerprint 409.

---

## 5. Error classification

Matrix from `scripts/v37-classify.mjs`, `data/v37-classify.json`, and the browser run in §8.

| Upstream | Server response | Client message (EN) | Verdict |
|---|---|---|---|
| 400 conditional header | 400 `write_rejected` + GitHub reason | "GitHub rejected the write (400)…" | correct, definite |
| 400 bad label | 400 `write_rejected` + "Invalid label name" | canvas: "(400)"; note: server reason shown | correct |
| 400 non-JSON | 400 `write_rejected` + generic phrase | "(400)" | correct but wording repeats "(GitHub rejected the write)" — P2 |
| 401 token rejected | 502 `github_unauthorized` | **was "outcome unknown"; now "check the token permissions"** | fixed (P1) |
| 403 forbidden | 502 `github_forbidden` | "may not write to that repository…" | correct |
| 403 rate limit | 503 `github_rate_limited` | **was "outcome unknown"; now rate-limit message** | fixed (P1) |
| 404 vanished | 404 `not_found` | "GitHub rejected the write (404)…" | correct |
| 409 conflict/locked | 502 `write_outcome_unknown` | "outcome is unknown" | **P2 — definite refusal reported as unknown** |
| 412 precondition | 409 `conflict` | "changed on GitHub first, nothing was written (409)" | correct |
| 422 validation | 400 `invalid_request` "The issue reference is not valid" | canvas: "(400)"; note: that text | **P2 — misleading message for a body/label rejection** |
| 422 non-standard | 502 unknown | unknown | conservative, acceptable |
| 429 rate limit | 503 `github_rate_limited` | rate-limit message (after fix) | fixed (P1) |
| 500 / 502 HTML | 502 unknown | unknown | correct |
| board 5xx with no cause | 502 unknown | unknown | correct |

Retryable-vs-permanent: no retryable failure is now reported as a permanent rejection; 429 was the
only retryable case misreported (as unknown), now named. 400 is never retried and is reported as a
definite refusal. 5xx stays unknown on purpose because the request may or may not have been applied.

---

## 6. Defects found and fixed

**P1 — GitHub 401/429 were collapsed into "outcome unknown" before the new named messages could run.**
Fixed in `f4beb1c`.
`api()` in `web/public/app.js` checked `response.status >= 500` before the payload's error code, so
`github_unauthorized` (502) and `github_rate_limited` (503) always became `write_outcome_unknown`.
The response said "the outcome is unknown. Refresh before dragging again" for causes the board had
already classified, and `canvas_save_signed_out` / `canvas_save_rate_limited` were dead strings.
Fix at the root: resolve those two definite-refusal codes before the generic 5xx branch
(`web/public/app.js:418-425`). No other code path changes; ambiguous 5xx still becomes unknown.
Regression tests: two fake-GitHub-backed server tests (429 → 503 `github_rate_limited`, 401 → 502
`github_unauthorized`, nothing written) and a client ordering assertion in
`web/tests/v3-6-canvas-persistence.test.mjs` (tests 7, 8, 10). The ordering assertion fails on the
same file with the new branch removed (`/tmp/opencode/v37-noappfix`: "api() keeps the GitHub 401 and
429 causes"), so it guards the fix rather than the symptom.

Verified in real Chromium after the fix (`data/v37-canvas-after.json`): rate limit →
"GitHub is rate limiting the board. Try again in a minute." / "GitHub limite le débit du tableau.
Réessayez dans une minute."; rejected token → token-permission message, both languages.

No P0 was found. No other P1 was found in two fix passes.

---

## 7. P2 findings (reported, not fixed)

1. **GitHub `409` on a write is reported as `502 write_outcome_unknown`** (`github.ts:120-168` has no
   409 case). A definite refusal is described as an unknown outcome. Rare for issue writes.
2. **`422` validation returns `400 "The issue reference is not valid"`** via `mapGitHubError`
   (`app.ts:292-294`). Correct status, useless message for a rejected body or label; the canvas card
   move masks it, a note edit shows it verbatim in English.
3. **The order batch and rebalance PATCHes bypass the new `write_rejected` branch** (`app.ts:2266`,
   `app.ts:2434`). A first-write 400 becomes `400 invalid_request "The issue reference is not valid"`;
   a later-write 400 becomes `502 write_outcome_unknown`.
4. **400 with a non-JSON body** produces "GitHub rejected the write; nothing was saved (GitHub
   rejected the write)" — duplicated wording, and "nothing was saved" is an inference for a 400 that
   carried no parseable reason.
5. **Stale local bundle.** `web/dist/server.mjs` (gitignored) still contains
   `headers["if-match"] = options.etag`, and `hosting.test.mjs:26-44` only builds the bundle when the
   file is absent. `npm run start:web` in this worktree would run the pre-fix server, and the hosting
   test validated that stale artifact. Any release must rebuild `web/dist` from `web/server.ts`.
6. **Stale test name.** `simple-views.test.mjs:96` still says "…routes use fingerprint + ETag"; the
   ETag is no longer sent. The assertions themselves are correct.
7. **French copy for non-canvas write failures stays generic** ("Could not save note.") while English
   shows the server's reason. Canvas moves are fully bilingual.
8. **No test exercises the `honorIfMatch` gateway path any more** (the fake still supports it). The
   412 → 409 branch is still covered through `patchHook` (`simple-views.test.mjs:272,408`).

---

## 8. V3-5 sign-in hotfix — verification

Real Chromium (`scripts/v37-guard.mjs`, `data/v37-guard.json`, screenshots in `screenshots/`):

| Check | 360x800 dark | 360x800 light | 1280x900 dark | 1280x900 light |
|---|---|---|---|---|
| Signed out: `#compact-nav-dock` | display none, 0px | none, 0px | none | none |
| Signed out: `.compact-header` | none | none | none | none |
| Signed out: `#app-sidebar` | none | none | none | none |
| Sign-in card | 328x252, centred (h/v delta 0.00), no overflow | same | 420 wide, centred, no overflow | same |
| Password field / button | 44px / 83x44 | 44px / 83x44 | 44px / 83x44 | 44px / 83x44 |
| Console errors | none | none | none | none |

Signed-in behaviour: at 360x800 the dock is `display: grid`, 57px high; at 1280x900 the sidebar is
visible and the dock stays hidden by the desktop media query. Calling `showLogin()` **after** the
board was rendered hides the dock instantly (`display: none`, 0px) and `showBoard()` restores it, so
the guard cannot be bypassed by late login rendering. A signed-in reload with `/api/board` delayed
(700ms sample) keeps the login view hidden and the dock visible; a reload with `/api/board` returning
500 and no cache stays on the board view with the dock visible (`data/v37-failedboard.json`).

Before/after proof the defect was real: at `6826bc8` the same 360x800 page shows the dock (57px,
"Canvas / List / Decisions / Blocked") over the sign-in card and a full-bleed 360px card at `y=40`
(`scripts/v37-v35before-check.mjs`; screenshot `screenshots/v37-v35before-360x800.png`). After the
fix: dock gone, card centred.

Regression test is not vacuous: removing the six `body:has(#login-view…)` rules from a copy of
`theme.css` makes `signin-dock-guard.test.mjs` fail on its first test (2/3 pass, 1/3 fail). The suite
is structural (CSS/DOM grep), so the behavioural proof above is the primary evidence.

---

## 9. Assertion audit

`git diff 6826bc8..2ae7f9d -- web/tests` contains **two** removed assertion lines and no deleted test:

```
-    assert.equal(fake.patchCalls[0].ifMatch, read.etag);     // github.test.mjs
-  assert.ok(fake.patchCalls[0].ifMatch);                      // simple-views.test.mjs
```

Both were inverted, not dropped, and both replacements are stricter:

* `github.test.mjs`: still reads the issue, now asserts the read **returns** an ETag and the PATCH
  sends **no** `If-Match` (two assertions replacing one), plus the existing token-leak assertion.
* `simple-views.test.mjs`: asserts `ifMatch === undefined` and keeps the following
  `409`/`200`/`409`/`400` fingerprint assertions unchanged.

The five `honorIfMatch: true` removals only drop the option from fixtures (`canvas.test.mjs` ×3,
`simple-views.test.mjs:82`, `issue-48-browser-verify.mjs:18`); every test in those files still runs
and still asserts its behaviour. No `test(`, `assert` or matcher was deleted anywhere in the diff.
V3-7 adds tests and removes none; the web suite grows 609 → 611.

---

## 10. Final checks (sequential, clean tree)

Fix commit: `f4beb1c` on `feat/board-v3`. The four checks below were run on the clean tree at
`7339629` (no uncommitted changes, `git status` empty), in this order, one after the other.

| Command | Result | Log |
|---|---|---|
| `npm test` | **618 / 618 pass**, exit 0 | `data/npm-test.log` |
| `node --test --test-timeout=30000 web/tests/*.test.mjs` | **611 / 611 pass**, exit 0 | `data/web-tests.log` |
| `npm run typecheck` | exit 0 | `data/typecheck.log` |
| `npx esbuild web/server.ts … --outfile=/tmp/opencode/v3-review.mjs` | exit 0, 224.6 kb, **0 occurrences of `if-match`** | `data/esbuild.log` |
| Real Chromium: guard matrix, drag+reload, 9-status message matrix, EN+FR | pass | `data/v37-guard.json`, `data/v37-canvas-after.json` |

Host contention was real (load average 4.7–12 on 4 cores from other sessions). Earlier run history on
the same content, before the clean-tree run: `npm test` gave 615/618, 616/618, 617/618, then 618/618;
the failures were the wall-clock assertions ("500-node graph <100ms" measured 128.88ms, "1,000 items
<60ms" measured 94.56ms, "5,000 checkboxes <50ms") and one panel test whose 40ms wait expired — each
failing file passes alone (`scale-and-adversarial.test.js` 33/33,
`stage1-dual-mode-and-scoping.test.js` 26/26, `panel-simple-views.test.js` 16/16). The web suite timed
out `app.test.mjs` at 30s twice under load 12. The four logs in `data/` are the clean-tree run at
`7339629`, all green first attempt (load 4.89). No assertion was weakened or skipped to get these
numbers.

---

## 11. Not run / not verified

* No live GitHub request of any kind; the real-API refusal is taken from the V3-6 read-only probes and
  the earlier A2 finding, not re-probed.
* `node scripts/generate-delivery-smoke.mjs` was not re-run (not in the review command list); the V3-6
  smoke log and screenshots were read, not regenerated.
* No deployment, no push, no GitHub mutation. The deployed release `0e6d237-20261111` still contains
  the V3-6 write defect until a reviewed deploy rebuilds and ships this branch.
* iOS Safari was not available; the phone checks use headless Chromium at 360x800/390x844.
* `web/dist/server.mjs` was deliberately not rebuilt or deleted (gitignored local artifact); see P2-5.
