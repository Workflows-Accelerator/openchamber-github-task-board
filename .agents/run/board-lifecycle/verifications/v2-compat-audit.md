# OpenChamber / OpenCode V2 Migration Compatibility Audit

**Target Integration:** `github-task-board` + `chambervoice`  
**Host Environment:** OpenChamber v2.0.4, OpenCode v2.0.21, Node.js v22.23.3, Linux x86_64  
**Date:** October 2026  
**Auditor:** Dynamic Subagent (V2 Compatibility Audit)  
**Status:** COMPLETE — Severe silent breakages identified with exact anchors and remediation proposals.

---

## Executive Summary

The OpenChamber and OpenCode V2 migration has kept core UI panel delivery and guest SDK activity states intact:
- The `github-task-board` panel is correctly served directly from `/workspace/extensions/github-task-board/panel/` on `master`.
- The eight-stage Kanban status model and `needs-human` activity mapping (`idle`, `running`, `waiting-permission`, `waiting-question`) are preserved by OpenChamber's guest session projection.
- Both test suites pass 100% in isolation (`github-task-board`: 202/202 pass; `chambervoice`: 427/427 pass).

However, **critical live runtime breakages exist under the surface**, masked by test suite mocks:
1. **ChamberVoice `listSessions()` returns empty:** The OpenCode V2 `/api/session` endpoint now returns a paginated object `{ data: [...], cursor }` instead of a JSON array, causing ChamberVoice's host client to return `[]` and rendering voice session monitoring blind when running without the desktop panel.
2. **Interactive voice question and permission replies 404:** OpenCode V2 replaced the `/api/question` tool with Effect-based forms (`/api/session/:id/form/:id/reply`), and scoped permissions to `/api/session/:id/permission/:id/reply` with body `{ decision }`. ChamberVoice's legacy routes (`/api/question/:id/reply` and `/api/permission/:id/reply`) fail with HTTP 404.
3. **Session items strip `url` in V2 guest SDK:** OpenChamber V2 host sanitizes guest session items to `{ id, data }`, stripping top-level `url`. Because `github-task-board` attaches `{ url, data: { issueNumber } }`, `getSessionIssueRepo()` returns `null`, breaking multi-repo session binding in **All Projects** mode (`buildSessionIndexByRepo`).
4. **Worktree lifecycle tooling points to non-existent `/home/opencode`:** The `worktree-lifecycle` skill hardcodes `/home/opencode/.local/share/opencode/opencode.db`, whereas on this host `HOME=/workspace` and the database lives at `/workspace/.local/share/opencode/opencode.db`.

---

## 1. Ground Truth on this Machine

| Component / Artifact | Expected / Configured Path | Actual Verified Path | Match Status | Notes |
|---|---|---|---|---|
| OpenChamber Data Dir | `$OPENCHAMBER_DATA_DIR` | `/workspace/.openchamber-data` | **MATCH** | Exported in env; resolved by `chambervoice/service/config.ts:139` |
| Extension Registry | `{dataDir}/extensions.json` | `/workspace/.openchamber-data/extensions.json` | **MATCH** | Registers `/workspace/extensions/chambervoice` and `/workspace/extensions/github-task-board` |
| Task Board Guest Storage | `{dataDir}/guest-storage/github-task-board.json` | `/workspace/.openchamber-data/guest-storage/github-task-board.json` | **MATCH** | 131 KB; contains `selected_repo`, 8 `repo_*` keys, 8 `scratchpad_*` keys |
| OpenCode Config | `$OPENCODE_CONFIG` | `/workspace/.openchamber-data/opencode.managed.json` | **MATCH** | Managed by OpenChamber runtime |
| OpenCode Database | `~/.local/share/opencode/opencode.db` | `/workspace/.local/share/opencode/opencode.db` | **MATCH** | SQLite database with 25 tables (`session`, `session_v2`, `worktree`, etc.) |
| Worktree Skill DB Path | `/home/opencode/.../opencode.db` | `/home/opencode` does NOT exist | **MISMATCH** | Hardcoded in `management/SKILL.md:95, 159` |

---

## 2. Test Suite Execution Baselines

Both test suites were executed in full on the machine:

### A. github-task-board
- **Command:** `node --test test/*.test.js`
- **Working Directory:** `/workspace/extensions/github-task-board`
- **Result:** **202 / 202 passed (0 failed, 0 skipped, duration 1.72s)**
- **Coverage:** 8-stage reconciler, scratchpad debounce/flush, dependency graph, hostile XSS/ragged tables, all-projects multi-repo clustering, secondary rate-limiting, and worktree token parsing.

### B. chambervoice
- **Command:** `npm run verify`
- **Working Directory:** `/workspace/extensions/chambervoice`
- **Result:** **427 / 427 passed (0 failed, 0 skipped, duration 18.09s)**
- **Coverage:** Audio pipeline, standby transitions, taskboard CRUD & sentinel URL defense, prompt synthesis, tool executor, session reader, and roster ranking.

