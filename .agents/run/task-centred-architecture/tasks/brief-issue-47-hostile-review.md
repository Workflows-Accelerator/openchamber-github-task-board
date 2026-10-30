<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin
Branch: fix/issue-47-fresh-app-stay-signed-in
Base: cc08379  Candidate: af9b39c1753db0ca3f6a4314f1942bf66accb62f
Issue: #47 (the board app always shows the newest version and keeps you signed in)
Mode: hostile review. Read-only for application code. Do not push, merge, deploy, or touch the live server, /workspace/.openchamber-data/**, or /workspace/releases/**.
Commands: npm run typecheck ; npx tsc -p web/tsconfig.json ; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/issue47-server.mjs ; node --test web/tests/*.test.mjs ; node --test --test-concurrency=1 test/*.test.js
</env_preflight>

<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>

<goal>
Conduct a hostile review of the changes in cc08379..af9b39c to find what was missed or is broken. Do not assume the builder was right. Original brief: /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-47-fresh-app-signin.md
</goal>

<audit>
1. Stale build recovery: a user with the OLD worker (fixed cache 'workflows-board-v1', cache-first for '/', '/app.js') opens the board. Walk the real sequence: does the browser fetch the new /sw.js (no-cache header, byte change), install, purge the old cache and serve the new shell on the next load without uninstalling? Does the injected CACHE_VERSION really change when only app.js changes? Is the stamp stable across restarts of the same release (no needless reload)? Can the controllerchange reload loop on any path (first install, sessionStorage blocked, two tabs)?
2. Network-first shell: offline fallback still works; API and non-GET still bypass cache; no caching of authenticated API responses or of error pages (a 502 during deploy must not be cached as the shell).
3. Sessions file: run the server bundle locally on a free port with a temp BOARD_SESSION_FILE, log in, restart, confirm still signed in; inspect the file - no raw cookie value, no raw CSRF token or any other secret usable to act as the user; mode 0600; concurrent writes and crash mid-write; unbounded growth; behaviour when the directory does not exist or is not writable (the live default is /workspace/.openchamber-data/board/sessions.json - must not crash the live server at start).
4. Sign out revokes immediately and survives restart (no resurrection from file). Rate limiter unaffected. Password change: do old sessions stay valid for 30 days? Report it.
5. Login form: method="post" action="/api/session" - if JS fails or a user presses Enter before JS binds, what does the native form post do (form-encoded body, password in a URL? server reply)? Hidden username field: does it break screen readers or the existing submit handler?
6. No secrets in logs, argv, URLs, page-readable storage, commits.
</audit>

<output>
At most 15 lines. Verdicts: Spec Compliance PASS/FAIL, Quality APPROVED/NEEDS-FIXES. Findings with severity and file:line. Commands run with exit codes and test counts. What you could not verify.
</output>
