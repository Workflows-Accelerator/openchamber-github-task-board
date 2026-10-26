# Issue #33 — independent residual hostile recheck

Candidate: `d41ff3419b66a4076a2199038260820ff1341cc9`, compared with `f6ee7da8e859991e6ce9f58fe80683b863e8743e`.
Reviewed 2026-10-25 UTC by **Genius (`9router/genius`)**, independent of the builder.
Product, tests, README, prior reports/proofs and ignored bundle were read-only. Only this report and `verifications/issue-33-residual-review/**` were created. No correction loop.

- **Security: APPROVED** for this bounded local review. No authentication/CSRF bypass, browser credential disclosure or redirect repository escape reproduced. The residual failures below concern write-outcome truth and question targeting, not a new authorization bypass.
- **Spec Compliance: PARTIAL.** Literal original reproducers now pass, but required invalid-entry, generic-validation-looking gateway and mixed-tab indentation variants fail.
- **Quality: NEEDS-FIXES.** Invalid data can still replace valid detail, destroy drafts and produce raw exceptions or false success. The new tests do not cover those inputs.
- **Machine verdict: `HALT`.** Owner decision 16 permits one correction and one recheck. This recheck failed; return to owner, do not autonomously correct again.

This report **supersedes the builder remediation conclusions** in `.agents/run/task-centred-architecture/outputs/issue-33-residual-correction.md`, particularly its F1–F3 table and conclusion at lines 22–24 and 137. That report correctly labels its evidence as builder-only and independent review pending. Earlier reports remain immutable audit artifacts; old overclaims already explicitly superseded are not a new blocker. Human validation remains pending. This verdict grants no merge, deployment or issue-closure authority.

## F1–F5 closure matrix

| Item | Independent status | Measured result and old/new discriminator |
| --- | --- | --- |
| **F1** | **OPEN — Medium** | Browser form/button invocation, real board, real HTTP gateway: each PATCH commits and board returns valid 200; gateway then damages the detail. `{"issue":{}}` now produces UNKNOWN + refresh and preserves the view/drafts on all three save paths, where the old tree printed `Cannot read properties of undefined (reading 'length').` Wrong identity, missing fingerprint/title/state, scalar/null replies and non-array fields also now refuse. But invalid array entries and unchecked rendering fields still pass the guard: `statusOptions:[null]` throws raw null/value exception; `issue.statusLabel:{}` throws `label.replace is not a function`; `editableSections:[{}]` erases the overview and reports success. 84 cases: old 15 pass / 69 fail; candidate 51 pass / 33 fail. Every old and new case committed exactly 1 PATCH, no automatic repeat. |
| **F2** | **OPEN — Low** | Upstream commits PATCH, then returns 422. Plain `{"message":"Gateway lost upstream"}` changes from old 400 `invalid_request` to new 502 `write_outcome_unknown`. HTML/malformed/null/scalar/array bodies remain unknown. However `{"message":"Gateway lost upstream","errors":[]}` or `errors:["connection reset"]`, and `{"message":"Gateway validation failed while relaying committed response"}`, still return 400 after one committed PATCH. Real precommit `Validation Failed` + GitHub-shaped `errors[]` remains 400, no commit. |
| **F3** | **OPEN — Low** | Four spaces, a leading tab and six-space nested-list code are now excluded, code-only direct index 0 refuses 400 with 0 PATCH; old tree offered/mutated them. Blank lines, real questions before/after code, two-space real nested questions, continuations and CRLF exact mutation pass. But one/two/three spaces **then a tab** expands to four Markdown indentation columns and bypasses the new regex. Each code-only fixture is counted and offered as a question; direct index 0 returns 200 and mutates code, 1 PATCH. Old and candidate both fail these six projection/refusal records. |
| **F4** | **CLOSED — reporting structure, not product closure** | New builder report explicitly supersedes the old closure claims (line 14), labels its matrix builder proof (18–26), records independent review pending (6, 139), and lists operational blind spots (125–131). README points to it (136). Its broad F1–F3 claims are disproved and superseded by this independent report. No rewriting of historical artifacts required. |
| **F5** | **CLOSED** | `web/server/board.ts:4-6` accurately describes shared normalization/metadata plus a web-only scanner; `web/server/sections.ts:4-6` no longer falsely claims shared question answering. |

## Ranked residual findings and minimum corrections

### R1 / F1 — Medium: outer-array checks still let invalid detail corrupt the page

**Sequence:** sign in through the real form; open issue 1; type both an overview draft and an answer draft, select In Review; click one section/question/status save button. Synthetic GitHub commits exactly one PATCH; the board verifies readback and responds 200 with valid detail. The independent HTTP gateway changes only the response body, never the product JavaScript or browser fetch function.