*Note on mock divergence:* Both test suites pass completely because all integration tests mock the host HTTP and SDK boundary. The test suites do not assert against the live OpenCode v2.0.21 HTTP API responses.

---

## 3. Detailed Severity Findings

### Section A: CONFIRMED BROKEN

#### 1. ChamberVoice `HostClient.listSessions` & `listGlobalSessions` broken by `/api/session` envelope change
- **Severity:** HIGH
- **Anchors:**
  - `extensions/chambervoice/service/host-client.ts:405-412`
  - `extensions/chambervoice/service/host-client.ts:428-430`
  - `extensions/chambervoice/service/host-client.ts:633-640`
  - `extensions/chambervoice/service/server.ts:684-704`
- **Root Cause:**
  In OpenChamber / OpenCode V2, `GET /api/session` returns `{ data: Session[], cursor: string }`, rather than a top-level JSON array `Session[]`.
  Additionally, each session's directory is nested inside `session.location.directory`, rather than top-level `session.directory`.
  `host-client.ts:411` strictly checks:
  ```ts
  if (!Array.isArray(raw)) return [];
  ```
  Consequently, `listSessions()` always returns `[]`.
- **Blast Radius:**
  - `ToolExecutor.loadRoster()` (`tool-executor.ts:68`) always evaluates to an empty roster when querying directory sessions.
  - Background polling in `server.ts:663-719` (`pollSessionActivity`) evaluates `sessions` and `globalSessions` to empty, blinding ChamberVoice to any active/completed/blocked sessions when running hands-free or on mobile without the desktop panel attached.
  - `resolveSessionModel()` (`host-client.ts:619`) fails to inspect recent sessions and cannot inherit previous session models.
- **Fix Proposal:**
  Update `host-client.ts` to unwrap the V2 pagination envelope and support both `directory` and `location.directory`:
  ```ts
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
  return list.map((entry) => ({
    id: String(entry?.id ?? ''),
    title: typeof entry?.title === 'string' && entry.title.trim() ? entry.title : String(entry?.id ?? 'untitled'),
    directory: typeof entry?.directory === 'string' ? entry.directory : (entry?.location?.directory ?? null),
    projectId: typeof entry?.projectID === 'string' ? entry.projectID : null,
    parentId: typeof entry?.parentID === 'string' ? entry.parentID : null,
    createdAt: typeof entry?.time?.created === 'number' ? entry.time.created : null,
    updatedAt: typeof entry?.time?.updated === 'number' ? entry.time.updated : null,
    agent: typeof entry?.agent === 'string' ? entry.agent : null,
  }));
  ```

---

#### 2. ChamberVoice Form / Question Inspection and Reply Broken (V2 Form entity replacement)
- **Severity:** HIGH
- **Anchors:**
  - `extensions/chambervoice/service/host-client.ts:727-740`
  - `extensions/chambervoice/service/host-client.ts:754-764`
  - `extensions/chambervoice/service/host-client.ts:805-819`
  - OpenChamber `/usr/local/lib/node_modules/@openchamber/web/server/lib/opencode/session-runtime.js:85-95, 111-120`
  - OpenCode protocol `/usr/local/lib/node_modules/@openchamber/web/node_modules/@opencode/protocol/dist/groups/session.js:603`
- **Root Cause:**
  1. OpenCode V2 replaced question tools with Effect `Form` entities.
  2. OpenChamber's `GET /api/sessions/status` snapshot (`session-runtime.js:114`) exposes pending blocking requests as `{ permissions: [...], forms: [...] }`. `host-client.ts:731` expects `entry?.questions`, which is `undefined`.
  3. `GET /api/question` was removed in V2 and returns HTTP 404 (replaced by `GET /api/form` or `entry.forms` in status snapshot).
  4. `POST /api/question/:requestId/reply` was removed in V2 and returns HTTP 404. OpenCode V2 registers `POST /api/session/:sessionID/form/:formID/reply`.
  5. The V2 payload for form replies is `{ answer: Record<string, Value> }`, not `{ answers: string[][] }`.
- **Blast Radius:**
  Any voice attempt to inspect pending questions (`get_pending_question`) or answer questions (`answer_session_question`) fails with HTTP 404 or reports "no pending question".
- **Fix Proposal:**
  1. In `getPendingQuestionFromStatus`: check `entry?.forms ?? entry?.questions`. Normalize `Form.Detail` / `Form.Info` fields into `QuestionInfo`.
  2. In `replyQuestion`: call `POST /api/session/${sessionId}/form/${requestId}/reply` with body `{ answer: { [fieldId]: selectedValue } }`.

---

