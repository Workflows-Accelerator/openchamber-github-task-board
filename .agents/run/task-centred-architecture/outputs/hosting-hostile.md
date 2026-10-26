# Hostile Review: Standalone Board Hosting Preparation Slice

- **Candidate Commit:** `b8e517c60db7558ea3769af9aa0c8fd04bec1f94`
- **Base Commit:** `2dfbb2227d8db1cfb036573752e5d7a869811558`
- **Branch:** `feat/board-hosting`
- **Reviewer:** Independent Hostile Subagent (`9router/engineer`)
- **Date:** 2026-10-26 UTC

---

## Verdicts

| Dimension | Verdict | Summary |
| :--- | :--- | :--- |
| **Security** | **NEEDS-FIXES** | Unapproved, unvalidated `BOARD_GITHUB_API_BASE` exfiltrates sensitive GitHub token over cleartext HTTP to arbitrary destinations on startup. |
| **Spec Compliance** | **PARTIAL** | Scope creep (`BOARD_GITHUB_API_BASE` added and documented as official config); root README start command omits prerequisite build step. |
| **Quality** | **NEEDS-FIXES** | Silent fallback to hardcoded `'1.2.1'` version string masks failed version reads; test suite freezes literal version and contains inter-test build state dependency. |
| **Machine Verdict** | **HALT** | Critical security/scope failure present; requires remediation before any integration, deployment, or owner sign-off. |

---

## Detailed Findings

### Finding 1: Unapproved, Unvalidated `BOARD_GITHUB_API_BASE` Token Exfiltration Vector (HIGH)
- **Status:** Introduced in `b8e517c`
- **Location:** `web/server/config.ts:271`, `web/README.md:36,159`, `web/tests/hosting.test.mjs:220,279`
- **Threat Vector:** STRIDE: Information Disclosure / SSRF / Elevation of Privilege
- **Evidence:**
  1. The task brief authorized only: configurable host (`BOARD_HOST`) with unchanged loopback default, `GET /health`, one start command, and an honest operations section. `BOARD_GITHUB_API_BASE` was neither requested nor authorized.
  2. `web/server/config.ts` reads `BOARD_GITHUB_API_BASE` with zero validation (`read(env, 'BOARD_GITHUB_API_BASE') ?? DEFAULT_GITHUB_API_BASE`), unlike `BOARD_BASE_URL` which enforces URL syntax and protocol.
  3. `web/server/app.ts:338` immediately calls `github.getAuthenticatedUser()` on startup. `GitHubClient.request` transmits the server-held `BOARD_GITHUB_TOKEN` in the `Authorization: Bearer <token>` header.
  4. In `adversarial-upstream.mjs`, setting `BOARD_GITHUB_API_BASE` to an arbitrary local HTTP server successfully captured the cleartext `Bearer` token upon process startup (`/user`).
  5. The variable is documented in `web/README.md` as an approved optional configuration variable.
- **Impact:** Any environment misconfiguration, shared container inspection, or injection allows redirecting the privileged GitHub bot token to arbitrary endpoints (including internal networks or metadata endpoints).
- **Required Minimal Correction:** Remove `BOARD_GITHUB_API_BASE` completely from `loadConfig`, `BoardConfig`, and `web/README.md`. Keep upstream GitHub API base fixed to `https://api.github.com` in production code. If child process testing against synthetic upstreams is required, restrict upstream overrides to an internal, undocumented test harness injection or non-production environment guard.

---

### Finding 2: False Health Signal Version Fallback & Brittle Literal Assertions (MEDIUM)
- **Status:** Introduced in `b8e517c`
- **Location:** `web/server/app.ts:117`, `web/tests/hosting.test.mjs:93,242,300`
- **Threat Vector:** STRIDE: Information Disclosure (False System Identity) / Reliability
- **Evidence:**
  1. In `web/server/app.ts`, `getPackageVersion()` tries `readFileSync(new URL('../../package.json', import.meta.url))`. In the catch block (line 117), it silently assigns `cachedVersion = '1.2.1'`.
  2. If `package.json` cannot be read at runtime (e.g. bundle executed without source tree), `/health` silently reports `'1.2.1'`, falsely indicating health and identity.
  3. In `web/tests/hosting.test.mjs`, lines 93, 242, and 300 freeze the literal string `'1.2.1'`.
  4. In `adversarial-version.mjs`, the hardcoded literal in `app.ts` and the duplicated assertions in `hosting.test.mjs` were verified. A future version bump to `1.2.2` will break tests while masking runtime read failures.
- **Required Minimal Correction:** In `web/server/app.ts`, do not fall back to a hardcoded version string; return `'unknown'` or propagate the error if version identity cannot be determined. In `hosting.test.mjs`, read the expected version dynamically from `package.json` or match against semver format `/^\d+\.\d+\.\d+$/`.

---

### Finding 3: Inter-Test State Dependency in `hosting.test.mjs` (LOW)
- **Status:** Introduced in `b8e517c`
- **Location:** `web/tests/hosting.test.mjs:261-317`
- **Threat Vector:** Test Reliability / Isolation
- **Evidence:**
  1. Test 8 ("the start command serves /health") executes `esbuild` to produce `web/dist/server.mjs`.
  2. Test 9 ("npm run start:web package script serves /health") assumes `web/dist/server.mjs` already exists.
  3. When Test 9 is run in isolation on a clean checkout without prior builds (`rm -rf web/dist && node --test --test-name-pattern="npm run start:web" web/tests/hosting.test.mjs`), it fails with `MODULE_NOT_FOUND: Cannot find module '.../web/dist/server.mjs'`.
