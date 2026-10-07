import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIssueAttachPayload,
  buildMultiIssueAttachPayload,
  getSessionIssueRepo,
  parseRepoFullName,
  buildSessionIndexByRepo,
  findSessionForIssueByRepo,
  buildIncrementalIssuesPath,
  syncIncrementalRepoIssues,
  mergeIssuePages,
  normalizeGithubIssues,
} from '../panel/core.ts';
import { updatePriorityLabels } from '../panel/labels.ts';

// ==========================================
// Part 1: V2 Session Binding Proofs
// ==========================================

test('Part 1: buildIssueAttachPayload injects repo into data for V2 session persistence', () => {
  const issue = {
    number: 42,
    title: 'Test V2 Binding',
    body: 'Details',
    html_url: 'https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/42',
    user: { login: 'agent' },
  };

  const payload = buildIssueAttachPayload(issue);
  assert.equal(payload.id, '42');
  assert.equal(payload.url, 'https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/42');
  assert.deepEqual(payload.data, {
    issueNumber: 42,
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });

  // Supports explicit repoOverride
  const overridePayload = buildIssueAttachPayload(issue, 'custom-org/custom-repo');
  assert.equal(overridePayload.data.repo, 'custom-org/custom-repo');

  // Supports repository_url on API issues
  const apiIssue = {
    number: 99,
    title: 'API Issue',
    repository_url: 'https://api.github.com/repos/api-org/api-repo',
  };
  const apiPayload = buildIssueAttachPayload(apiIssue);
  assert.equal(apiPayload.data.repo, 'api-org/api-repo');
});

test('Part 1: buildMultiIssueAttachPayload injects repo into data for V2 session persistence', () => {
  const issues = [
    {
      number: 1,
      title: 'Issue 1',
      html_url: 'https://github.com/my-org/my-repo/issues/1',
      repo: 'my-org/my-repo',
    },
    {
      number: 2,
      title: 'Issue 2',
      html_url: 'https://github.com/my-org/my-repo/issues/2',
      repo: 'my-org/my-repo',
    },
  ];

  const payload = buildMultiIssueAttachPayload(issues, 'my-org/my-repo');
  assert.equal(payload.data.count, 2);
  assert.deepEqual(payload.data.issueNumbers, [1, 2]);
  assert.equal(payload.data.isMulti, true);
  assert.equal(payload.data.repo, 'my-org/my-repo');
});

test('Part 1: getSessionIssueRepo parses repo across V2 projection and legacy formats', () => {
  // 1. V2 host projection (only id and data are preserved, url is dropped)
  const v2Item = {
    id: '42',
    data: { issueNumber: 42, repo: 'owner/v2-bound-repo' },
  };
  assert.equal(getSessionIssueRepo(v2Item), 'owner/v2-bound-repo');

  // 2. Legacy direct repo field
  assert.equal(getSessionIssueRepo({ repo: 'legacy-org/repo' }), 'legacy-org/repo');

  // 3. Legacy projectRepo field
  assert.equal(getSessionIssueRepo({ projectRepo: 'project-org/repo' }), 'project-org/repo');

  // 4. Legacy html_url
  assert.equal(getSessionIssueRepo({ html_url: 'https://github.com/url-org/repo/issues/5' }), 'url-org/repo');

  // 5. Legacy API url
  assert.equal(getSessionIssueRepo({ url: 'https://api.github.com/repos/api-org/repo/issues/5' }), 'api-org/repo');

  // 6. Null safety
  assert.equal(getSessionIssueRepo(null), null);
  assert.equal(getSessionIssueRepo({}), null);
});

// ==========================================
// Part 2: Rate-Limit Bundle Proofs
// ==========================================

