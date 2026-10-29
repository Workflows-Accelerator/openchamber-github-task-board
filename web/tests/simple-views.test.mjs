import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { shortName, parseOrderMarker, stripOrderMarker, setOrderMarker, midpointOrder, buildBoardListItem, buildIssueDetail } from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession } from './helpers.mjs';

for (const [full, expected] of [
  ['Workflows-Accelerator/openchamber-github-task-board', 'Task Board'],
  ['owner/GH_repo.github', 'Gh_repo.github'], ['owner/REPO.API_tools-v2', 'Api Tools V2'],
  ['owner/coffee', 'Coffee'], ['owner/gh', 'Gh'],
]) test('short name: ' + full, () => assert.equal(shortName(full), expected));
test('short name override is case-insensitive and wins', () => {
  assert.equal(shortName('Owner/REPO', { 'owner/repo': 'My project' }), 'My project');
});
test('order marker parse, last marker, finite, stripping and midpoint contract', () => {
  assert.equal(parseOrderMarker('No marker'), null);
  assert.equal(parseOrderMarker('<!-- board-order: -1.5 -->\n<!-- board-order: 3e2 -->'), 300);
  assert.equal(parseOrderMarker('<!-- board-order: Infinity -->'), null);
  assert.equal(parseOrderMarker('inline <!-- board-order: 8 -->'), null);
  assert.equal(parseOrderMarker('<!-- board-order: 1e999 -->'), null);
  assert.equal(midpointOrder(null, null), 1000);
  assert.equal(midpointOrder(null, 2000), 1000);
  assert.equal(midpointOrder(1000, null), 2000);
  assert.equal(midpointOrder(-4, 8), 2);
  const body = '## Overview\r\nKeep\r\n\r\n<!-- board-order: 1000 -->';
  const rewritten = setOrderMarker(body, 1500);
  assert.equal(rewritten, '## Overview\r\nKeep\r\n\r\n<!-- board-order: 1500 -->');
  assert.equal(parseOrderMarker(rewritten), 1500);
  assert.doesNotMatch(stripOrderMarker(rewritten), /board-order/);
  assert.throws(() => setOrderMarker('', NaN));

  // F3: fenced/indented markers ignored, CRLF and Markdown trailing hard-break spaces preserved
  const fencedOnly = '## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n';
  assert.equal(parseOrderMarker(fencedOnly), null);
  assert.equal(stripOrderMarker(fencedOnly), fencedOnly);
  const indentedOnly = '    <!-- board-order: 42 -->\n';
  assert.equal(parseOrderMarker(indentedOnly), null);
  assert.equal(stripOrderMarker(indentedOnly), indentedOnly);
  const hardBreak = 'Keep this hard break  \r\n\r\n';
  const withMarker = setOrderMarker(hardBreak, 1000);
  assert.equal(withMarker, 'Keep this hard break  \r\n\r\n<!-- board-order: 1000 -->');
  assert.equal(stripOrderMarker(withMarker), 'Keep this hard break  \r\n\r\n');
  const complexRaw = '## Overview\r\nOriginal\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 1000 -->';
  assert.equal(parseOrderMarker(complexRaw), 1000);
  const complexUpdated = setOrderMarker(complexRaw, 1500);
  assert.equal(
    complexUpdated,
    '## Overview\r\nOriginal\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 1500 -->',
  );
});

test('F7: dependency parser supports checklist and numbered prefixes and ignores fenced/indented code', () => {
  assert.deepEqual(
    buildBoardListItem(makeIssue({ number: 1, body: '- [ ] Blocked by #2\n- [x] Depends on #3\n1. Requires #4 and #5' })).dependencies,
    [2, 3, 4, 5],
  );
  assert.deepEqual(
    buildBoardListItem(makeIssue({ number: 1, body: '```md\nDepends on #2\n- [ ] Blocked by #3\n```\n    Requires #4\n' })).dependencies,
    [],
  );
});
test('marker hidden from body, overview, description and pending items; raw fingerprint retained', () => {
  const raw = makeIssue({ number: 1, body: '## Overview\nIdea\n\n<!-- board-order: 2000 -->', labels: ['status:draft'] });
  const detail = buildIssueDetail(raw);
  const row = buildBoardListItem(raw);
  assert.doesNotMatch(detail.body, /board-order/);
  assert.doesNotMatch(JSON.stringify(detail.editableSections), /board-order/);
  assert.doesNotMatch(row.description, /board-order/);
  assert.equal(detail.fingerprint, row.fingerprint);
  assert.equal(row.order, 2000);
});

