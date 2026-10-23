<env_preflight>
Repo/worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-coordinator-host-contract
Branch: fix/coordinator-host-contract; reviewed implementation 5c22202, review report 81b8e27. Verify targeted git state if needed.
Files: SDK guest service contracts, installed host auth/network bridges, service implementation, run report.
Tests: read-only contract probes only; no installed activation or application edits.
Do not touch: credentials or credential files, opencode.db, host settings/grants, service installation, remote issues, branches or master. Never print secrets. Use /tmp/opencode for disposable probes.
</env_preflight>
<goal>
Resolve the next integration dependency while startup repair awaits release: identify a supported capability-scoped authenticated outbound transport for host background services to observe linked sessions and read one explicitly selected GitHub repository. Prior discovery established inbound service token is NOT outbound host authorization and host GitHub proxy is DISCONNECTED. Do not invent a credential workaround.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/stage2c-live-discovery.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-coordinator-host-contract/.agents/run/task-centred-architecture/outputs/host-contract-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-coordinator-host-contract/.agents/run/task-centred-architecture/outputs/host-contract-fix.md]
</context_files>
<scope>
Read actual SDK/installed host contracts for outbound service capabilities, extension settings and supported integration connection flow. Determine whether a background service can use supported SDK/IPC or token exchange WITHOUT copying UI credentials, reading credential files, abusing service bearer, bypassing auth, or relying on research-process injected tokens. If impossible on installed host version, report exact upstream gap and smallest supported alternative; no speculative bridge implementation. Identify plain-language account action needed for disconnected GitHub, if any, with verified UI path only. Do not change connection or permissions. Check whether actual Node20 binary is available for a disposable shipped-bundle smoke (not syntax inference); if unavailable record unverified, do not install. No live remote mutation or worker spawning. Report optional developer-facing upstream change separately from approved current repair.
</scope>
<criteria>
Evidence-linked transport answer with explicit supported/unsupported/unknown, one minimal next step, exact genuinely user-required action if needed. No application changes, no claim full coordinator works. No waiting on technical questions to user.
</criteria>
<output>
Write and commit report only: .agents/run/task-centred-architecture/outputs/service-transport-discovery.md. Return findings, proof, blockers and provider/model identity if known.
</output>
