<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
Base commit: 37243b4 (fix commit on top of reviewed cb1c4ab). Worktree clean except untracked .agents/idle-nontext-state.json.
You are a FRESH verifier. You did not author, fix or previously review the draft. Own only verifications/final2.md. Do not edit the draft or companions, do not publish, do not touch verifications/final.md or proof.md.
</env_preflight>

<goal>
Decide, from the text and runtime evidence, whether commit 37243b4 resolves BLK-03, NEW-01, MAJOR-01 and minors 1-8 from verifications/final.md, without introducing new defects, and is safe to publish as one draft issue. Return two verdicts and READY/BLOCKED.
</goal>

<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/verifications/final.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/source-receipts.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/extensions/github-task-board/panel/core.ts]
</context_files>

<scope>
1. BLK-03: read AC 8/9/11, Scenarios 8 and 11, Q5 and Human Task 5. Confirm each is conditional on or neutral toward Decisions 2, 4 and 5, and that the recurring-task representation is now actually asked. Try to falsify: is there any remaining sentence outside the decision table that mandates a specific open option as a pass condition? Search acceptance criteria, subtasks, migration stages, test scenarios and human tasks.
2. NEW-01: confirm the public body and both companions contain no `/api/session/:id/abort`. Confirm the documented route `POST /api/session/:sessionID/interrupt` matches the installed runtime (grep the installed protocol yourself; do not trust the previous report). Confirm the claim is labelled SOURCE-OBSERVED and does not claim interruption equals a clean stop.
3. MAJOR-01: confirm host-daemon storage is (a) stated as unverified in the body, (b) present in the capability-gap list, and (c) every `.openchamber-data/` claim that depends on it is qualified.
4. Minors 1-8: fenced title removed and prose added; `transferIssue` used with no `POST .../transfer`; no asserted HTTP 301; SDK anchor 145 correct in package; Scenario 6 anchor points to a real AC or section; base-commit lines accurate; Q1/Q2 option lists complete; fast-path sequence includes human_verification.
5. Regression sweep: run the actual v1 parsers and report title, questions, human tasks, test plan, subtasks, unchecked counts. Grep the public body for `/workspace/`, `ses_`, `55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`, `41f51f5`, `cb1c4ab`, `- [x]`. Confirm no checked box, no false "renders cleanly" claim, proposal-only banner intact, exactly 5 questions and 5 human tasks.
6. Read the body once as a human: does any sentence now read as self-contradictory after the conditional rewrites? Flag awkwardness only if it creates ambiguity about authority or scope.
</scope>

<criteria>
- Every finding anchored to file:line or a reproducible command.
- A blocker forces BLOCKED. Do not re-report resolved items as blockers; note them resolved.
- Do not publish, do not edit the draft, do not claim runtime proof for anything NOT RUN.
</criteria>

<steps>
1. Confirm HEAD and clean state.
2. Check BLK-03, NEW-01, MAJOR-01, minors in that order with exact evidence.
3. Run the parser check and the leak grep.
4. Write verifications/final2.md with verdicts, resolution ledger for BLK-03/NEW-01/MAJOR-01/minors 1-8, new findings, residual unknowns and READY/BLOCKED.
5. Commit only verifications/final2.md.
</steps>

<output>
<=10 lines: SPEC verdict, QUALITY verdict, READY/BLOCKED, unresolved IDs, commit, parser counts, residual doubt.
</output>
