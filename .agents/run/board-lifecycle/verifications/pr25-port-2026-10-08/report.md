# PR #25 Page-Size Fallback Port & Release Plan

## 1. Problem Statement
Older OpenChamber host proxies truncate HTTP responses at 256,000 characters. For active repositories (e.g., `openchamber/openchamber`), a page of 100 issues easily exceeds 800 KB, resulting in truncated responses that fail JSON parsing with:
`SyntaxError: Unterminated string in JSON at position 256000`
Newer hosts refuse the oversized payload and reject with error code `RESPONSE_TOO_LARGE`.

Community PR #25 by Bohdan Triapitsyn (`btriapitsyn`) introduces a fallback: when a page 1 request fails as oversized, shrink the page size for that repository from 100 to 20 issues per page, and retain that size for subsequent pages while enforcing the 1,000 issue cap (50 pages max).

---

## 2. Issue-List Fetch Paths in Current Tree & Coverage Plan

Every issue-list fetch path in the current tree (`c2fb739`) has been identified:

| Path # | File & Line | Context | Current Behavior | Coverage Plan |
|---|---|---|---|---|
| **Path 1** | `panel/main.ts:1369` (req: 1376, 1394) | `fetchIssues`: Page 1 initial fetch | Hardcoded `per_page=100`. Catches and fails entire fetch on truncation / `RESPONSE_TOO_LARGE`. | Wrapped with `fetchRepoIssuePage` / `fetchIssuePage` fallback. On page 1 oversized error, shrinks repo to 20, updates `issuePageSizes`, retries at `per_page=20`. |
| **Path 2** | `panel/main.ts:1268` (req: 1273, 1288) | `streamRemainingPages`: Pages 2+ background streaming | Hardcoded `per_page=100`, loops `page <= 10`, terminates on `nextItems.length < 100`. | Reads `pageSize` from `issuePageSizes.get(repo) ?? 100`. Loops `page <= Math.ceil(1000 / pageSize)` (up to 50 pages). Terminates on `nextItems.length < pageSize`. Later-page oversized errors are not retried. |
| **Path 3** | `panel/main.ts:1464` (req: 1470, 1483) | `fetchAllRepoIssuePages`: Page 1 multi-repo fetch | Hardcoded `per_page=100`, checks `firstItems.length < 100`. | Wrapped with `fetchRepoIssuePage` fallback. On page 1 oversized error, shrinks repo to 20, updates `issuePageSizes`, retries at `per_page=20`. Returns early if `firstItems.length < pageSize`. |
| **Path 4** | `panel/main.ts:1502` (req: 1507, 1520) | `fetchAllRepoIssuePages`: Pages 2+ multi-repo streaming | Hardcoded `per_page=100`, loops `page <= 10`, terminates on `nextItems.length < 100`. | Uses `pageSize` for repo, loops `page <= Math.ceil(1000 / pageSize)` (up to 50 pages). Terminates on `nextItems.length < pageSize`. Later-page oversized errors are not retried. |
| **Path 5** | `panel/core.ts:2412, 2438` (req: 2440) via `panel/main.ts:1652` | `syncIncrementalRepoIssues` & `buildIncrementalIssuesPath`: D11 idle sync | Hardcoded `per_page=100`, loops `page <= 10`, checks `items.length < 100`. | `buildIncrementalIssuesPath` accepts `pageSize` (default 100). `syncIncrementalRepoIssues` accepts `pageSizes` / `pageSize` / `onShrink`. On page 1 oversized error, shrinks to 20, updates map, retries page 1 at 20, loops up to `Math.ceil(1000 / pageSize)` (50 pages). |

**Coverage Verdict:** 5 of 5 issue-list fetch paths are covered. Zero paths left uncovered.

---

## 3. Adaptation Architecture (PR #25 onto Current Base)

### 3.1 `panel/core.ts`
- Constants:
  - `FULL_ISSUE_PAGE_SIZE = 100`
  - `SMALL_ISSUE_PAGE_SIZE = 20`
  - `MAX_ISSUES_PER_REPO = 1000`
- Types:
  - `IssuePageRequest`
- Predicate:
  - `isOversizedAnswer(err: any): boolean` returning `err instanceof SyntaxError || err?.code === 'RESPONSE_TOO_LARGE'`
- Function:
  - `fetchIssuePage(repo, page, request, pageSizes, onShrink, headers?)`
- Incremental Sync:
  - `buildIncrementalIssuesPath(repo, since, page, pageSize = FULL_ISSUE_PAGE_SIZE)`
  - `syncIncrementalRepoIssues` receives `pageSizes`, handles page 1 shrink to 20, loops to `Math.ceil(MAX_ISSUES_PER_REPO / pageSize)`.

