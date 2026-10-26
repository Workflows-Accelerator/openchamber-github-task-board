# Issue #33 — final bounded R1–R3 correction, builder evidence

Date: 2026-10-26 UTC. Provider/model: `9router/genius` (Genius).
Base: `a4191a450d2967bd7e04f26bab5f28912b836718`; product before this work: `d41ff34`.
Branch: `feat/issue-33-standalone-board`.
Status: builder correction and local verification complete; the one independent hostile recheck authorized by owner decision 17 is **pending**. This is not an independent verdict or acceptance of #33.

This active report supersedes the F1–F3 remediation/closure conclusions in `outputs/issue-33-residual-correction.md`, especially its matrix and conclusion. The independent `outputs/issue-33-residual-hostile.md` demonstrated those claims were too broad. That report, previous reports and previous proof directories remain immutable audit history. This report supplies new builder evidence against the three residual mechanisms; it does not rewrite or dismiss the failed independent review. No merge, push, deployment, secret reuse or issue closure is authorized or performed.

Paths beginning `outputs/` or `verifications/` below are relative to `.agents/run/task-centred-architecture/`. All new evidence lives in `verifications/issue-33-last-correction/` (called `P` below).

## Changes and consumed-field checklist

### R1 — validate the consumed detail contract before assignment

Commit `5298f02`: `web/public/app.js` and `web/tests/last-correction.test.mjs`.

Read all client detail/save paths and compared them with `IssueDetail`, `buildIssueDetail()`, `statusOptions()` and the mutation response in `web/server/app.ts`. The owning boundary is `api()`'s existing `isValidMutationPayload()` check, before any of the three handlers assigns detail/options or renders. The patch strengthens that predicate; no renderer fallback/filter was added and no generic schema framework/dependency was introduced.

| Field | Actual consumer / producer contract | Check |
| --- | --- | --- |
| `issue.number` | Detail identity/badge and all next-save URL paths | Positive integer matching mutation URL |
| `issue.fingerprint` | All next-save request bodies | Required nonempty string |
| `issue.title`, `issue.state` | Detail heading and state badge | String title; `open` or `closed` state |
| `issue.statusLabel` | `statusText().replace`, status selection/badge | Explicit null or string; absent/object refused |
| `issue.updatedAt` | `relative()` in detail freshness | Explicit null or string; absent/object refused |
| `issue.phase`, `issue.attention` | Detail metadata badges | Required strings, including empty strings |
| `issue.editableSections[]` | `renderDetail()` reads first `.text`; next overview save reads first `.id`; producer entries include title | Non-array objects with string `id`, `title`, `text`; every entry checked |
| `issue.openQuestions[]` | Question text, answered/open presentation, input IDs, answer handler target; producer numbers source positions and unresolved indices | Non-array objects, string text, boolean completed, source `index` equals array position; completed means explicit null `answerIndex`, unresolved indices run from zero without gaps |
| `issue.humanTasks[]` | Human-task text/completed rendering | Non-array objects with string text and boolean completed |
| `issue.acceptanceCriteria[]`, `issue.subtasks[]` | Existing guard requires arrays; these are not currently rendered | Preserve required arrays and validate each text/completed entry; remove nonexistent `subtests` fallback |
| Top-level `statusOptions[]` | Assigned into state, then every option's value/label dereferenced | Required array of non-array objects with string value/label; remove nested fallback that handlers did not consume |

`htmlUrl`, body, labels, column, createdAt, testPlan, savedAt and fetchedAt are not consumed by this mutation-detail rendering/next-save path. This is deliberately not a full schema for unused fields. Empty arrays/strings and legitimate nullable status/time remain accepted. Invalid entries are not silently filtered. Existing last detail, options, question/human DOM and both typed drafts remain untouched; only UNKNOWN feedback and refresh guidance change.

Regressions: 56 invalid variants plus two legitimate controls, across section/question/status saves, 174 cases. Before fix: 24 pass, 150 fail (exit 1, `r1-red.log`). After fix: 174/174 pass; combined with unchanged protocol suite: 186/186 (exit 0, `r1-green.log`). Final focused tests re-run against archived base still fail the same 150 R1 cases. Real HTTP gateway matrix supplies committed-write/browser evidence rather than relying only on the VM network-boundary mock.

### R2 — preserve provenance and classify mutation validation conservatively

Commit `bb29b3c`: `web/server/github.ts` and `web/tests/validation-provenance.test.mjs`.

PATCH validation is definitive only for exact `message: "Validation Failed"`, a nonempty errors array and every error a non-array object containing nonempty string resource/field plus a recognized GitHub validation code (`missing`, `missing_field`, `invalid`, `already_exists`, `unprocessable`, `custom`). Arbitrary errors arrays, partial/mixed entries, transport codes, message alone and substring matches stay `server`; the existing dispatched-write catch returns `502 write_outcome_unknown` without retry. `GitHubError` retains status, parsed flag and original data. A gateway response matching this recognizable contract is not a cryptographic attestation; no stronger origin guarantee is claimed.

