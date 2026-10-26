import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { GitHubClient, GitHubError } from '../server/github.ts';
import { buildBoardList, buildIssueDetail, applyQuestionAnswer } from '../server/board.ts';
import { HttpSession, startBoard, SYNTHETIC_TOKEN } from './helpers.mjs';
import { makeIssue, startFakeGitHub } from './fake-github.mjs';

async function fixture(options = {}) {
  const issues = options.issues ?? [makeIssue({ number: 1, body: '## Overview\nTest\n' })];
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues, ...options.fake });
  const board = await startBoard(fake, options.board);
  return {
    fake,
    board,
    logs: board.logs,
    close: async () => {
      await board.app.close();
      await fake.close();
    },
  };
}

// --- N2: Redirect handling ---
test('N2: GitHubClient rejects 302 and 307 redirects before following (zero requests sent to destination)', async () => {
  let foreignHits = 0;
  const foreign = http.createServer((req, res) => {
    foreignHits += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ number: 99 }));
  });
  await new Promise((r) => foreign.listen(0, '127.0.0.1', r));
  const foreignPort = foreign.address().port;

  let originCalls = [];
  const origin = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    originCalls.push({ url: req.url, method: req.method, body });
    if (req.method === 'GET' && req.url.startsWith('/repos/owner/repo/issues')) {
      res.writeHead(302, { location: `http://127.0.0.1:${foreignPort}/untrusted-issues` });
      res.end();
    } else if (req.method === 'PATCH' && req.url === '/repos/owner/repo/issues/1') {
      res.writeHead(307, { location: `http://127.0.0.1:${foreignPort}/untrusted-patch` });
      res.end();
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ number: 1, full_name: 'owner/repo', login: 'bot' }));
    }
  });
  await new Promise((r) => origin.listen(0, '127.0.0.1', r));
  const originPort = origin.address().port;

  try {
    const client = new GitHubClient({
      apiBase: `http://127.0.0.1:${originPort}`,
      token: 'secret-token',
      repo: { owner: 'owner', name: 'repo', full: 'owner/repo' },
    });

    // GET redirect
    await assert.rejects(
      () => client.listIssues(),
      (err) => {
        assert.ok(err instanceof GitHubError);
        assert.equal(err.kind, 'server');
        return true;
      },
    );
    assert.equal(foreignHits, 0, 'GET redirect must not be followed to foreign destination');

    // PATCH redirect
    await assert.rejects(
      () => client.updateIssue(1, { body: 'new text' }),
      (err) => {
        assert.ok(err instanceof GitHubError);
        assert.equal(err.kind, 'server');
        return true;
      },
    );
    assert.equal(foreignHits, 0, 'PATCH redirect must not be followed to foreign destination');
  } finally {
    origin.closeAllConnections();
    foreign.closeAllConnections();
    await new Promise((r) => origin.close(r));
    await new Promise((r) => foreign.close(r));
  }
});