- **Required Minimal Correction:** Ensure Test 9 (or a suite before hook) builds or verifies the presence of `web/dist/server.mjs` before executing `npm run start:web`.

---

### Finding 4: Documentation Gap for `npm run start:web` in Root README (LOW)
- **Status:** Introduced in `b8e517c`
- **Location:** `README.md:121`
- **Threat Vector:** Operational Friction / Usability
- **Evidence:**
  1. Root `README.md` added `npm run start:web` to the command table.
  2. Root `npm run build` only executes `build:panel && build:service`; it does not build `web/dist/server.mjs`.
  3. A fresh operator running `npm run build && npm run start:web` from root will crash with `MODULE_NOT_FOUND`.
  4. While `web/README.md` documents the explicit `esbuild` command, root `README.md` does not mention this prerequisite.
- **Required Minimal Correction:** Clarify in `README.md` that `npm run start:web` requires building `web/dist/server.mjs` via the documented esbuild command in `web/README.md`.

---

### Finding 5: `HEAD /health` Returns HTTP 405 Method Not Allowed (INFO)
- **Status:** Introduced in `b8e517c`
- **Location:** `web/server/app.ts:462`
- **Threat Vector:** Operational Monitoring Compatibility
- **Evidence:**
  1. `web/server/app.ts` checks `if (method !== 'GET') return methodNotAllowed('GET')`.
  2. Executing `HEAD /health` returns `HTTP 405 Method Not Allowed` with `Allow: GET` (proven in `adversarial-health.mjs`).
  3. `web/README.md` states: "Non-GET requests return HTTP 405 with Allow: GET", so this aligns with builder docs. However, standard HTTP monitors and load balancers often issue `HEAD` probes.

---

## Independent Gate Verification

All commands executed from repository root in `/workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting`:

| Check / Gate | Target | Result | Exit | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Hosting Test Suite | `node --test web/tests/hosting.test.mjs` | **PASS** (9/9 passed) | 0 | Duration ~4.8s |
| Full Web Tests | `node --test web/tests/*.test.mjs` | **PASS** (347/347 passed) | 0 | 338 base + 9 hosting tests |
| Root Test Suite | `npm test` | **PASS** (516/517 or 517/517) | 0 | 1 transient timing flake in unedited panel test under CPU load; 517 passed when run individually |
| Web TypeScript | `npx tsc -p web/tsconfig.json` | **PASS** (0 errors) | 0 | Type check clean |
| Root TypeScript | `npm run typecheck` | **PASS** (0 errors) | 0 | Type check clean |
| Server Bundle | `npx esbuild web/server.ts ...` | **PASS** (101.0 kb) | 0 | Build succeeds in ~35ms |
| Bundle Hash | `sha256sum web/dist/server.mjs` | `a35cc7995721457cc2c841ec078dd363bf0fc6bcd6889e3c10c8826437d67c7e` | 0 | Reproducible clean bundle |

---

## Red-Before Baseline Verification (Commit `2dfbb22`)

When `web/tests/hosting.test.mjs` was executed against base commit `2dfbb22` (in isolated scratch container with symlinked dependencies):
- **Pass:** 1 test (test 7: existing authenticated routes require password).
- **Fail:** 8 tests:
  - Test 1 (default loopback): `actual undefined !== '127.0.0.1'` (no host config)
  - Test 2 (configured host): `actual undefined !== '0.0.0.0'` (no BOARD_HOST)
  - Test 3 (invalid host): failed on GitHub token rejection because BOARD_HOST was unparsed
  - Test 4 (health 200): `actual 404 !== 200` (/health not present)
  - Test 5 (health credentials/405): `actual 404 !== 200` (/health not present)
  - Test 6 (health secret leak): `actual 404 !== 200` (/health not present)
  - Test 8 (start command serves health): failed on token rejection and /health 404
  - Test 9 (npm run start:web): `npm error Missing script: "start:web"`
- **Conclusion:** The new tests genuinely discriminate the additions and fail against the base commit for the expected functional reasons.

---

## L5 Preview Blockers Status

Per `verifications/L5-preview-plan.md`, the five blockers for browser-board validation:
1. **Container port publishing (`8787:8787`):** Unremoved (Owner/infrastructure only).
2. **Container recreation & brief downtime:** Unremoved (Owner maintenance window only).
3. **Container restart persistence / entrypoint hook:** Unremoved (Entrypoint startup hook outside repo).
4. **Secret provisioning (`BOARD_GITHUB_TOKEN`, etc.):** Unremoved (Owner supplies credentials; never in repo).
5. **Configurable host (`BOARD_HOST`) and `/health`:** Removed in principle repo-side by this slice, but blocked by the unapproved/unsafe `BOARD_GITHUB_API_BASE` exfiltration vector and version fallback quality issues.

---

## Blind Spots & Limits

The following could not be verified in this bounded repository environment:
1. **Real reverse proxy / Traefik routing:** No live Traefik instance or Coolify route exists in this test environment.
2. **TLS termination / Let's Encrypt certificates:** No TLS certificate generation or HTTPS handshake tested.
3. **Container recreation & network publishing:** Docker container recreation was not run; localhost loopback/0.0.0.0 only.
4. **Restart supervision persistence:** No init/systemd/entrypoint restart daemon was exercised.
5. **Production GitHub upstream:** All tests ran against synthetic localhost mock server; authentic GitHub rate limits and real token validations were not run.
6. **Installed host panel surface:** Panel extension integration was not run; web standalone surface only.
