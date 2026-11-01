# Discovery: OpenChamber Host Service Contract & Task Board Runtime Boundary

**Audit Date:** Fri Oct 30 2026 (Updated Sun Nov 01 2026 for Plan Correction R2)  
**Investigator:** Model `9router/engineer`  
**Repository:** `openchamber-github-task-board`  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Executive Summary

This investigation isolates the root cause behind Issue #50 ("Reliable task board background connection"). OpenChamber extensions declare local services via `openchamber.contributes.service` in `package.json`. In OpenChamber's host architecture, guest services are managed on-demand by `@openchamber/web/server/lib/guests/service.js`.

The task board extension's built service (`service/main.js`) currently starts an internal coordinator polling loop that only prunes local leases, but completely omits an HTTP server, loopback socket binding, and the mandatory `/health` readiness probe. Consequently, when the host spawns the service, host readiness polling fails repeatedly until a 15-second timeout expires, at which point the host terminates the child process with `SERVICE_FAILED`. Furthermore, the panel frontend (`panel/main.ts`) never calls `host.serviceRequest`, meaning the host never triggers on-demand service startup during normal panel operation.

---

## 2. Host Guest Service Runner Contract & Error Taxonomy

Source inspection of `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js`, `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/routes.js`, and `@openchamber/sdk` (`dist/host.js`, `dist/contract.d.ts`, `GUEST_SERVICES.md`) establishes the exact host contract and error codes:

### 2.1 On-Demand Lifecycle & Spawning
1. **Manifest Declaration:** The package declares:
   ```json
   "contributes": {
     "service": {
       "entry": "service/main.js",
       "runtime": "host"
     }
   }
   ```
2. **Admission & Grants (`service.js:665-667`):** At installation, declaring `contributes.service` adds the capability `"service"` to the extension's requested list. The host refuses requests with `NO_SERVICE` until the user approves the capability in Settings → Extensions:
   ```javascript
   if (!Array.isArray(granted) || !granted.includes('service')) {
     throw new GuestServiceError('Allow this extension\'s local service in Settings → Extensions.', 'NO_SERVICE');
   }
   ```
3. **Disabled Extension Check (`service.js:653-658`):** If the user has disabled the extension, the host throws:
   ```javascript
   if (store.disabledGuests?.[guestId]) {
     throw new GuestServiceError(`${label} is disabled in Settings → Extensions.`, 'DISABLED');
   }
   ```
4. **Trigger Mechanism:** The host does not launch guest services at boot. Spawning is lazy and triggered exclusively via `openGuestServiceRequest` / `proxyGuestServiceRequest` when an incoming request targets `POST /api/guests/:id/service/request` (`service.js:576-592, 622-684`).
5. **Status Queries Do Not Spawn:** The host route `GET /api/guests/:id/service/status` calls `getServiceStatus(guestId)` (`service.js:210-216`), which inspects the in-memory `runtimes` map. It returns `'stopped'` if no request has spawned the service. Calling `host.serviceStatus()` from the panel does not trigger a spawn.

### 2.2 Injected Environment & Port Allocation
When spawning a service process (`service.js:461-492`):
1. **Port Reservation:** The host allocates an ephemeral loopback port using `reserveLoopbackPort()` (`net.createServer().listen(0, '127.0.0.1')`).
2. **Bearer Token:** The host mints a 24-byte cryptographically random hex token via `crypto.randomBytes(24).toString('hex')`.
3. **Environment Allowlist (`inheritedServiceEnv`):** The host passes an explicit allowlist of environment variables:
   - System/locale: `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `TMPDIR`, `TEMP`, `TMP`, `TZ`, `LANG`, `LANGUAGE`, `LC_ALL`, `LC_CTYPE`, `LC_MESSAGES`, `XDG_*`, `USERPROFILE`, Windows variables.
   - Host secrets wall: Host UI password (`#openchamber-ui-password`), tool tokens, and cloud API keys are strictly excluded.
   - Injected service keys:
     - `OPENCHAMBER_SERVICE_PORT`: String representation of the loopback port.
     - `OPENCHAMBER_SERVICE_TOKEN`: Bearer secret hex token (`SERVICE_TOKEN_ENV = 'OPENCHAMBER_SERVICE_TOKEN'`).
     - `ELECTRON_RUN_AS_NODE`: `'1'`.
     - `OPENCHAMBER_SERVICE_SOCKETS`: JSON map of resolved socket bindings (if declared).
     - `OPENCHAMBER_HOST_CALLBACK_URL`: Callback URL (only if the service declares `provides: ["source-control"]`).
4. **Execution:** The host executes `spawn(process.execPath, [absoluteEntry], { cwd: packageRoot, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })`.

