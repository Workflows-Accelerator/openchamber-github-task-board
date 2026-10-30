<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-38-draft-default
Branch: feat/issue-38-draft-default
Base commit: db53d401f24374f4262a26f4c27a910bc035822a
Goal: Fix the two hostile review defects on priority alias mapping in groupIssuesBy and drawerPrioritySelect synchronization.
Commands: npm run build ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; node --test test/shipped-parity.test.js
</env_preflight>

<goal>
Fix the two defects identified during hostile review:
1. `panel/main.ts`: Ensure `groupIssuesBy` normalizes priority aliases (`urgent` -> `critical`, `high` -> `important`, `medium` -> `useful`, `low` -> `optional`, or vice versa matching the buckets) so that issues labeled with standard priority aliases are never silently dropped from the Priority Group view.
2. Drawer priority selection: Ensure `drawerPrioritySelect` correctly handles both canonical priority names (`critical`, `important`, `useful`, `optional`) and aliases (`urgent`, `high`, `medium`, `low`) so that opening an issue with an alias priority correctly selects the corresponding option in the drawer UI without desynchronizing.
</goal>

<scope>
1. Edit `panel/main.ts`:
   - Normalize priority values in `groupIssuesBy` when grouping by priority, or import/use the normalized mapping from `panel/labels.ts`.
   - Update drawer priority population to map aliases to the select values or add the alias options to the select.
2. If `panel/labels.ts` or `panel/core.ts` need matching normalization, update them consistently.
3. Rebuild bundles: `npm run build`.
4. Add regression tests in `test/label-manager.test.js` or `test/layout-and-views.test.js` verifying that issues with priority aliases (`urgent`, `high`, `medium`, `low`) appear in priority groups and correctly populate drawer selection.
5. Verify all suites pass:
   - `npm test`
   - `node --test web/tests/*.test.mjs`
   - `npm run typecheck`
   - `npx tsc -p web/tsconfig.json`
   - `node --test test/shipped-parity.test.js`
6. Commit changes with a clean conventional commit.
</scope>

<criteria>
Zero omitted issues in priority grouping; drawer priority select accurately reflects alias priorities; all tests pass; 0 typecheck errors; shipped parity passes.
</criteria>

<output>
At most 10 lines:
Edits made; regression tests added; test pass counts; typecheck status; commit hash.
</output>
