# Empirical Verification Proof: Issue #50 (Reliable Host Connection)

**Date:** Sun Nov 01 2026  
**Issue:** #50 (Reliable Host Connection & Background Service Adapter)  
**Plan Revision:** Plan Revision 2 (approved) + Re-Review Advisories 1-4 + L4 Hostile Review Hardening  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Summary of Changes

1. **Service Host Adapter (`service/main.ts`, `service/config.ts`, `service/types.ts`):**
   - Standard-library-only HTTP adapter using `node:http`, `node:crypto`, `node:url`, `node:fs`.
   - Direct-run entry guard with `fs.realpathSync` normalization (Advisory 4) ensuring zero side-effects on module import.
   - Fast-fail config validation before coordinator/lease initialization (Advisory 2: regex `/^[0-9]+$/` without prior trim; non-empty token; sanitized stderr; exit code 1 in <10ms).
   - Constant-time Bearer authentication via SHA-256 fixed 32-byte digests before `crypto.timingSafeEqual` (never throws `RangeError`).
   - Auth-first processing: authentication checked strictly before payload buffering or route disclosure; unauthenticated probes return 401.
   - Strict route confinement: authenticated `GET /health` returns 200 `{"status":"ok","service":"task-coordinator"}`; normalized trailing slashes (`/health/`); returns 503 if coordinator is not running; non-GET on `/health` returns 405; all other paths (including `/status`) return 404 with zero process/lease disclosure.
   - Startup order: coordinator service initialized and started before HTTP server socket binds on loopback.
   - Bounds and graceful shutdown: 15s socket timeout, 64KB body cap (413/destroy), 3,500ms safety timer that forcibly exits code 1 if shutdown stalls before host 5s SIGKILL, SIGTERM release of only own leases while preserving other owners' unexpired leases.

2. **Panel D59 Caller (`panel/main.ts`):**
   - Single probe inside `host.onReady` on panel open; zero polling, zero auto-grant, no retry storm, no new toolbar button.
   - Outcome 1 (200 OK): dismisses coordinator banners while preserving unrelated repository/setup banners (Advisory 1).
   - Outcome 2 (`NO_SERVICE` or `DISABLED`): displays non-intrusive Settings notice; never claims success.
   - Outcome 3 (transport error, host timeout, or non-200): displays connection failure notice; logs sanitized code only; never passes raw Error object or token.
   - Banner preservation: `setRepository` guarded so active coordinator notices are not dismissed on repo switch.

3. **Built Bundles:**
   - Freshly compiled `service/main.js` and `panel/main.js` via `npm run build`.

---

## 2. Empirical Verification Evidence

### L0: Build and TypeScript Validation

Command:
```bash
npm run build && npm run typecheck
```
Exit Code: `0`

Output Snippet:
```
> openchamber-github-task-board@1.2.1 build
> npm run build:panel && npm run build:service

> openchamber-github-task-board@1.2.1 build:panel
> esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js
  panel/main.js  709.2kb
Done in 82ms

> openchamber-github-task-board@1.2.1 build:service
> esbuild service/main.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=service/main.js
  service/main.js  36.6kb
Done in 11ms

> openchamber-github-task-board@1.2.1 typecheck
> tsc --noEmit
```

---

### L1: Dedicated Test Suites (Built Artifact & Real Panel Caller)

Command:
```bash
node --test test/service-host-connection.test.js test/panel-service-connection.test.js
```
Exit Code: `0`

