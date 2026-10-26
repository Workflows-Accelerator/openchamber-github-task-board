# Issue #33 — Residual Defect Remediation Report (F1–F5)

**Date:** 2026-10-25 UTC  
**Branch:** `feat/issue-33-standalone-board`  
**Base Commit:** `f6ee7da8e859991e6ce9f58fe80683b863e8743e`  
**Status:** **BUILDER REMEDIATION COMPLETE — AWAITING INDEPENDENT RECHECK**

---

## 1. Executive Summary and Adjudication Scope

This report documents the surgical remediation and builder verification of residual defects **F1–F5** identified during the independent hostile review (`.agents/run/task-centred-architecture/outputs/issue-33-final-protocol-hostile.md`).

**Supersession Notice:** This report supersedes the premature closure claims made in `.agents/run/task-centred-architecture/outputs/issue-33-final-protocol-correction.md` (lines 12, 20–24, 242). Prior reports and prior verification directories remain immutable audit history.

In accordance with owner binding decision 16 (2026-10-25), this work is strictly bounded to the five residual findings in the web layer. No changes were made to `panel/**`, `service/**`, root configuration, or dependencies. No production GitHub writes were made, no branches merged, and no tokens disclosed.

### Builder Status Matrix of Residual Findings F1–F5

| Item | Severity | Root Layer | Builder Status | Empirical Verification Summary |
| --- | --- | --- | --- | --- |
| **F1** | Medium | `web/public/app.js` | **REMEDIATED (Builder Proof)** | `isValidMutationPayload()` validates required fields and arrays before applying mutation responses; nominal 200 with `{}` or invalid shape throws `write_outcome_unknown`, shows "Outcome unknown — refresh to check GitHub state", preserves existing `state.detail` and user drafts without raw `TypeError`. Tested across all 19 gateway cases. |
| **F2** | Low | `web/server/github.ts` | **REMEDIATED (Builder Proof)** | `kindForStatus(422)` requires recognizable GitHub validation shape (`Validation Failed` message or `errors` array) to classify as `'invalid'`. Generic JSON 422 after a dispatched PATCH maps to `'server'`, yielding `502 write_outcome_unknown`. Valid GitHub validation rejections remain `400 invalid_request`. |
| **F3** | Low | `web/server/board.ts` | **REMEDIATED (Builder Proof)** | Web scanner excludes lines indented by 4+ spaces or tabs (`/^(?: {4,}|\t)/`) from question list counts, detail projections, and mutation targeting. Direct answer mutation targeting code indices returns `400 invalid_edit` with 0 PATCH calls. `panel/core.ts` untouched. |
| **F4** | Low | Active Documentation | **REMEDIATED (Builder Proof)** | Corrected active report claims: this report does not claim "completely remediated" as an accepted conclusion, distinguishes builder proof from independent verdict pending, and lists remaining operational blind spots. |
| **F5** | Nit | Source Header Comments | **REMEDIATED (Builder Proof)** | Updated headers in `web/server/board.ts` and `web/server/sections.ts` to accurately reflect that open-question parsing and mutation occur in the web layer to enforce fence and indentation safety. |

---

## 2. Technical Remediation Details

### F1 (Medium): Nominal 200 with Invalid Detail Shape

- **Problem:** When an upstream proxy or faulty gateway returned `200 {"issue":{}}` after a committed mutation, `api()` treated truthy `payload.issue` as valid. The save handlers assigned `{}` to `state.detail` and called `renderDetail()`, which dereferenced `issue.editableSections.length`, throwing an uncaught `TypeError`. The generic catch block displayed the raw exception string without refresh guidance, corrupted the header view (`#undefined`, `no status`), and overwrote typed user drafts.
- **Remediation:**
  1. Implemented `isValidMutationPayload(payload, expectedNumber)` in `web/public/app.js`: verifies that `payload.issue` has positive integer `number` matching the URL, non-empty `fingerprint` string, `title` string, `state` string, and arrays for `editableSections`, `openQuestions`, `humanTasks`, `acceptanceCriteria`, `subtasks`/`subtests`, and `statusOptions`.
  2. In `api()`, if a mutation returns `response.ok` but fails `isValidMutationPayload`, it throws `ApiError('write_outcome_unknown', response.status, { message: 'Outcome unknown — refresh to check GitHub state' })`.
  3. In `saveOverview`, `saveAnswer`, and `saveStatus`, guarded assignment ensures `state.detail` is never updated if validation fails. User drafts in `#overview-text` are preserved.
  4. In `renderDetail`, added defensive array checks and string conversions so any partial or legacy structures cannot cause unhandled exceptions.
