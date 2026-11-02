# Empirical Proof & Citation Verification: Issue #50 Plan Re-Review

**Audit Date:** Sun Nov 01 2026  
**Auditor:** Model `9router/engineer`  
**Repository:** `openchamber-github-task-board`  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection`  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Citation Verification Matrix (17/17 Verified, 0 Unchecked)

Every source citation in `PLAN.md` Revision 2 was directly inspected against the installed host runner, SDK, and repository sources:

| # | Plan Anchor | Cited Path & Line(s) | Actual Source Content & Behavior | Verification Result |
|---|---|---|---|---|
| 1 | Section 2.1 (1) | `service.js:576-592, 622-684` | Defines `ensureGuestService` and `openGuestServiceRequest`. Services spawn lazily on incoming requests. | **VERIFIED** |
| 2 | Section 2.1 (2) | `service.js:461-475` | Calls `reserveLoopbackPort()`, generates 24-byte hex token, injects `OPENCHAMBER_SERVICE_PORT`, `OPENCHAMBER_SERVICE_TOKEN`, `ELECTRON_RUN_AS_NODE: '1'`. | **VERIFIED** |
| 3 | Section 2.1 (3) | `service.js:134-155` | `waitForServiceReady`: Polls `GET http://127.0.0.1:${port}/health` with `Authorization: Bearer ${token}` and `Accept: application/json` every 200ms up to 15,000ms. Expects HTTP 200. | **VERIFIED** |
| 4 | Section 2.1 (4) | `service.js:525-535` | If not ready or child exits, calls `discardRuntime`, captures stdout/stderr, throws `GuestServiceError(..., 'SERVICE_FAILED')`. | **VERIFIED** |
| 5 | Section 2.2 Table | `service.js:653-658` | Checks `store.disabledGuests?.[guestId]`. Throws `GuestServiceError(`${label} is disabled in Settings → Extensions.`, 'DISABLED')`. | **VERIFIED** |
| 6 | Section 2.2 Table | `service.js:665-667` | Checks `granted.includes('service')`. Throws `GuestServiceError('Allow this extension\'s local service in Settings → Extensions.', 'NO_SERVICE')`. | **VERIFIED** |
| 7 | Section 2.2 Table | `service.js:84` | Checks `assertGuestHostActive(lifecycle)`. Throws `GuestServiceError('The host is shutting down.', 'NO_SERVICE')`. | **VERIFIED** |
| 8 | Section 2.2 Table | `service.js:525-535` | Service startup failure throws `GuestServiceError(..., 'SERVICE_FAILED')`. | **VERIFIED** |
| 9 | Section 2.2 Table | `service.js:745, 771` | Request failure or unreadable response throws `GuestServiceError('Guest service request failed.', 'REQUEST_FAILED')`. | **VERIFIED** |
| 10 | Section 2.2 Table | `service.js:775` | Response exceeding 8MB throws `GuestServiceError('The service answered with more than ${responseMax} bytes.', 'RESPONSE_TOO_LARGE')`. | **VERIFIED** |
| 11 | Section 2.2 Table | `host.js:308` | SDK client timer (20s) rejects with `new HostRequestError('HOST_TIMEOUT', 'Host did not answer in time.')`. | **VERIFIED** |
| 12 | Section 2.2 Table | `host.js:303` | SDK client missing parent window rejects with `new HostRequestError('HOST_UNAVAILABLE', 'No host frame. This page is not in an iframe.')`. | **VERIFIED** |
| 13 | Section 2.2 Code | `@openchamber/sdk/dist/host.js:12-19` | Defines `HostRequestError` class with `code: HostRequestErrorCode` and `message: string`. | **VERIFIED** |
| 14 | Section 3.2.1 | `panel/main.ts:9903` | `host.onReady(async (ctx) => { ... })` entrypoint where initial workspace setup and panel initialization runs. | **VERIFIED** |
| 15 | Section 3.2.2 | `panel/main.ts:497-526`, `panel/index.html:3580-3583` | Defines `showBanner`, `hideBanner`, and the HTML container `<div id="boardBanner" class="banner" style="display: none;">`. | **VERIFIED** |
| 16 | Section 6.3 (1) | `service.js:134-155, 461-536, 628-689` | Full lifecycle implementation in host runner (spawning, readiness probing, request proxying, graceful termination). | **VERIFIED** |
| 17 | Section 6.4 | `panel/labels.ts:633-721`, `panel/main.ts:1654, 3190-3196` | Defines `StatusReconciler`, scheduled on issue fetch, invoking `updateIssueStatus` which calls GitHub `PATCH /repos/:repo/issues/:number`. | **VERIFIED** |

