# Issue #33 — final independent hostile recheck

Candidate: `5c562e8a2bf7bc96e25fc9b5552c1b2610b673fb`, compared with `a4191a450d2967bd7e04f26bab5f28912b836718`.
Reviewed 2026-10-26 UTC by **Genius (`9router/genius`)**, independent of the builder.
Product commits: `5298f02`, `bb29b3c`, `0bca8fb`; candidate's remaining commit contains builder evidence/report only.

- **Security: APPROVED** for this bounded synthetic-localhost review. Authentication, CSRF, credential secrecy and redirect refusal smoke passed; no new authorization bypass reproduced.
- **Spec Compliance: PASS** for the three residual corrections authorized by owner decision 17 and the preserved boundaries specified in this review.
- **Quality: APPROVED.** The fixes sit at the consumed-detail, upstream-validation and web question-scanner boundaries; existing tests/assertions remain intact. Independent malformed and valid controls passed.
- **Machine verdict: `PROCEED`.** No standing required failure reproduced. This completes the one independent recheck; it does not authorize integration, push, production changes or issue closure. **Human validation remains pending.**

This independent report supersedes the **pending-review state** and independently adjudicates the R1–R3 conclusions in `outputs/issue-33-last-correction.md`. The previous independent `outputs/issue-33-residual-hostile.md` remains an accurate failed review of the previous candidate, not a standing failure of this one. Historical builder/reviewer artifacts were not edited. The active builder report explicitly supersedes prior closure claims, separates builder evidence from pending independent review, records its failed GET compatibility attempt and states operational limits. README changes only its active-report pointer. No unsupported deployment/acceptance claim found.

All paths beginning `outputs/` or `verifications/` are relative to `.agents/run/task-centred-architecture/`. New proof directory: **`verifications/issue-33-last-review/`**, abbreviated `P` below. Product, committed tests, README, prior proofs/reports and ignored bundle were read-only. Only this report and P were created. No fix loop.

## R1–R3 disposition

| Correction | Independent status | Actual discriminator |
| --- | --- | --- |
| **R1: consumed mutation detail** | **CLOSED** | Saved 84-case browser matrix **84/84**, additional source-derived matrix **117/117**. Combined **201/201**, including **177 malformed replies** rejected with UNKNOWN + refresh and exact prior view/both drafts/status selection retained, plus **24 valid controls** accepted. Every record: board-origin 200 after verified write, exactly **1 committed PATCH**, no automatic repeat. Same programs on archived base: **51/84** and **39/117**; **111 failures** become green. |
| **R2: write-validation provenance** | **CLOSED** | Saved matrix F2 **12/12**, additional real HTTP R2 **85/85**, combined **97/97**. Arbitrary errors arrays/objects, exact-message malformed errors, prefix/suffix/case/whitespace variants and transport validation words remain `502 write_outcome_unknown` after one committed PATCH. Exact recognizable GitHub message + correctly shaped errors remain `400 invalid_request` with one dispatched PATCH and no commit. Preserved rejection/precommit controls pass. Base: **9/12** and **43/85**, **45 failures** become green. |
| **R3: mixed-indent code targeting** | **CLOSED** | Saved matrix F3 **24/24**, additional real HTTP R3 **44/44**, combined **68/68**. One/two/three spaces + tab, multiple tabs/mixed suffixes and nested-parent contexts excluded consistently from scanner/list/detail. All **30 direct refusal records** send **0 PATCH** and leave source unchanged. Real two-space nested targets, continuations, duplicates/completed positions, BOM and CRLF mutate exact target only. Base: **18/24** and **20/44**, **30 failures** become green. |

**Ranked standing residuals: none reproduced within the authorized scope.** No minimal product correction is requested. If a required failure had stood, decision 17 would have parked #33 for the mission; this review did not exercise a second correction attempt.

## R1: contract derived from consumers, not copied from predicate

Read the full `a4191a4..5c562e8` source/test/README diff (442 lines, saved as `P/product.diff`), entire `web/public/app.js`, `web/server/{board,github,app,sections}.ts`, helper/fake-GitHub modules, unchanged protocol tests and immediate shared producer functions. Compared actual consumers with `IssueDetail` and `buildIssueDetail()`, not just the builder's checklist.

