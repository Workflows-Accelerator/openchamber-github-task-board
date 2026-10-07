# Test-Oracle Audit Matrix: `test/review-repairs.test.js`

**Target File:** `test/review-repairs.test.js` (Commit `00ac1b9`)  
**Auditor:** Independent L4 Hostile Reviewer  
**Methodology:** Astute AST and call-path inspection verifying whether each test imports and invokes the actual served production function / event handler (`panel/core.ts`, `panel/main.ts`, `panel/main.js`) or executes a bespoke in-test simulation (`simulate*`, local object literals, synthetic Map operations).

---

## 1. Summary of Oracle Coverage

| Total Tests in File | Production Function Execution | Copied Simulation / Enactment | Tautology |
|:---:|:---:|:---:|:---:|
| **12** | **5** (41.7%) | **6** (50.0%) | **1** (8.3%) |

**Core Takeaway:** Only the low-level pure helpers from `panel/core.ts` (`mergeIssuePages`, `syncIncrementalRepoIssues`, `normalizeGithubIssues`, `buildMultiIssueAttachPayload`, `sessionRepoKeys`) and `panel/labels.ts` were executed against real code. The orchestration logic inside `panel/main.ts` (`streamRemainingPages`, `fetchIssues`, `handleIdleRefresh`, `syncRepoIncremental`, `loadComments`, `githubRequest`) was entirely bypassed by local simulations in `test/review-repairs.test.js`.

---

## 2. Detailed Test-by-Test Audit

| # | Test Title | Function Tested | Implementation Type | Oracle Classification | Status & Notes |
|:---:|---|---|---|:---:|---|
| **1** | `F-01: mergeIssuePages preserves issues with same number in different repos` | `mergeIssuePages` (`panel/core.ts:1943`) | Real import from `../panel/core.ts` | **PRODUCTION** | **PROVEN.** Directly executes `mergeIssuePages` on colliding issue numbers. Confirmed 3 distinct repos survive with independent state. |
| **2** | `F-04: syncIncrementalRepoIssues fetches all pages when changes exceed 100 items` | `syncIncrementalRepoIssues` (`panel/core.ts:2404`) | Real import from `../panel/core.ts` | **PRODUCTION** | **PROVEN.** Directly executes `syncIncrementalRepoIssues` with mock transport across 2 pages (150 items). |
| **3** | `F-12: normalizeGithubIssues preserves repo property` | `normalizeGithubIssues` (`panel/core.ts:1905`) | Real import from `../panel/core.ts` | **PRODUCTION** | **PROVEN.** Directly verifies `repo` is retained on returned objects. |
| **4** | `F-13: buildMultiIssueAttachPayload preserves per-issue repos for cross-repo bundles` | `buildMultiIssueAttachPayload`, `sessionRepoKeys` (`panel/core.ts:1223, 1341`) | Real imports from `../panel/core.ts` | **PRODUCTION** | **PROVEN.** Directly validates payload format and session index extraction across multiple repositories. |
| **5** | `F-14: updatePriorityLabels clears existing priority when given "none"` | `updatePriorityLabels` (`panel/labels.ts:182`) | Real import from `../panel/labels.ts` | **PRODUCTION** | **PROVEN.** Directly validates stripping of `priority:*` labels when subgroup is `'none'`. |
| **6** | `F-02 & F-03: Page body cache returns cached items on 304 and avoids dropping later pages` | `simulatePageStream`, `simulateColdStartFetch` | Local simulation function defined inside test | **COPIED SIMULATION** | **UNPROVEN BY THIS TEST.** Did not call production `streamRemainingPages` or `fetchIssues`. *(Note: Independently proven by L4 harness in `production-orchestration.test.js: Test 1`)*. |
| **7** | `F-05: Idle refresh in All Projects mode refreshes all configured repos in scope (D11 B1)` | Local ternary: `const reposToSync = isAllProjectsMode ? ... : ...` | Standalone expression checking reviewer premise | **COPIED SIMULATION** | **UNPROVEN BY THIS TEST.** Did not invoke `handleIdleRefresh`. *(Note: Independently proven by L4 harness in `production-orchestration.test.js: Test 2`)*. |
| **8** | `F-06: Incremental sync in All Projects mode does not contaminate single-repo cache with other repos` | Local `issueCache.set` + `multiRepoIssues.filter` | Synthetic code duplicating `panel/main.ts` lines 1662-1671 | **COPIED SIMULATION** | **UNPROVEN BY THIS TEST.** Did not invoke `syncRepoIncremental` or `fetchAllProjectIssues`. *(Note: Independently proven by L4 harness in `production-orchestration.test.js: Test 3`)*. |
| **9** | `F-07 & F-09: repoIncrementalEtagCache is keyed strictly by clean repo name without timestamps` | `new Map()` + `map.set('owner/repo', ...)` | Raw Map operations testing Map key behavior | **COPIED SIMULATION** | **UNPROVEN BY THIS TEST.** Did not call `buildIncrementalIssuesPath` or `syncRepoIncremental`. |
| **10** | `F-08: Stale comment response from previous issue is discarded when active issue changes` | `simulateLoadComments` | Local setTimeout simulation duplicating generation checks | **COPIED SIMULATION** | **UNPROVEN BY THIS TEST.** Did not invoke `loadComments` or `renderDrawer`. *(Note: Independently proven by L4 harness in `production-orchestration.test.js: Test 4`)*. |
| **11** | `F-10: commentsCache is cleared when refreshTasks or setRepository is triggered` | `commentsCache.clear()` | Instantiates `new Map()`, calls `.clear()`, asserts `size === 0` | **TAUTOLOGY** | **UNPROVEN BY THIS TEST.** Merely tests `Map.prototype.clear()`. Does not execute `refreshTasks` or `setRepository`. |
| **12** | `F-11: githubRequest does not fallback to proxy for non-GET mutations on error` | `simulateRequest` | Synthetic function testing an `if (method !== 'GET') throw` | **COPIED SIMULATION** | **UNPROVEN BY THIS TEST.** Did not execute `githubRequest` or `githubRequestWithRetry`. *(Note: Independently proven by L4 harness in `production-orchestration.test.js: Test 5`)*. |

---

## 3. Hostile Remedy Executed by L4 Auditor

To eliminate the oracle gap, the L4 auditor created `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js`. This harness instantiates the shipped bundle `panel/main.js` with a fully interactive DOM/OpenChamber SDK Host bridge, and executed the real production implementations of:
- `streamRemainingPages` (PROD-ORCH 1 -> PASS)
- `handleIdleRefresh` (PROD-ORCH 2 -> PASS)
- `syncRepoIncremental` (PROD-ORCH 3 -> PASS)
- `loadComments` (PROD-ORCH 4 -> PASS)
- `githubRequest` (PROD-ORCH 5 -> PASS)
- `repoForIssue` (PROD-ORCH 6 -> DEFECT PROVED)
- `normalizeGithubIssues` (PROD-ORCH 7 -> DEFECT PROVED)
- `fetchIssues` (PROD-ORCH 8 -> DEFECT PROVED)
