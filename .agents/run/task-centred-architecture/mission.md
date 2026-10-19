# Run work from the task board

State: exploring
Date: 2026-10-19
Alignment: research and detailed draft issue creation APPROVED by user; architecture choices and implementation NOT APPROVED.
Repository snapshot: /workspace/extensions/github-task-board, feat/v2-binding-and-ratelimit, 55ddeaa911180ac54b84ce9ff194d35e31874261. Only existing unrelated untracked .agents files were present. Do not touch them.
Config snapshot: /workspace/config/opencode, master, e10fc86ec9d212f676f6e0baba24e7db5f7a4d26. Existing untracked devops skill folder and opencode.json.openchamber.backup must not be modified/read for secrets.

## User-authorized scope
Research deeply, explore first principles and existing capabilities, produce a comprehensive architecture draft issue covering the full vision below. Use research subagents and isolated worktrees, hostile reviews, and source-grounded evidence. No application/agent/skill/config changes. No merges, remote branch pushes or PRs without separate approval. Prior five-feature implementation is historical context, not authorization to expand it.

## User vision — durable requirements (not every mechanism is approved)
- Make GitHub issues/tasks the durable primary point of contact and source of work state for humans, solo/team agents and workers. Board is the main user interface. Chat and local mission/task Markdown must no longer be required to reconstruct work.
- A small task-management tool replaces agents manually spawning subagents: activating/claiming a task lets an extension/plugin/runtime ensure the appropriate linked worker is running, recover when it finishes/fails, and advance to the next appropriate step. Research the boundary; do not remove current delegate tools during this investigation.
- Quick add rather than a separate scratchpad/drafting workspace. Capture rough todos fast; AI routes to project/repository, categorizes and develops drafts. Uncertain routing asks a human, not a silent guess.
- Output-focused, positively worded, easily understood plain-language task titles without technical prefixes. Dense, repeatable, human-readable bodies: desired output, context, relevant source/file links, questions, decisions, next action, evidence, constraints. No fluff.
- Native contained subtasks as real linked issues; distinguish checklist steps from child tasks and dependency edges. Support rich/many dependencies, cross-task dependencies and parallelism, while investigate actual GitHub limits instead of promising literal infinite graph size.
- Explicit workflow phases such as draft, exploration, alignment, planning, execution, verification, human verification, publication, done and archive. These names/granularity remain proposals, not a locked enum.
- Human attention is ORTHOGONAL to workflow phase, not a replacement phase/status label. Draft routing question stays draft; implementation approval stays execution. A task is blocked only when no authorized continuation remains without human action. Unanswered optional questions do not automatically freeze all useful work; expose actionable questions/reviews in attention views. Distinguish human blocking, dependency waiting, runtime failure, ongoing work and completed work.
- Rich exploration before asking: inspect code and similar past work, brainstorm, formulate/test hypotheses, gather useful online references/templates/inspiration (excellent sites for websites, analogous workflows for workflows), discover relevant new tools where worthwhile. Summarize good alternatives and recommendations; batch only meaningful decisions for the user.
- Exploration/alignment define outputs, tools, per-phase model choice, relevant skills, source files, boundaries, decomposition and whether enough is known to simply proceed. Right-size: tiny tasks skip ceremony; large tasks break into child tasks and may use parallel specialists for independent research dimensions. Do not create a fixed swarm for every tiny task.
- Planning follows exploration and explicit alignment of real decisions. Execution and independent hostile verification have empirical proof; human approval boundaries persist. Automation must not rubber-stamp approvals, deploy or close on an agent's own authority.
- Ongoing scheduled/event/webhook-triggered tasks use existing OpenChamber scheduling where possible. Need clear reusable definition vs individual run state/history, editing, concurrency, cancellation and recovery.
- Refactor solo/team/worker instructions and high-level orchestration skills to agree with task-centric state. Explore a small catalog of directory/router skills (e.g. DevOps) exposed initially, with specialist skills hidden from initial catalog but invokable through skill tool by ID/path after discovery. Verify whether OpenCode actually supports separate discovery visibility and loadability; do not assume folder nesting hides skills.
- Replace required mission.md and local worker task briefs with issue/child-issue state. Technical runtime metadata, logs/artifacts and non-authoritative offline caches may still be needed; research minimal reliable ownership and storage rather than duplicating sources of truth.
- Cover no-repository projects, creating a brand new project before its repository exists, central/general intake project, routing confidence, cross-repo work, issue transfer/link identity, permissions, private context and workspace paths. Central intake location is an OPEN DECISION, not silently choose OpenChamber repo.
- Reuse native GitHub subissues/dependencies/projects/custom fields/issue types/Markdown where available; verify API, visibility, plan constraints, counts/depth/cycle restrictions and fallbacks.

