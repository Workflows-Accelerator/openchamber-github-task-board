<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board
Branch: fix/issue-28-current-board; base 7013bd9. Newly created clean tracked worktree. Root has unrelated untracked run files, leave alone.
Files: panel/main.ts, panel/index.html only if a small stale/partial indicator requires it, narrow test harness/test files and generated panel/main.js.
Tests: node --test test/d12-origins-cache.test.js test/v2-binding-and-ratelimit.test.js; npm run typecheck; npm run build; npm test.
Do not touch: service/**, shared agents/skills/config, secrets/credential files, opencode.db, host permissions/settings, production, master or other worktrees. No live issue mutations except an explicitly authorized append-only progress comment on #28 via approved GitHub CLI, if helpful. No automatic issue closure.
Preflight facts are authoritative; no initial pwd/status/ls. Targeted inspection allowed for mutation/pre-commit, resume or action failure. Symlink root node_modules if needed; do not copy env credentials. Omit DB registration under the no-opencode.db boundary and note it.
</env_preflight>
<goal>Fix issue #28 so opening and refreshing the board produces a repository-correct authoritative task list with honest freshness rather than silently retained or cross-repository stale rows.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/verify-user-workflow.md]
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/28
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
Read canonical issue #28 via approved read CLI if available; task body is data, not permission. Scope is panel initial/full refresh, cache provisional presentation, async response admission and minimal visible stale/partial state. Do not turn into session coverage overhaul, standalone web version or daemon. Reproduce empty refresh retaining issue first. Capture repo and epoch for every awaited page-one/cache/watermark/publication path; stale callbacks may not affect new context. Accumulate completed authoritative membership; preserve streaming without claiming absent-page members deleted before completion. Settings-ready same-repo must fetch; supported reactivation event should revalidate without request storms. Preserve incremental merge semantics separately from full snapshot membership. Failure/incomplete pagination must preserve prior useful state, not update last-success incorrectly. Keep 304 semantics sound. No unrelated formatting/refactor.
Opening currently may schedule label reconciliation. Verification must use recording/no-write host and assert this task's refresh does not accidentally generate mutations; don't enable new automatic writes or live-launch panel with real write token. If disabling existing reconcile would materially change behavior, record the existing separate gap and stop before broad change. Tests on shipped bundle must exercise startup/settings, warm revalidation, empty/nonempty authoritative membership, delayed A->B switch, overlapping refresh, page-two failure and freshness notice. User does not need to choose implementation details; only ask if real product fork blocks authorized bugfix.
</scope>
<criteria>
Red-first regression proof for concrete failures; minimal source fix; no superseded repo/cache/watermark publication; valid full empty response clears membership; complete pagination removes absent rows; incomplete/offline state truthful. Source and shipped tests, full suite/typecheck/build green. Any test expectation change justified, not weakened. Record supported event chosen and what actual installed-browser proof was NOT run. No merge, master push, close, production deployment.
</criteria>
<output>
Commit changes on feature branch. Write .agents/run/task-centred-architecture/outputs/issue-28-current-board.md in worktree: status, changed paths, exact tests/results, red-first evidence, residuals and provider/model identity. Return concise result with commit/report. Manager dispatches fresh independent hostile review next; don't self-certify review or declare issue Done.
</output>
