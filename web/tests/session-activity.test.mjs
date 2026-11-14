import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  extractIssueRefs,
  SessionActivityTracker,
  createSessionActivityTracker,
} from '../server/session-activity.ts';

// A local service stands in for OpenChamber or Triggers. Tests own every
// fixture, so a failure here never reads or writes real session state.
async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    }),
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('extractIssueRefs reads owner/repo#number into lowercase keys', () => {
  assert.deepEqual(extractIssueRefs('Closes Owner/Repo#42 today'), ['owner/repo#42']);
});

test('extractIssueRefs uses defaultRepo for bare issue numbers', () => {
  assert.deepEqual(extractIssueRefs('Fix #42 and #7', 'Owner/Repo'), ['owner/repo#42', 'owner/repo#7']);
});

test('extractIssueRefs reads multiple mixed refs in order without duplicates', () => {
  assert.deepEqual(
    extractIssueRefs('a/b#1 then c/d#2 then #1 and A/B#1', 'e/f'),
    ['a/b#1', 'c/d#2', 'e/f#1'],
  );
});

test('extractIssueRefs ignores invalid numbers and bare refs without a repo', () => {
  assert.deepEqual(extractIssueRefs('#0 #abc a/b#0'), []);
  assert.deepEqual(extractIssueRefs('Fix #42'), []);
  assert.deepEqual(extractIssueRefs('a/b#1', 'not-a-repo'), ['a/b#1']);
});

test('an unconfigured tracker reports unavailable without fetching', async () => {
  let fetched = 0;
  const tracker = new SessionActivityTracker({
    fetchFn: () => {
      fetched += 1;
      throw new Error('must not fetch');
    },
  });
  const snapshot = await tracker.getSnapshot();
  assert.equal(snapshot.available, false);
  assert.equal(snapshot.degraded, false);
  assert.equal(snapshot.fetchedAt, null);
  assert.deepEqual(snapshot.activeByIssue, {});
  assert.equal(fetched, 0);
});

test('invalid or non-http URLs are treated as unconfigured', async () => {
  const tracker = createSessionActivityTracker({
    openchamberUrl: 'ftp://example.test',
    triggersUrl: 'not a url',
    fetchFn: () => {
      throw new Error('must not fetch');
    },
  });
  const snapshot = await tracker.getSnapshot();
  assert.equal(snapshot.available, false);
  assert.equal(snapshot.degraded, false);
  assert.deepEqual(snapshot.activeByIssue, {});
});

test('a busy session maps to its issue and an idle session is ignored', async () => {
  const calls = [];
  const tracker = new SessionActivityTracker({
    openchamberUrl: 'http://127.0.0.1:9',
    fetchFn: async (url) => {
      calls.push(String(url));
      return json({
        ses_busy: { type: 'busy', title: 'owner/repo#42 running' },
        ses_idle: { type: 'idle', title: 'owner/repo#43 finished' },
      });
    },
  });
  const snapshot = await tracker.getSnapshot();
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.degraded, false);
  assert.equal(typeof snapshot.fetchedAt, 'string');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/api\/session\/status$/);
  assert.deepEqual(snapshot.activeByIssue['owner/repo#42'], {
    active: true,
    sessionId: 'ses_busy',
    source: 'openchamber',
    updatedAt: snapshot.fetchedAt,
  });
  assert.equal('owner/repo#43' in snapshot.activeByIssue, false);
});

test('an array-shaped status payload is read too', async () => {
  const tracker = new SessionActivityTracker({
    openchamberUrl: 'http://127.0.0.1:9',
    fetchFn: async () =>
      json({ sessions: [{ id: 'ses_1', type: 'busy', title: 'Owner/Repo#5 work' }] }),
  });
  const snapshot = await tracker.getSnapshot();
  assert.deepEqual(Object.keys(snapshot.activeByIssue), ['owner/repo#5']);
});

test('triggers and openchamber combine: trigger sessionId resolves the issue ref', async () => {
  const tracker = new SessionActivityTracker({
    openchamberUrl: 'http://127.0.0.1:9',
    triggersUrl: 'http://127.0.0.1:10',
    repoByDirectory: { '/workspace/code/acme': 'Acme/Widgets' },
    fetchFn: async (url) => {
      if (String(url).endsWith('/state')) {
        return json({
          triggers: [
            { id: 'nightly', name: 'Acme/Widgets#77 nightly', sessionId: 'ses_9', action: { directory: '/workspace/code/acme' } },
            { id: 'idle-flag', name: 'Acme/Widgets#78 idle', sessionId: 'ses_10', active: true, action: { directory: '/workspace/code/acme' } },
          ],
        });
      }
      return json({
        ses_9: { type: 'busy' },
        ses_10: { type: 'idle' },
      });
    },
  });
  const snapshot = await tracker.getSnapshot();
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.degraded, false);
  assert.deepEqual(snapshot.activeByIssue['acme/widgets#77'], {
    active: true,
    sessionId: 'ses_9',
    source: 'openchamber',
    updatedAt: snapshot.fetchedAt,
  });
  // OpenChamber says this session is idle, so the trigger's own flag cannot
  // keep a finished card spinning.
  assert.equal('acme/widgets#78' in snapshot.activeByIssue, false);
});

