<env_preflight>
Repo: /workspace/extensions/github-task-board
Location: staging worktree /workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51 (keep this caller checkout intact until after this worker ends).
Published local master + origin/master: 8b7e059b17b7f4fad61a7466cd35cb34467807ef.
Merged source worktrees eligible for normal teardown after evidence archival:
1. /workspace/extensions/github-task-board/.worktrees/team-dev-issue-49-login-label (branch fix/issue-49-login-label @ 84d2e39)
2. /workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection (branch fix/issue-50-host-connection @ f0dae5b)
3. /workspace/extensions/github-task-board/.worktrees/team-dev-issue-51-toolbar-controls (branch fix/issue-51-toolbar-controls @ c37ad8b)
Preserve root branch ops/task-board-activation, every unrelated worktree, all local+remote git branches (do NOT delete branches), production processes/releases/session data, and manager run state. No product edits, push, fetch, reset, rebase, force removal, remote delete or issue writes.
Secrets wall: never read/probe /workspace/.openchamber-data/**, board.env, .env*, `/proc/*/environ`, saved credentials. Never run `git remote -v`. Zero emojis.
</env_preflight>
<goal>
Archive all unique review/build/release/audit evidence from the #49, #50, #51, and staging worktrees under root `.agents/run/task-centred-architecture/preserved-repairs-49-50-51/` with SHA-256 checksum manifest, and normally remove + prune + DB-deregister the three merged #49/#50/#51 source worktrees while keeping their branches and leaving the staging worktree ready for manager final teardown.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/repairs-49-50-51-release-receipt.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51/.agents/run/repairs-49-50-51-release-audit/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Prove `84d2e39`, `f0dae5b`, and `c37ad8b` are ancestors of published `master` (`8b7e059`) and confirm none of the three source worktrees has uncommitted product edits.
2. Copy complete secret-free `.agents/run/**` directories (proofs, findings, plans, harnesses, screenshots, JSON data) from the three source worktrees AND from `.worktrees/team-dev-staging-repairs-49-50-51/.agents/run/**` into root `/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/preserved-repairs-49-50-51/{issue-49,issue-50,issue-51,staging}/`, generate `checksums.sha256`, and verify `sha256sum -c --strict checksums.sha256`.
3. Remove ONLY the three merged source worktrees (`team-dev-issue-49-login-label`, `team-dev-issue-50-host-connection`, `team-dev-issue-51-toolbar-controls`) using normal `git worktree remove <path>` + `git worktree prune` (First remove any symlinked `node_modules` inside each worktree if needed so normal `git worktree remove` succeeds without `--force`; never use `--force` to discard real files). Keep all git branches (`fix/issue-49-login-label`, `fix/issue-50-host-connection`, `fix/issue-51-toolbar-controls`, `staging/repairs-49-50-51`). Deregister removed worktree paths from `~/.local/share/opencode/opencode.db` / `~/.local/share/antigravity/antigravity.db` if present using safe parameterized SQL (if permission denied on python3/sqlite3, record and skip without failing).
4. Write a concise receipt at root `.agents/run/task-centred-architecture/outputs/repairs-49-50-51-cleanup-receipt.md` and commit ONLY `.agents/run/task-centred-architecture/preserved-repairs-49-50-51/**` and `.agents/run/task-centred-architecture/outputs/repairs-49-50-51-cleanup-receipt.md` on root `ops/task-board-activation` (do not edit `mission.md` or `tasks.md`). Keep `.worktrees/team-dev-staging-repairs-49-50-51` intact until this worker finishes.
</scope>
<output>
Return <=12 lines: ancestry check; archived file count + sha256sum check; worktrees removed + pruned; branches retained; DB deregistration status; root commit hash; staging worktree status for manager removal; actual provider/model.
</output>
