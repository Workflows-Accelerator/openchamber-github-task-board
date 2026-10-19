# Manager draft findings and fix requirements

Status: manager pre-adjudication after synthesis at 474e7cb. The independent reviewer is running; this file is not a substitute for its proof. Findings here are grounded in the pinned draft, the v1 issue-body contract, and the reviewed research rulings.

## A. Blocking defects (must fix before publication)

### A1. The draft does not use the v1 parser headings
- Contract: `### Friendly Title:`, `### Acceptance Criteria:`, `### Actionable Subtasks Checklist:`, `### Open Questions:`, `### Human Tasks:`, `## Test Plan (Issue)`.
- Draft: `## Friendly Title` (no colon), `## Acceptance Criteria` (level 2), `## Actionable Subtasks Checklist` (level 2), `## Open Questions` (level 2), `## Human Tasks` (level 2).
- `parseFriendlyTitle` regex requires `Friendly Title:` with a colon; the draft will not parse. The "Compatibility Shell Note" claim is false.
- Fix: use the exact contract spellings/levels, and remove the false compatibility claim. Verify every section against `docs/issue-body-contract.md` and `panel/core.ts`.
- The separate `Title:` first line must not be part of the published body; the publisher uses it as the GitHub issue title only.

### A2. Unapproved architecture choices are presented as decided
- The draft recommends a dedicated private intake repository (`org/intake`), a host extension daemon, and per-run child issues. Recommendations are allowed, but acceptance criteria, Human Tasks and Test Plan then treat them as selected:
  - "Quick Add captures ideas into a private intake repository" (acceptance).
  - "Designate or authorize creation of the dedicated private intake repository" (human task).
  - "Verify task is created in private intake repo" (test plan).
  - "Create host background coordinator daemon" and "host.storage" (proposed implementation slices).
  - "Definition issue creates distinct child run sub-issues" (test plan).
- Fix: every downstream statement must be conditional on the user's choice, or explicitly say "whichever intake/controller/recurrence option is approved". Keep the decision table as a recommendation with fair alternatives. Do not silently choose a central intake repo, hosting route, or run representation.
- The user has not approved implementation, child execution issues, branch pushes or merges. Label implementation slices as "proposed, not authorized".

### A3. Rate guidance misstates evidence and invents a magic constant
- Draft: "max 80/min, max 500/hr, 900 REST points/min (mutations cost 5 points)" and ">= 7.2s average pacing".
- Ruling B10/G8/G10: 80/min and 500/hour are general documented content-generation guidance, not universal guarantees; quotas vary by auth, endpoint and shared token. The official page also documents 900 REST points/min and 5-point mutation costs in the secondary-limit point table, so those numbers are source-backed; they are not a safe throughput promise. 7.2s is only arithmetic at 500/hour with no shared usage; it is not a safe constant. Fixed pacing must not be prescribed.
- Fix: keep the documented point numbers with a link and a "general guidance, not guaranteed" caveat; use adaptive, response-aware budgets; honour `Retry-After`/rate headers where the supported request path exposes them; state the SDK header limitation; say exact thresholds are unknown/NOT RUN. No universal quota claim; no 7.2s magic constant.

### A4. Destructive retention language
- Draft: "retention requires active deletion rather than archiving" and "purging deleted items".
- Ruling G4/G9: archiving does not free the 50,000-item Projects cap, but no automatic deletion is approved; deletion or sharding is a later decision. The current draft recommends permanent deletion as the answer.
- Fix: state the capacity fact, then say retention/partitioning is an open decision; no automated destructive cleanup; preserve audit history; bounded run history is a design option.

### A5. Invented API/host names
- Draft names `task.claim`, `task.update`, `task.ask`, `task.record_evidence`, `task.handoff` and `host.storage` as if they exist.
- These are proposed operation semantics, not existing tools/host APIs. `host.storage` is not verified; the SDK gap and storage route need proof.
- Fix: describe operations semantically (claim/hand-off/record evidence/ask/complete) and explicitly say names, APIs and storage mechanisms are unproposed implementation details pending capability proof. Do not assert `host.storage`; say "supported extension-owned storage to be verified".

### A6. Overclaims about exactly-once, crash detection and conflict detection
- Draft: "detects crashes", "recover idempotently", "detect external human edits" via read-hash-patch-verify.
- Reality from rulings: lease expiry is not death; no CAS on unsafe GitHub mutations; readback can detect a post-write conflict but cannot prevent a lost update in the race window; arbitrary external effects cannot be exactly-once.
- Fix: say "best-effort reconciliation; duplicate or orphan effects remain possible; fencing only where the effect checks it; preserve human edits and escalate conflicts; exactly-once is not claimed."

