import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import {
  startBoard,
  browserConfig,
  HttpSession,
  BOARD_PASSWORD,
  SESSION_SECRET,
  SYNTHETIC_TOKEN,
} from './helpers.mjs';
import { ConfigError } from '../server/config.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const OVERVIEW_BODY = [
  'Board overview prose.',
  '',
  '## Acceptance Criteria',
  '- [ ] A person can open the board',
  '',
  '## Open Questions',
  '- [ ] Which port should the board use?',
  '- [ ] Who approves the rollout?',
  '',
  '## Human Tasks',
  '- [ ] Approve the rollout',
  '',
  '## Test Plan (Issue)',
  '- [ ] node --test web/tests/*.test.mjs',
  '',
].join('\n');

async function fixture(options = {}) {
  const issues =
    options.issues ??
    [
      makeIssue({ number: 1, title: 'First task', body: OVERVIEW_BODY, labels: ['status:todo', 'bug'] }),
      makeIssue({ number: 2, title: 'Second task', body: 'Second body', labels: ['status:in-progress'] }),
      makeIssue({ number: 3, title: 'Pull request', pull_request: true }),
      makeIssue({ number: 4, title: 'Closed task', state: 'closed', labels: ['status:done'] }),
    ];
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues, ...options.fake });
  const board = await startBoard(fake, options.board);
  return { fake, board, logs: board.logs, close: async () => { await board.app.close(); await fake.close(); } };
}

function runEntry(env) {
  return spawnSync(process.execPath, ['web/server.ts'], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

test('the server entry refuses a missing configuration and names the variable', () => {
  const result = runEntry({
    BOARD_GITHUB_LOGIN: 'board-owner',
    BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD: 'correct horse battery staple',
    BOARD_SESSION_SECRET: SESSION_SECRET,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BOARD_GITHUB_TOKEN/);
  assert.equal(result.stderr.includes(SYNTHETIC_TOKEN), false);
  assert.equal(result.stdout.includes(SYNTHETIC_TOKEN), false);
});

test('the server entry refuses an invalid repository without echoing secrets', () => {
  const result = runEntry({
    BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
    BOARD_GITHUB_LOGIN: 'board-owner',
    BOARD_REPO: 'not-a-repo',
    BOARD_PASSWORD: 'correct horse battery staple',
    BOARD_SESSION_SECRET: SESSION_SECRET,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BOARD_REPO/);
  assert.equal(result.stderr.includes(SYNTHETIC_TOKEN), false);
});

test('startup is refused when the token belongs to another account', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, login: 'someone-else' });
  try {
    await assert.rejects(
      () =>
        startBoard(fake, {
          config: browserConfig(fake, { BOARD_GITHUB_LOGIN: 'board-owner' }),
        }),
      (err) => {
        assert.ok(err instanceof ConfigError);
        assert.equal(err.variable, 'BOARD_GITHUB_LOGIN');
        assert.match(err.message, /BOARD_GITHUB_LOGIN/);
        assert.equal(err.message.includes(SYNTHETIC_TOKEN), false);
        return true;
      },
    );
  } finally {
    await fake.close();
  }
});

test('startup is refused when the repository is not accessible', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repoAccessible: false });
  try {
    await assert.rejects(
      () => startBoard(fake),
      (err) => {
        assert.ok(err instanceof ConfigError);
        assert.equal(err.variable, 'BOARD_REPO');
        assert.match(err.message, /BOARD_REPO/);
        return true;
      },
    );
  } finally {
    await fake.close();
  }
});

test('every API route denies data without a session', async () => {
  const { board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    for (const route of ['/api/board', '/api/issues/1', '/api/session']) {
      const response = await client.request(route);
      if (route === '/api/session') {
        assert.equal(response.status, 200);
        assert.deepEqual(response.json, { authenticated: false });
      } else {
        assert.equal(response.status, 401, route);
        assert.equal(response.text.includes('First task'), false);
        assert.equal(response.text.includes(SYNTHETIC_TOKEN), false);
      }
    }
  } finally {
    await close();
  }
});

