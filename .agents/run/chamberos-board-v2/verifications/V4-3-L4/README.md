# V4-3 independent L4 review

Reviewed range: `a6f61f3..4b9c216` on `feat/board-v3` (HEAD `4b9c216`). Reviewer did not write the code.
Local synthetic only: fake GitHub, local board, Playwright routes. No real GitHub write, no push, no deploy, no application file modified.

## Verdict

| | Verdict |
|---|---|
| SPEC | **PASS**, with one Medium defect noted below. Through the board, a task cannot be put into "waiting for you" unless it has something to click. The one exception is a task created with two status labels (F2), and that task does not appear as waiting on its card. |
| QUALITY | **CHANGES REQUIRED.** One Medium (F1) and five Low findings. |
| PUBLISH | **NO, until F1 is fixed.** F1 is a one-line condition. After that fix and a re-run of the focused tests, **YES** with the caveats below. |

Why NO for one Medium: F1 silently undoes a status the human chose. That is exactly the authority the user wants to keep ("valider... depuis le board"). It is reachable from the ordinary answer form on any `done`, `in-review` or `todo` task that has a question gate.

## Method

1. Read `git diff a6f61f3..4b9c216` directly: `web/server/board.ts` (`parseHumanReview`, guard helpers), `web/server/app.ts` (create guard, `writeIssue` guard, answer label change, CSP), `web/public/app.js` (`renderHumanReview`, `questionAnswerBlock`, `humanReviewStatus`, row/canvas summaries, i18n), `index.html`, `theme.css`, `docs/issue-body-contract.md` §2.9/§2.10, the `panel/core.ts` prompt constants and the shipped `panel/main.js` strings, both V4-3 test files, the authors' probes and the four fix commits.
2. Wrote independent attacks rather than re-running the authors' attack scripts: `scripts/attack.mjs`, `scripts/followup.mjs`, `scripts/qualified.mjs`, `scripts/browser.mjs` (independent probe), `scripts/caps.mjs`.
3. Re-ran every suite sequentially. The authors' browser and framing probes ran from copies under `scripts/` so the committed `V4-3/` evidence was not overwritten. The delivery smoke ran with `DELIVERY_DIR` pointing here.

## Suites (re-run, sequential)

| Check | Result | Log |
|---|---|---|
| Focused V4-3 (`v4-3-human-review` + `v4-3-client`) | 34/34 pass, 3 s | run in session (tail recorded in the review) |
| Web suite `node --test web/tests/*.test.mjs` | 706/706 pass, 40 s, exit 0 | `logs/web-suite.log`, `.exit` |
| `npm test` | 618/618 pass, 16 s, exit 0 | `logs/npm-test.log`, `.exit` |
| `npx tsc --noEmit` | exit 0 | `logs/typecheck.log`, `.exit` |
| esbuild `web/server.ts` | 246.4 kb, exit 0 | `logs/esbuild-server.log` |
| esbuild `web/public/app.js` | 414.4 kb, exit 0 | `logs/esbuild-client.log` |
| Authors' browser probe (copy) | pass; 84 rows, 1248 assertions, 0 fail, 84+12 screenshots, 0 CSP/console/page errors | `logs/browser.log`, `browser.json` |
| Framing probe (copy) | 12/12; floor 0.55; Show all 0.315 (360) / 0.344 (390); 1280 at 0.785, filter 0.915 | `logs/framing-promise.log`, `regression/` |
| Delivery smoke | 14/14 PASS, 191 captures, 302 s, exit 0 | `logs/delivery-smoke.log`, `smoke.json` |
| Independent browser probe | pass; 72 rows, 592 assertions, 0 fail, 0 CSP, 0 page/console errors | `logs/l4-browser.log`, `l4-browser.json`, `screenshots/l4-*.png` |
| Cap probe (360, EN/FR) | 6/6 pass | `logs/l4-caps.log`, `l4-caps.json` |
| Qualified-route attack | 5/5 as expected | `logs/qualified.json` |

The JSON files match the logs: `browser.json` counts sum to 1248 assertions with 0 `ok:false`. The 14 entries in `smoke.json` are all `PASS`. The log contains 191 `Captured` lines.

## Write-path attack (fake GitHub non-GET request count)

All refusals return 400 `human_review_required` and make **0 writes**. Sources: `logs/attack.json`, `logs/followup.json`, `logs/qualified.json`.

