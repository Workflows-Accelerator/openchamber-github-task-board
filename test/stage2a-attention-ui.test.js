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
