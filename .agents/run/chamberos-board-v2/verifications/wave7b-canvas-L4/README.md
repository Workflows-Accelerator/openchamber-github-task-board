# Wave 7b canvas flow — hostile L4 verification

Commit under review: `f66ce54` (`4fba1fd..f66ce54`, one commit).
Branch: `feat/wave7b-canvas-l4` (separate from `feat/wave7-overhaul`; not merged).
Review date: 2026-11-14.

## Verdicts

| Field | Verdict |
|---|---|
| SPEC_VERDICT | **FAIL as received**, PASS after the P1 note fix in this review |
| QUALITY_VERDICT | PASS AFTER FIX; two P2 behavioural risks remain |
| PUBLISH_VERDICT | **NO** — not merged, no browser proof, P2 notes open |
| TEST_WEAKENING | **UNPROVEN** — no before/after exists in git; four final assertions are non-behavioural and one passed while the app was broken |

## 1. The "4 wrong spec assertions" claim — UNPROVEN

The worker's claim cannot be proved or disproved from repository evidence:

- `git show --name-status f66ce54` shows the test file as **added whole** (`A web/tests/wave7b-canvas-flow.test.mjs`), not modified.
- `git log --all --oneline -- web/tests/wave7b-canvas-flow.test.mjs` returns only `f66ce54`.
- The worktree reflog has no amend (`f66ce54 HEAD@{...}: commit`, then `reset: moving to HEAD`).
- `git fsck --lost-found` found no dangling commit or blob containing `wave7b-canvas-flow` or `W7b flow graph`.
- There is no stash and no other ref containing the file.

Therefore **no before/after can be quoted**. The four assertions the worker says it changed cannot be identified; the claim rests on worker testimony only.

To still judge the substance, these are the four weakest final assertions that carry the claim's weight. "Before" is unavailable for all four; "After" is the committed line.

| # | After (committed) | Verdict |
|---|---|---|
| 1 | `assert.match(js, /renderCanvasNotes\(\)/, 'sticky notes still render');` (line 573) | **WEAK / misleading.** A source-presence regex. It passed while the app rendered sticky notes for cards hidden inside collapsed groups (P1 below). It proves nothing about attachment or collapse behaviour. |
| 2 | `assert.match(js, /if \(!board\) return;/, 'empty board failure state kept');` (line 574) | **WEAK.** Presence regex; never sets `state.board = null` or inspects `#empty-state`. |
| 3 | `assert.match(js, /worldStep\s*=\s*baseStep\s*\*\s*4;/, 'two-stop dot grid kept');` (line 572) | **WEAK.** Checks a source line, not the transform or background-size maths. The grid is unchanged from `4fba1fd`, so the assertion is true but non-verifying. |
| 4 | `assert.deepEqual(layout.positions[`${REPO}#2`], { ...layout.positions[`${REPO}#2`], x: 640, y: 320 }, 'manual position wins');` (line 467) | **SELF-REFERENTIAL.** The expected value is a spread of the actual value, so it only checks that the position exists and has x/y; it cannot detect wrong `w`, `h`, `groupKey` or extents. |

Conclusion: the final test file is not a reliable proof that app code was not weakened. Several assertions are source-text checks that survive broken behaviour. The claim "fixed in the test file, not by weakening app code" is **not established**.

## 2. Flow graph

### 2.1 DOM cost with 345 issues / 27 repositories — PASS

Fixture: 345 issues, 27 repos, first 4 issues per repo parented, all groups collapsed, 1280 px viewport, `renderCanvasIssues` exercised through the vm harness.

| Metric | Value |
|---|---|
| Groups | 54 (27 repos × parent + standalone) |
| Card elements created | **0** |
| Group-card elements | 54 |
| Group-frame elements | 0 |
| Element nodes under `#canvas-cards` | **864** (16 per group card average; text nodes excluded by the harness) |
| Layout time | ~57 ms in the vm harness |

`renderCanvasIssues` still iterates all 345 issues, but it appends a card only when `state.canvasFlowPositions[key]` exists; collapsed groups expose no positions. No per-card DOM cliff. The group-card node cost is bounded by group count, not issue count.

