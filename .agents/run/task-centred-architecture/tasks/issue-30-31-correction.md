<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design (design docs only)
Owned: .agents/run/issue-30-31-design/proposal.md and a new corrections note beside it. Nothing else.
Do not touch: code, tests, shared skills, other worktrees, GitHub. No push, merge, issue edits.
</env_preflight>
<goal>
One correction pass on the #30/#31 proposal so every finding in revised-review.md is resolved or explicitly left as an owner decision.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/proposal.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/revised-review.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Fix exactly these:
1. Question ID (~:233): IDs must be exact, case-preserving, and never derived from stripped link text; specify matching that cannot be spoofed by a look-alike or relinked question.
2. Generation (~:232-237): must not reset when lines are deleted; use a monotonic counter stored in the body or comment, and say what happens on a manual edit that lowers it (refuse, not reset).
3. §4 (~:152-154): a question raises attention (needs-human) without changing workflow phase. Phase and attention stay separate.
4. D1 (~:95): remove the pre-baked approval and the new `type:*` label; use the existing `bug`/`enhancement` labels plus a Work Log. Present D1 as an open owner decision.
5. Writes (~:252-259): remove atomic wording; best-effort with pre-save conflict check; failed/ambiguous readback is reported UNKNOWN and never auto-repeated (matches owner decision).
6. Host service (~:278): mark host service execution UNVERIFIED; label 3–5 days as an estimate.
7. Automatic-closure evidence: say resolution to done was reproduced live, PATCH chain inferred from source, and that #36 removes automatic closure.
Then write D1–D3 as three plain-language owner questions, each with 2–3 options and a recommendation, at the top of the proposal.
</scope>
<criteria>
Every revised-review finding mapped to a line in the new proposal or an owner question. No new scope.
</criteria>
<output>
Commit in the worktree. Return at most 12 lines: commit, finding→fix map, the D1–D3 questions verbatim, actual model.
</output>
