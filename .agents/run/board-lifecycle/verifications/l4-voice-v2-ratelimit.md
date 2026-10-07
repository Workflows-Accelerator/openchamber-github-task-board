# L4 Hostile Review: OpenChamber V2 Compatibility & Rate-Limit Defense

**Target Repository:** `/workspace/extensions/chambervoice`  
**Commit Reviewed:** `cd6ab18` (`fix(v2): support OpenChamber v2 api and add taskboard rate limit defense`)  
**Base Commit:** `235d1ec`  
**Branch:** `feat/v2-compat-and-ratelimit`  
**Review Type:** Read-Only Hostile Adversarial Review (L4)  
**Host Environment:** OpenChamber v2.0.4, OpenCode v2.0.21, Node.js v22.23.3, Linux x86_64  
**Date:** October 2026  
**Auditor:** Dynamic Subagent (L4 Hostile Reviewer)  

---

## 1. Executive Verdict & Summary

### **OVERALL VERDICT: HALT**

While commit `cd6ab18` successfully unblocks the high-level `GET /api/session` `{ data: [], cursor }` pagination envelope and implements initial rate-limiting caches for Task Board, hostile scrutiny against live OpenCode V2 endpoints and `@opencode/protocol` contract definitions reveals **several critical defect classes and silent runtime failures**:

1. **Permissions Protocol Mismatch (CRITICAL):** V2 permissions carry `action` and `resources` (`permission.d.ts`), but `host-client.ts` looks for `permission` and `patterns`. As a result, permission names default to the useless string `'permission'` and patterns are always empty `[]`, blinding the voice user to what action or shell command is awaiting approval.
2. **Form `multiselect` Type Mismatch (CRITICAL):** OpenCode V2 forms use `type: "multiselect"` (`form.d.ts:100`), not `"multichoice"` or `"checkbox"`. Because `f.type === 'multiselect'` is not checked, `replyQuestion` treats multiselect forms as single-select and sends a scalar string `sub[0]` instead of an array of strings, triggering HTTP 400 `FormInvalidAnswerError` from OpenCode's Effect schema validator.
3. **Dead V1 Route Polling Cascade (HIGH):** When `GET /api/permission/request` or `GET /api/form` returns an empty array `[]` (as observed on the idle host), `getPendingPermission` and `getPendingQuestion` fail to find a matching session and immediately fall through to the removed V1 endpoints (`/api/permission` and `/api/question`), firing guaranteed HTTP 404 requests on every check.
4. **Speculative Form Field Key Invention (HIGH):** If form field schema cannot be loaded, `replyQuestion` speculatively invents field keys `'choice'` or `'field_0'`. Real V2 form fields have arbitrary semantic keys (`confirm`, `decision`, etc.). Arbitrary keys fail OpenCode schema validation with `FormInvalidAnswerError`.
5. **Cursor Truncation on Session Rosters (MEDIUM-HIGH):** OpenCode V2 `/api/session` defaults to a page limit of 50. Live probe confirms Page 1 returns 50 sessions and `cursor.next`. `listGlobalSessions()` and `listSessions()` never follow `cursor.next`, quietly dropping all sessions beyond 50. Background worktree discovery in `server.ts:701-723` drops any worktree session pushed past the first 50 global sessions.
6. **Issue #17 Collision Guarantee Violation (MEDIUM-HIGH):** In All Projects mode, `getTask(N)` assumes a task belongs to repo A if repo A is the only known repo in `knownIssueRepos` for issue number `N`. In multi-repo workspaces with sequential issue numbers (#1, #2, #3...), a partially warmed list causes `getTask` to query only repo A, silently bypassing repo B and violating the Issue #17 collision warning contract.
7. **Stale Completion Mutation Overwrite (MEDIUM):** An in-flight `getTasks()` or `getTask()` read that completes after `updateTask()` clears the cache will write pre-mutation stale data back into the cache, serving outdated issue state for up to 30 seconds.

---

## 2. Independent Component Verdicts

