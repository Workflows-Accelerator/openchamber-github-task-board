import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createCoordinatorHostServer } from '../service/main.ts';
import { SnapshotStore } from '../service/snapshot.ts';

/**
 * The three Work Status routes over real HTTP, with the bearer check first.
 * Every rejection must leave the stored snapshot byte-identical, so each test
 * reads `/status` before and after.
 */

const TOKEN = 'route-test-token';
const NOW = 1_763_136_000_000;
const DIRECTORY = '/workspace/project-a';

async function start(options = {}) {
  const snapshotStore = options.snapshotStore ?? new SnapshotStore();
  const server = createCoordinatorHostServer(TOKEN, () => 'running', {
    snapshotStore,
    now: options.now ?? (() => NOW),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    port,
    snapshotStore,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function request(port, { method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function snapshotBody(overrides = {}) {
  return JSON.stringify({
    v: 1,
    directory: DIRECTORY,
    at: NOW - 1_000,
    complete: true,
    counts: { needsMe: 8, running: 2, blocked: 1, done: 12, total: 40 },
    top: { repo: 'owner/repo', number: 123, title: 'Fix the parser' },
    ...overrides,
  });
}

async function statusJson(port, query = '') {
  const res = await request(port, { path: `/status${query}`, headers: AUTH });
  assert.equal(res.status, 200);
  return JSON.parse(res.body);
}

test('status-routes: /status and /snapshot refuse a request without the bearer and leak nothing', async () => {
  const app = await start();
  try {
    await request(app.port, { method: 'POST', path: '/snapshot', headers: { 'Content-Type': 'application/json' }, body: snapshotBody() });

    for (const [method, path, body] of [
      ['GET', '/status?directory=/workspace/project-a', null],
      ['POST', '/snapshot', snapshotBody()],
    ]) {
      for (const headers of [{}, { Authorization: 'Bearer wrong-token' }, { Authorization: 'Basic abc' }]) {
        const res = await request(app.port, { method, path, headers, body });
        assert.equal(res.status, 401, `${method} ${path}`);
        assert.deepEqual(JSON.parse(res.body), { error: 'Unauthorized' });
        assert.equal(res.body.includes('tasks'), false);
        assert.equal(res.body.includes('owner/repo'), false);
        assert.equal(res.headers['access-control-allow-origin'], undefined);
      }
    }
    // Nothing was stored by the unauthenticated attempts.
    const view = await statusJson(app.port, `?directory=${encodeURIComponent(DIRECTORY)}`);
    assert.equal(view.rows[0].id, 'empty');
  } finally {
    await app.close();
  }
});

test('status-routes: methods are confined and /session-events answers ok', async () => {
  const app = await start();
  try {
    const postStatus = await request(app.port, { method: 'POST', path: '/status', headers: AUTH });
    assert.equal(postStatus.status, 405);
    const getSnapshot = await request(app.port, { path: '/snapshot', headers: AUTH });
    assert.equal(getSnapshot.status, 405);

    const event = JSON.stringify({
      v: 1,
      requestId: 'req-1',
      event: {
        id: 'evt-1',
        type: 'turn-started',
        at: NOW,
        session: { id: 'ses-1', parentId: null },
        project: { directory: DIRECTORY },
        linked: [],
      },
    });
    const postEvent = await request(app.port, { method: 'POST', path: '/session-events', headers: AUTH, body: event });
    assert.equal(postEvent.status, 200);
    assert.deepEqual(JSON.parse(postEvent.body), { ok: true });

    const badEvent = await request(app.port, { method: 'POST', path: '/session-events', headers: AUTH, body: '{}' });
    assert.equal(badEvent.status, 400);
  } finally {
    await app.close();
  }
});

test('status-routes: a valid snapshot answers 204 and /status renders the six rows', async () => {
  const app = await start();
  try {
    const write = await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: snapshotBody() });
    assert.equal(write.status, 204);

    const res = await request(app.port, { path: `/status?directory=${encodeURIComponent(DIRECTORY)}&locale=en`, headers: AUTH });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['access-control-allow-origin'], undefined);

    const view = JSON.parse(res.body);
    assert.equal(view.rows.length, 6);
    assert.deepEqual(view.rows.map((row) => row.id), ['needs-me', 'top', 'progress', 'running', 'blocked', 'age']);
    assert.equal(view.rows[0].value, '8 tasks');
    assert.equal(view.rows[1].value, 'owner/repo#123 Fix the parser');
    assert.equal(view.rows[2].value, '12 of 40 done');
    assert.equal(view.rows[3].value, '2 running');
    assert.equal(view.rows[4].value, '1 task');
    assert.equal(view.rows[5].tone, 'muted');
  } finally {
    await app.close();
  }
});

test('status-routes: the section is per directory and never shows another project counts', async () => {
  const app = await start();
  try {
    await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: snapshotBody() });

    const other = await statusJson(app.port, `?directory=${encodeURIComponent('/workspace/project-b')}`);
    assert.deepEqual(other.rows, [{
      kind: 'note',
      id: 'empty',
      text: 'No board data yet. Open the board once to load it.',
      tone: 'muted',
    }]);
    assert.equal(JSON.stringify(other).includes('8 tasks'), false);

    const missing = await statusJson(app.port, '');
    assert.equal(missing.rows[0].id, 'empty');
  } finally {
    await app.close();
  }
});

