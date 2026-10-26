// Independent final-check probes for issue #33 N1-N5.
// Real HTTP against the actual board server modules and synthetic GitHub.
// Run from the worktree root: node .agents/run/task-centred-architecture/verifications/issue-33-integration/probes.mjs
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.env.PRODUCT_ROOT || process.cwd();
const { startFakeGitHub, makeIssue } = await import(path.resolve(root, 'web/tests/fake-github.mjs'));
const { startBoard, HttpSession, SYNTHETIC_TOKEN } = await import(path.resolve(root, 'web/tests/helpers.mjs'));
const proofDir = path.resolve(
  process.cwd(),
  '.agents/run/task-centred-architecture/verifications/issue-33-integration',
);
await mkdir(proofDir, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, ...detail });
}

async function withFixture(options, fn) {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, ...options });
  const board = await startBoard(fake);
  try {
    return await fn({ fake, board });
  } finally {
    await board.app.close();
    await fake.close();
  }
}

async function login(board) {
  const client = new HttpSession(board.url);
  const res = await client.login();
  if (res.status !== 200) throw new Error(`login failed ${res.status}`);
  return client;
}

// ---------------- N1: server-side post-commit 4xx provenance ----------------
await withFixture(
  {
    issues: [makeIssue({ number: 1, body: '## Overview\nOriginal\n', labels: ['status:todo'] })],
  },
  async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;

    fake.setPatchHook((issue, payload, req, res) => {
      // Model an upstream/proxy that applies the write and then returns a
      // non-GitHub-shaped error response.
      if (typeof payload?.body === 'string') issue.body = payload.body;
      res.writeHead(422, { 'content-type': 'text/html' });
      res.end('<h1>Gateway lost upstream</h1>');
    });
    let before = fake.patchCalls.length;
    const html422 = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Committed html422', fingerprint },
    });
    record('N1.srv.html422', html422.status === 502 && html422.json?.error === 'write_outcome_unknown', {
      status: html422.status,
      body: html422.json,
      patches: fake.patchCalls.length - before,
      committed: fake.findIssue(1).body.includes('Committed html422'),
    });

    // Valid-JSON but generic 422 from the same post-commit position.
    fake.setPatchHook((issue, payload, req, res) => {
      if (typeof payload?.body === 'string') issue.body = payload.body;
      res.writeHead(422, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Gateway lost upstream' }));
    });
    before = fake.patchCalls.length;
    const detail2 = await client.request('/api/issues/1');
    const json422 = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: {
        sectionId: 'overview',
        text: 'Committed json422',
        fingerprint: detail2.json.issue.fingerprint,
      },
    });
    record('N1.srv.json422', json422.status === 502 && json422.json?.error === 'write_outcome_unknown', {
      status: json422.status,
      body: json422.json,
      patches: fake.patchCalls.length - before,
      committed: fake.findIssue(1).body.includes('Committed json422'),
    });

    // Structured real-GitHub-shaped validation 422 (definitive pre-commit rejection).
    fake.setPatchHook((issue, payload, req, res) => {
      res.writeHead(422, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'Validation Failed',
          errors: [{ resource: 'Issue', field: 'body', code: 'invalid' }],
        }),
      );
    });
    const detail3 = await client.request('/api/issues/1');
    const real422 = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: {
        sectionId: 'overview',
        text: 'Rejected validation',
        fingerprint: detail3.json.issue.fingerprint,
      },
    });
    record('N1.srv.real422', real422.status === 400 && real422.json?.error === 'invalid_request', {
      status: real422.status,
      body: real422.json,
      committed: fake.findIssue(1).body.includes('Rejected validation'),
    });
  },
);

// ---------------- N2: redirects refused before dispatch ----------------
async function readRequestBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

