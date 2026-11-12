# V4-2 independent review (L4)

Reviewer: independent L4 pass. I did not write this code, did not fix it and did not push.
Worktree `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3`,
branch `feat/board-v3` at `a7867e8`, tracked tree clean. Reviewed range `d1eef33..a7867e8`
(`d1eef33` is the released V4; everything after it is V4-2).

No application file was modified. Only this directory was added. Nothing was deployed, nothing
was pushed, and every run below used the synthetic Chromium preview against
`web/tests/fake-github.mjs`; no real GitHub request was made.

Evidence in this directory is mine. The author's evidence remains at
`../V4-2/` and is unmodified (verified with `git status` after every run that writes there; the
tracked author directory was restored with `git checkout --` each time).

## 1. Verdict

| axis | verdict | basis |
|---|---|---|
| SPEC | **PASS** | A note becomes a real issue comment the board reads back, and Decisions questions with `  - label :: gist :: details` render as Markdown presets with expandable details. Both are what the user asked for. |
| QUALITY | **CHANGES REQUIRED** | One MEDIUM finding (the option authoring convention is documented only in a code comment, so no issue author will produce presets), plus LOW/INFO findings. No security defect found in the write path. |
| PUBLISH | **NO as it stands; YES after the one docs change below** | The code is publishable. The feature is effectively unreachable until the convention reaches the people/agents who author issue bodies. |

### The one change required before publication

Document the option convention where issue authors read, not only in `web/server/board.ts`:

1. `docs/issue-body-contract.md` §2.5 `### Open Questions:` — add the `  - label :: gist :: details`
   form, the 2-space indent and "directly after the question line" rule, the 8-option cap and the
   120-character label cap, and state what happens to the option block when an answer is written.
2. `panel/core.ts` `DEFAULT_AI_ISSUE_PROMPT` (~line 1977) and `DEFAULT_AI_ALIGNMENT_PROMPT`
   (~line 2024), whose Open Questions instructions still say only "interactive Markdown checkboxes".
   Either teach the format there, or say explicitly that presets are a hand-authored feature.
3. Reconcile the same section's **"self-contained prose"** rule: chambervoice reads raw issue
   bodies over REST, so an option label must still read as a complete answer with no drawer around
   it. Today nothing states that.

No runtime code change is needed for this. It is a documentation/prompt change in files outside the
V4-2 diff, which is why I report it rather than make it.

## 2. What I ran (sequential, my own runs)

| # | command | result | exit | log |
|---|---|---|---|---|
| 1 | `node --test --test-timeout=30000 web/tests/*.test.mjs` (load 10.0) | 670 tests, 669 pass, 0 fail, **1 cancelled**: `web/tests/app.test.mjs` hit the 30 s file timeout | 1 | `logs/web-tests.log` |
| 2 | `node --test --test-timeout=60000 web/tests/app.test.mjs` (load 11.6) | 42/42 pass, 30.7 s | 0 | `logs/web-tests-app-alone.log` |
| 3 | `node --test --test-timeout=30000 web/tests/*.test.mjs` (load 6.28) | **670/670** | 0 | `logs/web-tests-run2.log`, `logs/web-tests-run2.exit` |
| 4 | `npm run typecheck` | clean | 0 | `logs/typecheck.log` |
| 5 | `npx esbuild web/public/app.js --bundle …` | 401.4 kb | 0 | `logs/esbuild-client.log` |
| 6 | `npx esbuild web/server.ts --bundle …` (the shipped entry, see `web/tests/hosting.test.mjs:35`) | 238.9 kb | 0 | `logs/esbuild-server.log` |
| 7 | `npx esbuild web/server/app.ts …` | 230.6 kb, matching the author's recorded size | 0 | (in `logs/esbuild-server.log` history / shell) |
| 8 | `node …/V4-2/scripts/browser.mjs` (load 11.1) | `pass:true`, 12 cases, 48 screenshots | 0 | `logs/browser.log` |
| 9 | `node …/V4-2-L4/scripts/framing-promise.mjs` (load ~4) | 12/12 PASS, 0 CSP, 0 console | 0 | `logs/framing-promise.log` |
| 10 | `DELIVERY_DIR=…/V4-2-L4 node scripts/generate-delivery-smoke.mjs` | 14/14 PASS, 191 captures, 307 s | 0 | `logs/delivery-smoke.log`, `smoke.json` |
| 11 | `npm test` at HEAD `a7867e8` (load 2.92) | **618/618** | 0 | `logs/npm-test-head.log` |
| 12 | `npm test` at detached `d1eef33` (load 4.06) | **618/618** | 0 | `logs/npm-test-base.log` |
| 13 | `node …/V4-2-L4/scripts/browser.mjs` (fresh copy, load 5.43) | `pass:true`, 12 cases, 48 screenshots | 0 | `logs/browser-run2.log`, `logs/browser-run2.exit` |
| 14 | four independent API probes | see `probe/probe*.json` | 0 | `probe/` |

