# Implementation & Verification Plan: Issue #50 (Reliable Host Connection)

**Plan Revision:** Revision 2 (Corrected per Independent Review & Decision D59)  
**Plan Date:** Sun Nov 01 2026 (Original R1: Fri Oct 30 2026)  
**Target Issue:** https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/50  
**Status:** Planned / Prepared (Requires User Approval before Implementation)  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Branch:** `fix/issue-50-host-connection`  

---

## Revision 2: Review Corrections & Decision D59 Mapping

This plan replaces Revision 1 in its entirety. The following table maps each mandatory correction and product decision to the exact architectural sections in this document:

| # | Review Finding / Decision Item | Original Plan Defect (R1) | Corrective Action in Revision 2 | Plan Section |
|---|---|---|---|---|
| **1** | **Decision D59 (Board-Open Start Policy)** | Unilaterally recommended Option A with silent swallow; left product fork unsettled. | Implement D59 board-open caller once on mount under `host.onReady`. Observable failure notices via `#boardBanner` / `showBanner`; no silent catch; no new toolbar button; no auto-grant; no prompt loops; acknowledge honest runtime change (expired-lock pruning). | Section 3.2, Section 7 |
| **2** | **Remove Speculative `GET /status`** | Proposed `GET /status` leaking `ownerId`, `activeLeases`, and process internals. | Completely eliminate `GET /status`. Service HTTP interface exposes exclusively `GET /health` with minimal payload `{"status":"ok","service":"task-coordinator"}`. Minimal 404 for unknown paths, 405 for invalid methods. Zero process/lease disclosure. | Section 3.1 |
| **3** | **No Silent Catch & Exact Error Codes** | Proposed wrapping `serviceRequest` in silent try/catch, hiding broken connections. | Eliminate all silent catches. Source-ground exact error codes (`NO_SERVICE`, `DISABLED`, `SERVICE_FAILED`, `REQUEST_FAILED`, `HOST_TIMEOUT`). Observable sanitized UI copy via existing banner. Zero raw Error object or token logging. UI never claims success on failure. | Section 2, Section 3.2 |
| **4** | **Fast Fail Startup Config Validation** | No fast-fail validation; permissive `parseInt` accepting trailing text (e.g. `3000abc`). | Enforce strict full-string regex `/^[0-9]+$/` (range 1..65535) and non-empty token check BEFORE coordinator/storage initialization. Output single sanitized line to `process.stderr` and call `process.exit(1)` immediately. | Section 3.1 |
| **5** | **Cryptographic Timing-Safe Auth** | Vague "dummy check" on unequal lengths; `crypto.timingSafeEqual` throws `RangeError`. | Pre-hash expected and presented tokens using SHA-256 to guarantee identical 32-byte buffers before `crypto.timingSafeEqual`. Malformed/missing headers return 401 without throwing. Enforce 64KB body and 15s socket timeout limits; bounded shutdown. | Section 3.1, Section 4 |
| **6** | **Preservations & Built-Artifact Tests** | Unclear built artifact test isolation; lease preservation unverified across process lifecycle. | Strict direct-run entry guard preserves module imports without side effects. Public APIs and single-writer lease filtering preserved. Automated tests spawn built `service/main.js` with synthetic fixtures; panel tests verify all 3 caller outcomes with stubbed bridge. | Section 3.3, Section 6 |
| **+** | **Sequential Invariant with Issue #51** | Risk of parallel merge collision in `panel/main.ts` and `panel/main.js`. | Confine Issue #50 ownership; confirm #51 collision graph; mandate strict sequential execution of #51 after #50. | Section 5 |
| **+** | **Evidence Categorization & Safety** | Unclear distinction between source predictions, fixture observations, and live host. | Explicitly separate source predictions, fixture observations, and real-host verification (parent UI password boundary). Document source inspection of `StatusReconciler` confirming prohibition of live production testing. | Section 6.3, Section 6.4 |
| **+** | **Doubt-Driven Self-Critique** | Single-sided justification without hostile verification. | Add comprehensive self-hostile critique across 6 dimensions: false success, module import side-effects, token exposure, error observability, D59 drift, lifecycle honesty. | Section 8 |

