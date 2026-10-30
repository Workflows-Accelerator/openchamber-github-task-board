<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label
Branch: fix/issue-49-login-label at a07de3b (builder commits e9ee37d test,76edb66 CSS,a07de3b proof); clean at manager inspection. Base master ab7516c4a3634c3d69f7b82936ddb7655d327ebb.
Root branch ops/task-board-activation hosts live extension; do NOT edit root source, change branches/refs, toggle guests, restart hosts or change web deployment. Concurrent activation audit ses_8e3e462f406eb956d0464e6b is unrelated/read-only on root; don't duplicate it.
Product diff: web/public/theme.css adds clip-path:inset(50%) to global .sr-only and input.sr-only {position:absolute;left:-9999px;top:auto;opacity:0}; web/tests/login-label.test.mjs is217 lines and imports playwright-core from PLAYWRIGHT_CORE or /workspace/.npm/_npx/e41f203b7505f1fb/node_modules/... then launches CHROMIUM_PATH or fixed /workspace/.cache/ms-playwright/chromium_headless_shell-1248/... . Baseline existing browser harnesses were separate *.mjs, not automatically unit-test globs.
Builder proof claims Chromium before screenshots already clean (NO bleed), Obscura before reproduces bleed; verify this distinction. Do NOT report a universal desktop Chrome bug from Obscura alone.
Tests: node --test web/tests/login-label.test.mjs; node --test web/tests/*.test.mjs (claimed452/452); node --test --test-concurrency=1 test/*.test.js (595); node --test test/shipped-parity.test.js (18); npx tsc -p web/tsconfig.json. Browser harnesses browser-verify.mjs33 and issue-48-browser-verify.mjs14. Use isolated synthetic data/fake GitHub only.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, real session or credential data, token-bearing remote URLs or process environment. No remote -v. No production state/GitHub mutations.
Preflight authoritative: skip initial pwd/ls/status discovery. Targeted mutation/commit/resume/failure inspection allowed. Source/tests READ ONLY; write only .agents/run/issue-49-hostile/** evidence and checkpoint it locally on feature branch. No package/dependency edits/install or environmental workarounds that mask portability failures.
</env_preflight>
<goal>
Independently determine whether #49 is a minimal, portable visual compatibility correction that preserves autofill semantics and is safe to show the user for approval.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-49-login-label.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label/.agents/run/issue-49-login-label/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-activation-approval.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent of builder ses_b75ff32406f2d7fdcab54699. Do not accept self-reported tests, screenshots, accessibility or autofill claims without checking them. Every failure must be ranked with file:line, actual impact, empirical evidence and minimum correction. No auto-fix.
</review_prompt>
<scope>
1. Inspect complete diff vs master, package test scripts, documented test setup and new test. Verify source scope and unchanged auth/config/SW/index/autocomplete semantics.
2. Portability: determine whether standard node --test web/tests/*.test.mjs now requires undeclared Playwright/Chromium and a transient npx cache path. Check a clean documented install would have them; prove missing-module/browser failure in a safe copied harness or nonmutating resolver without deleting/changing actual caches. Existing cached installation passing here is NOT proof of a portable suite. A hardcoded local fallback silently adding required external browser setup to unit tests is a required finding if real.
3. Regression validity: builder's u.right<=0 check tests chosen implementation, not necessarily a visual defect (base Chromium appears clean). Verify before/after in Obscura and Chromium with independent screenshots. Challenge scrollWidth-based text rectangle and "accessible" tests based only on element presence. Determine which CSS property actually removes bleed; no need to modify source, inject styles in isolated browser pages for causal ablation. Ask if redundant opacity/offscreen/global rule changes exceed minimum and harm Chrome autofill heuristics. Do not infer password-manager compatibility from DOM presence or display/visibility alone; native popup remains UNVERIFIED.
4. Check #username readonly/tabindex/autocomplete, password field, synthetic browser sign-in+HttpOnly session and no request/log credential leaks. Verify no mobile horizontal scroll or offscreen focusing side effects. Inspect .sr-only labels and announcer accessible roles/names where browser tooling permits; actual screen reader remains UNVERIFIED.
5. Independently run appropriate tests/commands and inspect retained screenshots, console errors, exact exits. Preserve before/after artifact comparisons and failure reproduction. No live production login or real GitHub writes. No dependency/CI/test weakening changes.
6. Return L5 human review readiness only if no required defects. User approved PREPARATION only; never push master, deploy or close #49. Return a plain-language disclosure that base Chromium was clean if verified; do not hide an engine-specific issue behind general Chrome claims.
</scope>
<criteria>
Spec PASS/FAIL/PARTIAL and Quality APPROVED/NEEDS-FIXES, each independent. Portable existing test invocation must remain valid; evidence must test visible outcome rather than only new CSS shape; unchanged security/session/autofill semantics established to realistic limits. Every unresolved required defect means not L5-ready. No source fixes, production/host mutations or secrets access.
</criteria>
<output>
Write .agents/run/issue-49-hostile/verifications/proof.md and findings.md; commit exact evidence paths only locally. Return <=15 lines with two verdicts, ranked required findings file:line+proof, browser distinction, actual tests/exits/counts, retained evidence/commit, L5 readiness, blind spots and actual provider/model.
</output>
