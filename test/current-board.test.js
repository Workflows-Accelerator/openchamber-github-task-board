import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from './test-app-harness.js';

const pause = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return;
    await pause(10);
  }
  assert.fail('Timed out waiting for recorded board state');
}
const issue = (number, repo = 'owner/a') => ({ number, title: `Task ${number}`, body: '', state: 'open', labels: [], html_url: `https://github.com/${repo}/issues/${number}` });
const response = (items, status = 200) => ({ status, body: JSON.stringify(items) });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
async function setup(read, options = {}) {
  const requests = [];
  const harness = createTestApp({ ...options, onRequest: async (payload) => {
    if (payload.path?.includes('/issues?')) {
      requests.push(payload);
      assert.equal(payload.method, 'GET', 'refresh must be read-only');
      return read(payload);
    }
    return {};
  } });
  await pause();
  harness.app.setState({ currentRepo: 'owner/a' });
  return { ...harness, requests };
}
function assertNoWrites(hostCalls) {
  assert.deepEqual(hostCalls.filter((call) => call.payload?.method && call.payload.method !== 'GET'), []);
}

test('current board: successful empty refresh clears retained membership', async () => {
  let items = [issue(1)];
  const { app, hostCalls } = await setup(() => response(items));
  await app.fetchIssues(true);
  assert.equal(app.getState().issues.length, 1);
  items = [];
  await app.fetchIssues(true);
  assert.equal(app.getState().issues.length, 0);
  await pause(350);
  assertNoWrites(hostCalls);
});

test('current board: settings-ready same repository fetches and warm visibility revalidates once', async () => {
  const { app, mockDoc, requests } = await setup(() => response([issue(1)]), { settings: { repo: 'owner/a' } });
  await waitFor(() => app.getState().issues.length === 1);
  assert.equal(requests.length, 1, 'settings startup must request current issues');
  assert.equal(app.getState().issues.length, 1);
  mockDoc.hidden = true;
  mockDoc.dispatchEvent({ type: 'visibilitychange' });
  mockDoc.hidden = false;
  mockDoc.dispatchEvent({ type: 'visibilitychange' });
  mockDoc.dispatchEvent({ type: 'visibilitychange' });
  await pause();
  assert.equal(requests.length, 2, 'one revalidation per actual hidden-to-visible transition');
});

test('current board: slow A response cannot publish into B or caches/watermarks', async () => {
  const slow = deferred();
  const { app, mockStorage } = await setup((payload) => payload.path.includes('/owner/a/') ? slow.promise : response([issue(2, 'owner/b')]));
  const pending = app.fetchIssues(true);
  await pause();
  app.setRepository('owner/b', 'test');
  await pause();
  slow.resolve(response([issue(1)]));
  await pending;
  assert.equal(app.getState().currentRepo, 'owner/b');
  assert.deepEqual(app.getState().issues.map((item) => item.number), [2]);
  assert.equal(app.getState().repoSyncWatermarks.has('owner/a'), false);
  assert.equal([...app.getState().pageBodyCache.keys()].some((key) => key.includes('/owner/a/')), false);
  assert.equal(mockStorage.has('cached_issues_owner/a'), false);
  assert.deepEqual(mockStorage.get('cached_issues_owner/b').issues.map((item) => item.number), [2]);
});

test('current board: overlapping refresh admits newest snapshot only', async () => {
  const slow = deferred();
  let calls = 0;
  const { app } = await setup(() => ++calls === 1 ? slow.promise : response([issue(2)]));
  const old = app.fetchIssues(true);
  await pause();
  await app.fetchIssues(true);
  const watermark = app.getState().repoSyncWatermarks.get('owner/a');
  slow.resolve(response([issue(1)]));
  await old;
  assert.deepEqual(app.getState().issues.map((item) => item.number), [2]);
  assert.equal(app.getState().repoSyncWatermarks.get('owner/a'), watermark);
});

test('current board: streamed membership remains provisional until complete; page-two failure preserves last success', async () => {
  let mode = 'initial';
  let pageTwo = deferred();
  const firstPage = Array.from({ length: 100 }, (_, index) => issue(index + 1));
  const { app, elements, mockStorage } = await setup((payload) => {
    if (mode === 'initial') return response([issue(900)]);
    if (payload.path.endsWith('page=1')) return response(firstPage);
    return pageTwo.promise;
  });
  await app.fetchIssues(true);
  const success = app.getState().lastSyncTimestamp;
  mode = 'refresh';
  const pending = app.fetchIssues(true);
  await pause();
  assert.ok(app.getState().issues.some((item) => item.number === 900), 'unseen members remain until completion');
  assert.match(elements.get('boardFreshness').textContent, /partial|refreshing/i);
  pageTwo.resolve(response({}, 500));
  await pending;
  await pause();
  assert.ok(app.getState().issues.some((item) => item.number === 900));
  assert.equal(app.getState().lastSyncTimestamp, success);
  assert.match(elements.get('boardFreshness').textContent, /stale|partial/i);
  assert.deepEqual(mockStorage.get('cached_issues_owner/a').issues.map((item) => item.number), [900]);
  pageTwo = deferred();
  const completed = app.fetchIssues(true);
  await pause();
  pageTwo.resolve(response([issue(101)]));
  await completed;
  await pause();
  assert.equal(app.getState().issues.length, 101);
  assert.equal(app.getState().issues.some((item) => item.number === 900), false);
  assert.match(elements.get('boardFreshness').textContent, /last full sync/i);
});

test('current board: warm cache still requests current data; cached empty 304 is authoritative', async () => {
  let calls = 0;
  const { app } = await setup(() => response([]));
  app.setWorkspaceGitToken('synthetic-test-token');
  const requests = [];
  const previousFetch = global.fetch;
  global.fetch = async (_url, options) => {
    requests.push(options);
    return ++calls === 1
      ? { ok: true, status: 200, headers: new Headers({ etag: 'empty' }), json: async () => [] }
      : { ok: false, status: 304, headers: new Headers() };
  };
  try {
    await app.fetchIssues();
    await app.fetchIssues();
  } finally {
    global.fetch = previousFetch;
  }
  assert.equal(requests.length, 2);
  assert.equal(requests[1].headers?.['If-None-Match'], 'empty');
  assert.deepEqual(app.getState().issues, []);
});

test('current board: superseded incremental response cannot advance watermarks', async () => {
  const slow = deferred();
  const { app } = await setup(() => slow.promise);
  const pending = app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', 12345);
  await pause();
  app.setState({ currentRepo: 'owner/b', activeStreamEpoch: app.getState().activeStreamEpoch + 1 });
  slow.resolve(response([issue(1)]));
  await pending;
  assert.equal(app.getState().repoSyncWatermarks.has('owner/a'), false);
});

test('current board: failed first-page refresh preserves data and last full success', async () => {
  let fail = false;
  const { app, elements } = await setup(() => response(fail ? {} : [issue(1)], fail ? 500 : 200));
  await app.fetchIssues(true);
  const timestamp = app.getState().lastSyncTimestamp;
  fail = true;
  await app.fetchIssues(true);
  assert.equal(app.getState().issues.length, 1);
  assert.equal(app.getState().lastSyncTimestamp, timestamp);
  assert.match(elements.get('boardFreshness').textContent, /stale/i);
});

test('current board: failed idle sync cannot report a new full-refresh success', async () => {
  const { app } = await setup(() => response({}, 500));
  const before = app.getState().lastSyncTimestamp;
  await app.handleIdleRefresh([{ id: 'idle-test', activity: 'idle' }], []);
  assert.equal(app.getState().lastSyncTimestamp, before);
});
