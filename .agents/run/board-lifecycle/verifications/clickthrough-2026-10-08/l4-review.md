# L4 Hostile Review: Click-Through Repair 1 (Friendly Titles, Repo Picker, All Projects Grouping)

**Date:** 2026-10-08  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-clickthrough-titles-queues-picker`  
**Branch:** `fix/clickthrough-titles-queues-picker`  
**Reviewed Commit:** `7f440af` (`fix(panel): repair clickthrough friendly titles, repo picker, and all projects grouping (D14, D15, D16)`)  
**Base:** `e5e45b2`  
**Reviewer:** dynamic-agent (L4 Hostile Reviewer)  

---

## 1. Two-Verdict Statement & Overall Status

- **Spec Compliance:** `PASS` (Satisfies human click-through bounce requirements D14, D15, D16, SV-01, and empty state distinctions).
- **Quality:** `APPROVED` (Robust bundle testing, byte parity, zero console errors, XSS protections verified).
- **Overall Verdict:** `PROCEED-WITH-CONDITIONS` (Zero HIGH, zero MEDIUM, one LOW edge case identified in regex link parsing).

---

## 2. Findings Summary

| ID | Severity | Category | Description | Required Action / Fix |
|---|---|---|---|---|
| F-01 | LOW | Parsing Edge Case | In `formatTaskTextWithLinks` (`panel/core.ts:175-195`), sequential regex replacements run over generated HTML. If a markdown link label contains an issue reference or URL (e.g. `[https://github.com/a/b/issues/1](...)` or `[owner/repo#1](...)`), inner text is matched and wrapped in a nested `<a>` tag, violating HTML5 specs. Additionally, two consecutive issue URLs separated by a single space will have the second URL skipped due to delimiter consumption in regex 2. | Refactor `formatTaskTextWithLinks` to token-based parser or use negative lookaheads/lookbehinds instead of delimiter-consuming character classes. Non-blocking for click-through preview. |

---

## 3. Systematic Criteria Verification

### Criterion 1: Root-Cause Authenticity
- **Claim:** During live preview, OpenChamber guest storage (`/workspace/.openchamber-data/guest-storage/github-task-board.json`) injected 5 stale cached issues (#1-#5) created before Friendly Titles and Human Tasks existed. Unauthenticated rate-limiting / CSP then failed subsequent network fetches, trapping the UI in the stale cache. Because #1-#5 lacked `### Friendly Title:` headers and `resolveSimplifiedViewTitle` returned `(No friendly title)`, every issue showed the placeholder and queues were empty.
- **Empirical Hostile Verification:**
  - Directly inspected `/workspace/.openchamber-data/guest-storage/github-task-board.json`: confirmed key `cached_issues_Workflows-Accelerator/openchamber-github-task-board` held issues `[5, 4, 3, 2, 1]`. None contained `### Friendly Title:` or `### Human Tasks:`.
  - Re-fetched live bodies of issues #23 and #24 via GitHub REST API using credentials helper: confirmed both bodies start with `### Friendly Title:` ("Add Simplified Task Views" and "Find and Switch Repositories") and carry populated `### Human Tasks:` and `### Open Questions:`.
  - Proved that the empty queues and placeholder titles were symptoms of the same cache-lock failure, exacerbated by `resolveSimplifiedViewTitle` violating user decision D14.
- **Verdict:** `PASS`. Root cause is authentic, empirically proven with live payloads and exact file:line anchors (`panel/main.ts:1347-1358, 1433-1439`, `panel/core.ts:145-161`).

### Criterion 2: Decision D14 — Elimination of "(No friendly title)" Placeholder
- **Repo-wide Grep Audit:** Grepped `git grep -i "no friendly title"`. Zero occurrences found in production code (`panel/core.ts`, `panel/main.ts`, `panel/main.js`). All test assertions expecting `(No friendly title)` were updated to expect `issue.title` (or `Issue #N` fallback). Remaining occurrences exist strictly in historical briefs and root cause analysis documents.
- **Behavioral Fallback Verification:** When no Friendly Title header exists, `resolveSimplifiedViewTitle` returns:
  `displayTitle: issue.title?.trim() || 'Issue #' + issue.number`, `displaySubtitle: null`, `isPlaceholder: false`.
  No conventional-commit slug is elevated or labeled with italic placeholder styling, and technical titles are never duplicated as subtitles.
- **Mutation Probe:**
  - Probe: Mutated `fallbackTitle` in `panel/core.ts:158` to `'MUTATED_FALLBACK'`.
  - Result: `RED` — 4 tests failed with AssertionError across `test/clickthrough-repair-titles-queues-picker.test.js` and `test/review-feedback-views.test.js`.
  - Restored: `GREEN` — all 294 tests passed.
- **Verdict:** `PASS`.

### Criterion 3: Decision D15 — Repo Picker Inline Session Repo & Honest Status
- **DOM & Visual Hierarchy:**
  - In `renderRepoPopoverList` (`panel/main.ts:878-945`), the current session repository is always computed via `getSessionLinkedRepo()` and rendered inline within the "Current session" option: `<span class="session-repo-inline">Session repo: ...</span>`.
  - The actively selected repo is visibly distinguished with class `.is-active.selected-repo` (green left-border accent `var(--succ)`) and explicit badge `<span class="status-pill status-pill-picked">[picked]</span>`.
  - If a sync failure occurs, `lastSyncErrorState` renders an actionable notice banner in the popover explaining rate limits and instructing the user to enter a Personal Access Token.
  - When issues are empty due to rate limiting, `renderEmptyState` renders `empty-state-rate-limited` with a clock SVG and token instructions.
- **Mutation Probe:**
  - Probe: Mutated `sessionRepoDisplay` in `panel/main.ts:880` to `'MUTATED_SESSION_REPO'` and rebuilt bundle.
  - Result: `RED` — subtests 4 and 5 in `test/clickthrough-repair-titles-queues-picker.test.js` failed (`must display linked session repo inline`, `must display Session repo: none linked`).
  - Restored: `GREEN` — all tests passed.
- **Verdict:** `PASS`.

### Criterion 4: Decision D16 — All Projects Grouping & Cross-Repo Links
- **Grouping:** In All Projects mode (`isAllProjectsMode = true`), both `renderHumanTasksView` (`panel/main.ts:3390-3413`) and `renderQuestionsView` (`panel/main.ts:3804-3832`) cluster items by repository under sticky headers (`.human-repo-header`, `.questions-repo-header`).
- **Link Conversion:** `formatTaskTextWithLinks` (`panel/core.ts:175-202`) converts cross-repo shorthand `org/repo#123` and full GitHub issue URLs into `<a>` links pointing to `https://github.com/org/repo/issues/123` with target `_blank` and `rel="noopener noreferrer"`. Same-repo issues (`currentRepo#123` or `#123`) remain self-contained prose.
- **XSS & Injection Hostile Audit:**
  - Raw HTML strings are sanitized via `escapeHtmlInternal` before regex linking (`<` -> `&lt;`, `"` -> `&quot;`).
  - Probed hostile payloads:
    - `<script>alert(1)</script>` -> sanitized to `&lt;script&gt;alert(1)&lt;/script&gt;` (PASS).
    - `[click](https://evil.com/x"onmouseover="alert(1))` -> attribute value cannot break out into `onmouseover` because double-quote is escaped to `&quot;` (PASS).
    - `[click](javascript:alert(1))` -> does not match `https?://` protocol requirement (PASS).
- **Verdict:** `PASS-WITH-CONDITIONS` (Subject to Finding F-01).

### Criterion 5: Decision SV-01 — Session Switch Exits All Projects Mode
- **Code Audit:** In `host.onSession` (`panel/main.ts:7380-7385`), when `sessionChanged` is detected (`activeSessionId !== sess.id`), `isAllProjectsMode` and `isManualRepoOverride` are reset to `false`.
- **Test Proof:** Verified in subtest `SV-01: Switching session while in All Projects mode exits to that session repo` in `test/clickthrough-repair-titles-queues-picker.test.js`.
- **Verdict:** `PASS`.

### Criterion 6: Empty States Differentiation
- **Code Audit:** `renderEmptyState` (`panel/main.ts:2467-2495`) distinctly differentiates all 4 states:
  - `empty`: In-box SVG, "No Issues in Repository".
  - `inaccessible`: Lock SVG (warning amber), "Inaccessible Repository".
  - `failed`: Alert SVG (error red), "Failed to Load Repository".
  - `rate-limited`: Clock SVG (warning amber), "API Rate-Limited", actionable token guidance.
- **Verdict:** `PASS`.

### Criterion 7: Test Authenticity Audit
- `test/clickthrough-repair-titles-queues-picker.test.js` does NOT use simulate-style or static regex mocks. It instantiates `createTestApp` (`test/test-app-harness.js`), which loads and executes the compiled `panel/main.js` IIFE in a Node VM harness with realistic DOM mock nodes.
- Full suite includes 294 passing tests (289 baseline + 5 new tests in the new file).
- **Verdict:** `PASS`.

### Criterion 8: Gate Verification
- `npm run typecheck`: 0 errors (PASS).
- `npm run build`: built in 59ms (PASS).
- `git diff --exit-code panel/main.js`: exit 0 (Byte parity verified) (PASS).
- `node --test test/*.test.js`: 294 passed, 0 failed, 0 flaked (PASS).

### Criterion 9: Screenshot Authenticity
All 6 screenshots under `.agents/run/board-lifecycle/verifications/clickthrough-2026-10-08/screenshots/` were generated by `scripts/generate-verification-screenshots.mjs` using `obscura fetch` against the real bundle:
1. `01-all-tasks-d14-fallback.png` (51,203 bytes): Shows All Tasks view with friendly titles on #21, #23, #24 and clean fallback directly to technical title on #22 without placeholder.
2. `02-human-tasks-view.png` (80,720 bytes): Shows populated Human Tasks view with items from #21, #23, and #24. Full URL cross-repo link rendered in blue.
3. `03-questions-view.png` (72,930 bytes): Shows populated Questions view with open questions across issues and active Answer buttons.
4. `04-repo-popover-d15-picked-and-notice.png` (43,654 bytes): Shows popover with inline session repo (`Session repo: Workflows-Accelerator/openchamber-github-task-board`), `[active default]` anchor, and `[picked]` badge on active repo.
5. `05-all-projects-d16-grouping.png` (102,153 bytes): Shows All Projects mode grouping Human Tasks by repository under sticky repository headers.
6. `06-empty-state-rate-limited.png` (38,143 bytes): Shows dedicated rate-limited empty state with clock icon and Personal Access Token instructions.
- **Verdict:** `PASS`.

### Criterion 10: Scope & Safety Audit
- Only approved files were modified in commit `7f440af`.
- Working tree is clean (`git status` clean).
- Zero credentials, tokens, or private secrets committed or logged.

---

## 4. Final Verdict

`PROCEED-WITH-CONDITIONS`  
Commit `7f440af` cleanly resolves the three human click-through bounces (D14, D15, D16) and proves the root cause of the live preview failures. Work is ready for human click-through validation.
