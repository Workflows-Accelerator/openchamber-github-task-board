# Deep Verification Result

**Task:** Hostile review and verification of Issue #47 test isolation repairs and stay-signed-in promise (candidate 268bd28738443863d6a58b5e4500ad20b6aaa05f vs reviewed product base 4b3f4750bf20bf370bbdc4632a05714e8e3dd009)
**Status:** PASS
**Timestamp:** 2026-10-29T13:15:00Z
**Reviewer:** ses_reviewer (Provider: 9router, Model: engineer)

---

### Machine-Readable Verdicts
- **Spec Compliance:** PASS
- **Quality:** APPROVED
- **Finding E (Test Isolation Leak):** CLOSED

---

### Executed Levels
- **L0 Static:** PASS (`npm run typecheck` -> exit 0; `npx tsc -p web/tsconfig.json` -> exit 0)
- **L1 Unit / Regression:** PASS (`node --test web/tests/hosting.test.mjs` -> exit 0, 12 passed; `node --test web/tests/*.test.mjs` -> exit 0, 413 passed; `node --test --test-concurrency=1 test/*.test.js` -> exit 0, 553 passed)
- **L2 Integration:** PASS (`node .agents/run/issue-47-session-hardening/harnesses/test_restart_behavior.mjs` -> exit 0, 12 invariants verified)
- **L3 The User's Way (HTTP Lifecycle):** PASS (`node .agents/run/issue-47-session-hardening/harnesses/test_http_restart.mjs` -> exit 0, 9 lifecycle steps verified)
- **L4 Hostile Review (AI Adversarial):** PASS (All test and child process constructor paths audited; Finding E verified closed with behavioral discrimination; zero secret exposure; zero product regressions)
- **L5 Human Validation:** AWAITING HUMAN (batch `batch-simplify-views` on `dev`)

---

### Empirical Evidence ("The User's Way")

1. **L0 Static Typechecks:**
   - *Command:* `npm run typecheck`
   - *Exit Code:* `0`
   - *Command:* `npx tsc -p web/tsconfig.json`
   - *Exit Code:* `0`

2. **L1 Unit & Targeted Integration Suites:**
   - *Command:* `node --test web/tests/hosting.test.mjs`
   - *Exit Code:* `0`
   - *Result Summary:* `12 passed, 0 failed, 0 skipped`
   - *Command:* `node --test web/tests/*.test.mjs`
   - *Exit Code:* `0`
   - *Result Summary:* `413 passed, 0 failed, 0 skipped`
   - *Command:* `node --test --test-concurrency=1 test/*.test.js`
   - *Exit Code:* `0`
   - *Result Summary:* `553 passed, 0 failed, 0 skipped`

3. **L2 Retained Session Invariants Harness:**
   - *Command:* `node .agents/run/issue-47-session-hardening/harnesses/test_restart_behavior.mjs`
   - *Exit Code:* `0`
   - *Output:* 12 session lifecycle and crypto derivation invariants passed; zero plaintext secrets or unredacted tokens logged.

4. **L3 Retained HTTP Lifecycle & Restart Harness:**
   - *Command:* `node .agents/run/issue-47-session-hardening/harnesses/test_http_restart.mjs`
   - *Exit Code:* `0`
   - *Output:* 9 steps passed (Server 1 login, 30-day Max-Age cookie, Server 2 restart survival, CSRF requirement and rejection, HTTP 204 logout purge, password rotation invalidation, BOARD_PASSWORD_HASH support, Finding A audit).

---

### Test Isolation Audit & Behavioural Discrimination Proof

#### 1. Finding E Remediation Verification
- Prior leak at `web/tests/hosting.test.mjs:186` executed `createBoardServer` with default `loadConfig(env)` without specifying `BOARD_SESSION_FILE`, causing it to resolve to the default `/workspace/.openchamber-data/board/sessions.json` path.
- In candidate `268bd28`:
  - `web/tests/hosting.test.mjs:187`: Explicit per-test session path created in `os.tmpdir()` (`test-board-sessions-...json`), injected into `BOARD_SESSION_FILE`, passed to `createBoardServer` as `sessionFilePath`, and unlinked in a `finally` block.
  - `web/tests/hosting.test.mjs:58`: `runServerEntry` synchronously provisions a unique temporary session file and deletes it in `finally`.
  - `web/tests/hosting.test.mjs:309,374`: Subprocess tests for `node web/dist/server.mjs` and `npm run start:web` inject explicit temporary `BOARD_SESSION_FILE` environment variables and clean up in `finally`.
  - `web/tests/helpers.mjs:25`: `startBoard` helper automatically generates a temporary session file path in `os.tmpdir()` if neither `options.sessionFilePath` nor `options.env.BOARD_SESSION_FILE` is provided, passes it explicitly to `createBoardServer`, and unlinks it when `app.close()` is awaited (unless `preserveSessionFile: true`).
  - `web/tests/app.test.mjs:55`: `runEntry` synchronously provisions a temporary session file and deletes it in `finally`.

