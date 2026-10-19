<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
HEAD: 41f51f5, clean except untracked .agents/idle-nontext-state.json (never commit it)
Owned files: .agents/run/task-centred-architecture/{issue-draft.md,design-evidence.md,source-receipts.md,revision-notes.md}
Forbidden: push, PR, publish, gh writes, resets, touching any other file.
</env_preflight>

<goal>
Apply four tiny review fixes, re-run the parser once, commit. This is a one-commit surgical edit; change nothing else.
</goal>

<steps>
1. issue-draft.md:122 — replace "workspace-relative links" with "repository-relative links".
2. issue-draft.md Decision 5 row — the recurrence cell currently proposes "Definition issue + run records" while calling retention open. Reword so the fork is explicit: state that the run representation is itself undecided between (a) reusable definition issue plus separate run records and (b) a single issue with an appended run ledger, then present the definition-plus-runs option as the recommendation with its capacity caveat. Do not lengthen the row by more than ~25 words.
3. issue-draft.md Stage 5 subtask "Execute controlled sandbox proof test..." — prepend "Following human authorization (Proof Task E): ".
4. source-receipts.md and design-evidence.md — strip the leading `/workspace/` (and `/workspace/extensions/github-task-board/`) from any public-facing table cells, leaving repository-relative paths. Keep commit hashes in these private companions but add one line at the top of each: "Internal traceability artifact — contains local commit references; not for publication."
5. Re-run the real v1 parsers exactly as before on issue-draft.md. The title, question count (5), human-task count (5) and test-plan count (17) must be unchanged; report the subtask count.
6. Update revision-notes.md with a one-line entry noting these four fixes and the new count.
7. Commit the four files as `docs(proposal): apply MINOR review fixes`.
</steps>

<output>
<=10 lines: commit hash, parser output verbatim, confirmation each of the four fixes is present, anything not done.
</output>
