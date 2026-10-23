<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-dev-issue-29-task-context
Branch: docs/issue-29-task-context; instruction change commit 856826b (6 files, +136/-1) on baseline 09c979f, reports 37a3ecc and 93f88dd earlier. Worker reports clean tree, no push.
Files: the six changed instruction files only, plus report-only review at .agents/run/issue-29-task-context/exception-review.md.
Verification: rerun the two test commands the author cited; read the edited hunks; grep for remaining mandatory-disk language on the manager path.
Do not touch: instruction/implementation files (review only), opencode.json, solo/worker prompts, credentials, opencode.db, host settings, live config root, master, remote issues, deployment. No DB registration, no push.
Preflight facts authoritative; targeted checks allowed for verification and precommit.
</env_preflight>
<goal>
Conduct a hostile review of the issue-backed briefing exception before any activation, focused on whether it can weaken approval boundaries, permissions or recovery honesty.</goal>
<context_files>
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/migration.md]
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/report.md]
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/review.md]
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/29
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Review-only. Attack the text as an adversary would read it: can an issue body or a comment smuggle a permission, an approval, a tool grant, a closure, a deployment, or a substituted scope? Does "the issue is the brief" permit a worker to treat a stale/transferred/ambiguous issue as authority? Does append-only writeback leak secrets, private paths or session identifiers into a public issue? Does the carve-out let a worker skip required empirical proof or a human gate by claiming the issue says so?
Check internal consistency with the files left unedited: subagent-driven-development and self-compaction still mandate disk briefs. Decide whether the declared precedence bullet is sufficient to remove ambiguity for a worker reading all of them, or whether the exception as written is still contradictory enough to produce wrong behavior. If contradictory, name the single smallest additional edit and the exact file/line.
Check the claim "grep shows no manager-path file silently mandates disk-only briefs" against reality, including skills referenced by team.md and dynamic-agent.md. Check that the fallback path is genuinely unchanged and that solo behavior is untouched. Check that progress comments cannot be mistaken for the board's parsed attention state.
Do not rewrite instructions. Do not activate anything. Report only.
</scope>
<criteria>
Two verdicts Spec PASS/FAIL/PARTIAL and Quality APPROVED/NEEDS-FIXES. Concrete severity + file/line for each finding, reproducible test output for the two suites. Explicit statement of whether activation is safe, what remains unproven (no live pilot yet), and the minimum remediation if any.
</criteria>
<output>
Write and commit only .agents/run/issue-29-task-context/exception-review.md. Return <=15 lines: verdicts, findings, whether the precedence bullet is sufficient, tests, residual risk, commit, supplied identity. Stop.
</output>
