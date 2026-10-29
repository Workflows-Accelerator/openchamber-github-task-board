# Deep Verification Result — Correction Round 1 (Issue #48 Extension Panel)

**Task:** Resolve all independent L4 hostile review findings (`C1`, `C2`, `H1`, `H2`, `H3`, `M1`, `M2`, `M3`, and L5 disclosure for `M4`) on `feat/issue-48-panel-simple-views` (base `cc083796c4bf62b57aaa76e2908f8b5cd47347dd`, prior candidate `253f9f23e4b4eda7f39ca0a059dff3a21e33eb84`, new candidate `c9fb61b8f4d7fa2178481abaff588b2e23b8380e`)
**Status:** PARTIAL (L0–L4 PASS; L5 AWAITING HUMAN)
**Spec Compliance Verdict:** PASS (all required Round 1 rulings `C1`, `C2`, `H1`, `H2`, `H3`, `M1`, `M2`, `M3` implemented and verified; `M4` disclosed for L5 sign-off per D52)
**Quality Verdict:** READY
**Doubt-Driven Verdict:** PROCEED TO INDEPENDENT RECHECK / L5
**Model:** `9router/genius`
**Timestamp:** 2026-10-29T15:18:00Z

### Executed Levels
- **L0 Static:** PASS
  - `npm run typecheck` -> `exit 0` (`.agents/run/issue-48-panel-correction/verifications/logs/typecheck.log`)
  - `npm run build:panel` -> `exit 0` (`.agents/run/issue-48-panel-correction/verifications/logs/build.log`)
  - `npm run build:panel -- --outfile=.agents/run/issue-48-panel-correction/verifications/scratch/main.js && cmp panel/main.js .agents/run/issue-48-panel-correction/verifications/scratch/main.js` -> `exit 0` (0 byte delta)
  - `git diff --check` -> `exit 0`
- **L1 Unit:** PASS
  - `node --test --test-concurrency=1 test/*.test.js` -> `exit 0`, `595/595` passed (`0` failed, `0` skipped) (`.agents/run/issue-48-panel-correction/verifications/logs/unit-tests.log`)
  - `node --test test/shipped-parity.test.js` -> `exit 0`, `18/18` passed (`0` failed) (`.agents/run/issue-48-panel-correction/verifications/logs/shipped-parity.log`)
- **L2 Integration (Harness + Fake Host/GitHub):** PASS
  - `node --test test/panel-simple-views.test.js` -> `exit 0`, `16/16` passed
  - `node --test test/viewstate.test.js` -> `exit 0`, `25/25` passed
  - `node --test test/dependency-graph.test.js` -> `exit 0`, `13/13` passed
  - `node --test test/layout-and-views.test.js` -> `exit 0`, `19/19` passed
- **L3 End-to-End Browser (`panel/index.html` + `panel/main.js` in headless Chromium):** PASS
  - `node .agents/run/issue-48-panel-correction/verifications/browser.mjs` -> `exit 0`, `28/28` checks passed, `0` `pageerror`, `0` console error/warning (`.agents/run/issue-48-panel-correction/verifications/logs/browser-results.json`)
- **L4 Adversarial Verification:** PASS (all 8 code findings closed with red-before-green regressions and Chromium runtime checks)
- **L5 Human Verification:** AWAITING HUMAN (visual simplicity, narrow `360px` truncation tradeoffs, and explicit `M4` removed-control sign-off)

---

### Disposition of Ranked Hostile Findings (`C1`, `C2`, `H1`–`H3`, `M1`–`M4`)

