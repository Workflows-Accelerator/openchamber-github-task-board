<env_preflight>
Repo: /workspace/extensions/github-task-board (root branch ops/task-board-activation; leave root .agents/idle-nontext-state.json untouched).
Run from the ROOT checkout /workspace/extensions/github-task-board, NOT from inside the three worktrees to remove.
Published local master + origin/master: 98261a8b417c8005b63bc234399bdf6e4cebb974.
Three worktrees for the #53/#54 batch to archive and normally tear down:
1. /workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish (branch explore/online-board-polish @ 02d367c; evidence commit on top of 8b7e059; clean).
2. /workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash (branch fix/issue-54-no-signin-flash @ 4606b45, ancestor of master 98261a8; has a timestamp-only modification on .agents/run/issue-54-build/verifications/browser-results.json from a later harness run and an untracked .agents/idle-nontext-state.json).
3. /workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look (branch feat/issue-53-openchamber-look @ 1a42ec2, release + release-audit proofs on top of master 98261a8; clean).
Preserve root branch ops/task-board-activation, every other worktree (24 of them), all local+remote git branches (do NOT delete branches), production processes/releases/session data, and manager mission.md/tasks.md/decisions. No product edits, push, fetch, reset, rebase, force removal, remote delete or issue writes.
Secrets wall: never read/probe /workspace/.openchamber-data/**, board.env, .env*, `/proc/*/environ`, saved credentials. Never run `git remote -v`. Zero emojis.
</env_preflight>
<goal>
Archive all review/explore/build/release/audit evidence (and the #54 untracked idle state file) from the three #53/#54 worktrees under root `.agents/run/task-centred-architecture/preserved-online-board-polish/` with a SHA-256 checksum manifest, and normally remove + prune + DB-deregister the three worktrees while keeping their branches (`explore/online-board-polish`, `fix/issue-54-no-signin-flash`, `feat/issue-53-openchamber-look`).
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/online-board-polish-release-receipt.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look/.agents/run/online-board-polish-release-audit/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-repairs-49-50-51-cleanup.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-repairs-49-50-51-staging-teardown.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Confirm `4606b45` and `98261a8` are ancestors of `master` (`98261a8`), and `02d367c` (`explore/online-board-polish`), `1cb1e18` and `1a42ec2` (`feat/issue-53-openchamber-look`) contain `.agents/run/**` evidence only above `master`. Confirm none of the three worktrees has uncommitted product edits.
2. In `.worktrees/team-dev-issue-54-no-signin-flash`:
   - Confirm `git status --porcelain` shows only ` M .agents/run/issue-54-build/verifications/browser-results.json` and `?? .agents/idle-nontext-state.json`.
   - Copy `.agents/idle-nontext-state.json` to root `.agents/run/task-centred-architecture/preserved-online-board-polish/issue-54-untracked/idle-nontext-state.json`, verify `cmp` byte-identical, then remove the original inside the #54 worktree.
   - Restore `.agents/run/issue-54-build/verifications/browser-results.json` in the #54 worktree with `git checkout -- .agents/run/issue-54-build/verifications/browser-results.json` so it matches the committed `4606b45` evidence.
3. Copy complete secret-free `.agents/run/**` directories from:
   - `.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore` -> `preserved-online-board-polish/explore/`
   - `.worktrees/team-dev-issue-54-no-signin-flash/.agents/run/issue-54-{build,hostile,audit}` -> `preserved-online-board-polish/issue-54/`
   - `.worktrees/team-dev-issue-53-openchamber-look/.agents/run/{issue-53-build,issue-53-hostile,issue-53-audit,online-board-polish-release,online-board-polish-release-audit}` -> `preserved-online-board-polish/issue-53/`
   Generate `preserved-online-board-polish/checksums.sha256` covering all archived files and verify `sha256sum -c --strict checksums.sha256`.
4. For each of the three worktrees (`team-dev-explore-online-board-polish`, `team-dev-issue-54-no-signin-flash`, `team-dev-issue-53-openchamber-look`):
   - Remove symlinks `<wt>/node_modules` and `<wt>/web/node_modules` if present (`test -L` first; `rm` on the link itself, no trailing slash, never `-r`).
   - Run `git worktree remove <wt>` without `--force`.
   Then run `git worktree prune`. Confirm `git worktree list` no longer lists those three, all 24 other worktrees remain untouched, and branches `explore/online-board-polish` (`02d367c`), `fix/issue-54-no-signin-flash` (`4606b45`), `feat/issue-53-openchamber-look` (`1a42ec2`) still exist.
5. Deregister the three paths (try both `/workspace/extensions/github-task-board/.worktrees/...` and `/workspace/code/openchamber-github-task-board/.worktrees/...`) from `~/.local/share/opencode/opencode.db` and `~/.local/share/antigravity/antigravity.db` if present using parameterized SQL; if python3/sqlite3 is denied, record and skip.
6. Write a concise receipt at root `.agents/run/task-centred-architecture/outputs/online-board-polish-cleanup-receipt.md` and commit ONLY `.agents/run/task-centred-architecture/preserved-online-board-polish/**`, `.agents/run/task-centred-architecture/outputs/online-board-polish-cleanup-receipt.md`, and `.agents/run/task-centred-architecture/tasks/brief-online-board-polish-{release-audit,cleanup}.md` on root `ops/task-board-activation` (do not edit `mission.md` or `tasks.md`, and do not stage `.agents/idle-nontext-state.json`).
</scope>
<output>
Return <=10 lines: ancestry & product-diff check; archived file count + sha256sum check; worktrees removed + pruned (count remaining); branches retained with SHAs; DB deregistration status; root commit hash; actual provider/model.
</output>
