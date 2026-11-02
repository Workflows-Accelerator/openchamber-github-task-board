<env_preflight>
Repo: /workspace/extensions/github-task-board (root branch ops/task-board-activation @ 79b3f60 or later).
Target worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51 (branch staging/repairs-49-50-51 @ 7c05c5f). Run from the ROOT checkout, not from inside the target.
Known state of target (`git status --short --ignored`): untracked `.agents/idle-nontext-state.json`; ignored `.opencode/`, `node_modules` (symlink), `web/dist/`, `web/node_modules` (symlink).
Evidence from this worktree is already archived at root `.agents/run/task-centred-architecture/preserved-repairs-49-50-51/staging/` (checksums pass).
Do not touch: root `.agents/idle-nontext-state.json`, any other worktree, any branch (never delete branches), production releases/processes, `/workspace/.openchamber-data/**`, `.env*`, credentials, `/proc/*/environ`. Never run `git remote -v`. No push, fetch, reset, rebase, `--force`, issue writes. Zero emojis.
</env_preflight>
<goal>
Normally remove and prune the staging worktree while preserving its one untracked file, keep branch staging/repairs-49-50-51, and deregister the path from the OpenCode DB.
</goal>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
</skills>
<scope>
1. Confirm `git -C <target> status --porcelain` lists only `?? .agents/idle-nontext-state.json` (stop and report if anything else, especially tracked edits).
2. Copy that file to root `.agents/run/task-centred-architecture/preserved-repairs-49-50-51/staging-untracked/idle-nontext-state.json`, verify byte-identical (`cmp`), then delete the original inside the target only.
3. Remove the two symlinks `<target>/node_modules` and `<target>/web/node_modules` with `rm` on the link itself (no trailing slash, never `-r` through a symlink; confirm with `test -L` first). Ignored `.opencode/` and `web/dist/` are build/runtime artefacts; `git worktree remove` without `--force` handles ignored files.
4. `git worktree remove <target>` (no --force), then `git worktree prune`. Confirm `git worktree list` no longer shows it and `git branch --list staging/repairs-49-50-51` still exists at 7c05c5f.
5. Deregister the path from `~/.local/share/opencode/opencode.db` (and `~/.local/share/antigravity/antigravity.db` if present) with parameterized SQL as in the skill; if python3/sqlite3 is denied, record and skip.
6. Commit ONLY the new `preserved-repairs-49-50-51/staging-untracked/` file on root ops/task-board-activation with message `chore(run): preserve staging untracked state before teardown`.
</scope>
<output>
Return <=8 lines: porcelain check result; preserved-file cmp result; symlinks removed; worktree removed + pruned; branch retained (hash); DB deregistration status; root commit hash; actual provider/model.
</output>
