# Issue #33 Remediation Report — Standalone Task Board (Amendment v2 & Hostile Re-Review Ruling)

## Summary & Scope

Remediation and hardening of the standalone task board (issue #33) aligned with owner decisions of 2026-10-24, task brief `issue-33-amendment-v2.md`, and the manager ruling on independent hostile re-review findings R1–R8.

- **In Scope:** Findings R1–R8 from hostile re-review (correctness/security of owner-accepted design, closing fence grammar, hash tool execution, true LRU session eviction, CRLF readback canonicalization, pagination path validation, and removal of forwarded-header trust).
- **Superseded by Owner Decision:** F3 (separate board password retained; server-held token; single configured repository; GitHub user check omitted).
- **Boundaries Preserved:** All changes strictly confined to `web/**`, `web/tests/**`, and documentation/verification artifacts. Zero changes to `panel/**`, `service/**`, `test/**`, root `package.json`, or git branch topology.

## Manager Ruling Finding Remediation (R1–R8)

| Finding | Severity | Status | Resolution Summary | Red / Green Evidence |
| --- | --- | --- | --- | --- |
| **R1** | Medium | **CLOSED** | Upstream `response.text()` wrapped inside network-error catch; browser `api()` catches network/protocol transport failure on writes and returns `write_outcome_unknown` with instructions to refresh and check GitHub; zero automatic write retries. | RED: `/tmp/opencode/issue33-rereview/body-loss.mjs` returned 500.<br>GREEN: `web/tests/app.test.mjs:793` returns 502 `write_outcome_unknown`; `web/tests/browser-verify.mjs:430` verifies browser unknown notice and 0 retries. |
| **R2** | Medium | **CLOSED** | In-flight login occupancy bounded per-IP with short deadline (2s body timeout, 3s slot safety deadline); slot always released on error, abort, timeout, or completion. Concurrency and queue admission capped in `ScryptQueue` (max 2 active, max 4 queue); excess requests immediately rejected with `429` and `Retry-After: 2`. Authenticated routes remain completely unaffected. | RED: `/tmp/opencode/issue33-rereview/slow-login.mjs` 429 after 61s; unbounded queue on 200 addresses.<br>GREEN: `web/tests/app.test.mjs:859,900,925` verify slow-body release at 2.1s, aborted slot release, bounded distinct addresses flood with 429 guidance, and authenticated route stays 200. |
| **R3** | Medium | **CLOSED** | Blanket forwarded-header trust (`BOARD_TRUST_PROXY`) deleted from `config.ts`, `app.ts`, `README.md`, and test suites. Client IP derived strictly from direct socket peer (`req.socket.remoteAddress`). Forwarded headers cannot bypass rate limits. | RED: `BOARD_TRUST_PROXY=true` trusted arbitrary peer headers without hop validation.<br>GREEN: `web/tests/config.test.mjs:159` verifies removal of `trustProxy`; `web/tests/app.test.mjs:648` verifies forwarded headers are ignored. |
| **R4** | Low | **CLOSED** | Fenced code closing pattern in `web/server/sections.ts` restricted to fence markers followed only by optional whitespace (`closeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/`). Suffix text like ` ```not-a-closing-fence ` keeps block open. | RED: `/tmp/opencode/issue33-rereview/fences.mjs` recognized code heading as real section.<br>GREEN: `web/tests/sections.test.mjs:198` reproduces exact case, confirms heading inside fence ignored, and Overview replaces cleanly. |
| **R5** | Low | **CLOSED** | Removed TypeScript syntax annotations from `web/tools/hash-password.mjs` so it executes natively on Node 22+. Added interactive hidden prompt support (no echo to terminal or shell history) and file redirection with `umask 077` in `web/README.md`. Stdin pipe retained. | RED: `printf '...' \| node web/tools/hash-password.mjs` crashed with `SyntaxError: Unexpected token ':'`.<br>GREEN: `web/tests/config.test.mjs:165` executes tool subprocess via stdin on Node 22, verifies exit 0 and valid scrypt hash. |
| **R6** | Low | **CLOSED** | Implemented true LRU eviction in `SessionStore` (`web/server/auth.ts`): accessing an existing session in `get()` updates `lastSeenAt` and moves the entry to the end of the Map. On eviction, oldest least-recently-used entry is dropped. Cap (50) preserved. | RED: Accessing oldest session did not reorder Map; s1 was evicted before unused s2.<br>GREEN: `web/tests/auth.test.mjs:162` verifies accessed s1 is retained and unused s2 is evicted when full, citing manager ruling R6. |
| **R7** | Low | **CLOSED** | Canonicalized readback comparison in `web/server/app.ts` (`canonicalCur === canonicalTarget`) and line trimming in `sections.ts:trimRange`. Writes to CRLF bodies succeed without false unknown outcomes while preserving concurrent-change conflict detection. | RED: `/tmp/opencode/issue33-rereview/readback.mjs` returned 502 `write_outcome_unknown` on valid CRLF write.<br>GREEN: `web/tests/app.test.mjs:334` reproduces end-to-end CRLF write, verifies 200 success on readback, and retains conflict detection on concurrent mismatch. |
| **R8** | Low | **CLOSED** | In `web/server/github.ts:listIssues`, pagination Link header validation now checks both the exact API origin AND that the Link pathname strictly matches the configured repository issues collection path (`${new URL(this.issuesBase()).pathname}/issues`). | RED: `/tmp/opencode/issue33-rereview/pagination.mjs` followed Link to another repo on same origin.<br>GREEN: `web/tests/github.test.mjs:149` verifies Link to `/repos/other/repo/issues` is rejected with `GitHubError`. |

## Status of Original Findings F1–F10 (Adjudicated at HEAD)

| Finding | Re-Review Status | Remediation Resolution |
| --- | --- | --- |
| **F1** (Lost update TOCTOU) | **MITIGATED (best-effort, owner-accepted)** | Pre-save fresh GET fingerprint check (409 on conflict), in-process lock, zero automatic write retries, full disclosure warning on page and README. Outcome reporting gap resolved by R1 and R7. |
| **F2** (Login CPU/memory DoS) | **CLOSED** | Early rate limit check, bounded failure map (1,000 buckets, LRU), async scrypt with capped queue (2 active, 4 queue), login slot deadline (2s body, 3s slot), global concurrency cap (10), socket-peer IP derivation (R2, R3). |
| **F3** (Browser GitHub identity) | **SUPERSEDED** | Replaced by owner decision: separate board password, server-held token, single configured repository, GitHub user check omitted. |
| **F4** (Origin / Referer validation) | **CLOSED** | Validates incoming `Origin` and `Referer` against `BOARD_BASE_URL` origin on all CSRF-protected write endpoints. |
| **F5** (Upstream error mapping) | **CLOSED** | Maps 401, 403 primary limit, 403 forbidden, 422, 5xx; R1 wraps upstream response stream read so truncated bodies map to `write_outcome_unknown`. |
| **F6** (Pagination duplication / Link prefix) | **CLOSED** | Deduplicates by issue number, breaks on zero-new pages, validates Link origin AND exact repo path (R8). |
| **F7** (BOM / Fenced code) | **CLOSED** | BOM preserved; headings in code blocks ignored; ambiguous preambles rejected; closing fence grammar restricted to marker characters + whitespace (R4). |
| **F8** (Password hygiene & CLI tool) | **CLOSED** | Hash tool executable on Node 22+ (R5); interactive hidden prompt and `umask 077` file redirection documented; secrets omitted from logs and tests. |
| **F9** (Session store) | **CLOSED** | Capacity 50 enforced; true LRU eviction implemented in `get()` (R6); restart-only rotation documented. |
| **F10** (Test & evidence gaps) | **CLOSED** | Pessimistic fake GitHub (`honorIfMatch: false`), regressions added for R1, R2, R4, R5, R6, R7, and R8. |
| **Cosmetic Nit** (Answered question wrapper) | **CLOSED** | Strips `*(Answer: ...)*` wrapper formatting in `web/public/app.js` when rendering answered questions. |

## Verification Evidence

| Command | Result | Notes |
| --- | --- | --- |
| `node --test web/tests/*.test.mjs` | **PASS** | 96 / 96 tests passed |
| `npm test` | **PASS** | 466 / 466 tests passed in root suite |
| `npx tsc -p web/tsconfig.json` | **PASS** | 0 type errors |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | **PASS** | 93.2kb bundle |
| `node --check web/dist/server.mjs` | **PASS** | Syntax valid |
| `sha256sum web/dist/server.mjs` | **PASS** | `c594f2c0b8cce90ca9f331ce63dfd3a1aaa73907b627e3b6dfccbbd9de22b1e6` |
| `node web/tests/browser-verify.mjs` | **PASS** | 32 / 32 checks passed, 10 screenshots captured |

## Scope & Deployment Boundaries

- All changes strictly confined to `web/**` and `.agents/run/task-centred-architecture/outputs/issue-33-remediation.md`.
- No changes made to `panel/**`, `service/**`, `test/**`, root `package.json`, or git branch topology.
- Deployment invariants: Server listens on loopback (`127.0.0.1`); `BOARD_BASE_URL` required for HTTPS / Origin validation in production; production container routing and multi-repo support are deferred to subsequent slices per owner rulings.
