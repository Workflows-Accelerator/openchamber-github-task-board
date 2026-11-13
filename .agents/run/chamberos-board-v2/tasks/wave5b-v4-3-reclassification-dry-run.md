<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 007f342 (V4-3 LIVE as b85676f-20261113; local and origin master at 007f342)
Untracked and OFF LIMITS: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — never stage, never touch.
Root checkout on ops/task-board-activation — DO NOT modify or commit there.
`gh` is authenticated as workflows-accelerator-agent with repo scope (checked 2026-11-13). Never print a token; never run `git remote -v`.
THIS STEP IS READ-ONLY ON GITHUB: `gh issue list`, `gh issue view`, `gh label list`, `gh repo view` only. No `gh issue edit`, no comment, no label creation, no body change, no close. The owner authorized writes for the next step, not this one.
</env_preflight>

<goal>
Produce the deterministic reclassification inventory for every open issue in every repository the board is configured for, so the manager can approve a table before anything is written. Do not change anything on GitHub.
</goal>

<steps>
1. Establish the configured repository set from the board's own configuration source (not from .openchamber-data secrets — never read board.env, jwt-secret or cookies). Verify each repository is reachable with the current token and that it has issues enabled. Record the exact source you used and the resulting list.
   If the repository set exists only inside `/workspace/.openchamber-data/board/board.env`, do NOT read that file. Derive it from a non-secret source instead (start.sh and supervisor.sh in /workspace/code/openchamber-config/tools/board — read-only; the repository's own configuration, docs or examples; or `gh repo list` for the account). If no non-secret source establishes the exact set, stop and report which single key you would need and why, rather than guessing a list.
2. For every open issue in those repositories, record: repo, number, title, current `status:*` label (or none), whether the body contains a clickable human artifact as V4-3a now defines it (image, video, link, each with a one-line instruction), and whether an agent review is demonstrably in flight (a recent agent comment, an open PR referencing it, another status label). Use `gh` and the API only; do not guess.
3. Apply the deterministic rule:
   - `status:needs-human` with no clickable artifact -> `status:todo`.
   - `status:in-review` with no artifact -> `status:todo` only when the review is demonstrably finished or abandoned (state your evidence per issue).
   - `status:in-review` with a genuinely in-flight agent review -> leave it, bucket "agent review in flight".
   - Anything ambiguous, any missing label in the target repository, any issue with two status labels, any issue whose body you cannot parse -> "needs your call". Do not force it.
4. Write `.agents/run/chamberos-board-v2/verifications/V4-3/reclassification-dry-run.md`: the repository list and its source, the full table, counts per bucket (will change / stays / agent review in flight / needs your call), and per-repository label inventory showing that every target label already exists (never propose creating a label).
5. Sanity check the table against the live board payload you can build locally from the synthetic fixture: the rule must agree with the parser V4-3a shipped. If they disagree, fix the parser, not the table.
6. Commit the dry run under verifications/V4-3/ on feat/board-v3. No source change unless step 5 found a parser bug, which then gets its own commit with a test.
</steps>

<output>
At most 18 lines Markdown: STATUS, REPOS (with the source you used), COUNTS per bucket, WILL_CHANGE (5-row sample plus the file path), NEEDS_YOUR_CALL (list), LABELS_OK (target label present everywhere: yes/no per repo), PARSER_AGREEMENT, COMMIT, NOT_VERIFIED. State plainly that nothing was written to GitHub.
</output>
