# Empirical Proof & Host Contract Verification: Issue #50 Plan Review

**Review Date:** Fri Oct 30 2026  
**Reviewer:** Model `9router/engineer`  
**Repository:** `openchamber-github-task-board`  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection`  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Review Verdicts

- **Spec Verdict:** `PARTIAL`
- **Quality Verdict:** `NEEDS-FIXES`

---

## 2. Host Guest Service Contract Verification (Source Grounding)

Direct audit of OpenChamber host runner source (`/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js`) and SDK definitions (`@openchamber/sdk`) establishes the immutable host contract:

| Contract Dimension | Source Anchor | Host Mechanism & Invariant | Plan Alignment Status |
|---|---|---|---|
| **Spawning Mechanism** | `service.js:576-592, 622-684` | Lazy, on-demand spawning triggered exclusively via `openGuestServiceRequest` / `proxyGuestServiceRequest`. Calling `serviceStatus` returns `'stopped'` without spawning. | **Verified.** Planner correctly identified that without a caller, service is never spawned. |
| **Capability Grant** | `service.js:665-667`, `GUEST_SERVICES.md:27, 93` | Host checks `granted.includes('service')`. Refuses with `NO_SERVICE` if user has not approved capability in Settings → Extensions. | **Defective in Plan.** Planner hid this with silent `try/catch` instead of observable capability status. |
| **Port & Token Injection** | `service.js:461-475` | Host allocates loopback port via `reserveLoopbackPort()` and 24-byte hex token via `crypto.randomBytes(24).toString('hex')`. Injects `OPENCHAMBER_SERVICE_PORT`, `OPENCHAMBER_SERVICE_TOKEN`, `ELECTRON_RUN_AS_NODE: '1'`. | **Verified.** Server must read these exact keys. |
| **Readiness Handshake** | `service.js:134-155` (`waitForServiceReady`) | Polls `GET http://127.0.0.1:${port}/health` with `Authorization: Bearer ${token}` and `Accept: application/json` every 200ms (1,500ms timeout per probe) up to 15,000ms deadline. Expects HTTP 200. | **Verified.** Endpoint must respond HTTP 200 on `/health` with Bearer auth. |
| **Readiness Failure** | `service.js:525-535` | If `/health` fails or exits within 15s, collects process stdout/stderr snapshot and throws `GuestServiceError(..., 'SERVICE_FAILED')`. | **Verified.** Service must fail fast (exit non-zero immediately) on bad port/token rather than hanging. |
| **Request Proxying** | `service.js:692-753` | Proxies any valid path (`/health`, `/status`) with `Authorization: Bearer ${runtime.token}`. Body bounded by 8MB (`GUEST_REQUEST_RESPONSE_MAX`). | **Verified.** Host proxy forwards path verbatim to loopback server. |
| **Process Lifecycle** | `service.js:314-347, 494` | Host tracks PID in `service-registry.js`. On extension stop or host shutdown, sends `SIGTERM`, waits 5,000ms, then `SIGKILL`. | **Verified.** Service must handle `SIGTERM` cleanly, stop timer, release held leases, and exit 0. |

---

## 3. Empirical Security & Protocol Verification

### 3.1 Constant-Time Bearer Authentication
In Node.js, `crypto.timingSafeEqual(bufA, bufB)` throws `RangeError: Input buffers must have the same length` when byte lengths differ. PLAN.md proposed a vague "dummy constant-time check" when lengths differ.

Empirical test of the robust cryptographic mitigation:
```javascript
const expectedHash = crypto.createHash('sha256').update(expectedToken).digest();
const receivedHash = crypto.createHash('sha256').update(receivedToken).digest();
const authenticated = crypto.timingSafeEqual(expectedHash, receivedHash);
```
- Both SHA-256 digests are strictly 32 bytes (`Buffer.byteLength === 32`).
- `timingSafeEqual` executes in constant time for all inputs (empty string, short token, long token, correct token).
- Zero `RangeError` exceptions; zero length-leakage side channels.

### 3.2 Endpoint Confinement & Route Minimization
- Audit of `panel/main.ts` confirms **0 occurrences** of `activeLeases` or `ownerId`.
- Exposing `ownerId` (`coordinator-${pid}-${timestamp}-${rand}`) in `GET /status` leaks process internals.
- Verification confirms that `host.serviceRequest({ method: 'GET', path: '/health' })` executes through OpenChamber's proxy identically to any other path, providing complete round-trip proof without information disclosure.

---

## 4. Worktree Integrity & Test Baseline

The current branch remains completely clean with zero product code modifications:
- `test/stage2b-pilot-coordinator.test.js`: 53/53 tests pass (`node --test test/stage2b-pilot-coordinator.test.js`).
- `test/shipped-parity.test.js`: 18/18 tests pass (`node --test test/shipped-parity.test.js`).
- Preflight invariants preserved: No `/workspace/.openchamber-data/**` touched, no synthetic bearer secrets printed, no production GitHub mutations invoked.
