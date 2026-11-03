# Independent Audit Proof: Issue #54 Never Flash Sign-in on Open / Reload

**Task:** Independent audit of `git diff 8b7e059..5b9bb70` for Issue #54 (D62: eliminate visual `#login-view` flash on reload when signed in; open straight into `#board-view`).
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash`
**Branch:** `fix/issue-54-no-signin-flash`
**Base Commit:** `8b7e059b17b7f4fad61a7466cd35cb34467807ef`
**Audited Commit:** `5b9bb705f3f7eea7fbf39fa456adc0a1eb254376`
**Date:** Mon Nov 02 2026
**Provider / Model:** `9router / engineer`

---

## 1. Two-Verdict Gate

- **Spec Compliance:** PASS
  - The implementation eliminates the visual sign-in flash on reload while authenticated.
  - `#login-view` is statically hidden by default and `#board-view` opens immediately without waiting for `/api/repos` or `/api/combined/board`.
  - Unauthenticated visitors are routed to `#login-view` upon `/api/session` completion without getting stuck.
  - Sign out immediately hides `#board-view`, displays `#login-view`, and purges client auth hint and cached board data.
- **Code Quality:** APPROVED
  - The changes are minimal, defensive, and conform to the project architecture.
  - All 5 adversarial findings (ADV-54-01 through ADV-54-05) are genuinely closed in production code and verified by dedicated regression tests.

---

## 2. Product Diff & Boundary Verification

### Diff Scope
- `panel/**`: 0 lines changed (0 diff)
- `service/**`: 0 lines changed (0 diff)
- `test/**`: 0 lines changed (0 diff)
- `web/**`: Only three files modified:
  - `web/public/index.html` (+6, -3): Inverts static view visibility; adds `<noscript>` fallback; hides `#board-toolbar` statically.
  - `web/public/app.js` (+151, -20): Auth hint and cached board lifecycle; immediate shell reveal; CSRF promise synchronization on mutations; comprehensive DOM scrubbing on sign out; defensive cache deserialization.
  - `web/tests/issue-54-no-signin-flash.test.mjs` (+728, -0): 11 comprehensive automated tests covering all functional requirements and hostile edge cases.

### Secret & CSRF Storage Audit
A complete audit of `web/public/app.js` confirms:
- `tb_auth_hint` only ever stores the static string `'1'` (`localStorage.setItem(AUTH_HINT_KEY, '1')`) and is cleared via `localStorage.removeItem(AUTH_HINT_KEY)`.
- `tb_cached_board` stores only `state.board` (repository name, issues array, status options). The backend `/api/combined/board` and repository board endpoints never return session secrets or CSRF tokens.
- `state.csrf` is held exclusively in memory; it is never written to `localStorage`, session storage, cookies, or the DOM.

---

## 3. Adversarial Findings (ADV-54-01 through ADV-54-05) Audit

| Finding ID | Title & Issue | Production Fix Verification | Automated Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- |
| ADV-54-01 | UX / Noscript Fallback & Toolbar Hiding | `<noscript>` CSS fallback added to `index.html` ensuring `#login-view` is shown and `#board-view` hidden when JS is disabled. Statically hid `#board-toolbar` with `hidden` attribute in markup. | `test('2.a Hostile 1: Static HTML noscript fallback reveals #login-view, and #board-toolbar is hidden until auth confirms')` | CLOSED |
| ADV-54-02 | Security / DOM Scrubbing on Logout | `clearRenderedData()` expanded to clear `ac-list`, `subtasks-list`, `detail-title`, `detail-subtitle`, `detail-freshness`, `recoverable-drafts`, `status-select`, `scope-status`, `discovery-status`, `refresh-policy`, and hide `#board-toolbar`. | `test('2.b Hostile 2: Security & Privacy: showLogin() thoroughly scrubs sensitive task data from all DOM nodes')` | CLOSED |
| ADV-54-03 | Concurrency / CSRF Race on Early Interaction | `api()` checks `isMutation && !state.csrf && state.sessionPromise` and awaits `state.sessionPromise` before sending `x-csrf-token`, avoiding 403 CSRF rejection if user clicks early. | `test('2.c Hostile 3: Concurrency & CSRF: mutations fired while cached board is rendered await in-flight /api/session check')` | CLOSED |
| ADV-54-04 | Resilience / Corrupted Cache Deserialization | `getCachedBoard()` sanitizes `parsed.issues` ensuring items are non-null objects with numeric `number`. `boot()` wraps cached board render in try/catch to reset cleanly on corrupt items. | `test('2.d Hostile 4: Corrupted cache resilience: malformed / non-object entries in tb_cached_board do not crash boot()')` | CLOSED |
| ADV-54-05 | Cache Freshness / Mutation Synchronization | `saveCachedBoard(state.board)` called on `publishMutation` and quick-add draft creation, keeping `tb_cached_board` fresh across reloads. | `test('2.e Hostile 5: Cache freshness on mutations: publishMutation updates tb_cached_board immediately')` | CLOSED |

---

## 4. Test Suite Execution & Browser Verification Results

### Test Results Summary
- **New Unit Suite (`node --test web/tests/issue-54-no-signin-flash.test.mjs`):**
  - Total: 11 tests | Passed: 11 | Failed: 0 | Duration: 206ms | Exit: 0
- **Full Web Suite (`node --test web/tests/*.test.mjs`):**
  - Total: 464 tests | Passed: 464 | Failed: 0 | Duration: 26.0s | Exit: 0
- **Root Suite (`npm test`):**
  - Total: 618 tests | Passed: 618 | Failed: 0 | Duration: 14.9s | Exit: 0
- **Typechecks:**
  - `npx tsc --noEmit`: 0 errors | Exit: 0
  - `npx tsc -p web/tsconfig.json --noEmit`: 0 errors | Exit: 0

### Obscura Browser CDP Verification (`verify-no-flash.mjs`)
- Executed against real Task Board server with isolated temp session and simulated 300ms WAN delay on board retrieval:
  - Check 1 (Unauthenticated visit routes to login view): PASS
  - Check 2 (Unauthenticated board view hidden): PASS
  - Check 3 (Unauthenticated auth hint unset): PASS
  - Check 4 (Sign-in sets auth hint to 1): PASS
  - Check 5 (Sign-in caches board snapshot): PASS
  - Check 6 (Sign-in renders task rows): PASS
  - Check 7 (`#login-view.hidden` ALWAYS `true` across reload lifecycle): PASS
  - Check 8 (`#board-view.hidden` NEVER `true` across reload lifecycle): PASS
  - Check 9 (Visual flash duration: 0ms): PASS
  - Check 10 (Sign-out reveals login view): PASS
  - Check 11 (Sign-out hides board view): PASS
  - Check 12 (Sign-out purges auth hint): PASS
  - Check 13 (Sign-out purges cached board): PASS
- Total Obscura Checks: 13/13 PASS. Flash duration: 0ms.