// --- N1: Client-side browser mutation error handling ---
test('N1 (client): api() treats malformed success, 5xx, and untrusted responses on mutations as write_outcome_unknown', async () => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  let code = fs.readFileSync('web/public/app.js', 'utf8');
  code = code.replace(/\}\)\(\);?\s*$/, 'window.__app = { api, state }; })();');

  function makeContext(mockFetch) {
    const ctx = {
      document: {
        getElementById: (id) => ({
          id,
          textContent: '',
          value: '',
          hidden: false,
          setAttribute: () => {},
          removeAttribute: () => {},
          addEventListener: () => {},
        }),
        createElement: () => ({
          setAttribute: () => {},
          addEventListener: () => {},
          appendChild: () => {},
        }),
      },
      window: {
        setTimeout: () => {},
        setInterval: () => {},
        addEventListener: () => {},
        location: { hash: '' },
      },
      fetch: mockFetch,
    };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    return ctx.window.__app;
  }

  // 1. 200 with malformed JSON
  {
    const app = makeContext(async () => ({ ok: true, status: 200, text: async () => '{bad' }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // 2. 200 with empty string
  {
    const app = makeContext(async () => ({ ok: true, status: 200, text: async () => '' }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // 3. 200 with JSON missing `issue`
  {
    const app = makeContext(async () => ({ ok: true, status: 200, text: async () => '{"saved":true}' }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // 4. 502 with HTML Bad Gateway
  {
    const app = makeContext(async () => ({
      ok: false,
      status: 502,
      text: async () => '<h1>Bad Gateway</h1>',
    }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // 5. 500 with generic server error JSON
  {
    const app = makeContext(async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: 'server_error', message: 'The board could not complete that request.' }),
    }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // 6. 422 with HTML (untrusted gateway error)
  {
    const app = makeContext(async () => ({
      ok: false,
      status: 422,
      text: async () => '<h1>Gateway lost upstream</h1>',
    }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // 7. Structured board pre-commit refusals remain distinct: 409 conflict
  {
    const app = makeContext(async () => ({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ error: 'conflict', message: 'Task changed on GitHub' }),
    }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'conflict');
        assert.equal(err.status, 409);
        return true;
      },
    );
  }

  // 8. Structured 400 invalid_edit remains distinct
  {
    const app = makeContext(async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'invalid_edit', message: 'An answer is required' }),
    }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'invalid_edit');
        assert.equal(err.status, 400);
        return true;
      },
    );
  }

  // 9. Structured 429 rate_limited remains distinct
  {
    const app = makeContext(async () => ({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: 'rate_limited', message: 'Too many requests' }),
    }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'rate_limited');
        assert.equal(err.status, 429);
        return true;
      },
    );
  }

  // 10. GET requests preserve standard errors (not forced to write_outcome_unknown)
  {
    const app = makeContext(async () => ({
      ok: false,
      status: 502,
      text: async () => '<h1>Bad Gateway</h1>',
    }));
    await assert.rejects(
      () => app.api('/api/board', { method: 'GET' }),
      (err) => {
        assert.equal(err.code, 'request_failed');
        assert.equal(err.status, 502);
        return true;
      },
    );
  }
});

test('N1: upstream malformed/HTML 422 after PATCH maps to 502 write_outcome_unknown', async () => {
  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, body: '## Overview\nOriginal\n' })],
  });
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;

    // Simulate upstream committing PATCH, but responding with HTML 422
    fake.setPatchHook((issue, payload, req, res) => {
      res.writeHead(422, { 'content-type': 'text/html' });
      res.end('<h1>Gateway lost upstream</h1>');
    });

    const res = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'New text', fingerprint },
    });
    assert.equal(res.status, 502, 'Malformed 422 must map to 502 write_outcome_unknown');
    assert.equal(res.json.error, 'write_outcome_unknown');
    assert.equal(fake.patchCalls.length, 1, 'Exactly one PATCH sent, no repeat');
  } finally {
    await close();
  }
});

// --- N3: Indentation-only mismatch on readback ---
test('N3: indentation-only mismatch on readback maps to 502 write_outcome_unknown', async () => {
  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, body: '## Overview\nOriginal\n\n## Human Tasks\n- [ ] Keep\n' })],
  });
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;

    // Upstream strips 4-space indentation on readback
    fake.setPatchHook((issue, payload) => {
      issue.body = payload.body.replace('    indented code', 'indented code');
      return { applyPayload: false };
    });

    const res = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: '    indented code', fingerprint },
    });
    assert.equal(res.status, 502, 'Indentation mismatch must return 502 write_outcome_unknown');
    assert.equal(res.json.error, 'write_outcome_unknown');
    assert.equal(fake.patchCalls.length, 1);
  } finally {
    await close();
  }
});

