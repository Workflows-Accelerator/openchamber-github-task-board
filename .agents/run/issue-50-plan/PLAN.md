# Implementation & Verification Plan: Issue #50 (Reliable Host Connection)

**Plan Date:** Fri Oct 30 2026  
**Target Issue:** https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/50  
**Status:** Planned / Prepared (Requires User Approval before Implementation)  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Branch:** `fix/issue-50-host-connection`  

---

## 1. Objective & Non-Goals

### Objective
Provide a minimal, standard-library-only HTTP adapter and a supported read-only panel caller that satisfies the OpenChamber host runner contract (`@openchamber/web/server/lib/guests/service.js:461-536`), enabling the background service to bind `OPENCHAMBER_SERVICE_PORT`, pass `GET /health` Bearer readiness checks within 15 seconds, gracefully terminate on `SIGTERM`, and report read-only coordinator state without expanding the coordinator's existing pruning behavior.

### Non-Goals (Scope Boundary)
- **No Autonomous Task Execution:** The coordinator remains restricted to lock pruning (`reconcileOnce` calling `leaseStore.pruneExpired()`). No automated task claiming, dispatching, or background agent runner loops.
- **No Remote Mutations:** No label modifications, remote GitHub API writes, or issue status mutations.
- **No Service Manifest Removal:** `package.json` retains `openchamber.contributes.service` per decision D58.
- **No External Dependencies:** Uses exclusively Node.js built-ins (`node:http`, `node:crypto`, `node:url`). Zero new npm packages.
- **No Global Host Restarts or Production Activation:** Work remains confined to extension sources and isolated test fixtures.

---

## 2. Architecture & Design

### 2.1 Minimal Stdlib Host Adapter (`CoordinatorHostServer`)
A lightweight HTTP server class implemented in `service/host-adapter.ts` (or integrated directly into `service/main.ts`):
1. **Configuration Resolution:**
   - Reads `OPENCHAMBER_SERVICE_PORT` (must be an integer > 0 and <= 65535).
   - Reads `OPENCHAMBER_SERVICE_TOKEN` (must be a non-empty string, expected 24-byte hex token).
2. **Loopback-Only Binding:**
   - The server binds strictly to `127.0.0.1:${port}`.
   - Refuses binding to `0.0.0.0` or wildcard interfaces.
3. **Inbound Bearer Authentication:**
   - Validates `Authorization: Bearer <token>`.
   - Uses constant-time comparison via `crypto.timingSafeEqual`:
     - Both expected and received tokens are converted to `Buffer.from(token, 'utf8')`.
     - When byte lengths differ, authentication fails immediately while performing a dummy constant-time check to prevent timing side channels.
   - Missing or invalid token yields HTTP 401 Unauthorized (`{"error":"Unauthorized"}`).
   - Tokens are never printed to console logs, error messages, or response bodies.
4. **Endpoints:**
   - `GET /health`:
     - Mandatory readiness probe for `waitForServiceReady`.
     - Answers HTTP 200 OK: `{"status":"ok","service":"task-coordinator"}`.
   - `GET /status`:
     - Supported read-only query for the panel frontend.
     - Answers HTTP 200 OK:
       ```json
       {
         "status": "ok",
         "service": "task-coordinator",
         "coordinatorStatus": "running",
         "ownerId": "coordinator-...",
         "activeLeases": 0
       }
       ```
   - All other routes or methods:
     - Return HTTP 404 Not Found (`{"error":"Not Found"}`) or HTTP 405 Method Not Allowed (`{"error":"Method Not Allowed"}`).
5. **Request & Body Protection:**
   - Rejects or destroys requests with payloads exceeding 64KB (protection against memory exhaustion).
   - Enforces socket timeouts (15 seconds) to prevent hanging connections.
6. **Graceful Lifecycle & Shutdown:**
   - Listens for `SIGTERM` and `SIGINT`.
   - On signal:
     1. Stops accepting new HTTP connections (`server.close()`).
     2. Calls `coordinatorService.stop()`, clearing the reconciliation timer and invoking `releaseHeldLeases()`.
     3. Preserves other owners' leases in `LeaseStore` (single-writer safety).
     4. Exits cleanly with code 0.

### 2.2 Supported Read-Only Caller (`panel/main.ts`)
To make the background service reachable in production, the panel requires a supported caller:
1. **Mechanism:**
   - Under `host.onReady`, invokes:
     ```typescript
     const res = await host.serviceRequest({ method: 'GET', path: '/status' });
     ```
   - OpenChamber's host runner intercepts `serviceRequest`, spawns `service/main.js` on-demand if not already running, verifies `GET /health` with Bearer auth, and proxies the `/status` request to loopback.
