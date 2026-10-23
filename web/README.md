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
| `BOARD_BASE_URL` | no | Public origin, e.g. `https://board.example.test` (used for HSTS when https). |

If both password variables are set, `BOARD_PASSWORD_HASH` wins.

Generate a hash (the password is not passed as an argument, so it stays out of
shell history):

```sh
BOARD_PASSWORD='…' node web/tools/hash-password.mjs
# or
printf '%s' '…' | node web/tools/hash-password.mjs
```

## Run

Node 22.18+ runs the TypeScript sources directly (type stripping). For a
deployable bundle:

```sh
# build (esbuild is already a devDependency of the extension)
npx esbuild web/server.ts --bundle --platform=node --format=esm \
  --target=node20 --packages=external --outfile=web/dist/server.mjs

# run from source
BOARD_GITHUB_TOKEN=… BOARD_GITHUB_LOGIN=owner BOARD_REPO=owner/repo \
BOARD_PASSWORD='…' BOARD_SESSION_SECRET='…' node web/server.ts

# run the built bundle
node web/dist/server.mjs
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
  server compares it with scrypt (`N=16384,r=8,p=1`, per-deployment salt) using
  `timingSafeEqual`. A successful sign-in issues a random session id, signed
  with `BOARD_SESSION_SECRET`, in an `HttpOnly; Secure; SameSite=Strict` cookie,
  plus a CSRF token bound to that session.
- **Failed logins:** a small in-memory sliding-window limiter (5 failures per
  minute per client address) answers `429` with `Retry-After`. A correct
  password is still accepted while the limiter is cooling down, so the owner
  cannot be locked out by an attacker or by their own typos. There is no
  account lockout state.
- **Sessions:** absolute 12-hour lifetime, 2-hour idle timeout, in memory only.
  A server restart signs everyone out.
- **CSRF:** every state-changing request needs `X-CSRF-Token` matching the
  session's token; the login endpoint itself needs no token but issues the
  session cookie only after a correct password.
- **Repository allowlist:** every GitHub call is built from `BOARD_REPO` on the
  server. Requests carrying `repo`, `repository`, `owner`, `name` or `org`
  parameters, or any `/repos/...` path, are refused before they reach GitHub.
- **Conditional writes:** the read model includes a SHA-256 fingerprint over the
  issue body, label names and state. A write must send the fingerprint it read.
  The server re-reads the issue, compares fingerprints, and refuses with `409`
  plus the current issue if anything changed. The `PATCH` also carries the
  ETag from that fresh read as `If-Match`; a `412` becomes the same `409`. In
  the conflict path nothing is written.
- **Section scoping:** only the Overview prose is replaceable. Every other byte
  of the body (checklists, questions, human tasks, test plan, spacing) is
  compared byte-for-byte in tests. Open-question answers reuse
  `panel/core.ts:answerOpenQuestionInMarkdown`. Status changes reuse the agreed
  `status:*` set and keep all other labels.
- **Response hardening:** `Content-Security-Policy` with no inline script,
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Cache-Control: no-store`.

### Deliberate limits

- Single user, one repository, one process, in-memory sessions. Not a
  multi-tenant service.
- The board is read-through: if GitHub is unavailable the page shows plain error
  and stale states; it does not keep a mirror of issue bodies.
- The fingerprint closes the lost-update window between the server's fresh read
  and its `PATCH` only when GitHub honours `If-Match`. GitHub's documented
  support for conditional `PATCH` on issues is not guaranteed; the small
  remaining window is a residual risk, recorded in the report.
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