| Component | Status | Verdict | Summary |
|---|---|---|---|
| **Session Roster & Polling** | Partial | **PROCEED-WITH-CONDITIONS** | Unwraps `{ data: [], cursor }` and `location.directory`. Fails to follow `cursor.next` beyond 50 sessions; omits `archived` flag; `getSessionModel` lists directory instead of fetching single session. |
| **Form Inspection & Replies** | Broken | **HALT** | Missing V2 `multiselect` type causes HTTP 400; option display labels override option values; invents `'choice'`/`'field_0'` keys; hits dead 404 `/api/question` when list is empty. |
| **Permission Inspection & Replies** | Broken | **HALT** | Reads non-existent `permission`/`patterns` instead of V2 `action`/`resources`, yielding blank details; hits dead 404 `/api/permission` on empty lists; fails to discover session ID from `/api/permission/request`. |
| **Rate-Limit Defense & Taskboard** | Partial | **PROCEED-WITH-CONDITIONS** | 30s cache and serialization functional; breaks Issue #17 multi-repo collision detection on small issue numbers; race condition allows in-flight reads to repopulate cache after mutation clear. |

---

## 3. Hostile Findings & Defect Register

### Finding 1: V2 Permission Schema Field Mismatch (Blank Voice Permissions)
- **File & Line:** `service/host-client.ts:1077-1089`
- **Severity:** HIGH (CRITICAL USER-FACING DEFECT)
- **Actual Code:**
  ```ts
  permission: typeof raw.permission === 'string' ? raw.permission : (typeof raw.type === 'string' ? raw.type : 'permission'),
  patterns: Array.isArray(raw.patterns) ? raw.patterns.map(String) : [],
  ```
- **Expected OpenCode V2 Protocol (`@opencode/protocol/dist/groups/permission.d.ts:12-34`):**
  ```ts
  readonly data: Schema.$Array<Schema.Struct<{
      readonly sessionID: ...;
      readonly action: Schema.String;
      readonly resources: Schema.$Array<Schema.String>;
      readonly save: ...;
      readonly id: ...;
  }>>
  ```
- **Defect Impact:**
  In OpenCode V2, the permission request object provides `action` (e.g. `'bash'`) and `resources` (e.g. `['npm run build']`). The keys `raw.permission` and `raw.patterns` are `undefined`. `normalizePermissionRequest` sets `permission: 'permission'` and `patterns: []`. The voice model and user hear: `"Permission: permission"` with no command or resource text.
- **Why Builder Unit Test Missed It:**
  In `test/host-client.test.js:779-786`, the builder mocked synthetic test data containing `{ permission: 'bash', patterns: ['npm run build'] }` instead of asserting against the real V2 schema.
- **Minimal Repair:**
  ```ts
  const action = typeof raw.action === 'string' ? raw.action : (typeof raw.permission === 'string' ? raw.permission : (typeof raw.type === 'string' ? raw.type : 'permission'));
  const patterns = Array.isArray(raw.resources) ? raw.resources.map(String) : (Array.isArray(raw.patterns) ? raw.patterns.map(String) : []);
  ```

---

### Finding 2: Form `multiselect` Type Omission Triggers HTTP 400 `FormInvalidAnswerError`
- **File & Line:** `service/host-client.ts:866, 964`
- **Severity:** HIGH (CRITICAL FUNCTIONAL DEFECT)
- **Actual Code:**
  ```ts
  // normalizeQuestionRequest:
  const multiple = f.type === 'multichoice' || f.type === 'checkbox' || f.multiple === true;
  // replyQuestion:
  const isMulti = f.type === 'multichoice' || f.type === 'checkbox' || f.multiple === true;
  const sub = normalized[i] ?? [];
  answerObj[k] = isMulti ? sub : (sub[0] ?? '');
  ```
- **Expected OpenCode V2 Protocol (`@opencode/protocol/dist/groups/form.d.ts:100`):**
  ```ts
  readonly type: Schema.Literal<"multiselect">;
  ```
