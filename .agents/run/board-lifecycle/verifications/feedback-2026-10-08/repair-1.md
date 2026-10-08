# L4 Verification Repair Report: Review-Feedback Views & Repository Switching

**Date:** 2026-10-08  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-review-feedback-views`  
**Branch:** `fix/review-feedback-views`  
**Base Commit:** `7a075fd` (`docs(verifications): add L4 hostile review report for review-feedback views`)  
**Tip Commit:** `1741008` (`fix(automation): poll DOM readiness before screenshot captures (F-04)`)  
**Status:** **`READY FOR L4 RE-REVIEW`**

---

## 1. Executive Summary

This repair addresses all five findings (`F-01` through `F-05`) identified in hostile review `l4-review.md`. The fixes are tightly scoped with zero feature drift or drive-by refactoring. All four user-facing features (distinct checklist icon, friendly titles with placeholders, real Human Tasks/Questions queues, and D13 session follow) remain intact and verified by 283 passing unit tests and refreshed visual screenshots.

Every behavioral defect lands with runtime-executing tests in `test/review-feedback-views.test.js`.

---

## 2. Findings Disposition Matrix

| Finding | Severity | Status | Commit | Description of Fix |
|---|---|---|---|---|
| **F-01** | HIGH | **REPAIRED** | `13fbd97` | Set `isManualRepoOverride = true` in custom repo submission (`elBtnSaveCustomRepo` click and Enter keydown on `elInputCustomRepo`). Broadened `autoResolveRepoForActiveContext` guard to check `if (isManualRepoOverride) return;` regardless of mode. Added runtime test. |
| **F-02** | MODERATE | **REPAIRED** | `beadbe3` | Prioritized session item repos (`sess.items`) before directory resolution in `host.onSession`, removing `!isAllProjectsMode` guard. Added runtime test. |
| **F-03** | MODERATE | **REPAIRED** | `dedbea5` | Rewrote tests 1, 2, 9, 10, 11, 12 in `test/review-feedback-views.test.js` to execute real DOM operations, event dispatches, and runtime assertions against compiled bundle via `test-app-harness.js`. |
| **F-04** | LOW | **REPAIRED** | `1741008` | Replaced fixed 400ms / 3s sleep in `scripts/generate-verification-screenshots.mjs` with polling DOM readiness (`data-ready-for-capture="true"` + selector matching) before Obscura captures. |
| **F-05** | LOW | **REPAIRED** | `64f9ef6` | Removed `(window as any).renderEmptyState = renderEmptyState;` from `panel/main.ts:2416`. Exported `renderEmptyState` directly in `test/test-app-harness.js`. |

---

## 3. Detailed Root Causes and Repairs

### F-01: Custom Repository Input Override Survival
- **Root Cause:** In `panel/main.ts`, saving a custom repository via `elBtnSaveCustomRepo` called `setRepository(custom, 'custom-input')` without setting `isManualRepoOverride = true`. Additionally, `autoResolveRepoForActiveContext` had `if (isAllProjectsMode && isManualRepoOverride) return;` which did not protect manual overrides when in single-project mode. Furthermore, pressing `Enter` in the custom repo input had no keydown listener.
- **Fix:**
  - Extracted `saveCustomRepo()` in `panel/main.ts:6328` setting `isManualRepoOverride = true; setRepository(custom, 'custom-input'); closeRepoPopover();`.
  - Added click listener on `elBtnSaveCustomRepo` and `keydown` listener on `elInputCustomRepo` for `Enter`.
  - Updated `autoResolveRepoForActiveContext` guard to `if (isManualRepoOverride) return;`.
- **Evidence:** Runtime test `F-01: Custom repo input marks manual override, survives background events, and resets on active session change` in `test/review-feedback-views.test.js` verifies that manual override survives background session updates and directory changes, accepts Enter key submission, and resets when session identity changes per D13.

### F-02: Session-Item Repo Auto-Resolution on Session Switch
- **Root Cause:** In `host.onSession`, when `isManualRepoOverride` was false, the code checked `!isAllProjectsMode` before resolving item repositories from `sess.items`. When switching chat sessions while previously in All Projects mode, `isAllProjectsMode` remained true, causing `itemRepo` resolution to be bypassed and falling through to directory resolution.
- **Fix:**
  - Removed `!isAllProjectsMode` guard when checking `sess.items`.
  - Ordered `sess.items` repository check before project/directory resolution so session items take precedence.
- **Evidence:** Runtime test `F-02: Switching sessions while in All Projects mode resolves the new session own repo from sess.items` asserts switching to a new session with item repo immediately sets `currentRepo` to the session's item repo.

### F-03: Test Oracle Fidelity (Runtime Execution)
- **Root Cause:** Tests 1, 2, 9, 10, 11, and 12 in `test/review-feedback-views.test.js` asserted on file string contents (`INDEX_HTML.includes(...)`, `MAIN_TS.includes(...)`) instead of executing code at runtime.
- **Fix:**
  - Enhanced `test/test-app-harness.js` with DOM parsing of `panel/index.html`, simulated attributes and event listeners, timer call tracking (`__setIntervalCalls`), and `emitSession`/`emitDirectory` dispatchers.
  - Test 1 now verifies runtime DOM elements (`elements.get('btnViewAllTasks')`), SVG path data, title, and ARIA attributes.
  - Test 2 simulates click on `btnViewAllTasks` and verifies dynamic sidebar toggle icon SVG update in runtime DOM.
  - Test 9 executes manual override followed by clicking `.current-session-option` in popover, verifying override reset and repo recovery.
  - Test 10 executes active session transition and asserts automatic override reset.
  - Test 11 calls `app.renderEmptyState(...)` for inaccessible, failed, and empty states, asserting rendered DOM classes, icons, and titles.
  - Test 12 verifies runtime registration of `setInterval` calls is 0 during panel boot and idle refresh.

### F-04: Screenshot Race Condition
- **Root Cause:** `scripts/generate-verification-screenshots.mjs` used a fixed 400ms `setTimeout` to set `readyForCapture` and `obscura fetch` used `--wait 3`, which occasionally captured before async issue loading finished.
- **Fix:**
  - Implemented 50ms polling loop in injected browser runner that performs UI interaction and waits for expected target containers (`#allTasksViewContainer .all-task-card`, `#humanViewContainer .human-issue-card`, `#questionsViewContainer .questions-issue-card`, `#repoPopover.active .current-session-option`, `.empty-box.empty-state-*`) before setting `document.body.dataset.readyForCapture = 'true'`.
  - Updated Obscura commands to use `--selector 'body[data-ready-for-capture="true"] ...'` to capture deterministically when elements exist.
