<env_preflight>
Repo: /workspace/extensions/chambervoice
Worktree: /workspace/extensions/chambervoice/.worktrees/team-dev-board-web-reference
Branch: docs/board-web-reference; base 7c6f8163bd4d549f57be0a3543c23332c7847178; new clean tracked worktree. Source checkout contains unrelated untracked work; leave it alone.
Files: live/**, service/live* and authentication/deployment docs, package.json; report only owned.
Verification: read-only source and unauthenticated public HTTPS status checks; no deployments, account login, credentials or mutations.
Do not touch: implementation files, secrets/env/credential files, opencode.db, host settings, production proxy/DNS, GitHub issues, master. Use disposable /tmp/opencode for probes. No recursive reads of private runtime files.
Preflight facts are authoritative; don't run initial pwd/status/ls. Targeted checks allowed after action failure or before report commit.
</env_preflight>
<goal>Identify the smallest proven way to serve the task board at board.workflows.ac by reusing the standalone voice page pattern without exposing private data or inventing host changes.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/stage2c-live-discovery.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/service-transport-discovery.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/verify/investigation/investigate-first/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
Read-only product investigation in voice repository; report only in .agents/run/board-web-reference/report.md. Establish how live.workflows.ac serves HTML, authenticates user, proxies protected host data, handles external origin/TLS/upgrade, and reaches installed service. Inspect actual source and deployment docs rather than assuming direct reuse. State what is observable vs source-inferred vs unknown. Public HEAD/GET page probes only if no private data; don't capture secret query strings or cookies. Find what board can reuse without editing voice or host. Identify exact minimum board service routes/browser adapter/build paths, safe auth/session/CSRF model and supported host-to-frame alternative. Include auth isolation, revocation, origin, nonpublic session paths, websocket/polling and browser-unload assumptions. Do not propose pulling PAT into browser or copying passwords. Explain whether board can use same installed host account safely; private data must never become public merely because domain is public.
No implementation or new UI scope decisions. User goal is web version running. Propose smallest parity slice; editing/start-agent scope still open, do not decide unilaterally. Return exact external steps DNS/proxy/access needed and what can be implemented/tested before them. No production activation.
</scope>
<criteria>
An evidence-grounded implementation handoff for #27: reusable code/contracts, minimal architecture alternatives with recommendation, exact data/auth limitations, tests and deployment proof still needed. Don't broaden to unrelated daemon or engine work. Do not claim site deployed or runtime contracts verified from source alone.
</criteria>
<output>
Write and commit only .agents/run/board-web-reference/report.md. Return concise findings with report absolute path, commit, blockers and supplied model/provider. No full transcript dump.
</output>
