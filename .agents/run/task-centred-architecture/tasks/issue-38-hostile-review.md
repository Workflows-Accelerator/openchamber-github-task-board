<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-38-draft-default
Branch: feat/issue-38-draft-default
Candidate commit: db53d401f24374f4262a26f4c27a910bc035822a
Goal: Conduct adversarial hostile review (L4) on the candidate commit db53d401f24374f4262a26f4c27a910bc035822a.
Commands: npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; node --test test/shipped-parity.test.js
</env_preflight>

<goal>
Conduct a hostile review of any edits or changes made in commit db53d401f24374f4262a26f4c27a910bc035822a to figure out what might have been missed or what might be broken. Don't assume that what was done is right.
</goal>

<scope>
1. Inspect git diff HEAD~1..HEAD.
2. Adversarially test:
   - What happens if an issue has `status:todo` explicitly assigned via label, but has no priority label? Does it get demoted to draft or does it remain todo?
   - What happens to an issue with active questions or needs-human status?
   - What happens to closed issues?
   - Are there any edge cases with label parsing (case-sensitivity, prefix variations)?
   - Verify prompt parity and shipped parity.
3. If defects are found, report them clearly. If zero defects are found, give the PROCEED / APPROVED verdict.
</scope>

<output>
Report findings, test results, and final verdict: Security (APPROVED/NEEDS-FIXES), Spec (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES), Recommendation (PROCEED/HALT).
</output>
