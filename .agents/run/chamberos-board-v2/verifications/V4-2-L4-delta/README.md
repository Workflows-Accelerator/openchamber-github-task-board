# V4-2 H1 correction — independent review (L4-delta)

Reviewer: independent pass. I did not write the correction, did not fix it, did not push.
Worktree `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3`,
branch `feat/board-v3` at `1d9f237`, tracked tree clean on entry and on exit. Reviewed delta
`a7867e8..1d9f237` (`88d66d1` feature, `1d9f237` evidence). The full V4-2 was reviewed at
`a7867e8` in `../V4-2-L4/README.md`; this pass only judges the correction and the publication gate.

No application file was modified. The only tracked file I touched was
`docs/issue-body-contract.md`, and only inside the mutation experiment, restored with
`git checkout --` each time and verified byte-identical afterwards (`md5sum -c` OK).
`.agents/run/chamberos-board-v2/verifications/V4-1-L4/` was not read, staged or written.
Nothing was pushed, deployed, or sent to real GitHub; Chromium ran the synthetic fixture only.

## 1. Verdict

| axis | verdict | basis |
|---|---|---|
| **H1** | **CLOSED** | The convention now exists in the contract §2.5, in both authoring prompts, in the shipped panel bundle, and a test parses the document's own example. The self-contained-prose rule is explicitly reconciled. |
| **SPEC** | **PASS** for `d1eef33..1d9f237` | No runtime behaviour changed in the delta except two user-facing strings; the V4-2 behaviour re-verified green (672 web tests, 12/12 browser cases, 14/14 smoke). |
| **QUALITY** | **APPROVED**, with four LOW/INFO findings below | The blocking finding is genuinely closed. The residue is documentation precision and two pieces of inert or stale packaging, none of which changes behaviour. |
| **PUBLISH** | **YES**, with the caveats in §8 | Nothing in the correction is a release blocker. |

## 2. Is the change set bounded? Yes — five files, no parser change

`git diff --name-status a7867e8..1d9f237` outside `.agents/`:

| file | change | what |
|---|---|---|
| `docs/issue-body-contract.md` | +23 −1 | new §2.5 "Preset answer options" + §5 prompt-contract sentence + v1.2 line |
| `panel/core.ts` | 2 lines | `DEFAULT_AI_ISSUE_PROMPT` (1977), `DEFAULT_AI_ALIGNMENT_PROMPT` (2024) |
| `panel/main.js` | 2 lines | the same two strings in the shipped bundle (6541, 6579) |
| `web/public/app.js` | 4 lines | `agent_note_too_long` and `agent_note_not_found`, EN and FR |
| `web/tests/issue-body-contract.test.mjs` | new, 62 lines | the document lock |

`git diff a7867e8..1d9f237 --stat -- web/server/board.ts` is empty. The parser's accepted syntax is
therefore unchanged by construction: same regexes (`optionLinePattern` 2–3 spaces + `-*+`/`\d+[.)]`,
`optionFieldSeparator = /\s+::\s+/`, `QUESTION_OPTION_MAX = 8`, label `> 120` skipped, gist 200,
details 2000 — `web/server/board.ts:628-652`). No other file changed, so no canvas, framing, i18n key
count, server route or panel behaviour moved.

## 3. Is the test a real lock? Yes — four mutations, four failures

The test (`web/tests/issue-body-contract.test.mjs`) reads the document at run time, cuts §2.5 out of
it, extracts the fenced `markdown` block, and `deepEqual`s the parser's output against both options.
It also matches the documented caps and asserts `QUESTION_OPTION_MAX === 8` plus real 120/121 and
10-option behaviour.

Baseline: `node --test web/tests/issue-body-contract.test.mjs` → 2/2, exit 0 (`logs/contract-test.log`).

