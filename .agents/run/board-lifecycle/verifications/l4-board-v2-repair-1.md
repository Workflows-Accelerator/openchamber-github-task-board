# L4 Hostile Review: Task Board V2 Session Binding & Rate-Limit Repair (Repair 1)

**Target Repository:** `/workspace/extensions/github-task-board`  
**Commit Reviewed:** `00ac1b9` (`fix: resolve L4 findings F-01 through F-14 for V2 binding and rate limits`)  
**Base Commit:** `656cc4f` (`feat: V2 session binding repo injection and D11 rate-limit optimizations`)  
**Branch:** `fix/v2-binding-ratelimit-review-repair`  
**Worktree Location:** `/workspace/extensions/github-task-board/.worktrees/team-dev-v2-binding-ratelimit-review-repair`  
**Review Type:** Independent Read-Only Hostile Adversarial Review (L4)  
**Host Environment:** OpenChamber v2.0.4, OpenCode v2.0.21, Node.js v22.23.3, Linux x86_64  
**Date:** October 2026  
**Auditor:** Independent Dynamic Subagent (L4 Hostile Reviewer)  
**Supporting Artifacts Directory:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/`  

---

## 1. Executive Verdict & Summary

### **OVERALL VERDICT: PROCEED-WITH-CONDITIONS**

Commit `00ac1b9` successfully resolves the catastrophic data-loss defects and structural flaws that resulted in the HALT verdict on commit `656cc4f`:
1. **Cross-Repo Collision Safety (F-01, F-12, F-13):** `mergeIssuePages` deduplicates via `${repo.toLowerCase()}#${issue.number}` with safe bare-key fallback. Empirically tested against 3 colliding repositories with open/closed duplicates; all issues survive with independent states.
2. **Page Body Cache on HTTP 304 (F-02, F-03):** `streamRemainingPages` recovers prior page bodies from `pageBodyCache` on 304 instead of dropping pages 2–10. Cold starts with 304 without cached body execute an unconditional retry rather than normalizing `[]` and rendering an empty board.
3. **Multi-Page Incremental Sync (F-04):** `syncIncrementalRepoIssues` loops up to 10 pages when changes exceed 100 items, merging all changed items without page-1 truncation.
4. **D11 B1 Full-Scope Idle Refresh (F-05):** In All Projects mode, `handleIdleRefresh` synchronizes all repositories in `allProjectsRepoRefs` across current scope, coalescing rapid events without targeted-only repository omission.
5. **Cache Isolation & Concurrency (F-06, F-07, F-09):** In All Projects mode, aggregated issues are saved exclusively under `ALL_PROJECTS_CACHE_KEY`, isolating single-repo caches. Incremental ETags are keyed strictly by clean repository name.
6. **Drawer Comment Race Guard (F-08, F-10):** Comment loading is protected by a monotonic `drawerGeneration` counter and active issue matching. Manual Refresh and repository switching cleanly clear `commentsCache`.
7. **Mutation Safety & Priority Clearing (F-11, F-14):** Non-GET mutations throw immediately on PAT failure without proxy fallback, preventing duplicate writes. Dragging to the "none" priority subgroup reliably clears priority labels.

However, hostile scrutiny revealed **test-oracle gaps** in the builder suite and **four residual defects** that require a bounded follow-up repair:
- **Test-Oracle Gap:** In `test/review-repairs.test.js`, 7 of the 12 tests (Tests 6–12) were local simulations / tautologies (`simulate*`) that bypassed production `main.ts` orchestration. The L4 auditor closed this gap by creating `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js` to execute the actual bundled functions.
- **Finding D-01 (HIGH):** `normalizeGithubIssues` sets `user: undefined` on issues lacking author metadata. `@openchamber/sdk` rejects objects containing `undefined` property values with `HOST_REJECTED: Storage values must be JSON.`, causing unhandled promise rejections and breaking persistent cache storage.
- **Finding D-02 (MEDIUM):** In All Projects mode, `repoForIssue` falls back to `currentRepo` (`'__all_projects__'`) for issues with unknown/missing repository attribution, generating invalid `PATCH /repos/__all_projects__/issues/{number}` and `GET /repos/__all_projects__/issues/{number}/comments` requests.
- **Finding D-03 (MEDIUM):** `fetchIssues` and `fetchAllRepoIssuePages` still perform aggregate cache substitution on page 1 HTTP 304 when in-memory `issues.length > 0`, skipping remaining page checks.
- **Finding D-04 (LOW):** `syncIncrementalRepoIssues` silently truncates after 10 pages (>1,000 items) without setting a truncation flag or alerting the user.

---

## 2. Component & Per-Item Verdicts (F-01 through F-14)

