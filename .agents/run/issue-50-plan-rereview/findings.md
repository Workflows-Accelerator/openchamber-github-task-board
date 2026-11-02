# Independent Plan Re-Review: Issue #50 (Revision 2)

**Review Date:** Sun Nov 01 2026  
**Auditor:** Model `9router/engineer`  
**Repository:** `openchamber-github-task-board`  
**Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection`  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Target Plan:** `.agents/run/issue-50-plan/PLAN.md` (Revision 2, commit `83ad27e`)  

---

## 1. Formal Verdicts

- **Spec Verdict:** `PASS`  
  *Rationale:* Revision 2 faithfully integrates Decision D59 and all six mandatory corrections from the initial review gate. The plan specifies standard-library-only implementation, strict startup config validation before coordinator instantiation, fixed-length SHA-256 digests prior to `timingSafeEqual`, removal of `/status` in favor of minimal `GET /health`, observable sanitized diagnostics on all outcomes, module-import isolation, multi-owner lease preservation, and strict sequential ordering before Issue #51.
- **Quality Verdict:** `APPROVED`  
  *Rationale:* The architectural specifications and test plans are concrete, source-grounded, and directly executable by a builder. Zero blocking defects were identified. Four minor non-blocking risks are detailed below as builder advisories to harden edge cases.

---

## 2. Verification of Mandatory Corrections & Decision D59

| Correction / Invariant | Evaluation Criteria | Findings & Source Evidence | Status |
|---|---|---|---|
| **1. Decision D59 (Board-Open Caller)** | Runs once per panel open; no polling or retry loop; no new toolbar button; no auto-grant; 3 distinct user outcomes; copy never claims success on failure; banner reuse exists. | Configured inside `host.onReady` (`panel/main.ts:9903`). Reuses existing `#boardBanner` (`panel/index.html:3580-3583`, `panel/main.ts:497-526`). Outcomes differentiate 200 (connected/silent log), `NO_SERVICE`/`DISABLED` (unapproved notice), and transport failures (failure notice). Copy never claims success on failure. | **PASS** |
| **2. Removal of `GET /status`** | No process/lease disclosure; minimal `GET /health` only; 404/405 without detail. | Plan completely removes `/status`. The loopback server responds to `GET /health` with `{"status":"ok","service":"task-coordinator"}`. All other routes return minimal 404, invalid methods return 405. Zero PIDs, `ownerId`, or lease data exposed. | **PASS** |
| **3. Observable Diagnostics & Error Codes** | No silent catches; exact error codes grounded in host/SDK source; no raw `Error` or token logging. | Proved end-to-end through host runner (`service.js`), HTTP routes (`routes.js`), and Web UI postMessage bridge: wire error codes (`NO_SERVICE`, `DISABLED`, `SERVICE_FAILED`, `REQUEST_FAILED`, `HOST_TIMEOUT`, `HOST_UNAVAILABLE`) propagate intact to `err.code` in SDK `HostRequestError`. Catch block inspects `code` safely without logging raw `Error` objects or tokens. | **PASS** |
| **4. Fast-Fail Startup Config Validation** | Strict port regex `/^[0-9]+$/` (1..65535) and non-empty token; validated before coordinator/storage startup; sanitized stderr exit 1. | Section 3.1.1 validates environment variables immediately at process start, prior to directory creation, `leaseStore.init()`, or `CoordinatorService` instantiation. Malformed port or token writes fixed generic stderr message and invokes `process.exit(1)`. | **PASS** |
| **5. Cryptographic Timing-Safe Auth** | Fixed-length SHA-256 pre-hashing before `crypto.timingSafeEqual`; malformed/missing headers never throw; bounded limits; bounded shutdown. | Section 3.1.3 hashes expected and received tokens into 32-byte buffers before comparison, preventing Node `RangeError`. Missing/malformed headers return `false` safely. 64KB body and 15s socket timeout enforced. Graceful shutdown releases own leases within <1,500ms (below host 5s kill). | **PASS** |
| **6. Preservations & Built-Artifact Tests** | Module imports produce no side-effects; public APIs preserved; single-writer unexpired leases untouched; automated tests exercise built artifact with isolated fixtures. | Direct-run guard prevents listeners or timers on import. Public methods of `CoordinatorService` retained. Automated test suite spawns built `service/main.js` with isolated storage, ephemeral ports, and synthetic tokens. Panel tests verify all 3 outcomes with stubbed bridge. | **PASS** |
| **+ Sequential with Issue #51** | Collision graph verified; #51 sequential. | Both issues touch `panel/main.ts` and require rebuilding `panel/main.js`. Section 5 strictly mandates sequential progression of #51 after #50. | **PASS** |
| **+ StatusReconciler Mutation Safety** | Source-accurate analysis of live GitHub mutations. | Source inspection of `panel/labels.ts:633-721` and `panel/main.ts:1654, 2756-2759` confirms that live panel mounting against real repositories triggers remote GitHub `PATCH` mutations on label/session mismatches. Prohibition of live repository testing is verified as essential. | **PASS** |

