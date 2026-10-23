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
    ---
    duration_ms: 1.722742
    type: 'test'
    ...
  # Subtest: DOM: panel/index.html defines layout menu items for Attention mode
  ok 2 - DOM: panel/index.html defines layout menu items for Attention mode
    ---
    duration_ms: 0.338152
    type: 'test'
    ...
  # Subtest: DOM: panel/index.html defines Attention View main container
  ok 3 - DOM: panel/index.html defines Attention View main container
    ---
    duration_ms: 0.327179
    type: 'test'
    ...
  # Subtest: CSS: panel/index.html defines required Attention View styles and tokens
  ok 4 - CSS: panel/index.html defines required Attention View styles and tokens
    ---
    duration_ms: 0.438329
    type: 'test'
    ...
  # Subtest: Main.ts: activeLayout and userLayoutPreference include "attention"
  ok 5 - Main.ts: activeLayout and userLayoutPreference include "attention"
    ---
    duration_ms: 0.663697
    type: 'test'
    ...
  # Subtest: Main.ts: defines renderAttentionView and wires it to layout switching
  ok 6 - Main.ts: defines renderAttentionView and wires it to layout switching
    ---
    duration_ms: 0.562946
    type: 'test'
    ...
  # Subtest: groupIssuesByAttention correctly categorizes mock issues for Attention View
  ok 7 - groupIssuesByAttention correctly categorizes mock issues for Attention View
    ---
    duration_ms: 1.96822
    type: 'test'
    ...
  # Subtest: Runtime: clicking btnViewAttention activates Attention layout
  ok 8 - Runtime: clicking btnViewAttention activates Attention layout
    ---
    duration_ms: 161.828117
    type: 'test'
    ...
  # Subtest: Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)
  ok 9 - Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)
    ---
    duration_ms: 93.727487
    type: 'test'
    ...
  # Subtest: Runtime: renderViews in Attention mode populates action queues and badge
  ok 10 - Runtime: renderViews in Attention mode populates action queues and badge
    ---
    duration_ms: 61.612583
    type: 'test'
    ...
  # Subtest: Runtime: sub-filter pills filter queue visibility
  ok 11 - Runtime: sub-filter pills filter queue visibility
    ---
    duration_ms: 77.11526
    type: 'test'
    ...
  # Subtest: Runtime: empty state banner renders when zero attention items exist
  ok 12 - Runtime: empty state banner renders when zero attention items exist
    ---
    duration_ms: 67.659202
    type: 'test'
    ...
  # Subtest: Runtime: clicking attention card opens drawer for that issue
  ok 13 - Runtime: clicking attention card opens drawer for that issue
    ---
    duration_ms: 67.500543
    type: 'test'
    ...
  1..13
  # tests 13
  # suites 0
  # pass 13
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 829.20036
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
  - Added CSS styling utilizing OpenChamber design tokens for `.attention-view`, `.attention-header`, `.attention-sub-filters`, `.attention-sub-filter-btn`, `.attention-queue-section`, `.attention-card`, and `.attention-empty-state`, along with responsive rules for `body[data-layout="attention"]`.
- `panel/main.ts`:
  - Expanded `activeLayout`, `userLayoutPreference`, and `currentRenderedLayout` types to include `'attention'`.
  - Implemented `currentAttentionFilter` state (`'all' | 'needs-decision' | 'needs-permission' | 'needs-review'`).
  - Added `updateAttentionBadge(issuesList: Issue[])` to dynamically update `#attentionViewBadge` based on total attention items across queues.
  - Implemented `renderAttentionView(filteredIssues: Issue[]): void` with:
    - Partitioning via `groupIssuesByAttention` from `panel/core.ts`.
    - Loading and empty states ("All systems clear — no tasks currently require human attention.").
    - Sub-filter tabs for All, Needs Decision, Needs Permission, and Needs Review with dynamic item counts.
    - Interactive attention cards displaying friendly title, technical subtitle, repository badge, issue number, workflow phase, attention reason snippet, and an action button opening `openDrawer(issue)`.
    - Sticky queue section headers with color-coded dot badges (`queue-dot-decision`, `queue-dot-permission`, `queue-dot-review`).
  - Integrated attention view into `applyLayoutMode`, `updateViewModeButtons`, sidebar cycle toggle (Graph -> Attention -> Human), and view select popovers.
  - Rebuilt shipped iframe bundle `panel/main.js`.
- `test/stage2a-attention-ui.test.js`:
  - Implemented 13 unit and integration tests verifying DOM structure, CSS tokens, main.ts wiring, core grouping, toolbar interactions, toggle cycle, action queue rendering, badge synchronization, sub-filter toggling, empty state rendering, and drawer interaction.

## Verification:
- Executed `npm run typecheck && node --test test/stage2a-attention-ui.test.js` (PASS, 13/13).
- Executed `npm test` (PASS, 398/398).
- Verified exact test assertions:
  - `DOM: panel/index.html defines Attention View toolbar button and badge`: asserts presence and hierarchy of `#btnViewAttention` and `#attentionViewBadge`.
  - `DOM: panel/index.html defines layout menu items for Attention mode`: asserts `#viewOptAttention` and `#menuItemViewAttention`.
  - `DOM: panel/index.html defines Attention View main container`: asserts `#attentionViewContainer`.
  - `CSS: panel/index.html defines required Attention View styles and tokens`: asserts all required CSS classes.
  - `Main.ts: activeLayout and userLayoutPreference include "attention"`: asserts type unions.
  - `Main.ts: defines renderAttentionView and wires it to layout switching`: asserts function definition and invocation.
  - `groupIssuesByAttention correctly categorizes mock issues for Attention View`: asserts proper partitioning across orthogonal queues.
  - `Runtime: clicking btnViewAttention activates Attention layout`: asserts click event changes `data-layout` and active classes.
  - `Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)`: asserts cyclic toggle progression.
  - `Runtime: renderViews in Attention mode populates action queues and badge`: asserts queue headers, badge count, card elements, and action buttons.
  - `Runtime: sub-filter pills filter queue visibility`: asserts clicking filter pills shows only target queue.
  - `Runtime: empty state banner renders when zero attention items exist`: asserts banner text and hidden badge.
  - `Runtime: clicking attention card opens drawer for that issue`: asserts opening task drawer with correct issue number.
