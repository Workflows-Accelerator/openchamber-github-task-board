<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: e1f90aa (commits under review: baba530 fix(board): name the cause of a discovery failure; e1f90aa test(board): record discovery failure legibility, base 210c010).
Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Live site: https://board.workflows.ac serves b85676f-20261113. Never sign in against production, never read board.env, tokens or cookies.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh.
INDEPENDENT HOSTILE REVIEW (READ-ONLY ON SOURCE/TESTS): Do NOT edit web/**, test/**, or existing verification files. Write your report only to .agents/run/chamberos-board-v2/verifications/discovery-legibility-L4/README.md (and any fresh verification captures if needed under that directory).
Forbidden: editing application source/tests, push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, GitHub writes, credential output, `git remote -v`, deletion, delegation.
</env_preflight>

<goal>
Conduct a hostile review of any edits or changes in 210c010..e1f90aa (`baba530` and `e1f90aa`) to figure out what was missed or what might be broken. Do not assume what was done is right.
</goal>

<context>
Read:
- `git diff 210c010..baba530`
- `.agents/run/chamberos-board-v2/tasks/wave6d-discovery-legibility.md`
- `.agents/run/chamberos-board-v2/verifications/discovery-legibility/README.md`
- `web/server/github.ts`, `web/server/repositories.ts`, `web/server/app.ts`, `web/public/app.js`
- `web/tests/discovery-legibility.test.mjs`, `web/tests/fake-github.mjs`
</context>

<attack_checklist>
1. **Error classification completeness**: check `GitHubError.kind` in `web/server/github.ts`. What happens on HTTP `403` without rate-limit headers (`kind === 'forbidden'`) or SSO/token scope refusal? Does `discoveryFailureKind` map `'forbidden'` to `'auth'` or silently drop it into `'server'`? What about malformed JSON / 5xx / timeout?
2. **Every surface & route**: check `/api/repos`, `/api/board` (all repos and single repo), `DiscoveryUnavailableError` 503 responses, `failures[]` rows, task drawer, and `board-notice` / `scope-status` / empty-state rendering. Does the UI repeat the exact same sentence 2–3 times on screen (check the screenshots under `verifications/discovery-legibility/screenshots/`)? Does a cached `/api/board` response or weak ETag hide a newly latched `errorKind`, or keep serving stale `errorKind` after recovery?
3. **Reset time honesty**: check `rateLimitResetAt()` and `discoveryResetClock(iso)`. What happens if `reset` is in the past, missing, 0, or on another day? Does `toLocaleTimeString` give an accurate or misleading clock?
4. **Invariants & I18N**: check EN/FR key-for-key parity (`discovery_failed_*`), zero `"n8n"`, zero `"mobile"`, zero emojis, zero `!` in the new messages, zero inline styles, zero secret/upstream body leaks in `errorReason` or payloads.
5. **Tests & Browser proof integrity**: independently run `node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs`, `node --test --test-timeout=60000 web/tests/*.test.mjs`, `npm test`, `npm run typecheck`, `npx tsc -p web/tsconfig.json --noEmit`, esbuild, and inspect `verify.mjs` + `report.json` + actual PNGs in `discovery-legibility/screenshots/` to verify no fake/weak assertions.
6. Commit ONLY `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4/` as `test(board): independent L4 review of discovery legibility`.
</attack_checklist>

<output>
At most 12 lines: SPEC_VERDICT (PASS/FAIL), QUALITY_VERDICT (APPROVED/CHANGES_REQUIRED), PUBLISH_VERDICT (YES/NO), FINDINGS (severity P0/P1/P2 + file:line + exact defect), TEST_RUNS (exact counts + exit codes), VISUAL_CHECK (what you saw in the PNGs), COMMIT, NOT_VERIFIED.
</output>
