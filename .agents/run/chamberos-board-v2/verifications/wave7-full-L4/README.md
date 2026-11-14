# Wave 7 full — hostile L4 review (7a + 7b + 7c)

Commit under review: **`1d11287`** (`5edb450..1d11287`), branch `feat/wave7-full-l4`.
Worktree: `.worktrees/workflows-accelerator-agent-dev-wave7-full-l4`.
Review date: 2026-11-14. Nothing pushed, deployed, merged or written to GitHub.

| Field | Verdict |
|---|---|
| SPEC_VERDICT | **FAIL as received, PASS after three fixes in this review.** 7c's headline claim — one "needs me" count — was false on the canvas: the sidebar badge said 8, the canvas group said 6. |
| QUALITY_VERDICT | **PASS AFTER FIX.** No P0. Two P1 (one count divergence, one phone-navigation regression) fixed with failing tests first; five P2 found, one fixed here, four recorded. |
| PUBLISH_VERDICT | **YES after this branch is merged** — no P0, both P1s fixed and mutation-proven, 859/859 and 618/618 green, real-browser proof at 390/1280 in EN and FR. |
| TEST_WEAKENING | **None found.** 7c edited four earlier suites; every edit adds assertions, converts source regexes to behaviour, or updates copy that the fix changed. Detail in §5. |
| BROWSER_PROOF | **RAN.** Chromium 156.0.8078.4 restored without installing anything system-wide. 13 PNGs in `screenshots/`. |

## 1. What was run

| Item | Value |
|---|---|
| Engine | `chrome-headless-shell` 156.0.8078.4, headless, `serviceWorkers: 'block'`, `reducedMotion: 'reduce'` |
| Data | `web/tests/fake-github.mjs` + `web/tests/helpers.mjs` `startBoard` — the 15-issue usability-audit fixture, rebuilt exactly (`verifications/usability-audit-2026-11-13/scripts/audit.mjs`) |
| Surfaces | list, Decisions, Blocked, canvas collapsed and expanded, drawer question gate, calm drawer, compact dock |
| Matrix | 390x844 and 1280x900, light and dark, EN and FR |
| Harnesses | `/tmp/opencode/w7-l4/{measure,measure2,contrast,final-capture,probe-*}.mjs` |
| Records | `measurements.json`, `measurements2.json`, `contrast.json`, `final-capture.json`, `dock3.json` |

### Chromium, restored without root

The container ships no browser libraries. The runtime was rebuilt entirely under
`/tmp/opencode`, exactly as `V4-2/scripts/browser-env.sh` did:

1. `curl` of `https://deb.debian.org/debian/dists/bookworm/main/binary-amd64/Packages.gz`;
2. per package, the first `Filename:` looked up in `Packages`, the `.deb` fetched and
   `dpkg-deb -x` extracted into `/tmp/opencode/chromium-deps/root` — 47 packages,
   including `libglib2.0-0`, `libnss3`, `libgbm1`, `libcups2`, `libasound2`,
   `libpango-1.0-0`, `libcairo2` and `fonts-dejavu-core`;
3. `LD_LIBRARY_PATH` and a generated `FONTCONFIG_FILE` pointing at the extracted tree.

`chrome-headless-shell --version` → `Google Chrome for Testing 156.0.8078.4`.
Nothing was installed into the system package database; the workspace was not
modified by the setup. The process ran as root, which is why no `sudo` workaround
was needed.

## 2. Audit findings #1–#17, one by one

Verdicts are from code reading **plus** a browser measurement, never from 7c's own
report. "Behavioural" means a rendered DOM was read; "source" means a string or
regex assertion, which is called out in §3.

