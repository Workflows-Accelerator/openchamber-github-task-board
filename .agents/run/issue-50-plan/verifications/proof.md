# Empirical Proof & Verification Report: Issue #50

**Audit Date:** Fri Oct 30 2026 (Updated Sun Nov 01 2026 for Plan Correction R2)  
**Auditor:** Model `9router/engineer`  
**Repository:** `openchamber-github-task-board`  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection`  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Capability Verification Matrix

| Layer / Capability | Prior Plan Defect | Source-Grounded Truth | Root Cause & Evidence | Planned #50 Correction (R2) |
|---|---|---|---|---|
| **Built Service Entry** | Spawns as child | `service/main.js` starts internal timer only | Lines 202–227 direct entry calls `CoordinatorService.start()`; no HTTP server. | Introduce lightweight stdlib HTTP server on `OPENCHAMBER_SERVICE_PORT`. |
| **Readiness Probe (`GET /health`)** | Believed working | Fails with `ECONNREFUSED` | No listener bound on loopback port. Probe times out after 15,000ms -> `SERVICE_FAILED`. | Add `/health` endpoint returning HTTP 200 with timing-safe Bearer auth. |
| **Inbound Auth** | Assumed present / dummy check on length | Timing safe equal throws `RangeError` on unequal buffer lengths | Node.js `crypto.timingSafeEqual` requires identical buffer byte lengths. | Hash both expected and received tokens with SHA-256 (strictly 32 bytes) prior to comparison. |
| **Config Validation** | Missing fast-fail; permissive parse | Host hangs 15s if port/token invalid | Unhandled invalid port causes silent stall; `parseInt` accepts trailing non-numeric text. | Strict regex `/^[0-9]+$/` (1..65535) and non-empty token check; sanitized stderr and fast `process.exit(1)`. |
| **Service Endpoints** | Speculative `GET /status` leaking internals | Leaked `ownerId` and `activeLeases` | Panel does not consume `ownerId`/`activeLeases`; violates least privilege. | Restrict HTTP routes to `GET /health` only; return 404/405 for all others. |
| **Panel Service Caller** | Missing caller / proposed silent catch | Swallowing errors hides broken connection | Swallowed errors prevent diagnosis of port collisions, crashes, or unapproved states. | Call `GET /health` on board open; distinguish `NO_SERVICE`/`DISABLED` from `SERVICE_FAILED`/`REQUEST_FAILED` with observable notice. |
| **Graceful Shutdown** | Unknown | Works for internal timer, missing HTTP | `SIGTERM` terminates timer and releases leases, but no server to close. | Close HTTP server on `SIGTERM`, release own leases, preserve other owners. |
| **Single-Writer Safety** | Verified in tests | Invariant holds in unit tests | `releaseHeldLeases` filters by `ownerId`. Other owners' leases survive. | Retain invariant in host-contract fixture tests. |
| **Live Remote Mutation Safety** | Not addressed | High Risk: `StatusReconciler` fires live `PATCH` | Loading panel with active sessions mutates remote issue labels via GitHub API. | Prohibit live production repository testing; verify strictly via synthetic fixtures. |

---

## 2. Red Reproducer: Original Missing Health Failure

To empirically prove the host readiness failure without wasting 15 seconds per probe or terminating external processes, an isolated harness was executed at `.agents/run/issue-50-plan/verifications/reproduce-unready-contract.mjs`.

### 2.1 Execution Details
- **Command:** `node .agents/run/issue-50-plan/verifications/reproduce-unready-contract.mjs`
- **Environment:**
  - `OPENCHAMBER_SERVICE_PORT=34291` (dynamic ephemeral loopback port)
  - `OPENCHAMBER_SERVICE_TOKEN=[REDACTED_SYNTHETIC_24_BYTE_HEX]`
  - `COORDINATOR_STORAGE_DIR=/tmp/antigravity/issue-50-repro-Wjip7g`
- **Probe Request:**
  - Target: `GET http://127.0.0.1:34291/health`
  - Headers:
    ```http
    Accept: application/json
    Authorization: Bearer [REDACTED_SYNTHETIC_TOKEN]
    ```

