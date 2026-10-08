# L4 Hostile Re-Review: Board Review-Feedback Repair 1

**Date:** 2026-10-08  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-review-feedback-views`  
**Branch:** `fix/review-feedback-views`  
**Base Commit:** `7a075fdd6055afac0a1d52a833ef368c0170fc63` (`docs(verifications): add L4 hostile review report for review-feedback views`)  
**Tip Commit:** `c31c33a99074a4035c4fabaa287bc5107c0c59a7` (`docs(verifications): add repair report for review-feedback findings F-01 through F-05`)  
**Auditor:** Independent Dynamic Agent (L4 Hostile Reviewer)  
**Verdict:** **`PROCEED`**

---

## 1. Executive Summary

An independent, read-only hostile re-review was conducted on repair commits `64f9ef6` through `c31c33a` on branch `fix/review-feedback-views` to evaluate the resolution of findings `F-01` through `F-05` established in `l4-review.md`.

All five original hostile-review findings are **genuinely resolved and verified** using real runtime test oracles rather than static string assertions. Six mutation probes were executed directly against the production source code; each probe failed its targeted test (RED) and restored cleanly (GREEN), proving the runtime test oracles are authentic and hostile.

One scope-boundary finding (`SV-01`) was identified regarding view mode persistence when switching sessions from All Projects mode. It is flagged as `MODERATE` for human validation during L5 interactive evaluation. All four core user features remain fully functional.

---

## 2. Findings Matrix

| Finding ID | Severity | File:Line | Evidence & Analysis | Required Fix / Resolution | Status |
|---|---|---|---|---|---|
| **F-01** | HIGH (repaired) | `panel/main.ts:6330-6345, 682` | Custom repo input save path and Enter key now set `isManualRepoOverride = true`. Broadened guard `if (isManualRepoOverride) return;` preserves manual override against background session and directory updates. D13 session change resets override to `false`. | N/A — Verified by Mutation Probes 1 & 2 and Test 13. | **RESOLVED** |
| **F-02** | MODERATE (repaired) | `panel/main.ts:7252` | Removed `!isAllProjectsMode` guard on session item resolution. Session item repo now takes precedence over native directory remote on session transition. | N/A — Verified by Mutation Probe 3 and Test 14. | **RESOLVED** |
| **F-03** | MODERATE (repaired) | `test/review-feedback-views.test.js:27-453` | 6 static string oracles rewritten to execute compiled bundle via `createTestApp()`. 2 reproduction tests added. Total tests increased from 12 to 14 with 0 deletions. | N/A — Verified by Mutation Probes 1–6 and full 283-test suite run. | **RESOLVED** |
| **F-04** | LOW (repaired) | `scripts/generate-verification-screenshots.mjs:333-395` | Replaced fixed sleeps with 50ms active polling for trigger presence and DOM container readiness (`.empty-box`, `.task-card`, `.repo-popover`) before setting `data-ready-for-capture`. | N/A — Verified by direct PNG inspection of all 7 regenerated screenshots. Screenshot 07 shows authentic empty box. | **RESOLVED** |
| **F-05** | LOW (repaired) | `panel/main.ts:2413` | Removed `(window as any).renderEmptyState = renderEmptyState;`. Zero replacement window assignments in diff. Harness wraps internal function cleanly. | N/A — Verified by AST and git diff inspection; 0 global window leaks. | **RESOLVED** |
| **SV-01** | MODERATE | `panel/main.ts:7253-7256, 806` | In All Projects mode, when active session changes to a session with an item repo (or directory matching a workspace project), `setRepository` is invoked, which executes `isAllProjectsMode = false` on line 806. The view mode transitions from All Projects to single-repo mode. Only sessions with no item repo and no directory remote maintain `isAllProjectsMode = true`. | Per repair brief, mode persistence across session switches was deferred to L5 human click-through validation. Flagged for L5 evaluation. | **NOTED / L5 AUDIT** |

---

## 3. Per-Finding Detailed Verification

### F-01: Manual Repository Override & Background Event Protection
- **Implementation:** In `panel/main.ts:6330-6345`, `saveCustomRepo` explicitly sets `isManualRepoOverride = true` upon custom repo submission. An Enter keydown listener is attached to `elInputCustomRepo`. In line 682, `autoResolveRepoForActiveContext` guards with `if (isManualRepoOverride) return;`.
- **D13 Reset Verification:** In line 7241-7244, `sessionChanged` resets `isManualRepoOverride = false` whenever `activeSessionId !== sess.id`. The broadened guard in `autoResolveRepoForActiveContext` does NOT block this reset because the flag is set to `false` before resolution runs.
- **Anchor & Dropdown Parity:** The popover's `current-session-option` explicitly resets `isManualRepoOverride = false` and calls `autoResolveRepoForActiveContext()`. The popover item click handler on line 901 sets `isManualRepoOverride = true`, identical to custom input.
- **Runtime Verdict:** **PASS**

### F-02: Session Item Repository Priority on Session Transition
- **Implementation:** In `panel/main.ts:7252`, `!isAllProjectsMode` was removed from the loop iterating over `sess.items`.
- **Edge Cases Tested:**
  1. *Session with no item repo:* Successfully falls through to `autoResolveRepoForActiveContext(sess)`.
  2. *Session with `sess.items: []`:* Successfully falls through without errors.
  3. *Directory remote absent:* Retains current state gracefully without throwing unhandled exceptions.
- **View Mode Persistence (SV-01):** When switching sessions while in All Projects mode, if the new session has an item repo, `setRepository(itemRepo)` runs and resets `isAllProjectsMode = false`. This behavior reflects the repair worker resolving the session repo over All Projects mode.
- **Runtime Verdict:** **PASS**

### F-03: Real Runtime Behavioral Oracles & Mutation Probes
- **Implementation:** In `test/review-feedback-views.test.js`, tests 1, 2, 9, 10, 11, and 12 were converted from string inspections into execution of `createTestApp()` backed by `panel/main.js`. Two new reproduction tests (13 and 14) were added.
- **Mutation Probes Executed (Red/Green Proofs):**
  - **Probe 1 (F-01 Manual Override Flag):**
    - Mutation: Commented out `isManualRepoOverride = true;` in `panel/main.ts:6333`.
    - Run: `node --test test/review-feedback-views.test.js`
    - Result: **RED** — Test 13 failed: `AssertionError: isManualRepoOverride must be true after saving custom repo (expected: true, actual: false)`.
    - Revert: `git restore panel/main.ts panel/main.js` -> **GREEN** (14/14 pass).
  - **Probe 2 (F-01 Enter Key Listener):**
    - Mutation: Commented out `elInputCustomRepo` Enter keydown listener in `panel/main.ts:6341-6345`.
    - Run: `node --test test/review-feedback-views.test.js`
    - Result: **RED** — Test 13 failed: `AssertionError: Enter key must save custom repo (expected: 'another-user/another-custom-repo', actual: 'custom-user/custom-repo')`.
    - Revert: `git restore panel/main.ts panel/main.js` -> **GREEN** (14/14 pass).
  - **Probe 3 (F-02 All Projects Guard):**
    - Mutation: Re-added `&& !isAllProjectsMode` to line 7252 in `panel/main.ts`.
    - Run: `node --test test/review-feedback-views.test.js`
    - Result: **RED** — Test 14 failed: `AssertionError: Active session items repository must take precedence on session change even when in All Projects mode`.
    - Revert: `git restore panel/main.ts panel/main.js` -> **GREEN** (14/14 pass).
  - **Probe 4 (Icon SVG Distinction):**
    - Mutation: Changed `btnViewAllTasks` SVG path in `panel/index.html` to List SVG path (`M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z`).
    - Run: `node --test test/review-feedback-views.test.js`
    - Result: **RED** — Test 1 failed: `AssertionError: All Tasks icon must not match List icon (operator: notStrictEqual)`.
    - Revert: `git restore panel/index.html` -> **GREEN** (14/14 pass).
  - **Probe 5 (Empty State Styling Differentiation):**
    - Mutation: Altered `empty-state-failed` CSS class in `panel/main.ts:2378` to `empty-broken-failed`.
    - Run: `node --test test/review-feedback-views.test.js`
    - Result: **RED** — Test 11 failed: `AssertionError: renders empty-state-failed class`.
    - Revert: `git restore panel/main.ts panel/main.js` -> **GREEN** (14/14 pass).
  - **Probe 6 (D11 Timer Polling Guard):**
    - Mutation: Injected `setInterval(() => {}, 1000);` into `panel/main.ts`.
    - Run: `node --test test/review-feedback-views.test.js`
    - Result: **RED** — Test 12 failed: `AssertionError: Found 1 setInterval occurrences in panel codebase`.
    - Revert: `git restore panel/main.ts panel/main.js` -> **GREEN** (14/14 pass).
- **Runtime Verdict:** **PASS**

### F-04: Screenshot Generator DOM Readiness & Visual Artifact Review
- **Implementation:** In `scripts/generate-verification-screenshots.mjs:333-395`, the generator polls at 50ms intervals until the trigger element is mounted, clicks it, and polls until target containers (`.task-card`, `.empty-box`, `.repo-popover`) are rendered before setting `data-ready-for-capture="true"`.
- **Visual Artifacts Inspected:**
  1. `01-three-views-all-tasks.png` (86.1 KB) — **PASS**: All Tasks active; distinct checklist SVG icon with checkmark glyphs; task cards rendered.
  2. `02-three-views-human-tasks.png` (88.5 KB) — **PASS**: Human Tasks active; human-todo cards parsed from issue bodies rendered.
  3. `03-three-views-questions.png` (88.6 KB) — **PASS**: Questions view active; questions queue rendered with badge counts.
  4. `04-friendly-title-with-subtitle.png` (87.7 KB) — **PASS**: Primary friendly title rendered; technical title demoted to subtitle.
  5. `05-friendly-title-missing-placeholder.png` (86.4 KB) — **PASS**: Issue #22 renders quiet italicized `(No friendly title)` placeholder.
  6. `06-repository-popover-d13.png` (89.5 KB) — **PASS**: Popover displays "Current session [default]" anchor, "All Projects", and discovered repos.
  7. `07-empty-state-empty.png` (75.4 KB) — **PASS**: Genuine `.empty-box` rendered with inbox icon and "No issues in this repository". Zero occurrence of "Connecting repo...".
- **Runtime Verdict:** **PASS**

### F-05: Window Global Leakage Removal
- **Implementation:** Deleted `(window as any).renderEmptyState = renderEmptyState;` from `panel/main.ts:2413`.
- **Verification:** Grep over `git diff 7a075fd..c31c33a panel/main.ts` found zero new window assignments. Grep over `test/` confirmed tests access `renderEmptyState` through harness object export.
- **Runtime Verdict:** **PASS**

---

## 4. Scope Discipline & Diff Audit

The commit diff `7a075fd..c31c33a` touches strictly the allowed files:
- `panel/main.ts` (application logic fixes)
- `panel/main.js` (compiled bundle rebuilt via esbuild)
- `test/test-app-harness.js` (runtime test harness extensions)
- `test/review-feedback-views.test.js` (runtime test suite)
- `scripts/generate-verification-screenshots.mjs` (DOM polling readiness)
- `.agents/run/board-lifecycle/verifications/feedback-2026-10-08/repair-1.md` (repair report)

Untouched files verified:
- `service/taskboard.ts` (untouched)
- `package.json` (untouched)
- `panel/core.ts` (untouched)
- `panel/labels.ts` (untouched)
- `panel/types.ts` (untouched)
- `panel/git.ts` (untouched)
- `docs/**` (untouched)
- `specs/**` (untouched)

---

## 5. Gate Execution & Exact Counts

| Gate Check | Command Run | Expected | Result | Verdict |
|---|---|---|---|:---:|
| TypeScript Typecheck | `npm run typecheck` | 0 errors | 0 errors | **PASS** |
| Bundle Rebuild Parity | `npm run build && git diff --exit-code panel/main.js` | 0 diff lines | 0 diff lines (476.6kb byte identical) | **PASS** |
| Feedback Views Test Suite | `node --test test/review-feedback-views.test.js` | 14 passed | 14 passed, 0 failed | **PASS** |
| Full Test Suite | `node --test test/*.test.js` | 283 passed | 283 passed, 0 failed (baseline 281, +2 new) | **PASS** |

---

## 6. Verification Verdict

**VERDICT: `PROCEED`**

The repairs in commits `64f9ef6` through `c31c33a` fully resolve defects `F-01` through `F-05`. The test suite is fortified with genuine runtime behavioral oracles proven by hostile mutation testing. Visual screenshots accurately capture live DOM state. Scope boundary finding `SV-01` is documented for human observation during L5 interactive review.