#### 3. ChamberVoice Permission Reply & Fallback List Broken
- **Severity:** HIGH
- **Anchors:**
  - `extensions/chambervoice/service/host-client.ts:854-868`
  - `extensions/chambervoice/service/host-client.ts:890-900`
  - OpenCode protocol `/usr/local/lib/node_modules/@openchamber/web/node_modules/@opencode/protocol/dist/groups/permission.js`
- **Root Cause:**
  1. `GET /api/permission` returns HTTP 404. The real V2 location route is `GET /api/permission/request`.
  2. `POST /api/permission/:requestId/reply` returns HTTP 404. The real V2 session route is `POST /api/session/:sessionID/permission/:requestID/reply`.
  3. V2 payload contract expects `{ decision: "once" | "always" | "reject", message?: string }`. `host-client.ts:897` sends `{ reply }`.
- **Blast Radius:**
  Hands-free voice tools `approve_permission` and `deny_permission` fail with HTTP 404 when attempting direct resolution against the host API.
- **Fix Proposal:**
  1. Fallback listing: query `GET /api/permission/request`.
  2. Permission reply: post to `POST /api/session/${sessionId}/permission/${requestId}/reply` with payload `{ decision: reply }`.

---

#### 4. Worktree Lifecycle Skill Tooling Assumes Invalid DB Path
- **Severity:** MEDIUM
- **Anchors:**
  - `/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md:95, 159`
- **Root Cause:**
  The skill instructions state:
  ```python
  db_path = '/home/opencode/.local/share/opencode/opencode.db'
  ```
  On this host, `/home/opencode` does not exist (`/home` contains only `node`). `HOME` is `/workspace`, and the actual database is at `/workspace/.local/share/opencode/opencode.db`.
- **Blast Radius:**
  Any automated worktree script relying literally on `/home/opencode/...` crashes with `FileNotFoundError` during worktree DB registration/deregistration.
- **Fix Proposal:**
  Update skill to resolve dynamically:
  ```python
  candidates = [
      os.environ.get("OPENCODE_DB_PATH"),
      os.path.expanduser("~/.local/share/opencode/opencode.db"),
      "/workspace/.local/share/opencode/opencode.db",
      "/home/opencode/.local/share/opencode/opencode.db"
  ]
  db_path = next((p for p in candidates if p and os.path.exists(p)), None)
  ```

---

### Section B: AT RISK

#### 1. Multi-Repo Session Linking in Task Board (`buildSessionIndexByRepo`) Stripped by V2 Guest SDK
- **Severity:** MEDIUM-HIGH
- **Anchors:**
  - `extensions/github-task-board/panel/core.ts:925-941` (`buildIssueAttachPayload`)
  - `extensions/github-task-board/panel/core.ts:1810-1845` (`getSessionIssueRepo`, `sessionRepoKeys`)
  - `extensions/github-task-board/panel/main.ts:742-749` (auto-detect repo from session items)
  - OpenChamber web bundle `/usr/local/lib/node_modules/@openchamber/web/dist/assets/PluginPane-2C71F8uF.js:39700-40100` (`ei` session mapper)
  - `@openchamber/sdk/workspace.d.ts:29` (`GuestSessionRecord.items`)
- **Root Cause:**
  In OpenChamber V2, the host sanitizes session items before delivering them to guest iframes:
  ```js
  items: gr(e).flatMap(b => {
    if (b.kind !== "guest" || b.providerId !== s) return [];
    const y = { id: b.identifier };
    return b.data !== void 0 && (y.data = b.data), [y];
  })
  ```
  Top-level properties such as `url` are dropped by the host; only `id` and `data` are preserved.
  When `github-task-board` calls `buildIssueAttachPayload(issue)`, it places `url: issue.html_url` at top-level, and `data: { issueNumber: issue.number }`. It does NOT include `repo` in `data`.
  Consequently, in the guest iframe:
  - `item.url` is `undefined`.
  - `item.repo` is `undefined`.
  - `item.data?.repo` is `undefined`.
  `getSessionIssueRepo(item)` returns `null`, causing `sessionRepoKeys(session)` to return `[]`.
- **Blast Radius:**
  - **Single-Repo View:** Unaffected! `buildSessionIndex` matches purely on numeric `item.id` and `item.data.issueNumber`.
  - **All Projects View:** Broken! `buildSessionIndexByRepo` requires `repo#number` keys. Sessions for issues from other repos will not bind to cards in the All Projects view.
  - **Auto Repo Detection:** `main.ts:742-749` checks `if (it.url && it.url.includes('github.com/'))` to detect the repo from session items. This check always fails in V2.