Output Snippet:
```
TAP version 13
# Subtest: panel-service-connection: real panel bundle executes onReady probe and outcome 1 hides prior coordinator banner
ok 1 - panel-service-connection: real panel bundle executes onReady probe and outcome 1 hides prior coordinator banner
# Subtest: panel-service-connection: Outcome 1 200 OK preserves unrelated active banner (Advisory 1)
ok 2 - panel-service-connection: Outcome 1 200 OK preserves unrelated active banner (Advisory 1)
# Subtest: panel-service-connection: Outcome 2 NO_SERVICE shows Settings notice without claiming success
ok 3 - panel-service-connection: Outcome 2 NO_SERVICE shows Settings notice without claiming success
# Subtest: panel-service-connection: Outcome 2 DISABLED shows Settings notice without claiming success
ok 4 - panel-service-connection: Outcome 2 DISABLED shows Settings notice without claiming success
# Subtest: panel-service-connection: Outcome 3 SERVICE_FAILED shows failure banner and sanitized warning
ok 5 - panel-service-connection: Outcome 3 SERVICE_FAILED shows failure banner and sanitized warning
# Subtest: panel-service-connection: Outcome 3 REQUEST_FAILED, HOST_TIMEOUT, and HOST_UNAVAILABLE show failure banner
ok 6 - panel-service-connection: Outcome 3 REQUEST_FAILED, HOST_TIMEOUT, and HOST_UNAVAILABLE show failure banner
# Subtest: panel-service-connection: Outcome 3 Non-200 HTTP status shows unexpected status notice
ok 7 - panel-service-connection: Outcome 3 Non-200 HTTP status shows unexpected status notice
# Subtest: panel-service-connection: Outcome 3 Generic error without code logs HOST_REJECTED safely
ok 8 - panel-service-connection: Outcome 3 Generic error without code logs HOST_REJECTED safely
# Subtest: panel-service-connection: real window hook __taskBoardBackgroundService is exported and callable
ok 9 - panel-service-connection: real window hook __taskBoardBackgroundService is exported and callable
# Subtest: panel-service-connection: Invariant: zero emojis in UI banner copy or log output
ok 10 - panel-service-connection: Invariant: zero emojis in UI banner copy or log output
# Subtest: service-host-connection: valid readiness handshake returns 200 JSON
ok 11 - service-host-connection: valid readiness handshake returns 200 JSON
# Subtest: service-host-connection: timing-safe auth rejects missing, invalid, and malformed tokens without RangeError
ok 12 - service-host-connection: timing-safe auth rejects missing, invalid, and malformed tokens without RangeError
# Subtest: service-host-connection: route and method confinement (no /status, only GET /health)
ok 13 - service-host-connection: route and method confinement (no /status, only GET /health)
# Subtest: service-host-connection: fast-fail startup config validation exits code 1 with sanitized stderr
ok 14 - service-host-connection: fast-fail startup config validation exits code 1 with sanitized stderr
# Subtest: service-host-connection: >64KB payload rejected with 413 or connection destroy
ok 15 - service-host-connection: >64KB payload rejected with 413 or connection destroy
# Subtest: service-host-connection: SIGTERM gracefully shuts down in <1500ms and preserves foreign unexpired leases
ok 16 - service-host-connection: SIGTERM gracefully shuts down in <1500ms and preserves foreign unexpired leases
# Subtest: service-host-connection: importing service/main.js as module does not bind port or exit process
ok 17 - service-host-connection: importing service/main.js as module does not bind port or exit process
# Subtest: service-host-connection: port bind collision (EADDRINUSE) exits code 1 fast
ok 18 - service-host-connection: port bind collision (EADDRINUSE) exits code 1 fast
# Subtest: service-host-connection: createCoordinatorHostServer returns 503 if coordinator status is stopping or stopped
ok 19 - service-host-connection: createCoordinatorHostServer returns 503 if coordinator status is stopping or stopped
1..19
# tests 19
# suites 0
# pass 19
# fail 0
```

---

### L2: Targeted Integration & Parity Suites

Command:
```bash
node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js
```
Exit Code: `0`

Output Snippet:
```
1..90
# tests 90
# suites 0
# pass 90
# fail 0
```
- `test/service-host-connection.test.js`: 9 passed
- `test/panel-service-connection.test.js`: 10 passed
- `test/stage2b-pilot-coordinator.test.js`: 53 passed
- `test/shipped-parity.test.js`: 18 passed

---

### L3: Full Regression Suite

