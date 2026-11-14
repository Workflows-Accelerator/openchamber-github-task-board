<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7-overhaul
Branch: feat/wave7-overhaul
HEAD: add4855 (release candidate prepared, merged `422b3a0`)
Mode: STRICTLY READ-ONLY on `/workspace/code/openchamber-config/**`, `/workspace/releases/**`, `/workspace/.openchamber-data/**`, and any running process. You may read files and run read-only inspection commands. You may write ONLY under `.agents/run/chamberos-board-v2/verifications/wave7-deploy-mechanics/`.
Forbidden:
- NEVER edit, move, delete or restart anything in `/workspace/code/openchamber-config/**`, `/workspace/releases/**`, or `/workspace/.openchamber-data/**`.
- NEVER read, print, echo or copy `board.env`, `jwt-secret`, tokens, passwords or cookies. Do not `cat` any env file. Presence checks (`test -f`, `ls -l`) are allowed; contents are not.
- NEVER run `git remote -v`, NEVER push, NEVER deploy, NEVER kill or start the board service, NEVER spawn subagents.
</env_preflight>

<goal>
Prove or disprove that the deploy and rollback commands in `.agents/run/chamberos-board-v2/verifications/wave7-release-candidate/README.md` would actually work against the LIVE environment, without executing any of them. The receipt's commands were copied from an older release and have never been checked against the current container, which was recreated recently and lost a supervisor watchdog.
</goal>

<checklist>
1. Read `.agents/run/chamberos-board-v2/verifications/wave7-release-candidate/README.md` and take its exact `DEPLOY_COMMANDS` and `ROLLBACK_COMMANDS` as the claim under test.
2. For EVERY path, binary and pid file those commands touch, report present/absent with evidence (`ls -ld`, `test -f`, `readlink`, `command -v`):
   - `/workspace/releases/board/`, `/workspace/releases/board/current` (where does it point now?), the previous release `b85676f-20261113` and its `checksums.sha256`.
   - `/workspace/code/openchamber-config/tools/board/start.sh` — read it (it is not a secret) and state exactly what it does: which env file it sources, which port, which artifact path, whether it daemonises, whether it writes a pid file, and whether it fails loudly when the artifact is missing.
   - The supervisor pid file `/tmp/opencode/board-supervisor/supervisor.pid` — does it exist, is the pid alive, and what process is it? Is the board currently running under that supervisor, or under something else (systemd unit, bare process, container entrypoint)?
3. Determine how the board is ACTUALLY running right now: find the listening process for the board port (read-only: `ss -ltnp`, `ps -eo pid,ppid,cmd`), and identify its parent. Report the real supervision model. If the receipt's `kill -TERM $(cat supervisor.pid)` + `start.sh` sequence would NOT restart the board in this container, say so plainly — that is a deploy-time outage risk and the single most important finding.
4. Check the deploy commands for concrete failure modes: `git archive` of a commit that exists; `npx esbuild` availability from the release directory (does it resolve?); `sha256sum` file glob `web/public/*` including subdirectories or not; `ln -sfn` + `mv -Tf` atomicity; whether `/workspace/releases/board` is writable by the current user; whether the health port `8787` matches the real board port.
5. Verify the artifact actually produced by the release candidate matches what the deploy would produce: compare the sha256 of `web/dist/server.mjs` in this worktree (`89d4b289…d604b7`) with what a fresh esbuild of `422b3a0` yields. Note any difference in the build invocation (flags, target, external packages).
6. Write `.agents/run/chamberos-board-v2/verifications/wave7-deploy-mechanics/README.md`: a command-by-command verdict table (`works` / `fails` / `unknown`), the real supervision model, the corrected deploy and rollback command sequences if the receipt's are wrong, and the exact residual risks a deploy would carry.
7. Commit ONLY that directory with explicit paths.
</checklist>

<output>
At most 12 lines: VERDICT (RECEIPT_CORRECT / RECEIPT_NEEDS_FIX / UNKNOWN), SUPERVISION_MODEL (what actually runs the board), FAILING_COMMANDS (list), CORRECTED_SEQUENCE (yes/no + where), OUTAGE_RISK (one line), RESIDUAL_RISKS, COMMIT, NOT_VERIFIED.
</output>
