<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Live release dir: /workspace/releases/board/ — current -> b85676f-20261113. Preserve every release.
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and supervisor.sh — READ/EXECUTE ONLY. Never edit anything under /workspace/code/openchamber-config.
Do not touch: web/** source, panel/**, GitHub issues/labels, git push, /workspace/.openchamber-data/** (never read or print board.env, jwt-secret, cookies), `git remote -v`, credentials, deletion, delegation.
URGENT: this is the THIRD loss of the board service today. A browser audit received HTTP 502 from https://board.workflows.ac minutes ago. Restore first, then make the service survive the kill.
</env_preflight>

<goal>
Restore the board again, and this time remove the mechanism that keeps killing it: the supervisor is launched inside a session/process group that something kills with SIGKILL (both supervisor and child vanish with no trap line, no OOM, no container restart). Launch it so it is not in that group, prove it survives, and record what you did and what remains unproven.
</goal>

<steps>
1. Observe and keep output: `readlink -f /workspace/releases/board/current`; the pid file under /tmp/opencode/board-supervisor/ and whether each PID is alive; `ps -ef | grep -i board | grep -v grep`; `ss -ltnp | grep 8787`; health on http://127.0.0.1:8787/health and https://board.workflows.ac/health with `-m 10`; the tail of supervisor.log; the death timestamp from the log. State whether the public 502 comes from the app being absent or from the ingress (compare loopback with public).
2. Restore exactly as before, which is proven to work: `cd /tmp && env -u BOARD_ENABLED -u BOARD_RELEASE_DIR -u BOARD_STATE_DIR -u BOARD_GITHUB_LOGIN -u BOARD_REPO -u BOARD_PASSWORD -u BOARD_PASSWORD_HASH -u BOARD_SESSION_SECRET -u BOARD_GITHUB_TOKEN /bin/sh /workspace/code/openchamber-config/tools/board/start.sh`
3. Harden WITHOUT editing /workspace/code/openchamber-config: stop the supervisor it just started, then relaunch the same start.sh under a detached session so it is outside this session's process group — `setsid` with stdin from /dev/null, output to the supervisor log, using the same `env -u BOARD_…` prefix. Confirm with `ps -o pid,ppid,pgid,sid,cmd` that the supervisor's SID differs from the shell that launched it and that its PGID equals its own PID. If setsid is unavailable, use `nohup` plus a double fork and say so. If a systemd user unit or a cron daemon is actually available and usable, prefer it — check before deciding, do not assume.
4. Prove recovery from the public origin: https://board.workflows.ac/health 200, https://board.workflows.ac/app.js 200 and byte-identical to /workspace/releases/board/b85676f-20261113/web/public/app.js (`cmp`), index.html identical too.
5. Prove the hardening is real, not cosmetic: record the supervisor PID, its SID and PGID, and show that they differ from the launching shell's session. Say plainly what this does and does not protect against: it protects against a kill aimed at the launching session's process group; it does not protect against a host-wide kill, a container restart, or a kill by PID.
6. If you can, add ONE cheap extra guard that lives outside the board repository and does not need the configuration repo: a detached watchdog loop (its own session) that every 60 seconds checks whether the supervisor PID is alive and, if not, reruns the proven start command. Keep it in a script under /workspace/releases/board/ or /tmp/opencode/board-supervisor/ (not in the git repo), log every action, and never restart more than once per minute. Say where it lives and how to stop it. If you judge this too risky, say so and stop instead of improvising.
7. Append to /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/b85676f-20261113/incident-3.md: timeline, observed state, what you changed, the SID/PGID proof, the public proof, the watchdog (if installed) with its stop command, and what remains unprotected. Commit on feat/board-v3 as `fix(board): relaunch the supervisor outside the killable session`.
</steps>

<output>
At most 12 lines: STATUS, PUBLIC_PROOF (health code, app.js cmp result), DEAD_WHAT (pids, listening, loopback vs public), SID_PGID (before and after), HARDENING (setsid / systemd / cron / watchdog — exactly what), WATCHDOG (path, interval, stop command, or none), STILL_PROTECTED_AGAINST (one line), STILL_UNPROTECTED (one line), COMMIT, NOT_VERIFIED.
</output>
