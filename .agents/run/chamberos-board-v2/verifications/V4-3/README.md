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

## Still missing

- The framing probe.
- The delivery smoke.
- The hostile review of these edits.
- The independent review.

## Not verified

Real GitHub, production, Safari, Firefox, physical phone, screen reader.
