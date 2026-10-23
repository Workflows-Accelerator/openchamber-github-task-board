<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-review-races
Branch: fix/issue-28-review-races; HEAD 2958b1b (docs); code change 9158bd2; base 88d3970; tracked state clean at start.
Files under review: panel/main.ts, generated panel/main.js, test/current-board.test.js in 88d3970..9158bd2; builder notes .agents/run/task-centred-architecture/outputs/issue-28-review-race-fix.md.
Tests: node --test test/current-board.test.js; npm run typecheck; npm run build; npm test.
Do not touch: other worktrees/branches (a competing fix exists in .worktrees/team-dev-issue-28-current-board — do NOT read or use it, independence matters), service/**, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, master, root checkout. No DB registration. No push.
Efficiency: locate functions with grep and read only those regions plus the diff; do not page through the whole of main.ts, core.ts or main.js.
</env_preflight>
<goal>
Independently falsify or confirm that 9158bd2 closes the two reviewed #28 races without introducing new correctness, memory, membership or failure-path defects, and grade it for integration.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/28
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-review-races/.agents/run/task-centred-architecture/verifications/issue-28/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-review-races/.agents/run/task-centred-architecture/outputs/issue-28-review-race-fix.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
</skills>
<scope>
Conduct a hostile review of the fix. Don't assume the builder is right. The builder claims: bounded per-request field-guard windows guarded at publication in publishIssueSnapshot/streamRemainingPages/fetchIssues; incremental field reconciliation plus a non-regressing watermark in syncRepoIncremental; guards in updateIssueBody/updateIssueStatus released on failed PATCH; 6 new shipped-bundle regressions (body edit, status edit, in-flight PATCH, incremental-vs-page-two, failed body, failed status); red-first 4 of 6 failed on 88d3970; 481/481, typecheck/build green.
Attack at minimum:
1. Guard lifetime and scope: exactly what bounds a window (request identity, count, time), what happens when a slow full refresh outlives it, and whether a guarded field can be clobbered after expiry. Are guards per repository, per issue, per field; can a guard for one issue or repo protect another; is memory bounded under many edits and repos.
2. Set/release ordering: guard set before or after the PATCH is sent; is there a window where a successful PATCH lands but the guard is not yet visible; release before or after the response is applied locally; can a release race erase a newer edit's guard (two tabs or rapid edits of the same field); can a failed edit release a guard that a concurrent successful retry still needs; double submit and retry after conflict.
3. Membership and empty snapshots: a completed full snapshot must still remove absent issues, including an empty result, while pagination is incomplete; does any guard or incremental merge retain or resurrect removed members; does repository switch clear guard state.
4. Watermark: confirm it never regresses and that it cannot freeze a genuinely newer snapshot's fields until reload; what happens with clock skew or two refreshes starting in the same millisecond.
5. All Projects aggregate: the builder admits that path has no guard window. Reproduce a clobber there (edit in All Projects during a refresh) and grade severity. Decide with evidence whether that is inside #28's acceptance criteria or a separate issue, and say which.
6. Test quality: do tests assert user-visible display and cache, not only internals; are they tautological; confirm red-first by reverting source in this worktree (git checkout 88d3970 -- panel/main.ts panel/main.js), rebuilding, running the targeted suite, recording which tests fail and why, then restoring HEAD and rebuilding; end clean with a bundle that matches a fresh build.
7. Adversarial fuzz: a disposable probe under /tmp/opencode driving the recording harness through at least 100 seeded random interleavings of refresh start/finish, pagination pages, body edit, status edit, PATCH success/failure/timeout, repo switch and rapid double edit, asserting: latest successful edit displayed and cached, no cross-repository contamination, membership only from completed snapshots, no unbounded guard growth. Record NOT RUN with reason if the harness cannot express it.
8. Bundle integrity and regressions: generated main.js matches a fresh build; ordinary editing preserved; no unintended GitHub mutations in recorded fixtures.
</scope>
<criteria>
Two verdicts: Spec PASS/FAIL/PARTIAL against issue #28 acceptance criteria; Quality APPROVED/NEEDS-FIXES. Every defect needs severity (Critical/High/Moderate/Low), exact source anchors (file:line at 9158bd2) and reproducible evidence (command plus observed output, log path). Distinguish proven defects from suspicions. Red-first confirmation, fuzz result, full suite/typecheck/build counts. Do not infer completion, closure, merge or human approval. If any Moderate+ defect stands, return the minimum concrete remediation and stop.
</criteria>
<output>
Commit only docs in this worktree: .agents/run/task-centred-architecture/outputs/issue-28-hostile-review-9158bd2.md and an appended section in verifications/issue-28/proof.md. Do not modify panel/test code, do not merge, push, close or deploy. Leave the tree clean with the bundle matching a fresh build. Return at most 15 lines: verdicts, defect list with severity, fuzz/red-first result, test counts, the All-Projects ruling, commit, actual and supplied model.
</output>