{
  const destinationHits = [];
  const originHits = [];
  const destination = http.createServer(async (req, res) => {
    destinationHits.push({
      path: req.url,
      method: req.method,
      authorization: req.headers.authorization ?? null,
      body: await readRequestBody(req),
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ number: 9, body: 'attacker destination' }));
  });
  await new Promise((r) => destination.listen(0, '127.0.0.1', r));
  const destPort = destination.address().port;

  let originPort = 0;
  const origin = http.createServer(async (req, res) => {
    originHits.push({ path: req.url, method: req.method });
    if (req.method === 'GET' && req.url === '/user') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ login: 'board-owner', id: 1 }));
    }
    if (req.method === 'GET' && req.url === '/repos/owner/repo') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ full_name: 'owner/repo', permissions: { push: true } }));
    }
    if (req.method === 'GET' && req.url === '/repos/owner/repo/issues/1') {
      res.writeHead(200, { 'content-type': 'application/json', etag: '"etag-1"' });
      return res.end(
        JSON.stringify(
          makeIssue({
            number: 1,
            body: '## Overview\nOriginal\n',
            labels: ['status:todo'],
          }),
        ),
      );
    }
    if (req.method === 'GET' && req.url.startsWith('/repos/owner/repo/issues')) {
      // Same-origin redirect to another repository path.
      res.writeHead(302, { location: `/repos/other/repo/issues` });
      return res.end();
    }
    if (req.method === 'PATCH' && req.url === '/repos/owner/repo/issues/1') {
      const body = await readRequestBody(req);
      // Same-origin redirect to another repository issue.
      res.writeHead(307, { location: `/repos/other/repo/issues/9` });
      return res.end();
    }
    if (req.method === 'PATCH' && req.url === '/repos/owner/repo/issues/2') {
      await readRequestBody(req);
      // Cross-origin redirect preserving method/body.
      res.writeHead(307, { location: `http://127.0.0.1:${destPort}/repos/other/repo/issues/9` });
      return res.end();
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
  });
  await new Promise((r) => origin.listen(0, '127.0.0.1', r));
  originPort = origin.address().port;

  const { createBoardServer } = await import(path.resolve(root, 'web/server/app.ts'));
  const { loadConfig } = await import(path.resolve(root, 'web/server/config.ts'));
  const { BOARD_PASSWORD, SESSION_SECRET } = await import(path.resolve(root, 'web/tests/helpers.mjs'));
  const config = loadConfig({
    BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
    BOARD_GITHUB_LOGIN: 'board-owner',
    BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD,
    BOARD_SESSION_SECRET: SESSION_SECRET,
  });
  const logs = [];
  const app = await createBoardServer({
    config,
    githubApiBase: `http://127.0.0.1:${originPort}`,
    logger: (line) => logs.push(line),
  });
  const { port } = await app.listen(0);
  const client = new HttpSession(`http://127.0.0.1:${port}`);
  await client.login();

  try {
    const list = await client.request('/api/board');
    record(
      'N2.sameOriginGet302',
      list.status === 502 &&
        destinationHits.length === 0 &&
        !originHits.some((h) => h.path === '/repos/other/repo/issues'),
      {
        status: list.status,
        body: list.json,
        destinationHits: destinationHits.length,
        originHits,
      },
    );

    const detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;
    const patch = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'N2 same origin redirect', fingerprint },
    });
    record(
      'N2.sameOriginPatch307',
      patch.status === 502 &&
        patch.json?.error === 'write_outcome_unknown' &&
        destinationHits.length === 0 &&
        !originHits.some((h) => h.path === '/repos/other/repo/issues/9'),
      {
        status: patch.status,
        body: patch.json,
        destinationHits: destinationHits.length,
        originPATCHes: originHits.filter((h) => h.method === 'PATCH').length,
        originHits,
      },
    );

    // Direct GitHubClient cross-origin probe; servers stay up until after this.
    const { GitHubClient, GitHubError } = await import(path.resolve(root, 'web/server/github.ts'));
    const direct = new GitHubClient({
      apiBase: `http://127.0.0.1:${originPort}`,
      token: 'synthetic-secret-token',
      repo: { owner: 'owner', name: 'repo', full: 'owner/repo' },
    });
    let directError = null;
    try {
      await direct.updateIssue(2, { body: 'cross origin body' });
    } catch (error) {
      directError = error;
    }
    record(
      'N2.crossOriginPatch307',
      directError instanceof GitHubError &&
        destinationHits.length === 0 &&
        originHits.some((h) => h.method === 'PATCH'),
      {
        error: directError
          ? { name: directError.name, kind: directError.kind, status: directError.status, message: directError.message }
          : null,
        destinationHits,
      },
    );
  } finally {
    app.close();
    origin.closeAllConnections();
    destination.closeAllConnections();
    await new Promise((r) => origin.close(r));
    await new Promise((r) => destination.close(r));
  }
}

