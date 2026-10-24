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
const issue = (number, repo = 'owner/a', body = '') => ({ number, title: `Task ${number}`, body, state: 'open', labels: [], html_url: `https://github.com/${repo}/issues/${number}` });
const response = (items, status = 200) => ({ status, body: JSON.stringify(items) });
const pageNumberOf = (path) => Number(/[?&]page=(\d+)/.exec(path || '')?.[1] || 1);
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
async function setup(read, options = {}) {
  const requests = [];
  const harness = createTestApp({ ...options, onRequest: async (payload) => {
    if (payload.method && payload.method !== 'GET') {
      return options.mutate ? options.mutate(payload) : { status: 200, body: '{}' };
    }
    if (payload.path?.includes('/issues?')) {
      requests.push(payload);
      assert.equal(payload.method, 'GET', 'refresh must be read-only');
      return read(payload);
    }
    return { status: 200, body: '{}' };
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

test('current board: successful body edit survives an older full response (R1 regression)', async () => {
  const slow = deferred();
  let full = 0;
  const { app, mockStorage, hostCalls } = await setup(
    () => (++full === 1 ? response([issue(1, 'owner/a', 'old body')]) : slow.promise),
    { mutate: () => ({ status: 200, body: JSON.stringify({ updated_at: '2026-10-23T12:00:00Z' }) }) }
  );
  await app.fetchIssues(true);
  const pending = app.fetchIssues(true);
  await pause();
  await app.updateIssueBody(app.getState().issues[0], 'new saved body');
  assert.equal(app.getState().issues[0].body, 'new saved body');
  slow.resolve(response([issue(1, 'owner/a', 'old body')]));
  await pending;
  await pause();
  assert.equal(app.getState().issues[0].body, 'new saved body', 'older full response must not undo an accepted body edit');
  assert.equal(mockStorage.get('cached_issues_owner/a').issues[0].body, 'new saved body', 'persistent cache must keep the accepted edit');
  assert.equal(hostCalls.filter((call) => call.payload?.method === 'PATCH').length, 1);
});

test('current board: successful status edit survives an older full response (R1 regression)', async () => {
  const slow = deferred();
  let full = 0;
  const { app, mockStorage } = await setup(
    () => (++full === 1 ? response([issue(1, 'owner/a', 'old body')]) : slow.promise),
    { mutate: () => ({ status: 200, body: '{}' }) }
  );
  await app.fetchIssues(true);
  const pending = app.fetchIssues(true);
  await pause();
  await app.updateIssueStatus(app.getState().issues[0], 'done', { isHumanGesture: true });
  assert.equal(app.getState().issues[0].state, 'closed');
  slow.resolve(response([issue(1, 'owner/a', 'old body')]));
  await pending;
  await pause();
  const shown = app.getState().issues[0];
  assert.equal(shown.state, 'closed', 'older full response must not undo an accepted status edit');
  assert.deepEqual(shown.labels.map((label) => label.name), ['status:done']);
  const cached = mockStorage.get('cached_issues_owner/a').issues[0];
  assert.equal(cached.state, 'closed');
  assert.deepEqual(cached.labels.map((label) => label.name), ['status:done']);
});

test('current board: newer incremental fields survive an older full snapshot without regressing the watermark (R2 regression)', async () => {
  const pageTwo = deferred();
  let mode = 'initial';
  const { app, mockStorage } = await setup((payload) => {
    if (payload.path.includes('since=')) return response([issue(1, 'owner/a', 'incremental new')]);
    if (mode === 'initial') return response([issue(1, 'owner/a', 'old body')]);
    if (payload.path.endsWith('page=1')) return response(Array.from({ length: 100 }, (_, index) => issue(index + 1, 'owner/a', 'old body')));
    return pageTwo.promise;
  });
  await app.fetchIssues(true);
  mode = 'refresh';
  const pending = app.fetchIssues(true);
  await pause();
  const incrementalWatermark = Date.now() + 60_000;
  await app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', incrementalWatermark);
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'incremental new');
  pageTwo.resolve(response([]));
  await pending;
  await pause();
  assert.equal(app.getState().issues.length, 100, 'completed pagination remains authoritative for membership');
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'incremental new', 'older full snapshot must not undo newer incremental fields');
  assert.equal(mockStorage.get('cached_issues_owner/a').issues.find((item) => item.number === 1).body, 'incremental new');
  assert.equal(app.getState().repoSyncWatermarks.get('owner/a'), incrementalWatermark, 'publication must not regress the watermark below admitted incremental coverage');
});

test('current board: completed full membership removes absent rows but keeps newer admitted items (R2 membership)', async () => {
  const pageTwo = deferred();
  let mode = 'initial';
  const { app } = await setup((payload) => {
    if (payload.path.includes('since=')) return response([issue(1, 'owner/a', 'incremental new'), issue(500, 'owner/a', 'created upstream')]);
    if (mode === 'initial') return response([issue(900, 'owner/a', 'doomed row'), issue(1, 'owner/a', 'old body')]);
    if (payload.path.endsWith('page=1')) return response(Array.from({ length: 100 }, (_, index) => issue(index + 1, 'owner/a', 'old body')));
    return pageTwo.promise;
  });
  await app.fetchIssues(true);
  mode = 'refresh';
  const pending = app.fetchIssues(true);
  await pause();
  await app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', Date.now());
  pageTwo.resolve(response([]));
  await pending;
  await pause();
  const numbers = app.getState().issues.map((item) => item.number);
  assert.equal(numbers.includes(900), false, 'rows absent from a completed full response are still deleted');
  assert.equal(numbers.includes(500), true, 'items admitted after the full request started survive it');
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'incremental new');
  assert.equal(numbers.length, 101);
});

test('current board: in-flight edit whose write completes after an older full response still wins (R1 in-flight)', async () => {
  const slow = deferred();
  const patch = deferred();
  let full = 0;
  const { app, mockStorage } = await setup(
    () => (++full === 1 ? response([issue(1, 'owner/a', 'old body')]) : slow.promise),
    { mutate: () => patch.promise }
  );
  await app.fetchIssues(true);
  const pending = app.fetchIssues(true);
  await pause();
  const editing = app.updateIssueBody(app.getState().issues[0], 'crossing write');
  await pause();
  slow.resolve(response([issue(1, 'owner/a', 'old body')]));
  await pending;
  await pause();
  assert.equal(app.getState().issues[0].body, 'crossing write', 'publication must not clobber an in-flight edit');
  patch.resolve({ status: 200, body: JSON.stringify({ updated_at: '2026-10-23T12:00:00Z' }) });
  await editing;
  await pause();
  assert.equal(app.getState().issues[0].body, 'crossing write', 'a write accepted across the fetch window must stay visible');
  assert.equal(mockStorage.get('cached_issues_owner/a').issues[0].body, 'crossing write');
});

test('current board: failed body edit is not permanently fresh; a later full response restores server truth (R1 failure)', async () => {
  const slow = deferred();
  const patch = deferred();
  let full = 0;
  let patchCalls = 0;
  const { app } = await setup(
    () => (++full === 1 ? response([issue(1, 'owner/a', 'old body')]) : full === 2 ? slow.promise : response([issue(1, 'owner/a', 'old body')])),
    { mutate: () => (++patchCalls === 1 ? patch.promise : { status: 200, body: '{}' }) }
  );
  await app.fetchIssues(true);
  const pending = app.fetchIssues(true);
  await pause();
  const editing = app.updateIssueBody(app.getState().issues[0], 'draft that fails');
  await pause();
  slow.resolve(response([issue(1, 'owner/a', 'old body')]));
  await pending;
  await pause();
  assert.equal(app.getState().issues[0].body, 'draft that fails', 'in-flight edit is kept while the write is unresolved');
  patch.resolve({ status: 500, body: '{}' });
  await editing;
  await pause();
  await app.fetchIssues(true);
  await pause();
  assert.equal(app.getState().issues[0].body, 'old body', 'a failed write must not stay pinned against later authoritative data');
});

test('current board: failed status edit reverts on the record published mid-write (R1 failure status)', async () => {
  const slow = deferred();
  const patch = deferred();
  let full = 0;
  const { app } = await setup(
    () => (++full === 1 ? response([issue(1, 'owner/a', 'old body')]) : slow.promise),
    { mutate: () => patch.promise }
  );
  await app.fetchIssues(true);
  const pending = app.fetchIssues(true);
  await pause();
  const moving = app.updateIssueStatus(app.getState().issues[0], 'done', { isHumanGesture: true });
  await pause();
  slow.resolve(response([issue(1, 'owner/a', 'old body')]));
  await pending;
  await pause();
  assert.equal(app.getState().issues[0].state, 'closed', 'in-flight move is kept while the write is unresolved');
  patch.resolve({ status: 500, body: '{}' });
  await moving;
  await pause();
  const shown = app.getState().issues[0];
  assert.equal(shown.state, 'open', 'failed move must revert on the published record');
  assert.deepEqual(shown.labels, []);
});

// F1: one incremental scan admits up to MAX_ISSUES_PER_REPO (1000) issues, so a
// 400-key cap let a 500-issue scan evict its own admissions and a pending edit.
test('current board: a 500-issue incremental scan cannot evict an in-flight edit before an older full snapshot (F1)', async () => {
  const pageTwo = deferred();
  const patch = deferred();
  let mode = 'initial';
  const { app } = await setup((payload) => {
    if (payload.path.includes('since=')) {
      const page = pageNumberOf(payload.path);
      if (page > 5) return response([]);
      return response(Array.from({ length: 100 }, (_, index) => issue(2 + (page - 1) * 100 + index, 'owner/a', 'incremental')));
    }
    if (mode === 'initial') return response([issue(1, 'owner/a', 'old body')]);
    if (pageNumberOf(payload.path) === 1) return response(Array.from({ length: 100 }, (_, index) => issue(index + 1, 'owner/a', 'old body')));
    return pageTwo.promise;
  }, { mutate: () => patch.promise });
  await app.fetchIssues(true);
  mode = 'refresh';
  const pending = app.fetchIssues(true);
  await pause();
  const editing = app.updateIssueBody(app.getState().issues.find((item) => item.number === 1), 'in-flight user edit');
  await pause();
  await app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', Date.now());
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'in-flight user edit', 'admissions may not evict the pending edit');
  pageTwo.resolve(response([]));
  await pending;
  await pause();
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'in-flight user edit', 'an older full snapshot must not undo the edit after cap pressure');
  patch.resolve({ status: 200, body: JSON.stringify({ updated_at: '2026-10-23T12:00:00Z' }) });
  await editing;
  await pause();
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'in-flight user edit', 'the accepted edit survives settlement too');
});

