<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: [FILL_HEAD_SHA] (clean; L4 verdict recorded at [FILL_L4_PATH])
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Live release dir: /workspace/releases/board/ (preserve every existing release intact: `7339629-20261111`, `0e6d237-20261111`, `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103`)
Current live: /workspace/releases/board/current -> 7339629-20261111
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and supervisor.sh (READ/EXECUTE ONLY; never edit /workspace/code/openchamber-config)
Do not touch: web/**, panel/**, service/**, /workspace/.openchamber-data/** (never read or print secrets), GitHub issues/labels, git push
Do NOT run `git remote -v` or print any credential.
</env_preflight>
<goal>
Publish the reviewed V4 board (Workflows Board, unified sheets, applied filters, readable dependencies) to production with a verified rollback, rebuilding the server bundle from source at [FILL_HEAD_SHA].
</goal>
<steps>
1. Rebuild the server bundle FROM SOURCE into the new release directory — never copy web/dist/server.mjs (stale, gitignored): `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/workspace/releases/board/[FILL_RELEASE]/web/dist/server.mjs`. Prove the built bundle contains zero `if-match` and does contain `write_rejected`.
2. Stage /workspace/releases/board/[FILL_RELEASE] with package.json, web/dist/server.mjs, every file of web/public/ and checksums.sha256. Verify with `sha256sum -c --strict checksums.sha256` and exact coverage both ways.
3. Record pre-cutover state: current symlink target, supervisor and child PIDs, health payload; verify every previous release still passes its checksums.
4. Atomically repoint /workspace/releases/board/current, gracefully kill -TERM the supervisor from /tmp/opencode/board-supervisor/supervisor.pid, wait for exit, then start /workspace/code/openchamber-config/tools/board/start.sh with a clean environment. Report only PIDs and health.
5. Verify http://127.0.0.1:8787/health and https://board.workflows.ac/health return 200 and that served index.html, app.js, theme.css, arrange.js, markdown.js, manifest.json and icons are byte-identical to the staged files over HTTPS (sw.js must match 127.0.0.1:8787/sw.js, not the disk digest, because CACHE_VERSION is stamped at runtime).
6. Prove the new client is live from the live origin, not from disk: fetch the served app.js over HTTPS and confirm the V4 strings are present (e.g. `frameDependencyFocus`, `computeFitView`, `applied-filter-btn`, "Workflows Board" in index.html). Confirm the served sw.js CACHE_VERSION is the V4 value so clients drop the old cache.
7. Signed-out read-only Chromium smoke at 390x844 and 1280x900: PNGs, zero console errors, zero CSP violations. Do NOT sign in against production and do NOT write to any real repository.
8. Write .agents/run/chamberos-board-v2/verifications/[FILL_RELEASE]/release-receipt.md with the hash table, PIDs, health codes, rollback target and the one-command rollback, plus which existing releases remain valid rollbacks. Commit on feat/board-v3 and set local master to the resulting HEAD. Do not push.
</steps>
<criteria>
1. https://board.workflows.ac/health returns 200 and every served asset matches the staged bytes.
2. The deployed app.js and index.html visibly carry the V4 changes, proven from the live origin; the served sw.js carries the new cache version.
3. All previous releases remain intact with passing checksums; the rollback command is documented and correct.
4. Zero secret printed, zero edits under /workspace/code/openchamber-config, zero GitHub writes, zero issue changes, nothing pushed.
5. Receipt committed; local master moved to the receipt commit.
</criteria>
<output>
STATUS: LIVE | ROLLED_BACK | BLOCKED; RELEASE_DIR and current target; HASH_TABLE staged vs live; LIVE_PROOF fetched from the live origin; HEALTH, PIDS, PREVIOUS_RELEASES; ROLLBACK exact command; SCREENSHOTS; NOT_VERIFIED.
</output>
