<env_preflight>
BLOCKED DRAFT — supervisor build ses_c43bb6ac007df0382aa0f811 finished at commit 4a3ecee in /workspace/config/opencode/.worktrees/team-ops-board-entrypoint; its independent hostile review is still running, so treat the shipped interface as provisional and record any assumption that depends on the review outcome.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment
Branch ops/board-deployment, HEAD40952c60d44c9afc5f98cc135acc5210407d92b9 tracked-clean; untracked private reports under .agents/run/task-centred-architecture/outputs/board-deployment-*-private.md and verifications/board-deployment-*-private/** are immutable and must stay untracked.
Accepted web artifact54816f6 is an ancestor; it is single-repository staging, NOT the all-repository goal. #37 and #35 remain unaccepted and must never be described as deployable.
Own only .agents/run/task-centred-architecture/outputs/board-deployment-runbook-v2-private.md and verifications/board-deployment-runbook-v2-private/** (untracked). Scratch /tmp/opencode. No secret values, no broad secret search, no env dump.
No production mutation of any kind: no deploy, restart, container recreation, proxy, port, DNS, firewall, env or secret write; no product patch; no push; no issue closure.
Current source routes are authoritative: GET /health 200, HEAD /health 405 with Allow: GET, POST/GET/DELETE /api/session, GET /api/board. Do not invent endpoints or use curl -I expecting 200.
</env_preflight>
<goal>
One surgical, executable deployment runbook that closes every open recheck defect and can be followed by an operator who is not this session.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-plan-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-plan-recheck-private.md]
[@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-plan-corrected-private.md]
Supervisor implementation (provisional): /workspace/config/opencode/.worktrees/team-ops-board-entrypoint at commit4a3ecee — entrypoint.sh (+9 guard lines), tools/board/start.sh, tools/board/supervisor.sh, tests/board-supervisor.test.mjs. Read those files directly and use their actual variables, defaults and commands: BOARD_ENABLED, BOARD_RELEASE_DIR default /workspace/releases/board/current, BOARD_STATE_DIR default /tmp/opencode/board-supervisor, BOARD_CHECKSUM_MANIFEST or checksums.sha256/SHA256SUMS/manifest.sha256, BOARD_START_CMD default `node web/dist/server.mjs`, BOARD_BACKOFF_INITIAL/MAX/MULTIPLIER/JITTER, BOARD_MAX_RESTARTS (0 = unlimited), BOARD_LOG_MAX_BYTES, BOARD_HEALTH_URL/INTERVAL. Its own independent hostile review is running (ses_e5b58fbb6787fb31c25d8b79); do not assume the current file names or defaults survive it. Mark every supervisor-dependent step that the review could change and keep the runbook easy to adjust.
Other open manager doubts the runbook must not paper over: start.sh may block on its PID poll when fractional sleep is unavailable; supervisor.log is appended without rotation; a new release placed at the current pointer does not restart an already-running child; lock/PID/logs live in /tmp. Give the exact operator step for each (restart the supervisor, rotate/disable logs, etc.) rather than claiming the behaviour is automatic.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Rewrite, do not append. The output is a single operator-facing runbook with numbered stages, each with an observable pass condition, a stop condition, and the exact command. Close every open defect from the recheck:
1. No secret on argv, in shell history, in a process list or in a log. Password submission to the board must not put the value on a command line: use an interactive prompt, a here-document fed on stdin, an environment variable read inside the shell without echoing, or a file with restrictive permissions that is removed afterwards. Show the method and why it is safe. State explicitly that no secret is ever written into a report, ticket, chat or commit.
2. No hardcoded per-commit release directory. Use the supervisor's real configured release path and the stable current-release pointer (or whatever the shipped supervisor actually implements — read the code, do not assume). A new board release must not require editing the entrypoint.
3. Early supervisor errors must be visible: the first log line exists before any board start attempt, and a missing artifact, bad checksum or missing required variable produces a recorded reason. Reconciling "supervisor exits nonzero on bad input" with "entrypoint must never block OpenChamber" must be stated as tested behaviour, not glossed.
4. Checksums must cover what actually runs: the server bundle, public assets, package metadata and the external dependency tree the process needs at runtime (or a lockfile plus installed-tree hash). Say exactly what is and is not covered, and what happens on mismatch.
5. An ordered stage pipeline must exist with explicit gates between stages: build+verify → stage env names only → start supervisor and prove health → prove auth/refusal → private port publication → route/TLS verification → adjacent-service comparison. No stage may begin before the previous stage's pass condition is observed. The stage that kills this session is last and is explicitly an operator action.
6. Supervisor concurrency must be provable: one owner, atomic lock, stale-lock recovery that never signals a foreign PID, and no reliance on a PID file that can race during backoff. Name the exact test from the supervisor's own suite that proves each claim; do not restate a claim the suite does not cover.
7. TLS and HTTP verification must use strict certificate checking; no -k. If strict verification cannot succeed, that is a stop condition, not a workaround.
8. Operator checkpoint before the destructive stage: exactly what to save, where, with what permissions, what it must contain (artifact commit, checksums, release path, env variable names, port mapping, route ownership, supervisor state, adjacent baselines), and the exact resume instruction for a fresh session after the container is recreated. Assert nothing about downtime duration.
9. Rollback: restore captured originals, disable the supervisor first, remove only board material this deployment introduced, revert port mapping and route ownership, verify adjacent services against the captured baselines. State what cannot be restored automatically.
10. Readiness truth: keep a single line that says deployment readiness is HALT while dedicated credentials and a working authorized controller transport are absent, regardless of runbook quality. Name the owner-only actions in plain words without asking for values in chat.
Use the supervisor's actual file names, variables, defaults and enable/disable commands. Where the implementation differs from any earlier plan text, follow the implementation and record the difference. Mark any step you could not ground in source or CLI help as NOT VERIFIED rather than plausible.
</scope>
<criteria>
Every one of the ten defects has a corresponding section that a reader can execute. No invented flags or endpoints. No secret handling that exposes a value. Commands grounded in the current source tree, CLI help/source, or the shipped supervisor. Stop conditions are explicit. Readiness line stays HALT. No production change, no push, no self-approval.
</criteria>
<output>
At most 12 lines: runbook path, defect-by-defect closure with any residual, readiness status, the exact owner-only blockers in plain words, what remains NOT VERIFIED, and actual provider/model. Do not publish private topology or credential names beyond variable names.
</output>
