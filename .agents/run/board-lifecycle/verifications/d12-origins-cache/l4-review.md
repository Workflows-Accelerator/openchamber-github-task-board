# L4 Hostile Review: D12 Direct-Origins Caching Activation

**Target Branch:** `feat/d12-origins-etag` (HEAD at `4c688e2`, base `f849dce`)  
**Auditor:** Dynamic Subagent (Engineer Tier — Hostile Prover)  
**Date:** October 8, 2026  
**Status:** COMPLETE  

---

## 1. Verdicts

- **Spec Verdict:** `PASS` — Manifest change (`package.json`) declares `origins` capability and `contributes.origins: ["https://api.github.com"]` without altering existing capabilities. Host proxy fallback paths remain intact across all failure modes (missing token, network/CSP rejection, 401). Real-oracle tests verify manifest structure and runtime fallback without mock leaks or synthetic tautologies.
- **Quality Verdict:** `NEEDS-FIXES` — Code changes are sound, but the builder's `report.md` contains critical operational omissions and recipe defects: (1) omits the mandatory OpenChamber capability approval prerequisite without which CSP `origins` is never granted by the server, (2) prescribes clicking the manual "Refresh" button which explicitly wipes the ETag/body cache and forces an unconditional fetch (making a 304 impossible), and (3) claims a 60s idle check interval when no timer polling exists.
- **Overall Operational Verdict:** `PROCEED-WITH-CONDITIONS` — Integration into preview/dev may proceed on condition that post-merge verification executes the corrected recipe (Settings -> Extensions capability approval + non-forced fetch/session idle event for 304) and retains L3 as `NOT RUN` until empirical served-panel observation is recorded.

---

## 2. Findings Matrix

| # | Severity | File:Line | Description | Reproducible Evidence | Required Fix / Condition |
|---|---|---|---|---|---|
| **F-01** | **HIGH** | `report.md:120` | **Missing Host Capability Approval Prerequisite:** Merely reloading the panel after merge will NOT grant the `origins` CSP. In OpenChamber (`catalog.js`, `grant-scope.js:73-75`, `routes.js:873`), newly requested capabilities must be approved by the user (`PUT /api/guests/:id/capabilities`). Until approved in Settings -> Extensions, `effectiveGrants` excludes `origins`, the served CSP `connect-src` excludes `api.github.com`, and `storage` calls fail with `Extension needs approval`. | Host source tracing and empirical simulation against `extensions.json` confirm `effectiveGrants(...).includes('origins') === false`. | Add prerequisite: OpenChamber UI -> Settings -> Extensions -> Approve Task Board capabilities before reloading the panel. |
| **F-02** | **MEDIUM** | `report.md:162`, `panel/main.ts:6493-6504` | **Manual Refresh Button Cache Busting (304 Impossible via Button):** Recipe Step C.2 instructs clicking the "Refresh" button to observe a 304. In `panel/main.ts:6493-6504`, `refreshTasks` calls `issueListEtagCache.clear()`, `pageBodyCache.clear()`, and invokes `fetchIssues(true)`. The `force=true` flag prevents sending `If-None-Match`, guaranteeing a 200 OK response. | Calling `refreshTasks()` wipes cached ETags and sends no `If-None-Match` header. | Correct recipe: trigger a non-forced fetch (e.g. repo selector re-pick or session transition), NOT the manual Refresh button. |
| **F-03** | **LOW** | `report.md:162` | **Timer Polling Fallacy:** Recipe Step C.2 claims "or wait 60s for the next idle check". D11 removed all interval timer polling (`Refresh Trigger` test verified 0 timers). Background idle refresh only triggers upon session activity state transitions (`handleIdleRefresh`). | Grep for `setInterval` returns 0 occurrences; passive waiting will never trigger a background sync. | Correct recipe: trigger a session state transition (`s.activity = 'idle'`) or use non-forced repo reload. |
| **F-04** | **LOW** | `panel/main.ts:1120` | **URL Origin Defense-in-Depth (Pre-existing):** `githubRequest` constructs `new URL(path, 'https://api.github.com/')` and directly attaches the Bearer token without verifying `url.origin === 'https://api.github.com'`. While browser CSP restricts `connect-src`, explicit origin validation prevents accidental token leakage if an absolute external path is passed. | Static code inspection of `panel/main.ts:1120-1132`. | Pre-existing condition; add defense-in-depth assertion in future maintenance. |

---

## 3. Host Schema, Catalog, and CSP Wiring Audit

1. **Manifest Schema Validation:**
   - Evaluated against `@openchamber/sdk/schemas:parseManifestJson`. Result: `ok: true`.
   - `openchamber.contributes.origins: ["https://api.github.com"]` parsed cleanly into `guest.origins`.
   - Note: `openchamber.capabilities: ["origins"]` is tolerated at top-level envelope, while SDK strictly tracks `requestedGuestCapabilities` from `contributes.origins`.
2. **Catalog Invalidation & Server Lifecycle:**
   - OpenChamber server caches catalog listings for 5,000ms (`CATALOG_CACHE_TTL_MS = 5000` in `catalog.js:423`).
   - No server or shared-service restart is required. On-disk manifest changes are picked up within 5 seconds.
3. **Effective Capability Grants & Security Enforcement:**
   - In `grant-scope.js:73-75`:
     ```js
     if (capability === 'origins') {
       return Boolean(stored?.origins) && sameList(stored.origins, current.origins ?? []);
     }
     ```
   - In `routes.js:873`:
     ```js
     const origins = guest.capabilityGrants?.includes('origins') && Array.isArray(guest.origins) ? guest.origins : [];
     res.setHeader('Content-Security-Policy', `sandbox allow-scripts; ${guestFramePolicy(connectSource, origins)}`);
     ```
   - In current `/workspace/.openchamber-data/extensions.json`: `stored.capabilityGrants` lacks `'origins'` and `stored.capabilityScopes` lacks `origins: ["https://api.github.com"]`.
   - Result: `guest.capabilityGrants` does NOT include `'origins'` until user approves the extension in UI.
   - When approved, host updates `extensions.json` with `origins` in both `capabilityGrants` and `capabilityScopes`. Subsequent HTML served includes `https://api.github.com` in CSP `connect-src`.

