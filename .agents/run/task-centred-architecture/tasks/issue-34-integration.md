<env_preflight>
Final hostile check PASS/APPROVED at 0e1a6be; manager gate accepted. No other implementation/release worker running in repo.
Repo/root /workspace/extensions/github-task-board; integration feat/v2-binding-and-ratelimit at c99a167 or later manager-only run-state commit; tracked clean. Unrelated/private untracked .agents/idle-nontext-state.json, .agents/run/board-lifecycle/**, .agents/run/test-inspection.mjs, outputs/deployment-preflight-private.md, outputs/devops-board-deployment.md and tasks/issue-34-hostile-review.md are NOT owned, NEVER stage/read/delete/copy them. Never git add -A.
Dispatch worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity; branch fix/issue-34-answer-integrity at 0e1a6be clean. Prior product eef57bd. Independent final report PASS/APPROVED. Manager diff review outputs/issue-34-review-gate.md.
Tests root node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. Existing root dependencies.
No master, credentials, installed extension, real GitHub issue mutations, shared config/skills, unrelated worktrees, reset/rebase/force. No issue closure. No deployment. Feature/integration push manager only. Do not remove current worktree from inside itself; manager handles cleanup after wake.
Preflight authoritative; no startup pwd/ls/status discovery. Targeted root checks before merge required to detect branch change/dirt after dispatch, then commit checks permitted.
</env_preflight>
<goal>
Integrate the independently reviewed answer fix into the working review branch only and prove the merged tree stays green.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-34-review-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-final-draft-hostile.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Release is explicitly authorized only into feat/v2-binding-and-ratelimit, NOT master. Root is checked out on integration; leave session located in source worktree but execute root git/test commands with correct working directory.
1. Confirm reviewed feature HEAD hasn't changed, root still intended integration branch, no tracked dirt/unexpected remote-moved conflict. If unexpected state, STOP. Never reset/rebase/force/overwrite.
2. Merge --no-ff fix/issue-34-answer-integrity into root with plain merge message for safe question answers. Conflicts outside generated panel/main.js: STOP/report, do not improvise. Regenerate generated bundle for bundle-only conflict using existing build. No source fixes.
3. Run focused26 expected, full suite, typecheck and build. Compare panel/main.js SHA before/after fresh build, ensure no unexpected tracked diff. No test weakening. If verification fails STOP with raw proof rather than fixing product.
4. Write owned root .agents/run/task-centred-architecture/outputs/issue-34-integration.md and verifications/issue-34-integration/** only with exact commands/exits/count/hash and git scope. Stage only those explicit owned paths/bundle if regenerated legitimately; commit any release proof as needed. Do not alter manager mission/tasks/continuation as manager may checkpoint them later.
No push/PR/issues/Done, no production merge. Manager pushes working branch and removes source worktree after evidence accepted. Local feature branch retained by portfolio policy (overrides skill branch deletion).
</scope>
<criteria>
Reviewed tip merged on integration with full green suite/types/build/bundle parity, no unexpected tracked dirt, unrelated/private untracked untouched. Reports preserved in committed integration tree before cleanup. No master or real GitHub changes. L5 still awaiting human.
</criteria>
<output>
<=10 lines: merge/proof commits, conflicts, targeted/full/type/build results, bundle hash/parity, tracked status/untracked preserved, actual provider/model, blind spots. Stop on unexpected failure; no cleanup from inside source worktree.
</output>
