# Issue #33 — Final Protocol Correction and Review Remediation Report

**Date:** 2026-10-25 UTC  
**Branch:** `feat/issue-33-standalone-board`  
**Base Commit:** `f50519d7a24413d74db4f46cef72a1512c820773`  
**Status:** **REMEDIATED AND VERIFIED — READY FOR HUMAN ADJUDICATION**

---

## 1. Executive Summary

This report remediates and closes findings **N1–N5** identified in the hostile independent review (`.agents/run/task-centred-architecture/outputs/issue-33-final-hostile.md`), superseding previous closure claims without widening scope or claiming unverified guarantees.

All remediations were strictly confined to `web/**` and `.agents/run/task-centred-architecture/verifications/issue-33-correction/**`. No modifications were made to `panel/**`, `service/**`, root `package.json`, or production configs. Prior review reports and prior verification artifacts remain completely immutable. All verifications ran against synthetic localhost upstream servers; no real GitHub credentials, tokens, or repository writes were used. No pull requests were merged or closed, and no code was pushed to remote branches.

### Status of Hostile Review Findings N1–N5

| Finding | Severity | Description | Remediated Status | Evidence Summary |
| --- | --- | --- | --- | --- |
| **N1** | Medium | Ambiguous mutation protocol/gateway and malformed 4xx outcomes misreported | **CLOSED** | Client `api()` maps malformed 200, gateway 502, truncated 200, empty 200, generic 500, and untrusted responses on mutations to `write_outcome_unknown` with refresh guidance; server `kindForStatus` retains JSON parse provenance so HTML 422 maps to 502 unknown rather than 400 invalid. |
| **N2** | Low | Upstream redirects followed automatically, bypassing repository boundary | **CLOSED** | `GitHubClient` enforces `redirect: 'manual'`; rejects 3xx responses with `GitHubError('server', ...)` before following. Zero requests sent to redirect destinations; tokens and bodies never forwarded. |
| **N3** | Low | Readback canonicalization erased meaningful Markdown indentation | **CLOSED** | Replaced broad `.trim()` with serializer-projection comparison normalizing only line endings (`\r\n` -> `\n`) and leading/trailing blank lines (`/^\n+/`, `/\n+$/`). Indentation changes fail readback and report 502 unknown. |
| **N4** | Low | Suffixed pseudo-closing fence exposed code checkbox as open question | **CLOSED** | Implemented `parseWebOpenQuestions` in `web/server/board.ts` with CommonMark fence tracking; excludes code checkboxes from list, detail, and answer targeting; direct HTTP answer requests to code checkboxes rejected with 400 invalid_edit. |
| **N5** | Low | Documentation contracts and availability claims overstated | **CLOSED** | Synchronized `web/README.md` numeric contracts (queue 4, deadline 2s, in-flight slots 10), redirect refusal, and qualified availability boundaries (local resource exhaustion protection; no unbounded network DoS immunity). |

---

## 2. Detailed Remediation and Adjudication

### N1: Mutation Protocol/Gateway Ambiguity and Server Parse Provenance

#### Defect Analysis
1. In `web/public/app.js`, JSON parsing errors were silently caught and set payload to `null`. On successful HTTP responses (`response.ok`), missing or malformed payloads caused the mutation handler to dereference `payload.issue`, throwing runtime `TypeError` (`Cannot read properties of null`). On non-OK responses (such as proxy HTML 502 or generic 500), errors were surfaced as `request_failed.` or generic errors without outcome-unknown guidance.
2. In `web/server/github.ts`, `kindForStatus(422)` unconditionally mapped HTTP status 422 to `'invalid'` regardless of whether the response was valid GitHub API JSON. An intermediate proxy returning an HTML 422 error page caused the board to report `400 invalid_request` ("The issue reference is not valid"), misleading the user into believing the mutation had been rejected before commit when the PATCH had already completed upstream.

