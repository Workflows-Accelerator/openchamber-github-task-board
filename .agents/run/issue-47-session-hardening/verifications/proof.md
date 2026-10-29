# Deep Verification Result

**Task:** Hostile review and verification of Issue #47 session hardening and stay-signed-in promise (candidate 4b3f475)
**Status:** PASS
**Timestamp:** 2026-10-29T12:05:00Z

### Executed Levels
- **L0 Static:** PASS (`npm run typecheck` -> exit 0; `npx tsc -p web/tsconfig.json` -> exit 0)
- **L1 Unit:** PASS (`node --test web/tests/*.test.mjs` -> exit 0, 412 passed; `node --test --test-concurrency=1 test/*.test.js` -> exit 0, 553 passed)
- **L2 Integration:** PASS (Atomic file persistence, 0600 mode, scrypt deterministic salt, HMAC CSRF derivation, corruption recovery, lastSeen throttling)
- **L3 The User's Way (E2E / CLI / Browser):** PASS (Full HTTP server lifecycle with real loadConfig, POST /api/session login, 30-day Max-Age Set-Cookie, restart survival, cookie validation, CSRF requirement/rejection, logout deletion, password change rejection)
- **L4 Hostile Review (AI):** PASS (Findings A, B, C, D, E audited; B and C resolved in 4b3f475; A, D, E documented)
- **L5 Human Validation:** AWAITING HUMAN (batch `batch-simplify-views` on `dev`)

---

### Empirical Evidence ("The User's Way")

1. **L0 Static Typechecks:**
   - *Command:* `npm run typecheck`
   - *Exit Code:* `0`
   - *Command:* `npx tsc -p web/tsconfig.json`
   - *Exit Code:* `0`

2. **L1 Test Suites:**
   - *Command:* `node --test web/tests/*.test.mjs`
   - *Exit Code:* `0`
   - *Result Summary:* `412 passed, 0 failed, 0 skipped`
   - *Command:* `node --test --test-concurrency=1 test/*.test.js`
   - *Exit Code:* `0`
   - *Result Summary:* `553 passed, 0 failed, 0 skipped`

3. **L2 Integration Verification (Session Hardening & Derivation Invariants):**
   - *Command:* `node /tmp/antigravity/test_restart_behavior.mjs`
   - *Exit Code:* `0`
   - *Verified Invariants:*
     - Two independent `loadConfig` calls with identical `BOARD_PASSWORD` produce identical `passwordHash` via scrypt salt derived from `sessionSecret`.
     - File on disk (`sessions.json`) enforces mode `0600`.
     - Zero plaintext secrets stored on disk: no raw password, no password hash, no session ID, no cookie value, no CSRF token.
     - Sessions keyed by `sha256(sessionId)` and contain `passwordFingerprint` (HMAC-SHA256 of `passwordHash` with `sessionSecret`).
     - Session survives simulated restart and restores identical CSRF token derived from `HMAC(sessionSecret, 'csrf:' + id)`.
     - Changing `BOARD_PASSWORD` or `BOARD_SESSION_SECRET` invalidates existing sessions on disk and memory.
     - `BOARD_PASSWORD_HASH` configuration is supported and deterministic across restarts; hash rotation invalidates old sessions.
     - Cross-session CSRF token replay rejected; empty/invalid CSRF tokens rejected.
     - Destroy/logout immediately purges entry from disk; session cannot resurrect on restart.
     - Legacy session format from `af9b39c` (missing `passwordFingerprint`) is safely dropped on load and purged from file without crashing.
     - Corrupted JSON, truncated writes, invalid schemas, and unwritable directories handled gracefully without throwing or crashing.
     - `lastSeenAt` disk writes throttled to 60s; oldest sessions evicted when `maxSessions` (50) is reached.