1. Replace `statusOptions` with `[null]`, leaving all other detail valid. All three save paths assign the reply, start rendering, wipe the answer draft and status options, then display `Cannot read properties of null (reading 'value').` No UNKNOWN, no refresh guidance. The section screenshot shows the raw exception beside Save overview.
2. Replace `issue.statusLabel` with `{}`. All three paths display `label.replace is not a function.` Header badges collapse to only `open`; UNKNOWN absent.
3. Replace `issue.editableSections` with `[{}]`. Section save displays `Saved just now.` and announces `Overview saved.`, but overwrites the overview draft with `''` and clears the answer draft. Question/status paths announce success and similarly replace the view. `[null]` hides/clears the overview; scalar/null/partial question entries erase or mislabel questions, and null human entries erase tasks. Partial status option entries produce a blank option rather than UNKNOWN.
4. Removing `updatedAt` or `statusLabel` also passes, changes the valid view to unknown time/no status and falsely accepts the damaged reply. These support the missing-field gap; the exception and draft-loss cases alone are sufficient blockers.

**Source:** `web/public/app.js:70-86` checks only outer arrays plus a few scalars. It does not validate entries or `statusLabel`/`updatedAt`. The checked reply is assigned at `:590-593`, `:640-643`, `:682-685`. Rendering dereferences `option.value` at `:458`, invokes `label.replace` at `:264`, and writes `overview.text || ''` at `:500`. The repeated guard in each handler has the same shallow predicate, so repetition does not help. Defensive filtering hides damaged entries rather than proving a valid response.

**Minimum correction, not applied:** narrowly validate actual mutation detail fields and array-entry shapes consumed by rendering before any assignment or DOM update. Require object section entries with string id/title/text, valid question entries, human-task entries, nullable-string status label, option objects with string value/label and the remaining required rendering fields. Reject invalid entries as UNKNOWN with refresh guidance, keeping the prior detail and both drafts. Do not silently filter malformed reply entries or rely on renderer defaults. Add real gateway regression cases for these payloads across all three paths; a generic schema framework is unnecessary.

**Proof:** `candidate-browser-matrix.json` contains before/after DOM, exact replacements, board 200 status, commit flag, PATCH count and feedback; matching `old-browser-matrix.json` uses the same harness against archived old sources. Candidate invalid-only cases: 48 correctly unknown/preserved, 33 failures; 3 valid replies succeed. Six failures show raw exception text, 27 accept damaged data without UNKNOWN. These exceptions are caught by the app, so zero uncaught CDP events is not evidence of correct feedback.

### R2 / F2 — Low: an arbitrary errors array or message substring is still treated as definitive rejection

**Sequence:** current fingerprint; click-equivalent HTTP section PUT; upstream applies `patch.body` and then returns 422 with one of:

```json
{"message":"Gateway lost upstream","errors":[]}
{"message":"Gateway lost upstream","errors":["connection reset"]}
{"message":"Gateway validation failed while relaying committed response"}
```

**Observed:** 400 `invalid_request`, message `The issue reference is not valid`, exactly 1 upstream PATCH and committed body. Expected 502 `write_outcome_unknown`. The first two are generic gateway objects, not recognizable GitHub validation. The third contains a substring but is explicitly a gateway transport failure.

**Source:** `web/server/github.ts:87-92` uses `msg.includes('validation failed') || Array.isArray(data?.errors)`. Either weak signal classifies the reply `invalid`; `web/server/app.ts:214-215` maps that to definitive 400, bypassing the unknown branch at `:799-800`.

**Minimum correction, not applied:** use a conservative recognizable GitHub validation shape through the existing `GitHubError` provenance, rather than either generic substring/array. The tested `message:"Validation Failed"` plus GitHub validation errors remains definitive; gateway transport messages, empty/generic errors arrays and mere substring matches remain unknown. Preserve trusted precommit board errors and no-retry handling. Do not infer rejection solely from 422 + valid JSON.

**Proof:** `candidate-residual-http.json` F2: 9/12 pass; old 6/12 pass. The original plain-object reproducer is fixed, the three variants above remain broken. All 11 postcommit cases have exactly 1 committed PATCH. The one recognizable-validation fixture has 1 dispatched PATCH, no commit, definitive 400.

### R3 / F3 — Low: mixed space/tab indentation bypasses the code exclusion

**Fixture, with `<TAB>` denoting a literal tab:**

```text
## Open Questions

 <TAB>- [ ] Code?
```

Variants with two or three spaces before the tab behave identically. Tab expansion reaches indentation column four; this is an indented code block, not an actionable Markdown list item.

