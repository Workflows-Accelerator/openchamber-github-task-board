# V4-2 verification: agent notes as GitHub comments, Markdown decision options

This branch is `feat/board-v3` and the base is `d1eef33`. Source commit `5430f36`, tests commit `b0718cc`.
The evidence commit is `aa9e1e3`; a later local `fix(v4-2)` commit adds the 410 mapping and its test (finding 1
below). Every run below used a synthetic preview against the fake GitHub in
`web/tests/fake-github.mjs`. The runs made no real GitHub requests and deployed nothing. This
evidence does not say that V4-2 is live or that a human has accepted it.

## Dirty-state disposition

The previous worker left 7 modified files, 3 new test files and this directory, all
uncommitted. I reviewed every hunk against the goal and against D37, D38 and D39. I kept every hunk.
This pass made these changes:

- `web/server/app.ts` `createIssueNote`: a GitHub 403 whose upstream message
  matches `/locked/i` now becomes `403 note_locked`. Other `forbidden` and
  `unauthorized` responses become `403 note_forbidden`. Before this change, a locked issue told
  the user to check token permissions.
- `web/public/app.js`: added `agent_note_locked` in EN and FR. `api()` passes `note_forbidden`
  and `note_locked` through unchanged, before the generic 403 is collapsed into `github_forbidden`.
- `web/server/board.ts` `parseQuestionOptionLines`: the line `-  :: gist` has an empty label.
  It is now skipped. Before, the separator text `:: gist` became the label.
- New tests: locked issue, a quoted-marker human comment end to end, and malformed
  option lines.

## Regression verdict: stale pre-D37 expectation, not a product defect

The old probe `scripts/generate-v4-1b-verification.mjs` comes from commit `6535937` (2026-11-12 00:16).
It is older than `38f6572` (03:31), which introduced `CANVAS_READABLE_MIN_SCALE = 0.55`.
Running `git merge-base --is-ancestor 38f6572 6535937` exits 1. The old probe requires
the following under automatic framing at every width (lines 377–394):

```
neighbourhoodCards.every((c) => c.insideViewport) && filtered.cards.every((c) => c.insideViewport)
&& cardsUnderHud.length === 0 && filteredUnderHud.length === 0
```

At 360 and 390 that requires a fit below the readable floor, which D37 forbids. The old probe
fails all 8 phone cases, not only two. Each phone case reports `zoomAfterFit: 0.55`,
`neighbourhoodInside: false` and `cardsUnderHud: ["acme/vanilla-sdk#11"]`. Both 768 and 1280 pass.
Reduced motion is 0/2 for the same reason. The probe was run unmodified and its result is
kept in `regression/v4-1b-summary.json` (8/16) and `logs/regression.log`.

`scripts/framing-promise.mjs` measures what the product actually promises. It runs real Chromium and uses real clicks.
It covers 360, 390 and 1280, in light and dark, in EN and FR:

| width | automatic zoom | neighbourhood outside | after real "Show all (4)" click | filter frame |
|---|---|---|---|---|
| 360 | 0.55 (floor) | 3 of 4, legend "Connected tasks are outside this view." / "Des tâches liées sont hors de cette vue." | 0.315, 4/4 inside, 0 under HUD, labels inside | 0.55, Show all reaches all matches |
| 390 | 0.55 (floor) | 3 of 4, same legend | 0.344, 4/4 inside, 0 under HUD, labels inside | 0.55, same |
| 1280 | 0.785 | 0, no Show all | n/a | 0.915 |

The result was 12/12 with exit 0, 0 CSP violations and 0 console problems (`regression/framing-promise.json`).
Attempt 1 scored 4/12 because of a bug in the probe: it expected the D39 zoom-limit sentence on
*automatic* framing, but that sentence belongs to a completed full fit. That attempt is kept in
`logs/framing-promise-attempt-1.log` and `regression/framing-promise-attempt-1.json`.
I did not change D37, D38, D39 or the filter and dependency return-view state.

## Commands (sequential, one clean run each; earlier attempts preserved)

| command | result | log |
|---|---|---|
| `node --test --test-timeout=30000 web/tests/*.test.mjs` | 670/670, EXIT 0 (before the 410 fix: 658 pass + 1 cancelled at a 30 s timeout, load 7.5, `web-tests-before-410-fix.log`) | `logs/web-tests.log` |
| `npm run typecheck` | EXIT 0 | `logs/typecheck.log` |
| esbuild client and server bundle check | EXIT 0 (401.4kb / 230.6kb) | `logs/esbuild.log` |
| `node scripts/browser.mjs` | pass true, 12 cases, 48 screenshots, EXIT 0 | `logs/browser.log` |
| `node scripts/framing-promise.mjs` | 12/12, EXIT 0 | `logs/framing-promise.log` |
| `DELIVERY_DIR=…/V4-2 node scripts/generate-delivery-smoke.mjs` | EXIT 0, real 6m01.0s, 14/14 PASS, 191 captures (attempt 5, post-410-fix) | `logs/delivery-smoke.log`, `smoke.json`, timings in `logs/delivery-smoke-timing.log` |
| `npm test` (panel suite `test/*.test.js`) | **not green**: pre-existing load-sensitive flake, see the head-vs-base section | `logs/npm-test-*.log` |

