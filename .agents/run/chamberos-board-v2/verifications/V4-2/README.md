# V4-2 verification: agent notes as GitHub comments, Markdown decision options

This branch is `feat/board-v3` and the base is `d1eef33`. Source commit `5430f36`, tests commit `b0718cc`. Every
run below used a synthetic preview against the fake GitHub in
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
| `node --test --test-timeout=30000 web/tests/*.test.mjs` | 669/669, EXIT 0 (baseline 631; 668 before the option fix, `web-tests-before-option-fix.log`) | `logs/web-tests.log` |
| `npm run typecheck` | EXIT 0 | `logs/typecheck.log` |
| esbuild client and server bundle check | EXIT 0 (401.4kb / 230.5kb) | `logs/esbuild.log` |
| `node scripts/browser.mjs` | pass true, 12 cases, 48 screenshots, EXIT 0 | `logs/browser.log` |
| `node scripts/framing-promise.mjs` | 12/12, EXIT 0 | `logs/framing-promise.log` |
| `DELIVERY_DIR=…/V4-2 node scripts/generate-delivery-smoke.mjs` | EXIT 0, real 6m11.8s, 14 sections, 191 captures (after option fix) | `logs/delivery-smoke.log`, `smoke.json`, timings in `logs/delivery-smoke-timing.log` |
| `npm test` (panel suite `test/*.test.js`) | **not green**: attempt 1 617/618, attempt 2 615/618, EXIT 1 | `logs/npm-test-attempt-1.log`, `logs/npm-test.log` |

`npm test` failures:
- `panel-simple-views` "quick capture… release is not a function" (attempt 1 only).
- `panel-simple-views:117` drawer description `0 !== 1` (attempt 2 only).
- `scale-and-adversarial` timing failures: 130ms > 100ms and 76ms > 60ms (attempt 2, load average about 12).

The failing set was different in each run. Every failing file imports only `panel/**`, and `panel/**` has no diff.
`panel-simple-views` passed 16/16 when run alone, twice. The two `test/` files that read `web/` source
(`web-drawer-parity`, `offline-drafts`) passed 12/12 when run alone. I did not re-run the full suite in a loop.

Delivery smoke attempts:
1. Missing `libglib-2.0.so.0`; exited 1 after 1.5 s.
2. Fontconfig `FATAL SkFontMgr_FontConfigInterface.cpp:163`, which caused a login-form timeout.
3. EXIT 0 in 5m13.9s with 14 sections. This was before the option fix; the log is kept as `logs/delivery-smoke-before-option-fix.log`.
4. After the option fix: EXIT 0 in 6m11.8s with 14 sections and 191 captures (`logs/delivery-smoke.log`).

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
- Empty and oversized notes get a 400 before any POST. Refusals 403 (forbidden or locked), 404 and 422 are honest and
  create nothing. On a lost response the client reconciles and creates no duplicate. A double send creates 1 comment.
  An unsent draft survives closing and reopening the drawer.
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

## Not verified

- Production, real GitHub, or any live or deployed instance.
- Safari, Firefox, a physical phone, or a screen reader.
- A board with 1000 cards.
- A green `npm test`.
