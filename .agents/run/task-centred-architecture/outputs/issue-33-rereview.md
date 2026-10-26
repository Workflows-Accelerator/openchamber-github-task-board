# Independent hostile re-review — issue #33

Date: 2026-10-24. Product HEAD: `a795985`; reviewed range: `ef1b78d..a795985` on `feat/issue-33-standalone-board`. Initial worktree clean. Review contract: `issue-33-rereview.md`; acceptance interpreted using supplied owner decisions dated 2026-10-24 and amendment v2, not the superseded GitHub-browser-identity requirement.

- **Security: NEEDS-FIXES.** No credential disclosure, authentication bypass, CSRF bypass, or executable issue-text injection found in checked paths. Login availability is not bounded as claimed.
- **Spec Compliance (owner decisions): PARTIAL.** Password access, detected-conflict refusal, warning, and absence of automatic write retries are implemented. Ambiguous transport outcomes do not always say unknown. New forwarded-header trust was added despite the amendment's restriction. `BOARD_HOST` remains absent.
- **Quality: NEEDS-FIXES.** Green existing suites miss reproduced failure paths; several CLOSED claims overstate implementation.
- **Machine-readable hostile-review verdict: PROCEED-WITH-CONDITIONS.** Conditions: address Medium findings and correct remediation statuses before approval; this is not permission to merge, deploy, or close an issue.

No product fixes, dependency changes, production access, live credentials, GitHub writes, or changes to `panel/**`, service, shared skills/configuration, other worktrees, branch topology, DNS/TLS, or host settings. Only this report is committed. All runtime probes used synthetic GitHub fixtures.

## Ranked findings

### R1 — Medium — Ambiguous response-body/browser transport failures do not show unknown

**Files:** `web/server/github.ts:119-131`; `web/server/app.ts:706-727,303-312`; `web/public/app.js:70-98,502-513,540-548,571-579`.

Only the initial upstream `fetchImpl` is inside the network-error catch. `await response.text()` at `github.ts:131` is outside it. A timeout/reset after response headers therefore throws a raw error; `writeIssue` only classifies `GitHubError` network/server failures as unknown. The raw error reaches the generic 500 response. A write may already be committed.

**Real local-HTTP reproduction:** fake GitHub commits PATCH; a synthetic proxy sends 200 headers with a larger Content-Length, writes eight response bytes, then destroys the socket. Board returns:

```json
{"status":500,"error":"server_error","message":"The board could not complete that request","patches":1,"committed":true}
```

`/tmp/opencode/issue33-rereview/body-loss.mjs` reproduces this without a custom fetch implementation. An additional injected response-stream failure produced the same result. In contrast, rejection before upstream headers correctly returns `502 write_outcome_unknown`, one attempted PATCH.

Separately, browser `api()` never classifies its own fetch/body-read failures as unknown on writes. Obscura probe allowed the real PUT to complete, then threw a synthetic browser transport error before the caller received it. DOM showed **`Synthetic browser response loss.`**, not unknown; GitHub body contained the edit, PATCH count one. This affects section, answer, and status handlers through their generic fallback. Login/logout are not issue writes and need different treatment.

**Impact:** owner cannot distinguish an unsuccessful operation from an applied write whose response was lost. No automatic repeat was found, but the required unknown instruction is missing and manual retry is encouraged by ambiguity. F1's owner-accepted overwrite window does not waive truthful outcome reporting. Catch/classify the entire upstream response-read operation and conservatively classify browser write transport/protocol failures; add both regressions. Do not retry writes.

### R2 — Medium — Login deduplication creates an over-60-second shared-address denial; global work queue is unbounded

**Files:** `web/server/app.ts:107-135,161-181,526-527,551-588`; `web/server/auth.ts:189-257`; `web/README.md:79-91`.

The **failure limiter itself** now works: early 429 before body/hash; no failure recorded on blocked requests; five recorded failures per address through the endpoint; 1,000 retained address buckets; cooldown at most 60 seconds. But `inFlightLogins.add(ip)` occurs before reading a body and has no application-level expiry. A single unfinished POST owns that address's slot until completion/error. New owner sign-in gets 429 from deduplication, independently of the failure cooldown.

**Reproduction:** open one unauthenticated POST `/api/session`, declare Content-Length 1000, write only `{"password":`, keep connection open. Correct owner login was 429 at 100 ms and **still 429 after 61 seconds**, with `retryAfterSeconds: 1` and “A login request is already in progress…”. Existing authenticated board request remained 200. No claim of infinite denial from one socket: Node/proxy timeouts may eventually release it. No such short application deadline is configured here. Behind the default proxy addressing, all visitors may share this address; request buffering could mitigate, but was not verified.