// ---------------- N3: readback projection integrity ----------------
await withFixture(
  {
    issues: [
      makeIssue({
        number: 1,
        body: '## Overview\nOriginal\n\n## Human Tasks\n- [ ] Keep suffix\n\nTrailing byte block\n',
      }),
    ],
  },
  async ({ fake, board }) => {
    const client = await login(board);
    let detail = await client.request('/api/issues/1');
    const fingerprint = detail.json.issue.fingerprint;
    const beforeBody = fake.findIssue(1).body;
    const suffix = beforeBody.slice(beforeBody.indexOf('## Human Tasks'));

    fake.setPatchHook((issue, payload) => {
      issue.body = payload.body.replace('    indented code', 'indented code');
      return { applyPayload: false };
    });
    const indented = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: '    indented code', fingerprint },
    });
    record(
      'N3.indentationMismatch',
      indented.status === 502 && indented.json?.error === 'write_outcome_unknown',
      { status: indented.status, body: indented.json, patches: fake.patchCalls.length },
    );

    // Trailing content whitespace mismatch on a non-blank line.
    fake.setPatchHook((issue, payload) => {
      issue.body = payload.body.replace('value   ', 'value');
      return { applyPayload: false };
    });
    detail = await client.request('/api/issues/1');
    const trailing = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'value   ', fingerprint: detail.json.issue.fingerprint },
    });
    record(
      'N3.trailingContentWhitespaceMismatch',
      trailing.status === 502 && trailing.json?.error === 'write_outcome_unknown',
      { status: trailing.status, body: trailing.json, patches: fake.patchCalls.length },
    );

    // Indentation-preserving success.
    fake.setPatchHook(null);
    detail = await client.request('/api/issues/1');
    const same = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: {
        sectionId: 'overview',
        text: '    indented code kept\nsecond line',
        fingerprint: detail.json.issue.fingerprint,
      },
    });
    const sameBody = fake.findIssue(1).body;
    record(
      'N3.indentationPreservedSuccess',
      same.status === 200 &&
        sameBody.includes('    indented code kept\nsecond line') &&
        sameBody.slice(sameBody.indexOf('## Human Tasks')) === suffix,
      {
        status: same.status,
        patches: fake.patchCalls.length,
        suffixEqual: sameBody.slice(sameBody.indexOf('## Human Tasks')) === suffix,
      },
    );

    detail = await client.request('/api/issues/1');
    const trailingOk = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: {
        sectionId: 'overview',
        text: 'trailing kept   ',
        fingerprint: detail.json.issue.fingerprint,
      },
    });
    record(
      'N3.trailingWhitespacePreservedSuccess',
      trailingOk.status === 200 && fake.findIssue(1).body.includes('trailing kept   \n'),
      { status: trailingOk.status, body: fake.findIssue(1).body },
    );
  },
);

await withFixture(
  {
    issues: [
      makeIssue({
        number: 1,
        body: '## Overview\r\n\r\nOriginal\r\n\r\n## Human Tasks\r\n- [ ] Keep\r\n',
      }),
    ],
  },
  async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    const res = await client.request('/api/issues/1/section', {
      method: 'PUT',
      body: {
        sectionId: 'overview',
        text: 'Changed\r\nsecond line',
        fingerprint: detail.json.issue.fingerprint,
      },
    });
    const body = fake.findIssue(1).body;
    record(
      'N3.crlfSuccessAndSuffix',
      res.status === 200 &&
        body === '## Overview\r\nChanged\r\nsecond line\r\n\r\n## Human Tasks\r\n- [ ] Keep\r\n',
      { status: res.status, patches: fake.patchCalls.length, body },
    );
  },
);

