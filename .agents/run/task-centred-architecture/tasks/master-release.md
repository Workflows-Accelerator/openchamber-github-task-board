<env_preflight>
READY — owner human validation (L5) explicitly approved: "Sure, I'm on my phone, so I can't really test it out if you don't publish the board. Plus, I'd really like you to move forward. This is not blocking... make sure the board is available online, and let's move forward."
Hostile reviews (L4) passed for all constituent issues (#33, #34, #36, #37, #30, hosting).
Repo: /workspace/extensions/github-task-board
Integration branch: feat/v2-binding-and-ratelimit (HEAD 95bcf97, tracked clean).
Target branch: master (currently origin/master 6f781be).
Origin/master is proven ancestor of feat/v2-binding-and-ratelimit (exit 0).
Do not read/stage/delete .agents/idle-nontext-state.json, .agents/run/board-lifecycle/**, .agents/run/test-inspection.mjs, or any *-private.md.
Commands: git checkout master ; git merge --ff-only feat/v2-binding-and-ratelimit ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; git push origin master ; git checkout feat/v2-binding-and-ratelimit
</env_preflight>

<goal>
Fast-forward master to accepted feat/v2-binding-and-ratelimit, verify full test suite on master, push master to GitHub origin, verify published tip, and switch back to feat/v2-binding-and-ratelimit.
</goal>

<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-30-integration.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-37-integration.md]
</context_files>

<scope>
1. Confirm root is tracked clean on feat/v2-binding-and-ratelimit at HEAD 95bcf97 (or latest manager checkpoint).
2. Fetch origin master once bounded (max 60s).
3. Checkout master in root:
   git checkout master
   git merge --ff-only feat/v2-binding-and-ratelimit
   Verify git log -1 shows feat/v2-binding-and-ratelimit tip.
4. Run full test gates on master:
   node --test web/tests/*.test.mjs (expect 384/384 pass)
   npm test (expect 525/525 pass)
   npm run typecheck (expect 0 errors)
   npx tsc -p web/tsconfig.json (expect 0 errors)
5. Push master to origin:
   git push origin master
6. Verify published remote tip with:
   git ls-remote origin refs/heads/master
7. Switch back to feat/v2-binding-and-ratelimit:
   git checkout feat/v2-binding-and-ratelimit
8. Record release receipt in .agents/run/task-centred-architecture/outputs/master-release-receipt.md.
</scope>

<criteria>
Master fast-forwarded to review branch tip; 384 web tests and 525 root tests pass; both typechecks pass; origin master pushed and verified via ls-remote; working tree restored to feat/v2-binding-and-ratelimit.
</criteria>

<output>
At most 10 lines:
Master commit SHA before and after; git push exit; ls-remote verified tip; web and root test suite counts; typecheck exits; restored branch.
</output>
