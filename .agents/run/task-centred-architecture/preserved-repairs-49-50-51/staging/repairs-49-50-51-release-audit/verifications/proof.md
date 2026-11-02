# Deep Verification Result: Repairs #49, #50, #51 Release Audit

**Task:** Independent audit of release candidate 8b7e059, web deployment, root checkout synchronization, and host runtime behavior  
**Status:** PASS  
**Timestamp:** 2026-11-02T11:20:00Z  

---

### Executed Levels
- **L0 Static:** PASS (Ancestor check passed for `ab7516c`, `84d2e39`, `f0dae5b`, `c37ad8b` into `8b7e059`; remote `origin/master` readback confirmed `8b7e059b17b7f4fad61a7466cd35cb34467807ef`; 0-byte product diff between root checkout `/workspace/extensions/github-task-board` and `master`).
- **L1 Unit / Regression:** PASS (Root test suite 618/618 passed, web test suite 453/453 passed, `test/shipped-parity.test.js` 18/18 passed, `test/toolbar-controls.test.js` 4/4 passed [23 style assertions], `test/panel-service-connection.test.js` 10/10 passed, `test/service-host-connection.test.js` 9/9 passed).
- **L2 Integration:** PASS (Manifest checksums 11/11 OK in `/workspace/releases/board/current` -> `8b7e059-20261102`; rollback `ab7516c-20261030` preserved; supervisor PID 125, child PID 163 with CWD `/workspace/releases/board/8b7e059-20261102`).
- **L3 The User's Way:** PASS (Local `http://127.0.0.1:8787` and public `https://board.workflows.ac` `/health` 200 OK with `version: 1.2.1`; TLSv1.3 / HTTP/2 certificate verification OK; 11 assets byte-matched to disk artifacts; `/sw.js` matches dynamically stamped version `1.2.1-c812caa389`; visual inspection of `live-login-1280.png` and `live-login-360.png` confirms zero username label bleed).
- **L4 Hostile Review (AI):** PASS (All adversarial findings confirmed resolved in candidate SHA).
- **L5 Human Validation:** PASS (Recorded user decision D60: "Approve all 3 & release").

---

### Empirical Evidence

1. **Git Ancestry & Remote Verification:**
   - *Command:* `git merge-base --is-ancestor <sha> 8b7e059`
   - *Result:* Ancestry confirmed for `ab7516c`, `84d2e39`, `f0dae5b`, `c37ad8b`.
   - *Remote Readback:* `git ls-remote origin master` confirmed `8b7e059b17b7f4fad61a7466cd35cb34467807ef`.
   - *Root Sync:* `git -C /workspace/extensions/github-task-board diff master -- . ':(exclude).agents/run' ':(exclude)outputs'` returned 0 bytes diff.

2. **Release Staging & Process State:**
   - *Symlink Target:* `readlink -f /workspace/releases/board/current` -> `/workspace/releases/board/8b7e059-20261102`.
   - *Manifest Checksums:* `sha256sum -c --strict checksums.sha256` -> 11/11 OK.
   - *Active Supervisor:* PID 125 (`/bin/sh /workspace/config/opencode/tools/board/supervisor.sh`), CWD `/workspace/releases/board/8b7e059-20261102`.
   - *Active Child:* PID 163 (`node web/dist/server.mjs`), CWD `/workspace/releases/board/8b7e059-20261102`.
   - *Rollback Release:* `/workspace/releases/board/ab7516c-20261030` preserved.

3. **Public and Local Endpoint Probes:**
   - Local `http://127.0.0.1:8787/health`: HTTP 200, `{"status":"ok","version":"1.2.1","uptime":...}`.
   - Public `https://board.workflows.ac/health`: HTTP 200, `{"status":"ok","version":"1.2.1","uptime":...}`.
   - TLS Verification: `curl -v --tlsv1.2 https://board.workflows.ac/health` -> TLSv1.3, HTTP/2, SSL certificate verify ok.
   - Static Asset Byte Comparisons: `/` (`index.html`), `/app.js`, `/theme.css`, `/manifest.json`, `/icon.svg`, `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png` byte-matched disk artifacts via `cmp -s`.
   - Service Worker: `/sw.js` on public matches local port 8787 byte-for-byte (`CACHE_VERSION = "1.2.1-c812caa389"` dynamically stamped by `server.mjs`).
   - Obscura Login Screenshots: Visual review of `live-login-1280.png` and `live-login-360.png` confirms `#username` hidden offscreen (`left: -10000px`), zero visual bleed or overlap on `#password` label/input.

4. **Host Extension Runtime Invariant Analysis:**
   - *Asset Serving:* `sendGuestFile` in `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/routes.js` invokes `fs.readFile(filePath)` directly on every request and sets `Cache-Control: no-store`. Extension panel assets (`panel/index.html`, `panel/main.js`) are read directly from disk on each panel load, not cached in memory.
   - *Running Services:* Process inspection (`ps -ef` and `/proc/[0-9]*/cmdline`) confirms zero `github-task-board` `service/main.js` child process currently running (only `chambervoice` PID 329 is active).
   - *On-Demand Invocation:* `openGuestServiceRequest` in `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js` automatically spawns the service child process on demand via `ensureGuestService` if the extension is enabled and granted (`!store.disabledGuests[guestId]` and `granted.includes('service')`). If disabled or ungranted, it rejects with `DISABLED` or `NO_SERVICE` instructing the user to enable it in Settings -> Extensions.

5. **GitHub Issues Verification & Test Discrepancy Note:**
   - Issues #49, #50, #51 are closed as completed with label `status:done`. Receipt comments verified: #49 (6575277632), #50 (6575304696), #51 (6575323971).
   - Test count discrepancy analysis: The release receipt's "23/23, 9/9, 5/5" reflected requirement and assertion breakdowns (23 individual token/style assertions in `test/toolbar-controls.test.js`, 9 tests from the initial plan/commit for panel connection, 5 test cases from Section 6.1 of `PLAN.md` for service host). Top-level `node --test` runner cases are 4, 10, and 9 respectively; all pass cleanly.

---

### Verdicts
- **Spec Verdict:** PASS
- **Quality Verdict:** APPROVED
- **Release Verdict:** PROCEED