### 2.3 Readiness Handshake (`waitForServiceReady`)
1. Immediately upon spawning, the host polls the loopback port (`service.js:134-155`):
   - Method: `GET`
   - URL: `http://127.0.0.1:${port}/health`
   - Header: `Authorization: Bearer ${token}`
   - Header: `Accept: application/json`
   - Timeout per probe: 1,500ms
   - Polling interval: 200ms
   - Overall timeout: 15,000ms (`SERVICE_READY_TIMEOUT_MS`)
2. **Success Condition:** The service must answer HTTP 200 OK. Once received, the host marks the runtime status as `'ready'` and proceeds to proxy the request.
3. **Failure Condition (`service.js:525-535`):** If the service exits, crashes, or fails to answer HTTP 200 within 15,000ms, the host calls `discardRuntime`, collects process output (up to 2,000 characters from stdout/stderr), and throws:
   `GuestServiceError('Guest service failed to become ready. [detail]', 'SERVICE_FAILED')`.

### 2.4 Request Proxy & Error Taxonomy
- Inbound requests from the panel reach the host via `POST /api/guests/:id/service/request` (`routes.js:604-635`).
- If `service.js` throws a `GuestServiceError`, `routes.js:628-634` maps the error code to HTTP status and JSON:
  - `SERVICE_FAILED`, `REQUEST_FAILED`, `RESPONSE_TOO_LARGE` -> HTTP 502 Bad Gateway with `{ error: code, message }`.
  - `NO_SERVICE`, `DISABLED`, `BAD_PATH` -> HTTP 400 Bad Request with `{ error: code, message }`.
- In the SDK client (`@openchamber/sdk/dist/host.js:284-294`):
  When the postMessage reply arrives with `ok: false`, it rejects the waiting promise:
  `waiter.reject(new HostRequestError(message.code, message.error))`.
  `HostRequestError` has fields:
  - `name`: `'HostRequestError'` (`host.js:16`)
  - `code`: `HostRequestErrorCode` (`host.js:17`, defined in `contract.d.ts:400-406`)
  - `message`: Sanitized error description (`host.js:14`)
- Direct caller errors:
  - `HOST_UNAVAILABLE`: Frame missing or client disposed (`host.js:303, 963`).
  - `HOST_TIMEOUT`: Host did not respond within 20s (`host.js:308`).
  - `BAD_PATH`: Request path invalid (`host.js:22`).

---

## 3. Discrepancy & Root Cause in `openchamber-github-task-board`

### 3.1 `service/main.ts` Direct Entry
Lines 202–227 of `service/main.ts`:
```typescript
if (process.argv[1] && import.meta.url) {
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    if (process.argv[1] === currentFilePath) {
      const service = new CoordinatorService();
      ...
      service.start().catch((err) => { ... });
    }
  } catch { ... }
}
```
1. When spawned by the host, `process.argv[1]` matches `currentFilePath` (`/workspace/.../service/main.js`).
2. `new CoordinatorService()` is instantiated and `service.start()` is invoked.
3. In `service.start()` (lines 72–109):
   - It checks `storageDir` and creates it if missing.
   - It runs `await this.leaseStore.init()`.
   - It starts `setInterval(() => this.reconcileOnce(), this.config.pollIntervalMs)`.
   - In `reconcileOnce()` (lines 147–159), it executes **only**:
     `await this.leaseStore.pruneExpired()`.
4. **Missing Capabilities:**
   - **Zero HTTP Server:** There is no `http.createServer()` or socket listener.
   - **Zero Port Binding:** `OPENCHAMBER_SERVICE_PORT` is completely ignored.
   - **Zero Inbound Authentication:** `OPENCHAMBER_SERVICE_TOKEN` is completely ignored.
   - **Zero `/health` Endpoint:** The process never responds to `GET /health`.

### 3.2 Panel Frontend Lacks Service Caller
In `panel/main.ts`:
- Grep for `serviceRequest` reveals **0 matches**.
- Grep for `serviceStatus` reveals **0 matches**.
- Grep for `coordinator` reveals **0 matches**.
- The panel communicates with GitHub via `connectHost.request` (`apiOrigin: "https://api.github.com"`), but never calls the host's `serviceRequest` proxy.
- Because OpenChamber starts services on-demand upon the first `serviceRequest`, the service is **never triggered** by the panel. If an external or test request hits `POST /api/guests/:id/service/request`, the service is spawned but crashes out with `SERVICE_FAILED` after 15 seconds.

---

## 4. Empirical Reproduction of Host Contract Failure