// --- N4: Code fence with pseudo-closer does not expose code as question ---
test('N4: malformed fence does not expose code checkbox as open question in list or detail', async () => {
  const bodyWithCodeFence = [
    '## Overview',
    'Intro',
    '',
    '## Open Questions',
    '```text',
    'example',
    '```not-a-closing-fence',
    '- [ ] This is a code example, not an actionable question?',
    '```',
    '- [ ] Real actionable question?',
    '',
    '## Human Tasks',
    '- [ ] Keep',
  ].join('\n');

  const raw = makeIssue({ number: 1, body: bodyWithCodeFence });

  // 1. List projection: open question count must be 1, not 2
  const listResult = buildBoardList([raw]);
  assert.equal(listResult.issues[0].counts.openQuestions.total, 1);
  assert.equal(listResult.issues[0].counts.openQuestions.open, 1);

  // 2. Detail projection: only 'Real actionable question?' present, index 0, answerIndex 0
  const detail = buildIssueDetail(raw);
  assert.equal(detail.openQuestions.length, 1);
  assert.equal(detail.openQuestions[0].text, 'Real actionable question?');
  assert.equal(detail.openQuestions[0].answerIndex, 0);

  // 3. Answering question at index 0 targets 'Real actionable question?', NOT code block
  const updated = applyQuestionAnswer(raw, 0, 'real answer');
  assert.ok(updated.includes('- [ ] This is a code example, not an actionable question?'), 'Code example must NOT be modified');
  assert.ok(updated.includes('- [x] Real actionable question? *(Answer: real answer)*'), 'Real question must be answered');
});

test('N4: fence variants (longer backticks, tildes) preserve fences and exclude code checkboxes', async () => {
  // 1. 4-backtick variant
  const b1 = [
    '## Open Questions',
    '````',
    '```',
    '- [ ] Inside 4-backtick fence?',
    '```',
    '````',
    '- [ ] Outside 4-backtick fence?',
  ].join('\n');
  const d1 = buildIssueDetail(makeIssue({ number: 1, body: b1 }));
  assert.equal(d1.openQuestions.length, 1);
  assert.equal(d1.openQuestions[0].text, 'Outside 4-backtick fence?');

  // 2. 4-tilde variant
  const b2 = [
    '## Open Questions',
    '~~~~',
    '~~~',
    '- [ ] Inside 4-tilde fence?',
    '~~~',
    '~~~~',
    '- [ ] Outside 4-tilde fence?',
  ].join('\n');
  const d2 = buildIssueDetail(makeIssue({ number: 2, body: b2 }));
  assert.equal(d2.openQuestions.length, 1);
  assert.equal(d2.openQuestions[0].text, 'Outside 4-tilde fence?');

  // 3. Tilde block with backticks inside
  const b3 = [
    '## Open Questions',
    '~~~',
    '```',
    '- [ ] Inside tilde fence?',
    '```',
    '~~~',
    '- [ ] Outside tilde fence?',
  ].join('\n');
  const d3 = buildIssueDetail(makeIssue({ number: 3, body: b3 }));
  assert.equal(d3.openQuestions.length, 1);
  assert.equal(d3.openQuestions[0].text, 'Outside tilde fence?');
});

test('N4: exact hostile review fixture (no questions outside fence) exposes 0 questions and refuses answer mutation via HTTP', async () => {
  const hostileFixtureBody = [
    '## Overview',
    'Intro',
    '',
    '## Open Questions',
    '```text',
    'example',
    '```not-a-closing-fence',
    '- [ ] This is a code example, not an actionable question?',
    '```',
    '',
    '## Human Tasks',
    '- [ ] Keep',
  ].join('\n');

  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, body: hostileFixtureBody })],
  });
  try {
    const client = new HttpSession(board.url);
    await client.login();

    // 1. Board list counts 0 open questions
    const listRes = await client.request('/api/board');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json.issues[0].counts.openQuestions.total, 0);

    // 2. Issue detail has empty openQuestions
    const detailRes = await client.request('/api/issues/1');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.json.issue.openQuestions.length, 0);

    // 3. Direct answer request to index 0 is refused with 400 invalid_edit
    const answerRes = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'attempted hack', fingerprint: detailRes.json.issue.fingerprint },
    });
    assert.equal(answerRes.status, 400);
    assert.equal(answerRes.json.error, 'invalid_edit');
    assert.equal(fake.patchCalls.length, 0, 'Zero PATCH requests must be sent');

    // 4. Issue body remains unmutated
    const current = fake.findIssue(1);
    assert.ok(current.body.includes('- [ ] This is a code example, not an actionable question?'));
    assert.ok(!current.body.includes('attempted hack'));
  } finally {
    await close();
  }
});

