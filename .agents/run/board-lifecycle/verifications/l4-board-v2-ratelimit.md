# Hostile L4 Adversarial Review: Board V2 Binding & D11 Rate-Limit Optimizations

**Date:** 2026-10-07  
**Reviewer:** Independent L4 Hostile Reviewer (Subagent Engineer)  
**Target Commit:** `656cc4f` (`feat: V2 session binding repo injection and D11 rate-limit optimizations`)  
**Base Commit:** `9f651db` (`merge: issue body contract v1, human-task extraction, and simplified views (#22 #23)`)  
**Branch:** `feat/v2-binding-and-ratelimit` (at checkout `/workspace/extensions/github-task-board`)  
**Verdict:** **`HALT`**

---

## 1. Executive Summary & Verdict

The changes in commit `656cc4f` contain several well-intentioned optimizations for V2 session persistence, retry wrappers, and conditional HTTP status handling. However, hostile adversarial inspection and empirical test execution revealed **critical defects causing silent data loss, cross-repo issue destruction, broken pagination, and cache corruption**.

### Key Catastrophic & High-Severity Risks Found:
1. **Cross-Repo Issue Destruction:** `mergeIssuePages` deduplicates solely by raw numeric `issue.number`. In All Projects mode, syncing repo A clobbers any issue in repo B that shares the same issue number.
2. **Page 2+ Dropping on HTTP 304:** `streamRemainingPages` has no cached body storage for previous pages. When receiving HTTP 304 for page 2, it executes `page++; continue;`, resulting in all issues on pages 2–10 being permanently dropped from the active board.
3. **Empty Board State on HTTP 304:** In `fetchIssues`, if in-memory `issues` is empty (e.g. cold start, cache expired) and page 1 returns HTTP 304, the code falls through to normalize an empty array, clobbering local storage and rendering an empty board.
4. **Incremental Pagination Truncation:** `syncIncrementalRepoIssues` only fetches `page=1` (`per_page=100`). If more than 100 issues were updated or created since `lastSyncTimestamp`, all issues on page 2+ are dropped.
5. **D11 Contract Violation (Targeted vs Incremental):** In All Projects mode, `handleIdleRefresh` inspects idle sessions and refreshes *only* the repos attached to those sessions. User Decision D11 explicitly rejected targeted-only refresh (Option B2) in favor of full-scope incremental refresh (B1). Edits made by other contributors on GitHub in other repositories are ignored, and `lastSyncTimestamp` advances, permanently skipping them.
6. **Cross-Repo Cache Poisoning:** In `syncRepoIncremental`, `issueCache.set(repo, ...)` saves the entire multi-repo `issues` array under the single repository's cache key, contaminating single-repo views with issues from other projects.
7. **Host Proxy Header Inoperability:** Custom request headers (`If-None-Match`) and response headers (`ETag`) are omitted from `@openchamber/sdk`'s `GuestRequest` and `GuestRequestResult` contracts. For all users relying on the host proxy (OAuth/extension default), conditional ETag requests do not work.

**Verdict:** **`HALT`**. The branch cannot proceed to integration or human review until these issues are resolved.

---

## 2. Findings Matrix