// ---------------- N4: fenced question integrity ----------------
const fenceFixtures = {
  hostile: [
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
  ].join('\n'),
  longerBacktick: [
    '## Open Questions',
    '````',
    '```',
    '- [ ] Inside four backticks?',
    '```',
    '````',
    '- [ ] Real after four backticks?',
  ].join('\n'),
  tilde: [
    '## Open Questions',
    '~~~~',
    '~~~',
    '- [ ] Inside four tildes?',
    '~~~',
    '~~~~',
    '- [ ] Real after four tildes?',
  ].join('\n'),
  beforeAndAfter: [
    '## Open Questions',
    '- [ ] First real question?',
    '```text',
    '- [ ] Fenced code question?',
    '```not-a-closing-fence',
    '- [ ] Still fenced code question?',
    '```',
    '- [ ] Second real question?',
  ].join('\n'),
  duplicates: [
    '## Open Questions',
    '- [ ] Duplicate question?',
    '- [ ] Duplicate question?',
  ].join('\n'),
  indentedCode: [
    '## Open Questions',
    '    - [ ] Four-space indented code question?',
    '- [ ] Indentation real question?',
  ].join('\n'),
};

for (const [name, body] of Object.entries(fenceFixtures)) {
  if (name === 'duplicates' || name === 'beforeAndAfter') continue;
  await withFixture(
    { issues: [makeIssue({ number: 1, title: name, body, labels: ['status:todo'] })] },
    async ({ fake, board }) => {
      const client = await login(board);
      const list = await client.request('/api/board');
      const detail = await client.request('/api/issues/1');
      const count = list.json.issues.find((i) => i.number === 1)?.counts.openQuestions;
      const views = detail.json.issue.openQuestions;
      const expected =
        name === 'hostile' || name === 'indentedCode'
          ? name === 'indentedCode'
            ? { total: 1, texts: ['Indentation real question?'] }
            : { total: 0, texts: [] }
          : {
              total: 1,
              texts: [
                name === 'longerBacktick' ? 'Real after four backticks?' : 'Real after four tildes?',
              ],
            };
      record(
        `N4.projection.${name}`,
        count?.total === expected.total && JSON.stringify(views.map((v) => v.text)) === JSON.stringify(expected.texts),
        { listCount: count, openQuestions: views, expected },
      );
    },
  );
}

// Hostile fixture: no question offered, direct answer refused, zero PATCH.
await withFixture(
  { issues: [makeIssue({ number: 1, body: fenceFixtures.hostile })] },
  async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    const answer = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'attempt', fingerprint: detail.json.issue.fingerprint },
    });
    record(
      'N4.hostileRefusal',
      detail.json.issue.openQuestions.length === 0 &&
        answer.status === 400 &&
        answer.json?.error === 'invalid_edit' &&
        fake.patchCalls.length === 0 &&
        fake.findIssue(1).body.includes('- [ ] This is a code example'),
      { detail: detail.json.issue.openQuestions, answer: { status: answer.status, body: answer.json }, patches: fake.patchCalls.length },
    );
  },
);

// Real question before and after fenced blocks: indices agree, targeting exact.
await withFixture(
  { issues: [makeIssue({ number: 1, body: fenceFixtures.beforeAndAfter })] },
  async ({ fake, board }) => {
    const client = await login(board);
    let detail = await client.request('/api/issues/1');
    const views = detail.json.issue.openQuestions;
    const first = views.find((q) => q.text === 'First real question?');
    const second = views.find((q) => q.text === 'Second real question?');
    const okViews =
      views.length === 2 &&
      first?.answerIndex === 0 &&
      second?.answerIndex === 1 &&
      !views.some((q) => q.text.includes('code question'));
    let res = await client.request(`/api/issues/1/questions/${first.answerIndex}/answer`, {
      method: 'POST',
      body: { answer: 'first answer', fingerprint: detail.json.issue.fingerprint },
    });
    let body = fake.findIssue(1).body;
    const firstOk =
      res.status === 200 &&
      body.includes('- [x] First real question? *(Answer: first answer)*') &&
      body.includes('- [ ] Second real question?') &&
      body.includes('- [ ] Fenced code question?');
    detail = await client.request('/api/issues/1');
    const refreshedSecond = detail.json.issue.openQuestions.find(
      (q) => q.text === 'Second real question?',
    );
    res = await client.request(`/api/issues/1/questions/${refreshedSecond.answerIndex}/answer`, {
      method: 'POST',
      body: { answer: 'second answer', fingerprint: detail.json.issue.fingerprint },
    });
    body = fake.findIssue(1).body;
    record(
      'N4.realBeforeAfterFence',
      okViews &&
        firstOk &&
        res.status === 200 &&
        body.includes('- [x] Second real question? *(Answer: second answer)*') &&
        body.includes('- [ ] Fenced code question?'),
      { views, patches: fake.patchCalls.length, body },
    );
  },
);