---

## 1. Objective & Non-Goals

### 1.1 Objective
Provide a minimal, standard-library-only HTTP adapter and an observable, supported panel caller that satisfies the OpenChamber host runner contract (`@openchamber/web/server/lib/guests/service.js`), enabling the background service to:
1. Validate startup port and token configuration quickly with immediate exit on error.
2. Bind strictly to loopback `127.0.0.1:${port}`.
3. Pass `GET /health` constant-time Bearer readiness checks within 15 seconds.
4. Gracefully terminate on `SIGTERM` within 1,500ms, preserving foreign unexpired leases.
5. Connect reliably when the board panel opens in accordance with Decision D59, providing sanitized, observable feedback to the user on success, unapproved capability, or failure.

### 1.2 Non-Goals (Strict Scope Boundary)
- **No Autonomous Task Execution:** The coordinator remains restricted exclusively to lock pruning (`reconcileOnce` calling `leaseStore.pruneExpired()`). No automated task claiming, dispatching, or background agent runner loops.
- **No Remote GitHub Mutations:** No label modifications, remote GitHub API writes, or issue status mutations are initiated by this connection path.
- **No New Settings System or Toolbar Buttons:** No new settings toggle, diagnostic drawer, or toolbar button is introduced. UI relies on existing `#boardBanner` markup.
- **No Automatic Capability Grants or Prompt Loops:** The extension never attempts to auto-grant its own service capability or enter aggressive retry loops if unapproved.
- **No Service Manifest Removal:** `package.json` retains `openchamber.contributes.service` per decision D58.
- **No External Dependencies:** Uses exclusively Node.js built-ins (`node:http`, `node:crypto`, `node:url`). Zero new npm packages.
- **No Global Host Restarts or Production Activation:** Work remains confined to extension sources and isolated test fixtures. Runtime activation awaits batched human review (L5).

### 1.3 Honest Runtime Boundary
Starting the service is a runtime change, not a "read-only request". When the panel calls `host.serviceRequest({ method: 'GET', path: '/health' })`, OpenChamber spawns a child Node process on the host machine running `service/main.js`. This child process instantiates `CoordinatorService`, initializes local storage, and runs an interval timer executing local expired-lock pruning. The plan documents this runtime reality truthfully.

---

## 2. Host Runner Contract & Error Taxonomy (Source Grounded)

Audit of installed OpenChamber source files establishes the exact contracts and wire error codes:
- Host Guest Service Runner: `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js`
- Host Guest HTTP Routes: `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/routes.js`
- SDK Guest Client: `/usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/host.js`
- SDK Contract Types: `/usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/contract.d.ts`

### 2.1 Spawning & Readiness Invariants
1. **On-Demand Spawn (`service.js:576-592, 622-684`):** Services are spawned on-demand upon incoming `POST /api/guests/:id/service/request`. Calling `host.serviceStatus()` returns `'stopped'` without spawning.
2. **Port & Token Injection (`service.js:461-475`):** Host reserves loopback port via `reserveLoopbackPort()` and injects:
   - `OPENCHAMBER_SERVICE_PORT`: Loopback port number as a string.
   - `OPENCHAMBER_SERVICE_TOKEN`: 24-byte cryptographically random hex string (`crypto.randomBytes(24).toString('hex')`).
   - `ELECTRON_RUN_AS_NODE`: `'1'`.
3. **Readiness Probe (`service.js:134-155`):** Host polls `GET http://127.0.0.1:${port}/health` with `Authorization: Bearer ${token}` every 200ms up to a 15,000ms deadline. It requires HTTP 200 OK.
4. **Readiness Failure (`service.js:525-535`):** If the service exits, crashes, or fails to respond HTTP 200 within 15 seconds, the host discards the runtime and throws `GuestServiceError(..., 'SERVICE_FAILED')`.

### 2.2 Host & SDK Error Taxonomy

