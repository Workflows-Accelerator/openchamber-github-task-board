# Preflight Risk Investigation Report: ChamberOS Board V2

- Date: 2026-11-04
- Mission: chamberos-board-v2
- Author: System Subagent (engineer)
- Status: COMPLETE
- Target Output: .agents/run/chamberos-board-v2/explore/preflight.md

---

## Q1: GitHub Native Issue Dependencies ("Blocked By")

### Answer
YES: GitHub provides native REST and GraphQL endpoints for issue dependencies, and the ambient token has full ADMIN permissions and necessary scopes to read and write them.

### Evidence
1. Token Identity and Scopes:
   - Command: `gh auth status`
   - Verified active token account: `workflows-accelerator-agent` (GITHUB_TOKEN, classic PAT `ghp_...`, length 40).
   - Scopes present: `repo`, `admin:org`, `write:discussion`, `workflow`, `project`, `audit_log`, `admin:repo_hook`, `user`.
2. Repository Permission:
   - Command: `gh repo view Workflows-Accelerator/openchamber-github-task-board --json viewerPermission`
   - Result: `viewerPermission: ADMIN`.
3. Dependency Graph Endpoint Verification:
   - Command: `gh issue view 57 --repo Workflows-Accelerator/openchamber-github-task-board --json blockedBy,blocking`
   - Result: `{"blockedBy":{"nodes":[],"totalCount":0},"blocking":{"nodes":[],"totalCount":0}}`.
   - Confirms the GraphQL `blockedBy` and `blocking` schema fields are active on the repository.
4. Board Server Token Resolution:
   - Inspected file: `/workspace/.openchamber-data/board/board.env`. `BOARD_GITHUB_TOKEN` is not defined in `board.env`.
   - Inspected file: `/workspace/config/opencode/tools/board/start.sh` (line 36):
     `export BOARD_GITHUB_TOKEN="${BOARD_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"`
   - Verified in Node process: `BOARD_GITHUB_TOKEN` defaults to container environment `GITHUB_TOKEN`.
   - The board server runs with the identical classic PAT holding full `repo` (admin) permissions.
5. Endpoints and Schemas:
   - REST API:
     - List blocked-by dependencies: `GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`
     - List blocking dependencies: `GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking`
     - Add dependency: `POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`
       Request body: `{"issue_id": <int>}` (or `{"owner": "<owner>", "repo": "<repo>", "issue_number": <int>}`)
     - Delete dependency: `DELETE /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by/{issue_id}`
   - GraphQL API:
     - Query: `repository(owner: $owner, name: $name) { issue(number: $number) { id blockedBy(first: 100) { nodes { id number title repository { nameWithOwner } } } } }`
     - Add mutation: `addBlockedBy(input: { issueId: ID!, blockingIssueId: ID! }) { issue { id } }`
     - Remove mutation: `removeBlockedBy(input: { issueId: ID!, blockingIssueId: ID! }) { issue { id } }`
6. Current Code Gap:
   - File: `web/server/board.ts` (lines 172-182). Dependencies are currently parsed solely via regex over issue body text (`scanBodyLines` matching `Blocked by #N`). Native GitHub dependencies API is not yet invoked.

### What the Builder Must Do
- Step A3:
  1. Extend `GitHubClient` in `web/server/github.ts` to implement native dependency methods (`getIssueDependencies`, `addIssueDependency`, `removeIssueDependency`).
  2. Add board server endpoints in `web/server/app.ts` (`GET/POST/DELETE /api/repos/:owner/:repo/issues/:number/dependencies`).
  3. Update `buildBoardListItem()` in `web/server/board.ts` to return native GitHub dependencies alongside or in place of markdown regex matches.

---

## Q2: Repository Contents Write and GitHub Discussions

### Answer
PARTIAL: The ambient token has write/push permissions across all 26 board repositories, but 0 of 26 repositories currently have GitHub Discussions enabled.

### Evidence
1. Repository Permissions Audit:
   - Command: `python3` scanning `gh repo list Workflows-Accelerator` and `gh repo list` (26 unique repositories total).
   - Results: All 26 repositories report `viewerPermission` as `ADMIN` (10 repos) or `WRITE` (16 repos).
   - Zero repositories lack write permission (`Repos without push/write: 0`).
   - Token scope `repo` grants full contents write, branch creation, and commit push permissions across every discovered repository.
2. Discussions Status Audit:
   - Command: Evaluated `hasDiscussionsEnabled` field across all 26 repositories.
   - Results: Exactly 0 out of 26 repositories have Discussions enabled (`hasDiscussionsEnabled: false` across all 26).
   - Specifically, `Workflows-Accelerator/openchamber-github-task-board` has `hasDiscussionsEnabled: false`.
