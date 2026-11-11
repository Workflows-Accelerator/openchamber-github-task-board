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
    assert.equal(reposRes.headers.get('cache-control'), 'no-cache');

    const reposNotMod = await client.request('/api/repos', {
      headers: { 'if-none-match': reposEtag },
    });
    assert.equal(reposNotMod.status, 304);
    assert.equal(reposNotMod.text, '');
    assert.equal(reposNotMod.headers.get('cache-control'), 'no-cache');

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
    assert.equal(boardRes.headers.get('cache-control'), 'no-cache');

    const boardNotMod = await client.request('/api/board', {
      headers: { 'if-none-match': boardEtag },
    });
    assert.equal(boardNotMod.status, 304);
    assert.equal(boardNotMod.text, '');
    assert.equal(boardNotMod.headers.get('cache-control'), 'no-cache');

    // 3. /api/combined/board
    const combinedRes = await client.request('/api/combined/board');
    assert.equal(combinedRes.status, 200);
    const combinedEtag = combinedRes.headers.get('etag');
    assert.ok(combinedEtag, 'Expected etag header on /api/combined/board');
    assert.equal(combinedRes.headers.get('cache-control'), 'no-cache');

    const combinedNotMod = await client.request('/api/combined/board', {
      headers: { 'if-none-match': combinedEtag },
    });
    assert.equal(combinedNotMod.status, 304);
    assert.equal(combinedNotMod.text, '');
    assert.equal(combinedNotMod.headers.get('cache-control'), 'no-cache');

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
