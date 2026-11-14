# Extension audit — OpenChamber task board

Read-only inventory of the extension as it exists at `d0f7ad9` on `ops/task-board-activation`.
Yardstick: the `openchamber-extensions` skill contribution-point table, cross-checked against
`node_modules/@openchamber/sdk/API.md` (SDK 2.7.1) and `GUEST_SERVICES.md`.
No source file was modified. Baseline: `npm test` = 618/618 pass (17.7 s).

Scope: `package.json` `openchamber` block, `panel/**`, `service/**`. `web/**` is the separate
hosted board and is out of scope except as context.

---

## 1. Manifest inventory

### 1.1 The block as shipped (`package.json:23-78`)

```json
  "openchamber": {
    "apiVersion": 1,
    "engines": {
      "openchamber": ">=1.22.0"
    },
    "capabilities": [
      "sessions",
      "prompt",
      "files",
      "origins",
      "filesystem"
    ],
    "contributes": {
      "capabilities": [
        "sessions",
        "prompt",
        "files"
      ],
      "panel": {
        "id": "github-task-board",
        "name": "Task Board",
        "icon": "icon.svg",
        "entry": "panel/index.html"
      },
      "service": {
        "entry": "service/main.js",
        "runtime": "host"
      },
      "page": true,
      "attach": true,
      "filesystem": [
        "/workspace/**"
      ],
      "origins": [
        "https://api.github.com"
      ],
      "integration": {
        "name": "GitHub",
        "description": "Syncs tasks, checklists, and discussions with GitHub Issues",
        "token": {
          "apiOrigin": "https://api.github.com",
          "scheme": "bearer",
          "account": {
            "path": "/user",
            "name": "login"
          }
        },
        "settings": [
          {
            "id": "repo",
            "label": "Repository (owner/repo)"
          }
        ]
      }
    }
  }
```

### 1.2 Declared contribution points

| Point | Where | Notes |
|---|---|---|
| `apiVersion: 1` | `package.json:24` | Correct. |
| `engines.openchamber: ">=1.22.0"` | `package.json:25-27` | Legal floor (`API.md:548`). Installed host is 2.7.1. |
| `panel` | `package.json:41-46` | id `github-task-board`, icon `icon.svg`, entry `panel/index.html`. |
| `service` | `package.json:47-50` | `service/main.js`, `runtime: "host"`. No `keepRunning`, no `permissions`, no `schedule`, no `provides`. |
| `page: true` | `package.json:51` | Reuses `panel.entry` (`API.md:260`). |
| `attach: true` | `package.json:52` | "+" menu opens the rail panel. |
| `capabilities` | `package.json:36-40` | `sessions`, `prompt`, `files`. |
| `origins` | `package.json:56-58` | `https://api.github.com` only. |
| `filesystem` | `package.json:53-55` | `/workspace/**`. |
| `integration` | `package.json:59-76` | GitHub bearer token via `/user`; one setting, `repo`. |

### 1.3 Absent contribution points

Every point below is absent from the manifest; none is declared anywhere else.

| Point | Declared | Why it is absent today |
|---|---|---|
| `statusSection` | no | The board is only visible in its rail panel. |
| `marks` | no | No sidebar signal; the panel instead calls `host.setBadge` (`panel/main.ts:3281`). |
| `actions` | no | No message/session/selection/file/diff menu entries. |
| `commands` | no | No `/name` in the composer. |
| `mentions` | no | No `@` rows for issues. |
| `blocks` | no | No chat block components. |
| `instructions` | no | Agents get instructions only through prompts the panel builds (`core.ts:2611`). |
| `skills` | no | No `skills/` folder. |
| `opencodePlugin` | no | No plugin folder. |
| `providerLogos` | no | Not applicable. |
| `sessionControl` | no | Service cannot start/stop/answer sessions. |
| `sessionEvents` | no | Service hears nothing when a turn finishes or asks. |
| `service.schedule` | no | Service never wakes on a clock. |
| `service.provides` | no | Service is not a browser/tracker/notification channel. |
| `fileEditors` | no | Files opens issue markdown its own way. |
| `page` | **yes** | `package.json:51`. |
| `integration` | **yes** | `package.json:59-76`. |

### 1.4 Manifest defects found