3. GraphQL Queries and Mutations for Discussions:
   - List discussions:
     ```graphql
     query ListDiscussions($owner: String!, $name: String!, $first: Int = 20, $after: String) {
       repository(owner: $owner, name: $name) {
         discussions(first: $first, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
           totalCount
           pageInfo { hasNextPage endCursor }
           nodes {
             id
             number
             title
             createdAt
             author { login avatarUrl }
             category { id name }
             comments { totalCount }
           }
         }
       }
     }
     ```
   - Read discussion:
     ```graphql
     query GetDiscussion($owner: String!, $name: String!, $number: Int!) {
       repository(owner: $owner, name: $name) {
         discussion(number: $number) {
           id
           number
           title
           body
           createdAt
           author { login avatarUrl }
           category { id name }
           comments(first: 50) {
             nodes {
               id
               body
               createdAt
               author { login avatarUrl }
             }
           }
         }
       }
     }
     ```
   - Create discussion:
     ```graphql
     mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
       createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
         discussion { id number url title }
       }
     }
     ```
   - Reply to discussion:
     ```graphql
     mutation AddDiscussionComment($discussionId: ID!, $body: String!) {
       addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
         comment { id url body createdAt }
       }
     }
     ```

### What the Builder Must Do
- Step B3:
  1. Implement GraphQL discussion queries and mutations in `web/server/github.ts`.
  2. Implement a fallback/prompt state in the UI drawer: if `hasDiscussionsEnabled` is false or query fails, show "Discussions are not enabled on this repository" with guidance to enable them in GitHub repository features settings.
- Step C2:
  1. Write permission is confirmed for all repos. Proceed with creating and pushing uploads to the orphan/isolated `board-assets` branch as specified in D20.

---

## Q3: OpenChamber Session Dispatch and Worktree Registration

### Answer
YES: OpenChamber runs on the same container loopback (127.0.0.1:3000) and exposes session dispatch via HTTP and local CLI, while worktrees are registered in SQLite at /workspace/.local/share/opencode/opencode.db.

### Evidence
1. Collocation and Health Probes:
   - Port check: Socket connections to `127.0.0.1:3000` (OpenChamber) and `127.0.0.1:8787` (Board) both succeed (OPEN).
   - HTTP probe: `GET http://127.0.0.1:3000/health` returns HTTP 200 with JSON payload `{"status":"ok","openchamberVersion":"2.6.0","runtime":"web"}`.
   - HTTP probe: `GET http://127.0.0.1:8787/health` returns HTTP 200 with JSON payload `{"status":"ok","version":"1.2.1"}`.
   - The board process and OpenChamber web server are co-located in the same container network namespace.
2. Session Dispatch Routes:
   - Inspected: `/usr/local/lib/node_modules/@openchamber/web/bin/lib/commands-session.js` (lines 125-155).
   - Inspected: `/workspace/code/openchamber-config/plugins/openchamber-bridge/index.ts` (lines 710-725, 1508-1535).
   - Dispatch HTTP Route: `POST /api/openchamber/control`
   - Payload:
     ```json
     {
       "action": "session.create",
       "input": {
         "directory": "/workspace/code/<repo-directory>",
         "prompt": "<prompt-text>",
         "model": "provider/model",
         "agent": "<agent-name>",
         "variant": "<variant>"
       }
     }
     ```
   - Authentication: Requires `oc_ui_session` cookie acquired from `POST /auth/session` with `{"password": "<OPENCHAMBER_UI_PASSWORD>"}`, or authorization bearer token if `OPENCHAMBER_AGENT_TOOL_TOKEN` is configured.
3. Alternative CLI Dispatch:
   - Binary: `/usr/local/bin/openchamber` (symlink to `@openchamber/web/bin/cli.js`).
   - Command: `openchamber session create --dir <path> --prompt <text> [--model <model>] [--agent <agent>]`.
   - Verified: Running `openchamber session list --limit 5` successfully returns active sessions.
4. Worktree Registration in OpenChamber DB:
   - Database path: `/workspace/.local/share/opencode/opencode.db`.
   - Reference: `/workspace/code/openchamber-config/.agents/skills/ship/worktree/management/SKILL.md`.
   - Registration query: `INSERT OR IGNORE INTO project_directory (id, path) VALUES (?, ?);`
   - In addition, calling `openchamber session create --dir <worktree_path>` automatically registers and associates the target directory in the database.

### What the Builder Must Do
- Step C3:
  1. Add environment configurations `OPENCHAMBER_BASE_URL` (default `http://127.0.0.1:3000`) and `OPENCHAMBER_UI_PASSWORD` to `web/server/config.ts`.
  2. Implement server route `POST /api/repos/:owner/:repo/run` to call `POST /api/openchamber/control` (or spawn `openchamber session create`).
