# Hosting Slice Correction Report: Hostile Review Remediation

- **Base Commit:** `2dfbb2227d8db1cfb036573752e5d7a869811558`
- **Initial Slice Commit:** `b8e517c60db7558ea3769af9aa0c8fd04bec1f94`
- **Hostile Review Commit:** `6efb78e8e0ff712aa17601c9dfe58cdd13ea1059`
- **Product Fix Commit:** `c828bf3`
- **Test Fix Commit:** `848c9f8`
- **Branch:** `feat/board-hosting`
- **Date:** 2026-10-26 UTC
- **Builder Model:** `9router/engineer`

---

## Remediation Summary

### Finding 1: Unapproved `BOARD_GITHUB_API_BASE` Token Exfiltration Vector (HIGH)
- **Status:** CLOSED
- **Changes:**
  - Removed `BOARD_GITHUB_API_BASE` environment reading from `web/server/config.ts`. Restored fixed default `DEFAULT_GITHUB_API_BASE` (`https://api.github.com`) in `loadConfig` identical to base commit `2dfbb22`.
  - Removed `githubApiBase` from `describeConfig` output.
  - Removed `BOARD_GITHUB_API_BASE` from `web/README.md` config table and operations section.
  - Removed `BOARD_GITHUB_API_BASE` from `web/tests/hosting.test.mjs`. In-process testing uses existing options injection, and spawned subprocess tests use isolated test harness network preloading without modifying production code.
- **Evidence:**
  - **Red-before (`b8e517c`):** Setting `BOARD_GITHUB_API_BASE` populated `config.githubApiBase`, causing startup validation requests to transmit the bearer token to an attacker URL.
  - **Green-after (`c828bf3` / `848c9f8`):** Added regression test `BOARD_GITHUB_API_BASE in environment is ignored and upstream defaults to api.github.com` in `web/tests/hosting.test.mjs`. Confirms `loadConfig` ignores the variable, `describeConfig` omits `githubApiBase`, and GitHub requests target `https://api.github.com/`.

### Finding 2: False Health Signal Version Fallback & Brittle Literal Assertions (MEDIUM)
- **Status:** CLOSED
- **Changes:**
  - In `web/server/app.ts:getPackageVersion()`, removed hardcoded fallback `cachedVersion = '1.2.1'`. If `package.json` cannot be read or parsed, it now returns `'unknown'`.
  - Added optional `packageJsonUrl` parameter to `BoardServerOptions` / `getPackageVersion` for testability.
  - In `web/tests/hosting.test.mjs`, replaced frozen literal `'1.2.1'` assertions with dynamic version read from root `package.json`.
  - Added regression test `/health returns version "unknown" when package.json cannot be read`.
- **Evidence:**
  - **Red-before (`b8e517c`):** `web/server/app.ts` contained literal `cachedVersion = '1.2.1'`, returning `'1.2.1'` even when package read failed.
  - **Green-after (`c828bf3` / `848c9f8`):** Test passes, asserting honest fallback `'unknown'` on unreadable package file.

### Finding 3: Inter-Test State Dependency in `hosting.test.mjs` (LOW)
- **Status:** CLOSED
- **Changes:**
  - Added `ensureBundleBuilt()` in `web/tests/hosting.test.mjs` invoked at the start of Test 8 and Test 9 to build `web/dist/server.mjs` via esbuild if missing, cleaning nothing required by subsequent tests.
- **Evidence:**
  - **Red-before (`b8e517c`):** `rm -rf web/dist && node --test --test-name-pattern="npm run start:web" web/tests/hosting.test.mjs` crashed with `MODULE_NOT_FOUND` (exit 1).
  - **Green-after (`848c9f8`):** `rm -rf web/dist && node --test --test-name-pattern="npm run start:web" web/tests/hosting.test.mjs` builds bundle on demand and passes (1/1 pass, exit 0).

### Finding 4: Method Behavior for `/health` (INFO)
- **Status:** CLOSED
- **Changes:**
  - Documented in `web/README.md` that only `GET` is supported; `HEAD` and all other non-GET methods return HTTP 405 with `Allow: GET`. Automated monitors and probes must use `GET`.
  - Added `'HEAD'` to non-GET method test cases in `web/tests/hosting.test.mjs:148`.
- **Evidence:**
  - **Green-after (`848c9f8`):** Test passes asserting `HEAD /health` returns status 405 with `Allow: GET`.

### Documentation Gaps
- **Root `README.md`:** Clarified that `npm run start:web` requires building `web/dist/server.mjs` first via `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` (not built by `npm run build`).
- **`web/README.md`:** Removed `BOARD_GITHUB_API_BASE` from configuration table and operations list.

---

## Gate Verification Results

| Check / Gate | Command | Result | Exit | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Hosting Tests | `node --test web/tests/hosting.test.mjs` | **PASS** (11/11) | 0 | Duration ~4.3s |
| Full Web Tests | `node --test web/tests/*.test.mjs` | **PASS** (349/349) | 0 | 338 base + 11 hosting |
| Root Test Suite | `npm test` | **PASS** (517/517) | 0 | Duration ~22.2s |
| Web TypeScript | `npx tsc -p web/tsconfig.json` | **PASS** | 0 | 0 errors |
| Root TypeScript | `npm run typecheck` | **PASS** | 0 | 0 errors |
| Server Bundle | `npx esbuild web/server.ts ...` | **PASS** (101.1 kb) | 0 | Duration ~43ms |
| Bundle Hash | `sha256sum web/dist/server.mjs` | `c385ced6c8fee23852350aa817937ec8ddf5a871dc43bed5be8af0e587674b5d` | 0 | Clean build |
| Isolation Start Test | `rm -rf web/dist && node --test --test-name-pattern="npm run start:web" web/tests/hosting.test.mjs` | **PASS** (1/1) | 0 | Independent bundle generation |

---

## Blind Spots & Limits

1. **Reverse proxy / TLS:** No live Traefik, Caddy, or TLS termination verified.
2. **Container lifecycle:** No Docker container recreation, port publishing, or init supervision executed.
3. **Production GitHub:** All tests executed against localhost synthetic mock; real GitHub token validation unexercised.
