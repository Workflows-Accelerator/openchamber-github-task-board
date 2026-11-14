// ==========================================
// Wave 7a server wiring.
//
// Proves the server foundations the canvas UI will build on:
//   * per-page conditional issue lists (Option A caches)
//   * issue-detail revalidation (If-None-Match / 304)
//   * a 60s dependency GraphQL TTL with mutation invalidation
//   * native `parent` sub-issue reads with a capability fallback
//   * the authenticated /api/layout surface and board `layout` payload
//   * `order: null` clearing the hidden order marker
//   * SessionActivityTracker enrichment of board rows
// ==========================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GitHubClient } from '../server/github.ts';
import { SessionActivityTracker } from '../server/session-activity.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

const REPO = 'owner/repo';

function clientFor(fake, overrides = {}) {
  return new GitHubClient({
    apiBase: fake.url,
    token: fake.token,
    repo: { owner: 'owner', name: 'repo', full: REPO },
    ...overrides,
  });
}

function issueRequests(fake) {
  return fake.requests.filter((request) => request.path === `/repos/${REPO}/issues`);
}

function dependencyQueries(fake) {
  return fake.state.graphqlCalls.filter((call) => call.query.includes('IssueDependencies'));
}

async function signedIn(url) {
  const session = new HttpSession(url);
  const login = await session.login();
  assert.equal(login.status, 200);
  return session;
}

function tempLayoutFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave7a-layout-'));
  return {
    dir,
    filePath: path.join(dir, 'canvas-layout.json'),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ==========================================
// 1. Option A: per-page If-None-Match on multi-page lists
// ==========================================

test('W7a listIssues revalidates every page with its own ETag and reuses 304 pages', async () => {
  const issues = Array.from({ length: 232 }, (_, index) => makeIssue({ number: index + 1 }));
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues, perPage: 100, honorIfNoneMatch: true });
  try {
    const client = clientFor(fake);
    const first = await client.listIssues();
    assert.equal(first.items.length, 232);
    assert.equal(first.pages, 3);
    assert.equal(first.notModified, false);
    assert.equal(first.pageEtags.length, 3);
    assert.ok(first.pageEtags.every((etag) => typeof etag === 'string' && etag.length > 0));
    assert.deepEqual(first.pageItems.map((page) => page.length), [100, 100, 32]);

    const second = await client.listIssues({
      pageCache: { etags: first.pageEtags, pages: first.pageItems },
    });
    assert.equal(second.notModified, true, 'all three pages unchanged is the fast path');
    assert.equal(second.items.length, 232);

    const secondRequests = issueRequests(fake).slice(3);
    assert.equal(secondRequests.length, 3, 'one conditional request per page');
    assert.ok(secondRequests.every((request) => request.ifNoneMatch), 'each page sends If-None-Match');
    assert.deepEqual(secondRequests.map((request) => request.responseStatus), [304, 304, 304]);

    // Only page 2 changes: pages 1 and 3 must still be reused from cache.
    fake.mutateIssue(150, (issue) => {
      issue.title = 'Changed on page two';
    });
    const third = await client.listIssues({
      pageCache: { etags: second.pageEtags, pages: second.pageItems },
    });
    assert.equal(third.notModified, false);
    assert.equal(third.items.length, 232);
    assert.equal(third.items.find((item) => item.number === 150).title, 'Changed on page two');
    assert.equal(third.items.find((item) => item.number === 1).title, 'Synthetic issue 1');

    const thirdRequests = issueRequests(fake).slice(6);
    assert.deepEqual(thirdRequests.map((request) => request.responseStatus), [304, 200, 304]);
  } finally {
    await fake.close();
  }
});