| Path | Result |
|---|---|
| Create `status:needs-human`: no artifact / no body / malformed | refused, 0 writes |
| Create with a ready image | 201, waiting, `ready` |
| `POST /status` and `PATCH status`: no artifact / malformed / settled question | refused, 0 writes |
| Qualified `/api/repos/o/r/...`: create, status, PATCH reopen, body edit | refused, 0 writes |
| Generic `PATCH state:open` on a closed waiting task with no artifact (with or without status) | refused, 0 writes, still closed |
| Dedicated `/reopen` on a closed legacy waiting task | 200, lands on `status:backlog` (not waiting) |
| Body edit that removes the gate / makes it malformed / settles it on an open waiting task | refused, 0 writes, stored body unchanged |
| Body edit that keeps a ready gate | 200 |
| Section editor targeting `human-review` | 400 `invalid_edit`, 0 writes |
| Overview section edit that injects an empty `### Human Review:` heading | 200; the original gate is later in the body, so the last section wins and the card stays `ready`, not broken |
| Body edit on a closed task removing the gate, then reopen | edit 200; reopen refused, 0 writes |
| Close a waiting task; remove a non-status label; remove `status:needs-human` | all allowed, as they should be |
| Answer the gated question on a waiting task | 200, `status:in-progress`, gate `settled` |
| External GitHub label add / body edit | board shows `missing` + `no_section` honestly, and the status control moves the card out (200, 1 write) |

My first `attack.mjs` run reported five failures. Three were fixture mistakes on my side, re-checked in `followup.mjs`: issue 20's first PATCH hit `invalid_edit` because a single fixture was reused; the injected-heading case is benign, as explained above; issue 30 had a prior `status:todo` label. Two were real: F1, and F2 below.

## Parser (47 real calls, `scripts/attack.mjs`)

All 47 cases behave as the contract says:
- CRLF and CR-only bodies parse.
- Body-only section works; with two sections the last wins, even when the last is malformed.
- Duplicate artifact, URL or instruction is `duplicate_field`.
- Fenced and indented headings are ignored. A heading with trailing prose is not a section. Levels 1-6 work, case-insensitive, with an optional colon.
- Rejected as `invalid_url`: `javascript:`, `data:`, relative, protocol-relative, `https://` with no host, quotes, spaces. An `http:` image is `insecure_url`; `http:` link and video are allowed. Uppercase `HTTPS` is accepted.
- Instruction 200 chars is `ready`, 201 is `long_instruction`. URL 2048 is `ready`, 2049 is `invalid_url`.
- Markdown and HTML in the instruction are kept as data; the client renders them with `textContent`.
- Question: an answered question is `settled`; no Open Questions is `missing_question`; a URL on a question gate is ignored.

## Findings

**F1, Medium: answering a gated question overrides any status, not only "waiting".**
`web/server/app.ts` ~2844-2854 (fix 947b80e) sets `patch.labels = applyStatusChange(fresh.item, 'status:in-progress')` whenever the answered question is the gated one. It never checks that the task is in `status:needs-human`.

Reproduced: answering on a `status:done` task gives `status:in-progress` (`logs/followup.json` `answerOnDone`); on `status:in-review`, also `status:in-progress` (`logs/attack.json`).

So the human's own decision ("done") is silently undone by an ordinary answer click. Fix: make the label change conditional on `isHumanReviewGateStatus(baseStatus)`, and add a test for done and in-review. Moving a *waiting* task to `in-progress` after its answer is right; it is what "the agent picks it up again" means.

**F2, Low: create accepts two status labels and the column and card disagree.**
`POST /api/issues` with `labels: ['status:todo','status:needs-human']` returns 201. The guard uses `statusLabelOf`, which returns the first status label (`todo`). `resolveIssueColumn` places the task in `needs-human`. The client keys the gate panel on `statusLabel`, so this task shows no gate panel and no badge.

It is not presented as waiting with nothing to click, but label hygiene on create is unchecked. Fix: refuse more than one status label on create.

**F3, Low: a question gate with no presets is accepted as `ready`.**
The human must type the answer. This contradicts the stated rule ("a question with preset answers") and the authors' own README line "fixing question gates without presets". Docs §2.9 explicitly permits it ("Presets remain suggestions").

Either require at least one `::` preset, or change the stated rule. The user's sentence favours requiring presets.

**F4, Low: imprecise client reason for `invalid_url`.**
The client always shows "must start with http:// or https://". That is false for a 2049-char URL or one containing a space. The server's precise `review.message` is discarded in favour of a dictionary string.

**F5, Low: partial rename.**
The Operations view still shows `Needs human` / `In review` (FR `Action humaine` / `Validation` / `En revue`) via i18n keys `operations_needs_human`, `status_needs_human`, `status_in_review`. See `screenshots/13-operations-1280-light-fr.png`.

`panel/labels.ts` still uses `Needs Human` / `In Review`. The OpenChamber panel renders no gate; only its prompt strings changed.

**F6, Low, evidence quality.**
In the authors' main probe:
- `panelVisible` records `expected:false`, which reads as the opposite of what it checks.
- `instructionVisible` is `height > 0` only.
- `inViewport` is recorded but never asserted.

The hostile-pass browser attack fixes this for the 7 states it covers; see L2.

**Noted, not a V4-3 regression.** An in-review task that also has Open Questions still shows the Open Questions answer form (`l4-browser.json` `interactions.inReviewDrawer.openQuestionForms: 1`). The review panel itself asks nothing.

**Privacy caveat.** CSP now allows `img-src https:`. Opening a drawer fetches a third-party review image, so that host sees the viewer's IP; the referrer is suppressed. No script, style, connect or frame directive moved.

