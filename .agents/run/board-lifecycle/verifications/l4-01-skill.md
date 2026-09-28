# L4 hostile review — LIFECYCLE SKILL (ses_500dac19a1fa9ad474cb9429)

Reviewed: /workspace/config/opencode/.agents/skills/meta/orchestration/issue-lifecycle/
(SKILL.md, scenarios.md, templates.md) + GitHub issue #21.
Verdict: PASSED, 5 findings fixed. Commits 03f0b6e + c17c1f1 in /workspace/config/opencode.

## Findings (all fixed)
1. [HIGH] SKILL.md:41-58 — linear pipeline diagram implied execution blocks route through
   In-Review (half-finished diffs into the AI gate); no needs-human -> in-progress return
   route. Fixed: bidirectional 6 <-> 8 branch; in-review bypassed on execution blocks.
2. [MEDIUM] templates.md / scenarios.md — Human Tasks and Open Questions placed ahead of
   Actionable Subtasks, violating contract v1 recommended order 2.1-2.7. Fixed: reordered.
3. [MEDIUM] SKILL.md:74,116 — alignment-blocked issues left in status:draft would miss the
   Human Tasks view. Fixed: active blockers -> status:needs-human; passive ideas stay draft.
4. [MEDIUM] SKILL.md:199-238 — missing L5 batching contract (batch:<name> quorum,
   Awaiting Batch badge, single batch review request). Fixed: dedicated section added.
5. [HIGH] Issue #21 violated the skill's own completion protocol (no subtasks, no Human
   Tasks, no status:needs-human). Fixed via REST: completed subtasks, verb-first Human
   Tasks (review artifacts, validate commit c17c1f1, close upon validation),
   label status:needs-human.

## Dogfood note
Issue #21 is itself in needs-human with Human Tasks — it is part of the L5 batch.
