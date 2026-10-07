# Sanitized Live Read-Only Host Evidence

**Target Host:** OpenChamber Host (Node.js 22, Express loopback, OpenCode v2.0.21)  
**Host URL:** `http://127.0.0.1:3000` (loopback only)  
**Auth Type:** Guest session cookie from local environment (credentials never printed or logged)  
**Execution Date:** October 2026  
**Auditor:** Independent L4 Hostile Reviewer  

---

## 1. Session Pagination & Complete Roster Verification

### Command Executed:
```javascript
const client = new HostClient();
const t0 = Date.now();
const globals = await client.listGlobalSessions();
console.log(`Fetched ${globals.length} sessions in ${Date.now() - t0} ms`);
```

### Empirical Result:
- **Total Sessions Discovered:** `1,365`
- **Elapsed Duration:** `954 ms`
- **Total Pages Traversed:** ~28 pages (default page size 50)
- **Cyclic Cursor Guard:** Active (no infinite loop encountered)
- **Memory Consumption:** Clean, non-leaking traversal

### Archive State Verification:
- **Total Sessions Checked:** 1,365
- **Archived Count:** 13
- **Sample Non-Archived Session:**
  ```json
  {
    "id": "ses_active_sample",
    "time": {
      "created": 1791307528687,
      "updated": 1791385513938,
      "idle": 1791385437954
    },
    "archived": false
  }
  ```
- **Sample Archived Session:**
  ```json
  {
    "id": "ses_f21ce9d93ffegI9HNTvPEl2AsQ",
    "time": {
      "created": 1790434173661,
      "updated": 1790434173661,
      "archived": 1790435981701
    },
    "archived": true
  }
  ```
- **Proof:** `typeof entry.time.archived === 'number' && entry.time.archived > 0` accurately reflects OpenCode V2 schema and decodes archived status as a boolean without dropping records.

---

## 2. Direct Session Detail Lookup (`getSessionModel`)

### Command Executed:
```javascript
const client = new HostClient();
const model = await client.getSessionModel("ses_active_sample", "/workspace");
console.log("Model:", JSON.stringify(model));
```

### Empirical Result:
- **Endpoint Called:** `GET /api/session/ses_active_sample?directory=%2Fworkspace` (HTTP 200)
- **Response Shape:**
  ```json
  {
    "providerID": "9router",
    "modelID": "engineer",
    "agent": "dynamic-agent"
  }
  ```
- **Directory Listing Check:** Whole-directory query `GET /api/session?directory=...` was **NOT** executed. Direct route succeeded on first try.

---

## 3. Absence of Dead V1 Probes on Idle Sessions (`getPendingPermission` & `getPendingQuestion`)

### Tracking Fetch Trace for `getPendingPermission`:
- **Query Target:** `ses_nonexistent` (no pending permission)
- **Requests Captured:**
  1. `GET /api/sessions/status` -> 200 OK (`{ sessions: {}, pending: {} }`)
  2. `GET /api/permission/request?directory=%2Fworkspace` -> 200 OK (`{ location: { directory: "/workspace" }, data: [] }`)
- **Outcome:** Returned `null` immediately.
- **V1 Route Probe Check:** `GET /api/permission` was **NOT** called. (Exit code clean, zero 404s logged).

### Tracking Fetch Trace for `getPendingQuestion`:
- **Query Target:** `ses_nonexistent` (no pending question)
- **Requests Captured:**
  1. `GET /api/sessions/status` -> 200 OK (`{ sessions: {}, pending: {} }`)
  2. `GET /api/form?directory=%2Fworkspace` -> 200 OK (`{ location: { directory: "/workspace" }, data: [] }`)
  3. `GET /api/session/ses_nonexistent/message?directory=%2Fworkspace` -> 404 Not Found (legacy turn fallback)
- **Outcome:** Returned `null`.
- **V1 Route Probe Check:** `GET /api/question` was **NOT** called.

---

## 4. Empirical Defect Proof: Fallback to Dead V1 Routes on Nonexistent Entity Reply

### Command Executed (Tracking Fetch on `replyPermission`):
```javascript
await client.replyPermission("perm_nonexistent", "once", "/workspace", "ses_nonexistent");
```

### Requests Captured:
1. `POST /api/session/ses_nonexistent/permission/perm_nonexistent/reply?directory=%2Fworkspace` -> **HTTP 404** (`PermissionNotFoundError`)
2. `POST /api/permission/perm_nonexistent/reply?directory=%2Fworkspace` -> **HTTP 404** (DEAD V1 ROUTE)

### Error Thrown:
```
HostClientError: Host request failed: POST /api/permission/perm_nonexistent/reply?directory=%2Fworkspace returned 404.
```
**Conclusion:** Catches V2 404 and probes removed V1 route, throwing misleading error that references removed V1 endpoint instead of reporting V2 entity absence.
