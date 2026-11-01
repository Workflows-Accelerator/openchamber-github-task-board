<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection
Branch: fix/issue-50-host-connection, HEAD 83ad27e (Revision 2 plan), clean. Base master ab7516c.
Preflight facts are authoritative: skip pwd/ls/status discovery.
Files: .agents/run/issue-50-plan/{PLAN.md,discovery.md,verifications/proof.md} (Revision 2); prior review .agents/run/issue-50-plan-review/{findings.md,verifications/proof.md}; source service/*.ts, panel/main.ts, panel/index.html, package.json, test/**; installed host /usr/local/lib/node_modules/@openchamber/web/server/lib/guests/{service.js,routes.js} and SDK /usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist/{host.js,contract.d.ts}.
Test command (read-only baseline if useful): node --test test/shipped-parity.test.js ; npm run typecheck.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label changes, agent starts, host toggles/restarts, production data.
Do-not-touch: PLAN.md and every application/test/dependency file; root checkout; other worktrees. You are a reviewer, not the author.
</env_preflight>
<goal>
Independently and hostilely judge whether #50 plan Revision 2 faithfully implements decision D59 and all six required corrections, and is safe and directly executable by a builder.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-50-plan-review-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-50-plan-correction.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan/PLAN.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Write only under .agents/run/issue-50-plan-rereview/** (findings.md, verifications/proof.md).
Verify every source citation in the plan against the installed host/SDK and repo source (file:line actually says what the plan claims). In particular check:
- D59: probe runs once per panel open, only through existing serviceRequest; no polling/retry storm, no auto-grant, no new button; three user-visible outcomes are distinct and accurate; DISABLED vs NO_SERVICE vs SERVICE_FAILED/REQUEST_FAILED/HOST_TIMEOUT/HOST_UNAVAILABLE mapping matches real SDK behavior (does the SDK actually surface the host's code to the panel, or a generic one? prove from source). Copy never claims success on failure. Banner reuse genuinely exists in panel source.
- /status fully gone; only GET /health; minimal 404/405; no disclosure.
- No silent catch in any planned path; no raw Error/token logging. Also check the plan's startup log line and any listener log for leaks.
- Config validation strict and before coordinator/storage init; trim semantics coherent (e.g. does trimming a port with whitespace contradict "full-string"? Is a whitespace-only token rejected consistently?).
- Auth: hash-then-timingSafeEqual; malformed headers never throw; limits (body/header/time) concrete and bounded; SIGTERM shutdown bounded below host's 5s kill; in-flight requests and the prune timer cleaned up.
- Import side-effect safety: the direct-run guard works for the BUILT artifact as actually invoked by the host (check how host spawns entry: argv/path/ELECTRON_RUN_AS_NODE) — a guard that never fires in the host would be a false success.
- Lease behavior and other-owner unexpired leases preserved; tests exercise the built artifact with isolated temp storage/ephemeral port/synthetic token; panel tests stub bridge for all outcomes; tests portable (no hardcoded host paths unless guarded).
- Does panel load in a real host trigger StatusReconciler label writes? Plan's claim must be source-accurate.
- Scope creep or speculative layers (ponytail): anything beyond what D59 + corrections require.
- #51 collision graph correct; #51 sequential.
Give two verdicts: Spec (PASS / PARTIAL / FAIL) and Quality (APPROVED / NEEDS-FIXES). List each finding as severity + plan location + evidence + minimal fix. Distinguish proven defects from risks/opinions; do not inflate.
</scope>
<criteria>
Every plan citation checked or explicitly marked unchecked; verdicts backed by file:line evidence; zero edits outside the rereview run path; zero host/GitHub mutation.
</criteria>
<output>
Commit only .agents/run/issue-50-plan-rereview/** locally on the branch (no push). Return ≤12 lines: Spec verdict; Quality verdict; blocking findings (if any) with minimal fixes; notable non-blocking risks; citations verified count / unchecked; commit hash; actual provider/model.
</output>
