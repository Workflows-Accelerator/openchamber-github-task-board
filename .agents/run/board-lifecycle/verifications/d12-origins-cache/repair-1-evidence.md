# D12 Repair 1 Evidence: Hostile Review Findings Resolution

**Target Branch:** `feat/d12-origins-etag`  
**Date:** October 8, 2026  
**Author:** Dynamic Agent (Engineer Tier)  
**Status:** COMPLETE — All 4 findings resolved, 0 residual defects, gates green.

---

## 1. Dispositions & Resolution Summary

| Finding | Severity | Disposition | Resolution Status |
|---|---|---|---|
| **F-01** | **HIGH** | State prerequisite prominently in `report.md` recipe preconditions and `proof.md`. User performs approval; do not script or automate. | **RESOLVED** — Documented in `report.md` (Prerequisites & Step-by-Step) and `proof.md`. Explains OpenChamber `grant-scope.js:73-75` and `routes.js:873` requirement for manual UI capability approval in Settings -> Extensions before CSP `connect-src` is granted. |
| **F-02** | **MEDIUM** | Rewrite recipe capture steps to trigger a non-forced fetch verified against production code; document why manual Refresh must not be pressed. | **RESOLVED** — Production code traced: `refreshTasks()` in `panel/main.ts:6497-6508` explicitly clears ETag and body caches and calls `fetchIssues(true)` with `force=true`, eliminating `If-None-Match`. Recipe rewritten to use non-forced triggers: (1) repo re-selection via popover after in-memory TTL expires, or (2) session activity transition to idle (`handleIdleRefresh`). |
| **F-03** | **LOW** | Remove all timer-polling claims in D12 artifacts (`report.md`, `proof.md`); match D11 reality (zero timers; session idle transitions + conditional reads). | **RESOLVED** — Eliminated 60s idle polling claim from `report.md:157` and verified zero remaining timer references across D12 verification artifacts. Background sync is event-driven only. |
| **F-04** | **LOW** | Add surgical origin guard in direct-fetch path (`panel/main.ts:1120`), confining token strictly to `https://api.github.com` and falling back to `host.request` for any other origin; prove with red/green test in `test/d12-origins-cache.test.js`. | **RESOLVED** — Surgical check `if (url.origin === 'https://api.github.com')` implemented. Red/green mutation probe confirmed: mutating guard off failed test 6; restoring guard passed test 6 (6/6 D12 suite, 289/289 full suite). |

---

## 2. Production Code Tracing for Non-Forced Fetch (F-02 & F-03)

### Why Manual "Refresh" Busts Cache
In `panel/main.ts:6497-6508`:
```ts
const refreshTasks = () => {
  commentsCache.clear();
  pageBodyCache.clear();
  issueListEtagCache.clear();
  repoIncrementalEtagCache.clear();
  if (isAllProjectsMode) {
    void discoverWorkspaceRepositories().then(() => fetchAllProjectIssues(true));
  } else {
    void fetchIssues(true);
    void discoverWorkspaceRepositories();
  }
};
```
- Both `issueListEtagCache` and `pageBodyCache` are explicitly cleared.
- `fetchIssues(true)` is called with `force=true`.
- In `panel/main.ts:1370-1373`:
  ```ts
  const cachedPage1 = !force ? pageBodyCache.get(page1Path) : undefined;
  const page1Etag = cachedPage1?.etag || (!force ? issueListEtagCache.get(page1Path) : undefined);
  const canSendEtag = Boolean(page1Etag && (cachedPage1?.items?.length || issues.length > 0));
  const page1Headers = canSendEtag && page1Etag ? { 'If-None-Match': page1Etag } : undefined;
  ```
- Because `force === true`, `page1Etag` is `undefined` and `page1Headers` is `undefined`. No `If-None-Match` header is sent.
- GitHub is forced to respond with `200 OK` full payload. An empirical `304 Not Modified` is impossible via the Refresh button.

### Real Non-Forced Fetch Triggers in Production Code
1. **Repository Selector Re-selection (`fetchIssues(false)`):**
   - In `panel/main.ts:833`: `setRepository()` calls `fetchIssues()` (default `force=false`).
   - When the 60-second in-memory `ISSUE_CACHE_TTL_MS` expires, or when switching away and back:
     - `readCachedIssueCollection()` cache miss occurs.
     - `fetchIssues` proceeds to network fetch.
     - `page1Etag` is retrieved from `issueListEtagCache` / `pageBodyCache`.
     - `page1Headers = { 'If-None-Match': page1Etag }` is sent.
     - Direct `fetch()` to `https://api.github.com/repos/...` sends `If-None-Match`.
     - GitHub responds with `304 Not Modified`.
