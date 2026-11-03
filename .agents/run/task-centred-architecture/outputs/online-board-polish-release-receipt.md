# Release Receipt: Online Board Polish (#53, #54) Deployment & Activation

**Executed:** Tue Nov 03 2026  
**Auditor / Operator:** `9router/engineer`  
**Candidate SHA:** `98261a8b417c8005b63bc234399bdf6e4cebb974`  
**Base Master SHA:** `8b7e059b17b7f4fad61a7466cd35cb34467807ef`  
**Source Branch:** `master` (pushed to `origin/master`)  
**Release Directory:** `/workspace/releases/board/98261a8-20261103`  
**Current Symlink:** `/workspace/releases/board/current -> /workspace/releases/board/98261a8-20261103`  
**Rollback Baseline:** `/workspace/releases/board/8b7e059-20261102` (intact and preserved)  
**Public Endpoint:** `https://board.workflows.ac`  
**Local Endpoint:** `http://127.0.0.1:8787`  
**Status:** Deployed, Live, Empirical Verification Passed  

---

## 1. Remote Git & Staging Verifications

| Check | Command / Assertion | Exit Code | Result |
| --- | --- | --- | --- |
| Ancestry check | `git merge-base --is-ancestor 8b7e059 98261a8` | 0 | **PASS** (ancestor confirmed) |
| Feature linear history | `8b7e059 -> b14a787 -> 5b9bb70 -> 4606b45 -> 764bd08 -> 35a23fe -> 98261a8` | 0 | **PASS** (all commits linear) |
| Fast-forward push | `git push origin master` | 0 | `8b7e059..98261a8` fast-forwarded |
| Remote readback | `git ls-remote origin master` | 0 | Confirmed `98261a8b417c8005b63bc234399bdf6e4cebb974` |

---

## 2. Release Staging & Manifest Checksums

Staged artifacts in `/workspace/releases/board/98261a8-20261103/`:
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
1a7c546e89375444fba05d33e5375323a8404a3011c05a2d0522a618db6e933e  web/public/app.js
0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c  web/public/apple-touch-icon.png
00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f  web/public/icon-192.png
9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266  web/public/icon-512.png
b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082  web/public/icon.svg
d35d4a80192b5d49725c965e817f953b8de4cf944f0dbd8667e17c40c5ce2a79  web/public/index.html
493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be  web/public/manifest.json
43ffeb4acfb14c258dae6cbbe3b04c256dd74874f3967eb9f4517747783f7852  web/public/sw.js
6a28df22a87fec2d8f8752f9810df18bb5db688751c8274a2d70a3bfc7224624  web/public/theme.css
```

---

## 3. Atomic Switch & Process Supervision

- **Symlink switch:** Atomic replacement `ln -sfn /workspace/releases/board/98261a8-20261103 /workspace/releases/board/current` via `os.replace`.
- **Supervisor restart:** Supervisor PID 78 terminated with SIGTERM, restarted via `/workspace/config/opencode/tools/board/start.sh`. Measured downtime: 2354.75ms.
- **Active Supervisor PID:** 1191855
- **Active Child PID:** 1191902 (PPID 1191855)
- **Verified Child CWD:** `/proc/1191902/cwd -> /workspace/releases/board/98261a8-20261103`

---

## 4. Empirical Endpoint Verifications

| Check | Probe Command | Observed Response | Result |
| --- | --- | --- | --- |
| Local Health | `curl -i -sS http://127.0.0.1:8787/health` | HTTP 200, `{"status":"ok","version":"1.2.1","uptime":44}` | **PASS** |
| Public Health | `curl -i -sS https://board.workflows.ac/health` | HTTP 200, `{"status":"ok","version":"1.2.1","uptime":45}` | **PASS** |
| Public TLS | `curl -v --tlsv1.2 https://board.workflows.ac/health` | TLSv1.3 / HTTP/2, cert verify OK | **PASS** |
| Public HTML | Byte comparison vs `/workspace/releases/board/98261a8-20261103/web/public/index.html` | 0-byte difference (SHA-256 `d35d4a80192b5d49...`) | **PASS** |
| Public App JS | Byte comparison vs `/workspace/releases/board/98261a8-20261103/web/public/app.js` | 0-byte difference (SHA-256 `1a7c546e89375444...`) | **PASS** |
| Public CSS | Byte comparison vs `/workspace/releases/board/98261a8-20261103/web/public/theme.css` | 0-byte difference (SHA-256 `6a28df22a87fec2d...`) | **PASS** |
| Service Worker | `cmp -s <(curl -sS https://board.workflows.ac/sw.js) <(curl -sS http://127.0.0.1:8787/sw.js)` | 0-byte difference (`CACHE_VERSION = "1.2.1-1c05c9137b"`) | **PASS** |
| Public Login 1280px | Obscura CDP at 1280x800 | Dark theme (`#0f1012`), `#login-view` visible, `#board-view` hidden, 0 overflow, 0 errors | **PASS** |
| Public Login 360px | Obscura CDP at 360x800 | Dark theme (`#0f1012`), `#login-view` visible, `#board-view` hidden, 0 overflow, 0 errors | **PASS** |

