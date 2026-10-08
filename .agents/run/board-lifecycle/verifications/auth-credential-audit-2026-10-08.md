# OpenChamber GitHub Authentication & Credential Transport Audit

**Target:** `github-task-board` + `OpenChamber` host credential transport  
**Date:** October 8, 2026  
**Auditor:** Dynamic Subagent (Auth Credential Transport Audit)  
**Status:** COMPLETE — Full request path traced, credential categories inventoried, drop points identified, and ranked options formulated.  
**Compliance Note:** SECRET WALL strictly enforced. Zero token values, prefixes, or secret contents read, printed, or exposed.

---

## 1. Executive Summary

This audit examined whether OpenChamber's existing GitHub authentication can support GitHub conditional requests (`ETag` / `304 Not Modified` caching) for the `github-task-board` extension, classified all existing host credential types, and evaluated safe reuse paths.

### Primary Verdicts
1. **Host Proxy Drops Conditional Headers Completely:** OpenChamber's guest proxy architecture (`@openchamber/sdk` -> host `PluginPane` -> server `proxyGuestRequest`) strictly strips all custom request headers (including `If-None-Match`), hardcodes outgoing request headers, and discards all incoming HTTP response headers (including `ETag`, `X-RateLimit-Remaining`, and `Retry-After`). The guest SDK contract and host Express route schemas do not support headers.
2. **Direct Browser Fetch Blocked by CSP:** The task board's fallback attempt to directly `fetch('https://api.github.com/...')` using local workspace PATs fails inside the browser panel because `github-task-board/package.json` does not declare `capabilities: ["origins"]` nor `contributes.origins: ["https://api.github.com"]`. As a result, the sandboxed iframe's Content Security Policy (`connect-src`) denies direct network requests to GitHub.
3. **OpenChamber Host Login Exists but is Not Shared with GitHub Guests:** OpenChamber holds an active GitHub OAuth token (minted via OAuth Device Flow under account `workflows-accelerator-agent`), and the host environment contains a Classic PAT (`GITHUB_TOKEN` and Git credential store). However, OpenChamber's host-sharing mechanism (`resolveHostAccessToken`) only shares credentials with the `linear` provider. GitHub integrations are relegated to guest-specific auth, which is currently unconfigured.
4. **Viable Paths Available:** Enabling `304` conditional requests requires either:
   - **Option 1 (Extension-level, recommended):** Declare `contributes.origins: ["https://api.github.com"]` + `"origins"` capability in `package.json`, allowing the board's existing Direct PAT logic to communicate directly with GitHub, where `If-None-Match` and `304` already work natively.
   - **Option 2 (Host-level):** Patch OpenChamber's host proxy and SDK to forward request headers and return response headers, and extend host auth sharing to GitHub.
   - **Option 4 (Zero-change immediate fallback):** Rely on incremental sync with GitHub's `since=` timestamp parameter without ETag/304 caching, which returns empty issue arrays (`[]`) and uses only ~300 requests/hr out of the 5,000/hr quota.

---

## 2. Detailed Answers to Audit Questions

### Answer 1: Board Authentication Today & Exact Header Drop Points

#### Request Flow Today
The Task Board invokes GitHub API requests through `githubRequest()` in `panel/main.ts:1085-1210`. The execution follows a dual-path architecture:

1. **Path A (Direct PAT Fetch — `panel/main.ts:1094-1152`):**
   - The board calls `getWorkspaceGitToken()` (`panel/main.ts:1016-1036`) to extract a token from `/workspace/.git-credentials` or `/workspace/.gitconfig` via `extractGitHubTokenFromCredentials()` (`panel/git.ts:35-41`), or retrieves `custom_github_token` from `host.storage`.
   - If a token is found, it calls `window.fetch('https://api.github.com/' + path, { headers: { Authorization, ...headers } })`.
   - **Failure mechanism:** In the OpenChamber browser/desktop UI, the extension runs in an iframe sandboxed with `sandbox="allow-scripts"` (`PluginPane-2C71F8uF.js:62359`). OpenChamber enforces `guestFramePolicy` (`@openchamber/sdk/dist/frame-policy.js:24-37`, `server/lib/guests/routes.js:874`, `PluginPane-2C71F8uF.js:34571`), which restricts `connect-src` to the guest's own host path (`/api/guests/github-task-board/`) unless external origins are declared and approved. Because `package.json:25-30` does not declare `contributes.origins: ["https://api.github.com"]`, direct `fetch` triggers a browser CSP network error (`panel/main.ts:1146-1151`), falling back to Path B.