1. **Top-level `capabilities` is not a valid manifest key.** `API.md:555` puts `capabilities`
   under `contributes`; "Extra keys are dropped, not forwarded" (`API.md:600`). The top-level
   block at `package.json:28-34` also lists `origins` and `filesystem`, which are not capability
   values. The effective grant is `contributes.capabilities` at `package.json:36-40`.
   Consequence: the duplicate is dead weight and would fail a strict validator even though the
   host tolerates it.
2. **`id`/`name`/`icon` live only inside `panel`.** Allowed for older packages (`API.md:549`),
   but top-level identity is the current form; leave as is unless a validator complains.
3. **No `keepRunning`.** Any future `marks`/`sessionEvents` work must add it, because a mark
   lives only as long as the service process (`API.md:565`).
4. **Floor vs. newer points.** `marks` ships in the first release after 2.7.0 and is silently
   ignored by older hosts (`API.md:565`); `sessionEvents` likewise (`API.md:564`). With
   `>=1.22.0` those points degrade silently on old hosts. The deployed host is 2.7.1, so they
   work here, but the floor should be raised if correctness on old hosts matters.

---

## 2. Panel inventory

### 2.1 Size and structure

| File | Lines | Role |
|---|---:|---|
| `panel/main.ts` | 10,039 | Every feature: state, fetching, rendering, events. 184 top-level functions. |
| `panel/index.html` | 4,474 | All markup: toolbar, five view containers, drawer, four modals. 261 `id=` attributes. |
| `panel/core.ts` | 4,626 | 99 exported pure functions, imported by tests and by `main.ts`. |
| `panel/main.js` | ~709 KB | Prebuilt classic script loaded by `index.html:4472`; esbuild, `--tree-shaking=false` (`package.json:16`). |
| `panel/markdown.ts` | 11.8 KB | Hand-rolled Markdown renderer. |
| `panel/dropdown.ts` | 7.9 KB | Custom select replacement, initialised once (`main.ts:9001`). |
| `panel/labels.ts`, `viewstate.ts`, `git.ts`, `types.ts`, `utils.ts` | 23.9 / 20.1 / 2.6 / 1.0 / 1.9 KB | Status labels, view state, git remote parsing, types, helpers. |

The panel is a single module with 48 module-level mutable `let` bindings (`main.ts:244-303`) and
one `initEvents()` that wires every control (`main.ts:8999-9942`). It is loaded as one opaque-origin
iframe (`index.html:4472`), so `core.ts` cannot be imported at runtime; its logic is duplicated
into the bundle and a parity test enforces the copy (`test/shipped-parity.test.js:9-15`).

### 2.2 Features offered today

**Data loading** (`panel/main.ts`)
- `githubRequest` `1290-1415`: PAT from workspace git credentials or stored token, direct `fetch`
  to `api.github.com`, ETag capture, rate-limit classification, fallback to `host.request`.
- `githubRequestWithRetry` `1418-1431`: bounded retry on rate-limit errors.
- `getWorkspaceGitToken` `1220-1245`: token discovery from workspace files.
- `fetchIssues` `1754-1852`: one-repo refresh with memory/persistent cache, ETag, partial streaming.
- `streamRemainingPages` `1700-1753`: page 2..N streaming for one repo.
- `fetchAllRepoIssuePages` `1856-1935`: full page walk with per-page ETag cache.
- `fetchAllProjectIssues` `1938-2053`: parallel multi-repo fetch, dedupe, TTL cache for All Projects.
- `syncRepoIncremental` `2054-2165`: `since`-based incremental sync after a session goes idle.
- `handleIdleRefresh` `2166-2205`: triggers the incremental sync.
- `discoverWorkspaceRepositories` `719-774`: scans `host.listProjects()`, reads `.git/config` and
  worktree pointers, links repo per project.
- `autoResolveRepoForActiveContext` `804-952`: picks the repo from the active session, its items,
  or the project directory.

**Views**
- `renderViews` `3501-3559`: filter, attention grouping, sort, dispatch.
- `renderSimpleListView` `3665-3894`, `renderListView` `4521-4620`, `renderKanbanView` `4621-4788`,
  `renderGraphView` `6499-6578`, `renderHumanTasksView` `4903-5419`.