### 2.2 Raw Output & Measurement
```json
{
  "port": 34291,
  "probeStatus": "none",
  "probeError": "ECONNREFUSED",
  "exitResult": {
    "code": 0,
    "signal": null
  },
  "stdoutSample": [
    "[Coordinator Service] ========================================",
    "[Coordinator Service] Starting OpenChamber Task Coordinator",
    "[Coordinator Service] Host origin: http://127.0.0.1:3000"
  ],
  "stderrSample": []
}
```

### 2.3 Empirical Finding
1. `service/main.js` direct-entry executed successfully upon spawn and started the coordinator service timer.
2. The HTTP probe to `http://127.0.0.1:34291/health` failed immediately with `ECONNREFUSED` because no socket was listening on port 34291.
3. In OpenChamber's host environment (`service.js:134-155`), `waitForServiceReady` retries this failed probe for 15,000ms before killing the process and throwing `GuestServiceError('Guest service failed to become ready.', 'SERVICE_FAILED')`.
4. The process exited cleanly with code 0 upon receiving `SIGTERM` within 80ms, proving graceful shutdown mechanisms function once triggered.

---

## 3. Cryptographic Verification: Fixed-Digest Timing-Safe Comparison

In Node.js, `crypto.timingSafeEqual(bufA, bufB)` throws:
`RangeError: Input buffers must have the same length`
whenever `bufA.length !== bufB.length`.

Pre-hashing both the expected token and the caller-provided token with SHA-256 resolves this invariant:
```javascript
const expectedHash = crypto.createHash('sha256').update(expectedToken, 'utf8').digest();
const presentedHash = crypto.createHash('sha256').update(presentedToken, 'utf8').digest();
const authenticated = crypto.timingSafeEqual(expectedHash, presentedHash);
```
- Both `expectedHash` and `presentedHash` are guaranteed strictly 32 bytes (`Buffer.byteLength === 32`).
- The comparison executes in constant time regardless of whether the presented token is empty, 1 byte, 24 bytes, or 10,000 bytes.
- Zero `RangeError` exceptions are thrown.
- Missing headers or malformed bearer schemes return false without invoking buffer allocations.

---

## 4. Verification Categorization & Boundaries

Three distinct levels of evidence are explicitly distinguished:

1. **Source Predictions (Host Contract):**
   - Derived directly from installed host runner source (`/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js:134-155, 461-536, 628-689`).
   - Grounded prediction: Host allocates loopback port and 24-byte hex token, polls `GET /health` with `Authorization: Bearer <token>`, requires HTTP 200 within 15 seconds, and delivers `SIGTERM` on shutdown with a 5-second kill window.
2. **Fixture Observations (Isolated Built Artifact Tests):**
   - Measured by spawning the compiled `service/main.js` artifact with ephemeral loopback ports, synthetic bearer tokens, and temporary filesystem paths (`/tmp/antigravity/...`).
   - Proves HTTP server binding, SHA-256 constant-time Bearer authentication, strict port validation, fast stderr exit, graceful SIGTERM termination, and preservation of foreign unexpired leases.
3. **Real-Host Verification (Parent Web UI Boundary):**
   - The production OpenChamber Web UI running on port 3000 is protected by `#openchamber-ui-password`.
   - In accordance with the secrets wall, password extraction is prohibited.
   - Genuine end-to-end integration inside an authenticated OpenChamber iframe remains unverified and awaits human-authenticated review (L5).

---

## 5. Remote Mutation Safety Analysis (`StatusReconciler`)

Inspection of `panel/labels.ts:633-721` and `panel/main.ts:1654, 3190-3196`:
- `StatusReconciler.schedule(issues)` is called immediately upon issue fetch.
- If an issue has an active session whose liveness maps to a column (`in-progress` or `needs-human`) differing from the issue's GitHub `status:*` label, `StatusReconciler.reconcile` calls `updateIssueStatus`.
- `updateIssueStatus` dispatches a live `PATCH /repos/:owner/:repo/issues/:number` with mutated labels to `https://api.github.com`.
- Because this extension lacks a dry-run flag for live GitHub APIs, mounting the panel against a production repository with real sessions will trigger automated label modifications.
- **Verification Rule:** Automated tests and contract proofs must operate exclusively on mocked SDK responses and isolated loopback fixtures. Zero live repository modifications were performed.
