# Test Oracle Matrix: Repair 2 Test Classification

**Commit Audited:** `252225a..HEAD`  
**Test File:** `test/v2-ratelimit-repair.test.js`  
**Auditor:** Independent L4 Hostile Reviewer  

---

## 1. Classification Methodology

In accordance with the Doubt-Driven Development and Verification Levels discipline:
- **Real Production Execution:** The test invokes the real application classes (`HostClient`, `TaskboardManager`) through their public interfaces with production code paths executed. Interception is restricted to standard network boundaries (`fetchImpl`), with assertions validating real runtime state transformations.
- **Mock Double / Simulation:** The test asserts against hand-crafted mock objects or duplicate logic that does not execute the production code paths.

---

## 2. Comprehensive Test Audit Matrix (Repair 2 Additions)

| # | Test Name | Target Function | Boundary Intercepted | Code Paths Verified | Classification |
|---|---|---|---|---|:---:|
| **3** | `Finding A (Repair 2): Form field of type integer accepts valid integer and validates correctly` | `HostClient.replyQuestion`, `HostClient.getPendingQuestion`, `HostClient.normalizeQuestionRequest` | HTTP `fetchImpl` (captures POST payload) | Line 932 (type mapping), Line 1078 (integer whitelist check), Line 1093-1098 (integer parsing & validation: accept 42, reject 42.5, reject non-number) | **Real Production Execution** |
| **4** | `Finding B (Repair 2): replyQuestion with known session does not fall through to V1 on 404` | `HostClient.replyQuestion` | HTTP `fetchImpl` (records requested URLs) | Line 1150-1158 (direct V2 reply POST, no catch block falling back to V1 on 404), assert requested URLs omit `/api/question/:id/reply` | **Real Production Execution** |
| **5** | `Finding B (Repair 2): replyPermission with known session does not fall through to V1 on 404` | `HostClient.replyPermission` | HTTP `fetchImpl` (records requested URLs) | Line 1334-1342 (direct V2 reply POST, no catch block falling back to V1 on 404), assert requested URLs omit `/api/permission/:id/reply` | **Real Production Execution** |
| **6** | `Finding B (Repair 2): replyQuestion and replyPermission without sessionId on proven V2 host do not call V1` | `HostClient.replyQuestion`, `HostClient.replyPermission` | HTTP `fetchImpl` (returns empty 200 list on V2 collection routes) | Line 1013 (`v2FormCollectionSupported`), Line 1161-1163 (`throw NOT_FOUND`), Line 1318 (`v2PermissionCollectionSupported`), Line 1345-1348 (`throw NOT_FOUND`), assert no V1 fall-through | **Real Production Execution** |
| **7** | `Finding B (Repair 2): Legacy fallback to V1 is preserved when V2 route returns 404 (pre-V2 host)` | `HostClient.replyQuestion`, `HostClient.replyPermission` | HTTP `fetchImpl` (returns 404 on V2 routes, 200 on V1 routes) | Line 1166-1178 (legacy V1 question fallback), Line 1352-1365 (legacy V1 permission fallback) | **Real Production Execution** |
| **22** | `Finding C (Repair 2): getTasks in All Projects mode does not cache partial list on repo failure and retries failed repo while reusing cached repo` | `TaskboardManager.getTasks`, `fetchRepoTasks`, `setCache`, `getValidCache` | HTTP `fetchImpl` (tracks request counts per repo) | Line 529 (`canCache = true`), Line 550-563 (per-repo cache check), Line 570-574 (per-repo cache set), Line 576, 581 (`canCache = false`), Line 631 (aggregate cache guard) | **Real Production Execution** |

---

## 3. Findings on Test Boundaries

- 100% of the 6 Repair 2 tests execute production code (`HostClient` and `TaskboardManager` exported from `service/main.js`).
- None of the tests use synthetic simulations or tautological mock passes.
- Network mock boundaries simulate realistic HTTP response statuses (`200`, `204`, `401`, `404`, `500`) and test exact JSON/payload encodings.