The scrypt queue bounds **active hashes**, not queued work. Its array and the in-flight-address Set have no capacity/admission cap. Using **200 distinct real loopback source addresses**, with forwarded-header trust disabled, admitted all 200 password verifications: 197 still waiting at 200 ms; all eventually 401; total 6,608 ms. Authenticated board request during the flood remained 200. Distributed senders can enqueue arbitrarily many addresses, retaining request/password closures; the limiter's bounded Map does not bound this queue.

**Impact:** unauthenticated availability issue, not account takeover. F2 cannot truthfully be CLOSED or described as preventing CPU/memory exhaustion. Bound queue/admission and request occupancy, and test slow bodies plus distinct concurrent source addresses. Keep authenticated routes independent. Do not claim complete denial-of-service immunity.

### R3 — Medium (configuration-dependent) — Blanket forwarded-header trust added outside amendment boundary

**Files:** `web/server/config.ts:192-196,258`; `web/server/app.ts:185-198`; `web/README.md:35`.

Default is correctly false; changing both forwarded headers across six failures still produced `401,401,401,401,401,429`. However, remediation introduced `BOARD_TRUST_PROXY=true`, which trusts the first X-Forwarded-For value from **any socket peer**, with Forwarded fallback. It does not configure/validate a trusted proxy address or hop. README recommends enabling it behind a trusted reverse proxy without requiring header replacement or checking the peer. If a proxy preserves/appends attacker-supplied values, an attacker invents per-attempt addresses, bypassing deduplication/cooldowns and feeding R2's queue.

The amendment explicitly says “no new forwarded-header trust”; default-off is not removal of that added capability. Remove it for this bounded task, or obtain a separate decision and specify a safe peer/header contract. This is not a default authentication bypass and is not proven exploitable in the unexamined deployment.

### R4 — Low — F7's fenced-code fix accepts a non-closing fence and still corrupts structure

**Files:** `web/server/sections.ts:31,62-81,109-129,180-186`.

The opening-fence regex also recognizes closing fences, but does not require that a closer contain only marker characters followed by whitespace. For valid Markdown:

````markdown
## Overview
Intro
```text
example
```not-a-closing-fence
## Not a heading (still in code)
example
```

## Human Tasks
- [ ] keep
````

`findSections` incorrectly closes at ` ```not-a-closing-fence ` and recognizes the following code text as a heading. Replacing Overview with `NEW` removes the opening fence and splits the fenced block. BOM and ordinary fence cases are fixed, but the unconditional “headings inside fenced code blocks are excluded” claim is false. Restrict closing-fence grammar or refuse ambiguous structure; add this case. This is a crafted-body structural-integrity problem, not XSS.

### R5 — Low — F8's history-safe command still records the secret; documented hash tool cannot execute

**Files:** `web/README.md:39-46`; `web/tools/hash-password.mjs:4-9,13-15,19`.

Typing `printf '%s' 'your-secret-password' | node ...` still records the literal password in interactive shell history. Stdin protects the invoked tool's argument vector, not the shell command text. The file-writing example repeats this. The tool still advertises inline `BOARD_PASSWORD='…'` plus the false history claim.

Both new README commands also fail on Node 22.23.3: the `.mjs` file contains TypeScript return/type annotations, producing **`SyntaxError: Unexpected token ':'` at line 13**. `printf '%s' 'abcdefghijk' | node web/tools/hash-password.mjs` exited 1. This syntax defect predates the review range, but F8's new documented workflow depends on it and the CLOSED claim is not verified. Use an actual hidden prompt/secret-manager input, retain restrictive file permissions, and test the executable hash command. Plain `BOARD_PASSWORD` startup remains an alternative; this is not a total board-startup failure.

### R6 — Low — Session eviction is FIFO, not the claimed LRU

**Files:** `web/server/auth.ts:75-81,101-118`; `web/README.md:92-94`; remediation report F9.

Capacity 50 is implemented. Eviction uses Map insertion order; `get()` updates `lastSeenAt` but never reorders entries. With capacity two: create A, create B, use A, create C; A is evicted and unused B survives. Existing test explicitly expects that behavior. Correct the documentation or implementation, without weakening the cap test. Password rotation still requires restart; restart revokes sessions.

### R7 — Low — New readback verification falsely reports ordinary CRLF saves as unknown

**Files:** `web/server/app.ts:658,691,732-735`; `web/server/sections.ts:111,142-145,176-186`.

