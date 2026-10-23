<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-review-races
Branch: fix/issue-28-review-races; HEAD 88d3970; clean tracked state. A previous worker in a different worktree stalled without writing; this worktree contains the same reviewed code. Do not touch other worktrees or root checkout.
Files: panel/main.ts, generated panel/main.js, test/current-board.test.js, run report only. panel/core.ts is reference only; do not edit it and do not read it end to end.
Tests: node --test test/current-board.test.js; then npm run typecheck; npm run build; npm test.
Do not touch: service/**, shared config/agents/skills, credentials, opencode.db, host settings, real GitHub, installed extension, production, master, other branches/worktrees. Symlink root node_modules if missing. No DB registration.
Preflight facts authoritative. Efficiency rule: locate the exact functions with grep (publishIssueSnapshot, streamRemainingPages, fetchIssues, updateIssueBody, status editing, syncRepoIncremental), read only those regions, then edit. Do not page through whole large files.
</env_preflight>
<goal>
Make a completed full refresh stop overwriting edits and incremental data that arrived after that refresh started, without weakening its authoritative membership behavior.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-review-races/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-review-races/.agents/run/task-centred-architecture/verifications/issue-28/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
</skills>
<scope>
Fix exactly two reviewed defects.
R1: a deferred full GET completing after a successful body or status/label edit must not restore the pre-edit field values into display, cache or storage. Track edits accepted after a request started (a bounded per-repository generation or per-issue field version is fine) and protect those fields at publication, or invalidate and restart the snapshot with a bounded retry. Do not fix by merging absent members back, and do not keep unbounded history.
R2: a newer admitted incremental response must not be reverted when an older paginated full snapshot finishes later. Reconciling membership is still the full snapshot's job; field freshness belongs to the newest accepted publication. Do not let the older full snapshot regress the incremental watermark, and do not silently drop the incremental changes.
Also cover: failed or rejected edit must not become permanently protected; successful edit must survive whether the refresh completes before or after the PATCH resolves; repository switch and superseded refresh behavior stay correct; empty authoritative results still clear membership; a fresh full snapshot with no concurrent activity keeps current behavior.
Add permanent shipped-bundle regressions for both races plus the failed-edit case in test/current-board.test.js, using the existing recording host harness and deferred responses. Red-first: they must fail on 88d3970 for the reviewed reason before your source change.
Optional: inspect /tmp/opencode/issue28-review-probes.mjs if present to understand the reviewer's interleaving, but land tests that assert correct behavior, not that the defect exists.
No unrelated refactors, formatting or renames. If the minimal fix requires touching a third function, note why in the report.
</scope>
<criteria>
Both new regressions fail before the patch and pass after; body and status edits survive older full responses; newer incremental fields survive an older paginated full snapshot; watermark does not regress; empty full snapshot still removes members; failed edit is not protected; repository switch/admission tests still pass; full suite, typecheck and build green; generated bundle matches a fresh build; diff limited to the two defects.
</criteria>
<output>
Commit on the branch. Report .agents/run/task-centred-architecture/outputs/issue-28-review-race-fix.md and append proof entries to verifications/issue-28/proof.md. Return <=15 lines: commit, changed functions, red-first evidence, test counts, residual risk, supplied/actual model. Do not merge, push, close or deploy. Fresh hostile review follows.
</output>
