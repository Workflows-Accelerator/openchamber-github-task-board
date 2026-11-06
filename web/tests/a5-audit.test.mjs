import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWebHumanTasks, toggleHumanTaskInMarkdown } from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession } from './helpers.mjs';

const body = '## Questions\n- [x] Already answered\n- [ ] Choose release date\n\n## Human Tasks\n- [ ] Approve release\n- [ ] Confirm records\n';
const routes = [
  ['answer', 'POST', '/api/issues/1/questions/0/answer', { answer: 'Friday' }],
  ['human task', 'POST', '/api/issues/1/human-tasks/0/toggle', { completed: true }],
  ['reopen', 'POST', '/api/issues/2/reopen', {}],
  ['remove label POST', 'POST', '/api/issues/1/labels/remove', { label: 'backburner' }],
  ['remove label DELETE', 'DELETE', '/api/issues/1/labels/backburner', {}],
];

for (const [name, method, route, payload] of routes) {
  test(`audit A5 ${name}: missing/stale fingerprints and malformed JSON refuse with zero PATCH`, async () => {
    const fake = await startFakeGitHub({ issues: [
      makeIssue({ number: 1, body, labels: ['status:todo', 'backburner', 'bug'] }),
      makeIssue({ number: 2, state: 'closed', labels: ['status:done'] }),
    ] });
    const board = await startBoard(fake);
    try {
      const session = new HttpSession(board.url);
      await session.login();
      const detail = await session.request('/api/issues/' + (name === 'reopen' ? 2 : 1));
      const fingerprint = detail.json.issue.fingerprint;
      for (const [scenario, fields, expected] of [
        ['missing', payload, 400],
        ['stale', { ...payload, fingerprint: '0'.repeat(64) }, 409],
      ]) {
        const result = await session.request(route, { method, body: fields });
        assert.equal(result.status, expected, scenario);
        assert.equal(fake.patchCalls.length, 0, scenario + ': no upstream writes');
        console.log(JSON.stringify({ route, method, scenario, status: result.status, PATCH: fake.patchCalls.length }));
      }
      const response = await fetch(board.url + route + (method === 'DELETE' ? '?fingerprint=' + fingerprint : ''), {
        method,
        headers: { cookie: session.cookie, 'x-csrf-token': session.csrf, 'content-type': 'application/json' },
        body: '{"fingerprint":',
      });
      assert.equal(response.status, 400);
      assert.equal(fake.patchCalls.length, 0);
      console.log(JSON.stringify({ route, method, scenario: 'malformed JSON', status: response.status, PATCH: fake.patchCalls.length }));
      if (name === 'human task') {
        for (const completed of [null, 0, '', 'false', [], {}]) {
          const result = await session.request(route, { method, body: { fingerprint, completed } });
          assert.equal(result.status, 400);
          assert.equal(fake.patchCalls.length, 0);
        }
        // An intervening insertion shifts the index. The old fingerprint must refuse it.
        fake.findIssue(1).body = body.replace('## Human Tasks\n', '## Human Tasks\n- [ ] Intervening task\n');
        const result = await session.request(route, { method, body: { fingerprint, completed: true } });
        assert.equal(result.status, 409);
        assert.equal(fake.patchCalls.length, 0);
      }
    } finally {
      await board.app.close();
      await fake.close();
    }
  });
}

test('audit A5 human task: BOM, LF, CRLF, fences, indented code, duplicate text and two-space nested list preserve exact bytes', () => {
  for (const eol of ['\n', '\r\n']) {
    const source = '\uFEFF' + [
      '## Acceptance Criteria', '- [ ] Same words', '## Human Tasks',
      '~~~md', '- [ ] Fenced example', '~~~', '    - [ ] Indented example',
      '- [ ] Same words', '  - [ ] Nested task', '## Other', '- [ ] Same words', '',
    ].join(eol);
    const tasks = parseWebHumanTasks(source);
    assert.deepEqual(tasks.map(task => task.text), ['Same words', 'Nested task']);
    for (let index = 0; index < tasks.length; index++) {
      const changed = toggleHumanTaskInMarkdown(source, index, true).newBody;
      const offset = tasks[index].charOffset;
      assert.equal(changed, source.slice(0, offset) + 'x' + source.slice(offset + 1));
    }
  }
  assert.deepEqual(parseWebHumanTasks('## Other\n- [ ] Not a human task'), []);
  assert.throws(() => toggleHumanTaskInMarkdown('## Other\n- [ ] Not a human task', 0));
});

