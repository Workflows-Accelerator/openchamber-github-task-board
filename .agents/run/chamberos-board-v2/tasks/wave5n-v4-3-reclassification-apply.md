<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: 7fdf07c (dry run + the five ambiguous issues resolved). Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
`gh` is authenticated as workflows-accelerator-agent with repo scope. Never print a token; never run `git remote -v`.
Never read /workspace/.openchamber-data/board/board.env, jwt-secret or cookies.
ENGINE RESTARTS HAVE KILLED WORKERS MID-TURN. Work repository by repository, commit the receipt incrementally after each repository, so an interruption loses at most one repository.
</env_preflight>

<goal>
Apply the deterministic reclassification the owner authorized (D40): move 67 issues from a waiting or review status to status:todo, with exactly one audit comment per changed issue and a reverse mapping. Change nothing else on GitHub.
</goal>

<context>
The authoritative list is the dry run: .agents/run/chamberos-board-v2/verifications/V4-3/reclassification-dry-run.md — section 3 counts, section 4 the full table, section 8 the five resolved issues. 67 changes: 45 x status:needs-human -> status:todo, 22 x status:in-review -> status:todo. Affected repositories: openchamber-github-task-board (22), openchamber-config (17), devops-cockpit (14), ironcore-frontline (10), chambervoice (2), case-management-platform (2).
Owner authorization (verbatim scope): label operations only via `gh issue edit`; exactly one comment per changed issue carrying the policy and the previous status; a reverse mapping; nothing closed; no body rewritten; no comment deleted; no repository settings touched. Report every refusal verbatim.
</context>

<rules>
1. Re-read each issue immediately before editing it: `gh issue view <n> --repo <repo> --json state,labels,updatedAt`. Apply only if the state is OPEN and the label is still exactly the expected old status. If the state or the label changed since the dry run, SKIP it and record why. Never guess.
2. One command per issue: `gh issue edit <n> --repo <repo> --add-label status:todo --remove-label <old>`. Never `--body`, never `--title`, never `--add-assignee`.
3. Exactly one comment per changed issue, posted only AFTER the label change succeeded. Body, exactly this shape, with the issue's own values:
   `<!-- board-reclassification:2026-11-13 -->` newline
   `**Reclassified by the board policy.** This task was marked `<old>` without a clickable human artifact (a screenshot, a video, a link, or a question with preset answers). It is now `status:todo`, so it no longer claims to wait for you.` newline
   `Previous status: `<old>`. Reverse: re-add `<old>` — the board will then show that the artifact is missing. Nothing else was changed.`
   If the issue already carries a comment with that marker, do not post a second one: record "comment already present" and move on.
4. Idempotency: if a label is already status:todo and the marker comment exists, record "already applied", change nothing.
5. NEVER close, NEVER reopen, NEVER edit a body or title, NEVER create a label, NEVER touch a repository setting or secret.
</rules>

<steps>
1. Build the work list from the dry run. Confirm the count is 67 and the split 45/22; if the file disagrees with that, stop and report.
2. Write the reverse mapping first: verifications/V4-3/reclassification-reverse.md with one row per issue (repo, number, previous label, new label, comment id, timestamp). Commit it before starting, then update and commit after each repository.
3. Apply, repository by repository in this order: openchamber-github-task-board, openchamber-config, devops-cockpit, ironcore-frontline, chambervoice, case-management-platform. After each repository: re-read every changed issue and confirm state OPEN, label status:todo present, old label absent, exactly one marker comment. Commit the updated reverse mapping with the verification result.
4. Write verifications/V4-3/reclassification-apply.md: the exact commands run, per-repository counts applied/skipped/already-applied/refused, every refusal quoted verbatim with the response, the final verification table, and the one-line reverse instruction. Commit it.
5. Final check across all 67: no issue closed, no body changed (compare updatedAt only where you can; you cannot diff bodies — say so), exactly one marker comment each, zero label created. Report honestly what you could not verify.
</steps>

<output>
At most 14 lines: STATUS, APPLIED (count per repository), SKIPPED (each with reason), REFUSED (verbatim or none), COMMENTS (count, duplicates prevented), VERIFIED (labels, states, marker count), REVERSE (path and one-line instruction), COMMITS, NOT_VERIFIED. State plainly whether GitHub now matches the dry run.
</output>
