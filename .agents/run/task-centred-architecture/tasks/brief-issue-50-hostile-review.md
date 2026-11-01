<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection
Branch: fix/issue-50-host-connection, HEAD 674dd9e (builder commits 2ebf750, 0cb5faf, 674dd9e), clean. Base master ab7516c4a3634c3d69f7b82936ddb7655d327ebb.
Preflight facts are authoritative at dispatch: skip initial pwd/ls/git status discovery.
Files to inspect: git diff ab7516c..HEAD -- service/ panel/ test/ ; .agents/run/issue-50-build/verifications/proof.md ; .agents/run/issue-50-plan/PLAN.md ; .agents/run/issue-50-plan-rereview/findings.md.
Test commands: npm run build ; npm run typecheck ; node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js ; npm test
Do not touch: package.json, package-lock.json, panel/index.html, web/**, .agents/run/issue-50-plan*, root checkout, other worktrees.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, agent starts, host toggles/restarts, production data. Zero emojis.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that were made for #50 to figure out what might have been missed or what might be broken. Don't assume that what was done is right.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan/PLAN.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan-rereview/findings.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-build/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
service/main.ts
service/config.ts
service/types.ts
panel/main.ts
service/main.js
panel/main.js
test/service-host-connection.test.js
test/panel-service-connection.test.js
.agents/run/issue-50-build/**
</owned_paths>
<criteria>
1. Distrust the builder's 611/611 claim: inspect `git diff 698d2c6..HEAD` line by line and run real verification commands yourself.
2. Stress-test specifically:
- Does `test/panel-service-connection.test.js` test the REAL code in `panel/main.ts`/`panel/main.js`, or a reimplemented helper inside the test file? If it tests a test-only copy or misses how `panel/main.ts` wires `host.onReady`, fix it so the real panel implementation is exercised.
- Does `GET /health?foo=bar` or trailing slash or URL encoding bypass or break route matching compared to what the host/proxy sends? Check how `@openchamber/web/server/lib/guests/service.js` constructs the URL (`new URL(normalizedPath, ...)`).
- Does authentication happen BEFORE or AFTER route/method checks or body buffering? Could an unauthenticated client send a 64KB+ body or probe routes to distinguish 404/405 vs 401? (All requests to the loopback service should require valid Bearer auth first, or verify whether unauthenticated 404/405 leaks route structure).
- What happens if `GET /health` is called BEFORE `coordinatorService.start()` finishes initializing `leaseStore`? Does the server start listening only after `coordinatorService.start()` resolves, or can `/health` return 200 while startup is still failing/racing?
- What happens on port bind error (`EADDRINUSE`) or `coordinatorService.start()` rejection? Does the process exit nonzero quickly instead of hanging for 15s?
- Does `SIGTERM` handler guard against double-invocation (`SIGTERM` + `SIGINT` or repeated signals)? Does `process.exit(0)` wait for `server.close` + `coordinatorService.stop()`?
- In `panel/main.ts`, could `checkBackgroundServiceConnection()` throw an unhandled rejection under any DOM state (e.g., `#boardBanner` missing) or unexpected `res` shape? Does it ever dismiss a non-coordinator banner?
- Are `service/main.js` and `panel/main.js` freshly rebuilt and byte-for-byte consistent with `npm run build` (leave working tree clean after running `npm run build`)?
- Check zero-emoji compliance across all changed files.
3. If you find ANY real defect or test tautology: fix it minimally in owned paths, rebuild bundles (`npm run build`), re-run tests, and commit atomically. Record every hostile finding and its resolution in `.agents/run/issue-50-build/verifications/proof.md` under `### Hostile Findings (L4)`.
4. Give two explicit verdicts: Spec (PASS / PARTIAL / FAIL) and Quality (APPROVED / NEEDS-FIXES).
</criteria>
<verification>
npm run build && git status --short && npm run typecheck && node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js && npm test
</verification>
<output>
Commit any fixes and updated .agents/run/issue-50-build/verifications/proof.md locally on fix/issue-50-host-connection (do not push). Return <=12 lines: Spec verdict; Quality verdict; hostile findings found + fixed; whether panel test exercises real code; build/clean-tree check; test counts; head commit hash; actual provider/model.
</output>