test('the shell page loads without a session and exposes no data or agent controls', async () => {
  const { board, close } = await fixture();
  try {
    const response = await fetch(`${board.url}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /id="login-form"/);
    assert.equal(html.includes('First task'), false);
    assert.equal(html.includes(SYNTHETIC_TOKEN), false);
    assert.equal(/start\s+agent|open\s+session|agent\s+activity/i.test(html), false);
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('x-frame-options') ?? '', /DENY/);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  } finally {
    await close();
  }
});

test('a wrong password is rejected and the correct one is never locked out', async () => {
  const { board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await client.login('wrong password value');
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    }
    const limited = await client.login('wrong password value');
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);

    const owner = await new HttpSession(board.url).login();
    assert.equal(owner.status, 200, 'a correct password still works while the limiter cools down');
    assert.ok(owner.json.csrfToken.length >= 32);
  } finally {
    await close();
  }
});

test('a successful login issues a hardened cookie and a bound CSRF token', async () => {
  const { board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    const login = await client.login();
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /board_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.match(setCookie, /Path=\//);
    assert.match(setCookie, /Max-Age=\d+/);
    assert.equal(login.text.includes(BOARD_PASSWORD), false);

    const session = await client.request('/api/session');
    assert.equal(session.status, 200);
    assert.equal(session.json.authenticated, true);
    assert.equal(session.json.csrfToken, client.csrf);

    const boardResponse = await client.request('/api/board');
    assert.equal(boardResponse.status, 200);
    assert.equal(boardResponse.json.repo, 'owner/repo');
    assert.equal(boardResponse.json.issues.length, 3);
    assert.equal(boardResponse.json.excludedPullRequests, 1);
    assert.equal(boardResponse.json.truncated, false);
    assert.deepEqual(
      boardResponse.json.issues.map((issue) => issue.number),
      [1, 2, 4],
    );
  } finally {
    await close();
  }
});

test('state-changing requests are rejected without a valid CSRF token', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;

    const noToken = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Hijacked.', fingerprint },
      csrf: false,
    });
    assert.equal(noToken.status, 403);
    assert.equal(fake.patchCalls.length, 0);

    const wrongToken = await client.request('/api/issues/1/section', {
      method: 'PUT',
      headers: { 'x-csrf-token': 'f'.repeat(64) },
      body: { sectionId: 'overview', text: 'Hijacked.', fingerprint },
      csrf: false,
    });
    assert.equal(wrongToken.status, 403);
    assert.equal(fake.patchCalls.length, 0);

    const denied = await client.request('/api/issues/1/status', {
      method: 'POST',
      body: { status: 'status:done', fingerprint },
      csrf: false,
    });
    assert.equal(denied.status, 403);
    assert.equal(fake.patchCalls.length, 0);
  } finally {
    await close();
  }
});

test('the board lists pages, excludes pull requests and reports freshness fields', async () => {
  const many = Array.from({ length: 105 }, (_, index) =>
    makeIssue({ number: index + 1, title: `Task ${index + 1}`, labels: ['status:todo'] }),
  );
  const { board, close } = await fixture({ issues: many.concat([makeIssue({ number: 500, pull_request: true })]) });
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const response = await client.request('/api/board');
    assert.equal(response.status, 200);
    assert.equal(response.json.issues.length, 105);
    assert.equal(response.json.excludedPullRequests, 1);
    assert.equal(typeof response.json.fetchedAt, 'string');
    const item = response.json.issues[0];
    for (const field of ['number', 'title', 'state', 'phase', 'attention', 'column', 'labels', 'updatedAt', 'counts']) {
      assert.ok(field in item, `missing ${field}`);
    }
  } finally {
    await close();
  }
});

test('issue detail exposes a fingerprint, the overview and answerable questions', async () => {
  const { board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const response = await client.request('/api/issues/1');
    assert.equal(response.status, 200);
    const issue = response.json.issue;
    assert.match(issue.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(issue.editableSections.length, 1);
    assert.equal(issue.editableSections[0].text, 'Board overview prose.');
    assert.equal(issue.openQuestions.length, 2);
    assert.deepEqual(
      issue.openQuestions.map((question) => question.answerIndex),
      [0, 1],
    );

    const pull = await client.request('/api/issues/3');
    assert.equal(pull.status, 404);
    const missing = await client.request('/api/issues/999');
    assert.equal(missing.status, 404);
  } finally {
    await close();
  }
});

test('a conditional section write succeeds and preserves every other section', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;

    const response = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Edited overview from the board.', fingerprint },
    });
    assert.equal(response.status, 200);
    assert.equal(fake.patchCalls.length, 1);
    const sentBody = fake.patchCalls[0].payload.body;
    assert.equal(
      sentBody,
      OVERVIEW_BODY.replace('Board overview prose.', 'Edited overview from the board.'),
    );
    assert.ok(sentBody.endsWith('## Test Plan (Issue)\n- [ ] node --test web/tests/*.test.mjs\n'));
    assert.equal(response.json.issue.editableSections[0].text, 'Edited overview from the board.');
    assert.notEqual(response.json.issue.fingerprint, fingerprint);
  } finally {
    await close();
  }
});

test('a concurrent edit conflicts instead of overwriting', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const staleFingerprint = detail.json.issue.fingerprint;

    fake.mutateIssue(1, (issue) => {
      issue.body = issue.body.replace('Board overview prose.', 'Someone else changed this.');
    });

    const section = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'My overwrite.', fingerprint: staleFingerprint },
    });
    assert.equal(section.status, 409);
    assert.equal(fake.patchCalls.length, 0);
    assert.notEqual(section.json.issue.fingerprint, staleFingerprint);
    assert.match(section.json.issue.editableSections[0].text, /Someone else changed this/);

    const status = await client.request('/api/issues/1/status', {
      method: 'POST',
      body: { status: 'status:done', fingerprint: staleFingerprint },
    });
    assert.equal(status.status, 409);
    assert.equal(fake.patchCalls.length, 0);
  } finally {
    await close();
  }
});

test('an inline open-question answer is written without touching other sections', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const response = await client.request('/api/issues/1/questions/1/answer', {
      method: 'POST',
      body: { answer: 'The owner approves.', fingerprint: detail.json.issue.fingerprint },
    });
    assert.equal(response.status, 200);
    const body = fake.patchCalls[0].payload.body;
    assert.match(body, /- \[x\] Who approves the rollout\? \*\(Answer: The owner approves\.\)\*/);
    assert.match(body, /- \[ \] Which port should the board use\?/);
    assert.equal(body.includes('- [ ] Approve the rollout'), true);

    const invalid = await client.request('/api/issues/1/questions/9/answer', {
      method: 'POST',
      body: { answer: 'nope', fingerprint: response.json.issue.fingerprint },
    });
    assert.equal(invalid.status, 400);
    assert.equal(fake.patchCalls.length, 1);
  } finally {
    await close();
  }
});

test('a status change rewrites only the agreed status labels', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const response = await client.request('/api/issues/1/status', {
      method: 'POST',
      body: { status: 'status:in-review', fingerprint: detail.json.issue.fingerprint },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(fake.patchCalls[0].payload.labels, ['bug', 'status:in-review']);
    assert.equal(fake.findIssue(1).labels.some((label) => label.name === 'status:done'), false);

    const refused = await client.request('/api/issues/1/status', {
      method: 'POST',
      body: { status: 'status:closed', fingerprint: response.json.issue.fingerprint },
    });
    assert.equal(refused.status, 400);
    assert.equal(fake.patchCalls.length, 1);
  } finally {
    await close();
  }
});

test('protected sections and oversized writes are refused without a PATCH', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;

    for (const sectionId of ['open-questions', 'human-tasks', 'acceptance-criteria']) {
      const response = await client.request('/api/issues/1/section', {
        method: 'PUT',
        body: { sectionId, text: 'x', fingerprint },
      });
      assert.equal(response.status, 400, sectionId);
    }

    const huge = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'x'.repeat(200_000), fingerprint },
    });
    assert.equal(huge.status, 413);

    const unknown = await client.request('/api/issues/1/danger', {
      method: 'POST',
      body: { fingerprint },
    });
    assert.equal(unknown.status, 404);
    assert.equal(fake.patchCalls.length, 0);
  } finally {
    await close();
  }
});

test('the client cannot name another repository', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();

    for (const route of [
      '/api/board?repo=evil/repo',
      '/api/issues/1?repository=evil/repo',
      '/repos/evil/repo/issues',
    ]) {
      const response = await client.request(route);
      assert.equal(response.status, 400, route);
    }
    const bodyRepo = await client.request('/api/board', {
      method: 'POST',
      body: { repo: 'evil/repo' },
    });
    assert.ok(bodyRepo.status === 400 || bodyRepo.status === 405);
    assert.deepEqual(fake.state.unknownRepoHits, []);
    assert.equal(
      fake.requests.every((request) => !request.path.includes('evil')),
      true,
    );
  } finally {
    await close();
  }
});

test('sessions expire and are cleared from the store', async () => {
  let now = 1_700_000_000_000;
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const board = await startBoard(fake, {
    now: () => now,
    sessionTtlMs: 1_000,
    idleTtlMs: 60_000,
  });
  try {
    const client = new HttpSession(board.url);
    const login = await client.login();
    assert.equal(login.status, 200);
    now += 500;
    assert.equal((await client.request('/api/board')).status, 200);
    now += 2_000;
    assert.equal((await client.request('/api/board')).status, 401);
    assert.equal((await client.request('/api/session')).json.authenticated, false);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('signing out destroys the session and clears the cookie', async () => {
  const { board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    assert.equal((await client.request('/api/board')).status, 200);
    const logout = await client.logout();
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/);
    assert.equal((await client.request('/api/board')).status, 401);
  } finally {
    await close();
  }
});

test('neither the token nor the password reaches HTML, JS, API responses or logs', async () => {
  const { board, logs, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();

    const surfaces = [];
    for (const route of ['/', '/app.js', '/theme.css', '/api/board', '/api/issues/1', '/api/session']) {
      const response = await client.request(route);
      surfaces.push(response.text);
    }
    const all = surfaces.join('\n') + '\n' + logs.join('\n');
    assert.equal(all.includes(SYNTHETIC_TOKEN), false);
    assert.equal(all.includes(BOARD_PASSWORD), false);
    assert.equal(all.includes(SESSION_SECRET), false);
    assert.equal(all.includes(client.cookie), false);
    assert.match(logs.join('\n'), /GET \/api\/board 200/);
    assert.equal(/\bauthorization\b/i.test(logs.join('\n')), false);
  } finally {
    await close();
  }
});

test('the API answers unknown routes and methods plainly', async () => {
  const { board, close } = await fixture();
  try {
    const client = new HttpSession(board.url);
    await client.login();
    assert.equal((await client.request('/api/nope')).status, 404);
    assert.equal((await client.request('/api/board', { method: 'DELETE' })).status, 405);
    assert.equal((await client.request('/api/issues/not-a-number')).status, 400);
  } finally {
    await close();
  }
});
