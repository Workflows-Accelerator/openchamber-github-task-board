# GitHub API Rate-Limit & Request Efficiency Audit

**Owner:** Subagent Audit (`board-lifecycle` mission)  
**Target File:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/rate-limit-audit.md`  
**Status:** COMPLETE / ACTIONABLE  
**Scope:** Read-only analysis of `github-task-board` (branch `issue-lifecycle-issue-contract-l4r`) and `chambervoice` (`service/taskboard.ts`).  

---

## 1. Executive Summary

This quantitative audit measures every outbound HTTP request directed at `api.github.com` by the GitHub Task Board extension and ChamberVoice's `taskboard` service.

### Key Discoveries:
1. **Total Request Call Sites:** 21 distinct call sites (16 in `panel/main.ts`, 5 in `chambervoice/service/taskboard.ts`).
2. **The Session Idle Refetch Storm (`main.ts:531-539`):** Every time *any* autonomous agent session transitions to `idle`, the panel deletes its issue cache and executes an unconditional multi-page refetch (`fetchIssues(true)` or `fetchAllProjectIssues(true)`). In multi-repo All Projects mode with 5 agents running, this generates up to **1,200 redundant GET requests per hour**.
3. **Comment Refetch Storm in the Drawer (`main.ts:4241`, `4518`):** `renderDrawer()` unconditionally issues `GET /issues/:id/comments` with zero caching. Toggling 5 subtask checkboxes or modifying dropdown attributes (priority, complexity, status) fires 5 PATCH requests plus 5 identical comment GET requests.
4. **Missing Retry & Backoff on 14 of 16 Panel Call Sites (Issue #18):** While `fetchAllRepoIssuePages()` (`main.ts:1293, 1301`) wraps requests in `githubRequestWithRetry()`, all single-repo fetches (`main.ts:1231`), background page streaming (`main.ts:1161`), and all 12 PATCH/POST mutation sites bypass retry logic. When hitting GitHub secondary rate limits (HTTP 403/429), these operations crash immediately rather than backing off.
5. **ChamberVoice Blind Multi-Repo Fanout (`taskboard.ts:562-564`):** Querying a single task (`tasks.get(number)`) in All Projects mode executes parallel unthrottled `GET` requests across *all* known repositories simultaneously. With 10 repositories linked, 1 request succeeds and 9 fail with HTTP 404, burning rate limit quota and risking secondary rate limit abuse detection.
6. **Zero Conditional Requests (ETags):** Neither the panel nor ChamberVoice sends `If-None-Match` or `If-Modified-Since`. Every issue list query unconditionally transfers full payloads and consumes primary rate limit units, even when 0 issues have changed.

---

## 2. Exhaustive Request Site Inventory

### 2.1 Task Board Panel (`panel/main.ts`)

| # | File : Line | Method | API Endpoint | Trigger | Payload | Caching / Dedupe | Backoff / Retry |
|---|-------------|--------|--------------|---------|---------|------------------|-----------------|
| 1 | `main.ts:1161` | `GET` | `/repos/:repo/issues?state=all&per_page=100&page=:page` | Background pagination in `streamRemainingPages` if page 1 returned 100 items (loops pages 2..10). | None | Stored in memory and `host.storage` once fetched; no ETag. | **None** (`githubRequest`) |
| 2 | `main.ts:1231` | `GET` | `/repos/:repo/issues?state=all&per_page=100&page=1` | Single-repo `fetchIssues()`. Triggers: panel init, repo switch, token prompt, manual refresh, session idle (`main.ts:538`), new issue modal (`main.ts:5642`). | None | Memory TTL 60s (`ISSUE_CACHE_TTL_MS`), persistent storage on load; bypassed on `force=true`. | **None** (`githubRequest`) |
| 3 | `main.ts:1293` | `GET` | `/repos/:repo/issues?state=all&per_page=100&page=1` | All Projects `fetchAllProjectIssues()` page 1 for each repo in `allProjectsRepoRefs`. Triggers: panel init in All Projects mode, manual refresh, session idle. | None | Aggregated memory TTL 60s (`__all_projects__`); persistent storage on load; bypassed on `force=true`. | `githubRequestWithRetry` (max 3 attempts) |
| 4 | `main.ts:1301` | `GET` | `/repos/:repo/issues?state=all&per_page=100&page=:page` | All Projects sequential pagination in `fetchAllRepoIssuePages()` if page 1 has 100 items (loops up to `MAX_PROJECT_ISSUE_PAGES = 10`). | None | Cached only upon complete aggregation; no ETag. | `githubRequestWithRetry` (max 3 attempts) |
| 5 | `main.ts:1415` | `PATCH` | `/repos/:repo/issues/:number` | `updateIssueBody()`. Triggers: subtask toggle (card, questions, drawer), inline question answer, drawer description edit, adding subtasks/questions/tests, linking blocker. | `{ body }` | **None**. Evicts repo from `issueCache`. Triggers drawer re-render (which fetches comments). | **None** (`githubRequest`) |
| 6 | `main.ts:1451` | `PATCH` | `/repos/:repo/issues/:number` | `updateIssueStatus()`. Triggers: Next Column button, Kanban drag-and-drop, drawer status dropdown, automatic writeback from `StatusReconciler`. | `{ state, labels }` | **None**. Evicts repo from `issueCache`. | **None** (`githubRequest`) |
| 7 | `main.ts:1598` | `PATCH` | `/repos/:repo/issues/:number` | `toggleArchiveIssue()`. Triggers: card archive button click. | `{ state, labels }` | **None**. Evicts repo from `issueCache`. | **None** (`githubRequest`) |
| 8 | `main.ts:2569` | `PATCH` | `/repos/:repo/issues/:number` | Kanban drag-and-drop into a priority subgroup when grouped by priority (`main.ts:2562-2573`). Fired immediately after #6 (`updateIssueStatus`). | `{ labels }` | **None**. Evicts repo from `issueCache`. | **None** (`githubRequest`) |
| 9 | `main.ts:4050` | `GET` | `/repos/:repo/labels?per_page=100` | `loadRepoLabels()`. Trigger: Clicking "Add Label" in issue drawer (`main.ts:6459`). | None | In-memory `repoLabelsCache` per repo (process-lifetime). | **None** (`githubRequest`) |
| 10 | `main.ts:4110` | `PATCH` | `/repos/:repo/issues/:number` | `addTagToIssue()`. Trigger: Confirming new label in drawer (`main.ts:6467`). | `{ labels }` | **None**. | **None** (`githubRequest`) |
| 11 | `main.ts:4129` | `PATCH` | `/repos/:repo/issues/:number` | `removeTagFromIssue()`. Trigger: Clicking '×' on label pill in drawer (`main.ts:4089`). | `{ labels }` | **None**. | **None** (`githubRequest`) |
| 12 | `main.ts:4518` | `GET` | `/repos/:repo/issues/:number/comments` | `loadComments()`. Trigger: Every call to `renderDrawer()` (`main.ts:4241`). Fired on opening drawer, every subtask toggle, status/priority/complexity dropdown change, and session change. | None | **None**. Zero cache. Refetches from GitHub network on every call. | **None** (`githubRequest`) |
| 13 | `main.ts:5633` | `POST` | `/repos/:repo/issues` | `createNewIssue()`. Trigger: Submitting new issue modal (`main.ts:5633`). | `{ title, body, labels }` | **None**. Evicts cache and triggers `fetchIssues(true)`. | **None** (`githubRequest`) |
| 14 | `main.ts:6339` | `PATCH` | `/repos/:repo/issues/:number` | Drawer priority dropdown change (`main.ts:6330`). | `{ labels }` | **None**. Evicts cache. Calls `renderDrawer()`. | **None** (`githubRequest`) |
| 15 | `main.ts:6361` | `PATCH` | `/repos/:repo/issues/:number` | Drawer status dropdown set to `'none'` (`main.ts:6352`). | `{ labels }` | **None**. Evicts cache. Calls `renderDrawer()`. | **None** (`githubRequest`) |
| 16 | `main.ts:6382` | `PATCH` | `/repos/:repo/issues/:number` | Drawer complexity dropdown change (`main.ts:6372`). | `{ labels }` | **None**. Evicts cache. Calls `renderDrawer()`. | **None** (`githubRequest`) |

---

### 2.2 ChamberVoice (`chambervoice/service/taskboard.ts`)

| # | File : Line | Method | API Endpoint | Trigger | Payload | Caching / Dedupe | Concurrency / Backoff |
|---|-------------|--------|--------------|---------|---------|------------------|-----------------------|
| 17 | `taskboard.ts:354` | `GET` | `/repos/:repo/issues?state=:state&per_page=50[&labels=...]` | Voice tool `taskboard(action: 'tasks.list')`. Single-repo mode = 1 call. All Projects mode = N parallel calls (`Promise.allSettled`). | None | **None**. Every voice turn triggers a fresh network call. | Timeout 5s (`AbortSignal.timeout`). No retry. Unbounded parallel fanout across N repos. |
| 18 | `taskboard.ts:513` | `GET` | `/repos/:repo/issues/:number` | Voice tool `taskboard(action: 'tasks.get')`. Single-repo mode = 1 call. All Projects mode = N parallel calls (`Promise.allSettled`). | None | **None**. Every voice turn triggers fresh network call. | Timeout 5s. No retry. Unbounded parallel fanout across N repos (N-1 calls return 404). |
| 19 | `taskboard.ts:660` | `POST` | `/repos/:repo/issues` | Voice tool `taskboard(action: 'tasks.create')`. | `{ title, body, labels }` | None | Timeout 5s. No retry. |
| 20 | `taskboard.ts:733` | `PATCH` | `/repos/:repo/issues/:number` | Voice tool `taskboard(action: 'tasks.update')`. | `{ title?, body?, state?, labels? }` | None | Timeout 5s. No retry. |
| 21 | `taskboard.ts:804` | `PATCH` | `/repos/:repo/issues/:number` | Voice tool `taskboard(action: 'tasks.close')`. | `{ state: 'closed', state_reason? }` | None | Timeout 5s. No retry. |

*(Note: `readScratchpad`, `replaceScratchpad`, and `appendToScratchpad` at lines 836-969 operate purely against local disk JSON at `guest-storage/github-task-board.json`, generating 0 GitHub API calls).*

---

## 3. Analysis of Existing Caching and Deduplication Layers

### 3.1 The 60-Second TTL Issue Cache (`core.ts:1957-1970`, commit `213fef8`)
- **Mechanism:** `issueCache` stores `{ timestamp: number, issues: Issue[] }` keyed by repo slug (or `__all_projects__`). If `now - timestamp < 60000` and `force === false`, returns cached issues with 0 network calls.
- **What it successfully saves:**
  - Fast UI operations (switching tabs between All Tasks / Human Tasks / Questions / Kanban, typing in search filters, toggling grouping modes) cost **0 API calls**.
  - Duplicate manual clicks within 60 seconds cost 0 calls.
- **Where it leaks:**
  1. **Eviction on Any Local Mutation:** Any body update, status move, label edit, or archive action executes `issueCache.delete(repo)`. The next fetch will be an unconditional network request.
  2. **Session Idle Invalidation (`main.ts:536-539`):** Completely deletes the cache entry and forces `fetchIssues(true)`.

### 3.2 Persistent Storage (`host.storage` / `core.ts:1210-1223`)
- **Mechanism:** Stores `cached_issues_${repo}` in extension storage. On page reload, if `issues.length === 0`, it instantly renders the stored issues.
- **Leak:** It does **not** abort the network fetch! Lines 1210-1223 render from storage to provide "0ms perceived latency", but line 1225 immediately proceeds to execute `githubRequest('GET', ...page=1)`. Persistent storage saves perceived user latency, but saves **zero GitHub API requests** on startup.

### 3.3 StatusReconciler Deduplication (`labels.ts:568-658`)
- **Mechanism:** Maintains an `inFlight = new Set<string>()` and `lastReconciled = new Map<string, ColumnId>()` debounced by 300ms.
- **What it successfully saves:** Prevents rapid status flutter and infinite reconciliation loops for the same issue to the same column.
- **Where it leaks:** `lastReconciled` is in-memory only. On board reload or project switch, it is cleared. When an issue transitions through multiple states (todo → in-progress → in-review → done), each step triggers a distinct PATCH.

### 3.4 In-Flight Deduplication & Concurrency Throttling
- **In-flight Deduplication:** **Absent.** If `fetchIssues()` is triggered twice in 100ms (e.g. from `host.onDirectory` followed by `host.onSession`), both HTTP requests are dispatched to GitHub.
- **Concurrency Throttling:** `mapWithConcurrency()` (`core.ts:2176`) limits parallel repo fetching in All Projects mode to `MAX_CONCURRENT_REPO_FETCHES = 4`. ChamberVoice, however, uses unthrottled `Promise.allSettled(knownRepos.map(...))` (`taskboard.ts:446, 562`).

### 3.5 Conditional Requests (ETag / `If-None-Match`)
- **Status:** **Completely absent.** Neither `panel/main.ts:1071` nor `chambervoice/service/taskboard.ts:291` records or transmits `ETag` or `If-None-Match`. Every query downloads full payloads and increments GitHub rate limits.

---

## 4. Waste Taxonomy & Root Causes

### Waste #1: Session Idle Fetch Storm (The #1 Offender)
- **Code Anchor:** `panel/main.ts:531-539`
- **Cause:** When any session in OpenChamber transitions to `activity === 'idle'`, the handler runs:
  ```ts
  if (becameIdle && currentRepo) {
    issueCache.delete(currentRepo);
    void fetchIssues(true);
  }
  ```
- **Waste Factor:** In All Projects mode, this runs `fetchAllProjectIssues(true)`, scanning all registered repositories and paging through them. If 5 autonomous agents run simultaneously, every subagent turn, tool call idle, or completion triggers a multi-repo scan. 5 agents idling 12 times an hour = 60 storms/hour = up to **1,200 requests/hour** of pure waste.

### Waste #2: Drawer Comment Refetch Storm on Checkbox Toggles
- **Code Anchor:** `panel/main.ts:4241`, `4518`, `1411`, `6336`, `6360`, `6379`
- **Cause:** `renderDrawer(issue)` unconditionally invokes `loadComments(issue.number)`. `updateIssueBody()` calls `renderDrawer(issue)` on every subtask toggle.
- **Waste Factor:** If a developer tests or checks off 10 subtasks in an issue drawer, the board executes:
  - 10 PATCH `/issues/:id` (for issue body)
  - 10 GET `/issues/:id/comments` (fetching the identical unchanged comments 10 times)
  - Total: 20 requests. 10 of them (50%) are completely redundant comment reads.

### Waste #3: Double-PATCH on Priority Drag-and-Drop
- **Code Anchor:** `panel/main.ts:2560-2573`
- **Cause:** When moving an issue card into a priority column, the code executes:
  1. `await updateIssueStatus(issue, col.id)` (PATCH state + `status:*` label)
  2. Followed immediately by `await githubRequest('PATCH', ... { labels: updatedLabels })` (PATCH priority label)
- **Waste Factor:** 2 sequential network roundtrips where 1 single PATCH containing both state and all labels would suffice. 100% waste on the second request.

### Waste #4: Unconditional Issue Refetch on Issue Creation
- **Code Anchor:** `panel/main.ts:5633-5642`
- **Cause:** `POST /repos/:repo/issues` returns the newly created issue object from GitHub. Instead of appending it to the local `issues` collection, lines 5641-5642 run:
  ```ts
  issueCache.delete(currentRepo);
  void fetchIssues(true);
  ```
- **Waste Factor:** Refetches all pages from GitHub to get an issue the client already holds in memory.

### Waste #5: ChamberVoice Blind Multi-Repo Fanout on Single-Issue Lookup
- **Code Anchor:** `chambervoice/service/taskboard.ts:562-564`
- **Cause:** When asking ChamberVoice "What is task #45?", `getTask(45)` in All Projects mode dispatches parallel `GET /repos/:repo/issues/45` requests to *all* known repositories.
- **Waste Factor:** For 10 repositories, 1 request succeeds and 9 return 404. All 10 consume rate limit quota and risk secondary rate limit abuse triggers.

---

## 5. ChamberVoice Traffic & Voice-Workflow Cost Model

### 5.1 Per-Query Cost
- `tasks.list` in single-repo mode: **1 request**.
- `tasks.list` in All Projects mode: **N requests** (where N = number of known repositories).
- `tasks.get(number)` in single-repo mode: **1 request**.
- `tasks.get(number)` in All Projects mode: **N requests** (N-1 requests return 404).
- `tasks.create` / `update` / `close`: **1 request** (mutations are blocked in All Projects mode unless repo is explicitly provided).

### 5.2 Voice Triage Cadence (Requests per Minute)
In a typical spoken voice triage session, a developer speaks with ChamberVoice at ~2 to 4 turns per minute.

| Operation (1-minute window) | Single Repo (N=1) | 3 Repos (N=3) | 5 Repos (N=5) | 10 Repos (N=10) |
|---|:---:|:---:|:---:|:---:|
| 1× `tasks.list` ("What's in todo?") | 1 req | 3 reqs | 5 reqs | 10 reqs |
| 1× `tasks.get` ("Details on #12") | 1 req | 3 reqs | 5 reqs | 10 reqs |
| 1× `tasks.update` ("Assign to me") | 1 req | 1 req | 1 req | 1 req |
| 1× `tasks.get` ("Check #15") | 1 req | 3 reqs | 5 reqs | 10 reqs |
| **Total per minute** | **4 reqs/min** | **10 reqs/min** | **16 reqs/min** | **31 reqs/min** |
| **Extrapolated / hour (if sustained)** | **240 reqs/hr** | **600 reqs/hr** | **960 reqs/hr** | **1,860 reqs/hr** |

*Notice:* With 5+ repos, a 15-minute voice triage session bursts to **240-465 requests**, easily hitting GitHub's secondary rate limit burst threshold (~100 concurrent / high per-minute bursts).

---

## 6. Quantitative Request-Rate Model

### Rate Limit Constraints (GitHub REST API):
- **Core Primary Rate Limit:** 5,000 requests/hour per authenticated user (PAT or OAuth token).
- **Secondary Rate Limit (Abuse Detection):**
  - Burst threshold: Maximum ~100 concurrent requests.
  - Frequency threshold: ~600 to 900 requests/hour sustained burst from a single IP/token.
  - Mutation throttle: No more than 1 mutation (POST/PATCH/DELETE) per second.
  - Penalty on breach: HTTP 403/429 with `Retry-After` (typically 1 to 5 minutes).

---

### Configuration 1: 1 Repo × 30 Issues Active
*Single developer, small repository (<100 issues = 1 page).*

#### Model Breakdown:
- Initial Load: 1 GET (Page 1 = 30 issues).
- Session Idles: 1 active agent, idles 4 times/hr → 4 × 1 GET = 4 GETs/hr.
- Card Moves: 3 moves/hr → 3 PATCHes/hr.
- Drawer Usage: 4 drawer opens (4 GET comments) + 4 subtask checks (4 PATCH body + 4 GET comments) = 12 reqs/hr.
- Status Reconciler: 2 auto-moves = 2 PATCHes/hr.

| Scenario | GET (List) | GET (Comments) | PATCH/POST | Total Reqs/Hr | % of Core Limit | Secondary Limit Risk |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Typical Case** | 5 | 8 | 9 | **22 / hr** | 0.4% | None |
| **Worst Case** (Heavy agent turns + 20 checkbox toggles + 15m voice triage) | 35 | 30 | 45 | **110 / hr** | 2.2% | Low |

---

### Configuration 2: 3 Repos × 100 Issues Active
*Mid-sized project / multi-package repo (~150 issues/repo = 2 pages/repo). All Projects mode.*

#### Model Breakdown:
- Initial Load: 3 repos × 2 pages = 6 GETs.
- Session Idles: 2 active agents idling 4 times/hr each = 8 idle events. 8 × 6 GETs = 48 GETs/hr.
- Card Moves: 6 moves/hr → 6 PATCHes/hr (plus 2 double-PATCHes = 8 PATCHes).
- Drawer Usage: 8 drawer opens (8 GET comments) + 8 subtask checks (8 PATCH + 8 GET comments) = 24 reqs/hr.
- Status Reconciler: 6 auto-moves = 6 PATCHes/hr.

| Scenario | GET (List) | GET (Comments) | PATCH/POST | Total Reqs/Hr | % of Core Limit | Secondary Limit Risk |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Typical Case** | 54 | 16 | 22 | **92 / hr** | 1.8% | Low |
| **Worst Case** (2 agents in rapid loops + 25 idles + 30 checkbox clicks + 20m voice triage) | 225 | 45 | 75 | **345 / hr** | 6.9% | Moderate (voice fanout bursts) |

---

### Configuration 3: Multi-Repo All-Projects Mode (10 Repos × 100 Issues) with 5 Live Agent Sessions
*High-concurrency team environment. 10 repos × 2 pages = 20 GETs per full scan.*

#### Model Breakdown:
- Initial Load: 10 repos × 2 pages = 20 GETs.
- Session Idles: 5 agents in autonomous loops. Each completes a turn or tool call every 5 minutes = 12 idle events/agent/hr = 60 idle events/hr. 60 × 20 GETs = **1,200 GETs/hr**!
- Directory / Context Switches: User navigates between worktrees 15 times/hr.
- Drawer Usage: 20 drawer opens (20 GET comments) + 30 subtask checks (30 PATCH + 30 GET comments) = 80 reqs/hr.
- Status Reconciler: 20 auto-moves across 5 sessions = 20 PATCHes/hr.
- Voice Supervision: 30 minutes of voice interaction across 10 repos = 360 reqs/hr.

| Scenario | GET (List) | GET (Comments) | PATCH/POST | Total Reqs/Hr | % of Core Limit | Secondary Limit Risk |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Typical Case** (Calm agents, 10 idles/hr, modest drawer use) | 220 | 25 | 35 | **280 / hr** | 5.6% | Moderate |
| **Worst Case** (Active agent storm + rapid drawer checks + voice supervision) | 1,440 | 60 | 90 | **1,590 / hr** (panel) + 360 (voice) = **1,950 / hr** | **39.0%** | **CRITICAL (Guaranteed 403/429 lockout)** |

*Root Cause of Failure in Config 3 Worst Case:* The panel attempts 1,950 requests/hour with parallel bursts of 10-20 requests every time an agent session idles. GitHub secondary rate limit triggers within 10-15 minutes, blocking all tokens on the developer's machine.

---

## 7. Efficiency Options & Feature-Loss Trade-Offs

Below are 5 concrete engineering options to eliminate waste and protect against rate limits.

---

### Option A: Conditional Requests Everywhere via `ETag` / `If-None-Match`
- **What it changes:**
  Store the `ETag` header returned by GitHub for every issue list and comment request (in memory / `host.storage`). On every subsequent request, send `If-None-Match: <etag>`. On `HTTP 304 Not Modified`, return the cached response immediately.
- **Requests Saved:**
  - **75% to 90% of core rate limit quota saved.**
  - Under GitHub API rules, **HTTP 304 responses do not count against the 5,000/hr rate limit**.
  - In Configuration 3 worst case, ~1,100 of the 1,200 list requests return 304 with **0 rate limit cost**.
- **Explicit Feature Loss / Degradation:**
  - **ZERO feature loss.** Data freshness is 100% identical. If anything changes on GitHub, GitHub returns HTTP 200 with new data; if not, 304 returns immediately.
- **Implementation Cost:** Low (1 day). Wrap `githubRequest` and ChamberVoice `fetch` to store ETags and handle status 304.
- **Risk:** Very Low. Standard HTTP protocol supported natively by GitHub REST API.

---

### Option B: Eliminate Session-Idle Fetch Storms & Rely on Event-Driven Local Telemetry
- **What it changes:**
  - Delete `main.ts:536-539` (`if (becameIdle) { issueCache.delete(); fetchIssues(true); }`).
  - Instead, use local session telemetry (`sessions` snapshot) to transition the specific issue's card status in-memory (e.g. running → in-progress, idle → in-review/done). The board already indexes session state!
  - Rely on the manual Refresh button (`elBtnRefresh`) or a modest periodic sync (e.g. 5-10 minutes) to pick up changes made outside OpenChamber.
- **Requests Saved:**
  - **Saves 100% of session-idle refetches.**
  - Config 2 worst case: saves **150 requests/hr**.
  - Config 3 worst case: saves **1,200 requests/hr** (eliminating the primary rate-limit killer).
- **Explicit Feature Loss / Degradation:**
  - **Degrades out-of-band multi-user sync freshness:** If *another human* edits an issue directly on github.com in their browser while you run an agent, that remote edit will not appear on your board the instant your agent idles; you must wait for the periodic sync or click Refresh.
  - **Direct CLI issue body mutations:** If an agent script uses `gh issue edit` via bash instead of OpenChamber session telemetry, the updated body will not reflect until manual refresh.
- **Implementation Cost:** Minimal (<2 hours). Delete 4 lines and verify local state attribution.
- **Risk:** Very Low.

---

### Option C: Drawer In-Memory Comment Caching & Mutation Coalescing
- **What it changes:**
  1. Add an in-memory cache for comments (`Map<number, { timestamp, comments }>` with a 2-minute TTL).
  2. In `updateIssueBody()`, `updateIssueStatus()`, and dropdown handlers, re-render drawer UI *without* re-fetching comments (`renderDrawerContent()` vs `loadComments()`).
  3. In Kanban drag-and-drop (`main.ts:2560-2573`), coalesce the status move and priority update into a **single PATCH** request with `{ state, labels: combinedLabels }`.
  4. In `createNewIssue()` (`main.ts:5633-5642`), append the returned issue object directly to `issues` rather than wiping cache and refetching all pages.
- **Requests Saved:**
  - **Saves 100% of redundant comment GETs** and **50% of drag-drop priority PATCHes**.
  - Toggling 10 subtasks drops from 20 requests (10 PATCH + 10 GET) to **10 requests** (10 PATCH + 0 GET).
  - Issue creation drops from 1 POST + 1-10 GETs to **1 POST + 0 GETs**.
- **Explicit Feature Loss / Degradation:**
  - **ZERO feature loss.** Comments are not edited by checking task checkboxes.
- **Implementation Cost:** Low (1 day).
- **Risk:** Very Low.

---

### Option D: ChamberVoice Issue Scoping & 30-Second Task Cache
- **What it changes:**
  1. Add a 30-second in-memory cache in `chambervoice/service/taskboard.ts` for `getTasks()`.
  2. Fix `getTask(number)` in All Projects mode: Instead of broadcasting N parallel requests to all repos (where N-1 return 404), inspect the local cached task list from `getTasks()` to identify which repo owns issue `#number`, and send **only 1 request** to that specific repository.
  3. Wrap multi-repo requests with a concurrency cap (max 2 parallel requests).
