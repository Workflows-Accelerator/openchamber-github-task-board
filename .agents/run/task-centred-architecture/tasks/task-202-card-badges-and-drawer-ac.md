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
<goal>Implement alert-only card badge chips (rendering only when human attention is required or worker is actively running) and add an interactive Acceptance Criteria checklist section to the issue drawer with optimistic toggle write-back.</goal>
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
.agents/run/task-centred-architecture/outputs/task-202-card-badges-and-drawer-ac.md
</owned_paths>
<depends_on>
task-201
</depends_on>
<steps>
1. In panel/index.html:
   - Add styles for alert badges: `.badge-attention`, `.attention-decision`, `.attention-permission`, `.attention-review`, `.badge-liveness`, `.liveness-running`.
   - In the drawer (`#issueDrawer` / `.drawer-content`), add the Acceptance Criteria section right before or after subtasks:
     ```html
     <div class="drawer-section" id="drawerAcceptanceCriteriaSection" style="display: none;">
       <div class="drawer-section-header">
         <span>Acceptance Criteria</span>
         <span class="status-pill" id="drawerAcceptanceCriteriaCountBadge">0 / 0</span>
       </div>
       <div class="check-list" id="drawerAcceptanceCriteriaContainer"></div>
     </div>
     ```
2. In panel/main.ts:
   - Implement `formatAlertBadges(issue: Issue): string`:
     - Inspect `issue.v2Metadata`:
       - If `attention === 'needs-decision'`: return `<span class="badge-attention attention-decision" title="Requires human decision">needs-decision</span>`.
       - If `attention === 'needs-permission'`: return `<span class="badge-attention attention-permission" title="Blocked on agent permission">needs-permission</span>`.
       - If `attention === 'needs-review'`: return `<span class="badge-attention attention-review" title="Awaiting human review">needs-review</span>`.
       - If `liveness === 'running'`: return `<span class="badge-liveness liveness-running" title="Agent session active"><span class="pulse-dot"></span>running</span>`.
       - If `attention === 'none'` and `liveness !== 'running'`: return `''` (strictly ZERO badge HTML to avoid vertical card inflation).
     - Inject `formatAlertBadges(issue)` into card rendering in list and kanban views (alongside labels/meta).
   - In drawer rendering (`renderDrawer`):
     - Cache DOM elements: `elDrawerAcceptanceCriteriaSection`, `elDrawerAcceptanceCriteriaContainer`, `elDrawerAcceptanceCriteriaCountBadge`.
     - Implement `renderDrawerAcceptanceCriteria(issue: Issue): void`:
       - If `!issue.acceptanceCriteria || issue.acceptanceCriteria.length === 0`, hide `elDrawerAcceptanceCriteriaSection`.
       - If items exist, show section and set badge text `${doneCount} / ${totalCount}`.
       - Render checkboxes with data-index and lineIndex.
       - On checkbox toggle:
         - Call `updateSubtaskInMarkdown(issue.body, item.lineIndex, newChecked)`.
         - Optimistically update issue in memory (`issue.body = newBody; issue.acceptanceCriteria[idx].completed = newChecked`).
         - Update badge count immediately.
         - Dispatch update through existing optimistic mutation pathway (`updateIssueBody` or `queueIssueUpdate`).
3. In test/stage2a-attention-ui.test.js, add test cases for:
   - `formatAlertBadges`: neutral issues output empty string; alert states output exact badge HTML.
   - Drawer AC DOM elements exist and are positioned correctly.
   - `renderDrawerAcceptanceCriteria`: hides on empty list, renders checklist with correct items and badge on non-empty list.
   - Checkbox toggle updates lineIndex in markdown body.
4. Verify `npm run typecheck` exits 0 and `node --test test/stage2a-attention-ui.test.js` passes.
5. Emit structured output in `.agents/run/task-centred-architecture/outputs/task-202-card-badges-and-drawer-ac.md`.
</steps>
<criteria>
- Neutral states produce zero badge HTML on cards (alert-only minimalism enforced).
- Active attention states (decision, permission, review) and running liveness render distinct badges.
- Acceptance criteria appear in the issue drawer with interactive checkboxes.
- Toggling an AC checkbox updates the markdown issue body preserving line indices.
- Typecheck and tests pass cleanly.
</criteria>
<verification>
npm run typecheck && node --test test/stage2a-attention-ui.test.js
</verification>
<output>
Emit structured output in .agents/run/task-centred-architecture/outputs/task-202-card-badges-and-drawer-ac.md:
# Task 202 Output: Alert-Only Card Badges & Drawer Acceptance Criteria
## Status: completed | failed
## Evidence:
- Typecheck output
- Test run output for test/stage2a-attention-ui.test.js
## Changes:
- Modified files and key functions added
## Verification:
- Exact test assertions verified
</output>