### A7. Unsupported "zero leakage risk"
- Draft: private intake repo has "zero leakage risk".
- No system has zero leakage risk; privacy depends on org/repo permissions, transfer, links, screenshots, logs and user behavior.
- Fix: "private by default; reduces exposure; not zero risk"; state private-context handling and transfer visibility.

### A8. Decision table has strawman alternatives and conflates routes
- "Full Autonomy: rejects user control; unacceptable" and "Panel Iframe Loop: dies" are not fair tradeoffs.
- Decision 3 combines a host extension daemon and an OpenCode plugin as one recommendation; they are different routes with different proof needs.
- Fix: present all credible options fairly; recommend "one authoritative controller first; hosting route selected by a bounded runtime probe" or separate the routes; state costs/risks of each.

### A9. Sources and provenance are not in the issue body
- The issue body has almost no usable links and no provenance section. The companion `source-receipts.md` will not be published with the issue.
- Fix: add a compact "Sources & Evidence" section with official documentation links, source-observed versions/paths (no private absolute paths), date, and an explicit NOT RUN list. Do not invent citations or claim remote mutation proof.

### A10. Implementation checklist implies authority
- `### Actionable Subtasks Checklist:` contains concrete implementation steps (parser, daemon, API integration, retention purge, deprecate delegate) without saying they are proposed only.
- Fix: keep the required heading, but add a line: "Proposed migration slices; none is authorized by this draft. No child execution issues, code changes, deployments or deprecations are approved." Make slices capability-probe-first and non-destructive.
- Do not say "deprecate delegate" or "transition from disk briefs" without the explicit proof gate. Current delegate/brief/mission contracts remain binding until replacement is approved and proven.

## B. Missing requirement coverage (fix in the revised draft)