| # | Verdict | Evidence |
|---|---|---|
| 1 Canvas fit at 390 | **CLOSED** (7b) | First canvas paint at 390 is `scale 1`, one collapsed group card, group title 13 px, counts 11 px, zero card text. The old 20 % fit is gone. |
| 2 Three numbers for "needs me" | **CLOSED after fix** | Sidebar 8, filter "Needs me" 8, canvas group 8 at 390 and 1280, EN and FR. Before the fix the group said 6 (see §4). The three scopes are now three labels: "Needs me" (attention), "Blocked & waiting" (view, 7), "Blocked by dependencies" (filter, 1). |
| 3 Progress outside the drawer | **CLOSED** | List rows `#104 0/1`, `#108 0/2`, `#112 0/2`, `#114 1/1`; canvas cards `0/1`, `0/2`, `0/2`, `1/1`; collapsed group `0/2 checklist`, `1/4 questions`. Values read from the rendered DOM, not the source. |
| 4 Missing vs malformed | **CLOSED** | Distinct titles, helps and reasons in EN and FR: "The review item is broken" vs "did not attach a review item"; reason "The artifact URL must be an http:// or https:// link of at most 2048 characters, with no spaces." List badge for #106 differs from #105. |
| 5 Reviewable-link filter | **CLOSED** | `matchesExtraFilter(issue,'artifact')` over the real payload returns exactly `[101,102,103]` — the three ready image/video/link artifacts, and nothing else. |
| 6 Four labels for one state | **CLOSED** | The duplicate status badge is suppressed when a gate exists; the 390 drawer now reads `open · Task Board · execution phase · Needs a decision` above a single gate heading. |
| 7 Answer above the fold | **CLOSED, behaviourally measured** | 390x844 with Details **and** the free-text field open: Answer at 760–804, `aboveFold: true`, `position: sticky`, hit-test `BUTTON.button primary`. FR: Répondre 760–804. At 1280: 767.5–811.5 (EN), 790–834 (FR). |
| 8 Dark status badge contrast | **CLOSED** | Recomputed from computed styles with correct alpha compositing: dark `8.37:1` (claim 8.35), light `13.1:1` (claim 13.15) at 11 px. |
| 9 Canvas counters | **CLOSED** | The counters are now ratios, not "N q": canvas badge dark `6.8:1`, status chip `7.26:1`, needs-human chip `8.15:1`, group count `7.26:1`, malformed review line `5.75:1`. All pass AA at 10–11 px. |
| 10 FR vocabulary | **CLOSED after fix** | Chrome was French but values were not: `Phase : execution`. Now every phase and attention value has its own label (`Phase : exécution`, `Décision attendue`, `Revue attendue`, `Autorisation attendue`) and a table test covers all ten phases and three attention values. |
| 11 Decisions badge vs cards | **CLOSED** | Badge `2`, two cards `#104`, `#108`, each with its question count in the meta line. |
| 12 #109 twice in Blocked | **CLOSED** | Badge 7, seven cards, one group, `#109` once, dependency chip kept. |
| 13 Answered question on canvas | **CLOSED** | `#114` shows `1/1` with `data-pending="0"`; no "1 q", no pending tone. |
| 14 Raw schema reasons | **CLOSED** | Both reason strings are plain prose in EN and FR; no `###`, no `- URL:`. |
| 15 Calm drawer | **PARTIAL (P3)** | The panel now states "The agent is reviewing this task. Nothing is asked of you." — the improvement audit #15 asked for — but 11 actions remain inside the 390 viewport and the dependency block still closes on two negatives. Not addressed by 7c, not fixed here. |
| 16 Human-task count label | **CLOSED** | One label per language: `1 human action` / `2 human actions`, `1 action humaine` / `2 actions humaines`. |
| 17 Arrange at 390 | **Out of 7c scope** | Carried from `wave7b-canvas-L4`; not re-opened here beyond confirming `arrange-flow` 14/14 still passes. |

## 3. Weak closures

A closure is weak when only a string or regex proves it, or when the assertion
enshrines the defect.

| Finding | Why weak | What now proves it |
|---|---|---|
| **#10 FR** | The 7c test asserted `/Phase : execution/` in the French drawer — it locked the English value in. | Fixed here: a table test renders all ten phases and three attention values in FR, and the browser shows `Phase : exécution`. |
| **#7 sticky Answer** | The only automated check was a CSS source regex. | Now paired with the 390x844 measurement above (760–804, `aboveTheFold`, hit-test). The regex remains as a guard, labelled as such in the test comment. |
| **#8 / #9 contrast** | No automated contrast test exists at all; the 8.35 / 13.15 claim was unverified. | Recomputed here from computed styles. It is **still unguarded by CI** — recorded as P2. |
| **#5 filter** | The test calls the predicate; nobody clicked the filter sheet. | Predicate verified against the real payload in the browser (`[101,102,103]`). The sheet's own count path is the same predicate but was not clicked end-to-end. |

Everything else in §2 was proved by reading a rendered DOM or a measured box.

