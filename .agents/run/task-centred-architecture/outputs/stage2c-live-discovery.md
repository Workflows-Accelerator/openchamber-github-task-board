# Stage 2C live discovery — 2026-10-23

Verdict: investigation complete; unattended issue-body mutation and autonomous worker spawning NOT ready. Smallest useful next increment is a real, explicitly activated background observer for one repository and already-linked sessions, with no GitHub writes. Then an independently gated append-only receipt pilot can make evidence durable on issues without replacing human-authored bodies. Neither increment was implemented here.

Identity: supplied execution identity Engineer, provider/model `9router/engineer`; no independent session-record identity lookup available in this tool set. Tools used: local reads/search, shell, report write. No opencode.db access.

## Baseline and scope

Observed before investigation:
- Checkout `/workspace/extensions/github-task-board`, branch `feat/v2-binding-and-ratelimit`, HEAD `16886c19a4d7a133735d30f27b16fa90040eed3e`.
- `git status --short` contained six pre-existing untracked paths: `.agents/idle-nontext-state.json`, `.agents/run/board-lifecycle/brief-capability-fix.md`, `.agents/run/board-lifecycle/brief-release-1.2.1.md`, `.agents/run/board-lifecycle/verifications/test-inspect-capabilities.test.mjs`, `.agents/run/task-centred-architecture/tasks/stage2c-live-discovery.md`, `.agents/run/test-inspection.mjs`. Left untouched.
- Installed host package `@openchamber/web` version 2.4.0 at `/usr/local/lib/node_modules/@openchamber/web`; extension-local `@openchamber/sdk` also 2.4.0. Runtime `node --version`: v22.23.3 (host package advertises Node >=24.14.0; not repaired here).
- No daemon started, grant/settings changed, worker spawned, issue/comment/label mutated, branch changed, commit created, build run, or application test suite run. Historical 467-test results are not new evidence.

## Evidence levels and direct observations

Manifest declaration is not runtime proof. Actual authenticated HTTP reads were made against the running host on `http://127.0.0.1:3000`, and one authenticated GitHub issue GET was made. Synthetic probes imported the shipped service bundle without executing its direct-entry branch. Only disposable files under a newly created `/tmp/opencode/stage2c-discovery-*` directory were used and removed.

1. Unauthenticated `GET /api/guests` and `GET /api/sessions/snapshot`: both HTTP 401. This is not an unauthenticated loopback API.
2. Supported `POST /auth/session` using the already-injected UI password in memory: HTTP 200. Cookie remained in memory; no credential value, cookie, authenticated remote, request body containing secrets, or credential file was printed/read/persisted. This creates transient login state, not a durable client credential; `issueClientToken` was not requested.
3. Authenticated `GET /api/guests`: HTTP 200. Actual installed `github-task-board` is enabled, service runtime `host`, service granted true. Requested and granted capability lists were both `[prompt,sessions,files,service,network,filesystem,origins]`.
4. Authenticated `GET /api/guests/github-task-board/service/status`: HTTP 200, `{"status":"stopped"}`. No service-start request was made. No observed running coordinator, health response, panel-close survival, restart recovery, or lease heartbeat.
5. Authenticated `GET /api/sessions/status` and `/api/sessions/snapshot`: HTTP 200, 81 status records at observation. Status records had `status`, `lastUpdateAt`, `metadata`; sampled records were `idle` with empty metadata. `pending` was empty. No live permission/form/page blocking example was observed, and idle is not proof of successful task completion.
6. Authenticated host proxy `POST /api/guests/github-task-board/request` carrying ONLY upstream `GET /repos/Workflows-Accelerator/openchamber-github-task-board/issues/26`: outer HTTP 409, `error: DISCONNECTED`. Host integration is not connected through this route despite network grant.
7. Direct GitHub GET of the same issue, using existing injected `GITHUB_TOKEN` in memory: HTTP 200, issue open, body present; rate remaining 4961 for this response. This proves this research process can read the issue, NOT that the sandboxed service receives this credential, NOT write permission, and NOT a universal quota.

## Actual integration gap

`service/main.ts:147–159` tick only prunes leases. It never fetches repositories/issues/sessions, calls claiming/reconciliation libraries, renews heartbeats, starts workers, or writes GitHub. `dryRun` changes no tick behavior; configuration defaults to false. Enabling the manifest cannot turn these exported helpers into a working coordinator.

