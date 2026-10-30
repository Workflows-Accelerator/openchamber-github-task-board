<env_preflight>
READY — owner human validation (L5) explicitly approved: "Approve and release both (Recommended)"
Hostile review (L4) passed with PROCEED verdict (ses_daf87b8388e21009091d6d54).
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode
Working branch: master
Feature branch to merge: feat/issue-39-front-desk (HEAD 7aae323, contains fc12056 and 7aae323)
Commands:
- Discard external UI schema artifact on opencode.json: git checkout HEAD -- opencode.json
- Stage and commit runtime supervisor environment loader: git add tools/board/start.sh && git commit -m "chore(board): load runtime board.env and tokens in start.sh"
- Merge feature branch: git merge --no-ff feat/issue-39-front-desk -m "feat(frontdesk): add front desk intake agent and issue management skill (Issue #39)"
- Verify tests: npm test ; node tests/audit.mjs ; node tests/solo-tools.test.mjs ; python3 -c "import json; json.load(open('opencode.json'))"
- Push: git push origin master
</env_preflight>

<goal>
Safely integrate and publish Issue #39 into /workspace/config/opencode master, verify full test suite and audit suite, and push master to GitHub origin.
</goal>

<scope>
1. In /workspace/config/opencode:
   - Check git status.
   - Revert accidental external rewrite on `opencode.json`: `git checkout HEAD -- opencode.json`.
   - Commit the runtime supervisor environment helper in `tools/board/start.sh` with message: `chore(board): load runtime board.env and tokens in start.sh`.
2. Merge `feat/issue-39-front-desk`:
   `git merge --no-ff feat/issue-39-front-desk -m "feat(frontdesk): add front desk intake agent and issue management skill (Issue #39)"`
   Confirm merge succeeds cleanly without conflicts.
3. Run full verification suite:
   - `npm test` (all 659+ unit tests must pass)
   - `node tests/audit.mjs` (all 7 architectural invariants must pass)
   - `node tests/solo-tools.test.mjs` (all 19 tests must pass)
   - `python3 -c "import json; json.load(open('opencode.json'))"` (valid JSON)
4. Push master to origin:
   `git push origin master`
5. Verify published commit with `git log -1 --stat`.
6. Record release receipt in /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-39-release-receipt.md.
</scope>

<criteria>
Master updated and merged cleanly; 0 test failures across all suites; 100% audit pass; origin master pushed; receipt saved.
</criteria>

<output>
At most 10 lines:
Master commit SHA before and after; merge commit SHA; git push exit; test and audit counts; receipt path.
</output>
