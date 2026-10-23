<env_preflight>
Repo/worktree: /workspace/extensions/github-task-board (existing checkout; read-only investigation)
Branch: feat/v2-binding-and-ratelimit
Last known base: 16886c1; verify current HEAD and dirty state before investigation because context may be stale.
Files: service/**, package.json, panel host/GitHub adapters, relevant host extension service contracts.
Test command: targeted non-mutating runtime probes only; no live issue mutations.
Do not touch: application files, branches, opencode.db, credentials, existing user files. Do not merge, push, close issues, or start an enabled mutation daemon.
</env_preflight>
<goal>
Find the shortest empirically grounded path from the existing coordinator library to a genuinely working issue-centred background coordinator. User wants us to move forward without technical review chores. Investigate current integration gaps and verify actual host lifecycle/session/GitHub contracts rather than assuming a sister manifest proves this extension works. This task is investigation only; do not implement speculative integrations.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210f-final-fix.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-211-integration-merge.md]
</context_files>
<scope>
Inspect actual service loop and host service launcher contracts, discover supported authenticated session observation and GitHub access paths without exposing credentials. Distinguish manifest declarations, source support, synthetic probes, and observed running behavior. Identify repository selection/opt-in boundaries and how the live adapter would preserve human questions/review, avoid duplicate claims, and fail closed. Explicitly assess why local SHA preflight does NOT guarantee atomic GitHub writes across a read/write race and what safe bounded pilot can honestly promise. Cross-process locking and failed-persistence claims cannot be declared safe merely because one daemon is expected. No opencode.db access.
</scope>
<criteria>
Produce evidence-backed smallest integration plan, exact files/tests, real safety blockers and any genuinely user-facing choice. Do not ask user technical implementation questions. No claims of live behavior without observation. No product edits.
</criteria>
<output>
Write .agents/run/task-centred-architecture/outputs/stage2c-live-discovery.md with findings, evidence sources, proposed minimal scope, verification steps, remaining uncertainties, and provider/model identity if available. Return short result with blockers. Stop after report.
</output>
