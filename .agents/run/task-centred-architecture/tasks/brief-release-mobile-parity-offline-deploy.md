<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-ops-release-mobile-parity-offline
Branch: ops/release-mobile-parity-offline (based on master @ cc08379)
Target release directory: /workspace/releases/board/cc08379-$(date +%Y%m%d)
Symlink target: /workspace/releases/board/current
Supervisor directory: /tmp/opencode/board-supervisor
Public URL: https://board.workflows.ac
Local URL: http://127.0.0.1:8787
Test command: node --test web/tests/*.test.mjs
Do not touch: /workspace/.openchamber-data/board/board.env, Traefik config, Docker containers, coolify configs
</env_preflight>

<goal>
Deploy the merged master (cc08379, containing Mobile task drawer parity, offline drafting, polished PWA icons, and panel-scoped align drafts) to https://board.workflows.ac with zero downtime, verified health endpoints, manifest/service worker/binary icon delivery, and honest empirical proof.
</goal>

<context_files>
/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/release-mobile-pwa-receipt.md
/workspace/config/opencode/tools/board/supervisor.sh
/workspace/config/opencode/tools/board/start.sh
/workspace/releases/board/8df6d7b-20261028/checksums.sha256
</context_files>

<steps>
1. Worktree preflight & build:
   - Ensure node_modules exists in the worktree (symlink from /workspace/extensions/github-task-board/node_modules if absent):
     `ln -s /workspace/extensions/github-task-board/node_modules node_modules`
   - Build panel bundle: `npm run build:panel`
   - Build service bundle: `npm run build:service`
   - Bundle web server: `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs`
   - Verify web tests pass: `node --test web/tests/*.test.mjs`

2. Stage new release:
   - Create release folder: `RELEASE_DIR=/workspace/releases/board/cc08379-$(date +%Y%m%d); mkdir -p "$RELEASE_DIR/web/dist" "$RELEASE_DIR/web/public"`
   - Copy runtime artifacts into release folder:
     - `package.json` -> `$RELEASE_DIR/package.json`
     - `web/dist/server.mjs` -> `$RELEASE_DIR/web/dist/server.mjs`
     - `web/public/index.html` -> `$RELEASE_DIR/web/public/index.html`
     - `web/public/app.js` -> `$RELEASE_DIR/web/public/app.js`
     - `web/public/theme.css` -> `$RELEASE_DIR/web/public/theme.css`
     - `web/public/manifest.json` -> `$RELEASE_DIR/web/public/manifest.json`
     - `web/public/sw.js` -> `$RELEASE_DIR/web/public/sw.js`
     - `web/public/icon.svg` -> `$RELEASE_DIR/web/public/icon.svg`
     - `web/public/icon-192.png` -> `$RELEASE_DIR/web/public/icon-192.png`
     - `web/public/icon-512.png` -> `$RELEASE_DIR/web/public/icon-512.png`
     - `web/public/apple-touch-icon.png` -> `$RELEASE_DIR/web/public/apple-touch-icon.png`
   - Generate `checksums.sha256` inside `$RELEASE_DIR` covering all 11 files with relative paths (e.g. `package.json`, `web/dist/server.mjs`, `web/public/...`), and verify with `sha256sum -c --strict checksums.sha256`.

3. Atomic switch & restart:
   - Atomically update symlink: `ln -sfn "$RELEASE_DIR" /workspace/releases/board/current`
   - Send SIGTERM to the running child process (PID from `/tmp/opencode/board-supervisor/child.pid`).
   - Monitor `/tmp/opencode/board-supervisor/board.log` and wait for the supervisor to restart the child with the new release.
   - Confirm active child PID has cwd pointing to `$RELEASE_DIR` via `readlink /proc/<pid>/cwd`.

4. Empirical verification:
   - `curl -sS http://127.0.0.1:8787/health` (must return 200 with status ok)
   - `curl -sS https://board.workflows.ac/health` (must return 200)
   - `curl -sS https://board.workflows.ac/manifest.json` (must return 200)
   - `curl -sS https://board.workflows.ac/sw.js` (must return 200)
   - `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/icon-192.png` (must return 200)
   - `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/icon-512.png` (must return 200)
   - `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/apple-touch-icon.png` (must return 200)
   - `curl -sS https://board.workflows.ac/ | grep -i 'btnAlignDrafts'` (must NOT find btnAlignDrafts in web board)
   - Verify zero secret or token leaks in logs or output.

5. Produce completion receipt:
   - Write receipt with exact checksums, HTTP status codes, and verification outputs to `/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/release-mobile-parity-offline-receipt.md`.
</steps>

<output>
Return concise summary of deployment status:
- New release directory and commit SHA
- Checksum validation status (11/11 files OK)
- Local and public health HTTP status
- PWA icons, manifest, and service worker public HTTP status
- Confirmation that btnAlignDrafts is absent from web HTML
- Location of the output receipt on disk
</output>