| Scenario | Host Runner Location | Host Error Code | HTTP Route Status | SDK Rejection Shape |
|---|---|---|---|---|
| **Extension Disabled** | `service.js:653-658` | `DISABLED` | 400 Bad Request | `HostRequestError` (`code: 'DISABLED'`) |
| **Capability Not Granted** | `service.js:665-667` | `NO_SERVICE` | 400 Bad Request | `HostRequestError` (`code: 'NO_SERVICE'`) |
| **Host Shutting Down** | `service.js:84` | `NO_SERVICE` | 400 Bad Request | `HostRequestError` (`code: 'NO_SERVICE'`) |
| **Service Failed to Start** | `service.js:525-535` | `SERVICE_FAILED` | 502 Bad Gateway | `HostRequestError` (`code: 'SERVICE_FAILED'`) |
| **Proxy / Connection Failed** | `service.js:745, 771` | `REQUEST_FAILED` | 502 Bad Gateway | `HostRequestError` (`code: 'REQUEST_FAILED'`) |
| **Response > 8,000,000 Bytes**| `service.js:775` | `RESPONSE_TOO_LARGE` | 502 Bad Gateway | `HostRequestError` (`code: 'RESPONSE_TOO_LARGE'`) |
| **SDK Host Timeout (20s)** | `host.js:308` | `HOST_TIMEOUT` | N/A (client timer) | `HostRequestError` (`code: 'HOST_TIMEOUT'`) |
| **Missing Host Iframe** | `host.js:303` | `HOST_UNAVAILABLE`| N/A (client guard) | `HostRequestError` (`code: 'HOST_UNAVAILABLE'`) |

In `@openchamber/sdk/dist/host.js:12-19`:
```typescript
export class HostRequestError extends Error {
  code: HostRequestErrorCode;
  constructor(code: HostRequestErrorCode, message: string) {
    super(message);
    this.name = 'HostRequestError';
    this.code = code;
  }
}
```

---

## 3. Architecture & Detailed Technical Design

### 3.1 Minimal Stdlib Host Adapter (`CoordinatorHostServer`)
Implemented cleanly in `service/main.ts` (or modularized via `service/host-adapter.ts` and `service/config.ts`):

#### 1. Configuration Resolution & Fast-Fail Startup
Validation occurs immediately upon direct execution, **strictly before** initializing storage, reading files, or creating the coordinator instance:
```typescript
// Strict port validation: full-string integer 1..65535 (no trailing text allowed)
const rawPort = process.env.OPENCHAMBER_SERVICE_PORT?.trim();
if (!rawPort || !/^[0-9]+$/.test(rawPort)) {
  process.stderr.write('[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_PORT must be an integer between 1 and 65535.\n');
  process.exit(1);
}
const port = Number(rawPort);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  process.stderr.write('[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_PORT out of valid range (1..65535).\n');
  process.exit(1);
}

// Strict token validation: non-empty string
const token = process.env.OPENCHAMBER_SERVICE_TOKEN;
if (!token || typeof token !== 'string' || token.trim().length === 0) {
  process.stderr.write('[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_TOKEN must be a non-empty string.\n');
  process.exit(1);
}
```
*Rationale:* Permissive `parseInt` accepts malformed inputs like `3000abc`. Strict regex `/^[0-9]+$/` rejects invalid ports. Immediate exit with code 1 alerts OpenChamber's `waitForServiceReady` instantly (`child.exitCode !== null`), avoiding a 15-second hang.