| # | Item / Finding | Previous State (656cc4f) | Repaired State (00ac1b9) | L4 Oracle Level | Verdict | Status & Notes |
|:---:|---|---|---|:---:|:---:|---|
| **F-01** | **Cross-Repo Issue Destruction** | Deduplicated by bare `issue.number`. Repo A #10 clobbered Repo B #10. | Repo-qualified key `${repo}#${number}`. | Production (`core.ts`) | **PROCEED** | Verified in `test-identity-and-binding.test.js: Test 1`. |
| **F-02** | **Page 2+ Dropping on 304** | No body cache; 304 executed `page++; continue;` dropping pages 2–10. | Bounded `pageBodyCache` restores previous page body. | Production (`main.js`) | **PROCEED** | Verified in `production-orchestration.test.js: Test 1`. |
| **F-03** | **Empty Board on Cold 304** | Cold 304 normalized `[]` and overwrote storage. | Retries unconditionally if no cached body. | Production (`main.js`) | **PROCEED** | Unconditional retry logic verified. |
| **F-04** | **Incremental Pagination Truncation** | Only fetched page 1 (`per_page=100`), truncating >100. | Loops `page = 1..10` while `res.length === 100`. | Production (`core.ts`) | **PROCEED-WITH-CONDITIONS** | Residual D-04: Feeds >1000 items silently truncated. |
| **F-05** | **D11 Contract Violation (Targeted Refresh)** | Synced only session-linked repo, skipping others. | Syncs all repos in `allProjectsRepoRefs`. | Production (`main.js`) | **PROCEED** | Verified in `production-orchestration.test.js: Test 2`. |
| **F-06** | **Cross-Repo Cache Poisoning** | Wrote multi-repo array into single-repo cache. | Aggregated saved to `__all_projects__`; single filtered. | Production (`main.js`) | **PROCEED** | Verified in `production-orchestration.test.js: Test 3`. |
| **F-07** | **Stale Response on Repo Switch** | Late network responses overwrote newly selected repos. | Guarded by `activeStreamEpoch`; writes background cache. | Production (`main.js`) | **PROCEED** | Verified by AST and epoch assertions. |
| **F-08** | **Drawer Comment Race Condition** | Slow response rendered into newly opened drawer. | Guarded by `drawerGeneration` and active issue. | Production (`main.js`) | **PROCEED** | Verified in `production-orchestration.test.js: Test 4`. |
| **F-09** | **ETag Cache Memory Leak** | Timestamped URL keys leaked dead cache entries. | Keyed strictly by clean repository name. | Production (`main.js`) | **PROCEED** | Keying by `cleanRepo` confirmed. |
| **F-10** | **Comment Freshness Loss** | 60s TTL never cleared on refresh, switch, reopen. | Cleared on Refresh & switch; bypassed on fresh drawer open. | Production (`main.js`) | **PROCEED** | Bypassed on open; cleared in `refreshTasks()`. |
| **F-11** | **Host Proxy Header Inoperability** | Custom headers dropped by SDK; mutations fell back. | Mutations throw immediately. GET fallback documented. | Production (`main.js`) | **PROCEED** | Verified in `production-orchestration.test.js: Test 5`. |
| **F-12** | **Repo Dropped on Issue Create** | `normalizeGithubIssues` stripped `repo`. | Preserves `repo` in normalization and create. | Production (`core.ts`) | **PROCEED-WITH-CONDITIONS** | Residual D-01: `user: undefined` breaks storage. |
| **F-13** | **Multi-Issue Attribution Gap** | All numbers attributed to first repo in bundle. | Per-issue repos preserved in `data.issues`. | Production (`core.ts`) | **PROCEED** | Verified in `test-identity-and-binding.test.js: Test 3`. |
| **F-14** | **Priority "none" Clearing Flaw** | Dragging to "none" did not clear priority labels. | Passes `newPriorityGroup: 'none'`, stripping labels. | Production (`labels.ts`) | **PROCEED** | Verified by `review-repairs.test.js: Test 5`. |

---

## 3. Test-Oracle Audit Findings

A critical finding of this L4 review is that the builder's regression suite in `test/review-repairs.test.js` exhibited a significant **oracle integrity deficit**:
- **Tests 1–5 (41.7%):** Correctly imported and executed production functions from `panel/core.ts` (`mergeIssuePages`, `syncIncrementalRepoIssues`, `normalizeGithubIssues`, `buildMultiIssueAttachPayload`, `sessionRepoKeys`) and `panel/labels.ts` (`updatePriorityLabels`).
- **Tests 6–10 and 12 (50.0%):** Defined local simulation functions (`simulatePageStream`, `simulateColdStartFetch`, `simulateLoadComments`, `simulateRequest`) or evaluated isolated local ternary expressions rather than invoking the served orchestration functions in `panel/main.ts` or `panel/main.js`.
- **Test 11 (8.3%):** Was a pure tautology: instantiated `new Map()`, called `.clear()`, and asserted `size === 0`, without executing `refreshTasks()` or `setRepository()`.

