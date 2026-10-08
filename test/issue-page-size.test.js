import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchIssuePage,
  FULL_ISSUE_PAGE_SIZE,
  SMALL_ISSUE_PAGE_SIZE,
  MAX_ISSUES_PER_REPO,
  isOversizedAnswer,
  buildIncrementalIssuesPath,
  syncIncrementalRepoIssues,
} from '../panel/core.ts';

const issues = (count) => Array.from({ length: count }, (_, i) => ({ number: i + 1 }));
const perPage = (path) => Number(new URL(path, 'https://api.github.com').searchParams.get('per_page'));

// A host that cuts a large answer off hands back text that fails JSON.parse.
const truncatingHost = (limit) => async (_method, path) => {
  const size = perPage(path);
  if (size > limit) JSON.parse('[{"body":"cut off');
  return issues(size);
};

// ---------------------------------------------------------------------------
// Ported PR #25 Core Tests
// ---------------------------------------------------------------------------

test('reads the full page size when the host carries it', async () => {
  const sizes = new Map();
  const seen = [];
  const page = await fetchIssuePage('o/r', 1, async (_m, path) => { seen.push(path); return issues(3); }, sizes);
  assert.equal(page.pageSize, FULL_ISSUE_PAGE_SIZE);
  assert.equal(page.items.length, 3);
  assert.deepEqual(seen, ['/repos/o/r/issues?state=all&per_page=100&page=1']);
  assert.equal(sizes.has('o/r'), false);
});

test('a cut-off first page switches that repo to small pages and keeps them', async () => {
  const sizes = new Map();
  const shrunk = [];
  const request = truncatingHost(SMALL_ISSUE_PAGE_SIZE);
  const first = await fetchIssuePage('o/r', 1, request, sizes, (size) => shrunk.push(size));
  assert.equal(first.pageSize, SMALL_ISSUE_PAGE_SIZE);
  assert.equal(first.items.length, SMALL_ISSUE_PAGE_SIZE);
  assert.deepEqual(shrunk, [SMALL_ISSUE_PAGE_SIZE]);

  const second = await fetchIssuePage('o/r', 2, request, sizes);
  assert.equal(second.pageSize, SMALL_ISSUE_PAGE_SIZE);

  const other = await fetchIssuePage('o/other', 1, async () => issues(1), sizes);
  assert.equal(other.pageSize, FULL_ISSUE_PAGE_SIZE);
});

test('a host that refuses an oversized answer by code is handled the same way', async () => {
  const sizes = new Map();
  const request = async (_m, path) => {
    if (perPage(path) > SMALL_ISSUE_PAGE_SIZE) throw Object.assign(new Error('too large'), { code: 'RESPONSE_TOO_LARGE' });
    return issues(1);
  };
  const page = await fetchIssuePage('o/r', 1, request, sizes);
  assert.equal(page.pageSize, SMALL_ISSUE_PAGE_SIZE);
});

test('other failures, and oversized later pages, are not retried', async () => {
  const sizes = new Map();
  let calls = 0;
  const failing = async () => { calls++; throw new Error('GitHub API error: 500'); };
  await assert.rejects(fetchIssuePage('o/r', 1, failing, sizes), /500/);
  assert.equal(calls, 1);

  await assert.rejects(fetchIssuePage('o/r', 2, truncatingHost(SMALL_ISSUE_PAGE_SIZE), sizes), SyntaxError);
  assert.equal(sizes.has('o/r'), false);
});

// ---------------------------------------------------------------------------
// Covered Fetch Path Tests
// ---------------------------------------------------------------------------

test('isOversizedAnswer correctly classifies SyntaxError and RESPONSE_TOO_LARGE', () => {
  assert.equal(isOversizedAnswer(new SyntaxError('Unexpected token in JSON at position 256000')), true);
  assert.equal(isOversizedAnswer({ code: 'RESPONSE_TOO_LARGE' }), true);
  assert.equal(isOversizedAnswer(new Error('Not Found')), false);
  assert.equal(isOversizedAnswer({ status: 500 }), false);
  assert.equal(isOversizedAnswer(null), false);
  assert.equal(isOversizedAnswer(undefined), false);
});

