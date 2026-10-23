import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  groupIssuesByAttention,
  filterIssuesByAttention,
  resolveV2Metadata,
  parseFriendlyTitle,
} from '../panel/core.ts';
import { createTestApp } from './test-app-harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

// ============================================================================
// 1. DOM Structure & Layout Contracts in panel/index.html
// ============================================================================
test('DOM: panel/index.html defines Attention View toolbar button and badge', () => {
  assert.ok(INDEX_HTML.includes('id="btnViewAttention"'), '#btnViewAttention must exist in index.html');
  assert.ok(INDEX_HTML.includes('data-mode="attention"'), 'btnViewAttention must specify data-mode="attention"');
  assert.ok(INDEX_HTML.includes('id="attentionViewBadge"'), '#attentionViewBadge must exist in index.html');

  // Must be in #viewModeGroup
  const viewModeGroupIdx = INDEX_HTML.indexOf('id="viewModeGroup"');
  const btnAttentionIdx = INDEX_HTML.indexOf('id="btnViewAttention"');
  assert.ok(viewModeGroupIdx !== -1 && btnAttentionIdx > viewModeGroupIdx, 'btnViewAttention must be inside #viewModeGroup');
});

test('DOM: panel/index.html defines layout menu items for Attention mode', () => {
  assert.ok(INDEX_HTML.includes('id="viewOptAttention"'), '#viewOptAttention must exist in layout popover');
  assert.ok(INDEX_HTML.includes('id="menuItemViewAttention"'), '#menuItemViewAttention must exist in sidebar overflow menu');
  assert.ok(INDEX_HTML.includes('id="sidebarMenuContent"'), '#sidebarMenuContent must exist for sidebar overflow menu');
});

test('DOM: panel/index.html defines Attention View main container', () => {
  assert.ok(INDEX_HTML.includes('id="attentionViewContainer"'), '#attentionViewContainer must exist in index.html');
  assert.ok(INDEX_HTML.includes('class="attention-view"'), 'Container must have attention-view class');
  assert.ok(INDEX_HTML.includes('aria-label="Attention View"'), 'Container must have aria-label="Attention View"');
});

test('CSS: panel/index.html defines required Attention View styles and tokens', () => {
  const requiredSelectors = [
    '.attention-view',
    '.attention-header',
    '.attention-sub-filters',
    '.attention-sub-filter-btn',
    '.attention-queue-section',
    '.attention-card',
    '.attention-empty-state',
    '.view-mode-badge',
    'body[data-layout="attention"]',
  ];

  for (const sel of requiredSelectors) {
    assert.ok(INDEX_HTML.includes(sel), `CSS must include selector ${sel}`);
  }
});

// ============================================================================
// 2. Main.ts Layout & Wiring Contracts
// ============================================================================
test('Main.ts: activeLayout and userLayoutPreference include "attention"', () => {
  assert.match(
    MAIN_TS,
    /activeLayout.*'attention'/,
    'activeLayout union must include "attention"'
  );
  assert.match(
    MAIN_TS,
    /userLayoutPreference.*'attention'/,
    'userLayoutPreference union must include "attention"'
  );
});

