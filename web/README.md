# Standalone task board

A single-user web board for the GitHub issues that the OpenChamber GitHub Task
Board extension reads. It is a static page plus a small Node server. It holds
the GitHub token on the server only, signs itself in with a board password, and
has **no agent control** — no session starting, no prompts, no live agent
activity.

- Every repository returned by the bot token’s GitHub `/user/repos` discovery,
  with a repository picker and combined view. Archived and empty repositories
  remain selectable. Previously known repositories losing access remain unavailable.
  GitHub only exposes what this token can see; hidden private repositories cannot be enumerated.
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
| `BOARD_GITHUB_TOKEN` | yes | Bot token covering the repositories to display. Server-side only. |
| `BOARD_GITHUB_LOGIN` | yes | The account the token belongs to. Checked against GitHub `/user` at startup. |
| `BOARD_REPO` | no | Optional legacy default `owner/name`; never grants access outside discovery. Existing single-repository configurations still work. |
| `BOARD_PASSWORD_HASH` | one of these | scrypt hash from `web/tools/hash-password.mjs`. |
| `BOARD_PASSWORD` | one of these | Plain password, hashed in memory at startup (minimum 8 characters). |
| `BOARD_SESSION_SECRET` | yes | At least 32 characters. Signs session cookies; changing it ends every session. |
| `BOARD_PORT` | no | Listen port, default `8787`. |
| `BOARD_HOST` | no | Listen address/host, default `127.0.0.1`. Must be a valid IP or hostname; fails startup on invalid input. |
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

# run the built bundle via production npm script
npm run start:web

# run the built bundle directly
node --env-file=.env.board web/dist/server.mjs

# or run from source (development)
node --env-file=.env.board web/server.ts
```

The server listens on `127.0.0.1` by default, or on the explicitly configured `BOARD_HOST`.
Put a TLS-terminating reverse proxy in front of it for a domain; the session cookie is always `Secure`, which browsers
accept on `https` origins (and on `http://localhost` for local testing).

## Security model

- **Credentials:** the GitHub token and session secret live in the server
  process. They are never written to the page, URL, `localStorage`, cookies or
  logs. Log lines are path/status/duration only and pass through a redactor that
  masks token-shaped strings, the token, the session secret and cookie values.
- **Startup:** `/user` must match `BOARD_GITHUB_LOGIN`. Discovery failure does not
  block sign-in: the picker reports failure distinctly from zero visible repositories.
  `BOARD_REPO` does not gate startup and is never an authorization source.
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
- **Repository allowlist & redirect refusal:** `/api/repos` exposes token-visible
  identities; `/api/repos/{owner}/{name}/board` and `/issues/{number}` (plus
  `/section`, `/status`, `/questions/{index}/answer`) resolve exact case-sensitive
  discovered names server-side. Unknown names, case variants and numeric-ID-only
  references cause zero upstream calls. Legacy `/api/board` and `/api/issues/...`
  use the same allowlist, never fallback. Numeric IDs in request bodies never
  redirect writes. Query repository overrides and bare `/repos/...` paths are refused.
  HTTP redirects (3xx) from upstream endpoints are refused before following (`redirect: 'manual'`);
  authorization headers and mutation bodies are never forwarded across redirect hops, and any redirect on a mutation yields an unknown outcome.
- **Editing & concurrency:** best-effort editing with pre-save conflict checks.
  The read model includes a SHA-256 fingerprint over repository identity, issue
  number, body, label names and state. Rows, locks, pending navigation, mutation
  validation and memory-only drafts are repository-qualified. Answer drafts bind
  exact source question text/index and observed fingerprint. Changed revisions
  expose old drafts separately for manual recovery, never automatic reassignment.
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

- Single user, token-visible repositories, one process, in-memory sessions capped at 50 entries. Not a
  multi-tenant service.
- The board is read-through: if GitHub is unavailable the page shows plain error
  and stale states; it does not keep a mirror of issue bodies.
- Best-effort editing: while the board serializes concurrent board clients with in-process locks
  and refuses detected pre-save conflicts, GitHub's API does not support transactional or conditional issue PATCH.
  A simultaneous edit on GitHub or by an agent can still be overwritten.
- Ambiguous write outcomes require human refresh and inspection; the board will not guess or retry.
  A pre-dispatch discovery refusal (`503 discovery_unavailable`) is different: nothing was sent,
  so it is shown as a definite refusal with retry guidance and never enters the uncertain set.
- The combined view returns at most 500 issues. Reaching that cap, a per-repository page
  bound, or a duplicate-only page that stopped pagination is marked `truncated` and `partial`;
  results are never published as complete.
