# Usability audit — question and progress surfaces (2026-11-13)

Status: complete for the synthetic matrix; live inspection blocked. No product
source was edited. Nothing was signed in, pushed, deployed or written to GitHub.

Owner's verdict under test, verbatim: "we have to talk a lot about how questions
look, and how we track progress etc. Cause rn, the board is scary, even for me."

This audit does not propose a redesign. It records what the shipped surfaces
show, at 390x844 and 1280x900, light and dark, EN and FR, and measures it.

## 1. What was run

| Item | Value |
|---|---|
| Worktree / branch / HEAD | `team-dev-board-v3` / `feat/board-v3` / `4e1374c` |
| Engine | Chromium 156.0.8078.4, headless, `reducedMotion: reduce`, service workers blocked |
| Synthetic surfaces | 38, each at 2 widths x 2 themes x 2 languages = 304 captures |
| Live surfaces | 1 signed-out state x 8 matrix rows = 8 captures |
| Total captures | 312 files in `screenshots/` |
| Machine record | `measurements.json` (312 rows, `counts.errors: 0`) |
| Runner | `scripts/audit.mjs` |

Two capture families, never mixed:

- `live-…` — `https://board.workflows.ac/`, signed out. Nothing typed into it.
- `synthetic-…` — a local board (`web/tests/helpers.mjs` `startBoard`) over a
  fake GitHub API (`web/tests/fake-github.mjs`). No token, no real GitHub call,
  no network write. The fixture is 15 issues: the seven V4-3 review states
  (image, video, link, question with presets, legacy missing artifact, malformed
  artifact, in-review), plus ordinary open questions, a native dependency plus
  human task, a blocker, a draft, planned checklists with a GitHub note, a closed
  issue, an answered question and a `### Decisions:` Markdown section.

### Live result: HTTP 502

Every request to production returned `502 Bad Gateway` between 14:46 and 15:18Z,
including `/` and `/api/health`; DNS resolved and unrelated HTTPS hosts returned
200. The eight `live-signed-out-*` captures record that response. No task drawer,
list, canvas, filter or Decisions view could be reached signed out. **All product
evidence below is synthetic and labelled as such.** No timed comprehension study
was performed; the "under three seconds" question is answered structurally, not
with a stopwatch.

### What each row measures

Injected in-page, on the rendered DOM, foreground container only (open dialog or
open drawer; background controls excluded):

- **First visible content** — text blocks in the viewport, ordered by `top`.
- **Words in first viewport** — count of visible words, to size the load.
- **Visible actions** — `a[href]`, `button`, `select`, `input`, `summary`,
  `[role=button]` that survive ancestor `display/visibility/opacity/clip`,
  ancestor scroll clipping, and a centre hit-test (`elementFromPoint`), so
  occluded or clipped controls are rejected.
- **Smallest CSS text** — smallest computed `font-size` of visible text.
- **Smallest effective text** — that size multiplied by the canvas scale for
  text inside `#canvas-plane`, because a 10 px card at 20 % zoom renders at 2 px.
- **Secondary-text contrast** — WCAG ratio of `.muted`, subtitles, reasons,
  gists, canvas meta and status badges against the composited ancestor
  background (alpha blended to the first opaque layer).
- **Primary action above the fold** — first `.primary` control's box against the
  viewport; `aboveFold` requires `top >= 0` and `bottom <= height`.
- **Taps at 390** — `pointerdown` events on `document`, one per physical tap.
  Scrolls are counted separately. Clicks were rejected as the unit because
  selecting a radio through its label fires two clicks from one tap.

## 2. Inventory and measurements

390 values are EN/light unless a theme difference is called out; the matrix rows
for dark and FR are in `measurements.json` and `screenshots/`.

