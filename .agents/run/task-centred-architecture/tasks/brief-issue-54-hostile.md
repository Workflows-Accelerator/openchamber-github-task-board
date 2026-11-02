<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash (branch fix/issue-54-no-signin-flash @ b14a787214bf436d389223bba86f9363a6bc5681, base master 8b7e059).
Do not touch: `panel/**`, `service/**`, `/workspace/releases/board/**`, live processes, port 3000, `/workspace/.openchamber-data/**`, `.env*`, credentials, `/proc/*/environ`, or live GitHub. Never run `git remote -v`. No git push. Zero emojis.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that were made in commit `b14a787214bf436d389223bba86f9363a6bc5681` to figure out what might have been missed or what might be broken. Don't assume that what was done is right.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-54-build.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash/.agents/run/issue-54-build/verifications/proof.md]
web/public/index.html
web/public/app.js
web/public/sw.js
web/tests/issue-54-no-signin-flash.test.mjs
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
1. Attack `git diff 8b7e059..b14a787` across security, edge cases, race conditions, and user experience:
   - What happens when an unauthenticated user (first visit, no `tb_auth_hint`, no `tb_cached_board`) loads the page? Since `#board-view` is unhidden in static HTML, does the unauthenticated user see an empty `#board-view` with active-looking "Sign out" / "Refresh" buttons before `/api/session` returns, or if JavaScript is slow/disabled? Can we avoid showing signed-in controls to an unauthenticated first-time visitor when `tb_auth_hint` is absent, or hide interactive board chrome until `tb_auth_hint === '1'` or `/api/session` confirms auth, while still never flashing `#login-view`?
   - What happens if `tb_auth_hint === '1'` and `tb_cached_board` is present, and the user's session was revoked (password rotated or expired), so `GET /api/session` returns `{ authenticated: false }`? Does `showLogin()` completely clear the DOM (`#task-list`, `#detail-view`, etc.) as well as `localStorage` (`tb_auth_hint`, `tb_cached_board`, any other cached board keys) so cached task titles do not remain in the hidden DOM or `localStorage` on a shared browser?
   - What if `localStorage` throws `QuotaExceededError` or `SecurityError` (private browsing / storage disabled) or contains corrupted JSON in `tb_cached_board`?
   - What if the user clicks a task or triggers a write while the cached board is shown before `GET /api/session` (and `state.csrfToken`) or fresh `loadBoard()` has resolved? Could a stale cached board overwrite a newer fresh board response, or fire an unauthenticated/CSRF-missing mutation?
   - Does `web/public/sw.js` cache version need bumping or is network-first already guaranteed?
   - Do the unit tests in `web/tests/issue-54-no-signin-flash.test.mjs` test the real `web/public/app.js` and fail if the production logic is mutated?
2. For every real defect or edge case found: write a failing regression test first, fix the production code cleanly, and re-run:
   - `node --test web/tests/*.test.mjs`
   - `npm test`
   - `npx tsc --noEmit` and `npx tsc -p web/tsconfig.json --noEmit`
   - `.agents/run/issue-54-build/harnesses/verify-no-flash.mjs` (Obscura browser verification)
3. Write `<worktree>/.agents/run/issue-54-hostile/verifications/proof.md` listing every finding, whether it was fixed or accepted, and the verification output, then commit on `fix/issue-54-no-signin-flash`.
</scope>
<output>
Return <=12 lines: findings found & fixed; test counts (web, root, Obscura, typechecks); Spec Compliance (PASS/FAIL) and Code Quality (APPROVED/NEEDS-FIXES); commit hash; actual provider/model.
</output>
