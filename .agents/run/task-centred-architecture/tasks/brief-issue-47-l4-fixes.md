<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin
Branch: fix/issue-47-fresh-app-stay-signed-in @ af9b39c (clean)
Files in scope: web/server/auth.ts, web/tests/auth.test.mjs (and helpers if needed). Touch web/server/app.ts or web/server/config.ts ONLY if a one-line wiring change is unavoidable, and report it - another worker is editing app.ts on a branch built from af9b39c.
Do not touch: web/public/**, panel/**, /workspace/.openchamber-data/**, /workspace/releases/**, the live server.
Tests: npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test web/tests/*.test.mjs ; node --test --test-concurrency=1 test/*.test.js
Git: commit locally. Do not push, merge or deploy.
</env_preflight>

<goal>
Close two low findings from the hostile review of #47 (/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/verifications/issue-47-l4.md):
B. sessions.json stores the CSRF token in plaintext (auth.ts ~165). Persist nothing that is usable on its own: store a hash or derive the CSRF token from the session secret + server secret so it never needs persisting. Existing request validation must keep working.
C. Changing the board password keeps sessions valid up to 30 days (auth.ts ~220). Bind each session to a fingerprint of the current password (for example HMAC of the password with the server secret; never store the password or a plain hash of it); on load and on validate, reject sessions whose fingerprint does not match.
Sessions written by af9b39c (old format) may be dropped on upgrade - users sign in once more. Say so in the report.
</goal>

<criteria>
- Tests: no CSRF token or password-derived value usable to authenticate in the file; CSRF check still passes for valid sessions and fails otherwise; password change invalidates old sessions after restart; old-format file tolerated.
- All suites pass, both typechecks exit 0.
</criteria>

<output>
STATUS, files changed, commit SHA, test counts, exit codes, and a hostile self-check of the change. Anything not verified.
</output>