CRLF body, Overview `Original`, browser edit text `Changed`: PATCH correctly writes CRLF `Changed\r\n`, but `findSections(...).text` is `Changed\r`; strict comparison against `Changed` fails. Reproduced **502 write_outcome_unknown**, one PATCH, issue correctly updated. LF edits with leading/trailing blank lines or text normalization can likewise differ from projected text. This is conservative rather than false success, but a newly added failure for supported line endings; existing section-only CRLF test misses the end-to-end readback step. Compare a canonical expected projection/patched body without losing concurrent-change detection.

### R8 — Low (trusted-upstream residual) — Pagination origin validation does not enforce the one-repository path

**Files:** `web/server/github.ts:187-196,222-234`; `web/README.md:98-100`.

Cross-origin Link rejection and deduplication are fixed. Same-origin links can still name `/repos/other/repo/issues`: synthetic Link made the client send its token to that second path and include its issue. Browser callers cannot supply this Link; exploitation requires a bad/compromised trusted upstream response, so not a new high-severity access-control bypass. Still, “every GitHub call is built from BOARD_REPO” is not literally true. Validate pagination collection path as well as origin, or disclose the upstream trust assumption. No live token scope was inspected or tested.

## Findings F1–F10 re-adjudicated at HEAD

| Original finding | Re-review status | Evidence and boundary |
| --- | --- | --- |
| F1 lost update | **MITIGATED (best-effort, owner-accepted); outcome-reporting gap OPEN (R1)** | `app.ts:622-634` fresh GET/fingerprint/409 before PATCH; `530-549` in-process lock; one `updateIssue` at `707`; `716-727,763-770` unknown cases. Warning at `index.html:65`, README `101-108,124-126`. Reproduced stale question returns 409 plus new text, zero PATCHes. Actual remaining interleaving reproduced below. Never CLOSED. |
| F2 login CPU/memory DoS | **PARTIAL / OPEN** | Early limit, bounded failure buckets and async hashes work (`app.ts:551-585`, `auth.ts:189-257`, `config.ts:171-189`). Slow occupancy, unbounded queue, added trust remain R2/R3. README's broader exhaustion claim is unsupported. |
| F3 browser GitHub identity | **SUPERSEDED by owner decision** | `app.ts:551-605` password-based session; startup token-owner check `256-279` is not browser GitHub sign-in. Password holders admitted regardless of their GitHub identity. No OAuth required; no second-browser-account denial claimed/tested. Existing “another account” startup test checks the token owner, which remains valid. |
| F4 Origin/Referer | **CLOSED for configured-origin defense-in-depth** | `app.ts:201-234,367-374`; all issue writes and logout call `requireCsrf`. Origin preferred; Referer fallback. Both absent is allowed, with session CSRF still required. Existing tests `app.test.mjs:653-689` reject evil Origin/Referer, accept matching Origin. BOARD_BASE_URL must be set. |
| F5 error mapping | **CLOSED for listed complete upstream HTTP responses** | `github.ts:59-73`; `app.ts:138-158`. Reproduced suite checks 401, 403 primary limit, other 403, 422, 5xx. Response-stream handling remains separate R1; do not broaden F5's closure to all transport failures. |
| F6 duplicates / Link prefix | **Original fixes CLOSED; residual R8 OPEN** | `github.ts:184,201-219` deduplicates numbers/stops zero-new pages; `225-234` parses URL and compares exact origin. Tests `github.test.mjs:129-181` cover hostile prefix and repeated pages. Zero-new-page early termination leaves `truncated:false`; not a completeness guarantee. |
| F7 BOM/fences | **PARTIAL / OPEN** | BOM scanning/preservation `sections.ts:54,173-175`; ordinary fences `62-81`; ambiguous preamble `92-105`; only first recognized Overview editable `112-129`. New tests pass but do not cover false closers (R4). |
| F8 password hygiene | **OPEN** | `README.md:39-46` still history-unsafe; executable tool fails (R5). `umask 077` and env-file launch guidance are improvements, not full closure. |
| F9 sessions | **Cap CLOSED; LRU claim FALSE; restart-only rotation remains** | `auth.ts:13,75-81,112-118` cap and expiry; README `92-94` restart. Recently used oldest evicted (R6). No password-update route. |
| F10 test/evidence gaps | **PARTIAL / OPEN** | Fake defaults `honorIfMatch:false` (`fake-github.mjs:88,166-170`), with error/PATCH hooks `106-108,177-190,241-242`. Added tests cover several old gaps, but R1/R2/R4/R5/R7 escape all green suites. No 412-specific test found; no real-GitHub permission/scopes test, deliberately. No second-browser-account test needed after owner decision. |

