# Issue #33 — final hostile check of the N1–N5 protocol correction

Reviewed candidate `06ed4a36f3210c212c769e47f9c62b7de755573c` against prior report commit
`8818b94`, branch `feat/issue-33-standalone-board`. Check ran 2026-10-25 UTC. Reviewer:
**Genius (`9router/genius`)**, independent of the builder. Read-only: no product, test,
README or bundle edit; no fix loop.

- **Security: APPROVED.** No browser authentication bypass, CSRF bypass, direct credential
  disclosure, or repository-escape through redirects reproduced. The N2 redirect boundary now
  holds before dispatch. Remaining defects are protocol/UI correctness and documentation, not
  authorization.
- **Spec Compliance: PARTIAL.** N2, N3 and the named N4 fences are closed against my own real
  HTTP reproductions. N1 is still open for a nominal 200 with an invalid detail shape and for a
  post-commit generic JSON 422. N5 is partial: README numbers are correct, but the correction
  report still asserts complete N1–N5 closure.
- **Quality: NEEDS-FIXES.** A green suite count does not cover the invalid-shape payload, the
  generic JSON 422, or the adjacent indented-code checkbox. Two source headers now describe a
  parser that no longer exists.

**This report supersedes** the N1–N5 closure status in
`.agents/run/task-centred-architecture/outputs/issue-33-final-protocol-correction.md` (lines 12,
20–24, 242). Prior reports remain immutable audit artifacts; they are not rewritten.

Human review is still pending. This is a verdict, not merge, deploy, or #33 closure authority.

## What was reviewed and how

Read the full `8818b94..06ed4a3` diff, including `web/public/app.js`, `web/server/{app,board,github,sections}.ts`,
both revised test files, `web/README.md`, the correction report, and the correction proof.
Reviewed the actual product runtime through its own modules:

- `verifications/issue-33-protocol-final-review/probes.mjs` — real HTTP board server plus
  synthetic GitHub, one probe per required behaviour.
- `verifications/issue-33-protocol-final-review/browser-gateway.mjs` — real Obscura CDP browser
  against a real board behind a real HTTP gateway that lets each mutation commit, then replaces
  the reply.
- `verifications/issue-33-protocol-final-review/browser-baseline-relocated.mjs` — the existing
  browser harness executed from this proof directory (only import paths, artifact root, and CDP
  port relocated).

Product commit scope is exactly the web files the brief named; `panel/**`, `service/**`, root
package metadata and prior proof/report paths are untouched by `06ed4a3`.

## N1–N5 matrix

| Item | Verdict | My reproduction |
| --- | --- | --- |
| **N1** browser writes report UNKNOWN | **OPEN** | 19 committed browser mutations: 16 show `Outcome unknown — refresh to check GitHub state`, each exactly 1 PATCH. 3 (`section`, `question`, `status` with 200 `{"issue":{}}`) show raw `Cannot read properties of undefined (reading 'length').` Server: HTML 422 → 502 unknown (pass); valid-JSON generic 422 → `400 invalid_request` (fail). |
| **N2** redirect refused before destination | **CLOSED** | Same-origin GET 302 `/repos/other/repo/issues`, same-origin PATCH 307 `/repos/other/repo/issues/9`, cross-origin PATCH 307: destination request count 0 in all three. Mutation returns `502 write_outcome_unknown`, origin PATCH count 1, no retry. |
| **N3** projection comparison | **CLOSED** | Indentation-only mismatch `    indented code` → `indented code` returns 502 unknown. Trailing content whitespace `value   ` → `value` returns 502 unknown. Preserved indentation and trailing whitespace both succeed 200; CRLF write returns 200 and exact `\r\n` body; protected Human Tasks suffix byte-identical. |
| **N4** fenced question safety | **CLOSED for named cases; adjacent residual** | Suffixed pseudo-closer, 4-backtick and tilde fixtures expose only the real trailing question; direct answer to the code index returns 400 `invalid_edit`, 0 extra PATCH. Real questions before/after fences, duplicate index 1, completed-index shift and stale-source 409 all behave. `panel/core.ts` has no diff in `06ed4a3`. A 4-space indented code checkbox is still offered and mutable (F3). |
| **N5** documentation truth | **PARTIAL** | README queue 4, deadline 2s, slots 10 match `app.ts:231,590-594`; redirect refusal and qualified DoS wording present; supersede sentence present. The correction report still says N1–N5 are closed and "completely remediated" while F1/F2 are open (F4). |

### N1 detail — what passes

Real gateway/browser, one committed PATCH each, visible in the DOM on desktop and 360px:
502 HTML, malformed 200, empty 200, generic JSON 500, truncated transport, and a 200 body with
no `issue` key all produce UNKNOWN with refresh guidance. Section, question and status paths
behave the same. Confirmed by `browser-gateway.json` (`patches: 1`, `committed: true` for every
case) and screenshots `section.gateway502-360.png`, `question.gateway502-360.png`,
`status.gateway502-360.png`, `section.malformed200.png`, `section.truncated200.png`.

