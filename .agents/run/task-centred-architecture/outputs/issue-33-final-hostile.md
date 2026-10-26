# Issue #33 — final independent hostile review

Reviewed product HEAD `f50519d7a24413d74db4f46cef72a1512c820773`, range `2151ce2..f50519d`, on `feat/issue-33-standalone-board`. Verification ran 2026-10-24–25 UTC. Reviewer: **Genius (`9router/genius`)**, independent of builders.

- **Security: NEEDS-FIXES.** No browser authentication bypass, CSRF bypass, issue-text execution, or direct browser credential disclosure reproduced. Repository-path enforcement still permits authenticated redirects to another repository.
- **Spec Compliance: PARTIAL.** R2–R6's specific remediations work. R1 is incomplete; R7's successful CRLF fix weakens readback comparison; R8 rejects bad Link paths but not redirects. The shared question parser retains the malformed-fence behavior fixed in the section parser.
- **Quality: NEEDS-FIXES.** Green suites and matching bundle do not cover the remaining protocol, redirect, and Markdown-integrity cases. README and remediation closure claims remain broader than evidence.
- **Machine-readable verdict: PROCEED-WITH-CONDITIONS.** No new High finding; no High-triggered HALT. This is a bounded review, not another builder loop or permission to merge, deploy, or close #33. Conditions: resolve/adjudicate findings below and correct completion claims before approval; retain the batched human gate.

## Actual post-collision tree

Read the complete remediation diff, changed tests, report diff, all `web/server/*.ts`, `web/public/app.js`, hash tool, README, browser harness, fake upstream and helper code; inspected the shared question parsing/answering functions called by the server. No interleaved syntax fragments or inconsistent product/bundle bytes found. `git diff --name-only e88126a f50519d` reports only `.agents/run/task-centred-architecture/outputs/issue-33-remediation.md`; no product difference. Reviewed the actual final tree, not duplicate-commit narratives.

`git diff --exit-code f50519d -- web panel service test package.json` exited 0 after checks. Final review changes are confined to this report and `verifications/issue-33-final/**`; disposable probes ran under `/tmp/opencode/issue33-final`. No product/test fixes, dependency installs, credentials, real GitHub writes, private deployment/voice reports, other worktrees, extension runtime, push, merge, closure, or deployment actions.

## R1–R8 adjudication

Proof directory below means `.agents/run/task-centred-architecture/verifications/issue-33-final/` in the reviewed worktree. Scripts and full raw results are committed there.

