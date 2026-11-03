# Release & Deployment Verification Proof: Online Board Polish (#53, #54)

**Date:** Tue Nov 03 2026  
**Auditor / Operator:** `9router/engineer`  
**Candidate SHA:** `98261a8b417c8005b63bc234399bdf6e4cebb974`  
**Base Master SHA:** `8b7e059b17b7f4fad61a7466cd35cb34467807ef`  
**Release Directory:** `/workspace/releases/board/98261a8-20261103`  
**Current Symlink:** `/workspace/releases/board/current -> /workspace/releases/board/98261a8-20261103`  
**Rollback Baseline:** `/workspace/releases/board/8b7e059-20261102` (intact and preserved)  
**Public Endpoint:** `https://board.workflows.ac`  
**Local Endpoint:** `http://127.0.0.1:8787`  

---

## 1. Remote Git & Staging Verifications

| Check | Target / Command | Exit Code | Result |
| --- | --- | --- | --- |
| Ancestry check | `git merge-base --is-ancestor 8b7e059 98261a8` | 0 | **PASS** (ancestor confirmed) |
| Linear batch history | `8b7e059 -> b14a787 -> 5b9bb70 -> 4606b45 -> 764bd08 -> 35a23fe -> 98261a8` | 0 | **PASS** (strictly linear) |
| Root test suite | `npm test` | 0 | **618/618 passed** |
| Web test suite | `node --test web/tests/*.test.mjs` | 0 | **479/479 passed** |
| Targeted tests | `node --test web/tests/issue-53-*.test.mjs web/tests/issue-54-*.test.mjs` | 0 | **26/26 passed** |
| Shipped parity tests | `node --test test/shipped-parity.test.js` | 0 | **18/18 passed** |
| Typecheck | `npm run typecheck` | 0 | **PASS (0 errors)** |
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
- **Supervisor restart:** Supervisor PID 78 received SIGTERM, followed by `/workspace/config/opencode/tools/board/start.sh`.
- **Measured downtime:** 2354.75ms.
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

Screenshots saved to:
- `.agents/run/online-board-polish-release/verifications/screenshots/live-login-1280.png`
- `.agents/run/online-board-polish-release/verifications/screenshots/live-login-360.png`

---

## 5. Loopback Authenticated Harnesses (Synthetic GitHub)

To preserve the secrets wall, no live production credentials were used for authenticated browser checks. Authenticated UX was verified using both standalone test harnesses driven over Obscura CDP:

1. **Issue #53 Look & Feel Harness (`verify-openchamber-look.mjs`):**
   - 48/48 checks passed:
     - 1280px full-width layout (`main` >= 1200px)
     - Compact unified toolbar with All Projects label and dropdown
     - Linear-style rows with status dot, title, and cleaned description preview
     - Slide-over detail drawer (480px width) keeping board visible underneath
     - Theme switching: Auto, Dark, Light tokens correctly applied
     - 360px mobile responsiveness and >=44px touch targets
     - Zero uncontained elements, zero horizontal overflow

2. **Issue #54 No Sign-in Flash Harness (`verify-no-flash.mjs`):**
   - 13/13 checks passed:
     - Unauthenticated visit reveals `#login-view` only after `/api/session` check
     - Authenticated sign-in records non-secret `tb_auth_hint = 1` and cached board
     - Page reload with 300ms simulated WAN latency opens straight to board shell (`#login-view` remains hidden for all 12 timeline checkpoints)
     - Explicit sign-out clears hint and cache, revealing login form cleanly

---

## 6. Root Checkout Synchronization

- **Root Merge:** In `/workspace/extensions/github-task-board`, merged `master` (`98261a8`) with `git merge --no-ff master -m "chore(ops): sync ops/task-board-activation with master 98261a8"` (commit `898ec36`).
- **Product Parity:** `git diff master -- . ':(exclude).agents/run' ':(exclude)outputs'` is 0 bytes (clean parity).
- **Extension Surface Parity:** `panel/**` and `service/**` are 100% byte-identical to `8b7e059` (zero guest toggle needed).
- **Test Parity in Root:**
  - `npm test`: 618/618 passed
  - `node --test web/tests/*.test.mjs`: 479/479 passed
  - `node --test web/tests/issue-53-*.test.mjs web/tests/issue-54-*.test.mjs`: 26/26 passed
  - `node --test test/shipped-parity.test.js`: 18/18 passed
  - `npm run typecheck`: clean (0 errors)

---

## 7. GitHub Issue Receipts

Per authority D65, receipts were posted and both issues remain OPEN awaiting human live inspection:

- **Issue #53:**
  - Receipt comment: `https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/53#issuecomment-6612603077`
  - Labels: added `status:needs-human`, removed `status:in-review`
  - State: OPEN
- **Issue #54:**
  - Receipt comment: `https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/54#issuecomment-6612604228`
  - Labels: added `status:needs-human`, removed `status:in-review`
  - State: OPEN

---

## 8. Rollback Safety & Preserved Baseline

- Prior release `/workspace/releases/board/8b7e059-20261102` remains intact on disk.
- Rollback command:
  ```bash
  ln -sfn /workspace/releases/board/8b7e059-20261102 /workspace/releases/board/current
  kill -TERM $(cat /tmp/opencode/board-supervisor/supervisor.pid)
  /workspace/config/opencode/tools/board/start.sh
  ```

---

## 9. Disclosed Blind Spots

1. **Zero Production Credentials in Browser Probes:** By policy, live production credentials were never typed into the public browser session. Public live tests verified signed-out DOM, HTTP/TLS health, asset hashes, and layout. Authenticated behavior was verified through isolated loopback harnesses with synthetic backends.
2. **Headless Emulation vs Physical Mobile Device:** Mobile 360px viewport tests were executed using Obscura CDP device metrics override rather than a physical mobile touchscreen device.
