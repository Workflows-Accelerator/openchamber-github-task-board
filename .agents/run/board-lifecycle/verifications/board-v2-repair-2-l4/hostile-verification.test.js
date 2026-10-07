import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGithubIssues, syncIncrementalRepoIssues } from '../../../../../panel/core.ts';
import { createTestApp, isJsonValue } from '../../../../../test/test-app-harness.js';

// =========================================================================
// Test D-01: Storage JSON Validation & Undefined Property Exclusion
// =========================================================================
test('HOSTILE D-01: normalizeGithubIssues strips undefined properties and passes strict SDK storage validation', async () => {
  const edgeRawIssues = [
    {
      number: 101,
      title: 'Issue without author',
      body: 'Body',
      state: 'open',
      html_url: 'https://github.com/org/repo/issues/101',
      labels: [{ name: 'bug', color: undefined }],
      user: undefined,
      assignees: [{ login: 'dev1', avatar_url: undefined }],
    },
    {
      number: 102,
      title: 'Issue with null user and null assignees',
      body: null,
      state: null,
      html_url: null,
      labels: null,
      user: null,
      assignees: null,
      repo: undefined,
      projectId: undefined,
    },
  ];

  const normalized = normalizeGithubIssues(edgeRawIssues);
  assert.equal(normalized.length, 2);

  // Check every key recursively: NO undefined properties anywhere
  const assertNoUndefined = (obj, path = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${k}` : k;
      assert.notEqual(v, undefined, `Property "${fullPath}" must not be undefined`);
      if (v && typeof v === 'object') {
        assertNoUndefined(v, fullPath);
      }
    }
  };

  normalized.forEach((issue, idx) => {
    assertNoUndefined(issue, `issue[${idx}]`);
    assert.equal(isJsonValue(issue), true, `issue[${idx}] must satisfy SDK isJsonValue`);
  });

  // Verify storage persistence through real test harness
  const { app, mockStorage } = createTestApp();
  const state = app.getState();
  app.setState({
    currentRepo: 'org/repo',
    issues: normalized,
  });

  // Simulate persistent storage set
  const storagePayload = { timestamp: Date.now(), issues: normalized };
  assert.equal(isJsonValue(storagePayload), true, 'Storage payload must be valid JSON');

  mockStorage.set('cached_issues_org/repo', storagePayload);
  assert.equal(mockStorage.has('cached_issues_org/repo'), true);
});

// =========================================================================
// Test D-02: Prevent __all_projects__ Sentinel Attribution and Block Writes
// =========================================================================
test('HOSTILE D-02: repoForIssue returns empty string for unknown repos and blocks ALL write mutations', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  app.setState({
    isAllProjectsMode: true,
    currentRepo: '__all_projects__',
  });

  const unknownRepoIssue = {
    number: 50,
    title: 'Unknown Repo Issue',
    state: 'open',
    labels: [],
    body: 'Some body text',
  };

  const sentinelRepoIssue = {
    number: 51,
    title: 'Sentinel Repo Issue',
    state: 'open',
    labels: [],
    body: 'Some body text',
    repo: '__all_projects__',
  };

  const legitRepoIssue = {
    number: 52,
    title: 'Legit Repo Issue',
    state: 'open',
    labels: [],
    body: 'Some body text',
    repo: 'org/legit-repo',
  };

  // 1. Check repoForIssue resolution
  assert.equal(app.repoForIssue(unknownRepoIssue), '', 'Unknown repo must return empty string');
  assert.equal(app.repoForIssue(sentinelRepoIssue), '', 'Sentinel repo must return empty string');
  assert.equal(app.repoForIssue(legitRepoIssue), 'org/legit-repo', 'Legit repo must return repo name');

  // 2. Track all network calls: NO requests allowed for unknown repo
  const networkCalls = [];
  global.fetch = async (url, opts) => {
    networkCalls.push({ url, method: opts?.method || 'GET' });
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({}),
    };
  };

  // Test write path 1: updateIssueStatus
  await app.updateIssueStatus(unknownRepoIssue, 'in-progress');
  // Test write path 2: updateIssueBody
  await app.updateIssueBody(unknownRepoIssue, 'New body content');
  // Test write path 3: loadComments (read path that needs repo)
  await app.loadComments(unknownRepoIssue.number, 1, true);

  assert.equal(networkCalls.length, 0, 'No HTTP requests should be dispatched for unknown-repo issue');
  const sentinelDispatched = networkCalls.some((c) => c.url.includes('__all_projects__'));
  assert.equal(sentinelDispatched, false, 'No request may ever target __all_projects__');
});

// =========================================================================
// Test D-03: Page 1 304 Multi-Page Validation
// =========================================================================
test('HOSTILE D-03: Page 1 304 validates and streams page 2 when changes exist on later pages', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  // 100 items from page 1 in memory
  const page1Items = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    repo: 'org/multi-page-repo',
    state: 'open',
    user: { login: 'dev', avatar_url: '' },
    labels: [],
  }));

  const state = app.getState();
  state.pageBodyCache.set('/repos/org/multi-page-repo/issues?state=all&per_page=100&page=1', {
    items: page1Items,
    etag: 'W/"page1-etag"',
    timestamp: Date.now(),
  });

  app.setState({
    currentRepo: 'org/multi-page-repo',
    issues: page1Items,
    activeStreamEpoch: 1,
  });

  const fetchHistory = [];
  global.fetch = async (url, opts) => {
    fetchHistory.push({ url, opts });
    if (/[?&]page=1(?:&|$)/.test(url)) {
      return {
        status: 304,
        ok: false,
        headers: new Headers({ etag: 'W/"page1-etag"' }),
      };
    }
    if (/[?&]page=2(?:&|$)/.test(url)) {
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        json: async () => [
          {
            number: 101,
            title: 'Issue #101 newly created on page 2',
            repo: 'org/multi-page-repo',
            state: 'open',
            user: { login: 'dev', avatar_url: '' },
            labels: [],
          },
        ],
      };
    }
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => [],
    };
  };

  await app.fetchIssues(false);
  await new Promise((r) => setTimeout(r, 60));

  // Must have queried page 1 AND page 2
  const requestedPage1 = fetchHistory.some((c) => /[?&]page=1(?:&|$)/.test(c.url));
  const requestedPage2 = fetchHistory.some((c) => /[?&]page=2(?:&|$)/.test(c.url));
  assert.equal(requestedPage1, true, 'Page 1 must be queried');
  assert.equal(requestedPage2, true, 'Page 2 must be queried even when page 1 is 304');

  const finalIssues = app.getState().issues;
  const issue101Found = finalIssues.some((i) => i.number === 101);
  assert.equal(issue101Found, true, 'Page 2 issue #101 must be merged into state');
  assert.equal(finalIssues.length, 101, 'State must contain all 101 issues');
});

// =========================================================================
// Test D-04: Incremental Sync Truncation and Watermark Preservation
// =========================================================================
test('HOSTILE D-04: >1,000 incremental changes sets truncated=true and prevents watermark advance', async () => {
  // Test core syncIncrementalRepoIssues logic
  let pagesRequested = 0;
  const mockRequestFn = async (method, path) => {
    pagesRequested++;
    return Array.from({ length: 100 }, (_, i) => ({
      number: (pagesRequested - 1) * 100 + i + 1,
      title: `Changed issue ${i + 1}`,
      repo: 'org/busy-repo',
      state: 'open',
      updated_at: '2026-10-07T14:00:00Z',
    }));
  };

  const syncResult = await syncIncrementalRepoIssues({
    repo: 'org/busy-repo',
    since: '2026-10-07T12:00:00Z',
    currentIssues: [],
    requestFn: mockRequestFn,
  });

  assert.equal(pagesRequested, 10, 'Must stop at MAX_INCREMENTAL_PAGES = 10');
  assert.equal(syncResult.truncated, true, 'Result must be marked truncated: true');
  assert.equal(syncResult.issues.length, 1000, 'Must have gathered exactly 1,000 issues');

  // Test production syncRepoIncremental watermark preservation and ETag deletion
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');
  const appState = app.getState();
  const initialWatermark = 1700000000000;
  appState.repoSyncWatermarks.set('org/busy-repo', initialWatermark);
  appState.repoIncrementalEtagCache.set('org/busy-repo', 'W/"old-etag"');

  let p = 1;
  global.fetch = async () => {
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () =>
        Array.from({ length: 100 }, (_, i) => ({
          number: p * 100 + i,
          title: `Busy item ${i}`,
          repo: 'org/busy-repo',
          state: 'open',
        })),
    };
  };

  const newWatermarkAttempt = initialWatermark + 60000;
  await app.syncRepoIncremental('org/busy-repo', '2026-10-07T12:00:00Z', newWatermarkAttempt);

  const finalWatermark = appState.repoSyncWatermarks.get('org/busy-repo');
  assert.equal(
    finalWatermark,
    initialWatermark,
    'Watermark must NOT advance when incremental sync was truncated'
  );

  const etagCleared = !appState.repoIncrementalEtagCache.has('org/busy-repo');
  assert.equal(etagCleared, true, 'ETag cache must be cleared on truncation to avoid false 304');
});
