<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7-overhaul
Branch: feat/wave7-overhaul
Base: feat/board-v3 (5edb450)
Test commands:
- node --test --test-timeout=60000 web/tests/layout.test.mjs web/tests/session-activity.test.mjs web/tests/arrange-flow.test.mjs web/tests/wave7a-server-wiring.test.mjs
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm test
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
- npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave7a-server.mjs
Forbidden:
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER edit `web/public/app.js` or `web/public/theme.css` or `web/public/index.html` (those belong to Wave 7b/7c after this server wave lands!).
- NEVER push, deploy, delete files outside task scope, or spawn subagents.
</env_preflight>

<goal>
Integrate the three L4-approved Wave 7a modules (`feat/wave7a-server-layout`, `feat/wave7a-session-activity`, `feat/wave7a-flow-layout`) onto `feat/wave7-overhaul` and wire the Wave 7a server foundations: Option A GitHub caches (per-page ETags, detail ETag, dep GraphQL TTL), native GitHub `parent` sub-issue read, `/api/layout` routes (`CanvasLayoutStore`), `order: null` clear-order support, and `SessionActivityTracker` enrichment in board payloads.
</goal>

<context>
Read first:
1. `web/server/config.ts`, `web/server/github.ts`, `web/server/board.ts`, `web/server/app.ts`, `web/tests/fake-github.mjs`.
2. Notice we are on `feat/wave7-overhaul` at `5edb450`. Three approved Wave 7a branches exist in git:
   - `feat/wave7a-server-layout` (`c49d9b9` — `web/server/layout.ts`, `web/tests/layout.test.mjs`)
   - `feat/wave7a-session-activity` (`e26c84a` — `web/server/session-activity.ts`, `web/tests/session-activity.test.mjs`)
   - `feat/wave7a-flow-layout` (`030494c` — `web/public/flow-layout.js`, `web/tests/arrange-flow.test.mjs`)
</context>

<requirements>
1. **Step 1 — Merge the 3 approved Wave 7a branches cleanly**:
   - Run `git merge --no-edit feat/wave7a-server-layout feat/wave7a-session-activity feat/wave7a-flow-layout` (or sequential `git merge --no-edit` for each). Verify `layout.test.mjs`, `session-activity.test.mjs`, `arrange-flow.test.mjs`, and `tsc` pass before proceeding.

2. **Option A lightweight GitHub caches (`web/server/github.ts`, `web/server/app.ts`)**:
   - **Per-page `If-None-Match` ETags for multi-page `listIssues`**:
     - Support `pageCache?: { etags: string[]; pages: any[][] }` (or internal per-repo page ETag cache in `GitHubClient` / `app.ts`) so a 3-page 232-issue repo sends `If-None-Match` on *each* page (page 1, page 2, page 3).
     - When all cached pages return `304 Not Modified`, return `notModified: true` (0 points / fast path). When only 1 page changed, reuse `304` pages' cached items and refresh only the modified page!
     - Keep full backwards compatibility with `ifNoneMatch?: string` callers/tests.
   - **Issue detail ETag (`getIssue`)**:
     - Extend `getIssue(number, options?: { ifNoneMatch?: string })` to send `If-None-Match` and return `{ item: any | null, etag: string | null, notModified: boolean }`.
     - In `app.ts`, store `{ etag, fetchedAt, data }` for issue detail reads so repeat `GET /api/.../issues/:n` (when not invalidated by a mutation or `?refresh=1`) revalidates via `If-None-Match` and serves cached data on `304`.
   - **Dependency GraphQL TTL cache (60s) + invalidation**:
     - Cache `getIssueDependencies(number)` results per `(repo, number)` with a 60s TTL (unless `?refresh=1` / `forceRefresh`), and invalidate affected issue caches immediately after dependency link/unlink or issue edit/comment/note mutations.

3. **Native GitHub `parent` sub-issue read (`web/server/github.ts`, `web/server/board.ts`, `web/server/app.ts`)**:
   - Extend `getIssueDependencies` GraphQL query to also request `parent { number title repository { nameWithOwner } }` alongside `blockedBy` and `blocking`.
   - **Resilience**: if GitHub GraphQL or a fake server rejects the `parent` field (GraphQL field error), automatically fall back to the `blockedBy`/`blocking` query without `parent` and cache the capability per client so older schemas/mocks never break!
   - Support `parent` in `web/tests/fake-github.mjs` so tests can verify parent grouping end-to-end.
   - Add `parentKey: string | null` (`owner/repo#number`) and `parentTitle: string | null` to `IssueSummary` / `board.issues[]` (extracting from `raw.parent` on REST if present, or GraphQL `parent` when fetched). Keep `parentKey: null, parentTitle: null` when unparented.

