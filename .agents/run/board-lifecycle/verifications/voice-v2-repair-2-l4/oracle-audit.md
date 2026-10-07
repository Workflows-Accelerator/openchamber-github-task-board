# Protocol Oracle Audit: OpenCode V2 Contract vs ChamberVoice Repair 2

**Review Commit Range:** `252225a..HEAD` (`f58e11b`, `67f955f`, `d582374`, docs `a5ddb77`)  
**Base Commit:** `252225a` (`fix(v2): repair protocol mismatches and taskboard caching race conditions`)  
**Branch:** `fix/v2-ratelimit-review-repair`  
**Protocol Source Reference:** `/workspace/config/opencode/node_modules/.pnpm/@opencode+protocol@2.0.15/node_modules/@opencode/protocol/dist/groups/`  
**Auditor:** Independent L4 Hostile Reviewer  
**Host Environment:** OpenChamber v2.0.4, OpenCode v2.0.21, Node.js v22.23.3, Linux x86_64  

---

## 1. Protocol Contract Audit: Form Definitions & Reply Handling

### A. Protocol Form Field Types (`form.d.ts:12-130`)
OpenCode V2 defines the complete union of form field types:
1. `type: "string"` (`form.d.ts:13`): Single-line or multi-line text input, optional `options` and `format`.
2. `type: "number"` (`form.d.ts:45`): Floating-point or general numeric input (`minimum`, `maximum`, `default`).
3. `type: "integer"` (`form.d.ts:64`): Whole integer input (`minimum`, `maximum`, `default`).
4. `type: "boolean"` (`form.d.ts:83`): Boolean checkbox or toggle.
5. `type: "multiselect"` (`form.d.ts:100`): Array of choices with `options`, `minItems`, `maxItems`, `custom`.
6. `type: "external"` (`form.d.ts:124-130`):
   ```ts
   Schema.Struct<{
     readonly key: Schema.String;
     readonly type: Schema.Literal<"external">;
     readonly url: Schema.String;
     readonly title?: Schema.String;
     readonly description?: Schema.String;
   }>
   ```

### B. Repair 2 Implementation vs Protocol Audit
| Field Type / Protocol Action | Protocol Expectation (@opencode/protocol) | ChamberVoice Repair 2 (`service/host-client.ts`) | Status | Finding / Risk |
|---|---|---|---|---|
| **`"integer"` Form Field Type** | Valid integer answers accepted (`42`, `-5`); fractional numbers rejected (`42.5`). | Lines 1078, 1093-1098: Whitelisted `'integer'`. Validates `!strToken \|\| isNaN(num) \|\| (f.type === 'integer' && !Number.isInteger(num))`. | **MATCH** | Accepted. 42 passes; 42.5, non-numeric strings, and empty strings throw `INVALID_FIELD_ANSWER`. |
| **`"external"` Form Field Type** | Non-input display URL element (`url`, `title`, `description`). Does NOT take user answer in `answer` record. | Lines 1078-1080: Whitelist check `if (f.type && !['string', 'number', 'integer', ...].includes(f.type))` throws `UNSUPPORTED_FORM_FIELD`. | **MISMATCH (DEFECT)** | **Finding 1 (Residual):** Any valid V2 form presenting an `external` field alongside input fields throws `UNSUPPORTED_FORM_FIELD` and cannot be answered. |
| **`QuestionInfo.type` Plumbing** | Backward-compatible type metadata on question inspection. | Line 69: `type?: string;`. Line 932: `type: typeof f.type === 'string' ? f.type : undefined`. | **MATCH** | Backward compatible. Does not disturb tool execution or existing callers. |

---

## 2. Protocol Contract Audit: 404 Route Semantics & Error Surfacing

### Protocol Definitions
- `POST /api/session/:sessionID/form/:formID/reply` (`session.d.ts:11224-11231`):
  - Returns `204 NoContent` on success.
  - Errors: `404 SessionNotFoundError`, `404 FormNotFoundError`, `400 FormInvalidAnswerError`.
- `POST /api/session/:sessionID/permission/:requestID/reply` (`session.d.ts:11200`):
  - Returns `204 NoContent` on success.
  - Errors: `404 SessionNotFoundError`, `404 PermissionNotFoundError`.

### Audit Findings for Fix 2
1. **Entity 404 Probing Elimination:**
   - Previous behavior (`252225a`): Catch block in `replyQuestion` (lines 1157-1163) and `replyPermission` (lines 1340-1345) caught `err.code === 'NOT_FOUND'` and dispatched a second request to dead V1 routes (`/api/question/:id/reply` or `/api/permission/:id/reply`).
   - Repaired behavior (`HEAD`): When `targetSessionId` is known, V2 reply POST is dispatched directly. Any 404 (`FormNotFoundError` or `PermissionNotFoundError`) propagates immediately to caller with `HostClientError(..., 'NOT_FOUND')`. Zero V1 probes are dispatched.
2. **Collection 404 Fallback Boundary:**
   - When `sessionId` is not provided, client queries `/api/form` or `/api/permission/request`.
   - If the endpoint returns 200, `v2FormCollectionSupported` / `v2PermissionCollectionSupported` is set to `true`. If the item is missing from the list, it throws `NOT_FOUND` without probing V1 routes.
   - If `/api/form` or `/api/permission/request` returns 404 (pre-V2 host where V2 endpoints do not exist), `v2*CollectionSupported` remains `false`, and legacy fallback to V1 endpoints is executed.
   - Non-404 errors (401, 403, 500) are explicitly re-thrown (`err.code !== 'NOT_FOUND'`), preventing misclassification of auth errors or transient server errors as legacy hosts.

---

## 3. Protocol Contract Audit: Multi-Repo Caching & Rate-Limit Defense

### All Projects Mode Specification
- When `selected_repo === '__all_projects__'`, `TaskboardManager.getTasks()` queries each configured repository sequentially.
- If 1 of N repositories fails:
  - The aggregate result must NOT be cached as complete for the 30s TTL.
  - Repositories that succeeded are cached individually under `list:${repo}:${status}:${label}` to avoid redundant network queries on subsequent calls.
  - Repositories that failed must be retried on the next call.
- Cache generation tracking:
  - If a task mutation (`createTask`, `updateTask`, `closeTask`) or scope switch occurs while a multi-repo fetch is in flight, `cacheGeneration` increments, preventing both per-repo and aggregate caches from writing stale results.
- In-flight coalescing:
  - Simultaneous `getTasks()` calls in All Projects mode coalesce onto a single active `fetchPromise` via `inflightReads` map keyed by `${startRepo}:${cacheKey}:${startGeneration}`.

Audit Status: **MATCH** with one verified condition (see Finding 1).