test('W7a /api/board revalidates every issue page of a multi-page repository', async () => {
  const issues = Array.from({ length: 232 }, (_, index) => makeIssue({ number: index + 1 }));
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [{ repo: REPO, issues, id: 1 }],
    perPage: 100,
    honorIfNoneMatch: true,
  });
  const board = await startBoard(fake, { boardCacheTtlMs: 0 });
  try {
    const session = await signedIn(board.url);
    const first = await session.request('/api/board');
    assert.equal(first.status, 200);
    assert.equal(first.json.issues.length, 232);

    const second = await session.request('/api/board');
    assert.equal(second.status, 200);
    assert.equal(second.json.issues.length, 232);

    const revalidated = issueRequests(fake).slice(3);
    assert.equal(revalidated.length, 3, 'the second board load revalidates each page');
    assert.ok(revalidated.every((request) => request.ifNoneMatch));
    assert.deepEqual(revalidated.map((request) => request.responseStatus), [304, 304, 304]);

    fake.mutateIssue(232, (issue) => {
      issue.title = 'Changed on page three';
    });
    const third = await session.request('/api/board');
    assert.equal(third.status, 200);
    assert.equal(third.json.issues.find((issue) => issue.number === 232).title, 'Changed on page three');
    const refreshed = issueRequests(fake).slice(6);
    assert.deepEqual(refreshed.map((request) => request.responseStatus), [304, 304, 200]);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

// ==========================================
// 2. Issue detail If-None-Match / 304
// ==========================================

test('W7a getIssue sends If-None-Match and reports 304 without a body', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    issues: [makeIssue({ number: 1, title: 'Seven', body: 'Body seven' })],
    honorIfNoneMatch: true,
  });
  try {
    const client = clientFor(fake);
    const first = await client.getIssue(1);
    assert.equal(first.notModified, false);
    assert.equal(first.item.title, 'Seven');
    assert.match(first.etag, /^".+"$/);

    const again = await client.getIssue(1, { ifNoneMatch: first.etag });
    assert.equal(again.notModified, true);
    assert.equal(again.item, null);
    assert.equal(again.etag, first.etag);
    const last = fake.requests.filter((request) => request.path === `/repos/${REPO}/issues/1`).at(-1);
    assert.equal(last.ifNoneMatch, first.etag);
    assert.equal(last.responseStatus, 304);
  } finally {
    await fake.close();
  }
});

test('W7a repeat drawer reads revalidate the issue and still serve the cached body', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    issues: [makeIssue({ number: 1, title: 'Cached drawer', body: '## Overview\nBody', labels: ['status:todo'] })],
    honorIfNoneMatch: true,
  });
  const board = await startBoard(fake);
  try {
    const session = await signedIn(board.url);
    const first = await session.request('/api/issues/1');
    assert.equal(first.status, 200);
    assert.equal(first.json.issue.title, 'Cached drawer');

    const second = await session.request('/api/issues/1');
    assert.equal(second.status, 200);
    assert.equal(second.json.issue.title, 'Cached drawer');
    const detailReads = fake.requests.filter((request) => request.path === `/repos/${REPO}/issues/1`);
    assert.equal(detailReads.length, 2);
    assert.ok(detailReads[1].ifNoneMatch, 'the repeat read must be conditional');
    assert.equal(detailReads[1].responseStatus, 304, 'upstream answered 304');

    // ?refresh=1 must bypass the cache and take a fresh read.
    const refreshed = await session.request('/api/issues/1?refresh=1');
    assert.equal(refreshed.status, 200);
    const afterRefresh = fake.requests.filter((request) => request.path === `/repos/${REPO}/issues/1`).at(-1);
    assert.equal(afterRefresh.ifNoneMatch, null);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

// ==========================================
// 3. Dependency GraphQL TTL + invalidation
// ==========================================

test('W7a dependency reads are cached for 60s and expire afterwards', async () => {
  let clock = Date.parse('2026-11-14T09:00:00Z');
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    issues: [makeIssue({ number: 1 }), makeIssue({ number: 2 })],
  });
  fake.addDependency(2, 1);
  try {
    const client = clientFor(fake, { now: () => clock });
    const first = await client.getIssueDependencies(2);
    assert.equal(first.blockedBy.length, 1);
    await client.getIssueDependencies(2);
    assert.equal(dependencyQueries(fake).length, 1, 'the second read inside the TTL is free');

    clock += 60_001;
    await client.getIssueDependencies(2);
    assert.equal(dependencyQueries(fake).length, 2, 'the TTL expires after 60s');

    await client.getIssueDependencies(2, { forceRefresh: true });
    assert.equal(dependencyQueries(fake).length, 3, 'forceRefresh bypasses the TTL');
  } finally {
    await fake.close();
  }
});

