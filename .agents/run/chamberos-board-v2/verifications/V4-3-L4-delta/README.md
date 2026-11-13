# V4-3 independent L4 review — delta d29699f..68c5053 (F1–F4 corrections)

Reviewer: independent of the author of the fixes and of the manager who wrote the brief.
Reviewed range: `d29699f..68c5053` on `feat/board-v3` (HEAD `68c5053`). The full change under
publication is `a6f61f3..68c5053`. Application code at `c318f33`; `68c5053` is evidence only
(verified: no non-`.agents/` path in that commit).
Local synthetic only: fake GitHub, local board, Playwright routes. No real GitHub write, no push,
no deploy, no application file modified. Nothing under `V4-1-L4/`, `V4-2*`, `V4-3/` or
`V4-3-L4/` was edited; probes ran from copies in `scripts/`.

## Verdict

| | Verdict |
|---|---|
| DELTA `d29699f..68c5053` | **PASS**, with one Low documentation/prompt defect (F3-docs, below). The four fixes are minimal, they hold on the paths I attacked before, and they change nothing outside their findings. |
| PUBLISH `a6f61f3..68c5053` | **YES**, with the caveats at the end. F1 (the Medium that blocked) is fixed and proven. F2/F3/F4 are Low and correct. |

Why PASS and not FAIL with a defect: every finding of mine that blocked is closed; the remaining
defect is a contradictory sentence in developer documentation and in the agent prompt's
Open Questions bullet. It cannot create a bad card or a dead end; the worst outcome is an honest
400 that names the missing preset. It should be fixed next, not held against the code.

## Method

1. Read `git diff d29699f..68c5053` in full, then each fix commit separately
   (`1ebd9e8`, `42556ee`, `c318f33`, `982daab`, `0da2997`): each touches only its own files.
2. Re-ran my own attack scripts from the previous review (copies under `scripts/`), updated only
   where the F3/F4 rule legitimately changed the expectation, and fixed the three fixture
   mistakes I had recorded in `V4-3-L4/README.md` (issue 20 reuse, injected heading, issue 30's
   prior `status:todo`). Each edit is listed under "Changes to my own probes".
3. Wrote two new probes: `scripts/delta.mjs` (F1 five statuses, F2 refusal, F3 four entry paths,
   F4 eight URL causes) and `scripts/browser-delta.mjs` (what the reader sees, 360/1280,
   light/dark, EN/FR).
4. Re-ran every suite sequentially, plus a controlled docs-mutation experiment.

## Suites (re-run sequentially at 68c5053)