| ID | Severity | Category | File & Line | Summary |
|---|---|---|---|---|
| **F-01** | **CATASTROPHIC** | Data Loss | `panel/core.ts:1913-1930`<br>`panel/main.ts:1520-1530` | `mergeIssuePages` deduplicates solely by `issue.number`. Syncing one repo in All Projects destroys issues with the same number in other repos. |
| **F-02** | **CATASTROPHIC** | Data Loss | `panel/main.ts:1218-1224` | `streamRemainingPages` has no per-page body cache; receiving HTTP 304 for page 2+ drops that page and all subsequent pages. |
| **F-03** | **CATASTROPHIC** | Core Flow | `panel/main.ts:1305-1335` | `fetchIssues` on HTTP 304 with empty in-memory issues falls through, normalizes `[]`, and overwrites storage with an empty list. |
| **F-04** | **HIGH** | Data Loss | `panel/core.ts:2296-2368` | `syncIncrementalRepoIssues` only fetches page 1 (`per_page=100`). Any change set >100 issues is truncated. |
| **F-05** | **HIGH** | Spec Violation | `panel/main.ts:1565-1579` | All Projects idle handler does targeted-only sync when sessions have bound repos, directly violating user decision D11 (B1). |
| **F-06** | **HIGH** | Cache Corruption | `panel/main.ts:1531-1538` | `syncRepoIncremental` writes the multi-repo `issues` array into `cached_issues_${repo}`, poisoning single-repo project views. |
| **F-07** | **MEDIUM** | Race Condition | `panel/main.ts:1507-1546` | `syncRepoIncremental` lacks `activeStreamEpoch` or repo-switch guards; delayed network responses overwrite newly selected repos. |
| **F-08** | **MEDIUM** | Visual / UI Race | `panel/main.ts:4748-4758` | Async `loadComments` has no active issue guard on completion; slow responses render comments into newly opened drawers. |
| **F-09** | **MEDIUM** | Memory Leak | `panel/main.ts:985, 1508-1525` | `issueListEtagCache` uses full URLs with varying ISO timestamps (`since=...`), creating dead, non-reusable cache entries indefinitely. |
| **F-10** | **MEDIUM** | Freshness Loss | `panel/main.ts:4709, 4743-4756` | `commentsCache` 60s TTL is never cleared by the manual Refresh button, repo switches, or drawer reopenings. |
| **F-11** | **MEDIUM** | Integration Defect | `panel/main.ts:1062, 1119-1142` | `@openchamber/sdk` `GuestRequest` does not support custom headers; `If-None-Match` is dropped and `res.headers` is undefined. |
| **F-12** | **MEDIUM** | State Mutation | `panel/main.ts:5859-5867`<br>`panel/core.ts:1892-1911` | `normalizeGithubIssues` strips `repo` property; `submitNewIssue` results in an issue object with `repo: undefined`. |
| **F-13** | **LOW** | Attribution Gap | `panel/core.ts:1205-1260` | `buildMultiIssueAttachPayload` on cross-repo issue bundles assigns all issue numbers to the first repo. |
| **F-14** | **LOW** | Functional Flaw | `panel/main.ts:2759-2763` | Drag-and-drop to "none" (No Priority) subgroup does not clear priority because `subgroupId !== 'none'` is guarded. |

---

## 3. Detailed Finding Descriptions & Technical Evidence

### F-01: Cross-Repo Issue Destruction in `mergeIssuePages`
- **Location:** `panel/core.ts:1913-1930`
- **Mechanism:**
  ```ts
  export function mergeIssuePages(existing: Issue[], incoming: Issue[]): Issue[] {
    const map = new Map<number, Issue>();
    if (Array.isArray(existing)) {
      for (const issue of existing) {
        if (issue && Number.isFinite(issue.number)) map.set(issue.number, issue);
      }
    }
    // ...
  ```
  `mergeIssuePages` indexes issues solely by `issue.number` (an integer). In multi-project mode, issue numbers are only unique per repository. When `syncIncrementalRepoIssues` calls `mergeIssuePages(currentIssues, changed)`:
  - If Repo A has issue #5 and Repo B has issue #5, `map.set(5, issue)` overwrites Repo B's issue with Repo A's issue.
  - When Repo A is updated, Repo B's issue #5 is completely deleted from the active board state.
- **Empirical Proof:** `.agents/run/board-lifecycle/verifications/board-v2-l4/proof-merge-issue-pages-collision.test.js` (PASS).

### F-02: `streamRemainingPages` Drops Pages 2+ on HTTP 304
- **Location:** `panel/main.ts:1218-1224`
- **Mechanism:**
  ```ts
  if (nextRaw && (nextRaw.notModified || nextRaw.status === 304)) {
    page++;
    continue;
  }
  ```
  `fetchIssues` resets `issues = page1Issues` (100 items). When `streamRemainingPages` runs for page 2 and receives HTTP 304 Not Modified, it simply executes `continue`. Because there is no response body cache for page 2, the previous page 2 issues are never merged into `issues`. If a repo has 250 issues and page 2 returns 304, the board drops 150 issues.
- **Empirical Proof:** `.agents/run/board-lifecycle/verifications/board-v2-l4/proof-etag-304-drops-subsequent-pages.test.js` (PASS).

