<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board
Branch: feat/v2-binding-and-ratelimit
Base commit: 926e294
Files: panel/core.ts, test/stage1-dual-mode-and-scoping.test.js, panel/main.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Merge feat/stage1-contract-shell into feat/v2-binding-and-ratelimit at the root checkout, rebuild the bundle, verify all tests pass green, and remove the local worktree.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-007-validation-walkthrough.md]
</context_files>
<skills>
[@.agents/skills/ship/git/git-workflow-and-versioning/SKILL.md]
[@.agents/skills/ship/worktree/management/SKILL.md]
</skills>
<owned_paths>
/workspace/extensions/github-task-board/
.agents/run/task-centred-architecture/outputs/task-008-integration-merge.md
</owned_paths>
<depends_on>
task-007
</depends_on>
<steps>
1. In /workspace/extensions/github-task-board, run `git merge --no-ff feat/stage1-contract-shell -m "merge: Stage 1 contract shell, section scoping, and attention grouping into preview"`.
2. Run `npm run typecheck` (verify exit 0).
3. Run `npm run build` to rebuild the bundled extension in `panel/main.js`. If `panel/main.js` changes, commit the update as `chore(build): rebuild panel/main.js bundle for Stage 1 integration`.
4. Run `node --test` to verify all 386 tests pass (360 baseline + 26 Stage 1 tests).
5. Tear down the local feature worktree:
   `git worktree remove .worktrees/team-dev-stage1-contract-shell`
   `git worktree prune`
   (Note: Do NOT delete the branch `feat/stage1-contract-shell`; branches persist per policy).
6. Emit completion report to `.agents/run/task-centred-architecture/outputs/task-008-integration-merge.md`.
</steps>
<criteria>
- Merge commit created on feat/v2-binding-and-ratelimit cleanly with zero conflicts.
- Typecheck and build pass cleanly.
- node --test passes 386/386 tests.
- Local worktree .worktrees/team-dev-stage1-contract-shell removed; branch feat/stage1-contract-shell preserved.
- No push to remote, no merge to master.
</criteria>
<verification>
git log -1 --stat && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-008-integration-merge.md:
# Task 008 Output: Stage 1 Integration Merge
## Status: completed | failed
## Merge Commit: <sha>
## Build & Verification:
- npm run typecheck: PASS / FAIL
- npm run build: PASS / FAIL (bundle commit sha if applicable)
- node --test: PASS / FAIL (passed/total)
## Cleanup:
- Worktree removal: .worktrees/team-dev-stage1-contract-shell removed (CONFIRMED)
- Branch status: feat/stage1-contract-shell preserved (CONFIRMED)
</output>