| Consumed field | Actual consumer | Required narrow contract independently checked |
| --- | --- | --- |
| `issue.number` | Detail badge; section/question/status URLs (`app.js:408-409,598,648,690`) | Positive integer matching mutation URL |
| `issue.fingerprint` | Every next-save request (`:600,650,692`) | Nonempty string |
| `issue.title`, `state` | Heading/state badge (`:402,501`) | String; `open`/`closed` |
| `statusLabel`, `updatedAt` | `statusText().replace`, status select and freshness (`:281-283,403,480,503`) | Explicit null or string, not missing/object |
| `phase`, `attention` | Detail badges (`:404-406`) | Present strings, including empty strings |
| `editableSections[]` | First section text rendered (`:512-518`) and id sent on next save (`:592-600`); producer includes title | Each entry non-array object with string id/title/text |
| `openQuestions[]` | Answered/open rendering, text, input ID and answer closure (`:413-466`) | Non-array objects, text string, completed boolean, positional source index; null answerIndex for completed, sequential integer answerIndex for unresolved |
| `humanTasks[]` | Text/completed rendering (`:483-495`) | Non-array objects with string text and boolean completed |
| Top-level `statusOptions[]` | Assigned at each success, then value/label dereferenced (`:469-480,609,659,701`) | Non-array objects with string value/label; nested fallback is not the handler's consumed field |
| `acceptanceCriteria[]`, `subtasks[]` | Not rendered on this page; existing boundary already requires arrays | Required arrays retained, text/completed entry contract consistent with producer |

Unused `htmlUrl`, body, labels, column, createdAt, testPlan and top-level timestamps are not required by this mutation rendering/next-save contract; an independent valid control removes them and still succeeds. No full-schema or general validation framework requirement was imposed. The validator at `app.js:70-105` is called in `api()` at `:154`, before success assignments at `:608,658,700`; the repeated handler checks do not introduce divergent rules. No invalid-entry filtering or renderer defaults were added as a substitute for rejection.

**Event order:** real browser signs in through form, opens issue, types both overview and answer drafts, selects In Review, clicks one actual section/question/status button. Fake GitHub commits PATCH, board readback verifies and returns valid 200. A real HTTP gateway then replaces only the JSON body. Product JavaScript/browser fetch remain unmodified by the two matrices. With `statusOptions:[null]`, `statusLabel:{}`, `editableSections:[{}]`, incomplete/question-routing/human/option entries or missing consumed metadata, the client now refuses before state/DOM replacement and reports UNKNOWN with refresh guidance. Both exact typed strings, title/badges/question/human content and selection remain equal to their pre-click records. No raw caught exception accepted as success; zero CDP exceptions alone is not used as proof.

Additional matrix contains 32 malformed variants across three saves (96 cases), independent of the saved 81 invalid cases. It challenges array-valued entries, missing section id, object text, null title, non-boolean completion, missing/nonsequential/duplicate question routes, answered-yet-routable/open-yet-null-route questions, absent phase/attention, invalid identity/state/fingerprint types and nested-only options.

**Restrictiveness challenged:** five actual `buildIssueDetail(makeIssue(...))` producer outputs cover empty body/no overview, completed/open/nested questions, populated human/acceptance/subtask lists, closed state, null time/no status, BOM+CRLF and fenced/mixed-indent source. Each runs on all three save paths through the same gateway. Separate controls exercise permitted null/empty strings/arrays and absent unused fields: **21 additional valid cases**, plus original three true unmodified board replies. They all report success, without UNKNOWN or raw rendering error. Producer-output replacement is deliberately a shape-compatibility control, not a claim that the substituted body was the body committed in that request. The three original unmodified controls prove normal committed/readback success.

## R2: conservative recognition through existing error provenance

