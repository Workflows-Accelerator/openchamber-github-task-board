# Release Receipt: #49, #50, #51 Deployment & Activation

**Executed:** Mon Nov 02 2026  
**Auditor / Operator:** `9router/engineer`  
**Candidate SHA:** `8b7e059b17b7f4fad61a7466cd35cb34467807ef`  
**Base Master SHA:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Source Branch:** `master` (pushed to `origin/master`)  
**Release Directory:** `/workspace/releases/board/8b7e059-20261102`  
**Current Symlink:** `/workspace/releases/board/current -> /workspace/releases/board/8b7e059-20261102`  
**Rollback Baseline:** `/workspace/releases/board/ab7516c-20261030` (intact and preserved)  
**Public Endpoint:** `https://board.workflows.ac`  
**Local Endpoint:** `http://127.0.0.1:8787`  
**Status:** Deployed, Live, Empirical Verification Passed  

---

## 1. Remote Git & Staging Verifications

| Check | Command / Assertion | Exit Code | Result |
| --- | --- | --- | --- |
| Ancestry check | `git merge-base --is-ancestor ab7516c 8b7e059` | 0 | **PASS** (ancestor confirmed) |
| Feature ancestry | `git merge-base --is-ancestor` (84d2e39, f0dae5b, c37ad8b into 8b7e059) | 0 | **PASS** (all included) |
| Fast-forward push | `git push origin master` | 0 | `ab7516c..8b7e059` fast-forwarded |
| Remote readback | `git ls-remote origin master` | 0 | Confirmed `8b7e059b17b7f4fad61a7466cd35cb34467807ef` |

---

## 2. Release Staging & Manifest Checksums

Staged artifacts in `/workspace/releases/board/8b7e059-20261102/`:
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

Strict manifest verification (`sha256sum -c --strict checksums.sha256`): **11/11 OK**

```text
e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee  package.json
c23898a6c614753b837ebc27398e4cf3b8788f59ccfafca0b9041a852d74fc2c  web/dist/server.mjs
23968c3199fee43222290b33f1426af1be447c991452cc4d8cd3b424eac62045  web/public/app.js
0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c  web/public/apple-touch-icon.png
00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f  web/public/icon-192.png
9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266  web/public/icon-512.png
b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082  web/public/icon.svg
c34e0eb4d42d0ad16e54b85d26fbeb85298b0721ed8d785367ef283d3b9efb7c  web/public/index.html
493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be  web/public/manifest.json
43ffeb4acfb14c258dae6cbbe3b04c256dd74874f3967eb9f4517747783f7852  web/public/sw.js
d253f5454fa25145b2326778f6993a4fb0032f306d863f6eb7ec4ee188e08544  web/public/theme.css
```

---

## 3. Atomic Switch & Process Supervision

- **Symlink switch:** `ln -sfn /workspace/releases/board/8b7e059-20261102 /workspace/releases/board/current`
- **Supervisor restart:** Supervisor PID 125 restarted child process. Measured downtime: 2350.60ms.
- **Active Child PID:** PID 163 (PPID 125 supervisor)
- **Verified Child CWD:** `/proc/163/cwd -> /workspace/releases/board/8b7e059-20261102`

---

## 4. Empirical Endpoint Verifications

| Check | Probe Command | Observed Response | Result |
| --- | --- | --- | --- |
| Local Health | `curl -i -sS http://127.0.0.1:8787/health` | HTTP 200, `{"status":"ok","version":"1.2.1","uptime":...}` | **PASS** |
| Public Health | `curl -i -sS https://board.workflows.ac/health` | HTTP 200, `{"status":"ok","version":"1.2.1","uptime":...}` | **PASS** |
| Public TLS | `curl -v --tlsv1.2 https://board.workflows.ac/health` | TLSv1.3 / HTTP/2, cert verify OK | **PASS** |
| Public HTML | `cmp -s <(curl -sS https://board.workflows.ac/) .../index.html` | 0-byte difference | **PASS** |
| Public App JS | `cmp -s <(curl -sS https://board.workflows.ac/app.js) .../app.js` | 0-byte difference | **PASS** |
| Public CSS | `cmp -s <(curl -sS https://board.workflows.ac/theme.css) .../theme.css` | 0-byte difference | **PASS** |
| Service Worker | `cmp -s <(curl -sS https://board.workflows.ac/sw.js) <(curl -sS http://127.0.0.1:8787/sw.js)` | 0-byte difference (`CACHE_VERSION = "1.2.1-c812caa389"`) | **PASS** |
| Login Desktop DOM (#49) | Obscura CDP at 1280x800 | `#username` offscreen (`uLeft: -10000`, `uRight: -9999`), 0 label bleed, 0 errors | **PASS** |
| Login Mobile DOM (#49) | Obscura CDP at 360x800 | `#username` offscreen (`uLeft: -10000`, `uRight: -9999`), 0 label bleed, 0 errors | **PASS** |

Screenshots saved to:
- `.agents/run/repairs-49-50-51-release/verifications/screenshots/live-login-1280.png`
- `.agents/run/repairs-49-50-51-release/verifications/screenshots/live-login-360.png`

---

## 5. Extension Synchronization & Activation

- **Root Checkout Synchronization:** Merged `master` (`8b7e059`) into `ops/task-board-activation`.
- **Product Tree Parity:** `git diff master -- . ':(exclude).agents/run' ':(exclude)outputs'` is 0 bytes.
- **Parity Test Suite:** 18/18 passed (`test/shipped-parity.test.js`).
- **Toolbar Controls Tests:** 23/23 passed (`test/toolbar-controls.test.js`).
- **Panel Connection Tests:** 9/9 passed (`test/panel-service-connection.test.js`).
- **Service Host Tests:** 5/5 passed (`test/service-host-connection.test.js`).
- **Typecheck:** Clean (0 errors).
- **Runtime Boundary:** Host OpenChamber web server on port 3000 requires password authentication (`#openchamber-ui-password`), returning 401 on unauthenticated `/api/guests/*` and `/api/guests/github-task-board/frame-grant`. Per secrets wall, host passwords were not probed. OpenChamber monitors the root checkout with `watchFolderInstalls: true`.

---

## 6. GitHub Issue Closures

- **Issue #49:** Receipt comment posted (`https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/49#issuecomment-6575277632`), label `status:done` added (`status:needs-human` removed), closed as completed.
- **Issue #50:** Receipt comment posted (`https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/50#issuecomment-6575304696`), label `status:done` added (`status:needs-human` removed), closed as completed.
- **Issue #51:** Receipt comment posted (`https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/51#issuecomment-6575323971`), label `status:done` added (`status:needs-human` removed), closed as completed.

---

## 7. Rollback Safety

- Rollback release `/workspace/releases/board/ab7516c-20261030` remains untouched on disk.
- Rollback command:
  ```bash
  ln -sfn /workspace/releases/board/ab7516c-20261030 /workspace/releases/board/current
  kill -TERM $(cat /tmp/opencode/board-supervisor/supervisor.pid)
  /workspace/config/opencode/tools/board/start.sh
  ```

---

## 8. Disclosed Blind Spots

- OpenChamber host UI on port 3000 password prompt prevented unauthenticated guest toggle API calls and live iframe DOM capture.
- Physical device password autofill prompts and native password manager overlays were verified via CDP computed styles/bounding boxes rather than physical hardware.
