# Empirical Proof & Verification Report: Issue #50

**Audit Date:** Fri Oct 30 2026  
**Auditor:** Model `9router/engineer`  
**Repository:** `openchamber-github-task-board`  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection`  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Capability Verification Matrix

| Layer / Capability | Prior Audit Claim | Empirical Discovery | Root Cause & Evidence | Planned #50 Resolution |
|---|---|---|---|---|
| **Built Service Entry** | Spawns as child | `service/main.js` starts internal timer only | Lines 202–227 direct entry calls `CoordinatorService.start()`; no HTTP server. | Introduce lightweight stdlib HTTP server on `OPENCHAMBER_SERVICE_PORT`. |
| **Readiness Probe (`GET /health`)** | Believed working | Fails with `ECONNREFUSED` | No listener bound on loopback port. Probe times out after 15,000ms -> `SERVICE_FAILED`. | Add `/health` endpoint returning HTTP 200 with timing-safe Bearer auth. |
| **Inbound Auth** | Assumed present | Missing | `OPENCHAMBER_SERVICE_TOKEN` environment variable is completely ignored. | Implement `crypto.timingSafeEqual` Bearer check on all routes. |
| **Panel Service Caller** | Assumed active | Completely absent | 0 calls to `serviceRequest` across `panel/main.ts` and `panel/main.js`. Service never spawns. | Add read-only `host.serviceRequest({ method: 'GET', path: '/status' })` in `host.onReady`. |
| **Graceful Shutdown** | Unknown | Works for internal timer, missing HTTP | `SIGTERM` terminates timer and releases leases, but no server to close. | Close HTTP server on `SIGTERM`, release own leases, preserve other owners. |
| **Single-Writer Safety** | Verified in tests | Invariant holds in unit tests | `releaseHeldLeases` filters by `ownerId`. Other owners' leases survive. | Retain invariant in host-contract fixture tests. |
| **Live Remote Mutation Safety** | Not addressed | High Risk | `StatusReconciler` triggers `PATCH .../labels` on snapshot mismatch. Live testing unsafe. | Prohibit live production task mutation; verify via synthetic fixtures. |

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

## 3. Remote Mutation Safety Analysis (`StatusReconciler`)

Inspection of `panel/labels.ts:633-721` and `panel/main.ts:3190-3196`:
- `StatusReconciler` schedules reconciliation whenever issue snapshots or session updates arrive.
- When an issue with an active session exhibits a state mismatch (e.g., active session on a task labelled `status:todo`), it immediately invokes `updateStatus`, which calls `updateIssueStatus` (`panel/main.ts:2704`).
- `updateIssueStatus` issues a remote GitHub API call: `PATCH /repos/:owner/:repo/issues/:number/labels`.
- Because this extension lacks a dry-run flag for live GitHub APIs, mounting the panel against a production repository with real sessions will trigger automated label modifications.
- **Verification Rule:** Automated tests and contract proofs must operate exclusively on mocked SDK responses and isolated loopback fixtures. Zero live repository modifications were performed.

---

## 4. Security & Isolation Invariants

1. **Loopback Only:** The planned server binds strictly to `127.0.0.1`. Binding to `0.0.0.0` or external addresses is forbidden.
2. **Timing-Safe Auth:** `crypto.timingSafeEqual` prevents timing-based extraction of `OPENCHAMBER_SERVICE_TOKEN`.
3. **No Secret Ingestion:** The service inherits only the standard host allowlist (`PATH`, `HOME`, temp dir). No API tokens or passwords from `/workspace/.openchamber-data/**` or `.env*` are accessed.
4. **Boundary Honesty:** Fixture proof demonstrates that the built Node service conforms to OpenChamber's loopback HTTP protocol. It does not certify that the full OpenChamber Web UI on port 3000 is authenticated or visually mounted, as the production parent UI is protected by `#openchamber-ui-password`.
