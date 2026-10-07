# L4 Hostile Review: Task Board V2 Residual Repairs (Repair 2)

**Target Repository:** `/workspace/extensions/github-task-board`  
**Commit Reviewed:** `bca2bc9` (`docs: record red-green verification log for residual repairs D-01 through D-04`)  
**Base Commit:** `00ac1b9` (`fix: resolve L4 findings F-01 through F-14 for V2 binding and rate limits`)  
**Commits in Review Chain:**
- `bea33c0` (`fix(core): omit undefined properties in normalizeGithubIssues for SDK JSON validation (D-01)`)
- `0c3b60a` (`fix(panel): prevent __all_projects__ sentinel attribution and block writes for unknown repos (D-02)`)
- `f2583e2` (`fix(panel): eliminate page 1 304 aggregate cache substitution and validate later pages (D-03)`)
- `147d8dd` (`fix(sync): flag truncated incremental sync and preserve watermark (D-04)`)
- `a8014aa` (`test(repairs): add production-path regression suite for D-01 through D-04`)
- `bca2bc9` (`docs: record red-green verification log for residual repairs D-01 through D-04`)  
**Branch:** `fix/v2-binding-ratelimit-review-repair`  
**Worktree Location:** `/workspace/extensions/github-task-board/.worktrees/team-dev-v2-binding-ratelimit-review-repair`  
**Review Type:** Independent Read-Only Hostile Adversarial Review (L4)  
**Host Environment:** Node.js v22.23.3, Linux x86_64  
**Date:** October 2026  
**Auditor:** Independent Dynamic Subagent (L4 Hostile Reviewer)  
**Supporting Artifacts Directory:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-2-l4/`  

---

## 1. Executive Verdict & Summary

### **OVERALL VERDICT: PROCEED**

All four residual defects (`D-01` through `D-04`) identified in the Repair-1 hostile audit of commit `00ac1b9` have been **surgically, deterministically, and correctly resolved** in `00ac1b9..HEAD`. 

Crucially:
1. **No Scope Creep:** Edits were strictly bounded to the 4 defect areas in `panel/core.ts` and `panel/main.ts`, plus supporting test harness and documentation files. No unrelated refactoring was introduced.
2. **Real Shipped Code Execution:** The builder completely abandoned simulated test functions (`simulate*`). All tests in `test/residual-repairs.test.js` execute either production `panel/core.ts` functions or the compiled `panel/main.js` bundle via an instantiated test harness (`test/test-app-harness.js`).
3. **Rigorous Test-Oracle Fidelity:** The harness's SDK bridge faithfully replicates `@openchamber/sdk`'s `isJsonValue` strictness and throws `HOST_REJECTED: Storage values must be JSON.` when an object with `undefined` values is passed to `host.storage.set`.
4. **Zero Collateral Damage:** All 14 previously verified fixes (`F-01` through `F-14`) remain fully intact and verified green across the full suite (269 tests) and hostile verification suites.
5. **Static & Bundle Parity:** TypeScript typecheck passes with 0 errors (`npm run typecheck`), and `panel/main.js` matches the fresh output of `npm run build` with zero git diff.

---

## 2. Per-Fix Verification & Disposition (D-01 through D-04)

### D-01: Storage JSON Rejection (`normalizeGithubIssues` Undefined Properties)
- **File & Line:** `panel/core.ts:1928-1930`, `panel/main.ts:1286, 1393, 1569, 1575, 1654, 1667, 1674, 1680, 6091, 6096`
- **Severity:** HIGH
- **Defect on 00ac1b9:** Issues lacking author metadata produced `{ user: undefined }`. When passed to `host.storage.set()`, `@openchamber/sdk` rejected the entire object payload with `HOST_REJECTED: Storage values must be JSON.`, causing unhandled promise rejections and dropping cache writes.
- **Surgical Fix:**
  - In `panel/core.ts`, conditionally spreads `user`: `...(item.user ? { user: { login: item.user.login, ...(item.user.avatar_url ? { avatar_url: item.user.avatar_url } : {}) } } : {})`.
  - Maps `labels` and `assignees` to omit `undefined` properties (`color`, `avatar_url`).
  - Omits `repo`, `projectId`, and `projectName` if undefined (`...(repo ? { repo } : {})`).
  - Added `.catch(() => {})` to all 10 `host.storage.set` invocation sites in `panel/main.ts` to guard against any host rejection.
- **Red/Green Evidence:**
  - Red on `00ac1b9`: `isJsonValue(normalizeGithubIssues([{ number: 42, user: undefined }])[0]) === false`. Storage set throws `HOST_REJECTED`.
  - Green on HEAD: `test/residual-repairs.test.js: Test 1` PASS; `hostile-verification.test.js: Test 1` PASS.
- **Verdict:** **PROCEED**

---

### D-02: Sentinel PATCH Prevention & Unknown-Repo Write Guards
- **File & Line:** `panel/main.ts:1742-1745`, `1752`, `1786`, `1960`, `4416`, `4476`, `4503`, `4938`, `6791`, `6825`, `6849`
- **Severity:** MEDIUM
- **Defect on 00ac1b9:** In All Projects mode (`currentRepo === '__all_projects__'`), `repoForIssue` defaulted to `currentRepo` when an issue's `repo` attribute was missing or equal to `'__all_projects__'`. This caused drag-and-drop, label edits, and comment loading to issue HTTP requests like `PATCH /repos/__all_projects__/issues/{id}` (404/422).
- **Surgical Fix:**
  - Updated `repoForIssue`:
    ```ts
    function repoForIssue(issue: Issue | null | undefined): string {
      if (issue?.repo && issue.repo !== ALL_PROJECTS_CACHE_KEY) return issue.repo;
      if (isAllProjectsMode) return '';
      return currentRepo;
    }
    ```
  - Added guards across ALL write mutation paths (`updateIssueStatus`, `updateIssueBody`, `toggleArchiveIssue`, `addTagToIssue`, `removeTagFromIssue`, `loadComments`, `elDrawerPrioritySelect`, `elDrawerStatusSelect`, `elDrawerComplexitySelect`):
    ```ts
    const repo = repoForIssue(issue);
    if (!repo) {
      addLog(`Cannot update issue #${issue.number}: repository unknown`, 'warn');
      if (host?.toast) {
        void host.toast({ kind: 'error', message: `Cannot update #${issue.number}: repository unknown` });
      }
      return;
    }
    ```
  - Harmless reads: Rendering cards and views for unknown-repo issues continues safely without network calls or crashes.
- **Red/Green Evidence:**
  - Red on `00ac1b9`: `repoForIssue({ number: 99 })` returned `'__all_projects__'` in All Projects mode and dispatched PATCH.
  - Green on HEAD: `repoForIssue` returns `''`, aborts write, logs warning, shows error toast, and dispatches zero network requests. Tested in `test/residual-repairs.test.js: Test 2` and `hostile-verification.test.js: Test 2` PASS.
- **Verdict:** **PROCEED**

---

### D-03: Page 1 HTTP 304 Multi-Page Validation & Degrade
- **File & Line:** `panel/main.ts:1360-1410`, `1445-1465`
- **Severity:** MEDIUM
- **Defect on 00ac1b9:** When page 1 returned HTTP 304, if in-memory `issues.length > 0`, `fetchIssues` and `fetchAllRepoIssuePages` executed an immediate early return:
  ```ts
  if (issues.length > 0) {
    if (cachedPage1) setCachedPage(...);
    renderViews();
    return;
  }
  ```
  This substituted the aggregate cache and completely skipped validating or streaming pages 2–10. Any updates or new issues created on page 2+ were permanently hidden from the user.
- **Surgical Fix:**
  - Removed early returns on page 1 304.
  - Merged cached/retried page 1 items into state: `issues = issues.length > 0 ? mergeIssuePages(issues, page1Issues) : page1Issues`.
  - Conditioned background streaming on both page 1 size and total existing issues:
    ```ts
    if (page1Items.length >= 100 || issues.length >= 100) {
      void streamRemainingPages(currentRepo, storageKey, 2, streamEpoch, force);
    }
    ```
  - In `streamRemainingPages`, page 2 validates against its paired `pageBodyCache` body; if page 2 has changed, it retrieves fresh items (HTTP 200) and merges them into state.
  - In `fetchAllRepoIssuePages`, iterates all pages up to `MAX_PROJECT_ISSUE_PAGES` without early return.
- **Red/Green Evidence:**
  - Red on `00ac1b9`: 2-page fixture where page 1 is 304 and page 2 changed resulted in zero requests to page 2 and omitted issue #101.
  - Green on HEAD: Page 2 is requested and verified; issue #101 is fetched and merged into board state. Tested in `test/residual-repairs.test.js: Test 3` and `hostile-verification.test.js: Test 3` PASS.
- **Verdict:** **PROCEED**

---

### D-04: Incremental Sync Truncation Flag & Watermark Preservation
- **File & Line:** `panel/core.ts:2412-2437`, `panel/main.ts:1620-1645`
- **Severity:** LOW
- **Defect on 00ac1b9:** When a repository experienced >1,000 issue modifications since the previous watermark, `syncIncrementalRepoIssues` hit the 10-page cap (`MAX_INCREMENTAL_PAGES = 10`) and exited without warning. `syncRepoIncremental` advanced `repoSyncWatermarks` to `Date.now()`, permanently skipping issues on page 11+.
- **Surgical Fix:**
  - In `panel/core.ts`, added `truncated: boolean` to `IncrementalSyncResult`. Sets `truncated = true` if `page === MAX_INCREMENTAL_PAGES` and `items.length === 100`.
  - In `panel/main.ts`:
    - If `result.truncated === true`:
      - Does **NOT** advance `repoSyncWatermarks` for `cleanRepo` (preserving the previous watermark for subsequent retry).
      - Deletes the incremental ETag from `repoIncrementalEtagCache` to prevent stale 304 false-positives on the truncated page 1 feed.
      - Logs a warning: `Incremental sync for ${cleanRepo} truncated at 1,000 changes. Watermark preserved for retry.`
      - Displays an informative toast: `Incremental sync for ${cleanRepo} exceeded 1,000 changes. Consider manual refresh.`
- **Red/Green Evidence:**
  - Red on `00ac1b9`: 1,000-item fixture silently stopped, returned no truncation flag, and advanced watermark.
  - Green on HEAD: `truncated: true` returned, watermark preserved, ETag deleted, user alerted. Tested in `test/residual-repairs.test.js: Test 4` and `hostile-verification.test.js: Test 4` PASS.
- **Verdict:** **PROCEED**

---

## 3. Test-Oracle Assessment of Harness Mocks

The builder implemented `test/test-app-harness.js` to run the bundled `panel/main.js` under Node.js:
1. **SDK JSON Validation:** `test-app-harness.js` defines `isJsonValue` identically to `@openchamber/sdk` lines 203–216, validating that objects containing `undefined` values trigger `{ ok: false, error: { code: 'HOST_REJECTED', message: 'Storage values must be JSON.' } }`. This rigorously validates finding `D-01`.
2. **Synthetic DOM:** Fixes the mock limitation in Repair 1 where `createElement().querySelector` returned `null`, allowing full DOM rendering trees to run without throwing null reference exceptions during view updates.
3. **Network Isolation:** Directly controls `global.fetch` and tracks URLs, query parameters, and HTTP methods, proving `D-02` (no PATCH to `__all_projects__`), `D-03` (page 2 fetched on page 1 304), and `D-04` (10-page cap handling).

---

## 4. Empirical Verification Evidence & Commands

### 4.1 Static Typecheck (L0)
```
$ npm run typecheck
> openchamber-github-task-board@1.1.0 typecheck
> tsc --noEmit
Exit Code: 0 (0 errors)
```

### 4.2 Build & Bundle Parity (L0)
```
$ npm run build && git status
> openchamber-github-task-board@1.1.0 build
> esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js
  panel/main.js  471.2kb
