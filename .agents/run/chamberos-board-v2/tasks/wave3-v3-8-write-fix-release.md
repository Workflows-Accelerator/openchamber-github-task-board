<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 8f7ebaa (clean; L4 verdict Spec PASS / Quality APPROVED, application code at `7339629` + `f4beb1c`)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Live release dir: /workspace/releases/board/ (preserve every existing release intact: `0e6d237-20261111`, `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103`)
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and supervisor.sh (READ/EXECUTE ONLY; never edit `/workspace/code/openchamber-config`)
Do not touch: web/**, panel/**, service/**, /workspace/.openchamber-data/** (never read or print secrets), GitHub issues/labels, git push
Do NOT run `git remote -v` or print any credential.
Preflight facts are true and authoritative at dispatch.
</env_preflight>

<goal>
Ship the L4-approved write fix to production. The live board currently runs `0e6d237-20261111`, where 8 of 11 product writes fail against real GitHub (status, draft, order, section, human-task toggle, canvas drag, sticky note, reopen). Replace it with a bundle built from `8f7ebaa`, verify every served asset, and leave a working rollback.
</goal>

<steps>
1. Rebuild the server bundle FROM SOURCE into the new release directory — never copy `web/dist/server.mjs`, which is a stale gitignored artifact that still contains `if-match`:
   `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/workspace/releases/board/7339629-20261111/web/dist/server.mjs`
   Then prove the built bundle contains zero `if-match` occurrences and does contain the `write_rejected` path.
2. Stage `/workspace/releases/board/7339629-20261111` with `package.json`, `web/dist/server.mjs`, every file of `web/public/`, and `checksums.sha256`. Verify with `sha256sum -c --strict checksums.sha256` and confirm exact file coverage (no staged file missing from the manifest, no manifest entry missing on disk).
3. Record the pre-cutover state: current symlink target, supervisor and child PIDs, health payload. Verify the previous release checksums still pass.
4. Atomically repoint `/workspace/releases/board/current`, gracefully `kill -TERM` the supervisor from `/tmp/opencode/board-supervisor/supervisor.pid`, wait for exit, then start `/workspace/code/openchamber-config/tools/board/start.sh` with a clean environment. Never read, echo or log any secret; report only PIDs and health.
5. Verify `http://127.0.0.1:8787/health` and `https://board.workflows.ac/health` return 200, and that the served `index.html`, `app.js`, `theme.css`, `arrange.js`, `markdown.js`, `manifest.json` and icons are byte-identical to the staged files over HTTPS (`sw.js` must match `127.0.0.1:8787/sw.js`, not the disk digest, because `CACHE_VERSION` is stamped at runtime).
6. Prove the fix is live in the delivered bundle, not just in git: fetch the served `app.js` over HTTPS and confirm the new canvas/`write_rejected` client strings are present, and confirm the running server's bundle has no `if-match`.
7. Do one read-only smoke against the live board through Chromium: load `https://board.workflows.ac` signed out at `390x844` and `1280x900`, capture PNGs, confirm zero console errors and that the sign-in card still behaves. Do NOT sign in against production and do NOT attempt any write on a real repository.
8. Write `.agents/run/chamberos-board-v2/verifications/V3-8/release-receipt.md` with the hash table, PIDs, health codes, rollback target and the one-command rollback. Commit on `feat/board-v3` and set local `master` to the resulting HEAD. Do not push.
</steps>

<criteria>
1. `https://board.workflows.ac/health` returns 200 and every served asset matches the staged bytes.
2. The deployed server bundle contains zero `if-match` and the deployed `app.js` contains the new precise error strings; both proven from the live origin, not from disk.
3. All previous releases remain intact and their checksums still pass; the rollback command is documented and correct.
4. Zero secret printed, zero edits under `/workspace/code/openchamber-config`, zero GitHub writes, zero issue changes.
5. Receipt committed; local `master` moved to the receipt commit; nothing pushed.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: LIVE | ROLLED_BACK | BLOCKED
- RELEASE_DIR and `current` target
- HASH_TABLE: staged vs live HTTPS per asset
- LIVE_BUNDLE_PROOF: `if-match` count and client string presence, fetched from the live origin
- HEALTH, PIDS, PREVIOUS_RELEASES
- ROLLBACK: exact command
- SCREENSHOTS
- NOT_VERIFIED
</output>
