# Hostile review — issue #33 standalone board

Reviewed commit: `af62a4e` (`feat/issue-33-standalone-board`), worktree
`.worktrees/team-dev-issue-33-standalone-board`; docs HEAD `5ac82c2`.
Review date: 2026-10-23. Worktree left clean; no product file changed.

## Verdicts

- **Spec against issue #33 as written: PARTIAL.** The functional board is
  largely there, but the two identity requirements — GitHub-based sign-in and
  refusal of a second GitHub account — are not implemented, and existing board
  rendering is not reused.
- **Security: NEEDS-FIXES.** No credential leak, code-level auth bypass, CSRF
  gap, or stored XSS was found. There are two Moderate code/operational
  findings (lost-update window; unauthenticated login CPU/memory DoS), one High
  specification/access-control deviation (board password instead of GitHub
  identity), and several Low hardening/evidence gaps.

This is not an approval to merge, deploy, or close anything.

## Spec ruling (issue #33 body, fetched 2026-10-23)

Issue #33 says: “Sign-in is GitHub-based and server-held; a token never reaches
the browser,” and its acceptance criteria require signed-in access “limited to
the configured GitHub account… any other account or repository is refused.”
The escape hatch test plan repeats “A second GitHub account cannot read or write
the allowed repository.”

The implementation has **no GitHub sign-in**. It has a board password
(`web/server/app.ts:303-320,430-467`, `web/server/config.ts:199-226`,
`README.md:27-36`) plus a server-held PAT. There is no OAuth/device-flow route,
no GitHub account input, no per-request GitHub identity, and no account
allowlist beyond the PAT's repository. Anyone who knows the board password is
admitted, regardless of GitHub account; a second GitHub account is irrelevant
rather than refused. That is a **FAIL** of acceptance criterion 2 and the test
plan, and a **FAIL** of the “choose and document the GitHub sign-in flow”
subtask. The builder's own residual list does not disclose this mismatch.

| Issue #33 item | Ruling | Evidence |
| --- | --- | --- |
| Unauth visitor sees no task data | PASS | shell is static; `/api/*` 401; browser proof |
| Access limited to configured GitHub account / other account refused | **FAIL** | password login only; no GitHub identity check |
| Credentials server-only, never browser/URL/source/logs | PASS | bundle/source/browser scans below |
| Title, state, phase, attention, freshness/failure | PASS | `board.ts`, browser screenshots |
| Edit section, answer question, change status appear on GitHub | PASS in code/synthetic; **NOT PROVEN on real GitHub** | fake GitHub only (real writes forbidden) |
| Concurrent edits fail closed | **PARTIAL** | stale-fingerprint conflict works; `If-Match` is not honoured by real GitHub (F1) |
| Agent controls absent | PASS | no route/DOM control; grep + browser |
| Desktop and narrow viewport, no horizontal scroll | PASS | measured 1280 px and 360 px |
| No separate task store / no extension change | PASS | new `web/**` only; imports `panel/core.ts`, `panel/labels.ts` |
| Reuse existing parsing and rendering logic | **PARTIAL** | parsing imported (`board.ts:9-16`); rendering is a new `web/public/app.js`; `panel/main.ts` not imported |
| Second GitHub account denial test | **FAIL** | no such authentication path exists |

The implementation is a reasonable single-owner substitute, but it is not what
issue #33 asks for. Grade it PARTIAL, not PASS.

## Findings

Severity: Critical / High / Moderate / Low. “Proven” means reproduced here;
“suspected” is identified as such.

### F1 — Moderate — Lost update: `If-Match` is sent, but GitHub does not support conditional PATCH; the real guard is a fresh GET plus hash compare with a TOCTOU window

Files: `web/server/app.ts:483-514` (fresh GET, fingerprint compare, PATCH with
`etag`), `web/server/app.ts:516-522` (412→409 branch),
`web/server/github.ts:105-107` (`if-match` header),
`web/server/github.ts:224-232` (PATCH). README claims the ETag makes a 412
(`README.md:98-101`), then concedes the support is “not guaranteed”
(`README.md:118-120`).

GitHub's own “best practices” documentation states: “Conditional requests for
unsafe methods, such as `POST`, `PUT`, `PATCH`, and `DELETE` are not supported
unless otherwise noted in the documentation for a specific endpoint.”
(https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api,
fetched 2026-10-23). The OpenAPI operation for
`PATCH /repos/{owner}/{repo}/issues/{issue_number}` declares no `If-Match`
header (github/rest-api-description, fetched 2026-10-23). So in production
GitHub will normally ignore the header and the `412` branch is dead.

Reproduction (`/tmp/opencode/toctou-probe.mjs`): a synthetic API changes the
body between the board's fresh GET and its PATCH, then either honours or ignores
`If-Match`.

