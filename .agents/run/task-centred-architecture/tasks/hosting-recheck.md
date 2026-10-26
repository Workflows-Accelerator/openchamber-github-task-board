<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting
Branch feat/board-hosting; HEADcd0734b (correction report) on product c828bf3 + tests848c9f8, tracked clean. Base for red-before: b8e517c (original slice) and 2dfbb22 (pre-slice). No active builder. Another panel worker runs in .worktrees/team-dev-issue-35-write-refresh; do not read or touch it.
Node modules link at worktree root expected. No installs, env copy or DB registration.
Commands: node --test web/tests/hosting.test.mjs; node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; npm run typecheck; bundle npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs (web/dist gitignored).
Own only new outputs/hosting-recheck.md and verifications/hosting-recheck/**. Product, tests, README, prior reports read-only. Scratch /tmp/opencode.
No fixes, no panel/service/shared config, no credentials, no real GitHub beyond synthetic fixtures, no installed host/proxy/TLS/container/deployment, no other worktrees, no push/merge/close/master/deploy.
Preflight authoritative; skip initial status/pwd/ls. Targeted checks before committing the report are expected.
</env_preflight>
<goal>
Independently confirm or reject that the five hosting-review findings are closed and nothing else changed, without fixing anything.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-hosting-slice.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/hosting-correction.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting/.agents/run/task-centred-architecture/outputs/hosting-hostile.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting/.agents/run/task-centred-architecture/outputs/hosting-correction.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile recheck of the correction, not the builder's summary. Read the full product and test diff b8e517c..cd0734b.

1. Confirm BOARD_GITHUB_API_BASE and every equivalent operator-supplied upstream override are gone from code, config, logs, docs and tests. Verify positively that the token-bearing request targets the fixed documented default even when a hostile value is present in the environment, and that no other path (options, query, header, redirect, proxy reuse) lets a caller or operator redirect the token. Search the tree for residual references.
2. Confirm /health version is read from the package metadata and that failure yields an honest non-version value; confirm the test compares dynamically and would fail on the old hardcoded fallback. Confirm /health still leaks no token, password material, session secret, repository name, issue data or environment dump, creates no session or CSRF state, and does not weaken any other route. Verify its position relative to authentication and origin checks.
3. Confirm the start-command test is genuinely order-independent: with web/dist absent, that test alone must pass; verify the file-level setup builds what the documented command runs, and that it does not silently test the source entry instead of the built artifact.
4. Confirm method behaviour for /health is documented and tested truthfully, including the 405 Allow header, and that documentation does not claim HEAD support if unsupported.
5. Confirm the documented build prerequisite for npm run start:web is exact and sufficient from a clean state, and that no doc still lists the removed variable.
6. Diff discipline: confirm the correction changes only what the five findings require; flag any unrelated behaviour, formatting churn or test weakening. Re-run the four gates and record actual counts and exits. Attempt the isolated start test yourself in a way that does not damage the tree (rebuild afterwards if you remove the ignored bundle).
</scope>
<criteria>
Report Security APPROVED or NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, machine PROCEED/HALT. Per finding: closed/open with evidence and path:line, plus whether the regression genuinely fails at b8e517c. Record command, exit and counts for hosting, web, root, both typechecks, bundle hash. State precisely what is not proven: no live proxy, TLS, container recreation, restart supervision, production GitHub. No fixes; stop after the verdict.
</criteria>
<output>
Commit only your report and proof. At most 12 lines: verdicts, per-finding status, reproduced gates, red-before evidence, residual risk, blind spots, actual provider/model. Any required failure means HALT with no deploy recommendation.
</output>
