import test from 'node:test';
import assert from 'node:assert/strict';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

function repoFixture(repo, issues, extra = {}) {
  return { repo, issues, ...extra };
}

async function fixture(options = {}) {
  const repositories = options.repositories ?? [
    repoFixture(
      'test-owner/primary-repo',
      options.issues ?? [
        makeIssue({
          number: 1,
          title: 'Draft issue',
          body: '## Overview\n\nDraft body markdown\n',
          labels: ['status:draft'],
          repo: 'test-owner/primary-repo',
        }),
        makeIssue({
          number: 2,
          title: 'In-progress issue',
          body: 'Progress body text',
          labels: ['status:in-progress'],
          repo: 'test-owner/primary-repo',
        }),
        makeIssue({
          number: 3,
          title: 'Unlabeled open issue',
          body: 'Plain body text without status labels',
          labels: [],
          repo: 'test-owner/primary-repo',
        }),
        makeIssue({
          number: 4,
          title: 'Done issue',
          body: 'Completed work',
          state: 'closed',
          labels: ['status:done'],
          repo: 'test-owner/primary-repo',
        }),
      ],
      { id: 101 },
    ),
  ];

  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories,
    ...(options.fake ?? {}),
  });

  let board;
  try {
    board = await startBoard(fake, {
      ...(options.board ?? {}),
      config: options.config ?? browserConfig(fake, options.env ?? {}),
    });
  } catch (error) {
    await fake.close();
    throw error;
  }

  return {
    fake,
    board,
    close: async () => {
      await board.app.close();
      await fake.close();
    },
  };
}

async function signedIn(url) {
  const client = new HttpSession(url);
  const login = await client.login();
  assert.equal(login.status, 200);
  return client;
}

