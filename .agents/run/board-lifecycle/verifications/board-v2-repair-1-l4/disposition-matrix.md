# Findings Disposition & Residual Gap Matrix

**Target:** Commit `00ac1b9` on `fix/v2-binding-ratelimit-review-repair`  
**Base:** `656cc4f`  
**Review Type:** Independent Hostile Verification (L4)  

---

## 1. Original Findings Matrix (F-01 through F-14)

| Finding | Severity | Category | File & Line | Previous Defect (656cc4f) | Repaired Status (00ac1b9) | L4 Empirical Verification | Verdict |
|:---:|---|---|---|---|---|---|:---:|
| **F-01** | CATASTROPHIC | Data Loss | `panel/core.ts:1943-2005` | Deduplicated solely by numeric `issue.number`. Repo A #10 clobbered Repo B #10. | Deduplicates by `${repo.toLowerCase()}#${issue.number}` with bare-key backward compatibility. | Tested 3 colliding repos + closed duplicate in `test-identity-and-binding.test.js`. All survive. | **PROCEED** |
| **F-02** | CATASTROPHIC | Data Loss | `panel/main.ts:1240-1280` | `streamRemainingPages` had no page body cache; 304 on page 2 dropped all remaining pages. | Bounded `pageBodyCache` restores previous page body on 304. | Tested real `streamRemainingPages` in `production-orchestration.test.js: Test 1`. 145 items preserved. | **PROCEED** |
| **F-03** | CATASTROPHIC | Core Flow | `panel/main.ts:1360-1380` | Cold start 304 with empty in-memory issues fell through to `[]` and overwrote storage. | Checks `pageBodyCache`; if empty, retries unconditionally once. | Code verified; unconditional retry path exercised on cold starts. | **PROCEED** |
| **F-04** | HIGH | Data Loss | `panel/core.ts:2412-2437` | `syncIncrementalRepoIssues` only fetched page 1 (`per_page=100`), dropping changes >100. | Loops `page = 1..10` while `res.length === 100`. | Tested real `syncIncrementalRepoIssues` with 150 items across 2 pages in `review-repairs.test.js: Test 2`. | **PROCEED-WITH-CONDITIONS** (Residual D-04: >1000 items silently truncated) |
| **F-05** | HIGH | Spec Violation | `panel/main.ts:1715-1738` | Idle refresh did targeted-only sync, violating D11 B1 full-scope contract. | Syncs all configured repos in `allProjectsRepoRefs` regardless of session target. | Tested real `handleIdleRefresh` in `production-orchestration.test.js: Test 2`. All 3 repos synced. | **PROCEED** |
| **F-06** | HIGH | Cache Poisoning | `panel/main.ts:1660-1678` | In All Projects mode, wrote aggregated issue list into single repo storage. | Stores aggregated list exclusively in `ALL_PROJECTS_CACHE_KEY`. Filters per-repo caches. | Tested real `syncRepoIncremental` in `production-orchestration.test.js: Test 3`. Single-repo cache clean. | **PROCEED** |
| **F-07** | MEDIUM | Race Condition | `panel/main.ts:1620, 1656` | Switched repo after fetch clobbered active board with background repo items. | Guarded by `activeStreamEpoch`; writes to background storage only if switched. | Verified by AST and epoch check in `production-orchestration.test.js`. | **PROCEED** |
| **F-08** | MEDIUM | Visual Race | `panel/main.ts:4888-4935` | Slow comments response rendered into newly opened drawer for different issue. | Guarded by monotonic `drawerGeneration` counter and active issue match. | Tested real `loadComments` with out-of-order responses in `production-orchestration.test.js: Test 4`. | **PROCEED** |
| **F-09** | MEDIUM | Memory Leak | `panel/main.ts:1012, 1619` | Keyed ETags by full URLs with millisecond timestamps (`since=...`), leaking keys. | Replaced by `repoIncrementalEtagCache` keyed strictly by clean repository name. | Code verified; keying by `cleanRepo` confirmed. | **PROCEED** |
| **F-10** | MEDIUM | Freshness Loss | `panel/main.ts:800, 4586, 6352` | `commentsCache` 60s TTL was never cleared by Refresh, repo switch, or reopen. | Cleared on manual Refresh & repo switch; bypassed on fresh drawer open (`!isRerender`). | Verified by AST: `commentsCache.clear()` invoked in `refreshTasks()` and `setRepository()`. | **PROCEED** |
| **F-11** | MEDIUM | Integration Gap | `panel/main.ts:1100-1165` | SDK `GuestRequest` lacks custom headers; mutations fell back to proxy on PAT errors. | Non-GET mutations throw immediately without proxy fallback. Unconditional GET fallback documented. | Tested real `githubRequest` in `production-orchestration.test.js: Test 5`. POST throws on 500 error. | **PROCEED** |
| **F-12** | MEDIUM | State Mutation | `panel/core.ts:1934`<br>`panel/main.ts:6041` | `normalizeGithubIssues` stripped `repo`; `submitNewIssue` lost repo attribution. | Preserves `repo` in `normalizeGithubIssues`; `submitNewIssue` tags created issue. | Tested real `normalizeGithubIssues` in `review-repairs.test.js: Test 3`. | **PROCEED-WITH-CONDITIONS** (Residual D-01: `user: undefined` breaks storage) |
| **F-13** | LOW | Attribution Gap | `panel/core.ts:1226-1236, 1341` | `buildMultiIssueAttachPayload` attributed all numbers to first repo in multi-repo bundles. | Stores per-issue repos in `data.issues`; `sessionRepoKeys` preserves individual repos. | Tested real `buildMultiIssueAttachPayload` and `sessionRepoKeys` in `test-identity-and-binding.test.js: Test 3`. | **PROCEED** |
| **F-14** | LOW | Functional Flaw | `panel/main.ts:1791, 2761`<br>`panel/labels.ts:182` | Dragging to "none" subgroup guarded `subgroupId !== 'none'`, leaving priority labels. | Passes `newPriorityGroup: 'none'`, stripping all `priority:*` labels cleanly. | Tested real `updatePriorityLabels` in `review-repairs.test.js: Test 5`. | **PROCEED** |