1. Representation and single source of truth for phase, attention, liveness, dependency and recurrence. The draft lists four axes but never says where each lives (labels, body sections, native fields) or how v1 `status:*`/`needs-human` maps. The user wants one authoritative phase and no dual-write. State the proposed representation and the migration rule.
2. Existing v1 `idle -> needs-human` behavior conflict. The draft says idle must not mean human-blocked, but the current status semantics do exactly that. Add a migration change and acceptance test.
3. Dependency representation conflict: v1 `Blocked by #N` body edges vs native issue dependencies. Choose one authoritative representation or define a clear reconciliation/fallback for cross-repo and old issues; no silent dual-write.
4. Cross-repo/transfer/private limits: native sub-issues are same-owner and one parent; cross-repo dependencies use full URLs; cross-org private dependencies, transfer redirects and GraphQL node-ID stability are UNKNOWN. State handling and identity mapping; no claim that transfer preserves identity.
5. Scheduled/event-triggered tasks: define reusable definition vs per-run history, editing, pause/cancel, overlap/missed-run/catch-up, timezone, event authentication, dedupe/replay, and failure alerts. The draft only tests non-overlap. Note that scheduler edit/catch-up/overlap semantics are NOT RUN.
6. Offline/GitHub outage/reconnect: reconciliation, queued writes, lost POST responses, duplicate webhooks (no automatic redelivery), rate-limit backoff, token expiry/revocation, and safe retry bounds. Add an explicit scenario.
7. Stale approvals and scope revocation: a human approval that changes mid-run, canceled/closed/transferred/deleted tasks, revoked permissions, and work already in flight. State stop/fence behavior and residual risk.
8. Worker replacement: issue-alone recovery must use durable commit/test/artifact evidence, not session IDs or local paths. The template's `ses_123` should be illustrative and not required to resume.
9. Exploration outputs: the plan must name desired outputs, model/tier per phase, skills, tools, files, limits, verifier, decomposition and parallelism; scale this down for small tasks. The draft only mentions budget/tools in the template and omits per-phase model/skills.
10. New tools/web search and past work: add explicit optional web search for new tools/references; no mandatory research ceremony; record sources and hypotheses.
11. Subtask vs dependency vs checklist distinction: native child issue = contained deliverable; dependency = ordering edge; GFM checklist = execution micro-step. The draft is close but should state it explicitly.
12. Parallelism and collision model: disjoint file paths and shared external side effects; no promise that parallel workers can edit the same file; worktree isolation; merge/review gate; partial failure of one child does not block independent siblings.
13. Human attention is not a phase and not all questions block. Optional questions must not freeze useful work; blocked means no authorized continuation remains. The draft states this but the acceptance/test plan should cover a non-blocking question and a blocking permission separately.
14. Tiny-task fast path: no mandatory swarm, no skipped independent hostile review, no auto-close. The draft says this; add the cost ceiling and "ordinary review defects return to bounded execution".
15. Authority/security: issue text and web/skill content are untrusted data, not instructions; issue text cannot grant tools or permissions; secrets/private context excluded; agents never check human boxes; approvals are versioned/actor-scoped; hiding a skill is not a security boundary; permissions must be enforced.
16. Skill disclosure: source-observed metadata, invocation by ID not path, aliases unsupported; dynamic-agent currently denies skill tool; solo allowlist; hidden invocation not live-proven; transclusion fallback; no claim of current capability.
17. Directory/router skills: incremental proposal; do not require six or any fixed taxonomy; prove discovery/loading and least privilege before rollout.
18. Intake: no silent `org/intake`; compare private repo, Projects draft, local transient; routing confidence and explainability; new repo/domain/cloud provisioning gated; repo-less/new-project path; no public leak.
19. Controller: one authoritative controller (or explicit fencing) first; panel iframe not a long-lived host; host service/plugin/central relay tradeoffs; multi-device is an open choice; no core DB schema writes; storage proof.
20. Body format: add `Decisions` and `Next authorized action` to the repeatable template; keep links, questions, human tasks, evidence, constraints, relative paths, no secrets. The current template lacks decisions and next action.
21. Agent/skill rework: `team` decomposition + review/dispatch; `solo` single-task state in issue; `worker` bounded execution; `dynamic-agent` general worker; local mission/brief files become ephemeral caches. Durable work is task-centric; no ad-hoc `delegate`, but an authorized lead may dispatch bounded ephemeral exploration/verification workers under the task plan with a cap and recorded outputs. Retain delegate/disk briefs until proven. Per-task skill router/permissions and hidden-specialist proof gate.
22. OpenChamber capability gaps: session start/resume/abort, request headers/ETags, model/skills/agent/directory injection, host open file, scheduler update/catch-up, stopShell vs abort. All NOT RUN; no availability claims.
23. Recurring/event work is a task class, not a phase; definition vs run record; issue-body size limits and high-frequency logs in comments/artifacts, not the canonical body.
21. Sources: official docs, source-observed version/paths, date, and NOT RUN list; distinguish DOCUMENTED / SOURCE-OBSERVED / PROPOSED / UNKNOWN.
22. Read compatibility: v1 issues must render without modification; parser tests; no automatic rewrite of old bodies.
23. Migration: staged, opt-in, pause/rollback, no old/new controllers both owning a task; retain delegate/disk briefs until proven; no implementation until separate approval.
24. Human decision count: at most five high-leverage choices; do not add a sixth decision disguised as an open question. If event-trigger semantics need a decision, fold it into recurrence or defer as a proof item.

## C. Keep (good material)
- The four-axis separation (phase, attention, liveness, dependency) is the right backbone.
- The "blocked only when no authorized continuation" definition is correct.
- The distinction between native child issues, dependency edges and GFM checklists is right.
- The "private intake, human decision on uncertainty" instinct is right; keep it as an option, not a silent choice.
- The staged migration and "no implementation" boundary are right; make them explicitly non-authorized.
- The ten scenarios are a good base; extend them with the edge cases above.
- The title direction (plain, positive, outcome-first) is right; improve the exact wording.

## D. Fixer output requirements
- Revise `issue-draft.md` in the proposal worktree, preserving the proposal's strongest material.
- Update `design-evidence.md` traceability for every changed requirement and every reviewer blocker.
- Update `source-receipts.md` only where a source correction is needed; no invented sources.
- Add `revision-notes.md` mapping each finding ID to its resolution and listing any deliberately parked item with reason.
- Use exact v1 headings. Keep all future acceptance criteria, human tasks and test plan items unchecked. Mark all runtime claims NOT RUN where unproven.
- Do not publish, push branches, open PRs, edit code/config/skills/agents, create schedules or child issues.
- Commit only the proposal run-state artifacts. Return the commit, a short list of resolved blockers, and any residual uncertainty.
