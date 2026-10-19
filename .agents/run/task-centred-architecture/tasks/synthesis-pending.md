<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
Branch: docs/task-centred-proposal
Base commit: 02949c0 (manager-only run state over board source baseline 55ddeaa)
State: clean isolated report-only worktree created. NOT READY FOR DISPATCH: wait for remaining independent GitHub/skills review wakes and insert exact source pointers; no synthesis worker active.
Files: captured user vision mission.md, decisions.md, research reports github.md/board.md/skills.md in isolated worktrees.
Test command: documentation/specification only; validate all claimed capabilities against attached evidence and link current official citations. No application tests or implementation.
Do not touch: application code, runtime config, agent prompts, skills, schedules, credentials or issue state.
</env_preflight>
<goal>Create a thorough but human-scannable draft architecture issue that preserves the user's task-centred vision, separates verified capabilities from design proposals, and gives a lean migration path with explicit decisions still required.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
RESEARCH REPORT POINTERS TO BE SET BEFORE DISPATCH.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/docs/documentation-and-adrs/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own ONLY .agents/run/task-centred-architecture/issue-draft.md, design-evidence.md and source-receipts.md under your assigned worktree. Sources are read-only. No application/agent/skill changes, no API mutations, no publication, no spawning, no remote push or PRs. This is a proposed architecture, not an approved implementation plan.
</scope>
<criteria>
- Positive plain-language title: Run all work from the task board. No conventional-commit prefix in issue title. Include current parser-compatible Friendly Title/Overview/Acceptance Criteria/Actionable Subtasks/Open Questions/Human Tasks/Test Plan sections where applicable; explicitly distinguish compatibility shell from proposed v2 contract. Do not let current needs-human-as-phase rules override the user's new orthogonal requirement.
- Preserve ALL user concepts and edge cases recorded in mission/decisions; do not silently select a repo for uncategorized work, hidden-skill mechanism, controller architecture or autonomous authority.
- Open with desired output and why it matters, followed by a short scope and verified-current-state summary. Human can identify their required decisions and the next action without reading research logs.
- Present 2–3 meaningful implementation approaches and a recommendation with operational tradeoffs; prefer native GitHub and smallest controller consistent with reliable unattended execution. Avoid custom workflow engine if existing OpenChamber runtime is adequate. Do not confuse issue-first state with literally storing all logs/leases in GitHub.
- Define proposed separation: durable task record, hierarchy, dependency graph, lifecycle phase, independent attention/blocking reason, execution attempt/liveness, recurrence definition and per-run history. Distinguish optional questions vs blockers; idle != needs human by default. Ongoing != permanently in-progress. Output-focused task descriptions and ready/next-action rules.
- Show concrete examples: uncertain routing stays draft; execution pauses for human then resumes to next step, not fixed in-review; tiny fix fast path; complex cross-repo task with independent research; new project without repo; scheduled task paused for human; controller restart/duplicate event/old approval.
- Define minimal task-tool contract as PROPOSED operations and authority, not nonexistent implemented APIs. Activation must not bypass approved scope; claim/retry/cancellation/reconciliation semantics, stale body edits, identity transfer, off-device access, privacy, untrusted web/task inputs and spending caps included.
- Directory skills need exact documented/observed feasibility and cheapest supported alternative. Skill catalog visibility is NOT skill tool loadability. Record per-phase model/tool/skill requirements as progressive refinement, not massive static prompt.
- Exploration gives source/context/reference links, hypotheses and evidence, relevant tools and useful alternatives; independent optional specialist tasks only when justified. Decide whether work is tiny/large/decomposable/collision-safe after proportionate exploration.
- Migration slices with dependencies, affected repos, rollback/read compatibility and empirical proof required before retiring local mission/brief files or delegate workflow. Existing strong human approval and independent hostile-review gates persist. Do not create many execution child issues before design approval.
- Native limits/current API evidence cited with date. Exact unknowns visible. Future acceptance criteria are UNCHECKED; no implemented claims from research-only docs.
- Open questions must be batched and prioritized (max 5 high-leverage user decisions in executive view; detailed technical uncertainties grouped later). Human Tasks only actual user decisions needed, not invented approvals already granted or checked by agent.
- Include a proposed repeatable task-body example that is dense, human-readable and parseable, with stable action identifiers/versioning considered, clear context and evidence pointers. Full raw logs and machine secrets excluded. Do not mandate every optional field for every tiny task.
- Add a requirement coverage map in companion design-evidence.md, not a gigantic user-facing checklist. Include current capabilities vs gaps, evidence provenance, conflicts and NOT RUN runtime proofs.
</criteria>
<constraints>
Never assume design approval. No implementation. No credentials. No literal infinite API capability. No promise of native hidden callable skills absent proof. Do not call own work done/approved; reviewer decides.
</constraints>
<signals>
Scope: large architecture; ambiguity: high; sensitivity: high (autonomy/permission model); reversibility: high (proposal only). Engineer suitable with complete evidence.
</signals>
<output>
Write issue-draft.md (issue body plus separate first-line title metadata easily stripped), design-evidence.md coverage map, source-receipts.md. Commit owned artifacts locally. Return <=15 lines: paths/commit, recommended minimum approach, unresolved decisions, evidence gaps. Independent hostile reviewer will inspect before publication.
</output>