---

## 3. Host Error Code Propagation Proof

Investigation of the installed OpenChamber web package confirms that error codes are preserved across every hop:
1. **Host Runner (`@openchamber/web/server/lib/guests/service.js`):** Throws `GuestServiceError(message, code)` with specific codes (`DISABLED` at line 657, `NO_SERVICE` at line 84 & 666, `SERVICE_FAILED` at line 533, `REQUEST_FAILED` at line 745 & 771, `RESPONSE_TOO_LARGE` at line 775).
2. **HTTP Route (`@openchamber/web/server/lib/guests/routes.js:628-631`):** Catches `GuestServiceError`, returns JSON `{ error: error.code, message: error.message }` with HTTP 400 or 502.
3. **Web UI Bridge (`dist/assets/useAppFontEffects-*.js`):** Function `UD` receives JSON response, checks `error` against allowlist `$ee` (which includes all host error codes), and returns `{ ok: false, code: s.data.error, message: s.data.message }`. Handler `Ixt` posts `{ ok: false, error: n.message, code: n.code }` to the guest iframe.
4. **Guest SDK (`@openchamber/sdk/dist/host.js:293`):** Resolves postMessage into `waiter.reject(new HostRequestError(message.code, message.error))`.
5. **Panel Consumer (`panel/main.ts`):** `err.code` matches the string code exactly, enabling clean discrimination between unapproved capability (`NO_SERVICE`, `DISABLED`) and runtime failure (`SERVICE_FAILED`, `REQUEST_FAILED`, `HOST_TIMEOUT`).

---

## 4. Itemized Non-Blocking Findings & Builder Advisories

The following four items do not block implementation approval, but should be adopted by the builder to ensure edge-case robustness:

### Finding 1: Blind `hideBanner()` can dismiss unrelated active banners
- **Severity:** Low / Minor UX
- **Plan Location:** Section 3.2.2 (Outcome 1 in `checkBackgroundServiceConnection`)
- **Evidence:** `panel/main.ts:894, 909` uses `showBanner` to prompt the user when no Git repository is linked. In Outcome 1 (successful health check), calling `hideBanner()` unconditionally will dismiss any existing setup or repository banner that opened concurrently.
- **Minimal Fix:** Only call `hideBanner()` if the banner is currently displaying a service-related notice:
  ```typescript
  const cur = document.getElementById('boardBannerText')?.textContent;
  if (cur && cur.includes('Background coordinator')) {
    hideBanner();
  }
  ```

### Finding 2: Whitespace trimming before regex relaxes strict full-string validation
- **Severity:** Low / Minor Spec Precision
- **Plan Location:** Section 3.1.1 (`const rawPort = process.env.OPENCHAMBER_SERVICE_PORT?.trim();`)
- **Evidence:** Calling `.trim()` on `OPENCHAMBER_SERVICE_PORT` before testing `/^[0-9]+$/` permits inputs containing leading or trailing whitespace (e.g. `" 3000 "`), which technically relaxes the "strict full-string integer (no trailing text allowed)" specification.
- **Minimal Fix:** Test the environment variable directly without prior `.trim()`:
  ```typescript
  const rawPort = process.env.OPENCHAMBER_SERVICE_PORT;
  if (!rawPort || !/^[0-9]+$/.test(rawPort)) { ... }
  ```

### Finding 3: Server shutdown should arm a fallback connection termination timer
- **Severity:** Low / Operational Resilience
- **Plan Location:** Section 3.1.5 (Graceful Shutdown)
- **Evidence:** `server.close()` stops accepting new connections but waits indefinitely for existing active sockets to finish. If an in-flight request stalls, the process could exceed the host's 5,000ms `SERVICE_KILL_TIMEOUT_MS` deadline (`service.js:332`), leading to an ungraceful `SIGKILL`.
- **Minimal Fix:** Arm a 2,500ms safety timer during shutdown that invokes `server.closeAllConnections?.()` if active requests have not settled.

### Finding 4: Direct-run entry guard symlink normalization
- **Severity:** Low / Portability
- **Plan Location:** Section 3.3.2 (`process.argv[1] === fileURLToPath(import.meta.url)`)
- **Evidence:** In containerized or symlinked worktree environments, `process.argv[1]` may contain a symlink path while Node's ESM `import.meta.url` canonicalizes to `fs.realpathSync`.
- **Minimal Fix:** Guard with realpath fallback:
  ```typescript
  if (process.argv[1] && import.meta.url) {
    const entryPath = fileURLToPath(import.meta.url);
    if (process.argv[1] === entryPath || (fs.realpathSync && fs.realpathSync(process.argv[1]) === entryPath)) {
      startHostServiceServer();
    }
  }
  ```

---

## 5. Conclusion & Next Steps

Plan Revision 2 satisfies all architectural, security, and protocol requirements. Implementation may proceed sequentially under Issue #50. Issue #51 must remain blocked until Issue #50 is merged and verified.