Host contract sources:
- `node_modules/@openchamber/sdk/GUEST_SERVICES.md`, sections Model, Service process contract, Lifecycle.
- Installed host `server/lib/guests/service.js`: spawn/readiness at approximately 458–529, environment allowlist at 543–565, request admission at 613 onward, ordinary panel-driven services have no idle-stop option by default.
- Installed host `server/lib/guests/routes.js`: request route 520–560, service request 562 onward, status 709 onward.
- Installed host `server/lib/guests/service-registry.js`: per-process registry/reaper, not a coordinator ownership lock.

Host starts ordinary service lazily on first `serviceRequest`, not merely because a manifest exists or panel opens. It spawns compiled entry with cwd = package root, a minimal environment, allocated `OPENCHAMBER_SERVICE_PORT`, and `OPENCHAMBER_SERVICE_TOKEN`. Service must listen on 127.0.0.1, authenticate every request, and return HTTP 200 from authenticated `GET /health` within 15 seconds. Exit/readiness failures are reported; this is not an automatic restart supervisor. Pause, withdrawal, uninstall, and host shutdown stop services. Ordinary started service can outlive its panel by source contract; startup after host restart still needs a trigger. Browser-provider role is a separate special lifecycle, not a legitimate task-coordinator workaround.

Our `service/main.ts` and shipped `service/main.js` have no HTTP listener, port/token handling, or `/health`. Source inference: first serviceRequest would time out readiness and be discarded. NOT live-tested because that would start the existing service and touch its real storage. `panel/main.ts` has no serviceRequest activation. Sister extension runtime behavior cannot validate this extension.

Environment allowlist excludes `OPENCHAMBER_HOST_ORIGIN`, `COORDINATOR_*`, `OPENCHAMBER_DATA_DIR`, UI password, agent-tool token, and GitHub token. The service bearer authenticates host-to-service requests; it is NOT authority to call host UI routes. `service/config.ts` only configures an origin, not authenticated outbound access. Passing credentials through global environment is neither present nor recommended.

Storage bug: `CoordinatorService` constructs `new LeaseStore(undefined, ttl)` rather than a store rooted at `this.config.storageDir`. Synthetic probe constructing service with temporary `storageDir` (without start) reported `storage override honored? false`. Thus startup directory logging/creation and actual lease persistence may disagree. Both default resolvers also use shared `/workspace/.openchamber-data/task-coordinator` here; no instance namespace.

## Session contracts and safe normalization

Sources: local SDK `dist/workspace.d.ts:15–55`; `panel/types.ts:18–29`; installed host `server/lib/notifications/routes.js:287–356`, `server/lib/opencode/session-runtime.js:1–135,271–291`; UI authentication `server/lib/ui-auth/ui-auth.js:892–929`, `server/lib/opencode/core-routes.js:704–710`, and `server/lib/ui-auth/DOCUMENTATION.md`.

SDK session record uses activity `unknown|idle|running|retrying|waiting-permission|waiting-question`, separate observed-turn `outcome: completed|failed|null`, repo-bearing attachment items, and project/directory. Snapshot also supplies loading/error/coverage. Current watcher ignores `outcome` and maps retry/unknown/unrecognized objects to idle. Synthetic probes against shipped bundle:
- `{activity:'idle',outcome:'completed'}` -> idle.
- `{activity:'idle',outcome:'failed'}` -> idle.
- `{status:'retry'}` -> idle.
- `{activity:'unknown'}` -> idle.

Host REST status route differs from SDK: session-ID keyed records containing status, lastUpdateAt, metadata; pending blockers are a separate keyed map containing `permissions`, `forms`, `pages`. Host source tracks permission.asked/replied, form.created/settled and waiting rendered pages. Forms replace the older question route in this host version. Do not feed raw REST envelope to watcher or treat arbitrary permission policy arrays as pending approvals. Do not map empty/missing/stale status or missing pending entries after restart to success. Source says pending map clears on OpenCode restart and snapshots age out after 24 hours.

Normalize pending permissions first; forms/pages as human questions; running/retry as active; idle/unknown as inconclusive unless an observed, attempt-correlated completion/failure exists. SDK outcome is a TURN outcome, explicitly not task status. Never advance on idle alone, nor reuse an old completed turn after a new prompt. For a first observer, report unknown where terminal proof is unavailable instead of fabricating completion. Full worker result/attempt correlation remains required before automatic phase advance.