```
If-Match honoured:  PUT -> 409 conflict; final body = "REMOTE CONCURRENT EDIT"; remoteSurvived=true
If-Match ignored:   PUT -> 200;           final body = "LOCAL EDIT";            remoteSurvived=false
```

The builder's fake **honours** `If-Match` (`web/tests/fake-github.mjs:158-162`),
and the suite's “concurrent edit” test changes the issue before the request, so
it fails at the first fingerprint compare and never exercises the `412` branch
(`web/tests/app.test.mjs:333-363`). The fake therefore makes the safety claim
look stronger than production. Impact: a concurrent human or agent edit in the
server-read-to-PATCH window is silently overwritten. GitHub issue edit history
makes it recoverable, so Moderate rather than Critical; it directly violates the
“fail closed” acceptance criterion. Fix: do not rely on `If-Match`; add a
post-write verification or a server-side per-issue lock/retry, and test the
ignored-header case.

### F2 — Moderate — Unauthenticated login CPU/memory DoS; the limiter blocks responses but not scrypt work, and its failure array grows without a cap

Files: `web/server/app.ts:430-453` (verdict is computed before the body; the
password is always verified, including for blocked clients; line 441 records
another failure), `web/server/auth.ts:204-223` (`prune` filters the whole array;
`recordFailure` prunes then pushes).

Evidence:
- 20 parallel wrong-password POSTs: 5 × `401`, 15 × `429`, **1257 ms** wall
  time (the five scrypt computations are serialized; the 15 blocked requests
  still run scrypt).
- `LoginRateLimiter` with 5,000 failures holds 5,001 entries; 20 `check` calls
  take 4 ms. At 20,000 entries 10 checks take 3.4 ms. Filling 100,000 entries
  did not finish within the 120 s probe timeout because each `recordFailure`
  prunes an ever-growing array.
- `X-Forwarded-For` and `Forwarded` are ignored (`app.ts:431` uses
  `socket.remoteAddress`); seven attempts with distinct headers still produced
  `401,401,401,401,401,429,429` — no bypass, but one shared bucket behind a
  proxy.

Impact: an unauthenticated attacker can stall the single Node process and grow
memory; the owner's correct password still works (verified), so it is
availability, not account takeover. Fix: return `429` before doing scrypt when a
key is blocked (or use async scrypt with a small global concurrency queue and a
bounded failure map); cap/evict the array; only trust a forwarded client address
from a configured proxy.

### F3 — High (specification/access-control deviation) — Board password replaces GitHub sign-in; a second GitHub account is not refused

Files: `web/server/app.ts:303-320`, `web/server/app.ts:430-467`,
`web/server/config.ts:199-226`, `README.md:27-36`. No OAuth/device-flow route
exists; the login body is `{password}` and the session is created solely from
the board password. The PAT belongs to the configured account, but no browser
user is ever authenticated as that account.

Impact: any password holder can read/write the private repository; the issue's
“configured GitHub account only” boundary is not implemented, and there is no
per-account revocation or MFA. This is the principal fail against issue #33.
It is not a code-level bypass of the implemented auth, and with a strong unique
password behind HTTPS it does not by itself expose credentials; it is still an
access-control deviation from the written requirement. Fix: implement the
GitHub OAuth/device flow the issue asks for (or obtain an explicit, recorded
decision changing the requirement), verify the signed-in login against
`BOARD_GITHUB_LOGIN` per session, and add the “second account” denial test.

### F4 — Low — No Origin/Referer validation on writes (defense-in-depth only)

File: `web/server/app.ts:282-288`; no `Origin` or `Referer` check anywhere. A
request with a valid session cookie and CSRF token plus
`Origin: https://evil.example` was accepted (200, one PATCH). Without the
per-session token the same request is refused 403, and the token is not
cross-origin readable (JSON, `nosniff`, no CORS, `SameSite=Strict`), so this is
not currently exploitable. Add an allowlist check as defence-in-depth if the
deployment origin is known (`BOARD_BASE_URL`).

### F5 — Low — GitHub error mapping misreports common failures as “GitHub could not be reached”

Files: `web/server/github.ts:58-63` (401/403 → `unauthorized`),
`web/server/app.ts:134-148` (unauthorized falls through to 502). Probe results:

```
upstream 401 -> board 502 github_unavailable
upstream 403 -> board 502 github_unavailable   (GitHub uses 403 for primary rate limits)
upstream 422 -> board 502 github_unavailable
upstream 429 -> board 503 github_rate_limited
upstream 500 -> board 502 github_unavailable
```

Revoked tokens, missing write scope, and primary rate limits all look like a
network outage, encouraging retries. Operational/UX, not a data leak.

### F6 — Low — Pagination can duplicate items; the Link origin check is a string prefix

