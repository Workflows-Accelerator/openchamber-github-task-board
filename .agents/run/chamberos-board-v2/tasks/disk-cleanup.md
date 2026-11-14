<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board
Branch: ops/task-board-activation (run-state only)
Context: `/workspace` is at 100% with ~692 MB free. The live board runs from `/workspace/releases/board/422b3a0-20261114` with rollback target `/workspace/releases/board/b85676f-20261113`. The user approved a disk cleanup on 2026-11-14.
Forbidden:
- NEVER read, print or copy `board.env`, `jwt-secret`, tokens, passwords or cookies.
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, the live release directory, or the rollback release directory.
- NEVER force-push, NEVER delete remote branches, NEVER run `git remote -v`.
- NEVER stop, restart or kill the board service or its supervisor.
- NEVER delete a worktree or branch that has uncommitted changes, untracked files, or commits not reachable from `master` or from its own remote.
- NEVER spawn subagents.
</env_preflight>

<goal>
Reclaim disk space safely, in tiers, with proof before every deletion. Free space first, then report what you refused to delete and why. The board must stay live throughout — nothing you do may restart or break it.
</goal>

<steps>
1. **Measure first.** Record `df -h /workspace` before anything. Then produce a size-ranked inventory (`du -sh` on the top offenders, sorted) of: `/workspace/releases/board/*`, `/workspace/code/openchamber-github-task-board/.worktrees/*`, `/workspace/code/openchamber-github-task-board/node_modules`, any `node_modules` inside worktrees, `/tmp/opencode/**`, `/workspace/tmp/**`, and `/workspace/.cache` if it exists. Report the total you could plausibly reclaim per tier.
2. **Tier A — ephemeral scratch (delete without further approval).** `/tmp/opencode/**` build outputs, screenshot scratch, `dpkg -x`/`apt` extracts, `/tmp` release archives and staged tarballs, and any `/workspace/tmp/**` entries that are pure build artefacts. Skip anything that looks like the only copy of a deliverable (a report, a screenshot set that is not committed elsewhere): if it is referenced by a committed `verifications/` report, it is NOT ephemeral — keep it.
3. **Tier B — merged worktrees (approved by the user's cleanup message).** For each worktree under `/workspace/code/openchamber-github-task-board/.worktrees/`:
   - `git status --porcelain` must be empty (or contain only gitignored build output),
   - the branch must be fully merged into `master` (`git branch --merged master`) or into `feat/wave7-overhaul`/`feat/board-v3` where that branch is itself merged,
   - `git log master..<branch>` must be empty (no unique commits),
   - the branch must not be checked out by a running agent session (check for a `.git` lock or an active process with that cwd).
   Only then remove it with `oc-worktree remove <feature>` (read `oc-worktree --help` first; use the repo-local `./bin/oc-worktree` spelling if that is what exists). Remove at most the provably merged ones, and list each with its size and merge proof. If `oc-worktree remove` refuses or is unavailable, report the exact error instead of improvising `git worktree remove`.
4. **Tier C — old releases (report only, do NOT delete).** List `/workspace/releases/board/*` by size and date. Keep the live release, the rollback target `b85676f-20261113`, and at least one older release. Present the rest as a candidate list for a later, separate approval — deleting a release is irreversible and outside this message's approval.
5. **Tier D — never touch, report only:** `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `/workspace/code/**` source checkouts, `node_modules` of active worktrees (report their size only), and any untracked file inside a worktree.
6. **Verify afterwards:** `df -h /workspace` after cleanup, `curl -fsS http://127.0.0.1:8787/health` (must still be 200 — you must not have disturbed the service), and confirm `/workspace/releases/board/current` still resolves to `422b3a0-20261114`. If health fails, stop immediately and report.
7. **Write the receipt** at `.agents/run/chamberos-board-v2/verifications/disk-cleanup-2026-11-14/README.md`: before/after `df`, every path deleted with its size and its safety proof, every candidate refused with the reason, the Tier C list awaiting approval, and the post-cleanup health result. Commit it with explicit paths.
</steps>

<output>
At most 12 lines: STATUS, BEFORE_AFTER (free space), DELETED (count + total + tiers), WORKTREES_REMOVED (names + merge proof), REFUSED (list + why), TIER_C_PENDING (releases + sizes), HEALTH_AFTER, COMMIT, NOT_VERIFIED.
</output>