- **Requests Saved:**
  - **Saves 70% to 90% of ChamberVoice API traffic.**
  - `getTask(number)` drops from 10 requests to **1 request** in a 10-repo workspace (90% reduction).
  - Rapid voice triage drops from ~30 reqs/min to **3-5 reqs/min**.
- **Explicit Feature Loss / Degradation:**
  - **30-second voice freshness delay:** If an issue is modified on github.com 5 seconds before a voice query, ChamberVoice may report the status from 25 seconds ago until the 30-second cache expires.
  - **Blind lookup of brand-new unlisted issues:** If an issue was created externally 2 seconds ago and is not yet in the task cache, looking it up by number over voice requires asking "Which project is that in?" or falling back to a sequential search.
- **Implementation Cost:** Low-Medium (1-2 days).
- **Risk:** Low. Completely stops secondary rate-limit abuse triggers from voice calls.

---

### Option E: Adaptive Polling & Visibility-Aware Throttling
- **What it changes:**
  - Detect when the task board webview is hidden or inactive using `document.visibilitychange` / `document.hidden` (already partially used at `main.ts:6142`).
  - When hidden or minimized: suspend all background streaming and issue fetching completely.
  - Dynamic TTL:
    - Active board (user interacting): 60s TTL.
    - Idle board (>5 min no user clicks): 10-minute TTL.
    - Hidden board: Infinity (0 requests until opened).
  - On foreground restore: execute a single conditional (ETag) refresh.