- **Defect Impact:**
  OpenCode V2 form schema defines multi-select fields with `type: "multiselect"`. Neither `"multichoice"` nor `"checkbox"` exists in V2. Because `f.type === 'multiselect'` is omitted, `isMulti` evaluates to `false`. When replying, `replyQuestion` sends a single string `sub[0]` instead of an array of strings `sub`. OpenCode's Effect schema validator (`session.d.ts:11236`) rejects scalar strings for multiselect fields with HTTP 400 `FormInvalidAnswerError`.
- **Why Builder Unit Test Missed It:**
  In `test/host-client.test.js:686`, the builder mocked `type: 'choice'`, which does not exist in OpenCode V2.
- **Minimal Repair:**
  ```ts
  const isMulti = f.type === 'multiselect' || f.type === 'multichoice' || f.type === 'checkbox' || f.multiple === true;
  ```

---

### Finding 3: Empty V2 Lists Fall Through to Removed V1 Routes (404 Cascade)
- **File & Line:** `service/host-client.ts:810-845, 1037-1075`
- **Severity:** MEDIUM-HIGH (RUNTIME NOISE & RATE/NETWORK WASTE)
- **Actual Code:**
  ```ts
  // getPendingPermission:
  try {
    const raw = await this.request<any>('GET', `/api/permission/request...`);
    const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : null);
    if (Array.isArray(list)) {
      const request = list.find(...);
      if (request) return this.normalizePermissionRequest(request, sessionId);
    }
  } catch {}
  try {
    const raw = await this.request<any>('GET', `/api/permission...`); // HITS DEAD V1 ROUTE!
    ...
  }
  ```
- **Live Empirical Evidence:**
  Live probe on running OpenChamber host with tracking fetch demonstrated:
  When `getPendingPermission("ses_nonexistent")` is called, `/api/permission/request` returns `data: []` (HTTP 200). Because `request` is `undefined`, execution falls out of the `if (Array.isArray(list))` block, leaves the first `try`, and fires `GET /api/permission`, which returns HTTP 404.
  Similarly, `getPendingQuestion("ses_nonexistent")` returns `data: []` from `/api/form`, falls through, and fires `GET /api/question`, which returns HTTP 404.
- **Defect Impact:**
  Every routine check or poll for a session without a pending request fires requests against dead V1 endpoints, filling server error logs with 404s.
- **Minimal Repair:**
  If the V2 request succeeded and returned an array (even if empty), return `null` immediately without entering the legacy V1 fallback:
  ```ts
  if (Array.isArray(list)) {
    const request = list.find(...);
    return request ? this.normalizePermissionRequest(request, sessionId) : null;
  }
  ```

---

### Finding 4: Speculative Field Key Hallucination in `replyQuestion`
- **File & Line:** `service/host-client.ts:968-974`
- **Severity:** MEDIUM-HIGH
- **Actual Code:**
  ```ts
  for (let i = 0; i < normalized.length; i++) {
    const sub = normalized[i];
    const k = normalized.length === 1 ? 'choice' : `field_${i}`;
    answerObj[k] = sub.length > 1 ? sub : (sub[0] ?? '');
  }
  ```
- **Defect Impact:**
  If form schema is unavailable (e.g. status snapshot lacked fields or form detail GET failed), `replyQuestion` blindly invents field names `'choice'` or `'field_0'`. In OpenCode V2, form fields carry arbitrary developer-defined keys (`confirm`, `package_name`, `action`). Submitting invented keys fails OpenCode schema validation with HTTP 400 `FormInvalidAnswerError`.
- **Minimal Repair:**
  If `formFields` is empty and answers were provided as an unstructured array, fail safely with an explanatory error instead of submitting guessed keys that OpenCode will reject.

---

