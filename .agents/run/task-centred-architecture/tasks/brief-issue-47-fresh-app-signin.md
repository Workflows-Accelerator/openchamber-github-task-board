<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin
Branch: fix/issue-47-fresh-app-stay-signed-in (from master @ cc08379, clean)
Issue: #47 https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/47
Files in scope: web/public/sw.js, web/public/app.js (only service-worker registration/update + login form wiring), web/public/index.html (login form only), web/server/auth.ts, web/server/app.ts (session/login/static headers only), web/server/config.ts, web/tests/**, test/**
Do not touch: panel/**, web/public views/board rendering (another worker will rewrite them next), /workspace/.openchamber-data/board/board.env, /workspace/config/**, Traefik, Docker, the live release directory, the running server.
Tests: npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test web/tests/*.test.mjs ; node --test --test-concurrency=1 test/*.test.js
Setup: ln -s /workspace/extensions/github-task-board/node_modules node_modules
Git: commit locally on your branch. Do not push, do not merge, do not deploy.
</env_preflight>

<goal>
The installed board app and browser always show the newest release, a device stays signed in for 30 days across server restarts, and the saved password is offered on desktop Chrome and phones.
</goal>

<context>
Verified by the manager:
- Live server already serves the new build, but users still see the old UI. Cause: web/public/sw.js uses a fixed CACHE_NAME 'workflows-board-v1' and cache-first for '/', '/app.js', '/theme.css'. The cached shell is never refreshed.
- Sessions are an in-memory Map in web/server/auth.ts (DEFAULT_IDLE_TTL_MS 2h, DEFAULT_ABSOLUTE_TTL_MS 12h). Every server restart (each deploy) signs everyone out.
- The login form (web/public/index.html line ~31) has only a password field, so Chrome desktop does not offer the saved credential.
Decisions: /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md (D47-D49).
</context>

<scope>
1. Fresh app after deploys
- App shell (navigation requests, app.js, theme.css, manifest) is network-first with cache fallback only when offline. Icons may stay cache-first.
- Cache name carries a version that changes every release (derive from package version + a build stamp, or have the server inject it); activate deletes all other caches; skipWaiting + clients.claim stay.
- Client registers with updateViaCache: 'none' and calls registration.update() on load and when the page becomes visible; when a new worker takes control, reload once (guard against loops) or show a small "Updated - reload" notice.
- Server sends Cache-Control: no-cache (or no-store) for /sw.js. Keep existing headers otherwise.
- Users who already have the old v1 worker must recover without uninstalling: the browser re-fetches /sw.js on navigation, so the new worker must install, delete 'workflows-board-v1', and take control. Prove this with a test that simulates the old cache present.
2. Stay signed in 30 days, surviving restarts
- Absolute lifetime 30 days, idle lifetime 30 days (sliding). Cookie Max-Age matches. Keep HttpOnly, Secure, SameSite as today.
- Persist sessions to a file so restarts keep them. Store only a SHA-256 hash of the session secret (never the raw cookie value), plus expiry/lastSeen and whatever CSRF binding exists today. File mode 0600, atomic write (temp file + rename), corrupt or missing file = start empty without crashing. Throttle lastSeen writes (for example at most once per minute per session).
- Location: read web/server/config.ts. Use an optional config/env value for the path; default must work on the live deployment WITHOUT editing board.env (for example next to the existing data/env directory the server already knows, or a data dir under the user's home). Report the exact default path.
- Sign out and rate limiting keep working; sign out deletes the record immediately and persists it.
3. Saved password offered
- Login form gets a username field Chrome recognises (autocomplete="username"; may be visually hidden or read-only with a fixed value such as "board") before the password field (autocomplete="current-password"), form has method="post" semantics without causing a real navigation, and the submit flow is unchanged otherwise.
</scope>

<criteria>
- Tests prove: versioned cache name, old caches deleted on activate, shell requests are network-first, /sw.js served no-cache, sessions survive constructing a new SessionStore from the same file, file contains no raw session secret, expired sessions are rejected and pruned, sign-out removes the record, corrupt file tolerated, 30-day cookie Max-Age, login form has username + current-password fields.
- All existing tests pass; both typechecks exit 0.
- No secret values in logs, argv, URLs, page-readable storage or commits.
</criteria>

<output>
STATUS, files changed, commit SHA, test counts per suite, typecheck exit codes, the default session file path, how the version stamp is produced, and a hostile self-review: what could still leave a user on a stale build, and what could leak or lose sessions. List anything not verified.
</output>