- Batch D:
  1. For worktree creation and cleanup, execute git worktree commands and register/deregister entries in `/workspace/.local/share/opencode/opencode.db`.

---

## Q4: Publishing, Release Supervisor, and Environment Configuration

### Answer
YES: Releases are built as self-contained bundles under /workspace/releases/board/<sha>-<date>, verified via strict checksums.sha256, switched via atomic symlink, and supervised with automatic process restarts.

### Evidence
1. Supervisor Architecture:
   - Scripts: `/workspace/config/opencode/tools/board/supervisor.sh` and `start.sh`.
   - Docs: `/workspace/code/openchamber-config/docs/BOARD_SUPERVISOR.md`.
   - Baseline receipt: `outputs/repairs-49-50-51-release-receipt.md`.
   - Active release: `/workspace/releases/board/current` -> `/workspace/releases/board/8b7e059-20261102`.
   - State directory: `/tmp/opencode/board-supervisor/` holding `supervisor.pid`, `child.pid`, `supervisor.lock`, `board.log`.
2. Required Release Files and Strict Checksum Manifest:
   - Every release directory must contain:
     - `package.json`
     - `web/dist/server.mjs`
     - `web/public/`
     - `checksums.sha256`
   - Strict Manifest Verification (`supervisor.sh` lines 105-121):
     `supervisor.sh` executes `sha256sum -c --strict checksums.sha256` and uses `comm -13` to verify that every single regular file and symlink in the release directory is explicitly listed in `checksums.sha256`. Any unlisted file causes supervisor failure.
3. Live Routing and Proxy Ingress:
   - Live URL: `https://board.workflows.ac`.
   - Ingress: External Traefik reverse proxy terminates TLS and routes traffic to container port 8787 (`127.0.0.1:8787`).
4. Environment Variables and Provenance:
   - Persistent env file: `/workspace/.openchamber-data/board/board.env`.
   - Variables loaded by `start.sh`:
     `BOARD_ENABLED`, `BOARD_GITHUB_LOGIN`, `BOARD_REPO`, `BOARD_PASSWORD_HASH`, `BOARD_HOST`, `BOARD_PORT`, `BOARD_BASE_URL`, `BOARD_START_CMD`, `BOARD_HEALTH_URL`, `BOARD_MAX_RESTARTS`, `BOARD_BACKOFF_INITIAL`, `BOARD_BACKOFF_MAX`, `BOARD_BACKOFF_MULTIPLIER`, `BOARD_BACKOFF_JITTER`, `BOARD_SUSTAINED_HEALTH_SECS`, `BOARD_LOG_MAX_BYTES`, `BOARD_SUPERVISOR_LOG_MAX_BYTES`, `BOARD_HEALTH_INTERVAL`.
   - Fallback variables from environment:
     `BOARD_GITHUB_TOKEN` defaults to `${GITHUB_TOKEN}`.
5. Atomic Switch and Rollback Procedure:
   - Build new release:
     - Directory: `RELEASE_DIR=/workspace/releases/board/<sha>-$(date +%Y%m%d)`.
     - Bundle server: `npm run build:service` into `$RELEASE_DIR/web/dist/server.mjs`.
     - Copy static assets: `cp -r web/public $RELEASE_DIR/web/` and `cp package.json $RELEASE_DIR/`.
     - Generate manifest: `(cd "$RELEASE_DIR" && find . -type f ! -name "checksums.sha256" | sed 's|^\./||' | LC_ALL=C sort | xargs sha256sum > checksums.sha256)`.
   - Switch release:
     `ln -sfn "$RELEASE_DIR" /workspace/releases/board/current.tmp && mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current`
   - Trigger supervisor reload:
     `kill -TERM $(cat /tmp/opencode/board-supervisor/child.pid)` (supervisor restarts child with new release).
   - Rollback release:
     Repoint symlink to `/workspace/releases/board/8b7e059-20261102` (or earlier known-good release) and send `kill -TERM` to child PID.
6. Adding Live Settings (`BOARD_D1_*` and OpenChamber):
   - Add keys to `web/server/config.ts`: `BOARD_D1_MODEL`, `BOARD_D1_BASE_URL`, `BOARD_D1_API_KEY`, `OPENCHAMBER_BASE_URL`, `OPENCHAMBER_UI_PASSWORD`.
   - Add values into `/workspace/.openchamber-data/board/board.env`.
   - Reload child process via `kill -TERM`.

### What the Builder Must Do
- Step C1: Update `web/server/config.ts` to accept `BOARD_D1_*` variables.
- Step C4: Execute release packaging, checksum generation, atomic symlink switch, and child PID restart following the verified procedure above.
