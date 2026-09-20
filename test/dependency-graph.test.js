import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIssueDependencies,
  addDependencyToMarkdown,
  removeDependencyFromMarkdown,
  extractIssueReferences,
  buildDependencyGraph,
  calculateEdgePath,
  detectCycle,
} from '../panel/core.ts';

test('parseIssueDependencies extracts blocker numbers from various standard formats', () => {
  assert.deepEqual(parseIssueDependencies(''), []);
  assert.deepEqual(parseIssueDependencies(null), []);

  const text1 = 'This issue implements the UI.\nBlocked by #12';
  assert.deepEqual(parseIssueDependencies(text1), [12]);

  const text2 = 'Blocked by #15, #8, #20';
  assert.deepEqual(parseIssueDependencies(text2), [8, 15, 20]);

  const text3 = '- [ ] Depends on #42\n- [x] Depends on #7';
  assert.deepEqual(parseIssueDependencies(text3), [7, 42]);

  const text4 = 'Depends on: #10, #11\nBlocked by #10'; // deduplicated
  assert.deepEqual(parseIssueDependencies(text4), [10, 11]);

  // Does not match random mentions like "Fixed in #5" or "See #99"
  const text5 = 'See #99 for details. Related to #44.';
  assert.deepEqual(parseIssueDependencies(text5), []);
});

test('addDependencyToMarkdown adds blocker cleanly and idempotently', () => {
  assert.equal(addDependencyToMarkdown('', 10), 'Blocked by #10');
  assert.equal(addDependencyToMarkdown('Some description', 10), 'Some description\n\nBlocked by #10');

  // Appending to existing Blocked by line
  const existing = 'Some description\n\nBlocked by #5';
  assert.equal(addDependencyToMarkdown(existing, 12), 'Some description\n\nBlocked by #5, #12');

  // Idempotent: adding already present blocker changes nothing
  assert.equal(addDependencyToMarkdown('Blocked by #5, #12', 5), 'Blocked by #5, #12');
});

test('removeDependencyFromMarkdown removes blocker and cleans up empty line', () => {
  const multi = 'Some description\n\nBlocked by #5, #12';
  assert.equal(removeDependencyFromMarkdown(multi, 12), 'Some description\n\nBlocked by #5');

  const single = 'Some description\n\nBlocked by #5';
  assert.equal(removeDependencyFromMarkdown(single, 5), 'Some description');

  // If not present, returns untouched
  assert.equal(removeDependencyFromMarkdown('Blocked by #5', 99), 'Blocked by #5');
});

test('extractIssueReferences finds mentioned issue numbers excluding self', () => {
  const body = 'Ref #12 and relates to #45. Also #99.';
  assert.deepEqual(extractIssueReferences(body, 12), [45, 99]);
  assert.deepEqual(extractIssueReferences('', 1), []);
});

test('buildDependencyGraph constructs waterfall layers, detects frontier, and calculates downstream impact', () => {
  const mockIssues = [
    {
      number: 1,
      title: 'Database Schema',
      body: 'Initial schema setup',
      state: 'open',
      labels: [{ name: 'theme:backend' }, { name: 'priority:critical' }],
      subtasks: [],
    },
    {
      number: 2,
      title: 'API Endpoints',
      body: 'CRUD endpoints\nBlocked by #1',
      state: 'open',
      labels: [{ name: 'theme:backend' }, { name: 'priority:important' }],
      subtasks: [],
    },
    {
      number: 3,
      title: 'Frontend Client',
      body: 'UI screens\nBlocked by #2',
      state: 'open',
      labels: [{ name: 'theme:frontend' }],
      subtasks: [],
    },
    {
      number: 4,
      title: 'Auth Setup',
      body: 'Cognito integration',
      state: 'closed', // done!
      labels: [{ name: 'theme:auth' }],
      subtasks: [],
    },
    {
      number: 5,
      title: 'Login Page',
      body: 'Login form\nBlocked by #4', // blocker is closed!
      state: 'open',
      labels: [{ name: 'theme:frontend' }],
      subtasks: [],
    },
  ];

  const graph = buildDependencyGraph(mockIssues);

  // Nodes map
  assert.equal(graph.nodes.size, 5);

  const node1 = graph.nodes.get(1);
  assert.equal(node1.layer, 0);
  assert.equal(node1.isFrontier, true);
  assert.equal(node1.isDone, false);
  assert.equal(node1.isBlocked, false);
  // Issue 1 blocks 2, which blocks 3 => downstream impact is 2
  assert.equal(node1.downstreamImpact, 2);

  const node2 = graph.nodes.get(2);
  assert.equal(node2.layer, 1);
  assert.equal(node2.isFrontier, false);
  assert.equal(node2.isBlocked, true);
  assert.deepEqual(node2.openBlockers, [1]);
  assert.equal(node2.downstreamImpact, 1);

  const node3 = graph.nodes.get(3);
  assert.equal(node3.layer, 2);
  assert.equal(node3.isFrontier, false);
  assert.equal(node3.isBlocked, true);
  assert.deepEqual(node3.openBlockers, [2]);
  assert.equal(node3.downstreamImpact, 0);

  const node4 = graph.nodes.get(4);
  assert.equal(node4.layer, 0);
  assert.equal(node4.isDone, true);
  assert.equal(node4.isFrontier, false);

  const node5 = graph.nodes.get(5);
  // Since its only blocker #4 is closed, #5 is unblocked and frontier!
  assert.equal(node5.layer, 0);
  assert.equal(node5.isFrontier, true);
  assert.deepEqual(node5.openBlockers, []);

  // Waterfall layers:
  // Layer 0: [1, 4, 5]
  // Layer 1: [2]
  // Layer 2: [3]
  assert.equal(graph.layers.length, 3);
  assert.deepEqual(graph.layers[0].map((n) => n.issue.number).sort(), [1, 4, 5]);
  assert.deepEqual(graph.layers[1].map((n) => n.issue.number), [2]);
  assert.deepEqual(graph.layers[2].map((n) => n.issue.number), [3]);

  // Edges
  assert.equal(graph.edges.length, 3);
  // Edge 1 -> 2
  assert.ok(graph.edges.some((e) => e.from === 1 && e.to === 2));
  // Edge 2 -> 3 (cross-theme: backend -> frontend)
  const e23 = graph.edges.find((e) => e.from === 2 && e.to === 3);
  assert.ok(e23);
  assert.equal(e23.isCrossTheme, true);
  // Edge 4 -> 5 (closed blocker)
  const e45 = graph.edges.find((e) => e.from === 4 && e.to === 5);
  assert.ok(e45);
  assert.equal(e45.isClosed, true);
});