| Finding | Verdict | Independently executed evidence and boundary |
| --- | --- | --- |
| **R1** | **PARTIAL / OPEN** | Real local HTTP proxy commits one PATCH, then supplies truncated 200, malformed JSON 200, 502 HTML, or a response body that never ends until the actual 15-second upstream timeout: each becomes `502 write_outcome_unknown`, exactly one PATCH, committed body confirmed (`probes.json`). Browser fetch rejection and real truncated browser response likewise show unknown without repeat. However real browser-facing 502 HTML and malformed 200 show `request_failed.` / a null-property exception instead of unknown. An upstream post-commit malformed 422 becomes definitive-looking `400 invalid_request`. See N1. |
| **R2** | **Specific availability defects CLOSED; documentation inaccurate** | Unfinished Content-Length 1000 login owns address at 100 ms (`429`); correct login succeeds after approximately 2.25 seconds (`200`), and authenticated board remains `200`. Abort releases the slot. 200 distinct real loopback peers yield 10 completed `401` and 190 `429`, all rejected requests carry retry guidance; authenticated request made during flood returns `200`. Twelve unfinished peers produce two immediate `429`; deadline recovery succeeds. Code bounds active hashes to 2, waiting queue to 4, address slots to 10, body lifetime to 2 seconds. 100,000 addresses / 500,000 recorded failures retain 1,000 buckets; simulated clock recovers at 60,000 ms. Not complete network/socket denial-of-service immunity. |
| **R3** | **CLOSED** | `BOARD_TRUST_PROXY=true` supplied to configuration, varying both X-Forwarded-For and Forwarded: `401,401,401,401,401,429`. Production config has no trustProxy; socket peer always used. README no longer recommends proxy-header trust. Shared-address limiter behavior behind proxies is disclosed. |
| **R4** | **Section-parser closer defect CLOSED; related shared-parser gap OPEN** | Exact prior non-closing-fence case plus 4-backtick and tilde variants exclude the code heading and preserve Human Tasks on replacement. `closeFencePattern` requires marker-only closer, same character and sufficient length. But the question parser still toggles on the suffixed pseudo-closer and offers a code example as an answerable question; see N4. |
| **R5** | **CLOSED** | Node `v22.23.3` stdin CLI regression passes. Independent pseudo-terminal invocation produces a valid verified scrypt hash, exits 0, and does not echo synthetic password. Executed documented `read -rs P`/pipeline environment-file workflow: exit 0, mode `0600`, password absent from command text and output. No literal password in the documented invocation's argv/history text. No assertion about arbitrary secret-manager behavior or user shell tracing settings. `hash-pty.json`. |
| **R6** | **CLOSED** | Capacity-two independent sequence create A/B, access A, create C retains A/C and evicts unused B. Code promotes successful access by Map delete/set, retains absolute/idle expiry and default cap 50. Existing cap test remains meaningful with the legitimately changed LRU expectation. |
| **R7** | **CRLF defect CLOSED; readback-integrity regression OPEN** | Real API write to CRLF issue with two-line LF input returns `200`, one PATCH, canonical text correct, protected Human Tasks suffix byte-preserved. Existing mismatch test still passes. New `.trim()` comparison nevertheless ignores meaningful indentation differences: expected `    indented code`, readback `indented code`, board says success. See N3. |
| **R8** | **PARTIAL / OPEN** | Real HTTP same-origin Link naming `/repos/other/repo/issues` is rejected before second request. Origin-prefix regression passes. But default fetch redirects bypass pathname checks: list returns another repository's item, and same-origin 307 replays PATCH plus bearer token to another repository. Cross-origin 307 strips bearer token in tested Node fetch, but still forwards the body. See N2. |

## Ranked findings

### N1 — Medium — R1 still misreports ambiguous protocol/gateway and malformed 4xx outcomes

**Files:** `web/public/app.js:78-113,509-532,553-567,584-598`; `web/server/github.ts:134-159`; `web/server/app.ts:791-803`.

The browser catch encloses `fetch` and `response.text()` only. JSON parse failure is silently turned into `null`; a successful response returns it and the mutation caller dereferences `response.issue`. Non-OK gateway responses become generic ApiError without distinguishing an untrusted post-send response from a definitive board rejection.

**Real browser + real HTTP gateway, original product bytes:** gateway waits for real board PUT to finish and for fake GitHub to commit, then replaces the response. Results in `browser-http-gateway.json`:

| Replacement | Visible DOM | PATCH count | Committed |
| --- | --- | --- | --- |
| 502 HTML `<h1>Bad Gateway</h1>` | `request_failed.` | 1 | yes |
| 200 `{bad` | `Cannot read properties of null (reading 'issue').` | 1 | yes |
| Truncated 200 | `Browser network error: outcome unknown — refresh to check GitHub state.` | 1 | yes |

Independent browser response replacements also reproduce empty-200 null exception and generic JSON-500 “The board could not complete that request.” All four commit once and lack unknown guidance. Screenshots confirm the messages beside the save control, not merely returned JavaScript strings. These are observations of failed requirements, **not** passing assertions hidden in the 33/33 count.

**Server-side malformed response case:** local proxy commits PATCH, then returns HTTP 422 with HTML `<h1>Gateway lost upstream</h1>`. Board responds `400 invalid_request`, “The issue reference is not valid,” although edit is present and PATCH count is one. `JSON.parse` failure is discarded before `kindForStatus(422)` classifies this as invalid. This does **not** establish that real GitHub validation rejections are ambiguous; it establishes that this malformed intermediary response is not evidence of pre-commit rejection.

**Minimal correction:** mutation protocol errors, malformed/missing success payloads, and untrusted gateway/generic post-send failures must map to unknown. Preserve known structured board refusals only when they actually establish pre-commit rejection; retain separate login/logout handling. Keep upstream parse/provenance information so a malformed 4xx cannot masquerade as definitive validation failure. Do not adopt “all 4xx/5xx prove rejection,” and do not retry.

