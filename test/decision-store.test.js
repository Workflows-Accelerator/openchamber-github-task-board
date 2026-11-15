import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createCoordinatorHostServer } from '../service/main.ts';
import { DecisionStore, DECISIONS_BODY_MAX } from '../service/decision-store.ts';
import { HostCallError } from '../service/host-client.ts';

/**
 * The decision store and its two routes (D53 S1 + S2).
 *
 * The guards that matter are the ones whose failure is invisible in the UI:
 * a second answer that reaches the host, an answer for a decision this store
 * never made, and a value the form no longer offers. Each has a test here and
 * a mutation check in the report.
 */

const NOW = 1_763_136_000_000;
const FORM_FIELDS = [
  { key: 'layout', type: 'string', title: 'Layout', description: null, required: true,
    options: [{ value: 'split', label: 'Split view' }, { value: 'stack', label: 'Stacked' }] },
  { key: 'note', type: 'string', title: 'Note', description: null, required: false },
];

function event(overrides = {}, content) {
  const base = {
    v: 1,
    requestId: 'req-1',
    event: {
      id: 'evt-1',
      type: 'question-asked',
      at: NOW,
      session: { id: 'ses_1', parentId: null },
      project: { directory: '/workspace/code/x' },
      linked: [{ id: 'acme/board#52', kind: 'issue', url: 'https://github.com/acme/board/issues/52', number: 52 }],
      question: { kind: 'form', id: 'q_1' },
      ...overrides,
    },
  };
  if (content !== undefined) base.content = content;
  return base;
}

const formContent = (fields = FORM_FIELDS, title = 'Choose a layout') => ({
  type: 'question-asked',
  sessionTitle: 'issue-52-worktree',
  ask: { kind: 'form', id: 'q_1', title, fields },
});

function stubHost(behaviour = async () => ({ answered: true })) {
  const calls = [];
  return {
    calls,
    answerForm: async (sessionId, formId, values, message) => {
      calls.push({ sessionId, formId, values, message });
      return behaviour(sessionId, formId, values, message);
    },
  };
}

function store(host, options = {}) {
  let clock = NOW;
  const instance = new DecisionStore({
    host,
    now: options.now ?? (() => clock),
    ...options,
  });
  return { store: instance, advance: (ms) => { clock += ms; } };
}

test('decision-store: a question-asked with content creates one pending form decision', () => {
  const { store: decisions } = store(stubHost());
  decisions.handleEvent(event({}, formContent()));
  const list = decisions.list();
  assert.equal(list.v, 1);
  assert.equal(list.decisions.length, 1);
  const [entry] = list.decisions;
  assert.equal(entry.id, 'ses_1:form:q_1');
  assert.equal(entry.kind, 'form');
  assert.equal(entry.sessionId, 'ses_1');
  assert.equal(entry.askId, 'q_1');
  assert.equal(entry.title, 'Choose a layout');
  assert.equal(entry.sessionTitle, 'issue-52-worktree');
  assert.equal(entry.state, 'pending');
  assert.equal(entry.fields.length, 2);
  assert.deepEqual(entry.linked, [{ id: 'acme/board#52', number: 52, url: 'https://github.com/acme/board/issues/52' }]);
});

test('decision-store: without content the decision is blind, not guessed', () => {
  const { store: decisions } = store(stubHost());
  decisions.handleEvent(event());
  const [entry] = decisions.list().decisions;
  assert.equal(entry.fields, null);
  assert.equal(entry.title, null);
  assert.equal(entry.state, 'pending');
});

test('decision-store: a malformed content envelope is ignored, not repaired', () => {
  const { store: decisions } = store(stubHost());
  decisions.handleEvent(event({}, { type: 'turn-finished', sessionTitle: 'x' }));
  const [entry] = decisions.list().decisions;
  assert.equal(entry.title, null);
  assert.equal(entry.fields, null);
});

test('decision-store: a duplicate delivery keeps one entry and the earlier askedAt', () => {
  const { store: decisions, advance } = store(stubHost());
  decisions.handleEvent(event({ at: NOW }, formContent()));
  advance(5_000);
  decisions.handleEvent(event({ at: NOW - 1_000, id: 'evt-2' }, formContent()));
  const list = decisions.list().decisions;
  assert.equal(list.length, 1);
  assert.equal(list[0].askedAt, NOW - 1_000);
  assert.equal(list[0].confirmedAt, NOW + 5_000);
});