Request method is supplied to the classifier: GET keeps the existing exact, case-insensitive validation-message mapping, without using that read-only compatibility rule to infer PATCH rejection. Auth, rate-limit, not-found, 412 conflict, redirect refusal and trusted board precommit errors are unchanged.

Fifteen validation/proxy shapes run through all three real HTTP mutation routes, asserting exactly one dispatched PATCH and actual commit/no-commit; provenance and GET-compatibility tests bring final R2 total to 47. Initial red: 3/46 pass, 43 fail (exit 1, `r2-red.log`). Initial green with protocol: 58/58 (exit 0, `r2-green.log`). Full web gate then exposed two read-only mapping regressions, not dismissed or weakened. A new exact-GET compatibility test failed (46/47, exit 1, `r2-read-red.log`); method-aware classification restored the behavior. Final R2: 47/47. Final tests against base: 4/47 pass, 43 fail.

### R3 — tab-stop-equivalent code exclusion at shared web scanner/target guard

Commit `0bca8fb`: `web/server/board.ts` and `web/tests/mixed-indent.test.mjs`.

The existing shared web indentation predicate is now `/^(?: {4}| {0,3}\t)/`. Four spaces already reach code indentation; a tab following zero, one, two or three spaces advances to column four. Both scanner and direct target guard use this same predicate; list/detail counts derive from the scanner. This changes no source offsets or line endings and does not touch `panel/core.ts` or rewrite Markdown parsing.

Nine new cases cover all three space+tab prefixes: projection exclusion, code-only direct refusal, and exact nested-real-question targeting around code/completed questions with CRLF and continuations. Before: 0/9 (exit 1, `r3-red.log`). After with protocol: 21/21 (exit 0, `r3-green.log`); final focused R3: 9/9. Final tests against base: 0/9. Mixed-code direct requests now refuse with zero PATCH, not by implicit remapping onto another question.

## Verification record

Node `v22.23.3`, existing dependency symlink, no installs or environment/DB setup. Localhost synthetic GitHub only. Existing assertions/tests were neither removed nor loosened. The root 466-test baseline is unchanged; no newer panel integration tree was merged.

