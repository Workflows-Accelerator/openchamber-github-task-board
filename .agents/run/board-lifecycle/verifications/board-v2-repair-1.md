# Task Board V2 Session Binding & Rate-Limit Repair Report

**Date:** 2026-10-07  
**Branch:** `fix/v2-binding-ratelimit-review-repair`  
**Base Commit:** `656cc4f` (`feat: V2 session binding repo injection and D11 rate-limit optimizations`)  
**Repair Commit:** `00ac1b9` (`fix: resolve L4 findings F-01 through F-14 for V2 binding and rate limits`)  
**Checkout Directory:** `/workspace/extensions/github-task-board/.worktrees/team-dev-v2-binding-ratelimit-review-repair`  
**Review Target:** Hostile L4 Adversarial Review (`l4-board-v2-ratelimit.md`)  
**Status:** **`READY FOR L4 RE-REVIEW`**

---

## 1. Executive Summary

This repair addresses all 14 defects (F-01 through F-14) identified during the hostile L4 review of commit `656cc4f`. The repairs resolve critical data loss vulnerabilities in multi-project mode, pagination truncation, 304 cache dropouts, race conditions in the issue drawer, and unaligned idle refresh behavior.

Key achievements:
1. **Preserved Cross-Repo Identity (F-01, F-12, F-13):** Replaced numeric issue deduplication with repo-qualified identity `${repo}#${number}` across `mergeIssuePages`, `normalizeGithubIssues`, `submitNewIssue`, and `buildMultiIssueAttachPayload`.
2. **Eliminated Data Loss on HTTP 304 (F-02, F-03):** Implemented a bounded `pageBodyCache` (`MAX_PAGE_CACHE_ENTRIES = 100`) so 304 responses accurately reconstruct prior pages rather than truncating them or rendering empty boards.
3. **Full Multi-Page Incremental Sync (F-04):** `syncIncrementalRepoIssues` loops up to 10 pages when changes exceed 100 items, preventing silent truncation.
4. **Restored D11 Option B1 Contract (F-05):** In All Projects mode, idle sessions trigger full-scope incremental refresh across all configured repositories (`allProjectsRepoRefs`), not targeted-only subsets.
5. **Fixed Cache Poisoning & Memory Leaks (F-06, F-07, F-09):** Incremental ETags are keyed per clean repository name. In All Projects mode, aggregated collections are stored exclusively under `ALL_PROJECTS_CACHE_KEY`, isolating single-repo caches.
6. **Drawer Comment Race Guard (F-08, F-10):** Comment rendering is gated by a monotonic `drawerGeneration` counter and active issue identity, discarding responses from previous issues. Manual refresh and repository switching clear `commentsCache`.
7. **Safe Mutation & Priority Clearing (F-11, F-14):** Mutations do not fall back to proxy after PAT failures, avoiding duplicate creates/updates. Dragging to the "none" priority subgroup reliably clears priority labels.

---

## 2. Findings Disposition Matrix (F-01 through F-14)