4. **Server-only `CanvasLayoutStore` wiring (`web/server/config.ts`, `web/server/app.ts`)**:
   - Add `layoutFilePath: string` to `BoardConfig` (override via `BOARD_LAYOUT_FILE`, defaulting to `path.join(path.dirname(sessionFilePath), 'canvas-layout.json')`).
   - Instantiate `CanvasLayoutStore({ filePath: config.layoutFilePath })` in `app.ts`.
   - Expose authenticated endpoints:
     - `GET /api/layout?scope=<scope>` (default `'all'`; also validate scope string cleanly) -> `200` `CanvasScopeLayout`.
     - `PATCH /api/layout` (CSRF-protected, JSON body cap) accepting `{ scope?, direction?, expandedGroups?, setPositions?, resetPositions? }` -> `200` updated `CanvasScopeLayout`; map `LayoutValidationError` to HTTP `400` `{ error: 'invalid_layout', message }`.
   - Also attach `layout: CanvasScopeLayout` (read from `layoutStore.getScope(...)`) to `GET /api/board`, `GET /api/repos/:owner/:name/board`, and `GET /api/combined/board` payloads (strip volatile fields? No, include `layout` in ETag computation or exclude only `rateLimit`/`fetchedAt` — `layout` changes SHOULD update the ETag so reloads don't get stale 304!).

5. **Manual order reset (`order: null`) (`web/server/app.ts`, `web/server/board.ts`)**:
   - In `PATCH /api/issues/:number` and `PATCH /api/repos/:owner/:name/issues/:number`: when `body.order === null`, call `stripOrderMarker(currentBody)` to remove `<!-- board-order: N -->` cleanly and return `order: null` on the updated issue! Reject non-null non-finite `order` with `400` as before.

6. **`SessionActivityTracker` wiring (`web/server/config.ts`, `web/server/app.ts`)**:
   - Add optional `openchamberUrl?: string` (`BOARD_OPENCHAMBER_URL`) and `triggersUrl?: string` (`BOARD_TRIGGERS_URL`) to `BoardConfig` and `BoardServerOptions` (plus optional `sessionActivityTracker` injection for tests).
   - Fetch `sessionTracker.getSnapshot({ forceRefresh })` during board loads (fail-safe, capped timeout, never blocks or fails `/api/board`).
   - Match each issue's normalized `owner/repo#number` against `snapshot.activeByIssue` and set `activeSession: ActiveIssueSession | null` on each `IssueSummary`, plus `sessionActivity: { available: boolean, degraded: boolean }` on the board response. Exclude volatile `sessionActivity.fetchedAt` from weak ETag or keep `activeSession` in ETag so status flips update cleanly.

7. **Failing tests first (`web/tests/wave7a-server-wiring.test.mjs`)**:
   - Write failing tests FIRST covering: multi-page per-page `304` ETags, `getIssue` `If-None-Match` `304` cache hit, 60s dep GraphQL TTL + mutation invalidation, GraphQL `parent` extraction + fallback when `parent` field unsupported, `GET/PATCH /api/layout` persistence + 400 validation + CSRF check + board payload `layout`, `PATCH` `order: null` clearing `<!-- board-order: N -->`, and `activeSession` attached on running issue vs `null` on idle `in-progress` issue.
</requirements>

<steps>
1. Merge `feat/wave7a-server-layout`, `feat/wave7a-session-activity`, and `feat/wave7a-flow-layout` into `feat/wave7-overhaul`.
2. Write failing tests in `web/tests/wave7a-server-wiring.test.mjs` and confirm they fail before production edits.
3. Implement changes in `web/server/config.ts`, `web/server/github.ts`, `web/server/board.ts`, `web/server/app.ts`, and `web/tests/fake-github.mjs`.
4. Run all verification checks (`wave7a-server-wiring.test.mjs`, `web/tests/*.test.mjs`, `npm test`, `npm run typecheck`, `tsc -p web/tsconfig.json --noEmit`, `esbuild`).
5. Commit cleanly (e.g. merge commit(s) + `feat(board): wire Wave 7a server caches, parent issues, layout API and session activity` + tests).
</steps>

<output>
At most 12 lines: STATUS, MERGED_COMMITS, NEW_COMMIT, TEST_COUNTS (focused, web, npm, typecheck, esbuild exit codes), IMPLEMENTED_ITEMS, NOT_VERIFIED.
</output>