| Exact command / working directory | Exit | Observed result / log in P |
| --- | --- | --- |
| `node --test web/tests/last-correction.test.mjs web/tests/validation-provenance.test.mjs web/tests/mixed-indent.test.mjs` | 0 | 230/230, no skip/cancel; `focused-green.log` |
| Same focused command in `/tmp/opencode/issue33-last-correction/before` | 1 | Final tests against archived base: 28/230 pass, 202 fail; `final-tests-on-before.log` |
| `node --test web/tests/protocol-corrections.test.mjs` | 0 | Unchanged 12/12; `protocol-tests.log` |
| `node --test web/tests/*.test.mjs` (initial full gate) | 1 | 335/337; two GET validation compatibility failures; `web-tests.log` |
| `node --test web/tests/*.test.mjs` (final) | 0 | 338/338, zero skip/cancel; `web-tests-green.log` |
| `npm test` (initial and final product) | 0, 0 | 466/466 both runs; `root-tests.log`, `final-root-tests.log` |
| `npx tsc -p web/tsconfig.json` (initial and final product) | 0, 0 | No diagnostics; `types.log`, `final-types.log` |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | 0 | Built ignored bundle; `build.log` |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/issue33-last-correction/server.mjs` | 0 | Independent output path; `parity-build.log` |
| `node --check web/dist/server.mjs` | 0 | Bundle syntax valid |
| `cmp web/dist/server.mjs /tmp/opencode/issue33-last-correction/server.mjs` | 0 | Byte-identical bundles |
| `sha256sum web/dist/server.mjs /tmp/opencode/issue33-last-correction/server.mjs` | 0 | Both `bee9a616c4f0ccd1df7cff7f9f4aebc110110deb43b1c30b2e84f6a1b0e8e858`; `bundle-hashes.log` |
| `git check-ignore web/dist/server.mjs` | 0 | Ignored, no committed bundle claimed |
| `RESULT_PREFIX=builder node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/browser-matrix.mjs` | 0 | Initial corrected tree: 84/84; `browser-matrix.log`, `builder-browser-matrix.json` |
| `RESULT_PREFIX=builder node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/residual-http.mjs` | 0 | Initial corrected tree: 36/36; `residual-http.log`, `builder-residual-http.json` |
| `RESULT_PREFIX=final node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/browser-matrix.mjs` | 0 | Final product: 84/84; `final-browser-matrix.log`, `final-browser-matrix.json` |
| `RESULT_PREFIX=final node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/residual-http.mjs` | 0 | Final product: 36/36; `final-residual-http.log`, `final-residual-http.json` |
| `node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/browser-gateway.mjs` | 0 | 19/19 records committed once and UNKNOWN+refresh; `browser-gateway.log`, `browser-gateway.json` |
| `node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/browser-baseline.mjs` | 0 | 32/32 checks, 10 screenshots; `browser-baseline.log`, `browser-verification.json` |
| `RESULT_PREFIX=final node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/probes.mjs` | 0 | 28/28 preserved probes; `probes.log`, `final-probes.json` |
| `node .agents/run/task-centred-architecture/verifications/issue-33-last-correction/audit.mjs` | 0 | Saved program/assertion equality, actual 84/36/19/32/28 records, PATCH counts, logs/events; `audit.log`, `audit.json` |
| `git diff --quiet a4191a4 -- panel service package.json package-lock.json` | 0 | Forbidden product/dependency surfaces unchanged |

Final tests were copied unchanged into a disposable `git archive a4191a4 web panel` extraction, not checked out over the candidate. Every intended new defect class has a before/after discriminator. Intermediate failures are retained, not overwritten.

The saved independent browser/HTTP programs were rerun as builder checks. Copies differ **only** by output-directory relocation from `issue-33-residual-review` to `issue-33-last-correction`; the baseline is byte-identical. Assertions, payloads, index meanings and ports are unchanged. `summary.json` records original/adapted program hashes, exact equality check, result counts and command exits. Running an independent program does not make this implementing agent an independent reviewer.

Final browser matrix: 81 invalid cases all UNKNOWN+refresh with prior title, badges, question/human content, both typed drafts and status selection preserved; three valid controls succeed. All 84 have board-origin 200, exactly one committed PATCH, no retry. Final HTTP matrix: 12 validation cases and 24 indentation/projection/refusal/real-target records pass; all 10 refusal records send zero PATCH. Gateway's older harness is observational, so its exit alone is insufficient: separately asserted all 19 JSON records contain UNKNOWN+refresh, one PATCH and committed=true. Final browser matrix, gateway and baseline have zero recorded runtime console/exception events; this does not substitute for the DOM/feedback assertions.

## Visual/log inspection and scope

Inspected screenshots directly: `screenshots/builder-section-partialSectionEntry-desktop.png`, `screenshots/final-question-nullOptionEntry-desktop.png`, `screenshots/final-status-wrongStatusLabel-360.png`, `screenshots/final-section-partialSectionEntry-360.png`. They show refresh guidance, intact heading/badges, retained overview/answer drafts and wrapped 360px layout instead of raw exceptions or a blank overview. Final matrix DOM records also measure overflow. Programmatic audit inspected 678 final matrix, 153 gateway and 24 baseline board log entries: method/path/status/duration or issue/field write metadata only, no token/cookie values or exception text. HTTP matrix has 73 board log lines. Root tests exercise failure-path diagnostics; a green suite is not a claim that all diagnostic logs are empty.

Read final product/test diff in full; changes are limited to the three owning web files, three new focused test files, README's active report path, this report and P. Existing `web/tests/protocol-corrections.test.mjs` is unchanged. No renderer patch, unrelated reformat, debug code, dependency change, prior report/proof edit or panel/service change. Product commits contain only their fix and regression tests; evidence/report are separate.

## Failures retained and limits

- **DIDN'T WORK:** initial broad validation change also altered GET's legacy validation mapping. Full web gate failed two assertions (`expected 400, actual 502`; `expected 'invalid', actual 'server'`). **FINALLY WORKED:** red-tested method distinction; kept exact-message compatibility for GET, strict shaped validation for PATCH. No existing test or matcher changed; full gate 338/338. This remains within the single builder correction, before independent recheck.
- **DIDN'T WORK:** staged `git diff --cached --check` flagged trailing spaces in raw Node assertion-diff logs. **FINALLY WORKED:** retained logs byte-for-byte; checked product/report changes separately and staged evidence with only `blank-at-eol` disabled. No source formatting or failing evidence was rewritten.
- The red runs and archived-base run intentionally fail because old mechanisms violate new assertions. Their nonzero results are evidence, not waived checks.
- **NOT RUN:** independent hostile recheck, human acceptance, real GitHub/token identity/scopes/repository permissions/writes, production TLS/proxy/deployment/restart/bind health, installed extension/host, real keyboard Tab traversal/computed focus-visible behavior, fresh XSS/DoS testing, multi-repository/PWA/notifications. No production or external GitHub access, deployment or secret reuse attempted.
- Best-effort overwrite window remains owner-accepted and disclosed; neither atomic writes nor a fail-closed concurrency guarantee is asserted.

Next boundary: stop for the one independent hostile recheck. If it fails, owner decision 17 parks #33 for this mission; no autonomous second correction or integration.
