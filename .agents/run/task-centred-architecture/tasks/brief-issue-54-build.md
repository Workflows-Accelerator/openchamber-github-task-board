<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash (branch fix/issue-54-no-signin-flash, base master 8b7e059b17b7f4fad61a7466cd35cb34467807ef, clean).
Dependencies: symlink `/workspace/extensions/github-task-board/node_modules` -> `<worktree>/node_modules` and `/workspace/extensions/github-task-board/web/node_modules` -> `<worktree>/web/node_modules` before running tests.
Test commands:
- Web unit suite: `npm --prefix web test`
- Root suite: `npm test`
- Typechecks: `npx tsc --noEmit` and `npm --prefix web run typecheck` (or `npx tsc -p web/tsconfig.json --noEmit`)
- Browser/Obscura harness: Chromium headless fails in this container (`libglib-2.0.so.0` missing); use Obscura (`obscura-bin` / CDP) as in `.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/harnesses/run-exploration.mjs` and `web/tests/login-label-browser-verify.mjs`.
Do not touch: `panel/**`, `service/**`, `/workspace/releases/board/**`, live processes, port 3000, `/workspace/.openchamber-data/**`, `.env*`, credentials, `/proc/*/environ`, or live GitHub issues/labels. Never run `git remote -v`. No git push. Zero emojis in code, comments, tests, or proof.
</env_preflight>
<goal>
Implement Issue #54 per aligned decision D62: when opening or reloading the online board while already signed in, never flash `#login-view`; open straight into the board shell (`#board-view`) and keep `#board-view` visible while `/api/session`, `/api/repos`, and `/api/combined/board` resolve, showing `#login-view` only when actually signed out (`authenticated: false` / 401) or after Sign out.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/findings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
web/public/index.html
web/public/app.js
web/public/theme.css
web/tests/simple-views-client.test.mjs
web/tests/app.test.mjs
web/tests/login-label.test.mjs
web/tests/login-label-browser-verify.mjs
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/implementation/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/implementation/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
1. Write failing (red) unit tests first in a new `web/tests/issue-54-no-signin-flash.test.mjs` (included in `web/package.json` test run or standard test glob) covering:
   a. Static `web/public/index.html` markup: `#login-view` has the `hidden` attribute by default, and `#board-view` does NOT have `hidden` by default (opens straight to board shell).
   b. In `boot()` when `GET /api/session` is pending or resolves `{ authenticated: true, csrfToken: '...' }` while `GET /api/repos` and `GET /api/combined/board` are still pending (unresolved promises), `#login-view.hidden` remains `true` at all times and `#board-view.hidden` is `false` immediately upon `/api/session` resolution (before `/api/repos` or `/api/combined/board` finish).
   c. Non-secret client auth hint (`localStorage` key `tb_auth_hint = '1'`): set when `/api/session` (GET or POST) confirms `authenticated: true`; cleared when `showLogin()` runs, when `GET /api/session` returns `{ authenticated: false }` or 401, or when `DELETE /api/session` (sign out) runs.
   d. When `tb_auth_hint === '1'` and cached board data exists in `localStorage`, `boot()` renders the cached board shell/tasks immediately before network calls finish so a returning signed-in user sees their board right away while fresh data loads.
   e. When `GET /api/session` returns `{ authenticated: false }` (unauthenticated user), `boot()` immediately reveals `#login-view` (`hidden = false`), hides `#board-view` (`hidden = true`), and clears `tb_auth_hint`.
   f. When `GET /api/session` fails with a network error and no cached board state exists, `showLogin('The board could not be reached. Reload to try again.')` reveals `#login-view` with the error message; if cached board state exists, offline board view remains visible.
2. Implement the minimal fix in `web/public/index.html` and `web/public/app.js` (and `web/public/theme.css` only if needed for a quiet loading state) to make all new and existing tests pass.
   - Check if `web/public/sw.js` cache version / asset handling needs anything (note D47 network-first for navigation/assets).
   - Ensure all existing tests in `web/tests/**` and root `test/**` pass without weakening assertions.
3. Run an Obscura browser verification script (save under `.agents/run/issue-54-build/harnesses/verify-no-flash.mjs`) against a local loopback server with an isolated temp session store:
   - Sign in once, then reload the page while recording DOM mutations on `#login-view` and `#board-view` (with an artificial 300ms delay on `/api/combined/board` to simulate WAN).
   - Prove empirically that across the entire reload lifecycle (`navigationStart` -> `DOMContentLoaded` -> `/api/session` -> `/api/repos` -> `/api/combined/board`), `#login-view.hidden` is ALWAYS `true` (0ms flash) and `#board-view.hidden` is `false` throughout.
   - Also verify unauthenticated visit and Sign out both show `#login-view` cleanly. Capture screenshots under `.agents/run/issue-54-build/screenshots/`.
4. Write `<worktree>/.agents/run/issue-54-build/verifications/proof.md` and commit all changes on `fix/issue-54-no-signin-flash`.
</scope>
<output>
Return <=12 lines: files changed; red-green test summary; full web + root test counts + typecheck results; Obscura reload timeline proof (loginHidden at every checkpoint); commit hash; actual provider/model.
</output>
