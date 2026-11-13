<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: ffaa2f8. Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
`gh` is authenticated as workflows-accelerator-agent with repo scope. Never print a token; never run `git remote -v`.
ALLOWED gh commands: `gh issue list`, `gh issue view`, `gh pr list`, `gh pr view`, `gh label list`, `gh repo view`. Nothing else.
READ-ONLY ON GITHUB: no `gh issue edit`, no comment, no label change, no body change, no close, no merge, no `gh api`.
Never read /workspace/.openchamber-data/board/board.env, jwt-secret or cookies.
</env_preflight>

<goal>
Resolve the five "needs your call" issues of the reclassification inventory with evidence, so the manager can decide them instead of handing the user a vague list.
</goal>

<context>
Inventory: .agents/run/chamberos-board-v2/verifications/V4-3/reclassification-dry-run.md, section 3 and the rows for these five. All five are in Workflows-Accelerator/openchamber-github-task-board: #56, #57, #58 (status:in-review, no comments, 9 days idle), #59 (an agent comment says a review is active since 2026-11-04 with no completion), #60 (an agent comment says a review is running since 2026-11-05 with no completion).
The previous inventory could not check pull requests; that is exactly what is missing.
</context>

<steps>
1. For each of #56–#60: `gh pr list --repo Workflows-Accelerator/openchamber-github-task-board --state all --search "<number> in:body"` and also read the issue's timeline through `gh issue view <n> --comments` and `--json state,labels,updatedAt,closedAt`. Record what actually links the issue to a branch or a PR, if anything.
2. Decide each one with the rule already agreed: `status:in-review` with no clickable artifact goes to `status:todo` only when the review is demonstrably finished or abandoned; a genuinely in-flight review stays. "In flight" means evidence that something is happening now — an open PR that touches the work, an agent comment within the last few days, a running session recorded on the issue. A comment from 9 days ago that says "review active" and nothing since is not in-flight evidence.
3. Append a section "8. PR and timeline check for the five ambiguous issues" to the inventory file: one row per issue with the PR evidence, the last activity date, your verdict (change to todo / leave as agent review in flight) and one sentence of reasoning. Update section 3's counts to the new totals if any of the five moves bucket.
4. Commit as `test(v4-3): resolve the five ambiguous issues with PR and timeline evidence`.
</steps>

<output>
At most 10 lines: STATUS, TABLE (5 rows: issue, PR evidence, last activity, verdict), NEW_COUNTS, COMMIT, NOT_VERIFIED. Nothing written to GitHub.
</output>