2. **Session Idle Event Transition (`handleIdleRefresh`):**
   - In `panel/main.ts:1743-1779`: `handleIdleRefresh(currentSessions, previousSessions)` detects session transitions where `s.activity === 'idle'` and previous activity was not idle.
   - Invokes `syncRepoIncremental(cleanRepo, sinceIso, watermarkStart)` (`panel/main.ts:1652`).
   - In `panel/core.ts:2410-2475`: `syncIncrementalRepoIssues` attaches `If-None-Match: etag` from `repoIncrementalEtagCache`.
   - GitHub responds with `304 Not Modified` when no issues changed since watermark.

### Eradication of Timer-Polling Myth (F-03)
- Grep of `setInterval` across the codebase returns 0 occurrences in panel code (verified by test `Refresh Trigger: No setInterval / timer polling exists in panel codebase (D11 enforced)`).
- Passive waiting for 60 seconds does not trigger any network traffic. Background sync is strictly event-driven.

---

## 3. Origin Guard Implementation & Red/Green Mutation Proof (F-04)

### Surgical Implementation (`panel/main.ts:1118-1172`)
```ts
  if (pat && typeof pat === 'string') {
    try {
      const url = new URL(path, 'https://api.github.com/');
      if (url.origin === 'https://api.github.com') {
        if (query) {
          Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
        }
        const directRes = await fetch(url.toString(), {
          method,
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${pat.trim()}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(headers || {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        // ... handle 304, 200, 403, 401, etc. ...
      } else {
        addLog(`Direct PAT fetch rejected for origin ${url.origin}; falling back to host proxy...`, 'warn');
      }
    } catch (err: any) {
      if (err && err.rateLimited) throw err;
      if (method !== 'GET') throw err;
      addLog(`Direct PAT fetch failed (${err.message}), falling back to host proxy...`, 'warn');
    }
  }

  // 3. Fallback to host.request proxy
```

### Red/Green Mutation Probe
- **Target Test:** Test 6 in `test/d12-origins-cache.test.js` (`D12 Origin Guard: direct fetch confines token to https://api.github.com and falls back to host.request for non-approved origins`).
- **Mutation:** Replaced `if (url.origin === 'https://api.github.com')` with `if (true)` and rebuilt `panel/main.js`.
- **Result:** **RED** — Test 6 failed with:
  `AssertionError: Direct fetch must NOT be attempted for non-approved origin: https://not-github.com/api/v1/repos (true !== false)`.
- **Restoration:** Restored `if (url.origin === 'https://api.github.com')` and rebuilt `panel/main.js`.
- **Result:** **GREEN** — Test 6 passed; 6/6 D12 suite passed; 289/289 full suite passed.

---

## 4. Host Capability Approval Prerequisite Verification (F-01)

- In `@openchamber/web` (`grant-scope.js:73-75`):
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
- Because OpenChamber guest approvals are tracked in `~/.openchamber-data/extensions.json`, newly declared capabilities require explicit approval by the human operator in the OpenChamber UI under Settings -> Extensions -> Task Board -> Approve.
- Reloading the panel prior to approval will not grant the CSP origin.
- The catalog cache TTL is 5,000ms (`CATALOG_CACHE_TTL_MS = 5000` in `catalog.js:423`); no server process restart is needed.

---

## 5. Gate Verification Results

- **Static Typecheck:** `npm run typecheck` (`tsc --noEmit`) -> Exit `0`, 0 errors.
- **Bundle Build:** `npm run build` (`esbuild panel/main.ts ...`) -> 476.9kb.
- **Byte Parity:** `git diff --exit-code panel/main.js` -> Exit `0` (clean byte parity).
- **D12 Test Suite:** `node --test test/d12-origins-cache.test.js` -> 6 passed, 0 failed.
- **Full Test Suite:** `node --test test/*.test.js` -> 289 passed, 0 failed (283 baseline + 6 D12 tests).
- **Known Flake:** `test/scale-and-adversarial.test.js:144` did not flake (passed on first run).
- **Secret Wall Compliance:** Clean — zero secrets, PAT prefixes, or credentials in diffs, logs, or fixtures.