| mutation (scratch, restored after each) | exit | failed because |
|---|---|---|
| A: `::` → `:` in both example option lines | 1 | the whole line became the label (`label: 'PostgreSQL : Mature and familiar : …'`); `deepEqual` rejected it — exactly the inert-feature failure H1 was about |
| B: "At most 8 options" → "At most 9" | 1 | `assert.match(section, /At most 8 options per question/)` did not match |
| C: example indent 2 → 4 spaces | 1 | option count 0: a 4-space line is an indented code block and ends the option block |
| D: "at most 120 characters" → 121 | 1 | `assert.match(section, /at most 120 characters/)` did not match |

`git checkout -- docs/issue-body-contract.md` after each; `md5sum -c mutation/original-doc.md5` → OK;
`git status --porcelain` shows no tracked modification. Logs in `mutation/`.

The author's claim is true with one boundary worth stating: the lock covers **the example and the two
cap numbers**, not the prose rules. Rewriting the sentence about malformed lines — the one sentence in
the new section that is inaccurate (§4) — leaves the test green.

## 4. Reading §2.5 as an author

The good part is real. The example is a question a person would actually ask; the format line spells
out every field; the caps are stated; the answer behaviour is stated; and the reconciliation
paragraph is unambiguous:

> "Option lines are recommendation metadata that the board renders; they are not part of the question's
> prose. The question must still read correctly as plain prose when the option lines are stripped …
> The free-text answer path always stays valid: presets are suggestions, never a required choice."

Answering was verified empirically, not just from the sentence: `applyQuestionAnswer` rewrites only the
question line to `- [x] … *(Answer: PostgreSQL)*` and leaves both `  - … :: …` lines in the body
(`probe-answer-preserves-options.log`). The stripped question is "Which database should we use for the
audit trail?" — plain prose. The free-text path is stated twice and is unmistakable.

What would mislead, quoted, with what the parser actually does (`probe-doc-claims.log`):

1. **§2.5 line 49: "A malformed line is skipped".** True only for a list item whose *fields* are bad
   (`  - `, `  -  :: gist`, over-long label). A line that is not a list item at all — an indented
   continuation paragraph, a wrapped gist, a nested checklist item — **ends the option block**, and
   every later option is silently lost. Measured: options `A`, then `  This paragraph is not an option
   line.`, then `B` → 1 option, `B` gone. Same with `  - [ ] a step` between two options.
2. **§2.5 line 49: "The option block ends at the first blank line, unindented line, indented code block
   or heading."** Incomplete for the same reason: any other indented line ends it too. The four listed
   endings are correct as far as they go (all four verified, including an indented heading).
3. **§2.5 line 47: "the details field is free Markdown".** It is silently truncated at 2,000 characters,
   and the gist at 200 (`web/server/board.ts:651-652`). Neither cap is documented. A long details
   paragraph loses its tail in the drawer with no warning.

Not misleading, for the record: the doc says two spaces while the parser accepts 2–3 (doc is stricter,
which is safe); the doc lists marker `1.` while the parser also accepts `1)` and multi-digit (superset,
safe); the example heading is `## Open Questions` while §2.5's heading is `### Open Questions:` — both
parse; and `parseWebOpenQuestions` really is the only parser for `::` lines (the panel's
`extractQuestionOptions` handles the older "X or Y?" / `(A)` shapes only).

## 5. The two prompts

Both name the exact delimiter, the caps, the placement and the free-text requirement, and neither
contradicts the rest of its prompt:

- `DEFAULT_AI_ISSUE_PROMPT` (`panel/core.ts:1977`): `"  - label :: gist :: details"`, "up to 8", "label
  at most 120 characters", "gist on one line", "details optional Markdown", malformed-line fallback,
  self-contained prose with the lines removed, free-text path preserved.
- `DEFAULT_AI_ALIGNMENT_PROMPT` (`panel/core.ts:2024`): the same content, shorter, still carrying the
  free-text sentence.