### 2.2 Wires into collapsed groups — PASS

`arrangeFlowGraph` maps a hidden endpoint to `group:<groupKey>` and terminates the wire on the group box. Added regression test `W7b flow graph: a dependency into a collapsed group ends on the group box, not a hidden card` asserts the wire ends at `{ x: group.x, y: group.y + group.h / 2 }` and that the hidden card has no position. `renderFlowEdges` draws group wires before the card loop and skips card-to-card pairs owned by `renderCanvasWires`. No dangling or duplicate wires found.

### 2.3 Real `parentKey` data — PARTIAL (P2)

`web/server/app.ts:1666-1671` fills `row.parentKey` / `parentTitle` from `listRepositoryDependencies()`, and `flowCardInput` consumes them. This is real, not a permanent "Standalone" fallback.

Limitation (pre-existing, introduced in `4fba1fd`, outside the reviewed commit): the GraphQL query in `web/server/github.ts:1048` is `issues(first: 100, ...)` with no pagination. In a repository with more than 100 issues, issues beyond the first 100 never receive `parentKey`, so their cards fall into the standalone group even when they have a parent. With 345 issues this silently mis-groups the tail of large repositories. If GitHub rejects the `parent` field, `parentCapability.supported = false` and every group becomes standalone; that is detected and degraded honestly, but not surfaced in the canvas UI.

### 2.4 Pan / zoom / dot grid — PASS

`updateCanvasTransform` (`app.js:2782-2807`) is byte-identical to `4fba1fd`: `worldStep = baseStep`, `* 4` below 0.35 scale, `* 2` below 0.65, `backgroundSize = worldStep * scale`, `backgroundPosition = pan`. The diff only added `.canvas-group-card` / `.canvas-group-frame` to the framing selector. No growth with card count.

### 2.5 Sticky notes — **P1, FIXED**

Defect: `renderCanvasNotes` iterated every issue in `state.currentCanvasIssues`, including cards with no flow position (inside a collapsed group). Their notes were appended to `#canvas-notes` at stale absolute coordinates with a connector line to a card that does not exist. On the 345/27 fixture, 54 notes rendered while all 54 groups were collapsed.

Failing test added first (`W7b client: a collapsed group does not leave its sticky notes floating without their card`): before the fix it reported `expected 0, actual 2`; after the fix it passes and expanding the group restores both notes.

Fix (`web/public/app.js`): `canvasIssueIsVisible(issue)` returns true only when `state.canvasFlowPositions` has the issue key; `renderCanvasNotes` skips hidden issues. Notes for visible cards still follow layout moves through `syncIssueNotesToPosition`, and drag still shifts them by the same delta.

## 3. Layout persistence

- **PATCH frequency — PASS.** A drag writes once on `pointerup` (`saveCardPosition`), not on every `pointermove`; `pointermove` only moves DOM and wires. No debounce is needed and no drag storm reaches the server.
- **Out-of-order response race — P2.** `persistCanvasLayout` applies every response through `applyServerLayout`, which replaces the whole `canvasManualPositions` object. The server serialises patches, but HTTP responses can arrive out of order; a slower older response can overwrite a newer local position until the next reload. No request sequence or generation guard exists. Low probability, self-healing on reload.
- **Failure feedback — PASS.** `canvasLayoutFailureMessage` maps 401 / 403 / other to EN/FR dictionary strings; drag failure also rolls back the card, notes and manual position and re-renders wires/notes. Toggle and direction failures call `setNotice` with the same localised message.
- **`order: null` reset — PASS with P2 cosmetic note.** `stripOrderMarker` removes the marker line and leaves the rest of the body intact (verified for LF, CRLF, marker at start/middle/end, fenced marker untouched). A set→reset cycle on a body ending in a single newline leaves one extra trailing blank line because `setOrderMarker` inserts a blank separator before the marker; content is unchanged but the body is not byte-identical. Existing coverage only asserted marker removal; this review added content-preservation assertions.
- **Zero GitHub writes on drag/arrange — PASS.** `saveCardPosition` calls only `persistCanvasLayout({ setPositions })`; `executeArrange` and `undoLastArrange` call only `persistCanvasLayout({ resetPositions, ... })`. No `saveIssueCanvas`, no `/canvas` endpoint, no issue PATCH in the drag path. Server test asserts `fake.patchCalls.length === 0`.

