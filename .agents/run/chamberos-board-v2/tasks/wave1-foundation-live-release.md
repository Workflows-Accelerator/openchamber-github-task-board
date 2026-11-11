<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: 4e92c01 (clean; application source at 59e5d05; ancestor 98261a8 is current local master and origin/master)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Live release dir: /workspace/releases/board/ (current -> /workspace/releases/board/98261a8-20261103; keep 98261a8-20261103 intact for rollback)
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and /workspace/code/openchamber-config/tools/board/supervisor.sh (READ/EXECUTE ONLY; NEVER edit anything in /workspace/code/openchamber-config)
Supervisor runtime state: /tmp/opencode/board-supervisor/ (supervisor.pid, child.pid, supervisor.log, board.log)
Test commands: npm test && node --test --test-timeout=30000 web/tests/*.test.mjs && npm run typecheck && npm run web:build
Do not touch: web/**, panel/**, service/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/** (NEVER read, print, or log secret files such as board.env or jwt-secret), GitHub issue states/closures (NEVER close any issue)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Publish the L4-approved 4e92c01 (application code 59e5d05) foundation release to origin/master and live production https://board.workflows.ac while preserving 98261a8-20261103 for instant rollback and keeping all GitHub issues open.</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile4/report.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/task-centred-architecture/outputs/online-board-polish-release-receipt.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/ship/release/shipping-and-launch/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/proof/verify-and-stop/SKILL.md]
</skills>
<owned_paths>
/workspace/releases/board/59e5d05-20261111/**
/workspace/releases/board/current
/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/wave1-release-receipt.md
</owned_paths>
<depends_on>
hostile4-approved-4e92c01
</depends_on>
<steps>
<step>1. Verify git ancestry and secret safety in `.worktrees/team-dev-chamberos-board-v2`: confirm `git merge-base --is-ancestor 98261a842dc3c4566ffe72aa50a31d9763012f51 4e92c01`, confirm `git diff --stat 98261a8..4e92c01 -- panel service` is empty, and scan `git log -p 98261a8..4e92c01 -- web scripts` for any accidentally committed tokens, passwords (other than synthetic test fixture `correct horse battery staple`), or private keys.</step>
<step>2. Fast-forward `master` to `4e92c01` without checking out `master` in root: verify `master` is not checked out in any worktree (`git worktree list`), update local ref `git branch -f master 4e92c01`, and push `git push origin master:master`. Do NOT force-push and do NOT delete any branches.</step>
<step>3. Build and stage the release bundle `/workspace/releases/board/59e5d05-20261111`: run `npm run web:build` inside `.worktrees/team-dev-chamberos-board-v2`, copy `package.json`, `web/dist/server.mjs`, and all 11 files in `web/public/` (`index.html`, `theme.css`, `app.js`, `arrange.js`, `markdown.js`, `sw.js`, `manifest.json`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) into `/workspace/releases/board/59e5d05-20261111/` preserving subdirectories (`web/dist/server.mjs`, `web/public/*`), generate `checksums.sha256` with relative paths (no `./` prefix) covering all 13 files, and verify `cd /workspace/releases/board/59e5d05-20261111 && sha256sum -c --strict checksums.sha256` exits 0 with zero uncovered files.</step>
<step>4. Cut over `/workspace/releases/board/current` and restart the board supervisor cleanly: keep `/workspace/releases/board/98261a8-20261103` completely untouched as rollback target; atomically update symlink via `ln -sfn /workspace/releases/board/59e5d05-20261111 /workspace/releases/board/current-next && mv -Tf /workspace/releases/board/current-next /workspace/releases/board/current`; read `/tmp/opencode/board-supervisor/supervisor.pid` (and `child.pid`), send `kill -TERM <supervisor_pid>`, wait up to 10s for both old supervisor and child processes to exit, then launch `/workspace/code/openchamber-config/tools/board/start.sh` (without setting custom test env vars so production defaults load cleanly from `/workspace/.openchamber-data/board/board.env` internally inside `start.sh` — NEVER inspect or print `board.env` or `jwt-secret`).</step>
<step>5. Empirically verify both local `:8787` and live public `https://board.workflows.ac`: check new supervisor PID is alive, verify `curl -fsS http://127.0.0.1:8787/health` and `curl -fsS https://board.workflows.ac/health` return HTTP 200 JSON, verify CSP header on `https://board.workflows.ac/`, and verify SHA-256 of fetched live assets (`https://board.workflows.ac/app.js`, `https://board.workflows.ac/theme.css`, `https://board.workflows.ac/arrange.js`, `https://board.workflows.ac/markdown.js`, `https://board.workflows.ac/sw.js`) match `/workspace/releases/board/59e5d05-20261111/checksums.sha256` byte-for-byte. If cutover fails health checks within 20s, immediately roll back `/workspace/releases/board/current` to `/workspace/releases/board/98261a8-20261103` and restart `start.sh`.</step>
<step>6. Record the full empirical receipt in `.agents/run/chamberos-board-v2/verifications/A-delivery/wave1-release-receipt.md` inside `.worktrees/team-dev-chamberos-board-v2` and commit that single receipt file locally on `feat/chamberos-board-v2` (do NOT push `master` again for the receipt commit; keep `master` at `4e92c01`). Confirm zero untracked/modified files remain.</step>
</steps>
<criteria>
1. `origin/master` and local `master` point to `4e92c01` via fast-forward push; `panel/**` and `service/**` have zero diff vs `98261a8`.
2. `/workspace/releases/board/59e5d05-20261111` passes `sha256sum -c --strict checksums.sha256` (13/13 files) and `/workspace/releases/board/98261a8-20261103` remains intact.
3. `/workspace/releases/board/current` targets `/workspace/releases/board/59e5d05-20261111`, supervisor is running cleanly, and both `http://127.0.0.1:8787/health` and `https://board.workflows.ac/health` return 200 OK.
4. Live HTTPS SHA-256 hashes of `app.js`, `theme.css`, `arrange.js`, `markdown.js`, and `sw.js` from `https://board.workflows.ac/` match the staged manifest exactly.
5. Zero secrets printed or logged; zero edits to `/workspace/code/openchamber-config`; zero GitHub issues closed.
</criteria>
<verification>
cd /workspace/releases/board/59e5d05-20261111 && sha256sum -c --strict checksums.sha256 && curl -fsS http://127.0.0.1:8787/health && curl -fsS https://board.workflows.ac/health
</verification>
<output>
Respond in concise structured Markdown with:
- STATUS: PASS | ROLLED_BACK | BLOCKED
- MASTER_SHA: exact SHA on local and origin/master
- RELEASE_DIR: exact path and symlink target
- SUPERVISOR_PID: old -> new PIDs
- LIVE_VERIFICATION: table of HTTP statuses and live vs staged SHA-256 checksums for app.js, theme.css, arrange.js, markdown.js, sw.js
- RECEIPT_COMMIT: local commit SHA on feat/chamberos-board-v2
- NOT_VERIFIED: explicit blind spots (e.g. live authenticated browser interaction without touching production credentials)
</output>