The author's claim **"web tests 670/670"** reproduces (run 3), but run 1 shows it is not reliably
green at a 30 s per-file timeout under heavy load. `web/tests/app.test.mjs` is byte-identical to
`d1eef33` (`git diff --stat d1eef33..HEAD -- web/tests/app.test.mjs` is empty; 1236 lines in both),
so this is harness/load sensitivity, not a V4-2 regression. That is the same class of problem as
the panel-suite flake, and it is reported as H3.

## 3. Author claims, checked one by one

| # | claim | my result | evidence |
|---|---|---|---|
| 1 | Marker `<!-- board-note: 1 -->` must be the first non-blank line; a quoted or later marker is not a note | Confirmed. Later marker, quoted marker, fenced marker and `board-note: 2` all parse as **not** a note. A human comment whose **first** line is the marker does parse as a note (admitted limitation 5). | `probe/probe.json` `marker` |
| 2 | Comments append-only, never PATCHed or DELETEd | Confirmed. Only `GET` and `POST` appear in the request log; 0 comment PATCH/DELETE; the issue body is unchanged after a send. | `probe/probe.json` `writeMethods`, `commentMutations`, `issueBody` |
| 3 | Both note routes behind CSRF | Confirmed: `/api/issues/1/notes` and `/api/repos/owner/repo/issues/1/notes` each return 403 with no CSRF token and create 0 comments. | `probe/probe.json` `csrfPlain`, `csrfQualified`, `commentsAfterCsrf` |
| 4 | Per-issue lock released in `finally` | Confirmed by code (`withIssueLock`) and by probe: a forced 502 is followed immediately by a 201 after 94 ms on the same issue. `finally` also invalidates repository caches. | `web/server/app.ts:1963-1982`; `probe/probe.json` `lockAfterThrow` |
| 5 | 400 for empty/oversized; 64 KB body → 413 | Confirmed: blank → 400, 4001 chars → 400 `note_too_long`, 70 KB body → 413, non-object body → 400. No GitHub call happens for any of them (comment call count unchanged). | `probe/probe.json` `empty`, `tooLong`, `bigBody`, `nonObject`, `commentsAfterCaps` |
| 6 | 403 forbidden/locked, 404 and 410 are definite refusals | Code and tests confirm the mapping; a 410 now yields `not_found` (commit `3af3fe0`), a locked issue yields 403 `note_locked` with its own sentence. I did not test against real GitHub, only the fake. | `web/server/github.ts:144`, `web/server/app.ts:2090-2145`, `web/tests/v4-2-notes.test.mjs:97,108` |
| 7 | A lost response reconciles without duplicating; a double send creates 1 comment | Confirmed in the browser probe: `lostResponse.commentsCreated 3` (the fake counts the deliberate extra send), `doubleSend.commentsCreated 1`. The server itself does **not** dedupe (see H2); the guarantee is client-side. | `browser.json` probes; `probe/probe.json` `serverDedupe: 2` |
| 8 | One conditional comments GET on drawer open, 304 when unchanged, ETag per repo#issue | Confirmed: `/api/board` adds 0 comment requests; the first drawer read adds exactly 1; an immediate re-read sends `If-None-Match` and gets 304. Two different issues produced separate 304s, no cross-issue reuse. | `probe/probe3.json`; `probe/probe.json` `conditional` |
| 9 | Multi-repo route rejects an unconfigured repository with 400 `repository_not_allowed` | Confirmed: `/api/repos/nope/nothing/issues/1/notes` and `/api/repos/owner/issues/1/notes` both 400 `repository_not_allowed`; only the configured pair gets 201. | `probe/probe2.json` |
| 10 | Options `  - label :: gist :: details` render as Markdown, details expand, max 8, label ≤ 120 | Confirmed by code and browser probe (`decisions.headingsListsInlineCodeLinksEmphasis`, `noRawMarkers`, `selectedOptionSaved`, `legacyFreeTextSaved`, `presetFreeTextFallbackSaved`). | `web/server/board.ts:602-675`, `web/public/app.js:6540-6570` |
| 11 | Legacy questions still render and are answerable; malformed options degrade | Confirmed: no options → the legacy free-text input only; all-invalid option block → legacy shape preserved; `-  :: gist` is skipped instead of becoming the label. | `web/tests/v4-2-decisions.test.mjs`; `web/server/board.ts:645-648` |
| 12 | Answers still post to `/questions/:i/answer` | Confirmed by code path and probe (`selectedOptionSaved`). No new answer endpoint was added. | `web/public/app.js:6600-6620` |
| 13 | 213 EN = 213 FR keys, none missing | Confirmed by parsing the `I18N` object literal out of `app.js`: 213/213, no missing, no extra, no duplicate. All `data-i18n` attributes in `index.html` resolve. | shell parse; `dict.close` is missing but pre-existed in `d1eef33` and falls back to `'Close'` |
| 14 | typecheck and esbuild clean | Confirmed, with a caveat: the author's 230.6 kb is the `app.ts` entry, not the shipped `web/server.ts` entry (238.9 kb). Both bundle clean, so this is an evidence-labelling issue, not a defect. | `logs/typecheck.log`, `logs/esbuild-server.log` |
| 15 | Browser probe 12 cases / 48 screenshots | Confirmed twice, exit 0 both times. `browser.json` probe object is identical to the author's, field for field. | `browser.json`, `rerun/browser.json`, `logs/browser-run2.log` |
| 16 | Framing probe 12/12 | Confirmed, 12/12 PASS, 0 CSP, 0 console, exit 0. My JSON is byte-identical to the author's after removing `generatedAt`. | `rerun/regression/framing-promise.json`, `logs/framing-promise.log` |
| 17 | Delivery smoke 14/14 in 6m01s | Confirmed 14/14 PASS, 191 captures, 0 error lines, exit 0. Mine took **307 s**, not 361 s; duration differs, content does not. | `smoke.json`, `logs/delivery-smoke.log` |
| 18 | `npm test` 617/618 at HEAD, 618/618 on base, `panel/`+`test/` byte-identical, load-sensitive flake | Partly reproduced: I got **618/618 at HEAD** and **618/618 on base**, both green. `git diff --stat d1eef33..HEAD -- panel test` is empty and `panel/core.ts` md5 matches in both trees. The author's failures are therefore not reproduced but also not contradicted: the code under test is identical, so no V4-2 regression path exists. The flake itself remains pre-existing and unproven either way. | `logs/npm-test-head.log`, `logs/npm-test-base.log`; md5 `8337eeac…` in both |
| 19 | Old framing probe predates D37 | Confirmed from history, not from the author's prose: probe commit `6535937` is 2026-11-12 00:16; `CANVAS_READABLE_MIN_SCALE` arrived in `38f6572` at 03:31; `git merge-base --is-ancestor 38f6572 6535937` exits 1. The old probe's lines 377-394 demand full containment at every width, which the 0.55 floor forbids. | `git show -s`, `git merge-base` |
| 20 | The new probe asserts the product's promise, not the implementation | Confirmed by reading it: it asserts the floor (0.55), the honest outside-view legend, a real "Show all (N)" click reaching 4/4 and 0 under HUD, labels inside after Show all, and full containment at 1280. It does not read app state to restate the code. | `V4-2/scripts/framing-promise.mjs` |