#### 2. Loopback-Only Socket Binding
The HTTP server binds strictly to IPv4 loopback:
```typescript
server.listen(port, '127.0.0.1', () => {
  console.log(`[Coordinator Service] Host adapter listening on http://127.0.0.1:${port}`);
});
```
Binding to `0.0.0.0`, wildcard, or external network interfaces is strictly forbidden.

#### 3. Fixed-Digest Timing-Safe Bearer Authentication
To prevent timing side-channels and eliminate Node.js `RangeError: Input buffers must have the same length`, both expected and presented tokens are pre-hashed with SHA-256:
```typescript
function authenticateRequest(authHeader: string | undefined, expectedToken: string): boolean {
  if (!authHeader || typeof authHeader !== 'string') return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return false;
  const presentedToken = match[1];

  // SHA-256 fixed-length 32-byte digests
  const expectedHash = crypto.createHash('sha256').update(expectedToken, 'utf8').digest();
  const presentedHash = crypto.createHash('sha256').update(presentedToken, 'utf8').digest();

  // Both digests are guaranteed strictly 32 bytes; constant-time comparison never throws RangeError
  return crypto.timingSafeEqual(expectedHash, presentedHash);
}
```
- Missing headers, non-Bearer schemes, or empty tokens return `false` immediately without allocating buffers.
- Failed authentication yields HTTP 401 Unauthorized (`{"error":"Unauthorized"}`) with header `Content-Type: application/json; charset=utf-8`.
- Bearer tokens are never printed to console logs, stderr, process lists, or HTTP error bodies.

#### 4. Route Confinement (Strict `/health` Only)
The HTTP server implements minimal route dispatching:
- **`GET /health`:**
  - Answers HTTP 200 OK:
    ```json
    {"status":"ok","service":"task-coordinator"}
    ```
  - Headers: `Content-Type: application/json; charset=utf-8`.
- **All other paths (including `/status`, `/unknown`, etc.):**
  - Return HTTP 404 Not Found:
    ```json
    {"error":"Not Found"}
    ```
- **All other HTTP methods (`POST`, `PUT`, `DELETE` on `/health`):**
  - Return HTTP 405 Method Not Allowed:
    ```json
    {"error":"Method Not Allowed"}
    ```
- *No Disclosure:* Zero disclosure of `ownerId`, `activeLeases`, process IDs, memory usage, configuration flags, or filesystem paths.

#### 5. Bounded Protection & Lifecycle Shutdown
- **Socket Timeouts:** Sockets are armed with a 15-second inactivity timeout (`socket.setTimeout(15000, () => socket.destroy())`).
- **Payload Limits:** Maximum request body size capped at 64KB (`65,536` bytes). Excess bytes immediately destroy the incoming request socket with HTTP 413.
- **Graceful Shutdown (`SIGTERM` / `SIGINT`):**
  1. Stops accepting new HTTP connections: `server.close()`.
  2. Closes idle keep-alive connections: `server.closeIdleConnections?.()`.
  3. Awaits `coordinatorService.stop()`:
     - Cancels active interval timer (`clearInterval(this.pollTimer)`).
     - Calls `this.releaseHeldLeases()`: filters `entry.ownerId === this.ownerId`, cleanly releasing only own locks in `leases.json`.
     - Preserves other owners' unexpired leases intact.
  4. Exits cleanly with code 0 within < 1,500ms (well within OpenChamber's 5,000ms `SERVICE_KILL_TIMEOUT_MS` deadline before `SIGKILL`).

---

### 3.2 Supported Caller in `panel/main.ts` (Decision D59)

#### 1. Trigger Point & Execution Invariant
The connection check executes **once per panel open** inside `host.onReady` (`panel/main.ts:9903`):
```typescript
host.onReady(async (ctx) => {
  ...
  // D59: Probe background service once on panel open
  void checkBackgroundServiceConnection();
  ...
});
```
- **Zero Polling:** No `setInterval` or background keep-alive loop.
- **Zero Retry Storms:** No exponential backoff or automated retry loop on failure.
- **Zero Event Churn:** Does not re-trigger on directory changes (`host.onDirectory`) or session changes (`host.onSession`).

#### 2. Observable Error Classification & UI Presentation
The caller handles all potential outcomes cleanly, reusing the existing `#boardBanner` markup and `showBanner` / `hideBanner` helpers (`panel/main.ts:497-526`, `panel/index.html:3580-3583`):

