<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection
Branch: fix/issue-50-host-connection, HEAD 698d2c6 (approved Revision 2 plan + rereview), clean. Base master ab7516c4a3634c3d69f7b82936ddb7655d327ebb.
Preflight facts are authoritative at dispatch: skip initial pwd/ls/git status discovery. Targeted checks for mutations, pre-commit verification, or failure diagnosis are allowed.
Files: service/main.ts, service/config.ts, service/types.ts, service/lease-store.ts (inspect only unless minimally required), panel/main.ts, service/main.js, panel/main.js, test/service-host-connection.test.js, test/panel-service-connection.test.js, test/stage2b-pilot-coordinator.test.js, test/shipped-parity.test.js.
Test commands: npm run build ; npm run typecheck ; node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js ; node --test test/*.test.js
Do not touch: package.json, package-lock.json, panel/index.html (reserved for sequential #51), web/**, .agents/run/issue-50-plan/**, .agents/run/issue-50-plan-review/**, .agents/run/issue-50-plan-rereview/**, root checkout, other worktrees.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, task creation, agent starts, host toggles/restarts, production data. Zero emojis anywhere in code, tests, comments, or commit messages.
</env_preflight>
<goal>
Implement Issue #50 per approved Plan Revision 2 and the four re-review advisories using TDD, rebuild the service and panel bundles, and record empirical L0-L3 proof on disk.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan/PLAN.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-plan-rereview/findings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-50-plan-review-gate.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/implementation/lean-build/SKILL.md]
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
<depends_on>
none
</depends_on>
<criteria>
1. Service host adapter (stdlib only: node:http, node:crypto, node:url, node:fs):
- Direct-run entry guard uses realpath fallback (Advisory 4: compare process.argv[1] and safe fs.realpathSync(process.argv[1]) against fileURLToPath(import.meta.url)) so importing service/main.ts or service/main.js in tests has zero listener/timer/exit side effects, while host spawn (`node [absoluteEntry]`) always starts the server.
- Fast-fail startup config validation runs strictly BEFORE storage/leaseStore/CoordinatorService initialization. Test raw process.env.OPENCHAMBER_SERVICE_PORT directly against `/^[0-9]+$/` WITHOUT prior `.trim()` (Advisory 2), range 1..65535; require non-empty string OPENCHAMBER_SERVICE_TOKEN (reject missing or whitespace-only). On invalid config: write a single fixed sanitized line to process.stderr (never echo env values/tokens) and `process.exit(1)` immediately.
- Bind strictly to `127.0.0.1` on the validated port.
- Constant-time bearer auth: parse `^Bearer\s+(\S+)$` (reject missing header, non-Bearer scheme, empty/whitespace token, or trailing tokens), SHA-256 hash both expected and presented tokens to 32-byte buffers, compare with `crypto.timingSafeEqual`. Never throw RangeError on any input length. Never log or reflect tokens.
- Route confinement: ONLY authenticated `GET /health` returns 200 JSON `{"status":"ok","service":"task-coordinator"}`. Unauthenticated requests return 401 `{"error":"Unauthorized"}`. Other methods on `/health` return 405 `{"error":"Method Not Allowed"}`. All other paths (including `/status`) return 404 `{"error":"Not Found"}`. Zero disclosure of ownerId, activeLeases, PIDs, paths, or config.
- Bounds & shutdown: 15s socket timeout, 64KB body cap (413/destroy on excess). On SIGTERM/SIGINT: stop accepting connections (`server.close()`), `server.closeIdleConnections?.()`, arm 2,500ms unref'd safety timer calling `server.closeAllConnections?.()` (Advisory 3), await `coordinatorService.stop()` (clears poll timer, releases ONLY own leases where `entry.ownerId === this.ownerId`, preserving foreign unexpired leases), exit 0 promptly (<1,500ms normal path).
- Preserve all existing public exports and methods on `CoordinatorService`, `config.ts`, `types.ts`, `lease-store.ts`.
2. Panel caller (`panel/main.ts`, Decision D59):
- Runs once per panel open inside `host.onReady`. No polling, no retry loop, no re-run on directory/session events, no new toolbar button, no auto-grant.
- Calls `host.serviceRequest({ method: 'GET', path: '/health' })`.
- Outcome 1 (status === 200): only call `hideBanner()` if `#boardBannerText` currently contains `'Background coordinator'` (Advisory 1 — never dismiss unrelated repo/token setup banners); log sanitized info.
- Outcome 2 (`err.code === 'NO_SERVICE' || err.code === 'DISABLED'`): `showBanner('Background coordinator service is not enabled in OpenChamber Settings -> Extensions.')` (ASCII `->` to respect zero-emoji/clean-ASCII policy; check existing file conventions).
- Outcome 3 (non-200 or any other error code like `SERVICE_FAILED`, `REQUEST_FAILED`, `HOST_TIMEOUT`, `HOST_UNAVAILABLE`, `UNKNOWN`): `showBanner('Background coordinator service failed to connect.')` (or unexpected status message for non-200); log sanitized warning with code only (never raw Error object or token). Never claim success on failure.
- Export or structure the caller helper cleanly so `test/panel-service-connection.test.js` can exercise the real function (not a copy-pasted clone in the test) against a stubbed bridge and DOM fixture.
3. Build & Tests (Red-Green):
- Write `test/service-host-connection.test.js` (spawns built `service/main.js` with isolated temp dir under `os.tmpdir()`, ephemeral port, synthetic token) covering: 200 health handshake; 401 missing/wrong/1-byte/500-byte/malformed auth without RangeError; 404 `/status` and `/unknown` with zero ownerId/lease leak; 405 `POST /health`; fast-fail (<500ms, exit 1, sanitized stderr, token not echoed) on `3000abc`, `" 3000 "`, `0`, `99999`, missing token, whitespace token; >64KB payload rejected; SIGTERM exits 0 promptly, releases own lease, preserves seeded foreign unexpired lease; importing `service/main.js` as a module does not bind a port or exit.
- Write `test/panel-service-connection.test.js` testing the real panel caller logic across: 200 connected (leaves unrelated setup banner intact, clears prior coordinator banner); `NO_SERVICE` and `DISABLED`; `SERVICE_FAILED` / `REQUEST_FAILED` / `HOST_TIMEOUT` / non-200; verifies `serviceRequest` called once with `{ method: 'GET', path: '/health' }` and no raw Error/token logged.
- Rebuild both `service/main.js` and `panel/main.js` via `npm run build` so built bundles match TypeScript sources.
- All suites pass: `npm run typecheck`, new tests, `test/stage2b-pilot-coordinator.test.js`, `test/shipped-parity.test.js`, full `npm test`.
4. Proof artifact:
- Write `.agents/run/issue-50-build/verifications/proof.md` recording exact commands, exit codes, raw output snippets, and explicit separation of fixture observations vs unverified authenticated OpenChamber parent host.
</criteria>
<steps>
<step>Read service/main.ts, service/config.ts, service/types.ts, and the relevant banner/onReady sections of panel/main.ts.</step>
<step>Write failing tests in test/service-host-connection.test.js and test/panel-service-connection.test.js, run them to confirm RED.</step>
<step>Implement service config validation, HTTP host adapter, and realpath direct-run guard; build service and verify service tests GREEN; commit locally.</step>
<step>Implement panel D59 caller with banner guard; build panel + service and verify panel tests GREEN; commit locally.</step>
<step>Run npm run typecheck, shipped-parity, stage2b-pilot-coordinator, and full npm test; write .agents/run/issue-50-build/verifications/proof.md and commit locally.</step>
</steps>
<verification>
npm run build && npm run typecheck && node --test test/service-host-connection.test.js test/panel-service-connection.test.js test/stage2b-pilot-coordinator.test.js test/shipped-parity.test.js && npm test
</verification>
<output>
Local atomic commits on fix/issue-50-host-connection (do not push). Return <=12 lines: status; commits created; files changed; new test counts + full suite count/pass; proof.md path; any deviations or findings; actual provider/model.
</output>