Source: `github.ts:68-120,193-208,325-349`; dispatched-write catch `app.ts:789-803`. `GitHubError` retains status, parsed flag and data. The method-aware classifier uses the legacy exact-message GET rule only for reads (`github.ts:101-103`). PATCH requires exact `"Validation Failed"`, a nonempty errors array and every entry a non-array object with nonempty string resource/field and a recognized validation code (`:106-116`). No substring or mere errors-array proof remains.

**Event order/payload:** after current fingerprint and one dispatched PATCH, synthetic upstream applies body/labels, then returns 422 with arbitrary errors or transport text. Examples independently measured on every route:

```json
{"message":"Gateway lost upstream","errors":[{"resource":"Issue","field":"body","code":"invalid"}]}
{"message":"Validation Failed while relaying committed response","errors":[{"resource":"Issue","field":"body","code":"invalid"}]}
{"message":"validation failed","errors":[{"resource":"Issue","field":"body","code":"invalid"}]}
{"message":"Validation Failed","errors":[{"resource":"Issue","field":"body","code":"invalid"},null]}
```

All remain UNKNOWN after commit; no retry. Scalar/null/list JSON, HTML and malformed bodies also remain unknown. Exact recognizable validation with each of the six accepted codes refuses definitively without committing, on each route (**18 positive validation controls**). Six rejection controls preserve 401, 403, 404, rate 403/429 and 412 behavior, with one dispatch and unchanged issue; four trusted board precommit controls preserve `400 invalid_edit` with **zero PATCH**. Existing exact-message GET tests pass. New committed provenance test also verifies original data/status/parsed fields, not just outcome counts.

This is conservative recognition of a configured upstream's protocol, **not cryptographic attestation** of a gateway reply. A gateway deliberately forging the full recognizable GitHub validation contract cannot be distinguished here; no stronger origin guarantee was required or claimed. Authentic GitHub/token behavior was not exercised. Best-effort overwrite semantics remain owner-accepted; no atomic-write guarantee asserted.

## R3: shared web indentation boundary and preserved source targeting

Source: `board.ts:38-43,94-96,361-398`; list/detail derive questions from the same scanner at `:272,304`. `/^(?: {4}| {0,3}\t)/` is equivalent to reaching column four for leading Markdown spaces/tabs: four spaces reach it, or the first tab after zero through three spaces does. Subsequent tabs/spaces cannot undo it. Both scanner and direct target guard share the predicate. No source-offset/line-ending rewrite; `panel/core.ts` unchanged.

**Event order:** code-only fixture with blank line and `" \t- [ ] Code?"` (also two/three spaces) projects zero questions, list total zero, direct answer index 0 refuses `400 invalid_edit`, upstream PATCH count zero. Additional fixtures include `" \t\t"`, `"  \t \t"`, `"   \t\t"`, tab/space/tab, four-to-six-space+tab and mixed suffixes, with and without parent list. All refuse unchanged. Direct API indices are unresolved-question indices, not raw source-line addresses; no implicit remapping was used to turn a code failure green.

Four independent real nested controls (`-`, `*`, `+`, `1.`) include BOM, CRLF, completed question, duplicate text, code between real questions and four-space continuation. Answer index 1 changes exactly the nested two-space real question, preserves all other bytes and dispatches one PATCH. Saved matrix preserves normal nested questions/continuations and real targets around code. The unchanged 28 preserved probes add named pseudo-closer, longer-backtick, tilde, duplicates, completed-index shift and changed-source 409 with new question text and zero PATCH.

## Independent command record

Node `v22.23.3`; existing dependency symlink, no install/environment/DB setup. Every command below ran. `P` is the exact proof path defined above; commands used that path, not a different runner. All candidate result assertions pass, including separate assertions over the legacy observational gateway runner.