test('Main.ts: defines renderAttentionView and wires it to layout switching', () => {
  assert.match(
    MAIN_TS,
    /function\s+renderAttentionView\s*\(/,
    'main.ts must declare renderAttentionView'
  );
  assert.ok(
    MAIN_TS.includes("activeLayout === 'attention'"),
    'main.ts must handle activeLayout === "attention"'
  );
  assert.ok(
    MAIN_TS.includes('renderAttentionView('),
    'main.ts must invoke renderAttentionView'
  );
  assert.ok(
    MAIN_TS.includes('groupIssuesByAttention'),
    'main.ts must use groupIssuesByAttention'
  );
});

// ============================================================================
// 3. Core Grouping Primitives
// ============================================================================
test('groupIssuesByAttention correctly categorizes mock issues for Attention View', () => {
  const issues = [
    {
      number: 101,
      title: 'feat: needs decision on protocol',
      body: '### Questions\n- [ ] Which database should we use?\n',
      labels: [{ name: 'phase:planning' }, { name: 'attention:needs-decision' }],
      subtasks: [],
      openQuestions: [{ text: 'Which database should we use?', completed: false, lineIndex: 1 }],
    },
    {
      number: 102,
      title: 'feat: agent waiting for bash tool approval',
      body: 'Working on implementation.',
      labels: [{ name: 'phase:execution' }, { name: 'attention:needs-permission' }],
      subtasks: [],
      openQuestions: [],
    },
    {
      number: 103,
      title: 'feat: finished work ready for review',
      body: '### Actionable Subtasks Checklist:\n- [x] Write code\n- [x] Add tests\n',
      labels: [{ name: 'phase:verification' }, { name: 'attention:needs-review' }],
      subtasks: [
        { text: 'Write code', completed: true, lineIndex: 1 },
        { text: 'Add tests', completed: true, lineIndex: 2 },
      ],
      openQuestions: [],
    },
    {
      number: 104,
      title: 'chore: routine task with no attention required',
      body: 'Simple update',
      labels: [{ name: 'phase:execution' }],
      subtasks: [],
      openQuestions: [],
    },
  ];

  const grouped = groupIssuesByAttention(issues);
  assert.equal(grouped['needs-decision'].length, 1);
  assert.equal(grouped['needs-permission'].length, 1);
  assert.equal(grouped['needs-review'].length, 1);
  assert.equal(grouped.none.length, 1);

  assert.equal(grouped['needs-decision'][0].number, 101);
  assert.equal(grouped['needs-permission'][0].number, 102);
  assert.equal(grouped['needs-review'][0].number, 103);
  assert.equal(grouped.none[0].number, 104);
});

// ============================================================================
// 4. Runtime App Wiring & Layout Switching Integration
// ============================================================================
test('Runtime: clicking btnViewAttention activates Attention layout', () => {
  const { elements, mockDoc } = createTestApp();

  const btnAttention = elements.get('btnViewAttention');
  assert.ok(btnAttention, '#btnViewAttention must exist in runtime DOM');

  // Initially List view is active
  assert.equal(btnAttention.getAttribute('aria-checked'), 'false');

  // Click Attention View button
  btnAttention.click();

  assert.equal(mockDoc.body.getAttribute('data-layout'), 'attention', 'body data-layout must be "attention"');
  assert.equal(btnAttention.getAttribute('aria-checked'), 'true', 'btnViewAttention must be checked');
  assert.ok(btnAttention.classList.contains('active'), 'btnViewAttention must have active class');

  // Verify other mode buttons are deactivated
  assert.equal(elements.get('btnViewHuman').getAttribute('aria-checked'), 'false');
  assert.equal(elements.get('btnViewList').getAttribute('aria-checked'), 'false');
});

test('Runtime: layout toggle cycle includes Attention mode (Graph -> Attention -> Human)', () => {
  const { elements, mockDoc } = createTestApp();

  // Switch to graph mode
  elements.get('btnViewGraph').click();
  assert.equal(mockDoc.body.getAttribute('data-layout'), 'graph');

  const btnToggle = elements.get('btnLayoutToggle');
  assert.equal(btnToggle.title, 'View: Graph (click to switch to Attention)');

  // Click toggle: should transition graph -> attention
  btnToggle.click();
  assert.equal(mockDoc.body.getAttribute('data-layout'), 'attention');
  assert.equal(btnToggle.title, 'View: Attention (click to switch to Human Tasks)');

  // Click toggle again: should transition attention -> human
  btnToggle.click();
  assert.equal(mockDoc.body.getAttribute('data-layout'), 'human');
  assert.equal(btnToggle.title, 'View: Human Tasks (click to switch to All Tasks)');
});

// ============================================================================
// 5. Attention View Queue Rendering & Badge Integration
// ============================================================================
test('Runtime: renderViews in Attention mode populates action queues and badge', () => {
  const { app, elements } = createTestApp();

  const mockIssues = [
    {
      number: 10,
      title: 'feat: database architecture choice',
      body: '### Open Questions\n- [ ] PostgreSQL or SQLite?\n',
      labels: [{ name: 'phase:planning' }, { name: 'attention:needs-decision' }],
      status: 'in-progress',
      openQuestions: [{ text: 'PostgreSQL or SQLite?', completed: false, lineIndex: 1 }],
      subtasks: [],
    },
    {
      number: 20,
      title: 'fix: execute migration script',
      body: 'Waiting on approval.',
      labels: [{ name: 'phase:execution' }, { name: 'attention:needs-permission' }],
      status: 'in-progress',
      openQuestions: [],
      subtasks: [],
    },
    {
      number: 30,
      title: 'chore: verify test suite completeness',
      body: '### Actionable Subtasks Checklist:\n- [x] Run unit tests\n- [x] Run integration tests\n',
      labels: [{ name: 'phase:verification' }, { name: 'attention:needs-review' }],
      status: 'in-review',
      openQuestions: [],
      subtasks: [
        { text: 'Run unit tests', completed: true, lineIndex: 1 },
        { text: 'Run integration tests', completed: true, lineIndex: 2 },
      ],
    },
    {
      number: 40,
      title: 'refactor: internal cleanups without attention',
      body: 'Nothing pending.',
      labels: [{ name: 'phase:execution' }],
      status: 'todo',
      openQuestions: [],
      subtasks: [],
    },
  ];

  app.setState({ issues: mockIssues });

  // Switch to Attention mode
  elements.get('btnViewAttention').click();
  app.renderViews();

  // 1. Check toolbar badge
  const badge = elements.get('attentionViewBadge');
  assert.equal(badge.textContent, '3', 'Badge must display total count of 3 attention items');
  assert.notEqual(badge.style.display, 'none', 'Badge must be visible when total > 0');

  // 2. Check container contents
  const container = elements.get('attentionViewContainer');
  const innerHtml = container.innerHTML;

  assert.ok(innerHtml.includes('Attention Action Queues'), 'Header title must be present');
  assert.ok(innerHtml.includes('Needs Decision'), 'Needs Decision queue must be present');
  assert.ok(innerHtml.includes('Needs Permission'), 'Needs Permission queue must be present');
  assert.ok(innerHtml.includes('Needs Review'), 'Needs Review queue must be present');

  // 3. Check cards rendered
  assert.ok(innerHtml.includes('#10'), 'Card for issue #10 must exist');
  assert.ok(innerHtml.includes('#20'), 'Card for issue #20 must exist');
  assert.ok(innerHtml.includes('#30'), 'Card for issue #30 must exist');
  assert.ok(!innerHtml.includes('#40'), 'Issue #40 (neutral) must NOT exist in attention queues');

  // 4. Check action buttons
  assert.ok(innerHtml.includes('Decide'), 'Decide action button must exist');
  assert.ok(innerHtml.includes('Authorize'), 'Authorize action button must exist');
  assert.ok(innerHtml.includes('Review'), 'Review action button must exist');
});

// ============================================================================
// 6. Sub-filter Tab Filtering & Empty State
// ============================================================================
test('Runtime: sub-filter pills filter queue visibility', () => {
  const { app, elements } = createTestApp();

  const mockIssues = [
    {
      number: 11,
      title: 'feat: needs decision',
      body: 'Decide something',
      labels: [{ name: 'phase:planning' }, { name: 'attention:needs-decision' }],
      status: 'in-progress',
      openQuestions: [{ text: 'Which way?', completed: false, lineIndex: 1 }],
      subtasks: [],
    },
    {
      number: 22,
      title: 'feat: needs review',
      body: 'Check work',
      labels: [{ name: 'phase:verification' }, { name: 'attention:needs-review' }],
      status: 'in-review',
      openQuestions: [],
      subtasks: [{ text: 'Done thing', completed: true, lineIndex: 1 }],
    },
  ];

  app.setState({ issues: mockIssues });
  elements.get('btnViewAttention').click();
  app.renderViews();

  const container = elements.get('attentionViewContainer');

  // Find sub-filter buttons
  const subFilterBtns = container.querySelectorAll('.attention-sub-filter-btn');
  assert.equal(subFilterBtns.length, 4, 'Must render 4 sub-filter tabs');

  const decisionTab = Array.from(subFilterBtns).find((b) => b.getAttribute('data-subfilter') === 'needs-decision');
  assert.ok(decisionTab, 'Needs Decision sub-filter button must exist');

  // Click Needs Decision sub-filter
  decisionTab.click();

  const filteredHtml = container.innerHTML;
  assert.ok(filteredHtml.includes('#11'), 'Issue #11 must be visible under needs-decision filter');
  assert.ok(!filteredHtml.includes('#22'), 'Issue #22 (needs-review) must be hidden when filtering by needs-decision');
});

test('Runtime: empty state banner renders when zero attention items exist', () => {
  const { app, elements } = createTestApp();

  const mockIssues = [
    {
      number: 50,
      title: 'chore: all clear task',
      body: 'Normal task without attention',
      labels: [{ name: 'phase:execution' }],
      status: 'todo',
      openQuestions: [],
      subtasks: [],
    },
  ];

  app.setState({ issues: mockIssues });
  elements.get('btnViewAttention').click();
  app.renderViews();

  const badge = elements.get('attentionViewBadge');
  assert.equal(badge.style.display, 'none', 'Badge must be hidden when attention count is 0');

  const container = elements.get('attentionViewContainer');
  assert.ok(
    container.innerHTML.includes('All systems clear — no tasks currently require human attention.'),
    'Must render all clear empty state banner'
  );
});

test('Runtime: clicking attention card opens drawer for that issue', () => {
  const { app, elements } = createTestApp();

  const mockIssues = [
    {
      number: 99,
      title: 'feat: needs decision card click',
      body: 'Question here',
      labels: [{ name: 'phase:planning' }, { name: 'attention:needs-decision' }],
      status: 'in-progress',
      openQuestions: [{ text: 'Question?', completed: false, lineIndex: 1 }],
      subtasks: [],
    },
  ];

  app.setState({ issues: mockIssues });
  elements.get('btnViewAttention').click();
  app.renderViews();

  const container = elements.get('attentionViewContainer');
  const card = container.querySelector('.attention-card');
  assert.ok(card, 'Attention card must be rendered');

  // Click card
  card.click();

  const drawer = elements.get('taskDrawer');
  assert.ok(drawer.classList.contains('active'), 'Task drawer must be active after card click');
  assert.equal(elements.get('drawerIssueNumber').textContent, '#99', 'Drawer must inspect clicked issue #99');
});

// ============================================================================
// 7. Task 202: Alert-Only Card Badges & Drawer Acceptance Criteria
// ============================================================================
test('DOM: panel/index.html defines Acceptance Criteria section and elements in drawer', () => {
  assert.ok(INDEX_HTML.includes('id="drawerAcceptanceCriteriaSection"'), '#drawerAcceptanceCriteriaSection must exist');
  assert.ok(INDEX_HTML.includes('id="drawerAcceptanceCriteriaContainer"'), '#drawerAcceptanceCriteriaContainer must exist');
  assert.ok(INDEX_HTML.includes('id="drawerAcceptanceCriteriaCountBadge"'), '#drawerAcceptanceCriteriaCountBadge must exist');

  const taskDrawerIdx = INDEX_HTML.indexOf('id="taskDrawer"');
  const acSectionIdx = INDEX_HTML.indexOf('id="drawerAcceptanceCriteriaSection"');
  const checklistIdx = INDEX_HTML.indexOf('id="drawerChecklistContainer"');

  assert.ok(acSectionIdx > taskDrawerIdx, 'AC section must be placed inside #taskDrawer');
  assert.ok(acSectionIdx > checklistIdx, 'AC section must be positioned right after subtasks checklist');
});

test('CSS: panel/index.html defines alert-only badge styles and AC section styles', () => {
  const requiredSelectors = [
    '.badge-attention',
    '.badge-attention.attention-decision',
    '.badge-attention.attention-permission',
    '.badge-attention.attention-review',
    '.badge-liveness',
    '.badge-liveness.liveness-running',
    '.pulse-dot',
    '.drawer-section',
    '.drawer-section-header',
  ];

  for (const sel of requiredSelectors) {
    assert.ok(INDEX_HTML.includes(sel), `CSS must include selector ${sel}`);
  }
});

test('Main.ts: declares formatAlertBadges and renderDrawerAcceptanceCriteria', () => {
  assert.match(
    MAIN_TS,
    /function\s+formatAlertBadges\s*\(/,
    'main.ts must declare formatAlertBadges'
  );
  assert.match(
    MAIN_TS,
    /function\s+renderDrawerAcceptanceCriteria\s*\(/,
    'main.ts must declare renderDrawerAcceptanceCriteria'
  );
  assert.ok(
    MAIN_TS.includes('renderDrawerAcceptanceCriteria('),
    'main.ts must invoke renderDrawerAcceptanceCriteria in drawer'
  );
  assert.ok(
    MAIN_TS.includes('formatAlertBadges('),
    'main.ts must invoke formatAlertBadges during card rendering'
  );
});

test('Runtime: formatAlertBadges returns empty string for neutral states (alert-only minimalism)', () => {
  const { mockWindow } = createTestApp();
  const formatBadges = mockWindow.formatAlertBadges;
  assert.equal(typeof formatBadges, 'function', 'formatAlertBadges must be exposed');

  // 1. None attention + idle liveness
  assert.equal(
    formatBadges({ v2Metadata: { attention: 'none', liveness: 'idle', phase: 'execution', dependencyState: 'ready', isExplicitV2: true } }),
    '',
    'attention: none + liveness: idle must produce strictly zero badge HTML'
  );

  // 2. None attention + completed liveness
  assert.equal(
    formatBadges({ v2Metadata: { attention: 'none', liveness: 'completed', phase: 'done', dependencyState: 'ready', isExplicitV2: true } }),
    '',
    'attention: none + liveness: completed must produce strictly zero badge HTML'
  );

  // 3. Issue with neutral label (no attention labels)
  assert.equal(
    formatBadges({ number: 1, title: 'task', body: '', labels: [{ name: 'phase:execution' }] }),
    '',
    'Neutral issue with only phase label must produce strictly zero badge HTML'
  );

  // 4. Edge cases: null or undefined
  assert.equal(formatBadges(null), '');
  assert.equal(formatBadges(undefined), '');
});

test('Runtime: formatAlertBadges returns exact badge HTML chips for alert states', () => {
  const { mockWindow } = createTestApp();
  const formatBadges = mockWindow.formatAlertBadges;

  // 1. needs-decision
  const decisionHtml = formatBadges({
    v2Metadata: { attention: 'needs-decision', liveness: 'idle' },
  });
  assert.equal(
    decisionHtml,
    '<span class="badge-attention attention-decision" title="Requires human decision">needs-decision</span>',
    'needs-decision must render exact amber chip'
  );

  // 2. needs-permission
  const permissionHtml = formatBadges({
    v2Metadata: { attention: 'needs-permission', liveness: 'idle' },
  });
  assert.equal(
    permissionHtml,
    '<span class="badge-attention attention-permission" title="Blocked on agent permission">needs-permission</span>',
    'needs-permission must render exact purple chip'
  );

  // 3. needs-review
  const reviewHtml = formatBadges({
    v2Metadata: { attention: 'needs-review', liveness: 'idle' },
  });
  assert.equal(
    reviewHtml,
    '<span class="badge-attention attention-review" title="Awaiting human review">needs-review</span>',
    'needs-review must render exact blue chip'
  );

  // 4. running liveness
  const runningHtml = formatBadges({
    v2Metadata: { attention: 'none', liveness: 'running' },
  });
  assert.equal(
    runningHtml,
    '<span class="badge-liveness liveness-running" title="Agent session active"><span class="pulse-dot"></span>running</span>',
    'running liveness must render pulsing dot badge'
  );

  // 5. Combined attention alert + running liveness
  const combinedHtml = formatBadges({
    v2Metadata: { attention: 'needs-review', liveness: 'running' },
  });
  assert.ok(combinedHtml.includes('badge-attention attention-review'), 'Combined must include attention chip');
  assert.ok(combinedHtml.includes('badge-liveness liveness-running'), 'Combined must include liveness chip');
});

test('Runtime: Card rendering injects alert badges and excludes them on neutral tasks', () => {
  const { app, elements } = createTestApp();
  const mockIssues = [
    {
      number: 10,
      title: 'Task Needing Decision',
      body: 'Body',
      labels: [{ name: 'phase:planning' }, { name: 'attention:needs-decision' }],
      status: 'in-progress',
      subtasks: [],
    },
    {
      number: 20,
      title: 'Neutral Routine Task',
      body: 'Body',
      labels: [{ name: 'phase:execution' }],
      status: 'todo',
      subtasks: [],
    },
  ];

  app.setState({ issues: mockIssues });

  // Use flat list view (currentGroupBy = 'none')
  const selectGroupBy = elements.get('selectGroupBy');
  selectGroupBy.value = 'none';
  selectGroupBy.dispatchEvent({ type: 'change', target: selectGroupBy });

  app.renderViews();

  const listContainer = elements.get('listViewContainer');
  const cards = listContainer.querySelectorAll('.card');
  assert.equal(cards.length, 2, 'Must render two cards');

  // Card #20 (neutral) must have ZERO badge HTML
  const neutralCard = Array.from(cards).find((c) => c.dataset.issueNumber === '20');
  assert.ok(neutralCard, 'Neutral card #20 must exist');
  assert.ok(!neutralCard.innerHTML.includes('badge-attention'), 'Neutral card #20 must NOT contain badge-attention');
  assert.ok(!neutralCard.innerHTML.includes('badge-liveness'), 'Neutral card #20 must NOT contain badge-liveness');

  // Card #10 (alert) must have attention badge HTML
  const alertCard = Array.from(cards).find((c) => c.dataset.issueNumber === '10');
  assert.ok(alertCard, 'Alert card #10 must exist');
  assert.ok(alertCard.innerHTML.includes('badge-attention attention-decision'), 'Card #10 must include needs-decision badge');
});

test('Runtime: Drawer Acceptance Criteria hides section on issue without AC', () => {
  const { app, elements } = createTestApp();
  const issueNoAc = {
    number: 55,
    title: 'Task with no acceptance criteria',
    body: 'Regular description with no AC headers or checkboxes.',
    labels: [],
    subtasks: [],
    acceptanceCriteria: [],
  };

  app.renderDrawer(issueNoAc);

  const acSection = elements.get('drawerAcceptanceCriteriaSection');
  assert.equal(acSection.style.display, 'none', 'AC section must be hidden when issue has zero AC items');

  const countBadge = elements.get('drawerAcceptanceCriteriaCountBadge');
  assert.equal(countBadge.textContent, '0 / 0', 'Count badge must reset to 0 / 0');
});

test('Runtime: Drawer Acceptance Criteria renders checklist and count badge for issue with AC', () => {
  const { app, elements } = createTestApp();
  const issueWithAc = {
    number: 77,
    title: 'Task with rich acceptance criteria',
    body: [
      '## Overview',
      'Feature implementation.',
      '',
      '### Acceptance Criteria',
      '- [ ] Unit tests pass across all platforms',
      '- [x] No regressions in shipped-parity bundle',
      '- [ ] Mobile layout works under 360px width',
    ].join('\n'),
    labels: [],
    subtasks: [],
  };

  app.renderDrawer(issueWithAc);

  const acSection = elements.get('drawerAcceptanceCriteriaSection');
  assert.equal(acSection.style.display, 'block', 'AC section must be visible when items exist');

  const countBadge = elements.get('drawerAcceptanceCriteriaCountBadge');
  assert.equal(countBadge.textContent, '1 / 3', 'Count badge must display "1 / 3"');

  const container = elements.get('drawerAcceptanceCriteriaContainer');
  const items = container.querySelectorAll('.check-item');
  assert.equal(items.length, 3, 'Must render 3 check items in container');

  const checkboxes = container.querySelectorAll('input');
  assert.equal(checkboxes.length, 3, 'Must render 3 checkbox inputs');

  // Validate data-index and lineIndex
  assert.equal(checkboxes[0].getAttribute('data-index'), '0');
  assert.equal(checkboxes[0].getAttribute('data-line-index'), '4');
  assert.equal(checkboxes[0].checked, false);

  assert.equal(checkboxes[1].getAttribute('data-index'), '1');
  assert.equal(checkboxes[1].getAttribute('data-line-index'), '5');
  assert.equal(checkboxes[1].checked, true);

  assert.equal(checkboxes[2].getAttribute('data-index'), '2');
  assert.equal(checkboxes[2].getAttribute('data-line-index'), '6');
  assert.equal(checkboxes[2].checked, false);
});

test('Runtime: Toggling Acceptance Criteria checkbox updates markdown body with lineIndex precision', () => {
  const { app, elements } = createTestApp();
  const initialBody = [
    '## Overview',
    'Some text',
    '',
    '### Acceptance Criteria',
    '- [ ] First criterion',
    '- [x] Second criterion',
  ].join('\n');

  const issue = {
    number: 88,
    title: 'Issue with AC toggle test',
    body: initialBody,
    labels: [],
    subtasks: [],
  };

  app.renderDrawer(issue);

  const container = elements.get('drawerAcceptanceCriteriaContainer');
  const checkboxes = container.querySelectorAll('input');
  assert.equal(checkboxes.length, 2);

  // Initially: item 0 is unchecked, item 1 is checked
  assert.equal(checkboxes[0].checked, false);
  assert.equal(elements.get('drawerAcceptanceCriteriaCountBadge').textContent, '1 / 2');

  // Toggle item 0 (click first checkbox)
  checkboxes[0].click();

  // Assert lineIndex precision update in issue.body: line 4 changed from - [ ] to - [x]
  assert.ok(
    issue.body.includes('- [x] First criterion'),
    'issue.body must be updated to mark First criterion checked'
  );
  assert.ok(
    issue.body.includes('- [x] Second criterion'),
    'Second criterion must remain checked'
  );
  assert.equal(
    issue.acceptanceCriteria[0].completed,
    true,
    'issue.acceptanceCriteria[0].completed must be optimistically true'
  );
  assert.equal(
    elements.get('drawerAcceptanceCriteriaCountBadge').textContent,
    '2 / 2',
    'Count badge must immediately update to 2 / 2'
  );

  // Toggle item 1 (uncheck second criterion)
  checkboxes[1].click();

  assert.ok(
    issue.body.includes('- [ ] Second criterion'),
    'issue.body line 5 must be updated to mark Second criterion unchecked'
  );
  assert.equal(
    issue.acceptanceCriteria[1].completed,
    false,
    'issue.acceptanceCriteria[1].completed must be false'
  );
  assert.equal(
    elements.get('drawerAcceptanceCriteriaCountBadge').textContent,
    '1 / 2',
    'Count badge must update to 1 / 2'
  );
});
