<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board
Branch: fix/issue-28-current-board; HEAD df0d324 (docs); repair 74038a3; previously reviewed code 8625b0a; base 88d3970; tracked state clean; bundle matches fresh build.
Files under review: the delta 8625b0a..74038a3 in panel/main.ts, panel/main.js, test/current-board.test.js, plus the repair report.
Tests: node --test test/current-board.test.js; npm run typecheck; npm run build; npm test.
Do not touch: other worktrees/branches (the halted competing fix in .worktrees/team-dev-issue-28-review-races must not be read), service/**, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, master, root checkout. No push, merge or close.
Efficiency: read the delta and the exact functions it touches; do not page through whole files.
</env_preflight>
<goal>
Bounded re-review: decide whether 74038a3 closes F1 from the earlier review and whether the repair itself introduces a worse failure, then clear or block integration.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review-8625b0a.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/outputs/issue-28-f1-fix.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/verifications/issue-28/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<scope>
The repair claims: soft cap 2000 (2 × MAX_ISSUES_PER_REPO), hard ceiling 4000; oldest-first eviction among unpinned only; pinned = pending > 0 or a settled admission newer than the only publishable snapshot start; at 4000 it abandons the older publication with freshness stale, then trims to 2000; pending is never evicted. Three new regressions fail on 8625b0a and pass at 74038a3; 485/485; typecheck/build green; bundle byte-identical.
Verify independently, at minimum:
1. Re-read the eviction and pinning predicates. Are they correct under two concurrent scans, a scan plus an incremental, a repository switch, and an issue moved between pages. Can a pinned record be evicted through a path the author missed (expiry, trim, prune, repository reset, hard-ceiling path).
2. Reproduce the F1 scenario yourself: paged full refresh plus a 500-issue incremental plus an in-flight successful body edit; the edit must survive in display and cache. Do not reuse the author's test as the only proof; drive your own probe.
3. Hard ceiling: is "abandon the older publication, mark freshness stale, trim" a safe and honest failure. Does the abandoned publication leave a misleading freshness state or drop useful data; can repeated scans wedge the board in stale forever; is memory actually bounded; can the trim then evict something still needed.
4. Regression surface: repository switch, empty snapshot deletion, superseded refresh, watermark, failed-PATCH release, and the three earlier red-first races still behave as reviewed. Run the full suite, typecheck and build; confirm the generated bundle matches a fresh build and contains the new logic.
5. Red-first: revert only the repair's source and bundle (git checkout 8625b0a -- panel/main.ts panel/main.js), rebuild if needed, run the targeted suite, record which tests fail and why, then restore HEAD and rebuild; end clean.
6. Judge whether the author's claim that the reviewer's minimum was insufficient is correct; if the design is more complex than necessary, say what simpler correct rule exists.
</scope>
<criteria>
Verdicts: F1 CLOSED/OPEN; Quality APPROVED/NEEDS-FIXES. Severity per new defect with file:line at 74038a3 and reproducible evidence. Do not re-litigate F2–F6 except to confirm they are unchanged and still outside #28. Do not infer merge, L5 or closure.
</criteria>
<output>
Commit only .agents/run/task-centred-architecture/outputs/issue-28-f1-re-review.md and append verifications/issue-28/proof.md. Do not modify panel/test code; do not merge, push, close or deploy. Return at most 12 lines: verdicts, proof of F1 closure or the standing defect, any new defect, counts, bundle parity, commit, actual and supplied model.
</output>
