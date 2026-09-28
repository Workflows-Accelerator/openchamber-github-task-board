# L5 Human Review — Batch 1 (prepared 2026-09-28)

Verdicts are per item: pass or bounce (with a note). Nothing is closed and nothing is
pushed until you rule. Issue numbers are on
github.com/Workflows-Accelerator/openchamber-github-task-board.

## 1. Three simplified views — issue #23 (github-task-board panel)
What to do: open the task board panel, use the layout switcher to open
**Human Tasks**, **All Tasks**, **Questions**.
What should happen:
- Human Tasks: only issues in needs-human, friendly titles, each with its checklist of
  human items (badges: Human Task / Open Question / Agent Waiting). Ticking a box updates
  the GitHub issue body immediately. Clicking an issue opens its drawer.
- All Tasks: every issue, friendly title only (quiet mono subtitle), grouped by all 8
  statuses with per-group counts. Filters/search keep working.
- Questions: every unanswered question from every issue, clickable through to the drawer,
  with inline answering.
- Switching between views leaves no stale cards behind; loading shows a spinner, not a
  premature "empty" box; blank titles fall back to "Issue #N".
Blind spots: not yet verified in a real browser session (visual polish pass comes next);
background-streaming focus drops (#19) are untouched by design.

## 2. Issue-body contract + status semantics — issue #22 (+ closes #20)
What to do: open any issue that has a `### Human Tasks:` section and one with
`### Open Questions:`; then let an attached session go idle.
What should happen: drawer shows Human Tasks as its own checklist; questions and human
tasks never bleed into each other; an issue whose session goes idle lands in
**Needs Human** (awaiting your validation), never in In Review; In Review only appears
when an agent marks its own review step.
Blind spots: parser edge cases (BOM, CRLF, duplicate sections) are unit-tested but were
never run against a live messy issue.

## 3. Voice + All Projects crash — issue #17 (chambervoice)
What to do: put the board in All Projects mode, then ask ChamberVoice what is on the
task board; then try to have it close or edit a task while still in All Projects mode.
What should happen: voice lists tasks merged across your repositories (each attributed
to its repo), no 404; mutations are refused with "board is in All Projects mode; specify
a repository" instead of writing to a wrong repo; issue numbers that exist in two repos
are reported with a disambiguation note.
Blind spots: all tests are mocked — no live GitHub call was made by the fix itself.

## 4. The lifecycle skill — issue #21 (shared skills library)
What to do: read
/workspace/config/opencode/.agents/skills/meta/orchestration/issue-lifecycle/SKILL.md
(plus scenarios.md, templates.md).
What should happen: the nine stages (Brainstorm, Draft, Align, Ready, Start,
In-Progress, In-Review = AI review, Needs-Human = your queue, Done/Close) match how you
want agents to work; the L5 batching section matches how you want to be asked; nothing
in it contradicts the contract at
/workspace/extensions/github-task-board/docs/issue-body-contract.md.
Blind spots: no agent has run a real issue through the skill yet — a dogfooding run is
the natural next step.

## Out of this batch (filed, per your D6 decision)
- #18 rate-limit backoff on single-repo fetch/PATCH paths — next batch.
- #19 background streaming re-render drops input focus — next batch (visual pass may fold in).
