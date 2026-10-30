# Deep Verification Result — Release #47 / #48 Simplified Views Batch

**Task:** Release human-approved #47/#48 staging batch to origin/master and deploy to https://board.workflows.ac with empirical proof and rollback safety  
**Status:** PASS  
**Timestamp:** 2026-10-30T08:25:00Z  
**Branch:** feat/batch-simplify-staging (staging), master (synced & pushed)  
**Approved Candidates:** #47 `268bd28738443863d6a58b5e4500ad20b6aaa05f`, #48 panel `c9fb61b8f4d7fa2178481abaff588b2e23b8380e`, #48 web `d5a205da26827d0555824339fcb14c9a39d7af7f`  
**Approved Staging SHA:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Remote Master SHA:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (push exit 0)  
**Deployed Release Path:** `/workspace/releases/board/ab7516c-20261030`  
**Current Release Symlink:** `/workspace/releases/board/current -> /workspace/releases/board/ab7516c-20261030`  
**Rollback Preserved Target:** `/workspace/releases/board/cc08379-20261029`  

---

### Executed Levels

- **L0 Static:** PASS
  - `npm run typecheck` -> exit 0
  - `npx tsc -p web/tsconfig.json` -> exit 0
- **L1 Unit / Regression:** PASS
  - `node --test test/shipped-parity.test.js` -> 18/18 passed, exit 0
  - `node --test --test-concurrency=1 test/*.test.js` -> 595/595 passed, exit 0
  - `node --test web/tests/*.test.mjs` -> 449/449 passed, exit 0
- **L2 Integration:** PASS
  - Panel bundle deterministic parity (`npx esbuild panel/main.ts --bundle --format=iife ...` vs `panel/main.js`): 0-byte difference, exit 0
  - Service bundle deterministic parity (`npx esbuild service/main.ts ...` vs `service/main.js`): 0-byte difference, exit 0
  - Server bundle deterministic build (`npx esbuild web/server.ts ...` -> `web/dist/server.mjs`): 0-byte difference, exit 0
  - Supervisor manifest verification against `/workspace/releases/board/ab7516c-20261030/checksums.sha256`: 11/11 OK, exit 0
  - Ancestry verification (`git merge-base --is-ancestor` for cc08379, 268bd28, c9fb61b, d5a205d into ab7516c): exit 0
  - Unrelated branch isolation (`git merge-base --is-ancestor b29eb60 ab7516c`): exit 1 (clean, not ancestor)
  - Zero diff on protected files (`web/server/auth.ts`, `web/server/config.ts`, `web/public/sw.js`) vs #47 candidate 268bd28: exit 0
- **L3 The User's Way (E2E / CLI / Browser / Live Endpoint):** PASS
  - Standalone browser suite (`node web/tests/browser-verify.mjs`): 33/33 passed, 10 screenshots, 0 page errors, exit 0
  - Mobile & panel view browser suite (`node web/tests/issue-48-browser-verify.mjs`): 14/14 passed, 16 screenshots, 0 page errors, exit 0
  - Live production local health probe (`curl -i -sS http://127.0.0.1:8787/health`): HTTP/1.1 200 OK (`{"status":"ok","version":"1.2.1",...}`)
  - Live production public health probe (`curl -i -sS https://board.workflows.ac/health`): HTTP/2 200 OK (`{"status":"ok","version":"1.2.1",...}`)
  - Live TLS handshake check (`curl -v --tlsv1.2 https://board.workflows.ac/health`): TLSv1.3 negotiated, SSL certificate verify ok
  - Public served assets byte verification vs `/workspace/releases/board/ab7516c-20261030/web/public/`:
    - `index.html`: BYTE-IDENTICAL (exit 0)
    - `app.js`: BYTE-IDENTICAL (exit 0)
    - `theme.css`: BYTE-IDENTICAL (exit 0)
    - `manifest.json`: BYTE-IDENTICAL (exit 0)
    - `apple-touch-icon.png`: BYTE-IDENTICAL (exit 0)
    - `icon-192.png`: BYTE-IDENTICAL (exit 0)
    - `icon-512.png`: BYTE-IDENTICAL (exit 0)
    - `icon.svg`: BYTE-IDENTICAL (exit 0)
    - `sw.js`: Byte-identical between local and public endpoint with dynamic version stamp (`CACHE_VERSION = "1.2.1-e5b029b1b2"`)
  - Web Align Drafts check: `curl -sS https://board.workflows.ac/ | grep -i 'align'` -> absent; `curl -sS https://board.workflows.ac/app.js | grep -i 'btnAlignDrafts'` -> absent; `POST /api/repos/.../batch-align` -> unauthenticated 401 / route absent
  - Real public login DOM inspection via Obscura CDP:
    - Desktop (1280x800): formMethod="post", formAction="/api/session", user input autocomplete="username", password input autocomplete="current-password", scrollWidth=1280, clientWidth=1280 (0 overflow), 0 page errors
    - Mobile (360x800): scrollWidth=360, clientWidth=360 (0 overflow), 0 page errors
    - Screenshots captured: `verifications/screenshots/public-login-desktop.png`, `verifications/screenshots/public-login-360.png`
- **L4 Hostile Review (AI):**
  - **Spec Verdict:** PASS
  - **Quality Verdict:** APPROVED
  - Hostile audit confirmed candidate ancestry, clean fast-forward of master, absence of test or mock bypasses, preserved session file paths, and unpolluted production data.
- **L5 Human Validation:** PASS (Release Executed)
  - Explicit human approval recorded on 2026-10-29 ("Approved", "Continue") authorizing merge of exact staging batch ab7516c to master, push, deploy to https://board.workflows.ac, and closure of #47 and #48.
  - Release comments posted to #47 and #48 quoting human approval.
  - Both issues transitioned to `status:done` and closed as completed.