### N2 — Low, trusted-upstream residual — R8 Link check bypassed by automatic redirects

**Files:** `web/server/github.ts:120-126,226-242,255-286`; README `102-104`.

`fetchImpl` uses default redirect-follow behavior. Only the literal Link URL is checked, not intermediate request targets. Real HTTP proofs:

1. GET configured `/repos/owner/repo/issues?...` responds 302 Location `/repos/other/repo/issues`; second path receives bearer token; list returns issue 2 from other repository (`probes.json`).
2. PATCH configured `/repos/owner/repo/issues/1` responds 307 Location `/repos/other/repo/issues/9`; other path receives **PATCH, bearer token, and body**; client accepts issue number 9 (`redirects.json`).
3. Cross-origin 307 to another local port strips Authorization in Node 22 fetch, but still forwards the PATCH body. No external credential-exfiltration claim from that test.

Browser cannot supply these redirects, and no live GitHub redirect or token scope was tested. Exploitability requires a trusted-upstream/proxy redirect and target access. Therefore Low rather than a new High. Nevertheless violates this review's explicit repository/redirect boundary and the README's unconditional claim.

**Minimal correction:** reject redirects (`redirect: 'error'` or manual handling without following), or validate every hop's origin and allowed resource path **before** dispatch. Checking `response.url` afterward is too late to prevent token/body forwarding. Add real HTTP 302/307 regressions.

### N3 — Low — R7 canonicalization equates meaningful Markdown indentation

**File:** `web/server/app.ts:815-823`.

Independent API probe requests `    indented code`. Fake upstream applies a concurrent/readback change removing four spaces, returning `indented code`. Board returns **200 success**. Four leading spaces change Markdown into an indented code block; `.trim()` erases that distinction in both expected and observed projections. The prior strict comparator would report unknown. This is narrower than the accepted fresh-GET/PATCH overwrite window: it is a mismatch that the readback actually observes but now ignores.

**Minimal correction:** compare the expected `findSections` projection of the exact patched body against readback with line-ending/blank-line normalization consistent with the serializer. Preserve meaningful indentation and trailing content whitespace. Add indentation-only mismatch regression. Keep successful CRLF regression.

### N4 — Low — malformed fence still turns a code example into an actionable question

**Files:** shared `panel/core.ts:397-402,974-995`, called by `web/server/board.ts:171-187,233` and `web/server/app.ts:752-779`.

Section-parser-only R4 repair leaves reused question parsing on a different fence grammar. Concrete body:

````markdown
## Overview
Intro