// Duplicate questions: index 1 targets the second occurrence only.
await withFixture(
  { issues: [makeIssue({ number: 1, body: fenceFixtures.duplicates })] },
  async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    const res = await client.request('/api/issues/1/questions/1/answer', {
      method: 'POST',
      body: { answer: 'second only', fingerprint: detail.json.issue.fingerprint },
    });
    const lines = fake.findIssue(1).body.split('\n');
    record(
      'N4.duplicateTargeting',
      res.status === 200 &&
        lines[1] === '- [ ] Duplicate question?' &&
        lines[2] === '- [x] Duplicate question? *(Answer: second only)*',
      { status: res.status, lines, patches: fake.patchCalls.length },
    );
  },
);

// Stale source question: fingerprint conflict refuses with zero PATCH.
await withFixture(
  { issues: [makeIssue({ number: 1, body: '## Open Questions\n- [ ] Original question?\n' })] },
  async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    fake.mutateIssue(1, (issue) => {
      issue.body = '## Open Questions\n- [ ] Changed question?\n';
    });
    const res = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'stale answer', fingerprint: detail.json.issue.fingerprint },
    });
    record(
      'N4.staleQuestionRefusal',
      res.status === 409 &&
        res.json?.error === 'conflict' &&
        fake.patchCalls.length === 0 &&
        res.json?.issue?.openQuestions?.[0]?.text === 'Changed question?',
      {
        status: res.status,
        body: res.json?.error,
        shownQuestion: res.json?.issue?.openQuestions?.[0]?.text,
        patches: fake.patchCalls.length,
      },
    );
  },
);

// Adjacent residual (not part of the named fenced variants): an indented code
// block checkbox is still offered and mutable. Recorded for adjudication.
await withFixture(
  { issues: [makeIssue({ number: 1, body: fenceFixtures.indentedCode })] },
  async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    const views = detail.json.issue.openQuestions;
    const res = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'mutated code', fingerprint: detail.json.issue.fingerprint },
    });
    record('N4.adjacentIndentedCode', views.length === 1 && views[0].text === 'Indentation real question?' && res.status === 200 && fake.findIssue(1).body.includes('    - [ ] Four-space indented code question?'), {
      observed: views,
      answerStatus: res.status,
      body: fake.findIssue(1).body,
      patches: fake.patchCalls.length,
    });
  },
);

// Longer/tilde variants: the fenced code checkbox is not addressable even by
// index, and the real question after the fence is the only mutable target.
for (const [name, body] of [
  ['longerBacktick', fenceFixtures.longerBacktick],
  ['tilde', fenceFixtures.tilde],
]) {
  await withFixture({ issues: [makeIssue({ number: 1, body, labels: ['status:todo'] })] }, async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    const outOfRange = await client.request('/api/issues/1/questions/1/answer', {
      method: 'POST',
      body: { answer: 'attempt code', fingerprint: detail.json.issue.fingerprint },
    });
    const real = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'real answer', fingerprint: detail.json.issue.fingerprint },
    });
    const updated = fake.findIssue(1).body;
    record(
      `N4.directTargeting.${name}`,
      detail.json.issue.openQuestions.length === 1 &&
        outOfRange.status === 400 &&
        fake.patchCalls.length === 1 &&
        real.status === 200 &&
        updated.includes('- [ ] Inside four') &&
        updated.includes('*(Answer: real answer)*'),
      {
        views: detail.json.issue.openQuestions,
        outOfRange: { status: outOfRange.status, body: outOfRange.json },
        realStatus: real.status,
        patches: fake.patchCalls.length,
        updated,
      },
    );
  });
}

// Completed question shifts answerIndex; targeting remains the open question.
await withFixture(
  {
    issues: [
      makeIssue({
        number: 1,
        body: '## Open Questions\n- [x] Completed question? *(Answer: done)*\n- [ ] Still open question?\n',
      }),
    ],
  },
  async ({ fake, board }) => {
    const client = await login(board);
    const detail = await client.request('/api/issues/1');
    const views = detail.json.issue.openQuestions;
    const res = await client.request('/api/issues/1/questions/0/answer', {
      method: 'POST',
      body: { answer: 'open answer', fingerprint: detail.json.issue.fingerprint },
    });
    record(
      'N4.completedIndexShift',
      views.length === 2 &&
        views[0].completed === true &&
        views[0].answerIndex === null &&
        views[1].answerIndex === 0 &&
        res.status === 200 &&
        fake.findIssue(1).body.includes('- [x] Still open question? *(Answer: open answer)*'),
      { views, status: res.status, patches: fake.patchCalls.length },
    );
  },
);

