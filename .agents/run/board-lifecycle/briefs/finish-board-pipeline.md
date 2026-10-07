<goal>Finish the board pipeline: hostile-review the recovery commit on branch issue-lifecycle-issue-contract-l4r, fix what you find, then merge the branch into local master of /workspace/extensions/github-task-board with the documented conflict rules, rebuild the bundle, and prove everything green — so the panel served from master finally shows the three simplified views.</goal>
<context_files>
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/merge-board-master.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-03-contract.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-04-views.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/l5-batch-1.md
/workspace/extensions/github-task-board/.worktrees/team-dev-contract-l4r
</context_files>
<skills>
/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md
/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md
</skills>
<scope>Repository /workspace/extensions/github-task-board only (main checkout + the .worktrees/team-dev-contract-l4r worktree). You may run git, npm, npx, node --test. No pushes, no PRs, no branch/worktree deletion (manager owns cleanup). panel/main.js is generated — rebuild it, never hand-merge it.</scope>
<criteria>Phase 1: the a27ba31 recovery diff is hostile-reviewed against the blueprint l4-03-contract.md finding by finding; every fix found is committed. Phase 2: master contains the full lineage (7196e06, b55eec5, 3729b6a, a27ba31 + your fixes) via a merge commit referencing #22 and #23; typecheck clean; full suite green (241+ expected); shipped-parity green; bundle rebuilt once from merged sources; the five integration invariants from merge-board-master.md verified and reported with file:line.</criteria>
<steps>
<step>Baseline: run npm run typecheck and node --test test/*.test.js on master; record counts. Then git diff master...issue-lifecycle-issue-contract-l4r --stat to know the full integration surface.</step>
<step>HOSTILE REVIEW of commit a27ba31 (the re-applied contract L4 fixes) — you did not write this, assume it is broken somewhere. Check it against /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-03-contract.md line by line. Specifically: re-applied fixes that differ from the blueprint's intent; the resolveIssueColumn fix missing a third call path that also routes idle sessions; the new regexes (#{1,6}, leading whitespace) over-matching headings inside code blocks or indented list items that are NOT sections; BOM stripping breaking byte positions used elsewhere; empty-item rejection dropping legitimate items like '- [ ] 0'; collectHumanTodos session matching creating NEW cross-issue bugs when sessions carry no number/title/worktree; test assertions that would pass even if the fix were reverted (prove at least one fails when you temporarily revert the fix — then restore it). Commit hygiene: git status must be clean and every claimed fix must appear in a commit (this pipeline already lost uncommitted work once).</step>
<step>Fix every finding with surgical commits referencing issue #22; re-run the suite.</step>
<step>Merge into master following the merge-board-master.md brief's conflict rules exactly (keep both sides in main.ts; branch side for core.ts/labels.ts/types.ts/docs; union tests; never hand-merge panel/main.js). Rebuild the bundle once (npm run build), run typecheck + full suite + shipped-parity, commit the merge.</step>
<step>Verify and report the five integration invariants: idle sessions resolve to 'needs-human' in BOTH resolver copies; parseHumanTasks/collectHumanTodos exported and in shipped-parity; the three view modes present in index.html and main.ts; the three D9 clarifications in docs/issue-body-contract.md; and the panel's static assets (index.html + main.js) are the ones a freshly loaded panel will serve from this checkout.</step>
</steps>
<output>Return a structured block: status; results (review findings list with file:line + severity, merge commit hash, conflicts resolved); evidence (baseline vs final counts for typecheck/suite/shipped-parity, the revert-probe test name); learnings (drift between branches the manager should know).</output>
