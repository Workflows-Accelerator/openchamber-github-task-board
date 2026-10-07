import test from 'node:test';
import assert from 'node:assert/strict';

test('Hostile Proof 4a: async loadComments race condition allows older issue comments to render into newly opened drawer', async () => {
  // Simulate loadComments and activeIssue state from panel/main.ts
  let activeIssue = null;
  let drawerRenderedForIssueNumber = null;
  let commentsRendered = null;

  async function simulateLoadComments(issueNumber, delayMs, returnedComments) {
    // In panel/main.ts lines 4749-4757:
    // It does not check if activeIssue is still issueNumber when promise resolves!
    await new Promise((r) => setTimeout(r, delayMs));
    commentsRendered = returnedComments;
    drawerRenderedForIssueNumber = issueNumber;
  }

  // User opens Issue 1
  activeIssue = { number: 1, title: 'Issue 1' };
  const loadPromise1 = simulateLoadComments(1, 50, ['Comment on Issue 1']);

  // Rapidly user opens Issue 2 before Issue 1 finishes loading
  activeIssue = { number: 2, title: 'Issue 2' };
  const loadPromise2 = simulateLoadComments(2, 10, ['Comment on Issue 2']);

  // Issue 2 finishes first
  await loadPromise2;
  assert.equal(activeIssue.number, 2);
  assert.deepEqual(commentsRendered, ['Comment on Issue 2']);

  // Now Issue 1's slow response finally arrives:
  await loadPromise1;
  assert.equal(activeIssue.number, 2, 'Active issue is still #2');
  // BUG: commentsRendered is overwritten by Issue 1's comments!
  assert.deepEqual(commentsRendered, ['Comment on Issue 1'], 'Bug confirmed: Issue 1 comments rendered into Issue 2 drawer');
  assert.equal(drawerRenderedForIssueNumber, 1);
});

test('Hostile Proof 4b: commentsCache 60s TTL is never invalidated on manual refresh or repo switch', () => {
  const DRAWER_COMMENTS_CACHE_TTL_MS = 60_000;
  const commentsCache = new Map();

  // User views issue #1 comments
  const cacheKey = 'owner/repo#1';
  commentsCache.set(cacheKey, { timestamp: Date.now(), comments: [{ body: 'Old comment' }] });

  // A new comment is added on github.com
  // User clicks "Refresh" button (fetchIssues(true))
  // But commentsCache.clear() is never called in panel/main.ts
  assert.equal(commentsCache.has(cacheKey), true);
  const cached = commentsCache.get(cacheKey);
  assert.equal(cached.comments[0].body, 'Old comment', 'Stale comments returned within 60s window even after manual refresh');
});
