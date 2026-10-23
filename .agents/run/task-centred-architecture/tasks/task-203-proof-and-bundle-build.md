<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2a-attention-views
Branch: feat/stage2a-attention-views
Base commit: 51da160
Files: panel/main.js, test/shipped-parity.test.js, test/stage2a-attention-ui.test.js
Test command: npm run typecheck && npm run build && node --test
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Rebuild the bundled extension (panel/main.js), align shipped parity tests, and execute the full test suite to prove zero regressions across all 386+ tests.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2A.md]
[@/workspace/extensions/github-task-board/test/shipped-parity.test.js]
</context_files>
<skills>
[@.agents/skills/ship/git/git-workflow-and-versioning/SKILL.md]
[@.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<owned_paths>
panel/main.js
test/shipped-parity.test.js
.agents/run/task-centred-architecture/outputs/task-203-proof-and-bundle.md
</owned_paths>
<depends_on>
task-202
</depends_on>
<steps>
1. Run `npm run typecheck` to confirm 0 TypeScript compiler errors.
2. Run `npm run build` to compile `panel/main.ts` into `panel/main.js`.
3. Run `node --test test/shipped-parity.test.js` to ensure shipped bundle parity remains 100% compliant. If new exports from `panel/core.ts` were added, update `test/shipped-parity.test.js` accordingly.
4. Run the full test suite: `node --test` across all test files.
5. Verify total passing tests >= 386 with 0 failures, 0 timeouts, 0 skips.
6. Commit changes on `feat/stage2a-attention-views` with conventional commit message:
   `feat(ui): implement Stage 2A attention views, alert badges, and drawer acceptance criteria`
7. Emit structured output in `.agents/run/task-centred-architecture/outputs/task-203-proof-and-bundle.md`.
</steps>
<criteria>
- npm run build succeeds and generates panel/main.js without bundling errors.
- test/shipped-parity.test.js passes cleanly.
- Full test suite passes 100% (>= 386 tests pass).
- Changes committed on feat/stage2a-attention-views.
</criteria>
<verification>
npm run typecheck && npm run build && node --test
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-203-proof-and-bundle.md:
# Task 203 Output: Proof Suite & Bundle Parity
## Status: completed | failed
## Evidence:
- Typecheck output
- Build bundle output and size
- node --test full regression test count (passed / total)
- Commit SHA on feat/stage2a-attention-views
</output>