### Finding 5: Option Value vs Display Label Reverse-Mapping Missing
- **File & Line:** `service/host-client.ts:858-864, 960-967`
- **Severity:** MEDIUM
- **Actual Code:**
  ```ts
  // normalizeQuestionRequest:
  options: (Array.isArray(f.options) ? f.options : [])
    .map((o: any) => ({
      label: typeof o.label === 'string' ? o.label : String(o.value ?? ''),
      description: typeof o.description === 'string' ? o.description : '',
    }))
  ```
- **Defect Impact:**
  In OpenCode V2, options have distinct `value` (machine token, e.g. `'yes'`) and `label` (spoken text, e.g. `'Yes, apply migrations'`). `normalizeQuestionRequest` keeps only `label`. When the user selects or speaks `"Yes, apply migrations"`, `replyQuestion` sends the display label as the field answer. When `f.custom === false`, OpenCode verifies that the answer matches an option `value`, triggering `FormInvalidAnswerError`.
- **Minimal Repair:**
  Preserve `value` on `QuestionOption` (`{ label, value, description }`) and in `replyQuestion`, match user answer strings against option labels and map back to `value`.

---

### Finding 6: Silent Session Roster Dropping Beyond 50 (Missing Cursor Pagination)
- **File & Line:** `service/host-client.ts:405-430, 434-437`, `service/server.ts:684-724`
- **Severity:** MEDIUM-HIGH
- **Live Empirical Evidence:**
  Live probe on running OpenChamber host:
  `GET /api/session` returned `dataLength: 50`, `cursor: { previous: '...', next: 'eyJ...' }`.
  Paging with `cursor.next` returned another 50 sessions on Page 2 (100+ sessions on host).
  `listGlobalSessions()` in `host-client.ts:434` executes a single unpaginated GET and returns only the 50 sessions from Page 1.
- **Defect Impact:**
  In `server.ts:701-723`, `pollSessionActivity` inspects `globalSessions` to discover active and blocked worktree sessions. Any worktree session outside the top 50 global sessions is permanently dropped from background monitoring. Furthermore, in directories with >50 sessions, `listSessions(directory)` omits all sessions beyond page 1.
- **Minimal Repair:**
  In `listSessions` and `listGlobalSessions`, support passing `limit: 100` or loop over `cursor.next` up to a bounded safety limit (e.g. 200 sessions).

---

### Finding 7: Single-Session Detail Listing Entire Directory in `getSessionModel`
- **File & Line:** `service/host-client.ts:680-702`
- **Severity:** MEDIUM
- **Actual Code:**
  ```ts
  const sessions = await this.listSessionsRaw(directory);
  const match = sessions.find((entry) => entry?.id === sessionId);
  ```
- **Live Empirical Evidence:**
  Live probe confirmed `GET /api/session/:sessionID` succeeds directly (returning `{ data: { model: { id, providerID, variant } } }`).
- **Defect Impact:**
  `getSessionModel` fetches up to 50 sessions for the directory just to inspect one session's model. If `sessionId` is in a worktree child directory or older than 50 sessions, `listSessionsRaw` fails to find it and returns `null`.
- **Minimal Repair:**
  Fetch the individual session directly:
  `const res = await this.request<any>('GET', `/api/session/${encodeURIComponent(sessionId)}`);`

---

### Finding 8: Issue #17 Collision Warning Silenced by Premature Known-Repo Routing
- **File & Line:** `service/taskboard.ts:642-655`
- **Severity:** MEDIUM-HIGH (CROSS-REPO DATA / REPOSITORY AMBIGUITY)
- **Actual Code:**
  ```ts
  const matchedKnown = knownForNum
    ? Array.from(knownForNum).filter((r) => knownRepos.includes(r))
    : [];

  if (matchedKnown.length === 1) {
    const single = await this.fetchSingleRepoTask(matchedKnown[0], number);
    if (single.ok && single.task) {
      ...
      return result;
    }
  }
  ```