---

## 4. Oracle Authenticity & Red/Green Mutation Probes

All five tests in `test/d12-origins-cache.test.js` drive the real production bundle (`panel/main.js`) via `test/test-app-harness.js`. Controlled mutation probes confirmed that test assertions strictly catch regressions:

### Probe 1: Remove Origins Capability from Manifest
- **Mutation:** Removed `"origins"` from `package.json:openchamber.capabilities`.
- **Result:** RED — Test 1 (`D12 Manifest`) failed with:
  `AssertionError: openchamber.capabilities must include "origins"` (actual: false, expected: true).
- **Restoration:** Restored `package.json` to HEAD. Result: GREEN (5/5 passing).

### Probe 2: Disable Direct-to-Host.Request Fallback on Fetch Failure
- **Mutation:** Modified `panel/main.ts:1169` to rethrow errors on GET instead of falling back to `host.request`. Rebuilt `panel/main.js`.
- **Result:** RED — Tests 3 and 4 failed:
  - Test 3 (`D12 Fallback Integrity: direct fetch network/CSP failure`): failed with `TypeError: Failed to fetch`.
  - Test 4 (`D12 Fallback Integrity: direct fetch 401 authentication failure`): failed with `Error: GitHub PAT authentication failed (401)`.
- **Restoration:** Restored `panel/main.ts` and `panel/main.js`. Result: GREEN (5/5 passing).

### Probe 3: Suppress If-None-Match Header Forwarding
- **Mutation:** Removed `...(headers || {})` from direct fetch headers in `panel/main.ts:1130`. Rebuilt `panel/main.js`.
- **Result:** RED — Test 5 (`D12 Direct Activation: direct fetch sends ETag / If-None-Match and handles 304 without host.request`):
  `AssertionError: Expected values to be strictly equal: + undefined - 'W/"direct-304-etag"'`.
- **Restoration:** Restored `panel/main.ts` and `panel/main.js`. Result: GREEN (5/5 passing).

---

## 5. Test Suite & Gate Verification

- **Static Typecheck:** `npm run typecheck` (`tsc --noEmit`) -> Exit `0`, 0 errors.
- **Bundle Compilation:** `npm run build` (`esbuild panel/main.ts ...`) -> 476.6kb.
- **Byte Parity:** `git diff --exit-code panel/main.js` -> Exit `0` (clean byte parity).
- **Targeted D12 Suite:** `node --test test/d12-origins-cache.test.js` -> 5 passed, 0 failed.
- **Full Test Suite:** `node --test test/*.test.js` -> 288 passed, 0 failed (283 baseline + 5 new).
  - Note: Known wall-clock timing flake (`scale-and-adversarial.test.js:144`) did not trigger (passed on initial execution).
- **Secret Wall Audit:** Zero tokens, secret prefixes (`ghp_`, `gho_`, `github_pat_`), credentials, or sensitive headers in diffs, commit history, or test artifacts.

---

## 6. Skeptical Review of Post-Merge Verification Recipe

### Corrected Recipe for Empirical Served-Panel Proof
1. **Target Real Served Panel:** Inspect `/api/guests/github-task-board/index.html` inside OpenChamber iframe.
2. **Approve Capabilities in UI (Mandatory Prerequisite):**
   - Navigate to OpenChamber Settings -> Extensions -> Task Board.
   - Click "Approve" for the newly requested `origins` capability (`https://api.github.com`).
3. **Verify Served CSP Header:**
   - In DevTools Network tab, inspect response headers for `index.html`.
   - Confirm `Content-Security-Policy` header contains `https://api.github.com` in `connect-src`.
4. **Capture First Request (200 OK + ETag):**
   - Allow board to load issues for active repository.
   - Observe `GET https://api.github.com/repos/<owner>/<repo>/issues?...` -> `200 OK`.
   - Confirm response header contains `ETag: W/"..."`.
5. **Capture Second Request (304 Not Modified):**
   - Do NOT click the manual "Refresh" button (which busts cache).
   - In repo picker popover, re-select the current repository to trigger non-forced `fetchIssues(false)`, or trigger an agent session idle event.
   - Observe request `GET https://api.github.com/repos/<owner>/<repo>/issues?...` -> `304 Not Modified`.
   - Verify Request header has `If-None-Match: <matching etag>`.
   - Verify Response body is 0 bytes and board UI retains all issues.
6. **Credential Safety:** DevTools header inspection must be visual only; do not copy/paste raw headers or export HAR files containing authentication tokens.

---

## 7. Verification Ladder Summary

- **L0 Static:** `PASS` (`tsc --noEmit` exit 0, schema validated).
- **L1 Unit / Regression:** `PASS` (288/288 tests pass; 5/5 real-oracle bundle tests; 3 red/green mutation probes).
- **L2 Integration:** `PASS` (Host schema, catalog resolution, and grant scopes verified against installed host code).
- **L3 End-to-End / "The User's Way":** `NOT RUN` (Live served panel CSP and real browser 304 network capture deferred to post-merge integration; synthetic tests do not substitute for empirical browser proof).
- **L4 Hostile Review:** `PASS` with conditions (4 findings catalogued; recipe flaws isolated and corrected).
- **L5 Human Validation:** `AWAITING BATCH` (Cannot be waived because capability grant involves user-facing permission approval prompt in Settings).