async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp('/tmp/opencode/issue48-routes-');
  const fake = await startFakeGitHub({ repositories: [
    { repo: 'owner/alpha', issues: [makeIssue({ number: 1, title: 'Idea', body: 'Inspiration\n\n<!-- board-order: 1000 -->', labels: ['status:draft', 'priority:high'], repo: 'owner/alpha' })] },
    { repo: 'owner/beta', issues: [] },
  ], honorIfMatch: true, ...options });
  let board = await startBoard(fake, { sessionFilePath: path.join(directory, 'sessions.json') });
  const client = new HttpSession(board.url);
  t.after(async () => { await board.app.close(); await fake.close(); await fs.rm(directory, { recursive: true, force: true }); });
  assert.equal((await client.login()).status, 200);
  return { fake, client, directory, restart: async () => {
    await board.app.close(); board = await startBoard(fake, { sessionFilePath: path.join(directory, 'sessions.json') }); client.base = board.url;
  } };
}
const endpoint = '/api/repos/owner/alpha/issues/1';
async function fingerprint(client) { return (await client.request(endpoint)).json.issue.fingerprint; }

test('draft create, inline edit and marker-only reorder routes use fingerprint + ETag', async (t) => {
  const { fake, client } = await fixture(t);
  const created = await client.request('/api/repos/owner/beta/issues', { method: 'POST', body: { title: 'Capture', body: 'Optional inspiration', labels: ['status:draft'] } });
  assert.equal(created.status, 201);
  assert.equal(created.json.issue.statusLabel, 'status:draft');
  assert.equal(created.json.issue.description, 'Optional inspiration');
  assert.equal(fake.requests.some((r) => /session|agent/.test(r.path)), false);
  const old = await fingerprint(client);
  const edit = await client.request(endpoint + '/draft', { method: 'PUT', body: { fingerprint: old, title: 'Edited', description: 'Keep this inspiration' } });
  assert.equal(edit.status, 200, edit.text);
  assert.equal(fake.findIssue(1).title, 'Edited');
  assert.equal(fake.findIssue(1).body, 'Keep this inspiration\n\n<!-- board-order: 1000 -->');
  assert.ok(fake.patchCalls[0].ifMatch);
  assert.equal((await client.request(endpoint + '/order', { method: 'PUT', body: { fingerprint: old, previous: null, next: 1000 } })).status, 409);
  const order = await client.request(endpoint + '/order', { method: 'PUT', body: { fingerprint: await fingerprint(client), previous: 1000, next: 2000 } });
  assert.equal(order.status, 200, order.text);
  assert.equal(order.json.issue.order, 1500);
  assert.deepEqual(fake.patchCalls.at(-1).payload, { body: 'Keep this inspiration\n\n<!-- board-order: 1500 -->' });
  assert.equal((await client.request(endpoint + '/order', { method: 'PUT', body: { fingerprint: await fingerprint(client), previous: 4, next: 2 } })).status, 409);
  assert.equal((await client.request(endpoint + '/order', { method: 'PUT', body: { fingerprint: await fingerprint(client), previous: 'bad', next: null } })).status, 400);
});
test('two devices cannot overwrite draft title or order with stale observed fingerprint', async (t) => {
  const { client, fake } = await fixture(t);
  const old = await fingerprint(client);
  fake.mutateIssue(1, (issue) => { issue.title = 'Other device'; });
  const edited = await client.request(endpoint + '/draft', { method: 'PUT', body: { fingerprint: old, title: 'Lost update', description: 'bad' } });
  assert.equal(edited.status, 409);
  assert.equal(fake.patchCalls.length, 0);
  assert.equal((await client.request(endpoint + '/order', { method: 'PUT', body: { fingerprint: old, previous: null, next: 0 } })).status, 409);
});
test('draft routes validate inputs, sign-in, CSRF and draft-only state', async (t) => {
  const { client, fake } = await fixture(t);
  const fp = await fingerprint(client);
  const anonymous = new HttpSession(client.base);
  assert.equal((await anonymous.request(endpoint + '/order', { method: 'PUT', body: {} })).status, 401);
  assert.equal((await client.request(endpoint + '/order', { method: 'PUT', csrf: false, body: {} })).status, 403);
  for (const changes of [{ title: '', description: '' }, { title: 'x'.repeat(257), description: '' }, { title: 'Title', description: '<!-- board-order: 3 -->' }]) {
    assert.equal((await client.request(endpoint + '/draft', { method: 'PUT', body: { fingerprint: fp, ...changes } })).status, 400);
  }
  fake.mutateIssue(1, (issue) => { issue.labels = [{ name: 'status:todo' }]; });
  assert.equal((await client.request(endpoint + '/draft', { method: 'PUT', body: { fingerprint: await fingerprint(client), title: 'No', description: '' } })).json.error, 'not_draft');
});
test('F1: move requires confirmation and transfers draft via native GraphQL transferIssue preserving history without copy or close', async (t) => {
  const { fake, client } = await fixture(t, {
    repositories: [
      { repo: 'owner/alpha', issues: [makeIssue({ number: 1, title: 'Idea', body: 'Body\n\n<!-- board-order: 1000 -->', labels: ['status:draft', 'priority:high'], repo: 'owner/alpha', created_at: '2026-09-15T08:00:00Z' })] },
      { repo: 'owner/beta', issues: [makeIssue({ number: 1, title: 'Existing beta #1', body: 'Stay untouched', labels: ['status:todo'], repo: 'owner/beta' })] },
    ],
  });
  const unconfirmed = await client.request(endpoint + '/move', {
    method: 'PUT',
    body: { fingerprint: await fingerprint(client), target: 'owner/beta' },
  });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.json.error, 'confirmation_required');
  assert.equal(fake.requests.filter((r) => r.method !== 'GET').length, 0);

  const originalNodeId = fake.findIssue(1, 'owner/alpha').node_id;
  const moved = await client.request(endpoint + '/move', {
    method: 'PUT',
    body: { fingerprint: await fingerprint(client), target: 'owner/beta', confirmed: true },
  });
  assert.equal(moved.status, 200, moved.text);
  assert.equal(fake.findIssue(1, 'owner/alpha'), null);
  assert.equal(fake.findIssue(1, 'owner/beta').title, 'Existing beta #1');
  const transferred = fake.findIssue(2, 'owner/beta');
  assert.ok(transferred);
  assert.equal(transferred.title, 'Idea');
  assert.equal(transferred.state, 'open');
  assert.equal(transferred.created_at, '2026-09-15T08:00:00Z');
  assert.equal(transferred.node_id, originalNodeId);
  assert.equal(parseOrderMarker(transferred.body), 1000);
  assert.equal(moved.json.issue.key, 'owner/beta#2');
  assert.equal(moved.json.issue.number, 2);
  assert.equal(moved.json.sourceKey, 'owner/alpha#1');
  assert.equal(moved.json.targetUrl, 'https://github.com/owner/beta/issues/2');
  assert.equal(fake.state.commentCalls.length, 0);
  assert.equal(fake.patchCalls.length, 0);
  const writes = fake.requests.filter((r) => r.method !== 'GET');
  assert.deepEqual(writes.map((r) => r.method + ' ' + r.path), ['POST /graphql']);
});