test('current board: a pending write is never evicted under tracker cap pressure (F1)', async () => {
  const pageTwo = deferred();
  const patch = deferred();
  let mode = 'initial';
  let scan = 0;
  let scanStart = 1;
  const { app, mockStorage } = await setup((payload) => {
    if (payload.path.includes('since=')) {
      const page = pageNumberOf(payload.path);
      if (page === 1) {
        scan += 1;
        scanStart = 2 + (scan - 1) * 1000;
      }
      return response(Array.from({ length: 100 }, (_, index) => issue(scanStart + (page - 1) * 100 + index, 'owner/a', 'admitted')));
    }
    if (mode === 'initial') return response([issue(1, 'owner/a', 'old body')]);
    if (pageNumberOf(payload.path) === 1) return response(Array.from({ length: 100 }, (_, index) => issue(index + 1, 'owner/a', 'old body')));
    return pageTwo.promise;
  }, { mutate: () => patch.promise });
  await app.fetchIssues(true);
  const editing = app.updateIssueBody(app.getState().issues.find((item) => item.number === 1), 'pending edit survives');
  await pause();
  await app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', Date.now());
  await app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', Date.now());
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'pending edit survives', 'cap pressure must not drop a pending write record');
  mode = 'refresh';
  const pending = app.fetchIssues(true);
  await pause();
  pageTwo.resolve(response([]));
  await pending;
  await pause();
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'pending edit survives', 'the pending edit survives the older publication');
  assert.equal(mockStorage.get('cached_issues_owner/a').issues.find((item) => item.number === 1).body, 'pending edit survives');
  patch.resolve({ status: 200, body: JSON.stringify({ updated_at: '2026-10-23T12:00:00Z' }) });
  await editing;
  await pause();
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'pending edit survives');
});

