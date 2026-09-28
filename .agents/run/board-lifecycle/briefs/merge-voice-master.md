<goal>Merge the chambervoice branch `issue-lifecycle-voice-allprojects` (3 commits: issue index, All Projects crash fix, L4 hardening) into local `master` of /workspace/extensions/chambervoice, verify the full suite, and commit the merge. Nothing is pushed, ever.</goal>
<context_files>
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-02-crashfix.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/portfolio/issue-index.md
</context_files>
<scope>Repository: /workspace/extensions/chambervoice only. You may run git, npm, and node --test there. Do not touch /workspace/extensions/github-task-board. Do not push, do not create PRs, do not delete branches or worktrees (the manager owns cleanup).</scope>
<criteria>master contains the merged branch history; npm run verify (tsc --noEmit + node --test test/*.test.js) is green after the merge (427 tests expected, 0 failures); the merge commit message references issue #17; report contains the merge commit hash and test counts.</criteria>
<steps>
<step>Baseline: in /workspace/extensions/chambervoice on master, run npm run verify and record counts.</step>
<step>git log --oneline master..issue-lifecycle-voice-allprojects to confirm the three expected commits (a288b16, 5cff2db, 3356e58) and nothing else.</step>
<step>Merge with: git merge --no-ff issue-lifecycle-voice-allprojects -m "merge: voice All Projects crash fix and hardening (#17)". If a conflict appears, STOP and report the conflicting files — do not guess at resolutions.</step>
<step>Run npm run verify again; record counts. Confirm the working tree is clean and the merge commit exists (git log -1).</step>
</steps>
<output>Return a structured block: status; results (merge commit hash, files merged); evidence (baseline vs post-merge test counts); learnings (anything odd in the merge).</output>
