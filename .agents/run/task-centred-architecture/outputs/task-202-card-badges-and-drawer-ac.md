# Task 202 Output: Alert-Only Card Badges & Drawer Acceptance Criteria

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
  # Subtest: DOM: panel/index.html defines Acceptance Criteria section and elements in drawer
  ok 14 - DOM: panel/index.html defines Acceptance Criteria section and elements in drawer
  # Subtest: CSS: panel/index.html defines alert-only badge styles and AC section styles
  ok 15 - CSS: panel/index.html defines alert-only badge styles and AC section styles
  # Subtest: Main.ts: declares formatAlertBadges and renderDrawerAcceptanceCriteria
  ok 16 - Main.ts: declares formatAlertBadges and renderDrawerAcceptanceCriteria
  # Subtest: Runtime: formatAlertBadges returns empty string for neutral states (alert-only minimalism)
  ok 17 - Runtime: formatAlertBadges returns empty string for neutral states (alert-only minimalism)
  # Subtest: Runtime: formatAlertBadges returns exact badge HTML chips for alert states
  ok 18 - Runtime: formatAlertBadges returns exact badge HTML chips for alert states
  # Subtest: Runtime: Card rendering injects alert badges and excludes them on neutral tasks
  ok 19 - Runtime: Card rendering injects alert badges and excludes them on neutral tasks
  # Subtest: Runtime: Drawer Acceptance Criteria hides section on issue without AC
  ok 20 - Runtime: Drawer Acceptance Criteria hides section on issue without AC
  # Subtest: Runtime: Drawer Acceptance Criteria renders checklist and count badge for issue with AC
  ok 21 - Runtime: Drawer Acceptance Criteria renders checklist and count badge for issue with AC
  # Subtest: Runtime: Toggling Acceptance Criteria checkbox updates markdown body with lineIndex precision
  ok 22 - Runtime: Toggling Acceptance Criteria checkbox updates markdown body with lineIndex precision
  1..22
  # tests 22
  # suites 0
  # pass 22
  # fail 0
  ```
- Regression test run:
  - Command: `npm test`
  - Result: 407 passed, 0 failed, 0 skipped. Full suite remains green without regressions.

## Changes:
- `panel/index.html`:
  - Added alert-only badge CSS rules (`.badge-attention`, `.attention-decision`, `.attention-permission`, `.attention-review`, `.badge-liveness`, `.liveness-running`, `.pulse-dot`).
  - Added drawer layout rules: `.drawer-section` and `.drawer-section-header`.
  - Added `#drawerAcceptanceCriteriaSection` with `#drawerAcceptanceCriteriaCountBadge` and `#drawerAcceptanceCriteriaContainer` inside the drawer.
- `panel/main.ts`:
  - Implemented `formatAlertBadges(issue: Issue): string`:
    - Strict alert-only minimalism: returns `''` for neutral states (`none` attention, `idle` / `completed` liveness).
    - Returns styled badge chips for `needs-decision`, `needs-permission`, `needs-review`, and `running` liveness.
    - Injected into card-id meta wrapper across all list and kanban card renderers.
  - Implemented `renderDrawerAcceptanceCriteria(issue: Issue): void`:
    - Renders checklist items from `issue.acceptanceCriteria`.
    - Handles interactive checkbox toggling with line-index precision via `updateSubtaskInMarkdown`.
    - Updates optimistic state, count badge `${done} / ${total}`, and dispatches `updateIssueBody`.
  - Rebuilt bundle `panel/main.js`.
- `test/stage2a-attention-ui.test.js`:
  - Added 9 tests verifying badge minimalism, alert badge chips, card injection, drawer AC rendering, and checkbox toggling.
