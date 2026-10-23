# Issue #33 Remediation Report — Standalone Task Board

## Summary & Scope

Remediation of Moderate and Low findings (F1, F2, F4–F9, cosmetic nit) identified during the hostile review of the standalone task board (issue #33).

- **In Scope:** F1, F2, F4, F5, F6, F7, F8, F9, and answered-question cosmetic nit.
- **Out of Scope:** F3 (High — specification/access-control deviation regarding GitHub sign-in vs board password). The existing password authentication model is preserved as designed.
- **Boundaries Preserved:** All changes strictly confined to `web/**`, `web/tests/**`, and documentation/verification artifacts. Zero changes to `panel/**`, `service/**`, `test/**`, root `package.json`, or git branch topology.

## Per-Finding Remediation

### F1 (Moderate) — Lost Update TOCTOU & `If-Match` Assumption
- **Resolution:**
  - Added `withIssueLock(number)` in `web/server/app.ts` to serialize concurrent write operations per issue within the board process.
  - Implemented post-write verification in `writeIssue`: following a PATCH, the server re-reads the issue from GitHub to verify the target edit took effect. If non-conflicting concurrent edits occurred in other sections, the server retries up to 2 times to converge; if conflicting edits occurred in the same section, it fails closed with `409 conflict`.
  - Updated `web/tests/fake-github.mjs` to set `honorIfMatch = false` by default, reflecting real GitHub REST API behavior for issue PATCH.
  - Documented residual direct-GitHub-write window in `web/README.md`.
- **Tests Added:**
  - `web/tests/app.test.mjs`: concurrent mutation between GET and PATCH in another section converges with both edits preserved; concurrent mutation in the same section results in 409 conflict without retry; retries bounded to at most 2 retries when verification keeps failing.

### F2 (Moderate) — Unauthenticated Login CPU/Memory DoS
- **Resolution:**
  - In `web/server/auth.ts`: bounded `LoginRateLimiter` to `DEFAULT_MAX_LIMITER_ENTRIES = 1000` with oldest-key eviction and efficient index-based window pruning.
  - In `web/server/config.ts`: added `verifyPasswordAsync` using asynchronous `scrypt` and added `BOARD_TRUST_PROXY` (`trustProxy: boolean`, default `false`).
  - In `web/server/app.ts`: added `ScryptQueue(2)` to limit concurrent scrypt executions to 2 workers; added in-flight IP deduplication (`inFlightLogins`) to reject parallel floods with 429 without performing duplicate scrypt work; client IP is obtained from socket address by default unless `trustProxy` is enabled.
- **Tests Added:**
  - `web/tests/config.test.mjs`: `BOARD_TRUST_PROXY` parsing and `verifyPasswordAsync` tests.
  - `web/tests/auth.test.mjs`: rate limiter entry bounding and non-growth under 5,000 failures.
  - `web/tests/app.test.mjs`: parallel login flood finishes quickly without stalling process; forwarded headers ignored unless proxy explicitly trusted.

### F4 (Low) — Origin / Referer Validation on Writes
- **Resolution:**
  - Implemented `assertOriginAllowed(req, baseUrl)` in `web/server/app.ts` to validate incoming `Origin` and `Referer` headers on all CSRF-protected write endpoints against `BOARD_BASE_URL` origin when set.
- **Tests Added:**
  - `web/tests/app.test.mjs`: rejects cross-origin writes with `403 cross_origin_rejected` when `BOARD_BASE_URL` is set, while permitting matching origin.

### F5 (Low) — Upstream GitHub Error Classification
- **Resolution:**
  - In `web/server/github.ts`: added `forbidden` error kind; mapped 401 to `unauthorized`, 403 primary rate limit (`x-ratelimit-remaining: 0`) to `rate_limited`, other 403s to `forbidden`, 422 to `invalid`, and 5xx to `unavailable`.
  - In `web/server/app.ts`: mapped 401 to `502 github_unauthorized`, 403 rate limit to `503 github_rate_limited`, 403 forbidden to `502 github_forbidden`, 422 to `400 invalid_request`, and 5xx to `502 github_unavailable`.
- **Tests Added:**
  - `web/tests/github.test.mjs`: error kind distinction for 401, 403 rate limit, 403 forbidden, 422, and 500.
  - `web/tests/app.test.mjs`: API error status and JSON error codes for upstream failures.

### F6 (Low) — Pagination Duplication & Link Header Origin Validation
- **Resolution:**
  - In `web/server/github.ts`: parsed `new URL(next).origin` and strictly matched against `new URL(this.apiBase).origin`.
  - Deduplicated issues by issue number across paginated requests; terminated pagination immediately if a page returns 0 new issues.
- **Tests Added:**
  - `web/tests/github.test.mjs`: rejection of malicious origin in Link header; issue deduplication and early loop termination.

### F7 (Low/Moderate) — Section Parser BOM & Fenced Code Handling
- **Resolution:**
  - In `web/server/sections.ts`: stripped leading UTF-8 BOM (`\uFEFF`) before scanning headings, and preserved BOM when replacing section text.
  - Ignored headings inside fenced code blocks (` ``` ` or `~~~`).
  - Refused ambiguous preambles containing code fences (`editable: false`).
  - Restricted editable sections to the first duplicate heading.
- **Tests Added:**
  - `web/tests/sections.test.mjs`: BOM handling, fenced code block heading exclusion, ambiguous preamble rejection, duplicate heading disambiguation.

### F8 (Low) — Password & Vault Hygiene Documentation
- **Resolution:**
  - Updated `web/README.md` to demonstrate generating hashes via stdin (`printf '%s' ... | node web/tools/hash-password.mjs`), setting `umask 077` when writing env files, and running the server with `--env-file` rather than inline shell assignments.

### F9 (Low) — In-Memory Session Cap
- **Resolution:**
  - In `web/server/auth.ts`: added `DEFAULT_MAX_SESSIONS = 50` and LRU eviction of oldest sessions when capacity is reached.
  - Documented session lifecycle and restart behavior in `web/README.md`.
- **Tests Added:**
  - `web/tests/auth.test.mjs`: session store caps stored sessions at max and evicts oldest.

### Cosmetic Nit — Answered Question Wrapper Display
- **Resolution:**
  - In `web/public/app.js`: stripped `*(Answer: ...)*` wrapper formatting when rendering answered questions, showing clean plain text.

## Verification Evidence

| Command | Result | Notes |
| --- | --- | --- |
| `node --test web/tests/*.test.mjs` | **PASS** | 86 / 86 tests passed (18 new regression tests) |
| `npx tsc -p web/tsconfig.json` | **PASS** | 0 type errors |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | **PASS** | 91.9kb bundle |
| `node --check web/dist/server.mjs` | **PASS** | Bundle syntax valid |
| `sha256sum web/dist/server.mjs` | **PASS** | `a230c333bafc720fb4580e6f6b918aa055f7d28a218e61f82f48500e2728d710` |
| `node web/tests/browser-verify.mjs` | **PASS** | 29 checks passed, 10 screenshots captured |