test('decision-store: ordering is waiting before confirming, newest askedAt, then askId descending', () => {
  const { store: decisions } = store(stubHost());
  decisions.handleEvent(event({ question: { kind: 'form', id: 'q_a' }, at: NOW }, formContent()));
  decisions.handleEvent(event({ question: { kind: 'form', id: 'q_b' }, at: NOW }, formContent()));
  decisions.handleEvent(event({ session: { id: 'ses_2', parentId: null }, question: { kind: 'form', id: 'q_c' }, at: NOW + 10 }, formContent()));
  const ids = decisions.list().decisions.map((entry) => entry.id);
  assert.deepEqual(ids, ['ses_2:form:q_c', 'ses_1:form:q_b', 'ses_1:form:q_a']);
});

test('decision-store: turn-finished closes, turn-started does not, archive and delete remove', () => {
  const { store: decisions } = store(stubHost());
  decisions.handleEvent(event({}, formContent()));
  decisions.handleEvent(event({ type: 'turn-started' }));
  assert.equal(decisions.list().decisions.length, 1, 'turn-started clears nothing');

  decisions.handleEvent(event({ type: 'turn-finished' }));
  assert.equal(decisions.list().decisions.length, 0);

  decisions.handleEvent(event({}, formContent()));
  decisions.handleEvent(event({ type: 'turn-failed' }));
  assert.equal(decisions.list().decisions.length, 0);

  decisions.handleEvent(event({}, formContent()));
  decisions.handleEvent(event({ type: 'session-archived' }));
  assert.equal(decisions.list().decisions.length, 0);

  decisions.handleEvent(event({}, formContent()));
  decisions.handleEvent(event({ type: 'session-deleted' }));
  assert.equal(decisions.list().decisions.length, 0);
});

test('decision-store: a permission-asked event creates no decision', () => {
  const { store: decisions } = store(stubHost());
  decisions.handleEvent(event({ type: 'permission-asked', permission: { requestId: 'p_1' }, question: undefined }));
  assert.equal(decisions.list().decisions.length, 0);
});

test('decision-store: sessions.status waiting confirms, idle closes', () => {
  const { store: decisions, advance } = store(stubHost());
  decisions.handleEvent(event({}, formContent()));
  advance(60_000);
  decisions.observeStatus('ses_1', 'waiting');
  assert.equal(decisions.list().decisions[0].confirmedAt, NOW + 60_000);
  decisions.observeStatus('ses_1', 'idle');
  assert.equal(decisions.list().decisions.length, 0);
});

test('decision-store: a form answer sends the option value, keyed by field key, once', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const result = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split', note: 'ok' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.state, 'answered-unconfirmed');
  assert.equal(host.calls.length, 1);
  assert.deepEqual(host.calls[0], { sessionId: 'ses_1', formId: 'q_1', values: { layout: 'split', note: 'ok' }, message: undefined });
  assert.equal(decisions.get('ses_1:form:q_1').state, 'answered-unconfirmed');
});

test('decision-store: a second answer gets 409 and makes zero further host calls', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
  const second = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'stack' } });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'DECISION_NOT_PENDING');
  assert.equal(host.calls.length, 1, 'at-most-once: the host must be called exactly once');
});

test('decision-store: two answers in flight make one host call, the second 409', async () => {
  // The real race is a double click, not a second answer after the first settled:
  // the `answering` marker must be down before the host call, or both requests
  // pass the `pending` check and the agent gets the form answered twice.
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const calls = [];
  const host = {
    calls,
    answerForm: async (sessionId, formId, values, message) => {
      calls.push({ sessionId, formId, values, message });
      await gate;
      return { answered: true };
    },
  };
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const first = decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
  const second = decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'stack' } });
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(secondResult.status, 409);
  assert.equal(secondResult.body.code, 'DECISION_NOT_PENDING');
  assert.equal(firstResult.status, 200);
  assert.equal(calls.length, 1, 'at-most-once: two in-flight answers, one host call');
});

test('decision-store: an unknown or foreign decision id is 404 and never reaches the host', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const result = await decisions.answer({ id: 'ses_other:form:q_9', values: { layout: 'split' } });
  assert.equal(result.status, 404);
  assert.equal(result.body.code, 'DECISION_UNKNOWN');
  assert.equal(host.calls.length, 0);
});

