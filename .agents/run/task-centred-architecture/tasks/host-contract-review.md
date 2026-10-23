<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-coordinator-host-contract
Branch: fix/coordinator-host-contract; implementation commit 5c22202; worker reports clean state.
Files: service/**, tests changed in 5c22202, README changes if any.
Test command: npm run typecheck; npm run build; npm test; targeted host contract tests discovered from diff.
Do not touch: application implementation (review-only), opencode.db, credentials, host settings/grants, installed service activation, GitHub mutations, master. Disposable probes only in /tmp/opencode.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Independently review startup repair 5c22202 against actual installed host launcher contract. We previously mistook a manifest and passing primitive tests for a working service; do not repeat that error. No merge authorization from this review.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-coordinator-host-contract/.agents/run/task-centred-architecture/outputs/host-contract-fix.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/stage2c-live-discovery.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/host-contract-fix.md]
[@/workspace/extensions/github-task-board/node_modules/@openchamber/sdk/GUEST_SERVICES.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Inspect diff and actual host contract. Empirically probe shipped bundle with minimal launcher env, allocated port, bearer health/status, missing/wrong auth, invalid config, shutdown, port reuse, secret-free responses/logging, read-only/inert startup and storage override. Inspect stop/start and error cleanup for leaked listeners/timers and unhandled rejection. Check existing library compatibility and that tests exercise subprocess rather than mocks alone. No live installed startup or network effects. No weakening safety requirements. Explicitly distinguish Node syntax checks from testing an actual Node20 runtime. If unrelated known lease defects remain unreachable in inert mode, record rather than call fixed.
</scope>
<criteria>
Return two verdicts: scope compliance and behavioral quality; concrete severity/file/evidence for findings; reproduce Moderate+ defects if possible. Run targeted tests and full suite/build/typecheck; inspect deterministic bundle diff. Do not fix code, merge, close issues or certify automatic orchestration.
</criteria>
<output>
Write .agents/run/task-centred-architecture/outputs/host-contract-review.md in worktree; commit report only. Return verdict, empirical counts, findings, unverified boundaries and actual provider/model if known. Stop for manager judgement.
</output>