test('conditional 304 and weak ETag revalidation for /api/repos, /api/board, and /api/combined/board', async () => {
  const { board, close } = await fixture();
  try {
    const client = await signedIn(board.url);

    // 1. /api/repos
    const reposRes = await client.request('/api/repos');
    assert.equal(reposRes.status, 200);
    const reposEtag = reposRes.headers.get('etag');
    assert.ok(reposEtag, 'Expected etag header on /api/repos');
    assert.equal(reposRes.headers.get('cache-control'), 'private, no-cache');

    const reposNotMod = await client.request('/api/repos', {
      headers: { 'if-none-match': reposEtag },
    });
    assert.equal(reposNotMod.status, 304);
    assert.equal(reposNotMod.text, '');
    assert.equal(reposNotMod.headers.get('cache-control'), 'private, no-cache');

    // Weak comparison without W/ prefix
    const rawReposEtag = reposEtag.replace(/^W\//, '');
    const reposNotModBare = await client.request('/api/repos', {
      headers: { 'if-none-match': rawReposEtag },
    });
    assert.equal(reposNotModBare.status, 304);

    // 2. /api/board
    const boardRes = await client.request('/api/board');
    assert.equal(boardRes.status, 200);
    const boardEtag = boardRes.headers.get('etag');
    assert.ok(boardEtag, 'Expected etag header on /api/board');
    assert.equal(boardRes.headers.get('cache-control'), 'private, no-cache');

    const boardNotMod = await client.request('/api/board', {
      headers: { 'if-none-match': boardEtag },
    });
    assert.equal(boardNotMod.status, 304);
    assert.equal(boardNotMod.text, '');
    assert.equal(boardNotMod.headers.get('cache-control'), 'private, no-cache');

    // 3. /api/combined/board
    const combinedRes = await client.request('/api/combined/board');
    assert.equal(combinedRes.status, 200);
    const combinedEtag = combinedRes.headers.get('etag');
    assert.ok(combinedEtag, 'Expected etag header on /api/combined/board');
    assert.equal(combinedRes.headers.get('cache-control'), 'private, no-cache');

    const combinedNotMod = await client.request('/api/combined/board', {
      headers: { 'if-none-match': combinedEtag },
    });
    assert.equal(combinedNotMod.status, 304);
    assert.equal(combinedNotMod.text, '');
    assert.equal(combinedNotMod.headers.get('cache-control'), 'private, no-cache');

    // 4. Default routes preserve SECURITY_HEADERS['cache-control'] = 'no-store'
    const sessionRes = await client.request('/api/session');
    assert.equal(sessionRes.headers.get('cache-control'), 'no-store');
  } finally {
    await close();
  }
});

test('query parameter ?refresh=1 forces fresh fetch and bypasses ETag 304 match', async () => {
  const { board, close } = await fixture();
  try {
    const client = await signedIn(board.url);

    // /api/repos with refresh=1
    const reposInitial = await client.request('/api/repos');
    assert.equal(reposInitial.status, 200);
    const reposEtag = reposInitial.headers.get('etag');

    const reposRefreshed = await client.request('/api/repos?refresh=1', {
      headers: { 'if-none-match': reposEtag },
    });
    assert.equal(reposRefreshed.status, 200);
    assert.ok(reposRefreshed.json);
    assert.equal(reposRefreshed.json.visibleCount, 1);

    // /api/board with refresh=1
    const boardInitial = await client.request('/api/board');
    assert.equal(boardInitial.status, 200);
    const boardEtag = boardInitial.headers.get('etag');

    const boardRefreshed = await client.request('/api/board?refresh=1', {
      headers: { 'if-none-match': boardEtag },
    });
    assert.equal(boardRefreshed.status, 200);
    assert.ok(boardRefreshed.json);
    assert.equal(boardRefreshed.json.issues.length, 4);

    // /api/combined/board with refresh=1
    const combinedInitial = await client.request('/api/combined/board');
    assert.equal(combinedInitial.status, 200);
    const combinedEtag = combinedInitial.headers.get('etag');

    const combinedRefreshed = await client.request('/api/combined/board?refresh=1', {
      headers: { 'if-none-match': combinedEtag },
    });
    assert.equal(combinedRefreshed.status, 200);
    assert.ok(combinedRefreshed.json);
    assert.equal(combinedRefreshed.json.issues.length, 4);
  } finally {
    await close();
  }
});

test('zero-waste GraphQL dependency query skipping when repository has 0 open issues', async () => {
  const { fake, board, close } = await fixture({
    repositories: [
      repoFixture('test-owner/empty-repo', [], { id: 201 }),
      repoFixture(
        'test-owner/open-repo',
        [makeIssue({ number: 1, title: 'Active task', state: 'open', repo: 'test-owner/open-repo' })],
        { id: 202 },
      ),
    ],
  });
  try {
    const client = await signedIn(board.url);

    // Request board for empty repo (0 open issues)
    const emptyBoardRes = await client.request('/api/repos/test-owner/empty-repo/board');
    assert.equal(emptyBoardRes.status, 200);
    assert.equal(emptyBoardRes.json.issues.length, 0);

    const emptyRepoGraphQLCalls = fake.state.graphqlCalls.filter((c) =>
      c.variables?.owner === 'test-owner' && c.variables?.name === 'empty-repo',
    );
    assert.equal(emptyRepoGraphQLCalls.length, 0, 'GraphQL dependency queries must be skipped for 0 open issues');

    // Request board for open repo (1 open issue)
    const openBoardRes = await client.request('/api/repos/test-owner/open-repo/board');
    assert.equal(openBoardRes.status, 200);
    assert.equal(openBoardRes.json.issues.length, 1);

    const openRepoGraphQLCalls = fake.state.graphqlCalls.filter((c) =>
      c.variables?.owner === 'test-owner' && c.variables?.name === 'open-repo',
    );
    assert.equal(openRepoGraphQLCalls.length, 1, 'GraphQL dependency query should run when repository has open issues');
  } finally {
    await close();
  }
});

test('singleflight request coalescing ensures concurrent board requests share single GitHub fetch', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = await signedIn(board.url);

    fake.setListDelay(60);
    const beforeCount = fake.requests.filter((r) => r.path === '/repos/test-owner/primary-repo/issues').length;

    const [res1, res2, res3] = await Promise.all([
      client.request('/api/board'),
      client.request('/api/board'),
      client.request('/api/board'),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(res3.status, 200);
    assert.equal(res1.json.issues.length, 4);
    assert.equal(res2.json.issues.length, 4);
    assert.equal(res3.json.issues.length, 4);

    const afterCount = fake.requests.filter((r) => r.path === '/repos/test-owner/primary-repo/issues').length;
    assert.equal(afterCount - beforeCount, 1, 'Concurrent requests must coalesce into a single GitHub issues call');
  } finally {
    fake.setListDelay(0);
    await close();
  }
});

test('rateLimit telemetry is exposed on repos, board, and combined endpoints without polluting ETags', async () => {
  const { board, close } = await fixture();
  try {
    const client = await signedIn(board.url);

    const reposRes = await client.request('/api/repos');
    assert.ok(reposRes.json.rateLimit, 'Rate limit telemetry should be present on /api/repos');
    assert.equal(typeof reposRes.json.rateLimit.limit, 'number');
    assert.equal(typeof reposRes.json.rateLimit.remaining, 'number');

    const boardRes = await client.request('/api/board');
    assert.ok(boardRes.json.rateLimit, 'Rate limit telemetry should be present on /api/board');
    assert.equal(typeof boardRes.json.rateLimit.limit, 'number');

    const combinedRes = await client.request('/api/combined/board');
    assert.ok(combinedRes.json.rateLimit, 'Rate limit telemetry should be present on /api/combined/board');
    assert.equal(typeof combinedRes.json.rateLimit.limit, 'number');
  } finally {
    await close();
  }
});

test('effectiveStage, isExplicitDraft, bodyMarkdown, and backward-compatible column projection', async () => {
  const { board, close } = await fixture();
  try {
    const client = await signedIn(board.url);
    const boardRes = await client.request('/api/board');
    assert.equal(boardRes.status, 200);

    const issues = boardRes.json.issues;
    const issue1 = issues.find((i) => i.number === 1);
    const issue2 = issues.find((i) => i.number === 2);
    const issue3 = issues.find((i) => i.number === 3);
    const issue4 = issues.find((i) => i.number === 4);

    // Issue 1: status:draft
    assert.equal(issue1.effectiveStage, 'draft');
    assert.equal(issue1.isExplicitDraft, true);
    assert.equal(issue1.column, 'draft'); // backward-compatible column

    // Issue 2: status:in-progress
    assert.equal(issue2.effectiveStage, 'in-progress');
    assert.equal(issue2.isExplicitDraft, false);
    assert.equal(issue2.column, 'in-progress');

    // Issue 3: unlabeled open issue (any-repo arbitrary issue)
    assert.equal(issue3.effectiveStage, 'todo');
    assert.equal(issue3.isExplicitDraft, false);
    assert.equal(issue3.column, 'draft'); // panel default for unlabeled issue without priority

    // Issue 4: status:done, closed
    assert.equal(issue4.effectiveStage, 'done');
    assert.equal(issue4.isExplicitDraft, false);
    assert.equal(issue4.column, 'done');

    // Detail endpoint: bodyMarkdown and effectiveStage
    const detailRes = await client.request('/api/issues/1');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.json.issue.bodyMarkdown, '## Overview\n\nDraft body markdown\n');
    assert.equal(detailRes.json.issue.effectiveStage, 'draft');
    assert.equal(detailRes.json.issue.isExplicitDraft, true);
  } finally {
    await close();
  }
});

