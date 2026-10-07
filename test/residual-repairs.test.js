import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGithubIssues, syncIncrementalRepoIssues } from '../panel/core.ts';
import { createTestApp, isJsonValue } from './test-app-harness.js';

// ==========================================
// Test D-01: normalizeGithubIssues JSON storage safety
// ==========================================
test('D-01 (REGRESSION): normalizeGithubIssues must never emit undefined property values and must pass SDK storage validation', () => {
  const rawGhostIssue = {
    number: 42,
    title: 'Ghost or synthetic issue without user',
    body: 'Some details',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/42',
    labels: [{ name: 'bug', color: undefined }],
    user: undefined,
    assignees: undefined,
  };

  const normalized = normalizeGithubIssues([rawGhostIssue]);
  assert.equal(normalized.length, 1);
  const issue = normalized[0];

  // Inspect all properties of the issue: none may be undefined
  for (const [key, value] of Object.entries(issue)) {
    assert.notEqual(
      value,
      undefined,
      `Property "${key}" on normalized issue must not be undefined`
    );
  }

  // Must pass SDK isJsonValue check
  assert.equal(
    isJsonValue(issue),
    true,
    'Normalized issue must satisfy SDK isJsonValue contract'
  );
});

// ==========================================
// Test D-02: repoForIssue sentinel in All Projects mode
// ==========================================
test('D-02 (REGRESSION): repoForIssue in All Projects mode returns empty string for unknown repos and blocks PATCH', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  app.setState({
    isAllProjectsMode: true,
    currentRepo: '__all_projects__',
  });

  const unknownRepoIssue = {
    number: 99,
    title: 'Unknown Repo Issue',
    state: 'open',
    labels: [],
  };

  const resolvedRepo = app.repoForIssue(unknownRepoIssue);
  assert.equal(
    resolvedRepo,
    '',
    'repoForIssue must return empty string for unknown repos in All Projects mode'
  );
  assert.notEqual(
    resolvedRepo,
    '__all_projects__',
    'repoForIssue must NEVER return __all_projects__ sentinel'
  );

  const fetchCalls = [];
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({}),
    };
  };

  await app.updateIssueStatus(unknownRepoIssue, 'in-progress');

  const patchSent = fetchCalls.some((c) =>
    c.url.includes('__all_projects__') || c.opts?.method === 'PATCH'
  );
  assert.equal(patchSent, false, 'No PATCH request may be sent when repo is unknown');
});

// ==========================================
// Test D-03: fetchIssues page 1 304 validation of page 2+
// ==========================================
test('D-03 (REGRESSION): fetchIssues validates and streams page 2 when page 1 returns 304 and in-memory issues exist', async () => {
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');

  // Pre-load 100 items from page 1 in memory
  const existingIssues = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    repo: 'owner/repo',
    state: 'open',
    labels: [],
    user: { login: 'author', avatar_url: '' },
  }));

  const state = app.getState();
  state.pageBodyCache.set('/repos/owner/repo/issues?state=all&per_page=100&page=1', {
    items: existingIssues,
    etag: 'W/"p1-etag"',
    timestamp: Date.now(),
  });

  app.setState({
    currentRepo: 'owner/repo',
    issues: existingIssues,
    activeStreamEpoch: 1,
  });

  const fetchUrls = [];
  global.fetch = async (url, opts) => {
    fetchUrls.push(url);
    if (/[?&]page=1(?:&|$)/.test(url)) {
      return {
        status: 304,
        ok: false,
        headers: new Headers({ etag: 'W/"p1-etag"' }),
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
            title: 'Issue #101 on Page 2',
            repo: 'owner/repo',
            state: 'open',
            labels: [],
            user: { login: 'author', avatar_url: '' },
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
  // Allow background streaming microtasks to settle
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Must request page 2 even though page 1 was 304
  const requestedPage2 = fetchUrls.some((u) => /[?&]page=2(?:&|$)/.test(u));
  assert.equal(
    requestedPage2,
    true,
    'Page 2 must be requested and verified when page 1 is 304'
  );

  // Check that issues contains issue 101 from page 2
  const finalState = app.getState();
  const hasPage2Item = finalState.issues.some((i) => i.number === 101);
  assert.equal(
    hasPage2Item,
    true,
    'Issues list must include page 2 item after streaming'
  );

  // Also verify fetchAllRepoIssuePages does not substitute aggregate cache on page 1 304
  const multiPageResult = await app.fetchAllRepoIssuePages('owner/repo', 2, false);
  assert.equal(
    multiPageResult.some((i) => i.number === 101),
    true,
    'fetchAllRepoIssuePages must validate page 2 and include page 2 items when page 1 is 304'
  );
});

// ==========================================
// Test D-04: syncIncrementalRepoIssues truncation flag and watermark guard
// ==========================================
test('D-04 (REGRESSION): syncIncrementalRepoIssues flags truncated=true when hitting 10-page cap and preserves watermark', async () => {
  // Generate 10 full pages of 100 items each = 1,000 items
  const requestedPages = [];
  const mockRequestFn = async (method, path) => {
    const pageNum = Number(/[?&]page=(\d+)/.exec(path)?.[1] || '1');
    requestedPages.push(pageNum);
    return Array.from({ length: 100 }, (_, i) => ({
      number: (pageNum - 1) * 100 + i + 1,
      title: `Issue ${(pageNum - 1) * 100 + i + 1}`,
      repo: 'owner/repo',
      state: 'open',
      updated_at: '2026-10-07T12:00:00Z',
    }));
  };

  const result = await syncIncrementalRepoIssues({
    repo: 'owner/repo',
    since: '2026-10-07T11:00:00Z',
    currentIssues: [],
    requestFn: mockRequestFn,
  });

  assert.equal(requestedPages.length, 10, 'Must request up to 10 pages');
  assert.equal(
    result.truncated,
    true,
    'syncIncrementalRepoIssues must set truncated: true when 10 full pages are fetched'
  );

  // Now test that syncRepoIncremental does NOT advance watermark when truncated
  const { app } = createTestApp();
  app.setWorkspaceGitToken('test_pat_token');
  const appState = app.getState();
  const initialWatermark = 1234567;
  appState.repoSyncWatermarks.set('owner/repo', initialWatermark);

  let p = 1;
  global.fetch = async () => {
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () =>
        Array.from({ length: 100 }, (_, i) => ({
          number: (p++) * 100 + i,
          title: 'Truncated item',
          repo: 'owner/repo',
          state: 'open',
        })),
    };
  };

  const targetWatermark = Date.now();
  await app.syncRepoIncremental('owner/repo', '2026-10-07T11:00:00Z', targetWatermark);

  const updatedWatermark = appState.repoSyncWatermarks.get('owner/repo');
  assert.equal(
    updatedWatermark,
    initialWatermark,
    'repoSyncWatermarks must NOT advance when incremental sync was truncated'
  );
});