### F-03: `fetchIssues` HTTP 304 Overwrites Storage with Empty List on Cold Start
- **Location:** `panel/main.ts:1305-1335`
- **Mechanism:**
  ```ts
  if (page1Raw && (page1Raw.notModified || page1Raw.status === 304)) {
    addLog(`Page 1 for ${currentRepo} -> 304 Not Modified (using cached issues)`, 'succ');
    lastSyncTimestamp = Date.now();
    if (issues.length > 0) {
      renderViews();
      statusReconciler.schedule(issues);
      return;
    }
  }
  // Falls through when issues.length === 0:
  const page1Items = Array.isArray(page1Raw) ? page1Raw : (page1Raw?.items || []); // []
  const page1Issues = normalizeGithubIssues(page1Items); // []
  issues = page1Issues; // []
  if (host?.storage) {
    void host.storage.set(storageKey, { timestamp: Date.now(), issues } as any); // Overwrites with []!
  }
  ```
  If `issues` in memory is empty, receiving a 304 sets `issues = []`, persists `[]` to host storage, and renders an empty board.
- **Empirical Proof:** `.agents/run/board-lifecycle/verifications/board-v2-l4/proof-etag-304-drops-subsequent-pages.test.js` (PASS).

### F-04: Incremental Sync Truncates Changed Feeds >100 Items
- **Location:** `panel/core.ts:2296-2368`
- **Mechanism:**
  `buildIncrementalIssuesPath(repo, since)` accepts `page: number = 1`. In `syncIncrementalRepoIssues`, it executes a single `requestFn('GET', path)`. It does not check if `items.length >= 100` and never fetches page 2.
- **Empirical Proof:** `.agents/run/board-lifecycle/verifications/board-v2-l4/proof-incremental-pagination.test.js` (PASS).

### F-05: All Projects Mode Violates D11 Contract (Targeted Refresh vs Incremental)
- **Location:** `panel/main.ts:1565-1579`
- **Mechanism:**
  ```ts
  const reposToSync = targetRepos.size > 0
    ? Array.from(targetRepos)
    : allProjectsRepoRefs.map((r) => r.repo);
  ```
  When an agent finishes a turn on repo A, `targetRepos` has `repo A`. `reposToSync` is restricted to `[repo A]`. Repos B, C, D are omitted. `lastSyncTimestamp` is advanced to `Date.now()`. Any concurrent modifications made by users or other agents on GitHub in repos B, C, D are skipped and will never be fetched by future incremental syncs.
- **Spec Reference:** `specs/rate-limit-manager-review.md` line 34 (D11 decision: B1 incremental approved across current scope; B2 targeted-only rejected).

### F-06: `syncRepoIncremental` Pollutes Single-Repo Cache
- **Location:** `panel/main.ts:1531-1538`
- **Mechanism:**
  In All Projects mode, `issues` holds items from all projects.
  Line 1531 executes:
  `issueCache.set(repo, { timestamp: Date.now(), issues });`
  `host.storage.set('cached_issues_' + repo, { timestamp: Date.now(), issues });`
  When switching from All Projects to project `repo`, `fetchIssues` reads `cached_issues_${repo}` and renders items belonging to completely unrelated repositories.

### F-07: Unbounded Memory Leak via Timestamped ETag Cache Keys
- **Location:** `panel/main.ts:985, 1508-1525`
- **Mechanism:**
  `buildIncrementalIssuesPath` embeds `encodeURIComponent(sinceIso)`. Because `sinceIso` is a millisecond-precision timestamp generated on every idle event, `path` is unique on every call. `issueListEtagCache.get(path)` never hits, and `issueListEtagCache.set(path, ...)` permanently leaks memory with dead keys.

### F-08: Stale Async Drawer Comments Race Condition
- **Location:** `panel/main.ts:4748-4758`
- **Mechanism:**
  When a user opens Issue #1, `loadComments(1)` fires. If the user quickly clicks Issue #2, `renderDrawer(issue2)` opens. When `loadComments(1)` resolves, it calls `renderCommentsList(list)`, rendering Issue #1's comments into Issue #2's drawer and updating the badge count to Issue #1's count.
- **Empirical Proof:** `.agents/run/board-lifecycle/verifications/board-v2-l4/proof-comments-stale-render-race.test.js` (PASS).

### F-11: OpenChamber SDK Contract Drops Custom Request Headers
- **Location:** `panel/main.ts:1062, 1119-1142`
- **Mechanism:**
  `@openchamber/sdk` defines `GuestRequest`:
  ```ts
  export type GuestRequest = {
    method: GuestRequestMethod;
    path: string;
    query?: Record<string, string>;
    body?: string;
  };
  ```
  There is no `headers` field. Passing `headers` to `githubRequest` does nothing when using `host.request`. Furthermore, `GuestRequestResult` only returns `{ status: number, body: string }` without response headers. The code at lines 1132-1138 (`const resHeaders = (res as any).headers`) evaluates to `undefined`, so `ETag` is never retrieved and `304` conditional requests never fire via the host proxy.
