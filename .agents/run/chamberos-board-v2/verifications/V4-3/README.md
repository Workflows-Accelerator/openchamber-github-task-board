# V4-3 recovery evidence

Status: checkpoint committed, verification incomplete. Local synthetic only; no real GitHub write and no deployment.

## Inherited diff disposition

- `web/server/board.ts`: kept section/type/payload architecture and fence-aware scanner; fixing unchecked URL parsing, duplicate-section ambiguity, question gates without presets, and precise missing-question reasons. Inherited parser was untested.
- `web/server/app.ts`: kept server guard intent; fixing status-entry coverage (creation, reopen/patch, legacy aliases, removal exposing waiting labels), and body edits invalidating an existing gate. Kept CSP image allowance limited to HTTPS; correcting misleading comment. No script/style/connect/frame relaxation.
- `web/public/app.js`: kept equal EN/FR keys and agent-review distinction; finishing render/actions and accurate translated reasons. Inherited strings alone did not render the feature.

## Checkpoint evidence

Focused suites, run on the committed tree:

```
node --test --test-timeout=60000 web/tests/v4-3-human-review.test.mjs web/tests/v4-3-client.test.mjs
```
Result: 27 tests, 27 pass, 0 fail, exit 0.

Full suite, run by the manager on this same tree:

```
node --test --test-timeout=60000 web/tests/*.test.mjs
```
Result: 699 tests, 698 pass, 1 fail, exit 1. The single failure is an environment failure, not V4-3 code: `simple-views.test.mjs:433` — "F9: default startBoard and browserConfig isolate project-names.json per fixture" — `ENOENT: mkdtemp '/tmp/antigravity/f9-isolation-ywyneF'`, a missing temporary directory in this environment.

No assertion was weakened and no test was skipped to reach these numbers. The full suite was not re-run for this checkpoint; the manager's counts are recorded as given.

## Browser evidence

Probe: `scripts/browser.mjs`, run from this directory as

```
source ../V4-2/scripts/browser-env.sh && node scripts/browser.mjs
```

Result on the committed tree: `pass: true`, 84 matrix rows, 84 screenshots
(plus 12 extra `-answer` shots for the question gate), 1248 recorded
assertions, 0 failed assertions, 0 page errors, 0 console errors, 0 CSP
violations, exit 0. Report: `browser.json`; images: `screenshots/`.
Implementation under test: `cd97f8e` (`web/server/board.ts`), probe `6127e35`,
Chromium 156.0.8078.4. Local synthetic only: fake GitHub API, local board, no
real GitHub call, no deployment.

Matrix: seven states x three viewports (360x800, 390x844, 1280x900) x two
themes (light, dark) x two languages (EN, FR) = 84 rows, one screenshot each
named `{state}-{width}-{theme}-{lang}.png`. The language is switched through
the real `#lang-switch-btn` control and asserted on `document.documentElement.lang`;
no text is rewritten.

Per state, in the real DOM (12 rows each):

| State | Asserted | Result |
|---|---|---|
| image | title, exactly 1 primary action (`Open screenshot` / `Ouvrir la capture`) with the artifact href and `rel="noopener noreferrer"`, one-line instruction visible, one inline `<img>` with non-empty alt and `naturalWidth` 320, no button, no inline video | 19 checks x 12, all pass |
| video | 1 action (`Watch the video` / `Regarder la vidéo`), instruction visible, no inline `<video>`, no image | 16 x 12, all pass |
| link | 1 action (`Open the link` / `Ouvrir le lien`), instruction visible | 16 x 12, all pass |
| question | 1 primary action (`Answer` / `Répondre`, a submit button), 2 preset option cards, 2 `Details`/`Détails` disclosures that start `aria-expanded="false"` and reveal the details text, free-text path `Write another answer` / `Écrire une autre réponse` open with a visible `#answer-0` field | 16 x 12, all pass |
| legacy (`status:needs-human`, no section) | title `Waiting for an artifact` / `En attente d’un élément à valider`, precise reason `The body has no "### Human Review:" section.` / `Le corps n’a pas de section « ### Human Review: ».`, panel state `missing`, 0 actions, 0 links, 0 buttons, 0 images | 13 x 12, all pass |
| malformed (`javascript:` URL) | same missing title, precise reason `The "- URL:" value must start with http:// or https://.` / `La valeur de « - URL: » doit commencer par http:// ou https://.`, panel state `malformed`, 0 actions, 0 links, 0 buttons | 12 x 12, all pass |
| in-review (no artifact) | title `Agent reviewing` / `Agent en revue`, body `The agent is reviewing this task. Nothing is asked of you.` / `L’agent révise cette tâche. Rien ne vous est demandé.`, neither waiting title and no missing-section reason, 0 actions, 0 links, 0 buttons | 12 x 12, all pass |