| Surface | 390 actions | 390 smallest CSS / effective px | 390 secondary contrast | 390 primary above fold | 1280 actions | 1280 smallest effective px | First visible at 390 |
|---|---|---|---|---|---|---|---|
| `list` grouped | 18 | 10.5 / 10.5 | 6.44 | no (icon-only `+`) | 33 | 10.0 | All Projects, 15, Filters, "Waiting for you" |
| `list-flat` | 17 | 10.5 / 10.5 | 6.44 | no | 31 | 10.0 | same |
| `canvas` (fit all) | 74 | 10 / **2.02** | 4.76 light, **3.66 dark** | no | 83 | **7.34** | All Projects, 15, Filters |
| `canvas-focus` (dependency) | 38 | 10 / 10 | 3.66 dark | no | 69 | 10.0 | All Projects, 15, Filters |
| `filters` sheet | 16 | 12 / 12 | 6.80 | yes ("Show 15 tasks" 788–832) | 22 | 12.0 | "Filter tasks", match rule |
| `filters-applied` | 17 | 10.5 / 10.5 | 6.07 | no | 27 | 10.0 | All Projects, Filters (1) |
| `decisions` | 16 | 10.5 / 10.5 | 7.13 light, **2.92 dark** | yes ("Answer" 689–733) | 25 | 10.0 | "Decisions", 3, subtitle |
| `blocked` | 13 | 10.5 / 10.5 | 7.13 light, **2.92 dark** | no | 22 | 10.0 | "Blocked", 7, subtitle |
| `drawer-question` (gate) | 10 | 11 / 11 | 6.80 | yes ("Answer" 756–800) | 13 | 11.0 | title, chips, gate at y=291 |
| `drawer-question-gate` | 10 | 11 / 11 | 6.80 | yes (756–800) | 13 | 11.0 | same |
| `drawer-question-details` (Details + free text open) | 8 | 11 / 11 | 6.80 | **no ("Answer" 845–889)** | 10 | 11.0 | same |
| `drawer-image` | 6 | 11 / 11 | 6.80 | yes (599–643) | 9 | 11.0 | title, chips |
| `drawer-video` | 9 | 11 / 11 | 5.30 | yes (389–433) | 10 | 11.0 | title, chips |
| `drawer-link` | 9 | 11 / 11 | 5.30 | yes (389–433) | 10 | 11.0 | title, chips |
| `drawer-malformed` | 8 | 11 / 11 | 6.80 | yes ("Apply status" 545–589) | 8 | 11.0 | title, chips |
| `drawer-legacy` | 8 | 11 / 11 | 5.30 | yes ("Apply status" 529–573) | 9 | 11.0 | title, chips |
| `drawer-in-review` | 8 | 11 / 11 | 5.30 | yes | 9 | 11.0 | title, chips |
| `drawer-normal` (no question) | 12 | 11 / 11 | 5.30 | yes | 14 | 11.0 | title, chips |
| `drawer-settled-gate` | 8 | 11 / 11 | 5.30 | yes | 9 | 11.0 | title, chips |
| `open-questions` (2 questions) | 10 | 12 / 12 | 6.80 | yes ("Answer" 478–522) | 15 | 12.0 | "Open questions", question 1 |
| `open-questions-details` | 10 | 12 / 12 | 6.80 | yes (522–566) | 13 | 12.0 | same |
| `agent-notes` | 11 | 11 / 11 | 5.30 | yes | 13 | 11.0 | "Agent notes", author |
| `agent-note-composer` | 11 | 11 / 11 | 5.30 | yes ("Send note" 282–326) | 14 | 11.0 | "Agent notes", composer |
| `progress-checklists` | 6 | 12 / 12 | n/a | yes ("Save overview") | 8 | 11.0 | "Acceptance criteria", item 1 |
| `drawer-blocked` | 6 | 11 / 11 | 6.80 | yes | 8 | 11.0 | dependency rows |
| `drawer-recorded-decision` | 2 | 11 / 11 | 6.80 | yes | 4 | 11.0 | "Overview", "Save overview" |
| `markdown-decision` | 3 | 11 / 11 | 5.30 | yes | 9 | 11.0 | edit warning, "Acceptance criteria" |
| `arrange` dialog | 5 | 12 / 12 | 5.17 | yes ("Arrange" 788–832) | 5 | 12.0 | "Arrange cards", scope rule |
| `arrange-undo` (after save) | 50 | 10 / **2.02** | 3.66 dark | no | 43 | **7.34** | All Projects, Filters |
| `zoom-minimum` (clamped) | 74 | 10 / **2.00** | 3.66 dark | no | 83 | **2.00** | All Projects, Filters |
| `zoom-maximum` | 25 | 10.5 / 10.5 | 6.80 | no | 39 | 10.0 | All Projects, Filters |
| `focus-limit` (stress) | 23 | 10 / 5.50 | 3.66 dark | no | 32 | 5.50 | legend, one card |
| `focus-limit-show-all` (stress) | 17 | 10.5 / 10.5 | n/a | no | 26 | 10.0 | legend |
| `columns` (legacy renderer) | 14 | 10.5 / 10.5 | 6.07 | no | 31 | 10.0 | "Brouillon — 1" |
| `phone-navigation` (drawer) | 13 | 10 / 10 | n/a | no | 33 (sidebar closed) | 10.0 | Views, Canvas, List |
| `filter-blocked` | 12 | 10.5 / 10.5 | 6.80 | no | 22 | 10.0 | All Projects, Filters (1) |
| `filter-reviewable-link` | 14 | 12 / 12 | n/a | yes ("Show 0 tasks") | 22 | 12.0 | "Filter tasks" |
| `canvas-filtered` | 39 | 10 / 5.97 | 3.66 dark | no | 48 | 8.41 | All Projects, Filters (1) |

