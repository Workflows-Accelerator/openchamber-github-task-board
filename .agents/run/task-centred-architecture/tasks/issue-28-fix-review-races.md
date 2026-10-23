<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board
Branch: fix/issue-28-current-board; implementation 29d1634; report-only review HEAD 88d3970. Reviewer reports clean tracked state; manager reran 23 targeted tests successfully before review finished.
Files: panel/main.ts, generated panel/main.js, test/current-board.test.js and narrow helper tests only as needed; report/proof under existing run path.
Tests: node --test test/current-board.test.js test/d12-origins-cache.test.js test/v2-binding-and-ratelimit.test.js; npm run typecheck; npm run build; npm test.
Do not touch: service/**, shared config/agents/skills, secrets/credential files, opencode.db, host settings/grants, real GitHub mutations, installed activation, production, master or other worktrees. Disposable synthetic probes only. Existing root node_modules symlink available; no environment copy or DB registration.
Preflight facts authoritative; targeted checks for edits/precommit/resume/errors permitted, no initial general discovery spin.
</env_preflight>
<goal>Resolve the two hostile-review races in #28 while preserving authoritative full membership and ordinary editing behavior.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/verifications/issue-28/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-28-current-board.md]
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/28
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
First bounded remediation after independent review, findings R1/R2 accepted. Add shipped-bundle red-first regressions for pending full GET followed by successful body edit and status/label edit; old GET must not overwrite fields/display/cache. Also deferred paginated full page two with newer incremental data; final authoritative membership must not overwrite newer accepted fields or regress watermark. Include in-flight/failed edits so speculative failed patches do not become permanently fresh and successful writes remain safe even if completion crosses fetch start/end. Bound state by repo and refresh generation; no unbounded per-issue history. Preserve full snapshot absent-member deletion including zero members: do not fix by blindly unioning old rows back. Preserve accurate pagination/incomplete and last-full-sync semantics. Smallest evidence-backed publication/version admission or bounded invalidation/revalidation, no speculative framework. Explicitly reason about membership versus field freshness, new items from accepted increments, same number across repos, switches, and no endless refresh storms. Do not widen to All Projects/session overhaul or disable existing ordinary editing. No new automatic write behavior. Preserve failed/offline useful data without falsely claiming full sync. Reviewer probes at /tmp/opencode/issue28-review-probes.mjs can be inspected if available, but write permanent regression tests rather than just replaying a defect-asserting probe.
Browser attempt was not visual proof: blank screenshot/unsettled synthetic iframe, no product blankness shown. You may fix only test harness/disposable fixture setup, not product UI unrelated to two defects, and seek meaningful real-browser fixtures if available. Never label incomplete rendering PASS. No credentials; synthetic recording host only. Actual installed-host proof remains separate.
</scope>
<criteria>
R1/R2 fail before source patch and pass after, with source/shipped parity and no weakened tests; successful body/status edits and newer incremental fields survive older full response, completed full membership still removes absent entries, watermarks don't regress or skip unseen activity. Relevant edge tests plus full suite/typecheck/build green, no unrelated diffs. Evidence distinguishes synthetic/browser/installed and L5 remains awaiting human.
</criteria>
<output>
Commit narrow implementation and report .agents/run/task-centred-architecture/outputs/issue-28-review-race-fix.md. Append proof evidence without deleting prior findings at verifications/issue-28/proof.md. Return <=15 lines with commit, tests, red-first proof, unresolved risks and supplied/actual model. Do not merge/push/close. Stop; fresh independent hostile review next.
</output>
