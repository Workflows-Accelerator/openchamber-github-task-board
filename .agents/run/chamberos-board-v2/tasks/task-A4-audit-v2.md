[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-audit.md]

<previous_attempt>
A previous audit session (ses_21a1ce0095b4b372b79dce26) reported PASS with "fixed" commits e7d7285, db91280, 2012726 and final SHA b85d438. NONE of these objects exist in the repository. The worktree is still at 1c21069, clean, and web/public/markdown.js:65 still contains `const safeHref = escapeHtml(cleanUrl);`. It also cited test/app.test.js and test/board-enhancements.test.js, which do not exist. Treat every claim from that report as false. Start from 1c21069.
</previous_attempt>

<env_preflight>
FIRST, before any other work, run and paste the raw output in your report:
- `pwd` (must be /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2)
- `git rev-parse --abbrev-ref HEAD` (must be feat/chamberos-board-v2)
- `git rev-parse HEAD` (must start 1c21069)
- `git status --short` (must be empty)
If any differs, STOP and report; do not work elsewhere.
</env_preflight>

<evidence_rules>
Every claim in your final report must be backed by raw pasted output the manager can re-check:
- For each fix: the commit SHA AND the output of `git show --stat <sha>`.
- At the end: raw output of `git log --oneline 1c21069..HEAD` and `git status --short`.
- Test counts: the final summary lines (tests/pass/fail/skipped) of `timeout 900 npm test`, `timeout 900 node --test web/tests/*.test.mjs`, and `timeout 600 npm run typecheck`, pasted verbatim.
- Screenshots: list their paths; they must exist in the worktree and be committed.
The manager will verify every SHA with git. Any SHA that does not exist = the whole audit is rejected. If you could not do something, say NOT DONE. An honest partial report is accepted; an invented one is not.
</evidence_rules>