| Command | Exit | Result |
| --- | --- | --- |
| `node --test web/tests/last-correction.test.mjs web/tests/validation-provenance.test.mjs web/tests/mixed-indent.test.mjs` | 0 | **230/230**; R1 174, R2 47, R3 9; zero fail/skip/cancel |
| Same focused command in `/tmp/opencode/issue33-last-review/old` | **1** | **28/230**, 202 expected old defects: R1 24/174, R2 4/47, R3 0/9 |
| `node --test web/tests/protocol-corrections.test.mjs` | 0 | **12/12**, zero fail/skip/cancel |
| `node --test web/tests/*.test.mjs` | 0 | **338/338**, zero fail/skip/cancel; 13,099.545 ms |
| `npm test` | 0 | **466/466**, zero fail/skip/cancel; 64,450.729 ms; unchanged root baseline |
| `npx tsc -p web/tsconfig.json` | 0 | No diagnostics |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/issue33-last-review/server.mjs` | 0 | 98.5 KB scratch build |
| `node --check /tmp/opencode/issue33-last-review/server.mjs` | 0 | Syntax valid |
| `cmp /tmp/opencode/issue33-last-review/server.mjs web/dist/server.mjs` | 0 | Byte-identical; ignored bundle not written by reviewer |
| `sha256sum /tmp/opencode/issue33-last-review/server.mjs web/dist/server.mjs` | 0 | Both **`bee9a616c4f0ccd1df7cff7f9f4aebc110110deb43b1c30b2e84f6a1b0e8e858`** |
| `git check-ignore web/dist/server.mjs` | 0 | Ignored; no committed bundle claimed |
| `RESULT_PREFIX=candidate node P/browser-matrix.mjs` | 0 | **84/84** |
| `RESULT_PREFIX=additional REVIEW_CDP_PORT=9385 node P/additional-browser.mjs` | 0 | **117/117** |
| `RESULT_PREFIX=candidate node P/residual-http.mjs` | 0 | **36/36** |
| `RESULT_PREFIX=additional node P/additional-http.mjs` | 0 | **129/129** (R2 85, R3 44) |
| `node P/browser-gateway.mjs` | 0 | **19/19** actual JSON records UNKNOWN + refresh, one committed PATCH, independently asserted by audit |
| `node P/browser-baseline.mjs` | 0 | **32/32**, 10 screenshots |
| `RESULT_PREFIX=candidate node P/probes.mjs` | 0 | **28/28** |
| `PRODUCT_ROOT=/tmp/opencode/issue33-last-review/old RESULT_PREFIX=old REVIEW_CDP_PORT=9383 node P/browser-matrix.mjs` | **1** | **51/84**, 33 old failures |
| `PRODUCT_ROOT=/tmp/opencode/issue33-last-review/old RESULT_PREFIX=old node P/residual-http.mjs` | **1** | **27/36**, 9 old failures |
| `PRODUCT_ROOT=/tmp/opencode/issue33-last-review/old RESULT_PREFIX=old-additional REVIEW_CDP_PORT=9385 node P/additional-browser.mjs` | **1** | **39/117**, 78 old failures |
| `PRODUCT_ROOT=/tmp/opencode/issue33-last-review/old RESULT_PREFIX=old-additional node P/additional-http.mjs` | **1** | **63/129**, 66 old failures |
| `node P/audit.mjs` | 0 | Program equality/hashes, counts, all candidate assertions, commit/PATCH/no-retry, draft/DOM equality, logs/events and test totals checked |
| `git diff --quiet a4191a4..5c562e8 -- panel service package.json package-lock.json` | 0 | Forbidden surfaces unchanged |
| `git diff --quiet a4191a4..5c562e8 -- web/tests/protocol-corrections.test.mjs` | 0 | Existing protocol assertions unchanged |
| `git diff --quiet 5c562e8 -- web panel service package.json package-lock.json` | 0 | Reviewer did not change product/tests/dependencies |
| `git diff --quiet a4191a4..5c562e8 -- .agents/run/task-centred-architecture/verifications/issue-33-residual-review .agents/run/task-centred-architecture/outputs/issue-33-residual-hostile.md` | 0 | Previous review artifacts unchanged |

Old runtime: `git archive a4191a4 web panel` extracted into disposable scratch; candidate was not checked out, rolled back or modified. Final focused tests copied unchanged to that extraction. The same independent matrices use `PRODUCT_ROOT` to import/serve old source. All saved independent programs match the immutable previous programs byte-for-byte after **only proof-output path relocation**; baseline is byte-identical. `P/audit.json` records hashes, equality, actual record counts and command exits. Newly added independent proof programs supplement rather than replace the saved assertions. Expected old failures remain nonzero; no waived/loosened/skipped assertions.

## Visual/log and security smoke evidence

Directly inspected screenshots:

- `candidate-section-partialSectionEntry-desktop.png`: UNKNOWN + refresh beside Save overview; both typed drafts, title/badges, status selection and human task retained.
- `candidate-status-wrongStatusLabel-360.png`: clear UNKNOWN banner, wrapped warning, intact badges and both drafts instead of raw `label.replace` error.
- `additional-question-questionDuplicateRoutes-360.png`: bad routing reply refused with visible refresh guidance and both typed values retained.
- `additional-status-validProducer1-desktop.png`: actual producer completed/open/nested question output renders correctly; no overview/human-task sections is legitimate, not refused.
- `task-detail-360-2026-10-26T12-31-53-055Z.png`: baseline answer text and warning wrap at 360px, normal controls retained.
- `old-section-nullOptionEntry-desktop.png`: the same harness against base shows raw null/value exception, cleared answer draft and emptied selection, confirming the discriminator visually.

Total screenshots **138** (candidate matrices 27+27, old matrices 27+27, gateway 20, baseline 10). Current matrix DOM overflow checks pass. Browser runtime console/uncaught exception event count **0** for both candidate matrices, gateway and baseline; old caught UI exceptions are still marked failures despite zero uncaught events.

Inspected actual saved server-log samples plus format/credential audit over all **678 + 942 + 153 + 24 + 73 + 264** current records: method/path/status/duration or issue/field write metadata only, no credential values or exception text. `P/audit.json` records per-program totals. Root tests exercise synthetic failure-path diagnostics; green suite does not mean every diagnostic line is empty.

Preserved smoke: anonymous/forged-cookie/wrong-password refusal, missing CSRF refusal, logout invalidation, HttpOnly/SameSite=Strict/Path cookie flags, unreadable browser cookie, empty local/session storage, synthetic token absent from HTML/JavaScript/issue JSON/browser page. Same-origin GET 302, same-origin PATCH 307 and cross-origin PATCH 307 send **zero destination requests**. Indentation/trailing-content-whitespace readback mismatches remain UNKNOWN; valid indentation/trailing whitespace and exact CRLF/suffix writes succeed. Human-applied status:done leaves issue open and preserves phase:execution, attention:needs-decision and bug. Best-effort overwrite warning remains visible.

## Limits and verification-method notes

- **NOT RUN:** production GitHub credentials/token presence, identity, permission scope, repository coverage or real writes; production TLS/proxy buffering/header rewriting, bind/deployment health, restart persistence; installed extension/host; actual keyboard Tab traversal/computed focus-visible behavior; fresh XSS exploitation or DoS/socket-exhaustion testing. Only synthetic localhost HTTP/browser fixtures used.
- Multi-repository #37, hosting, PWA/notifications, secret reuse, atomic writes and integration are outside this bounded check. No access/change attempted. Human validation remains pending.
- **DIDN'T WORK:** initial parallel source-read included guessed nonexistent `web/server/types.ts` and returned `File not found: web/server/types.ts`. **FINALLY WORKED:** read the actual `IssueDetail`/`OpenQuestionView` declarations in `web/server/board.ts` and the real producer/consumer paths. No product change.
- **DIDN'T WORK:** glob without hidden-directory inclusion did not find the timestamped baseline screenshot under `.agents`. **FINALLY WORKED:** enumerated that owned screenshots directory and directly opened the exact image. No evidence/result mutation.
- Red archived-base commands intentionally exit 1; no current required failure, retry-to-green, assertion weakening or corrective product edit occurred. Staged evidence retains raw test logs, including assertion-diff whitespace; evidence-only whitespace checks disable `blank-at-eol` rather than rewrite those logs.

**Final disposition:** R1, R2 and R3 closed for this bounded independent recheck. Security APPROVED; Spec PASS; Quality APPROVED; `PROCEED` to the caller's human-gated next decision only. No merge, push, deployment or closure authority granted.
