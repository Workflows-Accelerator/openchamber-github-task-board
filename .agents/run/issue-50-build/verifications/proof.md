# Empirical Verification Proof: Issue #50 (Reliable Host Connection)

**Date:** Sun Nov 01 2026  
**Issue:** #50 (Reliable Host Connection & Background Service Adapter)  
**Plan Revision:** Plan Revision 2 (approved) + Re-Review Advisories 1-4  
**Branch:** `fix/issue-50-host-connection`  
**Base Commit:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  

---

## 1. Summary of Changes

1. **Service Host Adapter (`service/main.ts`, `service/config.ts`, `service/types.ts`):**
   - Standard-library-only HTTP adapter using `node:http`, `node:crypto`, `node:url`, `node:fs`.
   - Direct-run entry guard with `fs.realpathSync` normalization (Advisory 4) ensuring zero side-effects on module import.
   - Fast-fail config validation before coordinator/lease initialization (Advisory 2: regex `/^[0-9]+$/` without prior trim; non-empty token; sanitized stderr; exit code 1 in <10ms).
   - Constant-time Bearer authentication via SHA-256 fixed 32-byte digests before `crypto.timingSafeEqual` (never throws `RangeError`).
   - Strict route confinement: authenticated `GET /health` returns 200 `{"status":"ok","service":"task-coordinator"}`; non-GET on `/health` returns 405; all other paths (including `/status`) return 404 with zero process/lease disclosure; unauthenticated requests return 401.
   - Bounds and graceful shutdown: 15s socket timeout, 64KB body cap (413/destroy), 2,500ms fallback safety timer (Advisory 3), SIGTERM release of only own leases while preserving other owners' unexpired leases.

2. **Panel D59 Caller (`panel/main.ts`):**
   - Single probe inside `host.onReady` on panel open; zero polling, zero auto-grant, no retry storm, no new toolbar button.
   - Outcome 1 (200 OK): dismisses coordinator banners while preserving unrelated repository/setup banners (Advisory 1).
   - Outcome 2 (`NO_SERVICE` or `DISABLED`): displays non-intrusive Settings notice; never claims success.
   - Outcome 3 (transport error, host timeout, or non-200): displays connection failure notice; logs sanitized code only; never passes raw Error object or token.

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
  panel/main.js  709.1kb
Done in 74ms

> openchamber-github-task-board@1.2.1 build:service
> esbuild service/main.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=service/main.js
  service/main.js  36.0kb
Done in 12ms

