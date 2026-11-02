<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash (branch fix/issue-54-no-signin-flash @ 5b9bb705f3f7eea7fbf39fa456adc0a1eb254376, base master 8b7e059).
Role: Independent read-only auditor. Zero product or test file edits (`web/**`, `panel/**`, `service/**`, `test/**`). Write ONLY under `<worktree>/.agents/run/issue-54-audit/**`.
Do not touch: `/workspace/releases/board/**`, live processes, port 3000, `/workspace/.openchamber-data/**`, `.env*`, credentials, `/proc/*/environ`, or live GitHub. Never run `git remote -v`. No git push. Zero emojis.
</env_preflight>
<goal>
Independently verify `git diff 8b7e059..5b9bb70` for Issue #54 (D62: never flash `#login-view` on load/reload when signed in; open straight to `#board-view`), confirm ADV-54-01 through ADV-54-05 are genuinely closed, run the full test and Obscura verification suites, and issue a two-verdict gate (Spec Compliance PASS/FAIL, Code Quality APPROVED/NEEDS-FIXES).
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-54-build.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash/.agents/run/issue-54-build/verifications/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash/.agents/run/issue-54-hostile/verifications/proof.md]
web/public/index.html
web/public/app.js
web/tests/issue-54-no-signin-flash.test.mjs
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
1. Inspect `git diff 8b7e059..5b9bb70 -- web/` line by line. Verify:
   - Only `web/public/index.html`, `web/public/app.js`, and `web/tests/issue-54-no-signin-flash.test.mjs` were modified under `web/` (`panel/**` and `service/**` have 0 diff).
   - No secret or CSRF token is stored in `localStorage` (`tb_auth_hint` is `'1'`, `tb_cached_board` strips or never includes `csrfToken`).
   - All 5 hostile findings (ADV-54-01 through ADV-54-05) are genuinely closed in production code and exercised by `web/tests/issue-54-no-signin-flash.test.mjs`.
2. Re-run:
   - `node --test web/tests/issue-54-no-signin-flash.test.mjs`
   - `node --test web/tests/*.test.mjs`
   - `npm test`
   - `npx tsc --noEmit` and `npx tsc -p web/tsconfig.json --noEmit`
   - `node .agents/run/issue-54-build/harnesses/verify-no-flash.mjs`
3. Write `<worktree>/.agents/run/issue-54-audit/verifications/proof.md` and commit ONLY `.agents/run/issue-54-audit/**` on `fix/issue-54-no-signin-flash`.
</scope>
<output>
Return <=10 lines: product diff stat check; secret/CSRF storage check; test & Obscura counts; Spec Compliance (PASS/FAIL) and Code Quality (APPROVED/NEEDS-FIXES); commit hash; actual provider/model.
</output>