- **Evidence:** All 7 screenshots generated with 0 timeout warnings and expected byte sizes.

### F-05: Global Leakage Removal
- **Root Cause:** `(window as any).renderEmptyState = renderEmptyState;` leaked an internal panel function to the global `window` object.
- **Fix:** Removed assignment from `panel/main.ts:2416`. Exported `renderEmptyState` directly from `test/test-app-harness.js` for testing.

---

## 4. Verification Results

### 4.1 Typecheck
```bash
npm run typecheck
```
- **Exit Code:** 0 (Clean, 0 errors)

### 4.2 Build Parity
```bash
npm run build
```
- **Exit Code:** 0
- **Bundle Output:** `panel/main.js` (476.6kb)
- `git diff panel/main.js`: committed and in sync with `panel/main.ts`.

### 4.3 Test Suite
```bash
node --test test/*.test.js
```
- **Total Tests:** 283
- **Passed:** 283
- **Failed:** 0
- **Duration:** 2874ms

### 4.4 Screenshot Visual Proofs
Generated via `node scripts/generate-verification-screenshots.mjs`:
- `01-all-tasks-view.png` (70,934 bytes): Distinct checklist icon, friendly titles, (No friendly title) placeholder on #22.
- `02-human-tasks-view.png` (67,934 bytes): Human tasks from #21 and #23, source badges, open question badge on #24.
- `03-questions-view.png` (65,525 bytes): Unanswered questions from #21, #23, and #24 with Answer buttons.
- `04-repo-selector-popover.png` (37,890 bytes): Current session [default] anchor (D13), All Projects, workspace repos.
- `05-empty-state-inaccessible.png` (37,190 bytes): Lock icon, Repository Inaccessible title, auth guidance.
- `06-empty-state-failed.png` (31,094 bytes): Exclamation icon, Failed to Load Repository title, error message.
- `07-empty-state-empty.png` (31,304 bytes): Inbox tray icon, No Issues in Repository title, getting-started guidance.
