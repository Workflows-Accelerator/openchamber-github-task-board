# Test Oracle Matrix: Production Execution vs Mock Boundaries

**Review Commit:** `252225a`  
**Test Files Audited:** `test/v2-ratelimit-repair.test.js` (16 tests) & `test/taskboard.test.js` (modified caching test)  
**Oracle Source:** `@opencode/protocol` dist definitions and live OpenCode v2.0.21 host endpoints  

---

## 1. Test-by-Test Audit & Execution Classification

| # | Test Name | Production Code Executed | Mocked / Double Layer | Real Protocol Fidelity | Oracle Efficacy / Blind Spot |
|:---:|---|---|---|:---:|---|
| **1** | Finding 1: getPendingPermission normalizes V2 action and resources into permission and patterns | `HostClient.getPendingPermission`<br>`HostClient.normalizePermissionRequest` | `fetchImpl` returning V2 `/api/permission/request` schema `{ location, data: [{ action, resources }] }` | **HIGH** | Proves `action` -> `permission` and `resources` -> `patterns`. Matches `permission.d.ts:17-18`. |
| **2** | Finding 2: normalizeQuestionRequest detects multiselect and replyQuestion formats array | `HostClient.getPendingQuestion`<br>`HostClient.normalizeQuestionRequest`<br>`HostClient.replyQuestion` | `fetchImpl` returning V2 status snapshot and capturing reply POST body | **HIGH** | Asserts answers are formatted as `string[]` for multiselect. **Blind spot:** Did not test field type `"integer"`, which we discovered is rejected by type whitelist. |
| **3** | Finding 3: Empty V2 permission list returns null and does not query /api/permission | `HostClient.getPendingPermission`<br>`HostClient.getPendingPermissionFromList` | `fetchImpl` returning `{ data: [] }` on `/api/permission/request` and recording requested URLs | **HIGH** | Proves empty V2 list is terminal null. **Blind spot:** Only tested empty list GET; did not test 404 on `replyPermission` POST. |
| **4** | Finding 3: Empty V2 form list returns null and does not query /api/question | `HostClient.getPendingQuestion`<br>`HostClient.getPendingQuestionFromQuestions` | `fetchImpl` returning `{ data: [] }` on `/api/form` and tracking URLs | **HIGH** | Proves empty V2 list is terminal null and dead V1 route `/api/question` is omitted. |
| **5** | Finding 4: replyQuestion throws when form schema is unavailable instead of inventing choice or field_0 | `HostClient.replyQuestion` | `fetchImpl` returning 404 for form schema detail request | **HIGH** | Asserts `SCHEMA_UNAVAILABLE` error is thrown before issuing any HTTP POST. |
| **6** | Finding 5: replyQuestion translates spoken option labels to machine values for single-choice fields | `HostClient.replyQuestion` | `fetchImpl` returning options with distinct `value` and `label` | **HIGH** | Asserts display label maps to machine value in payload. Matches `form.d.ts:20-22`. |
| **7** | Finding 6: listSessions and listGlobalSessions follow cursor.next through 150+ sessions | `HostClient.listSessions`<br>`HostClient.fetchAllSessionPages` | `fetchImpl` returning 3 pages of 50 sessions each with `cursor.next` | **HIGH** | Proves multi-page cursor traversal, 150 items accumulated, directory query parameter preserved. |
| **8** | Finding 6: Repeated pagination cursor throws INVALID_CURSOR visibly | `HostClient.listSessions`<br>`HostClient.fetchAllSessionPages` | `fetchImpl` returning repeated cursor string | **HIGH** | Proves cyclic cursor loop detection fails visibly. |
| **9** | Finding 7: getSessionModel queries direct session detail without listing entire directory | `HostClient.getSessionModel` | `fetchImpl` responding to `/api/session/:id` | **HIGH** | Asserts direct session detail route is called and directory listing is skipped. |
| **10** | Finding 8: In All Projects mode, getTask checks all known repos and detects collision for same issue number | `TaskboardManager.getTask` | `fetchImpl` responding for 2 repos with issue #12 | **HIGH** | Proves collision warning message emitted when issue #12 exists in both repos. |
| **11** | Finding 8: In All Projects mode, getTask detects collision against closed issue in second repo | `TaskboardManager.getTask` | `fetchImpl` returning open issue in repo A and closed issue in repo B | **HIGH** | Proves closed issues are included in collision detection. |
| **12** | Finding 9: In-flight read completing after clearCache does not write stale data to cache | `TaskboardManager.getTasks`<br>`TaskboardManager.updateTask` | Deferred `fetchImpl` resolving after mutation | **HIGH** | Proves in-flight read completing after mutation does not poison cache with pre-mutation data. |
| **13** | Scope switch during fetch invalidates in-flight read and does not return or cache for new repo | `TaskboardManager.getTasks` | Deferred `fetchImpl` with file-system guest storage modification mid-flight | **HIGH** | Proves scope switch aborts stale write and triggers re-fetch under new scope. |
| **14** | closeTask clears cache so next read immediately sees updated state | `TaskboardManager.closeTask`<br>`TaskboardManager.getTasks` | `fetchImpl` tracking call counts and states | **HIGH** | Proves `closeTask` clears cache and next read sees fresh closed state. |
| **15** | replyPermission discovers sessionID from /api/permission/request when status snapshot lacks it | `HostClient.replyPermission` | `fetchImpl` providing `/api/permission/request` list with `sessionID` | **HIGH** | Proves session resolution fallback when status snapshot is empty. |
| **16** | listSessions preserves archived boolean when time.archived is present in V2 session | `HostClient.listSessions` | `fetchImpl` providing V2 session with `time.archived` timestamp | **HIGH** | Proves `time.archived` timestamp maps to boolean without error. |
| **17** | `taskboard.test.js`: getTask verifies all known repos before caching unique task in All Projects mode | `TaskboardManager.getTask` | `fetchImpl` simulating GitHub API with tracked URLs | **HIGH** | Proves all repos queried on cold read (2 URLs), and 0 URLs queried on subsequent warm read within TTL. |

---

## 2. Summary Assessment of Test Coverage
All 17 tests directly instantiate and exercise the **real production classes** (`HostClient`, `TaskboardManager`). None of the tests copy-paste logic into fake local `simulate*` functions. All network boundaries are mocked via standard `fetchImpl` request interception, asserting exact parameter and header propagation.

**Uncovered Protocol Edge Cases Identified by L4 Review:**
1. Form field with `type: "integer"` was omitted from test fixtures and rejected in production code (Finding A).
2. HTTP 404 response on `/api/session/:sessionID/form/:formID/reply` or `/api/session/:sessionID/permission/:requestID/reply` was omitted from test fixtures and causes fallback to dead V1 routes in production code (Finding B).
3. Partial failure of 1 repo in multi-repo `getTasks()` was omitted from test fixtures and causes caching of incomplete task list (Finding C).
