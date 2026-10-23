<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-stage2a-attention-views
Branch: feat/stage2a-attention-views
Base commit: 51da160
Files: panel/index.html, panel/main.ts, test/stage2a-attention-ui.test.js
Test command: npm run typecheck && node --test test/stage2a-attention-ui.test.js
Do not touch: config/**, master branch (do NOT push to master or origin)
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Implement the interactive Attention View mode in panel/index.html and panel/main.ts, wiring groupIssuesByAttention to render dedicated action queues for needs-decision, needs-permission, and needs-review with sub-filters, toolbar badge, and empty state.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/PLAN-STAGE2A.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/stage2-doubt-audit.md]
[@/workspace/extensions/github-task-board/panel/core.ts]
</context_files>
<skills>
[@.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@.agents/skills/build/discipline/incremental-implementation/SKILL.md]
[@.agents/skills/build/discipline/surgical-patch/SKILL.md]
</skills>
<owned_paths>
panel/index.html
panel/main.ts
test/stage2a-attention-ui.test.js
.agents/run/task-centred-architecture/outputs/task-201-attention-view.md
</owned_paths>
<depends_on>
none
</depends_on>
<steps>
1. Symlink node_modules in the worktree if not present: `[ -d node_modules ] || ln -s /workspace/extensions/github-task-board/node_modules node_modules`.
2. In panel/index.html:
   - In `#viewModeGroup`, add button for Attention View:
     `<button class="view-mode-btn" data-mode="attention" id="btnViewAttention" title="Attention Action Queue" aria-label="Attention Action Queue" role="radio" aria-checked="false">`
     Include an icon, label "Attention", and a badge `<span class="view-mode-badge" id="attentionViewBadge" style="display: none;">0</span>`.
   - In layout select menu (`#viewSelectMenu`) and sidebar overflow menu (`#sidebarMenuContent`), add corresponding items for Attention mode (`#viewOptAttention`, `#menuItemViewAttention`).
   - Add the container: `<main class="attention-view" id="attentionViewContainer" aria-label="Attention View" style="display: none;"></main>`.
   - Add clean CSS styling matching OpenChamber theme tokens (`--bg`, `--surf`, `--surf-hover`, `--border`, `--prim`, `--fg-muted`, `--radius`) for `.attention-view`, `.attention-header`, `.attention-sub-filters`, `.attention-sub-filter-btn`, `.attention-queue-section`, `.attention-card`, and `.attention-empty-state`.
3. In panel/main.ts:
   - Expand `activeLayout` type: `'list' | 'kanban' | 'graph' | 'human' | 'all-tasks' | 'questions' | 'attention'`.
   - Wire view switcher logic:
     - In layout switching routines, handle `activeLayout === 'attention'`: hide other views, display `#attentionViewContainer`, and call `renderAttentionView(sorted)`.
     - Update toolbar button states (`#btnViewAttention.classList.add('active')`, `aria-checked="true"`).
   - Implement `renderAttentionView(filteredIssues: Issue[]): void`:
     - Import or use `groupIssuesByAttention` from `panel/core.ts`.
     - Group issues into: `needs-decision`, `needs-permission`, `needs-review`, and `none`.
     - Update `#attentionViewBadge`: show count if total attention items > 0, hide if 0.
     - Render sub-filter pill tabs: `All Attention (total)`, `Needs Decision (count)`, `Needs Permission (count)`, `Needs Review (count)`.
     - Maintain an active sub-filter state (`currentAttentionFilter = 'all' | 'needs-decision' | 'needs-permission' | 'needs-review'`).
     - Render cards in each active queue section:
       - Issue number (`#${issue.number}`), repo tag (if multi-repo), title (friendly title), phase indicator.
       - Attention reason snippet (e.g. "2 open questions require decisions", "Session blocked on permission", "Completed subtasks awaiting review").
       - Action buttons: click to open drawer (`renderDrawer(issue)`).
     - Render an empty state banner when no issues need attention: "All systems clear — no tasks currently require human attention."
4. Author tests in `test/stage2a-attention-ui.test.js`:
   - Test DOM elements in `panel/index.html`: `#btnViewAttention`, `#attentionViewContainer`, `#attentionViewBadge`, layout menu options.
   - Test `renderAttentionView` logic with mock issues across all attention categories.
   - Test sub-filter tab filtering and count badges.
   - Test empty state rendering when list has zero attention items.
5. Verify `npm run typecheck` exits 0 and `node --test test/stage2a-attention-ui.test.js` passes 100%.
6. Emit structured output in `.agents/run/task-centred-architecture/outputs/task-201-attention-view.md`.
</steps>
<criteria>
- Attention View button and container are correctly added to panel/index.html.
- panel/main.ts renders Attention View using groupIssuesByAttention without type errors.
- Sub-filters allow viewing All, Needs Decision, Needs Permission, and Needs Review.
- Empty state renders cleanly when zero attention items exist.
- Typecheck passes cleanly (`npm run typecheck`).
- New test suite test/stage2a-attention-ui.test.js passes.
</criteria>
<verification>
npm run typecheck && node --test test/stage2a-attention-ui.test.js
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-201-attention-view.md:
# Task 201 Output: Attention View Mode
## Status: completed | failed
## Evidence:
- Typecheck output
- Test run output for test/stage2a-attention-ui.test.js
## Changes:
- Modified files and key functions added
## Verification:
- Exact test assertions verified
</output>