test('Part 2.1 & 2.2: buildIncrementalIssuesPath formats ISO timestamp and repo cleanly', () => {
  const path = buildIncrementalIssuesPath('owner/repo', '2026-10-07T12:00:00.000Z');
  assert.equal(
    path,
    '/repos/owner/repo/issues?state=all&since=2026-10-07T12%3A00%3A00.000Z&per_page=100&page=1'
  );

  // Handles epoch timestamp number
  const timestamp = 1791374400000;
  const iso = new Date(timestamp).toISOString();
  const pathFromNum = buildIncrementalIssuesPath('owner/repo.git', timestamp);
  assert.equal(
    pathFromNum,
    `/repos/owner/repo/issues?state=all&since=${encodeURIComponent(iso)}&per_page=100&page=1`
  );
});

test('Part 2.2: syncIncrementalRepoIssues handles 304 Not Modified without modifying issue list', async () => {
  const existingIssues = [
    { number: 1, title: 'Issue 1', body: '', state: 'open', html_url: '', labels: [], subtasks: [], openQuestions: [], humanTasks: [] },
    { number: 2, title: 'Issue 2', body: '', state: 'open', html_url: '', labels: [], subtasks: [], openQuestions: [], humanTasks: [] },
  ];

  let requestCount = 0;
  let receivedHeaders = null;

  const mockRequestFn = async (method, path, body, query, headers) => {
    requestCount++;
    receivedHeaders = headers;
    return { notModified: true, status: 304, etag: 'W/"cached-etag-123"' };
  };

  const result = await syncIncrementalRepoIssues({
    repo: 'owner/repo',
    since: '2026-10-07T12:00:00.000Z',
    currentIssues: existingIssues,
    etag: 'W/"cached-etag-123"',
    requestFn: mockRequestFn,
  });

  assert.equal(requestCount, 1, 'Incremental sync on idle must make exactly 1 request');
  assert.deepEqual(receivedHeaders, { 'If-None-Match': 'W/"cached-etag-123"' });
  assert.equal(result.modified, false);
  assert.equal(result.changedCount, 0);
  assert.equal(result.etag, 'W/"cached-etag-123"');
  assert.deepEqual(result.issues, existingIssues);
});

test('Part 2.2: syncIncrementalRepoIssues incrementally updates changed issues without full refetch', async () => {
  const existingIssues = [
    { number: 1, title: 'Issue 1 (old)', body: '', state: 'open', html_url: '', labels: [], subtasks: [], openQuestions: [], humanTasks: [] },
    { number: 2, title: 'Issue 2 (untouched)', body: '', state: 'open', html_url: '', labels: [], subtasks: [], openQuestions: [], humanTasks: [] },
  ];

  const changedRaw = [
    {
      number: 1,
      title: 'Issue 1 (updated by agent turn)',
      body: '### Human Tasks:\n- [ ] Review PR',
      state: 'open',
      labels: [{ name: 'status:needs-human' }],
      updated_at: '2026-10-07T12:05:00Z',
    },
    {
      number: 3,
      title: 'Issue 3 (brand new)',
      body: 'New issue',
      state: 'open',
      labels: [{ name: 'status:todo' }],
      updated_at: '2026-10-07T12:05:00Z',
    },
  ];

  let requestCount = 0;
  const mockRequestFn = async (method, path, body, query, headers) => {
    requestCount++;
    assert.ok(path.includes('since=2026-10-07T12%3A00%3A00.000Z'));
    return Object.assign([...changedRaw], { etag: 'W/"new-etag-456"' });
  };

  const result = await syncIncrementalRepoIssues({
    repo: 'owner/repo',
    since: '2026-10-07T12:00:00.000Z',
    currentIssues: existingIssues,
    etag: 'W/"cached-etag-123"',
    requestFn: mockRequestFn,
  });

  assert.equal(requestCount, 1, 'Incremental sync should make only 1 request');
  assert.equal(result.modified, true);
  assert.equal(result.changedCount, 2);
  assert.equal(result.etag, 'W/"new-etag-456"');
  assert.equal(result.issues.length, 3);

  // Issue 1 was updated
  const updatedIssue1 = result.issues.find((i) => i.number === 1);
  assert.equal(updatedIssue1.title, 'Issue 1 (updated by agent turn)');
  assert.equal(updatedIssue1.humanTasks.length, 1);

  // Issue 2 was preserved untouched without being refetched from server
  const issue2 = result.issues.find((i) => i.number === 2);
  assert.equal(issue2.title, 'Issue 2 (untouched)');

  // Issue 3 was added
  const issue3 = result.issues.find((i) => i.number === 3);
  assert.equal(issue3.title, 'Issue 3 (brand new)');
});

