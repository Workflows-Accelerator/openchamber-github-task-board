# L4 Hostile Review: OpenChamber V2 Compatibility & Rate-Limit Repair (Repair 1)

**Target Repository:** `/workspace/extensions/chambervoice`  
**Commit Reviewed:** `252225a` (`fix(v2): repair protocol mismatches and taskboard caching race conditions`)  
**Base Commit:** `cd6ab18` (base `235d1ec`)  
**Branch:** `fix/v2-ratelimit-review-repair`  
**Review Type:** Independent Read-Only Hostile Adversarial Review (L4)  
**Host Environment:** OpenChamber v2.0.4, OpenCode v2.0.21, Node.js v22.23.3, Linux x86_64  
**Date:** October 2026  
**Auditor:** Independent Dynamic Subagent (L4 Hostile Reviewer)  
**Supporting Artifacts Directory:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-1-l4/`  

---

## 1. Executive Verdict & Summary

### **OVERALL VERDICT: PROCEED-WITH-CONDITIONS**

Commit `252225a` makes substantial, high-quality progress in resolving the 9 defects identified in the initial L4 review (`l4-voice-v2-ratelimit.md`):
- Session cursor pagination traverses all pages without silent truncation (empirically confirmed against 1,365 live host sessions).
- Direct session detail lookup in `getSessionModel` eliminates directory listing overhead.
- V2 permission normalization properly extracts `action` and `resources`.
- `replyQuestion` resolves spoken display labels to machine values, flags duplicate labels, formats multiselect as string arrays, and refuses to guess schema keys.
- Cache generation tracking and in-flight read coalescing in `TaskboardManager` protect against stale mutation overwrites and mid-flight scope switches.
- Bare issue lookups in All Projects mode enforce Issue #17 cross-repo collision safety across open and closed issues before caching unique results with 30s TTL.

However, hostile scrutiny against `@opencode/protocol` contract definitions and live endpoint probing revealed **three new/residual defects** that must be addressed before final promotion:

1. **Form Field Type `"integer"` Rejection (Finding A, HIGH):** OpenCode V2 defines `type: "integer"` (`form.d.ts:64`), but `host-client.ts:1073` omits `"integer"` from its allowed type whitelist. Any valid V2 form presenting an integer field throws an `UNSUPPORTED_FORM_FIELD` error and cannot be answered.
2. **Dead V1 Fallback Probes on 404 in `replyPermission` and `replyQuestion` (Finding B, MEDIUM-HIGH):** When `targetSessionId` is known and OpenCode V2 returns 404 (e.g. `PermissionNotFoundError` or `FormNotFoundError`), `HostClient` catches the 404 and dispatches a second request against removed V1 endpoints (`/api/permission/:id/reply` or `/api/question/:id/reply`), producing guaranteed 404 errors that mask the underlying V2 issue.
3. **Partial Multi-Repo Fetch Caching in `getTasks()` (Finding C, MEDIUM):** If 1 of N repositories fails during a multi-repo fetch in All Projects mode, `getTasks()` caches the incomplete aggregate task list for 30 seconds.

---

## 2. Independent Component & Per-Item Verdicts

| # | Item / Finding | Previous State (cd6ab18) | Repaired State (252225a) | Verdict | Status & Notes |
|:---:|---|---|---|:---:|---|
| **1** | **Permission Normalization** | Read `permission`/`patterns`, yielding blank details. | Extracts `action` and `resources` from V2 payload; fallbacks intact. | **PROCEED** | Verified against `permission.d.ts:17-18` and unit test 1. |
| **2** | **Form `multiselect` & Types** | `multiselect` omitted, sent scalar string, HTTP 400. | Detects `multiselect`, serializes answers as `string[]`. | **PROCEED-WITH-CONDITIONS** | Blocked on **Finding A**: Whitelist at line 1073 omits `"integer"`, rejecting integer forms. |
| **3** | **Empty V2 Route Fall-Through** | Empty V2 lists fell through to dead V1 404 routes. | Empty list returns terminal `null`; 401/403/5xx rethrown. | **PROCEED-WITH-CONDITIONS** | Blocked on **Finding B**: `replyQuestion` and `replyPermission` still fall through to V1 on 404. |
| **4** | **Form Field Key Hallucination** | Guessed `'choice'`/`'field_0'`, causing HTTP 400. | Throws `SCHEMA_UNAVAILABLE` before any POST when schema missing. | **PROCEED** | Verified by test 5; zero network POSTs dispatched. |
| **5** | **Option Value vs Label Mapping** | Sent display labels to strict `custom: false` fields. | Translates label to value; errors on ambiguous duplicate labels. | **PROCEED** | Verified by test 6; handles strict and open custom fields. |
| **6** | **Session Roster Cursor Pagination** | Dropped all sessions past 50 due to missing cursor traversal. | Traverses `cursor.next` to completion; fails on cyclic cursor. | **PROCEED** | Live probe verified 1,365 sessions collected across 28 pages in 954ms. |
| **7** | **Direct Session Detail Lookup** | Listed whole directory (50 sessions) to get 1 model. | Direct `GET /api/session/:id`, fallback only on 404. | **PROCEED** | Live probe verified direct model retrieval; directory listing bypassed. |
| **8** | **Issue #17 Collision Guarantee** | Partially warmed single repo suppressed multi-repo collision. | Unconditional sequential search across all known repos. | **PROCEED** | Verified across open and closed collisions (tests 10, 11). Quantified latency in Section 4. |
| **9** | **Cache Generation & In-Flight Races** | In-flight read wrote stale data over mutation clear. | Monotonic `cacheGeneration` counter + `inflightReads` map. | **PROCEED-WITH-CONDITIONS** | Blocked on **Finding C**: `getTasks()` caches partial list on single repo failure. |

---

## 3. Hostile Defect Register

### Finding A: Missing Support for V2 Form Field Type `"integer"` (Protocol Mismatch)
- **File & Line:** `service/host-client.ts:1072-1076, 1085`
- **Severity:** HIGH (CRITICAL FUNCTIONAL DEFECT)
- **Expected OpenCode V2 Protocol (`@opencode/protocol/dist/groups/form.d.ts:63-81`):**
  ```ts
  readonly type: Schema.Literal<"integer">;
  readonly minimum: ...;
  readonly maximum: ...;
  readonly default: ...;
  readonly key: Schema.String;
  ```
- **Actual Code (`host-client.ts:1072-1076`):**
  ```ts
  // Unsupported field type check
  if (f.type && !['string', 'number', 'boolean', 'select', 'multiselect', 'multichoice', 'choice', 'checkbox'].includes(f.type)) {
    throw new HostClientError(`Unsupported form field type "${f.type}" for field "${k}".`, 'UNSUPPORTED_FORM_FIELD');
  }
  ```
- **Defect Impact:**
  OpenCode V2 includes `"integer"` alongside `"number"`. Because `"integer"` is omitted from the whitelist, answering any form containing an integer field throws `HostClientError: Unsupported form field type "integer" for field "..."`. Furthermore, line 1085 checks `if (f.type === 'number')` but omits `f.type === 'integer'`, preventing numeric parsing.
- **Minimal Repair:**
  ```ts
  // Line 1073:
  if (f.type && !['string', 'number', 'integer', 'boolean', 'select', 'multiselect', 'multichoice', 'choice', 'checkbox'].includes(f.type)) {
  // Line 1085:
  if (f.type === 'number' || f.type === 'integer') {
    const num = Number(strToken);
    if (isNaN(num) || (f.type === 'integer' && !Number.isInteger(num))) {
      throw new HostClientError(`Value "${strToken}" is not a valid ${f.type} for field "${k}".`, 'INVALID_FIELD_ANSWER');
    }
  ```

---

### Finding B: Dead V1 Route Probes on 404 in `replyPermission` and `replyQuestion`
- **File & Line:** `service/host-client.ts:1159-1175` (`replyQuestion`), `service/host-client.ts:1338-1365` (`replyPermission`)
- **Severity:** MEDIUM-HIGH (NETWORK WASTE & MASKED V2 ERROR DETAILS)
- **Live Empirical Evidence:**
  Probing `replyPermission("perm_nonexistent", "once", "/workspace", "ses_nonexistent")` against the live OpenChamber host produced:
  1. `POST /api/session/ses_nonexistent/permission/perm_nonexistent/reply` -> HTTP 404 (`PermissionNotFoundError`).
  2. Caught in line 1346 because `err.code === 'NOT_FOUND'`.
  3. Dispatched second request: `POST /api/permission/perm_nonexistent/reply` -> HTTP 404 (DEAD V1 ROUTE).
  4. Error thrown to user: `Host request failed: POST /api/permission/perm_nonexistent/reply?directory=%2Fworkspace returned 404.`
- **Defect Impact:**
  When a session, permission, or form does not exist or has expired on a V2 host, `HostClient` catches the 404 and probes removed V1 routes, generating dead network traffic and replacing the V2 session-qualified error with an uninformative V1 404 error.
- **Minimal Repair:**
  If `targetSessionId` is known or if the host is proven V2 (e.g. `/api/permission/request` or `/api/form` previously returned 200), do not fall through to legacy V1 routes on 404; rethrow the V2 error immediately:
  ```ts
  if (targetSessionId) {
    await this.request('POST', `/api/session/${encodeURIComponent(targetSessionId)}/permission/${encodeURIComponent(requestId)}/reply...`);
    return { ok: true };
  }
  ```

---

### Finding C: Partial Multi-Repo Listing Caches Incomplete Taskboard State in All Projects Mode
- **File & Line:** `service/taskboard.ts:546-565, 588-590`
- **Severity:** MEDIUM (STALE / INCOMPLETE TASKBOARD DATA ON REPO OUTAGES)
- **Defect Impact:**
  In All Projects mode, `getTasks()` iterates sequentially over `knownRepos`. If repository 1 succeeds but repository 2 fails (e.g. 500 error, temporary GitHub rate limit 403, network timeout), `anySuccess = true`. Line 588 writes the incomplete task list into `this.cache` with a 30-second TTL. For the next 30 seconds, voice queries in All Projects mode will omit all tasks from the failed repository without re-attempting or warning.
  *(Note: `getTask(number)` in lines 728-735 already correctly sets `canCache = false` on repo errors; `getTasks()` omitted this check).*
- **Minimal Repair:**
  Add a `canCache` flag to `getTasks()`, setting `canCache = false` if any repository fails in the multi-repo loop:
  ```ts
  let canCache = true;
  for (const r of knownRepos) {
    try {
      const res = await this.fetchRepoTasks(r, status, label);
      if (res.ok) { anySuccess = true; allTasks.push(...res.tasks); }
      else { canCache = false; ... }
    } catch { canCache = false; ... }
  }
  if (result.ok && canCache && this.cacheGeneration === startGeneration) {
    this.setCache(cacheKey, result, startGeneration);
  }
  ```

---

### Finding D: Dead In-Memory Cache `knownIssueRepos`
- **File & Line:** `service/taskboard.ts:239, 267-278`
- **Severity:** LOW (DEAD CODE)
- **Defect Impact:**
  `this.knownIssueRepos` is populated on every issue fetch via `recordKnownTask`. However, `getKnownReposForTask` is never called anywhere in the codebase. `getTask` now relies entirely on `this.cache` (`task:__all_projects__:${number}`).
- **Minimal Repair:**
  Clean up dead method and map or preserve as documented diagnostic inspection state.

---

## 4. Empirical Evidence & Benchmarks

### A. Verification & Static Passes
- **Command:** `npm run verify`
  - Result: **PASS (Exit 0)**
  - Tests: **453 passed** (60 suites, 0 failed, 0 skipped, 20.8s duration)
  - Typecheck: `tsc --noEmit` exited with code 0 (0 errors).
- **Command:** `npm run build`
  - Output: `panel/main.js` (99.7kb), `live/main.js` (73.2kb), `live/worklet.js` (1.6kb), `service/main.js` (312.7kb).
  - Git diff against checked-in bundles: Clean zero-diff. Checked-in assets match build output byte-for-byte.
  - `panel/main.js` diff in `cd6ab18..252225a` verified as comment-only path differences (`node_modules` vs `../../node_modules`).

### B. Sanitized Live Read-Only Host Probes
Executed against local running host `127.0.0.1:3000`:
1. `listGlobalSessions()` discovered **1,365 sessions** across ~28 pages in **954 ms** with zero cyclic cursor failures.
2. Verified `entry.time.archived` mapping: 13 archived sessions discovered, all correctly carrying `archived: true` boolean based on `time.archived` timestamp.
3. `getSessionModel` fetched model directly via `GET /api/session/:id`, skipping directory listing.
4. `getPendingPermission` & `getPendingQuestion` on nonexistent sessions returned `null` without calling removed V1 endpoints (`/api/permission` or `/api/question`).

### C. Measured Latency & Request Costs in All Projects Mode
Benchmarked `TaskboardManager.getTask(number)` in All Projects mode across simulated repository counts:

| Configured Repositories (N) | Simulated GitHub API Roundtrip (ms) | Cold Turn Duration (ms) | Cold HTTP Requests Made | Warm Turn Duration (ms) | Warm HTTP Requests Made |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **2** | 50 ms | 105 ms | 2 | 0 ms | 0 |
| **4** | 50 ms | 205 ms | 4 | 0 ms | 0 |
| **8** | 50 ms | 408 ms | 8 | 0 ms | 0 |
| **8** | 200 ms | 1,609 ms | 8 | 0 ms | 0 |

- **Evaluation:** Cold turn sequential latency for 8 repos (~1.6s) safely fits within Gemini Live's 5-second turn budget while complying with GitHub rate-limit defense. Subsequent reads within 30s TTL take 0ms and make 0 requests.

---

## 5. Test Oracle Matrix (Production vs Mock Classification)

All 16 tests in `test/v2-ratelimit-repair.test.js` and modified `test/taskboard.test.js` were audited:

| Test Name | Production Code Executed | Mocked Boundary | Classification |
|---|---|---|:---:|
| **1: Permission Normalization** | `HostClient.getPendingPermission` | `fetchImpl` returning V2 schema | Real Production Execution |
| **2: Multiselect Formatting** | `HostClient.replyQuestion` | `fetchImpl` capturing POST body | Real Production Execution |
| **3: Empty Permission V1 Fallback** | `HostClient.getPendingPermission` | `fetchImpl` tracking URLs | Real Production Execution |
| **4: Empty Form V1 Fallback** | `HostClient.getPendingQuestion` | `fetchImpl` tracking URLs | Real Production Execution |
| **5: Missing Schema Error** | `HostClient.replyQuestion` | `fetchImpl` returning 404 | Real Production Execution |
| **6: Spoken Label Mapping** | `HostClient.replyQuestion` | `fetchImpl` returning options | Real Production Execution |
| **7: Cursor Pagination (150+)** | `HostClient.listSessions` | `fetchImpl` returning 3 pages | Real Production Execution |
| **8: Cyclic Cursor Detection** | `HostClient.listSessions` | `fetchImpl` returning looped cursor | Real Production Execution |
| **9: Direct Model Lookup** | `HostClient.getSessionModel` | `fetchImpl` answering single session | Real Production Execution |
| **10: Issue #17 Collision Warning** | `TaskboardManager.getTask` | `fetchImpl` with 2 matching repos | Real Production Execution |
| **11: Closed Issue Collision** | `TaskboardManager.getTask` | `fetchImpl` with closed match | Real Production Execution |
| **12: In-Flight Mutation Race** | `TaskboardManager.getTasks` | Deferred `fetchImpl` | Real Production Execution |
| **13: Mid-Flight Scope Switch** | `TaskboardManager.getTasks` | Guest storage disk modification | Real Production Execution |
| **14: closeTask Cache Clear** | `TaskboardManager.closeTask` | `fetchImpl` tracking states | Real Production Execution |
| **15: Permission Session Discovery**| `HostClient.replyPermission` | `fetchImpl` with `/api/permission/request` | Real Production Execution |
| **16: Archive Boolean Mapping** | `HostClient.listSessions` | `fetchImpl` with `time.archived` | Real Production Execution |
| **taskboard.test.js: Multi-Repo Verify**| `TaskboardManager.getTask` | `fetchImpl` tracking URLs | Real Production Execution |

*Conclusion:* 100% of tests execute actual production code classes with standard HTTP transport interception. None use simulated duplicate functions.

---

## 6. Positive Proof Gap & Disposable Fixture Plan (NOT RUN)

- **Status:** **NOT RUN** (per mission scope constraints).
- **Justification:** The local loopback host (`127.0.0.1:3000`) shares the live developer's SQLite database (`opencode.db`) and active session roster. Creating, prompting, or replying to test sessions on the shared host violates non-interference invariants.
- **Disposable Fixture Specification:** A fully isolated execution contract has been authored and saved to `.agents/run/board-lifecycle/verifications/voice-v2-repair-1-l4/disposable-fixture-contract.md`. It outlines running an ephemeral `opencode serve --port 3888` on a private `XDG_DATA_HOME` sandbox for clean, non-interfering positive reply proof.

---

## 7. Actionable Minimal Recovery Repairs

To bring this review from `PROCEED-WITH-CONDITIONS` to `PROCEED`:

1. **Add `"integer"` to Form Field Type Whitelist (`service/host-client.ts:1073, 1085`):**
   Include `'integer'` in allowed types and parse string answer into integer number.
2. **Prevent Dead V1 Route Probes on 404 in Reply Handlers (`service/host-client.ts:1159-1175, 1338-1365`):**
   When `targetSessionId` is defined, rethrow 404 errors directly instead of falling back to legacy `/api/question/:id/reply` or `/api/permission/:id/reply`.
3. **Guard Against Caching Partial Multi-Repo Lists in `getTasks()` (`service/taskboard.ts:546-590`):**
   Add `canCache = false` if any repository fails in the multi-repo loop, preventing incomplete task caching in All Projects mode.