- Repository choice is remembered as an opaque SHA-256 digest of the repository numeric id
  (or `owner/name` when no id exists), never as a name or credential. Numeric ids are
  brute-forceable; this digest is a convenience preference and never an authorization input.
- Unavailable-repository history is process-memory only. A restart forgets last-known
  identities that the token can no longer see; this is accepted and not a durable inventory.
- Proof for this slice is synthetic only: local fake-GitHub fixtures and localhost. No real
  multi-repository token, live GitHub permission change, hidden-private-repository enumeration,
  production deployment, installed extension or physical mobile device was exercised.
- Residual defect remediations (F1–F5) and protocol corrections are documented in `.agents/run/task-centred-architecture/outputs/issue-33-last-correction.md`, which supersedes previous closure claims. Prior reports are immutable.
- There is no notification/question loop and no agent integration. Those are
  separate, parked workstreams.

## Discovery and refresh bounds

- Discovery freshness: 60 seconds, including failed-attempt backoff; concurrent
  refreshes coalesce. At most 10 pages of 100 entries. Malformed pages, duplicate
  identities and page overflow reject the entire discovery, never publish a partial
  allowlist. Failed refresh retains picker identity and pauses repository operations
  until a successful refresh. A successful empty discovery says no repositories visible.
- Known identities survive access loss in this process (up to 10,000 historical
  entries; exceeding the bound fails discovery rather than dropping entries).
  Restart loses inaccessible history; this is not a durable repository inventory.
- Combined refresh: `/api/combined/board`, three fixed workers, concurrent aggregate
  requests coalesce, no retries, at most 10 issue pages per repository, and at most
  500 issues in total. Per-repository failure, truncation or the total issue cap makes
  the response and UI explicitly partial and truncated; a page of only duplicate issues
  also reports truncation because later pages were not read. No background polling.
  Refresh is manual; the footer discloses bounds.
- Last choice is remembered as `all` or an opaque SHA-256 repository-identity digest
  in localStorage. No repository name, token, session/CSRF value or issue/draft
  content is persisted. It is a preference, not a secret or authorization input.
  Disabled storage falls back to memory. Detail URLs retain only existing issue
  numbers; combined detail identity is memory-only and not deep-linked after reload.
- Observed changes invalidate draft assignment. Identical delete-and-re-ask
  entirely between reads cannot be detected. No history store was added.

## Operations

### Required environment variables
Only variable names are documented here; never record secret values in repository files or command logs:
- `BOARD_GITHUB_TOKEN`
- `BOARD_GITHUB_LOGIN`
- `BOARD_SESSION_SECRET`
- One of `BOARD_PASSWORD_HASH` (recommended) or `BOARD_PASSWORD`

Optional configuration variables:
- `BOARD_REPO` (legacy default; discovered permissions still required)
- `BOARD_HOST` (defaults to `127.0.0.1`)
- `BOARD_PORT` (defaults to `8787`)
- `BOARD_BASE_URL` (optional public origin for CSRF origin/referer validation)

### Supervisor and restart persistence
The board process has no supervisor today and does not survive a container restart or process crash on its own. If the process exits or the container restarts, an external process supervisor, orchestrator, or container entrypoint startup hook is required to restart it.

### Container recreation and downtime
Publishing the board port requires container recreation, which briefly interrupts other running container services.

### Access model
Anyone with the board password has full board access. The GitHub identity of the visitor is not checked or authenticated against GitHub; all GitHub actions and queries are performed using the single server-configured token.

### Best-effort writes and concurrency
Issue updates use a best-effort concurrency model. While the board checks fingerprints before saving and serializes edits per issue in-process, GitHub does not support transactional or conditional issue writes. A simultaneous external edit on GitHub or by an autonomous agent can still be overwritten by the board's save. Ambiguous write outcomes require human refresh and inspection; the board will not guess or automatically retry.

### Liveness endpoint (`GET /health`)
An unauthenticated liveness endpoint is provided at `GET /health`, returning HTTP 200 with process liveness and version identity:
```json
{
  "status": "ok",
  "version": "1.2.1",
  "uptime": 123
}
```
Only `GET` is supported; `HEAD` and all other non-GET methods return HTTP 405 with `Allow: GET`. Automated monitoring and health probes must use `GET`.

Liveness is not readiness:
- `GET /health` proves only that the Node process is running and its HTTP listener can accept connections.
- It does not prove upstream GitHub reachability or token validity.
- It does not prove that TLS is terminated or valid.
- It does not prove that a reverse proxy routes to the board process.
- It offers no guarantee or promise of uptime.

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