| Check | Result | Exit | Log |
|---|---|---|---|
| Focused V4-3 (`v4-3-human-review` + `v4-3-client`) | 41/41 pass, 3.6 s | 0 | `logs/focused-v4-3.log`, `.exit` |
| Web suite `node --test --test-timeout=60000 web/tests/*.test.mjs` | 713/713 pass, 39.1 s | 0 | `logs/web-suite.log`, `.exit` |
| `npm test` | 618/618 pass, 14.7 s | 0 | `logs/npm-test.log`, `.exit` |
| `npx tsc --noEmit` | clean | 0 | `logs/typecheck.log`, `.exit` |
| esbuild `web/server.ts` | 247.2 kb | 0 | `logs/esbuild-server.log`, `.exit` |
| esbuild `web/public/app.js` | 414.9 kb | 0 | `logs/esbuild-client.log`, `.exit` |
| V4-3 browser probe, **committed expectations** (copy) | 84 rows, 1248 assertions, **12 failed**, 84+12 shots, 0 CSP/page errors | **1** | `logs/v4-3-browser-committed.log`, `logs/v4-3-browser-committed.json` |
| V4-3 browser probe, current expectations (author's copy, diff-verified) | 84 rows, 1248 assertions, 0 failed, 0 CSP/page errors | 0 | `logs/v4-3-browser-current.log`, `logs/v4-3-browser-current.json` |
| Framing probe (copy) | 12/12; floor 0.55; Show all 0.315 (360) / 0.344 (390); 1280 at 0.785, filter 0.915 | 0 | `logs/framing.log`, `regression/` |
| Delivery smoke (`DELIVERY_DIR` = this dir) | 14/14 sections PASS, 191 captures, 0 exceptions/console/CSP | 0 | `logs/delivery-smoke.log`, `.exit`, `smoke.json` |
| My L4 browser probe (copy) | 72 rows, 592 assertions, 0 failed, 0 CSP/page errors | 0 | `logs/l4-browser.log`, `l4-browser.json` |
| Cap probe (360, EN/FR) | 6/6 | 0 | `logs/caps.log`, `l4-caps.json` |
| Delta browser probe (new) | 29 rows, 182 assertions, 0 failed, 0 CSP/page errors | 0 | `logs/delta-browser.log`, `delta-browser.json` |
| My attack script (updated) | 49 parser + 54 route checks, 0 failures | 0 | `logs/attack.json`, `logs/attack.err` |
| Delta API probe (new) | 13 parser + 24 route checks, 0 failures | 0 | `logs/delta.json`, `logs/delta.err` |
| Follow-up reproduction (my F1/F2 probe) | reproductions recorded | 0 | `logs/followup.json` |
| Qualified multi-repo route attack | 5/5 as expected | 0 | `logs/qualified.json` |
| Author's parser/route attack (copy) | 28 parser, 15 route; 1 documented F3 mismatch, 0 route mismatches | 0 | `logs/author-parser-and-routes.json` |
| Author's hostile browser attack (copy) | 7 states, 30 assertions, 0 failed, 1 expected 404 console line | 0 | `logs/author-attack-browser.log` |

The committed V4-3 browser probe fails 12 assertions and only those: every `malformed` matrix row
(360/390/1280 × light/dark × EN/FR), because its `malformed.reason` dictionary still expects the
old `must start with http:// or https://` sentence. No other state or assertion failed. I diffed
the author's copy against the committed one: the only difference is those two strings (EN, FR).
So the F4 change is exactly what the probe sees, and the stale evidence is the probe, not the
product.

## F1 (Medium, blocked publication) — fixed

`web/server/app.ts` now gates the `status:in-progress` label write on
`isHumanReviewGateStatus(baseStatus)`. `baseStatus` is `statusLabelOf(labelNames(fresh.item))`
read from the freshly fetched issue (line 2296) and is not reassigned on the `question` path.

| Path | Before (my L4 evidence) | After (this run) |
|---|---|---|
| answer on `status:done` | `status:in-progress` | `status:done`, gate `settled`, labels unchanged |
| answer on `status:in-review` | `status:in-progress` | `status:in-review`, gate `settled` |
| answer on `status:todo` | `status:in-progress` | `status:todo`, gate `settled` |
| answer on `status:in-progress` | `status:in-progress` | `status:in-progress`, gate `settled` |
| answer on `status:needs-human` | `status:in-progress` | `status:in-progress`, `status:needs-human` gone, gate `settled` |

The reverse holds too. API: the board row for the answered waiting task has
`column: in-progress` and `statusLabel: status:in-progress` (`logs/delta.json`
`answer on a waiting task…`). Browser: a real radio click and submit moved the card from
`needs-human` to `in-progress`, the panel hid, and the board row column became `in-progress`
(`delta-browser.json` `interactions.answerWaiting`). A waiting task whose question is already
answered reads "Answer received" / "Réponse reçue" and says the agent must pick it up again, in
EN and FR, with no action (`delta-settled-en/fr`). No empty label patch is sent on the four
non-waiting paths (the stored label array is byte-identical before and after).

Ordering and blast radius: the answer still settles the gate on every status (the new test and
my probe assert `settled`, so the answer is accepted, not ignored), and the guard that refuses a
body edit which breaks a ready gate is untouched (`op.kind !== 'question'` exemption unchanged).

## F2 (Low) — fixed

Refused: a create whose labels carry **two or more distinct** status labels, normalised
(trim + lowercase). `400 conflicting_status_labels`, message
`Creation carries 2 status labels (status:todo, status:needs-human); an issue has exactly one
status label.` Nothing is written: `fake.issues` unchanged, 0 PATCH calls, 0 non-GET requests.

Not refused, verified: the same label twice (`201`), the same label in two cases
(`['status:todo','STATUS:TODO']` → `201`), one status plus a normal label
(`['status:todo','priority:high']` → `201`), and a legitimate single-status
`needs-human` create whose body carries a ready image or question artifact (`201`, `ready`).
Counting distinct labels is the right call: the first version's false refusal of
`['status:todo','status:todo']` would have been a product change nobody asked for.

Client: no board surface can send two status labels. The quick-add form sends
`['status:draft']`; the offline draft queue stores `['status:draft']`; the draft-sync retry
re-sends that stored array. So there is nothing in the UI to show this error to, and the API
caller gets the precise message. The generic create catch does render `error.message` verbatim
(`web/public/app.js` quick-add catch), so a future path that could trigger it would display it.

## F3 (Low) — fixed in code, incomplete in documentation

The manager's decision (a question gate must offer at least one preset, because the user's rule
is "une question avec des réponses préfaites") is implemented: a `question` artifact whose first
unanswered `### Open Questions:` item has no `  - label :: gist :: details` line is `malformed`
with the new reason `missing_options`, and the message names the missing line. One preset line is
enough (2 options are not required).