- Supplements: `renderAttentionView` `5780-6011`, `renderQuestionsView` `5420-5779`.
- `renderArchiveView` `3339-3378`; `renderDrawer` `6801-6931`; `renderEmptyState` `3288-3337`.

**Task actions**
- `updateIssueStatus` `2746-2823`: optimistic status-label + state PATCH with rollback.
- `updateIssueBody` `2531-2648`: optimistic body PATCH with stale-write protection.
- `toggleArchiveIssue` `2907-2982`; `addTagToIssue` `6741-6772`; `removeTagFromIssue` `6773-6800`.
- `handleAddDependency` `6042-6060`; `handleRemoveDependency` `6061-6085`.
- Drafts: `createQuickCaptureDraft` `3937-3973`, `editDraftTitle` `3974-4005`,
  `editDraftDescription` `4006-4042`, `reorderDraft` `4043-4114`,
  `transferDraftProject` `4115-4233`.
- Launch: `launchAgentSession` `7559-7645`, `launchPackagedSession` `7680-7729`,
  `launchBatchSeparateSessions` `7730-7770`, `attachSelectedIssues` `7771-7906`.
- Authoring: `quickAddDraft` `8645-8704`, `batchAlignDrafts` `8705-8810`,
  `submitNewIssue` `8811-8885`, `launchAiIssueSession` `8886-8953`,
  `acceptAndPostDraft` `7992-8060`.

**Question answering**
- `answerQuestion` `2649-2744`: reload-before-mutation, duplicate-question guard, optimistic
  Markdown rewrite via `updateIssueBody`, draft recovery on failure.
- `renderQuestions` `7075-7267` (drawer) and `renderQuestionsView` `5420-5779` (queue).
- Draft persistence: `saveQuestionDraft` `2335-2360`, `getQuestionDraft` `2361-2375`,
  `clearQuestionDraft` `2376-2390`, `renderRecoverableDraftsElement` `2412-2499`.
- `notifyAgentOnHumanTasksComplete` `2212-2259`: resumes the linked session when human tasks close.

**Repo selection**
- `setRepository` `953-999` (persists `selected_repo` and `repo_<projectId>`).
- `renderRepoPopoverList` `1000-1112`, `openRepoPopover` `1113-1121`, `closeRepoPopover` `1116`.
- `selectAllProjects` `1138-1180`, `buildProjectRepoRefs` `1122-1137`,
  `getWorkspaceRootProject` `1181-1206`.
- `projectPicker` `3560-3573`: a native `<select>` built with `innerHTML`, used inside draft rows.

**Settings**
- View state: `loadViewState` `3399-3413`, `rememberViewState` `3387-3398` (instance or device scope).
- Project display names: `onReady` handler `9945-9980` (`project_name_overrides`).
- Collapsed groups: `toggleGroupCollapse` `305-315`.
- AI prompt overrides: `loadPromptConfigForEditor` `8080-8098`, `savePromptConfig` `8099-8131`,
  `resetPromptConfigToDefault` `8132-8147` (keys `ai_issue_prompt_*`, `ai_alignment_prompt_*`).
- Integration setting `repo` read in `onReady` at `9963-9968`.
- Custom PAT fallback: `promptCustomToken` `1433-1440` (`custom_github_token`).

**Error handling**
- `showBanner` `497-513`, `hideBanner` `523-526`.
- `makeRateLimitError` `1263-1274`, `rateLimitErrorFromResponse` `1275-1289`.
- `renderBoardFreshness` `1453-1463` (`refreshing` / `partial` / `stale` / `complete`).
- `renderEmptyState` `3288-3337`: distinct inaccessible / failed / rate-limited / empty states.
- `lastSyncErrorState` `302`; `reloadIssueBeforeMutation` `2500-2530`.
- `checkBackgroundServiceConnection` `533-564`: one `GET /health` probe and three banners.

### 2.3 Three biggest structural weaknesses

1. **God-file with global mutable state.** `panel/main.ts` is 10,039 lines and 184 functions;
   `panel/index.html` is 4,474 lines. All state is module-level `let` (`main.ts:244-303`), and
   every listener is wired in one 943-line `initEvents` (`main.ts:8999-9942`). Any new surface that
   imports this module inherits the whole board and its side effects.