test('graceful 403 and 422 label fallback on issue creation', async () => {
  const { fake, board, close } = await fixture();
  try {
    const client = await signedIn(board.url);

    // 1. 403 on POST /api/issues with labels -> retries without labels
    fake.setFailLabels(403);
    const res403 = await client.request('/api/issues', {
      method: 'POST',
      body: {
        title: 'New issue with 403 label permission restriction',
        body: 'Issue description text',
        labels: ['status:draft'],
      },
    });
    assert.equal(res403.status, 201);
    assert.equal(res403.json.ok, true);
    assert.equal(res403.json.labelFallback, true);
    assert.deepEqual(res403.json.issue.labels, []);

    // 2. 422 on POST /api/repos/:owner/:name/issues with labels -> retries without labels
    fake.setFailLabels(422);
    const res422 = await client.request('/api/repos/test-owner/primary-repo/issues', {
      method: 'POST',
      body: {
        title: 'Repo scoped issue with 422 label error',
        body: 'Another issue description',
        labels: ['status:todo'],
      },
    });
    assert.equal(res422.status, 201);
    assert.equal(res422.json.ok, true);
    assert.equal(res422.json.labelFallback, true);
    assert.deepEqual(res422.json.issue.labels, []);

    // 3. Normal creation with labels (no failure) -> no labelFallback returned
    fake.setFailLabels(false);
    const resNormal = await client.request('/api/issues', {
      method: 'POST',
      body: {
        title: 'Normal issue with supported labels',
        labels: ['status:draft'],
      },
    });
    assert.equal(resNormal.status, 201);
    assert.equal(resNormal.json.ok, true);
    assert.equal(resNormal.json.labelFallback, undefined);
    assert.deepEqual(resNormal.json.issue.labels, ['status:draft']);
  } finally {
    fake.setFailLabels(false);
    await close();
  }
});