### Closing the Oracle Gap
To ensure the repair is evaluated against actual served production code, the L4 auditor developed `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js`. This harness instantiates `panel/main.js` with a mock DOM and OpenChamber SDK host bridge, successfully proving:
- `streamRemainingPages` recovering page 2 from `pageBodyCache` on 304 without dropping items.
- `handleIdleRefresh` executing full-scope sync across all repos in `allProjectsRepoRefs` (D11 B1 compliance).
- `syncRepoIncremental` preserving cache isolation between multi-project and single-project views.
- `loadComments` discarding out-of-order comment responses across rapid drawer navigation.
- `githubRequest` throwing on mutation failures without proxy fallback.

Full details are documented in `board-v2-repair-1-l4/test-oracle-matrix.md`.

---

## 4. Hostile Defect Register (Residual Defects)

### Finding D-01: `normalizeGithubIssues` Sets `user: undefined`, Breaking SDK Persistent Storage Validation
- **File & Line:** `panel/core.ts:1928`
- **Severity:** HIGH (PERSISTENT STORAGE CORRUPTION / UNHANDLED REJECTION)
- **Hostile Test Proof:** `production-orchestration.test.js: Test 7` (PASS).
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
- **Hostile Test Proof:** `production-orchestration.test.js: Test 6` (PASS).
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
- **Hostile Test Proof:** `production-orchestration.test.js: Test 8` (PASS).
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

---

## 5. Structural Invariants & Decision Alignment

### 5.1 Watermarks & Incremental Synchronization
- **Safety Overlap:** `since = Math.max(0, prevWatermark - 10_000)` (10-second overlap) handles clock skew and transaction commit latency. Verified in `panel/main.ts:1730`.
- **Completion-Only Advance:** `repoSyncWatermarks.set(cleanRepo, watermarkTime)` runs only upon full successful retrieval of all pages. If an error is thrown, the watermark is NOT updated. Verified in `panel/main.ts:1637`.
- **Idle Event Coalescing:** If an idle occurs while `isIdleSyncing` is active, `pendingIdleRefresh = true` triggers a trailing pass in a `do ... while (pendingIdleRefresh)` loop. Verified in `panel/main.ts:1715-1738`.

### 5.2 GitHub REST API Deletions & Transfers
- **Contract Reality:** `GET /repos/{owner}/{repo}/issues?since={iso}` returns only created or updated issues. Deleted issues or transferred issues do NOT appear in the feed.
- **Freshness Gap Status:** The board will retain deleted or transferred issues across idle syncs until a manual Refresh (`refreshTasks()`) or cache clear occurs.
- **Decision Alignment:** This is an inherent property of the GitHub REST API that cannot be solved without full refetches (which was explicitly rejected by D11 due to rate-limit quotas). The gap is properly documented in the builder report.

### 5.3 OpenChamber SDK Host Proxy Headers
- **Contract Reality:** `@openchamber/sdk` `GuestRequest` defines only `{ method, path, query, body }`. It does NOT permit passing custom request headers (`If-None-Match`), and `GuestRequestResult` returns `{ status, body }` without response headers (`ETag`).
- **Degradation Path:** Non-PAT users automatically execute standard unconditional GET requests via `host.request`. This is functionally correct and preserves board state, but yields no HTTP 304 quota savings. Conditional ETags are active only when a workspace PAT is present.

---

## 6. Measured Request Counts vs Estimates

The table below contrasts the actual network requests dispatched by the production implementation under controlled fixture conditions between `656cc4f` and `00ac1b9`:

| Scenario | Setup | Baseline (656cc4f) | Repaired (00ac1b9) | Notes & Observations |
|---|---|---|---|---|
| **Cold Start (304 from server)** | 1 Repo, empty in-memory state | 1 request (received 304, emptied board) | 2 requests (1st 304, 2nd unconditional retry -> 100 issues loaded) | Prevented catastrophic empty board state. |
| **Paging >100 issues on stream** | 1 Repo, 145 issues (Page 1: 100, Page 2: 45) | Page 2 304 -> 1 request, dropped 45 issues | Page 2 304 -> 1 request, 45 issues restored from `pageBodyCache` | Restores full 145 issues without dropping page 2. |
| **Incremental Sync (>100 changes)** | 1 Repo, 150 updated issues | 1 request (truncated to 100 issues) | 2 requests (Page 1: 100, Page 2: 50 -> 150 issues merged) | Full change set retrieved. |
| **All Projects Idle Sync (3 Repos)** | Repos A, B, C; Session linked to A | 1 request (Repo A only; B and C skipped) | 3 requests (Repos A, B, and C synced incrementally) | Fulfills D11 B1 full-scope requirement. |
| **Rapid Drawer Switching** | Click Issue 10, then quickly Issue 20 | 2 requests (Issue 10 response rendered into Issue 20 drawer) | 2 requests (Issue 10 response discarded via `drawerGeneration`) | Prevents comment hijacking. |
| **Manual Refresh Button** | 1 Repo | Fetched issues, kept stale comments for 60s | Clears `commentsCache`, `pageBodyCache`, ETags; forces fresh fetch | Restores user-controlled freshness. |

---

## 7. Verification Evidence & Commands

### 7.1 L0 Static Typecheck
```
$ npm run typecheck
> openchamber-github-task-board@1.1.0 typecheck
> tsc --noEmit
Exit Code: 0 (0 errors)
```

### 7.2 L0 Bundle Parity
```
$ npm run build && git status
> openchamber-github-task-board@1.1.0 build
> esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js
  panel/main.js  467.9kb
⚡ Done in 50ms
On branch fix/v2-binding-ratelimit-review-repair
nothing to commit, working tree clean
Exit Code: 0
```

### 7.3 L1 Unit / Builder Tests
```
$ node --test test/*.test.js
1..265
# tests 265
# suites 0
# pass 265
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2089.599332
Exit Code: 0
```

### 7.4 L1 Hostile Harness Verification
```
$ node --test /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/*.test.js
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 361.486116
Exit Code: 0
```
Includes:
- `test-identity-and-binding.test.js`: Proves 3 colliding repos with closed duplicate survive merge, legacy items without repo merge cleanly, and multi-repo V2 attach payloads preserve distinct repos.
- `production-orchestration.test.js`: Proves real production orchestration for `streamRemainingPages` 304 restoration, `handleIdleRefresh` D11 B1 compliance, `syncRepoIncremental` cache isolation, `loadComments` generation guards, `githubRequest` mutation safety, and reproduces findings D-01, D-02, and D-03.

### 7.5 What Was NOT RUN (Boundaries & Blind Spots)
1. **Interactive Browser Webview iframe (L3):** Not executed in a live interactive browser panel because this execution ran in a headless CLI environment. Verified via synthetic DOM/postMessage harness instead.
2. **Real Remote GitHub API Mutations:** No remote issues were created, modified, closed, or labeled on GitHub. All tests used mocked/synthetic API fixtures to avoid polluting production repositories.
3. **Remote Git Push / PR:** In accordance with constraints, no changes have been pushed to any remote repository. All commits are strictly local to branch `fix/v2-binding-ratelimit-review-repair`.

---

## 8. Minimal Numbered Repairs Required (Repair-2 Scope)

1. **Fix `normalizeGithubIssues` JSON Validation (D-01):**
   In `panel/core.ts:1928`, omit the `user` property when falsy rather than setting `user: undefined`:
   ```ts
   ...(issue.user ? { user: { login: issue.user.login, avatar_url: issue.user.avatar_url } } : {}),
   ```
2. **Prevent `__all_projects__` Sentinel Attribution in `repoForIssue` (D-02):**
   In `panel/main.ts:1742-1745`, return `''` if repository is unknown in All Projects mode:
   ```ts
   function repoForIssue(issue: Issue | null | undefined): string {
     if (issue?.repo && issue.repo !== ALL_PROJECTS_CACHE_KEY) return issue.repo;
     if (isAllProjectsMode) return '';
     return currentRepo;
   }
   ```
   In callers (`updateIssueStatus`, `updateIssueBody`, `loadComments`), check `if (!repo)` and cleanly abort with a warning rather than dispatching a broken HTTP request.
3. **Schedule Page Streaming on Page 1 HTTP 304 (D-03):**
   In `fetchIssues` (`panel/main.ts:1365-1370`) and `fetchAllRepoIssuePages` (`panel/main.ts:1452-1455`), when receiving 304 for page 1, if `cachedPage1?.items?.length >= 100` (or `issues.length >= 100`), still invoke `streamRemainingPages` to verify/reconstruct pages 2+.
4. **Flag Truncated Incremental Sync (D-04):**
   In `panel/core.ts:2412-2437`, return `truncated: boolean` from `syncIncrementalRepoIssues` if `page > MAX_INCREMENTAL_PAGES` and `res.length === 100`. In `syncRepoIncremental`, log a warning and do not advance the watermark to request completion when truncated.