---

## 2. Structural & Architectural Invariants Evaluated

### 2.1 Watermarks & Incremental Synchronization
- **Safety Overlap:** `since = Math.max(0, prevWatermark - 10_000)` (10-second overlap) handles clock skew and transaction commit latency. Verified in `panel/main.ts:1730`.
- **Completion-Only Advance:** `repoSyncWatermarks.set(cleanRepo, watermarkTime)` runs only upon full successful retrieval of all pages. If an error is thrown, the watermark is NOT updated. Verified in `panel/main.ts:1637`.
- **Idle Event Coalescing:** If an idle occurs while `isIdleSyncing` is active, `pendingIdleRefresh = true` triggers a trailing pass in a `do ... while (pendingIdleRefresh)` loop. Verified in `panel/main.ts:1715-1738`.

### 2.2 GitHub REST API Deletions & Transfers
- **Contract Reality:** `GET /repos/{owner}/{repo}/issues?since={iso}` returns only created or updated issues. Deleted issues or transferred issues do NOT appear in the feed.
- **Freshness Gap Status:** The board will retain deleted or transferred issues across idle syncs until a manual Refresh (`refreshTasks()`) or cache clear occurs.
- **Decision Alignment:** This is an inherent property of the GitHub REST API that cannot be solved without full refetches (which was explicitly rejected by D11 due to rate-limit quotas). The gap is properly documented in the builder report.

### 2.3 OpenChamber SDK Host Proxy Headers
- **Contract Reality:** `@openchamber/sdk` `GuestRequest` defines only `{ method, path, query, body }`. It does NOT permit passing custom request headers (`If-None-Match`), and `GuestRequestResult` returns `{ status, body }` without response headers (`ETag`).
- **Degradation Path:** Non-PAT users automatically execute standard unconditional GET requests via `host.request`. This is functionally correct and preserves board state, but yields no HTTP 304 quota savings. Conditional ETags are active only when a workspace PAT is present.

---

## 3. Hostile Defect Register (New / Residual Findings)

### Finding D-01: `normalizeGithubIssues` Sets `user: undefined`, Violating SDK JSON Validation and Breaking Persistent Storage
- **File & Line:** `panel/core.ts:1928`
- **Severity:** HIGH (PERSISTENT STORAGE CORRUPTION / UNHANDLED REJECTION)
- **Hostile Test Proof:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js: Test 7` (PASS).
- **Mechanism:**
  Line 1928 in `panel/core.ts`:
  ```ts
  user: issue.user ? { login: issue.user.login, avatar_url: issue.user.avatar_url } : undefined,
  ```
  When an issue has no user (e.g. author deleted on GitHub, synthetic issues created by extensions, or local mocks), `user` is set to `undefined`.
  In `@openchamber/sdk` (bundled in `panel/main.js` lines 203-217 and 663):
  ```js
  var isJsonValue = (value) => {
    if (value === void 0) return false;
    // ...
    if (Object(value) === value) return Object.values(value).every(isJsonValue);
    return false;
  };
  // In storage set:
  if (payload.op === "set" && !isJsonValue(payload.value)) {
    throw new HostRequestError("HOST_REJECTED", "Storage values must be JSON.");
  }
  ```
  `Object.values(issue)` includes `undefined`. `isJsonValue` evaluates to `false`.
  Calling `host.storage.set(storageKey, { timestamp, issues })` fails with `HostRequestError: Storage values must be JSON.`.
  Because `void host.storage.set(...)` is called without `.catch()` in `streamRemainingPages` (line 1286), `fetchIssues` (line 1399), `fetchAllProjectIssues` (line 1578), and `syncRepoIncremental` (line 1664), this creates an unhandled promise rejection and prevents caching issues to storage.
- **Minimal Repair:**
  In `panel/core.ts:1928`, omit the `user` property entirely when `issue.user` is falsy:
  ```ts
  ...(issue.user ? { user: { login: issue.user.login, avatar_url: issue.user.avatar_url } } : {}),
  ```

---

### Finding D-02: `repoForIssue` Returns `'__all_projects__'` Sentinel for Items with Unknown Repo in All Projects Mode
- **File & Line:** `panel/main.ts:1742-1745`
- **Severity:** MEDIUM (SPEC VIOLATION & INVALID GITHUB API REQUESTS)
- **Hostile Test Proof:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js: Test 6` (PASS).
- **Brief Constraint:** *"Unknown old item repo remains unknown, never guess or force all-projects sentinel as repo."*
- **Mechanism:**
  ```ts
  function repoForIssue(issue: Issue | null | undefined): string {
    if (issue && isAllProjectsMode && issue.repo) return issue.repo;
    return currentRepo;
  }
  ```
  When `isAllProjectsMode` is active, `currentRepo` is `'__all_projects__'`.
  If `issue.repo` is missing or unknown, `repoForIssue` falls back to `currentRepo`, returning `'__all_projects__'`.
  This causes:
  1. `updateIssueStatus` to PATCH `/repos/__all_projects__/issues/{number}` (HTTP 404 / 422).
  2. `loadComments` to GET `/repos/__all_projects__/issues/{number}/comments` (HTTP 404).
