<goal>Map exactly how the chambervoice extension and the github-task-board extension talk to each other today, and what is missing for voice to manage issues across multiple projects and to read "tasks the human must do" out of issues that are waiting on a human.</goal>
<context_files>
/workspace/extensions/chambervoice/service/taskboard.ts
/workspace/extensions/chambervoice/service/server.ts
/workspace/extensions/chambervoice/service/tool-executor.ts
/workspace/extensions/chambervoice/service/session-synthesizer.ts
/workspace/extensions/chambervoice/SCRATCHPAD.md
/workspace/extensions/chambervoice/package.json
/workspace/docs/VISION_AND_ROADMAP.md
</context_files>
<skills>
/workspace/config/opencode/.agents/skills/plan/context/source-driven-development/SKILL.md
</skills>
<scope>You are READ-ONLY on all application code in both repositories. Your only writes are (1) the map document at .agents/run/board-lifecycle/explore/voice-seam-map.md inside this worktree and (2) a commit of that map file. Do not edit anything under /workspace/extensions/chambervoice or /workspace/extensions/github-task-board outside your worktree's .agents/run directory.</scope>
<criteria>Every claim carries a file:line anchor in the repo it belongs to; the GitHub API surface used by TaskboardManager is listed method by method; the scratchpad storage contract is specified precisely (file, path, per-theme section format, repo-scoping rules); the gap list for multi-project support and for human-task surfacing is concrete enough to file issues from.</criteria>
<steps>
<step>Map TaskboardManager in /workspace/extensions/chambervoice/service/taskboard.ts: options, token discovery (guest-storage github-task-board.json, /workspace/.git-credentials), repo resolution (getRepo and how a repo is chosen or switched), and every public method with its GitHub API endpoint and payload shape.</step>
<step>Map TASKBOARD_TOOL_DECLARATION and getToolDeclarations: the exact tool schema the voice model receives, and the taskboard guidance text embedded in the live system prompt (buildLiveSystemPrompt). Quote the guidance verbatim — a lifecycle skill must not contradict it.</step>
<step>Map the scratchpad contract: where it is stored, the "## [Theme: X]" section format, the repo-switch overwrite protection recently added (commit 2950c64), and how both extensions read and write it.</step>
<step>Map how tool calls flow from the voice model to TaskboardManager (tool-executor.ts, server.ts) and what errors the voice caller sees when the board extension is absent (isTaskboardInstalled).</step>
<step>Assess multi-project readiness: what breaks or silently misroutes when issues span more than one repository, and what would need to change for voice to list/switch/manage projects. Be concrete.</step>
<step>Assess human-task readiness: what a voice session can learn today about what a human must do for a blocked issue, and what contract (issue-body section, label, or comment convention) the board would need to expose for voice to read it in one query.</step>
<step>Read /workspace/docs/VISION_AND_ROADMAP.md (Pillar B: Notification & Phone Escalation) and note how human-in-the-loop escalation is intended to work there.</step>
<step>If the gh CLI is available in your environment, list the open GitHub issues of the board repository and summarize which ones already track this work (issue titles/numbers only). If gh is unavailable, say so explicitly and move on.</step>
<step>Write the map to .agents/run/board-lifecycle/explore/voice-seam-map.md and commit it on this branch with a docs() commit.</step>
</steps>
<output>Return a structured block: status; results (the five most important facts a manager must know, each with file:line); evidence (what you actually executed or read); learnings (top 3 gaps for multi-project and human-task support). Keep full detail in the map file.</output>