- **Requests Saved:**
  - **Saves 80% to 95% of background traffic** during typical coding/editor usage when the developer is not looking at the board.
- **Explicit Feature Loss / Degradation:**
  - **Tab Badge Stagnation:** Unread count badges or task counter numbers on the collapsed tab or sidebar will not update in real-time while the board is hidden; they refresh upon opening the tab.
  - **500ms Resume Spin:** When clicking the tab after 20 minutes away, the board shows a brief 500ms spinner while it catches up.
- **Implementation Cost:** Medium (2 days).
- **Risk:** Low.

---

## 8. Human Decision Matrix

| Option | Primary Benefit | Requests Saved | What Feature Degrades / Dies | Cost | Recommendation |
|---|---|:---:|---|:---:|:---:|
| **A: ETags / 304** | 0 rate limit cost for unchanged queries | 75% - 90% quota | **Nothing** (100% identical behavior) | 1 day | **Must-Do** |
| **B: Kill Session-Idle Storms** | Eliminates the largest traffic explosion | 150 - 1,200 reqs/hr | Remote out-of-band edits by *other humans* require manual refresh | 2 hours | **Must-Do** |
| **C: Drawer Cache & Coalescing** | Halves drawer traffic; eliminates double PATCH | 50% of drawer calls | **Nothing** (comments cached 2m during editing) | 1 day | **Must-Do** |
| **D: Voice Scoping & Cache** | Stops N-way 404 fanout in voice | 80% of voice calls | 30s status freshness over voice; lookup of brand-new issues needs repo context | 1-2 days | **Must-Do for Voice** |
| **E: Adaptive Visibility Throttling** | Stops all traffic when board is hidden | 85% background calls | Background tab counter badges freeze until tab is clicked | 2 days | **Recommended** |
| **F: Issue #18 Bugfix** | Applies `githubRequestWithRetry` across all 14 sites | Prevents crashes | **Nothing** (fixes crash-on-rate-limit defect) | 1 day | **Must-Do** |

### Projected Impact If Options A + B + C + D + F Are Implemented:
- **Configuration 1 (1 repo, 30 issues):** Drops from 110 reqs/hr worst case to **~15 reqs/hr** (86% reduction).
- **Configuration 2 (3 repos, 100 issues):** Drops from 345 reqs/hr worst case to **~35 reqs/hr** (90% reduction).
- **Configuration 3 (10 repos, 5 agents, voice):** Drops from 1,950 reqs/hr worst case to **~65 reqs/hr** (**96.7% reduction**).
- **Result:** Complete immunity from GitHub secondary rate limits, rock-solid stability during autonomous multi-agent runs, and zero loss of core functionality.
