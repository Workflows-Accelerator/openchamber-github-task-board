# Decisions — board-lifecycle (aligned 2026-09-26)

## D1. Human to-do source of truth: HYBRID
Agents write an explicit `### Human Tasks:` checklist when they block on a human.
Fallback when the section is absent/empty: derive items from unanswered
`### Open Questions:` plus the attached session's waiting reason
(`waiting-permission` / `waiting-question`).
Rationale: machine-readable for board + voice, forgiving of pre-existing issues.

## D2. Simplified views: THREE (user's own framing, supersedes my two-mode proposal)
1. **Human Tasks** — everything the human must do (from D1 extraction).
2. **All Tasks** — every issue, friendly titles only, grouped by status.
3. **Questions** — all open questions across issues, for fast alignment.
Existing list/kanban/graph/archive views remain untouched.

## D3. Review = AI step (RESOLVED 2026-09-26)
`in-review` = the agent is reviewing its own finished work (AI hostile-review gate).
`needs-human` = anything awaiting the human: permission, answers, or final validation.
Human to-do list reads exactly: everything in `needs-human` + open questions (any status).
Code changes required by this: labels.ts:155 description rewrite; the idle-session
auto-transition (labels.ts:403-468) moves issues to `needs-human` (awaiting validation),
NOT `in-review`; `in-review` is set by explicit `status:in-review` label while the agent
self-reviews.

## D4. Lifecycle skill: ONE skill in the shared library
`/workspace/config/opencode/.agents/skills/...` — one `issue-lifecycle` skill, backed
by a single written issue-body contract referenced by board parsers, the AI issue
prompt, and the voice prompt.

## D5. Build order: contract + to-do views first
Contract locked first (incl. Human Tasks section), then the three views. Lifecycle
skill written in parallel against the contract. Visual polish after the views exist.

## D6. Bugs: file all four now; fix the `__all_projects__` voice crash in this iteration
Issues to file: (1) voice 404 crash on All Projects mode [FIX NOW], (2) rate-limit
backoff missing on single-repo fetch + PATCH paths (main.ts:1219,1281), (3) full
re-render on streamed pages drops input focus (main.ts:1156,1161), (4) idle sessions
auto-move issues to in-review (labels.ts:403-468) [tied to D3].
Crash fix is voice-side defensive handling (chambervoice repo) — the board-side
storage contract tweak folds into the contract track to avoid two workers in one repo.

## D7. Portfolio access: user GRANTED direct access
gh is not installed anywhere (verified by explorer: `gh: command not found`);
workers can reach api.github.com with /workspace/.git-credentials. User chose to
grant the manager direct access. Until it is live, issue ops route through workers.

## D8. Voice multi-project routing (new tool `repo` argument) — NOT this iteration
Tracked as filed issue; the seam map has the gap analysis.

## D9. Contract v1 clarifications (surfaced by skill walkthroughs + its hostile review)
1. Human Tasks / Open Questions items must be **self-contained prose** — chambervoice
   reads raw issue bodies over REST and sees no drawer metadata.
2. Cross-repo dependencies use **full URLs**, never `#N` shorthand (wrong-repo links).
3. Issues **actively blocked awaiting alignment** sit in `status:needs-human`; passive
   ideas stay `status:draft` (they surface via the Questions view).
FOLD INTO docs/issue-body-contract.md when the contract worker's output lands
(its brief predates these lines) — small follow-up patch at review time.