### 3.2 `panel/main.ts`
- Global state:
  - `issuePageSizes = new Map<string, number>()`
- Helper:
  - `fetchRepoIssuePage(repo, page, request)`
- Call-site wiring across all 4 main.ts fetch locations (Paths 1, 2, 3, 4) plus incremental sync (Path 5).

---

## 4. Test Strategy & TDD Workflow
1. Port PR #25's 4 unit tests into `test/issue-page-size.test.js`:
   - `reads the full page size when the host carries it`
   - `a cut-off first page switches that repo to small pages and keeps them`
   - `a host that refuses an oversized answer by code is handled the same way`
   - `other failures, and oversized later pages, are not retried`
2. Add targeted regression tests for our tree:
   - Incremental idle sync fallback (`syncIncrementalRepoIssues` with oversized page 1).
   - Multi-repo isolation (repo A oversized shrinks to 20; repo B stays 100).
   - 1,000-issue cap preserved (50 pages of 20 = 1,000 max).
3. Demonstrate red-green cycle before committing.

---

## 5. Red / Green Proof & Evidence

### Red Phase
Initial execution before wiring the fallback call sites:
- `test/issue-page-size.test.js` initial run failed with:
  `ReferenceError: fetchIssuePage is not defined`
- Call-site integration test before wiring `fetchRepoIssuePage` failed with:
  `SyntaxError: Unterminated string in JSON at position 256000` (uncaught by `fetchIssues` and `fetchAllRepoIssuePages`).

### Green Phase
After implementing `FULL_ISSUE_PAGE_SIZE`, `SMALL_ISSUE_PAGE_SIZE`, `MAX_ISSUES_PER_REPO`, `isOversizedAnswer`, and `fetchIssuePage` in `panel/core.ts`, wiring `fetchRepoIssuePage` and `issuePageSizes` across `panel/main.ts`, and adapting `syncIncrementalRepoIssues`:
- Command: `node --test test/issue-page-size.test.js`
- Result: 13 tests passed, 0 failed, 0 skipped.
- Total suite: `node --test test/*.test.js` -> 302 tests passed, 0 failed (baseline 289 + 13 new).

---

## 6. Hostile Self-Review Matrix

| Scenario | Behavior & Proof | Test Assertion |
|---|---|---|
| **0 issues** | Returns empty array immediately; no second page request; clean termination. | `boundary conditions: 0 issues, exactly 20 issues, and 21 issues with SMALL_ISSUE_PAGE_SIZE` |
| **Exactly 20 issues** | Returns 20 items on page 1; next page returns 0 items and loop terminates cleanly. | Covered by boundary test |
| **21 issues** | Page 1 returns 20 items, page 2 returns 1 item; loop terminates since `items.length < pageSize`. | Covered by boundary test |
| **1,000+ issues cap** | `maxPages = Math.ceil(1000 / 20) = 50`. Requests exactly 50 pages and sets `truncated: true`. | `Path 5: syncIncrementalRepoIssues caps at 50 pages (1,000 issues) when page size is 20` |
| **Page 1 ok, Page 3 oversized** | Later pages are NOT retried with a smaller size (page offsets would shift). Error is logged and streaming terminates safely without corrupting cache or page-size state. | `Path 2: streamRemainingPages does not retry when a later page (page 2) fails or is oversized` |
| **Two repos shrinking independently** | Repo A hits oversized error and drops to 20; Repo B continues fetching at 100 without interference. | `multi-repo isolation: repo A oversized shrinking to 20 leaves repo B at 100` |
| **SyntaxError that is NOT truncation** | Retries page 1 once at `per_page=20`; if still malformed, fails and throws `SyntaxError` without infinite loops. | `non-truncation SyntaxError on page 1 retries once at 20 and then throws if still failing` |

---

## 7. Full Gate Counts

1. `npm run typecheck`: 0 errors.
2. `npm run build`: `panel/main.js` built clean (479.7kb).
3. `git diff --exit-code panel/main.js`: Byte parity clean after build.
4. `node --test test/*.test.js`: 302 passed, 0 failed (baseline 289 + 13 new tests).

---

## 8. Release & Update Mechanism Verification

- `package.json`: `"version": "1.2.0"` (only the version field changed).
- `README.md`: Documented in-app update mechanism and 1.2.0 features (page-size fallback, direct origins & ETag caching, three simplified views, V2 session binding, incremental idle sync).
- Update Mechanism: OpenChamber extension host detects version increments in `package.json` against the catalog and prompts users in the extension UI to reload and update.
- Contributor Credit: Bohdan Triapitsyn (`btriapitsyn`) credited in commit body and documentation, citing PR #25.