Framing: `document.documentElement.scrollWidth` equals the viewport width in all
84 rows (360, 390 and 1280), so there is no horizontal page scroll. No gate
element inside `#human-review` crosses its container box in any row: 0 of 28
rows at 360x800 and 0 of 28 at 390x844, and the panel's own
`scrollWidth` never exceeds its `clientWidth`.

Fixture adjustments, recorded in `browser.json` under `fixture.adjustments`:

- Every waiting fixture is born with `status:needs-human` in the fake GitHub
  state, so this probe issues no status write. The V4-2 probe flipped issue 1
  to `needs-human` through the UI, which V4-3 now refuses without an artifact;
  that refusal is covered by `web/tests/v4-3-human-review.test.mjs` and is not
  re-exercised in the browser.
- The image artifact URL `https://example.com/screenshots/login-empty.png` is
  fulfilled by a Playwright route with a synthetic 320x200 PNG so the inline
  render and its natural width are measurable offline. The URL in the issue
  body is not rewritten and the parser still sees the https URL. No other
  network request exists, so no console error needed an "expected HTTP failure"
  classification; `expectedHttpErrors` is empty.
- The legacy and malformed fixtures deliberately carry a body the V4-3 parser
  refuses, because those states exist to show the reason.

Probe defects found and fixed during this work, both in the probe only, with no
assertion weakened and no application change:

1. The first run asserted that the legacy card must not say "nothing you can
   click". That sentence is exactly what the product should say; the assertion
   direction was wrong. It was replaced by three positive checks: the card names
   the reason, its panel state is `missing`, and it says in the reader's words
   that there is nothing to click. 12 failures (one per legacy row) in that run,
   all probe defects; the corrected probe passes.
2. The first framing scrolled the gate under the sticky drawer identity bar at
   1280 and cropped the question gate's single `Answer` action on phones. The
   probe now scrolls only when needed and takes a second `-answer` shot per
   question row so the one primary action is visible.

Not covered by this evidence: the write-path refusal in the browser (unit
tests only), real GitHub, production, Safari, Firefox, a physical phone and a
screen reader.

## Framing and delivery smoke

Both long-running proofs, run on the committed tree (`b57e894`, implementation
`cd97f8e`) with the Chromium environment from
`.agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh`.

### Framing promise probe

Probe copied unchanged from `../V4-2/scripts/framing-promise.mjs` to
`scripts/framing-promise.mjs` at the same directory depth, so its relative
imports resolve. Run from this directory:

```
source ../V4-2/scripts/browser-env.sh && node scripts/framing-promise.mjs
```

Result: 12/12 cases pass, 0 CSP violations, 0 console problems, exit 0, 55 s.
Raw log: `logs/framing-promise.log`; exit: `logs/framing-promise.exit`;
data: `regression/framing-promise.json`; images: `regression/screenshots/`
(40: framed, show-all, filtered, filtered-show-all per case).

Each width row is identical across light/dark and EN/FR; the values below are
the measured ones for all four combinations.

| Width | Automatic scale | Limit legend | Show-all scale | Cards inside after Show all | Cards under HUD after Show all |
|---|---|---|---|---|---|
| 360x800 | 0.55 | yes — "Connected tasks are outside this view." + "Show all (4)" | 0.315 | 4/4 | 0 |
| 390x844 | 0.55 | yes — same sentence + "Show all (4)" | 0.344 | 4/4 | 0 |
| 1280x900 | 0.785 | no — full fit, Show all hidden | not offered | 4/4 under automatic framing | 0 |