---

### Empirical Evidence ("The User's Way")

1. **Git Remote Release Advance:**
   - *Command:* `GIT_TERMINAL_PROMPT=0 git push origin master`
   - *Exit Code:* `0`
   - *Remote verification:* `GIT_TERMINAL_PROMPT=0 git ls-remote origin master` -> `ab7516c4a3634c3d69f7b82936ddb7655d327ebb refs/heads/master`

2. **Immutable Release Package & Strict Checksums:**
   - *Location:* `/workspace/releases/board/ab7516c-20261030`
   - *Command:* `( cd /workspace/releases/board/ab7516c-20261030 && sha256sum -c --strict checksums.sha256 )`
   - *Exit Code:* `0`
   - *Output:* All 11 files verified `OK`:
     - `e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee package.json`
     - `c23898a6c614753b837ebc27398e4cf3b8788f59ccfafca0b9041a852d74fc2c web/dist/server.mjs`
     - `23968c3199fee43222290b33f1426af1be447c991452cc4d8cd3b424eac62045 web/public/app.js`
     - `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c web/public/apple-touch-icon.png`
     - `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f web/public/icon-192.png`
     - `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266 web/public/icon-512.png`
     - `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082 web/public/icon.svg`
     - `c34e0eb4d42d0ad16e54b85d26fbeb85298b0721ed8d785367ef283d3b9efb7c web/public/index.html`
     - `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be web/public/manifest.json`
     - `43ffeb4acfb14c258dae6cbbe3b04c256dd74874f3967eb9f4517747783f7852 web/public/sw.js`
     - `bc775d75a73b9e446e04e5456576da11e2e422eaedafe150703966db66768f16 web/public/theme.css`

3. **Atomic Symlink Switch & Controlled Supervisor Restart:**
   - *Symlink command:* `ln -sfn /workspace/releases/board/ab7516c-20261030 /workspace/releases/board/current`
   - *Target verification:* `readlink -f /workspace/releases/board/current` -> `/workspace/releases/board/ab7516c-20261030`
   - *Restart execution:* Supervisor terminated with `kill -TERM`, child reaped, restarted cleanly via `/workspace/config/opencode/tools/board/start.sh`
   - *Measured downtime:* 2419 ms
   - *Active process inspection:* Supervisor PID 78, child PID 116; verified child cwd `/proc/116/cwd -> /workspace/releases/board/ab7516c-20261030`

4. **Live Public Endpoint & Asset Verification:**
   - *Endpoint:* `GET https://board.workflows.ac/health` -> HTTP/2 200 OK (`{"status":"ok","version":"1.2.1","uptime":237}`)
   - *Local endpoint:* `GET http://127.0.0.1:8787/health` -> HTTP/1.1 200 OK (`{"status":"ok","version":"1.2.1","uptime":236}`)
   - *Public assets byte match:* `index.html`, `app.js`, `theme.css`, `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `icon.svg` match staged release artifacts byte-for-byte (`cmp -s` exit 0).
   - *Dynamic Service Worker:* `sw.js` matches `CACHE_VERSION = "1.2.1-e5b029b1b2"` on both local and public servers.

5. **Public Login Viewport Inspection (No-Auth DOM Probe):**
   - *Desktop:* 1280x800, 0 overflow, username input present with autocomplete="username", password input autocomplete="current-password", 0 console errors.
   - *Mobile:* 360x800, 0 overflow, 0 console errors.
   - *Screenshots:*
     - `.agents/run/batch-simplify-release/verifications/screenshots/public-login-desktop.png` (79,057 bytes)
     - `.agents/run/batch-simplify-release/verifications/screenshots/public-login-360.png` (59,187 bytes)

6. **GitHub Issue Closures:**
   - *Issue #47:* Receipt comment posted (`https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/47#issuecomment-6518428491`), labeled `status:done`, closed as completed.
   - *Issue #48:* Receipt comment posted (`https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/48#issuecomment-6518432884`), labeled `status:done`, closed as completed.

---

### Installed Extension Status

- **Status:** NOT VERIFIED
- **Diagnosis:** The OpenChamber extension directory is located at `/workspace/extensions/github-task-board`. The root checkout at this directory is currently checked out to `feat/v2-binding-and-ratelimit` for manager portfolio work, not `master`. Although the updated panel code has been built and committed to `master` (and panel deterministic bundle parity is verified 0-byte difference), the OpenChamber host process serving the extension reads directly from the files in `/workspace/extensions/github-task-board/panel/`.
- **Safe Next Step:** Once active tasks on `feat/v2-binding-and-ratelimit` conclude, fast-forward or switch the root checkout to `master` (or sync master files) and reload OpenChamber window / extension panel to activate the simplified views in the IDE.

---

### Failures & Blind Spots

- **Failures:** None. All preflight, build, test, push, deployment, manifest, TLS, and DOM gates passed.
- **Rollback Safety:** Rollback release `/workspace/releases/board/cc08379-20261029` remains untouched on disk. If needed, running `ln -sfn /workspace/releases/board/cc08379-20261029 /workspace/releases/board/current && kill -TERM $(cat /tmp/opencode/board-supervisor/supervisor.pid) && /workspace/config/opencode/tools/board/start.sh` restores the prior version cleanly.
- **Disclosed Blind Spots:**
  - Real GitHub GraphQL `transferIssue` permissions on live repositories were not exercised with live writes (mocked in tests).
  - Physical phone touch feel, haptics, and native browser OS password manager autofill prompts were not exercised on physical devices.
  - Production session file contents and persistent credential stores were not accessed or modified.