## Open Questions
```text
example
```not-a-closing-fence
- [ ] This is a code example, not an actionable question?
```

## Human Tasks
- [ ] Keep
````

GET detail exposes the checkbox inside code as `answerIndex: 0`. POST its answer with current fingerprint returns **200**, one PATCH, converts code to `[x] ... *(Answer: yes)*`. `extra.json` records projection and changed body. Not XSS or authentication bypass; pre-existing shared-parser integrity gap uncovered while checking R4 and the owner’s ambiguous-target boundary.

**Minimal correction:** use matching fence state/closer grammar for question discovery and answer targeting, or refuse ambiguous fenced targets in the web layer. Any shared-parser edit needs appropriate scope approval; this reviewer changed nothing.

### N5 — Low — post-collision README and closure claims do not match final code

**Files:** `web/README.md:83-85`; `.agents/run/task-centred-architecture/outputs/issue-33-remediation.md:15-22,30-40`.

README says waiting queue **8**, body deadline **5s**; actual final implementation and builder report use **4** and **2s** (`app.ts:590-594`). No missing code half or bundle divergence found; this is inconsistent documentation. R1/R8 are not CLOSED, F10 cannot mean all evidence gaps closed, and R7 now has a distinct comparator regression. R3 variable remains in a negative regression test by design, despite report saying deleted from test suites. Documentation may summarize bounded behavior but must not overstate tested completeness.

**Minimal correction:** synchronize numeric contracts and adjudicated statuses with actual implementation/proof; avoid “completely unaffected” as an unbounded resource-exhaustion guarantee.

## Preserved design and security checks

- Independent board password remains owner-approved; no browser GitHub identity requirement imposed. Server checks stored token account/repository at startup. Single configured repo is the secure base; #37 multi-repository work remains separate.
- Session cookie remains signed random opaque ID, `HttpOnly; Secure; SameSite=Strict; Path=/`; CSRF token stays in memory. Forged cookie and logged-out replay independently return 401. Missing, wrong, and cross-session CSRF return 403; evil Origin and evil Referer return 403 with configured base URL. Negative tests ran with the helper's automatic CSRF insertion explicitly disabled where required. Existing session expiry/CSRF/cookie regressions pass.
- Synthetic token/password absent from inspected HTML/JS/API/log surfaces; browser cookie unreadable and local/session storage empty. No real credentials inspected. R8 is the upstream path exception, not browser disclosure.
- Browser-injected issue title, question, and label text containing img/svg/script/event-handler strings remain literal text, no executable nodes or `window.__xss`. Screenshot `hostile-text-inert-*` inspected. Rendering still uses textContent/value/native elements; no issue-controlled HTML insertion found.
- Repository query/path overrides return 400; traversal/NUL variants 404; ordinary synthetic requests produce no unknown-repository hits. Static assets are a literal allowlist. CSP, no-store, nosniff and frame protection remain.
- Changed source question before answer returns 409 with `Changed question?`, **zero PATCHes**. Two simultaneous board writes with same fingerprint return 200/409, one PATCH. N4 records the fenced ambiguous-target exception.
- Human status:done request succeeds, leaves issue open, preserves `phase:execution`, `attention:needs-decision`, `bug`; attention and phase are not conflated. No automatic Done or issue-close mutation path found.
- Read every browser mutation dispatcher and server PATCH path. Browser has one fetch wrapper and one dispatch per control; handlers catch but do not replay. Server lock waits before callback, makes one fresh GET/check, one updateIssue, then readback. GitHubClient has one explicit fetch, but **its default HTTP redirect policy can replay a PATCH (N2)**. No application retry/re-apply loop found. Probed ambiguous writes each make one PATCH when no redirect supplied.
- Owner-accepted window reproduced independently: external edit between fresh GET and PATCH is overwritten, board reports 200 on local readback, one PATCH. This remains accepted best-effort risk, not a demand for atomic writes. Warning is readable above editing controls on fresh 1280px and 360px screenshots; README repeats it.

## Reproduced checks and artifact integrity

Node `v22.23.3`, existing root node_modules symlink, no installs. Commands with exit results:

| Command | Actual result |
| --- | --- |
| `node --test web/tests/*.test.mjs` | exit 0; **96/96**, no failed/skipped/cancelled tests; 10,662 ms |
| `npm test` | exit 0; **466/466**, no failed/skipped/cancelled tests; 65,860 ms |
| `npx tsc -p web/tsconfig.json` | exit 0; no diagnostics |
| `npm run build:web` | **exit 1**, `Missing script: "build:web"`; root package.json has no such script |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/issue33-final/server.mjs` | exit 0; fresh disposable bundle, product bundle not overwritten |
| `node --check /tmp/opencode/issue33-final/server.mjs` | exit 0 |
| `sha256sum /tmp/opencode/issue33-final/server.mjs web/dist/server.mjs` | exit 0; both **`c594f2c0b8cce90ca9f331ce63dfd3a1aaa73907b627e3b6dfccbbd9de22b1e6`** |
| `node /tmp/opencode/issue33-final/browser-baseline.mjs` | exit 0; **32/32 checks**, 10 screenshots; see execution note below |
| `OBS_CDP_PORT=9344 node /tmp/opencode/issue33-final/browser-hostile.mjs` | final exit 0; **33/33 checks**, 15 screenshots; protocol failures recorded separately as failing observations, not counted as requirements passed |
| `node /tmp/opencode/issue33-final/browser-http-gateway.mjs` | final exit 0; three real-HTTP browser outcomes above, each exactly one committed PATCH |
| `node /tmp/opencode/issue33-final/probes.mjs` | final exit 0; 30 named result records, including R1/R8 defects, auth boundaries, real-peer login floods, CRLF/LRU/fence tests |
| `node /tmp/opencode/issue33-final/extra.mjs` | exit 0; six result records, including readback indentation and fenced-question defects |
| `node /tmp/opencode/issue33-final/redirects.mjs` | exit 0; same-origin token/PATCH forwarding and cross-origin stripping outcomes recorded |
| `python3 /tmp/opencode/issue33-final/hash-pty.py` | exit 0; prompt no-echo, hash verification, documented shell command and mode 0600 |
| `git diff --exit-code f50519d -- web panel service test package.json` | exit 0; product/test paths unchanged by review |
| `git diff --check` | exit 0 before report/proof staging |

**Browser execution note:** did not execute `node web/tests/browser-verify.mjs` verbatim because its hardcoded output paths write outside this review's owned paths. Executed a disposable copy with only absolute fixture imports, root/artifact path relocation, and additional runtime/server log capture; all original assertions and screenshots unchanged. Committed the exact executed copy. This reproduces the test behavior without touching prior evidence or product tests; do not claim the literal original command ran.

Inspected screenshots directly: baseline desktop detail, narrow detail, narrow board, conflict banner, hostile malformed/gateway messages, and inert hostile text. The warning is visible before controls; narrow labels/wrapping and answered text remain readable. No horizontal overflow in browser assertions. Read captured server logs; baseline 24 lines and hostile 67 lines contain no synthetic credential values. Both final browser runs captured **zero Runtime exception/console events**; that does not make caught bad mutation messages correct. Real HTTP gateway proof also records its logs/events. No installed-browser focus claim is inferred from DOM structure.

## Blind spots — NOT RUN

- Production GitHub token presence, permissions, least-privilege scopes, real API writes, and bot identity/coverage verification. All upstream endpoints in probes are synthetic localhost servers.
- Production TLS, proxy routing/header replacement/buffering, network namespace, restart persistence, external bind suitability, load behavior outside these synthetic probes, real deployment health. Loopback remains as shipped; no BOARD_HOST/deployment fix attempted.
- **Real keyboard Tab traversal and real keyboard-induced focus-visible rendering.** Obscura script focus/native-control structure is not that proof. Existing test explicitly records this as NOT RUN.
- Multi-repository #37, push/notifications, private hosting investigation and reports. No claims of completion in this slice.

## Verification failures and corrected approaches

- **DIDN'T WORK:** `npm run build:web` exited 1, `Missing script: "build:web"`. **FINALLY WORKED:** documented esbuild command built to disposable path, syntax check passed, SHA-256 matches shipped bundle. No package-script edit.
- **DIDN'T WORK:** first independent security harness expected wrong CSRF to fail but got `200 !== 403`; HttpSession had overwritten supplied header with its valid token. **FINALLY WORKED:** set `csrf:false` for wrong/cross-session cases; unchanged negative assertions pass with actual invalid tokens. First failure preserved in `probes-first-harness-error.log`; not a product CSRF bypass.
- **DIDN'T WORK:** added browser navigation left hash/refresh state unsuitable for the inherited stale-board assertion; timeout `stale freshness marker`. **FINALLY WORKED:** full healthy-board navigation before outage, original stale assertion unchanged; 33/33 final. Earlier failure and observations preserved.
- **DIDN'T WORK:** real-HTTP browser probe used Refresh after synthetic DOM-driven open, timed out waiting for cleared save status because browser hash state did not select detail refresh. **FINALLY WORKED:** full detail navigation between cases; all three real-wire outcomes recorded. No product edit or weakened requirement assertion.
- **DIDN'T WORK:** optional screenshot contact-sheet utility failed `ModuleNotFoundError: No module named 'PIL'`. **FINALLY WORKED:** read representative PNG screenshots directly; installed nothing.
- **DIDN'T WORK:** final `git diff --cached --check` exited 2 on nine single-space context lines inside the stored raw diff artifact, not product whitespace. **FINALLY WORKED:** removed that redundant generated proof file; the original report diff remains reproducible from the recorded commit range. Final staged whitespace/scope checks rerun before commit.
- **DIDN'T WORK:** initial report write resolved the workspace-root path outside the selected worktree. **FINALLY WORKED:** moved that newly created report into the owned path in this worktree immediately; no parent product file was changed and no parent report left behind.

No fixes applied. No new High found. Remaining findings go to the caller/owner for adjudication; no autonomous remediation loop.