**Observed:** list count `{total:1,open:1}`, detail offers `Code?` at `answerIndex:0`. Direct POST `/api/issues/1/questions/0/answer` with current fingerprint returns 200, exactly 1 PATCH, and rewrites the source code to ` <TAB>- [x] Code? *(Answer: must refuse code)*`. The code-only fixture has no real question that could legitimately receive the answer. No ambiguity about retargeting is needed to reproduce the failure.

**Source:** `web/server/board.ts:40` uses `/^(?: {4,}|\t)/`; `:92-94` and `:383-385` repeat the same insufficient test. The general checklist regex at `:41` accepts mixed whitespace.

**Minimum correction, not applied:** measure leading indentation with tab-stop semantics, or conservatively refuse mixed whitespace reaching code indentation in the web scanner and target guard. Preserve exact source offsets and zero-PATCH refusal. Do not edit `panel/core.ts` or rewrite Markdown parsing. Add all three mixed space/tab fixtures.

**Proof:** HTTP matrix F3: candidate 18/24 pass, old 6/24 pass. Three projections and three refusal checks fail in both trees; ordinary four-space/tab/nested code exclusions improve. Exact real nested-question targeting and CRLF byte equality pass. Mixed-fixture direct invalid/out-of-range indices refuse; projected real indices mutate only their real line. The API is unresolved-question-index based, not a raw source-line-address API.

## Preserved boundaries rechecked

`probes.mjs` adapts the original independent probe into the owned directory, changes the indented-code expectation to the approved requirement, and exits nonzero for failures. It reports **28/28 pass** on the candidate:

- Same-origin GET 302, same-origin PATCH 307 and cross-origin PATCH 307: destination request count **0**. Mutation origin receives one PATCH, returns 502 unknown, no retry.
- Indentation-only and trailing-content-whitespace readback mismatches: 502 unknown. Preserved meaningful indentation/trailing spaces: 200. Protected Human Tasks suffix byte-identical; exact CRLF section body preserved.
- Named pseudo-closer, longer-backtick and tilde fixtures exclude code; invalid code/out-of-range targets refuse with zero extra PATCH. Real questions before/after fences, duplicates, completed-index shift and stale-source 409 retain correct targeting. Stale conflict returns new question text and 0 PATCH.
- Anonymous read 401, missing CSRF 403, forged cookie 401, wrong password 401; logout 204 then 401. Cookie has HttpOnly/SameSite=Strict/Path flags; browser cannot read it and local/session storage remain empty.
- Synthetic token absent from served HTML, JavaScript, issue JSON and browser page; overwrite warning visible. Human-applied `status:done` keeps the issue open and preserves `phase:execution`, `attention:needs-decision`, `bug`; attention remains separate from phase.

Owner-accepted best-effort overwrite window remains. No atomic-write requirement imposed or guarantee asserted.

## Independent commands, counts and bundle parity

All commands below actually ran; Node `v22.23.3`, existing dependencies, no install. Paths `P` below expand to `.agents/run/task-centred-architecture/verifications/issue-33-residual-review` for compactness only; shell invocations used the full paths.

