<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-38-draft-default
Branch: feat/issue-38-draft-default
Candidate commit: 7dbf0d9424a2c21c75f50d30e65c37edb5e1b34b
Base commit: 95bcf974fd5f5414fd5e55a0fad5b33e6817ea3c
Goal: Conduct adversarial hostile review (L4) on the candidate commit 7dbf0d9424a2c21c75f50d30e65c37edb5e1b34b.
Commands: npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; node --test test/shipped-parity.test.js
</env_preflight>

<goal>
Conduct a hostile review of any edits or changes made in commit 7dbf0d9424a2c21c75f50d30e65c37edb5e1b34b (and preceding db53d40) to figure out what might have been missed or what might be broken. Don't assume that what was done is right.
</goal>

<scope>
1. Inspect git diff 95bcf97..7dbf0d9 across all modified files.
2. Adversarially verify:
   - Priority alias normalization: do all aliases (`urgent`, `high`, `medium`, `low`) map correctly to canonical buckets (`critical`, `important`, `useful`, `optional`)?
   - What happens if an issue has both an alias and a canonical label, or multiple conflicting priority labels?
   - Does `groupIssuesBy` drop any issue or place it in the wrong group?
   - Does `drawerPrioritySelect` correctly reflect priority for issues with alias labels without desynchronization or dropping the value?
   - Does `resolveIssueColumn` accurately default unprioritized issues to `draft` without demoting issues with alias priorities, closed issues, or active sessions?
   - Does `filterDisplayLabels` exclude both canonical priorities and aliases from general badge display?
   - Check bundle build: ensure `npm run build` produces deterministic output matching committed `panel/main.js`.
   - Run the test suite:
     - `npm test`
     - `node --test web/tests/*.test.mjs`
     - `npm run typecheck`
     - `npx tsc -p web/tsconfig.json`
     - `node --test test/shipped-parity.test.js`
3. Report findings, test results, and final verdict: Security (APPROVED/NEEDS-FIXES), Spec (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES), Recommendation (PROCEED/HALT).
</scope>

<output>
State findings, test counts, and the four-part verdict. If clean, state PROCEED.
</output>