| ID | Severity | Status | Fix & Verification Evidence |
| --- | --- | --- | --- |
| **C1** | Catastrophic | **CLOSED** | `computeMove` (`panel/viewstate.ts:316-411`) now returns `MoveWrite[] \| null` (`Array<{ index, order }>`), using a single midpoint write when neighbours are distinct, lazily assigning `ORDER_GAP = 1000` markers when `firstUnmarked !== -1 && lastMarked <= to`, and rebalancing the minimal contiguous span when neighbour markers are equal or precision-exhausted. `reorderDraft` (`panel/main.ts:4001-4071`) switches `viewState.sort` to `'manual'` and performs the move on the first gesture (unless switching sort already moved the item in the requested direction), reloads each participating issue via `reloadIssueBeforeMutation`, and sequentially applies conflict-safe `updateIssueBody` writes, aborting remaining writes on conflict/failure and reconciling partial writes cleanly. Refusal tests in `test/viewstate.test.js` and `test/panel-simple-views.test.js` were replaced with lazy-initialisation, rebalance, exhaustive permutation, and partial-failure reconciliation tests. Verified in Chromium (`C1-unmarked-down` and `C1-marked-first-gesture-and-create` in `browser-results.json`). |
| **C2** | Catastrophic | **CLOSED** | `transferDraftProject` (`panel/main.ts:4073-4191`) validates `targetRepo` against `availableProjectRepos()`, blocks in-flight mutations/reorders/unconfirmed issues, and requires `window.confirm` naming the source/target project and warning that issue number/URL may change before any network call. On Cancel, `select.value = repo` and `select.title = repo` are restored with `0` network calls. On confirmed transfer, fresh issue/repository node IDs are fetched, `transferIssue` is executed, and `issueWriteTrackers.delete(key)` + `admitIssueRecord` update the canonical identity. On ambiguous `POST /graphql` failure (`graphqlStarted && !isDefinitivePreCommitRejection(err)`), `(issue as any).unconfirmed = true` is set on the issue and `findIssueRecord(repo, issue)`, locking the row (`.simple-row-unconfirmed`, `.badge-unconfirmed`, disabled controls) until refresh reconciles source and target, with no auto-retry. Verified in `test/panel-simple-views.test.js` and Chromium (`C2-saved-project-change-cancel`, `C2-confirmed-and-unconfirmed-lock`). |
| **H1** | High | **CLOSED** | `.filter-popover` (`panel/index.html:3429`) is left-anchored (`left: 0; right: auto; max-width: calc(100vw - 16px)`) and dynamically clamped inside the viewport on open (`panel/main.ts:9056-9076`). Verified in `test/panel-simple-views.test.js` and Chromium at `360x780` (`H1-filter-clamped-360`: `popoverBox.x = 8`, `width = 320`, `chipBox.x = 18`, screenshot `filter-popover-360.png`). |
| **H2** | High | **CLOSED** | `findTerminalUnfencedOrderMarker` (`panel/viewstate.ts:74-156`) tracks CommonMark backtick/tilde code fences and matches/strips/sets only a terminal unfenced `<!-- board-order: N -->` marker at the end of the body, preserving `\r\n` vs `\n`, multiple blank lines, and trailing Markdown hard-break spaces. `editDraftDescription` (`panel/main.ts:3964-3999`) and drawer description edit (`panel/main.ts:9715-9721`) handle browser `<textarea>` `\r\n` -> `\n` normalisation without spurious `PATCH` writes or CRLF loss. Verified in `test/viewstate.test.js`, `test/panel-simple-views.test.js`, and Chromium (`H2-fenced-inline-body`, screenshot `fenced-sample-preserved.png`). |
| **H3** | High | **CLOSED** | `buildDependencyGraph` (`panel/core.ts:2796-3158`) is self-contained for `shipped-parity.test.js` extraction and keys `graph.nodes` by repo-qualified identity (`${repo}#${number}`) via `DependencyNodeMap` while preserving numeric fallback lookup (`graph.nodes.get(1)`) and scoping unqualified `#N` blocker references to the same repository. `renderGraphView` (`panel/main.ts:6473-6520`) keys `visibleNumbers` by `${getIssueRepoFullName(i) || ''}#${i.number}`. Verified in `test/dependency-graph.test.js`, `test/layout-and-views.test.js`, `test/shipped-parity.test.js`, and Chromium (`H3-graph-same-number`: all 7 issues including both `#1`s across repos render in All Projects Graph view, screenshot `graph-all-projects-both-visible.png`). |
| **M1** | Moderate | **CLOSED** | Editable draft rows in `renderSimpleListView` (`panel/main.ts:3792-3820`, CSS in `panel/index.html:3446-3449`) render compact accessible Move Up (`.simple-move-up`, `↑`) and Move Down (`.simple-move-down`, `↓`) buttons with `aria-label` and boundary/busy `disabled` states calling `reorderDraft(issue, sorted, rowIndex +/- 1)`. Verified in `test/panel-simple-views.test.js` and Chromium (`M1-move-up-button`, screenshot `draft-360.png`). |
| **M2** | Moderate | **CLOSED** | `pendingDraftEdits`, `snapshotDraftElementFocus`, `restoreDraftElementFocus`, and `isRenderingSimpleListView` (`panel/main.ts:3530-3755`) preserve unsaved title/description text, cursor selection, and next-focus targets (`Tab` from `.simple-title` to `.simple-description`) across `renderViews()`, ignore DOM-teardown and `#btnRefresh` blurs so refresh during typing neither loses text nor fires a spurious `PATCH`, and retain unsaved description text when `editDraftDescription` fails. Verified in `test/panel-simple-views.test.js` and Chromium (`M2-title-tab-focus`, `M2-failed-description-value`, `M2-refresh-during-typing`). |
| **M3** | Moderate | **CLOSED** | `compareManualOrder` (`panel/viewstate.ts:226-237`) and `byNumberDesc` (`panel/viewstate.ts:530-534`) compare `(a.repo || '').localeCompare(b.repo || '')` before `issue.number`. Verified in `test/viewstate.test.js`. |
| **M4** | Moderate | **DISCLOSED FOR L5** | Per manager ruling on D52 (`issue-48-panel-hostile-review-gate.md`), legacy toolbar controls are intentionally not re-added. Exact removed controls are itemized below for explicit human sign-off at L5. |