⚡ Done in 64ms
On branch fix/v2-binding-ratelimit-review-repair
nothing to commit, working tree clean
Exit Code: 0
```

### 4.3 Full Repository Test Suite (L1)
```
$ node --test test/*.test.js
1..269
# tests 269
# suites 0
# pass 269
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2492.355997
Exit Code: 0
```

### 4.4 Repair-1 Identity & Binding Verification (L1)
```
$ node --test /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/test-identity-and-binding.test.js
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# duration_ms 286.544461
Exit Code: 0
```

### 4.5 Independent L4 Hostile Verification Suite (L1/L2)
```
$ node --test .agents/run/board-lifecycle/verifications/board-v2-repair-2-l4/hostile-verification.test.js
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# duration_ms 629.116748
Exit Code: 0
```
- `HOSTILE D-01`: normalizeGithubIssues strips undefined properties and passes strict SDK storage validation (PASS).
- `HOSTILE D-02`: repoForIssue returns empty string for unknown repos and blocks ALL write mutations (PASS).
- `HOSTILE D-03`: Page 1 304 validates and streams page 2 when changes exist on later pages (PASS).
- `HOSTILE D-04`: >1,000 incremental changes sets truncated=true and prevents watermark advance (PASS).

---

## 5. Explicit NOT RUN Boundaries & Blind Spots

As an automated hostile subagent operating in a headless container environment, the following boundaries remain intentionally unverified:
1. **Interactive Browser Webview Iframe (L3):** Not verified inside the live OpenChamber Webview renderer with native Chromium rendering, user clicks, or CSS layout paints. All tests were executed against simulated DOM and synthetic message-passing harnesses.
2. **Real Remote GitHub API Mutations:** In strict adherence to safety constraints, no live GitHub issues were patched, labeled, created, or closed on real remote repositories. All tests used mocked fetch boundaries.
3. **Remote Git Publishing:** No git push, pull request creation, or branch merge was executed. Commits remain strictly local to branch `fix/v2-binding-ratelimit-review-repair`.
4. **Human Subjective UX (L5):** Visual layout fluidness, animation cadence, toast positioning, and text legibility cannot be graded by AI and require human verification on the integration branch.

---

## 6. Known Documented Trade-Offs (Non-Defect Status)

As confirmed in the Repair-1 audit, the following architectural trade-offs remain documented awaiting human decision and are not defects:
1. **GitHub REST API `since=` Gap:** `GET /repos/{owner}/{repo}/issues?since={iso}` returns updated and created issues, but omits deleted or transferred issues. Deleted issues persist in the local board until a manual Refresh (`refreshTasks()`) occurs.
2. **SDK Host Proxy Request Headers:** Non-PAT users execute unconditional GET requests via `host.request` because `GuestRequest` cannot pass custom `If-None-Match` headers. HTTP 304 quota savings are active only when a workspace PAT is present.

---

## 7. Next Steps & Recommendation

With `D-01` through `D-04` proven fixed and all 14 baseline repairs verified green:
1. **The code on branch `fix/v2-binding-ratelimit-review-repair` at commit `bca2bc9` is certified ready for integration into the dev branch.**
2. **Proceed to L5 Human Validation on the integrated dev preview.**
