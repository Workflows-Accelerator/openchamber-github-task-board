import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGithubIssues,
  mergeIssuePages,
} from '../../../../../panel/core.ts';

test('Hostile Proof 3a: streamRemainingPages drops page 2+ when receiving 304 because it lacks a response body cache', async () => {
  // Simulate streamRemainingPages logic from panel/main.ts lines 1201-1240
  async function simulateStreamRemainingPages(repo, startPage, cachedPages, networkResponses) {
    let page = startPage;
    let localIssues = [...cachedPages[1]]; // Page 1 issues loaded
    const MAX_PAGES = 10;

    while (page <= MAX_PAGES) {
      const pagePath = `/repos/${repo}/issues?state=all&per_page=100&page=${page}`;
      const nextRaw = networkResponses[page];
      if (!nextRaw) break;

      // Current logic in main.ts lines 1218-1224:
      if (nextRaw && (nextRaw.notModified || nextRaw.status === 304)) {
        page++;
        continue; // Bug: page 2 issues are completely dropped from localIssues!
      }

      const nextItems = Array.isArray(nextRaw) ? nextRaw : (nextRaw?.items || []);
      if (nextItems.length === 0) break;

      const nextIssues = normalizeGithubIssues(nextItems);
      localIssues = mergeIssuePages(localIssues, nextIssues);
      page++;
    }

    return localIssues;
  }

  const page1Issues = Array.from({ length: 100 }, (_, i) => ({
    number: i + 1,
    title: `Issue #${i + 1}`,
    body: '',
    state: 'open',
  }));

  // Suppose page 2 had 50 issues previously
  const networkResponses = {
    2: { notModified: true, status: 304, etag: 'W/"page2-etag"' },
  };

  const finalIssues = await simulateStreamRemainingPages(
    'owner/repo',
    2,
    { 1: page1Issues },
    networkResponses
  );

  // Assert that finalIssues contains only 100 items instead of 150 items
  assert.equal(finalIssues.length, 100, 'Bug confirmed: Page 2 issues were dropped on 304');
});

test('Hostile Proof 3b: fetchIssues with 304 and empty in-memory issues renders empty board', () => {
  // Simulate fetchIssues logic from panel/main.ts lines 1305-1335
  function simulateFetchIssuesPage1_304(page1Raw, inMemoryIssues) {
    let currentIssues = [...inMemoryIssues];

    if (page1Raw && (page1Raw.notModified || page1Raw.status === 304)) {
      if (currentIssues.length > 0) {
        return { renderedIssues: currentIssues, earlyReturn: true };
      }
    }

    // Falls through to line 1321
    const page1Items = Array.isArray(page1Raw) ? page1Raw : (page1Raw?.items || []);
    const page1Issues = normalizeGithubIssues(page1Items);
    currentIssues = page1Issues;
    return { renderedIssues: currentIssues, earlyReturn: false };
  }

  // Case: User opens board, in-memory issues is empty, but ETag cache had an entry
  const result = simulateFetchIssuesPage1_304(
    { notModified: true, status: 304, etag: 'W/"page1"' },
    [] // in-memory issues empty
  );

  assert.equal(result.earlyReturn, false);
  assert.deepEqual(result.renderedIssues, [], 'Empty array returned and rendered to user on 304 when issues is initially empty');
});
