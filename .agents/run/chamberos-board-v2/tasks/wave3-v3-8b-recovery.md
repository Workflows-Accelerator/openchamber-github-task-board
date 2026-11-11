<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 8f7ebaa (clean; L4 approved; an interrupted deployment worker may have left release files or a changed symlink behind)
Release dir: /workspace/releases/board/ — releases that MUST survive: `0e6d237-20261111` (previous live), `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103`
Supervisor: /workspace/code/openchamber-config/tools/board/{start.sh,supervisor.sh} — READ/EXECUTE ONLY, never edit `/workspace/code/openchamber-config`
Do not touch: web/**, panel/**, service/**, /workspace/.openchamber-data/** (never read or print secrets), GitHub issues/labels, git push, git reset, git rebase
Do NOT run `git remote -v` or print any credential.
</env_preflight>

<goal>
A previous worker was interrupted in the middle of deploying `8f7ebaa` to `/workspace/releases/board/`. The production board may be down, half-switched, or running a partially staged release. First restore a known-good service — the board must answer health checks — and only then decide whether to finish the deployment or stay on the verified previous release. Never leave production broken to finish a deploy.
</goal>

<recovery_order>
1. Establish the facts first, in this order, and write them down before changing anything:
   - `readlink -f /workspace/releases/board/current` and the full directory listing of `/workspace/releases/board/` with timestamps.
   - Whether a `7339629-20261111` directory exists, what it contains (file count, presence of `package.json`, `web/dist/server.mjs`, all `web/public/` files, `checksums.sha256`), and whether `sha256sum -c --strict checksums.sha256` passes there.
   - `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/health` and `https://board.workflows.ac/health`.
   - Supervisor state: `/tmp/opencode/board-supervisor/supervisor.pid` contents, whether that PID is alive, any child process, and the last ~80 lines of the supervisor/child logs (redact anything that looks like a secret: tokens, cookies, passwords, JWT).
2. Restore service before anything else:
   - If health is 200 and `current` resolves to a release whose checksums pass, the board is up; do not restart it just to be tidy. Continue to step 3.
   - If health fails, first try starting the existing `current` target through `start.sh` with a clean environment. If that release is itself incomplete or corrupt, repoint `current` to `0e6d237-20261111` (verify its checksums first) and start it. Report which path you took.
   - Never leave the process stopped. If you must kill, kill gracefully and restart within the same step, then prove health.
3. Then decide the deployment, with the safety ordering below. Finish the deploy only if every prerequisite holds:
   - The candidate bundle for `7339629-20261111` must be rebuilt from source into that directory (`npx esbuild web/server.ts ... --outfile=/workspace/releases/board/7339629-20261111/web/dist/server.mjs`), because `web/dist/server.mjs` in the worktree is a stale gitignored artifact containing `if-match`.
   - Prove the built bundle contains zero `if-match` and does contain `write_rejected`.
   - Confirm the staged directory passes `sha256sum -c --strict checksums.sha256` with exact file coverage (no staged file missing from the manifest, no manifest entry missing on disk).
   - Only then repoint `current`, gracefully terminate the old supervisor, and start the new one. If any prerequisite fails, stay on the previous live release and report BLOCKED with the exact failing check.
4. Verify the outcome from the live origin, not from disk: `https://board.workflows.ac/health` returns 200; served `index.html`, `app.js`, `theme.css`, `arrange.js`, `markdown.js`, `manifest.json` and icons are byte-identical to the staged files (`sw.js` must match `127.0.0.1:8787/sw.js`, because `CACHE_VERSION` is stamped at runtime); the served `app.js` contains `canvas_save_rate_limited`; the running server bundle contains no `if-match`.
5. Capture one signed-out live PNG at `390x844` proving the board renders (not an error page) under `.agents/run/chamberos-board-v2/verifications/V3-8/recovery/`.
6. Write `.agents/run/chamberos-board-v2/verifications/V3-8/release-receipt.md` (or append a clearly dated recovery section if one already exists) with: the recovery path taken, the fact table, the hash table, PIDs, health codes, the rollback command, and exactly what the interrupted worker left behind. Commit on `feat/board-v3` and set local `master` to the resulting HEAD. Do not push.
</recovery_order>

<criteria>
1. `https://board.workflows.ac/health` returns 200 at the end of the run, from a release whose checksums pass.
2. Every pre-existing release directory is still present and its checksums still pass.
3. If deployed, `7339629-20261111` is complete, checksum-verified, built from source, and serving: live `app.js` contains `canvas_save_rate_limited`, running bundle has zero `if-match`. If not deployed, the receipt says exactly which prerequisite failed.
4. No secret printed, no edits under `/workspace/code/openchamber-config`, no GitHub writes, no issue changes, nothing pushed.
5. The receipt states precisely what the interrupted worker had already done, so the manager can tell the user whether production was ever down and for how long.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: LIVE_NEW | LIVE_PREVIOUS | ROLLED_BACK | BLOCKED
- WHAT_THE_INTERRUPTED_WORKER_LEFT: symlink state, partial directories, whether the process had been stopped, and the evidence for each
- OUTAGE: yes/no, and the measured duration if the process was ever down
- CURRENT_RELEASE + hash table
- LIVE_PROOF: health code, served app.js marker, bundle `if-match` count
- ROLLBACK: exact command
- RECEIPT: path
- NOT_VERIFIED
</output>