## Hostile fixes

| Commit | Holds? | Unrequested behaviour? |
|---|---|---|
| 254a339 reopen guard | Yes. Generic PATCH reopen is refused with 0 writes. `/reopen` lands on backlog. Qualified route too. | No. |
| 947b80e answer settles and moves the task | Yes, for a waiting task. | **Yes, F1.** It also moves done, in-review and todo tasks. |
| 854522c https for inline image | Yes. `http:` image is `insecure_url`, with no image attempted. `http:` link and video are still allowed. | No. |
| 7d8e354 failed image load | Yes. On a 404 the `<img>` is hidden, the precise fallback "The image could not be loaded…" / FR shows, and the action stays hit-testable, at 360 and 1280, both themes, EN/FR. | No. |

## Presentation (independent probe, 360 and 1280, light and dark, EN and FR)

- **Actions.** Exactly one primary action for image, video, link and question. It is in the viewport and hit-testable: `elementFromPoint` returns the anchor or button itself.
- **Inline image.** Renders at `naturalWidth` 320.
- **Instruction.** Visible and not covered.
- **Width.** No horizontal page scroll in any row.
- **Legacy and malformed cards.**
  - No action, link or button in the panel.
  - The precise reason is shown.
  - The drawer status control offers `in-progress`.
  - A real `#status-select` + `#apply-status` click at 360 moves the card out of waiting and hides the panel.
- **In review.** "The agent is reviewing this task. Nothing is asked of you." No action. Never the waiting title.
- **Settled.** "Answer received" / "Réponse reçue", no action, says the agent must pick it up again.
- **Answering in the browser.** The card goes to `status:in-progress` and the panel hides.
- **Caps at 360.** A 200-char instruction, a 190-char unbroken token and a 2048-char URL all fit, with no panel overflow and the action hit-testable.

## Non-regression (re-run)

The delivery smoke passes 14/14, covering:
- shared sheets
- phone sidebar
- applied filters with live count and reset
- dependency focus and edge toggle
- theme/language reload and identity
- hostile geometry
- List and Canvas with a Markdown note and wires
- canvas controls containment, Undo and `<html lang>`
- any-repo list and drawer
- Decisions and Blocked
- Operations, Archive, Presentation
- zero exceptions, console errors and CSP violations

The framing probe passes 12/12 (D37 0.55 floor, Show all). The web suite covers V4-2 notes (append-only comments) and Decisions presets.

Grep on the diff: 0 `n8n`, 0 `mobile`, 0 emoji. `index.html` has 0 inline `style=` and all scripts external. The CSP change is limited to `img-src https:`.

## Known limitations

1. **External `status:needs-human`: ships with caveat.** It is honest and recoverable, not a dead end. The card reads "Waiting for an artifact" with the precise `no_section` reason, offers no fake action, and the drawer status control moves it out in one write (verified in the API and by a real click at 360). Tell the user: a tool outside the board can still mark a task waiting without an artifact; the board will say so and they can move it out with the status control.
2. **Probe honesty: now honest for the gate, but not because of the main probe.** The main 84-row probe still only asserts `height > 0` (F6). The hostile `attack/browser.mjs` checks are real: `inViewport`, `hitTestSelf`, display, visibility and opacity, image naturalWidth, the fallback, no concealed control. My independent 72-row probe confirms the same at 360 and 1280 in both themes and languages. No self-fulfilling assertion remains uncovered.
3. **`matrix-picker` swap: environment noise, not product nondeterminism.** My smoke run differs from the committed one on 6 of 16 picker frames (`360-light-en`, `1280-dark-fr`, all four `768`); the other 10 are byte-identical. Viewing `360-light-en` side by side shows the same sheet. In my capture it is 1 px lower and still translucent, with the list showing through. The frame was taken during the sheet's open transition. Content, order and controls are identical. All picker geometry assertions pass in both runs. Recommended (Low): the smoke should wait for the sheet transition to end before capturing.
4. **Carried from V4-2: ships with caveat.** A saved `ai_issue_prompt` overrides the new default, so an agent may still try to set `needs-human` without a gate. The server refuses with 400 `human_review_required`, so no bad card is created, but the agent's write fails. Tell the user to reset or update a saved custom prompt. The other carried items (panel Quick Choices not rendering `::`, contiguous option lines, 2,000-char detail cut, non-standard 422 shown as outcome-unknown, note count a floor above 100) are unchanged and remain caveats.

## Caveats to tell the user before it goes live (after F1 is fixed)

- A task now waits for you only with a screenshot, short video, link or question attached. Anything else is refused by the board.
- A task marked waiting from outside the board shows "Waiting for an artifact". Use the status control to send it back.
- A saved custom AI issue prompt replaces the new default. Reset it so agents attach an artifact.
- A question gate can still have no preset answers, in which case you type the answer (F3).
- Review images load from their https host when you open the task, so that host sees your IP address.
- The Operations view and the OpenChamber panel still say "Needs human" / "In review" (F5).
