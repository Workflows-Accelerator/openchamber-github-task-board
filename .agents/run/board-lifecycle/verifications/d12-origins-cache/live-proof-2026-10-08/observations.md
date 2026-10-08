# D12 Live Served Panel Observations (Pre-Approval State)

**Date:** 2026-10-08  
**Target:** Live Served Panel (`github-task-board` extension under OpenChamber on loopback `127.0.0.1:3000`)  
**Auditor:** Dynamic Subagent (Engineer Tier)  
**Execution Branch:** Branch B (Approval Pending — Halted for User Approval)

---

## 1. Effective Delivered Content Security Policy (CSP)

Delivered HTTP response headers for the real served guest panel document (`/api/guests/github-task-board/panel/index.html`):

- **HTTP Status:** `200 OK`
- **Content-Type:** `text/html; charset=utf-8`
- **Content-Security-Policy:**
  ```text
  sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' 'self' data: blob:; style-src 'unsafe-inline' 'self' data: blob:; img-src 'self' data: blob:; font-src 'self' data: blob:; media-src 'self' data: blob:; worker-src 'self' data: blob:; frame-src 'self' data: blob:; connect-src 127.0.0.1:3000/api/guests/github-task-board/; object-src 'none'; form-action 'none'
  ```
- **Analysis of `connect-src`:**
  - Allowed destination: `127.0.0.1:3000/api/guests/github-task-board/`
  - External origin `https://api.github.com`: **ABSENT**
  - Result: Any direct `fetch()` call originating inside the sandboxed panel iframe toward `https://api.github.com` is strictly blocked by the browser.

---

## 2. Capability State Determination (Host Registry)

Query to OpenChamber extension registry endpoint (`GET /api/guests`):

- **Requested Capabilities:** `["network", "filesystem", "origins"]`
- **Granted Capabilities:** `["prompt", "sessions", "files", "filesystem", "network"]`
- **`origins` Capability Granted:** `false` (pending human approval in Settings -> Extensions -> Task Board)

---

## 3. Fallback Integrity Empirical Observation

The real compiled panel bundle (`panel/main.js`) was loaded in an iframe connected to the OpenChamber host bridge via the standard `@openchamber/sdk` postMessage channel.

### Observed Execution Sequence

1. **Host Handshake & Discovery:**
   - Panel issued `hello` message.
   - Host answered `ready` with active directory `/workspace/extensions/github-task-board`.
   - Panel queried workspace projects (`workspace-read: projects`).
   - Panel inspected `.git/config` via host file read (`file-read: /workspace/extensions/github-task-board/.git/config`).
   - Panel identified active Git repository: `Workflows-Accelerator/openchamber-github-task-board`.
   - Panel set active repository and initiated initial issue fetch.

2. **Workspace Credential Resolution & Direct Fetch Attempt:**
   - Panel read workspace credentials via host file read (`file-read: /workspace/.git-credentials`).
   - Panel extracted authenticated token from credentials.
   - Panel verified `url.origin === 'https://api.github.com'` (origin guard passed).
   - Panel attempted direct fetch:
     - Method: `GET`
     - Destination (redacted): `https://api.github.com/repos/<owner>/<repo>/issues?state=all&per_page=100&page=1`
   - Outcome: Request blocked by pre-approval security boundary (CORS / CSP preflight violation).

3. **Fallback Routing to `host.request`:**
   - Panel caught the direct fetch failure.
   - Panel logged warning:
     ```text
     [TaskBoard] Direct PAT fetch failed (CORS preflight returned HTTP 403 Forbidden), falling back to host proxy...
     ```
   - Panel cleanly invoked the fallback path via SDK postMessage:
     - Message Type: `request`
     - Method: `GET`
     - Redacted Path: `/repos/<owner>/<repo>/issues?state=all&per_page=100&page=1`
   - Host bridge forwarded request to OpenChamber backend proxy (`POST /api/guests/github-task-board/request`).
   - Host proxy returned status `401` / `409` (`DISCONNECTED` / `Request failed` as host-level GitHub OAuth is unlinked).
   - Panel handled the proxy response cleanly, displayed notification banner, and retained UI state without unhandled exceptions or panel crash.

---

## 4. Freshness and UI State Visibility

- **Pre-fetch State:** Panel rendered column headers and repository label (`Workflows-Accelerator/openchamber-github-task-board`).
- **Post-fetch State:** Panel retained rendered shell, displayed connection status banner, and logged the complete sequence in the log drawer.
- **Visual Evidence:** Screenshot recorded at `panel-pre-approval.png`.

---

## 5. Decision & Branch Halt

- In accordance with the D12 verification brief, the origins capability approval belongs exclusively to the human operator and must never be automated.
- Because `origins` is unapproved and CSP restricts direct origins access, Branch B is executed:
  - Pre-approval CSP and fallback behavior empirically recorded above.
  - Step-by-step user approval checklist generated in `pre-approval-checklist.md`.
  - Execution halted pending human approval.
