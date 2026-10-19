<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
HEAD: 4224d1f, clean except untracked .agents/idle-nontext-state.json (never commit)
</env_preflight>

<goal>
One edit, one commit: make Q4 match the three options already listed in Human Task 4 and the Decision 4 table. Do not change anything else.
</goal>

<steps>
1. In issue-draft.md, replace the Q4 line under `### Open Questions:` (currently a yes/no question about the adaptive fast-path) with: "Which phase model should govern execution: adaptive fast path for simple tasks (preserving independent hostile review and human sign-off), compulsory full phases on every task, or human-dispatched advancement one phase at a time?"
2. Re-run the actual v1 parsers on the body and confirm title, 5 questions, 5 human tasks, 17 test-plan, 58 subtasks, all unchecked.
3. Append one line to revision-notes.md recording this Q4 wording fix.
4. Commit exactly those two files as `docs(proposal): align Q4 with phase model options`.
</steps>

<output>
<=6 lines: commit, parser counts, confirmation the Q4 text is present, anything else.
</output>