> openchamber-github-task-board@1.2.1 typecheck
> tsc --noEmit
```

---

### L1: Dedicated Test Suites (Built Artifact & Panel Caller)

Command:
```bash
node --test test/service-host-connection.test.js test/panel-service-connection.test.js
```
Exit Code: `0`

Output Snippet:
```
TAP version 13
# Subtest: panel-service-connection: Outcome 1: 200 OK connected hides prior coordinator banner and logs info
ok 1 - panel-service-connection: Outcome 1: 200 OK connected hides prior coordinator banner and logs info
# Subtest: panel-service-connection: Outcome 1: 200 OK preserves unrelated active banner (Advisory 1)
ok 2 - panel-service-connection: Outcome 1: 200 OK preserves unrelated active banner (Advisory 1)
# Subtest: panel-service-connection: Outcome 2: NO_SERVICE shows Settings notice without claiming success
ok 3 - panel-service-connection: Outcome 2: NO_SERVICE shows Settings notice without claiming success
# Subtest: panel-service-connection: Outcome 2: DISABLED shows Settings notice without claiming success
ok 4 - panel-service-connection: Outcome 2: DISABLED shows Settings notice without claiming success
# Subtest: panel-service-connection: Outcome 3: SERVICE_FAILED shows failure banner and sanitized warning
ok 5 - panel-service-connection: Outcome 3: SERVICE_FAILED shows failure banner and sanitized warning
# Subtest: panel-service-connection: Outcome 3: REQUEST_FAILED and HOST_TIMEOUT show failure banner
ok 6 - panel-service-connection: Outcome 3: REQUEST_FAILED and HOST_TIMEOUT show failure banner
# Subtest: panel-service-connection: Outcome 3: Non-200 HTTP status shows unexpected status notice
ok 7 - panel-service-connection: Outcome 3: Non-200 HTTP status shows unexpected status notice
# Subtest: panel-service-connection: Outcome 3: Generic error without code logs UNKNOWN safely
ok 8 - panel-service-connection: Outcome 3: Generic error without code logs UNKNOWN safely
# Subtest: panel-service-connection: Invariant: zero emojis in UI banner copy or log output
ok 9 - panel-service-connection: Invariant: zero emojis in UI banner copy or log output
# Subtest: service-host-connection: valid readiness handshake returns 200 JSON
ok 10 - service-host-connection: valid readiness handshake returns 200 JSON
# Subtest: service-host-connection: timing-safe auth rejects missing, invalid, and malformed tokens without RangeError
ok 11 - service-host-connection: timing-safe auth rejects missing, invalid, and malformed tokens without RangeError
# Subtest: service-host-connection: route and method confinement (no /status, only GET /health)
ok 12 - service-host-connection: route and method confinement (no /status, only GET /health)
# Subtest: service-host-connection: fast-fail startup config validation exits code 1 with sanitized stderr
ok 13 - service-host-connection: fast-fail startup config validation exits code 1 with sanitized stderr
# Subtest: service-host-connection: >64KB payload rejected with 413 or connection destroy
ok 14 - service-host-connection: >64KB payload rejected with 413 or connection destroy
# Subtest: service-host-connection: SIGTERM gracefully shuts down in <1500ms and preserves foreign unexpired leases
ok 15 - service-host-connection: SIGTERM gracefully shuts down in <1500ms and preserves foreign unexpired leases
# Subtest: service-host-connection: importing service/main.js as module does not bind port or exit process
ok 16 - service-host-connection: importing service/main.js as module does not bind port or exit process
1..16
# tests 16
# suites 0
# pass 16
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
1..87
# tests 87
# suites 0
# pass 87
# fail 0
```
- `test/service-host-connection.test.js`: 7 passed
- `test/panel-service-connection.test.js`: 9 passed
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
1..611
# tests 611
# suites 0
# pass 611
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 14124.942819
```
All 611 tests pass (up from 595 pre-implementation). Zero regressions across all test files.

---

## 3. Evidence Categorization & Verification Boundaries

### Fixture Observations (Isolated Test Environment)
- Verified loopback binding (`127.0.0.1`) and constant-time Bearer token authentication.
- Verified absence of `RangeError` on length-mismatched or malformed tokens.
- Verified route confinement: `/status` returns 404 with zero process disclosure; `POST /health` returns 405.
- Verified payload limits: bodies > 64KB trigger HTTP 413 or socket destruction.
- Verified fail-fast behavior: invalid ports (`3000abc`, `" 3000 "`, `0`, `99999`) or missing/whitespace tokens write single sanitized stderr line and exit 1 immediately (<10ms) without echoing tokens.
- Verified graceful shutdown on `SIGTERM`: exits with code 0 in <1,500ms, releases owned leases, and preserves foreign unexpired leases in `leases.json`.
- Verified module import safety: importing `service/main.js` produces zero listeners, timers, or exits.
- Verified panel caller: executes once under `host.onReady`, differentiates 200 / `NO_SERVICE` / `DISABLED` / runtime errors, preserves unrelated setup banners, and logs sanitized strings with zero raw Error objects or bearer tokens.

### Real-Host Verification Boundary (Explicitly Unverified)
- Real-host execution inside an authenticated OpenChamber parent web interface (port 3000) was **NOT** performed. The parent interface is guarded by authentication. The secrets wall strictly prohibits extracting credentials.
- In-situ validation within an authenticated parent host frame remains unverified and awaits human-authenticated review (L5).

### Remote Mutation Safety
- Verified that the host connection check does not invoke remote GitHub APIs, dispatch agent sessions, or mutate issue status labels.