test('repository with has_issues: false makes zero issue-list and zero GraphQL calls', async () => {
  const { fake, board, close } = await fixture({
    repositories: [
      repoFixture(
        'test-owner/no-issues-repo',
        [makeIssue({ number: 1, title: 'Ignored', state: 'open', repo: 'test-owner/no-issues-repo' })],
        { id: 301, hasIssues: false },
      ),
      repoFixture(
        'test-owner/active-repo',
        [makeIssue({ number: 2, title: 'Visible', state: 'open', repo: 'test-owner/active-repo' })],
        { id: 302, hasIssues: true },
      ),
    ],
  });
  try {
    const client = await signedIn(board.url);

    const scopedRes = await client.request('/api/repos/test-owner/no-issues-repo/board');
    assert.equal(scopedRes.status, 200);
    assert.equal(scopedRes.json.issues.length, 0);

    const combinedRes = await client.request('/api/combined/board');
    assert.equal(combinedRes.status, 200);
    assert.equal(combinedRes.json.issues.length, 1);
    assert.equal(combinedRes.json.issues[0].repository.full, 'test-owner/active-repo');

    const issueListCalls = fake.requests.filter((r) => r.path === '/repos/test-owner/no-issues-repo/issues');
    const graphqlCalls = fake.state.graphqlCalls.filter((c) =>
      c.variables?.owner === 'test-owner' && c.variables?.name === 'no-issues-repo',
    );
    assert.equal(issueListCalls.length, 0, 'Expected zero issue-list requests for has_issues:false repository');
    assert.equal(graphqlCalls.length, 0, 'Expected zero GraphQL requests for has_issues:false repository');
  } finally {
    await close();
  }
});

test('V3-3: Operations buckets agree with effectiveStage for unlabeled open issues', async () => {
  const { board, close } = await fixture();
  try {
    const client = await signedIn(board.url);
    const boardResult = await client.request('/api/board');
    for (const route of ['/api/operations', '/api/combined/operations']) {
      const result = await client.request(route);
      assert.equal(result.status, 200, result.text);
      const counts = result.json.statusPerProject['test-owner/primary-repo'];
      for (const stage of Object.keys(counts)) {
        assert.equal(counts[stage], boardResult.json.issues.filter(i => i.effectiveStage === stage).length, stage);
      }
      assert.equal(counts.draft, 1);
      assert.equal(counts.todo, 1);
    }
  } finally { await close(); }
});

test('V3-3: conditional validators are private and session-bound for every board scope', async () => {
  const { board, close } = await fixture();
  try {
    const first = await signedIn(board.url);
    const second = await signedIn(board.url);
    for (const route of ['/api/repos', '/api/board', '/api/combined/board', '/api/repos/test-owner/primary-repo/board']) {
      const initial = await first.request(route);
      const headers = { 'if-none-match': initial.headers.get('etag') };
      assert.equal((await first.request(route, { headers })).status, 304);
      const crossSession = await second.request(route, { headers });
      assert.equal(crossSession.status, 200, route);
      assert.equal(crossSession.headers.get('cache-control'), 'private, no-cache');
      assert.notEqual(crossSession.headers.get('etag'), headers['if-none-match']);
    }
  } finally { await close(); }
});

