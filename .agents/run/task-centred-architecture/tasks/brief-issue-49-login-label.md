<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label (just created by manager via git worktree add)
Branch: fix/issue-49-login-label, base master ab7516c4a3634c3d69f7b82936ddb7655d327ebb (clean).
Setup still needed (worktree skill steps 4-5): symlink root node_modules into this worktree if absent; register worktree path in ~/.local/share/opencode/opencode.db using parameterized SQL (adapt the skill's hardcoded /home/opencode path; do not edit the shared skill). No .env copy needed; never read .env*.
Files: web/public/index.html (login form, lines ~40-41: hidden username label+input with class sr-only, value "board", autocomplete="username", readonly, tabindex=-1), web/public/theme.css (.sr-only at ~line 533), relevant web/tests/** (login, autofill, browser-verify harnesses).
Tests: npx tsc -p web/tsconfig.json; node --test web/tests/*.test.mjs (baseline 449/449); node --test --test-concurrency=1 test/*.test.js (baseline 595/595); node --test test/shipped-parity.test.js (18/18); web browser harnesses under web/tests/ (browser-verify.mjs 33/33, issue-48-browser-verify.mjs 14/14). All tests use isolated synthetic stores and fake GitHub. Root CPU-timing tests can flake under load: rerun once, never weaken.
Do not touch: web/server/auth.ts, web/server/config.ts, web/public/sw.js logic (cache version stamping must keep working), panel/**, service/**, master, production /workspace/releases/**, the live supervisor, GitHub issues.
Secrets wall: never read /workspace/.openchamber-data/**, board.env, credentials, cookies, process environments; never git remote -v. No real passwords in logs/argv/evidence; use a synthetic password.
Preflight authoritative at startup; skip initial pwd/ls/status discovery. Targeted checks allowed before commits, on failure or resume.
</env_preflight>
<goal>
Make the sign-in page show a clean Password label with no visible username text, while keeping password-manager autofill, sign-in, sessions and CSRF behaviour unchanged.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-activation-approval.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-live-audit-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<context>
Issue #49 (https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/49). Live audit screenshots (preserved under .agents/run/task-centred-architecture/preserved-batch-simplify/staging/batch-simplify-release-audit/**) show the hidden username value "board" visibly overlapping the "Password" label at desktop and 360px. D49 requires a hidden username field so desktop Chrome offers the saved password. User approved PREPARATION only: no master push, deploy or issue closure.
</context>
<scope>
Owned: web/public/index.html login form markup, web/public/theme.css visual-hiding rule, new or updated web/tests/** regression tests and harnesses, .agents/run/issue-49-login-label/**.
First reproduce in a normal Chromium-class browser (Playwright/Obscura per repo harnesses) against a local server with synthetic config; record whether the bleed reproduces. Then apply the smallest visual-only fix (for example a robust visually-hidden rule: clip-path inset, overflow clip, zero size, no padding/border, white-space nowrap; or position the field off-layout) that keeps the field in the DOM, focus-inert, autocomplete="username" and submitted as before. Check every other .sr-only use (quick-add labels, overview label, answer labels, announcer live region) is not degraded: labels stay accessible, live region still announces.
Add a regression check that fails on the old CSS: e.g. rendered bounding box/visible text of #username does not overlap the Password label, at 1280 and 360 widths.
Do not change auth flow, session storage, CSRF, server routes or SW logic. If the SW cache version is derived from asset hashes, confirm it changes naturally so installed apps pick up the fix; do not hand-edit it.
Commit locally on fix/issue-49-login-label in small green steps. No push, no PR, no deploy.
</scope>
<criteria>
Before/after screenshots at 1280 and 360 show the bleed gone and layout otherwise unchanged; regression test fails on base and passes on fix; username/current-password autocomplete attributes intact; synthetic sign-in through the browser still works and session cookie set; all baselines green (web, root, parity, both browser harnesses, typecheck); diff limited to owned paths; zero console/page errors.
</criteria>
<steps>
<step>Worktree setup (node_modules symlink, DB registration).</step>
<step>Reproduce with screenshots; record result in proof.</step>
<step>Write failing regression test; commit.</step>
<step>Apply minimal CSS/markup fix; rerun; commit.</step>
<step>Full test ladder + browser sign-in with synthetic password; screenshots; commit proof.</step>
<step>Hostile self-review per review prompt; record findings.</step>
</steps>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Specifically: does any password manager now ignore the hidden username (display:none / visibility:hidden can stop autofill); did other .sr-only users change; does the fix hold on iOS Safari/WebKit and Firefox in principle; does the SW serve the new CSS after deploy.
</review_prompt>
<output>
Return <=12 lines: reproduction result; fix summary with file:line; regression test name and fail-before/pass-after evidence; test counts; screenshots paths; commits (SHA); hostile self-review findings; residual blind spots (real password-manager prompts); actual provider/model. Full proof in .agents/run/issue-49-login-label/verifications/proof.md.
</output>