2. **Resilience & Fault Tolerance:**
   - Catches all rejections (`NO_SERVICE`, `DISABLED`, `SERVICE_FAILED`, `REQUEST_FAILED`).
   - If the user has not approved the service capability in Settings → Extensions, the panel catches `NO_SERVICE` cleanly and logs a quiet diagnostic message (`[TaskBoard] Background coordinator service not enabled by user.`).
   - The panel UI continues operating normally; frontend functionality is not blocked by service state.

### 2.3 Public API Preservation
- `CoordinatorService` in `service/main.ts` maintains its existing class signature:
  - `getConfig(): CoordinatorConfig`
  - `getStatus(): CoordinatorStatus`
  - `getLeaseStore(): LeaseStore`
  - `getOwnerId(): string`
  - `acquireLease(repo, issueNumber, bodySha, phase, ttlMs?): Promise<ClaimResult>`
  - `start(): Promise<void>`
  - `stop(): Promise<void>`
  - `reconcileOnce(): Promise<void>`
- Direct execution condition (`process.argv[1] === fileURLToPath(import.meta.url)`) starts both the coordinator and the host adapter when run by Node as an entry point. When imported by tests, the server does not auto-bind.
- Preserves 100% backward compatibility for existing 595 root tests and `test/stage2b-pilot-coordinator.test.js`.

---

## 3. Security Invariants & Proof Matrix

| Invariant | Threat Vector | Mitigation Strategy | Proof Method |
|---|---|---|---|
| **Loopback Isolation** | Network exposure | Bind explicitly to `127.0.0.1`; reject `0.0.0.0`. | Assert server address is `127.0.0.1` and fails external dial. |
| **Timing-Safe Auth** | Secret extraction via timing attack | `crypto.timingSafeEqual` on UTF-8 buffers. | Assert rejection of invalid/short/long tokens; benchmark timing variance. |
| **Zero Token Leakage** | Log inspection / accidental exposure | Token omitted from logs, errors, query strings, and responses. | Assert sanitized console logs during startup and request handling. |
| **No CORS Bypass** | Web-based cross-origin port dialing | No `Access-Control-Allow-Origin: *` wildcard. | Assert absence of permissive CORS headers on responses. |
| **Route Confinement** | Path traversal or unexpected RPC | Strict routing allowlist: only `/health` and `/status`. | Probe `/unknown`, `/etc/passwd`, `POST /health` -> 404/405. |
| **DoS / Payload Limiting** | Memory exhaustion via large request | 64KB max request body limit; 15s socket timeout. | Send oversized payload chunk -> socket destroyed. |
| **Single-Writer Safety** | Lease clobbering / cross-owner release | Shutdown only releases leases matching instance `ownerId`. | Seed multi-owner lease file; verify only own leases removed. |

---

## 4. Owned Paths & Collision Graph (#50 vs #51)

### Planned Owned Paths for Issue #50
- `service/main.ts` (Host HTTP adapter, lifecycle listeners, endpoints)
- `service/config.ts` (Parse port and token environment variables)
- `service/types.ts` (Service response types and server options)
- `panel/main.ts` (Read-only service status caller in `host.onReady`)
- `test/service-host-connection.test.js` (Isolated host-contract test suite)
- `service/main.js` (Rebuilt bundle)
- `panel/main.js` (Rebuilt bundle)

### Planned Owned Paths for Issue #51
- `panel/index.html` (CSS adjustments for `#selectSort`, `#txtRepoLabel`, `#btnViewSelect`)
- `panel/main.ts` (Toolbar element attributes / container classes)
- `test/toolbar-controls.test.js` (DOM / visual verification tests)
- `panel/main.js` (Rebuilt bundle)

### File Collision Analysis
- **Direct Collision:** Both #50 and #51 modify `panel/main.ts` and require rebuilding `panel/main.js`.
- **Sequencing Mandate:**
  ```
  [Issue #50: Host Connection & Background Service]
                     │
                     ▼ (Merged to base)
  [Issue #51: Toolbar Controls Styling (#selectSort, #txtRepoLabel, #btnViewSelect)]
  ```
  Issue #51 must strictly follow Issue #50 to avoid concurrent git conflicts in `panel/main.ts` and bundle corruption.

---

## 5. Verification Plan

### 5.1 Isolated Host-Contract Test Fixture (`test/service-host-connection.test.js`)
An automated test suite using `node:test` that models OpenChamber's host runner:
1. **Lifecycle & Readiness:**
   - Spawns built `service/main.js` with dynamic loopback port and synthetic token in a temporary directory (`/tmp/antigravity/service-fixture-*`).
   - Polls `GET /health` with Bearer auth; confirms HTTP 200 within 500ms.
