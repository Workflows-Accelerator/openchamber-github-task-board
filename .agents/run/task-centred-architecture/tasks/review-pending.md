<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
Branch: docs/task-centred-proposal
Base commit: FILL WITH SYNTHESIS COMMIT AFTER WAKE
State: NOT READY FOR DISPATCH until synthesis author returns and its commit is recorded. Then this reviewer is a FRESH independent session; author is finished and cannot be resumed. All source research is in other worktrees, read-only.
Files: issue-draft.md, design-evidence.md, source-receipts.md; manager mission/decisions/scenarios/reviewed-inputs/research-rulings; docs/issue-body-contract.md; saved official evidence in board/GitHub worktrees by immutable commit.
Test command: documentation/architecture review only; read-only. App build/tests, live controller, schedule and native hidden-skill invocation NOT RUN by design.
Do not touch: draft or any research/source file, application, config, agents, skills, credentials, schedules, core DB, GitHub issues, other worktrees. Write only owned review artifacts.
Preflight authoritative at dispatch. No initial discovery commands; targeted checks only for commit/content verification, stale resume or failure.
</env_preflight>
<goal>Independently determine whether the architecture draft is complete, source-honest, right-sized and safe enough to present to the user for design alignment, and list every blocking defect before publication.</goal>
<hostile_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are a fresh independent reviewer, not the author: distrust the draft's self-description and verify claims against pinned evidence and the user's stated requirements.
</hostile_prompt>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/explore/scenarios-to-cover.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/reviewed-inputs.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/research-rulings.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/source-receipts.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/methodology/ponytail-review/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own ONLY .agents/run/task-centred-architecture/verifications/proof.md for the architecture draft and sanitized supporting evidence in this proposal worktree. Draft, research reports and sources READ ONLY. No edits to draft or source, no implementation, no publication, no GitHub mutation, no schedules or sessions, no config/skill/agent changes, no user questions, no pushing/merging. If you find defects, report them; do not silently fix the author's work.
</scope>
<criteria>
- Return two explicit verdicts: Spec Compliance PASS | FAIL | PARTIAL and Quality & Health APPROVED | NEEDS-FIXES. Use PASS/APPROVED only if no material defect prevents human design review; this is readiness for alignment, never implementation or merge approval.
- Verify title is output-focused plain language and no technical prefix, body has compatible v1 headings without checked future criteria, human tasks only real decisions, at most five top user choices, and no claim work is implemented, tested or approved. All live runtime proof must be marked NOT RUN.
- Check full user vision coverage against mission/decisions and all ten scenarios. Find omissions in routing uncertainty/intake/no-repo creation, issues replacing required mission/brief state, output-focused bodies, child tasks vs dependency graph vs checklists, file/resource collisions, phase vs attention vs liveness vs dependency, optional vs blocking questions, exploration proportionality and references/tools/model/skill/scope plan, tiny-task fast path, scheduled/event runs, skill catalog/visibility/permissions, migration/rollback, human approval/release/closure, privacy and recovery.
- Detect silently settled decisions. Intake location, hosting/always-on controller, multi-device authority, autonomy/permission budget, phase granularity, schedule run representation and hidden-skill configuration must remain choices with tradeoffs, not approved facts. A recommendation is fine; pretending user agreed is not.
- Verify claims against pinned evidence and labels: DOCUMENTED (official source/date), SOURCE-OBSERVED (installed code/version), PROPOSED, UNKNOWN/NOT RUN. Reject fabricated test artifacts, unmeasured latencies, universal quotas, imaginary APIs, docs confused with live behavior, claims that a cached schema proves current route, or a managed dashboard proving current authorization.
- GitHub specifics: subissues are one-parent tree, documented count/depth/owner bounds, distinct from dependencies; cycles/limits/cross-org privacy untested; Projects archive counts toward cap; draft project items are not full issues and do not carry org issue fields; transfer number/redirect facts vs node-ID unknown; no mutation CAS; default issue scans include open issues and PRs. Flag any overstatement.
- Concurrency/reliability: no local SQLite global election, lease expiry != death, fencing only where checked; no exactly-once arbitrary agents; crash/duplicate webhook/lost POST/spawn race/restart/rate-limit/offline/token sharing/transfer/close/deletion/revocation/cancel and in-flight effects handled or explicitly deferred; broad automatic destructive cleanup forbidden; conflict recovery preserves human edits.
- Authority: issue text or reference content cannot grant tools; capture/activation != deploy/merge/close; agent never checks human boxes or closes own issue; tiny path retains independent hostile review, empirical proof and human release; fixable verifier defects loop to bounded execution; approvals scoped/versioned and stale approval cannot authorize changed work.
- Scheduling: definition vs run/attempt/history, edit/pause/cancel, overlap/missed/catch-up/timezone/event auth/dedupe/permissions. Do not claim existing plugin enum or current advertised schema is proven live behavior for proposed adapter. No schedule mutations in review.
- Skills: source-observed metadata hiding is not live callable proof; dynamic-agent skill denial and solo allowlist are real current permission limits; native tool uses ID not path; no security by hiding; transclusion fallback retained; six routers is unapproved proposal; don't retire mission/brief or delegate before a proven replacement.
- Task body example: dense, human-readable, output/context/next action/decisions/evidence, stable action IDs and versioning idea; optional fields not mandatory for tiny tasks; private paths/log data/secrets excluded; no invented HTML-comment magic or unsupported atomic revision semantics.
- Migration: no giant rewrite; staged read compatibility, opt-in ownership, one authoritative phase, pilot coordinator, tools/instructions/skills/schedule adapters after proof; old/new controllers cannot both own a task; rollback/pause; no execution child issues or destructive changes now.
- Flag overengineering: mandatory swarm, ten compulsory phases, custom graph service, dual-write truth, premature router catalog, giant schema. Also flag underspecification that would make unattended execution unsafe. Check strongest simpler alternative is fairly considered.
- Evidence quality: prove companion coverage map covers every review finding and requirement, sources resolve plausibly, and unknown/internal limits are disclosed. Do not accept the author's self-check as independent.
</criteria>
<output>
Write verifications/proof.md with dual verdicts, findings by severity and exact draft anchors, required corrections, verified strengths, source/evidence checks performed, remaining UNKNOWN and NOT RUN, explicit publication blockers, and a plain statement that architecture/design and runtime remain unimplemented. Do NOT edit draft. Commit only owned review artifacts locally. Return <=15 lines with path/commit, verdicts, blocker finding IDs and actual provider/model if exposed. Reviewer approval only permits presenting the draft to the human; it never authorizes implementation, push, merge or closure.
</output>
