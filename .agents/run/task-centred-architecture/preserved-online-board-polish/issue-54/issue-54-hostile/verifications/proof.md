# Hostile Verification Proof: Issue #54 Never Flash Sign-in on Open / Reload

**Task:** Conduct adversarial/hostile review of commit `b14a787214bf436d389223bba86f9363a6bc5681` (Issue #54 / Decision D62) to find edge cases, race conditions, privacy leaks, and regressions.
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash`
**Branch:** `fix/issue-54-no-signin-flash`
**Base Commit:** `8b7e059b17b7f4fad61a7466cd35cb34467807ef`
**Commit Under Review:** `b14a787214bf436d389223bba86f9363a6bc5681`
**Date:** Mon Nov 02 2026
**Provider / Model:** `9router / engineer`

---

## 1. Two-Verdict Review Summary

- **Spec Compliance:** PASS
  - The implementation eliminates visual sign-in flash on reload while authenticated.
  - `#login-view` is hidden by default and `#board-view` opens immediately.
  - Unauthenticated visitors are routed to `#login-view` upon `/api/session` completion without getting stuck.
  - Sign out purges client auth hint and cached board snapshot.
- **Code Quality:** APPROVED
  - Addressed edge cases across noscript fallback, board toolbar hiding, DOM scrubbing on session invalidation, CSRF concurrency race during early cached board interaction, corrupted cache sanitization, and cache freshness on mutations.

---

## 2. Adversarial Findings & Resolution Matrix

| ID | Category | Severity | Finding | Resolution Status |
| :--- | :--- | :--- | :--- | :--- |
| ADV-54-01 | UX / Accessibility | Moderate | If JavaScript is disabled or blocked, static `#board-view` was visible while `#login-view` remained hidden. Furthermore, `#board-toolbar` was unhidden in static markup, displaying active board controls to unauthenticated visitors before auth verification. | FIXED: Added `<noscript>` style fallback ensuring `#login-view` displays and `#board-view` hides when JS is disabled. Statically hid `#board-toolbar` with `hidden` attribute and revealed it only after authentication is confirmed. |
| ADV-54-02 | Security & Privacy | Moderate | On shared computers, if a session was revoked or expired, `showLogin()` emptied some board elements but left others populated in hidden DOM (`#ac-list`, `#subtasks-list`, `#detail-subtitle`, `#detail-freshness`, `#recoverable-drafts`, `#filter-chips`, `#repo-options-list`, `#status-select`, `#scope-status`, `#discovery-status`, `#refresh-policy`). | FIXED: Updated `clearRenderedData()` in `web/public/app.js` to scrub all task-bearing DOM elements and hide `#board-toolbar`. |
| ADV-54-03 | Concurrency & Race | Moderate | If a user interacted with the cached board immediately on boot before `/api/session` finished, a mutation request could fire without `state.csrf`, causing a 403 CSRF rejection. | FIXED: Tracked in-flight `state.sessionPromise` during `boot()`. In `api()`, mutation calls await `state.sessionPromise` to acquire `state.csrf` before sending `x-csrf-token`. |
| ADV-54-04 | Resilience & Robustness | Low | Corrupted or malformed entries in `tb_cached_board` (e.g. non-object issue items or missing numbers) could trigger unhandled exceptions in `filterSort()` or `renderBoard()`, crashing `boot()`. | FIXED: Added issue filtering and defensive validation in `getCachedBoard()`, and wrapped cached board render in `boot()` with try/catch to safely clear auth hint on failure. |
| ADV-54-05 | Cache Freshness | Low | `publishMutation` and quick-add draft updated `state.board` in memory, but did not sync `tb_cached_board` in `localStorage`. A page reload right after a mutation showed stale cached task data until the network board load finished. | FIXED: Added `saveCachedBoard(state.board)` calls to `publishMutation` and quick-add draft handlers. |

---

## 3. Regression Tests Added

Added 5 comprehensive adversarial test cases to `web/tests/issue-54-no-signin-flash.test.mjs`:
1. `2.a Hostile 1: Static HTML noscript fallback reveals #login-view, and #board-toolbar is hidden until auth confirms`
2. `2.b Hostile 2: Security & Privacy: showLogin() thoroughly scrubs sensitive task data from all DOM nodes`
3. `2.c Hostile 3: Concurrency & CSRF: mutations fired while cached board is rendered await in-flight /api/session check`
4. `2.d Hostile 4: Corrupted cache resilience: malformed / non-object entries in tb_cached_board do not crash boot()`
5. `2.e Hostile 5: Cache freshness on mutations: publishMutation updates tb_cached_board immediately`

---

## 4. Verification Output & Results

| Verification Suite / Tool | Tests Total | Passed | Failed | Exit Code | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `node --test web/tests/issue-54-no-signin-flash.test.mjs` | 11 | 11 | 0 | 0 | PASS (11/11 tests pass) |
| `node --test web/tests/*.test.mjs` | 464 | 464 | 0 | 0 | PASS (464/464 tests pass) |
| `npm test` (root test suite) | 618 | 618 | 0 | 0 | PASS (618/618 tests pass) |
| `npx tsc --noEmit` | - | - | - | 0 | PASS (0 errors) |
| `npx tsc -p web/tsconfig.json --noEmit` | - | - | - | 0 | PASS (0 errors) |
| `node .agents/run/issue-54-build/harnesses/verify-no-flash.mjs` (Obscura CDP) | 13 | 13 | 0 | 0 | PASS (0ms flash verified) |

Obscura reload timeline verified 0ms flash duration across the entire reload lifecycle under 300ms simulated WAN delay.
