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
test('DOM: Needs me is a filter, not a duplicate toolbar view', () => {
  assert.ok(INDEX_HTML.includes('id="btnFilterToggle"'));
  assert.ok(INDEX_HTML.includes('id="activeFilters"'));
  assert.equal(INDEX_HTML.includes('id="btnViewAttention"'), false);
  assert.ok(MAIN_TS.includes("['needs-me', 'human', 'questions']"));
});

test('DOM: one view menu replaces separate Attention menu entries', () => {
  assert.ok(INDEX_HTML.includes('id="viewOptSimple"'));
  assert.equal(INDEX_HTML.includes('id="viewOptAttention"'), false);
  assert.equal(INDEX_HTML.includes('id="menuItemViewAttention"'), false);
  assert.ok(INDEX_HTML.includes('id="sidebarMenuContent"'));
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
    '.filter-chip',
  ];

  for (const sel of requiredSelectors) {
    assert.ok(INDEX_HTML.includes(sel), `CSS must include selector ${sel}`);
  }
});

// ============================================================================
// 2. Main.ts Layout & Wiring Contracts
// ============================================================================
test('Main.ts: Needs me is persisted with shared view state rather than a layout', () => {
  assert.ok(MAIN_TS.includes('let viewState: ViewState = defaultViewState()'));
  assert.ok(MAIN_TS.includes("viewState.filters.includes('needs-me')"));
  assert.equal(MAIN_TS.includes('userLayoutPreference'), false);
});