2. **Logic exists twice, and the shipped copy is authoritative.** `isIssueClosed` is defined at
   `main.ts:2833-2852` and again at `core.ts:3294-3310`; `resolveIssueColumn` at
   `main.ts:3080-3203` and again, session-aware, at `core.ts:3727-3843`. `core.ts` is what tests
   exercise; `panel/main.js` is what ships, and `test/shipped-parity.test.js:9-15` exists only to
   detect drift between them. The bundle is built with `--tree-shaking=false`
   (`package.json:16`), which is why it is ~709 KB.
3. **Ad-hoc DOM and hand-rolled widgets instead of a component layer.** 238 `getElementById`
   calls, 109 `innerHTML` writes, 230 `addEventListener` calls. `projectPicker`
   (`main.ts:3560-3573`) creates a native select with `innerHTML` after the one-time
   `initAllCustomDropdowns()` (`main.ts:9001`), so dynamically added selects never get the custom
   dropdown treatment. Markdown is a bespoke parser (`panel/markdown.ts`). Empty states do exist
   (`renderEmptyState` `3288-3337`), so "no empty states" would be wrong.

Also observed, not a weakness by itself: the panel already has a "Needs me" filter and a priority
sort (`main.ts:3512-3523`), which is the same computation a status section needs.

---

## 3. Service inventory

### 3.1 Routes

`service/main.ts` is 398 lines. The HTTP adapter is `createCoordinatorHostServer` `225-294`.

| Method | Path | Answer | Line |
|---|---|---|---|
| `GET` | `/health` | `200 {"status":"ok","service":"task-coordinator"}` when status is `running`; `503` otherwise | `271-280` |
| any other | `/health` | `405 {"error":"Method Not Allowed"}` | `281-285` |
| any | anything else, including `/status` | `404 {"error":"Not Found"}` | `288-290` |

Guard order: bearer auth first (`237-244`, timing-safe SHA-256 compare at `209-219`), 64 KB body
cap (`229`, `246-265`), 15 s socket timeout (`232-235`), loopback bind only (`380`).

**The panel calls exactly one route: `GET /health`** (`panel/main.ts:535`), once per panel open.

### 3.2 State the service actually holds

- `CoordinatorService` `15-194`: `config`, `status` (`stopped|starting|running|stopping`),
  `ownerId`, `heldLeases: Map`, `LeaseStore`.
- `reconcileOnce` `149-161`: prunes expired leases; the dry-run branch is empty. It does not fetch
  issues, does not inspect sessions, and never calls `acquireLease`.
- `LeaseStore` persists `TaskLease` records (`service/types.ts:22-31`): repo, issue number, owner,
  timestamps, claimed SHA, phase. No title, no body, no attention, no session id.
- `reconcileTaskState` (`reconciler.ts:20-145`) and `inspectSessionLiveness`
  (`session-watcher.ts:13-203`) are pure functions with no live inputs. Nothing calls them from
  the running service.
- No GitHub client, no token, no issue cache, no session list. `readSettings()` would return only
  the non-secret `repo` field, because the token lives in the integration `token` block, not in
  `integration.settings` (`GUEST_SERVICES.md:210`).

### 3.3 Can it produce a 16-row `statusSection`?

**No, not from what it already has.** It has no issue data and no session list. `sessions.status`
requires `sessionControl` and a known session id (`GUEST_SERVICES.md:197`); there is no
"list sessions" call. A `source`-style `/status` would return empty rows or need new data
plumbing. This is the single most important finding for the implementation worker.

---

## 4. Data available for new surfaces

All "panel" answers refer to in-memory state inside the open panel, not something a service or a
second frame can read for free.

