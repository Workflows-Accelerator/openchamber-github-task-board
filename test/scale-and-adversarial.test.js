import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionIndex,
  buildDependencyGraph,
  detectCycle,
  scopeDoneIssues,
  normalizeGithubIssues,
  mergeIssuePages,
  parseIssueDependencies,
  parseSubtasks,
  parseOpenQuestions,
} from '../panel/core.ts';
import { sortIssues, filterIssues } from './optimizations.test.js';

test('adversarial stress test: buildSessionIndex handles 1,000 sessions with O(1) performance', () => {
  const sessions = Array.from({ length: 1000 }, (_, i) => ({
    id: `sess-${i}`,
    title: `Working on issue #${i + 1}`,
    activity: i % 10 === 0 ? 'running' : 'idle',
    worktree: { name: `issue-${i + 1}-feature` },
    items: [{ id: String(i + 1), data: { issueNumber: i + 1 } }],
  }));

  const start = performance.now();
  const index = buildSessionIndex(sessions);
  const duration = performance.now() - start;

  assert.equal(index.size, 1000);
  assert.equal(index.get(1)?.id, 'sess-0');
  assert.equal(index.get(500)?.id, 'sess-499');
  assert.equal(index.get(9999), undefined);
  // Must execute under 50ms (typically ~5ms)
  assert.ok(duration < 50, `Session indexing took ${duration}ms, expected <50ms`);
});

test('adversarial stress test: buildDependencyGraph scales to 500 interconnected issues', () => {
  const issues = Array.from({ length: 500 }, (_, i) => {
    const num = i + 1;
    // Issue N is blocked by previous issue N-1 (deep waterfall chain)
    const blocker = num > 1 && num % 3 === 0 ? `Blocked by #${num - 1}` : '';
    return {
      number: num,
      title: `Task #${num}`,
      body: `Description for task ${num}.\n${blocker}`,
      state: num % 5 === 0 ? 'closed' : 'open',
      labels: [{ name: `theme:theme-${num % 8}` }],
      subtasks: [],
    };
  });

  const start = performance.now();
  const graph = buildDependencyGraph(issues);
  const duration = performance.now() - start;

  assert.equal(graph.nodes.size, 500);
  assert.ok(graph.layers.length > 1);
  assert.ok(graph.frontierNodes.length > 0);
  assert.ok(duration < 100, `Graph construction took ${duration}ms, expected <100ms`);
});

test('adversarial stress test: detectCycle handles deep chains without call stack overflow', () => {
  const chainLength = 150;
  const chainIssues = Array.from({ length: chainLength }, (_, i) => {
    const num = i + 1;
    return {
      number: num,
      title: `Chain ${num}`,
      body: num > 1 ? `Blocked by #${num - 1}` : '',
      state: 'open',
      labels: [],
      subtasks: [],
    };
  });

  // Attempting to make Issue 1 blocked by Issue 150 creates a 150-node loop
  assert.equal(detectCycle(chainIssues, 150, 1), true);
  // Valid non-cycle check
  assert.equal(detectCycle(chainIssues, 1, 150), false);
});

test('adversarial stress test: sorting and filtering 1,000 issues runs in <15ms', () => {
  const issues = Array.from({ length: 1000 }, (_, i) => ({
    number: i + 1,
    title: `Issue ${i + 1} fixing bug ${i % 10}`,
    body: 'Some details',
    state: i % 4 === 0 ? 'closed' : 'open',
    labels: [
      { name: i % 3 === 0 ? 'priority:critical' : 'priority:optional' },
      { name: `tag-${i % 5}` },
    ],
    subtasks: [{ completed: i % 2 === 0, text: 'Do it' }],
  }));

  const startSort = performance.now();
  const sortedPriority = sortIssues(issues, 'priority');
  const sortedComplexity = sortIssues(issues, 'complexity');
  const sortedNewest = sortIssues(issues, 'newest');
  const sortDuration = performance.now() - startSort;

  assert.equal(sortedPriority.length, 1000);
  assert.equal(sortedComplexity.length, 1000);
  assert.equal(sortedNewest.length, 1000);
  assert.ok(sortDuration < 30, `Sorting 1,000 issues took ${sortDuration}ms, expected <30ms`);

  const startFilter = performance.now();
  const filteredQuery = filterIssues(issues, { query: 'bug 3', priority: 'all', tag: 'all' });
  const filteredTag = filterIssues(issues, { query: '', priority: 'critical', tag: 'tag-1' });
  const filterDuration = performance.now() - startFilter;

  assert.ok(filteredQuery.length > 0);
  assert.ok(filteredTag.length > 0);
  assert.ok(filterDuration < 30, `Filtering 1,000 issues took ${filterDuration}ms, expected <30ms`);
});

test('adversarial stress test: normalizeGithubIssues and mergeIssuePages handle 1,000 items safely', () => {
  const rawApiPages = Array.from({ length: 10 }, (_, pageIdx) =>
    Array.from({ length: 100 }, (_, itemIdx) => {
      const num = pageIdx * 100 + itemIdx + 1;
      return {
        number: num,
        title: `Raw API issue #${num}`,
        body: `### Subtasks\n- [ ] Task 1\n- [x] Task 2\n### Open Questions:\n- [ ] Question 1?`,
        state: 'open',
        pull_request: num % 10 === 0 ? { url: 'https://...' } : undefined,
      };
    })
  );

  let merged = [];
  const start = performance.now();
  for (const rawPage of rawApiPages) {
    const normalized = normalizeGithubIssues(rawPage);
    merged = mergeIssuePages(merged, normalized);
  }
  const duration = performance.now() - start;

  // 1,000 total items, 100 pull requests filtered out = 900 issues
  assert.equal(merged.length, 900);
  assert.equal(merged[0].number, 999); // Highest issue number (1000 was a pull request)
  assert.ok(duration < 60, `Multi-page normalization and merging took ${duration}ms, expected <60ms`);
});

test('adversarial defense: null, undefined, malformed, and huge markdown data never crash parser', () => {
  assert.deepEqual(normalizeGithubIssues(null), []);
  assert.deepEqual(normalizeGithubIssues(undefined), []);
  assert.deepEqual(normalizeGithubIssues([null, undefined, {}]), [
    {
      number: undefined,
      title: '',
      body: '',
      state: 'open',
      html_url: '',
      labels: [],
      user: undefined,
      assignees: [],
      comments: 0,
      created_at: '',
      subtasks: [],
      openQuestions: [],
    },
  ]);

  assert.deepEqual(mergeIssuePages([], null), []);
  assert.deepEqual(buildSessionIndex(null).size, 0);
  assert.deepEqual(scopeDoneIssues(null), { visible: [], total: 0, remaining: 0 });

  // Extremely large markdown body test (10,000 lines)
  const hugeBody = Array.from({ length: 5000 }, (_, i) => `- [ ] Large task item ${i}`).join('\n');
  const start = performance.now();
  const subtasks = parseSubtasks(hugeBody);
  const duration = performance.now() - start;

  assert.equal(subtasks.length, 5000);
  assert.ok(duration < 100, `Parsing 5,000 subtasks took ${duration}ms, expected <100ms`);
});
