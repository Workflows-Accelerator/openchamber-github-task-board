# L4 Hostile Review: OpenChamber V2 Compatibility & Rate-Limit Repair (Repair 2)

**Target Repository:** `/workspace/extensions/chambervoice`  
**Commits Reviewed:** `252225a..HEAD`  
- `f58e11b` (`fix(v2): add integer form field support to HostClient (Finding A)`)  
- `67f955f` (`fix(v2): eliminate dead V1 route probes on 404 in replyQuestion and replyPermission (Finding B)`)  
- `d582374` (`fix(v2): prevent partial multi-repo caching on failure and retry failed repos in getTasks (Finding C)`)  
- `a5ddb77` (`docs(voice-v2): add reproduction, repair log, and test evidence for repair 2`)  
**Base Commit:** `252225a` (`fix(v2): repair protocol mismatches and taskboard caching race conditions`)  
**Branch:** `fix/v2-ratelimit-review-repair`  
**Review Type:** Independent Read-Only Hostile Adversarial Review (L4)  
**Host Environment:** OpenChamber v2.0.4, OpenCode v2.0.21, Node.js v22.23.3, Linux x86_64  
**Date:** October 2026  
**Auditor:** Independent Dynamic Subagent (L4 Hostile Reviewer)  
**Supporting Artifacts Directory:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-2-l4/`  

---

## 1. Executive Verdict & Summary

### **OVERALL VERDICT: PROCEED-WITH-CONDITIONS**

Repair 2 addresses all three defects identified in the Repair 1 review (`l4-voice-v2-repair-1.md`):
1. **Fix 1 (`"integer"` Form Fields):** Form field type `"integer"` was added to the whitelist and validated with integer constraints (`accept 42`, `reject 42.5`, `reject non-numeric`). Red baseline confirmed on `252225a`.
2. **Fix 2 (Dead V1 Route Probes on 404):** `replyQuestion` and `replyPermission` eliminate dead V1 route probes when V2 session-qualified endpoints return 404. Typed `NOT_FOUND` errors propagate cleanly to callers. Pre-V2 fallback is preserved strictly where the V2 collection route itself returns 404. Transient 401/403/500 errors rethrow without fallback.
3. **Fix 3 (Partial Multi-Repo Cache Poisoning):** In All Projects mode, `TaskboardManager.getTasks()` guards aggregate caching with `canCache = false` on any repo failure. Healthy repositories are stored under per-repo cache keys (`list:${repo}:${status}:${label}`) with generation tracking, while failed repos are retried on subsequent calls.

However, hostile analysis of `@opencode/protocol` contract definitions revealed **one residual defect**:
- **Form Field Type `"external"` Rejection (Finding 1, MEDIUM):** `@opencode/protocol` (`form.d.ts:124-130`) defines `type: "external"` for non-input display URLs. The builder omitted `"external"` from the whitelist in `host-client.ts:1078` under the assumption that non-input fields need no voice handling. However, because `replyQuestion` loops over all `formFields` unconditionally, any valid V2 form presenting an informational link alongside input fields throws `HostClientError: Unsupported form field type "external"` and cannot be answered via voice.

---

## 2. Independent Component & Per-Fix Verdicts

| # | Repair Item / Finding | Base State (252225a) | Repaired State (HEAD) | Verdict | Status & Notes |
|:---:|---|---|---|:---:|---|
| **1** | **Fix 1: Form Field Type `"integer"`** | Omitted `"integer"` from whitelist; threw `UNSUPPORTED_FORM_FIELD`. | Adds `"integer"`, validates `Number.isInteger(num)`, parses correctly. | **PROCEED-WITH-CONDITIONS** | Blocked on **Finding 1**: Whitelist at line 1078 omits `"external"`, causing forms with display links to throw `UNSUPPORTED_FORM_FIELD`. |
| **2** | **Fix 2: Dead V1 Route Probes on 404** | Caught 404 on V2 reply routes and probed dead V1 endpoints. | Directly executes V2 reply POST; rethrows typed `NOT_FOUND`; restricts V1 fallback to collection 404. | **PROCEED** | Empirically verified: zero requests sent to `/api/question/:id/reply` or `/api/permission/:id/reply`. |
| **3** | **Fix 3: Partial Multi-Repo Cache Poisoning** | Cached incomplete aggregate task list for 30s TTL when 1 repo failed. | Sets `canCache = false` on repo errors; caches healthy repos individually; retries failed repos next call. | **PROCEED** | Verified with red/green reproduction: repo B failure retried on turn 2, repo A served from cache. |

---

## 3. Hostile Defect Register

### Finding 1: Form Field Type `"external"` Rejection in `replyQuestion`
- **File & Line:** `service/host-client.ts:1067-1080`
- **Severity:** MEDIUM (FUNCTIONAL REJECTION OF FORMS CONTAINING EXTERNAL DISPLAY LINKS)
- **Expected OpenCode V2 Protocol (`@opencode/protocol/dist/groups/form.d.ts:124-130`):**
  ```ts
  Schema.Struct<{
    readonly key: Schema.String;
    readonly type: Schema.Literal<"external">;
    readonly url: Schema.String;
    readonly title?: Schema.String;
    readonly description?: Schema.String;
  }>
  ```
  `external` fields are informational URL displays that do not accept input and do not have entries in the reply `answer` record.
- **Actual Code (`service/host-client.ts:1067-1080`):**
  ```ts
  if (formFields.length > 0) {
    for (let i = 0; i < formFields.length; i++) {
      const f = formFields[i];
      const k = f.key || f.id;
      ...
      // Unsupported field type check
      if (f.type && !['string', 'number', 'integer', 'boolean', 'select', 'multiselect', 'multichoice', 'choice', 'checkbox'].includes(f.type)) {
        throw new HostClientError(`Unsupported form field type "${f.type}" for field "${k}".`, 'UNSUPPORTED_FORM_FIELD');
      }
  ```
- **Defect Impact:**
  If an agent presents an interactive form that includes an external documentation link, OAuth URL, or dashboard link alongside input questions, calling `replyQuestion` encounters `f.type === 'external'` at line 1078 and throws `UNSUPPORTED_FORM_FIELD`. The user is unable to submit answers to the form via voice. Furthermore, if non-input fields are not skipped, sequential answer array indexing `normalized[i]` would become misaligned with the remaining input fields.
- **Minimal Repair:**
  In `service/host-client.ts`, filter out or skip non-input fields (`f.type === 'external'`) in `replyQuestion`:
  ```ts
  // service/host-client.ts:1068
  const inputFields = formFields.filter((f) => f.type !== 'external');
  for (let i = 0; i < inputFields.length; i++) {
    const f = inputFields[i];
    ...
  ```

---

## 4. Empirical Evidence & Verification Audit

### A. Full Gate Verification Suite
- **Command:** `npm run verify` (`tsc --noEmit && npm test`)
  - Result: **PASS (Exit 0)**
  - Test Summary: **459 passed**, 0 failed, 60 test suites, duration 19.7s.
  - TypeScript: `tsc --noEmit` exited 0 with 0 errors.
- **Command:** `npm run build`
  - Output Assets:
    - `panel/main.js`: 99.7kb
    - `live/main.js`: 73.2kb
    - `live/worklet.js`: 1.6kb
    - `service/main.js`: 313.7kb
  - Diff against base `252225a`:
    - `panel/main.js`: **0 bytes diff (identical)**
    - `live/main.js`: **0 bytes diff (identical)**
    - `live/worklet.js`: **0 bytes diff (identical)**
    - `service/main.js`: surgical bundle changes matching `service/host-client.ts` and `service/taskboard.ts`.

### B. Independent Red Baseline Reproduction Against Base `252225a`
Executed using scratch archive extraction of `252225a`:
1. **Finding A (Integer):** `client.replyQuestion('frm_int_1', [['42']], ...)` failed with `UNSUPPORTED_FORM_FIELD: Unsupported form field type "integer" for field "timeout_seconds"`.
2. **Finding B (Dead V1 Probes):** Probing on 404 in `replyQuestion` resulted in `probedV1 === true` (dispatched dead POST to `/api/question/:id/reply`). On `HEAD`, `probedV1 === false`.
3. **Finding C (Partial Cache):** On base `252225a`, Turn 2 made 0 requests to repo B (`fetchCountB === 1`) and returned a stale 1-task list. On `HEAD`, repo A was served from cache (`fetchCountA === 1`) and repo B was retried (`fetchCountB === 2`).

### C. Collateral Sweep of Previously Verified Repairs
Re-verified that none of the 9 previously approved repairs were degraded:
1. **Permission Normalization:** PASS (V2 `action` and `resources` mapped to `permission` and `patterns`).
2. **Multiselect Detection:** PASS (Array formatting and `multiple: true` intact).
3. **Empty V2 Route Lists:** PASS (Returns terminal `null` without querying `/api/permission` or `/api/question`).
4. **Form Field Key Hallucination:** PASS (Throws `SCHEMA_UNAVAILABLE` before network dispatch).
5. **Option Value vs Label Mapping:** PASS (Labels translated to machine values; duplicate collisions flagged).
6. **Cursor Pagination:** PASS (Traverses pages; cyclic cursors throw `INVALID_CURSOR`).
7. **Direct Model Lookup:** PASS (Direct `GET /api/session/:id` bypassing directory listings).
8. **Issue #17 Collision Guarantee:** PASS (Sequential searches across open and closed issues detect collision).
9. **Cache Generation & In-Flight Races:** PASS (In-flight reads completing after `clearCache` discarded).

### D. Read-Only Live Host Probes (`127.0.0.1:3000`)
- `listGlobalSessions()` traversed **1,369 sessions** across 28 pages in **1,255 ms** with zero cyclic errors.
- `getSessionModel()` resolved session model directly via `GET /api/session/:id` (`providerID: 9router`).
- Negative entity lookup: `getPendingPermission` and `getPendingQuestion` on non-existent sessions returned `null` without calling legacy V1 routes.

---

## 5. Test Oracle Matrix (Production vs Mock Classification)

All 6 Repair 2 tests in `test/v2-ratelimit-repair.test.js` were audited:
- Test 3 (`Finding A: Integer Form Field`): **Real Production Execution** (`HostClient.replyQuestion`, `normalizeQuestionRequest`).
- Test 4 (`Finding B: replyQuestion V2 404`): **Real Production Execution** (`HostClient.replyQuestion`).
- Test 5 (`Finding B: replyPermission V2 404`): **Real Production Execution** (`HostClient.replyPermission`).
- Test 6 (`Finding B: Proven V2 Host Negative Lookup`): **Real Production Execution** (`HostClient.replyQuestion`, `replyPermission`).
- Test 7 (`Finding B: Pre-V2 Collection 404 Fallback`): **Real Production Execution** (`HostClient.replyQuestion`, `replyPermission`).
- Test 22 (`Finding C: Multi-Repo Cache Poisoning`): **Real Production Execution** (`TaskboardManager.getTasks`, `fetchRepoTasks`, `setCache`).

---

## 6. Positive Proof Gap (NOT RUN)

- **Status:** **NOT RUN**
- **Justification:** The local loopback host (`127.0.0.1:3000`) shares the live developer's SQLite database (`opencode.db`) and user session roster. Creating or replying to live forms/permissions on the shared host is prohibited to protect developer state. Production code execution is verified via HTTP transport boundary interception in regression test suites.

---

## 7. Actionable Minimal Recovery Repairs

To bring this review from `PROCEED-WITH-CONDITIONS` to `PROCEED`:

1. **Skip Non-Input `"external"` Form Fields in `replyQuestion` (`service/host-client.ts:1067-1080`):**
   Filter out `f.type === 'external'` before iterating over answer slots, ensuring that informational display links do not trigger `UNSUPPORTED_FORM_FIELD` and do not misalign user answer indices for input fields.
