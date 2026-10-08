<goal>Fix the four human-review failures on the task board (identical List/All Tasks icons, technical titles in simplified views, empty Human Tasks/Questions queues, and unreliable current-session repository discovery and switching per issue 24), proving each fix through the real built panel bundle with populated browser evidence.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/feedback-2026-10-08.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/v2-compat-audit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/decisions.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/verify/investigation/investigate-first/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
Owned: panel/**, test/**, and this worktree's .agents/run/board-lifecycle/verifications/feedback-2026-10-08/**. MUST NOT: touch canonical run-state outside your worktree, chambervoice, config/opencode, any GitHub issue operation, any live OpenChamber host/DB/guest-storage/session/form/permission state, authentication configuration, git push, or master. No timer polling additions (decision D11). No service restarts.
</scope>
<criteria>
- All Tasks gets a checklist-style icon distinct from List; Human Tasks and Questions icons stay distinct from each other and from List; accessible labels preserved.
- Simplified views render parseFriendlyTitle output. When a body has no Friendly Title the view must not present a conventional-commit slug as if it were a friendly title: use a quiet explicit placeholder and report the choice; never invent titles in code.
- Human Tasks and Questions views show items for issue bodies containing the contract sections (fixture shapes: issue-23-update-2026-10-08.md content and issue 24 body), including the same issue number existing in two repositories without cross-linking.
- Issue 24 acceptance honored: current-session repository is the default when no deliberate manual override is active; explicit switching stays easy; cache never leaks across repositories; empty, inaccessible and failed repositories are visually distinguishable; manual-override lifetime follows the human answer if recorded, otherwise report it as an unresolved fork and do NOT guess behavior.
- Production-path proof: the real panel/main.js bundle executes against a populated fixture (extend test-app-harness.js / production-orchestration.test.js style to a browser page), with Obscura or Playwright screenshots of List, Human Tasks, All Tasks, Questions and the repository selector saved under this worktree's .agents/run/board-lifecycle/verifications/feedback-2026-10-08/screenshots/. If the shared live host is touched at all it is strictly read-only.
- Gates green in the worktree with exact counts: npm run typecheck, npm run build (regenerated panel/main.js committed), node --test test/*.test.js (baseline 269).
- The actual refresh trigger is identified and documented with anchors. Prior claims of minute-based idle auto-refresh are UNVERIFIED and decision D11 records that no timer polling exists; do not add polling or any timer-based refresh.
</criteria>
<steps>
<step>Zero-edit diagnosis first. Icons: compare the List and All Tasks view-mode button markup in panel/index.html near line 2758. Titles: trace parseFriendlyTitle (panel/core.ts:85) into renderAllTasksView (panel/main.ts:3233) and the other simplified renderers (title call sites near main.ts:2672, 3067, 3305, 3405) and separate data cause (missing body sections) from renderer cause; only the renderer is yours to fix. Queues: determine the exact gating of collectHumanTodos and the Human/Questions renderers (status label vs body section vs session binding). Repos: trace selected_repo (main.ts:814) through discovery, cache scoping and the V2 session-item stripping documented in v2-compat-audit.md Section B.1 (core.ts:925-941, 1810-1845; main.ts:742-749).</step>
<step>Write the anchored diagnosis to this worktree's .agents/run/board-lifecycle/verifications/feedback-2026-10-08/diagnosis.md BEFORE any code edit.</step>
<step>Apply minimal fixes for proven defects only: icon markup, friendly-title rendering, queue gating, and issue 24 repository discovery/selection/cache behavior. Surface product-policy forks (especially manual-override lifetime) as Open Questions in the report instead of guessing.</step>
<step>Extend the production-bundle harness to run the real bundle against a populated fixture: two repositories with the same issue number, issues with and without Friendly Title, bodies containing Human Tasks and Open Questions. Assert icon distinction, friendly-title rendering, queue population and repository switching with cache isolation.</step>
<step>Capture browser proof with Obscura or Playwright over the harness page (or the real panel only if reachable without any mutation) and save screenshots of all four simplified views and the repository selector.</step>
<step>Run npm run typecheck, npm run build (commit the regenerated bundle), and node --test test/*.test.js. Commit in small green steps on branch fix/review-feedback-views. Report with file:line anchors, exact counts, screenshot paths and an explicit NOT VERIFIED list.</step>
</steps>
<output>STATUS; DIAGNOSIS anchors; CHANGES table (file:line, what, why); EVIDENCE (commands, counts, screenshot paths); OPEN FORKS; NOT VERIFIED; BLOCKERS. No secrets. Nothing pushed, closed or merged.</output>