4. **L3 Live HTTP Server Lifecycle Harness:**
   - *Command:* `node /tmp/antigravity/test_http_restart.mjs`
   - *Exit Code:* `0`
   - *Verified Flow:*
     - Server 1 initialized with real `loadConfig(env1)` using `BOARD_PASSWORD`.
     - `POST /api/session` returns 200 with `Set-Cookie: board_session=...; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Strict`.
     - Response body delivers `{ authenticated: true, csrfToken: '...' }`.
     - Authenticated `GET /api/session` succeeds on Server 1.
     - Server 1 stopped cleanly. `sessions.json` verified on disk (mode 0600, no secrets).
     - Server 2 started with independent `loadConfig(env2)` using the same session file.
     - Client `GET /api/session` with Server 1 cookie succeeds on Server 2 (session survived restart).
     - CSRF token on Server 2 matches Server 1 CSRF token identically.
     - Mutations without CSRF token receive HTTP 403 `csrf_rejected`.
     - Mutations with valid CSRF token succeed; `DELETE /api/session` logs out with HTTP 204.
     - Subsequent `GET /api/session` returns `authenticated: false`.
     - Server started with rotated password rejects old session cookie with `authenticated: false`.
     - Server started with `BOARD_PASSWORD_HASH` validates across restart, and rejects sessions after hash rotation.
     - Finding A confirmed: native form-urlencoded POST receives HTTP 400 `invalid_json`.

---

### Hostile Findings (L4)

| # | Finding | Severity | File:Line | Description | Resolution |
|---|---|---|---|---|---|
| A | Native form POST without JS returns 400 invalid_json | low | `web/server/app.ts:924` | HTML form has `method="post" action="/api/session"`, but backend handler `login()` only parses JSON. Credentials stay in POST body (no query param leak). | Open - defer until #48 web branch merges to prevent app.ts conflict. |
| B | CSRF token stored in plaintext in sessions.json | low | `web/server/auth.ts:165` (prior) | Prior candidate stored plaintext CSRF token. | Resolved in 4b3f475: CSRF token derived via `deriveCsrfToken(secret, id)`; never written to disk. |
| C | Changing BOARD_PASSWORD preserved sessions for 30 days | low | `web/server/auth.ts:220` (prior) | Prior candidate did not invalidate sessions on password change. | Resolved in 4b3f475: Bound sessions to `passwordFingerprint`; added deterministic scrypt salt in `config.ts:291`. Password change invalidates old sessions. |
| D | Version stamp falls back to package version if public dir missing | low | `web/server/app.ts:143` | If `web/public/` is missing, `getVersionStamp()` falls back to `package.json` version without asset content digest. | Accept: production deployment layouts always include `web/public/`. |
| E | Test isolation leak in hosting.test.mjs | low | `web/tests/hosting.test.mjs:186` | `hosting.test.mjs` runs `createBoardServer` with default `loadConfig(env)` without specifying `BOARD_SESSION_FILE`. In an environment where `/workspace/.openchamber-data/board/sessions.json` exists, it would load and prune production sessions. | Resolved: All server constructors and child processes in web/tests (`hosting.test.mjs`, `helpers.mjs`, `app.test.mjs`) explicitly isolated to unique temporary files with teardown cleanup. Behavioural regression verified with private stand-in default store. |

---

### Test Isolation Remediation & Durable Evidence (Finding E Repair)

**Timestamp:** 2026-10-29T12:45:00Z
**Repair Scope:** `web/tests/hosting.test.mjs`, `web/tests/helpers.mjs`, `web/tests/app.test.mjs`
**Status:** PASS

#### 1. Behavioural Regression Proof (Stand-In Default Store)
- *Command:* `node --test web/tests/hosting.test.mjs`
- *Exit Code:* `0`
- *Result:* `12 passed, 0 failed, 0 skipped`
- *Verified:*
  - A private temporary stand-in default store (`standin-data-*/board/sessions.json`) populated with sentinel data was created.
  - Buggy setup (omitted `BOARD_SESSION_FILE`) discriminated: verified that the old setup leaked to and mutated the stand-in default store, overwriting the sentinel.
  - Repaired setup: constructor run with `isolatedSessionFile`; verified that the stand-in default store remained 100% byte-for-byte identical to the original sentinel data.
  - Verified that the isolated session file was created, populated, and used.
  - Zero access or probing of `/workspace/.openchamber-data/**`.