test('F1: GraphQL permission refusal on transferIssue preserves source draft without copy/close fallback', async (t) => {
  const { fake, client } = await fixture(t, {
    graphqlHook: () => ({
      status: 200,
      payload: {
        data: { transferIssue: null },
        errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by integration' }],
      },
    }),
  });
  const fp = await fingerprint(client);
  const res = await client.request(endpoint + '/move', {
    method: 'PUT',
    body: { fingerprint: fp, target: 'owner/beta', confirmed: true },
  });
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'transfer_forbidden');
  assert.equal(fake.findIssue(1, 'owner/alpha')?.state, 'open');
  assert.equal(fake.findIssue(1, 'owner/beta'), null);
  assert.equal(fake.state.commentCalls.length, 0);
  assert.equal(fake.patchCalls.length, 0);
});

test('F1: ambiguous transferIssue outcome returns 502 write_outcome_unknown without blind retry or source close', async (t) => {
  const { fake, client } = await fixture(t, {
    graphqlHook: () => ({
      status: 502,
      payload: { message: 'Bad Gateway after mutation dispatch' },
    }),
  });
  const moved = await client.request(endpoint + '/move', {
    method: 'PUT',
    body: { fingerprint: await fingerprint(client), target: 'owner/beta', confirmed: true },
  });
  assert.equal(moved.status, 502);
  assert.equal(moved.json.error, 'write_outcome_unknown');
  assert.equal(moved.json.sourceKey, 'owner/alpha#1');
  assert.equal(moved.json.targetRepo, 'owner/beta');
  assert.equal(fake.requests.filter((r) => r.path === '/graphql').length, 1);
  assert.equal(fake.patchCalls.length, 0);
});
test('drawer overview and checklist body saves retain hidden marker', async (t) => {
  const { client, fake } = await fixture(t);
  const section = await client.request(endpoint + '/section', { method: 'PUT', body: { fingerprint: await fingerprint(client), sectionId: 'overview', text: 'Changed' } });
  assert.equal(section.status, 200, section.text);
  assert.equal(parseOrderMarker(fake.findIssue(1).body), 1000);
  assert.doesNotMatch(section.json.issue.editableSections[0].text, /board-order/);
  const patch = await client.request(endpoint, { method: 'PATCH', body: { fingerprint: await fingerprint(client), body: 'Changed again' } });
  assert.equal(patch.status, 200, patch.text); assert.equal(parseOrderMarker(fake.findIssue(1).body), 1000);
});