| Finding | Severity | Disposition | Implemented Solution |
|---|---|---|---|
| **F-01** | CATASTROPHIC | **REPAIRED** | `mergeIssuePages` deduplicates by `${(repo || '').toLowerCase()}#${issue.number}` with fallback to bare number for legacy items. |
| **F-02** | CATASTROPHIC | **REPAIRED** | Bounded `pageBodyCache` stores `{ items, etag, timestamp }`. 304 responses restore cached body. 304 without cached body triggers unconditional retry. |
| **F-03** | CATASTROPHIC | **REPAIRED** | `fetchIssues` checks `pageBodyCache` on 304; if empty, executes an unconditional single retry rather than normalizing `[]` and overwriting storage. |
| **F-04** | HIGH | **REPAIRED** | `syncIncrementalRepoIssues` loops `page = 1..10` while `items.length === 100`, accumulating and merging all changed items. |
| **F-05** | HIGH | **REPAIRED** | Enforced D11 B1: In All Projects mode, `handleIdleRefresh` syncs all repos in `allProjectsRepoRefs`, coalescing rapid events via `pendingIdleRefresh`. |
| **F-06** | HIGH | **REPAIRED** | In All Projects mode, aggregated issues are saved only to `ALL_PROJECTS_CACHE_KEY`. Single-repo caches are populated strictly with repo-matching issues. |
| **F-07** | MEDIUM | **REPAIRED** | Added `activeStreamEpoch` guards; background fetch results for switched-away repos update background cache only without altering active board. |
| **F-08** | MEDIUM | **REPAIRED** | `drawerGeneration` incremented on drawer open/close/switch; `loadComments` verifies generation and active issue match before DOM mutation. |
| **F-09** | MEDIUM | **REPAIRED** | Replaced timestamped URL keys with `repoIncrementalEtagCache` keyed strictly by `cleanRepo` (`owner/repo`), preventing memory leak. |
| **F-10** | MEDIUM | **REPAIRED** | `commentsCache.clear()` executed on manual Refresh and `setRepository`. `openDrawer` sets `forceFreshComments = true` for fresh loads. |
| **F-11** | MEDIUM | **REPAIRED & DOCUMENTED** | Direct PAT fetch utilizes native `fetch()` with headers. Failed mutations throw immediately without proxy fallback. Documented SDK proxy header limits. |
| **F-12** | MEDIUM | **REPAIRED** | `normalizeGithubIssues` preserves `repo` property. `submitNewIssue` captures `targetRepo = currentRepo` and tags created issue. |
| **F-13** | LOW | **REPAIRED** | `buildMultiIssueAttachPayload` preserves per-issue repos in `data.issues: Array<{ number, repo }>`. `sessionRepoKeys` binds each issue to its repo. |
| **F-14** | LOW | **REPAIRED** | `renderKanbanView` passes `newPriorityGroup: 'none'`. `updateIssueStatus` passes options to `updatePriorityLabels`, stripping `priority:*` labels. |

---

## 3. Architectural Enhancements

### 3.1 Watermarks & Incremental Synchronization
- **Safe Completion Watermark:** `repoSyncWatermarks` updates only upon *complete successful* synchronization of a repository. It is never advanced pre-request or on partial failure.
- **Safety Overlap:** Subsequent incremental requests use `since = prevWatermark - 10_000` (10-second overlap) to account for clock skew and transactions committed during network transit.
- **Coalesced Idle Events:** If an idle event fires while `isIdleSyncing` is active, `pendingIdleRefresh = true` queues a trailing pass, ensuring no idle notification is lost.

### 3.2 Cache Isolation & Concurrency
- **Multi-Project Isolation:** When in All Projects mode, the multi-repo collection is saved exclusively under `cached_issues___all_projects__`.
- **Scope Guards:** If a user switches repositories while `syncRepoIncremental` is in flight, the completed payload is safely merged into that repository's background cache and storage without clobbering the active board.
- **Live Drawer Synchronization:** When an incremental sync updates an issue currently open in the inspection drawer, `renderDrawer(updatedIssue, true)` refreshes markdown tasks and status without clearing comments or resetting scroll position.

### 3.3 Mutation Safety
- **No Duplicate Mutations:** When using direct PAT fetch, any HTTP error (such as 401, 403, 500) on a non-GET mutation (POST, PATCH, PUT, DELETE) immediately throws an error. It does not fall back to `host.request`, preventing double-submitting issue creations or status transitions.

---

## 4. Contract Boundaries & Limitations

### 4.1 OpenChamber SDK Host Proxy Headers (F-11)
- **Contract Inspection:** In `@openchamber/sdk`, `GuestRequest` defines only `{ method, path, query, body }` (no custom request headers), and `GuestRequestResult` returns only `{ status, body }` (no response headers).
- **Impact:** When a user lacks a workspace PAT or custom token, requests route through `host.request`. Custom headers (`If-None-Match`) cannot be sent, and response headers (`ETag`, `x-ratelimit-remaining`) cannot be read.
- **Handling:** For host proxy requests, the extension executes standard unconditional GET requests. This is functionally correct and maintains board state, but cannot yield conditional 304 bandwidth/quota savings. Direct PAT fetch (via workspace credentials) retains full conditional header support.

