# Issue #33 — standalone board server and page

Status: **done**, with one explicit NOT RUN (real Tab-key traversal) and the
residuals listed below. Commit `af62a4e` on `feat/issue-33-standalone-board`
(based on `c436dbf`, i.e. base `feat/v2-binding-and-ratelimit` plus the run-docs
commit). Nothing pushed, no deployment, no issue closed, no extension host
touched.

- Supplied model: Engineer (`9router/engineer`).
- Actual model: Engineer (`9router/engineer`).

## What changed

All new files. No existing file was edited; `panel/core.ts` and
`panel/labels.ts` are imported (not copied). `web/dist/` is a local build
artifact and is gitignored.

```
web/README.md                     configuration, run, security model, tests
web/tsconfig.json                 typecheck config (server/**/*.ts)
web/.gitignore                    dist/
web/server.ts                     entry: env config, startup identity, listen
web/server/config.ts              env parsing/refusal, scrypt hash+verify
web/server/auth.ts                sessions, cookie flags, CSRF, login limiter
web/server/github.ts              server-side GitHub client, pagination, PATCH
web/server/board.ts               read model; reuses panel/core.ts parsing
web/server/sections.ts            byte-preserving section edit + status labels
web/server/app.ts                 HTTP routes, auth/CSRF gate, static assets, logs
web/public/index.html             shell: login, task list, task detail
web/public/theme.css              extension tokens + responsive board styles
web/public/app.js                 small client: read, edit, answer, status
web/tools/hash-password.mjs       BOARD_PASSWORD_HASH generator (stdin/env)
web/tests/fake-github.mjs         synthetic GitHub API, no token or network
web/tests/helpers.mjs             board server + cookie-session test client
web/tests/config.test.mjs         config refusal, hashing
web/tests/auth.test.mjs           cookie, session expiry, CSRF, limiter
web/tests/sections.test.mjs       byte-preserving edits, status labels
web/tests/board.test.mjs          read model, fingerprints, write guards
web/tests/github.test.mjs         pagination, ETags, error mapping
web/tests/app.test.mjs            integration over HTTP against the fake server
web/tests/browser-verify.mjs      Obscura CDP run, screenshots, result JSON
```

Notes on reuse: `web/server/board.ts` imports `normalizeGithubIssues`,
`resolveV2Metadata`, `resolveIssueColumn`, `parseTestPlan` and
`answerOpenQuestionInMarkdown` from `panel/core.ts`; `sections.ts`/`app.ts`
import the agreed `status:*` set and display metadata from `panel/labels.ts`.
`panel/main.ts` is not imported. This is one import beyond the brief's named
`panel/core.ts` reuse; it avoids duplicating the status-label contract.

## Behaviour

- **Configuration:** environment only. Refuses to start on a missing/invalid
  value, naming `BOARD_GITHUB_TOKEN`, `BOARD_GITHUB_LOGIN`, `BOARD_REPO`,
  `BOARD_PASSWORD_HASH`/`BOARD_PASSWORD`, `BOARD_SESSION_SECRET`,
  `BOARD_PORT` or `BOARD_BASE_URL`; never echoes a value.
- **Startup identity:** `/user` must equal `BOARD_GITHUB_LOGIN`,
  `/repos/{owner}/{repo}` must be readable, otherwise the process exits before
  listening. Tested for wrong account and inaccessible repo.
- **Auth:** scrypt (`N=16384,r=8,p=1`, random salt, `timingSafeEqual`) over
  HTTPS in deployment; session id signed with `BOARD_SESSION_SECRET`; cookie
  `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=…`; CSRF token bound to
  the session and required as `X-CSRF-Token` on every write; absolute 12 h and
  idle 2 h expiry, in-memory. Failed-login limiter: 5 failures/minute per
  address, `429` + `Retry-After`, but a correct password still works while the
  limiter cools down (no owner lockout).
- **Credentials:** token/session secret only in the server process. API, HTML,
  JS, CSS and log lines were scanned in tests and in the browser; secret values
  and the session cookie are absent. Logs are `METHOD path status ms` with a
  redactor for token-shaped strings, the token, the secret and cookies.
- **Read:** `/api/board` pages through the repository (`per_page=100`, cap 10
  pages, `truncated` flag), excludes pull requests via
  `normalizeGithubIssues`, and exposes title, state, phase, attention, column,
  status label, labels, updatedAt and question/task counts. `/api/issues/:n`
  adds body, fingerprint, Overview section, open questions (with answer
  indices), human tasks, acceptance criteria, subtasks and test plan.
- **Writes:** PUT Overview text, POST an open-question answer, POST a status
  label. Each write requires the fingerprint from a current read; the server
  re-reads, compares SHA-256 over body+labels+state, returns `409` plus the
  current issue when different, and only then `PATCH`es (with the fresh ETag as
  `If-Match`; a `412` also becomes `409`). Conflicting writes produced zero
  PATCHes. Other sections stay byte-identical (tested with exact strings, LF
  and CRLF); human checkboxes, issue closing and non-status labels are refused.