test('F3: section edit and reorder preserve fenced board-order markers, CRLF and hard-break spaces', async (t) => {
  const raw = '## Overview\r\nOriginal\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 2000 -->';
  const { client, fake } = await fixture(t, {
    repositories: [
      { repo: 'owner/alpha', issues: [makeIssue({ number: 1, title: 'Fenced', body: raw, labels: ['status:draft'], repo: 'owner/alpha' })] },
    ],
  });
  const section = await client.request(endpoint + '/section', {
    method: 'PUT',
    body: { fingerprint: await fingerprint(client), sectionId: 'overview', text: 'Changed overview' },
  });
  assert.equal(section.status, 200, section.text);
  assert.equal(
    fake.findIssue(1).body,
    '## Overview\r\nChanged overview\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 2000 -->',
  );
  const reordered = await client.request(endpoint + '/order', {
    method: 'PUT',
    body: { fingerprint: await fingerprint(client), previous: 1000, next: 2000 },
  });
  assert.equal(reordered.status, 200, reordered.text);
  assert.equal(
    fake.findIssue(1).body,
    '## Overview\r\nChanged overview\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 1500 -->',
  );
});
test('project rename is signed-in, CSRF protected, validated, stored beside data, persistent and resettable', async (t) => {
  const { client, directory, restart } = await fixture(t);
  assert.equal((await new HttpSession(client.base).request('/api/project-names')).status, 401);
  assert.equal((await client.request('/api/project-names', { method: 'PUT', csrf: false, body: { repository: 'owner/alpha', name: 'Home' } })).status, 403);
  for (const body of [{ repository: '../../escape', name: 'X' }, { repository: 'owner/unknown', name: 'X' }, { repository: 'owner/alpha', name: '<script>' }, { repository: 'owner/alpha', name: 'x'.repeat(61) }, { repository: 'owner/alpha', name: '\nBad' }]) {
    assert.equal((await client.request('/api/project-names', { method: 'PUT', body })).status, 400);
  }
  const renamed = await client.request('/api/project-names', { method: 'PUT', body: { repository: 'owner/alpha', name: 'My work' } });
  assert.equal(renamed.status, 200); assert.equal(renamed.json.projectNames['owner/alpha'], 'My work');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'project-names.json'), 'utf8')), { 'owner/alpha': 'My work' });
  await restart();
  assert.equal((await client.request('/api/repos')).json.projectNames['owner/alpha'], 'My work');
  assert.equal((await client.request('/api/project-names', { method: 'PUT', body: { repository: 'owner/alpha', name: '' } })).status, 200);
  assert.deepEqual((await client.request('/api/project-names')).json.projectNames, {});
});