- **Empirical Proof:** `.agents/run/board-lifecycle/verifications/board-v2-l4/proof-sdk-headers-dropped.test.js` (PASS).

---

## 4. Synthetic Test Defect Analysis

The builder added a test in `test/v2-binding-and-ratelimit.test.js` labeled `Revert-failure check: idle synchronization must enforce since= and forbid full paginated refetch`:
```js
function verifyIdleCompliance(syncResult) {
  assert.equal(syncResult.calls.length, 1, 'Idle refresh must not execute multi-page fetches');
}
```
**Hostile Analysis:**
1. This test explicitly asserted that `calls.length === 1`, enshrining the inability to fetch page 2 (>100 issues) into an assertion!
2. The test did not execute the actual `panel/main.ts` idle orchestrator (`handleIdleRefresh`), but rather tested a bespoke synthetic object literal created within the test file itself (`newIdleImplementation`).
3. Consequently, caller bugs such as cross-repo collision in `mergeIssuePages`, targeted-only repository omission in `handleIdleRefresh`, and the advancement of `lastSyncTimestamp` before request completion were completely invisible to the test suite.

---

## 5. Verification Ladder Status (L0–L5)

- **L0 Static:** PASS (`npm run typecheck` -> exit 0, 0 errors).
- **L1 Unit:** PASS on builder tests (`node --test test/*.test.js` -> 253 pass).
- **L1 Hostile Proofs:** PASS (10 of 10 adversarial proofs pass in `.agents/run/board-lifecycle/verifications/board-v2-l4/*.test.js`, proving F-01 through F-11).
- **L2 Integration:** PARTIAL / BLOCKED. Live GitHub probe demonstrated conditional 304 outside the webview, but SDK contract analysis proves `host.request` drops headers.
- **L3 The User's Way (E2E / Browser):** **NOT RUN**.
  - CORS header exposure inside the actual OpenChamber webview iframe: NOT RUN.
  - Multi-repo incremental refresh in the UI: NOT RUN.
  - Kanban priority drag-and-drop to "none": NOT RUN.
  - Drawer comment rendering during rapid issue selection: NOT RUN.
- **L4 Hostile Review (AI):** **HALT** (14 findings identified; 3 catastrophic, 3 high).
- **L5 Human Validation:** **BLOCKED** pending resolution of L4 defects.

---

## 6. Minimal Numbered Repairs Required

1. **Fix `mergeIssuePages` or Incremental Merging for Multi-Project:**
   - In `mergeIssuePages`, deduplicate by repo-qualified key `${(issue.repo || '').toLowerCase()}#${issue.number}` instead of raw numeric `issue.number`.
2. **Implement Multi-Page Incremental Sync:**
   - In `syncIncrementalRepoIssues`, loop `page = 1, 2, ...` as long as `items.length >= 100`, updating the per-repo collection until all pages are retrieved.
3. **Remove Broken 304 Skip in `streamRemainingPages` or Implement Page Body Cache:**
   - Either store page contents in a keyed response cache before attempting 304 optimization, or avoid skipping uncached pages when receiving 304.
4. **Fix HTTP 304 Fallback in `fetchIssues`:**
   - If `issues.length === 0` and HTTP 304 is received, do not fall through to normalize `[]`; either retain stored cache or perform a full forced fetch (`force = true`).
5. **Restore D11 B1 Full-Scope Incremental Refresh:**
   - In `handleIdleRefresh`, sync all repositories in `allProjectsRepoRefs` incrementally rather than filtering down to `targetRepos`.
6. **Eliminate Cross-Repo Cache Contamination:**
   - In `syncRepoIncremental`, do not set `cached_issues_${repo}` with the multi-project aggregated collection. Filter `issues.filter(i => i.repo === repo)` before saving single-repo caches.
7. **Guard Stale Async Drawer Comments:**
   - In `loadComments`, capture `const targetNumber = issueNumber; const targetRepo = repo;` and verify `activeIssue && activeIssue.number === targetNumber && repoForIssue(activeIssue) === targetRepo` before modifying `elDrawerCommentsContainer` or `elCommentCountBadge`.
8. **Invalidate `commentsCache` on Refresh:**
   - Call `commentsCache.clear()` inside manual refresh handlers and `setRepository`.
9. **Preserve `repo` in `submitNewIssue`:**
   - Tag newly created issues with `repo: currentRepo` after `normalizeGithubIssues`.