Malformed everywhere it can appear — all verified:

| Entry path | Result |
|---|---|
| create `status:needs-human` | `400 human_review_required`, 0 writes, nothing created |
| status route (todo task, preset-less body) | `400 human_review_required`, 0 writes, stays `status:todo` |
| body edit replacing a ready gate with a preset-less one | `400 human_review_required`, 0 writes, stored body unchanged |
| reopen a closed task whose gate has no presets | `400 human_review_required`, 0 writes, stays closed |
| live issue edited on GitHub | reads `malformed` / `missing_options`, stays in the waiting column, card says so |
| body edit that keeps the presets | `200` |

Not a dead end. The gated question is only claimed by the gate panel when the artifact is
`ready` (`gatedQuestionIndex` returns -1 otherwise), so a preset-less question stays in the
Open Questions list with a bare text input and no radios. Browser, 360/1280, light/dark, EN/FR:
one form, `#answer-0`, zero radios, and a typed answer submits: the gate settles, the card reads
"Answer received", and the status control moves the task out in one click
(`delta-browser.json` `typedAnswerOnPresetLessGate`). API: the answer is accepted (`200`) and the
free-text answer path is unchanged for preset questions too — an answer that is not one of the
presets is accepted (`'Something else entirely'` → `200`, gate settled). So the free-text path
survives exactly as the manager required: presets are offered, typing is still possible.

The one defect: the rule now contradicts text the fix left untouched.

- `docs/issue-body-contract.md` §2.5: heading "Preset answer options (optional)" and
  "presets are suggestions, never a required choice, and every question must remain answerable
  in prose" — while §2.9 now says "At least one preset line is required".
- `panel/core.ts` / `panel/main.js`, `DEFAULT_AI_ISSUE_PROMPT`, Open Questions bullet:
  "every question must keep a free-text answer path (presets are suggestions, never a required
  choice)" — while the Human Review bullet in the same prompt says "at least one preset is
  required".

A careful reader can scope the absolute sentence to ordinary questions and the gate rule to
gates, but the prompt now says both things in one message. The likely outcome is an agent that
omits the preset and receives a 400 naming it, which is recoverable and honest. Recommended
one-clause fix: "presets are optional for an ordinary question; a human-review question gate
requires at least one". Not a publish blocker, because the operative gate rule is explicit and
adjacent, and the refusal is precise.

