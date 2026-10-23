# Task 201 Output: Attention View Mode

## Status: completed

## Evidence:
- Typecheck output:
  ```
  > openchamber-github-task-board@1.2.1 typecheck
  > tsc --noEmit
  ```
  Exited 0 with zero diagnostic errors.
- Test run output for `test/stage2a-attention-ui.test.js`:
  ```
  TAP version 13
  # Subtest: DOM: panel/index.html defines Attention View toolbar button and badge
  ok 1 - DOM: panel/index.html defines Attention View toolbar button and badge
  # Subtest: DOM: panel/index.html defines layout menu items for Attention mode
  ok 2 - DOM: panel/index.html defines layout menu items for Attention mode
  # Subtest: DOM: panel/index.html defines Attention View main container
  ok 3 - DOM: panel/index.html defines Attention View main container
  # Subtest: CSS: panel/index.html defines required Attention View styles and tokens
  ok 4 - CSS: panel/index.html defines required Attention View styles and tokens
  # Subtest: Main.ts: activeLayout and userLayoutPreference include "attention"
  ok 5 - Main.ts: activeLayout and userLayoutPreference include "attention"
  # Subtest: Main.ts: defines renderAttentionView and wires it to layout switching
  ok 6 - Main.ts: defines renderAttentionView and wires it to layout switching
  # Subtest: groupIssuesByAttention correctly categorizes mock issues for Attention View
  ok 7 - groupIssuesByAttention correctly categorizes mock issues for Attention View
  # Subtest: Runtime: clicking btnViewAttention activates Attention layout
  ok 8 - Runtime: clicking btnViewAttention activates Attention layout
  # Subtest: Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)
  ok 9 - Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)
  # Subtest: Runtime: renderViews in Attention mode populates action queues and badge
  ok 10 - Runtime: renderViews in Attention mode populates action queues and badge
  # Subtest: Runtime: sub-filter pills filter queue visibility
  ok 11 - Runtime: sub-filter pills filter queue visibility
  # Subtest: Runtime: empty state banner renders when zero attention items exist
  ok 12 - Runtime: empty state banner renders when zero attention items exist
  # Subtest: Runtime: clicking attention card opens drawer for that issue
  ok 13 - Runtime: clicking attention card opens drawer for that issue
  1..13
  # tests 13
  # suites 0
  # pass 13
  # fail 0
  ```
- Regression test run:
  - Command: `npm test`
  - Result: 398 passed, 0 failed, 0 skipped. Full suite remains green without regressions.

## Changes:
- `panel/index.html`:
  - Added toolbar button `#btnViewAttention` with badge `#attentionViewBadge` in `#viewModeGroup`.
  - Added layout menu option `#viewOptAttention` in `#viewSelectPopover` (`#viewSelectMenu`).
  - Added sidebar overflow menu item `#menuItemViewAttention` in `#sidebarMenuContent`.
  - Added main view container `<main class="attention-view" id="attentionViewContainer" aria-label="Attention View" style="display: none;"></main>`.
  - Added CSS styling utilizing OpenChamber design tokens for `.attention-view`, `.attention-header`, `.attention-sub-filters`, `.attention-sub-filter-btn`, `.attention-queue-section`, `.attention-card`, and `.attention-empty-state`.
- `panel/main.ts`:
  - Expanded `activeLayout`, `userLayoutPreference`, and `currentRenderedLayout` types to include `'attention'`.
  - Implemented `currentAttentionFilter` state (`'all' | 'needs-decision' | 'needs-permission' | 'needs-review'`).
  - Added `updateAttentionBadge(issuesList: Issue[])` to dynamically update `#attentionViewBadge` based on total attention items across queues.
  - Implemented `renderAttentionView(filteredIssues: Issue[]): void`.
  - Integrated attention view into `applyLayoutMode`, `updateViewModeButtons`, sidebar cycle toggle, and view select popovers.
  - Rebuilt bundle `panel/main.js`.
- `test/stage2a-attention-ui.test.js`:
  - Implemented 13 unit and integration tests verifying DOM structure, CSS tokens, main.ts wiring, core grouping, toolbar interactions, toggle cycle, action queue rendering, badge synchronization, sub-filter toggling, empty state rendering, and drawer interaction.
