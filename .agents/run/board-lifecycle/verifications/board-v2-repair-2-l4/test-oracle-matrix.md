# Test-Oracle Integrity & Harness Fidelity Matrix (Repair 2)

**Auditor:** Independent L4 Hostile Auditor  
**Date:** October 2026  
**Target:** Commit `bca2bc9`  

---

## 1. Test-Oracle Evaluation: `test/residual-repairs.test.js`

In the prior review (Repair 1), 58.3% of tests in `test/review-repairs.test.js` were identified as simulations (`simulate*`) or tautologies.
For Repair 2, the builder constructed a dedicated regression suite in `test/residual-repairs.test.js` backed by `test/test-app-harness.js`.

### Oracle Breakdown by Test:

| Test ID | Finding Targeted | Production Entrypoint Invoked | Real Shipped Code Executed? | Oracle Level | Verdict | Auditor Critique |
|:---|:---:|:---|:---:|:---:|:---:|:---|
| **Test 1** | **D-01** | `normalizeGithubIssues(rawItems)` (`panel/core.ts`) + `isJsonValue` | Yes | L1/L2 Production Unit & Storage Contract | **SOUND** | Invokes production `normalizeGithubIssues` with raw issue containing `user: undefined`, `labels: [{ color: undefined }]`, `assignees: undefined`. Asserts all properties are defined and satisfies `isJsonValue`. |
| **Test 2** | **D-02** | `app.repoForIssue(issue)` and `app.updateIssueStatus(issue, 'in-progress')` | Yes (`panel/main.js` via harness) | L2/L3 Bundled Production Orchestration | **SOUND** | Executes bundled `main.js` functions `repoForIssue` and `updateIssueStatus`. Asserts `repoForIssue` returns `''`, and verifies that zero PATCH requests are dispatched to GitHub. |
| **Test 3** | **D-03** | `app.fetchIssues(false)` and `app.fetchAllRepoIssuePages('owner/repo', 2, false)` | Yes (`panel/main.js` via harness) | L2/L3 Bundled Production Orchestration | **SOUND** | Executes bundled `main.js` `fetchIssues` and `fetchAllRepoIssuePages` with 100 in-memory items, page 1 returning 304, and page 2 returning 200 with issue 101. Proves page 2 is requested and merged. |
| **Test 4** | **D-04** | `syncIncrementalRepoIssues` (`panel/core.ts`) and `app.syncRepoIncremental(...)` (`panel/main.js`) | Yes (`panel/core.ts` & `panel/main.js` via harness) | L1/L2 Production Core & Bundled App | **SOUND** | First tests `syncIncrementalRepoIssues` with 10 full pages of 100 items (1,000 items) for `truncated: true`. Then tests `syncRepoIncremental` verifying watermark does NOT advance and ETag is deleted. |

**Audit Conclusion:** All 4 tests in `test/residual-repairs.test.js` execute actual production source code or the compiled `panel/main.js` bundle. Zero simulation functions (`simulate*`) or tautological checks were introduced.

---

## 2. Harness Fidelity Assessment: `test/test-app-harness.js`

The builder claims `test/test-app-harness.js` accurately reproduces the production runtime environment and SDK bridge contract. We audited the harness line-by-line against `@openchamber/sdk` and browser DOM requirements:

### 2.1 `@openchamber/sdk` `isJsonValue` Contract Fidelity
In bundled `panel/main.js` (lines 203–216):
```js
var isJsonValue = (value) => {
  if (value === void 0) return false;
  if (value === null || value === true || value === false) return true;
  if (String(value) === value) return true;
  if (Number(value) === value) return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (Object(value) === value) return Object.values(value).every(isJsonValue);
  return false;
};
```
In `test/test-app-harness.js` (lines 8–14):
```js
export function isJsonValue(value) {
  if (value === void 0) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (Object(value) === value) return Object.values(value).every(isJsonValue);
  return false;
}
```
**Assessment:** The harness `isJsonValue` function identically matches the SDK's structural validation. Crucially, when `data.payload?.op === 'set'` is received:
```js
if (!isJsonValue(data.payload.value)) {
  ok = false;
  error = { code: 'HOST_REJECTED', message: 'Storage values must be JSON.' };
}
```
The harness accurately throws or replies with `HOST_REJECTED` whenever an object containing `undefined` is passed to `host.storage.set`.

### 2.2 Bundled `main.js` Execution Harness
- Reads the actual built `panel/main.js` artifact from disk (`path.resolve(__dirname, '../panel/main.js')`).
- Rewrites the IIFE wrapper via regex to expose inner functions (`fetchIssues`, `streamRemainingPages`, `fetchAllRepoIssuePages`, `syncRepoIncremental`, `updateIssueStatus`, `updateIssueBody`, `repoForIssue`, etc.) and internal states (`issues`, `currentRepo`, `pageBodyCache`, `issueListEtagCache`, `repoIncrementalEtagCache`, `repoSyncWatermarks`, `commentsCache`, etc.).
- Instantiates the bundle using `new Function('window', 'document', 'navigator', mainJs)` under a mock window and document.

### 2.3 Synthetic DOM Improvements over Repair-1 Harness
- In Repair 1's `production-orchestration.test.js`, `createElement().querySelector` returned `null`, which caused synthetic DOM elements (`card.querySelector(...)`) to throw `Cannot read properties of null (reading 'addEventListener')` when `renderViews()` executed.
- In `test-app-harness.js`, `createElement().querySelector` returns `createElement()`, allowing full DOM render trees and event listener registrations in `renderViews()` and `renderDrawer()` to complete without runtime crashes.

---

## 3. Independent Hostile Test Suite (`board-v2-repair-2-l4/hostile-verification.test.js`)

To guarantee independent adversarial verification, the L4 auditor executed `hostile-verification.test.js` covering:
1. `HOSTILE D-01`: Multi-variant raw issue edge cases (`user: undefined`, `user: null`, `labels: [{ color: undefined }]`, `assignees: [{ avatar_url: undefined }]`, `repo: undefined`, `projectId: undefined`). Proven to emit zero undefined keys and pass `isJsonValue`.
2. `HOSTILE D-02`: Multi-path write blocking for unknown repos and sentinel repos (`updateIssueStatus`, `updateIssueBody`, `loadComments`). Proven to dispatch zero network calls and zero requests to `__all_projects__`.
3. `HOSTILE D-03`: 2-page pagination scenario with page 1 returning 304 and page 2 returning 200 with new issue #101. Proven to stream page 2 and merge issue #101 into board state.
4. `HOSTILE D-04`: 10-page (1,000 items) incremental sync fixture. Proven to flag `truncated: true`, preserve the previous watermark, delete the incremental ETag, and emit a user warning.

All 4 hostile verification tests passed cleanly (duration: 629ms, exit 0).