Length is sane: the issue prompt is now 4,674 characters (+556 on its Open Questions bullet), the
alignment prompt 2,363 (+474); the Open Questions bullet is 830 characters, 17.8 % of the issue prompt
and the longest of the ten bullets. No contradiction with the neighbouring "propose 2-3 approaches"
instruction.

Shipped parity is real: `panel/main.js` carries the identical strings, and
`node --test test/shipped-parity.test.js` → **18/18, exit 0** (`logs/shipped-parity.log`), which
includes `assert.equal(Shipped.DEFAULT_AI_ISSUE_PROMPT, Core.DEFAULT_AI_ISSUE_PROMPT)`.

How the prompt actually reaches an agent (`panel/main.ts:8532-8548`): `resolveAiIssuePrompt` output is
passed as `text` to `host.startSession({ …, skills: ['issue-lifecycle'] })`, so the convention travels
in the session prompt itself. The one gap is precedence: a stored `ai_issue_prompt_{repo}` or
`ai_issue_prompt_global` value wins (`panel/core.ts:1999`), so an installation that saved a prompt
template before today sends the old text. "Reset prompts to default" (`panel/main.ts:8131-8141`)
deletes those keys and is the remedy. See caveat 2 in §8.

## 6. The two corrected messages

Both are true of the cases they are shown for, both are actionable, and the dictionaries are equal.

