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

## Workstream status (updated 2026-10-07)

State: building (batch 2 bounded repair 1 after both L4 HALTs); awaiting_human (batch 1). Alignment: CONFIRMED for lifecycle + D11 efficiency decisions; no approval for feature/freshness loss. See decisions.md, specs/rate-limit-manager-review.md and status-l4-halts-2026-10-07.md.

| Track | Where | Session | State |
| --- | --- | --- | --- |
| Voice All Projects crash #17 | chambervoice local master, 21fd1d1 | ended | Batch 1 human verdict pending |
| Contract #22/status #20 + views #23 | board local master, 9f651db, final hardening 4194652 | ses_9623172ae6d79b9821e636bc ended | 244 tests reported green; Batch 1 human verdict pending |
| Lifecycle skill #21 | config/opencode | ended | L4 passed; Batch 1 human verdict pending |
| V2 compatibility audit | verifications/v2-compat-audit.md | ses_ecdfe3aa6e23d79b33d843f7 ended | Received; runtime reply tests missing |
| GitHub efficiency audit and D11 choices | specs/rate-limit-manager-review.md | ses_a9897235d8cb1b41183c8bab ended | Audit received; estimates not measured; choices approved |
| Board V2 binding + D11 efficiency build | board root feat/v2-binding-and-ratelimit, 656cc4f | ses_068d6622598dc3b1059dbd91 ended | NOT accepted; 253 tests reported, root still serves experimental build |
| Board V2 + D11 hostile review | board root (read-only), l4-board-v2-ratelimit.md | ses_af99b63ee4e5d43f2caed88c ended | HALT, 14 reported findings; simulation evidence caveats recorded |
| Board V2 + D11 repair 1 | .worktrees/team-dev-v2-binding-ratelimit-review-repair, fix/v2-binding-ratelimit-review-repair | ses_5872aebae42f0424f9288287 | Running; engineer and auto-accept verified; isolated app owner |
| Voice V2 + D11 efficiency build | chambervoice root feat/v2-compat-and-ratelimit, cd6ab18 | ses_6a5a8749c6759270a40cbafd ended | NOT accepted; 437 tests green but actual protocol defects found |
| Voice V2 + D11 hostile review | chambervoice root (read-only), l4-voice-v2-ratelimit.md | ses_fc89160228e764868dff56b1 ended | HALT; positive real reply proof missing |
| Voice V2 + D11 repair 1 | chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair, fix/v2-ratelimit-review-repair | ses_1797615df11da447fd7d5863 | Running; engineer and auto-accept verified; isolated app owner |
| Visual polish + focus drop #19 | board | — | Parked behind current frontier |
| Voice human_todo + explicit repo argument | chambervoice | — | Deferred (D8); no redesign approval assumed |

Proof index: verifications/proof.md. Active repair briefs: briefs/voice-v2-ratelimit-repair-1.md and briefs/board-v2-ratelimit-repair-1.md. All report receipts must exclude login secrets, tokens, and cookies.

### Immediate next moves
1. Await repair wakes; do not duplicate or re-prompt ended sessions. Next delegate after each build must be fresh read-only hostile review of its exact commit.
2. Fold in real trade-offs (GitHub deletion/transfer detection, SDK conditional transport) before alignment decisions; no silent no-loss claim or new polling/timeout policy.
3. Positive form/permission reply proof is NOT RUN: empty pending lists prove discovery only. Safe isolated actual V2 fixtures may be planned/run within worker brief bounds; shared-host session mutation is NOT authorized.
4. Batch 1 verdicts are pending (l5-batch-1.md); do not repeat the full ask. Root served checkouts contain rejected batch 2 code, so original preview is not validated. Batch 2 human review waits for all L4 members.
5. Only the USER closes/moves issues to Done and pushes. Prior text promising agent closure is superseded.
6. The worktree skill's hardcoded DB path is adapted to HOME at use time, per manager guardrail; shared skill file is NOT to be edited. Manager shell denial on git check-ignore recorded; worktree preparation delegated without a manager workaround.

## Roadmap beyond this iteration

1. Views B (three simplified views) — depends on contract extraction API.
2. Visual polish pass with real screenshots (browser verification).
3. Voice: `human_todo` tool action + `repo` argument + `__all_projects__` contract fix
   on the board side (storage schema: keep `selected_repo` real, add `view_mode`).
4. L4 hostile review per workstream, then one L5 human review batch.

## Constraints observed

- Manager shell allowlist is single git commands / oc_admin / node --test. `gh` denied.
- Manager read/write/edit restricted to `.agents/run/**`. Code work goes to workers.
