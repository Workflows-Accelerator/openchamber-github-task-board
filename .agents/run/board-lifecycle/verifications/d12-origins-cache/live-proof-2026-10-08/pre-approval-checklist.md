# D12 Live Proof: Pre-Approval Checklist & Human Gate

**Mission:** D12 Direct-Origins Caching Activation (`github-task-board`)  
**Date:** 2026-10-08  
**Status:** HALTED AT BRANCH B (Awaiting Human Approval)  
**Evidence Artifacts:**
- Screenshot: `panel-pre-approval.png`
- Observations: `observations.md`
- Sanitized Evidence Extract: `sanitized-evidence.json`

---

## 1. Concrete Observed Pre-Approval Evidence (Criterion 1)

1. **Delivered CSP Header:**
   The live OpenChamber server delivered the following Content-Security-Policy to the panel iframe at `/api/guests/github-task-board/panel/index.html`:
   ```text
   sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'self' data: blob:; style-src 'unsafe-inline' 'self' data: blob:; img-src 'self' data: blob:; font-src 'self' data: blob:; media-src 'self' data: blob:; worker-src 'self' data: blob:; frame-src 'self' data: blob:; connect-src 127.0.0.1:3000/api/guests/github-task-board/; object-src 'none'; form-action 'none'
   ```
   - Direct connection to `https://api.github.com`: **DENIED** (absent from `connect-src`).

2. **Capability Grants in Registry:**
   - Registry check (`GET /api/guests`): `github-task-board` has `requested: ["network", "filesystem", "origins"]`, but `granted: ["prompt", "sessions", "files", "filesystem", "network"]`.
   - The `"origins"` capability is currently **UNAPPROVED**.

3. **Observed Direct Fetch & Fallback Execution:**
   - Panel attempted direct fetch to:
     `GET https://api.github.com/repos/<owner>/<repo>/issues?state=all&per_page=100&page=1`
   - Direct fetch failed due to the pre-approval boundary:
     `[TaskBoard] Direct PAT fetch failed (CORS preflight returned HTTP 403 Forbidden), falling back to host proxy...`
   - Panel immediately routed through the fallback mechanism:
     `host.request({ method: 'GET', path: '/repos/<owner>/<repo>/issues?state=all&per_page=100&page=1' })`
   - Request proxied through OpenChamber backend (`POST /api/guests/github-task-board/request`).
   - UI remained functional and error banner was displayed without unhandled crash.

---

## 2. Human Operator Approval Checklist (Step-by-Step)

The human user must execute the following actions directly in the OpenChamber user interface:

### Step 1: Open Settings in OpenChamber
- In the running OpenChamber browser/desktop application (`http://127.0.0.1:3000`), click the gear icon or navigate to **Settings**.

### Step 2: Open Extensions Configuration
- In the Settings navigation menu, select **Extensions**.
- Locate the **Task Board** (`github-task-board`) extension card.

### Step 3: Approve Requested Origins Capability
- You will see a notification indicating newly requested capabilities:
  - Requested Capability: `origins` (`https://api.github.com`).
- Click the **Approve** button for Task Board.
- *Note:* No server restart is required. OpenChamber's extension catalog cache has a 5-second TTL (`CATALOG_CACHE_TTL_MS = 5000`); the grant takes effect within 5 seconds.

---

## 3. Post-Approval 304 Verification Procedure (Non-Forced Trigger)

Once the capability is approved, perform the following sequence to capture the `304 Not Modified` network response:

### Step 4: Open Developer Tools Network Tab
- Open browser Developer Tools (`F12` / `Ctrl+Shift+I` / `Cmd+Option+I`).
- Switch to the **Network** tab.
- Set filter to `api.github.com`.

### Step 5: Reload / Open Task Board Panel
- Open or reload the Task Board panel.
- Observe the initial request:
  - `GET https://api.github.com/repos/<owner>/<repo>/issues?state=all&per_page=100&page=1`
  - Status: `200 OK`
  - Response headers include: `ETag: W/"..."` (or `"..."`)
  - Log drawer displays: `[TaskBoard] API GET ... -> 200 OK (via workspace PAT)`

### Step 6: Trigger the Non-Forced Fetch (Option 1 or Option 2)

> **CRITICAL WARNING:** **NEVER CLICK THE MANUAL "REFRESH" BUTTON!**  
> Clicking the manual Refresh button invokes `refreshTasks()`, which explicitly clears `pageBodyCache` and `issueListEtagCache` and forces `force=true`. This suppresses sending `If-None-Match` and guarantees a full `200 OK` payload, defeating the 304 cache capture.

Use one of the two verified non-forced triggers:

#### Option 1: Repository Re-selection via Popover
1. Wait at least 60 seconds for the in-memory cache TTL (`ISSUE_CACHE_TTL_MS = 60000`) to elapse, OR switch to a different repository and switch back.
2. In the repository popover picker, click the target repository.
3. Observe the newly issued request:
   - Request: `GET https://api.github.com/repos/<owner>/<repo>/issues?state=all&per_page=100&page=1`
   - Request Header: `If-None-Match: <etag from Step 5>`
   - Response Status: **`304 Not Modified`**
   - Response Size: 0 bytes (empty body)
   - Log drawer confirms:
     `[TaskBoard] API GET /repos/<owner>/<repo>/issues?... -> 304 Not Modified (via workspace PAT)`
     `[TaskBoard] Page 1 for <owner>/<repo> -> 304 Not Modified`

#### Option 2: Session Activity Idle State Transition
1. In an active conversation session linked to the repository, run any agent command and allow it to complete and enter `idle` state.
2. The panel's `handleIdleRefresh()` detects the `s.activity === 'idle'` transition and runs `syncRepoIncremental()`.
3. Observe the incremental request:
   - Request: `GET https://api.github.com/repos/<owner>/<repo>/issues?state=all&since=...&per_page=100&page=1`
   - Request Header: `If-None-Match: <etag>`
   - Response Status: **`304 Not Modified`**

---

## 4. Execution Status

**HALTED AT BRANCH B.**  
Agent execution stops here. The origins approval click belongs solely to the human operator.
