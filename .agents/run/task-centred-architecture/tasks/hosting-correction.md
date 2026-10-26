<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting
Branch feat/board-hosting; HEAD6efb78e (review report on top of product b8e517c), tracked clean. No active builder or reviewer. Node modules link expected at worktree root; create with ln -s ../../node_modules node_modules once if missing. No installs, env copy or DB registration.
Product you own for this correction: web/server/app.ts, web/server/config.ts, web/tests/hosting.test.mjs, web/tests/config.test.mjs (only if needed), web/README.md, root README.md, package.json (only if a script must change). Do not touch other tests or product files.
Commands: node --test web/tests/hosting.test.mjs; node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; npm run typecheck; bundle npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs (web/dist gitignored).
No panel/**, service/**, shared config/skills, credentials, real GitHub, installed host, proxy/TLS/container/deployment, other worktrees, push/merge/close/master/deploy. No new features.
Preflight authoritative; skip initial status/pwd/ls. Targeted checks at commit and after failures are expected.
</env_preflight>
<goal>
Close exactly the four hostile-review findings and the two documentation gaps in the hosting slice, with no other behaviour change.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-hosting-slice.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/hosting-hostile.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting/.agents/run/task-centred-architecture/outputs/hosting-hostile.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. HIGH: remove the BOARD_GITHUB_API_BASE environment variable entirely and restore the fixed upstream base already used at base commit 2dfbb22. The server-held token must never be sendable to an operator-supplied origin. Remove it from config, from describeConfig output, from the README variable tables and examples, and from any test that set it. Prove with a test that a BOARD_GITHUB_API_BASE value in the environment is ignored (or rejected) and that GitHub requests go to the documented default. Do not add a replacement override for tests; existing fixtures already inject the base through the server options.
2. MEDIUM: /health version must not fall back to a duplicated literal. Read the package version from the tree; if it cannot be read, return an explicit honest value such as 'unknown' rather than a plausible number. Tests must compare against the package.json version read at test time, not a hardcoded string, and one test must prove the fallback is honest rather than a version guess.
3. LOW: make the start-command test independent of test order. Ensure the bundle it launches exists from that test's own setup (file-level setup hook that builds when missing, and cleans nothing the other tests need), so running only that test in isolation passes.
4. INFO: decide and document method behaviour for /health. Either support HEAD with no body, or document explicitly that only GET is supported and monitoring must use GET. Keep non-supported methods returning 405 with an Allow header.
5. DOC GAP: root README must state that npm run start:web needs the built bundle and give the exact build command from the brief; do not claim npm run build produces it. Keep the operations section's honest limits and correct the variable lists after removal.
Keep the rest of the slice identical: loopback default, explicit host, actionable startup failure, no secret leakage, existing auth/CSRF unchanged. Add or adjust tests so each fixed finding has a regression that fails on b8e517c and passes now; do not delete, skip or weaken existing assertions.
</scope>
<criteria>
All four findings closed with discriminating evidence; both documentation gaps corrected; hosting test file passes in isolation and in the full web suite; web and root suites green with counts reported; both typechecks and the bundle build reproduce with a fresh hash; no BOARD_GITHUB_API_BASE reference remains anywhere in the tree except a regression asserting it is ignored; no hardcoded version fallback remains. Report red-before evidence for each new regression against b8e517c.
</criteria>
<steps>
Reproduce each failing regression first against current code where practical. Apply the smallest edits. Rerun the named gates, then run the start test alone to prove independence. Commit product and tests separately; commit an updated report. Leave the tracked tree clean and stop for independent recheck.
</steps>
<output>
At most 12 lines: each finding's status with red/green evidence, test counts and exits, isolation run of the start test, typecheck/build/hash, changed files and commits, documentation changes, blind spots, actual provider/model. No independent verdict, no merge/push/deploy.
</output>
