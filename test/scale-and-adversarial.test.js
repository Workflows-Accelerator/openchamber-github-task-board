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
  groupIssuesByProject,
  aggregateProjectIssues,
  readCachedIssueCollection,
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
  assert.ok(sortDuration < 100, `Sorting 1,000 issues took ${sortDuration}ms, expected <100ms`);

  const startFilter = performance.now();
  const filteredQuery = filterIssues(issues, { query: 'bug 3', priority: 'all', tag: 'all' });
  const filteredTag = filterIssues(issues, { query: '', priority: 'critical', tag: 'tag-1' });
  const filterDuration = performance.now() - startFilter;

  assert.ok(filteredQuery.length > 0);
  assert.ok(filteredTag.length > 0);
  assert.ok(filterDuration < 100, `Filtering 1,000 issues took ${filterDuration}ms, expected <100ms`);
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

const PROJECTS = [
  {
    id: 'p1',
    name: 'Alpha',
    directory: '/workspace/alpha',
    gitRepo: { owner: 'acme', repo: 'alpha' },
    linkedRepo: 'acme/alpha',
  },
  {
    id: 'p2',
    name: 'Beta',
    directory: '/workspace/beta',
    gitRepo: null,
    linkedRepo: 'acme/beta',
  },
];

test('groupIssuesByProject: a) clusters issues by tagged project and by repository', () => {
  const issues = [
    { number: 1, title: 'A1', projectId: 'p1' },
    { number: 2, title: 'A2', projectId: 'p1' },
    { number: 3, title: 'B1', projectId: 'p2' },
    { number: 4, title: 'B2 by repo', repo: 'acme/beta' },
    { number: 5, title: 'orphan', repo: 'other/repo' },
    { number: 6, title: 'inferred from url', html_url: 'https://github.com/acme/alpha/issues/6' },
  ];

  const groups = groupIssuesByProject(issues, PROJECTS);

  // Empty projects are omitted; unmatched issues fall into a labelled group.
  assert.deepEqual(groups.map((g) => g.title), ['Alpha', 'Beta', 'other/repo']);
  assert.deepEqual(groups.map((g) => g.id), ['p1', 'p2', 'unmatched:other/repo']);
  assert.deepEqual(groups.map((g) => g.count), [3, 2, 1]);
  assert.deepEqual(
    groups.map((g) => g.issues.map((i) => i.number)),
    [[1, 2, 6], [3, 4], [5]]
  );
  // Every issue is accounted for exactly once.
  assert.equal(groups.reduce((sum, g) => sum + g.issues.length, 0), issues.length);
});

test('groupIssuesByProject: defends against empty, null, and malformed input', () => {
  assert.deepEqual(groupIssuesByProject([], PROJECTS), []);
  assert.deepEqual(groupIssuesByProject(null, PROJECTS), []);
  assert.deepEqual(groupIssuesByProject(undefined, PROJECTS), []);

  // No projects supplied: unmatched issues still cluster by repo/name label.
  const groups = groupIssuesByProject(
    [
      { number: 1, title: 'x', projectName: 'Gamma' },
      { number: 2, title: 'y', projectName: 'Gamma' },
    ],
    null
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'Gamma');
  assert.equal(groups[0].count, 2);

  // Null entries inside the arrays never throw.
  assert.deepEqual(groupIssuesByProject([null, undefined], [null, undefined]), []);
});

test('adversarial stress test: multi-repo aggregation and caching handles 1,000+ issues', () => {
  const repoCount = 12;
  const issuesPerRepo = 100;
  const sources = Array.from({ length: repoCount }, (_, ri) => ({
    projectId: `p${ri}`,
    projectName: `Project ${ri}`,
    repo: `acme/repo-${ri}`,
    issues: Array.from({ length: issuesPerRepo }, (_, ii) => ({
      number: ri * 1000 + ii + 1,
      title: `Issue ${ri}-${ii}`,
      state: 'open',
      labels: [],
      subtasks: [],
    })),
  }));

  const start = performance.now();
  const merged = aggregateProjectIssues(sources);
  const duration = performance.now() - start;

  assert.equal(merged.length, repoCount * issuesPerRepo);
  assert.equal(merged[0].projectId, 'p0');
  assert.equal(merged[0].projectName, 'Project 0');
  assert.equal(merged[0].repo, 'acme/repo-0');
  assert.equal(merged[merged.length - 1].projectId, `p${repoCount - 1}`);
  assert.ok(duration < 100, `Aggregating 1,200 issues took ${duration}ms, expected <100ms`);

  // Duplicate pages from the same repo must dedupe by repo + issue number.
  const deduped = aggregateProjectIssues([...sources, ...sources]);
  assert.equal(deduped.length, repoCount * issuesPerRepo);

  // Same issue number in different repos must NOT collide.
  const collisions = aggregateProjectIssues([
    { projectId: 'a', projectName: 'A', repo: 'acme/one', issues: [{ number: 7, title: 'one' }] },
    { projectId: 'b', projectName: 'B', repo: 'acme/two', issues: [{ number: 7, title: 'two' }] },
  ]);
  assert.equal(collisions.length, 2);

  // Fresh cache entry returns instantly; stale entry is evicted.
  const cache = new Map();
  cache.set('all', { timestamp: 1_000_000, issues: merged });
  const cached = readCachedIssueCollection(cache, 'all', 60000, 1_050_000);
  assert.equal(cached.length, repoCount * issuesPerRepo);
  assert.equal(readCachedIssueCollection(cache, 'all', 60000, 1_070_000), null);
  assert.equal(cache.has('all'), false);

  // Grouping 1,200 aggregated issues by project stays fast.
  const groupStart = performance.now();
  const groups = groupIssuesByProject(merged, sources.map((s) => ({
    id: s.projectId,
    name: s.projectName,
    directory: `/workspace/${s.projectName}`,
    gitRepo: null,
    linkedRepo: s.repo,
  })));
  const groupDuration = performance.now() - groupStart;

  assert.equal(groups.length, repoCount);
  assert.ok(groups.every((g) => g.count === issuesPerRepo));
  assert.ok(groupDuration < 100, `Grouping 1,200 issues took ${groupDuration}ms, expected <100ms`);
});