Host UI supports password session cookie and trusted-client bearer authentication. Only transient cookie access was demonstrated. Existing service gets neither. A supported capability-scoped outbound bridge or deliberately provisioned authenticated transport remains a real implementation dependency; do not scrape host process environment, copy credential files, disable authentication, or treat inbound service token as outbound authorization. No authenticated background-only SDK bridge was established in this investigation.

## GitHub/repository/opt-in boundaries

Panel `githubRequest` at `panel/main.ts:1250–1355` prefers a credential-file/stored PAT route, then host proxy. Those credential files were NOT read here. Importing panel code into a daemon would bring DOM/UI/storage dependencies and credential discovery; extract only pure parsing/identity logic, not this credential fallback. Host `server/lib/guests/request.js` supplies authorization internally, pins declared API origin, refuses redirects, bounds response size/time, but returns only status/body and accepts no caller conditional headers. Route checks effective network grant and disabled state. Live host proxy was DISCONNECTED; connection must be established before choosing it as the working production adapter. Direct injected research token is not evidence of daemon credential availability.

Repository selection currently lives in panel state/storage (`selected_repo`, `repo_${projectId}`, `cached_issues_*`; main.ts around 699–942), integration also advertises a `repo` setting. None is consumed by service. Never silently expand All Projects or infer all accessible repositories. Proposed pilot must have persisted explicit repository + project/directory mapping and a small exact issue allowlist, independent of panel mount; missing/ambiguous mapping means no action. Exclude PRs returned by issue-list APIs; validate stable GitHub identity and current owner/repository, not number alone. Transfers/moves suspend pilot until mapping is revalidated.

`service/task-claim.ts` accepts generic `pilot` label OR explicit-v2 exploration/execution. Pilot label branch permits nonterminal draft/planning/publication and absent attention. Explicit v2 is metadata format, not necessarily human authorization for autonomous work. It reads normalized fields, not raw phase/attention labels. Reconciler likewise needs normalized input; raw API labels with needs-review would otherwise be missed. `panel/core.ts:3009–3076` resolves explicit labels; later logic also derives state and must not be mistaken for authorization.

For minimal activation require ALL: repository and issue allowlist, explicit coordinator activation, exploration/execution phase, no unresolved human attention/review/questions, ready dependencies, valid project mapping, unambiguous linked attempt, and current successful observations. Unknown/malformed metadata fails closed. Do not manufacture labels or repurpose generic `pilot` as blanket permission.

Use repo-qualified identity, not issue number or session title. `panel/core.ts:3719–3840` already supplies repo-aware attachment keys; `buildSessionIndexByRepo` selects one session by activity priority but does not establish uniqueness. Multiple matching active attempts must suspend rather than choose one. `buildLaunchSessionPayload` at 1754 onward attaches GitHub URL and issue number, but has no durable attempt idempotency key. Worker creation after crash without a returned session ID remains unresolved. Stage 2C should initially observe already-linked sessions rather than auto-respawn them.

## Safety blockers: actual claims versus guarantees

### SHA preflight is not atomic GitHub CAS

`service/cas.ts` normalizes line endings and compares local SHA-256 digests. It has no conditional mutation transport. Sequence: GET body B, hash matches; human saves H; coordinator PATCH writes C derived from B. Human edit is lost despite successful preflight. Synthetic in-memory demonstration ended in `worker replacement` after intervening `human edit after GET`. Re-reading narrows but cannot eliminate this window; post-write checks cannot prove no overwritten edit. No atomic issue-body update contract was demonstrated; current host proxy cannot forward If-Match headers anyway. Do not promise conditional writes merely because ETags exist for GET caching.

Recommended bounded promise: no unattended issue-body replacement. Observer makes no remote changes. Later explicitly authorized append-only run receipt comments can preserve body/questions without CAS, but require deduplication/uncertain-outcome recovery and can still duplicate on crash. Comment mutation was NOT tested or authorized here. Automated label replacement can also race with human attention; defer it. Completion receipt is evidence for review, never approval, publication, closure, or automatic next-worker authorization.

### Lease file is not cross-process exclusion

`LeaseStore.runExclusive` uses an instance-local Promise queue. Each mutation independently reloads, checks, changes memory, writes a unique temporary file, renames. Atomic rename prevents partial JSON publication, not competing read-modify-write claims. Different processes/instances can read no lease, both return acquired, last rename wins. There is no external lock, fencing, fsync durability, strict lease-entry validation, or instance namespace. Repo keys are case-sensitive while panel identity keys lowercase.