```typescript
async function checkBackgroundServiceConnection(): Promise<void> {
  try {
    const res = await host.serviceRequest({ method: 'GET', path: '/health' });
    if (res && res.status === 200) {
      // Outcome 1: Connected (Healthy)
      hideBanner();
      console.info('[TaskBoard] Background coordinator service connected (healthy).');
    } else {
      // Non-200 response from loopback server
      showBanner('Background coordinator service returned an unexpected status.');
      console.warn('[TaskBoard] Background coordinator service returned HTTP status:', res?.status);
    }
  } catch (err: unknown) {
    const code = (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string')
      ? (err as any).code
      : 'UNKNOWN';

    if (code === 'NO_SERVICE' || code === 'DISABLED') {
      // Outcome 2: Capability unapproved or extension disabled
      showBanner('Background coordinator service is not enabled in OpenChamber Settings → Extensions.');
      console.info('[TaskBoard] Background coordinator service not enabled in Settings → Extensions.');
    } else {
      // Outcome 3: Service failed, request failed, host timeout, or crash
      showBanner('Background coordinator service failed to connect.');
      console.warn('[TaskBoard] Background coordinator service connection failed (' + code + ').');
    }
  }
}
```

#### 3. Presentation Invariants
- **UI Never Claims Success on Failure:** If `serviceRequest` throws or returns non-200, the board banner displays observable feedback. It never displays a green "Connected" badge or suppresses the failure.
- **No Prompt Loops / No Auto-Grants:** If `code === 'NO_SERVICE'`, the banner simply advises the user to check Settings → Extensions. It does not display an intrusive modal or attempt to mutate settings.
- **Sanitized Logging:** Console logs receive fixed informational strings with sanitized error codes. Raw `Error` objects (which may contain process paths or stack traces) and bearer tokens are never passed to `console.log`.

---

### 3.3 Public API Preservation & Module Guard
1. **`CoordinatorService` Signature (`service/main.ts`):** Retains 100% API compatibility:
   - `getConfig(): CoordinatorConfig`
   - `getStatus(): CoordinatorStatus`
   - `getLeaseStore(): LeaseStore`
   - `getOwnerId(): string`
   - `acquireLease(repo, issueNumber, bodySha, phase, ttlMs?): Promise<ClaimResult>`
   - `start(): Promise<void>`
   - `stop(): Promise<void>`
   - `reconcileOnce(): Promise<void>`
2. **Direct Execution Guard:**
   ```typescript
   if (process.argv[1] && import.meta.url && process.argv[1] === fileURLToPath(import.meta.url)) {
     // Direct execution by host runner or CLI fixture: validate config and start HTTP server + coordinator
     startHostServiceServer();
   }
   ```
   *Invariant:* Importing `service/main.ts` in test suites or unit fixtures does not bind sockets, start timers, or invoke `process.exit`.

---

## 4. Security & Protocol Invariants

| Invariant | Threat Vector | Mitigation Strategy | Proof Method |
|---|---|---|---|
| **Loopback Isolation** | Network exposure / port sniffing | Bind strictly to `127.0.0.1:${port}`; reject `0.0.0.0`. | Assert server address is `127.0.0.1` and fails external dial. |
| **Constant-Time Auth** | Secret extraction via timing attack | SHA-256 fixed-digest hashing prior to `crypto.timingSafeEqual`. | Assert rejection of invalid/short/long tokens; test zero `RangeError` on length mismatch. |
| **Zero Token Leakage** | Log inspection / accidental exposure | Token omitted from logs, errors, stderr, argv, query strings, and responses. | Assert sanitized console logs during startup and request handling. |
| **No Route Traversal / RPC**| Internal endpoint exploitation | Strict allowlist: `GET /health` only. 404/405 for all others. | Probe `/status`, `/unknown`, `POST /health` -> HTTP 404/405. |
| **Least Privilege** | State / PID disclosure | Eliminate `/status`; return minimal `{"status":"ok","service":"task-coordinator"}`. | Audit response body: 0 occurrences of `ownerId`, `activeLeases`, or PIDs. |
| **DoS / Memory Exhaustion**| Unbounded body buffering | 64KB maximum body limit; 15-second socket timeout. | Probe oversized payload -> socket destroyed / 413. |
| **Single-Writer Safety** | Lease clobbering / cross-owner release | Shutdown only releases leases where `entry.ownerId === this.ownerId`. | Seed multi-owner `leases.json`; verify foreign leases survive `SIGTERM`. |
| **Fail-Fast Configuration**| Host 15-second hang on bad config | Strict regex `/^[0-9]+$/` (1..65535) and non-empty token check; exit 1 immediately. | Spawn with `3000abc` or missing token -> exit code 1 in <100ms. |