At 360 and 390 the automatic frame stops exactly at the readable floor 0.55 and
leaves 3 of the 4 neighbourhood cards outside the viewport; the limit sentence
and the explicit `Show all (4)` control appear, and the pressed control reaches
0.315 (360) and 0.344 (390) with all 4 cards inside, no card overlapping the
canvas controls, and all wire labels inside. Filter framing also stops at 0.55
at both phone widths and its Show-all reaches a complete fit. At 1280 the
automatic frame is 0.785 with 0 cards outside and Show all hidden, and filter
framing is 0.915.

One honest detail the pass condition does not hide: under automatic framing at
360/390, one neighbourhood card (`acme/vanilla-sdk#11`) sits under the canvas
controls — recorded as `automaticFraming.cardsUnderHud`. That is the expected
consequence of stopping at the floor instead of fitting; the promise covers the
explicit full fit, which has 0 cards under the HUD.

No expectation was edited to match a measurement. Every number reproduces the
V4-2 delta baseline (0.55 floor, 0.315 / 0.344, 0.785, 12/12, 0 CSP,
0 console).

### Delivery smoke

```
DELIVERY_DIR=.agents/run/chamberos-board-v2/verifications/V4-3 node scripts/generate-delivery-smoke.mjs
```

Result: 14/14 sections PASS, 191 captures, 308 s, exit 0. Raw log:
`logs/delivery-smoke.log`; exit and duration: `logs/delivery-smoke.exit`;
report: `smoke.json`; measurements: `canvas-measurements.json`,
`dependency-measurements.json`, `filter-measurements.json`,
`sheet-measurements.json`, `sidebar-measurements.json`,
`surface-measurements.json`; images: `screenshots/`.

The V4-3 human-review guard did not interact with this smoke: its only
`status:needs-human` fixture (issue 1) is born with the label in the fake GitHub
state and carries no `### Human Review:` section, so no status write is
attempted and no transition is refused. No section failed, no assertion was
weakened or skipped, and `scripts/generate-delivery-smoke.mjs` was not modified.

Browser diagnostics section: 0 exceptions, 0 console errors, 0 CSP violations.

## Hostile review

Independent attack of the gate as shipped (`cd97f8e` + `3aa50f2`), run on the
fixed tree. Scripts: `scripts/attack/parser-and-routes.mjs` (parser cases and
every write route against the fake GitHub) and `scripts/attack/browser.mjs`
(real Chromium, 7 states, 30 assertions, 0 failures). Raw output:
`logs/attack-parser-routes.json`, `logs/attack-browser.json`,
`logs/attack-browser.log`; screenshots: `screenshots/attack/`.

