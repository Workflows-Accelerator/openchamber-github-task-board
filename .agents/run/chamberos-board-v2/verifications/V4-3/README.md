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

## Still missing

No screenshot, no framing number and no smoke run exists yet for V4-3.

- Browser probes in real Chromium at 360x800, 390x844 and 1280x900, in light and dark, in EN and FR, for each of: image artifact, video artifact, link artifact, preset question, legacy waiting card with no artifact, malformed artifact, and in-review card that reads as agent review. Zero console errors and zero CSP violations not yet demonstrated.
- The framing probe.
- The delivery smoke.
- The hostile review of these edits.
- The independent review.

## Not verified

Real GitHub, production, Safari, Firefox, physical phone, screen reader.
