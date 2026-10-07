<goal>Merge fix/v2-binding-ratelimit-review-repair (tip 4353672 — the L4-approved board repair chain: 656cc4f + 00ac1b9 + bea33c0/0c3b60a/f2583e2/147d8dd + tests a8014aa + docs bca2bc9 + review artifacts 4353672) into feat/v2-binding-and-ratelimit at the ROOT checkout /workspace/extensions/github-task-board, so the served extension preview runs the reviewed code. This is preview integration only: NEVER merge to master, never push, never close issues, never remove worktrees.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/status-l4-halts-2026-10-07.md]
</context_files>
<context>
You are the integration merger. The fix branch passed hostile review (PROCEED, zero residual) on every repair; the only reason to merge is so the human can click through the exact reviewed code in the running preview. The root checkout is currently on feat/v2-binding-and-ratelimit (pre-repair code plus manager run-state commits on top of 656cc4f). The fix branch diverged with application repairs plus its own worktree-local .agents/run artifacts; run-state files exist on both sides and must NOT clobber the root's canonical manager state.
Run-state conflict policy is mandatory: for any .agents/run/** path present on both sides, keep the ROOT side (ours) unchanged — the root copy is canonical. Keep every file the fix branch ADDS (verifications/l4-board-v2-repair-2.md, verifications/board-v2-repair-2-l4/**, verifications/board-v2-repair-2/**). Application code conflicts (panel/**, test/**) resolve to the fix branch side (theirs) verbatim — those are the reviewed repairs; do not alter, reformat, or "improve" them. .gitignore: union of both sides. If a conflict appears anywhere else (package files, config), STOP and report instead of guessing.
</context>
<scope>
Execute git merge in /workspace/extensions/github-task-board (the ROOT checkout) — that is where feat/v2-binding-and-ratelimit is checked out; you are explicitly authorized to run git commands there for this merge. You may also read the fix worktree /workspace/extensions/github-task-board/.worktrees/team-dev-v2-binding-ratelimit-review-repair. No edits to application code beyond conflict resolution as specified. No push, no PR, no master, no issue operations, no worktree teardown, no service restarts, no secrets in output.
</scope>
<criteria>
Merge commit created on feat/v2-binding-and-ratelimit containing exactly the fix-branch application changes; run-state conflicts resolved per policy (root run state intact, fix-branch review artifacts added). Post-merge gates all green with exact counts. Tracked working tree clean afterwards. Report lists every conflict and its resolution.
</criteria>
<steps>
<step>In /workspace/extensions/github-task-board run `git branch --show-current` (expect feat/v2-binding-and-ratelimit) and `git status --porcelain` (no tracked changes; untracked .worktrees/ and .opencode/ noise is expected and stays untracked).</step>
<step>Run `git merge --no-ff fix/v2-binding-ratelimit-review-repair -m "merge: board V2 binding + D11 rate-limit repairs (L4 approved) into preview branch"`.</step>
<step>Resolve conflicts per the context policy. For .agents/run/** conflicts prefer the root side; keep fix-branch-added artifact files; application code takes theirs. Record each conflict and resolution.</step>
<step>Post-merge gates: `npm run typecheck` (exit 0), `npm run build` (if regenerated panel/main.js differs from the committed file, commit it as `chore: rebuild bundle after integration`), `node --test test/*.test.js` (expect 269 pass / 0 fail). Then `git status --porcelain` must show no tracked changes.</step>
<step>Verify `git log --oneline -3` shows the merge commit and report.</step>
</steps>
<output>
STATUS; merge commit hash; CONFLICTS table (path, side kept, reason); EVIDENCE (commands, counts, exits); NOT VERIFIED; BLOCKERS. Nothing is pushed, merged to master, closed or human-approved. Never include credentials.
</output>
