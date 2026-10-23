<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2b-pilot-coordinator
Branch: feat/stage2b-pilot-coordinator
Base commit: 9d4f8da
Files: package.json, service/main.js, panel/main.js, test/shipped-parity.test.js, test/stage2b-pilot-coordinator.test.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Build both extension bundles (panel/main.js and service/main.js), align parity tests in test/shipped-parity.test.js, execute the complete test suite across all 414+ existing tests and new Stage 2B tests, and commit the verified state to feat/stage2b-pilot-coordinator.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2B.md]
[@/workspace/extensions/github-task-board/test/shipped-parity.test.js]
[@/workspace/extensions/github-task-board/test/repo-detector.test.js]
</context_files>
<skills>
[@.agents/skills/ship/git/git-workflow-and-versioning/SKILL.md]
[@.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<owned_paths>
service/main.js
panel/main.js
test/shipped-parity.test.js
.agents/run/task-centred-architecture/outputs/task-209-proof-and-bundle.md
</owned_paths>
<depends_on>
task-208
</depends_on>
<steps>
1. Run `npm run typecheck` to verify 0 TypeScript compiler errors.
2. Run `npm run build` (which compiles `panel/main.js` and `service/main.js`).
3. Verify both generated bundle files:
   - `panel/main.js` exists and is valid JavaScript.
   - `service/main.js` exists, is ESM node target, and can be evaluated.
4. Run `node --test test/shipped-parity.test.js` to ensure shipped panel parity remains intact.
5. Run the complete test suite: `node --test`.
6. Confirm:
   - All pre-existing 414 tests pass.
   - All new Stage 2B tests pass (target: >= 430 total tests).
   - 0 failures, 0 timeouts, 0 skips.
7. Commit changes on `feat/stage2b-pilot-coordinator` with conventional commit message:
   `feat(service): implement Stage 2B single-writer pilot coordinator background host service`
8. Emit structured output in `.agents/run/task-centred-architecture/outputs/task-209-proof-and-bundle.md`.
</steps>
<criteria>
- npm run build produces both panel/main.js and service/main.js cleanly.
- Full test suite passes 100% with >= 430 passing tests.
- Zero regressions in existing 414 tests.
- Changes committed on feat/stage2b-pilot-coordinator.
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-209-proof-and-bundle.md:
# Task 209 Output: Stage 2B Proof & Bundle Build
## Status: completed | failed
## Evidence:
- Typecheck output
- Bundle builds output (panel/main.js, service/main.js)
- Full regression test run summary (passed / total)
- Commit SHA on feat/stage2b-pilot-coordinator
</output>
