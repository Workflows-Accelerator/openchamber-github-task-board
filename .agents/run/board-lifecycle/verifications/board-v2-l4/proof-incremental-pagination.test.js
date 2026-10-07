import test from 'node:test';
import assert from 'node:assert/strict';
import {
  syncIncrementalRepoIssues,
  buildIncrementalIssuesPath,
} from '../../../../../panel/core.ts';

test('Hostile Proof 1: syncIncrementalRepoIssues drops issues when changes exceed 100 items (>1 page)', async () => {
  const existingIssues = [];

  // Simulate 150 changed issues returned by GitHub across 2 pages
  const page1Items = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    body: 'Updated body',
    state: 'open',
    updated_at: '2026-10-07T12:05:00Z',
  }));

  const requestedUrls = [];
  const mockRequestFn = async (method, path, body, query, headers) => {
    requestedUrls.push(path);
    // Page 1 returns 100 items
    return page1Items;
  };

  const result = await syncIncrementalRepoIssues({
    repo: 'owner/test-repo',
    since: '2026-10-07T12:00:00Z',
    currentIssues: existingIssues,
    requestFn: mockRequestFn,
  });

  // Verify that only page 1 was requested
  assert.equal(requestedUrls.length, 1, 'Bug confirmed: only 1 page was requested');
  assert.ok(requestedUrls[0].includes('page=1'), 'Only page=1 was fetched');
  assert.equal(result.issues.length, 100, 'Issues on page 2 (items 101-150) were completely dropped');
});
