<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-server-layout
Branch: feat/wave7a-server-layout
HEAD: a0a9c98 (base feat/board-v3 e1f90aa)
Test command: node --test --test-timeout=60000 web/tests/layout.test.mjs && npx tsc -p web/tsconfig.json --noEmit
Forbidden: push, deploy, touching files outside web/server/layout.ts and web/tests/layout.test.mjs, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, GitHub writes, delegation.
</env_preflight>

<goal>
Conduct a hostile review of any edits or changes in `a0a9c98` (`web/server/layout.ts` and `web/tests/layout.test.mjs`) to figure out what might have been missed or what might be broken. Do not assume what was done is right.
</goal>

<attack_checklist>
1. Read `web/server/layout.ts` and `web/tests/layout.test.mjs` completely.
2. Check prototype pollution (`__proto__`, `constructor`, `toString` as `scope`, `position` key, or `expandedGroups` entry!).
3. Check concurrency/queue error handling: if one `patchScope` throws (validation error or disk error), does the serialized queue stall forever for subsequent callers?
4. Check `getScope` vs `patchScope` ordering: if `getScope` runs while a `patchScope` is writing or after a corrupt JSON file, is state consistent? Does corrupt JSON recovery silently wipe valid backups or fail to recover?
5. Check `prunePositions`, `maxScopes`, `maxPositionsPerScope`, `expandedGroups` limits, NaN/Infinity/-0, non-plain objects, and temp-file cleanup on write failure.
6. Fix any genuine defect you find with a failing test first, re-run `node --test --test-timeout=60000 web/tests/layout.test.mjs` and `npx tsc -p web/tsconfig.json --noEmit`, and commit as `fix(board): harden canvas layout store after hostile review` (or report clean PASS if zero defects found).
</attack_checklist>

<output>
At most 10 lines: VERDICT (APPROVED or FIXED_AND_APPROVED), FINDINGS, TESTS (count + exit code), TYPECHECK (exit code), COMMIT.
</output>