| Question | Ready? | Source | Cost if not |
|---|---|---|---|
| (a) "needs me" count | **Yes, panel** | `renderViews` builds the set at `main.ts:3512-3515` from `groupIssuesByAttention` (`core.ts:3844-3893`); `applyFilters` predicate at `3516` | 0 API calls; re-derive in a status frame, or read the same cached issue list |
| (b) running-agent sessions | **Yes, panel** | `sessions` state `main.ts:265`, filled by `host.onSessions` `627-631`; filter `activity === 'running'`; `resolveMatchedSession` `core.ts:3312-3416` | Service cannot list sessions at all; a status frame can call `host.onSessions` itself |
| (c) blocked count | **Yes, panel** | `updateBadgeCounts` `3277-3281` counts `waiting-permission` + `waiting-question`; `renderAttentionView` groups the same issues `5786-5792` | 0 API calls. Distinct from graph "Blocked" (`6505-6508`), which counts dependency-blocked issues |
| (d) most urgent item + issue number + repo | **Yes, derivable, no single function** | `renderViews` sorts by priority weight `3522-3523` (`critical 4 … optional 1`) through `applySort`; `sorted[0]`; `repoForIssue` `2206-2210`; `getIssueRepoFullName` `core.ts:4058-4066` | 0 API calls; wrap in one accessor |
| (e) issue title/body by `owner/repo#n` | **Yes, panel** | `issues` array; `findIssueRecord` `main.ts:1621-1625`; otherwise one `GET /repos/{repo}/issues/{n}` via `githubRequest` `1290-1415` | 1 API call per uncached resolve; a `mentions` search must answer in 2 s from memory, so it needs a cache, not a live call |

**What a `statusSection` can do without new fetching.** The panel persists the issue list under
`cached_issues_<repo>` and `cached_issues___all_projects__` (`main.ts:1689`, `1998`, `2115`,
`2128`). A status frame shares the extension's `host.storage`, so it can read that key, call
`host.onSessions`, and compute (a)–(d) with **zero** GitHub calls. It must handle "cache absent or
stale" with an empty state, and optionally refresh one page while visible (1 call per poll).

**What a `mentions` row needs.** The service cannot answer from memory because it has no issue
cache. Either the panel pushes issues to the service (new route, stale after the panel closes), or
the service fetches GitHub itself (needs a token path it does not have today: `readSettings()`
returns only `repo`; the token is in `integration.token`). Either way it is a new cache plus two
routes, and the search must be local and under 2 s.

---

## 5. Gap table vs the skill

Values: V = value for this board (0–5), C = cost (1–5, higher is more work). "Data ready" means
"available to the surface without new fetching".

| # | Point | Declared | V | Data ready | Cost (files / routes) | Main failure mode |
|---|---|---|---:|---|---|---|
| 1 | `statusSection` | no | 5 | panel yes; service no | 3–4 files (`package.json`, `status/index.html`, `status/main.ts`, build script) / 0 routes if frame reads `cached_issues_*` + `host.onSessions`; +2 files / 1 route if service-sourced | `statusSection: true` would boot the 709 KB board in a 120 px frame; must use `{ entry }`. Old hosts ignore it |
| 2 | `marks` | no | 4 | no (service has no session list) | 2–3 files (`package.json`, `service/main.ts`, maybe `panel/main.ts`) / 1 route (`/session-events`) if event-driven; +1 route if panel pushes | Marks die with the service process (needs `keepRunning`); 60 changes/min; 200 held; old hosts ignore |
| 3 | `actions` | no | 3 | yes (message text / selection) | 3 files (`package.json`, `background.html`, `background.ts` + build) / 0 routes (use `host.request`) | Silent unless `host.toast`; `mode:"background"` without `background.entry` would boot the whole panel |
| 4 | `commands` | no | 3 | yes (1 GET per resolve) | 3 files (`package.json`, background page + build) / 0–1 routes | Name collision with a built-in command is ignored; resolve deadline; needs token |
| 5 | `mentions` | no | 4 | no | 4+ files (`package.json`, `service/main.ts`, cache module, panel push) / 2 routes (`search`, `resolve`) + 1 sync route | 2 s search deadline; stale or empty menu when the panel has not run; 20 rows / 120 chars |
| 6 | `blocks` | no | 2 | partial | 3 files (`package.json`, block page + build, instructions) / 0 routes | Agent must choose it; token cost; no side effects before a click |
| 7 | `instructions` | no | 3 | static text | 2 files (`package.json`, `service/main.ts`) / 0 routes | Only set once the service runs; 4,096-char cap; costs tokens in every session |
| 8 | `skills` | no | 3 | static text | 2 files (`package.json`, `skills/<name>/SKILL.md`) / 0 routes | Description decides selection; duplicates the launch prompts in `core.ts` |
| 9 | `opencodePlugin` | no | 2 | n/a | 2–3 files (plugin folder + entry) / 0 routes | Runs with full user access; review burden |
| 10 | `providerLogos` | no | 0 | n/a | 1 file / 0 routes | Irrelevant to this board |
| 11 | `sessionControl` | no | 4 | no | 3 files (`package.json`, `service/main.ts`, dispatch logic) / 2+ routes | Spends tokens; 60 prompts/hour; needs an issue source to know what to start |
| 12 | `sessionEvents` | no | 3 | partial | 2 files (`package.json`, `service/main.ts`) / 1 route | Old hosts send nothing; needs an issue↔session map to be useful beyond session-level marks |
| 13 | `service.schedule` | no | 1 | no | 2 files / 1 route | Wakes the service to do nothing today; spends tokens if it starts sessions |
| 14 | `service.provides` | no | 1 | no | 3+ files (role block + service) / role routes | Strict role contract (tracker/notification) is a product of its own |
| 15 | `fileEditors` | no | 1 | n/a | 3 files / 0 routes | Not core; issue bodies are edited in the drawer |
| 16 | `page` | **yes** | 2 | yes | 0 | Already reuses the panel; no reduction in panel opens |
| 17 | `integration` | **yes** | 5 | yes | 0 | Token/repo already works |