#### Remediation Implemented
1. **Client-side mutation handling (`web/public/app.js`):**
   - For all mutations (non-GET, non-`/api/session` requests):
     - If `response.ok` but JSON parsing fails or `payload.issue` is missing: throws `ApiError('write_outcome_unknown', response.status, { message: 'Outcome unknown — refresh to check GitHub state' })`.
     - If `response.status === 401`: invokes `showLogin()`.
     - If `response.status >= 500`: throws `write_outcome_unknown` with refresh guidance.
     - If non-OK response is malformed, non-JSON, or lacks structured `{ error }`: throws `write_outcome_unknown` with refresh guidance.
     - Structured board pre-commit rejections (400 `invalid_edit`, 409 `conflict`, 429 `rate_limited`) are preserved and handled appropriately.
   - All mutation error notices and status indicators enforce refresh guidance: `"Outcome unknown — refresh to check GitHub state."`
2. **Server-side parse provenance (`web/server/github.ts`):**
   - `kindForStatus(status, headers, data, jsonParsed)` requires `jsonParsed === true && typeof data === 'object'`. If upstream returns non-JSON (such as HTML 422), `kindForStatus` returns `'server'`, preserving provenance.
   - In `app.ts`, GitHub server errors after a PATCH dispatch map to `502 write_outcome_unknown`.

#### Verification Evidence
- Unit/integration test in `web/tests/protocol-corrections.test.mjs`:
  - `N1 (client): api() treats malformed success, 5xx, and untrusted responses on mutations as write_outcome_unknown` (PASS)
  - `N1: upstream malformed/HTML 422 after PATCH maps to 502 write_outcome_unknown` (PASS)
- Real HTTP Gateway Proof (`browser-http-gateway.mjs`):
  - 502 HTML Bad Gateway: `Outcome unknown — refresh to check GitHub state.` (1 committed PATCH, verified)
  - 200 `{bad` Malformed JSON: `Outcome unknown — refresh to check GitHub state.` (1 committed PATCH, verified)
  - 200 Truncated JSON: `Browser network error: outcome unknown — refresh to check GitHub state.` (1 committed PATCH, verified)
- Real Browser Hostile Proof (`browser-hostile.mjs`):
  - Verified `malformed200`, `gateway502`, `empty200`, and `generic500` replacements all display outcome-unknown and refresh guidance.

---

### N2: Upstream Redirect Refusal Before Following

#### Defect Analysis
In `web/server/github.ts`, `fetchImpl` used default redirect-following semantics. While Link headers were inspected, intermediate 302 or 307 redirects from GitHub upstream could redirect requests to other endpoints or repositories, forwarding authorization bearer tokens and mutation bodies.

#### Remediation Implemented
1. In `web/server/github.ts:GitHubClient.request`:
   - Configured `redirect: 'manual'` in `fetchImpl`.
   - Intercepted 3xx responses immediately:
     ```ts
     if (response.status >= 300 && response.status < 400) {
       throw new GitHubError(
         'server',
         response.status,
         `GitHub redirected with status ${response.status}; redirects are not permitted`,
       );
     }
     ```
   - No request is dispatched to redirect destination URLs.
   - Authorization headers and request bodies are never forwarded across redirect hops.

#### Verification Evidence
- Unit/integration test in `web/tests/protocol-corrections.test.mjs`:
  - `N2: GitHubClient rejects 302 and 307 redirects before following (zero requests sent to destination)`:
    - 302 on GET: throws `GitHubError`, destination server receives 0 requests.
    - 307 on PATCH: throws `GitHubError`, destination server receives 0 requests; no token or body leaked.
    - Status write through board server encountering 302/307 maps to `502 write_outcome_unknown`.

---

### N3: Serializer-Projection Readback Comparison (Indentation Integrity)

#### Defect Analysis
In `web/server/app.ts:replaceSectionText`, post-mutation readback verification used `.trim()` on both `canonicalCur` and `canonicalTarget`:
```ts
const canonicalCur = curSec.text.replace(/\r\n/g, '\n').trim();
const canonicalTarget = targetText.replace(/\r\n/g, '\n').trim();
```
This comparison stripped leading and trailing spaces, equating indented code blocks (e.g. `    indented code`) with plain text (`indented code`), obscuring semantic Markdown differences.