---

## 5. Owned Paths & Collision Graph (#50 vs #51)

### Planned Owned Paths for Issue #50
- `service/main.ts` (HTTP server adapter, direct-run guard, endpoints, lifecycle)
- `service/config.ts` (Strict port and token validation functions)
- `service/types.ts` (Health response types and server config interfaces)
- `panel/main.ts` (Caller probe in `host.onReady`, observable banner handling)
- `test/service-host-connection.test.js` (Built-artifact host contract test suite)
- `test/panel-service-connection.test.js` (Panel caller test suite with stubbed bridge)
- `service/main.js` (Rebuilt service bundle via `npm run build:service`)
- `panel/main.js` (Rebuilt panel bundle via `npm run build:panel`)

### Planned Owned Paths for Issue #51
- `panel/index.html` (CSS styling for `#selectSort`, `#txtRepoLabel`, `#btnViewSelect`)
- `panel/main.ts` (Toolbar element attributes / container classes)
- `test/toolbar-controls.test.js` (DOM / visual verification tests)
- `panel/main.js` (Rebuilt panel bundle via `npm run build:panel`)

### File Collision & Sequencing Invariant
- **Direct Collision:** Both #50 and #51 modify `panel/main.ts` and regenerate `panel/main.js`.
- **Sequencing Mandate:**
  ```
  [Issue #50: Host Connection & Background Service]
                     │
                     ▼ (Merged & verified on branch base)
  [Issue #51: Clear Task Board Toolbar Controls]
  ```
  Issue #51 must strictly follow Issue #50. Developing #51 concurrently risks merge collisions in `panel/main.ts` and bundle corruption in `panel/main.js`.

---

## 6. Verification Plan

### 6.1 Built-Artifact Host Contract Suite (`test/service-host-connection.test.js`)
An automated test suite using Node's native test runner (`node:test`) that spawns the **compiled artifact** (`service/main.js`) in isolated temporary environments:
1. **Valid Readiness Handshake:**
   - Spawns `service/main.js` with ephemeral port and synthetic 24-byte hex token.
   - Probes `GET /health` with `Authorization: Bearer ${token}`.
   - Asserts HTTP 200 OK with body `{"status":"ok","service":"task-coordinator"}` within 500ms.
2. **Timing-Safe Authentication Edge Cases:**
   - Probes `GET /health` with missing Authorization header -> HTTP 401.
   - Probes `GET /health` with invalid Bearer token (wrong length, 1 byte, 100 bytes) -> HTTP 401 without throwing `RangeError`.
   - Probes `GET /health` with malformed header (e.g. `Basic ...`, `Bearer `, `Token ...`) -> HTTP 401.
3. **Route & Method Confinement:**
   - Probes `GET /status` -> HTTP 404.
   - Probes `GET /unknown` -> HTTP 404.
   - Probes `POST /health` -> HTTP 405.
4. **Fast-Fail Configuration Validation:**
   - Spawns with `OPENCHAMBER_SERVICE_PORT=3000abc` -> process exits with code 1 in <100ms; stderr contains sanitized port error.
   - Spawns with `OPENCHAMBER_SERVICE_PORT=99999` -> process exits with code 1 in <100ms.
   - Spawns with missing `OPENCHAMBER_SERVICE_TOKEN` -> process exits with code 1 in <100ms.
