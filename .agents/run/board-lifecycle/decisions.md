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

# Issue body contract (v1 — canonical text in specs/issue-body-contract-v1.md)
- `### Friendly Title:` — 3-6 words plain English (parseFriendlyTitle, core.ts:85)
- Overview / description block
- `### Open Questions:` — checkboxes, parsed (core.ts:136)
- `### Actionable Subtasks Checklist:` — checkboxes (core.ts:175)
- `### Human Tasks:` — NEW, checkboxes; what a human must do (D1)
- `## Test Plan (Issue|Batch)` / `Blocked by #N`