---

### L5 Human Handoff & Explicit Disclosure (`M4`)
1. **Intentional Control Removals Requiring Human Sign-off (`M4` / D52):**
   - Cards/List toolbar **Priority filter**, **Tag filter**, and **Group-by** selector (`none` / `priority` / `status` / `tag` / `project`).
   - **"Select All with Tag"** (`#btnSelectByTag`) batch-selection helper button.
   - Graph-local **"Show Done"** toggle (`#graphShowDone`, replaced by shared `Filter -> Stage: Done` chip) and **Graph Theme (`theme:*`) filter** dropdown (`#graphThemeSelect`).
   - Attention category sub-filter pills (`attention:needs-decision`, `attention:needs-permission`, `attention:needs-review`) and `Blocked` / `Unassigned` quick-preset buttons.
   - `All Tasks` collapsible stage-grouped section headers (`allTasksSectionHeader`) inside Pending items.
2. **Narrow Viewport (`360px`) Visual Tradeoffs Inspected:**
   - First draft row starts near `y ≈ 180–200px`, showing ~4–5 rows above the sticky quick-capture add bar.
   - In All Projects mode at `360px`, the per-row project `<select>` and compact `↑`/`↓` reorder buttons share the row with `.simple-content`, narrowing the inline title width before ellipsis.

### Explicit Blind Spots (Not Claimed as Verified)
- Installed OpenChamber desktop/web host runtime (tested via synthetic `openchamber.sdk` iframe `postMessage` host harness in headless Chromium).
- Live GitHub REST / GraphQL endpoints and real OAuth/PAT credentials (tested against deterministic in-process fake REST/GraphQL fixtures).
- Assistive technology / screen-reader announcement behavior (`aria-label` and `aria-busy` attributes verified in DOM, not tested with VoiceOver/NVDA).
