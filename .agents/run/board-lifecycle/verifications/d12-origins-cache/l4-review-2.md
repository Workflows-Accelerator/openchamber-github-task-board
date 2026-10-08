# L4 Hostile Re-Review (Iteration 2): D12 Direct-Origins Caching Activation

**Target Branch:** `feat/d12-origins-etag` (HEAD at `7a44a93`, review-1 base at `2461bd5`, branch base `f849dce`)  
**Auditor:** Dynamic Subagent (Engineer Tier — Hostile Prover)  
**Date:** October 8, 2026  
**Status:** COMPLETE — All Repair-1 findings resolved, zero residual defects.

---

## 1. Verdicts

- **Spec Verdict:** `PASS` — The direct-fetch origin guard strictly confines token forwarding to `url.origin === 'https://api.github.com'`, preserving host fallback proxy routing for non-approved origins, missing tokens, network/CSP rejections, and 401 authentication errors. Manifest keeps all pre-existing capabilities with only `"origins"` appended and `contributes.origins: ["https://api.github.com"]`.
- **Quality Verdict:** `APPROVED` — All 4 findings from the first review are verified resolved: (F-01) OpenChamber Settings -> Extensions human capability approval prerequisite is prominently disclosed, (F-02) the post-merge recipe uses verified non-forced triggers and explicitly warns against clicking the cache-busting manual Refresh button, (F-03) all interval/timer-polling claims have been excised from D12 artifacts, and (F-04) the origin guard is proven effective against bypass attacks with red/green oracle validation.
- **Overall Operational Verdict:** `PROCEED` — The branch is ready for integration merge into dev/preview. Post-merge verification must execute the corrected recipe (Settings -> Extensions -> Approve Task Board capabilities -> non-forced repo switch or session idle event for 304). L3 served-panel network proof remains `NOT RUN` pending served environment deployment.

---

## 2. Repair-1 Findings Resolution Matrix

| Finding | Severity | File:Line | Disposition & Required Fix | Auditor Independent Verification Result | Status |
|---|---|---|---|---|---|
| **F-01** | **HIGH** | `report.md:120`, `proof.md:71` | Prominently disclose mandatory OpenChamber human capability approval prerequisite in Settings -> Extensions prior to panel reload. Explain 5s catalog cache TTL and no server restart requirement. State that human operator must perform approval (agents must never automate). | Verified in `report.md` Section 7 and `proof.md`. Explains OpenChamber `grant-scope.js:73-75` and `routes.js:873` mechanisms. Explicitly warns that panel reload without approval will not grant CSP origin. | **RESOLVED** |
| **F-02** | **MEDIUM** | `report.md:162`, `panel/main.ts:6497` | Remove instruction to click manual Refresh button (which clears ETag caches and passes `force=true`). Rewrite capture steps to trigger a verified non-forced fetch. | Verified against production code: `refreshTasks()` clears `pageBodyCache` and `issueListEtagCache` and invokes `fetchIssues(true)`. Recipe now details two verified non-forced paths: Option 1 (repo re-selection after TTL) and Option 2 (session idle event transition). | **RESOLVED** |
| **F-03** | **LOW** | `report.md:166`, `proof.md:73` | Remove 60s timer-polling myth from D12 artifacts; match D11 reality (zero timers, event-driven idle sync + conditional reads). | Comprehensive grep confirmed 0 timer polling claims remain in D12 artifacts. Grep for `setInterval` in panel code returns 0 (verified by test suite). | **RESOLVED** |
| **F-04** | **LOW** | `panel/main.ts:1120`, `test/d12-origins-cache.test.js:195` | Add surgical origin guard confining direct token fetch strictly to `https://api.github.com` and falling back to `host.request` for unapproved origins; prove with red/green test. | Verified surgical check `if (url.origin === 'https://api.github.com')` in `panel/main.ts:1121`. Tested with red/green mutation probe and 9 adversarial URL trickery probes. All passed. | **RESOLVED** |

---

## 3. Adversarial Security & Origin Guard Audit (F-04)

### 3.1 Red/Green Mutation Probe
- **Probe:** Mutated `panel/main.ts:1121` from `if (url.origin === 'https://api.github.com')` to `if (true)`.
- **Bundle Rebuild:** Executed `npm run build` (`esbuild panel/main.ts ... -> panel/main.js`).
- **Mutation Run:** Ran `node --test test/d12-origins-cache.test.js`.
  - **Result:** **RED** — Test 6 (`D12 Origin Guard: direct fetch confines token to https://api.github.com and falls back to host.request for non-approved origins`) strictly failed:
    `AssertionError: Direct fetch must NOT be attempted for non-approved origin: https://not-github.com/api/v1/repos (true !== false)`.
- **Restoration:** Restored `panel/main.ts` and rebuilt bundle (`git diff --exit-code panel/main.js` clean).
  - **Result:** **GREEN** — Test 6 passed; 6/6 tests in `test/d12-origins-cache.test.js` passed.

### 3.2 Hostile URL Trickery & Bypass Analysis
To ensure that `new URL(path, 'https://api.github.com/')` combined with `url.origin === 'https://api.github.com'` cannot be bypassed via userinfo, port manipulation, subdomain spoofing, or scheme confusion, 9 hostile test vectors were evaluated against the real production bundle via `test-app-harness.js`:

| # | Hostile URL Probe | WHATWG Parsed Origin | Guard Result | Direct Fetch Blocked | Fallback Behavior |
|---|---|---|---|---|---|
| 1 | `https://api.github.com@evil.example/` | `https://evil.example` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; rejected by path validator |
| 2 | `https://evil.example/@api.github.com/` | `https://evil.example` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; rejected by path validator |
| 3 | `https://api.github.com./repos` (trailing dot) | `https://api.github.com.` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; rejected by path validator |
| 4 | `https://api.github.com:8080/repos` (non-443 port) | `https://api.github.com:8080` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; rejected by path validator |
| 5 | `http://api.github.com/repos` (plaintext HTTP) | `http://api.github.com` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; rejected by path validator |
| 6 | `//evil.example/repos` (protocol-relative) | `https://evil.example` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; handled cleanly |
| 7 | `//api.github.com.attacker.com/repos` | `https://api.github.com.attacker.com` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; handled cleanly |
| 8 | `//not-github.com/api/v1/repos` | `https://not-github.com` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; handled cleanly |
| 9 | `javascript:alert(1)` (scheme injection) | `null` | Reject (`!==`) | YES (0 direct fetches) | Falls back to host proxy; rejected by path validator |

**Outcome:** Zero bypasses possible. In all cases, `directFetchAttempted === false`, the PAT was never forwarded to external endpoints, and requests cleanly routed to `host.request`.

---

## 4. Production Code Tracing: Non-Forced Fetch (F-02 & F-03)

Audited `panel/main.ts` and `panel/core.ts` to independently confirm the recipe mechanisms:
1. **Manual Refresh Cache Busting:**
   - In `panel/main.ts:6497-6508`, `refreshTasks()` calls:
     ```ts
     commentsCache.clear();
     pageBodyCache.clear();
     issueListEtagCache.clear();
     repoIncrementalEtagCache.clear();
     fetchIssues(true);
     ```
   - In `panel/main.ts:1370-1373`: `cachedPage1 = !force ? pageBodyCache.get(page1Path) : undefined`. When `force=true`, `page1Headers` is `undefined`, sending NO `If-None-Match`. GitHub always returns `200 OK`. The recipe's warning against clicking Refresh is 100% correct.
2. **Option 1 (Repo Re-selection):**
   - In `panel/main.ts:796-798`: `if (!force && currentRepo === repo) return;`.
   - In `panel/main.ts:1336`: `const cached = readCachedIssueCollection(issueCache, currentRepo, ISSUE_CACHE_TTL_MS);`.
   - If the operator re-selects the repository after the 60s memory cache TTL (`ISSUE_CACHE_TTL_MS = 60000`) has elapsed, or switches projects/sessions, `fetchIssues(false)` sends `page1Headers = { 'If-None-Match': page1Etag }` to GitHub, returning `304 Not Modified`.
3. **Option 2 (Session Idle Event Transition):**
   - In `panel/main.ts:1743-1779`: `handleIdleRefresh()` detects `s.activity === 'idle'` and calls `syncRepoIncremental()`.
   - In `panel/core.ts:2439-2442`: `syncIncrementalRepoIssues` attaches `If-None-Match: etag` from `repoIncrementalEtagCache`.
   - On unchanged repository state, GitHub returns `304 Not Modified` with 0 bytes body.
4. **Timer Polling Elimination:**
   - Grep for `setInterval` returns 0 across panel runtime code.
   - Background synchronization is strictly event-driven (session activity transitions and explicit UI actions).

---

## 5. Test Suite & Gate Verification

- **Static Typecheck:** `npm run typecheck` (`tsc --noEmit`) -> Exit `0`, 0 errors.
- **Bundle Compilation:** `npm run build` (`esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js`) -> 476.9kb, exit 0.
- **Byte Parity:** `git diff --exit-code panel/main.js` -> Exit `0` (clean byte parity).
- **Targeted D12 Suite:** `node --test test/d12-origins-cache.test.js` -> 6 passed, 0 failed (428ms).
- **Full Test Suite:** `node --test test/*.test.js` -> 289 passed, 0 failed (3,521ms).
  - Baseline count: 283 tests
  - D12 additions: 6 tests (5 original + 1 origin guard test)
  - Known wall-clock flake (`scale-and-adversarial.test.js:144` <60ms budget) passed on first execution.
- **Scope Audit:** Diff between `2461bd5` and `7a44a93` touches only:
  - `panel/main.ts` (origin guard)
  - `panel/main.js` (rebuilt bundle)
  - `test/d12-origins-cache.test.js` (guard test)
  - `.agents/run/board-lifecycle/verifications/d12-origins-cache/report.md`
  - `.agents/run/board-lifecycle/verifications/d12-origins-cache/repair-1-evidence.md`
  - `.agents/run/board-lifecycle/verifications/proof.md`
  Zero modifications to `package.json`, `panel/core.ts`, UI HTML, or unrelated files.
- **Secret Wall Compliance:** Audited all diffs, commit messages, and test artifacts. Zero token strings, PAT prefixes (`ghp_`, `gho_`, `github_pat_`), credentials, or sensitive headers exposed.

---

## 6. Verification Ladder Summary

- **L0 Static:** `PASS` (`tsc --noEmit` exit 0, manifest schema validated).
- **L1 Unit / Regression:** `PASS` (289/289 tests pass; 6 real-oracle bundle tests; red/green mutation confirmed; 9 URL trickery probes blocked).
- **L2 Integration:** `PASS` (OpenChamber manifest schema, host catalog 5s TTL, and capability grant scope rules verified against host code).
- **L3 End-to-End / "The User's Way":** `NOT RUN` (Live served panel iframe CSP and real `api.github.com` 304 network capture deferred to post-merge integration; recipe feasibility verified).
- **L4 Hostile Review:** `PASS` (Iteration 2 complete; all 4 findings verified resolved).
- **L5 Human Validation:** `AWAITING BATCH / HUMAN` (Requires human user to approve `origins` capability in OpenChamber Settings -> Extensions).