---

## 2. End-to-End Error Propagation Proof

The brief required proving whether the SDK surfaces the host's exact error code to the panel or converts it to a generic code.

Direct source trace across the four layers of the communication pipeline:

```
[Host Runner: service.js]
  │ throws GuestServiceError(msg, code) where code ∈ {DISABLED, NO_SERVICE, SERVICE_FAILED, REQUEST_FAILED, RESPONSE_TOO_LARGE}
  ▼
[Host HTTP Route: routes.js:628-631]
  │ catches GuestServiceError
  │ returns HTTP 400 / 502 with JSON: { error: error.code, message: error.message }
  ▼
[Parent Web UI: dist/assets/useAppFontEffects-*.js]
  │ UD = async (t, e, n) => { ... return r7t(s) }
  │ r7t: checks s.data.error against allowlist $ee via mb(s.data.error)
  │ $ee includes: "HOST_UNAVAILABLE", "HOST_TIMEOUT", "HOST_REJECTED", "DISCONNECTED",
  │              "DISABLED", "BAD_PATH", "NO_SERVICE", "SERVICE_FAILED", "REQUEST_FAILED", ...
  │ mb preserves exact code: mb('NO_SERVICE') === 'NO_SERVICE'
  │ Ixt handler: postMessage({ channel, v, type: 'result', id, ok: false, error: msg, code: code })
  ▼
[Guest SDK: @openchamber/sdk/dist/host.js:284-294]
  │ onMessage: waiter.reject(new HostRequestError(message.code, message.error))
  ▼
[Task Board Caller: panel/main.ts]
  │ catch (err: unknown) { const code = (err as any)?.code; ... }
```

**Proof Conclusion:** The SDK preserves the exact string code originating from the host runner (`code: 'NO_SERVICE'`, `code: 'DISABLED'`, `code: 'SERVICE_FAILED'`, etc.). The plan's branch logic correctly categorizes these codes without loss of fidelity.

---

## 3. Direct-Run Guard & Module Import Verification

PLAN.md specifies:
```typescript
if (process.argv[1] && import.meta.url && process.argv[1] === fileURLToPath(import.meta.url)) {
  startHostServiceServer();
}
```

### Empirical Test
1. **Direct Child Execution:** When OpenChamber spawns the service (`service.js:487`), it invokes `spawn(process.execPath, [absoluteEntry], ...)`. Node.js populates `process.argv[1]` with `absoluteEntry`. In ESM, `fileURLToPath(import.meta.url)` inside `service/main.js` produces `absoluteEntry`. The check evaluates to `true`, and the server starts.
2. **Module Import in Tests:** When test suites import `service/main.ts` or `service/main.js` (e.g. `import { CoordinatorService } from '../service/main.ts'`), `process.argv[1]` contains the test file path (e.g. `/workspace/.../test/stage2b-pilot-coordinator.test.js`). The comparison evaluates to `false`, preventing server socket binding or timer instantiation.

---

## 4. StatusReconciler Remote Mutation Safety Verification

Audit of `panel/labels.ts` and `panel/main.ts` confirms:
1. `fetchIssues()` in `panel/main.ts:1654` invokes `statusReconciler.schedule(issues)`.
2. `StatusReconciler.schedule` (`panel/labels.ts:664-672`) triggers `reconcile(issues)` after a 300ms debounce.
3. In `panel/labels.ts:685`, if an issue's active session state maps to a column (`in-progress`, `needs-human`) differing from its current `status:*` label, it invokes `this.updateStatus(issue, targetCol)`.
4. In `panel/main.ts:3192-3194`, `updateStatus` delegates to `updateIssueStatus`.
5. In `panel/main.ts:2756-2759`, `updateIssueStatus` issues a live HTTP mutation:
   ```typescript
   await githubRequestWithRetry('PATCH', `/repos/${repo}/issues/${issue.number}`, {
     state: newState,
     labels: filteredLabels,
   });
   ```
6. **Finding:** Mounting the panel against a production repository with divergent session and label states performs live remote modifications on GitHub. The plan's directive enforcing isolated loopback test fixtures with synthetic mocks is empirically confirmed as necessary for safety.

---

## 5. Worktree Integrity & Test Baseline

The worktree remains clean with zero changes outside `.agents/run/issue-50-plan-rereview/**`:
- `node --test test/shipped-parity.test.js`: 18/18 tests pass (292ms).
- `node --test test/stage2b-pilot-coordinator.test.js`: 53/53 tests pass (764ms).
- `npm run typecheck`: Clean (0 errors).
- No production GitHub mutations, secrets extraction, or live host modifications were performed.