test('V3-3: single-page discovery really revalidates upstream; rejected singleflight retries', async () => {
  let clock = Date.now();
  const { fake, board, close } = await fixture({ board: { now: () => clock, repositoryTtlMs: 10, boardCacheTtlMs: 0 }, fake: { honorIfNoneMatch: true } });
  try {
    const client = await signedIn(board.url);
    const initial = await client.request('/api/repos');
    clock += 20;
    const before = fake.requests.filter(r => r.path === '/user/repos').length;
    const conditional = await client.request('/api/repos', { headers: { 'if-none-match': initial.headers.get('etag') } });
    assert.equal(conditional.status, 304);
    assert.equal(fake.requests.filter(r => r.path === '/user/repos').length, before + 1);
    assert.equal(conditional.headers.get('etag'), initial.headers.get('etag'));
    const upstream = fake.requests.filter(r => r.path === '/user/repos').at(-1);
    assert.ok(upstream.ifNoneMatch, 'upstream If-None-Match must actually be sent');
    assert.equal(upstream.responseStatus, 304, 'upstream must actually return 304');
    // Synthetic API exposes fixed rate telemetry; production GitHub billing is not simulated here.
    fake.setRepoFailing('test-owner/primary-repo', true);
    fake.setListDelay(40);
    const failures = await Promise.all([client.request('/api/board'), client.request('/api/board')]);
    assert.ok(failures.every(r => r.status === 502), failures.map(r => r.text).join('\n'));
    fake.setRepoFailing('test-owner/primary-repo', false);
    fake.setListDelay(0);
    assert.equal((await client.request('/api/board')).status, 200);
  } finally { await close(); }
});

test('V3-3: page-1 validators never suppress later issue pages, closed pages or discovery pages', async () => {
  let clock = Date.now();
  const repo = 'test-owner/primary-repo';
  const issues = Array.from({ length: 101 }, (_, i) => makeIssue({ number: i + 1, state: 'closed', labels: [], repo }));
  const repositories = [repoFixture(repo, issues, { id: 1 }), ...Array.from({ length: 100 }, (_, i) => repoFixture(`test-owner/repo-${i}`, [], { id: i + 2 }))];
  const { fake, board, close } = await fixture({ repositories, board: { now: () => clock, repositoryTtlMs: 10, boardCacheTtlMs: 0 }, fake: { honorIfNoneMatch: true } });
  try {
    const client = await signedIn(board.url);
    const initial = await client.request('/api/board');
    assert.equal(initial.json.issues.length, 101);
    assert.equal(new Set(initial.json.issues.map(i => i.number)).size, 101);
    await client.request('/api/archive');
    fake.mutateIssue(101, issue => { issue.title = 'Changed page two'; });
    const changed = await client.request('/api/board', { headers: { 'if-none-match': initial.headers.get('etag') } });
    assert.equal(changed.status, 200);
    assert.equal(changed.json.issues.find(i => i.number === 101).title, 'Changed page two');
    const archive = await client.request('/api/archive');
    assert.match(JSON.stringify(archive.json), /Changed page two/);
    fake.setHasIssues('test-owner/repo-99', false);
    clock += 20;
    const discovery = await client.request('/api/repos');
    assert.equal(discovery.json.repositories.find(r => r.full === 'test-owner/repo-99').hasIssues, false);
  } finally { await close(); }
});

test('V3-3: degraded dependencies retry instead of accepting a page-1 304 forever', async () => {
  let reject = true;
  const { fake, board, close } = await fixture({ board: { boardCacheTtlMs: 0 }, fake: { honorIfNoneMatch: true, graphqlHook: () => reject ? { status: 503, payload: { message: 'temporary failure' } } : null } });
  try {
    const client = await signedIn(board.url);
    const initial = await client.request('/api/board');
    assert.equal(initial.json.dependenciesDegraded, true);
    reject = false;
    const recovered = await client.request('/api/board');
    assert.equal(recovered.json.dependenciesDegraded, false);
    assert.equal(fake.state.graphqlCalls.length, 2);
  } finally { await close(); }
});

