<env_preflight>
BLOCKED — DO NOT DISPATCH YET. The standalone board lives on feat/issue-33-standalone-board and is not yet integrated. Dispatch only after #33's approved correction is integrated into feat/v2-binding-and-ratelimit and the merge is verified. Manager fills the worktree, branch and HEAD at dispatch.
Repo /workspace/extensions/github-task-board
Worktree FILL_AT_DISPATCH (suggested .worktrees/team-dev-board-hosting, branch feat/board-hosting from the integrated review branch)
Base FILL_AT_DISPATCH; clean state FILL_AT_DISPATCH. No other worker may own web/** or package.json scripts.
Key paths (ground them yourself in the integrated tree): web/server.ts, web/server/app.ts, web/server/config.ts or equivalent, web/README.md, web/tests/**, root package.json scripts, root README.
Tests FILL_AT_DISPATCH (expected: node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; the web esbuild bundle command recorded in the brief issue #33 work). Do not invent npm run build:web if it does not exist.
New file allowance: no more than one small docs file under web/ for operations, only if the integrated README has no operations section.
Root dependencies via node_modules symlink; no installs, no env copy, no DB registration.
Do not touch panel/**, service/**, shared skills/config, private reports, credentials, real GitHub, installed extension, other worktrees, master, deployment configs, DNS, proxy configs, supervisor configs inside or outside the container. No push/merge/close/deploy. Synthetic fixtures only.
</env_preflight>
<goal>
The board process can bind where a supervisor needs it, prove it is alive without leaking data, and be started from a documented command, with the operational limits stated honestly.
</goal>
<context_files>
GitHub issue for the board itself: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/33 (read only)
<file path=.agents/run/task-centred-architecture/decisions-2026-10-24.md>
Owner decisions 2, 8, 10, 11, 13, 15 govern this slice. Read the file in the run directory; do not restate or extend those decisions.
</file>
<file path=.agents/run/task-centred-architecture/verifications/L5-preview-plan.md>
The blockers this slice must remove, and the ones it must NOT pretend to remove (port publishing, container recreation, secret provisioning, TLS, restart hook approval). Read the file in the run directory.
</file>
</context_files>
<scope>
1. Configurable bind address. Today the server binds loopback only. Add an explicit host setting (default unchanged: loopback) read from the documented environment variable name BOARD_HOST. Invalid, unresolvable or wildcard values must fail loudly at startup with one clear message, never silently fall back to loopback or to 0.0.0.0.
2. Liveness endpoint. Add GET /health (exact path, no auth) returning a small JSON body with process liveness and the build/version identity already available in the tree, plus HTTP 200 only when the process can serve requests. It must not call GitHub, must not read or echo tokens, passwords, session secrets, repository names, issue data or environment dumps, and must not bypass or weaken any existing auth or CSRF rule for other routes. Document that liveness is not readiness: it does not prove GitHub reachability, TLS, or that a proxy routes to it.
3. Start command. Add or correct one documented start path that runs the built server with production dependencies only, plus the matching package script if the repo lacks one. It must not require a dev server, a watcher or a build step at start time beyond what the documented command states. Verify it by starting the process and requesting the health endpoint.
4. Honest operations section. State, in the web README (or the one allowed docs file): required environment variable names only; that the board has no supervisor today, so it does not survive a container restart on its own; that publishing the port requires container recreation and briefly interrupts other services; that anyone with the board password has board access and the GitHub identity of the visitor is not checked; that best-effort writes can lose a simultaneous external edit; and that /health does not prove GitHub or TLS. No secret values, no hostnames beyond what is already public in the repo, no promise of uptime.
5. Tests. Cover: default bind is loopback; a configured host is honoured; an invalid host fails startup with a non-zero exit and one actionable message; /health returns 200 with the expected keys; /health requires no credentials; /health leaks no secret or repository value even when those variables are set; existing authenticated routes still require the password; the start command serves /health.
</scope>
<criteria>
Every claim in the operations section is either proven by a command in this slice or explicitly labelled unverified. No new authentication path, no token in output or logs, no wildcard default, no behaviour change to board writes, answers, repository selection or Done handling. Full test suite, typecheck and the bundle build reproduce green, and the built artifact is committed fresh. The worker reports which of the five L5-preview blockers this slice removes and which remain owner-only.
</criteria>
<must_not_do>
No PWA, service worker, push notifications, polling coordinator or #31 work.
No multi-repository behaviour from #37.
No deployment, container recreation, port publishing, proxy or TLS change; those need the owner's explicit go.
No secret creation, reading or printing.
</must_not_do>
<output>
Commit the slice and its tests on the feature branch, not on an integration branch. Report: env variable names honoured, exact commands run with exit codes for bind/health/start, test counts, bundle hash, files changed, which preview blockers remain, blind spots, actual provider/model. Return at most 12 lines. Independent hostile review follows; do not self-approve.
</output>
