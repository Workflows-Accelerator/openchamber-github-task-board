<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: e604b9e (tracked tree clean except untracked verifications/V4-1-L4/, which must stay untouched; application reviewed at 1d9f237 by the independent delta review in verifications/V4-2-L4-delta/, full increment reviewed in verifications/V4-2-L4/)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches there)
Live release dir: /workspace/releases/board/ — preserve every existing release intact: `26fbc00-20261112`, `7339629-20261111`, `0e6d237-20261111`, `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103`
Current live: /workspace/releases/board/current -> 26fbc00-20261112
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and supervisor.sh (READ/EXECUTE ONLY; never edit /workspace/code/openchamber-config)
Do not touch: web/** source edits, panel/**, service/**, /workspace/.openchamber-data/** (never read or print secrets), GitHub issues/labels, real repository writes, git push
Do NOT run `git remote -v` or print any credential.
</env_preflight>
<goal>
Publish the reviewed V4-2 board (agent notes as real GitHub comments, Markdown Decisions with preset options and expandable details) to production with a verified rollback, rebuilding the server bundle from source at e604b9e.
</goal>
<steps>
1. Rebuild the server bundle FROM SOURCE into the new release directory /workspace/releases/board/e604b9e-20261112 — never copy web/dist/server.mjs: `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/workspace/releases/board/e604b9e-20261112/web/dist/server.mjs`. Prove the built bundle contains the note route and marker (`board-note`) and still contains `write_rejected` and zero `if-match`.
2. Stage /workspace/releases/board/e604b9e-20261112 with package.json, web/dist/server.mjs, every file of web/public/ and checksums.sha256. Verify `sha256sum -c --strict checksums.sha256` and exact coverage both ways.
3. Record pre-cutover state: current symlink target, supervisor and child PIDs, health payload; verify every previous release still passes its checksums.
4. Atomically repoint /workspace/releases/board/current, kill -TERM the supervisor from /tmp/opencode/board-supervisor/supervisor.pid, wait for exit, then start /workspace/code/openchamber-config/tools/board/start.sh with a clean environment. Report only PIDs and health.
5. Verify http://127.0.0.1:8787/health and https://board.workflows.ac/health return 200 and that served index.html, app.js, theme.css, arrange.js, markdown.js, manifest.json and icons are byte-identical to the staged files over HTTPS (sw.js must match 127.0.0.1:8787/sw.js, not the disk digest, because CACHE_VERSION is stamped at runtime). Prove the served sw.js CACHE_VERSION differs from `1.2.1-2e7655bc77`.
6. Prove the new client is live from the live origin, not from disk: fetch the served app.js over HTTPS and confirm `agent-note-composer`, `question-option-card` and `board-note:` are present, plus `canvasZoomLimitText` and `frameDependencyFocus` from V4 (non-regression) and "Workflows Board" in index.html.
7. Signed-out read-only Chromium smoke at 390x844 and 1280x900: PNGs of list, canvas, drawer and Decisions, zero console errors, zero CSP violations. Do NOT sign in against production and do NOT write to any real repository or post any comment.
8. Write .agents/run/chamberos-board-v2/verifications/e604b9e-20261112/release-receipt.md with the hash table, PIDs, health codes, rollback target and the one-command rollback, plus which existing releases remain valid rollbacks and the old vs new CACHE_VERSION. Commit on feat/board-v3 and set local master to the resulting HEAD. Do not push.
</steps>
<criteria>
1. https://board.workflows.ac/health returns 200 and every served asset matches the staged bytes.
2. The deployed app.js visibly carries the V4-2 surfaces, proven from the live origin; the served sw.js carries a new cache version.
3. All previous releases remain intact with passing checksums; the rollback command is documented and correct.
4. Zero secret printed, zero edits under /workspace/code/openchamber-config, zero GitHub writes, zero issue changes, nothing pushed.
5. Receipt committed; local master moved to the receipt commit.
</criteria>
<output>
STATUS: LIVE | ROLLED_BACK | BLOCKED; RELEASE_DIR and current target; HASH_TABLE staged vs live; LIVE_PROOF fetched from the live origin; HEALTH, PIDS, PREVIOUS_RELEASES; ROLLBACK exact command; SCREENSHOTS; NOT_VERIFIED.
</output>
