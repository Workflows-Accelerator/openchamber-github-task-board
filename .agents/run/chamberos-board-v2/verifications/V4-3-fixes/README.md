# V4-3 fixes: F1–F4 from the independent L4 review

Reviewed finding source: `../V4-3-L4/README.md` (review range `a6f61f3..4b9c216`).
Fixed range: `d29699f..c318f33` on `feat/board-v3`.
Local synthetic only: fake GitHub, local board, Playwright routes. No real GitHub write, no push, no deploy. Nothing under `V4-1-L4/`, `V4-2*` or `V4-3-L4/` was touched; the probes were run from copies in `scripts/`.

## Findings, fixes, tests

### F1 (Medium, blocked publish): answering a gated question overwrote any status

- Fix `1ebd9e8`: `web/server/app.ts` — the `status:in-progress` label write on a gated answer is now conditioned on `isHumanReviewGateStatus(baseStatus)`, the status the issue carries at write time. A `done`, `in-review`, `todo` or `in-progress` task keeps its status; only a `status:needs-human` task leaves the waiting column.
- Test: `V4-3 answering a gated question only moves a waiting task to in-progress` (`web/tests/v4-3-human-review.test.mjs`). Covers `done`, `in-review`, `todo`, `in-progress` (status kept, gate still `settled`) and `needs-human` (moves to `status:in-progress`, `status:needs-human` removed).
- The pre-existing `V4-3 answering the gated question is allowed and settles the artifact` still proves the waiting task leaves the waiting column.
- Reproduced before the fix with `../V4-3-L4/scripts/followup.mjs`: `answerOnDone` gave `statusLabel: status:in-progress`. After: `statusLabel: status:done`, gate `settled`.

### F2 (Low): creation with two status labels split the card and its column

- Chose **refuse the conflict**, not "apply the gate as a needs-human creation". Reason: two status labels are ambiguous by construction (`statusLabelOf` reads the first, `resolveIssueColumn` the waiting one), and `applyStatusChange` already enforces one status label on every other write path. Refusing keeps one invariant instead of inventing a precedence rule, and writes nothing.
- Fix `42556ee` + `c318f33`: `web/server/app.ts` create route returns 400 `conflicting_status_labels` naming the distinct labels before any GitHub call. `c318f33` counts **distinct** labels, so the same label twice is one status and still creates.
- Tests: `V4-3 creation refuses conflicting status labels instead of splitting the card` (400, precise message, `fake.issues.length` unchanged, 0 PATCH calls, single label still 201, repeated same label 201).
- Reproduced before the fix with `followup.mjs`: `createTwoStatusLabels` 201, `statusLabel: status:todo`, `column: needs-human`. After: 400, no issue created.

### F3 (Low): a question gate with no preset answers was accepted

- Fix `982daab`: `web/server/board.ts` — a `question` artifact whose open question has no `  - label :: gist :: details` line is `malformed` with reason `missing_options` (new reason), message naming the missing preset line. The free-text answer path is unchanged and stays alongside the presets.
- Refused server-side by the existing guards, because they require `state === 'ready'` (create, status write, body edit, reopen).
- Tests:
  - `V4-3 a question artifact must offer at least one preset answer` (parser: `malformed` / `missing_options`, message mentions presets; one preset line makes it `ready` with 2 options).
  - `V4-3 a question gate without presets is refused server-side and writes nothing` (create 400 `human_review_required`, no write; `QUESTION_BODY` with presets 201 `ready`).
  - Added to the reason table: `['### Open Questions:\n- [ ] Is the wording right?\n\n### Human Review:\n- Artifact: question\n', 'malformed', 'missing_options']`.
  - Client: `V4-3 client: a question gate without presets names the missing presets in English and French`.
  - Docs lock tests (`§2.9` example parses, mutation fails, document byte-identical) still pass.
- Docs and prompts, kept in parity: `docs/issue-body-contract.md` §2.9 (the `question` bullet and the "Reconciliation" paragraph now say at least one preset is required), `panel/core.ts` and shipped `panel/main.js` `DEFAULT_AI_ISSUE_PROMPT` / `DEFAULT_AI_ALIGNMENT_PROMPT`. The parity test passes.

### F4 (Low): imprecise client reason for an invalid URL

- Fix `0da2997`: the parser message and both client strings now state the constraints the parser actually enforces — one `http://`/`https://` link, at most 2048 characters, no spaces. The reason code stays `invalid_url`, so no API shape change; EN and FR say the same thing.
- Chose localized precise text over rendering the server's English `review.message`, so a French reader keeps the same precision. The two texts are kept word-for-word equivalent.
- Tests: `V4-3 an invalid URL reason names the length limit and the no-space rule` (parser, 2049 chars and a space), `V4-3 client: an invalid URL reason states the real limit and the no-space rule in English and French`.
- One existing expectation was updated, not loosened: `V4-3 client: a malformed artifact is reported with its precise reason` asserted the old false string (`must start with http:// or https://`) and now asserts the new full sentence.

## Suites (re-run sequentially at `c318f33`, final code)

