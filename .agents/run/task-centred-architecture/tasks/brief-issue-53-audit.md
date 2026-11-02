<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look (branch feat/issue-53-openchamber-look @ 35a23fe, parent #54 accepted at 4606b45, base master 8b7e059). Clean working tree.
Role: Independent read-only auditor. Zero product or test file edits (`web/**`, `panel/**`, `service/**`, `test/**`). Write ONLY under `<worktree>/.agents/run/issue-53-audit/**`.
Do not touch: `/workspace/releases/board/**`, live processes, port 3000, `/workspace/.openchamber-data/**`, `.env*`, credentials, `/proc/*/environ`, or live GitHub. Never run `git remote -v`. No git push. Zero emojis.
If a harness regenerates artifacts under `.agents/run/issue-53-build/**` or `.agents/run/issue-54-build/**`, copy the ones you need into `.agents/run/issue-53-audit/` and `git checkout --` the originals so only the audit folder is committed.
</env_preflight>
<goal>
Independently verify `git diff 4606b45..35a23fe` for Issue #53 (D63: online board matches the OpenChamber Task Board panel layout, toolbar, rows, 480px drawer and colours; D64: theme follows device by default with Auto/Dark/Light in Settings saved under localStorage `tb_theme_mode`, dark `#0f1012`, light `#f4f5f7`). Confirm the 7 hostile blockers are genuinely closed, confirm #54 (D62 no sign-in flash) is not regressed, run the full suites and both Obscura harnesses, look at every screenshot yourself, and issue a two-verdict gate (Spec Compliance PASS/FAIL, Code Quality APPROVED/NEEDS-FIXES).
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-53-build.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-53-hostile.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look/.agents/run/issue-53-build/verifications/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look/.agents/run/issue-53-hostile/verifications/proof.md]
Reference panel screenshots: /workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/ (panel-1280-dark.png and siblings)
web/public/index.html, web/public/app.js, web/public/theme.css, web/tests/issue-53-openchamber-look.test.mjs
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
1. Inspect `git diff 4606b45..35a23fe` line by line. Verify:
   - Product changes are limited to `web/public/{index.html,app.js,theme.css}` and `web/tests/issue-53-openchamber-look.test.mjs`; `panel/**`, `service/**` and `test/**` have 0 diff against master 8b7e059 beyond what #54 already did.
   - No secret, password or CSRF token is written to localStorage or disk; only non-secret keys (`tb_theme_mode`, `tb_auth_hint`, cached board without csrf).
   - Constraints still hold: no `Align Drafts` or agent-start control on the web; View/Filter/Sort present; short project names; quick capture saves a `status:draft` and never starts an agent; native transfer flow unchanged (no copy/recreate/close/retry).
   - Boilerplate copy and the empty Done box are gone (D63).
   - The 7 hostile blockers (SVG size, row layout + markdown preview, closed dialogs taking space, theme precedence, drawer overlap, quick-add in Simple list, harness strength) are closed in code and covered by tests/harness checks that would fail if reverted.
   - Doubt the harness: confirm its checks actually assert (not just log) and that a regression would turn it red.
2. Re-run:
   - `node --test web/tests/issue-53-openchamber-look.test.mjs`
   - `node --test web/tests/issue-54-no-signin-flash.test.mjs`
   - `node --test web/tests/*.test.mjs`
   - `npm test`
   - `npx tsc --noEmit` and `npx tsc -p web/tsconfig.json --noEmit`
   - `node .agents/run/issue-53-build/harnesses/verify-openchamber-look.mjs`
   - `node .agents/run/issue-54-build/harnesses/verify-no-flash.mjs`
   - Chromium is known broken here (`libglib-2.0.so.0` missing); record it as NOT VERIFIED, do not try to install packages.
3. Open every regenerated screenshot (desktop dark, search/filter, drawer, light, settings, mobile board, mobile drawer) with `read` and compare against the reference panel screenshots. Note any visual defect, however small.
4. Write `<worktree>/.agents/run/issue-53-audit/verifications/proof.md` (findings with file:line, counts, verdicts, blind spots) and commit ONLY `.agents/run/issue-53-audit/**` on `feat/issue-53-openchamber-look`.
</scope>
<output>
Return <=12 lines: product diff scope check; secret/CSRF storage check; constraint check; test & Obscura counts; visual findings; Spec Compliance (PASS/FAIL) and Code Quality (APPROVED/NEEDS-FIXES) with any blocking findings; commit hash; actual provider/model.
</output>