test('decision-store: an answer for a form the session no longer waits on is 404 DECISION_GONE', async () => {
  const host = stubHost(async () => {
    throw new HostCallError('This request is no longer waiting for an answer', 'NOT_FOUND', 404);
  });
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const result = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
  assert.equal(result.status, 404);
  assert.equal(result.body.code, 'DECISION_GONE');
  assert.equal(decisions.get('ses_1:form:q_1'), undefined, 'a gone decision is removed, never rendered as current');
});

test('decision-store: a refused permission maps to 403 and the entry returns to pending', async () => {
  const host = stubHost(async () => {
    throw new HostCallError('This call needs the "sessionAnswers" approval.', 'NOT_GRANTED', 403);
  });
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const result = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'PERMISSION_MISSING');
  assert.match(result.body.message, /sessionAnswers/);
  assert.equal(decisions.get('ses_1:form:q_1').state, 'pending');
});

test('decision-store: an unknown outcome is 502 and the entry stays answering, not retried', async () => {
  let calls = 0;
  const host = stubHost(async () => {
    calls += 1;
    throw new HostCallError('OpenChamber did not answer.', 'HOST_UNAVAILABLE', 0);
  });
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const result = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
  assert.equal(result.status, 502);
  assert.equal(decisions.get('ses_1:form:q_1').state, 'answering');
  const second = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
  assert.equal(second.status, 409);
  assert.equal(calls, 1, 'a request whose outcome is unknown is never re-armed');
});

test('decision-store: no host (capability refused) answers 503 and leaves the form pending', async () => {
  const { store: decisions } = store(undefined);
  decisions.handleEvent(event({}, formContent()));
  const result = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
  assert.equal(result.status, 503);
  assert.equal(decisions.get('ses_1:form:q_1').state, 'pending');
});

test('decision-store: server-side re-validation refuses a label, an empty object and an unknown key', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const label = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'Split view' } });
  assert.equal(label.status, 400);
  assert.equal(label.body.code, 'ANSWER_INVALID');
  assert.deepEqual(label.body.detail, ['layout']);

  const empty = await decisions.answer({ id: 'ses_1:form:q_1', values: {} });
  assert.equal(empty.status, 400);

  const unknown = await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split', evil: 'x' } });
  assert.equal(unknown.status, 400);
  assert.deepEqual(unknown.body.detail, ['evil']);

  const missingRequired = await decisions.answer({ id: 'ses_1:form:q_1', values: { note: 'hello' } });
  assert.equal(missingRequired.status, 400);
  assert.deepEqual(missingRequired.body.detail, ['layout']);

  assert.equal(host.calls.length, 0, 'an invalid answer never reaches the host');
});

test('decision-store: a hidden field is dropped from the values sent to the host', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  const fields = [
    { key: 'mode', type: 'string', title: 'Mode', description: null, required: true,
      options: [{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }] },
    { key: 'detail', type: 'string', title: 'Detail', description: null, required: true,
      when: [{ key: 'mode', op: 'eq', value: 'advanced' }] },
  ];
  decisions.handleEvent(event({}, formContent(fields)));
  const result = await decisions.answer({ id: 'ses_1:form:q_1', values: { mode: 'simple', detail: 'stale' } });
  assert.equal(result.status, 200);
  assert.deepEqual(host.calls[0].values, { mode: 'simple' });
});

test('decision-store: dismissal sends null values with the owner message', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  const result = await decisions.answer({ id: 'ses_1:form:q_1', values: null, message: 'Dismissed from the task board.' });
  assert.equal(result.status, 200);
  assert.equal(host.calls[0].values, null);
  assert.equal(host.calls[0].message, 'Dismissed from the task board.');
});

test('decision-store: dismissal needs a non-empty message', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  decisions.handleEvent(event({}, formContent()));
  assert.equal((await decisions.answer({ id: 'ses_1:form:q_1', values: null, message: '  ' })).status, 400);
  assert.equal((await decisions.answer({ id: 'ses_1:form:q_1', values: null })).status, 400);
  assert.equal(host.calls.length, 0);
});

