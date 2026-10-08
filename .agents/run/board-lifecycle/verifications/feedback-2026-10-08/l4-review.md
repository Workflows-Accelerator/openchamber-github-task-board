# L4 Hostile Verification: Board Review-Feedback Views & Repository Switching

**Date:** 2026-10-08  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-review-feedback-views`  
**Branch:** `fix/review-feedback-views`  
**Base Commit:** `3598c9e`  
**Preservation Commit SHA:** `768efa9fba85f79a25b1ea4c9c22976b97855aa1`  
**Verdict:** `HALT`

---

## 1. Executive Summary

A hostile verification was conducted on the uncommitted review-feedback fixes authored by worker `ses_6b7c1c2086f540092b39965b`. In accordance with Step 0 instructions, a byte-verbatim preservation commit was created prior to review (`768efa9`).

The implementation addresses the four core human complaints in `feedback-2026-10-08.md`:
1. **Icon Distinction:** All Tasks now displays a distinct checklist SVG icon with visible checkmarks, contrasting with the three horizontal lines of the List icon.
2. **Friendly Titles:** `resolveSimplifiedViewTitle` ensures friendly titles are primary, while issues lacking friendly titles (such as #22) display a quiet italicized `(No friendly title)` placeholder and suppress the technical slug to a subtitle.
3. **Queue Population:** Human Tasks and Questions views now populate directly from real issue body sections (`### Human Tasks:`, `### Open Questions:`) rather than requiring `status:needs-human` labels. Real live issue body shapes from `issue-23-update-2026-10-08.md` parse with 100% fidelity.
4. **Repository Selection & Decision D13:** Current-session repository anchor is provided in the popover (`[default]`), with automatic reset on active session change.
5. **Empty States:** Visual distinction for empty, inaccessible (401/403/404), and failed (500/network) repository states.

However, the review identified **two behavioral defects** in repository switching, **one test-oracle fidelity issue**, **one screenshot harness timing vulnerability**, and **one namespace leak**. Consequently, the verdict is **HALT** until these bounded defects are repaired.

---

## 2. Findings Matrix

| Finding | Severity | File:Line | Empirical Evidence | Required Fix |
|---|---|---|---|---|
| **F-01: Custom repository input in popover fails to set `isManualRepoOverride = true`** | **HIGH** | `panel/main.ts:6333-6339` | In `elBtnSaveCustomRepo.addEventListener('click', ...)`, `setRepository(custom, 'custom-input')` is invoked without setting `isManualRepoOverride = true`. In contrast, selecting a workspace repo (line 901) and All Projects (line 893) sets `isManualRepoOverride = true`. Because the flag remains `false`, the very next background session event (`host.onSession`) or directory event (`host.onDirectory`) immediately overwrites the user's custom repository back to the session repository. Furthermore, the popover continues showing `[default]` on "Current session" while on a custom repo. | Add `isManualRepoOverride = true;` inside `elBtnSaveCustomRepo` click listener. Add `keydown` handler for `Enter` on `elInputCustomRepo` to support keyboard submission. |
| **F-02: Stale `isAllProjectsMode` guard blocks session-item repository auto-resolution on session switch** | **MODERATE** | `panel/main.ts:7249` | In `host.onSession`, when `sessionChanged` is detected, `isManualRepoOverride` is reset to `false`. However, line 7249 guards item resolution with `if (itemRepo && itemRepo !== currentRepo && !isAllProjectsMode)`. If the previous session was left in All Projects mode, `isAllProjectsMode` remains `true` until `setRepository` runs. As a result, line 7249 skips the active session's linked item repository and falls through to `autoResolveRepoForActiveContext(sess)` where native directory remote takes precedence, ignoring `sess.items`. | Remove the `!isAllProjectsMode` condition on line 7249 when `sessionChanged` or `!isManualRepoOverride` is true, ensuring session item repositories take priority on session transitions. |
| **F-03: Static string/regex test oracles in `test/review-feedback-views.test.js`** | **MODERATE** | `test/review-feedback-views.test.js:26-89, 280-317` | 6 of the 12 new tests (Tests 1, 2, 9, 10, 11, 12) perform static string and regex searches on source files (`INDEX_HTML.includes(...)`, `MAIN_TS.includes(...)`) rather than executing runtime code. While pure core helpers are well-tested, the runtime integration of D13 session switching, popover click events, and `renderEmptyState` DOM generation was never executed in Node test harnesses. | Add runtime tests using `test/test-app-harness.js` (established production bundle harness) to execute `setRepository`, `renderEmptyState`, and session switching events against the bundled runtime. |
| **F-04: Screenshot generation script relies on static `--wait 3` timer, leading to race-condition blank captures** | **LOW** | `scripts/generate-verification-screenshots.mjs:327-350, 432` | `scripts/generate-verification-screenshots.mjs` sets `data-ready-for-capture` at 400ms, but `obscura fetch` executes with a fixed `--wait 3` flag. Under system load, asynchronous boot resolution (`inspectGitConfigInDir` and `fetchIssues`) exceeded 3 seconds, resulting in a capture of `07-empty-state-empty.png` (21KB) where the view body was completely blank and toolbar displayed "Connecting repo...". A rerun under low latency captured the full empty state (31KB). | Update the capture script or Obscura invocation to wait explicitly for DOM readiness (e.g. `document.body.dataset.readyForCapture === 'true'` and presence of `.empty-box` / `.view-container`) rather than relying purely on an arbitrary 3-second sleep. |
| **F-05: Global namespace leakage of `renderEmptyState` on `window`** | **LOW** | `panel/main.ts:2416` | `(window as any).renderEmptyState = renderEmptyState;` leaks an internal implementation function into the browser global namespace. No test or external module consumes this global. | Remove the `(window as any).renderEmptyState` assignment from `panel/main.ts`. |