Command:
```bash
npm test
```
Exit Code: `0`

Output Snippet:
```
1..614
# tests 614
# suites 0
# pass 614
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 14370.390257
```
All 614 tests pass (up from 611 pre-hardening). Zero regressions across all test files.

---

### Hostile Findings (L4)

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | `test/panel-service-connection.test.js` used a synthetic mock harness with extracted code instead of running the real bundled `panel/main.js`. | High | Rewrote suite to execute the compiled `panel/main.js` bundle directly in a VM context, verifying real `host.onReady` execution, banner DOM changes, sanitized logging, and window hook exports. |
| 2 | `service/main.ts` parsed `Content-Length` and registered body data chunks before verifying Bearer authentication, allowing unauthenticated callers to cause 413 or probe routes. | Medium | Moved Bearer authentication check to the very first step of request handling before payload parsing or route inspection; unauthenticated requests immediately receive 401. |
| 3 | `service/main.ts` bound and listened on the loopback port before `coordinatorService.start()` resolved, creating a startup race where `/health` could return 200 while startup failed. | Medium | Awaited `coordinatorService.start()` strictly before calling `server.listen()`. Wired `createCoordinatorHostServer` to check coordinator status and return 503 if stopping or stopped. |
| 4 | URL matching in `service/main.ts` did not normalize trailing slashes on `/health/`. | Low | Added path normalization `url.pathname.replace(/\/+$/, '') \|\| '/'` to cleanly match both `/health` and `/health/`. |
| 5 | Shutdown safety timer in `service/main.ts` did not invoke `process.exit(1)`, risking hangs up to OpenChamber's 5s SIGKILL timeout. | Medium | Configured a 3,500ms safety timer during graceful shutdown that forcibly exits code 1 if connections or lease release stall before host timeout. |
| 6 | In `panel/main.ts`, `setRepository` dismissed active banners on repository selection, clearing coordinator notice banners. | Low | Guarded `setRepository` so `hideBanner()` is not called if the banner text contains a background coordinator notice. |

---

## 3. Evidence Categorization & Verification Boundaries

### Fixture Observations (Isolated Test Environment)
- Verified loopback binding (`127.0.0.1`) and constant-time Bearer token authentication.
- Verified absence of `RangeError` on length-mismatched or malformed tokens.
- Verified route confinement: `/status` returns 404 with zero process disclosure; `POST /health` returns 405; trailing slash `/health/` returns 200; query params on `/health` return 200.
- Verified payload limits: bodies > 64KB trigger HTTP 413 or socket destruction; unauthenticated oversized requests return 401 immediately without buffering.
- Verified fail-fast behavior: invalid ports (`3000abc`, `" 3000 "`, `0`, `99999`) or missing/whitespace tokens write single sanitized stderr line and exit 1 immediately (<10ms) without echoing tokens; port bind collisions (`EADDRINUSE`) exit 1 in <200ms.
- Verified graceful shutdown on `SIGTERM`: exits with code 0 in <1,500ms, releases owned leases, preserves foreign unexpired leases in `leases.json`, and arms a 3,500ms force-exit safety timer.
- Verified module import safety: importing `service/main.js` produces zero listeners, timers, or exits.
- Verified real panel caller: executes once under `host.onReady` against compiled `panel/main.js`, differentiates 200 / `NO_SERVICE` / `DISABLED` / runtime errors, preserves unrelated setup banners, and logs sanitized strings with zero raw Error objects or bearer tokens.

### Real-Host Verification Boundary (Explicitly Unverified)
- Real-host execution inside an authenticated OpenChamber parent web interface (port 3000) was **NOT** performed. The parent interface is guarded by authentication. The secrets wall strictly prohibits extracting credentials.
- In-situ validation within an authenticated parent host frame remains unverified and awaits human-authenticated review (L5).

### Remote Mutation Safety
- Verified that the host connection check does not invoke remote GitHub APIs, dispatch agent sessions, or mutate issue status labels.
