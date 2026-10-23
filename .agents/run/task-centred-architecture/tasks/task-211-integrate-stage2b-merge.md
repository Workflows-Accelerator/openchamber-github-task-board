<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board
Branch: feat/v2-binding-and-ratelimit
Base commit: 9d4f8da
Files: package.json, service/**, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (never push to master)
Note: pushing feature/preview branches (feat/stage2b-pilot-coordinator, feat/v2-binding-and-ratelimit) to origin IS authorized and required.
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Merge feat/stage2b-pilot-coordinator into feat/v2-binding-and-ratelimit at the root checkout, rebuild both bundles (panel and service), verify all tests pass green, remove the local worktree, and emit the completion deliverable.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-210-hostile-review.md]
</context_files>
<skills>
[@.agents/skills/ship/git/git-workflow-and-versioning/SKILL.md]
[@.agents/skills/ship/worktree/management/SKILL.md]
</skills>
<owned_paths>
/workspace/extensions/github-task-board/
.agents/run/task-centred-architecture/outputs/task-211-integration-merge.md
</owned_paths>
<depends_on>
task-210
</depends_on>
<steps>
1. In /workspace/extensions/github-task-board, run `git merge --no-ff feat/stage2b-pilot-coordinator -m "merge: Stage 2B single-writer pilot coordinator background service into preview"`.
2. Run `npm run typecheck` (verify exit 0).
3. Run `npm run build` to compile `panel/main.js` and `service/main.js`. If any bundle changed, commit as `chore(build): rebuild bundles for Stage 2B integration`.
4. Run `node --test` to verify all tests pass (0 failures, 0 skipped, >= 430 tests).
5. Push to GitHub origin (feature/preview branches only):
   `git push origin feat/v2-binding-and-ratelimit`
   `git push origin feat/stage2b-pilot-coordinator`
   (Note: master must NEVER be pushed. No force-push, no branch deletion.)
6. Tear down the local feature worktree:
   `git worktree remove .worktrees/team-dev-stage2b-pilot-coordinator`
   `git worktree prune`
   (Note: Do NOT delete branch `feat/stage2b-pilot-coordinator`; branches persist per policy).
7. Emit completion report to `.agents/run/task-centred-architecture/outputs/task-211-integration-merge.md`.
</steps>
<criteria>
- Merge commit created on feat/v2-binding-and-ratelimit cleanly with zero conflicts.
- Typecheck and both builds pass cleanly.
- node --test passes all tests (>= 430 tests).
- Local worktree .worktrees/team-dev-stage2b-pilot-coordinator removed; branch feat/stage2b-pilot-coordinator preserved.
- feat/v2-binding-and-ratelimit and feat/stage2b-pilot-coordinator pushed to origin.
- No push to remote master.
</criteria>
<verification>
git log -1 --stat && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-211-integration-merge.md:
# Task 211 Output: Stage 2B Integration Merge
## Status: completed | failed
## Merge Commit: <sha>
## Build & Verification:
- npm run typecheck: PASS / FAIL
- npm run build: PASS / FAIL
- node --test: PASS / FAIL (passed/total)
## Cleanup:
- Worktree removal: .worktrees/team-dev-stage2b-pilot-coordinator removed (CONFIRMED)
- Branch status: feat/stage2b-pilot-coordinator preserved (CONFIRMED)
## Origin Push:
- feat/v2-binding-and-ratelimit pushed: CONFIRMED / SKIPPED
- feat/stage2b-pilot-coordinator pushed: CONFIRMED / SKIPPED
</output>
