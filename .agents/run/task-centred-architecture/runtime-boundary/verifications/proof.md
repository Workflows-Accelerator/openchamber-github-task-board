# Task Board Runtime Boundary & Host Connection Proof

**Audit Date:** Fri Oct 30 2026  
**Auditor:** Independent Subagent (Model: `9router/engineer`)  
**Engines Tested:**  
- Standard Chromium Headless Shell 156.0.8078.4 (`/workspace/.cache/ms-playwright/chromium_headless_shell-1248/.../chrome-headless-shell`)
- Obscura Headless Chromium CDP 0.2.5 (Port 9333)  
**Host Target:** OpenChamber Web (Port 3000)  
**Branch:** `ops/task-board-activation`  
**Base Master SHA:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Capability Verification Matrix

| Capability / Layer | Status | Empirical Evidence |
| --- | --- | --- |
| **Disk & Served Bundle Parity** | **VERIFIED** | SHA-256 `9d9c2d0` byte-identical between disk, master branch, and host served bundle (`POST /frame-grant` -> `panel/main.js`). |
| **Host Iframe SDK Handshake** | **VERIFIED** | Handshake (`hello` -> `ready`) functions cleanly inside real iframe (`window.self !== window.top`). Zero `No host frame` warnings observed. |
| **Production Parent UI Inspection** | **BLOCKED (AUTH)** | Live OpenChamber UI on port 3000 requires password authentication (`#openchamber-ui-password`). Secrets wall strictly observed: stopped at auth wall, zero credential probing. |
| **Read-Only Repo / Task Loading** | **NOT VERIFIED (SAFETY)** | `StatusReconciler` (`panel/labels.ts:674`) triggers automated `updateIssueStatus` (`PATCH /repos/.../issues/.../labels`) without dry-run mode. Live testing against production repos halted to avoid mutating remote GitHub labels. |
| **Background Service / Coordinator** | **FAILED (BROKEN CONTRACT)** | Missing HTTP server, port binding, and `/health` listener required by host runner (`service.js:461-536`). Would fail host readiness probe (`SERVICE_FAILED`). No `serviceRequest` exists in panel. Background coordination is an unimplemented boundary. |

---

## 2. Host Service Architecture & Unimplemented Runtime Boundary

### 2.1 Host Guest Service Runner Contract
Per `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js:461-536`:
1. **On-Demand Trigger:** Host starts services lazily via `openGuestServiceRequest` only when incoming requests hit `POST /api/guests/:id/service/request`.
2. **Environment & Port Allocation:** Host reserves a random loopback port via `reserveLoopbackPort()` and injects:
   - `OPENCHAMBER_SERVICE_PORT`: allocated loopback port
   - `OPENCHAMBER_SERVICE_TOKEN`: random 24-byte hex bearer token
3. **Readiness Probe (`waitForServiceReady`):** The host immediately begins polling:
   - `GET http://127.0.0.1:${port}/health`
   - Header: `Authorization: Bearer ${token}`
   - Timeout: 15,000ms (`SERVICE_READY_TIMEOUT_MS`)
4. **Failure Consequence:** If the service does not bind `OPENCHAMBER_SERVICE_PORT` and return HTTP 200 within 15 seconds, the host terminates the child process and throws `GuestServiceError('Service failed to start.', 'SERVICE_FAILED')`.

### 2.2 Extension Service Discrepancy
- In `package.json:28-31`, the extension declares:
  ```json
  "contributes": {
    "service": {
      "entry": "service/main.js",
      "runtime": "host"
    }
  }
  ```
- In `service/main.ts:13-231`:
  - `CoordinatorService` instantiates an internal lease store and polling loop.
  - It **never creates an HTTP server**, never binds `OPENCHAMBER_SERVICE_PORT`, and exposes **no `/health` endpoint**.
  - In comparison, working guest services like `chambervoice` (`/workspace/extensions/chambervoice/service/server.ts:1830`) run an explicit HTTP server with `/health`.
- In `panel/main.js`:
  - There are **zero calls to `serviceRequest`**. The panel never invokes the host's service proxy.

### 2.3 Refutation of Prior Audit Claim
- **Prior Claim:** *"The absence of a child process is the normal, intended state for this extension under the host's on-demand architecture. ACTIVATION VERIFIED."*
- **Empirical Refutation:** While the host does spawn on-demand, this extension's service is **not** ready to be spawned. If a request triggered `startGuestService`, the process would crash or time out after 15s because it cannot answer `GET /health`.
- **Impact on Capabilities:** Approved capabilities such as unattended background lease pruning and cross-session task coordination cannot execute in the host environment. The background coordinator is an **unimplemented runtime boundary**, not merely an idle daemon.

---

## 3. Host Iframe Bridge & "No host frame" Root Cause

### 3.1 Mechanism of Prior Warning
In `panel/main.js:987-989`:
```javascript
const send = (message, timeoutMs = requestTimeoutMs) => {
  if (disposed || target.parent === target) {
    return Promise.reject(new HostRequestError("HOST_UNAVAILABLE", "No host frame. This page is not in an iframe."));
  }
  ...
};
```
When a developer or test harness loads `/api/guest-files/:grant/panel/index.html` directly in a browser tab:
- `target.parent === target` is `true` (`window.parent === window`).
- Every call to `connectHost().storage.get()` immediately logs:
  `[TaskBoard] Could not remember view settings: No host frame. This page is not in an iframe.`