test('status-routes: locale fr and fr-CA answer French, en answers English', async () => {
  const app = await start();
  try {
    await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: snapshotBody() });
    const path = `?directory=${encodeURIComponent(DIRECTORY)}`;

    for (const locale of ['fr', 'fr-CA', 'fr-FR']) {
      const view = await statusJson(app.port, `${path}&locale=${locale}`);
      assert.equal(view.rows[0].label, 'À traiter', locale);
      assert.equal(view.rows[2].value, '12 sur 40 terminées', locale);
    }
    const english = await statusJson(app.port, `${path}&locale=en`);
    assert.equal(english.rows[0].label, 'Needs me');
    assert.equal(english.rows[2].value, '12 of 40 done');
  } finally {
    await app.close();
  }
});

test('status-routes: every rejected body answers 400 and leaves the snapshot byte-identical', async () => {
  const app = await start();
  try {
    await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: snapshotBody() });
    const before = await statusJson(app.port, `?directory=${encodeURIComponent(DIRECTORY)}`);
    const beforeJson = JSON.stringify(before);

    const rejected = [
      snapshotBody({ extra: 1 }),
      snapshotBody().replace('"v":1', '"v":1,"__proto__":{"polluted":true}'),
      snapshotBody({ v: '1' }),
      snapshotBody({ complete: false }),
      snapshotBody({ at: String(NOW) }),
      snapshotBody({ at: NOW - 200_000 }),
      snapshotBody({ at: NOW + 200_000 }),
      snapshotBody({ counts: { needsMe: 0, running: 0, blocked: 0, done: 0, total: 0 }, top: { repo: 'owner/repo', number: 1, title: 't' } }),
      snapshotBody({ counts: { needsMe: 10_000, running: 0, blocked: 0, done: 0, total: 1 } }),
      snapshotBody({ top: { repo: 'not-a-repo', number: 1, title: 't' } }),
      'not json',
    ];

    for (const body of rejected) {
      const res = await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body });
      assert.equal(res.status, 400, body.slice(0, 60));
      assert.deepEqual(JSON.parse(res.body), { error: 'invalid_snapshot' });
      const after = await statusJson(app.port, `?directory=${encodeURIComponent(DIRECTORY)}`);
      assert.equal(JSON.stringify(after), beforeJson);
    }
  } finally {
    await app.close();
  }
});

test('status-routes: an oversize body answers 413 and the snapshot survives', async () => {
  const app = await start();
  try {
    await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: snapshotBody() });
    const before = JSON.stringify(await statusJson(app.port, `?directory=${encodeURIComponent(DIRECTORY)}`));

    const oversize = JSON.stringify({ padding: 'a'.repeat(20_000) });
    const res = await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: oversize });
    assert.equal(res.status, 413);

    const after = JSON.stringify(await statusJson(app.port, `?directory=${encodeURIComponent(DIRECTORY)}`));
    assert.equal(after, before);
  } finally {
    await app.close();
  }
});

test('status-routes: a non-JSON content type answers 415', async () => {
  const app = await start();
  try {
    const res = await request(app.port, {
      method: 'POST',
      path: '/snapshot',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'text/plain' },
      body: snapshotBody(),
    });
    assert.equal(res.status, 415);
  } finally {
    await app.close();
  }
});

test('status-routes: the 11th write in a minute answers 429 and the last good snapshot survives', async () => {
  const app = await start();
  try {
    for (let index = 1; index <= 10; index++) {
      const body = snapshotBody({
        counts: { needsMe: index, running: 0, blocked: 0, done: 0, total: index },
        top: { repo: 'owner/repo', number: index, title: `Task ${index}` },
      });
      const res = await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body });
      assert.equal(res.status, 204, `write ${index}`);
    }

    const eleventh = snapshotBody({
      counts: { needsMe: 99, running: 0, blocked: 0, done: 0, total: 99 },
      top: { repo: 'owner/repo', number: 99, title: 'Should not land' },
    });
    const res = await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: eleventh });
    assert.equal(res.status, 429);
    assert.equal(res.headers['retry-after'], '60');

    const view = await statusJson(app.port, `?directory=${encodeURIComponent(DIRECTORY)}&locale=en`);
    assert.equal(view.rows[0].value, '10 tasks');
    assert.equal(view.rows[1].value, 'owner/repo#10 Task 10');
  } finally {
    await app.close();
  }
});

test('status-routes: the 31st attempt in a minute answers 429 even when each body is invalid', async () => {
  const app = await start();
  try {
    for (let index = 0; index < 30; index++) {
      const res = await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: 'not json' });
      assert.equal(res.status, 400, `attempt ${index + 1}`);
    }
    const res = await request(app.port, { method: 'POST', path: '/snapshot', headers: AUTH, body: 'not json' });
    assert.equal(res.status, 429);
  } finally {
    await app.close();
  }
});