### Ranking by value per cost

| Point | V | C | V/C |
|---|---:|---:|---:|
| `skills` | 3 | 1 | 3.00 |
| `statusSection` (frame + cache) | 5 | 2 | 2.50 |
| `marks` (event-driven) | 4 | 2 | 2.00 |
| `statusSection` (service-sourced) | 5 | 3 | 1.67 |
| `actions` | 3 | 2 | 1.50 |
| `commands` | 3 | 2 | 1.50 |
| `instructions` | 3 | 2 | 1.50 |
| `marks` (panel-push) | 4 | 3 | 1.33 |
| `mentions` | 4 | 4 | 1.00 |
| `sessionEvents` | 3 | 3 | 1.00 |
| `sessionControl` | 4 | 4 | 1.00 |
| `service.schedule` | 1 | 1 | 1.00 |
| `blocks` | 2 | 3 | 0.67 |
| `opencodePlugin` | 2 | 4 | 0.50 |
| `service.provides` | 1 | 3 | 0.33 |
| `fileEditors` | 1 | 3 | 0.33 |
| `providerLogos` | 0 | 1 | 0.00 |

`skills` wins the pure ratio but is not a surface: it does not make the board appear anywhere and
partly repeats the prompts already injected at launch (`core.ts:2611-2635`). It is the best cheap
follow-up, not a top-3 surface.

### Recommended top 3

1. **`statusSection` as a frame, not a source.** New `status/index.html` + `status/main.ts`
   (bundled), manifest key `statusSection: { entry: "status/index.html", title: "Task Board",
   defaultExpanded: true, requiresProject: true }`. It reads the repo from `selected_repo`
   (`main.ts:980`) or `ctx.settings.repo`, reads `cached_issues_<repo>` from `host.storage`, calls
   `host.onSessions`, and computes needs-me / running / blocked / top item with the same helpers.
   Zero new service routes, zero GitHub calls on the happy path. This is the only point that
   replaces the daily "open the panel to see what needs me".
2. **`marks`, event-driven.** `marks: true` + `sessionEvents` with `permission-asked`,
   `question-asked` and `turn-finished` + `service.keepRunning: true`. The service maps session id
   to a mark (`close-circle`/`error` or `question`/`warning`) and removes it on `turn-finished`. No
   issue data needed, no panel push, and a click opens the panel only when a mark exists. Cost: one
   `/session-events` route and an in-memory map; re-set marks at service start.
3. **`actions` on a message.** One entry, "Create task from message", `where: "message"`,
   `mode: "background"`, with a small `background.html` (not `panel/index.html`). It reads the
   message text, calls `githubRequest` through `host.request`, and toasts the created issue. This
   turns a chat into a board item without opening the panel.

Runner-up: `commands` (`/task owner/repo#n` attaches an issue chip) — same cost as `actions` and a
better fit if the workflow is "hand the agent an existing issue" rather than "capture a new one".

