<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection
Branch: fix/issue-50-host-connection, HEAD 07a23c5 (plan ba59e5b + review evidence 07a23c5), clean. Based on master ab7516c4a3634c3d69f7b82936ddb7655d327ebb.
Preflight facts are authoritative: skip pwd/ls/status discovery. Targeted safety checks allowed.
Files: .agents/run/issue-50-plan/{discovery.md,PLAN.md,verifications/proof.md}; .agents/run/issue-50-plan-review/{findings.md,verifications/proof.md}; service/main.ts, service/config.ts, service/types.ts, service/lease-store.ts, panel/main.ts, package.json, tests under test/ relevant to service/panel; installed host /usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js plus the SDK/bridge source that implements serviceRequest and its error codes (locate by targeted grep under /usr/local/lib/node_modules/@openchamber/).
Test command (baseline reference only, nothing to change): node --test test/shipped-parity.test.js ; npm run typecheck.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, task creation, agent starts, host toggles/restarts, production data or root checkout edits.
Do-not-touch: all application/test/dependency files (this is a PLAN correction only), root checkout, other worktrees.
</env_preflight>
<goal>
Produce a corrected #50 implementation and verification plan that applies the user's start-policy decision (D59) and every required correction from the independent plan review, ready for a second independent critique.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-50-plan-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan-review/findings.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan-review/verifications/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan/PLAN.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/extension-repairs-approval.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-board-runtime-boundary-gate.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/verify/investigation/investigate-first/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<decision>
D59 (user, 2026-11-01): "Connect when board opens (Recommended)". When the board panel opens, it requests the background service's authenticated GET /health through the existing host serviceRequest bridge — ONLY if the capability is already granted in OpenChamber settings; never auto-grant, never prompt-loop. Connection failures are reported to the user with sanitized, observable feedback (distinguish capability disabled/denied from real service/request failure); never silently swallowed, never displayed as success. No new toolbar button. No agent/task starts, no label writes, no GitHub calls from this path. Starting the service runs only its existing local expired-lock pruning; the plan must state this honestly as a runtime change, not a "read-only request".
</decision>
<scope>
Write only under .agents/run/issue-50-plan/** in the worktree. Revise PLAN.md in place (git keeps the old version) and add a top "Revision 2" section mapping each correction below to the exact plan change. Update discovery.md / verifications/proof.md only where new source evidence is gathered.
Required corrections (all mandatory):
1. Caller: implement D59 board-open behavior exactly as stated above. Specify where in panel/main.ts it runs (once per panel open, no polling loop, no retry storm), what the user sees on each outcome (connected / capability not granted / service failed), and that UI copy never claims success on failure. Keep it minimal; reuse existing panel status/notice styling if any exists — cite it. No new settings system.
2. Remove /status (no ownerId/activeLeases/config/process disclosure). Only authenticated GET /health with minimal body. Unknown routes/methods → minimal 404/405 without detail.
3. No silent catch anywhere in the new path. Verify the exact error shape/codes serviceRequest returns for capability-disabled/denied vs transport/timeout/non-2xx in the installed SDK/host source and cite file:line. Do not log raw Error objects or tokens; sanitized messages only.
4. Config: strict full-string integer port 1..65535 (e.g. /^[0-9]+$/ then range check; no permissive parseInt accepting trailing text), non-empty token. Invalid/missing → sanitized stderr line, nonzero exit, fast — validated BEFORE coordinator/storage startup.
5. Auth: SHA-256 both presented and expected bearer to fixed length, then crypto.timingSafeEqual; missing/malformed/wrong-length headers never throw. No bearer in logs/URL/argv. Bounded request body/header/time limits; bounded shutdown (host sends SIGTERM, waits 5s, then SIGKILL).
6. Preserve: module-import has no listener/timer side effects (direct-run guard), existing public class APIs, existing lease behavior, other owners' unexpired leases untouched, clean SIGTERM shutdown. Tests must exercise the BUILT artifact (spawn built service with isolated temp storage, ephemeral port, synthetic token): valid health 200, wrong/missing/malformed auth 401 without exceptions, unknown route, bad port/missing token fast-fail, SIGTERM exit promptly, other-owner lease preserved; plus panel-side tests for the three caller outcomes with a stubbed bridge.
Also: list exact owned paths and confirm the #51 collision (panel files) so #51 stays sequential. Do not treat the reviewer's "zero length leakage" wording or "under 10 lines" caller limit as requirements. Distinguish source predictions, fixture observations and real-host verification (real authenticated OpenChamber parent remains unverified; state it). Note whether loading the panel in a real host triggers StatusReconciler label writes — inspect source only, do not run live.
Self-hostile critique the revised plan before committing: false success, side effects on import, token exposure, error-path observability, D59 drift (no polling, no auto-grant), lifecycle honesty.
</scope>
<criteria>
Every one of corrections 1–6 maps to a concrete, source-cited plan change; D59 implemented faithfully with no scope creep; zero application/test/dependency edits; zero host/GitHub mutation; plan is directly executable by a builder with exact paths, tests and invariants.
</criteria>
<output>
Commit only .agents/run/issue-50-plan/** on fix/issue-50-host-connection (local, no push). Return ≤12 lines: correction→change map summary; serviceRequest error codes found (file:line); owned paths + tests; remaining open questions (if any real fork, STOP and state it instead of choosing); self-critique results; commit hash; actual provider/model.
</output>
