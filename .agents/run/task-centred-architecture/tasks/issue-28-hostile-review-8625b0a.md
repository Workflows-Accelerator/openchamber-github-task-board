<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board
Branch: fix/issue-28-current-board; HEAD 658e970 (docs); code change 8625b0a; base 88d3970; tracked state clean at start.
Files under review: panel/main.ts, generated panel/main.js, test/current-board.test.js in 88d3970..8625b0a; builder notes outputs/issue-28-review-race-fix.md.
Tests: node --test test/current-board.test.js; npm run typecheck; npm run build; npm test.
Do not touch: other worktrees/branches (a second competing fix exists in .worktrees/team-dev-issue-28-review-races — do NOT read or use it, independence matters), service/**, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, master, root checkout. No DB registration. No push.
Efficiency: locate functions with grep and read only those regions plus the diff; do not page through the whole of main.ts, core.ts or main.js.
</env_preflight>
<goal>
Independently falsify or confirm that 8625b0a actually closes the two reviewed #28 races without introducing new correctness, memory or membership defects, and grade it for integration.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/28
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/verifications/issue-28/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/outputs/issue-28-review-race-fix.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/test/methodology/test-driven-development/SKILL.md]
</skills>
<scope>
Conduct a hostile review of the fix. Don't assume the builder is right. The builder claims: bounded admission records (TTL 5 min, cap 400, key repo#number) settle on PATCH outcome; provisional merges and full publications overlay only newer local fields; completed snapshots stay authoritative for membership; publication watermark is max(request start, existing); red-first 7 new tests failed on 88d3970 and pass now.
Attack at minimum:
1. TTL and cap: what happens when a record expires or is evicted before a slow full refresh publishes; can a successful edit still be clobbered; is the cap reachable in a plausible repo (more than 400 edited issues); does eviction order make the oldest and most vulnerable record go first; is there any unbounded growth or per-issue leak; clock jumps / non-monotonic Date.now.
2. Failed, rejected or timed-out PATCH: is protection released correctly, and can a failed edit now clobber a newer successful retry; double-submit of the same edit; edit during repository switch.
3. Membership: an issue with a newer admission record is retained by a completed snapshot. Can a genuinely deleted issue stay visible or be resurrected after being removed, and for how long; does the empty-snapshot deletion behaviour from the original acceptance criteria still hold when admissions exist; does retention leak into cache or storage.
4. Watermark: does max(request start, existing) let a genuinely newer full snapshot be treated as older and never publish some fields; can a stale snapshot permanently raise the watermark and freeze fields until reload.
5. Coverage: the builder admits archive/tag add-remove/priority/complexity label PATCHes and issue creation are not wired to the admission helper. Reproduce one such clobber (e.g. an archive or priority edit landing during a refresh) and grade it. Decide with evidence whether that is inside #28's acceptance criteria or a separate issue, and say which.
6. Test quality: are the new tests asserting user-visible state and cache, or internal bookkeeping only; are they tautological; do they fail on 88d3970 for the reviewed reason when the source is reverted (revert in this worktree with git checkout 88d3970 -- panel/main.ts panel/main.js, rebuild, confirm red, then restore to HEAD and rebuild; end with a clean tree and matching bundle).
7. Adversarial fuzz: write a disposable probe under /tmp/opencode that drives the recording harness through seeded random interleavings of refresh start/finish, pagination pages, body edit, status edit, repo switch and PATCH failure (at least 100 seeds), asserting invariants: latest successful edit is displayed and cached, no cross-repository contamination, membership only from completed snapshots or protected admissions. If the harness cannot express it, record NOT RUN with the reason.
8. Bundle integrity and regressions: generated main.js matches a fresh npm run build; ordinary editing still works; no unintended GitHub mutations from refresh paths in recorded fixtures.
</scope>
<criteria>
Two verdicts: Spec PASS/FAIL/PARTIAL against issue #28 acceptance criteria; Quality APPROVED/NEEDS-FIXES. Every defect needs severity (Critical/High/Moderate/Low), exact source anchors (file:line at 8625b0a) and reproducible evidence (command plus observed output, log path). Distinguish proven defects from suspicions. Red-first confirmation, adversarial fuzz result, full suite/typecheck/build counts. Do not infer completion, closure, merge or human approval. If any Moderate+ defect stands, return the minimum concrete remediation and stop.
</criteria>
<output>
Commit only docs in this worktree: .agents/run/task-centred-architecture/outputs/issue-28-hostile-review-8625b0a.md and an appended section in verifications/issue-28/proof.md. Do not modify panel/test code, do not merge, push, close or deploy. Leave the tree clean with the bundle matching a fresh build. Return at most 15 lines: verdicts, defect list with severity, fuzz/red-first result, test counts, the unwired-write-path ruling, commit, actual and supplied model.
</output>