Files: `web/server/github.ts:168-200` (accumulates without dedupe; line 190 uses
`startsWith(this.apiBase)`). A synthetic API that returns the same two-item page
as “next” ten times produced 20 board rows (`1,2,1,2,…`) and
`truncated:true`; `buildBoardList` does not dedupe. Real GitHub normally sends a
correct Link, but ordering shifts between pages can create boundary duplicates.
The `startsWith` test would accept `https://api.github.com.evil.test`; that
requires control of GitHub's Link response or the API base, so Low. Parse and
compare `new URL(next).origin`, and dedupe by issue number.

### F7 — Low/Moderate (data integrity) — BOM or a leading fenced code block makes the preamble “Overview” and saving drops structure

Files: `web/server/sections.ts:30` (heading regex has no BOM handling), `:56`
(only `\r` is stripped), `:66-80` (preamble is marked editable),
`:140-168` (replacement). Reproduced directly:

- Body `\uFEFF## Overview\n\nText A\n\n## Human Tasks\n- [ ] keep\n` →
  `editableSections[0].text` is `\uFEFF## Overview\n\nText A`; saving `NEW`
  produces `NEW\n\n## Human Tasks\n- [ ] keep\n` — the `## Overview` heading is
  gone.
- Body starting with ` ```\n# Overview\n...` → the preamble is just ` ``` `;
  saving drops the opening fence and corrupts the code block.
- Duplicate headings and CRLF are handled correctly; the first duplicate is the
  only editable one and other bytes survive.

This violates the “every other byte preserved” promise for crafted/pasted
bodies. It is not a security boundary (the owner can edit GitHub directly), so
Low/Moderate. Fix: strip a leading BOM before heading scanning, skip fenced code
regions, and refuse rather than guess when the preamble contains a heading or
fence.

### F8 — Low — Password/vault hygiene in the README

`web/README.md:42` and `:59` show `BOARD_PASSWORD='…' node …`; the assignment is
recorded by an interactive shell's history, contradicting the tool's own claim
(`web/tools/hash-password.mjs:8-9`, “so it stays out of shell history”) while
its example block itself uses the history-recording form at `:5`. The stdin
form is safe. The hash tool writes no file, so there is no application-created
world-readable hash; if an operator redirects stdout under a default umask the
file is typically 0644. Recommend stdin or a secret manager, and `umask 077` if
a file is used.

### F9 — Low — No session cap and no password-change-without-restart path

`web/server/auth.ts:53` keeps an unbounded in-memory Map; only successful
logins add entries (1,000 sessions accepted in a direct probe), so an attacker
needs the password. There is no password-change route; changing the env requires
a restart, which also clears all sessions. Acceptable for one owner, but record
it as an operational limit.

### F10 — Low — Evidence/test gaps; the fake GitHub is not pessimistic enough

- `web/tests/fake-github.mjs:115-117` enforces auth, and `:158-162` enforces
  `If-Match` — the latter is unlike real GitHub PATCH (F1).
- The fake has no rate-limit responses (403 primary/429 secondary), no token
  scopes, and accepts `state` in PATCH even though the client refuses it.
- The suite's “concurrent edit” test does not cover the 412 branch; there is no
  second-GitHub-account test, no unauthenticated-write test, no XSS test, no
  Origin test, no BOM/fence test, no 403-primary-rate-limit test, and no
  duplicate-pagination test. Some of these are covered by this review and pass;
  the missing 412 and second-account cases are material.
- The residual list is honest about real Tab traversal, If-Match, real GitHub,
  and the single process, but omits the spec mismatch, the login DoS, Origin,
  error mapping, duplicates, and BOM/fence.

## Credential-exposure checks (no finding)

Proven absent from every surface checked:

- Source/bundle grep for `ghp_`, `github_pat_`, the synthetic token, the
  password, and the session secret found nothing in `web/server`, `web/public`,
  `web/README.md`, or `web/dist/server.mjs`. The bundle is 82,468 bytes and its
  SHA-256 (`21df693c45c5c982fb19687c62588e18226d28922963acc7dd21fc195d68fc2c`)
  equals a fresh build.
- Browser probe: `document.cookie` is empty (HttpOnly), `localStorage` +
  `sessionStorage` length 0, page source contains no token/password/CSRF token,
  and the page has no data while signed out. The session cookie is an opaque
  `id.signature`, not the GitHub token.
- Error responses are generic; forced upstream 500/502s return
  `{"error":"github_unavailable","message":"GitHub could not be reached"}`, no
  stack. Logs contain only `METHOD path status ms` plus
  `write issue=N fields=…`; the redactor covers token shapes, the token, the
  secret, and cookie values. The suite and this review found no Authorization or
  Cookie header logging.
- The hash generator writes no file. Test fixtures contain only synthetic
  values; screenshots and the browser JSON contain no real credential.

## XSS / page-integrity checks (no finding)

