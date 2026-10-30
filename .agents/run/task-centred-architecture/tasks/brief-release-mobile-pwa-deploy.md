<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-ops-release-mobile-pwa
Branch: ops/release-mobile-pwa (based on master @ 8df6d7b)
Target release directory: /workspace/releases/board/8df6d7b-$(date +%Y%m%d)
Symlink target: /workspace/releases/board/current
Supervisor directory: /tmp/opencode/board-supervisor
Public URL: https://board.workflows.ac
Local URL: http://127.0.0.1:8787
Test command: node --test web/tests/*.test.mjs
Do not touch: /workspace/.openchamber-data/board/board.env, Traefik config, Docker containers, coolify configs
</env_preflight>

<goal>
Deploy the merged master (8df6d7b, containing Mobile PWA, quick-add drafts, batch align, and searchable project picker) to https://board.workflows.ac with zero downtime, verified health endpoints, manifest/service worker delivery, and honest empirical proof.
</goal>

<context_files>
/workspace/extensions/github-task-board/.agents/run/live-board-deployment-receipt.md
/workspace/config/opencode/tools/board/supervisor.sh
/workspace/config/opencode/tools/board/start.sh
/workspace/releases/board/07d8511-20261027/checksums.sha256
</context_files>

<steps>
1. Worktree preflight & build:
   - Ensure node_modules exists in the worktree (symlink from /workspace/extensions/github-task-board/node_modules if absent).
   - Build panel bundle: `npm run build:panel`
   - Build service bundle: `npm run build:service`
   - Bundle web server: `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs`
   - Verify web tests pass: `node --test web/tests/*.test.mjs`

2. Stage new release:
   - Create release folder: `/workspace/releases/board/8df6d7b-$(date +%Y%m%d)`
   - Copy runtime artifacts into release folder:
     - `package.json`
     - `web/dist/server.mjs`
     - `web/public/index.html`
     - `web/public/app.js`
     - `web/public/theme.css`
     - `web/public/manifest.json`
     - `web/public/sw.js`
     - `web/public/icon.svg`
   - Generate `checksums.sha256` inside the release root covering all staged files with relative paths, and verify with `sha256sum -c --strict checksums.sha256`.

3. Atomic switch & restart:
   - Atomically update symlink: `ln -sfn /workspace/releases/board/8df6d7b-$(date +%Y%m%d) /workspace/releases/board/current`
   - Send SIGTERM to the running child process (PID from `/tmp/opencode/board-supervisor/child.pid`).
   - Monitor `/tmp/opencode/board-supervisor/board.log` and wait for the supervisor to restart the child with the new release.

4. Empirical verification:
   - `curl -sS http://127.0.0.1:8787/health` (must return 200 with status ok)
   - `curl -sS https://board.workflows.ac/health` (must return 200)
   - `curl -sS https://board.workflows.ac/manifest.json` (must return 200 with PWA manifest JSON)
   - `curl -sS https://board.workflows.ac/sw.js` (must return 200 with service worker script)
   - `curl -sS https://board.workflows.ac/ | grep -i 'manifest.json'` (must link manifest)
   - Verify zero secret or token leaks in logs or output.

5. Produce completion receipt:
   - Write receipt with exact checksums, HTTP status codes, and verification outputs to `/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/release-mobile-pwa-receipt.md`.
</steps>

<output>
Return concise summary of deployment status:
- New release directory and commit SHA
- Checksum validation status (N/N files OK)
- Local and public health HTTP status
- PWA manifest and service worker public HTTP status
- Location of the output receipt on disk
</output>