// ---------------- Smoke: auth, CSRF, token secrecy, status semantics ----------------
await withFixture(
  {
    issues: [
      makeIssue({
        number: 1,
        title: 'Sensitive synthetic token check',
        body: '## Overview\nText\n\n## Open Questions\n- [ ] Q?\n',
        labels: ['status:todo', 'phase:execution', 'attention:needs-decision', 'bug'],
      }),
    ],
  },
  async ({ fake, board }) => {
    const anonymous = new HttpSession(board.url);
    const unauth = await anonymous.request('/api/board');
    record('smoke.unauth', unauth.status === 401 && unauth.json?.error === 'unauthenticated', {
      status: unauth.status,
    });

    const client = new HttpSession(board.url);
    const noCsrf = await client.login();
    const csrfMissing = await client.request('/api/issues/1/status', {
      method: 'POST',
      body: { status: 'status:done', fingerprint: 'a'.repeat(64) },
      csrf: false,
    });
    const forgedSession = new HttpSession(board.url);
    const forged = await forgedSession.request('/api/board', {
      headers: { cookie: 'board_session=forged' },
    });
    record(
      'smoke.csrfAndForgedCookie',
      noCsrf.status === 200 && csrfMissing.status === 403 && forged.status === 401,
      { login: noCsrf.status, csrfMissing: csrfMissing.status, forged: forged.status },
    );

    const detail = await client.request('/api/issues/1');
    const page = await client.request('/');
    const js = await client.request('/app.js');
    const tokenLeak = [page.text, js.text, JSON.stringify(detail.json)].some((text) =>
      text.includes(SYNTHETIC_TOKEN),
    );
    const warning = page.text.includes('simultaneous edit on GitHub or by an agent can still be overwritten');
    record('smoke.tokenAndWarning', !tokenLeak && warning, { tokenLeak, warning });

    const before = fake.findIssue(1);
    const done = await client.request('/api/issues/1/status', {
      method: 'POST',
      body: { status: 'status:done', fingerprint: detail.json.issue.fingerprint },
    });
    const after = fake.findIssue(1);
    const labels = after.labels.map((label) => label.name);
    record(
      'smoke.humanDoneOnly',
      done.status === 200 &&
        after.state === 'open' &&
        labels.includes('status:done') &&
        labels.includes('phase:execution') &&
        labels.includes('attention:needs-decision') &&
        labels.includes('bug') &&
        !labels.includes('status:todo'),
      { status: done.status, state: after.state, labels, beforeState: before.state },
    );

    // Login/logout semantics and cookie flags.
    const wrongSession = new HttpSession(board.url);
    const wrong = await wrongSession.login('definitely not the password');
    const cookieHeader = noCsrf.headers.get('set-cookie') ?? '';
    const logout = await client.logout();
    const afterLogout = await client.request('/api/board');
    record(
      'smoke.loginLogout',
      wrong.status === 401 &&
        logout.status === 204 &&
        afterLogout.status === 401 &&
        /HttpOnly/i.test(cookieHeader) &&
        /SameSite=Strict/i.test(cookieHeader) &&
        /Path=\//i.test(cookieHeader),
      {
        wrong: wrong.status,
        logout: logout.status,
        afterLogout: afterLogout.status,
        cookieFlags: cookieHeader.replace(/=[^;]+/, '=<redacted>'),
      },
    );
  },
);

await writeFile(path.join(proofDir, process.env.RESULT_PREFIX ? process.env.RESULT_PREFIX + '-probes.json' : 'probes.json'), JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2) + '\n');
const failed = results.filter((r) => !r.pass);
console.log(
  JSON.stringify(
    {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.map((r) => r.name),
      observations: results.filter((r) => ['N4.adjacentIndentedCode', 'N1.srv.json422'].includes(r.name)),
    },
    null,
    2,
  ),
);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}`);
process.exit(failed.length ? 1 : 0);