2. **Path B (Host Proxy Fallback — `panel/main.ts:1154-1195`):**
   - The board falls back to `host.request({ method, path, query, body })`.

#### Six Exact Anchors Where Authorization & Custom Headers Are Dropped
Across Path B, custom request headers (including `If-None-Match`) and response headers (including `ETag` and rate limit metrics) are dropped at six distinct layers:

1. **Board Call Site (`panel/main.ts:1156-1161`):**
   - `githubRequest` receives `headers?: Record<string, string>` (set by `core.ts:2421` and `main.ts:1619`), but the call to `host.request` completely omits `headers`:
     ```ts
     const res = await host.request({
       method,
       path,
       query,
       body: body ? JSON.stringify(body) : undefined,
     });
     ```
2. **SDK Type & Contract Boundary (`@openchamber/sdk/dist/contract.d.ts:65-74`):**
   - The SDK specification defines:
     ```ts
     export type GuestRequest = {
       method: GuestRequestMethod;
       path: string;
       query?: Record<string, string>;
       body?: string;
     };
     export type GuestRequestResult = {
       status: number;
       body: string;
     };
     ```
   - Neither `GuestRequest` nor `GuestRequestResult` contains a `headers` property.
3. **Host Frontend Bridge (`PluginPane-2C71F8uF.js:4258, 60077`):**
   - When the host receives `postMessage({ type: 'request' })`, it posts `{ method, path, query, body }` to `POST /api/guests/:id/request`.
   - The response is validated by Zod schema `ro = z.object({ status: z.number().int().min(100).max(599), body: z.string() })`. Any HTTP response headers from the server are discarded before returning to the iframe.
4. **Host Route Validation (`server/lib/guests/routes.js:86-91, 539-550`):**
   - The Express route validates the request body using:
     ```js
     const requestBodySchema = z.object({
       method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
       path: z.string().trim().min(1).refine(isGuestRequestPath),
       query: z.record(z.string().min(1).max(128), z.string().max(2000)).optional(),
       body: z.string().max(64_000).optional(),
     });
     ```
   - Any client-submitted headers are stripped during schema parsing.
5. **Host Outgoing Request Construction (`server/lib/guests/request.js:46-61`):**
   - `sendAuthorized()` constructs a hardcoded headers dictionary:
     ```js
     const headers = {
       Accept: 'application/json',
       Authorization: guestAuthorizationHeader(accessToken, authorization),
     };
     if (body !== undefined && method !== 'GET') {
       headers['Content-Type'] = 'application/json';
     }
     ```
   - No custom headers (e.g. `If-None-Match`) can pass through to `api.github.com`.
6. **Host Incoming Response Truncation (`server/lib/guests/request.js:108-111`):**
   - `proxyGuestRequest()` resolves the HTTP response as:
     ```js
     return {
       status: response.status,
       body: await readCappedBody(response),
     };
     ```
   - The incoming `ETag`, `X-RateLimit-Remaining`, and `Retry-After` headers are discarded.

---

### Answer 2: Can ETag / If-None-Match Reach api.github.com Today?

* **Via Host Proxy (`host.request`): NO.**
  - As detailed above, the SDK, host schema, request builder, and response mapper drop both outgoing conditional request headers and incoming `ETag` headers.
* **Via OpenChamber Host Internals: YES (OAuth App Token / CLI Token).**
  - OpenChamber's internal GitHub Octokit (`server/lib/github/octokit.js:20-69`) implements `createConditionalFetch(token)` with an internal 300-entry in-memory `etagCache`. It sends `if-none-match` on every GET request and handles `304 Not Modified` transparently without consuming rate limit quota. However, this is used solely for internal PR status tracking (`server/lib/github/pr-status.js`), not exposed to guest extensions.
* **Via Task Board Direct Fetch: BLOCKED BY CSP (Classic PAT).**
  - The Task Board's source code in `panel/main.ts:1104-1116` already attaches `headers: { ...(headers || {}) }` (including `If-None-Match`) and handles HTTP 304 (`main.ts:1114-1117`).
  - Under Classic PAT credentials, this would succeed against `api.github.com`, but the browser's CSP currently prevents the network connection.

---

### Answer 3: Existing GitHub Credential Categories on This Host

All credentials verified strictly via key names, file existence, and tool metadata without reading or exposing any secret value:

| # | Credential Category | Source / Anchor | Presence & Scope Proof |
|---|---|---|---|
| **1** | **Classic PAT** | Process environment: `process.env.GITHUB_TOKEN` | Present in process environment (string length 40). Verified via `gh auth status`: user `workflows-accelerator-agent`, active account, full repo/admin scopes (`admin:org`, `repo`, `workflow`, `project`, etc.). |
| **2** | **Git Credential Store** | Local filesystem: `/workspace/.git-credentials` | File exists on filesystem. Referenced in `/workspace/.gitconfig` under `[credential] helper = store --file /workspace/.git-credentials`. |
| **3** | **Git URL Rewrite Token** (Classic PAT) | Local filesystem: `/workspace/.gitconfig` | File exists. INI section `[url "https://x-access-token:...@github.com/"]` configures `insteadof = https://github.com/`. |
| **4** | **OAuth App Device Flow Token** | OpenChamber Data: `/workspace/.openchamber-data/github-auth.json` | JSON file exists. Contains 1 account entry with keys `accessToken`, `scope` (`read:org,read:user,repo,user:email`), `tokenType`, `createdAt`, `user`, `current: true`, `accountId: 'workflows-accelerator-agent'`. Minted via Client ID `Ov23lizomPOC3eFYo56r` (`server/lib/github/device-flow.js`). |
| **5** | **Guest Integration Auth Store** | OpenChamber Data: `/workspace/.openchamber-data/guest-auth.json` | File exists. Keys: `guests: {}` (empty; no tokens configured for `github-task-board`). |

---

### Answer 4: Reusing OpenChamber Host GitHub Login for the Board

#### Feasibility
Reusing OpenChamber's host GitHub login (`github-auth.json`) is technically feasible, but **requires modifying OpenChamber host server code**:
- Currently, OpenChamber only permits host token delegation for Linear (`server/lib/guests/host-session.js:6-9, 63-73` checks `integration?.host?.provider === 'linear'`).
- If `host-session.js` were updated to support `provider === 'github'` and return `getGitHubAuth()?.accessToken`, the Task Board could declare `"host": { "provider": "github" }` in its integration manifest and immediately inherit the user's active session without entering credentials.

#### Security Trade-Offs
* **Benefits:**
  - **Zero Setup Friction:** Board immediately authenticates as `workflows-accelerator-agent` across all sessions and worktrees.
  - **No Secrets in Guest Storage:** Access tokens stay within host server memory and host-managed storage (`0o600`).
  - **Shared Quota:** Leverages the 5,000 req/hr authenticated quota.
* **Risks:**
  - **Privilege Overlap:** The host OAuth token carries `repo,read:org,read:user,user:email` permissions. An issue-tracking guest would have write access to any repo accessible to the user.
  - **GitHub Org Restrictions:** OAuth applications (`Ov23lizomPOC3eFYo56r`) are subject to organization third-party application policies. If an enterprise GitHub organization blocks third-party OAuth apps, requests return HTTP 403 (which was the historical motivation for introducing workspace PAT support in commit `ca26befa`).

---

### Answer 5: Ranked Options & Trade-Offs

| Option | Setup Cost | Quota Effect | Security Trade-off | Recommendation |
|---|---|---|---|---|
| **Option 1: Declare Origins in Board Manifest + Direct Workspace PAT** | **Low:** Add `"origins"` capability & `contributes.origins: ["https://api.github.com"]` in `package.json`. No host modifications. | **Optimal:** Full 5,000 req/hr PAT quota; conditional `304` requests consume 0 quota points. | PAT token accessed via existing `host.readFile` grant (`/workspace/**`). Origin grant opens network access to GitHub from iframe. | **RECOMMENDED (Fastest & Self-Contained):** Solves CSP block cleanly within extension boundary. Native `fetch()` handles ETag/304 without proxy truncation. |
| **Option 2: Host Proxy Header Forwarding & GitHub Host Auth Delegation** | **High:** Requires patch to `@openchamber/sdk`, OpenChamber web server (`request.js`, `routes.js`), and frontend bridge (`PluginPane`). | **Optimal:** Full 5,000 req/hr OAuth quota; conditional `304` requests consume 0 quota points. | Cleanest architectural boundaries. Token never enters iframe context. Iframe remains network-isolated. | **RECOMMENDED (Long-Term Clean Architecture):** Best overall design for OpenChamber platform, but dependent on host release cycle. |
| **Option 3: User PAT in Board Settings (`host.storage`) via Current Proxy** | **Low:** No code changes; user enters PAT in UI Settings dialog (`custom_github_token`). | **Degraded:** 5,000 req/hr PAT quota, but cannot use `304` caching because host proxy drops headers. | Token stored in guest storage file (`github-task-board.json`). | **Not Recommended:** Requires user setup and does not enable conditional request caching. |
| **Option 4: Accept Plain GETs with Incremental `since=` Timestamp Filtering** | **Zero:** Already implemented in `panel/main.ts:1607-1700`. No auth or infrastructure changes. | **Moderate:** Each idle sync costs 1 API call per repo (e.g. 5 repos = 5 calls). Unchanged repos return `[]` (HTTP 200, small payload). ~300 req/hr under heavy idle loops. | Maintains current operational posture without new network or host permissions. | **Viable Operational Baseline:** Works today within rate limits while deciding between Option 1 and Option 2. |

