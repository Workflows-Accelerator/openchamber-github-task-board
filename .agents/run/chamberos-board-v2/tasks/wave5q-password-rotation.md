<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: 6403a24. Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Live release: /workspace/releases/board/b85676f-20261113. Supervisor runs detached (setsid, PPID 1) with a watchdog at /tmp/opencode/board-supervisor/watchdog.sh.
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh — READ/EXECUTE ONLY, never edit anything under /workspace/code/openchamber-config.
SECRET RULES, ABSOLUTE: the new password must never appear in your report, in any echo, in any log line, in any commit, or in any tool output you show. Do not print board.env. Do not print the old password or the old hash. Generate the password inside the script and pass it by variable only.
Forbidden: source edits, push, deploy, GitHub writes, deletion of releases, `git remote -v`, delegation.
</env_preflight>

<goal>
Rotate the board password. The owner asked for a new one. It must end up in `/workspace/.openchamber-data/board/board.env` as `BOARD_PASSWORD` (with any `BOARD_PASSWORD_HASH` line removed, because the hash takes precedence in web/server/config.ts), the service must be restarted, health must be proven, and the owner must be able to read the new password from a file only they can read — never from this transcript.
</goal>

<steps>
1. Generate a strong password without printing it: 24 characters from a safe alphabet, using node or openssl into a shell variable, never echoed. Write it once to `/workspace/.openchamber-data/board/password-latest.txt` with `umask 077` and confirm only the file mode and the character count.
2. Back up the env file with `cp -p` to `board.env.bak-<timestamp>` (mode preserved). Do not read or print either file.
3. Rewrite `board.env` in place, preserving every other line and the inode: remove lines matching `^[[:space:]]*(export[[:space:]]+)?BOARD_PASSWORD(_HASH)?=`, then append exactly one `BOARD_PASSWORD=<value>` line. Keep the file mode unchanged. Confirm only that the file now contains exactly one `BOARD_PASSWORD=` line and zero `BOARD_PASSWORD_HASH=` lines, by counting matches — never by printing them.
4. Restart with the proven detached command, exactly this shape (do not edit start.sh):
   `cd /tmp && env -u BOARD_ENABLED -u BOARD_RELEASE_DIR -u BOARD_STATE_DIR -u BOARD_GITHUB_LOGIN -u BOARD_REPO -u BOARD_PASSWORD -u BOARD_PASSWORD_HASH -u BOARD_SESSION_SECRET -u BOARD_GITHUB_TOKEN setsid /bin/sh /workspace/code/openchamber-config/tools/board/start.sh </dev/null >> /tmp/opencode/board-supervisor/supervisor.log 2>&1`
   Before starting, SIGTERM the current supervisor PID from `/tmp/opencode/board-supervisor/supervisor.pid` and wait for it to be gone (max 20 s). The watchdog may fire during the gap; that is expected, start.sh's single-owner lock prevents two supervisors, but check afterwards that exactly one supervisor and one child are alive.
5. Verify, all without printing the secret:
   - `http://127.0.0.1:8787/health` returns 200 and `https://board.workflows.ac/health` returns 200;
   - the served `app.js` over HTTPS is byte-identical to the release file (`cmp`);
   - a POST to `http://127.0.0.1:8787/api/session` with `{"password": <from the file>}` returns 200 (read the value from the file inside the script; print only the status code);
   - a POST with a deliberately wrong password returns 401 (proves the check is live, not bypassed).
6. If health or login fails: restore the backup with `cat`, restart the same way, verify health 200, and report ROLLED_BACK. Never leave the board down.
7. On success, keep the backup for now and report its path so the owner can ask for it to be deleted after they confirm they can log in. Do not commit anything containing a secret; append a short note to `.agents/run/chamberos-board-v2/verifications/b85676f-20261113/password-rotation.md` with timestamps, file modes, counts, status codes and nothing secret. Commit it as `fix(board): rotate the board password`.
</steps>

<output>
At most 10 lines: STATUS (ROTATED or ROLLED_BACK), PASSWORD_FILE (path and mode only), ENV_STATE (password lines 1, hash lines 0), HEALTH (loopback, public), ASSET_CMP, LOGIN (correct=code, wrong=code), PROCESSES (supervisor and child PIDs, exactly one each), BACKUP (path), COMMIT, NOT_VERIFIED. Never include the password itself.
</output>