test('Main.ts: defines renderAttentionView and wires it to layout switching', () => {
  assert.match(
    MAIN_TS,
    /function\s+renderAttentionView\s*\(/,
    'main.ts must declare renderAttentionView'
  );
  assert.ok(
    MAIN_TS.includes("viewState.filters.includes('needs-me')"),
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
test('Runtime: Needs me chip filters Simple list without changing the view', () => {
  const { app, elements, mockDoc } = createTestApp();
  app.renderViews();
  elements.get('btnFilterToggle').click();
  const chip = elements.get('filterPopover').querySelector('[data-filter="needs-me"]');
  assert.ok(chip);
  chip.click();
  assert.equal(mockDoc.body.getAttribute('data-layout'), 'simple');
  assert.deepEqual(app.getState().viewState.filters, ['needs-me']);
  assert.equal(elements.get('btnFilterToggle').getAttribute('aria-expanded'), 'true');
});

test('Runtime: Needs me selection survives switching from Graph to Pending items', () => {
  const { app, elements, mockDoc } = createTestApp();
  app.setState({ viewState: { view: 'graph', filters: ['needs-me'], sort: 'priority' } });
  app.renderViews();
  assert.equal(mockDoc.body.getAttribute('data-layout'), 'graph');
  elements.get('viewOptPending').click();
  assert.equal(mockDoc.body.getAttribute('data-layout'), 'pending');
  assert.deepEqual(app.getState().viewState.filters, ['needs-me']);
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
  app.setState({ viewState: { view: 'simple', filters: ['needs-me'], sort: 'priority' } });
  app.renderViews();

  // Active filter chip replaces the old toolbar count badge.
  assert.ok(elements.get('activeFilters').textContent.includes('Needs me'));

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
      repo: 'review/repo',
      body: 'Check work',
      labels: [{ name: 'phase:verification' }, { name: 'attention:needs-review' }],
      status: 'in-review',
      openQuestions: [],
      subtasks: [{ text: 'Done thing', completed: true, lineIndex: 1 }],
    },
  ];

  app.setState({ issues: mockIssues });
  app.setState({ viewState: { view: 'simple', filters: ['needs-me'], sort: 'priority' } });
  app.renderViews();

  const container = elements.get('attentionViewContainer');

  // One Filter control replaces the old attention presets. Combine Needs me
  // with stage to narrow the same action queues without hiding other functions.
  assert.equal(container.querySelectorAll('.attention-sub-filter-btn').length, 0);
  app.setState({ viewState: { view: 'simple', filters: ['needs-me', 'project:review/repo'], sort: 'priority' } });
  app.renderViews();
  assert.ok(container.innerHTML.includes('#22'));
  assert.ok(!container.innerHTML.includes('#11'));

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
  app.setState({ viewState: { view: 'simple', filters: ['needs-me'], sort: 'priority' } });
  app.renderViews();

  assert.equal(elements.has('attentionViewBadge'), false, 'duplicate badge removed');
  assert.equal(elements.get('attentionViewContainer').querySelectorAll('.attention-card').length, 0);

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
  app.setState({ viewState: { view: 'simple', filters: ['needs-me'], sort: 'priority' } });
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

  app.setState({ viewState: { view: 'cards', filters: [], sort: 'priority' } });

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

// ============================================================================
// 8. Remediations for Hostile Review Findings (ADV-01..ADV-06)
// ============================================================================
test('CSS: panel/index.html attention repo badge defines ellipsis truncation styles (ADV-06)', () => {
  const badgeCssMatch = INDEX_HTML.match(/\.attention-repo-badge\s*\{([^}]+)\}/);
  assert.ok(badgeCssMatch, '.attention-repo-badge CSS rule must exist in index.html');
  const css = badgeCssMatch[1];
  assert.match(css, /max-width:\s*90px;?/, '.attention-repo-badge must have max-width: 90px');
  assert.match(css, /text-overflow:\s*ellipsis;?/, '.attention-repo-badge must have text-overflow: ellipsis');
  assert.match(css, /overflow:\s*hidden;?/, '.attention-repo-badge must have overflow: hidden');
  assert.match(css, /white-space:\s*nowrap;?/, '.attention-repo-badge must have white-space: nowrap');
});

test('Runtime: renderDrawerAcceptanceCriteria handles null and undefined safely without throwing (ADV-03)', () => {
  const { elements, mockWindow } = createTestApp();
  const renderAc = mockWindow.renderDrawerAcceptanceCriteria;
  assert.equal(typeof renderAc, 'function', 'renderDrawerAcceptanceCriteria must be available');

  const acSection = elements.get('drawerAcceptanceCriteriaSection');
  acSection.style.display = 'block';

  // ADV-03: Invoking with null or undefined must not throw and must hide section
  assert.doesNotThrow(() => {
    renderAc(null);
  }, 'renderDrawerAcceptanceCriteria(null) must not throw');
  assert.equal(acSection.style.display, 'none', 'AC section must be hidden when issue is null');

  acSection.style.display = 'block';
  assert.doesNotThrow(() => {
    renderAc(undefined);
  }, 'renderDrawerAcceptanceCriteria(undefined) must not throw');
  assert.equal(acSection.style.display, 'none', 'AC section must be hidden when issue is undefined');
});

test('Runtime: renderDrawerAcceptanceCriteria sets aria-label on checkbox inputs (ADV-05)', () => {
  const { app, elements } = createTestApp();
  const issueWithAc = {
    number: 91,
    title: 'AC with accessible label',
    body: '### Acceptance Criteria\n- [ ] Fast performance\n- [x] Zero regressions',
    labels: [],
    subtasks: [],
  };

  app.renderDrawer(issueWithAc);
  const container = elements.get('drawerAcceptanceCriteriaContainer');
  const checkboxes = container.querySelectorAll('input');
  assert.equal(checkboxes.length, 2);
  assert.equal(checkboxes[0].getAttribute('aria-label'), 'Fast performance');
  assert.equal(checkboxes[1].getAttribute('aria-label'), 'Zero regressions');
});

test('Runtime: AC toggle re-locates target item lineIndex when body lines shifted remotely (ADV-01)', async () => {
  let patchBody = null;
  const initialBody = [
    '### Acceptance Criteria',
    '- [ ] Criterion 1',
    '- [ ] Criterion 2',
  ].join('\n');

  const remoteFreshBody = [
    '# Shifted Title',
    'Remote added this line 1',
    'Remote added this line 2',
    '',
    '### Acceptance Criteria',
    '- [ ] Criterion 1',
    '- [ ] Criterion 2',
  ].join('\n');

  const { app, elements } = createTestApp({
    onRequest: (payload) => {
      if (payload.method === 'GET' && payload.path === '/repos/test-owner/test-repo/issues/701') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 701,
            body: remoteFreshBody,
            updated_at: '2026-10-23T12:00:00Z',
          }),
        };
      }
      if (payload.method === 'PATCH' && payload.path === '/repos/test-owner/test-repo/issues/701') {
        const parsed = JSON.parse(payload.body || '{}');
        patchBody = parsed.body;
        return {
          status: 200,
          body: JSON.stringify({
            number: 701,
            body: patchBody,
            updated_at: '2026-10-23T12:01:00Z',
          }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  const issue = {
    number: 701,
    repo: 'test-owner/test-repo',
    title: 'Drift test issue',
    body: initialBody,
    labels: [],
    subtasks: [],
  };

  app.renderDrawer(issue);

  const container = elements.get('drawerAcceptanceCriteriaContainer');
  const checkboxes = container.querySelectorAll('input');
  assert.equal(checkboxes.length, 2);

  // Click criterion 2 (index 1)
  checkboxes[1].click();

  // Wait for async reload and patch
  for (let i = 0; i < 50; i++) {
    if (patchBody) break;
    await new Promise((r) => setTimeout(r, 10));
  }

  assert.ok(patchBody, 'A PATCH request should have been dispatched');
  assert.ok(patchBody.includes('# Shifted Title'), 'PATCH body must retain remote shifted content');
  assert.ok(patchBody.includes('- [ ] Criterion 1'), 'Criterion 1 must remain unchecked');
  assert.ok(patchBody.includes('- [x] Criterion 2'), 'Criterion 2 must be checked at its shifted line');
  assert.ok(patchBody.includes('Remote added this line 2'), 'Remote lines must not be corrupted by drift');
});

test('Runtime: issue.v2Metadata is refreshed on updateIssueBody, reloadIssueBeforeMutation, and updateIssueStatus (ADV-02)', async () => {
  const { app, mockWindow } = createTestApp({
    onRequest: (payload) => {
      if (payload.method === 'GET' && payload.path === '/repos/test-owner/test-repo/issues/801') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 801,
            body: '## Work\nAll questions resolved remotely.',
            updated_at: '2026-10-23T14:00:00Z',
          }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  const issue = {
    number: 801,
    repo: 'test-owner/test-repo',
    title: 'Question issue',
    body: '## Work\n### Open Questions\n- [ ] Should we use SQLite or PostgreSQL?\n',
    state: 'open',
    labels: [{ name: 'status:in-progress' }],
    openQuestions: [{ text: 'Should we use SQLite or PostgreSQL?', completed: false, lineIndex: 2 }],
    subtasks: [],
  };

  // Initially compute and cache v2Metadata
  issue.v2Metadata = resolveV2Metadata(issue);
  assert.equal(issue.v2Metadata.attention, 'needs-decision', 'Initial attention must be needs-decision');

  // 1. updateIssueBody clears open questions
  await app.updateIssueBody(issue, '## Work\nQuestions answered.');
  assert.equal(
    issue.v2Metadata?.attention,
    'none',
    'issue.v2Metadata must be recomputed on updateIssueBody, clearing needs-decision'
  );
  assert.equal(
    mockWindow.formatAlertBadges(issue),
    '',
    'formatAlertBadges must return empty string once questions are cleared'
  );

  // 2. updateIssueStatus moves issue to done (closed)
  issue.v2Metadata.attention = 'needs-review'; // inject artificial stale metadata
  await app.updateIssueStatus(issue, 'done', { isHumanGesture: true });
  assert.equal(
    issue.v2Metadata?.phase,
    'done',
    'issue.v2Metadata.phase must be recomputed to done on updateIssueStatus'
  );
  assert.equal(
    issue.v2Metadata?.attention,
    'none',
    'issue.v2Metadata.attention must be none when closed/done'
  );

  // 3. reloadIssueBeforeMutation recomputes issue.v2Metadata
  issue.v2Metadata.attention = 'needs-decision'; // inject stale
  if (typeof mockWindow.reloadIssueBeforeMutation === 'function') {
    await mockWindow.reloadIssueBeforeMutation(issue);
    assert.equal(
      issue.v2Metadata?.attention,
      'none',
      'reloadIssueBeforeMutation must refresh issue.v2Metadata from reloaded body'
    );
  }
});

