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
    ---
    duration_ms: 1.818474
    type: 'test'
    ...
  # Subtest: DOM: panel/index.html defines layout menu items for Attention mode
  ok 2 - DOM: panel/index.html defines layout menu items for Attention mode
    ---
    duration_ms: 0.314602
    type: 'test'
    ...
  # Subtest: DOM: panel/index.html defines Attention View main container
  ok 3 - DOM: panel/index.html defines Attention View main container
    ---
    duration_ms: 0.325173
    type: 'test'
    ...
  # Subtest: CSS: panel/index.html defines required Attention View styles and tokens
  ok 4 - CSS: panel/index.html defines required Attention View styles and tokens
    ---
    duration_ms: 0.440929
    type: 'test'
    ...
  # Subtest: Main.ts: activeLayout and userLayoutPreference include "attention"
  ok 5 - Main.ts: activeLayout and userLayoutPreference include "attention"
    ---
    duration_ms: 2.475652
    type: 'test'
    ...
  # Subtest: Main.ts: defines renderAttentionView and wires it to layout switching
  ok 6 - Main.ts: defines renderAttentionView and wires it to layout switching
    ---
    duration_ms: 0.566334
    type: 'test'
    ...
  # Subtest: groupIssuesByAttention correctly categorizes mock issues for Attention View
  ok 7 - groupIssuesByAttention correctly categorizes mock issues for Attention View
    ---
    duration_ms: 2.043583
    type: 'test'
    ...
  # Subtest: Runtime: clicking btnViewAttention activates Attention layout
  ok 8 - Runtime: clicking btnViewAttention activates Attention layout
    ---
    duration_ms: 159.363989
    type: 'test'
    ...
  # Subtest: Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)
  ok 9 - Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)
    ---
    duration_ms: 92.241724
    type: 'test'
    ...
  # Subtest: Runtime: renderViews in Attention mode populates action queues and badge
  ok 10 - Runtime: renderViews in Attention mode populates action queues and badge
    ---
    duration_ms: 61.141368
    type: 'test'
    ...
  # Subtest: Runtime: sub-filter pills filter queue visibility
  ok 11 - Runtime: sub-filter pills filter queue visibility
    ---
    duration_ms: 70.02663
    type: 'test'
    ...
  # Subtest: Runtime: empty state banner renders when zero attention items exist
  ok 12 - Runtime: empty state banner renders when zero attention items exist
    ---
    duration_ms: 68.237197
    type: 'test'
    ...
  # Subtest: Runtime: clicking attention card opens drawer for that issue
  ok 13 - Runtime: clicking attention card opens drawer for that issue
    ---
    duration_ms: 77.835226
    type: 'test'
    ...
  # Subtest: DOM: panel/index.html defines Acceptance Criteria section and elements in drawer
  ok 14 - DOM: panel/index.html defines Acceptance Criteria section and elements in drawer
    ---
    duration_ms: 0.467064
    type: 'test'
    ...
  # Subtest: CSS: panel/index.html defines alert-only badge styles and AC section styles
  ok 15 - CSS: panel/index.html defines alert-only badge styles and AC section styles
    ---
    duration_ms: 0.330794
    type: 'test'
    ...
  # Subtest: Main.ts: declares formatAlertBadges and renderDrawerAcceptanceCriteria
  ok 16 - Main.ts: declares formatAlertBadges and renderDrawerAcceptanceCriteria
    ---
    duration_ms: 0.746263
    type: 'test'
    ...
  # Subtest: Runtime: formatAlertBadges returns empty string for neutral states (alert-only minimalism)
  ok 17 - Runtime: formatAlertBadges returns empty string for neutral states (alert-only minimalism)
    ---
    duration_ms: 46.769022
    type: 'test'
    ...
  # Subtest: Runtime: formatAlertBadges returns exact badge HTML chips for alert states
  ok 18 - Runtime: formatAlertBadges returns exact badge HTML chips for alert states
    ---
    duration_ms: 63.696196
    type: 'test'
    ...
  # Subtest: Runtime: Card rendering injects alert badges and excludes them on neutral tasks
  ok 19 - Runtime: Card rendering injects alert badges and excludes them on neutral tasks
    ---
    duration_ms: 57.965826
    type: 'test'
    ...
  # Subtest: Runtime: Drawer Acceptance Criteria hides section on issue without AC
  ok 20 - Runtime: Drawer Acceptance Criteria hides section on issue without AC
    ---
    duration_ms: 79.088004
    type: 'test'
    ...
  # Subtest: Runtime: Drawer Acceptance Criteria renders checklist and count badge for issue with AC
  ok 21 - Runtime: Drawer Acceptance Criteria renders checklist and count badge for issue with AC
    ---
    duration_ms: 47.253174
    type: 'test'
    ...
  # Subtest: Runtime: Toggling Acceptance Criteria checkbox updates markdown body with lineIndex precision
  ok 22 - Runtime: Toggling Acceptance Criteria checkbox updates markdown body with lineIndex precision
    ---
    duration_ms: 77.807963
    type: 'test'
    ...
  1..22
  # tests 22
  # suites 0
  # pass 22
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 1296.784493
  ```
- Regression test run:
  - Command: `npm test`
  - Result: 407 passed, 0 failed, 0 skipped. Full suite remains green without regressions.

## Changes:
- `panel/index.html`:
  - Added CSS rules for alert-only badge chips:
    - `.badge-attention`: monospace badge chip typography, layout padding, and color variants.
    - `.badge-attention.attention-decision`: amber badge (`var(--warn)`).
    - `.badge-attention.attention-permission`: purple badge (`#a855f7`).
    - `.badge-attention.attention-review`: blue badge (`var(--prim)`).
    - `.badge-liveness.liveness-running`: green pulsing badge (`var(--succ)`).
    - `.pulse-dot`: animated indicator for active agent sessions.
  - Added drawer layout rules: `.drawer-section` and `.drawer-section-header`.
  - Added `#drawerAcceptanceCriteriaSection` container directly following subtasks in `#taskDrawer`:
    - Contains header with `#drawerAcceptanceCriteriaCountBadge` ("0 / 0").
    - Contains checklist container `#drawerAcceptanceCriteriaContainer`.
