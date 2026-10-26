<env_preflight>
READY — dispatch conditions met: #33 independent gate PASS/APPROVED e4b0091 integrated6b1603f/proofbf745aa and pushed; merged web338/root517/browser201/HTTP165/types/build/parity green. This slice is web/** + root package.json scripts + README only; #35 panel correction runs concurrently in .worktrees/team-dev-issue-35-write-refresh (panel/**, test/**) so do not touch those.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-board-hosting
Branch feat/board-hosting; base commit2dfbb22 (clean tracked; known private/unrelated untracked exist in root only and are absent from this worktree). Create the shared dependency link yourself once: ln -s ../../node_modules node_modules (root node_modules already installed). No npm install, no env copy, no DB registration.
Key paths (ground yourself in this tree): web/server.ts, web/server/app.ts, web/server/config.ts, web/README.md, web/tests/**, root package.json, root README.
Tests: node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; web bundle via npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs. npm run build:web does not exist — never invent it. web/dist is gitignored.
New file allowance: at most one small operations file under web/, only if web/README.md has no operations section.
Do not touch panel/**, service/**, test/**, shared skills/config, private reports, credentials, real GitHub, installed extension, other worktrees, master, deployment/proxy/TLS/supervisor configs, DNS. No push, merge, close, deploy. Synthetic fixtures and localhost only.
Preflight facts authoritative at dispatch; no initial git status/pwd/ls discovery. Targeted checks before commit and after failure are expected.
</env_preflight>
<goal>
The board process can bind where a supervisor needs it, prove it is alive without leaking data, and be started from a documented command, with the operational limits stated honestly.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/verifications/L5-preview-plan.md]
Owner decisions 2, 8, 10, 11, 13, 15 govern this slice: do not restate or extend them. The L5 preview plan lists the blockers this slice must remove and those it must NOT pretend to remove (port publishing, container recreation, secret provisioning, TLS, restart hook approval). The board issue https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/33 is read-only context available through the repo, not fetched.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Configurable bind address. Today the server binds loopback only. Add an explicit host setting (default unchanged: loopback) read from BOARD_HOST. Allow an explicitly configured bind address such as 0.0.0.0 for the approved in-container hosting shape, but never silently widen the default. Invalid or unresolvable input must fail startup with one actionable message, never silently fall back to a different address. Binding publicly is not itself deployment approval.
2. Liveness endpoint. Add GET /health (exact path, no auth) returning a small JSON body with process liveness and the build/version identity already available in the tree, plus HTTP 200 only when the process can serve requests. It must not call GitHub, must not read or echo tokens, passwords, session secrets, repository names, issue data or environment dumps, and must not bypass or weaken any existing auth or CSRF rule for other routes. Document that liveness is not readiness: it does not prove GitHub reachability, TLS, or that a proxy routes to it.
3. Start command. Add or correct one documented start path that runs the built server with production dependencies only, plus the matching package script if the repo lacks one. It must not require a dev server, a watcher or a build step at start time beyond what the documented command states. Verify it by starting the process and requesting the health endpoint.
4. Honest operations section. State, in the web README (or the one allowed docs file): required environment variable names only; that the board has no supervisor today, so it does not survive a container restart on its own; that publishing the port requires container recreation and briefly interrupts other services; that anyone with the board password has board access and the GitHub identity of the visitor is not checked; that best-effort writes can lose a simultaneous external edit; and that /health does not prove GitHub or TLS. No secret values, no hostnames beyond what is already public in the repo, no promise of uptime.
5. Tests. Cover: default bind is loopback; a configured host is honoured; an invalid host fails startup with a non-zero exit and one actionable message; /health returns 200 with the expected keys; /health requires no credentials; /health leaks no secret or repository value even when those variables are set; existing authenticated routes still require the password; the start command serves /health.
</scope>
<criteria>
Every claim in the operations section is either proven by a command in this slice or explicitly labelled unverified. No new authentication path, no token in output or logs, no wildcard default, no behaviour change to board writes, answers, repository selection or Done handling. Full test suite, typecheck and the bundle build reproduce green. Report a fresh reproducible hash and parity; web/dist is gitignored, so do not force-add it or claim it is committed. The worker reports which of the five L5-preview blockers this slice removes and which remain owner-only.
</criteria>
<must_not_do>
No PWA, service worker, push notifications, polling coordinator or #31 work.
No multi-repository behaviour from #37.
No deployment, container recreation, port publishing, proxy or TLS change; those need the owner's explicit go.
No secret creation, reading or printing.
</must_not_do>
<output>
Commit the slice and its tests on feat/board-hosting only. Report at most 12 lines: env variable names honoured (names only), exact commands with exit codes for bind/health/start, test counts, bundle hash and parity, files changed and commit, which L5 preview blockers this removes and which remain owner-only, blind spots (no real proxy/TLS/container restart), actual provider/model. Independent hostile review follows; do not self-approve or claim deployment.
</output>
