<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode
Working branch: master
Head commit: e7b459b1eadcbdb9d24001438cfba8e73d7a0845
Goal: Commit the supervisor test scoping fix in tools/board/start.sh, run full test gates, push master to origin, and record receipt.
Commands:
- git commit -m "fix(board): scope runtime board.env loading to default state dir" tools/board/start.sh
- npm test ; node tests/audit.mjs
- git push origin master
</env_preflight>

<goal>
Commit the remaining fix on tools/board/start.sh, run full test suite and audit, push master to GitHub origin, and record the release receipt.
</goal>

<scope>
1. In /workspace/config/opencode:
   - Commit tools/board/start.sh:
     `git commit -m "fix(board): scope runtime board.env loading to default state dir" tools/board/start.sh`
   - Run tests:
     `node --test tests/board-supervisor.test.mjs` (23 pass)
     `node --test tests/config-shape.test.mjs` (30 pass)
     `node --test tests/solo-tools.test.mjs` (19 pass)
     `npm test`
     `node tests/audit.mjs`
   - Push to origin:
     `git push origin master`
   - Record receipt in /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-39-release-receipt.md.
</scope>

<criteria>
Master clean, all tests pass, pushed to origin master.
</criteria>

<output>
At most 10 lines:
Commit hash; push exit; test pass counts; audit status.
</output>
