<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Live release dir: /workspace/releases/board/ — current -> b85676f-20261113 (published today). Preserve every release.
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and supervisor.sh — READ/EXECUTE ONLY, never edit anything under /workspace/code/openchamber-config.
Do not touch: web/** source, panel/**, GitHub issues or labels, git push, /workspace/.openchamber-data/** (never read or print board.env, jwt-secret, cookies).
Do NOT run `git remote -v`, do not print credentials, do not delete anything, do not delegate.
URGENT: the user reports the site is unreachable right now. Diagnose first, restore second, explain third.
</env_preflight>

<goal>
Find out why https://board.workflows.ac is not reachable, restore service, and record the evidence that explains it. The user is blocked and annoyed; the answer must be "the site is back, here is why it died", or "the site is back and here is what I could not prove".
</goal>

<steps>
1. Observe before changing anything, and keep the output:
   - `readlink -f /workspace/releases/board/current`
   - `cat /tmp/opencode/board-supervisor/supervisor.pid` and whether that PID is alive (`ps -o pid,ppid,etime,stat,cmd -p <pid>`)
   - `ps -ef | grep -i board | grep -v grep`
   - whether anything listens on 8787 (`ss -ltnp | grep 8787`)
   - `curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/health` and the same for https://board.workflows.ac/health with `-m 10`
   - the supervisor log and any child log: find them under /tmp/opencode/board-supervisor/ and /workspace/releases/board/*/logs (list first, then read the tail of the current one), plus `dmesg | tail -n 40` if readable, and `journalctl -n 50 --no-pager` if it exists, looking for an OOM kill or a signal.
2. Restore: if the supervisor or child is dead, clear the stale pid file exactly as start.sh expects and run `/workspace/code/openchamber-config/tools/board/start.sh` with a clean environment. Wait for health to answer, then confirm the served asset hashes match the staged release (at least index.html and app.js over HTTPS).
3. Prove the site is back from the public origin, not just loopback: https://board.workflows.ac/health returns 200 and https://board.workflows.ac/app.js is served and byte-identical to /workspace/releases/board/b85676f-20261113/web/public/app.js.
4. Determine, with evidence rather than a guess, whether this is the same failure as the earlier one today (the first post-cutover supervisor pair 607172/607214 vanished with no shutdown line): same signature or different? Quote the log lines that support your answer. If the supervisor has no automatic restart and the host kills it, say so plainly and name the exact mechanism you can prove.
5. Write a short incident note at /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/b85676f-20261113/incident-2.md with: the timeline with timestamps, the observed state, what you did, the health proof, the root-cause evidence and what remains unknown. Commit it on feat/board-v3 as `fix(board): restore service after the second supervisor loss`.
6. Do NOT attempt a structural fix (systemd, cron watchdog, restart loop) in this task. Describe in one line what it would take, and stop.
</steps>

<output>
At most 12 lines: STATUS (BACK_UP or STILL_DOWN), WHAT_WAS_DEAD (pid, state, listening), PUBLIC_PROOF (health code, asset hash match), SAME_FAILURE_AS_1 (yes/no + one quoted line), CAUSE (proven / unproven), RESTORED_WITH (commands), COMMIT, WHAT_WOULD_PREVENT_RECURRENCE (one line), NOT_VERIFIED.
</output>
