<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
Branch: docs/task-centred-proposal
Base commit: 9c1a3f8 (independent review commit on top of 474e7cb; worktree clean)
State: The synthesis draft is a proposal, not an approved architecture. The independent review returned at the base commit. You are a fresh fixer; the synthesis author and reviewer are finished and cannot be resumed.
Files you own: .agents/run/task-centred-architecture/issue-draft.md, design-evidence.md, source-receipts.md, revision-notes.md. You may read the review proof and all manager inputs. Do not modify the review proof, mission/decisions/rulings, application code, docs contract, config, skills, agents, credentials, schedules, core DB, GitHub issues or other worktrees.
Test command: documentation review only. You must run a local heading/parser compatibility check against docs/issue-body-contract.md and the actual panel/core.ts regexes; do not claim app tests. No publication.
Do not touch: existing untracked files in the main checkout; the review proof; any source research artifacts.
</env_preflight>
<goal>Revise the reviewed architecture draft into a publishable, parser-compatible proposal that preserves the user's vision, keeps every unapproved architecture choice open, corrects all evidence overclaims, and states exactly what is proposed, documented, source-observed and NOT RUN. Publication remains a separate manager gate.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/source-receipts.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/review-adjudication.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/manager-draft-findings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/research-rulings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/reviewed-inputs.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/explore/scenarios-to-cover.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/meta/orchestration/subagent-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</context_files>
<skills>
Use doubt-driven-development as the review lens, subagent-driven-development for the two-verdict fixer discipline, and caveman-lite for dense prose. Do not load other skills.
</skills>
<scope>
- Edit only the four owned artifacts. Rewrite rather than add layers if the draft's structure is the problem. Preserve its good parts: four-axis orthogonality, native hierarchy/dependency facts, adaptive fast path, single-authoritative-controller-first proposal, dense task-body idea, staged migration and ten-scenario intent. Create `revision-notes.md` mapping every BLK and M to its resolution.
- First fix the v1 contract headings exactly. The published body must begin with `### Friendly Title:` and use `### Acceptance Criteria:`, `### Actionable Subtasks Checklist:`, `### Open Questions:` and `### Human Tasks:`; `## Overview` and `## Test Plan (Issue)` are correct. The separate `Title:` metadata line is not body and must be stripped by the publisher. Remove the false “compatibility shell” claim or replace it with a tested statement.
- Keep five decision forks at most: intake home/privacy; autonomy and outward gates; controller hosting/authority; phase fast path; recurrence/run visibility. Present recommendations as recommendations with fair tradeoffs, not selections. Do not bake a recommendation into acceptance criteria, human tasks or test-plan expectations; make those conditional on the selected option.
- Keep unapproved implementation out. Label the migration checklist “Proposed migration slices — not authorized until decisions and pilot scope are approved.” Do not ask the user to approve a pilot deployment that has not been scoped.
- Correct invented or unverified capabilities: do not present `task.*` names, `host.storage`, SDK headers, scheduler methods or hidden-skill invocation as existing. Describe semantic operations and mark the interface/hosting route as undecided. Use only source-observed paths/versions where the receipt supports them.
- Correct reliability claims: no exactly-once, no crash detection certainty, no lost-update prevention, no zero-leakage claim. State residual duplicate/orphan/stale-approval/transfer/permission risks and fencing only where effects can be checked.
- Rate and quota wording must follow research-rulings.md: 80 content-creates/min and 500/hour are documented general guidance, not universal guarantees; the official point table also documents 900 REST points/min and 5-point mutation costs, but they are not safe throughput promises. Use adaptive response-aware budgets, no 7.2-second magic constant, and mark exact thresholds unknown/NOT RUN. Archiving does not free Projects capacity; no automatic deletion/purging. Retention/partitioning is a decision.
- Add the missing visible requirements: exploration/alignment outputs (outputs, tools, per-phase model, skills, files, limits, decomposition/parallelism); web search/new tools/past work/exemplars/hypotheses only when useful; `Decisions:` and `Next Authorized Action:` in the repeatable body; one authoritative phase/approval representation and no dual write; current delegate/brief/mission contracts retained until proof; issue text cannot grant tools; untrusted content; secrets/private context; agents never check human boxes; scoped/versioned approvals and stale-approval invalidation; event triggers and schedule overlap/catch-up/edit/cancel/recovery; cross-repo/transfer/identity/full-URL dependencies; offline/outage/lost response/webhook redelivery/reconnect; deleted/closed/transferred/revoked tasks and cancellation/in-flight effects.
- Add a concise “How the agents and skills change” section: `team` owns task decomposition and review/dispatch through the task interface; `solo` works one task and records state in the issue; `worker` executes a bounded step and returns evidence; `dynamic-agent` is the general worker; local mission/brief files become ephemeral caches, never authoritative. Durable work is task-centric and uses no ad-hoc `delegate`, but an authorized `team`/exploration lead may dispatch bounded ephemeral exploration/verification workers under the task plan with a cap and recorded outputs. Retain `delegate`/subagent and disk briefs until the replacement is proven. Add the per-task skill selection/router policy and the hidden-specialist proof gate.
- Add a short “OpenChamber capability gaps to verify” list: start/resume/abort session control, request headers and ETags, injecting model/skills/agent/directory into a started session, host file open, scheduler update/catch-up, and stopShell vs session abort. Mark all NOT RUN; do not present them as available.
- State that recurring and event-triggered work is a task class, not a workflow phase; each run is a child/run record, and the definition issue remains the reusable record. State how issue-body size limits are handled and that high-frequency logs stay in comments or artifacts, not the canonical body.
- Add usable public source links or a durable evidence section in the issue itself. Use official documentation URLs, repository-relative paths and version strings; do not use unpushed local commit hashes, local absolute paths, run-state paths, session internals, credentials or unreviewed raw research as public evidence. Label source-observed facts by installed version/interface, not by a private path.
- Keep every checkbox unchecked. Distinguish DOCUMENTED, SOURCE-OBSERVED, PROPOSED, UNKNOWN/NOT RUN next to the claims.
- Update design-evidence.md so every requirement/scenario/review finding maps to a visible anchor in the revised issue. Update source-receipts.md only for provenance corrections; do not invent new sources.
- Consider the title/friendly title: use positive outcome language without a conventional commit prefix. If you change the title, keep it consistent across artifacts and report the change.
</scope>
<criteria>
- The revised issue body parses under the v1 contract: exact heading level and punctuation for every parsed section, verified locally against docs and the actual parser regexes; no false compatibility claim. Use `### Friendly Title:` exactly, put the real title first, and remove any earlier fenced `Friendly Title:` text. Record the known v1 `parseSubtasks` cross-section counting limitation instead of claiming clean rendering.
- All 14 blockers (BLK-01..14) and all 9 majors (M-01..09) in the pinned review proof are fixed with visible changes or returned explicitly to the manager. No blocker may be silently dropped. The manager adjudication in `review-adjudication.md` controls where it corrects or sharpens the review (heading level, 900/5 caveat, proof-file existence, intake transfer limits, five-decision framing, baseline, banner, retention, reliability, migration, body fields, concurrency, provenance, native graph, authority).
- The issue body includes a usable Sources & Evidence section with stable official links and commit-pinned references, labels DOCUMENTED / SOURCE-OBSERVED / PROPOSED / UNKNOWN-NOT RUN, and lists what was not run. The private/companion files must not be the only evidence.
- The issue body includes the proposal-only authorization banner; no human task asks to deploy a pilot; no acceptance/test/human checkbox is checked.
- No architecture choice is presented as selected; all downstream criteria/tasks/expectations are conditional.
- No implementation, publication, branch push, PR, merge, schedule mutation, agent/skill/config edit or credential access occurs.
- Every claim is labelled and every unknown is explicit. The body is dense but readable, with no fluff and no strawman alternatives.
- The revised artifacts are committed on docs/task-centred-proposal. Report the commit, the exact files changed, the headings check result, and any unresolved disagreement with the reviewer.
</criteria>
<steps>
1. Read the review proof and the manager findings; list every blocker and gap.
2. Run an exact heading/parser check against the contract and panel/core.ts regexes. Record the commands/results in your report.
3. Revise issue-draft.md first, then design-evidence.md and source-receipts.md. Preserve good content, cut repetition and strawmen.
4. Re-read the revised body as a human: title/outcome first, one authoritative state model, decisions clearly open, architecture next to its evidence, edge cases, sources, then acceptance/subtasks/questions/human tasks/test plan.
5. Check every checkbox remains unchecked; check no choice leaked into acceptance/human tasks/test plan; check no implementation authorization language.
6. Commit only the four owned artifacts. Do not amend or rewrite review history.
7. Return a two-verdict report: Fix coverage PASS/FAIL and Publication readiness RECOMMEND/HOLD, with blocker IDs and residual doubts. No self-approval.
</steps>
<output>
Commit the revised artifacts locally. Return <=15 lines: commit hash, files changed, heading check result, blockers fixed/parked, evidence corrections, remaining doubts and a clear RECOMMEND/HOLD for the next independent verification. Do not publish.
</output>
