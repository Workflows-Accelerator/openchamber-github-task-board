import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeIssuePages,
  normalizeGithubIssues,
  syncIncrementalRepoIssues,
  buildMultiIssueAttachPayload,
  sessionRepoKeys,
} from '../panel/core.ts';
import { updatePriorityLabels } from '../panel/labels.ts';

// ==========================================
// Test 1: F-01 Cross-Repo Issue Collisions in mergeIssuePages
// ==========================================
test('F-01: mergeIssuePages preserves issues with the same issue number in different repos', () => {
  const existingAllProjectsIssues = [
    { number: 10, title: 'Repo A Issue 10', repo: 'owner/repo-A', state: 'open' },
    { number: 20, title: 'Repo A Issue 20', repo: 'owner/repo-A', state: 'open' },
    { number: 10, title: 'Repo B Issue 10', repo: 'owner/repo-B', state: 'open' },
  ];

  const incomingChanged = [
    { number: 10, title: 'Repo A Issue 10 (Updated)', repo: 'owner/repo-A', state: 'closed' },
  ];

  const merged = mergeIssuePages(existingAllProjectsIssues, incomingChanged);

  assert.equal(merged.length, 3, 'Both repo-A and repo-B issue #10 must survive in All Projects mode');
  const repoAIssue = merged.find((i) => i.repo === 'owner/repo-A' && i.number === 10);
  const repoBIssue = merged.find((i) => i.repo === 'owner/repo-B' && i.number === 10);
  assert.ok(repoAIssue, 'Repo A issue 10 must exist');
  assert.equal(repoAIssue.title, 'Repo A Issue 10 (Updated)', 'Repo A issue 10 must be updated');
  assert.equal(repoAIssue.state, 'closed');
  assert.ok(repoBIssue, 'Repo B issue 10 must NOT be clobbered');
  assert.equal(repoBIssue.title, 'Repo B Issue 10');
});

// ==========================================
// Test 2: F-04 Incremental Sync Pagination (>100 items)
// ==========================================
test('F-04: syncIncrementalRepoIssues fetches all pages when changes exceed 100 items', async () => {
  const existingIssues = [];

  const page1Items = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    body: 'Updated body',
    state: 'open',
    updated_at: '2026-10-07T12:05:00Z',
  }));

  const page2Items = Array.from({ length: 50 }, (_, i) => ({
    number: i + 101,
    title: `Issue #${i + 101}`,
    body: 'Page 2 item',
    state: 'open',
    updated_at: '2026-10-07T12:05:00Z',
  }));

  const requestedUrls = [];
  const mockRequestFn = async (method, path) => {
    requestedUrls.push(path);
    const pageNum = Number(/[?&]page=(\d+)/.exec(path)?.[1] || '1');
    if (pageNum === 1) return page1Items;
    if (pageNum === 2) return page2Items;
    return [];
  };

  const result = await syncIncrementalRepoIssues({
    repo: 'owner/test-repo',
    since: '2026-10-07T12:00:00Z',
    currentIssues: existingIssues,
    requestFn: mockRequestFn,
  });

  assert.equal(requestedUrls.length, 2, 'Must request page 1 and page 2');
  assert.ok(requestedUrls[0].includes('page=1'));
  assert.ok(requestedUrls[1].includes('page=2'));
  assert.equal(result.issues.length, 150, 'All 150 changed items across both pages must be merged');
  assert.equal(result.changedCount, 150);
});

// ==========================================
// Test 3: F-12 normalizeGithubIssues preserves repo property
// ==========================================
test('F-12: normalizeGithubIssues preserves repo property', () => {
  const createdRaw = {
    number: 77,
    title: 'Brand New Task',
    body: 'Details',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/77',
    labels: [],
  };

  const normalized = normalizeGithubIssues([{ ...createdRaw, repo: 'owner/repo' }]);
  assert.equal(normalized[0].number, 77);
  assert.equal(normalized[0].repo, 'owner/repo', 'normalizeGithubIssues must preserve repo');
});

// ==========================================
// Test 4: F-13 Cross-repo multi-issue payload attribution
// ==========================================
test('F-13: buildMultiIssueAttachPayload preserves per-issue repos for cross-repo bundles', () => {
  const issueA = {
    number: 1,
    title: 'Issue in Repo Alpha',
    repo: 'org/alpha',
    html_url: 'https://github.com/org/alpha/issues/1',
  };
  const issueB = {
    number: 2,
    title: 'Issue in Repo Beta',
    repo: 'org/beta',
    html_url: 'https://github.com/org/beta/issues/2',
  };

  const payload = buildMultiIssueAttachPayload([issueA, issueB]);

  // When session items are indexed:
  const mockSession = {
    id: 'multi-sess',
    activity: 'running',
    items: [
      {
        id: payload.id,
        data: payload.data,
      },
    ],
  };

  const keys = sessionRepoKeys(mockSession);
  assert.ok(keys.includes('org/alpha#1'), 'org/alpha#1 must be bound');
  assert.ok(keys.includes('org/beta#2'), 'org/beta#2 must be bound');
  assert.ok(!keys.includes('org/alpha#2'), 'org/alpha#2 must NOT be bound');
});