Synthetic controlled interleaving against TWO independent shipped LeaseStore instances sharing a disposable file paused each after read before either write: results `[true,true]` for different owners claiming the same issue. This demonstrates missing inter-instance exclusion; no need to falsely describe it as a live multi-process test. A later multi-process test must exercise the actual exclusion mechanism. One expected daemon is an assumption, not enforcement: multiple hosts and orphan intervals exist.

Before effects: process-wide ownership admission plus cross-process exclusive transaction over reload/check/write, explicit local-filesystem scope, canonical keys, validated entries, and fail-closed lock/persistence behavior. Avoid unsafe stale-lock deletion based solely on TTL/PID. A single-device pilot cannot promise distributed fencing against another machine. Pause/resume or lease expiry must not silently spawn a duplicate worker while old one may live.

### Failed persistence is not safely reflected in memory

acquire/renew/release/prune mutate memory before save. Synthetic injected saveToDisk failure made acquire reject while `getLease()` still returned the phantom lease. This is not limited to corrupt-plus-unbackupable storage: any save error after mutation has the ordering problem. Existing disk reload does not reliably repair absent/unreadable disk; getters read memory. Corruption backup then reset also discards ownership knowledge, unsafe basis for a new effect. Require copy-on-write commit or rollback, unhealthy-store state, and no claim/spawn/write after any uncertain persistence/corruption event until recovery. Merely backing up bytes is not permission to reset and continue work.

### Loop and shutdown

Current async setInterval allows overlapping ticks once network latency exceeds interval. stop() clears timer but does not drain an in-flight tick; future effects could happen after lease release. prune errors currently log and continue, unsuitable for effectful ticks. Require single-flight scheduling, cancellation/drain before release, heartbeat/ownership checks before each effect, deadline/TTL budgeting, and no effects on failed renewal or stale observations. dryRun defaults must become inert by default before wiring effects; it must bypass claims/worker creation/remote writes, not just log a flag.

## Proposed smallest integration sequence (not implemented)

1. **Make actual extension host-compatible, inert by default.** Loopback listener, bearer-authenticated health/status, explicit start/stop observation controls, config validation and one correctly namespaced storage path. One deliberate activation through serviceRequest may keep observation running after panel closes; report honestly that ordinary host restart/crash needs reactivation. Do not pretend this is boot-autostart. Preserve extension pause/withdraw semantics. No browser-role impersonation.
2. **Fix safety substrate before claims/effects.** Cross-process exclusion and persistence state machine, no reset-and-reclaim, single-flight/drained loop, canonical identity, explicit opt-in allowlist. Observer can operate without task leases while read-only; do not present an advisory observation lock as exclusive execution ownership.
3. **Implement read adapters against proven contracts.** Establish supported outbound authenticated host transport first; connect host GitHub integration rather than copy PAT fallback. Read exact allowlisted issue, normalize parser state and repo-qualified linked-session evidence, read status/pending/attempt evidence, emit structured decision plus unknown reasons. Rate-aware bounded polling, timeouts, pagination only inside selected repository, Retry-After/reset handling, no blanket hourly quota assumption. No new dependencies necessary in principle.
4. **Demonstrate panel independence on this installed extension.** Authenticated health, status, bounded observation, panel closed, service still observes; pause stops it; host restart reports stopped until explicit reactivation. No live issue writes needed. If truly unattended recovery after host restart is required, obtain a real host lifecycle facility or separately supervised explicit process contract; no such general boot facility was proven here.
5. **Optional, separately authorized issue-durable receipt pilot.** One issue, one already-linked attempt, append-only uniquely tagged receipt with session/attempt/provenance/evidence links, no body/attention/phase/closure edits, no worker spawn. Persist intent before send, reconcile remote marker on ambiguous timeout, never blindly retry. This is at-least-once reconciliation with bounded duplicate risk unless stronger server idempotency is proven, not exactly-once. Human questions, reviews, and decisions remain untouched.
6. **Later, not part of smallest pilot:** authenticated/idempotent worker launch and durable attempt-to-session recovery; approval-aware automatic continuation; boot recovery; conditional field ownership. Existing panel startSession source is a candidate contract, not a runtime-verified autonomous spawn adapter.

Genuinely user-facing choice: whether background observation continues only after explicit activation per host run, and whether to authorize a later append-only receipt on a named issue. Recommend observation first, receipts only after its proof. Repository/issue and permitted work remain user authorization boundaries, not technical review questions. No need to ask user about locks, HTTP shapes, polling design, or CAS implementation.

