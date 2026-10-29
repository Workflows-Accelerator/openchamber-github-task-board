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
test('move creates target first, links source, then closes source without deleting it', async (t) => {
  const { fake, client } = await fixture(t);
  const moved = await client.request(endpoint + '/move', { method: 'PUT', body: { fingerprint: await fingerprint(client), target: 'owner/beta' } });
  assert.equal(moved.status, 200, moved.text);
  assert.equal(fake.findIssue(1).state, 'closed');
  const target = fake.findIssue(1, 'owner/beta');
  assert.equal(target.title, 'Idea'); assert.equal(target.state, 'open');
  assert.equal(parseOrderMarker(target.body), 1000);
  assert.match(fake.state.commentCalls[0].payload.body, /https:\/\/github.com\/owner\/beta\/issues\/1/);
  const writes = fake.requests.filter((r) => r.method !== 'GET');
  assert.deepEqual(writes.map((r) => r.method + ' ' + r.path), ['POST /repos/owner/beta/issues', 'POST /repos/owner/alpha/issues/1/comments', 'PATCH /repos/owner/alpha/issues/1']);
});
test('failed target create never comments or closes source', async (t) => {
  const { fake, client } = await fixture(t);
  const fp = await fingerprint(client); fake.setRepoFailing('owner/beta', true);
  assert.equal((await client.request(endpoint + '/move', { method: 'PUT', body: { fingerprint: fp, target: 'owner/beta' } })).status, 502);
  assert.equal(fake.findIssue(1).state, 'open');
  assert.equal(fake.state.commentCalls.length, 0); assert.equal(fake.patchCalls.length, 0);
});
test('halfway move failure returns target link and explicit no-retry warning', async (t) => {
  const { fake, client } = await fixture(t, { patchHook: () => ({ status: 500 }) });
  const moved = await client.request(endpoint + '/move', { method: 'PUT', body: { fingerprint: await fingerprint(client), target: 'owner/beta' } });
  assert.equal(moved.status, 409); assert.equal(moved.json.error, 'partial_move');
  assert.match(moved.json.targetUrl, /owner\/beta\/issues\/1/);
  assert.match(moved.json.message, /Do not repeat move/);
  assert.equal(fake.findIssue(1).state, 'open'); assert.ok(fake.findIssue(1, 'owner/beta'));
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
test('failed link comment leaves source open with target link and no blind move retry', async (t) => {
  const { client, fake } = await fixture(t, { commentHook: () => ({ status: 500 }) });
  const result = await client.request(endpoint + '/move', { method: 'PUT', body: { fingerprint: await fingerprint(client), target: 'owner/beta' } });
  assert.equal(result.status, 409); assert.equal(result.json.error, 'partial_move');
  assert.match(result.json.targetUrl, /owner\/beta\/issues\/1/);
  assert.equal(fake.findIssue(1).state, 'open'); assert.equal(fake.patchCalls.length, 0);
});

test('an empty friendly-title heading cannot expose hidden order marker as title', () => {
  const raw = makeIssue({ number: 1, title: 'Technical title', body: '### Friendly Title:\n<!-- board-order: 5 -->' });
  assert.doesNotMatch(JSON.stringify(buildIssueDetail(raw)), /<!-- board-order/);
  assert.doesNotMatch(JSON.stringify(buildBoardListItem(raw)), /<!-- board-order/);
});