test('audit A5 operations: old closure edited today excluded; unlabelled/planned/review issues counted once; repository-qualified identity', async () => {
  const now = Date.now();
  const fake = await startFakeGitHub({ repositories: [
    { repo: 'owner/alpha', issues: [
      makeIssue({ number: 1, repo: 'owner/alpha', labels: ['status:planned'] }),
      makeIssue({ number: 2, repo: 'owner/alpha', labels: ['status:in-review'] }),
      makeIssue({ number: 3, repo: 'owner/alpha' }),
      makeIssue({ number: 4, repo: 'owner/alpha', state: 'closed', labels: ['status:done'], updated_at: new Date(now).toISOString(), closed_at: new Date(now - 30 * 86400000).toISOString() }),
    ] },
    { repo: 'owner/beta', issues: [makeIssue({ number: 1, repo: 'owner/beta', labels: ['status:todo'] })] },
  ] });
  const board = await startBoard(fake);
  try {
    const session = new HttpSession(board.url);
    await session.login();
    const result = await session.request('/api/combined/operations');
    assert.equal(result.status, 200);
    assert.equal(result.json.closed7Days, 0);
    assert.equal(result.json.openClosed.total, 5);
    assert.equal(Object.values(result.json.statusPerProject['owner/alpha']).reduce((a, b) => a + b, 0), 4);
    assert.equal(Object.values(result.json.statusPerProject['owner/beta']).reduce((a, b) => a + b, 0), 1);
    assert.equal(result.json.statusPerProject['owner/alpha'].planned, 1);
    assert.equal(result.json.statusPerProject['owner/alpha']['in-review'], 1);
    const first = await session.request('/api/repos/owner/alpha/operations');
    const next = await session.request('/api/repos/owner/alpha/operations');
    assert.equal(next.json.fetchedAt, first.json.fetchedAt);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('audit A5 label removal preserves unrelated labels and refuses absent assignment with zero PATCH', async () => {
  const fake = await startFakeGitHub({ issues: [makeIssue({ number: 1, labels: ['status:todo', 'backburner', 'bug'] })] });
  const board = await startBoard(fake);
  try {
    const session = new HttpSession(board.url);
    await session.login();
    let result = await session.request('/api/issues/1');
    const absent = await session.request('/api/issues/1/labels/remove', { method: 'POST', body: { fingerprint: result.json.issue.fingerprint, label: 'absent' } });
    assert.equal(absent.status, 400);
    assert.match(absent.json.message, /not present/);
    assert.equal(fake.patchCalls.length, 0);
    result = await session.request('/api/issues/1/labels/remove', { method: 'POST', body: { fingerprint: result.json.issue.fingerprint, label: 'backburner' } });
    assert.equal(result.status, 200);
    assert.deepEqual(fake.patchCalls[0].payload, { labels: ['status:todo', 'bug'] });
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('audit A5 archive pagination: non-finite limit and offset normalize to finite numbers', async () => {
  const fake = await startFakeGitHub({ issues: [
    makeIssue({ number: 1, state: 'closed', closed_at: '2026-11-01T00:00:00Z' }),
  ] });
  const board = await startBoard(fake);
  try {
    const session = new HttpSession(board.url);
    await session.login();
    for (const query of ['limit=Infinity&offset=Infinity', 'limit=-Infinity&offset=-Infinity', 'limit=NaN&offset=-5']) {
      const res = await session.request('/api/archive?' + query);
      assert.equal(res.status, 200);
      assert.ok(Number.isFinite(res.json.limit), `${query}: limit must be finite`);
      assert.ok(Number.isFinite(res.json.offset), `${query}: offset must be finite`);
    }
  } finally {
    await board.app.close();
    await fake.close();
  }
});
