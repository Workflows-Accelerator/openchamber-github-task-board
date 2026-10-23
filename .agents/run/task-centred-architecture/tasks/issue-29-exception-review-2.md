<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-dev-issue-29-task-context
Branch: docs/issue-29-task-context; exception 856826b, first review becdcea, remediation d9ca47a. Worker reports clean tree, no push.
Files: the three edited instruction files plus the migration addendum; report-only review at .agents/run/issue-29-task-context/exception-review-2.md.
Verification: rerun the two cited test commands; read the actual sentences; verify each of F1-F6/F8 is genuinely closed, not reworded around.
Do not touch: instruction files (review only), opencode.json, credentials, opencode.db, host settings, live config root, master, remote issues, deployment. No push, no DB registration.
Preflight facts authoritative; targeted checks allowed.
</env_preflight>
<goal>
Decide whether the issue-backed briefing exception is now safe to enable in the live manager configuration, or must be blocked again.
</goal>
<context_files>
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/exception-review.md]
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/migration.md]
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/29
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/32
</context_files>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Review-only. For each prior finding F1, F2, F3, F4, F5, F6, F8: quote the new sentence, decide CLOSED / PARTIAL / OPEN, and say what an adversary could still do with the remaining text. Actively try to construct two attack readings against the new wording: one where an issue comment grants scope or approval, one where the issue tells a worker to push, deploy, close or expose a credential. Also check whether the re-read-before-action rule creates a livelock or is bounded, whether the governed-edit-path requirement for questions can be satisfied by a worker without violating append-only write-back, and whether the exception still reads as optional for a manager skim-reading team.md.
Verify the F8 correction lists the same files the reviewer found and no others are silently omitted. Check nothing outside the three files changed and that the disk-brief default path is unchanged in practice.
State clearly whether activation is safe now, what it still cannot guarantee (permission isolation is prose, not capability separation), and any single remaining sentence to fix. Do not fix anything.
</scope>
<criteria>
Two verdicts Spec PASS/FAIL/PARTIAL and Quality APPROVED/NEEDS-FIXES; per-finding CLOSED/PARTIAL/OPEN with quotes; two attempted attacks and their outcome; explicit activation decision with scope; tests rerun; NOT RUN list.
</criteria>
<output>
Write and commit only .agents/run/issue-29-task-context/exception-review-2.md. Return <=15 lines: activation decision, per-finding status, attacks, tests, commit, supplied identity. Stop.
</output>
