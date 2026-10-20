# Alignment and doubts ledger

## Aligned from user, 2026-10-19
A1. Task/issue is primary durable work record and the board is primary human interface; sessions implement work rather than define its durable state.
A2. Capture rough tasks quickly, route with AI, develop them in draft/exploration. Expose uncertain routing to human instead of silently selecting a project.
A3. Preserve task phase when human action blocks progress; attention is independent of phase. Blocking means no further authorized continuation at the relevant scope, not merely an unanswered nonblocking question.
A4. Plain positive outcome titles and concise comprehensible body; conventional issue-title prefixes are intentionally not the desired future contract.
A5. Real child tasks and dependency relationships both matter; prefer GitHub native capabilities. 'Infinite' is intent for flexible graphs, not evidence of limitless API capacity.
A6. Useful exploration includes past work, local architecture, relevant references/templates/web/tool discovery and hypothesis tests; effort proportional to ambiguity/risk, not automatic swarm on every task.
A7. Task exploration/alignment establishes outputs, skills, tools, models per step, files, boundaries, decomposition and useful parallelism. Avoid optimizing a bad process into rigid automation.
A8. Recurring/event-triggered tasks, repo-less projects and project creation need first-class treatment.
A9. Directory skills are a hypothesis needing native runtime feasibility research, not an implementation requirement to pretend is currently supported.
A10. Draft a deep architecture issue now; do not rewrite the system or change existing permissions, agents or execution policy before design approval.

## Manager judgements for investigation scope only
J1. One architecture frontier with independent read-only probes. Reports have disjoint ownership in separate worktrees. No parallel application edits.
J2. The current tooling still governs this investigation; the proposed task-management tool cannot replace present delegate mechanics until separately built and proven.
J3. Local run files are temporary orchestration state under CURRENT requirements, not a rejection of desired issue-centric future. The proposal must identify which are retired vs caches/artifacts vs worker process metadata.
J4. Research/issue publishing authorized; no branch pushes/PRs/merges. No real schedules/workers launched merely to test a hypothetical orchestrator. No issue creation in probes; a separate bounded publisher after synthesis/review.
J5. Build claims cannot follow from docs-only research. Capability reports must distinguish observed, documented, proposed and unknown. No renewed 335-test/full-working claims from historical conversation.

## Unsettled forks — hold for evidence, batch later
Q1. Where should uncategorized/repo-less/new-project work live? Dedicated private intake repository vs existing general project repository vs local transient intake with explicit issue promotion. Must not leak client/task context into a public repo.
Q2. What scope may run autonomously? Exploration only by default vs explicitly authorized project scopes/work classes; costs, tool grants, release/deploy and human validation boundaries.
Q3. When task is blocked by dependency vs blocked by human, how do attention and next-action queues differ? Active questions on optional research must not deadlock parent task/whole portfolio.
Q4. What is canonical state vs runtime metadata? GitHub issue and native links as durable work truth; coordinator claims/idempotency as bounded technical state; avoid two authoritative descriptions of phase/approval.
Q5. Where does always-on coordination run and under what trust/account credentials? A visible panel alone cannot be presumed to keep working when closed.
Q6. Recurring definition vs run issue/attempt hierarchy: every run issue can be noise; single reused issue can lose overlapping run/approval history. Need justified minimal strategy.
Q7. What exact phase set/gates can collapse for small tasks? Avoid ten compulsory phases for typo fixes while preserving proof and human authority.
Q8. How hide skill catalog entries without disabling invocation? If runtime doesn't support it, choose explicit loader/router tradeoff rather than speculative schema.
Q9. Source-of-truth state edits across devices/editors: stale body writes, claimed task deleted/transferred, approval changed after run starts and webhook loss need empirical proofs in later implementation.

## Current evidence
Manager: git status and log verified board base 55ddeaa on feat/v2-binding-and-ratelimit; config base e10fc86 on master. Existing unrelated untracked files preserved. .worktrees ignored in both repositories. gh issue list failed with command unavailable (exit 127); no credentials inspected.
Research workers running; no architecture implementation or live runtime verification performed.

## Human Alignment Decisions (Issue #26) — 2026-10-20
User explicitly selected and approved the 5 strategic architecture forks via interactive question gate:
1. **Intake Home (D1):** Private intake repo — dedicated repository (e.g. `org/tasks-intake`) with full issue features, sub-issues, and multi-device access.
2. **Autonomy Scope (D2):** Scoped autonomy — autonomous research, branching, editing, testing, and hostile review in isolated worktrees; hard human gates before merge, deploy, secrets, repo creation, or task closure.
3. **Coordinator Hosting (D3):** Host extension service daemon — managed by OpenChamber host, persists across UI tabs and runs independently of panel lifecycle.
4. **Phase Fast Path (D4):** Adaptive fast path — tiny tasks collapse exploration and planning; execution, hostile review, and human sign-off remain mandatory.
5. **Recurrence & Retention (D5):** Definition + runs — reusable definition issue with child run issues, bounded history (e.g. 30 days retention to avoid GitHub Projects 50,000 cap), and skip-on-overlap policy.