## Risks to investigate, not prematurely settle
GitHub is not a transactional job queue: duplicate claims, ordering, stale body updates, crash between spawn/write, multi-device control planes, webhook loss/redelivery, API limits/offline mode and durable reconciliation. A panel alone may not run when closed. Preserve exact human approval scope and artifact access. Bound research/agent costs, tool privileges, untrusted content/prompt injection, context exposure and scheduler recursion.

## Research frontier
- GITHUB: native issue hierarchy/relationship/project capabilities and limits with current official citations; existing issue graph/duplicates if safely readable.
- BOARD: existing board/contracts/runtime/scheduler/host API integration and minimal task-control-plane boundaries.
- SKILLS: installed solo/team/worker and skill discovery/loading behavior; directory-skill feasibility and migration map.
- SYNTHESIS: after these, independent architecture author integrates into deep proposed issue; hostile reviewer then checks source evidence, contradictions, missing decisions and overengineering.

## Operational policy
Manager retains alignment and proof decisions. Workers own only isolated report paths in their worktrees; source trees read-only. Only delegate dispatch. No repeated session polling. Research reports distinguish observed/source-documented/proposed/unknown. gh CLI unavailable at manager checkout (exit 127); worker must not assume gh is present. Never print/read credential files or raw authenticated remotes. No application baseline tests needed for read-only research; record NOT RUN rather than historical test claims.

## Dispatched sessions
- GITHUB: ses_6b9cfac5fb254d350b6c0246; engineer requested; /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-github; report explore/github.md (in worker worktree); RUNNING.
- BOARD: ses_a3148e31f7413473a465be92; engineer requested; /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-board; report explore/board.md; RUNNING.
- SKILLS: ses_0ffb8b71f9acc1ab15ec25ca; engineer requested; /workspace/config/opencode/.worktrees/team-research-task-centred-skills; report explore/skills.md; RUNNING.
Actual provider/model verification deferred to completion wake or one safe session-record check; no polling. All workers auto_accept=true, dynamic-agent, report-only scope. Worktrees created with git worktree add from the above explicit current snapshots; no base branch checkout/pull because these are isolated read-only investigations of current installed work, not production feature branches. Setup DB registration delegated safely; no dependencies/env required.

## Restart recovery, 2026-10-19
User reported server restart. Saved mission and report ownership recovered. One bounded status check for each original worker returned busy; no duplicate or replacement workers spawned. (A duplicate SKILLS status call was accidental; do not repeat.) Main checkout remains same feature branch, only unrelated untracked files and our untracked decisions.md. Continue work from these artifacts, await completion wakes, no polling. Additional aligned decisions are in decisions.md.

## Recovery checkpoint
User reported server restart during research. Read saved mission and checked each known worker once (skills status was inadvertently queried twice); all returned busy. No workers restarted or duplicated. Main checkout still contains only unrelated untracked run files plus this run's uncommitted decisions.md. Current parent session record: ses_f22887e18ffem6RBrwgNhw5iNM, agent team, provider/model 9router/genius. Do not status-poll workers; await completion wakes.

## Next gate
Review evidence, author draft, run hostile review. Publish one deep draft issue (no implementation children yet unless user later approves), link it to this session, ask one batched alignment round with a short plain-language decision list. No claims of implementation or runtime proof.