- **Defect Impact:**
  GitHub issue numbers are sequential integers starting at #1 in every repo. If the user previously listed issues in `repo-backend` (caching `#12`), and later asks for task `#12` in All Projects mode:
  `matchedKnown.length === 1` evaluates to `true`.
  `getTask` queries only `repo-backend` and returns its issue #12.
  If `repo-frontend` also has an issue #12, that collision is silently suppressed!
  This directly violates the Issue #17 contract which mandates alerting the user to multiple matching repositories:
  `"Issue #12 exists in multiple repositories (repo-backend, repo-frontend)... Select a specific project to disambiguate."`
- **Trade-Off Analysis (D11 vs Issue #17):**
  D11 aimed to avoid fanning out to N repos for known tasks. But assuming a task number only exists in one repo based on a partially warmed cache breaks cross-repo collision safety.
- **Minimal Repair:**
  Only fast-path to `matchedKnown[0]` if `knownIssueRepos` has been warmed by a recent full All Projects listing across all known repos, or verify task numbers against all repos if the issue number is small (e.g. < 100) where collisions are statistically near 100%.

---

### Finding 9: Stale Completion Race Condition Overwrites Mutation Cache Clear
- **File & Line:** `service/taskboard.ts:478-565, 786-790, 863-867`
- **Severity:** MEDIUM (STALE DATA ON VOICE QUERIES)
- **Race Sequence:**
  1. Voice client triggers `getTasks()`. `fetchRepoTasks()` is dispatched to GitHub API (takes 600ms).
  2. At 200ms, user issues a command that triggers `updateTask()`. `updateTask()` executes and calls `this.clearCache()`.
  3. At 600ms, `fetchRepoTasks()` from Step 1 finishes. Line 564 executes: `this.setCache(cacheKey, result)`.
  4. Pre-mutation stale data is written into `this.cache` with a 30-second TTL.
  5. Subsequent `getTasks()` calls for the next 30 seconds return outdated state.
- **Minimal Repair:**
  Track a cache generation counter or epoch timestamp. If `clearCache()` is called, increment generation; discard cache writes from in-flight reads started prior to the generation bump.

---

### Finding 10: Multi-Repo Serialization Latency Risks Voice Assistant Timeouts
- **File & Line:** `service/taskboard.ts:503-530`
- **Severity:** MEDIUM (LATENCY / UX DEGRADATION)
- **Trade-Off Analysis:**
  D11 replaced `Promise.allSettled` with a sequential `for` loop across `knownRepos`.
  With 8 configured repositories taking ~300ms each, `getTasks()` in All Projects mode takes a minimum of `2.4 seconds` sequentially.
  If any repository experiences an API stall or 5-second network timeout, total turn duration exceeds 7+ seconds.
  In Gemini Live voice interactions, turns taking >5 seconds cause dead air or client-side turn cancellation.
- **Minimal Repair:**
  Add a bounded per-repo timeout (e.g. 1.5s) in the sequential loop, or serialize with a small concurrency pool (e.g. 2 concurrent workers) instead of strict serial execution.

---

## 4. Empirical Evidence & Verification Execution

### A. Static & Verification Test Suite Run
- **Command:** `npm run verify`
- **Working Directory:** `/workspace/extensions/chambervoice`
- **Outcome:** **PASS (Exit 0)**
- **Test Metrics:**
  - Total Tests: **437 passed** (0 failed, 0 cancelled, 0 skipped)
  - Total Suites: **59 passed**
  - Verification Duration: **18.38s**
- **Typecheck:** `tsc --noEmit` exited with code 0 (0 errors).

### B. Generated Bundle Parity (`service/main.js`)
- **Command:** `npm run build:service && git diff service/main.js`
- **Outcome:** Clean zero-diff. The checked-in `service/main.js` is byte-for-byte identical to the output of `esbuild service/main.ts`.

### C. Live V2 Host Probes (Read-Only)
Live probes were conducted against the running OpenChamber host (`http://127.0.0.1:3000`) using authorized guest auth:

1. **Session Listing & Pagination Envelope:**
   - `GET /api/session` -> HTTP 200.
   - Response Shape: `{ data: [50 sessions], cursor: { previous: '...', next: 'eyJ...' } }`.
   - Proved default limit is 50 and `cursor.next` paginates to another 50 sessions on Page 2.
2. **Form Route Existence:**
   - `GET /api/form` -> HTTP 200.
   - Response Shape: `{ location: { directory: '/workspace' }, data: [] }`.
   - `GET /api/question` -> HTTP 404 (`NOT_FOUND`).
3. **Permission Route Existence:**
   - `GET /api/permission/request` -> HTTP 200.
   - Response Shape: `{ location: { directory: '/workspace' }, data: [] }`.
   - `GET /api/permission` -> HTTP 404 (`NOT_FOUND`).
4. **Sessions Status Snapshot:**
   - `GET /api/sessions/status` -> HTTP 200.
   - Response Shape: `{ sessions: {...}, pending: {}, serverTime: ... }`.
5. **Single Session Get:**
   - `GET /api/session/ses_f22887e18ffem6RBrwgNhw5iNM` -> HTTP 200.
   - Response Shape: `{ data: { id, model: { id: 'genius', providerID: '9router' }, ... } }`.

---

## 5. Missing Positive Proof & Disposable Session Fixture

### Missing Positive Proof
Because the review was conducted strictly read-only and no active forms or permission prompts were pending on the host, **no positive reply submission proof exists** for `POST /api/session/:id/form/:id/reply` or `POST /api/session/:id/permission/:id/reply`.

### Safe Disposable Session Fixture Contract (NOT RUN)
To safely gather positive reply proof without touching production user sessions or answering pending developer prompts:
1. **Fixture Creation:** Call `POST /api/session` with `directory: "/tmp/antigravity/l4-disposable-fixture"` and a test prompt.
2. **Trigger Interactive Form:** In the test session, invoke an agent tool that generates an interactive form or requests a command permission.
3. **Inspect Request:** Query `GET /api/sessions/status` to confirm the request appears in `pending[sessionId].forms` or `pending[sessionId].permissions`.
4. **Execute Reply:** Dispatch `replyQuestion` or `replyPermission` using ChamberVoice's `HostClient`.
5. **Assert Proof:** Confirm OpenCode returns HTTP 204 `NoContent`, and verify the pending request disappears from `GET /api/sessions/status`.
6. **Cleanup:** Delete the disposable session.

*Status: MARKED NOT RUN per brief scope constraints.*

---

## 6. Actionable Recovery Blueprint

To bring `feat/v2-compat-and-ratelimit` from **HALT** to **PROCEED**, apply the following minimal repairs:

1. **Fix Permission Schema Normalization (`service/host-client.ts:1084-1085`):**
   Read `raw.action` (fallback `raw.permission`) and `raw.resources` (fallback `raw.patterns`).
2. **Fix Form Multi-Select Detection (`service/host-client.ts:866, 964`):**
   Add `f.type === 'multiselect'` to `isMulti` checks.
3. **Prevent Fall-Through to Dead V1 Routes on Empty Lists (`service/host-client.ts:820, 1045`):**
   If `Array.isArray(list)` is true, return the found match or `null` directly; do not fall through to the second `try` block.
4. **Remove Guessed Keys in `replyQuestion` (`service/host-client.ts:968-974`):**
   If `formFields` is empty, throw a descriptive `HostClientError` instead of guessing `'choice'` / `'field_0'`.
5. **Add Page Limit & Cursor Awareness to Roster Polling (`service/host-client.ts:405-430`):**
   Pass `limit: 100` on `/api/session` queries to prevent dropping sessions 51-100.
6. **Protect Issue #17 Multi-Repo Collisions (`service/taskboard.ts:642-655`):**
   Do not fast-path to a single repo when issue numbers are small (<100) unless all repos in the workspace have been verified.
7. **Add Generation Counter to Taskboard Cache (`service/taskboard.ts:240, 786`):**
   Prevent in-flight read promises from writing back into `this.cache` after `clearCache()` has been called.
8. **Rebuild Bundle & Re-run Verification:**
   Run `npm run build && npm run verify`.
