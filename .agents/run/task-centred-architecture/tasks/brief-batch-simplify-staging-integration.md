<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-batch-simplify-staging
Branch: feat/batch-simplify-staging (branched from master cc08379)
Candidates to merge:
- Panel (#48): feat/issue-48-panel-simple-views at c9fb61b8f4d7fa2178481abaff588b2e23b8380e (L4 ACCEPTED)
- Web (#48 + #47): feat/issue-48-web-simple-views at d5a205da26827d0555824339fcb14c9a39d7af7f (L4 ACCEPTED; already contains #47 268bd28738443863d6a58b5e4500ad20b6aaa05f).
Do not touch master, feat/v2-binding-and-ratelimit, /workspace/releases/**, /workspace/.openchamber-data/**, /workspace/config/**, live board process, proxy routes, or real GitHub. Zero secrets in logs, argv, or reports.
</env_preflight>
<goal>
Integrate accepted #47 and #48 (panel + web) branches into a clean staging worktree branched from master (cc08379), run full combined L0–L3 + browser verification, preserve all untracked hostile-review and recheck proofs from the feature worktrees, and start a safe nonproduction preview server with seeded synthetic multi-project data for L5 human review.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-preview-handoff.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-47-isolation-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-panel-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-web-accepted.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
0. Ensure `node_modules` symlink exists in `.worktrees/team-dev-batch-simplify-staging/node_modules` pointing to `/workspace/extensions/github-task-board/node_modules`, and register `.worktrees/team-dev-batch-simplify-staging` in `~/.local/share/antigravity/antigravity.db` per the worktree-lifecycle skill.
1. Merge `feat/issue-48-panel-simple-views` (`c9fb61b8f4d7fa2178481abaff588b2e23b8380e`) and `feat/issue-48-web-simple-views` (`d5a205da26827d0555824339fcb14c9a39d7af7f`) into `feat/batch-simplify-staging` using normal `git merge --no-ff` (never rebase, reset, cherry-pick, or force). Verify with `git merge-base --is-ancestor` that `cc08379`, `268bd28738443863d6a58b5e4500ad20b6aaa05f`, `c9fb61b8f4d7fa2178481abaff588b2e23b8380e`, and `d5a205da26827d0555824339fcb14c9a39d7af7f` are all ancestors of `HEAD`. Also verify `git diff --exit-code 268bd28738443863d6a58b5e4500ad20b6aaa05f HEAD -- web/server/auth.ts web/server/config.ts web/public/sw.js`.
2. Verify deterministic panel bundle parity (`npx esbuild panel/main.ts --bundle --format=esm --target=es2022 --outfile=/tmp/antigravity/panel-staging-check.js && cmp -s panel/main.js /tmp/antigravity/panel-staging-check.js`), `npm run typecheck`, `npx tsc -p web/tsconfig.json`, `node --test --test-concurrency=1 test/*.test.js`, `node --test web/tests/*.test.mjs`, and `node --test test/shipped-bundle-parity.test.js`.
3. Run combined browser verification (`node web/tests/issue-48-browser-verify.mjs` and `node web/tests/browser-verify.mjs`) against isolated temporary stores and fake GitHub.
4. Preserve secret-free untracked verification proofs from the three feature worktrees into `.agents/run/batch-simplify-staging/preserved-proofs/`:
   - `.worktrees/team-dev-issue-47-fresh-app-signin/.agents/run/issue-47-isolation-review/verifications/proof.md`
   - `.worktrees/team-dev-issue-48-panel-simple-views/.agents/run/issue-48-panel-hostile/verifications/proof.md`
   - `.worktrees/team-dev-issue-48-panel-simple-views/.agents/run/issue-48-panel-correction/verifications/proof.md`
   - `.worktrees/team-dev-issue-48-panel-simple-views/.agents/run/issue-48-panel-recheck/verifications/proof.md`
   - `.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-hostile/verifications/proof.md`
   - `.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-recheck/verifications/proof.md`
5. Commit the preserved proofs and combined staging verification proof (`verifications/proof.md`) on `feat/batch-simplify-staging`.
</scope>
<criteria>
Zero merge conflicts affecting product behaviour (or halt and report if any non-trivial conflict occurs), 100% pass across root and isolated web test suites, 0 typecheck errors, 0-byte panel bundle delta, browser verification exit 0 with 0 page errors, and all feature-worktree proof files preserved and committed on staging.
</criteria>
<output>
Write combined proof to `.agents/run/batch-simplify-staging/verifications/proof.md`. Return <=15 lines: staging HEAD SHA, ancestry check results, test counts/exit codes, preserved proof paths, and actual provider/model from runtime metadata.
</output>
