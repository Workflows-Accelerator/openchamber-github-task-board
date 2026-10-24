# Issue #33 Remediation Report — Standalone Task Board (Amendment v2)

## Summary & Scope

Remediation and hardening of the standalone task board (issue #33) aligned with owner decisions of 2026-10-24 and task brief `issue-33-amendment-v2.md`.

- **In Scope:** F1, F2, F4, F5, F6, F7, F8, F9, F10, cosmetic nit, and removal of retry loops and unsupported safety claims.
- **Superseded by Owner Decision:** F3 (separate board password retained; server-held token; single configured repository; GitHub user check omitted).
- **Boundaries Preserved:** All changes strictly confined to `web/**`, `web/tests/**`, and documentation/verification artifacts. Zero changes to `panel/**`, `service/**`, `test/**`, root `package.json`, or git branch topology.

## Per-Finding Remediation Status

### F1 (Moderate) — Lost Update TOCTOU & If-Match Assumption
- **Status:** MITIGATED (best-effort, owner-accepted)
- **Resolution:**
  - Implemented best-effort editing with a pre-save conflict check: server re-reads the issue from GitHub via fresh GET, compares the SHA-256 fingerprint against the version the user loaded, and refuses with `409 Conflict` if diverged.
  - In-process per-issue lock (`withIssueLock`) serializes write requests within the board process.
  - All automatic retries, re-apply, and repeat loops removed.
  - If a write's outcome is ambiguous (timeout, network error after send, upstream server error, or readback mismatch), the board returns `502 write_outcome_unknown` with message "Outcome unknown — check the issue on GitHub" and never repeats the write.
  - Visible warning added on the page near editing controls and in `web/README.md`: "Best-effort editing: a simultaneous edit on GitHub or by an agent can still be overwritten."
  - Fake GitHub defaults `honorIfMatch = false` to reflect production GitHub issue PATCH behavior.
- **Exact Remaining TOCTOU Interleaving:**
  1. Client loads issue at $t_0$ (body $B_0$, fingerprint $FP_0$).
  2. Client submits edit at $t_1$.
  3. Server performs fresh GET at $t_2$ (body $B_0$, matching $FP_0$).
  4. An external writer (human on GitHub web/mobile or agent) submits PATCH directly to GitHub at $t_3$, setting body $B_{ext}$.
  5. Board server sends PATCH at $t_4$ with $B_{local}$. Because GitHub REST API does not support conditional `If-Match` on issue PATCH, GitHub applies $B_{local}$, overwriting $B_{ext}$.
  6. Board server readback at $t_5$ observes $B_{local}$ and reports success, but $B_{ext}$ was overwritten.
  Because GitHub provides no conditional unsafe issue endpoint, this window between fresh GET ($t_2$) and GitHub's internal commit ($t_4$) cannot be closed from the client side. The owner accepted best-effort editing with full disclosure.
- **Tests Added/Verified:**
  - `web/tests/app.test.mjs`: pre-save conflict refused without PATCH call; ambiguous outcome (readback mismatch or upstream 500) returns 502 with zero retries; simultaneous overwrite warning verified in index.html and README.

### F2 (Moderate) — Unauthenticated Login CPU/Memory DoS
- **Status:** CLOSED
- **Resolution:**
  - Early rate limiting in `web/server/app.ts`: requests from blocked client addresses receive `429 Too Many Requests` immediately before reading body or executing password hashing work.
  - Limiter failure tracking does not record failures on blocked 429 requests, ensuring no accumulating or permanent lockout.
  - Cooldown bounded to at most 60 seconds (`windowMs = 60_000`, `retryAfterSeconds <= 60`).
  - Memory bounded in `web/server/auth.ts`: `LoginRateLimiter` capped at 1,000 entries with LRU eviction of oldest addresses.
  - In-flight login deduplication per IP rejects concurrent requests with 429 without duplicate hashing.
  - Password hashing uses asynchronous `scrypt` with a concurrency queue (max 2 concurrent workers).
  - Existing authenticated sessions are unaffected during rate limit cooldown because authenticated routes do not consult login limiter.
  - Client address derived from direct socket by default (`trustProxy: false`).
  - README states plainly that unauthenticated owner sign-in from the same address can be briefly rate limited.
- **Tests Added/Verified:**
  - `web/tests/auth.test.mjs`: bounded cooldown of at most 60s without accumulating lockout; memory bounded under 5,000 failures; sliding window recovery.
  - `web/tests/app.test.mjs`: early 429 on cooldown; parallel login flood finishes quickly; forwarded headers ignored unless proxy trusted; existing authenticated session remains usable during cooldown.

### F3 (High) — Board Password Replaces GitHub Sign-in
- **Status:** SUPERSEDED
- **Owner Decision (2026-10-24):** Keep separate board password and server-held GitHub token. Access is limited to holders of board password; token stays server-side; one configured repository only. GitHub identity check and OAuth omitted per owner direction.

### F4 (Low) — Origin / Referer Validation on Writes
- **Status:** CLOSED
- **Resolution:**
  - `assertOriginAllowed` in `web/server/app.ts` validates incoming `Origin` and `Referer` headers on all CSRF-protected write endpoints against `BOARD_BASE_URL` origin when configured.
- **Tests Added/Verified:**
  - `web/tests/app.test.mjs`: cross-origin writes rejected with `403 cross_origin_rejected` when `BOARD_BASE_URL` is set, while matching origin is accepted.

### F5 (Low) — Upstream GitHub Error Classification
- **Status:** CLOSED
- **Resolution:**
  - In `web/server/github.ts`: added `forbidden` error kind; maps 401 to `unauthorized`, 403 primary rate limit (`x-ratelimit-remaining: 0`) to `rate_limited`, other 403s to `forbidden`, 422 to `invalid`, and 5xx to `unavailable`.
  - In `web/server/app.ts`: mapped 401 to `502 github_unauthorized`, 403 rate limit to `503 github_rate_limited`, 403 forbidden to `502 github_forbidden`, 422 to `400 invalid_request`, and 5xx to `502 github_unavailable`.
- **Tests Added/Verified:**
  - `web/tests/github.test.mjs`: error kind distinction for 401, 403 rate limit, 403 forbidden, 422, and 500.
  - `web/tests/app.test.mjs`: API error status and JSON error codes for upstream failures.

### F6 (Low) — Pagination Duplication & Link Header Origin Validation
- **Status:** CLOSED
- **Resolution:**
  - In `web/server/github.ts`: parses `new URL(next).origin` and strictly compares against `new URL(this.apiBase).origin`.
  - Issues deduplicated by issue number across paginated requests; loop terminates immediately if a page yields zero new issues.
- **Tests Added/Verified:**
  - `web/tests/github.test.mjs`: rejection of untrusted origin in Link header; issue deduplication and early loop termination.

### F7 (Low/Moderate) — Section Parser BOM & Fenced Code Handling
- **Status:** CLOSED
- **Resolution:**
  - In `web/server/sections.ts`: strips leading UTF-8 BOM (`\uFEFF`) before scanning headings, and preserves BOM when replacing section text.
  - Excludes headings inside fenced code blocks (` ``` ` or `~~~`).
  - Refuses ambiguous preambles containing code fences (`editable: false`).
  - Restricts editable sections to first duplicate heading.
- **Tests Added/Verified:**
  - `web/tests/sections.test.mjs`: BOM handling, code fence exclusion, ambiguous preamble rejection, duplicate heading disambiguation.

### F8 (Low) — Password & Vault Hygiene Documentation
- **Status:** CLOSED
- **Resolution:**
  - Updated `web/README.md` to demonstrate generating hashes via stdin (`printf '%s' ... | node web/tools/hash-password.mjs`), setting `umask 077` when writing env files, and running server with `--env-file` rather than inline shell assignments.

### F9 (Low) — In-Memory Session Cap
- **Status:** CLOSED
- **Resolution:**
  - In `web/server/auth.ts`: bounded session store to 50 active sessions (`DEFAULT_MAX_SESSIONS = 50`) with LRU eviction of oldest sessions.
  - Documented session lifecycle and restart behavior in `web/README.md`.
- **Tests Added/Verified:**
  - `web/tests/auth.test.mjs`: session store caps stored sessions at max and evicts oldest.

### F10 (Low) — Pessimistic Fake GitHub & Test Gaps
- **Status:** CLOSED
- **Resolution:**
  - `web/tests/fake-github.mjs` sets `honorIfMatch = false` by default, accurately simulating GitHub issue PATCH.
  - Comprehensive tests added for primary rate limits (403), forbidden (403), invalid references (422), network/server errors (500), cross-origin writes, BOM/fenced markdown, and session rate limit cooldown.

### Cosmetic Nit — Answered Question Wrapper Display
- **Status:** CLOSED
- **Resolution:**
  - In `web/public/app.js`: strips `*(Answer: ...)*` wrapper formatting when rendering answered questions, showing clean plain text.

## Verification Evidence

| Command | Result | Notes |
| --- | --- | --- |
| `node --test web/tests/*.test.mjs` | **PASS** | 88 / 88 tests passed |
| `npx tsc -p web/tsconfig.json` | **PASS** | 0 type errors |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | **PASS** | 91.1kb bundle |
| `node --check web/dist/server.mjs` | **PASS** | Syntax valid |
| `sha256sum web/dist/server.mjs` | **PASS** | `5a188e69c903759380db3bb2481bde34782deb854ee07c08a329f8221461cfcb` |
| `node web/tests/browser-verify.mjs` | **PASS** | 30 checks passed, 10 screenshots captured |
| `npm test` | **PASS** | 466 / 466 tests passed in root suite |