## 4. CSP and product invariants — PASS

- Zero `style="` attributes in all five changed source files; zero inline `<style>` added. `style-src 'self'` unchanged at `web/server/app.ts:130`.
- Pre-existing `<noscript><style>` at `index.html:14` is blocked by `style-src 'self'`; it predates this commit and was not added here (P2 note only).
- Zero `n8n`, zero `mobile`, zero Extended_Pictographic characters in the five changed files (checked with Node, not locale-sensitive grep).
- `#empty-state` is untouched when `state.board === null`: `renderBoard` returns at `app.js:6315` before any empty-state write.
- Active ring: `.canvas-card-agent-active::before` rotates; `.canvas-card-in-progress-idle` has no animation and a distinct left bar. `@media (prefers-reduced-motion: reduce)` sets `animation: none` for both ring and badge.

## 5. Server route and service worker — PASS with P2 coverage note

- `/flow-layout.js` served with `text/javascript; charset=utf-8` from `STATIC` before sign-in; test asserts 200, content type, `export function arrangeFlowGraph`, `globalThis.arrangeFlowGraph`, and CSP `script-src 'self'`.
- Added to `SHELL_ASSETS` and to `isShellRequest` (`pathname === '/flow-layout.js'`), so it is pre-cached and network-first. No stale-cache path found; `CACHE_VERSION` stays `2.1.0` but install `addAll` refreshes the same cache.
- `web/tests/sw.test.mjs` was **not** updated: it still lists `markdown.js` and `arrange.js` but not `flow-layout.js`. No assertion was deleted or weakened; the new file is covered by the Wave 7b test instead. P2 coverage gap, not a weakening.

## 6. Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F1 | **P1** | Sticky notes rendered for cards hidden inside collapsed groups, floating at stale coordinates with dead connectors | Fixed in this review, failing test first |
| F2 | P2 | Layout PATCH responses applied without sequencing; an older response can overwrite a newer manual position | Recorded |
| F3 | P2 | Parent enrichment capped at `issues(first: 100)` per repository; tail issues silently become standalone groups on large repos | Recorded (pre-existing, `4fba1fd`) |
| F4 | P2 | `order: null` after a set leaves one extra trailing blank line (content preserved, not byte-identical) | Recorded; test strengthened |
| F5 | P2 | `sw.test.mjs` does not assert `/flow-layout.js`; coverage lives only in the Wave 7b test | Recorded |
| F6 | P2 | Four final test assertions are source-presence / self-referential and passed while F1 was broken | Recorded |
| F7 | P2 | Dead `state.canvasProjectBands` branch remains in `renderCanvasNotes`; never assigned after the column rewrite | Recorded |
| F8 | P2 | Pre-existing `<noscript><style>` is blocked by strict CSP | Recorded, out of scope |

## 7. Commands and counts

| Command | Result |
|---|---|
| `node --test --test-timeout=60000 web/tests/wave7b-canvas-flow.test.mjs` | **20/20 pass, exit 0** (17 original + 3 added) |
| `node --test --test-timeout=60000 web/tests/*.test.mjs` | **835/835 pass, exit 0** (baseline 832 + 3) |
| `npm test` | **618/618 pass, exit 0** |
| `npm run typecheck` | exit 0 |
| `npx tsc -p web/tsconfig.json --noEmit` | exit 0 |
| `npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave7b-l4-app.js` | exit 0, 439.2 kb |

## 8. Not verified

- No real browser rendering or Chromium screenshot; DOM node count comes from the vm harness and excludes text nodes.
- No real GitHub repository; parent-key coverage and the 100-issue cap were read from source, not exercised against live data.
- The four assertions the worker says it changed could not be identified (no historical version exists).
- No merge, push, deploy or real GitHub write was performed.