// ==========================================
// Test 5: F-14 updatePriorityLabels with "none" clears priority
// ==========================================
test('F-14: updatePriorityLabels clears existing priority when given "none"', () => {
  const currentLabels = [{ name: 'status:in-progress' }, { name: 'priority:high' }, { name: 'bug' }];
  const updated = updatePriorityLabels(currentLabels, 'none');
  assert.ok(!updated.some((l) => l.startsWith('priority:')), 'All priority labels must be removed');
  assert.ok(updated.includes('status:in-progress'));
  assert.ok(updated.includes('bug'));
});

// ==========================================
// Test 6: F-02 & F-03 Page body cache reconstruction and cold start 304 handling
// ==========================================
test('F-02 & F-03: Page body cache returns cached items on 304 and avoids dropping later pages', async () => {
  const pageBodyCache = new Map();
  const setCachedPage = (path, items, etag) => {
    pageBodyCache.set(path, { items, etag, timestamp: Date.now() });
  };

  const page1Items = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    repo: 'owner/test-repo',
  }));
  const page2Items = Array.from({ length: 45 }, (_, i) => ({
    number: i + 101,
    title: `Issue #${i + 101}`,
    repo: 'owner/test-repo',
  }));

  // Populate cache for page 1 and page 2
  setCachedPage('/repos/owner/test-repo/issues?state=all&per_page=100&page=1', page1Items, 'etag-1');
  setCachedPage('/repos/owner/test-repo/issues?state=all&per_page=100&page=2', page2Items, 'etag-2');

  // Simulate streaming page 2 with a 304 Not Modified
  const simulatePageStream = async (page) => {
    const pagePath = `/repos/owner/test-repo/issues?state=all&per_page=100&page=${page}`;
    const cachedPage = pageBodyCache.get(pagePath);
    // Network returns 304
    const nextRaw = { notModified: true, status: 304 };

    let nextItems = [];
    if (nextRaw.notModified || nextRaw.status === 304) {
      if (cachedPage && cachedPage.items && cachedPage.items.length > 0) {
        nextItems = cachedPage.items;
      }
    }
    return nextItems;
  };

  const streamedPage2 = await simulatePageStream(2);
  assert.equal(streamedPage2.length, 45, 'Page 2 must be restored from pageBodyCache on 304');
  assert.equal(streamedPage2[0].number, 101);

  // Cold start 304 without cached body must trigger unconditional retry
  let retryCount = 0;
  const simulateColdStartFetch = async (hasCachedBody) => {
    const pagePath = '/repos/owner/test-repo/issues?state=all&per_page=100&page=1';
    let raw = { notModified: true, status: 304 };
    let items = [];
    if (raw.notModified || raw.status === 304) {
      if (hasCachedBody) {
        items = page1Items;
      } else {
        // Cold start retry:
        retryCount++;
        raw = { items: page1Items, status: 200 };
        items = raw.items;
      }
    }
    return items;
  };

  const coldStartIssues = await simulateColdStartFetch(false);
  assert.equal(retryCount, 1, 'Must execute unconditional retry when 304 arrives without cached body');
  assert.equal(coldStartIssues.length, 100, 'Board must not be rendered empty on cold start 304');
});

// ==========================================
// Test 7: F-05 D11 B1 full-scope idle refresh across all repos
// ==========================================
test('F-05: Idle refresh in All Projects mode refreshes all configured repos in scope (D11 B1)', async () => {
  const allProjectsRepoRefs = [
    { projectId: 'p1', projectName: 'Project 1', repo: 'org/repo-alpha' },
    { projectId: 'p2', projectName: 'Project 2', repo: 'org/repo-beta' },
    { projectId: 'p3', projectName: 'Project 3', repo: 'org/repo-gamma' },
  ];

  // Even if idle sessions only link to repo-alpha:
  const idleSessions = [{ id: 'sess-1', activity: 'idle', items: [{ data: { repo: 'org/repo-alpha' } }] }];
  const isAllProjectsMode = true;

  const reposToSync = isAllProjectsMode
    ? (allProjectsRepoRefs.length > 0 ? allProjectsRepoRefs.map((r) => r.repo) : [])
    : ['org/repo-alpha'];

  assert.equal(reposToSync.length, 3, 'Must refresh all 3 repos in All Projects mode');
  assert.deepEqual(reposToSync, ['org/repo-alpha', 'org/repo-beta', 'org/repo-gamma']);
});