| Command | Actual result |
| --- | --- |
| `node --test web/tests/protocol-corrections.test.mjs` | exit 0, 12/12, 0 fail/skip/cancel; 1,904 ms |
| `node --test web/tests/*.test.mjs` | exit 0, 108/108, 0 fail/skip/cancel; 12,675 ms |
| `npm test` | exit 0, 466/466, 0 fail/skip/cancel; 65,033 ms; this tree's 466 baseline, no panel integration merge |
| `npx tsc -p web/tsconfig.json` | exit 0, no diagnostics |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/issue33-residual-review/server.mjs` | exit 0, 98.0 KB |
| `node --check /tmp/opencode/issue33-residual-review/server.mjs` | exit 0 |
| `sha256sum /tmp/opencode/issue33-residual-review/server.mjs web/dist/server.mjs` | both `97ad16115fd88c7956a786100730ad2e31741efb6c6a5af816857ecb03c190cd` |
| `git check-ignore web/dist/server.mjs` | exit 0, ignored; no committed bundle claimed |
| `node P/probes.mjs` | exit 0, 28/28 pass |
| `node P/residual-http.mjs` | **exit 1**, 27/36 pass, 9 fail (3 F2 + 6 F3) |
| `PRODUCT_ROOT=/tmp/opencode/issue33-residual-review/old RESULT_PREFIX=old node P/residual-http.mjs` | **exit 1**, 12/36 pass, 24 fail, expected old defects |
| `node P/browser-matrix.mjs` | **exit 1**, 51/84 pass, 33 fail, every case one committed PATCH |
| `PRODUCT_ROOT=/tmp/opencode/issue33-residual-review/old RESULT_PREFIX=old node P/browser-matrix.mjs` | **exit 1**, 15/84 pass, 69 fail, every case one committed PATCH |
| `node P/browser-gateway.mjs` | exit 0, original 19 cases all UNKNOWN + refresh, every case one committed PATCH; payloads narrower than the independent 84-case matrix |
| `node P/browser-baseline.mjs` | exit 0, 32/32 checks, 10 screenshots |
| `git diff --quiet f6ee7da..d41ff34 -- panel service package.json package-lock.json` | exit 0, unchanged |

Old runtime sources were extracted with `git archive f6ee7da web panel` into disposable `/tmp/opencode/issue33-residual-review/old`; no checkout, worktree mutation or rollback of the candidate. The same independent matrix imports source modules and serves old or candidate JavaScript according to `PRODUCT_ROOT`. `summary.json`, per-case JSON and logs are committed alongside the proof programs. Failing probe requirements remain failures even when an older observational harness exits 0.

## Visual, log and review scope evidence

Read the full six-file product/test/README diff, the current client/server render and write paths, the new report, and builder proof-program deltas against original independent probes. The copied builder baseline is byte-identical to the old independent baseline; no new assertion coverage there. Examined builder JSON/log summaries against their actual programs, not just green totals. Candidate scope is six web files plus new owned report/proofs; no prior review/report/proof path changed.

Inspected actual desktop and 360px screenshots directly, including:

- `candidate-section-emptyIssue-360.png`, `candidate-question-emptyIssue-desktop.png`: UNKNOWN guidance visible, original title/badges/questions and typed drafts remain intact.
- `candidate-section-nullOptionEntry-desktop.png`: raw null/value exception beside Save overview, answer draft lost, status options cleared.
- `candidate-status-wrongStatusLabel-360.png`: red `label.replace is not a function.` banner, missing status/phase/attention badges, no refresh guidance.
- `candidate-question-partialSectionEntry-desktop.png`: overview blank despite typed draft, answer rendered as saved, no UNKNOWN notice.
- `task-detail-360-2026-10-25T23-39-19-672Z.png`: normal narrow layout/warning and answered question wrap without horizontal overflow.

Candidate 84-case matrix captured 27 screenshots; old matrix 27, legacy gateway 20, baseline 10. Browser runtime console/uncaught exception event count **0** for every run. The raw exceptions reported in R1 are caught and printed by product code. Candidate matrix board log: 678 lines; legacy gateway: 153; baseline: 24. Inspected log records have only method/path/status/duration or issue/field write metadata, no credential values or server exception text. A clean console does not negate the observed broken DOM. Root test logs contain synthetic host/workspace failure-path diagnostics, not a claim that every logged message was error-free.

The new F1 unit test exercises four coarse cases and only section draft preservation. It never injects malformed entries. F2 tests only one generic and one recognizable validation body. F3 uses literal four spaces / column-zero tab. Those omissions explain green 12/108/466 totals alongside standing failures; no assertion was removed or weakened in this review.

## Blind spots — NOT RUN

- Production GitHub token presence, identity, scopes, permissions, repository coverage or real writes. All upstreams are synthetic localhost servers.
- Production TLS/proxy buffering or header rewriting, restart persistence, bind/deployment health, installed extension/host.
- Real keyboard Tab traversal and computed `:focus-visible` rendering. Browser baseline checks only native controls, script focus and stylesheet presence and explicitly marks this limitation.
- Fresh browser XSS exploitation or real DoS/socket exhaustion; no such fresh security proof claimed.
- Hosting, #37 multi-repository, PWA/notifications, secret reuse. No expansion attempted.

## Verification-method corrections

- **DIDN'T WORK:** the first inline `git diff` output was presented as a path-grouped rendering, obscuring exact patch lines. **FINALLY WORKED:** wrote the diff to `/tmp/opencode/issue33-residual-review/product.diff` and read all 631 lines directly.
- **DIDN'T WORK:** an initial log-format audit required a nonempty path suffix (`/[^ ]+`) and falsely flagged normal `GET / 200 ...ms` lines. **FINALLY WORKED:** allow the root path (`/[^ ]*`); zero unexpected formats across the four browser logs. No product changes.
- The two independent matrices intentionally exit 1 on standing defects. No retries, product patching or assertion weakening used to turn them green.

**Final disposition:** F1–F3 remain open; F4/F5 reporting/comment corrections accepted within the limits above. Stop and return to owner. Human validation, merge, deployment and closure remain gated.
