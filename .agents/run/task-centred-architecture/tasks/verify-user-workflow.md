<env_preflight>
Repo/worktree: /workspace/extensions/github-task-board
Branch last known feat/v2-binding-and-ratelimit; inspect current HEAD and dirty state read-only.
Files: panel refresh/session observation paths, agent issue-update instructions and issue contract, related tests.
Test command: targeted existing tests identified by inspection; no builds or product edits in root.
Do not touch: application code, credentials, opencode.db, other worktrees, host settings, GitHub issue content, master. No live mutations, publishing or deployment.
</env_preflight>
<goal>
Verify the user's actual requested workflow: opening the board obtains fresh GitHub issues and linked-session activity, and agents have clear actionable instructions to keep those issues updated. We overbuilt a daemon and must stop confusing primitive tests with user-facing proof. Find precisely what works and what remains, using existing supported panel/agent paths without changing OpenChamber. This is an execution-time verification/investigation task, not another speculative architecture plan.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/continuation.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/stage2c-live-discovery.md]
</context_files>
<scope>
Trace actual panel startup, repository selection, initial fetch/cache invalidation, session subscriptions and stale/offline presentation. Run relevant existing tests and attempt read-only real-interface verification if tools/authorization permit; explicitly distinguish mocked tests, source inspection and live observations. Inspect applicable solo/team/worker instruction paths for how to discover and update an issue: repo-qualified identity, progress, questions, evidence and human review preservation. Do not modify shared skills or infer that an available skill is actually activated. Identify the smallest concrete fixes and exact files, with evidence, not daemon work. New issue #27 is recorded for a later standalone board; don't build/deploy it in this task. Do not ask user technical questions.
</scope>
<criteria>
Return a short tested/not-tested gap list tied to the two user outcomes and minimal implementation handoff. No claim done without empirical proof. Record actual provider/model if available. No application edits or remote mutations.
</criteria>
<output>
Write report .agents/run/task-centred-architecture/outputs/verify-user-workflow.md. Return concrete results, test counts, live-proof limits, and next smallest fix. Stop after report; manager dispatches independent hostile review and implementation separately.
</output>