- **Minimal Repair:**
  ```ts
  function repoForIssue(issue: Issue | null | undefined): string {
    if (issue?.repo && issue.repo !== ALL_PROJECTS_CACHE_KEY) return issue.repo;
    if (isAllProjectsMode) return '';
    return currentRepo;
  }
  ```
  In callers (`updateIssueStatus`, `updateIssueBody`, `loadComments`), check `if (!repo)` and cleanly abort with a warning rather than dispatching a broken HTTP request.

---

### Finding D-03: `fetchIssues` & `fetchAllRepoIssuePages` Perform Aggregate Cache Substitution on Page 1 HTTP 304
- **File & Line:** `panel/main.ts:1365-1370`, `1452-1455`
- **Severity:** MEDIUM (AGGREGATE CACHE SUBSTITUTION / SKIP LATER PAGES)
- **Hostile Test Proof:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js: Test 8` (PASS).
- **Brief Constraint:** *"existing global 'issues.length > 0' is not a page cache; page1 304 says nothing about page2... Don't hide later pages with 304 or aggregate cache substitution."*
- **Mechanism:**
  In `fetchIssues`:
  ```ts
  if (page1Raw && (page1Raw.notModified || page1Raw.status === 304)) {
    // ...
    if (issues.length > 0) {
      if (cachedPage1) setCachedPage(page1Path, cachedPage1.items, page1Raw.etag || page1Etag);
      renderViews();
      statusReconciler.schedule(issues);
      return;
    }
  ```
  When page 1 returns 304, if in-memory `issues.length > 0`, it immediately returns at line 1369.
  It NEVER executes line 1412: `if (page1Items.length >= 100) void streamRemainingPages(...)`.
  Similarly in `fetchAllRepoIssuePages` line 1453:
  ```ts
  if (firstRaw && (firstRaw.notModified || firstRaw.status === 304)) {
    if (cachedRepoIssues && cachedRepoIssues.length > 0) return cachedRepoIssues;
  ```
  It immediately returns `cachedRepoIssues` without checking if pages 2+ need streaming.
- **Minimal Repair:**
  When page 1 returns 304, if `cachedPage1?.items?.length >= 100` (or `issues.length >= 100`), still schedule `streamRemainingPages` to verify/reconstruct pages 2+.

---

### Finding D-04: `syncIncrementalRepoIssues` Silently Truncates Feeds Exceeding 10 Pages (1,000 Changes)
- **File & Line:** `panel/core.ts:2412-2437`
- **Severity:** LOW (EDGE-CASE TRUNCATION / NO USER WARNING)
- **Brief Constraint:** *"Existing pagination cap must not mark incomplete data as a complete baseline; flag limitation or fail visibly."*
- **Mechanism:**
  `syncIncrementalRepoIssues` loops `while (page <= MAX_INCREMENTAL_PAGES)` (where `MAX_INCREMENTAL_PAGES = 10`).
  If a repository has >1,000 issue updates since the last watermark, it exits the loop after page 10. `repoSyncWatermarks` advances to `Date.now()`, permanently skipping issues on page 11+. No warning or truncation indicator is returned.
- **Minimal Repair:**
  Return `{ issues, modified, changedCount, etag, truncated: boolean }` from `syncIncrementalRepoIssues`. If `truncated === true`, log a warning or display a toast notification, and do not advance the watermark to request completion.