5. **Graceful Shutdown & Single-Writer Preservation:**
   - Pre-seeds temporary `leases.json` with foreign lease:
     ```json
     {
       "workspaces/test-repo#42": {
         "ownerId": "foreign-coordinator-999",
         "expiresAt": 9999999999999
       }
     }
     ```
   - Starts service, acquires an own lease via coordinator instance.
   - Sends `SIGTERM` to the process; confirms exit with code 0 in <1,500ms.
   - Inspects `leases.json`: Own lease is cleanly released; foreign lease `foreign-coordinator-999` is untouched.

### 6.2 Panel Caller Test Suite (`test/panel-service-connection.test.js`)
An automated test suite verifying the panel caller logic against a stubbed OpenChamber SDK bridge:
1. **Outcome 1 (Connected):**
   - Stubbed `host.serviceRequest` resolves `{ status: 200, body: '{"status":"ok"}' }`.
   - Asserts `#boardBanner` remains hidden (`style.display === 'none'`).
2. **Outcome 2 (Capability Unapproved):**
   - Stubbed `host.serviceRequest` rejects with `new HostRequestError('NO_SERVICE', 'Allow this extension...')`.
   - Asserts `#boardBanner` is visible (`style.display === 'flex'`).
   - Asserts banner text contains `"Settings → Extensions"`.
   - Asserts UI does not display success.
3. **Outcome 3 (Service Failure):**
   - Stubbed `host.serviceRequest` rejects with `new HostRequestError('SERVICE_FAILED', 'Failed to become ready')`.
   - Asserts `#boardBanner` is visible with failure text.
   - Asserts UI does not display success.

### 6.3 Evidence Categorization & Verification Boundaries
Evidence is strictly classified into three explicit categories:
1. **Source Predictions (Host Contract):**
   - Derived by reading `@openchamber/web/server/lib/guests/service.js:134-155, 461-536, 628-689`.
   - Invariant: Host allocates port and 24-byte hex token, polls `GET /health` with Bearer auth, requires HTTP 200 within 15 seconds, and terminates via `SIGTERM` with 5-second kill deadline.
2. **Fixture Observations (Isolated Tests):**
   - Empirically observed by spawning compiled `service/main.js` against ephemeral ports in `/tmp/antigravity/...`.
   - Validates socket binding, SHA-256 timing-safe comparison, route confinement, fast stderr exit, and lease preservation.
3. **Real-Host Verification (Parent Web UI Boundary):**
   - The OpenChamber parent web interface on port 3000 is protected by `#openchamber-ui-password`.
   - Secrets wall prohibits extracting or bypassing host passwords.
   - Genuine end-to-end integration inside an authenticated parent OpenChamber iframe remains unverified and awaits human-authenticated review (L5).

### 6.4 Remote Mutation Safety Analysis (`StatusReconciler`)
- Source inspection of `panel/labels.ts:633-721` and `panel/main.ts:1654, 3190-3196` confirms that `StatusReconciler.schedule` runs upon issue fetch.
- For issues with active OpenChamber sessions whose liveness differs from GitHub status labels (e.g. running session on a task labelled `status:todo`), `StatusReconciler.reconcile` calls `updateIssueStatus`, issuing live remote `PATCH /repos/:repo/issues/:number` mutations to GitHub.
- **Safety Directive:** Live end-to-end testing against real production repositories must remain strictly prohibited. Automated test suites and contract verifications must use synthetic mock stores, stubbed SDK bridges, and isolated loopback fixtures.

### 6.5 Full Test & Build Parity
1. `npm run build` (esbuild bundles both `service/main.js` and `panel/main.js`).
2. `node --test test/shipped-parity.test.js` (all 18 baseline tests pass).
3. `npm run typecheck` (0 TypeScript errors).
4. `node --test test/*.test.js` (all existing tests pass without regressions).

---

## 7. Product Decision D59 Integration & Start Policy Rationale