Trusted pre-commit paths stay distinct: missing CSRF 403, unauthenticated 401, stale
fingerprint 409, and a real GitHub-shaped 422 (`message:"Validation Failed"` plus `errors[]`)
map to `400 invalid_request` with no commit. Login/logout remain separate (`/api/session` is
excluded from mutation handling). No automatic repeat observed in any case.

## New ranked findings

### F1 — Medium — a nominal 200 with an invalid detail shape becomes a raw exception, not UNKNOWN

**Input:** real board behind the gateway; the PATCH commits; the gateway answers `200
{"issue":{}}`. Reproduced identically for section, question and status writes.

**Observed:** `patches: 1`, `committed: true`, visible text
`Cannot read properties of undefined (reading 'length').` in the save status (section) and the
notice region (question, status). No UNKNOWN, no refresh guidance. The detail header also
renders from the incomplete object (`#undefined`, `no status`), so the page is left showing a
broken task. Screenshots: `section.invalidShape.png`, `section.invalidShape-360.png`,
`section.invalidShape-after.png`, `question.invalidShape.png`, `status.invalidShape.png`.

**Source:** `web/public/app.js:115` validates only that `payload.issue` is truthy. `{}` passes.
The handler then assigns it (`:554`, `:597`, `:632`) and `renderDetail` dereferences
`issue.editableSections.length` (`:452-466`). The thrown `TypeError` falls into the generic
catch branch (`:560-575`, `:602-615`, `:637-650`), which prints `error.message + '.'`.

**Minimum correction:** validate the mutation success payload's required shape before returning
it (object `number`, string `fingerprint`, arrays `editableSections`/`openQuestions`/
`humanTasks`/`acceptanceCriteria`/`subtests`, `statusOptions`); on any failure throw the same
`write_outcome_unknown` used for malformed JSON. Do not infer success from a 2xx status alone.

### F2 — Low — a post-commit generic JSON 422 is still reported as definitive invalid request

**Input:** upstream applies the PATCH body, then answers `422 {"message":"Gateway lost
upstream"}` (valid JSON, no GitHub `errors` array, not a GitHub validation body).

**Observed:** board replies `400 invalid_request`, `"The issue reference is not valid"`,
`patches: 1`, committed body present. Contrast: the same position returning HTML 422 correctly
yields `502 write_outcome_unknown`, and a GitHub-shaped validation 422 yields `400` with no
commit. So the remaining hole is exactly "valid JSON is treated as proof of validation".

**Source:** `web/server/github.ts:74` rejects only non-JSON/non-object bodies; `:87` maps every
remaining 422 to `'invalid'`; `web/server/app.ts:214-215` turns that into 400 `invalid_request`.

**Minimum correction:** treat a post-dispatch 422 as definitive only when it matches GitHub's
validation shape (for example a `Validation Failed` message with an `errors` array), or carry
explicit provenance that the response came from GitHub before it is classified. Everything else
after a dispatched write is `write_outcome_unknown`, never invalid request.

### F3 — Low — a 4-space indented code checkbox is offered and mutable

**Input:** issue body

```markdown
## Open Questions
    - [ ] Four-space indented code question?
- [ ] Indentation real question?
```

**Observed:** detail projects two questions; `answerIndex: 0` is the indented code line. Posting
an answer returns 200 and rewrites it to
`    - [x] Four-space indented code question? *(Answer: mutated code)*`. This renders as a code
block, not a question. Logged in `probes.json` as `N4.adjacentIndentedCode`, which is an
observation record, not a passing requirement.

**Source:** `web/server/board.ts:39` `checklistRegex` accepts arbitrary leading whitespace and
`parseWebOpenQuestions` (`:44-...`, used at `:264`, `:296`, `:364`) tracks only fenced code, not
indented code blocks. `panel/core.ts` is untouched, as required.

**Minimum correction:** track indented code blocks (four spaces or a tab after a non-paragraph
context) in the web-layer scanner, or refuse checklist candidates whose indentation makes them
code in the web layer. This is outside the named fenced variants; it does not reopen N4's
required cases.

### F4 — Low — the correction report still overclaims complete closure

**Source:** `.agents/run/task-centred-architecture/outputs/issue-33-final-protocol-correction.md:12`
("remediates and closes findings N1–N5"), the `CLOSED` table at `:20-24`, and `:242`
("completely remediated"). F1 and F2 contradict that.

**Minimum correction:** supersede the closure table with the measured status (done here) and
remove "completely remediated" from the active report. Prior reports stay immutable.

### F5 — Nit — stale source headers describe the removed reuse