`npm test` failure names seen across runs: `scale-and-adversarial` "5,000 checkboxes … <50ms" (actual 59.39ms,
59.01ms), `panel-simple-views:290` "quick capture … Cannot read properties of undefined (reading 'payload')",
and earlier `panel-simple-views` "quick capture… release is not a function" and `panel-simple-views:117`
drawer description `0 !== 1`. The failing test differs per run; no test was edited or weakened.

Delivery smoke attempts:
1. Missing `libglib-2.0.so.0`; exited 1 after 1.5 s.
2. Fontconfig `FATAL SkFontMgr_FontConfigInterface.cpp:163`, which caused a login-form timeout.
3. EXIT 0 in 5m13.9s, 14 sections, before the option fix (`logs/delivery-smoke-before-option-fix.log`).
4. EXIT 0 in 6m11.8s, 14 sections, after the option fix (`logs/delivery-smoke-before-410-fix.log`).
5. EXIT 0 in 6m01.0s, 14/14 PASS, after the 410 fix — the current `logs/delivery-smoke.log` and `smoke.json`.

## Browser environment deviation

Chromium 156.0.8078.4 cannot launch in this container: 20 shared libraries are missing and there are no fonts.
`scripts/browser-env.sh` extracts Debian bookworm `.deb` packages to
`/tmp/opencode/v4-2-libs` and sets `LD_LIBRARY_PATH` and `FONTCONFIG_FILE`. Nothing is
installed system-wide. This departs from the brief's "no /tmp env script" instruction, and it is the only way to get a
real Chromium here. Node is v22.23.5, not the Node 20 named in the brief.

## Note flow (probes in `browser.json`, tests in `web/tests/v4-2-notes.test.mjs`)

- Marker `<!-- board-note: 1 -->` must be the first non-blank line. A quoted or later marker is
  not treated as a note, and versions 0 and 2 are rejected. Comments are append-only: the board never PATCHes or DELETEs them.
- `POST /api/issues/:n/notes` and `/api/repos/:o/:r/issues/:n/notes` require CSRF and take a per-issue lock.
- Empty and oversized notes get a 400 before any POST. Refusals 403 (forbidden or locked), 404 and 410 create
  nothing and are reported as definite. A 422 in GitHub's documented validation shape
  (`errors[].resource/field/code`) is also definite (400 `invalid_note`). A 422 carrying only
  `errors[].message` is treated as possibly committed and reported 502 `note_outcome_unknown`, with no
  claim that it was saved. On a lost response the client reconciles and creates no duplicate. A double send
  creates 1 comment. An unsent draft survives closing and reopening the drawer.
- API cost: opening the drawer adds 1 conditional comments GET (304 when unchanged). The board list adds 0
  comment requests. A send costs getIssue, dependencies, POST, getIssue re-read and a forced comments GET.
  The browser run counted 19 conditional comments GETs.
- Canvas stickies stay separate from agent notes (`canvasStickyUnchanged`).

## Decisions

- Options use the format `  - label :: gist :: details`, with at most 8 per question and labels of at most 120 characters. They render as Markdown,
  and the details expand.
- A selected preset, legacy free text, and free text typed on a preset question all save through the existing
  `/questions/:i/answer` flow, in the browser.
- Headings, lists, code, links and emphasis render without raw markers. `javascript:` links and `<script>` are not rendered.
- Malformed option lines degrade: empty or over-long labels are skipped and unclosed Markdown stays literal text.
  If every option is invalid, the question keeps its exact legacy shape.

## Screenshots

- `screenshots/{360,390,1280}-{light,dark}-{en,fr}-{note-closed,composer-open,decisions-collapsed,decisions-expanded}.png` (48 files).
- `regression/screenshots/{framed,show-all,filtered,filtered-show-all}-{360,390,1280}-*.png` (the new probe) and
  `regression/screenshots/{focus-*,filter-applied-framed,m4-entry-points,m5-legend}-*.png` (the old probe).
- The remaining files in `screenshots/` come from the delivery smoke (list, canvas, sheets, sidebar, filters, dependency, brand, settings).

## `npm test`: HEAD vs the released base `d1eef33`

The repository has no lockfile, so the throwaway detached worktree at `d1eef33` reused this worktree's
`node_modules` through a symlink. `git diff d1eef33 HEAD -- panel test` is empty, and
`panel/core.ts` and `test/stage1-dual-mode-and-scoping.test.js` have identical md5 sums in both trees.

| tree | full `npm test` | failing test | load at start |
|---|---|---|---|
| HEAD `aa9e1e3` (V4-2) | 617/618, EXIT 1 | `scale-and-adversarial`: 5,000 checkboxes, 59.39ms | 8.64 |
| HEAD `aa9e1e3` run 2 | 617/618, EXIT 1 | same test, 59.01ms | 6.96 |
| base `d1eef33` | 618/618, EXIT 0 | — | 7.20 |
| base `d1eef33` run 2 | 618/618, EXIT 0 | — | 5.01 |
| HEAD + 410 fix | 617/618, EXIT 1 | `panel-simple-views:290` quick capture, reading `'payload'` of undefined | 12.75 |

