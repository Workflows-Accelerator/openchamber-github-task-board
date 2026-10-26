<env_preflight>
Runbook v2 was produced by ses_886c491bf3b8e69d1b102511 (9router/engineer) at .agents/run/task-centred-architecture/outputs/board-deployment-runbook-v2-private.md, untracked. This check is independent of that author; do not accept its self-declared closures.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment
Branch ops/board-deployment, HEAD40952c60d44c9afc5f98cc135acc5210407d92b9 tracked-clean. Untracked private preflight/hostile/corrected/recheck/runbook-v2 reports and their verifications/ dirs are immutable.
Own only .agents/run/task-centred-architecture/outputs/board-deployment-runbook-v2-check-private.md and verifications/board-deployment-runbook-v2-check-private/**; untracked. Scratch /tmp/opencode.
Read-only product and infrastructure. No secret values, no broad secret search, no .env reads. No production mutation: no deploy, restart, recreation, proxy, port, DNS, firewall, env or secret write; no product patch; no push; no closure.
Source of truth for commands: web/server/app.ts and config.ts, the shipped supervisor at /workspace/config/opencode/.worktrees/team-ops-board-entrypoint commit4a3ecee, and devops CLI help/source. Preflight authoritative at dispatch.
</env_preflight>
<goal>
Decide whether runbook v2 is safe and executable as written, and whether its remaining claims are grounded, without changing anything.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-plan-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-runbook-v2-private.md]
[@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-plan-recheck-private.md]
Supervisor source: /workspace/config/opencode/.worktrees/team-ops-board-entrypoint/{entrypoint.sh,tools/board/start.sh,tools/board/supervisor.sh,tests/board-supervisor.test.mjs}
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of the runbook. FIX NOTHING. Verify each suspicion below independently rather than assuming the manager is right; report the ones that are real and drop the ones that are not.
1. Artifact identity: Stage 1 builds with `npx esbuild web/server.ts` from `/workspace/extensions/github-task-board` after only checking `git merge-base --is-ancestor 54816f6 HEAD`. Determine what is actually built when HEAD has moved, and whether the runbook can silently deploy unreviewed product code. Judge whether a clean export of 54816f6 (or hash equality with the accepted bundle) is required.
2. Invented identity: Stage 2 hardcodes `BOARD_GITHUB_LOGIN=workflows-accel-bot`. The owner never confirmed that username. Confirm the source requires the variable and that it must be derived from `/user` with the dedicated token, then correct the expectation in your verdict.
3. Password handling: Stage 4 uses bash `read -s -r -p` and `printf '{"password":"%s"}'`. Test what happens when the password contains a double quote, backslash, newline or non-ASCII character, and what happens if the operator's shell is not bash. Judge whether the runbook's login probe can corrupt its own payload or fail under a realistic password.
4. HEAD probe: Stage 3 uses `curl -X HEAD`. Measure what this actually does (hang, body wait, exit code) versus `curl -I`, and compare with the board's real 405 + Allow:GET response. Report the correct command.
5. Health/version: Stage 3 asserts a specific `version` value. Check what /health actually returns in source and whether the runbook's pass condition would fail on a correct deployment.
6. Auth contract: Stage 4 asserts 401 for unauthenticated `/api/board`, `csrfToken` on GET /api/session, and 204 on logout. Verify each against source, including whether a bad login returns 401 and whether the rate limiter (5 failures/minute) can interfere with the sequence the runbook prescribes.
7. Port syntax: the checkpoint and Stage 6 assert `ports_mappings` value `10.0.0.7:8787:8787`. Verify with the devops CLI source/help and Coolify semantics whether a host-IP-qualified mapping is actually supported, or whether this is untested assumption. If unverified, the step must say so and give the supported alternative.
8. Container identity: Stage 6 resolves the container with `docker ps --filter name=xt12m5ucm14ze1a8a0hzwkjr`, equating the Coolify application UUID with a Docker container name. Determine whether that is grounded; propose the exact supported lookup (label, compose service, app metadata) and say what happens if the filter matches nothing or several containers.
9. Baseline honesty: the checkpoint hardcodes `"proxy_route_status_baseline": "absent"` and `tls_valid: true` rather than measuring them, and Stage 8 requires live.workflows.ac to return 502 forever. Judge whether rollback could delete a pre-existing route that was never proven absent, and whether freezing a 502 is the honest baseline the gate demanded.
10. Rollback completeness: verify that setting BOARD_ENABLED=false plus removing BOARD_* variables leaves the committed entrypoint hook as a safe no-op; that the route removal removes only what this deployment added and uses the supported CLI rather than `rm -f`; that the release directory and supervisor state are handled; and that the container-recreation step is genuinely last.
11. Supervisor coupling: the runbook depends on commit 4a3ecee while an independent review of that commit is still running. Identify every step that would change if the review forces different variable names, defaults, or lock/state paths, and say whether the runbook can be executed safely before that review lands.
12. Executability: pick three non-destructive stages and dry-run their commands where safe (no network mutation, no container action, no secrets). Report commands that would fail as written, including missing tools (python3, jq), bash-only syntax in sh, and paths that do not exist on the target host.
13. Readiness: judge whether the two stated owner blockers are complete and correctly described, whether deployment readiness must remain HALT, and whether anything in the runbook could cause an operator to expose the board publicly before authentication is proven.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, design ACCEPTED/REVISE, machine readiness PROCEED/HALT. Any invented identity, unverified port syntax presented as fact, public exposure before auth proof, secret-handling defect, or destructive step before checkpoint is blocking. No production change, no code correction, no self-approval.
</criteria>
<output>
At most 12 lines: verdicts, confirmed defects with section/line and minimal correction, suspicions that proved false, exact corrected commands where relevant, readiness status, owner blockers in plain words, report path, actual provider/model.
</output>
