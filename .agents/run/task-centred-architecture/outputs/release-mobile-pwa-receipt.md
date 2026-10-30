# Release Receipt: Mobile PWA, Quick-Add Drafts, Batch Align & Searchable Project Picker

**Executed:** Wed Oct 28 2026  
**Source Commit:** `8df6d7b5f79eaf6133cc51950996ffcac872d52e` (`8df6d7b`)  
**Source Branch / Worktree:** `ops/release-mobile-pwa` in `/workspace/extensions/github-task-board/.worktrees/team-ops-release-mobile-pwa`  
**Release Directory:** `/workspace/releases/board/8df6d7b-20261028`  
**Current Symlink:** `/workspace/releases/board/current -> /workspace/releases/board/8df6d7b-20261028`  
**Public Endpoint:** `https://board.workflows.ac`  
**Local Endpoint:** `http://127.0.0.1:8787`  
**Status:** Deployed, Live, Empirical Verification 100% Passed  

---

## 1. Worktree Preflight & Build Verifications

| Step | Command | Exit Code | Result |
| --- | --- | --- | --- |
| Symlink dependencies | `ln -s /workspace/extensions/github-task-board/node_modules node_modules` | 0 | Linked |
| Build panel bundle | `npm run build:panel` | 0 | `panel/main.js` (673.0kb) built |
| Build service bundle | `npm run build:service` | 0 | `service/main.js` (31.3kb) built |
| Bundle web server | `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | 0 | `web/dist/server.mjs` (123.0kb) built |
| Web unit tests | `node --test web/tests/*.test.mjs` | 0 | **390/390 passed**, 0 failed, 0 cancelled |

---

## 2. Release Staging & Manifest Checksums

Staged artifacts in `/workspace/releases/board/8df6d7b-20261028/`:
- `package.json`
- `web/dist/server.mjs`
- `web/public/app.js`
- `web/public/icon.svg`
- `web/public/index.html`
- `web/public/manifest.json`
- `web/public/sw.js`
- `web/public/theme.css`

Manifest verification (`sha256sum -c --strict checksums.sha256`): **8/8 OK**

```text
e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee  package.json
eab17f727f25a87e083c3c9f27cda074bc42bc3d14a853c947cfa5ab00f3767c  web/dist/server.mjs
cf2229dc4a5e6b46a752a740b3632d54d0a8b45c80b9e754c883cea8e03f3cc1  web/public/app.js
b9c1ccff9d23415cf60a5a91d465b0a245bf9930b64a69e58f4ddd4b8c35577b  web/public/icon.svg
93a10fe11f89acf6643cf0b216c6b897c37bb6e49adf179f15ec93054b92b360  web/public/index.html
2bcc84ddaf8dcd15f0e77e1e5c4da21c6e94f5a3cfcd95a1af2228097fdbb73a  web/public/manifest.json
493173c5853607908f498473eb2bce0dd81030595eaeac512a270dbe5d55f0cc  web/public/sw.js
d3157828a320f97b684bce9cd7782bfeef1616421c52c4f67e309a50089e973a  web/public/theme.css
```

---

## 3. Atomic Switch & Process Supervision

- **Symlink switch:** `ln -sfn /workspace/releases/board/8df6d7b-20261028 /workspace/releases/board/current`
- **Supervisor restart:** Supervisor cleanly terminated with `kill -TERM` and relaunched via `/workspace/config/opencode/tools/board/start.sh` so child working directory binds directly to the new release inode per operator contract in `docs/BOARD_SUPERVISOR.md`.
- **Active Supervisor PID:** `2273758`
- **Active Child PID:** `2273804`
- **Verified Child CWD:** `/proc/2273804/cwd -> /workspace/releases/board/8df6d7b-20261028`
- **Supervisor Health Transition:** Sustained health reset triggered (`uptime >= 30s`), backoff set to initial, consecutive crash counter 0.

---

## 4. Empirical Endpoint Verifications

| Check | Probe Command | Observed Response | Result |
| --- | --- | --- | --- |
| Local Health | `curl -sS http://127.0.0.1:8787/health` | HTTP 200, `{"status":"ok","version":"1.2.1",...}` | **PASS** |
| Public Health | `curl -sS https://board.workflows.ac/health` | HTTP 200, `{"status":"ok","version":"1.2.1",...}` | **PASS** |
| PWA Manifest | `curl -sS https://board.workflows.ac/manifest.json` | HTTP 200, `Content-Type: application/manifest+json; charset=utf-8` | **PASS** |
| Service Worker | `curl -sS https://board.workflows.ac/sw.js` | HTTP 200, `Content-Type: application/javascript; charset=utf-8`, `service-worker-allowed: /` | **PASS** |
| Manifest Link in HTML | `curl -sS https://board.workflows.ac/ \| grep -i 'manifest.json'` | `<link rel="manifest" href="/manifest.json">` | **PASS** |
| PWA Icon Asset | `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/icon.svg` | HTTP 200, `Content-Type: image/svg+xml; charset=utf-8` | **PASS** |
| Static Assets | `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/app.js` | HTTP 200 | **PASS** |
| Static Stylesheet | `curl -sS -o /dev/null -w "%{http_code}" https://board.workflows.ac/theme.css` | HTTP 200 | **PASS** |

---

## 5. Security & Secret Exposure Audit

- Logs scanned (`/tmp/opencode/board-supervisor/supervisor.log`, `/tmp/opencode/board-supervisor/board.log`).
- No GitHub tokens, bearer headers, session secrets, or password hashes present in log streams.
- Strict release checksum manifest verified with zero uncovered or untracked files.