test('Path 5: syncIncrementalRepoIssues falls back to pages of 20 when page 1 is oversized', async () => {
  const requestedPaths = [];
  const mockRequestFn = async (_method, path) => {
    requestedPaths.push(path);
    const size = perPage(path);
    if (size > 20) {
      throw new SyntaxError('Unterminated string in JSON at position 256000');
    }
    return [
      { number: 1, title: 'Updated 1', state: 'open', updated_at: '2026-10-08T12:00:00Z' },
      { number: 2, title: 'Updated 2', state: 'open', updated_at: '2026-10-08T12:00:00Z' },
    ];
  };

  const pageSizes = new Map();
  let shrunkSize = 0;

  const result = await syncIncrementalRepoIssues({
    repo: 'owner/busy-repo',
    since: '2026-10-08T10:00:00Z',
    currentIssues: [],
    pageSizes,
    onShrink: (size) => { shrunkSize = size; },
    requestFn: mockRequestFn,
  });

  assert.equal(shrunkSize, 20);
  assert.equal(pageSizes.get('owner/busy-repo'), 20);
  assert.equal(result.modified, true);
  assert.equal(result.changedCount, 2);
  assert.equal(requestedPaths.length, 2);
  assert.match(requestedPaths[0], /per_page=100/);
  assert.match(requestedPaths[1], /per_page=20/);
});

test('Path 5: syncIncrementalRepoIssues caps at 50 pages (1,000 issues) when page size is 20', async () => {
  const requestedPages = [];
  const mockRequestFn = async (_method, path) => {
    const pageNum = Number(/[?&]page=(\d+)/.exec(path)?.[1] || '1');
    requestedPages.push(pageNum);
    return Array.from({ length: 20 }, (_, i) => ({
      number: (pageNum - 1) * 20 + i + 1,
      title: `Issue ${(pageNum - 1) * 20 + i + 1}`,
      repo: 'owner/huge-repo',
      state: 'open',
      updated_at: '2026-10-08T12:00:00Z',
    }));
  };

  const pageSizes = new Map([['owner/huge-repo', 20]]);
  const result = await syncIncrementalRepoIssues({
    repo: 'owner/huge-repo',
    since: '2026-10-08T10:00:00Z',
    currentIssues: [],
    pageSizes,
    requestFn: mockRequestFn,
  });

  assert.equal(requestedPages.length, 50, 'Must request exactly 50 pages for 1,000 issue cap at per_page=20');
  assert.equal(result.truncated, true, 'Must flag truncated: true when hitting 50 pages');
  assert.equal(result.issues.length, 1000);
});

// ---------------------------------------------------------------------------
// Call-Site Integration Tests (Paths 1, 2, 3, 4)
// ---------------------------------------------------------------------------

import { createTestApp } from './test-app-harness.js';

test('Path 1 & Path 2: fetchIssues falls back to per_page=20 on oversized page 1 and streams subsequent pages at 20', async () => {
  const requestedUrls = [];
  const { app } = createTestApp({
    onRequest: (req) => {
      if (req?.path && req.path.includes('/issues')) {
        requestedUrls.push(req.path);
      }
      const url = new URL(req.path || '/', 'https://api.github.com');
      const perPageVal = Number(url.searchParams.get('per_page'));
      const pageVal = Number(url.searchParams.get('page'));
      if (perPageVal > 20) {
        return { status: 200, body: '[{"number":1,"title":"cut off' };
      }
      if (pageVal === 1) {
        const items = Array.from({ length: 20 }, (_, i) => ({
          number: i + 1,
          title: `Issue #${i + 1}`,
          state: 'open',
          repo: 'owner/oversized-repo',
          labels: [],
          user: { login: 'author', avatar_url: '' },
        }));
        return { status: 200, body: JSON.stringify(items) };
      }
      if (pageVal === 2) {
        const items = Array.from({ length: 5 }, (_, i) => ({
          number: 20 + i + 1,
          title: `Issue #${20 + i + 1}`,
          state: 'open',
          repo: 'owner/oversized-repo',
          labels: [],
          user: { login: 'author', avatar_url: '' },
        }));
        return { status: 200, body: JSON.stringify(items) };
      }
      return { status: 200, body: '[]' };
    },
  });

  app.setState({
    currentRepo: 'owner/oversized-repo',
    activeStreamEpoch: 1,
  });

  await app.fetchIssues(false);
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(requestedUrls.length >= 3, 'Must have at least 3 requests');
  assert.match(requestedUrls[0], /per_page=100&page=1/);
  assert.match(requestedUrls[1], /per_page=20&page=1/);
  assert.match(requestedUrls[2], /per_page=20&page=2/);

  const state = app.getState();
  assert.equal(state.issues.length, 25);
});

