# Review Findings & Contract Ruling: Issue #50 (Reliable Host Connection)

**Review Date:** Fri Oct 30 2026  
**Auditor:** Model `9router/engineer`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Branch:** `fix/issue-50-host-connection`  

---

## 1. Formal Verdicts

- **Spec Verdict:** `PARTIAL`  
  *Rationale:* The plan identifies the underlying host contract requirements (port, token, `/health`, `SIGTERM`), but unilaterally resolves an unapproved product decision (automatic mount caller), proposes speculative endpoints leaking coordinator internals (`GET /status`), and specifies silent error swallowing that obscures broken host connections.
- **Quality Verdict:** `NEEDS-FIXES`  
  *Rationale:* Critical cryptographic flaw in proposed buffer comparison (`RangeError` on length mismatch), lack of observability on service failures, and missing fail-fast validation for startup configuration block unconditional approval.

---

## 2. Itemized Findings & Corrections

### Finding 1: Unapproved Start-Policy Product Fork (Scope Overreach)
- **Anchors:** `PLAN.md` Section 6 ("User Product Fork") & Section 2.2; `@openchamber/web/server/lib/guests/service.js:608-684` (`openGuestServiceRequest`); `outputs/extension-repairs-approval.md` (Decision D58).
- **Impact:** OpenChamber services are on-demand processes spawned only upon `serviceRequest`. Declaring `contributes.service` requires explicit user permission in Settings → Extensions (`service.js:665-667`). In current code, `CoordinatorService` only prunes expired local leases (`reconcileOnce` calling `leaseStore.pruneExpired()`). Unconditionally firing `serviceRequest` on panel mount spawns a background Node process that runs indefinitely on the user's host without explicit user action or active task execution.
- **Smallest Correction:** Reject planner's unilateral recommendation of Option A. Decouple backend service readiness from frontend caller policy. Return a conditional contract for the builder brief:
  - **Backend Service:** Implement the complete host HTTP server and lifecycle listeners in `service/main.ts` unconditionally.
  - **Caller Product Fork (Requires User/Manager Choice):**
    - *Fork 1 (Explicit Action):* Trigger `serviceRequest` only via an explicit user diagnostic action (e.g. "Check Service" button).
    - *Fork 2 (Passive Mount Probe):* Trigger `serviceRequest` in `panel/main.ts` on mount, but cleanly handle capability errors and report state without silent swallowing.

### Finding 2: Speculative Information Disclosure in `GET /status`
- **Anchors:** `PLAN.md` Section 2.1 (Endpoints) & Section 2.2; `panel/main.ts` (0 matches for `activeLeases` or `ownerId`); `@openchamber/web/server/lib/guests/service.js:692-753`.
- **Impact:** PLAN.md introduced `GET /status` returning internal coordinator state: `ownerId` (`coordinator-${pid}-...`) and `activeLeases`. The task board panel does not display or consume either field. Exposing process IDs and lease internals over HTTP creates unnecessary attack surface and departs from minimal requirements.
- **Smallest Correction:** Restrict the service HTTP interface strictly to `GET /health` returning `{"status":"ok","service":"task-coordinator"}`. OpenChamber's host proxy routes `host.serviceRequest({ method: 'GET', path: '/health' })` seamlessly. If status metadata is mandated in the future, return only `{"status":"ok","coordinatorStatus":"running"}` without PIDs or lease details.

### Finding 3: Silent Failure Handling in Panel Caller Hides Broken Connections
- **Anchors:** `PLAN.md` Section 2.2 ("Resilience & Fault Tolerance"); `@openchamber/sdk/dist/contract.d.ts:400` (`HOST_REQUEST_ERROR_CODES`).
- **Impact:** PLAN.md specifies wrapping `serviceRequest` in a "silent try/catch that gracefully treats NO_SERVICE / unapproved states as inactive without interrupting panel functionality." Swallowing errors unconditionally hides genuine runtime failures (`SERVICE_FAILED`, `REQUEST_FAILED`, timeout, port conflict). If the service crashes or fails to bind, the failure is invisible to users, developers, and automated tests.
- **Smallest Correction:** Implement observable failure handling:
  - If error code is `NO_SERVICE` or `DISABLED`: Log informational notice (`console.info('[TaskBoard] Background coordinator service not enabled in Settings → Extensions.')`) and record service state as `unapproved`.
  - If error code is `SERVICE_FAILED`, `REQUEST_FAILED`, `HOST_TIMEOUT`, or unexpected: Log explicit diagnostic warning (`console.warn('[TaskBoard] Background service connection failed:', err)`) and record service state as `failed`. Never silently discard failures.