2. **Authentication Security:**
   - Probes `GET /health` without Authorization header -> HTTP 401.
   - Probes `GET /health` with wrong token -> HTTP 401.
   - Probes `GET /health` with malformed Bearer prefix -> HTTP 401.
3. **Supported Read-Only Caller:**
   - Probes `GET /status` with valid token -> HTTP 200 with status, ownerId, and activeLeases count.
   - Probes unknown path `GET /unsupported` -> HTTP 404.
4. **Shutdown & Single-Writer Preservation:**
   - Pre-seeds `leases.json` with an external owner's lease (`other-owner-123`) and acquires an own lease.
   - Sends `SIGTERM` to child process; confirms clean exit with code 0 in <1,500ms.
   - Inspects `leases.json`: Own lease is cleanly released; foreign lease is untouched.
5. **No Lingering Processes:**
   - Asserts process is dead and loopback port is freed.

### 5.2 Build Parity & Existing Test Suite
- Run `npm run build` to verify clean esbuild bundling of both `service/main.js` and `panel/main.js`.
- Run `node --test test/shipped-parity.test.js` (18 baseline tests pass).
- Run `npm run typecheck` (0 TypeScript errors).
- Run `node --test test/*.test.js` (all 595 tests pass).

---

## 6. User Product Fork (Caller / Start Policy Decision)

While decision D58 approved preparing background service startup/shutdown, the product policy for when the panel calls `serviceRequest` presents three architectural options:

1. **Option A: Automatic Probe on Panel Mount (Recommended)**
   - When the panel loads (`host.onReady`), it executes `host.serviceRequest({ method: 'GET', path: '/status' })`.
   - *Pros:* Automatically starts the coordinator service on-demand without extra user interaction; background lease pruning operates while the panel is active.
   - *Cons:* Spawns the service even if the user only intends a brief view of the board.
2. **Option B: Explicit User Opt-In Setting**
   - The panel adds an extension setting (`enableBackgroundCoordinator: boolean`) or a toggle button in the toolbar.
   - *Pros:* Complete user control; keeps the service dormant unless opted in.
   - *Cons:* Requires additional UI elements and documentation; leases are not pruned unless the user knows to toggle it.
3. **Option C: Diagnostics-Only Probe**
   - The panel only calls `serviceRequest` when the user opens a diagnostics drawer or clicks an explicit "Check Service" button.
   - *Pros:* Minimal runtime impact.
   - *Cons:* Service is rarely running; does not provide reliable background connection.

*Recommendation:* Proceed with **Option A**, wrapped in a silent `try/catch` that gracefully treats `NO_SERVICE` / unapproved states as inactive without interrupting panel functionality.

---

## 7. Doubt-Driven Self-Hostile Critique

1. **False Success Trap ("200 on /health is enough"):**
   - *Challenge:* If the service responds 200 on `/health` but the panel never calls `serviceRequest`, the service is never spawned in production because OpenChamber spawns services exclusively on-demand.
   - *Defense:* The plan explicitly pairs the `/health` adapter with a supported `/status` caller in `panel/main.ts`.
2. **Module Import Side-Effects:**
   - *Challenge:* If importing `service/main.ts` in test suites triggers port binding, existing unit tests will fail due to port collisions or unhandled promises.
   - *Defense:* Server initialization is strictly guarded behind `process.argv[1] === fileURLToPath(import.meta.url)` and requires explicit `OPENCHAMBER_SERVICE_PORT`.
3. **Bearer Token Leakage:**
   - *Challenge:* Printing requests or errors with headers can leak `OPENCHAMBER_SERVICE_TOKEN` to stdout, which OpenChamber captures in process snapshots.
   - *Defense:* The adapter explicitly strips Authorization headers before logging and never reflects tokens in HTTP responses.
4. **Single-Writer Corruption:**
   - *Challenge:* A buggy shutdown handler could wipe all leases in `leases.json`, deleting work claimed by other coordinators.
   - *Defense:* `releaseHeldLeases` filters strictly by `entry.ownerId === this.ownerId`, verified by an adversarial multi-owner test.
5. **Simulated Host vs Real Host Parent:**
   - *Challenge:* Passing tests in a standalone Node fixture does not prove the panel works inside an authenticated OpenChamber iframe.
   - *Defense:* The boundary is clearly documented: the fixture proves host-runner contract compliance; live parent verification requires human L5 credentials.
