# Standalone task board

A single-user web board for the GitHub issues that the OpenChamber GitHub Task
Board extension reads. It is a static page plus a small Node server. It holds
the GitHub token on the server only, signs itself in with a board password, and
has **no agent control** — no session starting, no prompts, no live agent
activity.

- One configured repository, fixed by the server. The client can never name a
  repository.
- Issues are read live from GitHub on each board/detail request. There is no
  background poller and no stored copy of issue content.
- Editable from the browser: the issue's **Overview** prose (no checklist
  sections), **answers to open questions**, and the **status label** from the
  agreed `status:*` set.
- The server never closes issues, never toggles human checkboxes, and never
  writes labels outside the agreed status set.

## Configuration

All configuration comes from the environment. The server refuses to start if a
required value is missing or invalid, and names the offending variable without
printing its value.

| Variable | Required | Meaning |
| --- | --- | --- |
| `BOARD_GITHUB_TOKEN` | yes | Fine-grained token for the one repository. Server-side only. |
| `BOARD_GITHUB_LOGIN` | yes | The account the token belongs to. Checked against GitHub `/user` at startup. |
| `BOARD_REPO` | yes | Repository as `owner/name`. Checked against GitHub at startup. |
| `BOARD_PASSWORD_HASH` | one of these | scrypt hash from `web/tools/hash-password.mjs`. |
| `BOARD_PASSWORD` | one of these | Plain password, hashed in memory at startup (minimum 8 characters). |
| `BOARD_SESSION_SECRET` | yes | At least 32 characters. Signs session cookies; changing it ends every session. |
| `BOARD_PORT` | no | Listen port, default `8787`. |
| `BOARD_BASE_URL` | no | Public origin, e.g. `https://board.example.test` (used for HSTS and Origin/Referer write validation). |

If both password variables are set, `BOARD_PASSWORD_HASH` wins.

Generate a hash using an interactive hidden prompt, restricted file redirection, or a secret manager to prevent recording secrets in shell history:

```sh
# interactive hidden prompt (no echo, not stored in shell history)
node web/tools/hash-password.mjs

# or read password from a restricted-permission file
(umask 077 && node web/tools/hash-password.mjs < /path/to/password-file)

# or write to an environment file with restricted permissions using hidden shell input
(umask 077 && read -rs P && printf 'BOARD_PASSWORD_HASH=%s\n' "$(printf '%s' "$P" | node web/tools/hash-password.mjs)" > .env.board && unset P)
```

## Run

Node 22.18+ runs the TypeScript sources directly (type stripping). For a
deployable bundle:

```sh
# build (esbuild is already a devDependency of the extension)
npx esbuild web/server.ts --bundle --platform=node --format=esm \
  --target=node20 --packages=external --outfile=web/dist/server.mjs

# run from source using an env file or secret manager (avoid inline secrets in shell history)
node --env-file=.env.board web/server.ts

# run the built bundle
node --env-file=.env.board web/dist/server.mjs
```

The server listens on `127.0.0.1` only. Put a TLS-terminating reverse proxy in
front of it for a domain; the session cookie is always `Secure`, which browsers
accept on `https` origins (and on `http://localhost` for local testing).

## Security model

- **Credentials:** the GitHub token and session secret live in the server
  process. They are never written to the page, URL, `localStorage`, cookies or
  logs. Log lines are path/status/duration only and pass through a redactor that
  masks token-shaped strings, the token, the session secret and cookie values.
- **Startup:** `/user` must match `BOARD_GITHUB_LOGIN`; `/repos/{owner}/{repo}`
  must be readable by the token. Otherwise the process exits with an error
  naming the variable, before it listens.
- **Sign-in:** the browser posts the password (over HTTPS in deployment). The
  server compares it using asynchronous scrypt (`N=16384,r=8,p=1`, per-deployment salt)
  and `timingSafeEqual`. Scrypt operations run through a concurrency queue (max 2
  concurrent workers, bounded waiting queue of 4 entries with `429` retry guidance)
  and in-flight login requests are bounded (max 10 in-flight login slots) and deduplicated per client IP with a request body deadline (2s).
  Authenticated routes run independently of unauthenticated login verification. A successful sign-in issues a
  random session id, signed with `BOARD_SESSION_SECRET`, in an `HttpOnly; Secure; SameSite=Strict`
  cookie, plus a CSRF token bound to that session.
