<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-coordinator-host-contract
Branch: fix/coordinator-host-contract; base 16886c1. Newly provisioned clean tracked state. Root contains unrelated untracked run files; do not touch them.
Files: service/main.ts, service/config.ts, service/types.ts, service/main.js, targeted tests, optional concise README service-contract note.
Tests: targeted contract tests then npm run typecheck, npm run build, npm test.
Do not touch: opencode.db, credential files, host settings/grants, GitHub issues, master, other projects, existing user data. No live remote mutations or worker spawning from the product.
</env_preflight>
<goal>
Repair the already-approved background service so the actual host can start and health-check it. Discovery proved our shipped entry lacks the required listener and configured storage is ignored. Implement the smallest inert-by-default host-compatible service boundary, not a new autonomous product mode or a pretend observer. No outbound authenticated transport has been established; keep automatic claiming, worker creation, GitHub writes and observation inactive. This is correctness repair of Stage 2B, not approval to expand behavior.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/stage2c-live-discovery.md]
[@/workspace/extensions/github-task-board/node_modules/@openchamber/sdk/GUEST_SERVICES.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Verify installed host service contract sources first. Implement loopback-only allocated-port listener, token-authenticated health/status (all routes require auth), no secret responses/logs, clean shutdown and ready/error semantics matching installed contract. Correct LeaseStore construction to honor explicit config.storageDir. Default service behavior must be inert: do not prune/rewrite existing lease state merely to answer health. Health must distinguish alive from configured/observing; report unavailable integration truthfully. Preserve library APIs where feasible and document intentional expectation changes. No panel activation UI, no host autostart change, no credential handoff, no new dependencies unless essential. Use shared root node_modules via symlink if needed; don't copy env/credentials. Do not access DB registration scripts because task explicitly excludes opencode.db; record that registration was omitted. Do not create worktree directories (already exists).
</scope>
<criteria>
Red-first tests through real HTTP with launcher-shaped minimal env: authenticated health succeeds; missing/wrong bearer fails; nonloopback bind impossible; secrets absent; port/listener stops; configured storage honored; health does not imply observation; startup/health cannot create claims or remote effects; no existing lease overwrite in inert mode. Shipped bundle subprocess health/shutdown smoke using disposable /tmp/opencode storage, never installed service storage. Full suite/typecheck/build green; do not weaken tests to claim previous broken behavior was safe. No live GitHub or installed service activation.
</criteria>
<output>
Commit implementation and report in this worktree. Report .agents/run/task-centred-architecture/outputs/host-contract-fix.md: changes, exact test results, source vs subprocess proof, residuals and provider/model identity. Do not self-grade as final hostile review; manager will dispatch independent review. Do not merge/push master or close issue.
</output>