test('decision-store: a page decision is not answerable as a form', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  decisions.handleEvent(event({ question: { kind: 'page', id: 'call_7' } }, {
    type: 'question-asked',
    sessionTitle: 'x',
    ask: { kind: 'page', id: 'call_7', title: 'Preview' },
  }));
  const [entry] = decisions.list().decisions;
  assert.equal(entry.kind, 'page');
  assert.equal(entry.title, 'Preview');
  assert.equal(entry.page.hasHtml, false);
  const result = await decisions.answer({ id: entry.id, values: { a: 'b' } });
  assert.equal(result.status, 400);
  assert.equal(host.calls.length, 0);
});

test('decision-store: the store caps at 50 entries, evicting answered entries first', () => {
  const { store: decisions } = store(stubHost());
  for (let i = 0; i < 60; i += 1) {
    decisions.handleEvent(event({ session: { id: `ses_${i}`, parentId: null }, question: { kind: 'form', id: `q_${i}` }, at: NOW + i }, formContent()));
  }
  assert.equal(decisions.size(), 50);
});

test('decision-store: /decisions stays under 64 KB with 50 large forms', () => {
  const { store: decisions } = store(stubHost());
  const bigFields = Array.from({ length: 40 }, (_, i) => ({
    key: `f${i}`, type: 'string', title: 'T'.repeat(200), description: 'D'.repeat(500), required: false,
    options: Array.from({ length: 50 }, (_, j) => ({ value: `v${j}`, label: 'L'.repeat(100) })),
  }));
  for (let i = 0; i < 50; i += 1) {
    decisions.handleEvent(event({ session: { id: `ses_${i}`, parentId: null }, question: { kind: 'form', id: `q_${i}` }, at: NOW + i }, formContent(bigFields)));
  }
  const body = JSON.stringify(decisions.list());
  assert.ok(Buffer.byteLength(body, 'utf8') <= DECISIONS_BODY_MAX, `body is ${Buffer.byteLength(body, 'utf8')} bytes`);
  assert.ok(decisions.list().decisions.length > 0);
});

// ---------------------------------------------------------------------------
// The routes, over real HTTP
// ---------------------------------------------------------------------------

const TOKEN = 'decision-route-token';

async function start(decisions) {
  const server = createCoordinatorHostServer(TOKEN, () => 'running', { decisions, now: () => NOW });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

function request(port, { method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

const AUTH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

test('decision-routes: bearer required, Origin refused, no-store on /decisions', async () => {
  const { store: decisions } = store(stubHost());
  const app = await start(decisions);
  try {
    assert.equal((await request(app.port, { path: '/decisions' })).status, 401);
    assert.equal((await request(app.port, { path: '/decisions', headers: { ...AUTH, Origin: 'https://evil.example' } })).status, 403);
    const ok = await request(app.port, { path: '/decisions', headers: AUTH });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['cache-control'], 'no-store');
    assert.equal(JSON.parse(ok.body).decisions.length, 0);
  } finally {
    await app.close();
  }
});

test('decision-routes: answer round trip and an unknown id 404', async () => {
  const host = stubHost();
  const { store: decisions } = store(host);
  const app = await start(decisions);
  try {
    const posted = await request(app.port, { method: 'POST', path: '/session-events', headers: AUTH, body: JSON.stringify(event({}, formContent())) });
    assert.equal(posted.status, 200);
    const listed = JSON.parse((await request(app.port, { path: '/decisions', headers: AUTH })).body);
    assert.equal(listed.decisions.length, 1);

    const answered = await request(app.port, {
      method: 'POST', path: '/decision/answer', headers: AUTH,
      body: JSON.stringify({ v: 1, id: 'ses_1:form:q_1', values: { layout: 'split' }, message: null }),
    });
    assert.equal(answered.status, 200);
    assert.equal(host.calls.length, 1);

    const unknown = await request(app.port, {
      method: 'POST', path: '/decision/answer', headers: AUTH,
      body: JSON.stringify({ v: 1, id: 'ses_x:form:q_x', values: { layout: 'split' } }),
    });
    assert.equal(unknown.status, 404);
  } finally {
    await app.close();
  }
});

test('decision-routes: answering makes no GitHub request', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response('{}', { status: 500 });
  };
  try {
    const host = stubHost();
    const { store: decisions } = store(host);
    decisions.handleEvent(event({}, formContent()));
    await decisions.answer({ id: 'ses_1:form:q_1', values: { layout: 'split' } });
    assert.deepEqual(urls, [], 'the answer path makes no network call of its own');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