test('Path 3 & Path 4: fetchAllRepoIssuePages falls back to per_page=20 on oversized page 1 and streams remaining pages at 20', async () => {
  const requestedUrls = [];
  const { app } = createTestApp({
    onRequest: (req) => {
      if (req?.path && req.path.includes('/issues')) {
        requestedUrls.push(req.path);
      }
      const url = new URL(req.path || '/', 'https://api.github.com');
      const perPageVal = Number(url.searchParams.get('per_page'));
      const pageVal = Number(url.searchParams.get('page'));
      if (perPageVal > 20) {
        return { status: 200, body: '[{"number":1,"title":"cut off' };
      }
      if (pageVal === 1) {
        const items = Array.from({ length: 20 }, (_, i) => ({
          number: i + 1,
          title: `Issue #${i + 1}`,
          state: 'open',
          repo: 'owner/all-repo',
          labels: [],
          user: { login: 'author', avatar_url: '' },
        }));
        return { status: 200, body: JSON.stringify(items) };
      }
      if (pageVal === 2) {
        const items = Array.from({ length: 3 }, (_, i) => ({
          number: 20 + i + 1,
          title: `Issue #${20 + i + 1}`,
          state: 'open',
          repo: 'owner/all-repo',
          labels: [],
          user: { login: 'author', avatar_url: '' },
        }));
        return { status: 200, body: JSON.stringify(items) };
      }
      return { status: 200, body: '[]' };
    },
  });

  app.setState({
    activeStreamEpoch: 1,
  });

  const issues = await app.fetchAllRepoIssuePages('owner/all-repo', 1, false);

  assert.ok(requestedUrls.length >= 3, 'Must have at least 3 requests');
  assert.match(requestedUrls[0], /per_page=100&page=1/);
  assert.match(requestedUrls[1], /per_page=20&page=1/);
  assert.match(requestedUrls[2], /per_page=20&page=2/);
  assert.equal(issues.length, 23);
});

test('Path 2: streamRemainingPages does not retry when a later page (page 2) fails or is oversized', async () => {
  let page2Calls = 0;
  const { app } = createTestApp({
    onRequest: (req) => {
      const url = new URL(req.path, 'https://api.github.com');
      const pageVal = Number(url.searchParams.get('page'));
      if (pageVal === 2) {
        page2Calls++;
        return { status: 200, body: '[{"number":21,"title":"cut off' };
      }
      return { status: 200, body: '[]' };
    },
  });

  app.setState({
    currentRepo: 'owner/repo-page2-oversized',
    activeStreamEpoch: 1,
    issues: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, title: `Issue ${i + 1}`, repo: 'owner/repo-page2-oversized', state: 'open', labels: [] })),
  });

  // Call streamRemainingPages directly starting from page 2
  await app.streamRemainingPages('owner/repo-page2-oversized', 'storage_key', 2, 1, false);

  // Page 2 should be attempted once and NOT retried
  assert.equal(page2Calls, 1);
  const state = app.getState();
  assert.equal(state.issues.length, 20);
});

test('multi-repo isolation: repo A oversized shrinking to 20 leaves repo B at 100', async () => {
  const pageSizes = new Map();
  const request = async (_m, path) => {
    if (path.includes('/repos/repo-a/') && perPage(path) > 20) {
      throw new SyntaxError('Unterminated string in JSON at position 256000');
    }
    return issues(perPage(path));
  };

  const pageA = await fetchIssuePage('repo-a', 1, request, pageSizes);
  assert.equal(pageA.pageSize, 20);
  assert.equal(pageSizes.get('repo-a'), 20);

  const pageB = await fetchIssuePage('repo-b', 1, request, pageSizes);
  assert.equal(pageB.pageSize, 100);
  assert.equal(pageSizes.has('repo-b'), false);
});

test('boundary conditions: 0 issues, exactly 20 issues, and 21 issues with SMALL_ISSUE_PAGE_SIZE', async () => {
  const pageSizes = new Map([['owner/boundary', 20]]);

  // 0 issues
  const res0 = await fetchIssuePage('owner/boundary', 1, async () => [], pageSizes);
  assert.equal(res0.items.length, 0);

  // Exactly 20 issues
  const res20 = await fetchIssuePage('owner/boundary', 1, async () => issues(20), pageSizes);
  assert.equal(res20.items.length, 20);

  // Page 2 with 1 issue (making 21 total)
  const res21 = await fetchIssuePage('owner/boundary', 2, async () => issues(1), pageSizes);
  assert.equal(res21.items.length, 1);
});

test('non-truncation SyntaxError on page 1 retries once at 20 and then throws if still failing', async () => {
  const sizes = new Map();
  let attempts = 0;
  const syntaxErrorHost = async () => {
    attempts++;
    throw new SyntaxError('Unexpected token < in JSON at position 0');
  };
  await assert.rejects(fetchIssuePage('owner/syntax-err', 1, syntaxErrorHost, sizes), SyntaxError);
  assert.equal(attempts, 2, 'Must attempt at 100 and then once at 20 before throwing');
  assert.equal(sizes.get('owner/syntax-err'), 20);
});




