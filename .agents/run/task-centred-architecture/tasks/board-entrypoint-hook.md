<env_preflight>
Worktree exists and is tracked-clean. Deployment plan recheck is still running; this implementation follows the corrected plan's supervisor requirements, but dispatch now is a deliberate parallel start in a different repository with no file overlap. If the recheck changes release-path semantics, adapt in the same branch rather than merging a contradictory hook.
Repo /workspace/config/opencode (Workflows-Accelerator/opencode-config); live checkout on master is NOT an implementation target.
Worktree /workspace/config/opencode/.worktrees/team-ops-board-entrypoint
Branch ops/board-entrypoint-hook; base master37f5b67a088107fa4cc5887b444a0f7cf64238de, tracked-clean. No node_modules symlink exists and none is needed; use POSIX shell plus the repository's existing node test runner only.
Key paths to ground in this worktree: entrypoint.sh (existing keepalive-proxy background start then exec tini), tools/keepalive-proxy/start.sh as precedent, tests/entrypoint-persistence.test.mjs and neighbouring tests for conventions. Do not assume a package manager.
No secrets, no credential files, no .env reads. Scratch /tmp/opencode. No board-repo source changes, no live /workspace/config/opencode edits, no container/proxy/DNS/deploy mutation, no push, no master merge, no issue closure.
Preflight authoritative at dispatch; no initial status/pwd/ls discovery. Targeted checks before commits and after failures.
</env_preflight>
<goal>
A reviewed, safely gated startup hook that keeps the standalone board running across crashes and container restarts without blocking OpenChamber startup.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/hosting-owner-prerequisites.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-plan-review-gate.md]
Board runtime contract: start from a pinned release directory containing web/dist/server.mjs, web/public/** and package metadata; command is npm run start:web (node web/dist/server.mjs). The process reads assets relative to import.meta.url, so the working directory/layout is part of the contract. Required env names are documented in the board web README (BOARD_GITHUB_TOKEN, BOARD_GITHUB_LOGIN, BOARD_REPO, BOARD_SESSION_SECRET, one password form, optional HOST/PORT/BASE_URL). Never print values.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
tools/board/**
entrypoint.sh
tests/board-supervisor/** (or the repository's existing test location if one exists; state which)
</owned_paths>
<scope>
Preserve all existing entrypoint behaviour and ordering, especially the background keepalive-proxy start and final exec tini. Addition must be non-blocking and failure-tolerant: a missing artifact, missing config, disabled gate or repeated crash must never prevent OpenChamber from starting.
1. tools/board/start.sh (or equivalently minimal files): POSIX sh preferred; no new runtime dependency unless present already. Reads BOARD_ENABLED (default false/absent = do nothing), BOARD_RELEASE_DIR (documented default such as a stable current-release pointer; do not hardcode a per-commit directory), optional BOARD_START_CMD, BOARD_HEALTH_URL, BOARD_STATE_DIR, BACKOFF bounds. If a checksum manifest exists, verify it before starting. Refuses to operate when release dir/assets/required env names are absent; logs a single clear reason with no secret values and exits 0 so the container never fails to boot. Does not create, download or build the artifact.
2. Supervisor: one owner only (lock/PID file with atomic create; a live owner prevents duplicate start; a stale PID is never signalled unless it is provably our child/recorded start). Starts the process detached from the entrypoint's stdio with capped log rotation or size limit, records the child, monitors exit, restarts with bounded exponential backoff and a cap/jitter, resets backoff after sustained health, and exits cleanly on supervisor shutdown signal by forwarding to the child and reaping it. No busy loop; sleep-based supervision acceptable. Health check optional and must not spawn unbounded curl/node processes.
3. Safety: never kill a PID merely because it matches by name; verify recorded ownership. No secrets in argv, filenames, logs or state; required env names only. Do not run a server as a different user or alter permissions on unrelated files. Do not modify, restart or supervise any other service. Do not touch live WAL/state or delete logs beyond the supervisor's own rotated files.
4. entrypoint.sh: one guarded, non-blocking invocation near the existing daemon start block, skipped in environments where the tool is absent. Preserve exit semantics if the hook fails. No `set -e` trap regressions.
5. Tests: fixtures with a fake child command; prove enabled start, default-disabled no-op, missing artifact/config exit0 with reason and no child, crash restart within bounds, backoff growth/cap, duplicate invocation does not create two supervisors, stale PID file not signalled, graceful shutdown forwards and reaps, log cap, no secret value appears in logs/state/argv, and entrypoint remains non-blocking on a deliberately broken hook. Use temporary dirs; no real board server, container, network or production state.
6. Report the exact install/enable instructions and the disable/uninstall steps an operator would run. These are documentation only; you do not edit live files.
</scope>
<criteria>
Fixture tests pass with no flaky sleeps beyond bounded real timers; scripts shellcheck-clean if available (otherwise record NOT RUN); no secret values or private topology in code/report; existing tests still pass or record their command/result; diff limited to owned paths; entrypoint ordering preserved; report gives the exact reviewable PR-ready summary and enable/disable/rollback steps. Independent hostile review follows. Do not merge to master or push master.
</criteria>
<verification>
Exact commands recorded in the report: the fixture suite, any repository test suite that exists, shell syntax check (`sh -n`), and a manual fixture run showing enable, crash restart, duplicate start refusal and disable. Record real exit codes.
</verification>
<output>
At most 12 lines: files and commits, test commands/totals/exits, what the supervisor guarantees and explicitly does not, enable/disable/rollback steps, untested production behaviour, blind spots, actual provider/model. No production or master claims.
</output>
