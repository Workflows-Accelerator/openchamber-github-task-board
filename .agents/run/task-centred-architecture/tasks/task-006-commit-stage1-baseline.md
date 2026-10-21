<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage1-contract-shell
Branch: feat/stage1-contract-shell
Base commit: 98eb0e3
Files: panel/core.ts, test/stage1-dual-mode-and-scoping.test.js
Test command: node --test test/stage1-dual-mode-and-scoping.test.js && node --test
Do not touch: panel/labels.ts, panel/main.ts, docs/issue-body-contract.md, package.json
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Create an atomic, conventional commit capturing the tested Stage 1 implementation in the feature worktree without pushing to remote.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-004-stage1-proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-005-adversarial-fuzz.md]
</context_files>
<skills>
[@.agents/skills/ship/git/caveman-commit/SKILL.md]
[@.agents/skills/ship/git/git-workflow-and-versioning/SKILL.md]
</skills>
<owned_paths>
.agents/run/task-centred-architecture/outputs/task-006-commit-checkpoint.md
</owned_paths>
<depends_on>
task-004, task-005
</depends_on>
<steps>
1. Verify git status shows only panel/core.ts, test/stage1-dual-mode-and-scoping.test.js, and clean working tree.
2. Confirm node --test passes completely.
3. Commit with Conventional Commits message: "feat(core): implement Stage 1 dual-mode parser, section scoping, and attention grouping".
4. Capture commit hash via git log -1 --stat.
5. Write receipt to .agents/run/task-centred-architecture/outputs/task-006-commit-checkpoint.md.
</steps>
<criteria>
- Clean git status after commit.
- Conventional commit message format followed.
- Remote repository is untouched (no git push).
</criteria>
<verification>
git log -1 --stat
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-006-commit-checkpoint.md:
# Task 006 Output: Commit Checkpoint
## Status: completed
## Commit Hash: <sha>
## Commit Message: <message>
## Files Changed:
- List of committed files and diffstat
</output>
