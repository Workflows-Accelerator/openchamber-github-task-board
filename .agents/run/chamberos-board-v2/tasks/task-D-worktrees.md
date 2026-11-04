[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step <STEP> of batch D (parent #55): worktree management from the board. D1 (#69) create and prepare worktrees, incl. pre-creating the next ready-to-run task's branch. D2 (#70) commit, push the feature branch, open a PR. D3 (#71) merge into master and clean up merged worktrees, each behind a confirmation click. This brief covers the step named in the dispatch line at the bottom.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D25, D26, D27)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md] (Q3: OpenChamber worktree registration API vs DB; reachability)
Worktree lifecycle rules (single source of truth; follow its naming, symlink, env-copy and registration steps; the DB path there is hardcoded to /home/opencode/... — the real one is ~/.local/share/opencode/opencode.db with HOME=/workspace; prefer an OpenChamber/OpenCode API over direct SQLite if preflight found one):
[@/workspace/code/openchamber-config/.agents/skills/ship/worktree/management/SKILL.md]
Previous proofs: verifications/A1..C4 and earlier D steps.
Repo -> folder map from C3 (BOARD_REPO_DIRS).
</context_files>

<rules>
- All git operations run server-side via child_process with argument arrays (never a shell string), inside a folder from the repo map only, with path validation (worktree paths must resolve under <repo>/.worktrees/). One operation at a time per repo (lock).
- Never force-push, never delete remote branches, never rebase/reset, never touch repo settings.
- D27: merge into master, push of master, and any deletion (worktree remove, branch -d, deregistration) require an explicit user click on a confirmation that names exactly what will happen; the server requires a short-lived confirmation token bound to that exact action. Everything else (create worktree, symlink, env copy, commit, push feature branch, open PR) runs on one click.
- Hidden in Client view.
- All tests run against throwaway git repos created under /tmp/opencode/board-v2-wt-tests/ (with a bare repo as fake remote) and a fake GitHub for PRs. NEVER run these operations against a real repository during this step, and never against the board's own worktree.
</rules>

<scope_by_step>
D1: Server routes + UI: create worktree + branch for an issue (name <user>-<env>-issue-<n>-<slug>, branch feat/issue-<n>-<slug> per the skill), symlink shared deps (node_modules etc. per the skill), copy env files, register in OpenChamber. "Prepare next": when an issue is marked ready-to-run, or on button press, pre-create the branch (and optionally worktree) for the next ready-to-run issue in the same repo whose base differs. Drawer shows the issue's worktree, branch, ahead/behind, dirty state.
D2: Commit all changes in the issue's worktree with a message built from the issue (conventional, editable before commit), push the feature branch (set upstream), open a PR via GitHub API linking the issue ("Closes" NOT used — use "Part of #N" so no auto-close; humans close issues). Show PR link and checks state.
D3: Merge: merge the feature branch into master locally with --no-ff after fetching; if master moved remotely, merge origin/master into the feature branch first (no rebase); refuse on conflicts with a plain message. Push master only after a second confirmation. Cleanup: only for branches already merged into master: worktree remove, prune, branch -d, OpenChamber deregistration — after confirmation. Never touches unmerged or dirty worktrees.
</scope_by_step>

<criteria>
- Everything in <common_criteria>.
- Tests on throwaway repos for every route incl. path traversal, dirty tree, conflicts, missing confirmation token, replayed token, concurrent operations.
- Browser proof on the fake setup.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/<STEP>/proof.md.</output>
