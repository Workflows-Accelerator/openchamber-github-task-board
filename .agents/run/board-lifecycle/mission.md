# Mission — github-task-board: human-in-the-loop lifecycle, perfected

Session: ses_f22887e18ffem6RBrwgNhw5iNM
Owner: team (manager). Started: 2026-09-26.

## Outcome we are driving to

Team agents and the voice-call extension can seamlessly manage issues across one or
more projects through the full lifecycle:
brainstorm -> draft issues -> align with human -> ready -> start -> needs-human -> human review -> close.

Concretely, the user named these deliverables:

1. **Human to-do extraction** — a clear, machine-extractable way to know *what the human
   must do* for every issue in the `needs-human` step (and other human-blocked states).
2. **Simplified to-do list view** — a minimal list of human items (fast intake), plus a
   simplified issue list (friendly title only) with normal filtering.
3. **A really neat, well-thought-out lifecycle skill** for the managing/team agents,
   covering every step including brainstorming and issue drafting/alignment.
4. **Amazing visuals** on the task board extension (UX polish).
5. **Voice-call extension interop** — multi-project management from the voice flow.
6. Speed and reliability improvements along the way.

## Grounded facts (verified by grep, 2026-09-26)

- Status columns (`panel/types.ts:37`): draft, backlog, todo, planned, in-progress,
  needs-human, in-review, done. Tabs filter per column (`panel/index.html:2530`).
- Views today: list (`main.ts:2359`), kanban (`main.ts:2451`), graph (`main.ts:3138`),
  archive (`main.ts:1935`), all-projects aggregation (commit 213fef8).
- Issue body is markdown with conventions parsed in `panel/core.ts`:
  `### Friendly Title:` (parseFriendlyTitle), `### Open Questions:` checkboxes
  (parseOpenQuestions), subtask checkboxes (parseSubtasks), test plans.
- `needs-human` semantics (`panel/labels.ts:141`): "Blocked waiting on human permission,
  answers, or input". Column resolution falls back to `needs-human` on several
  blocked/permission shapes (labels.ts:407-462).
- Tests live in `test/*.test.js` (node --test), incl. layout-and-views, checklist,
  ai-prompt, shipped-parity. `panel/main.js` is a build artifact of `panel/main.ts`.
- Friendly title renders as card title with the technical title as a mono subtitle
  (layout-and-views.test.js:334).

## Open forks awaiting user answers (2026-09-26)

ALL RESOLVED — see decisions.md (D1-D8, aligned 2026-09-26). Remaining fork: none.

## Workstream status (updated 2026-09-26)

| Track | Where | Session | State |
| --- | --- | --- | --- |
| Voice crash fix + file 4 issues | chambervoice | ses_909742d6a8b4139607f53184 | running |
| Contract v1 + Human Tasks extraction + D3 semantics | github-task-board | ses_cb7138841e2593d7a1f8bdff | running |
| issue-lifecycle skill | config/opencode skills library | ses_500dac19a1fa9ad474cb9429 | running |
| Three simplified views (Human Tasks / All Tasks / Questions) | github-task-board | — | next, after contract lands |
| Visual polish ("amazing visual") | github-task-board | — | after views exist |
| Voice `human_todo` + multi-project routing | chambervoice | — | next iteration (D8) |

## Roadmap beyond this iteration

1. Views B (three simplified views) — depends on contract extraction API.
2. Visual polish pass with real screenshots (browser verification).
3. Voice: `human_todo` tool action + `repo` argument + `__all_projects__` contract fix
   on the board side (storage schema: keep `selected_repo` real, add `view_mode`).
4. L4 hostile review per workstream, then one L5 human review batch.

## Constraints observed

- Manager shell allowlist is single git commands / oc_admin / node --test. `gh` denied.
- Manager read/write/edit restricted to `.agents/run/**`. Code work goes to workers.