Docs and prompt parity otherwise holds: §2.9's `question` bullet and its reconciliation
paragraph were updated, `panel/core.ts` and the shipped `panel/main.js` carry the same new
sentence, and the parity test (`prompts document the human gate identically…`) passes.

### Documentation lock: what it catches, and what it does not

Two controlled mutations of `docs/issue-body-contract.md`, each restored and sha256-verified
(`4ee0bbfc…`, `git status` clean):

1. Fenced §2.9 example, `- Artifact: image` → `- Artifact: screenshot`: **2 of 3** contract
   tests fail (`unknown_artifact`). The lock works.
2. The new §2.9 prose, "At least one preset line is required…" → "Presets remain suggestions":
   **all 4** contract/prompt tests pass. The prose that carries the F3 rule is not locked.

So the answer to "does the documentation lock test still fail under a mutation?" is yes for the
example and **no** for the new rule. The prose can silently drift back to the old behaviour.
Low; worth one assertion (`/at least one preset/` in the §2.9 slice) whenever F3-docs is fixed.

## F4 (Low) — fixed

Server message and both client dictionary strings now state the constraints the regex actually
enforces: one `http(s)` link, at most 2048 characters, no spaces. EN and FR are word-for-word
equivalent, and the reason code stays `invalid_url` (no API shape change). The client still maps
reason → localised string rather than rendering the server's English message, which is the right
choice for a French reader.

Eight refusal causes checked (`logs/delta.json` parser group); the message is accurate for:

| Case | Named correctly |
|---|---|
| 2049 characters | "at most 2048 characters" |
| URL with a space | "with no spaces" |
| relative `/preview/login` | "must be an http:// or https:// link" |
| `javascript:` | same |
| `data:` | same |
| `https://` with no host | "must be … link" (no host is arguably not a link) |
| URL with a double quote | **not named** |
| URL with a backslash | **not named** |

No case where the new text is false: every listed condition really is required. Three causes
(no host, quotes, backslashes) are still not named, so for those the reader learns what is
allowed rather than what they broke. That is the same class of imprecision F4 complained about,
reduced from "always wrong about the length/space case" to "incomplete for three rarer causes".
Not a regression; residual Low. EN and FR render on the card at 360/1280 in both themes with the
length and no-space text (`delta-browser.json`).

## Regression

- Grep for `Artifact: question` outside `node_modules` and prior evidence: only
  `web/tests/v4-3-human-review.test.mjs`. Its `QUESTION_BODY` carries two presets; the only
  preset-less bodies are the new negative fixtures. The delivery smoke
  (`scripts/generate-delivery-smoke.mjs`) has no `Artifact:` and no `Human Review` section at all;
  its one waiting fixture is a `makeIssue` seed with `['status:needs-human','priority:urgent']`,
  which is one status label, so F2 does not touch it. No fixture, smoke card or probe question
  silently became malformed: 713 + 618 tests, the 84-row probe and 14/14 smoke are green.
- `statusLabelOf` was rewritten to delegate to `statusLabelsOf`; behaviour is identical (first
  normalised status label, `null` when none), and the only new caller is the create guard.
- `parseHumanReview`'s question branch now always sets `question.options`; the guard above
  guarantees a non-empty array, so the removed conditional is equivalent.
- Stale expectations remain in prior evidence, by design and not edited: `V4-3/scripts/browser.mjs`
  (old F4 sentence, 12 assertions), `V4-3/scripts/attack/parser-and-routes.mjs` (preset-less
  question expected `ready`), and my own `V4-3-L4/scripts/attack.mjs` (two parser cases and one
  route case). Anyone re-running those will see exactly those deltas.

### Changes to my own probes (so the evidence is reproducible)