test('a trigger with an explicit active flag is used when openchamber is absent', async () => {
  const tracker = new SessionActivityTracker({
    triggersUrl: 'http://127.0.0.1:10',
    repoByDirectory: { '/workspace/code/acme': 'acme/widgets' },
    fetchFn: async () =>
      json({ triggers: [{ id: 'run', sessionId: 'ses_3', running: true, action: { directory: '/workspace/code/acme' }, name: '#12 sweep' }] }),
  });
  const snapshot = await tracker.getSnapshot();
  assert.deepEqual(snapshot.activeByIssue['acme/widgets#12'], {
    active: true,
    sessionId: 'ses_3',
    source: 'triggers',
    updatedAt: snapshot.fetchedAt,
  });
});

test('a 404 on the first status path falls back to /session/status', async () => {
  const server = await startServer((req, res) => {
    if (req.url === '/session/status') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ses_1: { type: 'busy', title: 'owner/repo#8' } }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"not found"}');
  });
  try {
    const tracker = new SessionActivityTracker({ openchamberUrl: server.url });
    const snapshot = await tracker.getSnapshot();
    assert.equal(snapshot.available, true);
    assert.equal(snapshot.degraded, false);
    assert.equal(snapshot.activeByIssue['owner/repo#8']?.sessionId, 'ses_1');
  } finally {
    await server.close();
  }
});

test('the TTL cache reuses one fetch and forceRefresh bypasses it', async () => {
  let calls = 0;
  const tracker = new SessionActivityTracker({
    openchamberUrl: 'http://127.0.0.1:9',
    ttlMs: 5000,
    fetchFn: async () => {
      calls += 1;
      return json({ ses_1: { type: 'busy', title: 'owner/repo#1' } });
    },
  });
  const first = await tracker.getSnapshot();
  const second = await tracker.getSnapshot();
  assert.equal(calls, 1);
  assert.equal(second.fetchedAt, first.fetchedAt);
  await tracker.getSnapshot({ forceRefresh: true });
  assert.equal(calls, 2);

  const fresh = new SessionActivityTracker({
    openchamberUrl: 'http://127.0.0.1:9',
    ttlMs: 0,
    fetchFn: async () => {
      calls += 1;
      return json({});
    },
  });
  await fresh.getSnapshot();
  await fresh.getSnapshot();
  assert.equal(calls, 4);
});

test('concurrent callers share a single in-flight fetch', async () => {
  let calls = 0;
  let release;
  const tracker = new SessionActivityTracker({
    openchamberUrl: 'http://127.0.0.1:9',
    ttlMs: 5000,
    fetchFn: () => {
      calls += 1;
      return new Promise((resolve) => {
        release = () => resolve(json({ ses_1: { type: 'busy', title: 'owner/repo#2' } }));
      });
    },
  });
  const pending = [tracker.getSnapshot(), tracker.getSnapshot(), tracker.getSnapshot()];
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  const snapshots = await Promise.all(pending);
  assert.equal(calls, 1);
  for (const snapshot of snapshots) {
    assert.equal(snapshot.activeByIssue['owner/repo#2']?.sessionId, 'ses_1');
  }
});

test('a hung source times out into a safe snapshot', async () => {
  const server = await startServer(() => {
    // Accept the request and never answer: only the timeout can end this.
  });
  try {
    const tracker = new SessionActivityTracker({ openchamberUrl: server.url, timeoutMs: 150, ttlMs: 0 });
    const started = Date.now();
    const snapshot = await tracker.getSnapshot();
    assert.equal(snapshot.available, false);
    assert.equal(snapshot.degraded, true);
    assert.deepEqual(snapshot.activeByIssue, {});
    assert.ok(Date.now() - started < 3000, 'the timeout must bound the wait');
  } finally {
    await server.close();
  }
});

test('a 5xx response degrades without throwing', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"error":"boom"}');
  });
  try {
    const tracker = new SessionActivityTracker({ triggersUrl: server.url });
    const snapshot = await tracker.getSnapshot();
    assert.equal(snapshot.available, false);
    assert.equal(snapshot.degraded, true);
    assert.deepEqual(snapshot.activeByIssue, {});
  } finally {
    await server.close();
  }
});

test('malformed JSON degrades without throwing', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('not json at all');
  });
  try {
    const tracker = new SessionActivityTracker({ openchamberUrl: server.url });
    const snapshot = await tracker.getSnapshot();
    assert.equal(snapshot.available, false);
    assert.equal(snapshot.degraded, true);
    assert.deepEqual(snapshot.activeByIssue, {});
  } finally {
    await server.close();
  }
});

test('one failing source still reports the healthy one as available but degraded', async () => {
  const tracker = new SessionActivityTracker({
    openchamberUrl: 'http://127.0.0.1:9',
    triggersUrl: 'http://127.0.0.1:10',
    fetchFn: async (url) => {
      if (String(url).endsWith('/state')) {
        return json({ triggers: [{ id: 't', sessionId: 'ses_4', running: true, name: 'owner/repo#4' }] });
      }
      throw new Error('connection refused');
    },
  });
  const snapshot = await tracker.getSnapshot();
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.degraded, true);
  assert.equal(snapshot.activeByIssue['owner/repo#4']?.source, 'triggers');
});