- **Failed logins & rate limiting:** an in-memory sliding-window limiter (5 failures per
  minute per client address) answers `429` with `Retry-After`. The limiter state is bounded
  (capped at 1,000 entries with LRU eviction). Client IP addresses are derived strictly from the
  direct socket connection; forwarded headers (`X-Forwarded-For`, `Forwarded`) are never trusted.
  When hosted behind a reverse proxy, rate limiting applies to the immediate peer connection.
  Unauthenticated owner sign-in from that address can be briefly rate limited (up to 60s cooldown)
  if failed attempts occur. Existing authenticated sessions are not affected. There is no account lockout state.
  These bounds protect against local resource exhaustion under normal operational conditions; they do not provide unbounded network or socket denial-of-service immunity.
- **Sessions:** absolute 12-hour lifetime, 2-hour idle timeout, in memory only. The
  session store is bounded to 50 concurrent active sessions with LRU eviction. A server
  restart or change to `BOARD_SESSION_SECRET` immediately invalidates every session.
- **CSRF & Origin checks:** every state-changing request needs `X-CSRF-Token` matching the
  session's token. When `BOARD_BASE_URL` is configured, incoming `Origin` and `Referer`
  headers on write requests are validated against the base URL origin.
- **Repository allowlist & redirect refusal:** every GitHub call is built from `BOARD_REPO` on the
  server. Requests carrying `repo`, `repository`, `owner`, `name` or `org`
  parameters, or any `/repos/...` path, are refused before they reach GitHub.
  HTTP redirects (3xx) from upstream endpoints are refused before following (`redirect: 'manual'`);
  authorization headers and mutation bodies are never forwarded across redirect hops, and any redirect on a mutation yields an unknown outcome.
- **Editing & concurrency:** best-effort editing with pre-save conflict checks.
  The read model includes a SHA-256 fingerprint over the issue body, label names and state.
  A write must send the fingerprint it read. The server acquires an in-process per-issue lock,
  re-reads the issue from GitHub, compares fingerprints, and refuses with `409 Conflict` if anything changed.
  When writing, the server sends `If-Match` with the latest ETag.
  Warning: a simultaneous edit on GitHub or by an agent can still be overwritten.
  If a write's outcome is ambiguous (timeout, post-send network or gateway failure, malformed/empty response, untrusted 4xx/5xx proxy reply, or serializer-projection readback mismatch including indentation differences),
  the board reports outcome unknown with guidance to refresh and check GitHub state, and never repeats the write automatically.
- **Section scoping & fenced content:** only the Overview prose is replaceable. Every other byte
  of the body (checklists, questions, human tasks, test plan, spacing) is
  compared byte-for-byte in tests. Markdown code fences are tracked with strict closer grammar;
  code-block checkboxes are excluded from actionable questions and cannot be targeted for answer mutation.
  Open-question answers update the target question without disturbing fenced examples. Status changes reuse the agreed
  `status:*` set and keep all other labels.
- **Response hardening:** `Content-Security-Policy` with no inline script,
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Cache-Control: no-store`.

### Deliberate limits

- Single user, one repository, one process, in-memory sessions capped at 50 entries. Not a
  multi-tenant service.
- The board is read-through: if GitHub is unavailable the page shows plain error
  and stale states; it does not keep a mirror of issue bodies.
- Best-effort editing: while the board serializes concurrent board clients with in-process locks
  and refuses detected pre-save conflicts, GitHub's API does not support transactional or conditional issue PATCH.
  A simultaneous edit on GitHub or by an agent can still be overwritten.
- Ambiguous write outcomes require human refresh and inspection; the board will not guess or retry.
- Residual defect remediations (F1–F5) and protocol corrections are documented in `.agents/run/task-centred-architecture/outputs/issue-33-last-correction.md`, which supersedes previous closure claims. Prior reports are immutable.
- There is no notification/question loop and no agent integration. Those are
  separate, parked workstreams.

## Tests

```sh
node --test web/tests/*.test.mjs     # unit + integration against a fake GitHub
npx tsc -p web/tsconfig.json         # typecheck
node web/tests/browser-verify.mjs    # real browser (Obscura CDP), synthetic data
```

The integration suite starts a synthetic GitHub server and the real board
server, then covers unauthenticated denial, wrong password, rate limiting,
session expiry, invalid configuration, wrong account, cross-repository refusal,
pull-request exclusion, pagination, conditional write success, concurrent-edit
conflict, preserved sections, CSRF rejection, and absence of the token or
password in HTML, JS, API responses and logs. The browser script writes
screenshots and a JSON result next to the run artifacts; screenshots use
synthetic fixtures, never the production repository.
