<env_preflight>
Repository: /workspace/extensions/github-task-board
Planner ses_8ff7dcccaf013fd264b3412e COMPLETED actual 9router/engineer. Plan commit ba59e5b, clean worktree confirmed by manager. Proposed owned product paths: service/main.ts, service/config.ts, service/types.ts, panel/main.ts, generated service/main.js and panel/main.js, test/service-host-connection.test.js. No application edits yet. Isolated original built-service reproducer observed ECONNREFUSED on GET /health and clean SIGTERM exit0. Proposed stdlib authenticated loopback GET /health + GET /status; panel host.onReady serviceRequest caller with silent catch. Start-policy alternatives are NOT approved: automatic panel-mount probe vs explicit action/diagnostics. Challenge this fork; return a conditional minimal contract, not permission to implement it.
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection
Branch: fix/issue-50-host-connection, based on master ab7516c4a3634c3d69f7b82936ddb7655d327ebb. Product source must remain unchanged during planning/review.
Root ops/task-board-activation serves the currently installed extension; do not touch root source, refs or runtime. #49 candidate 84d2e39 is independently accepted but unpublished and parked awaiting batch; #51 toolbar queued after #50 due to panel collisions.
Relevant files: service/main.ts, service/config.ts, service/types.ts, service/lease-store.ts, panel/main.ts, package.json; installed host service contract source. Plan artifacts: .agents/run/issue-50-plan/{discovery.md,PLAN.md,verifications/proof.md}.
Tests: source-grounded plan inspection plus targeted isolated assertions where necessary. No full suites or product changes required for a zero-edit plan. No live host service launch, toggle, restart, GitHub writes, labels or agent starts.
Secrets wall: no /workspace/.openchamber-data/**, .env*, board.env, credential/cookie files, process environments or token-bearing remote URLs; never git remote -v. Do not print synthetic bearer values either. Fixture processes/storage must be isolated and owned; no real lease stores.
Preflight is authoritative at startup; no initial pwd/ls/status discovery. Targeted inspection allowed for artifact verification, failure or resume. Write/commit only .agents/run/issue-50-plan-review/**, staged sequentially and never alongside another worker's changes.
</env_preflight>
<goal>
Reject unsafe, incomplete or overbuilt #50 plans before implementation and return an exact minimal host-connection contract suitable for a builder brief.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/extension-repairs-approval.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-board-runtime-boundary-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan/PLAN.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan/discovery.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/investigation/investigate-first/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent of the planner. A plan that only makes /health green but never gives the host a real supported caller is not a complete connection. A plan that invents an autonomous task runner exceeds user approval. Do not solve either problem by broadening scope silently.
</review_prompt>
<scope>
Check installed host's actual port/token/readiness/proxy/shutdown contract, endpoint authorization and entrypoint behavior. Separate source facts from observed fixture failures and unverified real authenticated OpenChamber UI.
Challenge caller/start policy: host is on-demand, so exactly which authorized, read-only action starts it? Does proposed panel code initiate new background behavior or writes without user action? Does lifecycle remain useful when the panel closes? If desired always-on behavior needs host changes or a new product decision, report a fork rather than fake it with a poller. Preserve current coordinator behavior (only pruning locks) and don't claim autonomous issue execution.
Security: loopback binding, strict port/token validation, rejected missing/bad bearer, no token exposure in URL/log/argv, bounded requests/timeouts, strict known routes, no accidental CORS relaxation or privileged endpoints. Does /status expose unnecessary owner IDs, lease keys, paths or config? Prefer a health-only supported caller if status adds no required user value. Check exact SDK request shape and result/error semantics in installed typings/source, not inferred fields. Silent failure handling must not hide a broken connection or imply success; recommend the narrowest observable failure behavior without inventing a new settings system. Use stdlib and existing patterns; avoid speculative routing frameworks/config/schemas and general APIs.
State: no real production store in fixtures, no other-owner lease deletion on shutdown, no duplicate pruning loops, no module-import startup side effects, clean signals/server shutdown, deterministic rebuild of service/main.js and panel/main.js if touched. Existing exported APIs/tests must remain intact.
Verification plan: actual built binary under an isolated fixture host using host-style env, GET health and supported request path, wrong auth, invalid port/config, restart and shutdown, artifact parity, original failure before patch. Parent shell mocks are not actual host integration. Full release still awaits L4 plus batched human L5; no production activation before approval.
Return explicit Spec PASS/FAIL/PARTIAL and Quality APPROVED/NEEDS-FIXES. Any required finding must name exact source anchor/plan section, impact and smallest correction. Do not implement, modify the original plan or ask user directly; manager bundles forks.
</scope>
<criteria>
No unapproved product decisions, known broken contract omissions or unverifiable proof claims. Minimal owned paths and exact runnable test strategy. User's preparation scope and secrets wall intact. Required changes must block implementation; a safe plan must have two affirmative verdicts before builder dispatch.
</criteria>
<output>
Write .agents/run/issue-50-plan-review/verifications/proof.md and findings.md; commit exact evidence paths only. Return at most 12 lines: two verdicts, caller/start strategy ruling, required findings and scope forks, verified host anchors, smallest builder ownership/test list, commit, actual provider/model. No source changes.
</output>