test('N4: real question after fenced code block can be answered via HTTP without touching code block', async () => {
  const bodyWithCodeAndRealQ = [
    '## Overview',
    'Intro',
    '',
    '## Open Questions',
    '```text',
    'example',
    '```not-a-closing-fence',
    '- [ ] This is a code example, not an actionable question?',
    '```',
    '- [ ] Real actionable question?',
    '',
    '## Human Tasks',
    '- [ ] Keep',
  ].join('\n');

  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, body: bodyWithCodeAndRealQ })],
  });
  try {
    const client = new HttpSession(board.url);
    await client.login();

    // 1. Issue detail exposes answerIndex 0 for 'Real actionable question?'
    const detailRes = await client.request('/api/issues/1');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.json.issue.openQuestions.length, 1);
    assert.equal(detailRes.json.issue.openQuestions[0].text, 'Real actionable question?');
    assert.equal(detailRes.json.issue.openQuestions[0].answerIndex, 0);

    // 2. Answer question at index 0
    const answerRes = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'yes indeed', fingerprint: detailRes.json.issue.fingerprint },
    });
    assert.equal(answerRes.status, 200);
    assert.equal(fake.patchCalls.length, 1, 'Exactly 1 PATCH sent');

    // 3. Verify GitHub issue body: code example preserved, real question answered
    const current = fake.findIssue(1);
    assert.ok(current.body.includes('- [ ] This is a code example, not an actionable question?'), 'Code example must be preserved');
    assert.ok(current.body.includes('- [x] Real actionable question? *(Answer: yes indeed)*'), 'Real question must be answered');
  } finally {
    await close();
  }
});