Screenshots:
- `.agents/run/online-board-polish-release/verifications/screenshots/live-login-1280.png`
- `.agents/run/online-board-polish-release/verifications/screenshots/live-login-360.png`

---

## 5. Extension Synchronization & Activation

- **Root Checkout Synchronization:** Merged `master` (`98261a8`) into `ops/task-board-activation` (commit `898ec36`).
- **Product Tree Parity:** `git diff master -- . ':(exclude).agents/run' ':(exclude)outputs'` is 0 bytes.
- **Extension Surface Parity:** `panel/**` and `service/**` are 100% byte-identical to `8b7e059` (zero guest toggle needed).
- **Parity Test Suite:** 18/18 passed (`test/shipped-parity.test.js`).
- **Root Unit Suite:** 618/618 passed (`npm test`).
- **Web Unit Suite:** 479/479 passed (`node --test web/tests/*.test.mjs`).
- **Targeted Batch Suite:** 26/26 passed (`web/tests/issue-53-openchamber-look.test.mjs`, `web/tests/issue-54-no-signin-flash.test.mjs`).
- **Typecheck:** Clean (0 errors).
- **Runtime Boundary:** Host OpenChamber web server on port 3000 requires password authentication (`#openchamber-ui-password`), returning 401 on unauthenticated `/api/guests/*` and `/api/guests/github-task-board/frame-grant`. Per secrets wall, host passwords were not probed. OpenChamber monitors the root checkout with `watchFolderInstalls: true`.

---

## 6. GitHub Issue Receipts & State

Per authority D65, receipts were posted quoting user decision and both issues remain OPEN awaiting live human inspection:

- **Issue #53:** Receipt comment posted (`https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/53#issuecomment-6612603077`), label `status:needs-human` added (`status:in-review` removed), state OPEN.
- **Issue #54:** Receipt comment posted (`https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/54#issuecomment-6612604228`), label `status:needs-human` added (`status:in-review` removed), state OPEN.

---

## 7. Rollback Safety

- Rollback release `/workspace/releases/board/8b7e059-20261102` remains untouched on disk.
- Rollback command:
  ```bash
  ln -sfn /workspace/releases/board/8b7e059-20261102 /workspace/releases/board/current
  kill -TERM $(cat /tmp/opencode/board-supervisor/supervisor.pid)
  /workspace/config/opencode/tools/board/start.sh
  ```

---

## 8. Disclosed Blind Spots

- Zero production credentials were used during live browser probes; authenticated UX was proven via standalone loopback harnesses with synthetic backends, reserving production authenticated check for the human operator.
- Physical device mobile browsers were emulated via Obscura CDP viewport and media emulation rather than physical hardware.
