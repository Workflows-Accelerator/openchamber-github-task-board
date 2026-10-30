# Deep Verification Result

**Task:** Independent L4 Hostile Review of Issue #48 OpenChamber Extension Simplified Views, Quick-Capture Drafts, Short Project Names, Manual Order, and Project Transfer (`feat/issue-48-panel-simple-views`, candidate `253f9f23e4b4eda7f39ca0a059dff3a21e33eb84`, base `cc083796c4bf62b57aaa76e2908f8b5cd47347dd`)
**Status:** FAIL
**Spec Compliance Verdict:** FAIL
**Quality Verdict:** NEEDS-FIXES
**Doubt-Driven Verdict:** HALT
**Reviewer Model:** `9router/genius`
**Timestamp:** 2026-10-29T18:10:00Z

### Executed Levels
- **L0 Static:** PASS (`npm run typecheck` -> `exit 0`; `npm run build:panel -- --outfile=.agents/run/issue-48-panel-hostile/verifications/scratch/main.js` -> `exit 0`; `cmp panel/main.js .agents/run/issue-48-panel-hostile/verifications/scratch/main.js` -> `exit 0`; `git diff --check cc083796c4bf62b57aaa76e2908f8b5cd47347dd..253f9f23e4b4eda7f39ca0a059dff3a21e33eb84` -> `exit 0`)
- **L1 Unit:** PASS (`node --test --test-concurrency=1 test/*.test.js` -> `exit 0`, `590/590` passed; `node --test test/shipped-parity.test.js` -> `exit 0`, `18/18` passed)
- **L2 Integration:** PASS (Synthetic OpenChamber `postMessage` bridge + fake GitHub REST/GraphQL harness in JSDOM and Chromium exercised ETag preflight reloads, conflict/unconfirmed write guards, storage persistence, and All Projects aggregation)
- **L3 The User's Way (E2E / CLI / Browser):** FAIL (Headless Chromium Playwright harness `.agents/run/issue-48-panel-hostile/verifications/browser.mjs` -> `exit 0` after recording empirical failures in `.agents/run/issue-48-panel-hostile/verifications/logs/browser-results.json`: unmarked downward reorder refused, saved-draft project transfer fires with zero confirmation and allows blind retry after ambiguous failure, `360px` filter popover renders off-screen left at `x = -147`, fenced `<!-- board-order: ... -->` sample stripped and CRLF normalised, All Projects Graph view drops colliding issue numbers, inline draft edits lose focus/input on refresh or failed PATCH, and no touch/button reorder controls exist)
- **L4 Hostile Review (AI):** FAIL (2 Catastrophic, 3 High, 4 Moderate findings reproduced with exact `file:line` and browser/runtime proof — see Hostile Findings below)
- **L5 Human Validation:** AWAITING HUMAN (blocked on L4 fixes for #48 extension before batch L5 preview)

---

### Empirical Evidence ("The User's Way")

1. **L0 / L1 / Bundle Parity Verification:**
   - *Command:*
     ```bash
     npm run typecheck
     npm run build:panel -- --outfile=.agents/run/issue-48-panel-hostile/verifications/scratch/main.js
     cmp panel/main.js .agents/run/issue-48-panel-hostile/verifications/scratch/main.js
     node --test --test-concurrency=1 test/*.test.js
     node --test test/shipped-parity.test.js
     git diff --check cc083796c4bf62b57aaa76e2908f8b5cd47347dd..253f9f23e4b4eda7f39ca0a059dff3a21e33eb84
     ```
   - *Exit Codes:* `typecheck=0`, `build=0`, `bundle_parity=0`, `root=0` (`590/590`), `shipped=0` (`18/18`), `diff_check=0`
   - *Logs:*
     - `.agents/run/issue-48-panel-hostile/verifications/logs/typecheck.log`
     - `.agents/run/issue-48-panel-hostile/verifications/logs/build.log`
     - `.agents/run/issue-48-panel-hostile/verifications/logs/root-tests.log`
     - `.agents/run/issue-48-panel-hostile/verifications/logs/shipped-parity.log`

2. **L3 Real Browser Execution against Built `panel/index.html` + `panel/main.js`:**
   - *Command:* `node .agents/run/issue-48-panel-hostile/verifications/browser.mjs`
   - *Exit Code:* `0` (harness captures all pass/fail checks into `.agents/run/issue-48-panel-hostile/verifications/logs/browser-results.json`)
   - *Verified Working Flows:*
     - Five views (`Simple list` [default], `Cards`, `Kanban board`, `Graph`, `Pending items`) render at `980x780` and `360x780` with `0` uncaught `pageerror`s.
     - Quick capture (`Simple list` + `stage:draft` filter): `Enter` in `#draftCaptureTitle` and `Shift+Enter` -> `#draftCaptureDescription` -> `Enter` creates `POST /repos/acme/openchamber-github-task-board/issues` with `labels: ["status:draft"]`, `<!-- board-order: 4000 -->`, and `sessionCalls: []` (zero agent/session launches).
     - Pressing `Alt+ArrowUp` while `sort = "priority"` switches `#selectSort` visibly to `"manual"` and emits info toast before moving on the second gesture.
     - Marked draft reorder (`#3` moved above `#2` and `#1`, then `#1` dragged onto `#2`) writes `<!-- board-order: 1500 -->`, `<!-- board-order: 500 -->`, `<!-- board-order: 1750 -->` via single-issue `PATCH` after fresh `GET` preflight.
     - Questions filter (`questions`) renders `.btn-inline-answer` + `.input-inline-answer` and saves `### Open Questions:\n- [x] Which colour should we use? *(Answer: Use blue)*` via `PATCH`.
     - Pending items (`pending`) checks human task checkbox and writes `### Human Tasks:\n- [x] Inspect the preview` without closing or moving the issue to `Done`.
   - *Captured Screenshots (visually inspected):*
     - Desktop (`980x780`): `.agents/run/issue-48-panel-hostile/verifications/screenshots/{simple,cards,kanban,graph,pending,draft}-980.png`
     - Narrow (`360x780`): `.agents/run/issue-48-panel-hostile/verifications/screenshots/{simple,cards,kanban,graph,pending,draft}-360.png`
     - Defect captures:
       - `.agents/run/issue-48-panel-hostile/verifications/screenshots/filter-offscreen-360.png`
       - `.agents/run/issue-48-panel-hostile/verifications/screenshots/unmarked-down-refused.png`
       - `.agents/run/issue-48-panel-hostile/verifications/screenshots/graph-all-projects-collision.png`
       - `.agents/run/issue-48-panel-hostile/verifications/screenshots/failed-description-discarded.png`
       - `.agents/run/issue-48-panel-hostile/verifications/screenshots/fenced-sample-stripped.png`
       - `.agents/run/issue-48-panel-hostile/verifications/screenshots/question-answer-open.png`

---

### Hostile Findings (L4)

| # | Severity | File:Line | Finding & Empirical Reproduction | Smallest Correction |
|---|---|---|---|---|
| **C1** | **Catastrophic** | `panel/viewstate.ts:192-223`, `panel/main.ts:3792-3814`, `test/viewstate.test.js:158-171`, `test/panel-simple-views.test.js:186-197` | **Manual reorder refuses unmarked, mixed, equal-marker, and exhausted-gap destinations instead of lazily initialising/rebalancing neighbour markers (D50 violation).** `slotOrder` returns `null` whenever `prev && prevOrder === null` (`panel/viewstate.ts:196`) or when `order <= prevOrder || order >= nextOrder` (`panel/viewstate.ts:200-201`), and `computeMove` (`panel/viewstate.ts:214-223`) returns `null`. In Chromium (`check: "unmarked-down"` in `browser-results.json`, screenshot `unmarked-down-refused.png`), pressing `Alt+ArrowDown` on the first of 3 unmarked drafts performs `mutations: []`, leaves order `["First unmarked idea", "Second unmarked idea", "Third unmarked idea"]`, and toasts `"That slot needs more than one marker write, or its order gap is full. Move an unordered draft to the top first."` | Replace single-write-only `computeMove` with a planner that returns the minimal ordered list of `{ index, order }` writes: lazily assign `ORDER_GAP`-spaced markers (`1000, 2000, ...`) to any unmarked prefix/neighbours up to `toIndex` (or rebalance the minimal contiguous equal/exhausted span), then in `reorderDraft` (`panel/main.ts:3792-3814`) reload all participating issues and sequentially apply `updateIssueBody` for each planned write using the existing conflict-safe path. Update the two tests that currently assert refusal. |
| **C2** | **Catastrophic** | `panel/main.ts:3610`, `panel/main.ts:3825-3875` | **Saved-draft project picker transfers issues on `change` with zero confirmation dialog and allows blind retries after ambiguous transfer failures (D55 violation).** `select.addEventListener('change', () => { void transferDraftProject(issue, select.value); })` (`panel/main.ts:3610`) never calls `host.confirm` or `window.confirm`. In Chromium (`check: "saved-project-change-with-cancel-policy"` in `browser-results.json`), changing the `<select>` on draft `#1` with a dialog auto-dismiss policy still fired `GET /repos/.../issues/1`, `GET /repos/...`, and `POST /graphql` (`transferIssue`) with `dialogs: []` and `hostConfirms: []`. Furthermore, if `POST /graphql` fails ambiguously (lost response / timeout), `transferDraftProject` (`panel/main.ts:3869-3874`) does not mark `(issue as any).unconfirmed = true` or lock the row, immediately re-enabling the `<select>` in `finally` for a blind retry. | Before any network call in `transferDraftProject` (`panel/main.ts:3825`), require explicit confirmation (`window.confirm` / `host.confirm`) naming the target project and warning that the issue number/URL may change; on cancel, reset `select.value = repo`, `select.title = repo`, and return without writing. Validate `targetRepo` against `availableProjectRepos()`. On non-definitive `POST /graphql` failure (`!isDefinitivePreCommitRejection(err)`), set `(issue as any).unconfirmed = true` (and on `findIssueRecord(repo, issue)`), disable further mutations until a full source+target refresh resolves the identity, and never auto-retry `transferIssue`. |
| **H1** | **High** | `panel/index.html:3429`, `panel/index.html:3481-3484` | **Filter popover renders off-screen to the left on a `360px` narrow viewport (`x = -147px`), making filter chips unclickable by pointer/tap.** `.filter-popover` sets `right: 0; left: auto; width: min(320px, calc(100vw - 24px))` (`panel/index.html:3429`) inside `#filterWrapper` (`panel/index.html:3481`), whose right edge is at `x = 149px` on a `360px` viewport. In Chromium (`check: "filter-offscreen"` in `browser-results.json`, screenshot `filter-offscreen-360.png`), `#filterPopover` has bounding box `{ x: -147.08, y: 36, width: 320, height: 185 }` and `[data-filter="stage:draft"]` is at `x = -137.08`, causing standard Playwright `.click()` to time out with `element is outside of the viewport`. | Anchor `.filter-popover` within the viewport (e.g. `left: 0; right: auto;` or clamp via `max-width: calc(100vw - 16px)` and viewport-aware horizontal positioning when opening `#btnFilterToggle`). |
| **H2** | **High** | `panel/viewstate.ts:73`, `panel/viewstate.ts:89-99`, `panel/viewstate.ts:122-126`, `panel/main.ts:3579`, `panel/main.ts:3769`, `panel/main.ts:9383` | **`stripOrderMarker` strips `<!-- board-order: ... -->` inside fenced code blocks and rewrites `\r\n` to `\n`.** `ORDER_MARKER_LINE_REGEX` (`panel/viewstate.ts:73`) matches every line in the body globally, and `stripOrderMarker` (`panel/viewstate.ts:95-98`) runs `.replace(ORDER_MARKER_LINE_REGEX, '').replace(/\r\n/g, '\n')`. In Chromium (`check: "fenced-inline-body"` in `browser-results.json`, screenshot `fenced-sample-stripped.png`), an issue body containing a fenced `<!-- board-order: 777 -->` example and `\r\n` line endings had the fenced line erased in the textarea (`Sample:\n\`\`\`html\n\n\`\`\``) before any user edit, and saving rewrites the body without the fenced line or CRLF. Contrasts with web `web/server/board.ts:41-50` which preserves CRLF. | Match/strip/set only a trailing `<!-- board-order: N -->` marker outside fenced code blocks (at the end of the body), and preserve the existing line ending (`\r\n` vs `\n`) instead of normalising `\r\n` to `\n`. |
| **H3** | **High** | `panel/core.ts:2791-2845`, `panel/main.ts:6158` | **All Projects Graph view keys nodes by `issue.number` instead of repo-qualified key, silently dropping same-number issues across repositories.** `buildDependencyGraph` (`panel/core.ts:2792-2797`) uses `new Map<number, DependencyNode>()` and `byNumber.set(issue.number, issue)`. In Chromium (`check: "graph-same-number"` in `browser-results.json`, screenshot `graph-all-projects-collision.png`), All Projects Simple list shows both `#1` issues (`"First unmarked idea"` in `acme/openchamber-github-task-board` and `"Other project same issue number"` in `acme/very-long-project-name-for-narrow-layout`), whereas Graph view renders only `"Other project same issue number"` and drops the first `#1`. | Key graph nodes and `visibleNumbers` by repo-qualified key (`${getIssueRepoFullName(issue) || ''}#${issue.number}`) while scoping unqualified `#N` dependency references to the same repository. |
| **M1** | **Moderate** | `panel/main.ts:3548-3648` | **No touch or accessible button reorder controls on draft rows.** Draft rows only wire `Alt+ArrowUp/Down` (`panel/main.ts:3623-3625`) and desktop HTML5 `draggable` (`panel/main.ts:3632-3645`). In Chromium (`check: "draft-geometry"` at `width: 360`), `touchButtons` inside `.simple-row` is `[]`; phone/touch users without a hardware `Alt` key or desktop drag events cannot reorder drafts. | Add compact accessible Move Up / Move Down buttons (or touch handle controls) on editable draft rows calling `reorderDraft(issue, sorted, index +/- 1)`. |
| **M2** | **Moderate** | `panel/main.ts:3526-3650`, `panel/main.ts:3731-3776` | **Full DOM rebuild of `.simple-row` inputs on every `renderViews()` loses unsaved inline typing on refresh, drops keyboard focus on `Tab` after title edit, and discards user text when description `PATCH` fails.** In Chromium (`browser-results.json`): (a) `check: "refresh-during-typing"`: typing `"UNSAVED TYPING"` in a draft description and clicking `#btnRefresh` resets the textarea to `"Inspiration one"` with `mutations: []`; (b) `check: "title-tab-focus"`: editing a draft title and pressing `Tab` triggers `blur` -> `editDraftTitle` -> synchronous `renderViews()` (`panel/main.ts:3741`), destroying the next input and leaving `document.activeElement` on `BODY`; (c) `check: "failed-description-value"` (screenshot `failed-description-discarded.png`): when `PATCH` returns `422`, `editDraftDescription` (`panel/main.ts:3774`) calls `renderViews()` in `finally` and overwrites the user's `"DO NOT LOSE THIS EDIT"` with `""`. | Preserve in-progress draft input values/selection and next-focus target across `renderViews()` keyed by `data-draft-key`, and keep the user's unsaved description text in the textarea when `editDraftDescription` fails. |
| **M3** | **Moderate** | `panel/viewstate.ts:157-167`, `panel/viewstate.ts:363-386` | **Sort tie-breakers omit repository identity in All Projects.** `compareManualOrder` (`panel/viewstate.ts:166`) and `applySort` (`panel/viewstate.ts:365`) break ties only by `issue.number`, so two issues with the same number and timestamp/priority across different repos have no deterministic tie-breaker (unlike web `manualCompare` in `web/public/app.js:827-828`, which compares `repo` before `number`). | Add `(a.repo || '').localeCompare(b.repo || '')` as a deterministic tie-breaker in `compareManualOrder` and `byNumberDesc`. |
| **M4** | **Moderate** | `panel/main.ts:3455-3512`, `panel/main.ts:5456`, `panel/main.ts:6140-6160`, `panel/index.html:3480-3540` | **Undisclosed functional removals beyond duplicated view/status tabs.** Replacing the toolbar removed: (1) Priority and Tag filters and Group-by controls (`none`/`priority`/`status`/`tag`/`project`) in Cards/List view; (2) `"Select All with Tag"` batch selection button; (3) Graph-local `"Show Done"` toggle and Theme (`theme:*`) filter dropdown; (4) Attention category sub-filter pills (`needs-decision` / `needs-permission` / `needs-review`); (5) `All Tasks` stage-grouped collapsible view. | Either restore the missing filter/group capabilities within the unified Filter/View controls or explicitly disclose every removed capability for human decision at L5. |

---

### Audit of Modified Existing Tests (`cc08379..253f9f2`)

| Test File | What Changed | Reviewer Assessment |
|---|---|---|
| `test/clickthrough-repair-titles-queues-picker.test.js` | Updated `Session repo:` assertion to expect `<span title="Workflows-Accelerator/openchamber-github-task-board">Task Board</span>`. | Legitimate update for D51 short project names + full `owner/repo` tooltip. |
| `test/human-tasks-ux-enhancements.test.js` | Replaced `switchViewMode('human')` / `btnViewHuman` with `viewState: { view: 'pending' }` / `viewOptPending`; removed assertions for `All Tasks` stage sections (`allTasksSectionHeader`) inside Pending items. | Entry-point update is legitimate; removal of `All Tasks` collapsible stage grouping inside Pending items is part of M4 and must be disclosed at L5. |
| `test/issue-34-answer-integrity.test.js` | Updated question view tests to set `viewState: { view: 'simple', filters: ['questions'], sort: 'priority' }` before asserting inline question answering. | Legitimate entry-point migration; question answer integrity assertions preserved. |
| `test/layout-and-views.test.js` | Replaced old 6-view / status-tab assertions with 5-view + filter popover + sort assertions; replaced Graph `graphShowDone` / `graphThemeSelect` checks with shared `stage:done` filter check. | Masks removal of Graph theme filter (`theme:*`) and priority/tag grouping (recorded in M4). |
| `test/review-feedback-views.test.js` | Replaced `btnViewAttention` / `btnViewQuestions` / `btnViewGraph` clicks with `viewState` filter/view updates; removed `"Select All with Tag"` test (`btnSelectByTag`) and replaced with active filter chip tests. | Masks removal of `"Select All with Tag"` batch helper (recorded in M4). |
| `test/simplified-views.test.js` | Updated from old 4-button toolbar check to the new `View` + `Filter` + `Sort` toolbar contract. | Legitimate contract update for D52. |
| `test/stage2a-attention-ui.test.js` | Updated attention view entry point to `filters: ['needs-me']`; replaced preset buttons (`Needs Me`, `Blocked`, `In Progress`, `Unassigned`) and attention sub-filter pills with `viewState` filter tokens. | Preset removal was requested by brief; removal of `Blocked`/`Unassigned` and sub-attention pills is recorded in M4. |
| `test/status-model.test.js` | Replaced `#statusTabs` count checks with `#filterPopover` `[data-filter="stage:..."]` chip checks. | Legitimate migration for status-tab strip removal. |
| `test/test-app-harness.js` | Added DOM stubs for `#SimpleListViewContainer`, `#filterPopover`, `#activeFilters`, `#selectSort`, `#projectNameOverridesList`; exposed `viewState`, `projectNameOverrides`, `draftMutations` in `getState`/`setState`. | Test harness plumbing only; no weakened CPU/safety thresholds. |
| `test/viewstate.test.js` & `test/panel-simple-views.test.js` | Added 24 unit tests + 13 integration tests, **including two tests (`test/viewstate.test.js:158-171`, `test/panel-simple-views.test.js:186-197`) that codify single-marker reorder refusal**. | Those two refusal tests contradict D50 and must be replaced with lazy neighbour marker initialisation tests (C1). |

---

### Human Review Brief (L5)
**Batch:** `simplify-views` (`#47` + `#48`)  **Branch:** `feat/issue-48-panel-simple-views` (blocked at L4 until C1–C2 and H1–H3 are resolved)
| # | What to click | What should happen |
|---|---|---|
| 1 | Open the extension panel and inspect the top toolbar | `Simple list` is selected by default with one `View` picker, one `Filter` button, and one `Sort` picker (`Priority`), and repositories show short names (e.g. `Task Board`) with full `owner/repo` on hover. |
| 2 | Open `Filter`, select `Draft`, then type a title at the bottom and press `Enter` | A draft row is added at the bottom without starting any AI session; pressing `Shift+Enter` opens the optional inspiration description box. |
| 3 | Drag or press `Alt+Up` / `Alt+Down` (or tap the row up/down buttons) on any draft — including newly imported unmarked drafts | Every move succeeds (switching `Sort` to `Manual order` if needed) and persists across reloads without refusing downward moves among unmarked drafts. |
| 4 | In `All Projects` with `Draft` filter active, change a saved draft's project dropdown | A confirmation prompt appears first; clicking `Cancel` leaves the draft untouched, and confirming transfers the issue via GitHub while preserving its history. |
| 5 | Switch between `Simple list`, `Cards`, `Kanban board`, `Graph`, and `Pending items` with `Needs me` or `Questions` filters on both desktop and narrow (`360px`) panel widths | Filter popover stays inside the viewport, questions can be answered inline or in the drawer, and checking a human task updates the checklist without auto-closing the issue. |

**Known blind spots for the human to focus on:**
- Real OpenChamber host iframe mounting + live GitHub REST/GraphQL OAuth/PAT permissions (especially cross-repo/org `transferIssue` permissions) were simulated via synthetic `postMessage` bridge in L2/L3 so live repositories and credentials were never touched.
- Physical mobile touch drag/scroll ergonomics on iOS/Android vs desktop panel resize.
- Whether the removed legacy controls (Priority/Tag filters, Group-by selector, `Select All with Tag`, Graph `theme:*` filter, and `All Tasks` collapsible stage list in Pending items) are missed in daily use.

### Failures & Blind Spots
- **Failures:** C1 (manual reorder refuses unmarked/mixed/equal/exhausted slots), C2 (saved-draft project transfer lacks confirmation dialog, does not reset picker on cancel, and leaves ambiguous failed transfers retryable without `unconfirmed` lock), H1 (`360px` filter popover off-screen left at `x = -147`), H2 (`stripOrderMarker` strips fenced `<!-- board-order: ... -->` examples and normalises `\r\n`), H3 (All Projects Graph view collides same-number issues across repos), M1 (no touch/button reorder controls), M2 (inline draft edits lose focus/typing on `renderViews()` / failed `PATCH`), M3 (sort tie-breakers omit repo in All Projects), M4 (undisclosed control removals).
- **Not Verified:** Live GitHub API / `transferIssue` execution against real repositories, installed OpenChamber host runtime, and physical mobile devices (withheld by review safety boundary).