## Exact implementation/test targets for next authorized change

Existing files:
- `service/main.ts` — real server bootstrap, admission/status, serialized/drained lifecycle, adapter orchestration; rebuild `service/main.js` only after source tests.
- `service/config.ts`, `service/types.ts` — explicit disabled/observe mode, repository/project/issue scope, attempt identity and observation provenance, authenticated transport interface, storage consistency.
- `service/lease-store.ts` — external transaction exclusion, copy-on-write/persistence health, strict validation/canonicalization, corrupt-state suspension.
- `service/session-watcher.ts`, `service/reconciler.ts` — explicit normalized contracts, retry/unknown, pending forms/pages/permissions, turn-versus-attempt outcome and attention preservation.
- `service/task-claim.ts` — conjunctive authorization guard; normalize actual raw GitHub state first; dependencies and duplicate linked-attempt veto.
- `service/cas.ts` — document/rename semantics as drift preflight, never atomic remote CAS; keep remote body overwrite unavailable.
- `panel/core.ts` — reuse/extract pure parser/repo identity only where necessary; `panel/main.ts` — explicit observer activation/status, never token handoff; `package.json` only if a documented host-supported manifest/lifecycle change proves necessary.

Proposed new files (names are proposals, not existing contracts): `service/host-client.ts`, `service/github-client.ts`, `service/session-adapter.ts`; optional later `service/attempt-store.ts` for receipt intents. Keep capability transport separated from business decisions.

Tests: extend `test/stage2b-pilot-coordinator.test.js`; add `test/stage2c-host-service-contract.test.js`, `test/stage2c-live-adapters.test.js`, `test/stage2c-cross-process-ownership.test.js`. Cover:
- Real installed-launcher-shaped minimal environment; wrong/missing bearer rejected, health ready, no bind outside loopback, storage override effective, no effects before explicit activation.
- Actual SDK idle+outcome, REST status/pending envelopes, busy/retry, forms/pages/permissions; unknown/stale/restarted/missing coverage never completed; repeated terminal turn not reused across attempts.
- Raw labels preserve needs-review and all human questions; malformed opt-in, dependency wait, terminal/closed, PR, wrong repo/project, same number across repos, multiple linked sessions all veto effects.
- Two child processes barrier-racing same/different issues; lock loss/crash/restart; failed read/backup/write/rename; no phantom claim/renew/release visible and no network/spawn after uncertain persistence.
- Tick longer than interval never overlaps; shutdown drains; renewal failure prevents effects; scoped pagination, 401/403/429/offline/backoff and response limits fail closed.
- Deliberate edit between preflight and mocked PATCH proves body overwrite route stays disabled, rather than weakening test to accept race.
- Receipt stage only: crash before send, ambiguous success, existing marker, duplicate marker, human edit to body preserved; no label deletion/closure/approval and no automatic response to human prompts.

Run narrow tests first with `node --test <new paths>`; then appropriate typecheck/build/full tests in an authorized implementation worktree. These commands are proposed, NOT run in this read-only investigation. Live proof should only read and observe until separately authorized mutation sandbox exists.

## Remaining uncertainties and release gates

- No live startup/health, panel-close, restart, stale owner, permission/form transition, completion/failure, or write-permission proof for this extension.
- No background-service outbound authenticated host capability was demonstrated. Research-process cookie and injected GitHub token cannot be assumed in launcher environment.
- Host integration is DISCONNECTED. Establish connection with supported secret custody; no credential-file workaround.
- SDK outcome is available by source contract, but full host REST completion/attempt correlation route remains to be integrated and verified. Raw status alone is insufficient.
- No distributed lock/fencing or atomic conditional issue-body write guarantee. Keep remote body replacement disabled.
- No worker-launch idempotency/recovery proof. Observe existing sessions first; do not claim full automatic orchestration is done.

Commands/probes actually completed successfully: baseline git checks; installed-source reads; unauthenticated HTTP rejection checks; in-memory password exchange and authenticated host reads; host GitHub read proxy (expected 409 DISCONNECTED); direct authenticated GitHub issue GET (200); shipped-bundle temporary-storage synthetic probes above. `rg` searches failed because `/usr/bin/bash: rg: command not found`; finally used grep/find/sed. No application tests/build were run. Synthetic adverse outcomes are evidence of defects, not passing safety tests.