### 4.2 GitHub REST API Deletion & Transfer Semantics
- **Contract Inspection:** The GitHub REST endpoint `GET /repos/{owner}/{repo}/issues?since={iso}` returns issues created or updated since the specified timestamp. Deleted issues and transferred issues do not appear in this feed.
- **Impact:** Incremental sync cannot detect issue deletions or transfers.
- **Handling:** Issue deletions and transfers are reconciled during manual Refresh (click Refresh button) or full cache invalidation. This is an inherent property of the GitHub Issues API.

---

## 5. Measured Request Counts vs Estimates

Measurements below compare network requests under simulated multi-repo scenarios between baseline `656cc4f` and repaired `00ac1b9`:

| Scenario | Scope / Setup | Baseline (656cc4f) | Repaired (00ac1b9) | Notes on Repair |
|---|---|---|---|---|
| **Cold Start (304 from server)** | 1 Repo, empty in-memory state | 1 request (returned 304, emptied board) | 2 requests (1st 304, 2nd unconditional retry -> 100 issues loaded) | Prevented catastrophic empty board state. |
| **Paging >100 issues on stream** | 1 Repo, 145 issues (Page 1: 100, Page 2: 45) | Page 2 304 -> 1 request, dropped 45 issues | Page 2 304 -> 1 request, 45 issues restored from `pageBodyCache` | Restores full 145 issues without dropping page 2. |
| **Incremental Sync (>100 changes)** | 1 Repo, 150 updated issues | 1 request (truncated to 100 issues) | 2 requests (Page 1: 100, Page 2: 50 -> 150 issues merged) | Full change set retrieved. |
| **All Projects Idle Sync (3 Repos)** | Repos A, B, C; Session linked to A | 1 request (Repo A only; B and C skipped) | 3 requests (Repos A, B, and C synced incrementally) | Fulfills D11 B1 full-scope requirement. |
| **Rapid Drawer Switching** | Click Issue 10, then quickly Issue 20 | 2 requests (Issue 10 response rendered into Issue 20 drawer) | 2 requests (Issue 10 response discarded via `drawerGeneration`) | Prevents comment hijacking. |
| **Manual Refresh Button** | 1 Repo | Fetched issues, kept stale comments for 60s | Clears `commentsCache`, `pageBodyCache`, ETags; forces fresh fetch | Restores user-controlled freshness. |

---

## 6. Verification Evidence

### 6.1 Static Typecheck
```
$ npm run typecheck
> openchamber-github-task-board@1.1.0 typecheck
> tsc --noEmit
Exit code: 0 (0 errors)
```

### 6.2 Build & Bundle Parity
```
$ npm run build
> openchamber-github-task-board@1.1.0 build
> esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js
  panel/main.js  467.9kb
⚡ Done in 59ms
```

### 6.3 Test Suite Execution
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
```
All 265 tests passed, including:
- 12 new targeted regression tests in `test/review-repairs.test.js` covering F-01 through F-14.
- All 13 parity tests in `test/shipped-parity.test.js` asserting complete AST and behavior parity between `panel/core.ts` and shipped `panel/main.js`.
- All legacy tests across markdown parsing, label management, dropdowns, and rate limits.

---

## 7. What Was Not Verified (Boundaries)

1. **Live Browser Webview iframe (L3):** Not verified in an interactive browser panel because this execution ran in a headless CLI environment. Fixture-based DOM and event testing was used instead.
2. **Real GitHub API Mutations:** No remote issues were created, modified, closed, or labeled on GitHub. All tests used mocked/synthetic API fixtures to avoid polluting production repositories.
3. **Remote Git Push / PR:** In accordance with constraints, no changes have been pushed to any remote repository. All commits are strictly local to branch `fix/v2-binding-ratelimit-review-repair`.

---

## 8. Learnings

- **DIDN'T WORK:** Attempting to extract `parseRepo` from external scope inside `shipped-parity.test.js` failed because `new Function()` in the test harness creates an isolated evaluation scope.
- **FINALLY WORKED:** Encapsulated `parseRepo` locally inside `normalizeGithubIssues` and `mergeIssuePages` in `panel/core.ts`, ensuring full self-contained functionality and green parity tests in both bundled and unbundled modes.