- **Fix Proposal:**
  Update `buildIssueAttachPayload` in `panel/core.ts:937` to place `repo` inside `data`:
  ```ts
  const repoSlug = issue.repository_url ? parseRepoFullName(issue.repository_url) : (currentRepo || '');
  return {
    providerId: 'github-task-board',
    id: numStr,
    title,
    url,
    text,
    data: {
      issueNumber: issue.number,
      repo: repoSlug,
    },
  };
  ```
  And in `getSessionIssueRepo(item)`, continue to check `item.data?.repo`.

---

#### 2. Concurrent Scratchpad Overwrites Between UI and Voice Service
- **Severity:** LOW-MEDIUM
- **Anchors:**
  - `extensions/chambervoice/service/taskboard.ts:893`
  - OpenChamber guest storage `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/storage.js`
- **Root Cause:**
  `chambervoice`'s `TaskboardManager` reads and writes `/workspace/.openchamber-data/guest-storage/github-task-board.json` directly via synchronous `fs.writeFileSync`. Meanwhile, OpenChamber host processes `host.storage.set(...)` from the taskboard UI panel via asynchronous file writes with temporary files and renames.
- **Blast Radius:**
  If the user is actively typing in the scratchpad UI while issuing voice commands that append to or replace the scratchpad, a race condition could overwrite one of the updates.
- **Fix Proposal:**
  When `host.serviceRequest` or an internal OpenChamber storage lock API is available, route scratchpad updates through the host storage endpoint or acquire an atomic file lock.

---

### Section C: CONFIRMED OK

#### 1. Session Activity Values and Reconciler State Machine
- **Verified Files:**
  - `@openchamber/sdk/dist/workspace.d.ts:15`
  - OpenChamber `PluginPane-2C71F8uF.js:39700-40100` (`ei`)
  - `extensions/github-task-board/panel/labels.ts:392-410`
- **Finding:**
  OpenChamber V2 internally converts OpenCode v2 states into the canonical guest activity enum:
  `'unknown' | 'idle' | 'running' | 'retrying' | 'waiting-permission' | 'waiting-question'`.
  `labels.ts` in `github-task-board` maps these exact strings to column transitions:
  - `running` -> `in-progress`
  - `waiting-permission` / `waiting-question` -> `needs-human`
  - `idle` -> `in-review`
  No silent renaming of activity states occurred. The 8-stage Kanban reconciler functions as designed.

#### 2. Panel Asset Serving from Master Checkout
- **Verified Files:**
  - `/workspace/.openchamber-data/extensions.json`
  - `extensions/github-task-board/package.json`
  - Live HTTP probe: `GET /api/guests/github-task-board/panel/main.js` (HTTP 200, 409,124 bytes)
- **Finding:**
  OpenChamber V2 directly serves guest extension files from the filesystem root specified in `extensions.json`. The served JavaScript matches `/workspace/extensions/github-task-board/panel/main.js` on `master` byte-for-byte. When pull requests are merged into `master` and rebuilt with `npm run build`, the updated panel is served immediately without caching issues.

#### 3. Taskboard Manager Guest Storage & Sentinel URL Defense
- **Verified Files:**
  - `extensions/chambervoice/service/taskboard.ts:258, 310, 849`
  - `/workspace/.openchamber-data/guest-storage/github-task-board.json`
- **Finding:**
  `TaskboardManager` resolves `OPENCHAMBER_DATA_DIR` correctly to `/workspace/.openchamber-data`.
  All 8 repositories and scratchpads, including `scratchpad___all_projects__` and `selected_repo`, are read correctly.
  The Issue #17 fix (`ALL_PROJECTS_SENTINEL` defense) correctly prevents queries against `repos/__all_projects__`.

---

## 4. Remediation Priority & Action Plan

| Priority | Issue | Component | Recommended Fix | Blast Radius |
|---|---|---|---|---|
| **P0** | Paginated `/api/session` envelope breaks `listSessions()` | `chambervoice/service/host-client.ts` | Support `{ data: [] }` envelope and `location.directory` | High (Voice monitoring blind) |
| **P0** | Question routes 404 (replaced by V2 Form API) | `chambervoice/service/host-client.ts` | Map `forms` from status and route to `/api/session/:id/form/:id/reply` | High (Voice answering broken) |
| **P0** | Permission routes 404 | `chambervoice/service/host-client.ts` | Route to `/api/session/:id/permission/:id/reply` with `{ decision }` | High (Voice permissions broken) |
| **P1** | Session items drop `url` (breaks All Projects binding) | `github-task-board/panel/core.ts` | Store `repo` inside `data` in `buildIssueAttachPayload` | Medium (All-projects card binding) |
| **P1** | Hardcoded `/home/opencode` DB path | `management/SKILL.md` | Dynamically resolve `opencode.db` across candidate locations | Medium (Worktree skill DB sync) |
| **P2** | Concurrent scratchpad writes | `chambervoice/service/taskboard.ts` | Add atomic write check or host API delegation | Low (Race on simultaneous edit) |