### 3.2 Real Parent-Iframe Verification
Tested across 12 combinations (Standard Chromium 156.0 and Obscura 0.2.5; dark and light themes; 1280px, 980px, 360px) in a real parent shell delivering standard OpenChamber SDK protocol messages (`channel: 'openchamber.sdk', v: 1`):
- `window.self !== window.top`: `true`
- Handshake `hello` -> `ready`: received and acknowledged
- Host theme tokens injected: `--oc-bg`, `--oc-fg`, etc. applied to root
- `No host frame` warnings: **0 occurrences across all runs**
- **Conclusion:** The SDK bridge functions properly when mounted inside an iframe. Prior warnings were purely an artifact of loading the panel asset directly outside an iframe container.

---

## 4. Live Parent UI Authentication Boundary

- Port 3000 host check:
  - `GET http://127.0.0.1:3000/api/auth/status` -> HTTP 200 `Authentication required`.
  - `GET http://127.0.0.1:3000/` -> Serves unlock page with `#openchamber-ui-password`.
- Per Secrets Wall:
  - No inspection of `/workspace/.openchamber-data/**`
  - No reading `.env*` or `board.env`
  - No credential extraction, process memory snooping, or auth bypass.
- **Result:** Stopped at the production parent UI authentication boundary as required by rule.

---

## 5. Safety Inspection: Startup Reconcilers & Mutation Risks

- `panel/main.ts:3190`: `statusReconciler = new StatusReconciler(...)`.
- `panel/labels.ts:674-721`: On snapshot updates, `StatusReconciler.reconcile()` detects mismatches between issue labels and active session states.
- If a mismatch is detected, it immediately executes `updateIssueStatus(issue, targetColumn)` (`panel/main.ts:2704`), making remote GitHub API calls (`PATCH /repos/.../issues/.../labels`).
- `panel/main.ts` lacks a read-only or dry-run configuration flag.
- **Safety Decision:** Loading live production repositories with active sessions risks unintended remote GitHub mutations. The task loading boundary was kept strictly read-only by avoiding unauthenticated live mutation runs.

---

## 6. Visual Toolbar Audit: Chromium 156.0 vs Obscura 0.2.5

Toolbar screenshots captured and saved to:
`.agents/run/task-centred-architecture/runtime-boundary/verifications/screenshots/`

### Empirical Measurements Table

| Defect / Element | Standard Chromium 156.0 (Dark) | Standard Chromium 156.0 (Light) | Obscura 0.2.5 (Dark) | Obscura 0.2.5 (Light) | Defect Classification |
| --- | --- | --- | --- | --- | --- |
| **Defect 1: `#selectSort` Background** | `rgb(107, 107, 107)` | `rgb(239, 239, 239)` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` | **REAL PANEL DEFECT** (Unstyled native select; inherits `var(--fg)` light text, rendering white-on-white on engines with white select UA background). |
| **Defect 1: `#selectSort` Color** | `rgb(255, 255, 255)` | `rgb(0, 0, 0)` | `rgb(240, 242, 245)` | `rgb(28, 30, 33)` | White text on white background in Obscura dark mode; unstyled in Chromium. |
| **Defect 2: `#txtRepoLabel` Centering** | `text-align: center` | `text-align: center` | `text-align: center` | `text-align: center` | **REAL PANEL DEFECT** (Button centers text; when truncated, pushes text start off left edge). |
| **Defect 2: `#txtRepoLabel` Overflow (360px)** | `sw=94 > cw=76` (**Overflow**) | `sw=94 > cw=76` (**Overflow**) | `sw=67, cw=67` | `sw=67, cw=67` | Truncation confirmed in Chromium 156.0 at 360px (`ecting repo...`). |
| **Defect 3: `#btnViewSelect` Crowding** | `cw=99, sw=99` (No crowd) | `cw=99, sw=99` (No crowd) | `cw=85 < sw=92` (**Crowded**) | `cw=85 < sw=92` (**Crowded**) | **REAL PANEL DEFECT** (Missing `min-width` and `flex-shrink: 0`; text touches border under compact flex containers). |

---

## 7. Conclusions & Required Alignment

1. **Prior Activation Verdict Overturned:** The prior audit's claim of "ACTIVATION VERIFIED" is unsupported. The extension's background service cannot start under OpenChamber's guest service runner due to a missing HTTP `/health` server.
2. **True State:** The panel frontend assets and iframe handshake are functional, but background coordination is an **unimplemented runtime boundary**.
3. **Visual Quality:** All 3 defects (`#selectSort` unstyled, `#txtRepoLabel` left-clipping, `#btnViewSelect` crowding) are pre-existing CSS bugs in `panel/index.html`.
4. **Next Steps for Product / User Alignment:**
   - To make the background service functional, implement an HTTP server listening on `OPENCHAMBER_SERVICE_PORT` with `GET /health` bearer authentication, or formally withdraw the service contribution if background reconciliation is not desired.
   - Address the 3 toolbar CSS defects in a coordinated panel styling fix.