---

## 6. Constraints an implementation must respect

Product invariants (from `.agents/run/chamberos-board-v2/decisions.md:74` and `PLAN.md:18`):

- Zero `"n8n"` anywhere in UI copy, prompts, or code strings.
- Zero the word `"mobile"`.
- Zero emojis. Enforced for prompts and banner copy by tests (`test/ai-prompt.test.js:15`,
  `test/drafting-and-skills-audit.test.js:30`, `test/panel-service-connection.test.js:392-406`).
  Use SVG icons, not glyphs; the current panel uses `→`, `▶`, `✓`, `↺` at `main.ts:2887-2901`.
- Nothing fake or simulated: every row must come from GitHub, a session, or storage.
- English and French, with a switch (D22, `decisions.md:43`). New strings need both.
- Strict CSP: scripts only from the package; no inline scripts; `fetch` only package files;
  external data through `host.request` or declared `origins` (`API.md:705`,
  `test/d12-origins-cache.test.js:81`).
- No panel redesign. The board should appear elsewhere so the panel is opened less.

Extension contract:

- `apiVersion: 1`; `engines.openchamber: ">=1.22.0"` (`package.json:24-27`).
- Newer points (`marks`, `sessionEvents`, `statusSection`, `mentions`) are ignored by hosts older
  than their release; the deployed host is 2.7.1, but the declared floor still allows old hosts.
- Build every new page script with `bunx openchamber-guest-bundle` / the repo's esbuild scripts;
  a page loads the `.js`, not the `.ts`.
- Any panel change requires rebuilding `panel/main.js`; `test/shipped-parity.test.js:9-15` checks
  that the shipped bundle still matches `core.ts`.

Tests that will legitimately need updating (not weakening):

- `test/service-host-connection.test.js:225-256` asserts `GET /status` returns **404**. Adding a
  service route means changing this expectation and keeping the "no ownerId/activeLeases
  disclosure" assertion.
- `test/panel-service-connection.test.js:241-244` asserts exactly one service request on ready and
  that it is `/health`. A panel that pushes state to the service will change that count.
- `test/shipped-parity.test.js:91` requires every core-owned declaration to be present in
  `panel/main.js`.
- Baseline is 618/618; keep it green.

Other invariants visible in code:

- Closing an issue requires a human gesture; automatic closure is refused (`main.ts:2762-2765`).
- Answering a question must reload the issue first and refuse to overwrite a remote answer
  (`main.ts:2672-2727`).
- The panel never polls; it refreshes on demand and on session-idle (`main.ts:638-644`).

---

## 7. Notes for the implementation worker

- Do not reuse `panel/index.html` for `statusSection`, `actions`, or `commands`. It boots the
  entire board (709 KB bundle, `host.onReady` discovery, GitHub fetches).
- Do not make the service fetch GitHub. It has no token path today; the token is in
  `integration.token`, and `readSettings()` exposes only `integration.settings`. A service-side
  GitHub client would need a duplicate secret field, which the skill forbids ("Secrets go to
  `integration.token` or a `secret` field, never into a page" — and duplicating the token is worse).
- The cheapest correct data path for a status surface is the panel's existing
  `cached_issues_<repo>` storage key plus `host.onSessions` in the status frame.
- A working in-workspace precedent exists: `/workspace/code/openchamber-subagent-pulse` declares
  `statusSection.source`, `sessionEvents`, `marks`, `keepRunning`, and serves `/status` +
  `/session-events` (`service/main.ts:1031-1085`). It is a sibling extension, not part of this
  repo, and is the closest reference for the event-driven marks design.

## 8. Method

- Read `package.json`, all of `service/**`, `panel/main.ts` (full), `panel/core.ts` (structure and
  cited ranges), `panel/index.html` (structure), `panel/markdown.ts`, `panel/dropdown.ts`.
- Cross-checked every contribution point against `node_modules/@openchamber/sdk/API.md` and
  `GUEST_SERVICES.md` (SDK 2.7.1).
- Counted with `grep -c`, `wc -l`, and a Node regex scan; ran `npm test` once (618/618 pass).
- No file outside this directory was written. `git status` before the commit showed only the
  pre-existing run-state changes listed in the task brief.