test('W7a a mutation invalidates the dependency cache immediately', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    issues: [makeIssue({ number: 1, labels: ['status:draft'] }), makeIssue({ number: 2 })],
  });
  const board = await startBoard(fake);
  try {
    const session = await signedIn(board.url);
    assert.equal((await session.request('/api/issues/2/dependencies')).status, 200);
    assert.equal((await session.request('/api/issues/2/dependencies')).status, 200);
    assert.equal(dependencyQueries(fake).length, 1);

    const detail = await session.request('/api/issues/1');
    const beforePatch = dependencyQueries(fake).length;
    const patched = await session.request('/api/issues/1', {
      method: 'PATCH',
      body: { fingerprint: detail.json.issue.fingerprint, status: 'status:backlog' },
    });
    assert.equal(patched.status, 200, patched.text);

    assert.equal((await session.request('/api/issues/2/dependencies')).status, 200);
    assert.equal(
      dependencyQueries(fake).length,
      beforePatch + 1,
      'the write dropped the cached dependency graph',
    );
  } finally {
    await board.app.close();
    await fake.close();
  }
});

// ==========================================
// 4. Native parent sub-issue read
// ==========================================

function parentFixture() {
  return {
    repo: REPO,
    id: 1,
    issues: [
      makeIssue({ number: 3, title: 'Parent task', labels: ['status:todo'], repo: REPO }),
      makeIssue({ number: 5, title: 'Child task', labels: ['status:todo'], repo: REPO }),
    ],
    parents: { 5: { number: 3, repo: REPO } },
  };
}

test('W7a parent is read on the drawer and on board rows', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repositories: [parentFixture()] });
  const board = await startBoard(fake);
  try {
    const session = await signedIn(board.url);

    const child = await session.request('/api/issues/5');
    assert.equal(child.status, 200);
    assert.equal(child.json.issue.parentKey, `${REPO}#3`);
    assert.equal(child.json.issue.parentTitle, 'Parent task');

    const unparented = await session.request('/api/issues/3');
    assert.equal(unparented.json.issue.parentKey, null);
    assert.equal(unparented.json.issue.parentTitle, null);

    const boardRes = await session.request('/api/board');
    assert.equal(boardRes.status, 200);
    const childRow = boardRes.json.issues.find((issue) => issue.number === 5);
    const parentRow = boardRes.json.issues.find((issue) => issue.number === 3);
    assert.equal(childRow.parentKey, `${REPO}#3`);
    assert.equal(childRow.parentTitle, 'Parent task');
    assert.equal(parentRow.parentKey, null);
    assert.equal(parentRow.parentTitle, null);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('W7a a schema without the parent field falls back and caches the capability', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repositories: [parentFixture()] });
  fake.setRejectParentField(true);
  try {
    const client = clientFor(fake);
    const first = await client.getIssueDependencies(5);
    assert.equal(first.parent, null);
    assert.deepEqual(first.blockedBy, []);

    const queries = dependencyQueries(fake);
    assert.equal(queries.length, 2, 'the rejected query is retried without parent');
    assert.ok(queries[0].query.includes('parent'), 'the first attempt asks for parent');
    assert.ok(!queries[1].query.includes('parent'), 'the retry omits parent');

    await client.getIssueDependencies(5, { forceRefresh: true });
    const after = dependencyQueries(fake);
    assert.equal(after.length, 3);
    assert.ok(!after[2].query.includes('parent'), 'the capability is remembered per client');
  } finally {
    await fake.close();
  }

  const appFake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repositories: [parentFixture()] });
  appFake.setRejectParentField(true);
  const board = await startBoard(appFake);
  try {
    const session = await signedIn(board.url);
    const detail = await session.request('/api/issues/5');
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.json.issue.parentKey, null);
    const boardRes = await session.request('/api/board');
    assert.equal(boardRes.status, 200, boardRes.text);
    assert.equal(boardRes.json.issues.find((issue) => issue.number === 5).parentKey, null);
  } finally {
    await board.app.close();
    await appFake.close();
  }
});

// ==========================================
// 5. /api/layout
// ==========================================