### 7.1 Decision Record D59
- **Decision Date:** 2026-11-01
- **User Choice:** "Connect when board opens (Recommended)"
- **Policy Contract:**
  When the board panel opens, it requests the background service's authenticated `GET /health` through the existing host `serviceRequest` bridge — **ONLY** if the capability is already granted in OpenChamber settings. It never auto-grants and never prompt-loops. Connection failures are reported to the user with sanitized, observable feedback (distinguishing capability disabled/denied from real service/request failure), never silently swallowed, and never displayed as success. No new toolbar button is added. No agent/task starts, no label writes, and no GitHub calls originate from this path. Starting the service runs only its existing local expired-lock pruning; this is honestly documented as a runtime change, not a "read-only request".

### 7.2 Retirement of Revision 1 Options
- **Option A (Original R1):** Required silent catch and proposed speculative `/status` endpoint. *Retired.* Replaced by D59 with observable notice and `/health` only.
- **Option B (Toolbar Toggle / Setting):** Introduces unnecessary settings complexity and toolbar clutter. *Rejected.*
- **Option C (Diagnostics-Only Drawer):** Leaves the service dormant during ordinary board use. *Rejected.*

---

## 8. Doubt-Driven Self-Hostile Critique

Before implementing this plan, it was subjected to skeptical, doubt-driven critique across six critical dimensions:

1. **False Success Trap ("200 on /health is enough"):**
   - *Challenge:* If `/health` returns 200 in an isolated test fixture, does that guarantee the extension functions in OpenChamber?
   - *Defense:* No. In OpenChamber, services are spawned on-demand exclusively when `serviceRequest` is called. A service that passes `/health` but has no caller will never be spawned in production. The plan explicitly pairs the `/health` HTTP adapter with the D59 board-open caller in `panel/main.ts`. Furthermore, the panel caller distinguishes HTTP 200 from errors and never claims success on failure.
2. **Module Import Side-Effects:**
   - *Challenge:* Could importing `service/main.ts` or `service/config.ts` in existing test suites trigger unexpected port binding, timers, or unhandled promise rejections?
   - *Defense:* Server binding and coordinator initialization are strictly guarded behind `process.argv[1] && import.meta.url && process.argv[1] === fileURLToPath(import.meta.url)`. Config validation only calls `process.exit(1)` when run directly. Unit test imports will not trigger direct-run execution.
3. **Bearer Token & Credential Exposure:**
   - *Challenge:* Can `OPENCHAMBER_SERVICE_TOKEN` leak to stdout, stderr, process lists, or HTTP errors?
   - *Defense:* Stderr on startup configuration error outputs fixed, generic error messages without echoing variable values. The HTTP server strips Authorization headers before logging and never reflects tokens in HTTP responses. Bearer tokens are omitted from URL query parameters and process arguments.
4. **Error-Path Observability vs Silent Swallowing:**
   - *Challenge:* Does the caller hide connection problems behind generic try/catch blocks or leave the user unaware of broken background processes?
   - *Defense:* Silent try/catch is strictly banned. The caller inspects `err.code` from `HostRequestError`. Capability unapproved (`NO_SERVICE`, `DISABLED`) triggers informative settings guidance via `#boardBanner`; transport or startup failures (`SERVICE_FAILED`, `REQUEST_FAILED`, `HOST_TIMEOUT`) trigger observable warning banners. UI copy never claims success on failure.
5. **D59 Drift (No Polling, No Auto-Grant, No Remote Writes):**
   - *Challenge:* Could an eager developer turn the connection check into a polling loop, prompt loop, or trigger background task runs?
   - *Defense:* The caller runs exactly once inside `host.onReady`. No `setInterval`, no reconnection timers, no settings mutation calls, and no GitHub API calls are attached to the connection check.
6. **Lifecycle & Pruning Honesty:**
   - *Challenge:* Does the plan present the coordinator as an autonomous task runner or background agent?
   - *Defense:* The plan explicitly clarifies that `CoordinatorService` currently only performs local expired-lease pruning (`reconcileOnce` calling `leaseStore.pruneExpired()`). Spawning the service starts this pruning timer as a runtime change, but does not claim or perform autonomous task dispatching.
