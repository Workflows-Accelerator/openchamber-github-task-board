<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting
Branch feat/board-hosting; base2dfbb22; candidate b8e517c, tracked clean. No active builder. A separate panel worker runs in .worktrees/team-dev-issue-35-write-refresh; do not read or touch it.
Product scope under review: web/server.ts, web/server/app.ts, web/server/config.ts, web/tests/{hosting,config,helpers}.mjs, web/README.md, root README.md, package.json. Dependencies link already needed: run ln -s ../../node_modules node_modules once if absent. No installs, env copy or DB registration.
Commands: node --test web/tests/hosting.test.mjs; node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; npm run typecheck; bundle npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs (web/dist gitignored; no build:web script).
Own only new outputs/hosting-hostile.md and verifications/hosting-review/** under .agents/run/task-centred-architecture/. Product, tests, docs, prior reports read-only. Scratch files /tmp/opencode.
No panel/**, service/**, shared config/skills, credentials, real GitHub beyond synthetic fixtures, installed host, proxy/TLS/container/deployment, other worktrees, push/merge/close/master/deploy, and no product fixes.
Preflight authoritative at dispatch; skip initial status/pwd/ls discovery. Targeted checks before committing your report are expected.
</env_preflight>
<goal>
Independently decide whether this hosting-preparation slice is honest, safe and complete, without repairing anything.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-hosting-slice.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/verifications/L5-preview-plan.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of the changes against the brief, not the builder's summary. Read the full diff 2dfbb22..b8e517c and the actual code paths.

1. Scope discipline: identify anything added beyond configurable host with unchanged loopback default, GET /health, one documented start path, and one honest operations section. In particular scrutinise the newly environment-configurable upstream API base: is it required, is it safe, is it documented as if approved, and can it redirect the server-held token anywhere unintended? Decide whether it must be removed rather than merely noted.
2. Honesty of the health signal: does /health report an identity that can silently be stale or false (hardcoded fallback, duplicated version literal, test asserting a literal instead of the package version)? Does it claim readiness it does not check? Does the operations text claim anything unproven, or omit any limit the brief required? Does the start command documentation include the exact build prerequisite if one is needed, or would a fresh operator hit a missing-file error with no guidance?
3. Security boundaries: /health must be unauthenticated but must not leak tokens, password material, session secrets, repository names, issue data or environment dumps, must not create or mutate sessions, cookies or CSRF state, must not weaken any other route, and must not become a proxy or side channel. Verify the exact position of the handler relative to auth, origin and body handling. Check method handling including HEAD, and response caching headers. Verify a public bind does not change origin/CSRF enforcement for write routes.
4. Bind correctness: default unchanged loopback; explicit host honoured and reported truthfully; malformed, unresolvable and unavailable addresses fail startup with one actionable message and a non-zero exit, with no silent fallback; IPv4 and IPv6 handled consistently; a bind failure cannot leave the process half-started or hang; the printed address matches what actually bound.
5. Test discrimination: do the new tests fail against the base commit for the right reason, or do they only re-assert constants? Is the version assertion meaningful, or does it freeze a duplicated literal? Are the leak tests real when the relevant secrets are actually set? Are start-command tests actually starting the built artifact the docs name, or a source entry instead?
6. Preserved behaviour: board reads, writes, answers, status changes, CSRF, auth and the accepted #33 semantics must be unchanged. Existing suites and assertions must not be weakened, deleted or skipped.
</scope>
<criteria>
Report Security APPROVED or NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, and machine PROCEED/HALT. For every finding give severity, evidence (event order, command and result, file path and line), whether it is pre-existing or introduced here, and the minimal correction. Reproduce the named gates yourself and record the actual counts and exit codes, plus whether the new tests genuinely fail at 2dfbb22. Note exactly what you could not run: real proxy, TLS, container recreation, restart supervision, production GitHub, installed host. No fixes; stop after the verdict.
</criteria>
<output>
Commit only your report and proof. At most 12 lines: verdicts, ordered findings, reproduced counts and exits, red-before evidence, documentation gaps, blind spots, actual provider/model. A required failure means HALT; do not recommend deploying anything.
</output>
