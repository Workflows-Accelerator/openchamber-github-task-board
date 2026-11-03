# Verification Proof: Issue #54 Never Flash Sign-in on Open / Reload

**Task:** Eliminate the `#login-view` visual flash when opening or reloading the online task board while already signed in, per aligned decision D62.
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash`
**Branch:** `fix/issue-54-no-signin-flash`
**Base Commit:** `8b7e059b17b7f4fad61a7466cd35cb34467807ef`
**Date:** Mon Nov 02 2026
**Provider / Model:** `9router / engineer`

---

## 1. Root Cause & Solution Architecture

### Root Cause
In `web/public/index.html`, `#login-view` was statically defined without the `hidden` attribute, while `#board-view` carried the `hidden` attribute. On initial load or reload, `web/public/app.js` executed `boot()`, which sequentially awaited:
1. `GET /api/session` (~10-15ms)
2. `GET /api/repos` (~20ms)
3. `GET /api/combined/board` (~100-350ms on local, ~1.2-1.8s over WAN)

Only after all three requests completed did `loadBoard()` call `showView('board')`. Throughout this entire cascade, the private sign-in form remained visible on screen to already-authenticated users.

### Aligned Decision D62 Solution
1. **Static HTML Visibility Inversion:**
   - `#login-view` statically has the `hidden` attribute in `web/public/index.html`.
   - `#board-view` does NOT carry `hidden` in `web/public/index.html` (opens straight into board shell).
2. **Immediate Board Shell Reveal:**
   - In `boot()`, as soon as `GET /api/session` resolves with `authenticated: true`, `#board-view` is revealed immediately without waiting for `/api/repos` or `/api/combined/board`.
3. **Client Auth Hint & Board Cache:**
   - Non-secret client flag `tb_auth_hint = '1'` in `localStorage` set on authenticated sessions.
   - Cached board snapshot stored in `tb_cached_board` on successful board loads.
   - When `tb_auth_hint === '1'` and `tb_cached_board` exists, `boot()` immediately renders the cached board tasks before network requests finish.
   - Flag and cache are cleared upon `showLogin()`, unauthenticated response (`authenticated: false` or 401), or sign out (`DELETE /api/session`).
4. **Clean Sign-Out & Unauthenticated Handling:**
   - Unauthenticated visitors immediately flip to `#login-view` upon `/api/session` completing (~10ms).
   - Sign out immediately hides `#board-view`, reveals `#login-view`, and purges cached board data and auth hint.

---

## 2. Red-Green TDD Unit Test Results

New unit test suite written first (red) in `web/tests/issue-54-no-signin-flash.test.mjs`:
- **Red Phase (before implementation):**
  - Test 1.a (Static HTML markup): FAILED (login-view missing hidden, board-view had hidden).
  - Test 1.b (Immediate board reveal on session): FAILED (waited for repos before revealing board).
  - Test 1.c (Auth hint lifecycle): FAILED (tb_auth_hint not set or cleared).
  - Test 1.d (Cached board render on boot): FAILED (no cached board render).
  - Test 1.e (Unauthenticated boot): FAILED.
  - Test 1.f (Network failure fallback): FAILED.
- **Green Phase (after implementation):**
  - All 6 tests passing (exit code 0, duration 211ms).

---

## 3. Real Browser (Obscura CDP) Verification

Executed standalone harness `.agents/run/issue-54-build/harnesses/verify-no-flash.mjs` against a local Task Board server with isolated temp session storage and synthetic GitHub issues, with an artificial 300ms network delay on issue listing to simulate WAN latency.

### Reload Mutation Timeline Under Simulated WAN Latency
Across the entire 476ms reload lifecycle (`navigationStart` -> `DOMContentLoaded` -> `fetch /api/session` -> `fetch /api/repos` -> `fetch /api/combined/board`), `#login-view.hidden` remained `true` at every single event checkpoint:

| Timestamp | Event | #login-view.hidden | #board-view.hidden | Detail / Duration |
| :--- | :--- | :--- | :--- | :--- |
| `t=61.8ms` | `init_script_start` | `true` | `false` | Initial DOM state |
| `t=71.8ms` | `fetch_start` | `true` | `false` | `/api/session` |
| `t=72.8ms` | `DOMContentLoaded` | `true` | `false` | DOM ready |
| `t=77.8ms` | `fetch_end` | `true` | `false` | `/api/session` (6ms, `authenticated: true`) |
| `t=79.8ms` | `fetch_start` | `true` | `false` | `/api/repos` |
| `t=79.8ms` | `hidden_attribute_changed` | `true` | `false` | `showView('board')` call |
| `t=94.8ms` | `fetch_end` | `true` | `false` | `/api/repos` (15ms) |
| `t=96.8ms` | `fetch_start` | `true` | `false` | `/api/combined/board` (simulated WAN) |
| `t=471.8ms` | `fetch_end` | `true` | `false` | `/api/combined/board` (374ms) |
| `t=474.8ms` | `hidden_attribute_changed` | `true` | `false` | Fresh board render complete |
| `t=476.8ms` | `hidden_attribute_changed` | `true` | `false` | View synchronization |

**Result:** Flash duration: **0ms**. `#login-view` was never visible during reload. `#board-view` remained visible throughout.

### Browser Checks Summary (12/12 PASS)
1. Unauthenticated: login-view is visible after session check: **PASS**
2. Unauthenticated: board-view is hidden: **PASS**
3. Unauthenticated: tb_auth_hint is not set: **PASS**
4. Sign-in: tb_auth_hint is set to 1: **PASS**
5. Sign-in: tb_cached_board is saved in localStorage: **PASS**
6. Sign-in: task rows rendered (count=2): **PASS**
7. No flash: #login-view.hidden was ALWAYS true throughout reload lifecycle: **PASS**
8. Continuity: #board-view.hidden was NEVER true during reload lifecycle: **PASS**
9. Flash duration is 0ms: **PASS**
10. Sign-out: #login-view is visible after sign out: **PASS**
11. Sign-out: #board-view is hidden after sign out: **PASS**
12. Sign-out: tb_auth_hint is cleared: **PASS**
13. Sign-out: tb_cached_board is cleared: **PASS**

### Captured Screenshots
- `.agents/run/issue-54-build/screenshots/01-unauthenticated-login-view.png`
- `.agents/run/issue-54-build/screenshots/02-signed-in-board-view.png`
- `.agents/run/issue-54-build/screenshots/03-reload-early-shell.png`
- `.agents/run/issue-54-build/screenshots/04-reload-complete-board.png`
- `.agents/run/issue-54-build/screenshots/05-signed-out-login-view.png`

---

## 4. Full Test Suite & Typecheck Summary

| Test Suite / Command | Total Tests | Pass | Fail | Exit Code | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `node --test web/tests/issue-54-no-signin-flash.test.mjs` | 6 | 6 | 0 | 0 | 212ms |
| `node --test web/tests/*.test.mjs` | 459 | 459 | 0 | 0 | 24.17s |
| `npm test` (root suite `test/*.test.js`) | 618 | 618 | 0 | 0 | 15.22s |
| `npx tsc --noEmit` | - | - | - | 0 | 1.8s |
| `npx tsc -p web/tsconfig.json --noEmit` | - | - | - | 0 | 1.9s |
| `node .agents/run/issue-54-build/harnesses/verify-no-flash.mjs` | 13 | 13 | 0 | 0 | 4.8s |

Zero test weakening, zero skipped tests, zero emojis in code or proof.
