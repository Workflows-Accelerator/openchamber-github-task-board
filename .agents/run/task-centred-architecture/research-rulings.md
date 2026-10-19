# Research adjudication — inputs to synthesis

Date: 2026-10-19
Scope: judgement about evidence quality and proposal authoring, NOT approval to implement architecture.

## Research is not runtime proof
R1. Original research reports are evidence leads, not accepted platform specifications. Board report f77a2a9 has independent verdict PARTIAL / NEEDS-FIXES at 952cc90. Its unsupported claims must not propagate. The final issue must receive its own independent review after corrections.
R2. Use provenance labels: source-observed (installed code/version), documented (official source/date), proposed (future behavior), unknown (requires check). Do not claim runtime tested from schema/source inspection. No application tests, GitHub mutation tests, scheduler changes or hidden-skill live invocation have been performed for this mission.
R3. No nonexistent proof artifact may be cited. Board's proof-sdk-headers-dropped.test.js reference was rejected by independent review. Evidence filenames must actually exist.

## Board corrections required by independent review
B1. Panel-only execution cannot promise unattended work while closed. Coordinator hosting is an OPEN DESIGN CHOICE. Distinguish host extension service, OpenCode plugin, and shared hosted controller without choosing on user's behalf.
B2. A local SQLite/lockfile coordinates only within its enforced single-controller boundary. It cannot elect a cross-device leader, stop an expired worker still running or protect writes by external GitHub clients. A common authority is needed for multi-device claims. Lease fencing works only where checked before side effects; do not promise exactly-once arbitrary execution.
B3. No supported issue mutation CAS means fresh-read/text matching and revision comments are risk reduction, not atomic protection against human edits. Prefer narrow append/patch operations, conflict detection/readback and explicit recovery; state residual race honestly. Do not promise an invisible token prevents clobbering.
B4. Coordinator technical state belongs in extension-owned storage through supported interfaces, not injected schemas in OpenCode core opencode.db. Existing worktree registration under present lifecycle is not authorization to invent new core DB tables.
B5. Fast path removes optional ceremony, not independent hostile review or human acceptance/release/closure authority. Approval is scoped/versioned and cannot be inferred from a checked unrelated task or an issue activation.
B6. Native synchronous question tool suspends that worker. Optional questions need asynchronous durable recording on the task while independent useful work continues; proposed task.ask is not an implemented API. All useful work blocked -> actionable human queue while phase preserved.
B7. Ordinary reviewer-found defects loop back to bounded execution fixes; not every failing test requires human attention. Escalate permission/product forks or exhausted bounded recovery.
B8. Source-observed SDK 2.4.0 clamping/header/open-file limitations apply to that SDK route/version, not necessarily all current host integrations. data.skills inert metadata does not activate skills. Avoid unproven file:// navigation. Stopping one shell is not aborting the agent session; cancellation doesn't undo committed side effects.
B9. Schedules: preserve evidence per route/version. Reviewed older openchamber-plugin.js enum lacks schedule.update, but THIS session's current advertised openchamber contract includes schedule.update. Neither inventory proves live behavior of the future extension. Do not prescribe delete/recreate as universally necessary; future adapter must capability-check and prove editing safely. Do not mutate real schedules in research.
B10. Five workers polling once per five seconds => 3,600 requests/hour before other requests. Primary quotas vary by authentication and endpoint; 5,000/hour is common, NOT universal. Remove unmeasured 200–800ms/zero-latency claims. Secondary/content-generation limits/backoff need actual endpoint/auth context.
B11. Parallel work partitions by files and shared external resources as well as concepts. A worktree isn't a conflict-prevention mechanism. This mission allows parallel read-only probes with disjoint report ownership; do not silently prescribe broader concurrent code-edit policy.
B12. Portable source references use repository/commit-relative links; private artifacts require authorized durable locations. Local absolute paths can be optional workstation navigation hints, never sole evidence or public sensitive context.

## GitHub claims requiring reviewer evidence
G1. Native subissues and dependencies are promising reuse. Exact counts, one-parent semantics, owner/privacy/cycle limits, CLI flags, fields rollout/auth and transfer stable IDs must be verified rather than copied from the first research report.
G2. Report asserted new GraphQL node ID on transfer without explicit evidence; unresolved until independent primary-source check. Preserve redirect/identity mapping and canonicalization as requirement; don't hardcode unsupported ID change/stability.
G3. Report included Needs Human in proposed phase enum despite orthogonal attention requirement, and called old contract 100% compatible. Both must be corrected; v1 read compatibility does not make current runtime implement v2 semantics.
G4. Org issue fields vs Projects fields vs issue types are distinct. Don't mandate newly available/org-only fields or admin setup for baseline. One authoritative representation and explicit fallback; no two-way ambiguous dual-write state.
G5. Public webhook receivers/relays and redelivery are possible; NAT doesn't make webhooks categorically impossible. Reconciliation is still needed for missed events/outages. Panel focus polling cannot be only unattended mechanism.
G6. An external shared coordination store is not automatically a competing work truth. Judge whether it stores operational claims vs authoritative intent, acceptance and decisions. Do not dismiss options purely by name or add distributed services without proven need.
G7. Projects draft intake vs private intake repo remains a user choice. Projects draft may not behave like a full issue (comments, links, native relations). Never silently leak cross-client input into this public extension repo.

## Skills evidence boundary
S1. Original wake claims installed source supports metadata opencode/autoinvoke false and/or disable-model-invocation true while skill IDs remain resolvable; nesting alone doesn't hide; path invocation unsupported. Independent reviewer must distinguish exact parser/boolean/alias/version semantics and permission restriction.
S2. Existing oxygen router/specialists metadata is source precedent, NOT demonstration of hidden authorized load in current session. Dynamic workers may lack skill tool even if main agents have it; transclusion fallback remains needed.
S3. Manager direct read of config-worktree skills.md was denied. Do not retry denied read through shell, another tool or content-copy worker. Use authorized completion summary and review verdict for routing; any raw evidence unavailable at publication remains clearly unverified.
S4. Directory/router taxonomy and changes to agent instructions remain proposals. Current delegate/brief/disk contracts continue to govern until replacement is approved, implemented and empirically proven. Do not prematurely delete them.

## Operational incident
I1. Accidental duplicate GitHub review sessions ses_b56f866fa48707aa35b84356 (designated) and ses_faa2494e941ea798902a7432 (duplicate) share report ownership. Stop follow-up rejected because duplicate busy. User informed to stop duplicate. No more sessions for that task until completion; compare immutable review commits for collision before use. Both report-only: no application changes authorized. Preserve history; never reset/force/delete work.

## Synthesis and publication boundary
P1. Produce ONE deep architecture draft issue, no execution child issues or architecture rewrite. Recommendations and technical alternatives may be explored without choosing them for the user. At most five high-leverage alignment choices in executive section; deeper technical checks grouped as later proof tasks.
P2. This architecture draft can use existing v1 headings/status for readability, explicitly identifying future semantics as proposed. No agent marks acceptance criteria met, human tasks completed or issue done.
P3. No branches pushed, PRs opened or merges without explicit user permission. Issue creation alone was authorized by original request; use approved authenticated path without revealing credentials and read back content before claiming published. gh missing in manager environment; do not install or bypass auth/permissions to publish.