---

## 3. Independent Verification Run Details

Every check was executed independently in the `/workspace/extensions/github-task-board/.worktrees/team-dev-review-feedback-views` worktree:

### 3.1. Typecheck
```bash
npm run typecheck
```
- **Exit Code:** 0
- **Output:** Clean, 0 errors.

### 3.2. Bundle Build & Shipped Parity
```bash
npm run build
git diff panel/main.js
```
- **Exit Code:** 0
- **Bundle Size:** 476.6kb
- **Diff:** 0 lines (byte-for-byte identical with committed bundle).

### 3.3. Test Suite Execution
```bash
node --test test/*.test.js
```
- **Total Tests:** 281
- **Passed:** 281
- **Failed:** 0
- **Baseline:** 269 (12 new tests in `test/review-feedback-views.test.js`)
- **Duration:** 2581.5ms

### 3.4. Decision D11 Refresh Check
- Audited `panel/main.ts` for timer polling:
  - `setIntervalMatches`: 0 occurrences.
  - Idle refresh remains strictly event-driven via `host.onSessions` and `becameIdle` transition.

### 3.5. Live Issue Extraction Truth
Tested `parseHumanTasks`, `parseOpenQuestions`, `collectHumanTodos`, and `resolveSimplifiedViewTitle` against live issue markdown shapes (`issue-23-update-2026-10-08.md` and `#24` specs):
- **Issue #23 Human Tasks:** 3/3 tasks parsed, completed: `false`.
- **Issue #23 Open Questions:** 1/1 question parsed, completed: `false`.
- **Issue #23 Todos:** 3 todos collected (human tasks take priority over questions).
- **Issue #23 Friendly Title:** Parsed as "Add Simplified Task Views", subtitle: "feat(board): implement simplified views and layout toggle", isPlaceholder: `false`.
- **Issue #22 (No Friendly Title):** Parsed as "(No friendly title)", subtitle: "fix(core): resolve race condition on scratchpad debounce", isPlaceholder: `true`.
- **Placeholder template protection:** `<3-6 words plain english title>` ignored cleanly, falls back to `(No friendly title)`.

---

## 4. Visual & Screenshot Inspection

Inspected all 7 PNG artifacts generated via Obscura:
- `01-all-tasks-view.png` (70,934 bytes): Confirmed toolbar displays distinct checklist SVG icon for All Tasks (two checkmarks with lines) alongside List icon (three plain lines). Friendly titles render as primary; issue #22 shows italicized `(No friendly title)` placeholder.
- `02-human-tasks-view.png` (67,934 bytes): Confirmed populated Human Tasks queue from issues #21 and #23 with checkboxes and `HUMAN TASK` badges, plus issue #24 with `OPEN QUESTION` badge.
- `03-questions-view.png` (65,525 bytes): Confirmed populated Questions view from issues #21, #23, and #24 with `[Answer]` action buttons and status badges.
- `04-repo-selector-popover.png` (37,890 bytes): Confirmed repo popover includes "Current session [default]" anchor (D13), "All Projects", workspace projects, and custom repository input.
- `05-empty-state-inaccessible.png` (37,190 bytes): Confirmed gold lock icon, "Repository Inaccessible" title, and auth resolution guidance.
- `06-empty-state-failed.png` (31,094 bytes): Confirmed red exclamation icon, "Failed to Load Repository" title, and error message.
- `07-empty-state-empty.png` (31,304 bytes): Confirmed faint inbox tray icon, "No Issues in Repository" title, and getting-started guidance.

---

## 5. Scope & Boundary Conformance

- No live GitHub API mutations or token logging occurred.
- No live OpenChamber database or service mutations occurred.
- Git status remains clean and strictly scoped to declared review artifacts.

---

## 6. Required Actions for Repair Worker

1. Fix `F-01`: In `panel/main.ts:6333`, set `isManualRepoOverride = true;` when saving a custom repository, and add an Enter key listener to `elInputCustomRepo`.
2. Fix `F-02`: In `panel/main.ts:7249`, fix the `!isAllProjectsMode` guard so active session item repositories are not dropped when switching from All Projects mode.
3. Fix `F-03`: In `test/review-feedback-views.test.js`, replace static string matching assertions with runtime execution via `test/test-app-harness.js`.
4. Fix `F-04`: In `scripts/generate-verification-screenshots.mjs`, eliminate the timing race condition by waiting for DOM readiness before capture.
5. Fix `F-05`: In `panel/main.ts:2416`, remove `(window as any).renderEmptyState = renderEmptyState;`.
6. Rebuild `panel/main.js` (`npm run build`) to ensure byte parity and verify test suite passes.