Severity: High = a waiting card with nothing to click or a false wait;
Medium = a silently broken artifact; Low = evidence weakness, not product.

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | High | Reopening a closed task that still carried `status:needs-human` and no artifact put it back in the waiting column with nothing to click. Reproduced on generic `PATCH {state:'open'}` (200, open, needs-human, `humanReview: missing`) and on the closed-body-edit-then-reopen path (200, 200). The dedicated `/reopen` route was unaffected because it resets the label to `status:backlog`. | Fixed `254a339`; now 400 `human_review_required`, state stays `closed`, zero GitHub writes. |
| F2 | High | Answering the gated question settled the artifact but left `status:needs-human`, so the task stayed in the waiting column and the drawer/row/canvas read "Waiting for an artifact" while the question was already answered. Reproduced by the original test asserting `status:needs-human` after the answer. | Fixed `947b80e`; the answer moves the task to `status:in-progress`, leaves the waiting column, and settled presentation reads "Answer received" / "Réponse reçue". |
| F3 | Medium | An `http://` image was accepted as `ready`, then blocked by CSP `img-src 'self' data: https:`; the browser recorded 2 violations and a silently missing artifact. | Fixed `854522c`; the parser refuses it with `insecure_url`, EN/FR text, and §2.9 now states the https requirement. |
| F4 | Medium | A 404 or non-image URL rendered a broken `<img>` with no explanation, although the action link still worked. | Fixed `7d8e354`; the image is hidden, a precise fallback appears, the action link stays. |
| F5 | Medium | An external tool can add `status:needs-human` to a body with no `### Human Review:` section; the board then lists it in the waiting column. The board cannot refuse a write it never sees. It does present "Waiting for an artifact" + `no_section` reason + the drawer status control, so the reader is not lied to. | Not fixed: a write-time guard cannot cover an external writer. Reported as a limitation, not changed. |
| F6 | Low | The existing probe's `instructionVisible` checks only `height > 0`; it never asserts the action or instruction is in the viewport or hit-testable, has no settled state, and no 404/http image case. A concealed second action with a different selector would not be counted. | Not fixed in the probe (must not be edited); the attack script adds 30 assertions that do check in-viewport, hit-test, hidden image/fallback, and settled states. |
| F7 | Low | The delivery smoke's `matrix-picker-360-*` screenshots swapped between runs (nondeterministic capture timing), though all 14 sections passed both times. | Not fixed; recorded so the evidence images are not over-read. |

### Re-run after the fixes

Sequential, on the fixed tree (`7d8e354` plus the attack scripts):

- Focused V4-3: `node --test --test-timeout=60000 web/tests/v4-3-human-review.test.mjs web/tests/v4-3-client.test.mjs` — 34 tests, 34 pass, exit 0.
- Full web suite: `node --test --test-timeout=60000 web/tests/*.test.mjs` — 706 tests, 706 pass, exit 0. The checkpoint's single `simple-views.test.mjs:433` environment failure did not reproduce.
- Panel suite: `npm test` — 618 tests, 618 pass, exit 0.
- `npx tsc --noEmit` — exit 0. Client and server esbuild bundles — exit 0.
- Existing browser probe — `pass: true`, 84 rows, 84 screenshots, 0 failed assertions, 0 page errors, 0 console errors, 0 CSP violations, exit 0.
- Framing probe — 12/12 cases, 0 CSP, 0 console, exit 0.
- Delivery smoke — 14/14 sections PASS, 191 captures, 0 failed sections, exit 0. `browser.json`, `canvas-measurements.json`, `framing-promise.json` and the regenerated screenshots are the refreshed evidence; only their timestamps/commit fields and PNG bytes changed, no measurement value moved.

### Attacks that found no defect

- Parser: CRLF bodies; body that is only the section; two sections (last wins);
  valid-then-invalid artifact and repeated URL (both `duplicate_field`);
  fenced heading excluded; indented heading excluded; heading levels 1 and 6;
  URL with query and fragment; `javascript:` and `data:` refused
  (`invalid_url`); instruction at 200 ready / 201 `long_instruction`; URL at
  2048 ready / 2049 `invalid_url`; `IMAGE` and `Link` accepted; Markdown in the
  instruction is rendered as text, not markup; `question` with a `javascript:`
  URL ignores the unused URL; answered question is `settled`; question with no
  Open Questions is `missing_question`; heading with trailing prose is
  `no_section`; fields after a subheading are ignored.
- Blast radius: label removal, closing, and a body edit that preserves the gate
  are allowed; a body edit that removes a ready gate is refused and records
  zero GitHub calls; `Human Review` is not an editable section, so the section
  editor cannot remove it; the qualified `/api/repos/:owner/:name/issues/:n/status`
  route resolves to the same refusal and writes nothing.
- Presentation: the legacy card has no invented action, says nothing is
  clickable, and keeps the drawer status control (`status:in-progress` is one of
  its options); the in-review card asks nothing; the gated question is
  answerable in EN and FR at 360.

## Still missing

- The independent review.

## Not verified

Real GitHub, production, Safari, Firefox, physical phone, screen reader.

## Delta residuals closed (2026-11-13)

The two Low residuals in `../V4-3-L4-delta/README.md` are closed. Documentation, prompt strings and
probe expectations only; no application behaviour changed.