Disclosures: `columns` invokes the retained Kanban renderer through debug state
because the current view selector is hidden; `focus-limit*` deliberately spreads
synthetic saved coordinates to x=0 and x=20000, so it is a framing stress case,
not production layout. Everything else uses the product's own controls.

## 3. Ranked findings

Severity is about cost to the person reading the board, not implementation size.

| # | Sev | Surface | What the person sees | Why it costs them | Measurement | Capture |
|---|---|---|---|---|---|---|
| 1 | High | Canvas, phone, default entry | The whole board fitted into one phone screen: 15 cards in four columns, no card title readable | The first view is illegible, so the only way to read anything is to zoom and pan one card at a time. Nothing on screen says the board was scaled down to fit | fit = 20 % zoom (the clamp floor, `app.js:2759`), smallest effective text **2.02 px**, 74 actions in viewport, 198 words | `synthetic-canvas-390-light-en.png`, `-dark-fr.png` |
| 2 | High | Blocked / filters / list | Three different numbers claim to be "what needs me": list group "Waiting for you 6", dock "Blocked 7", filter "Needs me 8"; filter "Blocked" then shows 1 task while the dock beside it still says 7 | The person cannot trust any count, and "Blocked" means two different things on the same screen. Choosing the wrong one hides six waiting tasks | list stage group 6; `isIssueBlocked` 7; `needsMe` 8; filter `blocked` = `blockerKeys` only = 1 | `synthetic-list-390-light-en.png`, `synthetic-filter-blocked-390-light-en.png`, `synthetic-blocked-390-light-en.png` |
| 3 | High | Progress, every view | Progress exists only as unchecked boxes inside the drawer. Rows and cards show "1 comment" or nothing; the checklist has no "2 of 5", no ratio, no bar; the columns view drops the artifact badge entirely | A person cannot see how far a task has come without opening it and counting boxes, and cannot compare two tasks at all | `renderChecklist` emits only `li` + checkbox, no count; list row #112 badges = Planned, High, Task Board, 1 comment; `columns` #105/#106 show status only | `synthetic-progress-checklists-390-light-en.png`, `synthetic-list-1280-light-en.png`, `synthetic-columns-1280-light-fr.png` |
| 4 | High | List, canvas, gate title | Two different failures wear one label: #105 (no `### Human Review:` section) and #106 (malformed `javascript:` URL) both read "Waiting for an artifact", in list, canvas and gate heading | A person cannot tell "the agent forgot to attach anything" from "the attachment is broken", so they cannot tell whom to ask or what to do | both list badges `["Waiting for you","Task Board","Waiting for an artifact"]`; only the 1-line reason differs | `synthetic-list-390-light-en.png`, `synthetic-drawer-legacy-390-light-en.png`, `synthetic-drawer-malformed-390-light-en.png` |
| 5 | High | Filter "Reviewable link" | The filter under "For your review" reports 0 and shows 0 tasks, while three tasks in the same board carry a review URL (`image`, `video`, `link` artifacts) | The one control named for review work cannot find review work, so a person concludes there is nothing to review | filter count 0; `matchesExtraFilter` scans `pendingItems` text only (`app.js:1996-1998`), not Human Review `- URL:` | `synthetic-filter-reviewable-link-390-light-en.png` |
| 6 | Medium | Gate, 390 | "Waiting for you" is printed twice on one screen (gate heading and status badge), beside a third amber chip "needs review", a fourth "Question", plus `open` and `phase: execution` | Four labels name one state, none of which is the instruction. The reader must decide which one is the state and which is the action | 6 chips above the gate; gate top at y=291, 291 px of chrome before the question | `synthetic-drawer-question-details-390-light-en.png`, `-fr.png` |
| 7 | Medium | Gate with Details / free text open, 390 | The Answer button is 1 px below the fold at 844, so the visible screen ends on "Write another answer" and a text field | The primary action disappears exactly when the person asks for more explanation; answering now needs a scroll they were not told about | Answer box 845–889, `aboveFold: false`; drawer scrollHeight 1821 vs 844 | `synthetic-drawer-question-details-390-light-en.png` |
| 8 | Medium | Dark theme, Decisions and Blocked | Every status badge ("Waiting for you", "Todo") is dark grey-blue on dark | The status is the one word that says why the task is on this page, and it is the least legible text on it | **2.92:1** at 11 px (AA needs 4.5:1); light theme is 7.13:1 | `synthetic-blocked-390-dark-en.png`, `synthetic-decisions-1280-dark-fr.png` |
| 9 | Medium | Dark theme, canvas counters | "1 q", "2 q", "1 human" sit at 10 px in mid-grey on a dark card | These are the only question/progress counters on the canvas, and they are the least readable element on the card | **3.66:1** at 10 px, and 2.02 px effective at fit zoom | `synthetic-canvas-390-dark-en.png` |
| 10 | Medium | FR locale | French chrome keeps English internal vocabulary: `open`, `phase: execution`, `needs decision`, `Question` in the drawer; `1 human tasks`, `2 questions` in columns; the same column is "En Attente De Vous" in the heading and "En attente de vous" in the badge | A French reader meets a mix of two languages plus schema words that were never meant to be read, which reads as a debug screen | 4 untranslated strings on one drawer; 2 untranslated badges in columns | `synthetic-drawer-question-details-390-light-fr.png`, `synthetic-columns-1280-light-fr.png` |
| 11 | Medium | Decisions | The badge says 3, the page lists 2 issues; the subtitle says "Every unanswered open question … grouped by issue", so the number and the list count different things | A person checking "did I clear them" gets 3, opens the page, counts 2 cards, and cannot tell whether one is hidden | badge = open questions (3); cards = issues (2) | `synthetic-decisions-390-light-en.png` |
| 12 | Medium | Blocked | #109 appears in both groups ("Waiting on Human Action" and "Blocked by Dependencies") while the page badge counts it once | The list looks longer than its own count, and the same task seems to be two problems | 7 badge, 8 rendered cards, #109 twice | `synthetic-blocked-390-light-en.png`, `synthetic-blocked-1280-light-en.png` |
| 13 | Medium | Canvas counters | An answered question still shows "1 q" on the canvas (#114) while the list shows no question badge and Decisions excludes it | The canvas says work is outstanding where no work is outstanding, which is exactly the "is anything waiting for me" question | canvas #114 badge "1 q"; list #114 no question badge; Decisions count 3 excludes it | `synthetic-canvas-1280-light-en.png`, `synthetic-list-1280-light-en.png` |
| 14 | Low | Gate reasons | The explanation is raw schema prose: `The body has no "### Human Review:" section.` and `The "- URL:" value must be an http:// or https:// link of at most 2048 characters, with no spaces.` | The person is told which Markdown line the agent got wrong, not what they can do; it reads like a parser log | both strings rendered as the reason line, 395–412 at 390 | `synthetic-drawer-legacy-390-light-en.png`, `synthetic-drawer-malformed-390-light-en.png` |
| 15 | Low | Calm drawer (nothing asked) | 12 actions inside the 390 viewport, and "Not blocked by any tasks." / "Not blocking any tasks." as the only closing content | A task that asks nothing still presents a wall of editable controls and two negatives, so "nothing to do" never looks like nothing to do | 12 actions in viewport (17 controls in the drawer), 2 empty statements, gate hidden | `synthetic-drawer-normal-390-light-en.png`, `synthetic-drawer-in-review-390-light-en.png` |
| 16 | Low | Human-task count label | The same count is "1 human" (list), "1 human tasks" (columns), "1 action" (FR list) | Three labels for one quantity, one of them ungrammatical and one that reads as a button count | `app.js:2541`, `app.js:2592`, `app.js:3518` | `synthetic-columns-1280-light-fr.png`, `synthetic-list-1280-dark-fr.png` |
| 17 | Low | Canvas after Arrange, 390 | Arrange succeeds into a single 20 % column; the only completion signal is a dialog line that closes after 1.2 s; Undo is an unlabeled bent-arrow icon | The person sees an unreadable column and no statement of what changed; undo exists but is not named | 20 % zoom, 2.02 px effective, 50 actions, `arrange-summary` transient | `synthetic-arrange-undo-390-light-en.png` |

## 4. Answers to the brief's questions

**Can a person tell in under three seconds what is asked and what to do?**
Partly, and not on the first screen. For image, video and link the gate puts one
instruction and one labelled action above the fold (390: "Open screenshot"
599–643, "Watch the video" 389–433, "Open the link" 389–433). For a question the
gate starts 291 px down, after the title, six chips, a GitHub notice and a
timestamp; the question text and both preset cards are visible, and "Answer" sits
at 756–800, inside 844. So the instruction is legible, but it competes with 4–5
state labels on the way in. No timed study was run, so this is structural
evidence, not a measured comprehension time.

**When nothing is asked, does it look calm?**
No. The gate is correctly hidden for a task with no question (`humanReview.hidden:
true`), and the in-review drawer says "The agent is reviewing this task. Nothing is
asked of you." — the clearest sentence in the audit. But the same drawer still
shows 12 actions in the 390 viewport and closes on two "Not blocked…" lines, so
absence of work is rendered as an editable form.

**Can a person tell where a task stands without reading its body?**
Sometimes, and the views disagree. The list carries status, project, artifact type
and counts; the canvas carries status plus a gate line; the columns view drops the
artifact badge. #105 and #106 are indistinguishable in list and canvas, and #114's
answered question still shows "1 q" on the canvas. Progress itself is never a
number outside the drawer.

**Do status, column, filter and dependency views contradict each other?**
Yes. See section 5. The clearest case is the word "Blocked": the dock says 7, the
filter of the same name says 1, and the filter's own page still shows "Blocked 7"
in the dock.

**At 390, how many taps to answer a gated question, and to find out why a task is waiting?**
Answering: **3 taps, 0 scrolls** (open row, choose preset, press Answer) when the
gate is compact. With one Details disclosure and the free-text field open, the
Answer button falls to 845–889, so a scroll is required before the third tap.
Finding out why a task waits: **1 tap, 0 scrolls**; the reason is at 395–412 in the
legacy case. Finding out *what* to do is the part that costs taps.

**Which words are ambiguous or duplicated?**
"Waiting" covers three states: `status:needs-human`, a human task, and a missing
artifact ("Waiting for you", "Waiting for an artifact", "Waiting on Human Action").
"Review" covers agent review ("Agent reviewing") and human review ("needs review",
"Reviewable link"). "Blocked" covers dependency blocks (filter) and human waits
(dock). "Note" covers a canvas note and a GitHub comment — the composer has to
explain the difference in a subtitle. "Human" becomes "action" in French and
"human tasks" in columns. "Question" appears twice on one row ("1 question" and
"Question"). Schema words leak: `open`, `phase: execution`, `needs decision`,
`### Human Review:`.

## 5. Contradictions about the same task

| # | Contradiction | Numbers | Evidence |
|---|---|---|---|
| A | "Blocked": dock/view vs filter | 7 tasks vs 1 task, both labelled Blocked, both on screen | `synthetic-filter-blocked-390-light-en.png` |
| B | "Needs me" vs "Waiting for you" vs "Blocked" | 8 vs 6 vs 7 for the same board | `synthetic-filters-390-light-en.png` |
| C | Decisions badge vs Decisions cards | 3 (questions) vs 2 (issues) | `synthetic-decisions-390-light-en.png` |
| D | Blocked badge vs rendered cards | 7 vs 8, #109 in both groups | `synthetic-blocked-1280-light-en.png` |
| E | "Reviewable link" vs review artifacts | filter 0 vs 3 tasks with an artifact URL | `synthetic-filter-reviewable-link-390-light-en.png` |
| F | Canvas question count vs list/Decisions | #114 "1 q" vs no badge vs excluded | `synthetic-canvas-1280-light-en.png` |
| G | List vs columns information | list #105/#106 show "Waiting for an artifact"; columns show status only | `synthetic-columns-1280-light-fr.png` |
| H | Same count, three labels | "1 human" / "1 human tasks" / "1 action" | `synthetic-columns-1280-light-fr.png` |

Not claimed: a visible status-vs-column contradiction. `stageOf` reads
`effectiveStage`; the legacy API `column` can differ for unprioritised planned
tasks, but no UI evidence of a conflicting column was captured, so this audit does
not assert one.

## 6. Three decisions that would unblock the most

1. **On a phone, should the canvas open on the whole board fitted to the screen, or
   on a readable subset?** Fit-all currently means 20 % zoom and 2 px text on every
   visit; the alternative is a different first frame, not a different renderer.
2. **Which single number is "what needs me", and must the filter and the view use
   it?** Today the same board answers 6, 7 and 8, and "Blocked" answers both 7 and 1.
3. **Should progress be a number outside the drawer — answered/total questions and
   done/total checklist items on the row and the card — or stay implicit?** Today a
   row can only say "1 comment" while five checklist items sit unopened.

## 7. Limits

- Production returned 502 for the whole session; no live list, canvas, drawer,
  filter or Decisions view was observed. Live evidence is the failure itself.
- All product findings come from a 15-issue synthetic fixture. Fixture design
  affects which states exist, not how the components render them; the components
  are the shipped ones.
- No timed comprehension study, no screen reader pass, no touch-target audit, no
  keyboard-only pass. Contrast is computed, not eyeballed.
- `columns` and `focus-limit*` use disclosed internal/stress setups.
- Tap counts are for one compact EN/light 390 path; FR labels are longer and were
  not tapped.

## 8. Reproduce

```
cd verifications/usability-audit-2026-11-13
source ../../.agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh
node scripts/audit.mjs          # rewrites measurements.json and screenshots/
```

`AUDIT_SURFACES=list,canvas` runs a subset but overwrites `measurements.json`;
run the full set to regenerate the complete matrix. The runner resets the pristine
fixture before every row, disables the board cache, and uses an explicit session
file under `/tmp/opencode/usability-audit-2026-11-13/`. It exits non-zero if any
row errors.