- **Page:** list with title/state/phase/attention/status/freshness, one task
  view, Overview editor, inline question answers, status selector, back/refresh/
  sign-out. Plain empty/error/stale/conflict states. No agent-start, session
  open or activity controls anywhere. Extension tokens drive the styling;
  360 px layout has no horizontal scroll (measured `scrollWidth <=
  clientWidth`); native controls and a served `:focus-visible` ring.

## Exact commands and results

Run from the worktree root:

| Command | Result |
| --- | --- |
| `node --test web/tests/*.test.mjs` | **PASS** — 68 tests, 68 pass, 0 fail (~4.8 s) |
| `npx tsc -p web/tsconfig.json` | **PASS** — no diagnostics |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | **PASS** — 82,468 bytes |
| `node --check web/dist/server.mjs` | **PASS** |
| `node web/tests/browser-verify.mjs` | **PASS** — 29/29 checks, 10 screenshots |

Integration tests cover: unauthenticated denial on every data route, shell
without data, wrong password, limiter `429`, owner login during cooldown,
cookie/CSRF issuance, CSRF rejection with no PATCH, 105-issue pagination, PR
exclusion, detail fingerprint/sections, conditional write success, concurrent
conflict with zero PATCH, preserved sections, inline answer, status label
replacement with other labels kept, protected-section and oversized-body
refusal, cross-repository refusal (client-supplied `repo` never reaches the fake
GitHub), session expiry, sign-out, secret absence in HTML/JS/API/logs, and plain
404/405 answers. Startup via the real entry point is spawned twice for
missing/invalid configuration.

## Browser proof (synthetic fixtures, Obscura CDP)

Fake GitHub server with four synthetic issues (one pull request), throwaway
password, no real repository or credential. Result JSON:
`.agents/run/task-centred-architecture/verifications/issue-33-standalone-board/browser-verification.json`
(29 checks, 29 pass). Checks included: PR excluded (3 rows), repository label,
`document.cookie` empty after sign-in, storage empty, page source free of token
and password, real form sign-in, task open, Overview save reaching the fake
GitHub with other sections intact, conflict banner with no overwrite, reload
then inline answer written, status label changed with `bug` preserved, stale
board after injected GitHub failure, empty repository state, and measured
no-overflow at 1280 px and 360 px.

Screenshots (all under
`.agents/run/task-centred-architecture/verifications/issue-33-standalone-board/screenshots/`):

```
login-desktop-2026-10-23T21-36-19-077Z.png
board-desktop-2026-10-23T21-36-19-077Z.png
task-detail-desktop-2026-10-23T21-36-19-077Z.png
conflict-desktop-2026-10-23T21-36-19-077Z.png
task-detail-after-edits-desktop-2026-10-23T21-36-19-077Z.png
stale-board-desktop-2026-10-23T21-36-19-077Z.png
empty-board-desktop-2026-10-23T21-36-19-077Z.png
board-360-2026-10-23T21-36-19-077Z.png
task-detail-360-2026-10-23T21-36-19-077Z.png
signed-out-360-2026-10-23T21-36-19-077Z.png
```

The generated `browser-verification-report.md` in the same directory holds the
full check table. Screenshots are synthetic-fixture proof, not production data.

## Residuals and NOT RUN

- **NOT RUN — real Tab-key traversal.** Obscura does not deliver synthetic key
  presses to the page, and script focus does not engage the browser's
  `:focus-visible` heuristic. Verified instead: every interactive element is a
  native control with `tabIndex >= 0`, focus moves to a real control, and the
  served stylesheet defines `:focus-visible { outline: 2px solid … }`. A human
  keyboard pass is still worthwhile.
- **GitHub `If-Match` on issue PATCH is not verified against real GitHub.**
  Conditional writes were verified against the fake server; GitHub's documented
  support for conditional `PATCH` is not guaranteed, so a small window between
  the re-read and the PATCH remains. The fingerprint check closes all
  client-visible conflicts.
- **No real-GitHub run.** The brief forbids using real credentials; every test
  and browser step uses synthetic fixtures. First real use should be a
  read-only look at the configured repository.
- **Deployment shape assumed:** the server binds `127.0.0.1`; a TLS-terminating
  reverse proxy is expected on the same host. The session cookie is always
  `Secure` (accepted on `http://127.0.0.1` by the browser used). There is no
  HSTS unless `BOARD_BASE_URL` is `https`.
- **Single process, single user:** sessions and rate limits are in memory, so a
  restart signs the owner out. No multi-user accounts, no persistence.
- **Editable surface is deliberately narrow:** only Overview prose plus inline
  open-question answers; other prose sections are read-only rather than risk
  checklist/prose ambiguity.
- **Fingerprint excludes `updated_at`** so comment activity does not force
  false conflicts; it covers body, label names and state.
- **Build bundle not smoke-run against a live API** because startup requires a
  real GitHub identity check; only `node --check` and the source tests cover it.

## Anything needed from the human

Nothing to unblock the build. Review would benefit from: one keyboard-only pass
in a normal browser, and a decision on whether other prose sections should
become editable (currently Overview only).