---

## 3. Evidence Anchors

### GitHub Task Board
- `panel/main.ts:1016-1036`: `getWorkspaceGitToken()` token resolution from `.git-credentials` and `.gitconfig`.
- `panel/main.ts:1094-1152`: Direct PAT fetch logic with ETag / 304 handling and catch fallback.
- `panel/main.ts:1156-1165`: `host.request` proxy fallback omitting `headers`.
- `panel/main.ts:1169-1178`: Attempted extraction of `(res as any).headers['etag']` (always undefined).
- `panel/core.ts:2410-2425`: Pagination helper setting `If-None-Match: etag` on page 1.
- `panel/git.ts:35-41`: Regex `extractGitHubTokenFromCredentials()` for `gh[pousr]_` tokens.
- `package.json:25-30, 43-61`: Missing `"origins"` capability and `contributes.origins` configuration.

### OpenChamber SDK
- `@openchamber/sdk/dist/contract.d.ts:65-74`: `GuestRequest` and `GuestRequestResult` types lacking `headers`.
- `@openchamber/sdk/dist/frame-policy.js:24-37`: `guestFramePolicy()` generating restrictive `connect-src`.

### OpenChamber Host Server & UI
- `server/lib/guests/routes.js:86-91`: `requestBodySchema` stripping `headers`.
- `server/lib/guests/routes.js:539-550`: `POST /api/guests/:id/request` route omitting headers.
- `server/lib/guests/routes.js:874`: `Content-Security-Policy` header injection on guest entry.
- `server/lib/guests/request.js:46-61`: `sendAuthorized()` hardcoding outbound headers.
- `server/lib/guests/request.js:75-77`: `proxyGuestRequest()` token resolution logic.
- `server/lib/guests/request.js:108-111`: Return statement discarding response headers.
- `server/lib/guests/host-session.js:6-9, 63-73`: Hardcoded check restricting host auth delegation to Linear.
- `server/lib/github/octokit.js:20-69`: Internal 300-entry `etagCache` with conditional fetch for host routes.
- `server/lib/github/auth.js:5-15, 215-258`: Host GitHub auth store at `github-auth.json`.
- `PluginPane-2C71F8uF.js:4258, 60077`: Frontend host message forwarder and `ro` schema validation.
- `PluginPane-2C71F8uF.js:34571, 62359`: Sandboxed iframe creation and `<meta>` CSP injection.

---

## 4. Explicit NOT VERIFIED

1. **Electron Shell Network Differences:** We did not verify whether the OpenChamber desktop app running on Electron bypasses `connect-src` CSP restrictions for guest iframes compared to the browser web runtime, as only the Linux headless web environment was directly inspected.
2. **Secret Token Strings:** We did not open or read the secret string contents or prefixes of `/workspace/.git-credentials`, `/workspace/.gitconfig`, or `/workspace/.openchamber-data/github-auth.json`, in strict compliance with the audit SECRET WALL.
3. **Live Remote Mutation:** We did not execute live GitHub API write requests (issue mutations, label updates) or trigger remote OAuth flows.
4. **Third-Party Org OAuth Authorization:** We did not test whether the user's specific target GitHub organizations enforce third-party OAuth application restrictions against Client ID `Ov23lizomPOC3eFYo56r`.

---

## 5. Blockers & Human Decision Point

**Blockers:** None. The investigation is complete and all findings are confirmed through static source tracing and read-only host verification.

**Decision for Human:**
Choose between:
1. **Option 1 (Extension-level fix):** Add `origins` to `package.json` to unleash direct PAT conditional requests with zero rate-limit impact on 304s.
2. **Option 2 (Host-level fix):** Upgrade OpenChamber host proxy to forward headers and delegate host GitHub credentials.
3. **Option 4 (Immediate baseline):** Retain current proxy transport and rely on incremental `since=` timestamp queries without 304 caching.