test('buildDependencyGraph handles circular dependencies safely without infinite loops', () => {
  const circularIssues = [
    { number: 10, title: 'Task A', body: 'Blocked by #20', state: 'open', labels: [] },
    { number: 20, title: 'Task B', body: 'Blocked by #10', state: 'open', labels: [] },
  ];

  // Must not throw or hang
  const graph = buildDependencyGraph(circularIssues);
  assert.equal(graph.nodes.size, 2);
  assert.equal(graph.layers.length, 1);
  assert.equal(graph.layers[0].length, 2);
});

test('calculateEdgePath generates valid SVG cubic bezier path coordinates', () => {
  const sourceRect = { left: 100, top: 50, right: 300, bottom: 150, width: 200, height: 100 };
  const targetRect = { left: 200, top: 300, right: 400, bottom: 400, width: 200, height: 100 };
  const canvasRect = { left: 50, top: 20 };

  const pathData = calculateEdgePath(sourceRect, targetRect, canvasRect);
  // Source bottom center: x = 100 + 100 - 50 = 150, y = 150 - 20 = 130
  // Target top center: x = 200 + 100 - 50 = 250, y = 300 - 20 = 280
  assert.equal(pathData.x1, 150);
  assert.equal(pathData.y1, 130);
  assert.equal(pathData.x2, 250);
  assert.equal(pathData.y2, 280);
  assert.match(pathData.d, /^M 150 130 C/);
  assert.match(pathData.d, /250 280$/);
});

test('detectCycle detects when adding a dependency would introduce a cycle', () => {
  const issues = [
    { number: 1, title: 'A', body: '', state: 'open', labels: [] },
    { number: 2, title: 'B', body: 'Blocked by #1', state: 'open', labels: [] },
    { number: 3, title: 'C', body: 'Blocked by #2', state: 'open', labels: [] },
  ];

  // If we try to make Issue 1 blocked by Issue 3 (blocker = 3, target = 1):
  // Since 3 is already blocked by 2 which is blocked by 1, making 1 blocked by 3 creates a cycle 1 -> 3 -> 2 -> 1!
  assert.equal(detectCycle(issues, 3, 1), true);

  // Normal valid dependency: making 3 also blocked by 1 (no cycle)
  assert.equal(detectCycle(issues, 1, 3), false);

  // Self dependency is a cycle
  assert.equal(detectCycle(issues, 1, 1), true);
});

test('buildDependencyGraph clusters by theme and ranks themes by task count', () => {
  const issues = [
    { number: 1, title: 'Auth API', body: '', state: 'open', labels: [{ name: 'theme:auth' }] },
    { number: 2, title: 'Auth UI', body: 'Blocked by #1', state: 'open', labels: [{ name: 'theme:auth' }] },
    { number: 3, title: 'Billing Setup', body: '', state: 'open', labels: [{ name: 'theme:billing' }] },
    { number: 4, title: 'Docs', body: '', state: 'open', labels: [] },
  ];

  const graph = buildDependencyGraph(issues);
  assert.deepEqual(graph.themes, ['auth', 'billing', 'No Theme']);
  assert.equal(graph.themeNodes.get('auth').length, 2);
  assert.equal(graph.themeNodes.get('billing').length, 1);
  assert.equal(graph.themeNodes.get('No Theme').length, 1);
});

test('add and remove dependency round-trip preserves other markdown content', () => {
  const initial = '## Overview\nImplement feature.\n\n### Tasks\n- [ ] write test';
  const withDep = addDependencyToMarkdown(initial, 42);
  assert.ok(withDep.includes('Blocked by #42'));
  assert.ok(withDep.includes('## Overview'));
  assert.ok(withDep.includes('- [ ] write test'));

  const withSecondDep = addDependencyToMarkdown(withDep, 88);
  assert.ok(withSecondDep.includes('#42, #88') || withSecondDep.includes('#42') && withSecondDep.includes('#88'));

  const removedFirst = removeDependencyFromMarkdown(withSecondDep, 42);
  assert.ok(!removedFirst.includes('#42'));
  assert.ok(removedFirst.includes('#88'));

  const removedAll = removeDependencyFromMarkdown(removedFirst, 88);
  assert.equal(removedAll, initial);
});


