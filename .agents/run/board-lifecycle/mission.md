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

State: awaiting_human (Batch 2 ask SENT 2026-10-07 — both chains L4-approved and merged into the served preview; Batch 1 + Batch 2 verdicts and two trade-off decisions pending). Alignment: CONFIRMED for lifecycle + D11 efficiency decisions; no approval for feature/freshness loss. See decisions.md, specs/rate-limit-manager-review.md and status-l4-halts-2026-10-07.md.

| Track | Where | Session | State |
| --- | --- | --- | --- |
| Voice All Projects crash #17 | chambervoice local master, 21fd1d1 | ended | Batch 1 human verdict pending |
| Contract #22/status #20 + views #23 | board local master, 9f651db, final hardening 4194652 | ses_9623172ae6d79b9821e636bc ended | 244 tests reported green; Batch 1 human verdict pending |
| Lifecycle skill #21 | config/opencode | ended | L4 passed; Batch 1 human verdict pending |
| V2 compatibility audit | verifications/v2-compat-audit.md | ses_ecdfe3aa6e23d79b33d843f7 ended | Received; runtime reply tests missing |
| GitHub efficiency audit and D11 choices | specs/rate-limit-manager-review.md | ses_a9897235d8cb1b41183c8bab ended | Audit received; estimates not measured; choices approved |
| Board V2 binding + D11 efficiency build | board root feat/v2-binding-and-ratelimit, 656cc4f | ses_068d6622598dc3b1059dbd91 ended | NOT accepted; 253 tests reported, root still serves experimental build |
| Board V2 + D11 hostile review | board root (read-only), l4-board-v2-ratelimit.md | ses_af99b63ee4e5d43f2caed88c ended | HALT, 14 reported findings; simulation evidence caveats recorded |
| Board V2 + D11 repair 1 | .worktrees/team-dev-v2-binding-ratelimit-review-repair, fix/v2-binding-ratelimit-review-repair, 00ac1b9 | ses_5872aebae42f0424f9288287 ended | Claims F-01..F-14 fixed, 265 tests; NOT accepted; manager checked commit/diff/clean state |
| Board repair 1 hostile review | same worktree (read-only), briefs/board-v2-repair-1-l4.md | ses_3c63be63d8cbb73cde19dac3 ended | PROCEED-WITH-CONDITIONS; 14 originals verified; 4 residual: D-01 storage JSON (HIGH), D-02 sentinel PATCH, D-03 304 page skip, D-04 silent truncation |
| Board repair 2 bounded fixes | same worktree at 00ac1b9, briefs/board-v2-repair-2-fixes.md | ses_5c0356f5e154169806b9fdea ended | 4 fixes committed bea33c0/0c3b60a/f2583e2/147d8dd + tests a8014aa + docs bca2bc9; 269 tests claimed; manager checked chain/diff/clean state; NOT accepted |
| Board repair 2 hostile review | same worktree (read-only), briefs/board-v2-repair-2-l4.md | ses_edc44a2c528758b04a5d3a20 ended | PROCEED (zero residual); D-01..D-04 verified fixed, F-01..F-14 collateral intact, 269/269 green (manager reproduced independently); report l4-board-v2-repair-2.md + board-v2-repair-2-l4/ committed on fix branch as 4353672 |
| Voice V2 + D11 efficiency build | chambervoice root feat/v2-compat-and-ratelimit, cd6ab18 | ses_6a5a8749c6759270a40cbafd ended | NOT accepted; 437 tests green but actual protocol defects found |
| Voice V2 + D11 hostile review | chambervoice root (read-only), l4-voice-v2-ratelimit.md | ses_fc89160228e764868dff56b1 ended | HALT; positive real reply proof missing |
| Voice V2 + D11 repair 1 | chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair, fix/v2-ratelimit-review-repair, 252225a | ses_1797615df11da447fd7d5863 ended | Claims 9 findings + extras fixed, 453 tests; NOT accepted; manager checked commit/diff/clean state |
| Voice repair 1 hostile review | same worktree (read-only), briefs/voice-v2-repair-1-l4.md | ses_e8f6110f2851bb374fe3c0bd ended | PROCEED-WITH-CONDITIONS; 3 residual defects: integer field type, 404 masking fall-through, partial-cache poisoning |
| Voice repair 2 bounded fixes | same worktree at 252225a, briefs/voice-v2-repair-2-fixes.md | ses_e0f2d7ad18363e33a02e08a4 ended | 3 fixes committed f58e11b/67f955f/d582374 + docs a5ddb77; 459 tests claimed; manager checked chain/diff/clean state; NOT accepted |
| Voice repair 2 hostile review | same worktree (read-only), briefs/voice-v2-repair-2-l4.md | ses_6d098c99a8d60ed4cbb8364e ended | PROCEED-WITH-CONDITIONS; 3 fixes verified + 9-item collateral sweep PASS + red/green on base; 1 residual: external form field type rejected (MEDIUM), blocks L5 |
| Voice repair 3 bounded fix | same worktree at a5ddb77, briefs/voice-v2-repair-3-fix.md | ses_de7b947c163f3c1c57b71b9f ended | single external-field fix at a7e3ac9 (normalizeQuestionRequest + replyQuestion inputFields + object-answer strip); red reproduced at a5ddb77, 460 tests green |
| Voice repair 3 hostile review | same worktree (read-only), briefs/voice-v2-repair-3-l4.md | ses_2baffff1f2bb7cbf79f5d8be ended | PROCEED (zero residual); red/green reproduced by reviewer, adversarial permutations pass, 12-repair collateral sweep PASS; report l4-voice-v2-repair-3.md + voice-v2-repair-3-l4/ in root run dir |
| Board integration merge | root checkout feat/v2-binding-and-ratelimit, briefs/integrate-board-batch2.md | ses_6b6bdf39c2559568f4e0307f ended | merge 8938494 (fix tip 4353672, zero conflicts) + bundle rebuild 66a734a; manager reproduced 269/269 in served root and diff scope 617d198..66a734a = fix chain only; engineer tier verified; preview branch now serves reviewed code |
| Voice integration merge | root checkout feat/v2-compat-and-ratelimit, briefs/integrate-voice-batch2.md | ses_93e9a89078ce4f3019d32046 ended | merge 7c6f816 (fix tip a7e3ac9, zero conflicts); manager reproduced 460/460 in served root and diff scope cd6ab18..7c6f816 = fix chain only; engineer tier verified; preview branch now serves reviewed code |
| Visual polish + focus drop #19 | board | — | Parked behind current frontier |
| Voice human_todo + explicit repo argument | chambervoice | — | Deferred (D8); no redesign approval assumed |