#### 2. Durable Secret-Free Harness Runs & Evidence Preservation
- *Harness 1:* `.agents/run/issue-47-session-hardening/harnesses/test_restart_behavior.mjs`
  - *Command:* `node .agents/run/issue-47-session-hardening/harnesses/test_restart_behavior.mjs`
  - *Exit Code:* `0`
  - *Log Artifact:* `.agents/run/issue-47-session-hardening/verifications/test_restart_behavior.log`
  - *Content:* 12 L2 invariants verified; zero plaintext secrets or raw tokens logged.
- *Harness 2:* `.agents/run/issue-47-session-hardening/harnesses/test_http_restart.mjs`
  - *Command:* `node .agents/run/issue-47-session-hardening/harnesses/test_http_restart.mjs`
  - *Exit Code:* `0`
  - *Log Artifact:* `.agents/run/issue-47-session-hardening/verifications/test_http_restart.log`
  - *Content:* Full HTTP server lifecycle, login, cookie issue, restart survival, CSRF enforcement, logout, and rotation verified; secrets redacted.

#### 3. Full Test Suite Verification (With Isolated Stores)
- *Command:* `npm run typecheck` -> `exit 0`
- *Command:* `npx tsc -p web/tsconfig.json` -> `exit 0`
- *Command:* `node --test web/tests/*.test.mjs` -> `exit 0` (`413 passed, 0 failed, 0 skipped`)
- *Command:* `node --test --test-concurrency=1 test/*.test.js` -> `exit 0` (`553 passed, 0 failed, 0 skipped`)

#### 4. Historical Live Data Impact Assessment
- **Status:** `UNKNOWN`
- In accordance with task constraints, `/workspace/.openchamber-data/**` was not inspected, stat'd, loaded, or altered. Whether earlier test runs prior to candidate 4b3f475 affected live data is strictly unverified and recorded as UNKNOWN.

---

---

### Human Review Brief (L5)

**Batch:** `batch-simplify-views`  **Branch:** `fix/issue-47-fresh-app-stay-signed-in`
| # | What to click | What should happen |
|---|---|---|
| 1 | Visit the web board root URL `/` | Login form is rendered with hidden username input (`board`, autocomplete `username`) and password field (`current-password`). Chrome / password managers offer saved credentials. |
| 2 | Enter board password and submit | Successful authentication; session cookie issued with 30-day Max-Age (2,592,000s); board view loads. |
| 3 | Restart the board server daemon (`service/main` or container) and refresh the page | User stays signed in; no re-login prompt appears. |
| 4 | Click "Sign out" in the top bar | Session is terminated immediately; refreshing prompts for password; server disk file purges session record. |
| 5 | Inspect Service Worker in Browser DevTools (Application > Service Workers) | Service worker registered with `updateViaCache: 'none'`, cache name contains version stamp, app shell assets cached network-first. |

**Known blind spots for the human to focus on:**
- Autofill dropdown presentation on physical iOS Safari and Android Chrome devices.
- Visual transition fluidity when new service worker takes control and page reloads.

---

### Failures & Blind Spots
- **Failures:** None. Both test suites pass cleanly with exit code 0.
- **Not Verified:**
  - Physical biometric/credential autofill on mobile hardware (iOS Keychain, Android Credential Manager).
  - Multi-process concurrency (SessionStore is single-instance per deployment container).
- **Flakiness Note:** `test/scale-and-adversarial.test.js` (test 348) and `test/stage1-dual-mode-and-scoping.test.js` (test 426) enforce CPU execution thresholds (<60ms and <50ms) that may fail if the machine is under external CPU saturation; both pass cleanly in isolation and under standard concurrency.
