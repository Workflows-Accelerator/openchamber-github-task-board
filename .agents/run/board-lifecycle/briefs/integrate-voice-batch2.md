<goal>Merge fix/v2-ratelimit-review-repair (tip a7e3ac9 — the L4-approved voice chain: cd6ab18 + 252225a + f58e11b/67f955f/d582374 + a5ddb77 + a7e3ac9) into feat/v2-compat-and-ratelimit at the ROOT checkout /workspace/extensions/chambervoice, so the served extension preview runs the reviewed code. Preview integration only: NEVER merge to master, never push, never close issues, never remove worktrees.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/status-l4-halts-2026-10-07.md]
</context_files>
<context>
You are the integration merger. The fix chain passed hostile review (PROCEED, zero residual on the final review); the merge exists so the human can click through the exact reviewed code in the running preview. The root checkout is on feat/v2-compat-and-ratelimit (at cd6ab18) and the fix branch is strictly ahead of it, so this should be trivial or a fast-forwardable merge — but do not assume: run the gates regardless.
Run-state conflict policy is mandatory: for any .agents/run/** path present on both sides, keep the ROOT side (ours) unchanged. Keep every file the fix branch adds (.agents/run/voice-v2-repair-1/, voice-v2-repair-2/, voice-v2-repair-3/ artifacts). Application code conflicts (service/**, test/**, panel/**) resolve to the fix branch side (theirs) verbatim — the reviewed repairs; do not alter or "improve" them. .gitignore: union of both sides. Untracked supervisor state in the root checkout stays untracked and untouched. If a conflict appears anywhere else, STOP and report instead of guessing.
</context>
<scope>
Execute git merge in /workspace/extensions/chambervoice (the ROOT checkout) — that is where feat/v2-compat-and-ratelimit is checked out; you are explicitly authorized to run git commands and the npm gates there for this merge. You may also read the fix worktree /workspace/extensions/chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair. No application edits beyond conflict resolution as specified. No push, no PR, no master, no issue operations, no worktree teardown, no service restarts, no secrets in output.
</scope>
<criteria>
Merge commit on feat/v2-compat-and-ratelimit containing exactly the fix-chain application changes; run-state conflicts resolved per policy (root run state intact, fix-branch artifacts added). Gates green with exact counts. Tracked working tree clean afterwards. Report lists every conflict and its resolution.
</criteria>
<steps>
<step>In /workspace/extensions/chambervoice run `git branch --show-current` (expect feat/v2-compat-and-ratelimit) and `git status --porcelain` (no tracked changes; untracked supervisor state is expected and stays).</step>
<step>Run `git merge --no-ff fix/v2-ratelimit-review-repair -m "merge: voice V2 compatibility + D11 rate-limit repairs (L4 approved) into preview branch"`.</step>
<step>Resolve conflicts per the context policy; record each conflict and resolution.</step>
<step>Post-merge gates: `npm run verify` (tsc + tests; expect 460 pass / 0 fail), `npm run build` (service/main.js must match the fix chain's built bundle; panel/main.js and live/* must be unchanged from base — any unexpected churn is a finding to report, not to fix). Then `git status --porcelain` must show no tracked changes.</step>
<step>Verify `git log --oneline -3` shows the merge commit and report.</step>
</steps>
<output>
STATUS; merge commit hash; CONFLICTS table (path, side kept, reason); EVIDENCE (commands, counts, exits); NOT VERIFIED; BLOCKERS. Nothing is pushed, merged to master, closed or human-approved. Never include credentials.
</output>
