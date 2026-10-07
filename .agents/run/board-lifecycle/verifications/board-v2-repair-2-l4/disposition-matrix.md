# Findings Disposition & Residual Gap Matrix (Repair 2)

**Target:** Commit `bca2bc9` (repair 2) on `fix/v2-binding-ratelimit-review-repair`  
**Base:** `00ac1b9` (repair 1)  
**Review Type:** Independent Hostile Verification (L4)  
**Date:** October 2026  

---

## 1. Residual Defects Disposition Matrix (D-01 through D-04)

| Finding | Severity | Category | File & Line | Previous Defect (00ac1b9) | Repaired Status (HEAD) | L4 Empirical Verification | Verdict |
|:---:|---|---|---|---|---|---|:---:|
| **D-01** | HIGH | Storage Validation | `panel/core.ts:1928-1930`<br>`panel/main.ts:1286, 1393, 1569, 1575, 1654, 1667, 1674, 1680, 6091, 6096` | `normalizeGithubIssues` set `user: undefined` on issues without author. `@openchamber/sdk` storage rejected with `HOST_REJECTED: Storage values must be JSON.` | Uses conditional object spread `...(item.user ? ... : {})`, strips undefined from `labels`, `assignees`, and `repo`. All storage calls append `.catch(() => {})`. | Tested raw issue edge cases with missing user/assignees/labels in `hostile-verification.test.js: Test 1` and `residual-repairs.test.js: Test 1`. No undefined properties emitted; passes SDK `isJsonValue`. | **PROCEED** |
| **D-02** | MEDIUM | Spec Violation & Invalid Requests | `panel/main.ts:1742-1745`, `1752`, `1786`, `1960`, `4416`, `4476`, `4503`, `4938`, `6791`, `6825`, `6849` | In All Projects mode, `repoForIssue` fell back to `'__all_projects__'` for unknown repos, dispatching invalid `PATCH /repos/__all_projects__/issues/{id}`. | `repoForIssue` returns `''` when repo is missing or equal to sentinel in All Projects mode. ALL write paths (`updateIssueStatus`, `updateIssueBody`, `toggleArchiveIssue`, `addTagToIssue`, `removeTagFromIssue`, `loadComments`, drawer controls) abort, log warnings, and display error toast. | Tested in `hostile-verification.test.js: Test 2` and `residual-repairs.test.js: Test 2`. Confirmed zero HTTP calls dispatched and zero requests to `__all_projects__`. | **PROCEED** |
| **D-03** | MEDIUM | Freshness Loss & Data Truncation | `panel/main.ts:1360-1410`, `1445-1465` | Page 1 HTTP 304 with non-empty in-memory list executed early return, skipping page 2+ validation (aggregate cache substitution). | Early returns removed. Merges page 1 items and checks `page1Items.length >= 100 || issues.length >= 100` to schedule `streamRemainingPages` for page 2+. `fetchAllRepoIssuePages` iterates subsequent pages. | Tested 2-page scenario where page 1 is 304 and page 2 changed in `hostile-verification.test.js: Test 3` and `residual-repairs.test.js: Test 3`. Page 2 fetched and merged into board state. | **PROCEED** |
| **D-04** | LOW | Edge-case Truncation | `panel/core.ts:2412-2437`<br>`panel/main.ts:1620-1645` | Incremental sync silently truncated at 10 pages (1,000 items) and prematurely advanced watermark past unread items. | `syncIncrementalRepoIssues` returns `truncated: true` when 10th page is full. In `syncRepoIncremental`, watermark is NOT advanced on truncation, incremental ETag is cleared to prevent false 304s, and user is alerted via warning log and toast. | Tested 10-page (1,000 items) fixture in `hostile-verification.test.js: Test 4` and `residual-repairs.test.js: Test 4`. `truncated: true` returned, watermark remained unchanged, and ETag deleted. | **PROCEED** |

---

## 2. Collateral Audit of Repair-1 Findings (F-01 through F-14)

All 14 repairs verified in commit `00ac1b9` were audited for collateral regression across `00ac1b9..HEAD`:

| Finding | Description | Untouched / Preserved In | Regression Test Proof | Status |
|:---:|---|---|---|:---:|
| **F-01** | Cross-Repo Qualified Key Deduplication | `panel/core.ts:1943-2005` (`mergeIssuePages` deduplication untouched) | `test-identity-and-binding.test.js: Test 1` PASS | **PRESERVED** |
| **F-02** | Page Body Cache on HTTP 304 | `panel/main.ts:1258-1269` (`streamRemainingPages` body recovery intact) | `production-orchestration.test.js: Test 1` PASS | **PRESERVED** |
| **F-03** | Cold Start 304 Unconditional Retry | `panel/main.ts:1263, 1368` (Unconditional retry logic preserved) | `panel/main.ts:1368-1372` code audit PASS | **PRESERVED** |
| **F-04** | Multi-Page Incremental Sync | `panel/core.ts:2412-2437` (Iterates pages 1..10 while `length === 100`) | `review-repairs.test.js: Test 2` PASS | **PRESERVED** |
| **F-05** | D11 B1 Full-Scope Idle Refresh | `panel/main.ts:1724-1726` (Syncs all repos in `allProjectsRepoRefs`) | `production-orchestration.test.js: Test 2` PASS | **PRESERVED** |
| **F-06** | Cache Isolation in All Projects Mode | `panel/main.ts:1667` (Aggregated list saved exclusively to sentinel) | `production-orchestration.test.js: Test 3` PASS | **PRESERVED** |
| **F-07** | Stale Response Guard (`activeStreamEpoch`) | `panel/main.ts:1242, 1281, 1468, 1660` (Epoch checks preserved) | Code audit & AST check PASS | **PRESERVED** |
| **F-08** | Drawer Comment Race Guard | `panel/main.ts:4930-4968` (`drawerGeneration` and active issue match) | `production-orchestration.test.js: Test 4` PASS | **PRESERVED** |
| **F-09** | Clean Repository ETag Keying | `panel/main.ts:1622` (Keyed strictly by `cleanRepo`) | `test/review-repairs.test.js: Test 7` PASS | **PRESERVED** |
| **F-10** | Comment Freshness Loss on Refresh | `panel/main.ts:800, 4586, 6352` (`commentsCache.clear()` on refresh/switch) | `test/review-repairs.test.js: Test 10` PASS | **PRESERVED** |
| **F-11** | Mutation Safety Without Proxy Fallback | `panel/main.ts:1100-1165` (Non-GET throws immediately) | `production-orchestration.test.js: Test 5` PASS | **PRESERVED** |
| **F-12** | Repo Property Preserved on Issue Create | `panel/core.ts:1936`<br>`panel/main.ts:6076` (Preserves repo on normalization) | `test/review-repairs.test.js: Test 3` PASS | **PRESERVED** |
| **F-13** | Multi-Issue Attribution Preserved | `panel/core.ts:1226-1236, 1341` (`buildMultiIssueAttachPayload`) | `test-identity-and-binding.test.js: Test 3` PASS | **PRESERVED** |
| **F-14** | Priority "none" Strips Priority Labels | `panel/labels.ts:182` (`updatePriorityLabels`) | `test/review-repairs.test.js: Test 5` PASS | **PRESERVED** |

---

## 3. Structural Invariants & Trade-Off Matrix

### 3.1 Watermarks & Incremental Synchronization
- **Safety Overlap:** `since = Math.max(0, prevWatermark - 10_000)` (10-second overlap) handles clock skew and transaction commit latency. Verified in `panel/main.ts:1733`.
- **Watermark Advance:** Advances only upon successful, untruncated completion. On truncation (D-04), watermark is preserved at the previous value, ensuring the next idle refresh starts from the unread window.
- **Loop Prevention:** Clearing the incremental ETag on truncation does not cause infinite loops because incremental sync is event-driven by session activity transitions (`activity === 'idle'`), never a tight timer loop.

### 3.2 Documented Architectural Gaps (Awaiting User Decision)
- **GitHub REST API Deletions/Transfers:** `GET /repos/{owner}/{repo}/issues?since={iso}` returns only created or updated issues. Deleted or transferred issues persist on the board until a manual Refresh (`refreshTasks()`) occurs. This is an intrinsic GitHub API limitation and remains a documented gap.
- **OpenChamber SDK Host Proxy Headers:** Non-PAT users execute unconditional GET requests via `host.request` because `GuestRequest` cannot pass `If-None-Match`. Conditional ETags are active only when a workspace PAT is present. This remains a documented gap.
