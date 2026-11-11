// V3-6 regression suite: a canvas drag must persist through GitHub and survive
// a reload.
//
// The live defect was a conditional header on an unsafe request. GitHub answers
// any issue PATCH that carries If-Match with
//   400 Conditional request headers are not allowed in unsafe requests
// and applies nothing, so every drag was rejected before the write and surfaced
// as an "unknown outcome". These tests exercise the real server against the
// fake GitHub (which now models that refusal) and pin the contract:
//   * a drag persists, and a re-read returns the dropped coordinates;
//   * a drag still works when the page load ended in a conditional 304;
//   * a refusal is reported with its real cause and status, never as unknown;
//   * a genuinely unknown upstream outcome keeps the write_outcome_unknown code.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCanvasMarker } from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession } from './helpers.mjs';

const REPO = 'Workflows-Accelerator/openchamber-github-task-board';

function fixture() {
  return makeIssue({
    number: 42,
    title: 'Drag me',
    body: '## Overview\r\nCanvas drag target.\r\n\r\n<!-- board-order: 1000 -->',
    labels: ['status:in-progress'],
    repo: REPO,
  });
}

async function boot(t, options = {}) {
  const fake = await startFakeGitHub({ repo: REPO, issues: [fixture()], ...options });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });
  const session = new HttpSession(board.url);
  await session.login();
  return { fake, board, session };
}

async function boardItem(session) {
  const res = await session.request('/api/board');
  assert.equal(res.status, 200, res.text);
  const item = res.json.issues.find((issue) => issue.number === 42);
  assert.ok(item, 'issue 42 must be on the board');
  return item;
}

test('V3-6 canvas drag: write persists the dropped position and a re-read returns it', async (t) => {
  const { fake, session } = await boot(t);
  const item = await boardItem(session);

  const saved = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 640, y: 480, fingerprint: item.fingerprint },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.deepEqual(saved.json.listItem.canvas, { x: 640, y: 480 });

  // The write reaches GitHub instead of being rejected by a conditional header.
  assert.equal(fake.patchCalls.length, 1, 'exactly one PATCH dispatched');
  assert.equal(fake.patchCalls[0].ifMatch, undefined, 'no If-Match on an unsafe request');

  const persisted = fake.findIssue(42).body;
  assert.deepEqual(parseCanvasMarker(persisted), { x: 640, y: 480 }, 'issue body carries the dropped coordinates');
  assert.ok(persisted.includes('## Overview\r\nCanvas drag target.'), 'body prose untouched');

  const reread = await session.request('/api/board?refresh=1');
  const reloaded = reread.json.issues.find((issue) => issue.number === 42);
  assert.deepEqual(reloaded.canvas, { x: 640, y: 480 }, 'board re-read returns the persisted position');
  assert.equal(reloaded.fingerprint, saved.json.listItem.fingerprint, 'client can chain the next drag');
});

test('V3-6 canvas drag: a write issued right after a conditional 304 GET still persists', async (t) => {
  const { fake, session } = await boot(t);
  const first = await session.request('/api/board');
  assert.equal(first.status, 200);
  const etag = first.headers.get('etag');
  assert.ok(etag, 'board GET carries an ETag');

  const conditional = await session.request('/api/board', { headers: { 'If-None-Match': etag } });
  assert.equal(conditional.status, 304, 'unchanged board revalidates as 304');
  assert.equal(conditional.text, '', '304 has no body');

  const item = first.json.issues.find((issue) => issue.number === 42);
  const saved = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 120, y: 240, fingerprint: item.fingerprint },
  });
  assert.equal(saved.status, 200, saved.text);
  assert.deepEqual(parseCanvasMarker(fake.findIssue(42).body), { x: 120, y: 240 });

  // After the write the cached board is invalidated, so the next conditional
  // GET must revalidate against the new content rather than replay a 304.
  const after = await session.request('/api/board', { headers: { 'If-None-Match': etag } });
  assert.equal(after.status, 200, 'stale ETag must not revalidate after a write');
  const updated = after.json.issues.find((issue) => issue.number === 42);
  assert.deepEqual(updated.canvas, { x: 120, y: 240 });
  assert.notEqual(after.headers.get('etag'), etag, 'board ETag changes with the new position');
});