test('W7a /api/layout persists per scope, validates input and requires CSRF', async () => {
  const layoutFile = tempLayoutFile();
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [{ repo: REPO, issues: [makeIssue({ number: 1, labels: ['status:todo'] })], id: 1 }],
  });
  const board = await startBoard(fake, { env: { BOARD_LAYOUT_FILE: layoutFile.filePath } });
  try {
    const session = await signedIn(board.url);

    const initial = await session.request('/api/layout');
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.json, {
      direction: 'auto',
      expandedGroups: [],
      positions: {},
      updatedAt: null,
    });

    const noCsrf = await session.request('/api/layout', {
      method: 'PATCH',
      csrf: false,
      body: { direction: 'LR' },
    });
    assert.equal(noCsrf.status, 403);

    const patched = await session.request('/api/layout', {
      method: 'PATCH',
      body: {
        direction: 'LR',
        expandedGroups: [`repo:${REPO}`],
        setPositions: { [`${REPO}#1`]: { x: 10, y: 20.5 } },
      },
    });
    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.json.direction, 'LR');
    assert.deepEqual(patched.json.expandedGroups, [`repo:${REPO}`]);
    assert.deepEqual(patched.json.positions, { [`${REPO}#1`]: { x: 10, y: 20.5 } });
    assert.match(patched.json.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

    const stored = JSON.parse(fs.readFileSync(layoutFile.filePath, 'utf8'));
    assert.equal(stored.version, 1);
    assert.equal(stored.scopes.all.direction, 'LR');

    const reread = await session.request('/api/layout?scope=all');
    assert.equal(reread.status, 200);
    assert.deepEqual(reread.json.positions, { [`${REPO}#1`]: { x: 10, y: 20.5 } });

    const invalidDirection = await session.request('/api/layout', {
      method: 'PATCH',
      body: { direction: 'sideways' },
    });
    assert.equal(invalidDirection.status, 400);
    assert.equal(invalidDirection.json.error, 'invalid_layout');
    assert.ok(typeof invalidDirection.json.message === 'string' && invalidDirection.json.message.length > 0);

    const invalidScope = await session.request('/api/layout?scope=not%20a%20scope');
    assert.equal(invalidScope.status, 400);
    assert.equal(invalidScope.json.error, 'invalid_layout');

    const repoScope = await session.request('/api/layout', {
      method: 'PATCH',
      body: { scope: REPO, direction: 'TD', resetPositions: true },
    });
    assert.equal(repoScope.status, 200, repoScope.text);
    assert.equal(repoScope.json.direction, 'TD');
    assert.deepEqual(repoScope.json.positions, {});
    assert.equal(fs.existsSync(layoutFile.filePath), true);
  } finally {
    await board.app.close();
    await fake.close();
    layoutFile.cleanup();
  }
});

test('W7a board payloads carry their scope layout and the layout changes the ETag', async () => {
  const layoutFile = tempLayoutFile();
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [{ repo: REPO, issues: [makeIssue({ number: 1, labels: ['status:todo'] })], id: 1 }],
  });
  const board = await startBoard(fake, { env: { BOARD_LAYOUT_FILE: layoutFile.filePath } });
  try {
    const session = await signedIn(board.url);

    const before = await session.request('/api/board');
    assert.equal(before.status, 200);
    assert.equal(before.json.layout.direction, 'auto');
    const etag = before.headers.get('etag');
    assert.ok(etag);

    assert.equal(
      (await session.request('/api/board', { headers: { 'if-none-match': etag } })).status,
      304,
      'an unchanged layout still revalidates',
    );

    const patched = await session.request('/api/layout', {
      method: 'PATCH',
      body: { scope: REPO, direction: 'TD', expandedGroups: ['group:blocked'] },
    });
    assert.equal(patched.status, 200, patched.text);

    const after = await session.request('/api/board', { headers: { 'if-none-match': etag } });
    assert.equal(after.status, 200, 'a layout change must not be hidden by a stale 304');
    assert.notEqual(after.headers.get('etag'), etag);
    assert.equal(after.json.layout.direction, 'TD');
    assert.deepEqual(after.json.layout.expandedGroups, ['group:blocked']);

    const combined = await session.request('/api/combined/board');
    assert.equal(combined.status, 200);
    assert.equal(combined.json.layout.direction, 'auto', 'the combined board reads the all scope');

    const qualified = await session.request(`/api/repos/${REPO}/board`);
    assert.equal(qualified.status, 200);
    assert.equal(qualified.json.layout.direction, 'TD');
  } finally {
    await board.app.close();
    await fake.close();
    layoutFile.cleanup();
  }
});

// ==========================================
// 6. order: null clears the hidden marker
// ==========================================