- **Empirical Evidence:**
  - `web/tests/protocol-corrections.test.mjs`: Test `F1 (client)` passes all 4 test cases (rejects `{issue:{}}`, missing arrays, wrong issue number, and verifies draft/detail preservation).
  - Real Obscura browser gateway probe (`browser-gateway.mjs`): 19/19 cases display `"Outcome unknown — refresh to check GitHub state."` with zero raw `TypeError` occurrences. Verified draft in `#overview-text` and `#1 Protocol gateway probe` title preserved in screenshot `section.invalidShape-after.png`.

### F2 (Low): Post-Commit Generic JSON 422 Classification

- **Problem:** `web/server/github.ts:kindForStatus` mapped every JSON 422 to `'invalid'`, which `app.ts` translated into `400 invalid_request`. When an upstream or proxy returned generic JSON 422 (e.g. `{"message":"Gateway lost upstream"}`) after applying a PATCH, the board misleadingly reported that the request was an invalid issue reference rather than an ambiguous write outcome.
- **Remediation:**
  1. Updated `kindForStatus(status, headers, data, jsonParsed)` in `web/server/github.ts`:
     ```ts
     if (status === 422) {
       const msg = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
       if (msg.includes('validation failed') || Array.isArray(data?.errors)) {
         return 'invalid';
       }
       return 'server';
     }
     ```
  2. Generic JSON 422 now returns `'server'`, which `app.ts` maps to `502 write_outcome_unknown`. Recognisable GitHub validation errors (`message: "Validation Failed"` or `errors` array) continue mapping to `400 invalid_request`.
- **Empirical Evidence:**
  - `web/tests/protocol-corrections.test.mjs`: Test `F2` passes both generic 422 -> 502 unknown and GitHub validation 422 -> 400 invalid.
  - Probe `N1.srv.json422` in `probes.mjs` flipped from FAIL (in hostile check) to PASS (status 502, error `write_outcome_unknown`).

### F3 (Low): 4-Space Indented Code Checkbox Parsing & Mutation Refusal

- **Problem:** `parseWebOpenQuestions` in `web/server/board.ts` tracked backtick/tilde fences but did not exclude 4-space or tab-indented Markdown code blocks. Checkboxes indented by 4 spaces (e.g. `    - [ ] Code?`) were projected as actionable questions. Answering index 0 mutated the code block instead of actual questions.
- **Remediation:**
  1. Added `indentedCodeLinePattern = /^(?: {4,}|\t)/` in `web/server/board.ts`.
  2. In `parseWebOpenQuestions()`, any line matching `indentedCodeLinePattern` is skipped.
  3. In `applyQuestionAnswer()`, any target line matching `indentedCodeLinePattern` throws `BoardError('invalid', 'That open question is no longer answerable')`, which HTTP maps to `400 invalid_edit` with 0 PATCH calls.
  4. `panel/core.ts` remains completely untouched.
- **Empirical Evidence:**
  - `web/tests/protocol-corrections.test.mjs`: Tests `F3` verify list count excludes indented code (1 instead of 2), detail projects only real questions, answering index 0 mutates the real question while preserving code untouched, and direct targeting of code index returns 400 with 0 extra PATCH calls. Only-code fixture exposes 0 questions and refuses index 0 with 0 PATCH calls.
  - Probes in `probes.mjs`: `N4.projection.indentedCode`, `F3.indentedCodeProtection`, and `F3.onlyIndentedCodeRefusal` all PASS.

### F4 & F5: Reporting Truthfulness and Comment Synchronization

- Stale comments in `web/server/board.ts:4-5` and `web/server/sections.ts:6` asserting that open-question parsing reuses `panel/core.ts` were corrected.
- `web/README.md` active report pointer was updated to point to this report (`issue-33-residual-correction.md`).
- This report avoids unverified claims of "complete remediation" and clearly identifies builder verification boundaries.

---

## 3. Empirical Verification Record

