# Release Receipt: Mobile Parity & Offline Drafts Deployment

**Executed:** Thu Oct 29 2026  
**Source Commit:** `cc08379 fix(web): initialize patch object to resolve TS2454 under strict typecheck` (`cc08379`)  
**Source Branch / Worktree:** `ops/release-mobile-parity-offline` in `/workspace/extensions/github-task-board/.worktrees/team-ops-release-mobile-parity-offline`  
**Release Directory:** `/workspace/releases/board/cc08379-20261029`  
**Current Symlink:** `/workspace/releases/board/current -> /workspace/releases/board/cc08379-20261029`  
**Public Endpoint:** `https://board.workflows.ac`  
**Local Endpoint:** `http://127.0.0.1:8787`  
**Status:** Deployed, Live, Empirical Verification 100% Passed  

---

## 1. Worktree Preflight & Build Verifications

| Step | Command | Exit Code | Result |
| --- | --- | --- | --- |
| Symlink dependencies | `ln -s /workspace/extensions/github-task-board/node_modules node_modules` | 0 | Linked |
| Build panel bundle | `npm run build:panel` | 0 | `panel/main.js` (673.9kb) built |
| Build service bundle | `npm run build:service` | 0 | `service/main.js` (31.3kb) built |
| Bundle web server | `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | 0 | `web/dist/server.mjs` (128.7kb) built |
| Web unit tests | `node --test web/tests/*.test.mjs` | 0 | **390/390 passed**, 0 failed, 0 cancelled |

---

## 2. Release Staging & Manifest Checksums

Staged artifacts in `/workspace/releases/board/cc08379-20261029/`:
- `package.json`
- `web/dist/server.mjs`
- `web/public/app.js`
- `web/public/apple-touch-icon.png`
- `web/public/icon-192.png`
- `web/public/icon-512.png`
- `web/public/icon.svg`
- `web/public/index.html`
- `web/public/manifest.json`
- `web/public/sw.js`
- `web/public/theme.css`

Manifest verification (`sha256sum -c --strict checksums.sha256`): **11/11 OK**

```text
e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee  package.json
b3e0ddf5f3dd67c575fb7147725e3a0bf2d6353fd668ebcce53c992a160dea9d  web/dist/server.mjs
4ede124488975038147fb476d889f5388b11f44b408a7c991424c3e2eb53babf  web/public/app.js
0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c  web/public/apple-touch-icon.png
00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f  web/public/icon-192.png
9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266  web/public/icon-512.png
b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082  web/public/icon.svg
2cd947e79911b029cb4e87d8107a09bd6f63dd84df3aa0c8df7794187e49cfe2  web/public/index.html
493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be  web/public/manifest.json
493173c5853607908f498473eb2bce0dd81030595eaeac512a270dbe5d55f0cc  web/public/sw.js
f08d266979a2e08526f1f0f7501512c58aa1e04a27943d9bb91c62d86f72fee7  web/public/theme.css
```

---

## 3. Atomic Switch & Process Supervision

- **Symlink switch:** `ln -sfn /workspace/releases/board/cc08379-20261029 /workspace/releases/board/current`
- **Supervisor restart:** Supervisor cleanly terminated with `kill -TERM` and relaunched via `/workspace/config/opencode/tools/board/start.sh` so child working directory binds directly to the new release inode per operator contract in `docs/BOARD_SUPERVISOR.md`.
- **Active Supervisor PID:** `220911`
- **Active Child PID:** `220982`
- **Verified Child CWD:** `/proc/220982/cwd -> /workspace/releases/board/cc08379-20261029`
- **Supervisor Health Transition:** Sustained health reset triggered (`uptime >= 30s`), backoff set to initial, consecutive crash counter 0.

---

## 4. Empirical Endpoint Verifications

| Check | Probe Command | Observed Response | Result |
| --- | --- | --- | --- |
| Local Health | `curl -i -sS http://127.0.0.1:8787/health` | HTTP 200, `{"status":"ok","version":"1.2.1","uptime":31}` | **PASS** |
| Public Health | `curl -i -sS https://board.workflows.ac/health` | HTTP 200, `{"status":"ok","version":"1.2.1","uptime":51}` | **PASS** |
| PWA Manifest | `curl -i -sS https://board.workflows.ac/manifest.json` | HTTP 200, `Content-Type: application/manifest+json; charset=utf-8` | **PASS** |
| Service Worker | `curl -i -sS https://board.workflows.ac/sw.js` | HTTP 200, `Content-Type: application/javascript; charset=utf-8`, `service-worker-allowed: /` | **PASS** |
| PWA Icon 192 PNG | `curl -sS -D - -o /dev/null https://board.workflows.ac/icon-192.png` | HTTP 200, `Content-Type: image/png`, 1321 bytes | **PASS** |
| PWA Icon 512 PNG | `curl -sS -D - -o /dev/null https://board.workflows.ac/icon-512.png` | HTTP 200, `Content-Type: image/png`, 5421 bytes | **PASS** |
| Apple Touch Icon | `curl -sS -D - -o /dev/null https://board.workflows.ac/apple-touch-icon.png` | HTTP 200, `Content-Type: image/png`, 1192 bytes | **PASS** |
| PWA Icon SVG | `curl -sS -D - -o /dev/null https://board.workflows.ac/icon.svg` | HTTP 200, `Content-Type: image/svg+xml`, 3602 bytes | **PASS** |
| Web Root HTML | `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/` | HTTP 200 | **PASS** |
| Static App JS | `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/app.js` | HTTP 200 | **PASS** |
| Static Stylesheet | `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/theme.css` | HTTP 200 | **PASS** |
| Absent Web Align Drafts | `curl -sS https://board.workflows.ac/ \| grep -i 'btnAlignDrafts'` | Exit code 1 (not found in web board HTML) | **PASS** |

---

## 5. Security & Secret Exposure Audit

- Logs scanned (`/tmp/opencode/board-supervisor/supervisor.log`, `/tmp/opencode/board-supervisor/board.log`).
- No GitHub tokens, bearer headers, session secrets, or password hashes present in log streams.
- Strict release checksum manifest verified with zero uncovered or untracked files.