## 4. Cross-cutting: the count divergence (P1, fixed)

`web/public/flow-layout.js:430` counts a group's "needs me" as
`card.stage === 'needs-human'` — the only thing a layout module can see. The
canonical predicate `needsHumanAttention` (`app.js:2122`) also counts open
questions and open human tasks. On the audit fixture:

```
pre-fix   sidebar list-nav-badge = 8   canvas group = "6 needs me"    (390 and 1280, EN and FR)
post-fix  sidebar list-nav-badge = 8   canvas group = "8 needs me"
```

The layout module was left alone (it has no issue data); `renderCanvasIssues`
now overwrites `group.needsMe` from `groupNeedsMeOf(groupKey, issues)`, next to
the existing `groupProgressOf` override. Test:
`W7c counts: a canvas group counts "needs me" with the same rule as the sidebar`.

No other double-counting was found. One predicate (`needsHumanAttention`) drives
the sidebar badge, the "Needs me" filter and the canvas group; `isIssueBlocked`
drives the Blocked view and `blockerKeys` the dependency filter, and those two
now carry different labels. `#109` renders once.

## 5. Did 7c regress 7a/7b, or edit earlier tests?

Every earlier suite passes unmodified in behaviour:

| Suite | Result |
|---|---|
| `wave7b-canvas-flow` | 20/20 |
| `wave7a-server-wiring` | 16/16 |
| `layout` | 23/23 |
| `arrange-flow` | 14/14 |
| `session-activity` | 25/25 |
| `wave7c-progress-questions` | 24/24 (20 at HEAD, +4 from this review) |

7c touched three earlier suites. Each edit was read in full:

- `wave7b-canvas-flow.test.mjs` — the dot-grid / notes / empty-board **source
  regexes** were replaced by behaviour (grid step measured at three zooms, notes
  layer counted, `renderBoard` leaves the list untouched). A `deepEqual` on a
  position was replaced by five explicit assertions, which is stricter.
- `v4-3-client.test.mjs` — six copy assertions updated to the new distinct
  titles and plain-prose reasons (the change those tests exist to protect).
- `sw.test.mjs` — four assertions **added** for `/js-enabled.js` and
  `/flow-layout.js` in the cache list.
- `issue-54-no-signin-flash.test.mjs` — the old `<noscript><style>` regex was
  replaced by six assertions on the external no-JS script, the `no-js` class and
  the CSS reveal rule.

No assertion was deleted without a stronger replacement.

## 6. Mutation check — 17/17 caught

Each row reverts one fix in the working tree, runs the owning test file, restores
the file. Script: `/tmp/opencode/w7-l4/mutate.py`.

| Reverted fix | Caught by |
|---|---|
| Decisions badge counts questions again | test 4 |
| Blocked lists a dual-blocked task twice | test 5 |
| List row drops the checklist ratio | test 8 |
| Canvas card says "N q" again | test 9 |
| Collapsed group loses its progress ratios | test 10 |
| Reviewable-link filter ignores artifacts | test 18 |
| Layout PATCH has no revision guard | test 19 |
| `setOrderMarker` adds a newline (`web/server/board.ts`) | test 20 |
| Drawer repeats the gate status as a badge | test 14 |
| Malformed and missing share one title | test 12 |
| Human count label regresses | test 17 |
| Blocked filter label collides with the view | test 6 |
| Answer button is no longer sticky (`theme.css`) | test 16 |
| No-JS fallback script removed (`index.html`) | issue-54 test 7 |
| **Dock binds the long view title again (this review)** | test 22 |
| **French phase value reverts to English (this review)** | test 14 |
| **Canvas group needs-me rule reverts to stage-only (this review)** | test 3 |

**Unproven: none.** Two of the three new fixes are additionally proven by
measurement (the dock's 94 px cell, the FR drawer's `Phase : exécution`).

## 7. Fixes made in this review

1. **P1 — one "needs me" count.** `groupNeedsMeOf` in `web/public/app.js`;
   `group.needsMe` overwritten in `renderCanvasIssues`. Failing test written first
   (`not ok 3`), then fixed. Browser: 8 vs 8 at both widths and both languages.