test('current board: an overflow of protected tracker records does not clobber a successful edit (F1)', async () => {
  const pageTwo = deferred();
  let mode = 'initial';
  let scan = 0;
  let scanStart = 1;
  const { app } = await setup((payload) => {
    if (payload.path.includes('since=')) {
      const page = pageNumberOf(payload.path);
      if (page === 1) {
        scan += 1;
        scanStart = 2 + (scan - 1) * 1000;
      }
      return response(Array.from({ length: 100 }, (_, index) => issue(scanStart + (page - 1) * 100 + index, 'owner/a', 'admitted')));
    }
    if (mode === 'initial') return response([issue(1, 'owner/a', 'old body')]);
    if (pageNumberOf(payload.path) === 1) return response(Array.from({ length: 100 }, (_, index) => issue(index + 1, 'owner/a', 'old body')));
    return pageTwo.promise;
  });
  await app.fetchIssues(true);
  mode = 'refresh';
  const pending = app.fetchIssues(true);
  await pause();
  await app.updateIssueBody(app.getState().issues.find((item) => item.number === 1), 'protected edit');
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'protected edit');
  await app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', Date.now());
  await app.syncRepoIncremental('owner/a', '2026-10-01T00:00:00Z', Date.now());
  pageTwo.resolve(response([]));
  await pending;
  await pause();
  assert.equal(app.getState().issues.find((item) => item.number === 1).body, 'protected edit', 'protected overflow must keep a settled edit through an older publication');
});