test('V3-3: cached boards and closed archives invalidate after patch, create, batch order and transfer', async () => {
  const firstRepo = 'test-owner/primary-repo';
  const target = 'test-owner/target';
  const { board, close } = await fixture({ repositories: [
    repoFixture(firstRepo, [makeIssue({ number: 1, title: 'Draft', body: 'Body', labels: ['status:draft'], repo: firstRepo })]),
    repoFixture(target, [makeIssue({ number: 1, title: 'Other draft', body: 'Other', labels: ['status:draft'], repo: target })], { id: 999 }),
  ], board: { boardCacheTtlMs: 30000 } });
  try {
    const client = await signedIn(board.url);
    const base = '/api/repos/' + firstRepo;
    let current = await client.request(base + '/board');
    await client.request(base + '/archive');
    const oldTag = current.headers.get('etag');
    const fp = current.json.issues[0].fingerprint;
    const ordered = await client.request(base + '/issues/1/order', { method: 'PUT', body: { fingerprint: fp, updates: [{ repo: firstRepo, number: 1, fingerprint: fp, order: 2000 }] } });
    assert.equal(ordered.status, 200, ordered.text);
    current = await client.request(base + '/board', { headers: { 'if-none-match': oldTag } });
    assert.equal(current.status, 200);
    assert.equal(current.json.issues[0].order, 2000);
    await client.request('/api/repos/' + target + '/board');
    const moved = await client.request(base + '/issues/1/move', { method: 'PUT', body: { fingerprint: current.json.issues[0].fingerprint, target, confirmed: true } });
    assert.equal(moved.status, 200, moved.text);
    assert.equal((await client.request(base + '/board')).json.issues.length, 0);
    assert.equal((await client.request('/api/repos/' + target + '/board')).json.issues.length, 2);
    const patchBase = '/api/repos/' + target;
    const detail = await client.request(patchBase + '/issues/1');
    const closed = await client.request(patchBase + '/issues/1', { method: 'PATCH', body: { fingerprint: detail.json.issue.fingerprint, state: 'closed' } });
    assert.equal(closed.status, 200, closed.text);
    assert.match(JSON.stringify((await client.request(patchBase + '/archive')).json), /Other draft/);
    const created = await client.request(base + '/issues', { method: 'POST', body: { title: 'New issue', body: 'text' } });
    assert.equal(created.status, 201);
    assert.equal((await client.request(base + '/board')).json.issues.length, 1);
  } finally { await close(); }
});

test('V3-3: disabled repositories also skip issue lists in archives', async () => {
  const { fake, board, close } = await fixture({ repositories: [repoFixture('test-owner/disabled', [], { hasIssues: false })] });
  try {
    const client = await signedIn(board.url);
    for (const route of ['/api/repos/test-owner/disabled/archive', '/api/combined/archive']) {
      assert.equal((await client.request(route)).status, 200);
    }
    assert.equal(fake.requests.filter(r => /\/issues$/.test(r.path) || r.path === '/graphql').length, 0);
  } finally { await close(); }
});

test('V3-3: dependency deletion invalidates board even when upstream outcome is unknown', async () => {
  const repo = 'test-owner/primary-repo';
  const { fake, board, close } = await fixture({
    issues: [makeIssue({ number: 1, repo }), makeIssue({ number: 2, repo })],
    board: { boardCacheTtlMs: 30000 },
  });
  try {
    fake.addDependency(1, 2);
    const client = await signedIn(board.url);
    const old = await client.request('/api/board');
    assert.equal(old.json.issues.find(i => i.number === 1).blockedBy.length, 1);
    // Inject an ambiguous response after applying the mutation. Next read must reconcile.
    fake.setDependencyHook(({ method }) => {
      if (method !== 'DELETE') return null;
      fake.repositories[0].dependencies = [];
      return { status: 500, payload: { message: 'response lost after deletion' } };
    });
    const deleted = await client.request('/api/issues/1/dependencies/blocked_by/2', { method: 'DELETE' });
    assert.equal(deleted.status, 502);
    const next = await client.request('/api/board', { headers: { 'if-none-match': old.headers.get('etag') } });
    assert.equal(next.status, 200);
    assert.equal(next.json.issues.find(i => i.number === 1).blockedBy.length, 0);
  } finally { await close(); }
});

test('V3-3: truncated ten-page issue snapshots cannot revalidate only page one', async () => {
  const repo = 'test-owner/primary-repo';
  const issues = Array.from({ length: 1001 }, (_, i) => makeIssue({ number: i + 1, state: 'closed', repo }));
  const { fake, board, close } = await fixture({ issues, board: { boardCacheTtlMs: 0 }, fake: { honorIfNoneMatch: true } });
  try {
    const client = await signedIn(board.url);
    const initial = await client.request('/api/board');
    assert.equal(initial.json.truncated, true);
    assert.equal(initial.json.issues.length, 1000);
    fake.mutateIssue(1000, issue => { issue.title = 'Changed in truncated snapshot'; });
    const next = await client.request('/api/board', { headers: { 'if-none-match': initial.headers.get('etag') } });
    assert.equal(next.status, 200);
    assert.equal(next.json.issues.find(i => i.number === 1000).title, 'Changed in truncated snapshot');
    const lists = fake.requests.filter(r => r.path === '/repos/' + repo + '/issues');
    assert.equal(lists.length, 20);
    assert.ok(lists.every(r => r.ifNoneMatch === null));
  } finally { await close(); }
});