2. **P1 — phone navigation collision.** 7c renamed `nav_blocked` from "Blocked"
   to "Blocked & waiting" ("Bloquées et en attente") and added dock badges; in the
   390 four-cell dock the label measured 111 px in a 94 px cell and spilled into
   the Decisions tab (`Décisions0Bloquées et en attent`). Fix: a dock-only
   `nav_blocked_short` ("Blocked" / "Bloquées") plus `overflow: hidden` and
   `min-width: 0` on the dock button and its label span. Failing test first;
   browser after: every cell 94/94, no overlap. Before/after in
   `screenshots/dock-390-fr-before.png` (long label + old cell reproduced in-page)
   and `screenshots/dock-390-fr.png`.
3. **P2 — French workflow vocabulary.** Per-value `phase_*` and `attention_*`
   labels in both dictionaries; `phaseText`/`attentionText` look them up with the
   old formatting as fallback. The 7c assertion that expected `Phase : execution`
   was corrected (it was enshrining the defect), and a table test added.

## 8. Findings recorded, not fixed

| Sev | Finding | Why not fixed |
|---|---|---|
| P2 | Tasks with acceptance criteria but no actionable subtasks show no ratio outside the drawer (`#101`, `#109`, `#110`, `#115`). `progressOf` reports subtasks only. | A second unlabelled ratio on the same row would create the ambiguity audit #2 is about; it needs a distinct label ("AC 0/3"), which is a design decision, not a hardening fix. |
| P2 | The list stage header still reads "Waiting for you 6" beside a sidebar "Needs me 8". | They are different scopes and now different words. Two numbers remain on one screen; a reader who compares them can still be puzzled. |
| P2 | No automated contrast test; the 8.35 / 13.15 claim can regress silently. | Adding a colour-ratio unit test needs a CSS-token parser; out of proportion for this review. |
| P2 | `npm test` failed once in ≥10 runs (`pass 617 / fail 1`); the failing name was not captured, and 9 subsequent runs were green. | Unreproduced. The suite logs `[TaskBoard] Project scan error` lines from fixtures; the flake may be a shared-path test. Not diagnosed. |
| P3 | `.agents/.../discovery-legibility/verify.mjs` aborts on a stale assertion (`#canvas-cards .canvas-card` count === 1) because 7b/7c open the canvas collapsed. | 32/32 rows passed before the abort; the script is stale, the product is not. Its 32 PNGs are in `/tmp/opencode/w7-l4/shots-discovery`. |
| P3 | Audit #15 calm drawer: 11 actions in the 390 viewport, two dependency negatives. | Copy/product decision, not a regression. |

## 9. Test counts

| Command | Result |
|---|---|
| `node --test --test-timeout=60000 web/tests/*.test.mjs` | **859/859 pass** (855 at HEAD + 4 added here) |
| `npm test` | **618/618 pass** |
| `npm run typecheck` | pass |
| `npx tsc -p web/tsconfig.json --noEmit` | pass |
| `npx esbuild web/server.ts ...` | pass (293.8 kb) |
| `npx esbuild web/public/app.js ...` | pass (449.8 kb) |

## 10. What is not verified

- **No live board.** Nothing was signed in against `board.workflows.ac`; every
  capture is synthetic and labelled as such. Production behaviour, real GitHub
  payloads, service-worker caching on a real device and Safari/Firefox are
  unverified.
- **No timed comprehension study.** "Under three seconds" is not measured here.
- **Drag, pan and zoom** were not exercised interactively beyond the fit/scale
  readings; 7b's pointer work is covered by its own suite.
- **The `npm test` flake** is unexplained.
- **Dark-theme screenshots** were measured but not all retained; the numbers are
  in `contrast.json`.

## 11. Reproduce

```bash
source /tmp/opencode/chromium-setup.sh          # or reuse /tmp/opencode/chromium-deps
export LD_LIBRARY_PATH=/tmp/opencode/chromium-deps/root/usr/lib/x86_64-linux-gnu:/tmp/opencode/chromium-deps/root/lib/x86_64-linux-gnu
export FONTCONFIG_FILE=/tmp/opencode/chromium-deps/fonts.conf
export H2_CHROME=/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell
node /tmp/opencode/w7-l4/final-capture.mjs      # sidebar vs group, 390/1280 EN/FR
node /tmp/opencode/w7-l4/measure2.mjs           # decisions, blocked, filter, canvas
node /tmp/opencode/w7-l4/contrast.mjs           # AA ratios in both themes
python3 /tmp/opencode/w7-l4/mutate.py           # 17/17
```
