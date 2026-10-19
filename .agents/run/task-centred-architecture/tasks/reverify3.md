<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
Base commit: ce230ab (Q4 alignment) on top of 4224d1f, which is on top of 37243b4. Worktree clean except untracked `.agents/idle-nontext-state.json`.
You are a FRESH verifier; you did not author, fix or previously review. Own only verifications/final3.md. Do not edit the draft or companions, do not publish, do not touch final.md/final2.md/proof.md.
</env_preflight>

<goal>
Decide whether the current HEAD resolves N-01, N-02, N-03, N-04, N-05, N-06 from verifications/final2.md plus the Q4 alignment, without introducing new defects, and is safe to publish as one draft issue. Return two verdicts and READY/BLOCKED.
</goal>

<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/verifications/final2.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/revision-notes.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/extensions/github-task-board/panel/core.ts]
</context_files>

<scope>
1. N-01 Scenario 7: confirm no unconditional autonomous remediation and no unconditional "human not alerted" claim; both autonomy branches present.
2. N-02 Scenario 8: confirm the overlap policy is conditional and covers skip, queue and parallel.
3. N-03 Decision 3: confirm the panel loop is no longer offered in Q3/Human Task 3, is visibly marked evaluated/rejected in the table, and that Stage 2 / Scenario 9 storage wording fits host, plugin and relay routes without contradiction. Then search the whole body for any other pass condition that still excludes an option offered in Q1-Q5. This is the defect class that has now failed twice — be exhaustive: go question by question, then every acceptance criterion, migration stage, scenario and human task against the option lists.
4. N-04: "manual retention review" appears in Q5 and Human Task 5.
5. N-05: design-evidence lines 25-29 match the conditional wording.
6. N-06: revision-notes no longer claims all blockers resolved.
7. Q4: the question now offers the same three phase models as Human Task 4 and the Decision 4 table.
8. Regression: run the actual v1 parsers; report title, questions, human tasks, test plan, subtasks, unchecked. Grep the public body for `/workspace/`, `ses_`, `55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`, `41f51f5`, `cb1c4ab`, `4224d1f`, `- [x]`. Confirm banner, exactly 5 questions/5 human tasks, no clean-render claim, all boxes unchecked.
9. Read the final body end to end as a human, specifically asking: "If I picked the option the draft does NOT recommend, would any sentence still call my choice a failure?" Report every instance, however small.
</scope>

<criteria>
- Anchored findings only (file:line or command).
- Blocker forces BLOCKED. Do not re-open resolved items.
- No publication, no edits to the draft, no runtime claims for NOT RUN items.
- Do not flag stylistic preferences as blockers.
</criteria>

<steps>
1. Confirm HEAD and clean state.
2. Work through scope items 1-9.
3. Write verifications/final3.md: verdicts, per-item ledger, any new findings, residual unknowns, READY/BLOCKED.
4. Commit only verifications/final3.md.
</steps>

<output>
<=10 lines: SPEC, QUALITY, READY/BLOCKED, unresolved IDs, commit, parser counts, residual doubt.
</output>