### 1. Preset-answer rule scoped to the human review gate (`fa15e35`)

`docs/issue-body-contract.md` §2.5 no longer says presets are "never a required choice". Its heading
is now "Preset answer options (optional, except at a human review gate)" and its reconciliation
paragraph reads: presets are optional for an ordinary question; a question that gates the task for
human review (§2.9) must offer at least one, because a gate is settled by clicking. §2.9 is
unchanged. `DEFAULT_AI_ISSUE_PROMPT`'s Open Questions bullet in `panel/core.ts` and the shipped
`panel/main.js` carry the same scope in the same words, so the two sections and the two prompt
copies agree.

Documentation lock, re-run after the edit:

- `node --test web/tests/issue-body-contract.test.mjs web/tests/v4-3-human-review.test.mjs web/tests/v4-3-client.test.mjs` — 43 tests, 43 pass, 0 fail, exit 0, including `V4-3 prompts document the human gate identically in core.ts and shipped main.js` and `V4-3 contract lock is non-destructive: the document stays byte-identical`.
- `node --test test/ai-prompt.test.js test/drafting-and-skills-audit.test.js test/issue-30-work-type.test.js` — 21 tests, 21 pass, 0 fail, exit 0.
- `npx tsc --noEmit` — exit 0.

### 2. Stale URL message expectations refreshed (`20f4553`)

`scripts/browser.mjs` now expects the F4 message the card actually renders, EN and FR:
`The "- URL:" value must be an http:// or https:// link of at most 2048 characters, with no spaces.`
and `La valeur de « - URL: » doit être un lien http:// ou https:// de 2048 caractères au maximum, sans espaces.`
Nothing else in the probe changed. The assertion is still
`body.innerText.includes(<the whole sentence>)`, so a message that loses the 2048 limit or the
no-space rule still fails. Two negative controls on the shipped client confirm it: the probe was
run from a copy outside this tree (`/tmp/opencode/v4-3-mut/scripts/browser.mjs`, identical except
for absolute test import paths) while `web/public/app.js` was mutated and then restored
byte-identically (sha256 `31c04a4f1c47a6d7265fb5984adaa07e5578d233d300dc2ed2bcbe2a17db3a8d` before
and after).

| Mutation of the EN message | Result |
|---|---|
| drop "at most 2048 characters" | 6 failed rows, all `malformed-*-en:reasonShown`, exit 1 (`logs/mutation-en-no-2048.log`, `.exit`) |
| drop "with no spaces" | 6 failed rows, all `malformed-*-en:reasonShown`, exit 1 (`logs/mutation-en-no-no-spaces.log`, `.exit`) |

Re-run on the committed probe: `pass: true`, 84 rows, 84 screenshots (plus 12 `-answer` shots for
the question gate), 1248 recorded assertions, 0 failed, 0 page errors, 0 console errors, 0 CSP
violations, exit 0. Raw log `logs/browser.log`, exit `logs/browser.exit`, report `browser.json`,
images `screenshots/`. Implementation under test `0da2997` (`web/server/board.ts`), probe head
`20f4553`, Chromium 156.0.8078.4, synthetic only.

`browser.json` changed only in `generatedAt`, `probeHead`, `commit` (was `854522c`, now `0da2997`)
and, in the 12 malformed rows, the `reasonShown` expected/actual pair and the measured card
`text`; no other state's measurement moved. The 12 malformed screenshots now show the F4 sentence;
13 other PNGs differ in bytes only, with identical measurements. The "Browser evidence" section
above is the earlier run at `cd97f8e` and still quotes the pre-F4 sentence; this run supersedes it.

### Still open, known

F5 (the Operations view and `panel/labels.ts` still read "Needs human" / "In review", and the panel
renders no gate); a live preset-less question gate (a typed answer settles it, then the status
control must move the task); the saved `ai_issue_prompt` override (a stored prompt keeps the old
wording); the third-party image host (`img-src https:` lets it see the reader's IP); and the URL
refusal causes the message still does not name — no host, a double quote, a backslash.