// --- F1: nominal 200 with invalid detail shape ---
test('F1 (client): nominal 200 with invalid detail shape throws write_outcome_unknown and does not corrupt detail', async () => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  let code = fs.readFileSync('web/public/app.js', 'utf8');
  code = code.replace(/\}\)\(\);?\s*$/, 'window.__app = { api, state, saveOverview, saveAnswer, saveStatus }; })();');

  const elements = {};
  function getEl(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        textContent: '',
        value: '',
        hidden: false,
        disabled: false,
        className: '',
        setAttribute: (k, v) => { elements[id][k] = v; },
        removeAttribute: (k) => { delete elements[id][k]; },
        addEventListener: () => {},
        appendChild: () => {},
        querySelector: () => null,
      };
    }
    return elements[id];
  }

  function makeContext(mockFetch) {
    const defaultEl = (id) => ({
      id,
      textContent: '',
      value: '',
      hidden: false,
      disabled: false,
      className: '',
      setAttribute: () => {},
      removeAttribute: () => {},
      addEventListener: () => {},
      appendChild: () => {},
      querySelector: () => null,
      focus: () => {},
      dispatchEvent: () => {},
    });
    for (const key of Object.keys(elements)) {
      delete elements[key];
    }
    ['login-form', 'refresh-btn', 'signout-btn', 'save-overview', 'overview-text', 'status-select',
     'apply-status', 'save-status', 'notice', 'announcer', 'conflict-banner', 'conflict-message',
     'human-list', 'no-human', 'question-list', 'no-questions', 'detail-title', 'detail-meta',
     'detail-freshness', 'overview-empty', 'password', 'login-error', 'repo-label', 'freshness',
     'board-count', 'task-list', 'no-issues', 'login-view', 'board-view', 'detail-view'
    ].forEach((id) => {
      elements[id] = defaultEl(id);
    });

    const ctx = {
      document: {
        getElementById: (id) => getEl(id),
        createElement: (tag) => ({
          tagName: tag,
          className: '',
          textContent: '',
          setAttribute: () => {},
          addEventListener: () => {},
          appendChild: () => {},
        }),
      },
      window: {
        setTimeout: (fn) => fn(),
        setInterval: () => {},
        addEventListener: () => {},
        location: { hash: '' },
      },
      fetch: mockFetch,
    };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    return ctx.window.__app;
  }

  // Case 1: 200 {"issue":{}} must throw write_outcome_unknown in api()
  {
    const app = makeContext(async () => ({ ok: true, status: 200, text: async () => '{"issue":{}}' }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // Case 2: 200 {"issue":{"number":1}} (missing fingerprint, arrays) must throw write_outcome_unknown
  {
    const app = makeContext(async () => ({ ok: true, status: 200, text: async () => '{"issue":{"number":1}}' }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        assert.ok(err.message.includes('Outcome unknown') && err.message.includes('refresh'));
        return true;
      },
    );
  }

  // Case 3: 200 with wrong issue number in detail payload
  {
    const app = makeContext(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        issue: {
          number: 99,
          title: 'Mismatch',
          fingerprint: 'fp',
          state: 'open',
          editableSections: [],
          openQuestions: [],
          humanTasks: [],
          acceptanceCriteria: [],
          subtasks: [],
        },
        statusOptions: [],
      }),
    }));
    await assert.rejects(
      () => app.api('/api/issues/1/section', { method: 'PUT', body: {} }),
      (err) => {
        assert.equal(err.code, 'write_outcome_unknown');
        return true;
      },
    );
  }

  // Case 4: saveOverview with 200 {"issue":{}} retains prior state.detail and draft value
  {
    const app = makeContext(async (url) => {
      if (String(url).includes('/api/session')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ authenticated: true, csrfToken: 'csrf' }) };
      }
      return { ok: true, status: 200, text: async () => '{"issue":{}}' };
    });
    // Wait for boot to finish
    await new Promise((r) => setTimeout(r, 10));
    const initialDetail = {
      number: 1,
      title: 'Original Title',
      fingerprint: 'fp1',
      state: 'open',
      statusLabel: 'status:todo',
      phase: 'execution',
      attention: 'none',
      updatedAt: '2026-10-25T00:00:00Z',
      editableSections: [{ id: 'overview', title: 'Overview', text: 'Original text' }],
      openQuestions: [],
      humanTasks: [],
      acceptanceCriteria: [],
      subtasks: [],
    };
    app.state.detail = initialDetail;
    elements['overview-text'].value = 'unsaved draft';

    await app.saveOverview();

    // Verify detail is not corrupted
    assert.deepEqual(app.state.detail, initialDetail, 'Prior detail must be preserved on invalid payload');
    // Verify typed draft in textarea is NOT overwritten
    assert.equal(elements['overview-text'].value, 'unsaved draft', 'User draft must be preserved');
    // Save status must display outcome unknown with refresh guidance
    assert.ok(
      elements['save-status'].textContent.includes('Outcome unknown') &&
      elements['save-status'].textContent.includes('refresh'),
      `Expected refresh guidance, got: ${elements['save-status'].textContent}`,
    );
  }
});

// --- F2: generic JSON 422 vs recognisable GitHub validation ---
test('F2: upstream generic JSON 422 after PATCH maps to 502 write_outcome_unknown, while recognisable GitHub validation 422 maps to 400 invalid_request', async () => {
  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, body: '## Overview\nOriginal\n' })],
  });
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;

    // 1. Generic JSON 422 (e.g. gateway error formatted as JSON)
    fake.setPatchHook((issue, payload, req, res) => {
      if (typeof payload?.body === 'string') issue.body = payload.body;
      res.writeHead(422, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Gateway lost upstream' }));
    });

    const genericRes = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Committed generic 422', fingerprint },
    });
    assert.equal(genericRes.status, 502, 'Generic JSON 422 must map to 502 write_outcome_unknown');
    assert.equal(genericRes.json.error, 'write_outcome_unknown');
    assert.equal(fake.patchCalls.length, 1, 'Exactly one PATCH sent');

    // 2. Recognisably GitHub validation 422 ("Validation Failed" with errors array)
    const detail2 = await client.request('/api/issues/1');
    fake.setPatchHook((issue, payload, req, res) => {
      res.writeHead(422, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'Validation Failed',
          errors: [{ resource: 'Issue', field: 'body', code: 'invalid' }],
        }),
      );
    });

    const validRes = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Rejected validation', fingerprint: detail2.json.issue.fingerprint },
    });
    assert.equal(validRes.status, 400, 'Recognisable GitHub validation must map to 400 invalid_request');
    assert.equal(validRes.json.error, 'invalid_request');
  } finally {
    await close();
  }
});