Proof index: verifications/proof.md. Active repair briefs: briefs/voice-v2-ratelimit-repair-1.md and briefs/board-v2-ratelimit-repair-1.md. All report receipts must exclude login secrets, tokens, and cookies.

### Immediate next moves
1. Integration merges COMPLETED and manager-verified: board 8938494+66a734a and voice 7c6f816 are now what the served preview roots load. Served roots still run the preview branches (feat/v2-binding-and-ratelimit / feat/v2-compat-and-ratelimit), NOT local master — master waits for verdicts; nothing is pushed.
2. NOW: send ONE Batch 2 ask (l5-batch-2.md): numbered plain-language click-through for board + voice, known blind spots, and the two open decisions (deletion/transfer freshness gap; PAT for conditional reads). Do not repeat the Batch 1 ask; those verdicts remain pending (l5-batch-1.md).
3. After verdicts: passing members merge onward to local master; worktrees torn down per worktree skill (branches kept; only the user pushes, closes issues, or moves them to Done). Bounced members return to In Progress with the user's note.
4. Positive form/permission reply proof is NOT RUN: empty pending lists prove discovery only. Safe isolated actual V2 fixtures may be planned/run within worker brief bounds (disposable-fixture-contract.md); shared-host session mutation is NOT authorized.
5. No silent no-loss claim or new polling/timeout policy for the two trade-offs; they go to the user as explicit options in the ask.
6. The worktree skill's hardcoded DB path is adapted to HOME at use time, per manager guardrail; shared skill file is NOT to be edited. Manager shell denials recorded (git check-ignore, git show <branch>:<path>).

## Roadmap beyond this iteration

1. Views B (three simplified views) — depends on contract extraction API.
2. Visual polish pass with real screenshots (browser verification).
3. Voice: `human_todo` tool action + `repo` argument + `__all_projects__` contract fix
   on the board side (storage schema: keep `selected_repo` real, add `view_mode`).
4. L4 hostile review per workstream, then one L5 human review batch.

## Constraints observed

- Manager shell allowlist is single git commands / oc_admin / node --test. `gh` denied.
- Manager read/write/edit restricted to `.agents/run/**`. Code work goes to workers.