Answered-question cosmetic change is present at `app.js:323-337`; fresh 360px screenshot displays plain answer text, not literal `*(Answer: ...)*` wrapper.

## Write-path proof and remaining accepted window

Read every production fetch/PATCH call site and caller error handling:

- Browser has one `fetch` primitive, `app.js:70-99`. One issue-write call per control: section `483-518`, answer `520-550`, status `552-581`. Each catch handles or displays error, not re-dispatch. Session POST/DELETE `583-595,597-628` likewise have no automatic replay. Hashchange, refresh, boot and interval initiate reads/rendering only.
- Routes `app.ts:451-494` share `writeIssue`. Lock's `while` waits before invoking the callback; it does not rerun a callback/write. Callback makes one fresh read, refuses mismatched fingerprint, validates operation, calls `updateIssue` once at `707`, then reads back. 412 branch reads and refuses; no repeat. Unknown branches throw. No re-apply/retry loop.
- `GitHubClient.request` `github.ts:102-163` makes one fetch; `updateIssue:254-275` makes one PATCH and permits only `body`/`labels`. Pagination loops only GET. No other production write primitive found.
- Existing tests reproduce section/status stale 409 with zero PATCHes; added independent changed-question probe returns 409 with `Changed question?`, zero PATCHes. `handleConflict`, `app.js:473-480`, replaces displayed detail and requires answering again.
- Existing mismatch and 500 tests each produce 502 unknown with one PATCH. Extra browser mismatch probe visibly shows unknown and issues exactly one PATCH. Lost response cases described in R1 also make one attempt, but fail the message requirement.

**Owner-accepted remaining interleaving:** client loads B0; board fresh GET returns B0 and matching fingerprint; external writer commits Bext; board PATCH writes Blocal using the earlier snapshot; GitHub ignores If-Match; readback sees Blocal and board returns success. Independent `setBeforePatchHook` probe returned 200, local survived, remote did not. This is explicitly disclosed, not a new demand for atomic writes. Board locks do not serialize GitHub/agent writers.

**Warning visibility:** `index.html:65` is directly above Overview/edit panels, with highlighted warning style `theme.css:312-318`. Opened fresh 1280px and 360px detail screenshots: warning readable before controls, no clipping; 360px text wraps. README repeats it. Existing browser text-only assertion alone would not prove visibility; screenshots do.

**Claim grep:**

```sh
grep -RniE 'atomic|fail[- ]?closed|guarantee' web/server web/public web/README.md README.md .agents/run/task-centred-architecture/outputs/issue-33-remediation.md
# exit 1: no matches
```

README `125` says GitHub does **not** support transactional/conditional issue PATCH; this is a negative capability statement, not an unsupported safety claim. Reports remain inaccurate in the specific ways listed above despite the keyword grep being clean.

## Security regression evidence

- Server token stays in `GitHubClient` Authorization header (`github.ts:106-110`), not issue projections/session payloads. Synthetic HTML/JS/API/log credential test passes (`app.test.mjs:518-539`). Independent probe logs contain no synthetic token/session secret/cookie. Error responses omit upstream exception details. No production secret read.
- Cookie `auth.ts:137-156`: Path=/, HttpOnly, Secure, SameSite=Strict, Max-Age; signed random session `39-47,82-108`, bound CSRF `179-182`. Forged/expired/destroyed session tests pass. Browser document.cookie empty; no local/session storage; no token/password in page source. Logout revokes server session.
- Missing/wrong CSRF coverage in suite passes. Independent missing-token and cross-session-token status changes each 403; evil Origin/Referer each 403; forged session, logged-out replay, and unauthenticated write each 401; zero PATCHes. Added Origin guard is supplementary, not substitute for CSRF.
- Rendering uses textContent/value/native elements, not issue-controlled HTML (`app.js:23-38,217-265,314-365,381-430`). Extra Obscura run injects img/script/svg/event-handler strings into title, label, question, human task. Result: `window.__xss` absent, zero injected img/svg/inline script nodes, zero onerror/onload attributes; literal text remains escaped. CSP/nosniff/no-store remain (`app.ts:81-89`). No XSS regression found.
- Static serving is a four-entry literal map (`app.ts:289-294,381-410`), not request-derived disk paths. Five independent traversal/NUL/path variants all 404. Unauthenticated API routes remain protected by `requireSession`.
- Repository query/path overrides rejected (`app.ts:339-355`); issue numbers parsed; writes only configured issue path and allowed fields. Synthetic unknownRepoHits remains empty in ordinary requests; R8 is the upstream pagination exception. Production PAT permission scope cannot be proved from application code.