// --- F3: 4-space indented code checkbox excluded from open questions ---
test('F3: four-space/tab indented code checkbox is excluded from list, detail, and mutation targeting', async () => {
  const indentedFixture = [
    '## Overview',
    'Intro prose',
    '',
    '## Open Questions',
    '    - [ ] Four-space indented code question?',
    '- [ ] Indentation real question?',
    '',
    '## Human Tasks',
    '- [ ] Keep task',
  ].join('\n');

  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, body: indentedFixture })],
  });
  try {
    const client = new HttpSession(board.url);
    await client.login();

    // 1. List projection: count of open questions must be 1, not 2
    const listRes = await client.request('/api/board');
    assert.equal(listRes.status, 200);
    const item = listRes.json.issues.find((i) => i.number === 1);
    assert.equal(item.counts.openQuestions.total, 1, 'Only 1 real question counted');
    assert.equal(item.counts.openQuestions.open, 1, 'Only 1 open question counted');

    // 2. Detail projection: only the real question is projected
    const detailRes = await client.request('/api/issues/1');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.json.issue.openQuestions.length, 1, 'Only 1 question projected in detail');
    assert.equal(detailRes.json.issue.openQuestions[0].text, 'Indentation real question?');
    assert.equal(detailRes.json.issue.openQuestions[0].answerIndex, 0);

    // 3. Answering index 0 mutates the real question, not the code block
    const answerRes = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'real answer', fingerprint: detailRes.json.issue.fingerprint },
    });
    assert.equal(answerRes.status, 200);
    assert.equal(fake.patchCalls.length, 1, 'Exactly 1 PATCH sent');

    const updatedIssue = fake.findIssue(1);
    assert.ok(
      updatedIssue.body.includes('    - [ ] Four-space indented code question?'),
      'Indented code checkbox must remain completely untouched',
    );
    assert.ok(
      updatedIssue.body.includes('- [x] Indentation real question? *(Answer: real answer)*'),
      'Real question must be answered',
    );

    // 4. Direct request targeting index 1 (out of range / aimed at code) must be refused 400 invalid_edit
    const detailAfter = await client.request('/api/issues/1');
    const outOfRangeRes = await client.request('/api/issues/1/questions/1/answer', {
      method: 'POST',
      body: { answer: 'attempted hack', fingerprint: detailAfter.json.issue.fingerprint },
    });
    assert.equal(outOfRangeRes.status, 400);
    assert.equal(outOfRangeRes.json.error, 'invalid_edit');
    assert.equal(fake.patchCalls.length, 1, 'Zero extra PATCH requests sent on refused mutation');
  } finally {
    await close();
  }
});

// --- F3: issue with only indented code exposes 0 questions and refuses answer index 0 ---
test('F3: issue with only indented code exposes 0 questions and refuses answer index 0', async () => {
  const onlyCodeFixture = [
    '## Overview',
    'Intro prose',
    '',
    '## Open Questions',
    '    - [ ] Four-space indented code question?',
    '\t- [ ] Tab indented code question?',
    '',
    '## Human Tasks',
    '- [ ] Keep task',
  ].join('\n');

  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, body: onlyCodeFixture })],
  });
  try {
    const client = new HttpSession(board.url);
    await client.login();

    // 1. List projection has 0 open questions
    const listRes = await client.request('/api/board');
    assert.equal(listRes.status, 200);
    const item = listRes.json.issues.find((i) => i.number === 1);
    assert.equal(item.counts.openQuestions.total, 0);

    // 2. Detail has 0 open questions
    const detailRes = await client.request('/api/issues/1');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.json.issue.openQuestions.length, 0);

    // 3. Direct answer targeting index 0 is refused 400 invalid_edit
    const answerRes = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'bad answer', fingerprint: detailRes.json.issue.fingerprint },
    });
    assert.equal(answerRes.status, 400);
    assert.equal(answerRes.json.error, 'invalid_edit');
    assert.equal(fake.patchCalls.length, 0, 'Zero PATCH requests sent');
  } finally {
    await close();
  }
});