#### Remediation Implemented
1. In `web/server/app.ts`:
   - Derived `expectedSec` directly from `findSections((patch.body as string) ?? '')`.
   - Replaced `.trim()` with normalization that strips only line breaks (`\r\n` -> `\n`) and leading/trailing blank line padding (`/^\n+/`, `/\n+$/`):
     ```ts
     const canonicalCur = curSec.text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
     const canonicalExpected = expectedSec.text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
     if (canonicalCur === canonicalExpected) {
       verified = true;
     }
     ```
   - All leading and trailing whitespace within lines (including 4-space code block indentation) is strictly preserved.
   - Any indentation discrepancy between the expected patch body and readback results in failed verification and reports `502 write_outcome_unknown`.

#### Verification Evidence
- Unit/integration test in `web/tests/protocol-corrections.test.mjs`:
  - `N3: indentation-only mismatch on readback maps to 502 write_outcome_unknown`:
    - Patch body with `    indented code` read back as `indented code` returns `502 write_outcome_unknown` with refresh guidance.
    - Canonical CRLF/LF normalization without indentation changes succeeds with `200`.

---

### N4: Web-Safe Question Parsing and Answer Targeting

#### Defect Analysis
In `panel/core.ts`, `parseOpenQuestions` and `answerOpenQuestionInMarkdown` used a naive fence toggle `/^[ \t]*(?:```|~~~)/.test(line)`. In Markdown, a fence opener like ```` ```not-a-closing-fence ```` is an opener or info string, not a closer. The naive check toggled `inCodeFence` off prematurely, exposing checkboxes inside code blocks as actionable open questions. Answering question index 0 would mutate the code block rather than an actual question.

