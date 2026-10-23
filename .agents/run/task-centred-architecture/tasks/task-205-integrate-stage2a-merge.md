<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board
Branch: feat/v2-binding-and-ratelimit
Base commit: 51da160
Files: panel/index.html, panel/main.ts, panel/main.js, test/stage2a-attention-ui.test.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Merge feat/stage2a-attention-views into feat/v2-binding-and-ratelimit at the root checkout, rebuild the bundle, verify all tests pass green, and remove the local worktree.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2A.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-204-hostile-review.md]
</context_files>
<skills>
[@.agents/skills/ship/git/git-workflow-and-versioning/SKILL.md]
[@.agents/skills/ship/worktree/management/SKILL.md]
</skills>
<owned_paths>
/workspace/extensions/github-task-board/
.agents/run/task-centred-architecture/outputs/task-205-integration-merge.md
</owned_paths>
<depends_on>
task-204
</depends_on>
<steps>
1. In /workspace/extensions/github-task-board, run `git merge --no-ff feat/stage2a-attention-views -m "merge: Stage 2A Attention Views, alert badges, and drawer acceptance criteria into preview"`.
2. Run `npm run typecheck` (verify exit 0).
3. Run `npm run build` to compile `panel/main.js`. If `panel/main.js` changes, commit the update as `chore(build): rebuild panel/main.js bundle for Stage 2A integration`.
4. Run `node --test` to verify all tests pass (0 failures, 0 skipped).
5. Tear down the local feature worktree:
   `git worktree remove .worktrees/team-dev-stage2a-attention-views`
   `git worktree prune`
   (Note: Do NOT delete branch `feat/stage2a-attention-views`; branches persist per policy).
6. Emit completion report to `.agents/run/task-centred-architecture/outputs/task-205-integration-merge.md`.
</steps>
<criteria>
- Merge commit created on feat/v2-binding-and-ratelimit cleanly with zero conflicts.
- Typecheck and build pass cleanly.
- node --test passes all tests (386+ tests).
- Local worktree .worktrees/team-dev-stage2a-attention-views removed; branch feat/stage2a-attention-views preserved.
- No push to remote, no merge to master.
</criteria>
<verification>
git log -1 --stat && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-205-integration-merge.md:
# Task 205 Output: Stage 2A Integration Merge
## Status: completed | failed
## Merge Commit: <sha>
## Build & Verification:
- npm run typecheck: PASS / FAIL
- npm run build: PASS / FAIL
- node --test: PASS / FAIL (passed/total)
## Cleanup:
- Worktree removal: .worktrees/team-dev-stage2a-attention-views removed (CONFIRMED)
- Branch status: feat/stage2a-attention-views preserved (CONFIRMED)
</output>
