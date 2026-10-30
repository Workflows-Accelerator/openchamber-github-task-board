<env_preflight>
Repo:/workspace/extensions/github-task-board
Worktree:/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label
Branch:fix/issue-49-login-label at6f079f9 (buildera07de3b plus independent hostile evidence), clean. Base/masterab7516c4a3634c3d69f7b82936ddb7655d327ebb unchanged. Node_modules symlink/DB setup completed by prior builder.
Authoritative findings: .agents/run/issue-49-hostile/findings.md54 lines. F1 HIGH new217-line *.test.mjs depends on ephemeral npx Playwright/browser caches; clean unit suite breaks. F2 MED synthetic u.right<=0/scrollWidth assertion tests implementation; base Chromium clean and Obscura-only bleed. Obscura ablation: left:-9999px alone removes bleed; globalclip-path ineffective, opacity0 redundant/risky for autofill. F3 blindspot native autofill/screen reader untestable headlessly.
Owned files:web/public/theme.css; web/tests/login-label.test.mjs and replacement standalone browser harness; new dependency-free focused tests; .agents/run/issue-49-correction/**. No package/lock dependency changes permitted.
Tests:node --test web/tests/*.test.mjs (original base449); node --test --test-concurrency=1 test/*.test.js595; node --test test/shipped-parity.test.js18; npx tsc -p web/tsconfig.json; existing standalone browser harness33+14. New standalone browser verification must use existing repo zero-dependency CDP/WebSocket pattern (browser-verify.mjs), never transient cache imports or new browser install assumptions in unit glob.
Do not touch:root source/runtime/branch, panel/**, service/**, web/server/auth.ts or config.ts, index form semantics, SW logic, GitHub issues, production/release/supervisor, old reviewer evidence. No push/deploy/master change.
Secrets wall:never /workspace/.openchamber-data/**,.env*,board.env,credentials/cookies/process env,remote URLs. No git remote-v, real GitHub writes/drafts/agent starts. All runtime tests isolated synthetic stores and fake GitHub only.
Startup authoritative:no initial pwd/ls/status; targeted state before commits/resume/failure permitted. Preserve all existing proof/screenshots/history. Stage/commit exact owned files sequentially; no broad git add.
</env_preflight>
<goal>
Resolve every required #49 hostile finding with a minimal portable compatibility patch and evidence of the actual engine-specific visible outcome.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label/.agents/run/issue-49-hostile/findings.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label/.agents/run/issue-49-hostile/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-activation-approval.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Minimal CSS: remove global clip-path and redundant opacity0 addition. Apply only the smallest scoped hidden-input offscreen rule needed (inherited .sr-only already absolute; left:-9999px may suffice). Preserve display/visibility, readonly,tabindex and autocomplete. Do not claim native password-manager compatibility proved by DOM attributes.
2. F1 portability: replace the new *.test.mjs Playwright-dependent test with existing repository dependency-free test conventions. Move real browser assertions to a clearly named standalone *-browser-verify.mjs harness using existing CDP/WebSocket tooling and documented invocation. No new deps/locks/CI changes or silent test skip. Standard unit glob must run using only documented npm install deps, not ephemeral browser cache. Optional browser invocation may explicitly require an existing CDP endpoint and fail clearly if unavailable, as repo conventions do. Add small dependency-free tests for preserved autocomplete/label/semantic contract if valuable, but these are not visual proof.
3. F2 outcome proof: remove fabricated unclipped scrollWidth rectangle and offscreen-right<=0-as-visual regression claim. Use actual before/after screenshots in Obscura and Chromium plus empirical pixel/region comparison if available without new deps; retain exact code+inputs and causal ablation. Acceptable proof: real image-region change in Obscura Password label area from base to corrected, independent screenshot inspection, Chromium unchanged. No canonical screenshot test that asserts only chosen left CSS. A geometry sanity check may remain but honestly label it implementation/safety, not evidence base Chromium was broken.
4. Revalidate synthetic browser sign-in, HttpOnly cookie, original auth/config/SW unchanged, other labels and announcer AX roles/names preserved where tooling allows. Native popups and auditory screen reader remain explicitly NOT VERIFIED. Assert no horizontal overflow at1280/360.
5. Run targeted/new full baselines and record exact commands/exits/counts. Commit smallgreen changes, preserve prior reports. No new UI design/auth behavior. All changes PREPARATION only; no feature push/PR/master/deploy/close.
</scope>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Before done challenge clean install/module resolution, screenshot causal relevance, scope/minimality, hidden field autofill semantics and fabricated claims. Independent recheck follows; don't label own patch L4 accepted.
</review_prompt>
<criteria>
F1 eliminated: standard unit glob no undeclared/cache/browser dependency; separate explicit harness documented. F2 eliminated: only necessary CSS, engine-specific disclosure and actual visible evidence, no fabricated visual assertion. F3 explicit blindspots. All baselines green, clean committed scoped diff, no weakened existing tests/security or production/host mutation. User approved preparation not release.
</criteria>
<output>
Full proof .agents/run/issue-49-correction/verifications/proof.md, mapping F1-F3 to evidence. Return<=15lines: each finding status; exact CSS/test delta; unit/browser counts/exits; Obscura vsChromium visual results; native blindspots; commit; self-review residuals; actual provider/model. No secret values/private data.
</output>