test('W7a order: null strips the marker on both PATCH routes and rejects a non-finite order', async () => {
  const ordered = makeIssue({
    number: 1,
    title: 'Ordered',
    body: 'Body text\n\n<!-- board-order: 500 -->',
    labels: ['status:draft'],
    repo: REPO,
  });
  const second = makeIssue({
    number: 2,
    title: 'Also ordered',
    body: 'Other body\n\n<!-- board-order: 900 -->',
    labels: ['status:draft'],
    repo: REPO,
  });
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repositories: [{ repo: REPO, issues: [ordered, second], id: 1 }] });
  const board = await startBoard(fake);
  try {
    const session = await signedIn(board.url);

    const before = await session.request('/api/issues/1');
    assert.equal(before.json.issue.order, 500);

    const cleared = await session.request('/api/issues/1', {
      method: 'PATCH',
      body: { fingerprint: before.json.issue.fingerprint, order: null },
    });
    assert.equal(cleared.status, 200, cleared.text);
    assert.equal(cleared.json.issue.order, null);
    assert.doesNotMatch(fake.findIssue(1).body, /board-order/);
    assert.equal(fake.findIssue(1).body.trimEnd(), 'Body text');

    const nonFinite = await session.request('/api/issues/1', {
      method: 'PATCH',
      body: { fingerprint: cleared.json.issue.fingerprint, order: 'abc' },
    });
    assert.equal(nonFinite.status, 400);
    assert.equal(fake.patchCalls.length, 1, 'a rejected order never reaches GitHub');

    const qualifiedBefore = await session.request(`/api/repos/${REPO}/issues/2`);
    assert.equal(qualifiedBefore.json.issue.order, 900);
    const qualifiedClear = await session.request(`/api/repos/${REPO}/issues/2`, {
      method: 'PATCH',
      body: { fingerprint: qualifiedBefore.json.issue.fingerprint, order: null },
    });
    assert.equal(qualifiedClear.status, 200, qualifiedClear.text);
    assert.equal(qualifiedClear.json.issue.order, null);
    assert.doesNotMatch(fake.findIssue(2).body, /board-order/);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

// ==========================================
// 7. SessionActivityTracker enrichment
// ==========================================

function activityTracker({ fail = false, ttlMs = 0 } = {}) {
  const state = { active: false };
  const tracker = new SessionActivityTracker({
    openchamberUrl: 'http://openchamber.local',
    ttlMs,
    timeoutMs: 200,
    fetchFn: async () => {
      if (fail) throw new Error('openchamber unreachable');
      return new Response(
        JSON.stringify({
          sessions: [{ id: 'session-1', status: state.active ? 'busy' : 'idle', issueRef: `${REPO}#2` }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  return { tracker, state };
}

test('W7a a running issue carries activeSession and an idle in-progress issue does not', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      {
        repo: REPO,
        id: 1,
        issues: [
          makeIssue({ number: 1, labels: ['status:todo'], repo: REPO }),
          makeIssue({ number: 2, labels: ['status:in-progress'], repo: REPO }),
        ],
      },
    ],
  });
  const activity = activityTracker();
  const board = await startBoard(fake, { sessionActivityTracker: activity.tracker });
  try {
    const session = await signedIn(board.url);
    activity.state.active = true;
    const running = await session.request('/api/board');
    assert.equal(running.status, 200);
    const runningRow = running.json.issues.find((issue) => issue.number === 2);
    assert.equal(runningRow.activeSession.active, true);
    assert.equal(runningRow.activeSession.source, 'openchamber');
    assert.equal(runningRow.activeSession.sessionId, 'session-1');
    assert.equal(running.json.issues.find((issue) => issue.number === 1).activeSession, null);
    assert.deepEqual(
      { available: running.json.sessionActivity.available, degraded: running.json.sessionActivity.degraded },
      { available: true, degraded: false },
    );

    const runningEtag = running.headers.get('etag');
    assert.ok(runningEtag);

    // The agent stops: the same session must see the flip, not a cached 304.
    activity.state.active = false;
    const idle = await session.request('/api/board', { headers: { 'if-none-match': runningEtag } });
    assert.equal(idle.status, 200, 'a status flip must not be served from a stale 304');
    assert.equal(idle.json.issues.find((issue) => issue.number === 2).activeSession, null);
    assert.equal(idle.json.issues.find((issue) => issue.number === 1).activeSession, null);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('W7a an unreachable session source degrades the board instead of failing it', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [{ repo: REPO, id: 1, issues: [makeIssue({ number: 2, labels: ['status:in-progress'], repo: REPO })] }],
  });
  const activity = activityTracker({ fail: true });
  const board = await startBoard(fake, { sessionActivityTracker: activity.tracker });
  try {
    const session = await signedIn(board.url);
    const degraded = await session.request('/api/board');
    assert.equal(degraded.status, 200);
    assert.equal(degraded.json.issues[0].activeSession, null);
    assert.deepEqual(
      { available: degraded.json.sessionActivity.available, degraded: degraded.json.sessionActivity.degraded },
      { available: false, degraded: true },
    );
  } finally {
    await board.app.close();
    await fake.close();
  }
});
