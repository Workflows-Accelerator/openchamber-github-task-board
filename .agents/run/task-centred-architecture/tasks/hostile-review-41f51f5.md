<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
HEAD: 41f51f5 (clean apart from untracked .agents/idle-nontext-state.json — ignore it)
You have READ-ONLY intent: do not edit, commit, push, or publish anything. Report only.
</env_preflight>

<goal>
Conduct a hostile review of the four files changed in commit 41f51f5 to find what was missed or broken. Do not assume the change is right. The author is not available; you are the adversary.
</goal>

<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/source-receipts.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/revision-notes.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/extensions/github-task-board/panel/core.ts]
</context_files>

<scope>
Read the diff: `git diff 6b0d8b9..41f51f5`. Then attack it, specifically:
1. Internal contradictions introduced by the edits: the Overview parser note vs the actual body; Decision table vs Open Questions vs Human Tasks vs Later Proof Tasks vs Acceptance vs Test Plan vs Subtasks. Counts stated anywhere that no longer match.
2. Any surviving claim that an open decision is already made (intake, hosting, recurrence/run representation, autonomy, fast path). Migration steps and test pass conditions are the usual leak points.
3. Any false or unsupported claim: rate numbers, GitHub limits, transfer/sub-issue constraints, SDK gaps, hidden-skill behavior, scheduler methods, parser behavior. Flag anything asserted as fact without DOCUMENTED / SOURCE-OBSERVED / PROPOSED / UNKNOWN-NOT RUN.
4. Redaction: grep the public body for local absolute paths, `ses_`, unpushed commit hashes, credentials.
5. Parser reality, not the note's claim: run the actual functions from `panel/core.ts` against the body yourself (throwaway script under /tmp/opencode; use node --experimental-strip-types or the repo's existing method). Report actual title, questions, human tasks, test-plan and subtask counts. Check that the fenced example's `### Friendly Title:` does not hijack the real title, and that `### Later Proof Tasks` does not bleed into questions/test plan.
6. Human readability: does a reader with no context understand each of the 5 questions and 5 human tasks, and are they distinct and non-overlapping?
7. Anything in the companion files that contradicts the body or claims something the body does not support.
</scope>

<criteria>
Report only defects — no praise, no restating the diff. Each finding: `file:line`, severity BLOCKER/MAJOR/MINOR, what is wrong, and the smallest fix. If you find nothing in a category, say so in one line. Do not propose a rewrite.
</criteria>

<output>
<=20 lines: a verdict line (PUBLISHABLE / NOT PUBLISHABLE), then numbered findings in the required format. Include the verbatim parser output.
</output>