Under `.agents/run/issue-50-plan/verifications/reproduce-unready-contract.mjs`, an isolated zero-edit test was executed against the built `service/main.js`:
- Allocated ephemeral loopback port `34291` on `127.0.0.1`.
- Spawned `service/main.js` with `OPENCHAMBER_SERVICE_PORT=34291` and a synthetic 24-byte bearer token in temporary storage (`/tmp/antigravity/issue-50-repro-*`).
- Polled `GET http://127.0.0.1:34291/health` with `Authorization: Bearer [REDACTED]` 3 times over 450ms.
- Observed result:
  ```json
  {
    "port": 34291,
    "probeStatus": "none",
    "probeError": "ECONNREFUSED",
    "exitResult": { "code": 0, "signal": null },
    "stdoutSample": [
      "[Coordinator Service] ========================================",
      "[Coordinator Service] Starting OpenChamber Task Coordinator",
      "[Coordinator Service] Host origin: http://127.0.0.1:3000"
    ]
  }
  ```
- The child process was safely terminated via `SIGTERM` within 100ms, cleanly exiting with code 0.
- Empirical confirmation: The built service starts the internal coordinator, but does not listen on the allocated port, resulting in immediate `ECONNREFUSED`. In OpenChamber, this causes the full 15-second hang and `SERVICE_FAILED` rejection.

---

## 5. Safety Audit: Remote GitHub Mutation Risk (`StatusReconciler`)

Source code inspection of `panel/labels.ts:633-721` and `panel/main.ts:1654, 3190-3196`:
1. When `fetchIssues()` completes (`panel/main.ts:1654`), it calls:
   `statusReconciler.schedule(issues)`.
2. Inside `StatusReconciler.schedule` (`panel/labels.ts:664-672`), it sets a 300ms debounce timer leading to `reconcile(issues)`.
3. In `reconcile(issues)` (`panel/labels.ts:674-718`):
   - For each issue with an active session (`this.getSession(issue)`), it determines `targetCol = resolveIssueColumn(issue, session)`.
   - While `targetCol === 'done'` is strictly prevented from issuing closures (`labels.ts:688`), any non-terminal discrepancy (e.g. session is running but issue has `status:todo` -> resolves to `in-progress`; or session is idle -> resolves to `needs-human`) triggers:
     `await this.updateStatus(issue, targetCol)`.
4. In `panel/main.ts:3192-3194`:
   `updateStatus: async (issue, targetColumn) => { await updateIssueStatus(issue, targetColumn); }`.
5. In `updateIssueStatus` (`panel/main.ts:2114+`):
   Sends a live `PATCH /repos/:repo/issues/:number` with the updated labels array to `https://api.github.com`.
6. **Safety Finding:** Loading the panel in a live OpenChamber host with real GitHub repositories and active sessions **will trigger remote label mutations** on GitHub whenever an issue label and session state diverge.
7. **Prohibition:** Live end-to-end testing against real production repositories must remain strictly prohibited. All automated test suites and contract verifications must use synthetic mock stores, stubbed SDK bridges, and isolated loopback fixtures.

---

## 6. Panel Status & Notice UX Inventory

Inspection of `panel/index.html` and `panel/main.ts` identifies existing notice infrastructure suitable for D59:
1. **HTML Elements (`panel/index.html:3580-3583`):**
   ```html
   <!-- Status / Info Banner -->
   <div id="boardBanner" class="banner" style="display: none;">
     <div class="banner-text" id="boardBannerText"></div>
     <div id="boardBannerActions"></div>
   </div>
   ```
2. **Styling (`panel/index.html:293-309`):**
   - `.banner`: Flex container positioned directly below the toolbar, subtle primary background (`var(--prim-subtle)`), bottom border, font size 12px.
   - `.banner-text`: Flex container with 6px gap, uses theme foreground (`var(--fg)`).
3. **Helper Functions (`panel/main.ts:497-526`):**
   - `showBanner(text: string, actionLabel?: string, onAction?: () => void): void`
   - `hideBanner(): void`
4. **Alignment with D59:**
   - D59 requires observable feedback without adding a new toolbar button or speculative settings system.
   - Calling `showBanner(...)` on failure (capability disabled vs connection failed) and `hideBanner()` on connection success reuses existing UI patterns cleanly and minimally.

---

## 7. Structural & Sequential Constraints for Issue #51

- Issue #51 ("Clear task board toolbar controls") addresses three styling bugs in the panel toolbar:
  1. `#selectSort`: Unstyled native `<select>` causing low contrast / white-on-white text in dark mode.
  2. `#txtRepoLabel`: Centered text causing left-clipping on narrow (360px) viewports.
  3. `#btnViewSelect`: Missing `flex-shrink: 0` and `min-width` causing crowding.
- **File Collision Graph:**
  - Issue #50 modifies `service/main.ts`, `service/config.ts`, `service/types.ts`, and adds a caller in `panel/main.ts`, requiring rebuild of `service/main.js` and `panel/main.js`.
  - Issue #51 modifies `panel/index.html` and `panel/main.ts`, requiring rebuild of `panel/main.js`.
  - Because `panel/main.ts` and `panel/main.js` are shared between #50 and #51, parallel branch execution risks merge collisions and overwriting bundle builds.
  - **Sequential Invariant:** Issue #51 must sequence strictly after Issue #50.
