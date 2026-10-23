<env_preflight>
Repo and worktree: /workspace/extensions/github-task-board (the main checkout, not a .worktrees path)
Branch: feat/v2-binding-and-ratelimit; HEAD 46291b0; tracked state clean; this is the shared working branch and it is checked out here.
Untracked files exist in this checkout from other work (for example .agents/board-lifecycle/**, .agents/idle-nontext-state.json). Leave every untracked path exactly as it is. Never `git add -A`, never `git add .`, never clean.
Source branch to merge: fix/issue-28-current-board (HEAD 0821897; reviewed and approved: F1 CLOSED, Quality APPROVED, 485/485, bundle byte-identical). Do not merge fix/issue-28-review-races — it is halted and must not land.
Tests: npm test; npm run typecheck; npm run build; node --test test/current-board.test.js.
Do not touch: source files beyond conflict resolution, service/**, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub, production, master (remote or local), other branches/worktrees. No force-push, no branch deletion, no issue closure, no deployment.
</env_preflight>
<goal>
Merge the approved #28 fix into the working branch, prove the merged tree is green and its generated bundle matches, and push the working branch.
</goal>
<scope>
1. Confirm the checkout is on feat/v2-binding-and-ratelimit and tracked state is clean; if not, stop and report.
2. Merge fix/issue-28-current-board with a merge commit (`git merge --no-ff`) and a message naming issue #28.
3. If there are conflicts, resolve them only where both sides are documentation or where the fix branch's reviewed code must win over older copies; never invent new behaviour. If a source conflict is not mechanically resolvable, stop the merge cleanly and report instead of guessing.
4. After the merge: `npm run build` (the generated panel/main.js must match the merged source and produce no unexpected diff), `node --test test/current-board.test.js`, `npm test`, `npm run typecheck`. Record exact counts.
5. Confirm the merge introduced no unrelated file changes: `git show --stat` on the merge and `git status --porcelain` (untracked files that predate you are expected and must be unchanged).
6. Push the branch: `git push origin feat/v2-binding-and-ratelimit`. No force, no tags.
7. Leave the feature worktree and branch intact; do not remove or prune anything.
</scope>
<criteria>
Merge commit exists on feat/v2-binding-and-ratelimit; tracked tree clean after build; current-board 19/19; full suite green; typecheck green; push accepted; no master push; no halted branch content; no unrelated file added.
</criteria>
<output>
Write .agents/run/task-centred-architecture/outputs/issue-28-integration.md in this checkout (tracked run docs only) and commit it as part of the merge follow-up. Return at most 12 lines: merge commit SHA, pushed branch and remote result, test/typecheck counts, bundle parity result, any conflict resolution, actual and supplied model. Stop after the push.
</output>