#### Remediation Implemented
1. Confined all changes to `web/server/board.ts` (keeping `panel/core.ts` completely unmodified):
   - Defined CommonMark fence patterns:
     ```ts
     const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
     const closeFencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
     ```
   - Implemented `parseWebOpenQuestions(body)`:
     - Tracks fence character (backtick or tilde) and minimum fence length.
     - Strict closer check requires matching fence character, equal or greater length, and only optional trailing whitespace.
     - Ignores suffixed pseudo-closing fences like ```` ```not-a-closing-fence ````.
     - Excludes any checkboxes inside code blocks.
   - Updated `buildBoardList` to use `parseWebOpenQuestions` for question counts.
   - Updated `buildIssueDetail` to project only safe, non-fenced questions.
   - Updated `applyQuestionAnswer` to target questions resolved by `parseWebOpenQuestions`, ensuring code-block checkboxes can never be answered or corrupted.

#### Verification Evidence
- Unit/integration tests in `web/tests/protocol-corrections.test.mjs`:
  - `N4: malformed fence does not expose code checkbox as open question in list or detail` (PASS)
  - `N4: fence variants (longer backticks, tildes) preserve fences and exclude code checkboxes` (PASS)
  - `N4: exact hostile review fixture (no questions outside fence) exposes 0 questions and refuses answer mutation via HTTP` (PASS; returns 400 `invalid_edit`, 0 PATCHes)
  - `N4: real question after fenced code block can be answered via HTTP without touching code block` (PASS; 1 PATCH, code block intact, question answered)

---

### N5: Documentation and Contract Synchronization

#### Defect Analysis
`web/README.md` stated the scrypt waiting queue was 8 and body deadline was 5s, whereas the actual implementation bounded the queue to 4 and the deadline to 2s. The README also lacked disclosure of the 10 in-flight login slots, redirect refusal semantics, and qualified availability boundaries.

#### Remediation Implemented
1. Updated `web/README.md`:
   - Synchronized numeric contracts: scrypt queue bounded to 4 (max 2 concurrent workers), request body deadline 2s, in-flight login slots capped at 10.
   - Documented redirect refusal (`redirect: 'manual'`) and prohibition of forwarding bearer tokens or mutation bodies across redirect hops.
   - Documented ambiguous mutation outcome handling (`write_outcome_unknown`) with refresh guidance.
   - Qualified availability claims: clarified that rate limiting and concurrency limits protect against local resource exhaustion under normal operational conditions and do not provide unbounded network or socket denial-of-service immunity.
   - Explicitly noted that this report (`issue-33-final-protocol-correction.md`) documents protocol corrections and supersedes previous closure claims while prior reports remain immutable.

---

## 3. Test and Verification Matrix

### Command Execution Record

| Verification Suite | Target / Command | Exit Code | Metrics | Result |
| --- | --- | --- | --- | --- |
| **Protocol Corrections Suite** | `node --test web/tests/protocol-corrections.test.mjs` | 0 | 8 tests, 0 failures | **PASS** |
| **Web Unit & Integration Suite** | `node --test web/tests/*.test.mjs` | 0 | 104 tests, 0 failures | **PASS** |
| **Root Repository Test Suite** | `npm test` | 0 | 466 tests, 0 failures | **PASS** |
| **TypeScript Typecheck** | `npx tsc -p web/tsconfig.json` | 0 | 0 diagnostics | **PASS** |
| **Server Production Bundle** | `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | 0 | Bundle size: 97.6 KB | **PASS** |
| **Bundle SHA-256 Check** | `sha256sum web/dist/server.mjs` | 0 | `f4efd59222139830510074035bd3fb55bd70475c7cdb5e7ccdc6ebf1904e38df` | **PASS** |
| **Syntax Verification** | `node --check web/dist/server.mjs` | 0 | Clean syntax | **PASS** |
| **Real Browser HTTP Gateway Proof** | `node .agents/run/task-centred-architecture/verifications/issue-33-correction/browser-http-gateway.mjs` | 0 | 3/3 gateway cases mapped to unknown | **PASS** |
| **Hostile Real-Browser CDP Suite** | `node .agents/run/task-centred-architecture/verifications/issue-33-correction/browser-hostile.mjs` | 0 | 37/37 checks passed; 4 hostile observations | **PASS** |

### Hostile Real-Browser Observations

All browser replacement observations confirmed proper client mapping and visible refresh guidance:

```json
[
  {
    "name": "malformed200",
    "text": "Outcome unknown — refresh to check GitHub state.",
    "patches": 1,
    "committed": true,
    "unknownGuidance": true
  },
  {
    "name": "gateway502",
    "text": "Outcome unknown — refresh to check GitHub state.",
    "patches": 1,
    "committed": true,
    "unknownGuidance": true
  },
  {
    "name": "empty200",
    "text": "Outcome unknown — refresh to check GitHub state.",
    "patches": 1,
    "committed": true,
    "unknownGuidance": true
  },
  {
    "name": "generic500",
    "text": "Outcome unknown — refresh to check GitHub state.",
    "patches": 1,
    "committed": true,
    "unknownGuidance": true
  }
]
```

---

## 4. Worktree Scope and Diff Boundaries

A strict boundary check confirms only intended files in `web/**` were modified:
- `web/README.md`: contract and availability qualification updates.
- `web/public/app.js`: mutation outcome error handling and refresh guidance.
- `web/server/app.ts`: readback comparator indentation check.
- `web/server/board.ts`: web-safe question parsing and answer mutation.
- `web/server/github.ts`: redirect blocking and parse provenance tracking.
- `web/tests/fake-github.mjs`: test harness support for custom raw HTTP bodies and responses.
- `web/tests/protocol-corrections.test.mjs`: targeted regression test suite for N1–N4.
- `web/dist/server.mjs`: rebuild of production bundle.

No files in `panel/`, `service/`, or root configuration files were touched. All verification artifacts are saved under `.agents/run/task-centred-architecture/verifications/issue-33-correction/`.

---

## 5. Conclusion

Findings N1 through N5 are completely remediated and verified with passing unit, integration, and real-browser proofs. The standalone board remains safely single-user, bounded, and strictly section-scoped. This report completes the remediation requirements for Issue #33 and is submitted for final human review.