## 4. Findings

Severity is the reviewer's; none of these is a security hole in the write path.

### H1 — MEDIUM — the preset-option convention is invisible to whoever authorises issues

`  - label :: gist :: details` is documented **only** in the comment block at
`web/server/board.ts:602-625`, in the test file, and in the author's evidence README. A repository-wide
search outside `.agents/` finds no other mention. Consequences:

- `docs/issue-body-contract.md` §2.5 still says Open Questions are `- [ ]` prose only. That contract is
  what the drafting agent is told to follow (`panel/core.ts:1966`: "Load the `issue-lifecycle` skill to
  adhere to Issue Body Contract v1").
- `DEFAULT_AI_ISSUE_PROMPT` (`panel/core.ts:1977`) and `DEFAULT_AI_ALIGNMENT_PROMPT` (`panel/core.ts:2024`)
  still describe Open Questions as checkboxes alone. Neither mentions options.
- The same section requires **"self-contained prose"** because chambervoice reads raw issue bodies over
  REST. An option label that only makes sense next to a drawer breaks that rule, and nothing says so.

Result: the rendering half ships, but no issue will contain options unless a human reads server source.
SPEC still passes because the requested behaviour exists and works; QUALITY requires this documentation
change. **Blocks publication** as "feature complete": publish after the three documentation points in §1.

### H2 — LOW — the server does not deduplicate; the one-comment guarantee is per page session

Two independent `POST`s with identical text create two comments (`probe/probe.json` `serverDedupe: 2`).
The browser guards this with `draft.busy`/`state.busy` plus the `draft.uncertain` reconcile, and the
probe confirms `doubleSend.commentsCreated 1` in one tab. But a second tab, or a reload after a
response was lost and before reconcile succeeded, can append a duplicate. Given the feature is a
"quick note", this is acceptable; the user-visible risk is a duplicated comment, never data loss.

### H3 — LOW — the web suite is not reliably green at its own 30 s per-file timeout

At load 10.0, `web/tests/app.test.mjs` was cancelled at 30 s. Alone at load 11.6 it took 30.7 s
(42/42, with a 60 s timeout). At load 6.28 the whole suite was 670/670. The file is byte-identical to
base, so V4-2 did not add the cost; but "670/670" is load-conditional and the CI budget should be
raised rather than the assertion weakened. Not a product defect.

### H4 — LOW — the note chip can read "100+" when the count is exact, and 20 shown notes have no "more" affordance

`noteCountPartial` is set when the page is full (`page.items.length >= 100`), so exactly 100 comments
shows `100+` even though the count is exact; and if the newest page holds no notes while older pages
do, the drawer shows `0+` with an empty list. `NOTES_SHOWN = 20` also caps the list below the displayed
count with no "show older notes" control. Honest as a floor, imprecise as an upper signal. This is the
admitted limitation 3, described more precisely.

### H5 — LOW — a 410 becomes "This issue no longer exists on GitHub"

`3af3fe0` maps 410 to `not_found`, which is right for "definite refusal, nothing saved". The client
then shows `agent_note_not_found`: "This issue no longer exists on GitHub". GitHub returns 410 when a
repository has issues disabled, in which case the issue may well still exist. The refusal is honest
about the save; the cause is misattributed. This is the admitted limitation 1's neighbour and the
only new copy issue introduced by `3af3fe0`.

### H6 — LOW — the 4,000-character refusal blames GitHub for the board's own cap

`agent_note_too_long` says "GitHub notes are limited to 4,000 characters" (EN) and "Les notes GitHub
sont limitées à 4 000 caractères" (FR). `NOTE_MAX_LENGTH = 4000` is a board constant
(`web/server/board.ts:301`); GitHub's comment limit is 65,536. The refusal is correct, the attribution
is not. The brief asks every refusal to name what failed; this one names the wrong party.

### H7 — INFO — GitHub's validation text is embedded in the 400 `invalid_note` body

`web/server/app.ts:2138` builds `GitHub rejected the note; nothing was saved (${reason})` where
`reason` comes from `error.data.errors[].message` or `error.data.message`. No token, cookie or header
material is included, and the client never renders this string (it shows its own `agent_note_rejected`
sentence), so the exposure is to the same authenticated browser that sent the request. Recorded because
the brief names "upstream error text" as a boundary; it is the only place that boundary is crossed.

### H8 — LOW (verification gap) — four promises are asserted by construction, not measured

- Arrow-key movement inside the radiogroup: native radios with a shared `name` inside `role="radiogroup"`
  make this browser behaviour, but no automated key press was run (author says the same).
- Labels hidden when an endpoint is off screen at the 0.55 floor: the code path exists
  (`web/public/app.js:3371-3376`, hidden branch at 3375) and the framing probe counts labels inside after Show all, but no
  probe asserts the hidden state itself.
- A 1000-card board: not measured by anyone.
- Screen reader output: not measured.

### H9 — INFO — the "esbuild clean" claim does not cover the shipped bundle, and `web/dist/server.mjs` is stale

The author recorded 230.6 kb, which is the `web/server/app.ts` entry. The production start command is
`node web/dist/server.mjs` (`package.json:19`) built from `web/server.ts`, which I bundled successfully
at 238.9 kb. The ignored `web/dist/server.mjs` on disk is dated 2026-11-11 and contains **0**
occurrences of `board-note`, i.e. it predates V4-2. Publishing therefore requires a rebuild; a deploy
that reuses the existing `dist` would ship V4-1 behaviour. Not a code defect, an operational caveat.

## 5. Admitted limitations: rulings

| # | limitation | ruling | what the user must be told |
|---|---|---|---|
| 1 | undocumented 422 (`errors[].message`) surfaces as 502 `note_outcome_unknown` | **Ships with caveat** | A rejected note can be reported as "outcome unknown". The note is never claimed as saved, the text is kept and Retry reconciles first. The client never sends such a body; only a proxy or a GitHub error outside the documented shape can trigger it. |
| 2 | `issueNotesCache` is unbounded | **Ships, no caveat needed** | Keyed per `repo#issue`, one small entry per issue read in the process lifetime. Memory grows with distinct issues opened, not with time or traffic. Restart clears it. |
| 3 | note count is a floor above 100 comments | **Ships, with a stated wording** | Above one page the chip may read `N+`; only the newest page's notes are listed and at most 20 are shown. A page with no notes can show `0+` while older notes exist. Never presented as an exact total. |
| 4 | generic CSRF 403 reads as a permission problem | **Ships with caveat** | A stale session or a blocked token can look like "you may not comment". Reload/sign in again; this is shared with every other write route and not introduced by V4-2. |
| 5 | a human comment quoting the marker first is shown as a note | **Ships, no privilege gained** | The comment author and time are displayed and the body is escaped, so a spoof reads as that author's comment. It is a formatting confusion on GitHub comments, not an escalation. Any repo commenter could already write that text. |

None of the five blocks publication.

## 6. What is solid (checked, not assumed)

- **CSRF on both route shapes**, before any body read and before any GitHub call. 0 comments created
  by unauthenticated attempts.
- **Repository allowlist**: the qualified route resolves through `RepositoryRegistry` before routing;
  unconfigured and malformed owners both get 400 `repository_not_allowed` and no write.
- **Lock**: acquired per `repo#issue`, released in `finally`, and the repository caches are invalidated
  in an outer `finally` even when the write throws.
- **Size caps before the write**: 64 KB at the body reader, 4,000 chars at the note validator and again
  in `buildNoteCommentBody`. A 413/400 leaves the comment count unchanged.
- **Append-only**: no `PATCH`/`DELETE` on comments anywhere in the server; the issue body, canvas
  marker and order marker are untouched by a note send. Canvas stickies and agent notes stay separate.
- **Read-back is the source of truth**: the response's note is the comment GitHub returned, re-read by
  id; the client also validates `response.note.id` and the text before showing success.
- **Failure honesty**: every branch names a distinct cause (locked, forbidden, not found, too long,
  rate limited, rejected, outcome unknown). The composer keeps the typed text, returns focus, restores
  the trigger's `aria-expanded`, and offers Retry; the browser probe confirms
  `failureRetry.retained/plainError/retry` and `draftSurvivesClose`.
- **Decisions escaping**: labels, gists and details all pass through the escape-first
  `web/public/markdown.js`; `javascript:` and `<script>` do not render; no `href` is built from an
  option; the details disclosure is a real `<button>` with truthful `aria-expanded`/`aria-controls`.
- **Non-regression probes**: 12/12 framing cases (0.55 floor, honest limit legend, Show all = full
  fit, 0 under HUD, labels inside), delivery smoke 14/14 across list/canvas/sheets/sidebar/filter/
  dependency/brand/settings at 360/390/768/1280 in EN/FR light/dark, 0 CSP violations, 0 console
  problems, 0 inline `style=` in `index.html`, 0 "n8n"/"mobile" and 0 emoji in public assets,
  Views `Canvas`/`Canevas` and List/`Liste`.
- **i18n**: 213 EN = 213 FR, all `data-i18n` keys resolve. (`dict.close` is absent but pre-existing and
  has a fallback.)

## 7. Not verified

- Real GitHub, production, or any deployed instance. All runs used `web/tests/fake-github.mjs`.
- That the model working an issue actually reads issue comments. The note is a real comment and the
  panel's comment drawer displays it, but no agent session was run and no drafting prompt in this repo
  includes comments. This is the one assumption under the SPEC PASS.
- Safari, Firefox, a physical phone, or a screen reader.
- A board with 1000 cards; arrow-key movement inside the radiogroup; the off-screen label hidden state.
- A green `npm test` under sustained high load (my runs were green at load 2.9-4.1; the author's were
  not at load 6.9-12.8). No assertion was changed or skipped by me.
- Whether `web/dist/server.mjs` is rebuilt by the release process (it is stale on disk; rebuild required).

## 8. Notes on method

DIDN'T WORK: `npx esbuild web/server/main.ts …` exits 1 — there is no `web/server/main.ts`; the real
entry is `web/server.ts` (per `web/tests/hosting.test.mjs:35`). I also first tried `/usr/bin/time`,
which is absent (exit 127).
FINALLY WORKED: bundling `web/server.ts` (238.9 kb) and `web/server/app.ts` (230.6 kb, the author's
number), and timing the smoke with `date +%s` deltas (307 s).
DIDN'T WORK: `node …/V4-2/scripts/browser.mjs` writes into the tracked `V4-2/` evidence directory and
dirtied it. FINALLY WORKED: copying the scripts to the same directory depth under `V4-2-L4/` and
restoring `V4-2/` with `git checkout --` after the framing run; `git status` confirms `V4-2/` is clean.
DIDN'T WORK: the first API probe reported 201 for `other/place` because the fixture registered two
repositories. FINALLY WORKED: a second probe with a single configured repository, which returns 400
`repository_not_allowed` for both the unknown and the malformed qualified paths.

## 9. Files

- `logs/` — every command's output and the two explicit exit codes.
- `browser.json` — my second browser run (from the copied scripts); `rerun/browser.json` — my first.
- `rerun/regression/framing-promise.json` — my framing run (screenshots not byte-reproducible; the JSON
  matches the author's except `generatedAt`).
- `smoke.json` + `screenshots/` — my delivery smoke (191 captures) plus 48 browser-probe captures.
- `probe/` — four independent API probes and their JSON output; `scripts/` — the two copied probes and
  the browser environment setup.

## 10. Answer to the brief

**SPEC PASS.** A note really is a GitHub issue comment, appended and read back, and Decisions questions
really render preset options as Markdown with expandable details, while legacy questions still work.
**QUALITY CHANGES REQUIRED**: H1 MEDIUM (document the option convention for issue authors and reconcile
the self-contained-prose rule); H2-H6, H8 LOW; H7, H9 INFO.
**PUBLISH NO as it stands; YES once H1's documentation change lands**, with these caveats for the user:
a rejected note can be reported as "outcome unknown" (nothing is claimed saved, text is kept, Retry
reconciles); above 100 comments the note chip is a floor and only the newest page is listed; a stale
session's 403 reads as a permission problem; a human comment that starts with the marker is displayed
as an agent note under that author's name and time; and the release must rebuild `web/dist/server.mjs`,
which currently predates V4-2.
