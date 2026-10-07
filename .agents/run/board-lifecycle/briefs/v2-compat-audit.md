<goal>Audit the github-task-board + chambervoice integration for OpenChamber/OpenCode V2 migration breakage: data-dir and storage paths, extension registration, session-data shapes the board parses, and both test suites — producing a severity-ranked breakage report with exact anchors.</goal>
<context_files>
/tmp/opencode/issue-lifecycle-explore-voice/.agents/run/board-lifecycle/explore/voice-seam-map.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-02-crashfix.md
/workspace/extensions/chambervoice/service/taskboard.ts
</context_files>
<skills>
/workspace/config/opencode/.agents/skills/plan/context/source-driven-development/SKILL.md
/workspace/config/opencode/.agents/skills/build/domain/debugging-and-error-recovery/SKILL.md
</skills>
<scope>READ-ONLY on all application code (both extension repos). You may run test suites and read any file including ~/.local/share/opencode/, extension manifests, and any V2 data dirs. Your only write is the report at /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/v2-compat-audit.md (write it into the main checkout, it is run state) — plus the report in your reply.</scope>
<criteria>Every claim anchored to a file:line or a verified filesystem path; both suites actually executed with counts; the report separates CONFIRMED BROKEN / AT RISK / CONFIRMED OK; each broken or at-risk item has a concrete fix proposal and an estimated blast radius.</criteria>
<steps>
<step>Establish the V2 ground truth on this machine: where the V2 data dir lives (compare ~/.local/share/opencode/ paths vs what the code resolves — chambervoice resolveDataDir and the board's storage reads), whether extensions.json exists and which paths it registers for github-task-board and chambervoice, whether guest-storage/github-task-board.json exists with selected_repo / repo_* / scratchpad_* keys, and where opencode.db lives now vs the path the worktree-lifecycle tooling assumes.</step>
<step>Session-data shapes: the board parses OpenCode session records (SessionInfo: id, title, activity, outcome, worktree, directory, items) and drives status transitions from session.activity values (idle, waiting-permission, waiting-question). Inspect real V2 session records (the V2 db or API) and verify every field and activity value the board depends on still exists with the same shape. This is the highest-risk silent breakage: if activity values renamed, the needs-human automation dies quietly.</step>
<step>Panel loading: confirm which files V2 actually serves for the github-task-board panel (index.html/main.js paths) and that they come from the repo checkout the manager merges into.</step>
<step>Run both suites: node --test test/*.test.js in /workspace/extensions/github-task-board (expect ~202 on current master) and npm run verify in /workspace/extensions/chambervoice (expect 427). Record counts and any environment-induced failures.</step>
<step>Check chambervoice's live-server/tool-declaration surface for V2 API drift (host-client, server.ts endpoints the panel calls, websocket contracts).</step>
<step>Write the report to the run-state path above with the three sections and fix proposals. Do not fix anything.</step>
</steps>
<output>Return a structured block: status; results (top 5 findings with severity and anchors); evidence (paths verified, suite counts); learnings (what V2 changed that our lifecycle tooling must adapt to).</output>
