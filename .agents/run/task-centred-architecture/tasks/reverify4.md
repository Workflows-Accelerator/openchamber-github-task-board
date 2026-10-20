<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
Base commit: c1d1df6 (on top of be21ac1). Worktree clean except untracked `.agents/idle-nontext-state.json`.
You are a FRESH verifier; you did not author, fix, or previously review. Own only verifications/final4.md. Do not edit the draft or companions, do not publish, do not touch final.md, final2.md, final3.md, or proof.md.
</env_preflight>

<goal>
Decide whether the current HEAD resolves N-07 and N-08 (blockers) and N-09, N-10, N-06 (minors) from verifications/final3.md, without introducing new defects, and is safe to publish as one draft issue. Return two verdicts and READY/BLOCKED.
</goal>

<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/verifications/final3.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/revision-notes.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/extensions/github-task-board/panel/core.ts]
</context_files>

<scope>
1. N-07: Confirm line 35 of issue-draft.md states execution liveness is managed in the selected route's authoritative store (extension storage for host/plugin, relay store for central relay), eliminating the contradiction with the central relay option.
2. N-08: Confirm line 61 of issue-draft.md scopes tiny-task deliverable collapse to the Decision 4 adaptive fast-path choice, eliminating the contradiction with compulsory full phases.
3. N-09: Confirm Scenario 11 (line ~288) includes the human-dispatched phase advancement verification branch.
4. N-10: Confirm design-evidence.md summary rows (B4, B7, A6, A8) are aligned with conditional architecture choices.
5. N-06: Confirm revision-notes.md lines 278 and 267-268 and Section 8 accurately reflect the resolution history.
6. Comprehensive decision neutrality audit: Test all options across Q1-Q5. Does selecting ANY evaluated alternative from Q1 through Q5 cause any acceptance criterion, migration stage, or test plan scenario to contradict itself or fail?
7. Regression: Run actual v1 parsers (import from panel/core.ts); verify title "All Work Runs on the Board", 5 open questions, 5 human tasks, 17 test plan items, 58 subtasks, all unchecked. Grep public body for forbidden leaks: /workspace/, ses_, 55ddeaa, df8d3ff, 9c1a3f8, 6b0d8b9, 41f51f5, cb1c4ab, 4224d1f, ce230ab, - [x], /abort. Confirm 0 matches.
</scope>

<criteria>
- Anchored findings only (file:line or command).
- Blocker forces BLOCKED. Do not re-open previously resolved items unless regressed.
- No publication, no edits to the draft, no runtime claims for NOT RUN items.
</criteria>

<steps>
1. Confirm HEAD and clean worktree.
2. Work through scope items 1-7.
3. Write verifications/final4.md: verdicts, per-item ledger, any new findings, residual unknowns, READY/BLOCKED.
4. Commit only verifications/final4.md.
</steps>

<output>
<=10 lines: SPEC, QUALITY, READY/BLOCKED, unresolved IDs, commit, parser counts, residual doubt.
</output>
