# Proof — issue #33 standalone board (builder proof + hostile review)

Reviewed code commit: `af62a4e` on `feat/issue-33-standalone-board`; docs HEAD
`5ac82c2`. Worktree: `.worktrees/team-dev-issue-33-standalone-board`.
Review date: 2026-10-23. This section is appended after the builder's browser
proof (`browser-verification-report.md`, `browser-verification.json`,
`screenshots/`) and does not replace it.

Verdicts: **Spec PARTIAL** against issue #33 as written; **Security
NEEDS-FIXES**. Full findings and ruling: `outputs/issue-33-hostile-review.md`.

## Environment

```
node v22.23.3
tsc 7.0.2 (npx)
esbuild (node_modules/.bin)
obscura 0.2.5
```

All probes and fixtures under `/tmp/opencode`. No real GitHub token, no real
repository, no GitHub write, no credentials file.

## Re-run of the builder's claimed checks (all from the worktree root)

| Command | Result |
| --- | --- |
| `node --test web/tests/*.test.mjs` | PASS — tests 68, pass 68, fail 0, duration 5031.28 ms |
| `npx tsc -p web/tsconfig.json` | PASS — `tsc_exit=0`, no diagnostics |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/server-review.mjs` | PASS — `esbuild_exit=0`, 82,468 bytes |
| `node --check /tmp/opencode/server-review.mjs` | PASS — `check_exit=0` |
| `sha256sum web/dist/server.mjs /tmp/opencode/server-review.mjs` | MATCH — both `21df693c45c5c982fb19687c62588e18226d28922963acc7dd21fc195d68fc2c` |
| `node --check web/dist/server.mjs` | PASS — `check=0` |
| `node web/tests/browser-verify.mjs` | PASS — `{"checks":29,"passed":29,"screenshots":10}` |

Browser run artifacts were restored with `git checkout --` and the
new timestamped screenshots deleted; worktree returned to clean. The 1280 px and
360 px screenshots were opened and inspected: login, board, detail, conflict,
stale, empty, signed-out render as reported; no horizontal scroll at 360 px.

## Hostile probes (synthetic only)

| Probe | Command | Key result |
| --- | --- | --- |
| Auth/CSRF/limiter/repo/write fuzz | `node /tmp/opencode/hostile-probe.mjs` | see below |
| Lost update (TOCTOU) | `node /tmp/opencode/toctou-probe.mjs` | If-Match honoured → 409, remote survives; ignored → 200, remote overwritten |
| Browser stored-XSS | `node /tmp/opencode/xss-probe.mjs` | `window.__xss === null`, 0 injected elements |
| Upstream error mapping + pagination | `node /tmp/opencode/github-errors-probe.mjs` | 401/403/422/500/502 → 502; 429 → 503; duplicated next page → 20 rows |
| Static surface + traversal | `node /tmp/opencode/surface-probe.mjs` | traversals 404, MIME/CSP/cache headers correct |
| CSRF form/fetch replay | `node /tmp/opencode/csrf-probe.mjs` | no-token form 403; text/plain 403; evil Origin + token 400 (body parse) |

Selected evidence:

```
anon GET /api/board -> 401; anon PUT/POST writes -> 401; patchCalls 0
login fuzz empty/array/object/number/null/duplicate/JSON/invalid -> 401/400/413; no crash, no Set-Cookie
7 wrong logins -> 401,401,401,401,401,429,429; correct password -> 200 (owner not locked out)
X-Forwarded-For / Forwarded variants -> same bucket (no bypass)
CSRF none/wrong/empty/other-session -> 403, patchCalls 0
valid token + evil Origin -> accepted (defence-in-depth gap, F4)
logout then replay old cookie+token -> 401
repo/owner/name/`/repos/...`/encoded traversal -> 400/404 or ignored; unknownRepoHits []
protected section / non-status label / missing or bad fingerprint / PR read+write -> refused
BOM body -> save drops `## Overview`; leading fence -> save corrupts block (F7)
If-Match honoured: 409, body "REMOTE CONCURRENT EDIT"; ignored: 200, body "LOCAL EDIT"
20 parallel wrong logins -> 5x401, 15x429, 1257 ms (blocked clients still scrypt)
limiter after 5,001 failures: 20 checks in ~4 ms; 100k fill exceeded 120 s (F2)
XSS browser: xss null, imgs 0, svgs 0, onerror 0, cookie "", storage 0
traversal: /../server.ts, /%2e%2e/server.ts, /app.js/../../server.ts, /app.js%00 -> 404
```

## Credential-exposure checks

`grep -rnE "ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}"` over
`web/server`, `web/public`, `web/README.md`, `web/tools`,
`web/dist/server.mjs` and the run artifacts: no credential. The synthetic
test-token patterns appear only in `web/tests/*` fixtures. Browser probe:
`document.cookie === ""`, `localStorage.length + sessionStorage.length === 0`,
page source free of token/password/CSRF token. Error responses are generic and
carry no stack.

## Spec-check evidence

Issue #33 body fetched 2026-10-23 via
`https://api.github.com/repos/Workflows-Accelerator/openchamber-github-task-board/issues/33`
(0 comments). It states: “Sign-in is GitHub-based and server-held; a token never
reaches the browser,” and requires access to be limited to the configured
GitHub account with “any other account or repository … refused.” The only
implementation login route accepts `{password}` and issues a session from the
board password (`web/server/app.ts:303-320,430-467`); no OAuth/device-flow or
GitHub-identity check exists. Criterion 2 and the second-account test therefore
FAIL, which is why the overall spec verdict is PARTIAL rather than PASS.

`If-Match` on issue PATCH is not supported by GitHub: the Best Practices page
says conditional requests for unsafe methods including `PATCH` are “not
supported unless otherwise noted”, and the OpenAPI operation
`PATCH /repos/{owner}/{repo}/issues/{issue_number}` declares no `If-Match`
header (github/rest-api-description, fetched 2026-10-23). The builder's fake
honours it (`web/tests/fake-github.mjs:158-162`); production normally will not,
so the residual window in F1 is real.

## Worktree integrity

Post-review `git status --porcelain` lists only the two review artifacts before
commit; `web/**` and all product files are untouched. Nothing pushed, deployed,
merged, or commented.

Actual review model: Genius (`9router/genius`). Builder-supplied and actual
builder model reported by the build: Engineer (`9router/engineer`).