A live Obscura/CDP run with `<img onerror>`, `<script>`, and `<svg onload>` in
the title, labels, body, open-question text, and human-task text produced:
`window.__xss === null`, 0 injected `img`/`svg`, 0 `onerror` attributes, escaped
HTML in the list and question/human-task markup, no non-`#main` links, and no
runtime exceptions. `web/public/app.js` renders with `textContent` and attribute
values only; there is no `innerHTML`, `eval`, or data URL. CSP is
`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;
`nosniff`, `DENY`, `no-referrer`, and `no-store` are present. Static traversal
attempts (`/../server.ts`, `/%2e%2e/server.ts`, `/app.js/../../server.ts`,
`/app.js%00`, `/public/../server.ts`) all returned 404. The authenticated shell
contains no issue data.

## Reproduced attacks and probes

All against synthetic fixtures in `/tmp/opencode`; no real token, no real
repository, no real GitHub write.

1. No session: GET board/detail, PUT section, POST status/answer, DELETE session
   → 401, zero PATCHes.
2. Tampered/forged session cookie and pre-set fixation cookie → 401; login after
   a pre-set cookie issues a new id; two independent sessions both work; logout
   then replay of the old cookie+CSRF → 401.
3. Login fuzz: empty, array, object, number, null, duplicate keys, JSON
   string/array/null, form body, invalid JSON, null byte, 100 KB body → 401/400/
   413/429 as appropriate, no crash, no Set-Cookie; 5 wrong → 429; correct
   password → 200; `X-Forwarded-For`/`Forwarded` distinct values still share one
   bucket (no bypass). No user enumeration: the login takes only a password (no
   account field) and every failure returns the same 401 message.
4. CSRF: missing, wrong, empty, and another session's token on PUT/POST → 403,
   zero PATCHes; cross-origin form POST with a valid cookie but no token → 403;
   GET on write routes → 405; valid token + evil `Origin` → accepted (F4).
5. Variables: duplicate/garbage session signatures, expiry (absolute/idle),
   empty password, oversized body, unknown methods — no 500, no stack, no
   secret.
6. Repo/identity: `?repo=`, `?owner=`, `?name=`, `/repos/...`, encoded traversal,
   and body `repo` → 400/404 or ignored; fake `unknownRepoHits` empty.
7. Writes: protected section, status outside the agreed set, missing/bad
   fingerprint, empty/out-of-range/overlong answer, PR detail/write → refused;
   `state` is not an allowed PATCH field, so closing is impossible; a
   body-only “close” request leaves `state: open`; non-status labels survive.
8. BOM/fence bodies → structure loss (F7); duplicate headings and CRLF preserved.
9. TOCTOU with `If-Match` honoured → 409, remote survives; ignored → 200, remote
   lost (F1).
10. Upstream 401/403/422/429/500/502 → 502/503 mapping (F5); repeated pages →
    20 duplicate rows (F6).
11. Credential and XSS scans as above; static traversal, MIME, CSP, cache,
    cookie flags (`HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`)
    verified.

## Re-run of the builder's claims

| Check | Result |
| --- | --- |
| `node --test web/tests/*.test.mjs` | **PASS** — 68 tests, 68 pass, 0 fail, 5,031 ms |
| `npx tsc -p web/tsconfig.json` | **PASS** — exit 0, no diagnostics |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/server-review.mjs` | **PASS** — 82,468 bytes; `node --check` exit 0; hash equals `web/dist/server.mjs` |
| `node web/tests/browser-verify.mjs` | **PASS** — 29/29 checks, 10 screenshots; artifacts restored afterwards, worktree clean |
| `node --check web/dist/server.mjs` | **PASS** |

I opened the fresh 1280 px and 360 px screenshots: login, board, task detail,
conflict, stale, empty, and signed-out states render as described; no horizontal
scroll at 360 px; the long URL wraps. The only visual nit is literal
`*(Answer: …)*` markdown in an answered question (Low/cosmetic). Real Tab
traversal remains **NOT RUN**; Obscura does not deliver synthetic key presses and
script focus does not engage `:focus-visible`, so the residual is accurate.

## Answer to “safe to run behind HTTPS for a single owner?”

With a strong, unique board password, a TLS proxy, `BOARD_BASE_URL=https://…`
(for HSTS), and no requirement for the issue's GitHub-account identity, the
auth/CSRF/XSS/credential handling is sound enough for a single owner. It is
**not approved as-is** because F1 can silently lose a concurrent edit, F2 lets an
unauthenticated client stall the process, and F3 is a deliberate deviation from
issue #33's access-control requirement. No Critical credential leak, auth
bypass, CSRF gap, or stored XSS was found.

Actual review model: Genius (`9router/genius`). Supplied/builder model reported
by the build: Engineer (`9router/engineer`); actual builder model reported:
Engineer (`9router/engineer`).