## D10. Gate ledger (this run)
| Work | L4 hostile review | L5 human review |
| --- | --- | --- |
| explore-board-map / explore-voice-seam | waived — read-only mapping, no code changes | waived |
| issue-lifecycle skill (ses_500dac19a1fa9ad474cb9429, commits 03f0b6e + c17c1f1, issue #21) | PASSED 2026-09-26 — 5 findings, all fixed (state-machine branch, section order, alignment-blocked status, L5 batching contract, issue #21 self-compliance) | queued for batch |
| voice crash fix + 4 filed issues (ses_909742d6a8b4139607f53184, issues #17-#20) | PASSED 2026-09-26 — 7 findings, all fixed (HIGH: getTask wrong-repo match + masked auth errors; slug validation, case-insensitive dedup, repo attribution in tool outputs, vacuous tests). chambervoice suite 427 green | queued for batch |
| contract + extraction (ses_cb7138841e2593d7a1f8bdff, commit 7196e06+, issue #22) | PASSED 2026-09-26 — 12 findings, all fixed (HIGH: main.ts resolveIssueColumn still routed idle->in-review; collectHumanTodos cross-issue session hijack; stale bundle). suite 217 green; D9 clarifications folded into docs | queued for batch |
| three views (ses_a666af59d1eb6423a9bc5d0c, issue #23) | RUNNING 2026-09-26 | queued for batch |

## Integration warning (updated after L4s)
The contract L4 had to touch panel/main.ts (resolveIssueColumn fix at main.ts:1767,1828) and
rebuild panel/main.js — the same files the views branch owns. BOTH branches now touch
main.ts + main.js. Merge procedure: merge contract branch first, then views; resolve
main.ts conflicts keeping the contract's idle->needs-human resolution; then REBUILD
panel/main.js once from merged sources and re-run shipped-parity + full suite. Never merge
the bundle by hand.

## D11. Request efficiency (aligned 2026-10-07)
- Incremental idle refresh across current scope: only changed issues, using since and conditional reads where actually supported. NOT targeted-only issue/repo refresh that misses other people's edits.
- Voice task reuse up to 30 seconds approved.
- No-loss bundle: conditional reads, comment reuse without feature loss, one PATCH for status/priority drag, optimistic create without full refetch, bounded retry defense, safe known-repo lookup. No hidden additional freshness loss or numeric-issue guessing.
- No timer polling exists; adaptive-polling option dropped.
- Source: specs/rate-limit-manager-review.md. Measured request savings and real browser conditional transport remain UNKNOWN.

## D12. GitHub caching route: DIRECT ORIGINS CAPABILITY (user, 2026-10-08)
Declare `capabilities: ["origins"]` + `contributes.origins: ["https://api.github.com"]` in the board manifest so the existing direct-fetch ETag/If-None-Match/304 path (main.ts:1094-1152) activates with the workspace token the user already provides. Rejected: host proxy upgrade (kept as possible later platform work; cleanest security but release-cycle cost), PAT-in-settings via proxy (proxy strips headers — cannot 304 regardless). Binding caveats: (a) implementation MUST empirically re-verify the CSP/origins claim in the real served panel and show an actual 304 in the network log before this counts as done; (b) no token values or prefixes in any log, test fixture or artifact; (c) the host.request fallback must remain intact for users without a workspace token.

## D13. Repo manual-override lifetime: FOLLOW THE SESSION (user, 2026-10-08)
Current-session repository is the default. A manual repo pick is scoped to the current session context: when the active session changes, selection resets to the new session's repository automatically. Explicit switching stays easy within a session context; the "Current session" control remains the anchor back to the default. (Manager had recommended keeping the manual pick; the user chose follow-the-session — this decision is authoritative.)

## D14. Missing friendly title falls back to the ISSUE TITLE (user, 2026-10-08)
The "(No friendly title)" placeholder is REJECTED — it should never appear. When an issue body has no
Friendly Title line, the simplified lists show the issue's own (technical) title. Separate known defect:
every issue currently shows the placeholder even though all 12 live bodies carry Friendly Titles —
a live parsing/data-path bug under investigation; the fixture-based tests passed, so production-path
truth is unproven. (D14 supersedes the placeholder behavior built in fix/review-feedback-views.)

## D15. Repo selector shows the SESSION'S REPO INLINE (user, 2026-10-08)
The picker must always display which repository the current session is linked to (e.g. "Session repo:
github-task-board"), with the actively picked repo visibly distinct. The current anchor wording is not
clear enough. Also reported: the picker showed a cache/rate-limit message during click-through; that
state must look intentional and explain what to do.

## D16. Cross-repo links: GROUP BY REPO + FULL URLS (user, 2026-10-08)
In All Projects mode, Human Tasks / Questions (and the to-do views generally) group by repository and
show related issues in other repositories as plain full-URL links (consistent with D9). User values the
"everything waiting on me" view; the current empty "nothing to show" state is a load failure, not truth.

## Gate ledger correction (2026-10-07)
- Batch 1 contract/views/status and voice crash local integration landed, L4 passed as indexed in verifications/proof.md; human review pending, not Done. Older RUNNING rows above are historical.
- Batch 2 voice cd6ab18 and board 656cc4f: both independent hostile reviews HALT. No integration/acceptance; repair 1 dispatched into isolated worktrees. Worker/model/session details: status-l4-halts-2026-10-07.md.
- Per-issue human verdicts remain required. Agent closure/push prohibited. Do not infer approval from old batch request or green synthetic tests.
- Unsupported conditional transport or incremental deletion/transfer loss is a potential alignment fork, not approved new polling/auth/freshness policy; workers must report evidence/options.

# Issue body contract (v1 — canonical text in specs/issue-body-contract-v1.md)
- `### Friendly Title:` — 3-6 words plain English (parseFriendlyTitle, core.ts:85)
- Overview / description block
- `### Open Questions:` — checkboxes, parsed (core.ts:136)
- `### Actionable Subtasks Checklist:` — checkboxes (core.ts:175)
- `### Human Tasks:` — NEW, checkboxes; what a human must do (D1)
- `## Test Plan (Issue|Batch)` / `Blocked by #N`