| Check | Result | Exit | Log |
|---|---|---|---|
| Focused V4-3 (`v4-3-human-review` 23 + `v4-3-client` 18) | 41/41 pass | 0 | in session |
| `node --test --test-timeout=60000 web/tests/*.test.mjs` | 713/713 pass, 51.6 s | 0 | `logs/web-suite.log`, `.exit` |
| `npm test` | 618/618 pass, 17.0 s | 0 | `logs/npm-test.log`, `.exit` |
| `npm run typecheck` | clean | 0 | `logs/typecheck.log`, `.exit` |
| esbuild `web/server.ts` | 247.2 kb | 0 | `logs/esbuild-server.log`, `.exit` |
| esbuild `web/public/app.js` | 414.9 kb | 0 | `logs/esbuild-client.log`, `.exit` |
| V4-3 browser probe (copy) | 84 rows, 1248 assertions, 0 failed, 84+12 screenshots, 0 CSP/page/console errors | 0 | `logs/browser.log`, `browser.json` |
| Hostile parser/routes attack (copy) | 28 parser cases, 15 route cases; 1 parser expectation mismatch (expected, below), 0 route mismatches | 0 | `logs/attack-parser-routes.log`, `.exit` |
| Hostile browser attack (copy) | 7 states, 30 assertions, 0 failed, 0 CSP, 0 page errors, 1 expected 404 console line | 0 | `logs/attack-browser.log`, `.exit` |
| Delivery smoke | 14/14 PASS, 172 cases, 191 captures | 0 | `logs/delivery-smoke.log`, `.exit`, `smoke.json` |

Baselines the focused count moves from: 34 to 41 (7 new tests, 1 parser case added to an existing table).

Not run, on purpose:
- Framing probe: no layout, CSS or `index.html` change; the diff touches no geometry.
- The delivery smoke was run although the human-review panel is not one of its surfaces, because F3/F4 changed the shipped client and the parser; it is the released non-regression check.

### Expected deltas in the copied evidence scripts (intended, not failures)

1. `scripts/attack/parser-and-routes.mjs` case `question with javascript: URL is silently accepted` expected `ready` with 0 options; it is now `malformed` / `missing_options`. That is F3. The committed script under `V4-3/` keeps the old expectation and was not edited.
2. `scripts/browser.mjs` (copy) expected the old imprecise `invalid_url` sentence in its reason dictionary. Only those two strings (EN, FR) differ from `V4-3/scripts/browser.mjs`; the copy now expects the F4 sentence. Without that update the probe reports 12 failures that are all the old string.

## Hostile self-review of `d29699f..c318f33`

Read the whole diff as if it were wrong.

- **F3 and existing valid data.** Grepped every `Artifact:` occurrence outside `node_modules` and prior evidence: `web/tests/v4-3-human-review.test.mjs`, the V4-3 and V4-3-L4 probe fixtures, docs and prompts. Every `Artifact: question` fixture carries at least two preset lines; the delivery smoke has no human-review fixture at all. Confirmed green: 713 web tests, 618 npm tests, 84-row probe, 14/14 smoke. No fixture was turned malformed by accident.
- **F1 still moves a waiting task.** The `needs-human` leg of the new test asserts `status:in-progress` and that `status:needs-human` is gone, through the real answer route and the fake GitHub write. The gate-settled assertion proves the answer was accepted, not ignored.
- **F1 ordering.** `baseStatus` is read from the freshly fetched issue before the answer is applied, and the label change is skipped entirely for non-waiting tasks, so no empty `labels` patch is sent.
- **F2 correction found during this review.** The first version counted status labels with duplicates (`['status:todo','status:todo']` would have been refused). A false refusal is a product change nobody asked for; `c318f33` counts distinct labels and a test pins it.
- **F3 legacy behaviour.** A preset-less question gate already waiting in the wild now reads "Waiting for an artifact" with `missing_options`, and the question stays in the Open Questions list (the gate panel only claims it when `ready`), so the human can still answer it and settle it. No dead end, but see the carried caveat.
- **F4 consistency.** Server message and both dictionary strings state the same three constraints; `insecure_url`, `missing_instruction` and `long_instruction` are untouched.
- **No debug output, no commented-out code, no incidental reformatting.** `git diff --stat d29699f..c318f33`: 8 files, +216/−22 (190 of the added lines are the 7 new tests), all of it named in this README.

## Carried (out of scope for this brief, not fixed)

- **F5**: the Operations view and `panel/labels.ts` still say "Needs human" / "In review"; the OpenChamber panel renders no gate.
- **F6**: the main 84-row probe still records `panelVisible.expected:false`, asserts `instructionVisible` as `height > 0` only, and records `inViewport` without asserting it. The hostile `attack/browser.mjs` covers those 7 states properly.
- **L1** (external `status:needs-human`): a tool outside the board can still mark a task waiting without an artifact; the card says "Waiting for an artifact" with the reason and the status control moves it out in one write.
- **L4 caveat** (saved `ai_issue_prompt`): a saved custom prompt overrides the new default, so an agent may still try to set `needs-human` without a gate; the server refuses with 400 `human_review_required`.
- **L4 caveat** (review images): CSP `img-src https:` means opening a drawer fetches a third-party image, so that host sees the viewer's IP; the referrer is suppressed.
- **L4 caveat** (matrix-picker frames): the smoke picker capture can differ by 1 px while the sheet is still transitioning; content and geometry assertions pass.
- **New from F3**: an existing issue that is waiting today with a preset-less question gate becomes `malformed` and must be given a preset line (or answered, then moved back) before it can wait again. Tell the user before publishing.
- **New from F2**: a caller that sent two status labels in one create now gets 400 `conflicting_status_labels` instead of a split card.
- **Stale expectations in prior evidence**: `V4-3/scripts/attack/parser-and-routes.mjs` still expects a preset-less question to be `ready`, and `V4-3/scripts/browser.mjs` still expects the old URL sentence. Both are prior evidence and were left untouched; the copies under `scripts/` carry the current expectations.

## Not verified

- No real GitHub repository was touched; every result above is against the synthetic fake GitHub.
- No human opened the board; no claim of review, publication or acceptance.
- The framing probe was not run (no layout change).