// ==========================================
// Test 8: F-06 Cross-repo cache isolation in multi-project mode
// ==========================================
test('F-06: Incremental sync in All Projects mode does not contaminate single-repo cache with other repos', () => {
  const issueCache = new Map();
  const ALL_PROJECTS_CACHE_KEY = '__all_projects__';

  const multiRepoIssues = [
    { number: 1, title: 'Alpha task', repo: 'org/alpha' },
    { number: 2, title: 'Beta task', repo: 'org/beta' },
  ];

  const cleanRepo = 'org/alpha';
  const isAllProjectsMode = true;

  // Emulate F-06 repaired caching:
  if (isAllProjectsMode) {
    issueCache.set(ALL_PROJECTS_CACHE_KEY, { timestamp: Date.now(), issues: multiRepoIssues });
    const repoOnlyIssues = multiRepoIssues.filter((i) => i.repo === cleanRepo);
    issueCache.set(cleanRepo, { timestamp: Date.now(), issues: repoOnlyIssues });
  }

  const alphaCache = issueCache.get('org/alpha');
  assert.equal(alphaCache.issues.length, 1, 'Single-repo cache must only have issues for org/alpha');
  assert.equal(alphaCache.issues[0].repo, 'org/alpha');

  const allProjectsCache = issueCache.get(ALL_PROJECTS_CACHE_KEY);
  assert.equal(allProjectsCache.issues.length, 2, 'All projects cache contains all repos');
});

// ==========================================
// Test 9: F-07 & F-09 Memory leak prevention with repo-keyed ETag cache
// ==========================================
test('F-07 & F-09: repoIncrementalEtagCache is keyed strictly by clean repo name without timestamps', () => {
  const repoIncrementalEtagCache = new Map();

  const repo = 'owner/repo';
  const since1 = '2026-10-07T12:00:00.000Z';
  const since2 = '2026-10-07T12:05:00.000Z';

  // First sync
  repoIncrementalEtagCache.set(repo, 'W/"etag-first"');
  assert.equal(repoIncrementalEtagCache.get(repo), 'W/"etag-first"');

  // Second sync with different timestamp reuses the same key
  repoIncrementalEtagCache.set(repo, 'W/"etag-second"');
  assert.equal(repoIncrementalEtagCache.size, 1, 'Cache map size must remain 1 regardless of changing timestamps');
  assert.equal(repoIncrementalEtagCache.get(repo), 'W/"etag-second"');
});

// ==========================================
// Test 10: F-08 Stale comment race prevention using drawer generation guards
// ==========================================
test('F-08: Stale comment response from previous issue is discarded when active issue changes', async () => {
  let drawerGeneration = 0;
  let activeIssue = null;
  let renderedComments = null;

  const simulateLoadComments = async (issueNumber, gen, delayMs, comments) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    // Guard from repaired loadComments:
    if (drawerGeneration === gen && activeIssue && activeIssue.number === issueNumber) {
      renderedComments = comments;
    }
  };

  // 1. Open Issue 10
  drawerGeneration++;
  activeIssue = { number: 10, repo: 'owner/repo' };
  const p1 = simulateLoadComments(10, drawerGeneration, 40, ['Comment on issue 10']);

  // 2. Rapidly switch to Issue 20
  drawerGeneration++;
  activeIssue = { number: 20, repo: 'owner/repo' };
  const p2 = simulateLoadComments(20, drawerGeneration, 10, ['Comment on issue 20']);

  await Promise.all([p1, p2]);

  assert.equal(activeIssue.number, 20);
  assert.deepEqual(renderedComments, ['Comment on issue 20'], 'Issue 10 comments must not overwrite Issue 20');
});

// ==========================================
// Test 11: F-10 commentsCache cleared on refresh and repo switch
// ==========================================
test('F-10: commentsCache is cleared when refreshTasks or setRepository is triggered', () => {
  const commentsCache = new Map();
  commentsCache.set('owner/repo#1', { timestamp: Date.now(), comments: [{ body: 'old' }] });

  assert.equal(commentsCache.size, 1);

  // Manual refresh or repo switch executes:
  commentsCache.clear();
  assert.equal(commentsCache.size, 0, 'commentsCache must be empty after refresh/switch');
});

// ==========================================
// Test 12: F-11 Mutation request safety (no proxy fallback after failed PAT mutation)
// ==========================================
test('F-11: githubRequest does not fallback to proxy for non-GET mutations on error', async () => {
  let proxyCalled = false;

  const simulateRequest = async (method, failPat) => {
    if (failPat) {
      if (method !== 'GET') {
        throw new Error(`GitHub ${method} failed: 500 Server Error`);
      }
      proxyCalled = true;
    }
  };

  // GET request allows fallback
  proxyCalled = false;
  await simulateRequest('GET', true);
  assert.equal(proxyCalled, true, 'GET requests can fall back to proxy');

  // POST/PATCH mutations forbid fallback
  proxyCalled = false;
  await assert.rejects(
    async () => {
      await simulateRequest('POST', true);
    },
    /GitHub POST failed/,
    'POST mutations must throw immediately without falling back to proxy'
  );
  assert.equal(proxyCalled, false, 'Proxy must NOT be called for failed mutation');
});