- The 50 ms assertion is wall-clock inside a suite that runs files in parallel. The test passed 5/5 in
  isolation on both trees at load 6.7–7.1. A direct 1,000-item parse loop over the same five parsers
  measured 8–40 ms on both trees with no consistent ordering.
- `panel-simple-views.test.js` alone in an alternating window at load 11.5: base failed 3/3, HEAD failed 2/3.
  The test file last changed in `c9fb61b` (2026-10-29) and `panel/` in `7b7bbc5` (2026-11-02); both are
  ancestors of `d1eef33`.
- One full web-suite run cancelled `web/tests/app.test.mjs` at a 30 s timeout under load 7.5; that file
  passes 42/42 alone.
- Verdict: a pre-existing, load-sensitive flake, not a V4-2 regression. No assertion was changed or skipped.
  A green `npm test` is still not demonstrated.

Logs: `logs/npm-test-head.log`, `npm-test-head-run2.log`, `npm-test-base.log`, `npm-test-base-run2.log`,
`npm-test-head-after-fix.log`.

## Hostile review of `5430f36` and `b0718cc`

| # | severity | finding | evidence | outcome |
|---|---|---|---|---|
| 1 | High | A GitHub 410 Gone comment refusal was reported as 502 `note_outcome_unknown` with `noteSent: true`, so the user was told the note might exist when it definitely did not. | Probe with a 410 `commentHook` returned 502 / `noteSent: true`. `kindForStatus` had no 410 branch, so it fell through to `server`. | **Fixed.** 410 maps to `not_found`. Test "a 410 Gone comment refusal is definite, never an unknown outcome"; before the fix the same request returned 502. |
| 2 | Medium | A non-standard 422 (`errors[].message`, no `resource`/`field`/`code`) is reported 502 `note_outcome_unknown`, although GitHub rejects that shape before committing. | Probe `422-odd`. `kindForStatus` trusts only the documented validation contract. | Not fixed. A proxy or gateway 422 is indistinguishable; claiming "nothing was saved" would be a guess. The README claim is narrowed to the documented shape. |
| 3 | Low | `issueNotesCache` grows without eviction, keyed per repository#issue. | `app.ts` Map; the key lowercases the full name, so no case variants. | Not fixed. No pressure observed; bounded by issues read in one process. Recorded. |
| 4 | Low | Above 100 comments the note count comes from the last page only, so it can understate the total. | `readIssueNotes` sets `noteCountPartial` when page > 1 or the page is full. | Not fixed. Displayed as a floor, never as exact; at most 20 notes are shown. |
| 5 | Info | A CSRF failure on the note route shows the generic forbidden page. | The route calls `requireCsrf`; every write route shares this. | Not fixed: pre-existing for all writes, outside this increment. |
| 6 | Info | Any commenter can spoof the note marker as the first line. | `parseNoteComment` trusts the marker; the author login and timestamp are displayed and the body is escaped by the escape-first Markdown renderer. | Not fixed: no server-side privilege gained; the note is shown as that author's. |
| 7 | Info, verified OK | ETag reuse across repositories or issues. | Two issues got separate ETags and separate 304s on re-read; no cross-issue reuse. | No change. |
| 8 | Info, verified OK | Multi-repository note route authorization. | `POST /api/repos/other/place/issues/1/notes` returns 400 `repository_not_allowed`; the registry rejects repositories outside the configured set. | No change. |
| 9 | Info, verified OK | Lock release on every error path. | `withIssueLock` releases in `finally`; every note failure throws inside `runLocked`. | No change. |
| 10 | Info, verified OK | Body limits. | 64 KB request cap (413) and a 4000-character note cap (400), both before any GitHub write. | No change. |
| 11 | Info, verified OK | Composer focus return, draft retention, double send, i18n, CSP, button label. | Browser probes: `escapeFocus`, `draftSurvivesClose`, `doubleSend.commentsCreated 1`, 0 CSP violations. 213 EN and 213 FR keys, none missing. The add control is a text button, with no inline `style=` added. | No change. |
| 12 | Info, verified OK | Decisions parser backward compatibility and Markdown XSS. | Legacy free text saves; preset selection saves; `javascript:` links and `<script>` do not render; raw markers absent; malformed option lines degrade. | No change. |
| 13 | Info, partly verified | Radiogroup keyboard behaviour. | Options are native radios sharing one `name` inside `role="radiogroup"`, so arrow keys are the browser's native behaviour; the browser probe asserted the group exists, not arrow-key movement. | No change; no separate arrow-key automation was run. |



- Production, real GitHub, or any live or deployed instance.
- Safari, Firefox, a physical phone, or a screen reader.
- A board with 1000 cards.
- A green `npm test`.
