# Board V2 Residual Repairs (D-01 through D-04) Execution & Verification Log

**Branch:** `fix/v2-binding-ratelimit-review-repair`  
**Base Commit:** `00ac1b9`  
**Target Commit:** `a8014aa`  
**Date:** 2026-10-07  

---

## 1. Red/Green Progression Summary

| Defect | File & Line | Symptom on 00ac1b9 | Red Test Result | Surgical Fix | Green Test Result |
|---|---|---|---|---|---|
| **D-01** | `panel/core.ts:1928-1930` | `normalizeGithubIssues` set `user: undefined` on issues without user, triggering `HOST_REJECTED: Storage values must be JSON.` in `@openchamber/sdk`. | `ERR_ASSERTION: Property "user" on normalized issue must not be undefined` | Omit `user` property when `!issue.user`; strip undefined from assignees/labels. | PASS (`test/residual-repairs.test.js: Test 1`) |
| **D-02** | `panel/main.ts:1742-1745`, `1748`, `1777`, `1943`, `4452`, `4484` | `repoForIssue` returned `'__all_projects__'` sentinel in All Projects mode for issues with missing repo, dispatching broken `PATCH /repos/__all_projects__/issues/:id`. | `AssertionError: repoForIssue must return empty string for unknown repos` & attempt to send PATCH | Return `''` when repo is missing or equal to sentinel in All Projects mode; callers abort with error log & toast notification. | PASS (`test/residual-repairs.test.js: Test 2`) |
| **D-03** | `panel/main.ts:1365-1370`, `1452-1455` | Page 1 HTTP 304 with non-empty in-memory list executed early return, skipping page 2+ validation (aggregate cache substitution). | `AssertionError: Page 2 must be requested and verified when page 1 is 304` | Remove early returns on page 1 304; merge cached/retried page 1 items and schedule `streamRemainingPages` if `items.length >= 100` or `issues.length >= 100`. | PASS (`test/residual-repairs.test.js: Test 3`) |
| **D-04** | `panel/core.ts:2412-2437`<br>`panel/main.ts:1629-1640` | Incremental sync silently truncated when reaching 10-page limit (1,000 items) and prematurely advanced watermark. | `AssertionError: syncIncrementalRepoIssues must set truncated: true` & watermark was updated | Return `truncated: boolean` from `syncIncrementalRepoIssues`; if truncated, display warning/toast and preserve watermark for subsequent sync retry. | PASS (`test/residual-repairs.test.js: Test 4`) |

---

## 2. Test Verification Log

### Full Test Suite Run:
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
```

### Static Typecheck:
```
$ npm run typecheck
> tsc --noEmit
Exit Code: 0
```

### Build & Bundle Parity:
```
$ npm run build
> esbuild panel/main.ts --bundle --format=iife --target=chrome100 --tree-shaking=false --outfile=panel/main.js
  panel/main.js  471.2kb
⚡ Done in 76ms
Exit Code: 0
```
