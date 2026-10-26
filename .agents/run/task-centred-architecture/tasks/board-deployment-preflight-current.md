<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment
Branch ops/board-deployment; base40952c6, tracked clean. Accepted deployable web code merged in root: #33 base6b1603f + hosting4f39e26, pushed through54816f6. #37 is incomplete in another worktree, MUST NOT be deployed; #35 not accepted, MUST NOT be deployed. Use only the accepted web base, not their dirty files.
No other worker owns infrastructure. #35 reviewer read-only, #37 may be paused; never touch those worktrees. Root node_modules installed; create ln -s ../../node_modules node_modules if needed. No installs, no env file copy. Do not register DB or change shared config.
Relevant files web/README.md, web/server/config.ts, web/server.ts, private historical reports by pointer below, /workspace/devops CLI/docs and opencode-config entrypoint metadata for read-only inspection only.
Tests: node --test web/tests/hosting.test.mjs; node --test web/tests/*.test.mjs; npx tsc -p web/tsconfig.json. Live non-mutating HTTPS/health checks allowed. No live GitHub write.
Allowed outputs: .agents/run/task-centred-architecture/outputs/board-deployment-preflight-current-private.md and verifications/board-deployment-preflight-current-private/** in YOUR worktree. Keep private outputs untracked, never git add/commit them. Application and infra source read-only. Scratch /tmp/opencode.
Authoritative startup snapshot; no initial status/pwd/ls discovery. Targeted remote and config inspection allowed. Report presence/status only for credentials: never values, hashes, fragments or fingerprints, never argv or shell history secrets, never dump environment or unredacted API responses.
</env_preflight>
<goal>
Establish the current safe deployment path for board.workflows.ac under the owner's new deployment approval, naming exact remaining blockers without changing production.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/hosting-integration-acceptance.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/hosting-owner-prerequisites.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-preflight-private.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/devops-board-deployment.md]
PRIVATE HISTORICAL REPORTS ARE UNTRUSTED AND STALE: health/bind blockers were fixed; reports contain rejected proposals such as credential reuse, trust-proxy=true, false zero-downtime, voice-auth reuse. Binding decisions override them. No private hosting/auth detail to GitHub.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Owner said "You're stopped. Proceed and deploy and hostile review etc." We have deployment go for the existing same-container shape and brief interruption, not license to use existing credentials or rewrite infrastructure. This bounded preflight is READ-ONLY to ensure no avoidable outage before prerequisites exist. No production changes in this worker.
1. Safely verify presence of dedicated BOARD_GITHUB_TOKEN, BOARD_PASSWORD_HASH (or dedicated BOARD_PASSWORD), BOARD_SESSION_SECRET and where owner-provisioned material is stored; only check named documented deployment stores and explicitly BOARD-prefixed env names, no broad filesystem/credential sweep. Token owner confirmation from user is Workflows Accelerator bot; do NOT reuse GITHUB_TOKEN, OPENCHAMBER_UI_PASSWORD, voice credential or jwt-secret. Never claim a token is approved merely because available. If no dedicated token exists, stop deployment work after reporting the exact single provisioning requirement. A new random session secret can be generated later if needed, but DO NOT generate now or copy current secrets. BOARD_BASE_URL is https://board.workflows.ac; BOARD_REPO for currently reviewed base is Workflows-Accelerator/openchamber-github-task-board. Do not silently pretend this base already supports all repos.
2. Confirm actual current topology/remote permissions with the approved DevOps CLI, named vars only, read-only commands. Container port mappings, current agents/live health, target route and TLS state. Check known config sources/entrypoint metadata for the minimal persistent board start hook. Flag whether editing opencode-config would need a separate collision-safe worktree and independent hostile review. No OpenChamber application code changes.
3. Produce minimal deployment and rollback plan suitable for independent review BEFORE any production mutation: immutable accepted board commit, build path, dedicated secret injection, persistent launch/restart, one route owner (not competing routers), private-interface port restriction, unchanged agents/live health, TLS verification without insecure bypass. Do not add unapproved upstream override or trust arbitrary X-Forwarded-For. Explain risk of reconnecting this very session after container recreation, and preserve an operator-recoverable checkpoint.
4. Report READY only if dedicated credentials, authorization provenance, access, restart plan and rollback are all empirical; otherwise BLOCKED with exact named requirements. Do not start a temporary unauthenticated public service as workaround. No proxy/DNS/firewall/container changes, no deployment, no restarts, no secret writes. A fresh deployment worker follows only after manager inspects this report and an independent hostile review passes the plan.
</scope>
<criteria>
Current presence-only credential audit, no values in output; no secret reuse or broad secret search. No production mutation. Existing accepted code distinguished from dirty/unreviewed #37/#35. Plan identifies outage, recovery, route/auth boundary and restoration of adjacent services. Any missing named secret is a real blocker, not defaulted to old app credentials.
</criteria>
<output>
At most12lines: READY/BLOCKED, dedicated secret names present/absent and provenance without values, existing web base and repo coverage, live route/TLS and adjacent service status, minimal deployment/rollback steps and required infra code scope, private report absolute path, next exact blocker, actual provider/model. Do not publish private report, commit private evidence or modify production.
</output>