test('V3-6 canvas drag: a second drag of the same card updates the marker once and stays byte-stable', async (t) => {
  const { fake, session } = await boot(t);
  const item = await boardItem(session);

  const firstDrop = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 200, y: 300, fingerprint: item.fingerprint },
  });
  assert.equal(firstDrop.status, 200, firstDrop.text);
  const bodyAfterFirst = fake.findIssue(42).body;

  const secondDrop = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 360, y: 420, fingerprint: firstDrop.json.listItem.fingerprint },
  });
  assert.equal(secondDrop.status, 200, secondDrop.text);
  const bodyAfterSecond = fake.findIssue(42).body;

  assert.equal((bodyAfterSecond.match(/board-canvas/g) || []).length, 1, 'exactly one canvas marker');
  assert.deepEqual(parseCanvasMarker(bodyAfterSecond), { x: 360, y: 420 });
  assert.equal(
    bodyAfterSecond,
    bodyAfterFirst.replace('{"x":200,"y":300}', '{"x":360,"y":420}'),
    'only the marker payload changes between drops',
  );
});

test('V3-6 canvas drag: a stale fingerprint is a precise 409 and never a silent move', async (t) => {
  const { fake, session } = await boot(t);
  const item = await boardItem(session);
  const before = fake.findIssue(42).body;

  const stale = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 10, y: 20, fingerprint: 'a'.repeat(64) },
  });
  assert.equal(stale.status, 409, stale.text);
  assert.equal(stale.json.error, 'conflict');
  assert.match(stale.json.message, /changed on GitHub/i);
  assert.match(stale.json.message, /nothing was written/i);
  assert.equal(fake.findIssue(42).body, before, 'a refused move writes nothing');
  assert.equal(fake.patchCalls.length, 0, 'no PATCH is dispatched for a stale fingerprint');
});

test('V3-6 canvas drag: a GitHub refusal is reported as a definite 400, not an unknown outcome', async (t) => {
  const { fake, session } = await boot(t);
  const item = await boardItem(session);
  const before = fake.findIssue(42).body;

  // The exact refusal real GitHub returns for a conditional unsafe request.
  fake.setPatchHook(() => ({
    status: 400,
    payload: {
      message: 'Bad Request',
      errors: ['Conditional request headers are not allowed in unsafe requests unless supported by the endpoint'],
    },
  }));

  const refused = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 640, y: 480, fingerprint: item.fingerprint },
  });
  assert.equal(refused.status, 400, refused.text);
  assert.equal(refused.json.error, 'write_rejected', 'a definite refusal must not reuse write_outcome_unknown');
  assert.match(refused.json.message, /rejected the write/i);
  assert.match(refused.json.message, /nothing was saved/i);
  assert.match(refused.json.message, /Conditional request headers are not allowed/i, 'the upstream reason survives');
  assert.equal(fake.findIssue(42).body, before, 'nothing was written');
});

test('V3-6 canvas drag: a genuinely unknown upstream outcome keeps write_outcome_unknown', async (t) => {
  const { fake, session } = await boot(t);
  const item = await boardItem(session);

  // Gateway commits the body, then returns an unreadable 5xx: the outcome truly
  // cannot be known, so the client must still see write_outcome_unknown.
  fake.setPatchHook((issue, patch) => {
    issue.body = patch.body;
    return { status: 500, rawBody: '<h1>Bad Gateway</h1>', headers: { 'content-type': 'text/html' } };
  });

  const unknown = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 640, y: 480, fingerprint: item.fingerprint },
  });
  assert.equal(unknown.status, 502, unknown.text);
  assert.equal(unknown.json.error, 'write_outcome_unknown');
});