### Finding 4: Cryptographic Insecurity in Bearer Token Comparison
- **Anchors:** `PLAN.md` Section 2.1 (Inbound Bearer Auth, item 3); Node.js documentation for `crypto.timingSafeEqual`.
- **Impact:** PLAN.md specifies: "When byte lengths differ, authentication fails immediately while performing a dummy constant-time check to prevent timing side channels." In Node.js, `crypto.timingSafeEqual` throws `RangeError` if buffer lengths differ. Vague "dummy checks" with unequal buffers leak length information via timing or crash the request handler.
- **Smallest Correction:** Compute SHA-256 digests of both expected and received tokens before comparison:
  ```typescript
  const expectedHash = crypto.createHash('sha256').update(expectedToken).digest();
  const receivedHash = crypto.createHash('sha256').update(receivedToken).digest();
  const authenticated = crypto.timingSafeEqual(expectedHash, receivedHash);
  ```
  Both digests are guaranteed 32 bytes, guaranteeing constant-time comparison without throwing `RangeError` or leaking token length.

### Finding 5: Incomplete Startup Port and Token Validation
- **Anchors:** `PLAN.md` Section 2.1 ("Configuration Resolution"); `@openchamber/web/server/lib/guests/service.js:525-535`.
- **Impact:** The plan does not specify fail-fast behavior if `OPENCHAMBER_SERVICE_PORT` or `OPENCHAMBER_SERVICE_TOKEN` is missing or invalid. Starting the process without binding a port causes OpenChamber's `waitForServiceReady` to hang for the full 15-second timeout before killing the process.
- **Smallest Correction:** Validate environment variables immediately upon direct execution in `service/main.ts`:
  - `port`: Must parse to an integer `1 <= port <= 65535`.
  - `token`: Must be a non-empty string.
  - If invalid or missing, write a sanitized error message to stderr and call `process.exit(1)` immediately.

### Finding 6: File Collision with Issue #51 Requires Strict Scope Isolation
- **Anchors:** `PLAN.md` Section 4 ("Owned Paths & Collision Graph"); `panel/main.ts`, `panel/main.js`.
- **Impact:** Issue #51 ("Clear task board toolbar controls") modifies `panel/index.html` and `panel/main.ts`. Broad or speculative changes to `panel/main.ts` in #50 risk merge collisions and bundle build churn.
- **Smallest Correction:** Confine builder ownership strictly:
  - Product code: `service/main.ts`, `service/config.ts`, `service/types.ts`.
  - Generated code: `service/main.js` (rebuilt via `npm run build:service`).
  - Tests: `test/service-host-connection.test.js`.
  - Conditional panel code: If the caller fork is approved, limit edits in `panel/main.ts` to minimal helper invocation in `host.onReady` (under 10 lines), followed by `npm run build:panel`. Zero HTML/CSS edits in #50.

---

## 3. Minimal Host-Connection Contract for Builder Brief

1. **Loopback Server (`service/main.ts`):**
   - Bind exclusively to `127.0.0.1:${port}` where `port = parseInt(process.env.OPENCHAMBER_SERVICE_PORT, 10)`.
   - Validate port in range `1..65535` and non-empty `process.env.OPENCHAMBER_SERVICE_TOKEN`; exit non-zero immediately if invalid.
   - Require `Authorization: Bearer <token>` on all requests, verified via SHA-256 hashed `crypto.timingSafeEqual`.
   - Route `GET /health` -> HTTP 200 `{"status":"ok","service":"task-coordinator"}`.
   - All other routes -> 404; non-GET methods -> 405.
   - Socket timeout: 15s; max body limit: 64KB.
2. **Lifecycle & Single-Writer Preservation:**
   - On `SIGTERM` / `SIGINT`: Close HTTP server, await `service.stop()` (cancels timer, releases own leases via `ownerId`), exit code 0.
   - Guard entrypoint behind `process.argv[1] === fileURLToPath(import.meta.url)` to prevent auto-binding on module imports.
3. **Supported Caller (Conditional on Fork Approval):**
   - Call `host.serviceRequest({ method: 'GET', path: '/health' })`.
   - Handle `NO_SERVICE` / `DISABLED` as unapproved (log info); handle `SERVICE_FAILED` / `REQUEST_FAILED` as failed (log warning). No silent swallow.
4. **Isolated Verification Fixture (`test/service-host-connection.test.js`):**
   - Spawn built `service/main.js` with ephemeral port and synthetic token in isolated temp directory.
   - Assert HTTP 200 on `GET /health` with valid Bearer; HTTP 401 on missing/wrong token.
   - Assert graceful `SIGTERM` shutdown with exit code 0 and preservation of external leases in multi-owner file.
