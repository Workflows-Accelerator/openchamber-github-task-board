<goal>Recover the lost contract-layer hostile-review fixes (12 findings) for issue #22 by first attempting git object/index recovery and otherwise re-applying them from the recorded blueprint, on a fresh branch that also contains the committed three-views work — then prove the full suite green.</goal>
<context_files>
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-03-contract.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/issue-body-contract-v1.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/decisions.md
</context_files>
<skills>
/workspace/config/opencode/.agents/skills/build/domain/debugging-and-error-recovery/SKILL.md
/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md
</skills>
<scope>You work in a fresh worktree of the github-task-board repo branched from issue-lifecycle-issue-views-v1. You own panel/core.ts, panel/labels.ts, panel/types.ts, panel/main.ts (the resolveIssueColumn region only), panel/main.js (rebuild only), docs/issue-body-contract.md, and test/**. Never push. The lost work's worktree directory is gone, but its git metadata may survive under /workspace/extensions/github-task-board/.git/worktrees/issue-lifecycle-issue-contract-v1/ — you may read and recover from it.</scope>
<criteria>Every finding in l4-03-contract.md is either recovered from git objects or re-applied and tested; the full suite (node --test test/*.test.js) is green including the views tests (baseline 234 on this lineage before your changes; expect more after); typecheck clean; panel/main.js rebuilt via the repo build script and shipped-parity green; docs/issue-body-contract.md contains the three D9 clarifications; everything committed on the new branch with clear messages.</criteria>
<steps>
<step>Baseline: run node --test test/*.test.js and npm run typecheck in your worktree; record counts (expect 234 passing).</step>
<step>RECOVERY ATTEMPT FIRST: inspect /workspace/extensions/github-task-board/.git/worktrees/issue-lifecycle-issue-contract-v1/ — if an index exists, list its staged entries (git ls-files --stage with that git dir) and diff them against commit 7196e06; run git fsck --unreachable in the main repo to find dangling blobs from git add. If you can identify and extract the lost file contents (they would contain markers like inHumanTasksSection, `replace(/\\r/g, '')`, BOM stripping `\\uFEFF`, or docs clarifications), restore those contents instead of rewriting. Record in your report exactly what recovery succeeded or failed.</step>
<step>Re-apply whatever recovery did not yield, per the blueprint l4-03-contract.md findings 1-12, TDD: write the failing test first (the blueprint's item 12 lists the test cases: duplicate Human Tasks sections, whitespace/heading variants, HTML entities, BOM, mixed CRLF, empty checklist items, cross-issue session fallback matching, status-metadata-vs-spec assertions, shipped-parity coverage for answerOpenQuestionInMarkdown), then the fix.</step>
<step>Apply the HIGH fix in panel/main.ts resolveIssueColumn (lines ~1767,1828 region): idle sessions must resolve to 'needs-human', never 'in-review' (decision D3). Update any test still asserting the old routing.</step>
<step>Fold the three D9 clarifications into docs/issue-body-contract.md exactly as the blueprint item 11 specifies.</step>
<step>Rebuild panel/main.js via the repo build script, run typecheck + full suite, record counts.</step>
<step>Hostile pass over your own diff: confirm no views functionality regressed (run test/simplified-views.test.js explicitly), confirm shipped-parity covers every core.ts export you touched, and confirm no \\r-only or BOM path remains untested.</step>
<step>Commit everything on your branch with feat/fix messages referencing issue #22. Nothing is pushed.</step>
</steps>
<output>Return a structured block: status; results (recovered-vs-reapplied split with file:line); evidence (test counts baseline/after, typecheck, build, shipped-parity); learnings (what git recovery could and could not retrieve).</output>