test('V3-6 canvas drag: a rate-limited write keeps its cause instead of becoming unknown', async (t) => {
  const { fake, session } = await boot(t);
  const item = await boardItem(session);
  const before = fake.findIssue(42).body;

  fake.setPatchHook(() => ({
    status: 429,
    payload: { message: 'Too Many Requests' },
    headers: { 'x-ratelimit-remaining': '0' },
  }));

  const limited = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 1, y: 2, fingerprint: item.fingerprint },
  });
  // GitHub answered before applying anything, so the board must forward the
  // cause (503 github_rate_limited) and never the UNKNOWN outcome the client
  // would turn into "refresh, then drag again".
  assert.equal(limited.status, 503, limited.text);
  assert.equal(limited.json.error, 'github_rate_limited');
  assert.equal(fake.findIssue(42).body, before, 'a rate-limited write wrote nothing');
});

test('V3-6 canvas drag: a rejected token keeps its cause instead of becoming unknown', async (t) => {
  const { fake, session } = await boot(t);
  const item = await boardItem(session);
  const before = fake.findIssue(42).body;

  fake.setPatchHook(() => ({ status: 401, payload: { message: 'Bad credentials' } }));

  const rejected = await session.request('/api/issues/42/canvas', {
    method: 'PUT',
    body: { x: 1, y: 2, fingerprint: item.fingerprint },
  });
  assert.equal(rejected.status, 502, rejected.text);
  assert.equal(rejected.json.error, 'github_unauthorized');
  assert.match(rejected.json.message, /token|credentials/i);
  assert.equal(fake.findIssue(42).body, before, 'a rejected token wrote nothing');
});

test('V3-6 fake GitHub: unsafe requests carrying If-Match are refused exactly like GitHub', async () => {
  const fake = await startFakeGitHub({ repo: REPO, issues: [fixture()] });
  try {
    const response = await fetch(`${fake.url}/repos/${REPO}/issues/42`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${fake.token}`, 'content-type': 'application/json', 'if-match': 'W/"weak-etag"' },
      body: JSON.stringify({ body: 'nope' }),
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.deepEqual(payload.errors, ['Conditional request headers are not allowed in unsafe requests unless supported by the endpoint']);
    assert.equal(fake.findIssue(42).body, fixture().body, 'refused write applied nothing');
  } finally {
    await fake.close();
  }
});

test('V3-6 canvas client: known failures name the cause in EN and FR, unknown stays unknown', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const js = fs.readFileSync(path.resolve(here, '../public/app.js'), 'utf8');

  for (const key of [
    'canvas_save_rejected',
    'canvas_save_conflict',
    'canvas_save_forbidden',
    'canvas_save_rate_limited',
    'canvas_save_signed_out',
    'canvas_save_unknown',
    'canvas_save_timeout',
  ]) {
    const occurrences = js.split(key + ':').length - 1;
    assert.ok(occurrences >= 2, `${key} must exist in both language dictionaries`);
  }

  assert.match(js, /function canvasMoveFailureMessage\(/, 'card-move failures route through one named-cause helper');
  assert.match(js, /code === 'write_outcome_unknown'/, 'unknown outcomes keep their own message');
  assert.match(js, /status >= 400 && status < 500/, 'definite refusals report their HTTP status');
  // The server maps a rejected token to 502 and a rate limit to 503; both are
  // decided before the GitHub write, so api() must resolve them before its
  // generic 5xx "write_outcome_unknown" branch or the named messages above can
  // never be reached.
  const unauthorizedIdx = js.indexOf("payload.error === 'github_unauthorized'");
  const rateLimitIdx = js.indexOf("payload.error === 'github_rate_limited'");
  const generic5xxIdx = js.indexOf('if (response.status >= 500)');
  assert.ok(unauthorizedIdx !== -1 && rateLimitIdx !== -1, 'api() keeps the GitHub 401 and 429 causes');
  assert.ok(
    unauthorizedIdx < generic5xxIdx && rateLimitIdx < generic5xxIdx,
    'the precise causes are resolved before the generic 5xx outcome',
  );
  assert.doesNotMatch(
    js,
    /} else if \(err && err\.message && l === 'en'\) \{/,
    'the old English-only passthrough of generic server messages is gone',
  );
});