All tests executed with Node `v22.23.3` against synthetic localhost environments.

| Check / Test Suite | Command | Exit Code | Result | Metrics |
| --- | --- | --- | --- | --- |
| **Protocol Corrections Suite** | `node --test web/tests/protocol-corrections.test.mjs` | 0 | **PASS** | 12/12 passed (N1–N4, F1–F3), 0 fail |
| **Web Suite** | `node --test web/tests/*.test.mjs` | 0 | **PASS** | 108/108 passed, 0 fail |
| **Root Suite** | `npm test` | 0 | **PASS** | 466/466 passed, 0 fail |
| **TypeScript Typecheck** | `npx tsc -p web/tsconfig.json` | 0 | **PASS** | 0 diagnostics |
| **Server Esbuild Bundle** | `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | 0 | **PASS** | 98.0 KB bundle generated |
| **Bundle Parity Check** | `sha256sum web/dist/server.mjs /tmp/opencode/server.mjs` | 0 | **PASS** | SHA-256: `97ad16115fd88c7956a786100730ad2e31741efb6c6a5af816857ecb03c190cd` |
| **Bundle Syntax Check** | `node --check web/dist/server.mjs` | 0 | **PASS** | Clean syntax |
| **Residual Probes** | `node .agents/run/task-centred-architecture/verifications/issue-33-residual/probes.mjs` | 0 | **PASS** | 29/29 passed (including `N1.srv.json422` and F3 probes) |
| **CDP Browser Gateway** | `node .agents/run/task-centred-architecture/verifications/issue-33-residual/browser-gateway.mjs` | 0 | **PASS** | 19/19 cases UNKNOWN with refresh guidance; 0 TypeErrors; draft preserved |
| **CDP Browser Baseline** | `node .agents/run/task-centred-architecture/verifications/issue-33-residual/browser-baseline.mjs` | 0 | **PASS** | 32/32 checks passed, 10 screenshots |

### Visual and Gateway Proof Artifacts
Artifacts are stored under `.agents/run/task-centred-architecture/verifications/issue-33-residual/`:
- `probes.json`: Full records of all 29 HTTP probe runs.
- `browser-gateway.json`: Detailed records of 19 browser mutation gateway replacements.
- `screenshots/`: 29 screenshots including desktop and 360px views:
  - `section.invalidShape-after.png`: Shows preserved `#1 Protocol gateway probe` detail, preserved draft in textarea, and visible "Outcome unknown — refresh to check GitHub state."
  - `section.invalidShape-360.png`: Fluid 360px mobile viewport rendering.
  - `question.invalidShape.png`, `status.invalidShape.png`: Error notices displayed with refresh guidance.

---

## 4. Scope and Diff Boundary Review

Files modified:
- `web/public/app.js`: F1 mutation detail schema validation, error handling, detail/draft preservation.
- `web/server/github.ts`: F2 422 classification provenance.
- `web/server/board.ts`: F3 4-space/tab indented code pattern exclusion and refusal; comment fix.
- `web/server/sections.ts`: F5 comment fix.
- `web/tests/protocol-corrections.test.mjs`: Regression tests covering F1, F2, F3.
- `web/README.md`: Pointer to active report.

Zero changes to `panel/**`, `service/**`, root `package.json`, or shared configs. `web/dist` remains gitignored and uncommitted.

---

## 5. Known Operational Blind Spots (NOT RUN)

The following operational aspects were intentionally not evaluated as part of this local web-tier bugfix:
1. **Production GitHub:** Real token scopes, permission verification, bot token identity, and real issue writes against live GitHub.
2. **Production Infrastructure:** TLS termination, dynamic reverse proxy header rewriting, process restart persistence, bind address (`BOARD_HOST`).
3. **Advanced Accessibility:** Keyboard-only Tab traversal order and visual `:focus-visible` ring rendering across diverse browser rendering engines.
4. **Deferred Epics:** Multi-repository aggregation (#37), PWA notifications, OpenChamber container hosting integration.

---

## 6. Conclusion and Next Step

Findings F1, F2, F3, F4, and F5 have been remediated with passing unit, integration, and live CDP browser gateway proofs. 

In accordance with owner decision 16, this work is submitted for **independent recheck**. The implementing agent does not self-approve or close Issue #33.