`web/server/board.ts:4-5` still says open-question answering reuses `panel/core.ts` and that
"Nothing here is a second parser"; `web/server/sections.ts:6` still says open-question answers
reuse `panel/core.ts`. Both are false after `parseWebOpenQuestions` (`board.ts:44`). Correct the
comments when the file is next touched; no behavioural impact.

## Smoke boundaries re-checked

- Unauthenticated board read 401; missing CSRF on a write 403; forged session cookie 401;
  logout 204 then 401; wrong password 401; cookie carries `Path=/`, `HttpOnly`, `SameSite=Strict`.
- Synthetic token absent from served HTML, `app.js` and the issue JSON; overwrite warning
  present above the editing controls; local/session storage empty.
- Human-only Done: `status:done` write returns 200, issue stays open, `phase:execution`,
  `attention:needs-decision` and `bug` are preserved, `status:todo` removed. Attention remains
  distinct from phase.
- Stale question answer returns 409 `conflict`, zero PATCH, and the payload shows the changed
  question text.
- Owner-accepted overwrite window is unchanged and still disclosed; no atomic-GitHub claim was
  tested or demanded.

## Commands and evidence

Node `v22.23.3`; existing root `node_modules`; no installs.

| Command | Result |
| --- | --- |
| `node --test web/tests/*.test.mjs` | exit 0 — 104/104, 0 fail/skip/cancel, 10,956 ms |
| `node --test web/tests/protocol-corrections.test.mjs` | exit 0 — 8/8 |
| `npm test` | exit 0 — 466/466, 0 fail/skip/cancel, 67,580 ms |
| `npx tsc -p web/tsconfig.json` | exit 0 — no diagnostics |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/issue33-review/server.mjs` | exit 0 |
| `node --check /tmp/opencode/issue33-review/server.mjs` | exit 0 |
| `sha256sum /tmp/opencode/issue33-review/server.mjs web/dist/server.mjs` | both `f4efd59222139830510074035bd3fb55bd70475c7cdb5e7ccdc6ebf1904e38df` |
| `node .../issue-33-protocol-final-review/probes.mjs` | exit 0 — 28 records, 27 pass, 1 fail (`N1.srv.json422`) |
| `node .../issue-33-protocol-final-review/browser-gateway.mjs` | exit 0 — 19 cases, 16 UNKNOWN, 3 raw TypeError; every case 1 PATCH and committed; 0 runtime events |
| `node .../issue-33-protocol-final-review/browser-baseline-relocated.mjs` | exit 0 — 32/32 checks, 10 screenshots |

`web/dist/server.mjs` is gitignored (`web/.gitignore:1`); the fresh disposable bundle matches it
byte-for-byte, so bundle parity is real but the committed tree has no bundle. 32 screenshots in
`verifications/issue-33-protocol-final-review/screenshots/`; desktop and 360px gateway/protocol
feedback inspected directly. Board logs recorded 153 lines for the gateway run, no credential
values, no runtime exception events; the raw TypeError is caught and printed by the app.

Browser harness execution note: the literal `node web/tests/browser-verify.mjs` was not run
because its hardcoded artifact root writes outside this review's owned paths. The relocated copy
changes only import paths, artifact root and CDP port; all 32 original assertions and the 10
screenshots are unchanged.

## Blind spots — NOT RUN

- Production GitHub: token presence, permissions, least-privilege scopes, real writes, bot
  identity and repository coverage. All upstream servers here are synthetic localhost.
- Production TLS, proxy/header rewriting, buffering, restart persistence, bind address, real
  deployment health, real network or socket exhaustion.
- Real keyboard Tab traversal and computed `:focus-visible` rendering; the harness records this
  as NOT RUN.
- Browser XSS inertness was not re-authored in this pass. Rendering paths are unchanged from the
  prior hostile check, but I am not claiming a fresh XSS execution here.
- Multi-repository #37, PWA/notifications, hosting changes. No expansion attempted.

## Verification failures and corrected approaches

- **DIDN'T WORK:** first browser pass reloaded the page and waited for the detail view while the
  URL lost `#/issue/1`; `wait timeout detail view` left the board list visible.
  **FINALLY WORKED:** navigate explicitly to `/?probe=N#/issue/1` between cases; 19/19 cases then
  ran with one PATCH each.
- **DIDN'T WORK:** first N2 probe closed the origin/destination servers before the direct
  cross-origin `GitHubClient` call, and an interim generic-422 probe reused a stale fingerprint,
  producing a misleading 409. **FINALLY WORKED:** keep servers alive through the direct probe and
  re-read the detail before each 422 case; the 409 disappeared and the real 400 defect reproduced.
- **DIDN'T WORK:** an early adjacent-fixture assertion expected zero questions and reported
  failure for a fixture that legitimately contains a real second question.
  **FINALLY WORKED:** assert exact projected texts and record the code-line mutation as an
  observation instead of folding it into a green count.

No fixes applied. Findings return to the owner/caller for adjudication.
