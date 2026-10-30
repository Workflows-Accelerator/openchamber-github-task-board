<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-38-draft-default
Branch: feat/issue-38-draft-default
Goal: Implement default status:draft classification for incomplete/unprioritized issues per Issue #38.
Commands: npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; npm run build ; node --test test/shipped-parity.test.js
Guardrails: Do not edit manager run state. Follow doubt-driven development.
</env_preflight>

<goal>
Implement the rule that issues without a priority label (priority:urgent, priority:high, priority:medium, priority:low) or missing essential criteria default to status:draft instead of backlog or todo, preventing incomplete tasks from polluting the active execution board.
</goal>

<context_files>
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/extensions/github-task-board/panel/labels.ts]
[@/workspace/extensions/github-task-board/web/server/board.ts]
</context_files>

<scope>
1. Inspect status resolution logic in:
   - `panel/labels.ts` (client status resolver)
   - `web/server/board.ts` (server issue mapper/reconciler)
   - `panel/core.ts` (if applicable)
2. Implement classification:
   - If an issue has no priority label (`priority:urgent`, `priority:high`, `priority:medium`, `priority:low`) and does not have an explicit advanced status (such as `status:in-progress`, `status:in-review`, `status:needs-human`, `status:done`), classify it as `status:draft`.
   - Ensure an issue with explicit priority advances to its specified status (`status:backlog`, `status:todo`, etc.).
   - Ensure existing closed or in-flight issues (`in-progress`, `in-review`, `done`) are never demoted retroactively.
3. Add unit and integration tests:
   - In `test/label-manager.test.js` (or new test file covering priority/draft defaulting)
   - In `web/tests/board.test.mjs`
   - Verify that adding a priority label immediately allows the issue to be viewed in Backlog/Todo.
4. Verify all suites pass:
   - `npm test`
   - `node --test web/tests/*.test.mjs`
   - `npm run typecheck`
   - `npx tsc -p web/tsconfig.json`
   - `npm run build`
   - `node --test test/shipped-parity.test.js`
5. Conduct a hostile review (L4) against your changes: test empty labels, conflicting labels, closed issues without priority, and ensure zero regressions across existing 525+384 tests.
6. Commit your changes locally with clear conventional commits.
</scope>

<criteria>
All tests pass; unprioritized issues reliably map to status:draft; prioritized issues map to their normal column; 0 typecheck errors; shipped parity passes.
</criteria>

<output>
At most 10 lines:
Summary of edits; test pass counts; typecheck status; hostile review findings and resolution; commit hash.
</output>