#### 2. Old vs. New Behavioural Discrimination (`hosting.test.mjs:436`)
- The regression test configures a private stand-in default store directory (`standin-data-*`) via `OPENCHAMBER_DATA_DIR` populated with sentinel JSON session data.
- **Old Buggy Setup:** Omitting `BOARD_SESSION_FILE` caused `loadConfig` to point `sessionFilePath` to the stand-in default store. The server wrote to the stand-in store, overwriting and pruning the sentinel session (`assert.notEqual(buggyContent, sentinelRaw)` passed).
- **Repaired Setup:** Specifying `BOARD_SESSION_FILE: isolatedSessionFile` and `sessionFilePath: isolatedSessionFile` left the stand-in default store byte-for-byte identical to the original sentinel (`standInContentAfter === sentinelRaw`), while the isolated session file was created and used.
- Verified: Zero mutation of `process.env` during test execution (isolated per-call env parameters). Zero access, stat, or probe of `/workspace/.openchamber-data/**`.

#### 3. Complete Web Test Suite Audit
- Audited all 17 test files in `web/tests/` for server, child process, and store construction:
  - `auth.test.mjs`: All persisted store tests use `fs.mkdtempSync` with cleanup in `finally`; tests without `filePath` operate in-memory without touching disk.
  - `config.test.mjs`: Tests path resolution strings in memory without opening files; `hash-password.mjs` CLI test uses pipe and does not instantiate servers.
  - `app.test.mjs`: All server tests use `startBoard` or `runEntry` with isolated temporary files.
  - `hosting.test.mjs`: Fully isolated and verified.
  - `mixed-indent.test.mjs`, `multi-repo.test.mjs`, `protocol-corrections.test.mjs`, `validation-provenance.test.mjs`: All use `startBoard` with isolated temporary files.
  - Remaining test suites do not construct servers or session stores.

#### 4. Durable Evidence & Harness Audit
- Harnesses under `.agents/run/issue-47-session-hardening/harnesses/`:
  - `test_restart_behavior.mjs` and `test_http_restart.mjs` audited: use relative imports (`../../../../web/...`), synthetic credentials, ephemeral `os.tmpdir()` isolation with `rmSync` cleanup, and comprehensive log redaction.
  - Zero stale worktree paths, zero references to missing `/tmp/antigravity` files, and zero raw tokens, passwords, or cookies in logs.

---

### Hostile Findings (L4)

| # | Finding | Severity | File:Line | Description | Resolution / Ruling |
|---|---|---|---|---|---|
| A | Native form POST without JS returns 400 invalid_json | low | `web/server/app.ts:924` | HTML form has `method="post" action="/api/session"`, but backend handler `login()` only parses JSON. Credentials stay in POST body (no query param leak). | Open - deferred to #48 web branch integration to avoid `app.ts` merge conflict. |
| B | CSRF token stored in plaintext in sessions.json | low | `web/server/auth.ts:165` (prior) | Prior candidate stored plaintext CSRF token. | Closed in 4b3f475: CSRF token derived via `deriveCsrfToken(secret, id)`; never written to disk. |
| C | Changing BOARD_PASSWORD preserved sessions for 30 days | low | `web/server/auth.ts:220` (prior) | Prior candidate did not invalidate sessions on password change. | Closed in 4b3f475: Bound sessions to `passwordFingerprint`; added deterministic scrypt salt in `config.ts:291`. Password change invalidates old sessions. |
| D | Version stamp falls back to package version if public dir missing | low | `web/server/app.ts:143` | If `web/public/` is missing, `getVersionStamp()` falls back to `package.json` version without asset content digest. | Accepted: production deployment layouts always include `web/public/`. |
| E | Test isolation leak in hosting.test.mjs | blocker | `web/tests/hosting.test.mjs:186` | `createBoardServer` called with default `loadConfig(env)` without specifying `BOARD_SESSION_FILE`, risking loading/pruning production sessions. | CLOSED in 268bd28: All server constructors and child processes isolated to temporary files with cleanup. Behavioural regression verified with private stand-in default store. |

---

### Human Review Brief (L5)

**Batch:** `batch-simplify-views`  **Branch:** `fix/issue-47-fresh-app-stay-signed-in`
| # | What to click | What should happen |
|---|---|---|
| 1 | Visit the web board root URL `/` | Login form is rendered with hidden username input (`board`, autocomplete `username`) and password field (`current-password`). Password managers offer saved credentials. |
| 2 | Enter board password and submit | Successful authentication; session cookie issued with 30-day Max-Age (2,592,000s); board view loads. |
| 3 | Restart the board server daemon (`service/main` or container) and refresh the page | User stays signed in; no re-login prompt appears. |
| 4 | Click "Sign out" in the top bar | Session is terminated immediately; refreshing prompts for password; server disk file purges session record. |
| 5 | Inspect Service Worker in Browser DevTools (Application > Service Workers) | Service worker registered with `updateViaCache: 'none'`, cache name contains version stamp, app shell assets cached network-first. |

**Known blind spots for the human to focus on:**
- Autofill dropdown presentation on physical iOS Safari and Android Chrome devices.
- Visual transition fluidity when new service worker takes control and page reloads.

---

### Failures & Blind Spots
- **Failures:** None. All test suites pass cleanly with exit code 0.
- **Historical Live Data Impact:** `UNKNOWN`. As required, `/workspace/.openchamber-data/**` was not accessed, stat'd, loaded, or altered. Whether test runs prior to candidate 4b3f475 affected live data is strictly unverified.
- **Not Run:**
  - Physical biometric/credential autofill on mobile hardware (iOS Keychain, Android Credential Manager).
  - Multi-process concurrency (SessionStore is single-instance per deployment container).
  - PWA installation on real physical mobile device.