- 404/410 path → `agent_note_not_found` ("The conversation for this issue is unavailable on GitHub
  (issues may be disabled, or the issue was deleted or transferred), so the note was not saved. Your
  text is kept. Reload the task to check."). Rendering confirmed live at 360 in EN and FR with an
  injected 410 (`note-copy-360.json`, `screenshots/note-410-360-*.png`). The old sentence claimed the
  issue no longer exists, which a 410 does not mean; the new one is honest about the refusal and names
  the three causes. "Reload the task to check" is the right next step.
- 4000-character path → `agent_note_too_long` ("The board limits notes to 4,000 characters…"). True:
  `NOTE_MAX_LENGTH = 4000` (`web/server/board.ts:301`); GitHub's own comment limit is far higher.
  Rendering confirmed at 360 in EN and FR.
- i18n: 213 EN keys = 213 FR keys, no missing, no extra, no empty value (`i18n.json`). Both changed
  keys exist in both dictionaries and nowhere else (the panel bundle does not carry note copy).
- Layout at 360: document `scrollWidth` 360 in all four theme/language combinations, the status block
  fully inside the viewport, no horizontal scroll inside the block, composer still visible, heights
  78 px (EN) and 98 px (FR). Spot-checked `screenshots/note-410-360-light-fr.png`: five clean lines,
  "Réessayer"/"Annuler" intact, draft "Brouillon conservé." still in the textarea, nothing clipped.
- Reachability, which the author's summary implies but does not say: `#agent-note-text` carries
  `maxlength="4000"` (`web/public/index.html:446`) and the server cap is also 4000, so the browser
  refuses the 4001st character. The 4,000-cap sentence is defensive copy a user cannot normally see.
  Corrected, but inert.

## 7. What I ran (sequential, my own runs, nothing reused)

| # | command | result | exit | log |
|---|---|---|---|---|
| 1 | `node --test web/tests/issue-body-contract.test.mjs` | 2/2 | 0 | `logs/contract-test.log` |
| 2 | four document mutations, restoring each time | 4 failures, each for the intended reason | 1 each | `mutation/` |
| 3 | `npm test` | **618/618**, 28.0 s | 0 | `logs/npm-test.log` |
| 4 | `node --test --test-timeout=30000 web/tests/*.test.mjs` | **672/672**, 58.5 s, 0 cancelled | 0 | `logs/web-tests.log` |
| 5 | `npm run typecheck` | clean | 0 | `logs/typecheck.log` |
| 6 | `npx esbuild web/public/app.js …` | 401.7 kb | 0 | `logs/esbuild-client.log` |
| 7 | `npx esbuild web/server.ts …` (the shipped entry) | 238.9 kb | 0 | `logs/esbuild-server.log` |
| 8 | `node scripts/browser.mjs` (copy, synthetic GitHub) | `pass:true`, 12 cases, 48 screenshots | 0 | `logs/browser.log`, `browser.json` |
| 9 | `node scripts/framing-promise.mjs` (D37–D39 non-regression) | 12/12, 0 CSP, 0 console | 0 | `logs/framing-promise.log`, `regression/` |
| 10 | `node --test test/shipped-parity.test.js` | 18/18 | 0 | `logs/shipped-parity.log` |
| 11 | `node scripts/note-copy-360.mjs` (my probe, both strings at 360 × EN/FR × light/dark) | `pass:true`, 8 screenshots, 0 page errors, 0 unexpected console errors | 0 | `logs/note-copy-360.log`, `note-copy-360.json` |
| 12 | `DELIVERY_DIR=…/V4-2-L4-delta node scripts/generate-delivery-smoke.mjs` | **14/14 PASS**, 191 captures, **341 s** | 0 | `logs/delivery-smoke.log`, `smoke.json` |

Run 4 was green at a 30 s per-file timeout this time, unlike the `670/670` load-conditional result in
`../V4-2-L4`. That does not close H3 from that review; the harness sensitivity is still there, it just
did not fire at this load. No assertion was changed or skipped anywhere.

## 8. Non-regression: D37/D38/D39

`git diff --name-status a7867e8..1d9f237` outside `.agents/` contains no canvas, framing, filter,
dependency or settings file — the five files in §2. The canvas framing constants
(`CANVAS_READABLE_MIN_SCALE = 0.55`, the outside-view legend, the D39 zoom-limit sentence) are not in
the delta, and the independent framing probe reproduces the same numbers the pre-change review
recorded: automatic zoom 0.55 at 360/390 and 0.785 at 1280, Show all 0.315/0.344 with 4/4 inside and
0 under the HUD, filter 0.55/0.915 — 12/12 PASS. Delivery smoke 14/14 covers list, canvas, sheets,
sidebar, filter, dependency, brand, settings, Operations/Archive/Client mode at 360/390/768/1280 in
EN/FR light/dark with 0 exceptions, 0 console errors, 0 CSP violations. Nothing in the non-regression
set moved.

## 9. Findings (none blocks publication)

### F1 — LOW — §2.5 understates when the option block ends, and "skipped" overpromises
`docs/issue-body-contract.md:49`. A non-list indented line, a wrapped gist or a nested checklist item
terminates the block, so later options disappear silently; the documented list of endings does not say
so, and "a malformed line is skipped" reads broader than the parser's behaviour. Same sentence in both
prompts (`panel/core.ts:1977`, `:2024`). Fix is one sentence: "any indented line that is not an option
line ends the option block; only invalid fields on a valid list item are skipped." Not blocking: the
happy path in the example and in the prompt is correct, and the degradation never corrupts a question
or an answer. The new test will not catch this either (§3).

### F2 — LOW — undocumented silent truncation of gist and details
200 / 2,000 characters (`web/server/board.ts:651-652`) with no stated cap; "details field is free
Markdown" implies otherwise. Consequence is a shortened paragraph in the drawer, never a wrong answer.

### F3 — INFO — the 4,000-character sentence is unreachable from the composer
`maxlength="4000"` on the textarea equals the server cap, so the corrected attribution is defensive
copy only. The 410/404 sentence is reachable and is the one users will actually see.

### F4 — INFO — the shipped panel bundle is hand-patched and pre-existing stale
`git diff` of a fresh `esbuild panel/main.ts` against the tracked `panel/main.js`: 23.8 KB larger, 754
diff lines, all in unrelated guest-service code (notifications/quota/tracker providers). The staleness
predates this delta (`panel/main.js` was 726,269 bytes at `a7867e8`, 727,299 now, +1,030 = the two
prompt strings). Agents therefore receive the new convention today (shipped-parity 18/18 proves the
strings match core), but a future `npm run build:panel` will ship unrelated source changes at the same
time. This is the same class as H9 in the previous review (`web/dist/server.mjs` is stale and must be
rebuilt for release).

## 10. What to tell the user before it goes live

1. **Agents get the convention through the prompt, not the skill.** The default drafting and alignment
   prompts now carry it and are sent as the session prompt. But a repo or global prompt template saved
   before this change overrides the default entirely (`ai_issue_prompt_{repo}`, `ai_issue_prompt_global`).
   If you have ever saved one, use "Reset prompts to default" or paste the new bullet in, or your agents
   keep writing plain questions.
2. **Presets render in the web board, not everywhere.** Decisions and the drawer render
   `  - label :: gist :: details`. The OpenChamber panel's own "Quick Choices" still uses the older
   `extractQuestionOptions` heuristics and will show no chips for these lines. Nothing breaks; the
   question is still answerable in prose.
3. **An author can lose options without noticing.** Keep option lines contiguous and unwrapped (F1);
   details over 2,000 characters are cut (F2).
4. **The 4,000-character refusal message is almost never shown** (F3); the message that will be seen is
   the 404/410 "conversation unavailable, reload" one, which is now accurate.
5. **Release must rebuild `web/dist/server.mjs`** (still stale, as flagged at `a7867e8`) and should not
   trust `panel/main.js` as reproducible from source until the unrelated bundle drift is rebuilt
   deliberately (F4).
6. Carried over, unchanged by this correction: a rejected note can still be reported as "outcome
   unknown" (nothing is claimed saved, text kept, Retry reconciles first); above 100 comments the note
   count is a floor and only the newest page is listed; a stale session's generic 403 reads as a
   permission problem; a human comment whose first line is the marker is displayed as a note under that
   author's name.

## 11. Not verified

- Real GitHub, production, any deployed instance. Every run used `web/tests/fake-github.mjs`.
- That a drafting model actually emits the convention after reading the prompt. The text is present in
  the prompt that is sent; its effect on a model was not measured.
- The `issue-lifecycle` skill's contents. It is not in this repository; if the installed skill restates
  the contract it may still carry the pre-v1.2 wording, and I could not read it.
- Safari, Firefox, a physical phone, a screen reader.
- Whether the release process rebuilds `web/dist/server.mjs` or `panel/main.js`.

## 12. Notes on method

DIDN'T WORK: my first 360 copy probe used `fake.state.commentHook` to produce the board's own 4,000-cap
message; the hook intercepts the board's call to *GitHub*, so the board reported
`400 invalid_note "GitHub rejected the note … (A note cannot exceed 4000 characters)"` and the
`agent_note_too_long` sentence never rendered.
FINALLY WORKED: intercepting the client's request with `page.route` and fulfilling the board's real
`{error:'note_too_long'}` body — which also exposed F3 (the textarea's `maxlength="4000"` means the
string is not user-reachable at all).

DIDN'T WORK: the same probe scored `pass:false` on console errors that were the deliberately injected
410 and 400 responses.
FINALLY WORKED: classifying `Failed to load resource … (400|404|410)` as expected HTTP errors, the way
the existing browser probe does with its `failureProbe` flag.

## 13. Files

- `mutation/` — the original document, its md5, and the four mutation logs with their failure output.
- `logs/` — every command's output plus an explicit `.exit` file per run.
- `browser.json`, `smoke.json`, `regression/`, `*-measurements.json` — my runs of the existing probes.
- `note-copy-360.json` + `screenshots/note-410-*.png`, `note-4000-*.png` — the copy check at 360.
- `probe-doc-claims.log`, `probe-answer-preserves-options.log`, `i18n.json` — parser-versus-document and
  dictionary evidence.
- `scripts/` — copies of the existing probes (same directory depth, so their output lands here) and my
  `note-copy-360.mjs`.