`scripts/attack.mjs`: two parser expectations moved to `malformed/missing_options` (F3), one
added (`one preset is ready`); the preset-less create case now expects `400` and nothing created;
a preset-less status-route case and a reopen case were added; the three known fixture mistakes
from my previous review were fixed (clean `status:todo` fixtures instead of reused issue 20/30,
and the injected-heading case now asserts the benign `200` + `ready` outcome instead of a
refusal); F2 create cases and a board-column check for the answered task were added.

`scripts/browser.mjs` and `scripts/caps.mjs` are unmodified copies and pass unchanged, which
confirms my previous UI evidence did not depend on the old URL sentence.

## The two caveats the author recorded

1. **A live preset-less question gate reads malformed until given a preset.** Acceptable, but the
   consequence is slightly worse than the record says: answering it settles the gate and the task
   **stays** in `status:needs-human` with an "Answer received" card, so the reader must also move
   it with the status control (previously the answer moved it automatically). Verified both ways:
   the typed answer is accepted, the card is honest, and the status control moves it out in one
   write. No dead end, no migration needed for correctness, but the user should be told.
2. **A create with two status labels now gets 400.** Acceptable. No board surface can send it, the
   previous behaviour was a split card (worse), and the message is precise. No migration story
   needed.

## Carried, not fixed (unchanged from V4-3-L4)

F5 (Operations view and `panel/labels.ts` still say "Needs human" / "In review"; the panel renders
no gate), F6 (the main probe's `panelVisible.expected:false`, `instructionVisible` as
`height > 0`, unasserted `inViewport`), L1 external `status:needs-human`, the saved
`ai_issue_prompt` override, `img-src https:` third-party fetch, and the matrix-picker frame that
can be captured mid-transition.

## Noticed, not changed (outside the delta)

- A `done` task whose gate is a ready question renders no gate panel (the panel only shows for
  `needs-human` / `in-review`) and the gated question is filtered out of the Open Questions list,
  so it cannot be answered anywhere in the UI. Pre-existing, unchanged by F1, and no longer
  dangerous now that an API answer cannot steal the status. `delta-browser.json`
  `interactions.doneTaskGate`.
- The shipped `panel/main.js` is stale relative to `panel/main.ts` in unrelated areas: a fresh
  `esbuild panel/main.ts` bundle differs in the guest-tool constants
  (`GUEST_TOOL_CARD_*`, `GUEST_PROVIDER_LOGOS_MAX`, `GUEST_STATUS_SECTION_HEIGHT_MAX` 320 vs 480,
  and 870 differing lines). The F3 prompt sentence is present and in parity, and this drift is
  not caused by these commits, but the shipped bundle is not a build of the current source.
- The settled card repeats itself: "The question is answered. The agent has to pick this task up
  again. The question is already answered." Pre-existing copy.

## Caveats to tell the user before it goes live

- A task now waits for you only with a screenshot, short video, link, or a question that offers
  at least one preset answer. Anything else is refused by the board.
- A question gate with no preset answer is refused. If such a task is already waiting, the card
  says "Waiting for an artifact" and you can still type an answer; after answering, use the
  status control to send it back to the agent.
- A task marked waiting from outside the board still shows "Waiting for an artifact"; the status
  control sends it back.
- A saved custom AI issue prompt replaces the new default. Reset it so agents attach an artifact
  with at least one preset when they ask a question.
- Review images load from their https host when you open the task, so that host sees your IP.
- The Operations view and the OpenChamber panel still say "Needs human" / "In review" (F5).
- Documentation follow-up (Low): §2.5 and the Open Questions prompt bullet still call presets
  optional, while §2.9 requires one for a gate. The code is right; the sentence is stale.

## Not verified

- No real GitHub repository was touched; every result is against the synthetic fake GitHub.
- No human opened the board; no claim of review, publication or acceptance.
- The OpenChamber panel was not loaded in a real OpenChamber session; only its prompt constants
  were compared and exercised through the parity test.
- The delivery smoke's wall-clock time was not recorded; it completed with exit 0 inside the
  900 s foreground timeout.