- `panel/main.ts`:
  - Implemented `formatAlertBadges(issue: Issue): string`:
    - Inspects `issue.v2Metadata` (or derives via `resolveV2Metadata(issue, session)`).
    - Strictly returns empty string `''` when attention is neutral (`none`) and worker liveness is neutral (`idle` / `completed`).
    - Renders `.badge-attention` chip for `needs-decision`, `needs-permission`, or `needs-review`.
    - Renders `.badge-liveness` chip with `.pulse-dot` when worker liveness is `running`.
  - Injected `formatAlertBadges(issue)` into `renderIssueCard` card-id meta wrapper across all list and kanban layouts.
  - Cached drawer Acceptance Criteria DOM elements: `elDrawerAcceptanceCriteriaSection`, `elDrawerAcceptanceCriteriaContainer`, `elDrawerAcceptanceCriteriaCountBadge`.
  - Implemented `renderDrawerAcceptanceCriteria(issue: Issue): void`:
    - Checks `issue.acceptanceCriteria` (parsing from `issue.body` via `parseAcceptanceCriteria` if not already present).
    - Hides section when count is zero and resets badge to "0 / 0".
    - Shows section, updates count badge `${done} / ${total}`, and renders checkboxes with `data-index` and `data-line-index`.
    - Checkbox change handler applies `updateSubtaskInMarkdown` preserving line index accuracy, optimistically updates in-memory `issue.body` and `issue.acceptanceCriteria`, refreshes count badge immediately, and calls `updateIssueBody`.
  - Updated `reloadIssueBeforeMutation` and `updateIssueBody` to refresh `issue.acceptanceCriteria` synchronously on markdown mutations.
  - Attached `formatAlertBadges` and `renderDrawerAcceptanceCriteria` to `window` for test harness accessibility.
  - Rebuilt shipped iframe bundle `panel/main.js`.
- `test/stage2a-attention-ui.test.js`:
  - Added 9 unit and integration tests (tests 14 to 22) verifying:
    - DOM presence and relative positioning of `#drawerAcceptanceCriteriaSection` in `#taskDrawer`.
    - CSS selectors for alert-only badges and drawer sections.
    - Declaration and wiring of `formatAlertBadges` and `renderDrawerAcceptanceCriteria`.
    - Alert-only minimalism: strictly zero badge HTML returned on neutral states.
    - Exact badge chip HTML strings on alert states (decision, permission, review, running, combined).
    - Runtime card rendering: alert badges injected on alert tasks and excluded on neutral tasks.
    - Drawer AC section visibility: hidden on empty AC, visible with checklist on populated AC.
    - Checkbox toggle write-back: verifies line-index precision markdown mutation and optimistic count badge updating.

## Verification:
- Executed `npm run typecheck && node --test test/stage2a-attention-ui.test.js` (PASS, 22/22).
- Executed `npm test` (PASS, 407/407).
- Verified exact test assertions:
  - `DOM: panel/index.html defines Acceptance Criteria section and elements in drawer`: verifies `#drawerAcceptanceCriteriaSection`, `#drawerAcceptanceCriteriaContainer`, and `#drawerAcceptanceCriteriaCountBadge` exist and are placed inside `#taskDrawer` after `#drawerChecklistContainer`.
  - `CSS: panel/index.html defines alert-only badge styles and AC section styles`: verifies presence of `.badge-attention`, `.badge-attention.attention-decision`, `.badge-attention.attention-permission`, `.badge-attention.attention-review`, `.badge-liveness`, `.badge-liveness.liveness-running`, `.pulse-dot`, `.drawer-section`, and `.drawer-section-header`.
  - `Main.ts: declares formatAlertBadges and renderDrawerAcceptanceCriteria`: asserts functions are declared and called in drawer and card rendering.
  - `Runtime: formatAlertBadges returns empty string for neutral states (alert-only minimalism)`: asserts empty string for `attention: none` + `liveness: idle`, `liveness: completed`, and unlabeled issues.
  - `Runtime: formatAlertBadges returns exact badge HTML chips for alert states`: asserts exact chip HTML for `needs-decision`, `needs-permission`, `needs-review`, and `running` liveness.
  - `Runtime: Card rendering injects alert badges and excludes them on neutral tasks`: asserts neutral issue #20 card has 0 badge HTML and alert issue #10 card has `badge-attention attention-decision`.
  - `Runtime: Drawer Acceptance Criteria hides section on issue without AC`: asserts section is hidden with `style.display = 'none'` and badge is `0 / 0`.
  - `Runtime: Drawer Acceptance Criteria renders checklist and count badge for issue with AC`: asserts section is visible, count badge is `1 / 3`, and 3 check-items with correct data-line-index attributes are rendered.
  - `Runtime: Toggling Acceptance Criteria checkbox updates markdown body with lineIndex precision`: asserts clicking checkbox 0 changes line 4 from `- [ ]` to `- [x]`, updates optimistic completed state to `true`, and increments badge to `2 / 2`; unchecking item 1 updates line 5 to `- [ ]` and decrements badge to `1 / 2`.