## Deployment boundary

**Not deployment-ready for an external-container proxy requiring a non-loopback bind.** `app.ts:781` hardcodes `127.0.0.1`; BoardConfig has no BOARD_HOST (`config.ts:22-33,256-271`), entry point reports loopback (`web/server.ts:36`). Owner decision 8 requires a configurable BOARD_HOST for the accepted container hosting shape. Whether the actual proxy shares the network namespace was not investigated here. No route/process/TLS/restart-persistence change performed or approved. BOARD_BASE_URL and HTTPS remain operational requirements; password/token readable by co-container agents is an owner-recorded hosting risk, not solved here.

## Reproduced checks and artifacts

Environment: Node `v22.23.3`; existing root node_modules symlink; no packages installed. Commands rerun with explicit exit capture, not inferred from pipelines:

| Command | Result |
| --- | --- |
| `node --test web/tests/*.test.mjs` | exit 0; **88/88 passed**, 0 skipped/fail; 6,369 ms final run |
| `npm test` | exit 0; **466/466 passed**, 0 skipped/fail; 63,563 ms final run |
| `npx tsc -p web/tsconfig.json` | exit 0; no diagnostics |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/issue33-rereview/server.mjs` | exit 0; 91.1kb |
| `node --check /tmp/opencode/issue33-rereview/server.mjs` | exit 0 |
| `sha256sum /tmp/opencode/issue33-rereview/server.mjs web/dist/server.mjs` | both `5a188e69c903759380db3bb2481bde34782deb854ee07c08a329f8221461cfcb` |
| `node web/tests/browser-verify.mjs` | exit 0; **30/30 checks**, 10 screenshots; sign-in, edit, conflict refusal, warning, desktop/narrow, sign-out |
| `node /tmp/opencode/issue33-rereview/browser-adversarial.mjs` | exit 0; **32/32 checks**, 12 screenshots; baseline plus XSS and visible mismatch-unknown assertions. Browser response-loss defect recorded as observation, not counted as a passing requirement. |
| `node /tmp/opencode/issue33-rereview/probes.mjs` | exit 0; 100,000 addresses / 500,000 failures retain 1,000 buckets; cooldown recovered at 60,000 ms; forwarding defaults, queue, conflicts, errors, traversal, sessions observations above |
| `node /tmp/opencode/issue33-rereview/security.mjs` | exit 0; cross-session CSRF, evil Origin/Referer each 403; forged session/logout replay/unauthenticated write each 401; zero PATCHes |
| `node /tmp/opencode/issue33-rereview/body-loss.mjs` | exit 0; real HTTP truncated-response defect reproduced (R1) |
| `node /tmp/opencode/issue33-rereview/slow-login.mjs` | exit 0; pending-body 429 beyond 61 seconds (R2) |
| `node /tmp/opencode/issue33-rereview/readback.mjs` | exit 0; CRLF false-unknown (R7) |
| `node /tmp/opencode/issue33-rereview/fences.mjs` | exit 0; non-closing fence misparsed (R4) |
| `node /tmp/opencode/issue33-rereview/pagination.mjs` | exit 0; same-origin second repository Link followed (R8) |
| `printf '%s' 'abcdefghijk' \| node web/tools/hash-password.mjs` | **exit 1**, SyntaxError (R5); synthetic input only |

Scripts/artifacts live under `/tmp/opencode/issue33-rereview/`, not committed product changes. Existing browser script regenerated two tracked evidence files; restored their exact HEAD contents after copying fresh output/screenshots to `/tmp/opencode/issue33-rereview/`. New screenshots moved there too. This report is the sole repository diff. `web/dist/server.mjs` not rewritten; fresh bundle hash agrees.

Not verified: production GitHub access/write scopes, real GitHub writes, TLS/proxy headers/buffering/network namespace, deployment persistence, restart recovery in the real container, real Tab traversal (Obscura input limitation). Existing browser residual about actual Tab/focus-visible remains accurate. No live/voice-page authentication accessed or reused.

DIDN'T WORK: system `rg` invocation failed, `/usr/bin/bash: rg: command not found` (127). FINALLY WORKED: `grep` searches above. Hash-generation command failed with SyntaxError and remains a reported defect, not worked around or fixed. No product rollback needed; no product edits made.

Actual independent review model: **Genius (`9router/genius`)**.