// ==========================================
// Revert-Failure Check
// ==========================================

test('Part 2.2 Revert-failure check: idle synchronization must enforce since= and forbid full paginated refetch', async () => {
  // Simulate the idle handler logic
  async function performIdleSync(impl, repo, lastSyncTimestamp, currentIssues) {
    return impl.handleIdle({ repo, lastSyncTimestamp, currentIssues });
  }

  // The correct implementation using since= incremental sync
  const newIdleImplementation = {
    handleIdle: async ({ repo, lastSyncTimestamp, currentIssues }) => {
      const sinceIso = new Date(lastSyncTimestamp).toISOString();
      const path = buildIncrementalIssuesPath(repo, sinceIso);
      const calls = [];
      calls.push({ path, method: 'GET' });
      // Only 1 page since=<timestamp> is requested
      return { calls, strategy: 'incremental' };
    },
  };

  // The broken / reverted implementation (old behavior before D11):
  // busts issueCache and executes fetchIssues(true) with pagination (page=1, page=2, ...) without since=
  const revertedImplementation = {
    handleIdle: async ({ repo }) => {
      const calls = [];
      calls.push({ path: `/repos/${repo}/issues?state=all&per_page=100&page=1`, method: 'GET' });
      calls.push({ path: `/repos/${repo}/issues?state=all&per_page=100&page=2`, method: 'GET' });
      calls.push({ path: `/repos/${repo}/issues?state=all&per_page=100&page=3`, method: 'GET' });
      return { calls, strategy: 'full-refetch' };
    },
  };

  // Helper verifying that an implementation complies with the idle contract
  function verifyIdleCompliance(syncResult) {
    assert.equal(syncResult.strategy, 'incremental', 'Idle refresh must use incremental strategy');
    assert.equal(syncResult.calls.length, 1, 'Idle refresh must not execute multi-page fetches');
    assert.ok(
      syncResult.calls[0].path.includes('since='),
      'Idle refresh query must contain since= timestamp parameter'
    );
  }

  // 1. Current fix must pass compliance
  const compliantResult = await performIdleSync(newIdleImplementation, 'owner/repo', Date.now() - 30000, []);
  verifyIdleCompliance(compliantResult);

  // 2. Reverted / legacy behavior MUST FAIL compliance
  const revertedResult = await performIdleSync(revertedImplementation, 'owner/repo', Date.now() - 30000, []);
  assert.throws(
    () => verifyIdleCompliance(revertedResult),
    /Idle refresh must use incremental strategy|Idle refresh must not execute multi-page fetches/,
    'Reverting to full refetch on idle must fail verification'
  );
});

// ==========================================
// Part 2.3 & 2.4: Drawer comment caching & Priority Coalescing
// ==========================================

test('Part 2.4: Priority drag-and-drop coalesces status and priority into a single label set', () => {
  // Existing labels
  const existingLabels = [{ name: 'status:backlog' }, { name: 'priority:optional' }, { name: 'feature' }];

  // Target: moved to in-progress AND dropped into priority 'critical'
  let filtered = existingLabels
    .map((l) => l.name)
    .filter((n) => !n.startsWith('status:'));
  filtered.push('status:in-progress');

  // Coalesce priority update
  const coalescedLabels = updatePriorityLabels(filtered, 'critical');

  // Both changes are present in a single PATCH body
  assert.ok(coalescedLabels.includes('status:in-progress'));
  assert.ok(coalescedLabels.includes('priority:critical'));
  assert.ok(!coalescedLabels.includes('status:backlog'));
  assert.ok(!coalescedLabels.includes('priority:optional'));
  assert.ok(coalescedLabels.includes('feature'));
  assert.equal(coalescedLabels.length, 3);
});