test('GitHub ETag rejection during reorder is a conflict, never a successful order', async (t) => {
  const { client, fake } = await fixture(t, { patchHook: () => ({ status: 412, payload: { message: 'Precondition Failed' } }) });
  const result = await client.request(endpoint + '/order', { method: 'PUT', body: { fingerprint: await fingerprint(client), previous: null, next: 1000 } });
  assert.equal(result.status, 409); assert.equal(result.json.error, 'conflict');
  assert.equal(parseOrderMarker(fake.findIssue(1).body), 1000);
});

test('F5: reorder rebalances automatically across 60 successive midpoint bisections without 409 precision failure', async (t) => {
  const { client, fake } = await fixture(t);
  let lo = 1000;
  let hi = 2000;
  for (let i = 0; i < 60; i += 1) {
    const res = await client.request(endpoint + '/order', {
      method: 'PUT',
      body: { fingerprint: await fingerprint(client), previous: lo, next: hi },
    });
    assert.equal(res.status, 200, `iteration ${i}: ${res.text}`);
    hi = res.json.issue.order;
    assert.ok(Number.isFinite(hi));
    assert.ok(hi > lo);
  }
  assert.ok(Number.isFinite(parseOrderMarker(fake.findIssue(1).body)));
});

test('F5: reorder validates neighbour fingerprints, rejects stale/colliding boundaries, and handles multi-issue initialization and partial failure', async (t) => {
  const { client, fake } = await fixture(t, {
    repositories: [
      {
        repo: 'owner/alpha',
        issues: [
          makeIssue({ number: 1, title: 'A', body: 'Body A', labels: ['status:draft'], repo: 'owner/alpha', created_at: '2026-10-01T09:00:00Z' }),
          makeIssue({ number: 2, title: 'B', body: 'Body B', labels: ['status:draft'], repo: 'owner/alpha', created_at: '2026-10-01T09:01:00Z' }),
          makeIssue({ number: 3, title: 'C', body: 'Body C', labels: ['status:draft'], repo: 'owner/alpha', created_at: '2026-10-01T09:02:00Z' }),
        ],
      },
    ],
  });
  const getIssue = async (num) => (await client.request(`/api/repos/owner/alpha/issues/${num}`)).json.issue;
  const a0 = await getIssue(1);
  const b0 = await getIssue(2);
  const c0 = await getIssue(3);

  // Stale neighbour fingerprint rejected with zero writes
  const staleNeighbour = await client.request(endpoint + '/order', {
    method: 'PUT',
    body: {
      fingerprint: a0.fingerprint,
      updates: [
        { repo: 'owner/alpha', number: 2, fingerprint: b0.fingerprint, order: 1000 },
        { repo: 'owner/alpha', number: 1, fingerprint: a0.fingerprint, order: 2000 },
      ],
      neighbours: [{ repo: 'owner/alpha', number: 3, fingerprint: '0'.repeat(64), order: null }],
    },
  });
  assert.equal(staleNeighbour.status, 409);
  assert.equal(fake.patchCalls.length, 0);

  // Lazy initialization of unmarked B and A so A moves after B while C stays unmarked
  const initMove = await client.request(endpoint + '/order', {
    method: 'PUT',
    body: {
      fingerprint: a0.fingerprint,
      updates: [
        { repo: 'owner/alpha', number: 2, fingerprint: b0.fingerprint, order: 1000 },
        { repo: 'owner/alpha', number: 1, fingerprint: a0.fingerprint, order: 2000 },
      ],
      neighbours: [{ repo: 'owner/alpha', number: 3, fingerprint: c0.fingerprint, order: null }],
    },
  });
  assert.equal(initMove.status, 200, initMove.text);
  assert.equal(parseOrderMarker(fake.findIssue(2).body), 1000);
  assert.equal(parseOrderMarker(fake.findIssue(1).body), 2000);
  assert.equal(parseOrderMarker(fake.findIssue(3).body), null);

  // Set C to 3000, then move A (at 2000) to 4000, and verify C with stale boundary [1000, 2000] is rejected
  const c1 = await getIssue(3);
  await client.request('/api/repos/owner/alpha/issues/3/order', {
    method: 'PUT',
    body: { fingerprint: c1.fingerprint, previous: 2000, next: null },
  });
  const c2 = await getIssue(3);
  const a1 = await getIssue(1);
  const moveA = await client.request('/api/repos/owner/alpha/issues/1/order', {
    method: 'PUT',
    body: { fingerprint: a1.fingerprint, previous: 3000, next: null },
  });
  assert.equal(moveA.status, 200);
  const staleBoundary = await client.request('/api/repos/owner/alpha/issues/3/order', {
    method: 'PUT',
    body: { fingerprint: c2.fingerprint, previous: 1000, next: 2000 },
  });
  assert.equal(staleBoundary.status, 409);

  // Concurrent requests for the same boundary cannot both succeed with identical rank
  const bNow = await getIssue(2);
  const cNow = await getIssue(3);
  const concurrent = await Promise.all([
    client.request('/api/repos/owner/alpha/issues/2/order', {
      method: 'PUT',
      body: { fingerprint: bNow.fingerprint, previous: 5000, next: 6000 },
    }),
    client.request('/api/repos/owner/alpha/issues/3/order', {
      method: 'PUT',
      body: { fingerprint: cNow.fingerprint, previous: 5000, next: 6000 },
    }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);

  // Partial multi-issue write failure reports partial_order honestly
  const aPre = await getIssue(1);
  const bPre = await getIssue(2);
  let patchCount = 0;
  fake.setPatchHook(() => {
    patchCount += 1;
    if (patchCount === 2) return { status: 412, payload: { message: 'Precondition Failed' } };
    return null;
  });
  const partial = await client.request('/api/repos/owner/alpha/issues/1/order', {
    method: 'PUT',
    body: {
      fingerprint: aPre.fingerprint,
      updates: [
        { repo: 'owner/alpha', number: 2, fingerprint: bPre.fingerprint, order: 7000 },
        { repo: 'owner/alpha', number: 1, fingerprint: aPre.fingerprint, order: 8000 },
      ],
    },
  });
  fake.setPatchHook(null);
  assert.equal(partial.status, 409);
  assert.equal(partial.json.error, 'partial_order');
  assert.equal(parseOrderMarker(fake.findIssue(2).body), 7000);
});

test('an empty friendly-title heading cannot expose hidden order marker as title', () => {
  const raw = makeIssue({ number: 1, title: 'Technical title', body: '### Friendly Title:\n<!-- board-order: 5 -->' });
  assert.doesNotMatch(JSON.stringify(buildIssueDetail(raw)), /<!-- board-order/);
  assert.doesNotMatch(JSON.stringify(buildBoardListItem(raw)), /<!-- board-order/);
});

test('F9: default startBoard and browserConfig isolate project-names.json per fixture and clean up on close', async (t) => {
  const standInTmp = await fs.mkdtemp(path.join('/tmp/antigravity', 'f9-isolation-'));
  const previousTmp = process.env.TMPDIR;
  process.env.TMPDIR = standInTmp;
  const fake = await startFakeGitHub({ repo: 'owner/repo' });
  let first;
  let second;
  try {
    first = await startBoard(fake);
    second = await startBoard(fake);
    assert.notEqual(path.dirname(first.sessionFile), path.dirname(second.sessionFile));
    const a = new HttpSession(first.url);
    const b = new HttpSession(second.url);
    await a.login();
    await b.login();
    const put = await a.request('/api/project-names', {
      method: 'PUT',
      body: { repository: 'owner/repo', name: 'Isolated Name' },
    });
    assert.equal(put.status, 200);
    const seenByB = await b.request('/api/project-names');
    assert.deepEqual(seenByB.json.projectNames, {});
    const dirA = path.dirname(first.sessionFile);
    const dirB = path.dirname(second.sessionFile);
    await first.app.close();
    first = null;
    await second.app.close();
    second = null;
    await assert.rejects(fs.access(dirA));
    await assert.rejects(fs.access(dirB));
  } finally {
    if (previousTmp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTmp;
    if (first) await first.app.close();
    if (second) await second.app.close();
    await fake.close();
    await fs.rm(standInTmp, { recursive: true, force: true });
  }
});
