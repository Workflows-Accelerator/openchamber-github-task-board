import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubClient, GitHubError } from '../server/github.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

function repoFixture(repository, issues, extra = {}) {
  return { repo: repository, issues, ...extra };
}

async function multiFixture(options = {}) {
  const repositories =
    options.repositories ??
    [
      repoFixture(
        'owner/alpha',
        [
          makeIssue({ number: 1, title: 'Alpha one', body: '## Overview\n\nAlpha body\n', labels: ['status:todo'] }),
          makeIssue({ number: 2, title: 'Alpha two', body: '## Overview\n\nAlpha second\n' }),
        ],
        { id: 101 },
      ),
      repoFixture(
        'owner/beta',
        [
          makeIssue({ number: 1, title: 'Beta one', body: '## Overview\n\nBeta body\n', labels: ['status:todo'] }),
        ],
        { id: 102 },
      ),
      repoFixture('owner/empty', [], { id: 103 }),
      repoFixture(
        'owner/archived',
        [makeIssue({ number: 4, title: 'Archived task', body: '## Overview\n\nOld but visible\n' })],
        { id: 104, archived: true },
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

async function signedIn(url, password) {
  const client = new HttpSession(url);
  const login = await client.login(password);
  assert.equal(login.status, 200);
  return client;
}

test('repository discovery lists every token-visible repository with immutable identity, archived and issue capability', async () => {
  const { board, close } = await multiFixture();
  try {
    const client = await signedIn(board.url);
    const response = await client.request('/api/repos');
    assert.equal(response.status, 200);
    assert.equal(response.json.discoveryFailed, false);
    assert.equal(response.json.stale, false);
    assert.equal(response.json.visibleCount, 4);
    assert.deepEqual(
      response.json.repositories.map((repository) => repository.full),
      ['owner/alpha', 'owner/beta', 'owner/empty', 'owner/archived'],
    );
    const alpha = response.json.repositories.find((repository) => repository.full === 'owner/alpha');
    assert.equal(alpha.owner, 'owner');
    assert.equal(alpha.name, 'alpha');
    assert.equal(alpha.id, 101);
    assert.equal(alpha.archived, false);
    assert.equal(alpha.hasIssues, true);
    assert.equal(alpha.available, true);
    const archived = response.json.repositories.find((repository) => repository.full === 'owner/archived');
    assert.equal(archived.archived, true);
    const empty = response.json.repositories.find((repository) => repository.full === 'owner/empty');
    assert.equal(empty.hasIssues, true);
    assert.equal(typeof response.json.fetchedAt, 'string');
  } finally {
    await close();
  }
});

test('the token covering two repositories shows both and the combined view labels every row', async () => {
  const { board, close } = await multiFixture();
  try {
    const client = await signedIn(board.url);
    const alpha = await client.request('/api/repos/owner/alpha/board');
    assert.equal(alpha.status, 200);
    assert.equal(alpha.json.scope, 'repo');
    assert.equal(alpha.json.repository.full, 'owner/alpha');
    assert.equal(alpha.json.issues.length, 2);

    const beta = await client.request('/api/repos/owner/beta/board');
    assert.equal(beta.status, 200);
    assert.equal(beta.json.issues.length, 1);

    const combined = await client.request('/api/combined/board');
    assert.equal(combined.status, 200);
    assert.equal(combined.json.scope, 'all');
    assert.equal(combined.json.complete, true);
    assert.equal(combined.json.partial, false);
    const identities = combined.json.issues.map((issue) => `${issue.repository.full}#${issue.number}`);
    assert.deepEqual(identities.sort(), ['owner/alpha#1', 'owner/alpha#2', 'owner/archived#4', 'owner/beta#1']);
    for (const issue of combined.json.issues) {
      assert.equal(typeof issue.repository.full, 'string');
      assert.equal(issue.key, `${issue.repository.full}#${issue.number}`);
    }
  } finally {
    await close();
  }
});

test('cross-repository same-number rows stay separate and reads resolve the shown repository', async () => {
  const { board, close } = await multiFixture();
  try {
    const client = await signedIn(board.url);
    const combined = await client.request('/api/combined/board');
    const ones = combined.json.issues.filter((issue) => issue.number === 1);
    assert.equal(ones.length, 2);
    assert.notEqual(ones[0].key, ones[1].key);
    assert.deepEqual(ones.map((issue) => issue.repository.full).sort(), ['owner/alpha', 'owner/beta']);

    const alpha = await client.request('/api/repos/owner/alpha/issues/1');
    const beta = await client.request('/api/repos/owner/beta/issues/1');
    assert.equal(alpha.status, 200);
    assert.equal(beta.status, 200);
    assert.equal(alpha.json.issue.repository.full, 'owner/alpha');
    assert.equal(beta.json.issue.repository.full, 'owner/beta');
    assert.match(alpha.json.issue.body, /Alpha body/);
    assert.match(beta.json.issue.body, /Beta body/);
    assert.notEqual(alpha.json.issue.key, beta.json.issue.key);
  } finally {
    await close();
  }
});

test('a write in the combined view lands only in the shown issue repository and same-number writes stay independent', async () => {
  const { fake, board, close } = await multiFixture();
  try {
    const client = await signedIn(board.url);

    const alphaDetail = await client.request('/api/repos/owner/alpha/issues/1');
    const betaDetail = await client.request('/api/repos/owner/beta/issues/1');
    const alphaFingerprint = alphaDetail.json.issue.fingerprint;
    const betaFingerprint = betaDetail.json.issue.fingerprint;

    const betaWrite = await client.request('/api/repos/owner/beta/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Beta edited from the combined board.', fingerprint: betaFingerprint },
    });
    assert.equal(betaWrite.status, 200);
    assert.equal(betaWrite.json.issue.repository.full, 'owner/beta');
    assert.equal(betaWrite.json.issue.key, 'owner/beta#1');
    assert.equal(fake.patchCalls.length, 1);
    assert.equal(fake.patchCalls[0].repo, 'owner/beta');
    assert.match(fake.findIssue(1, 'owner/beta').body, /Beta edited from the combined board/);
    assert.doesNotMatch(fake.findIssue(1, 'owner/alpha').body, /Beta edited/);

    const alphaWrite = await client.request('/api/repos/owner/alpha/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Alpha edited independently.', fingerprint: alphaFingerprint },
    });
    assert.equal(alphaWrite.status, 200);
    assert.equal(fake.patchCalls.length, 2);
    assert.deepEqual(fake.patchCalls.map((call) => call.repo), ['owner/beta', 'owner/alpha']);
    assert.match(fake.findIssue(1, 'owner/alpha').body, /Alpha edited independently/);
    assert.match(fake.findIssue(1, 'owner/beta').body, /Beta edited from the combined board/);

    // A client-supplied numeric repository id cannot redirect a write.
    const alphaAfter = await client.request('/api/repos/owner/alpha/issues/1');
    await client.request('/api/repos/owner/alpha/issues/1/status', {
      method: 'POST',
      body: {
        status: 'status:done',
        fingerprint: alphaAfter.json.issue.fingerprint,
        repositoryId: 102,
        repository_id: 102,
      },
    });
    assert.equal(fake.patchCalls.at(-1).repo, 'owner/alpha');
  } finally {
    await close();
  }
});

test('fabricated, unknown and case-variant repositories are refused before any GitHub call and never fall back to the default', async () => {
  const { fake, board, close } = await multiFixture();
  try {
    const client = await signedIn(board.url);
    await client.request('/api/repos');
    const before = fake.requests.length;

    for (const route of [
      '/api/repos/evil/repo/board',
      '/api/repos/owner/unknown/board',
      '/api/repos/Owner/Alpha/board',
      '/api/repos/owner/ALPHA/issues/1',
      '/api/repos/102/board',
    ]) {
      const response = await client.request(route);
      assert.equal(response.status, 400, route);
      assert.equal(response.json.error, 'repository_not_allowed', route);
      assert.equal(response.text.includes('Alpha one'), false, route);
    }
    assert.equal(fake.patchCalls.length, 0);
    const requested = fake.requests.slice(before).map((request) => request.path);
    assert.equal(requested.some((path) => /evil|unknown|Owner|ALPHA|102/i.test(path)), false, requested.join(','));
    assert.deepEqual(fake.state.unknownRepoHits, []);
  } finally {
    await close();
  }
});

test('discovery failure keeps the last known picker and marks it stale instead of presenting an empty list', async () => {
  const { fake, board, close } = await multiFixture({ board: { repositoryTtlMs: 0 } });
  try {
    const client = await signedIn(board.url);
    const warm = await client.request('/api/repos');
    assert.equal(warm.status, 200);
    assert.equal(warm.json.repositories.length, 4);

    fake.setDiscoveryFailure(true);
    const failed = await client.request('/api/repos');
    assert.equal(failed.status, 200);
    assert.equal(failed.json.discoveryFailed, true);
    assert.equal(failed.json.stale, true);
    assert.equal(failed.json.repositories.length, 4);
    assert.match(failed.json.error, /discovery failure/i);

    // Display survives, but expired discovery cannot authorize reads/writes.
    const alpha = await client.request('/api/repos/owner/alpha/board');
    assert.equal(alpha.status, 503);
    assert.equal(alpha.json.error, 'discovery_unavailable');
  } finally {
    await close();
  }
});

test('zero visible repositories is distinct from failed discovery', async () => {
  const { fake, board, close } = await multiFixture({ board: { repositoryTtlMs: 0 } });
  try {
    const client = await signedIn(board.url);
    assert.equal((await client.request('/api/repos')).json.visibleCount, 4);

    for (const repository of ['owner/alpha', 'owner/beta', 'owner/empty', 'owner/archived']) {
      fake.setRepoAccessible(repository, false);
    }
    const none = await client.request('/api/repos');
    assert.equal(none.status, 200);
    assert.equal(none.json.discoveryFailed, false);
    assert.equal(none.json.stale, false);
    assert.equal(none.json.visibleCount, 0);
    assert.equal(none.json.repositories.every((repository) => repository.available === false), true);
    assert.equal(none.json.repositories.length, 4);
  } finally {
    await close();
  }
});

test('archived and empty repositories stay selectable with correct board states', async () => {
  const { board, close } = await multiFixture();
  try {
    const client = await signedIn(board.url);
    const repos = await client.request('/api/repos');
    const archived = repos.json.repositories.find((repository) => repository.full === 'owner/archived');
    const empty = repos.json.repositories.find((repository) => repository.full === 'owner/empty');
    assert.equal(archived.archived, true);
    assert.equal(archived.available, true);
    assert.equal(empty.hasIssues, true);
    assert.equal(empty.available, true);

    const emptyBoard = await client.request('/api/repos/owner/empty/board');
    assert.equal(emptyBoard.status, 200);
    assert.deepEqual(emptyBoard.json.issues, []);
    assert.equal(emptyBoard.json.complete, true);
    assert.equal(emptyBoard.json.repository.full, 'owner/empty');

    const archivedBoard = await client.request('/api/repos/owner/archived/board');
    assert.equal(archivedBoard.status, 200);
    assert.equal(archivedBoard.json.issues.length, 1);
    assert.equal(archivedBoard.json.repository.archived, true);
  } finally {
    await close();
  }
});

test('a known repository losing access is shown unavailable with its last identity and refuses reads and writes', async () => {
  const { fake, board, close } = await multiFixture({ board: { repositoryTtlMs: 0 } });
  try {
    const client = await signedIn(board.url);
    const warm = await client.request('/api/repos');
    const before = warm.json.repositories.find((repository) => repository.full === 'owner/beta');
    assert.equal(before.available, true);

    fake.setRepoAccessible('owner/beta', false);
    const refreshed = await client.request('/api/repos');
    const beta = refreshed.json.repositories.find((repository) => repository.full === 'owner/beta');
    assert.ok(beta, 'lost repository remains in the picker');
    assert.equal(beta.available, false);
    assert.equal(beta.id, before.id);
    assert.equal(beta.owner, 'owner');
    assert.equal(beta.name, 'beta');
    assert.equal(refreshed.json.visibleCount, 3);

    const requestsBefore = fake.requests.length;
    const read = await client.request('/api/repos/owner/beta/board');
    assert.equal(read.status, 400);
    assert.equal(read.json.error, 'repository_not_allowed');
    const requestsAfterRead = fake.requests.slice(requestsBefore);
    assert.equal(requestsAfterRead.some((request) => request.path.startsWith('/repos/owner/beta')), false);
  } finally {
    await close();
  }
});

test('aggregate refresh is bounded, one failure stays local and partial results are never marked complete', async () => {
  const repositories = Array.from({ length: 5 }, (_, index) =>
    repoFixture(
      `owner/repo-${index + 1}`,
      [makeIssue({ number: 1, title: `Repo ${index + 1} task`, body: '## Overview\n\nBody\n' })],
      { id: 200 + index },
    ),
  );
  const { fake, board, close } = await multiFixture({
    repositories,
    fake: { listDelayMs: 40 },
    board: { repositoryTtlMs: 0 },
  });
  try {
    const client = await signedIn(board.url);
    fake.setRepoFailing('owner/repo-3', true);
    const response = await client.request('/api/combined/board');
    assert.equal(response.status, 200);
    assert.equal(response.json.complete, false);
    assert.equal(response.json.partial, true);
    assert.equal(response.json.repositoriesRequested, 5);
    assert.equal(response.json.repositoriesLoaded, 4);
    assert.equal(response.json.failures.length, 1);
    assert.equal(response.json.failures[0].repository.full, 'owner/repo-3');
    assert.equal(response.json.issues.length, 4);
    assert.equal(response.json.issues.some((issue) => issue.repository.full === 'owner/repo-3'), false);
    assert.ok(fake.state.maxActiveIssueLists <= 3, `max concurrent ${fake.state.maxActiveIssueLists}`);
    assert.ok(fake.state.maxActiveIssueLists > 1, 'requests should run with bounded concurrency, not serially');

    const listCalls = fake.requests.filter((request) => request.path.endsWith('/issues'));
    for (const spec of repositories) {
      assert.equal(
        listCalls.filter((request) => request.path === `/repos/${spec.repo}/issues`).length,
        1,
        `${spec.repo} fetched exactly once (no retry storm)`,
      );
    }
  } finally {
    await close();
  }
});

test('F4: the combined view caps total issues and marks the result truncated and partial', async () => {
  const issues = (count) => Array.from({ length: count }, (_, index) =>
    makeIssue({ number: index + 1, title: `Task ${index + 1}`, body: '## Overview\n\nBody\n' }));
  const { board, close } = await multiFixture({
    repositories: [
      repoFixture('owner/alpha', issues(300), { id: 101 }),
      repoFixture('owner/beta', issues(250), { id: 102 }),
    ],
  });
  try {
    const client = await signedIn(board.url);
    const combined = await client.request('/api/combined/board');
    assert.equal(combined.status, 200);
    assert.equal(combined.json.issues.length, 500);
    assert.equal(combined.json.issueCap, 500);
    assert.equal(combined.json.truncatedByIssueCap, true);
    assert.equal(combined.json.truncated, true);
    assert.equal(combined.json.partial, true);
    assert.equal(combined.json.complete, false);
    const keys = new Set(combined.json.issues.map((issue) => issue.key));
    assert.equal(keys.size, 500, 'capped rows remain repository-qualified and unique');
  } finally {
    await close();
  }
});

test('repository discovery fails loudly on a malformed page and respects the page bound', async () => {
  const mockFetchFor = (handler) => async (url, init) => handler(String(url), init);

  const malformed = new GitHubClient({
    apiBase: 'https://api.github.com',
    token: SYNTHETIC_TOKEN,
    repo: { owner: 'owner', name: 'alpha', full: 'owner/alpha' },
    fetchImpl: mockFetchFor(() => new Response(JSON.stringify({ message: 'not a list' }), { status: 200 })),
  });
  await assert.rejects(
    () => malformed.listRepositories(),
    (err) => err instanceof GitHubError && /list/i.test(err.message),
  );

  let pageCount = 0;
  const endless = new GitHubClient({
    apiBase: 'https://api.github.com',
    token: SYNTHETIC_TOKEN,
    repo: { owner: 'owner', name: 'alpha', full: 'owner/alpha' },
    fetchImpl: mockFetchFor(() => {
      pageCount += 1;
      return new Response(
        JSON.stringify([
          {
            id: pageCount,
            full_name: `owner/repo-${pageCount}`,
            name: `repo-${pageCount}`,
            owner: { login: 'owner' },
            archived: false,
            has_issues: true,
          },
        ]),
        {
          status: 200,
          headers: { link: `<https://api.github.com/user/repos?page=${pageCount + 1}>; rel="next"` },
        },
      );
    }),
    maxPages: 2,
  });
  await assert.rejects(
    () => endless.listRepositories(),
    (err) => err instanceof GitHubError && /page bound/i.test(err.message),
  );
  assert.equal(pageCount, 2);
});

test('repository discovery follows bounded pagination and preserves identity fields', async () => {
  const requested = [];
  const client = new GitHubClient({
    apiBase: 'https://api.github.com',
    token: SYNTHETIC_TOKEN,
    repo: { owner: 'owner', name: 'alpha', full: 'owner/alpha' },
    fetchImpl: async (url) => {
      requested.push(String(url));
      const page = new URL(String(url)).searchParams.get('page') ?? '1';
      if (page === '1') {
        return new Response(
          JSON.stringify([
            { id: 11, full_name: 'owner/alpha', name: 'alpha', owner: { login: 'owner' }, archived: false, has_issues: true },
          ]),
          { status: 200, headers: { link: '<https://api.github.com/user/repos?page=2>; rel="next"' } },
        );
      }
      return new Response(
        JSON.stringify([
          { id: 12, full_name: 'owner/beta', name: 'beta', owner: { login: 'owner' }, archived: true, has_issues: false },
        ]),
        { status: 200 },
      );
    },
  });
  const result = await client.listRepositories();
  assert.equal(result.pages, 2);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.repositories.map((repository) => repository.full), ['owner/alpha', 'owner/beta']);
  assert.equal(result.repositories[1].archived, true);
  assert.equal(result.repositories[1].hasIssues, false);
  assert.equal(result.repositories[1].id, 12);
  assert.equal(requested.length, 2);
});

test('discovery failure before any success is not an empty picker and does not prevent sign-in', async () => {
  const { fake, board, close } = await multiFixture({ fake: { } });
  try {
    const client = await signedIn(board.url);
    fake.setDiscoveryFailure(true);
    // A new process has no saved discovery; credentials still verify via /user.
    const second = await startBoard(fake);
    try {
      const secondClient = await signedIn(second.url);
      const result = await secondClient.request('/api/repos');
      assert.equal(result.status, 200);
      assert.equal(result.json.discoveryFailed, true);
      assert.equal(result.json.fetchedAt, null);
      const denied = await secondClient.request('/api/repos/owner/alpha/issues/1');
      assert.equal(denied.status, 400);
    } finally { await second.app.close(); }
  } finally { await close(); }
});

test('expired failed discovery retains display identities but cannot authorize a write', async () => {
  const { fake, board, close } = await multiFixture({ board: { repositoryTtlMs: 0 } });
  try {
    const client = await signedIn(board.url);
    const detail = await client.request('/api/repos/owner/alpha/issues/1');
    fake.setDiscoveryFailure(true);
    const before = fake.requests.filter(r => r.path.startsWith('/repos/')).length;
    const result = await client.request('/api/repos/owner/alpha/issues/1/status', {
      method: 'POST', body: { status: 'status:done', fingerprint: detail.json.issue.fingerprint },
    });
    assert.equal(result.status, 503);
    assert.equal(result.json.error, 'discovery_unavailable');
    assert.equal(fake.patchCalls.length, 0);
    assert.equal(fake.requests.filter(r => r.path.startsWith('/repos/')).length, before);
  } finally { await close(); }
});

test('F1: a write during a gated discovery refresh cannot use the pre-refresh allowlist', async () => {
  let now = 1_700_000_000_000;
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      repoFixture('owner/alpha', [makeIssue({ number: 1, title: 'Alpha', body: '## Overview\n\nAlpha\n', labels: ['status:todo'] })], { id: 101 }),
      repoFixture('owner/beta', [makeIssue({ number: 1, title: 'Beta', body: '## Overview\n\nBeta\n', labels: ['status:todo'] })], { id: 102 }),
    ],
  });
  let releaseDiscovery = () => {};
  let discoveryGate = null;
  let discoveryEntered = false;
  let gateRefresh = false;
  const fetchImpl = async (input, init) => {
    if (gateRefresh && String(input).includes('/user/repos')) {
      discoveryEntered = true;
      await discoveryGate;
    }
    return fetch(input, init);
  };
  const board = await startBoard(fake, { now: () => now, fetchImpl });
  try {
    const client = await signedIn(board.url);
    assert.equal((await client.request('/api/repos')).status, 200);
    const alpha = await client.request('/api/repos/owner/alpha/issues/1');
    assert.equal(alpha.status, 200);

    fake.setRepoAccessible('owner/alpha', false);
    now += 61_000;
    gateRefresh = true;
    discoveryGate = new Promise((resolve) => { releaseDiscovery = resolve; });
    const refresh = client.request('/api/repos');
    while (!discoveryEntered) await new Promise((resolve) => setImmediate(resolve));
    const before = fake.requests.length;

    const write = client.request('/api/repos/owner/alpha/issues/1/status', {
      method: 'POST',
      body: { status: 'status:done', fingerprint: alpha.json.issue.fingerprint },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseDiscovery();
    const [refreshed, refused] = await Promise.all([refresh, write]);

    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.json.discoveryFailed, false);
    const alphaEntry = refreshed.json.repositories.find((repository) => repository.full === 'owner/alpha');
    assert.equal(alphaEntry.available, false);
    assert.equal(refused.status, 400);
    assert.equal(refused.json.error, 'repository_not_allowed');
    const alphaCalls = fake.requests.slice(before).filter((request) => request.path.startsWith('/repos/owner/alpha'));
    assert.deepEqual(alphaCalls, [], 'no pre-dispatch or fingerprint read for the revoked repository');
    assert.equal(fake.patchCalls.length, 0);

    // A repository in both old and refreshed results still resolves and writes.
    const beta = await client.request('/api/repos/owner/beta/issues/1');
    assert.equal(beta.status, 200);
    const betaWrite = await client.request('/api/repos/owner/beta/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Beta remains editable', fingerprint: beta.json.issue.fingerprint },
    });
    assert.equal(betaWrite.status, 200);
    assert.equal(fake.patchCalls.length, 1);
    assert.equal(fake.patchCalls[0].repo, 'owner/beta');
    assert.match(fake.findIssue(1, 'owner/beta').body, /Beta remains editable/);
  } finally {
    releaseDiscovery();
    await board.app.close();
    await fake.close();
  }
});

test('identical contents in same-number issues do not permit a cross-repository fingerprint replay on any write path', async () => {
  const body = '## Overview\n\nIdentical\n\n## Open Questions\n- [ ] Decide?\n';
  const { fake, board, close } = await multiFixture({ repositories: ['alpha', 'beta'].map((name, i) =>
    repoFixture(`owner/${name}`, [makeIssue({ number: 1, body, labels: ['status:todo'] })], { id: i + 1 })) });
  try {
    const client = await signedIn(board.url);
    const alpha = await client.request('/api/repos/owner/alpha/issues/1');
    const beta = await client.request('/api/repos/owner/beta/issues/1');
    assert.notEqual(alpha.json.issue.fingerprint, beta.json.issue.fingerprint);
    for (const [suffix, method, patch] of [
      ['section', 'PUT', { sectionId: 'overview', text: 'Wrong repository' }],
      ['status', 'POST', { status: 'status:done' }],
      ['questions/0/answer', 'POST', { answer: 'Wrong repository' }],
    ]) {
      const replay = await client.request('/api/repos/owner/beta/issues/1/' + suffix, {
        method, body: { ...patch, fingerprint: alpha.json.issue.fingerprint },
      });
      assert.equal(replay.status, 409);
      const unknown = await client.request('/api/repos/evil/repo/issues/1/' + suffix, {
        method, body: { ...patch, fingerprint: beta.json.issue.fingerprint },
      });
      assert.equal(unknown.status, 400);
    }
    assert.equal(fake.patchCalls.length, 0);
    assert.deepEqual(fake.state.unknownRepoHits, []);
    const answer = await client.request('/api/repos/owner/beta/issues/1/questions/0/answer', {
      method: 'POST', body: { answer: 'Beta only', fingerprint: beta.json.issue.fingerprint },
    });
    assert.equal(answer.status, 200);
    assert.equal(fake.patchCalls[0].repo, 'owner/beta');
    assert.doesNotMatch(fake.findIssue(1, 'owner/alpha').body, /Beta only/);
  } finally { await close(); }
});

test('discovery rejects malformed entries and conflicting duplicate immutable identities', async () => {
  for (const entries of [
    [{ full_name: 'owner/repo' }],
    [{ id: 1, full_name: 'owner/../other', archived: false, has_issues: true }],
    [1, 2].map(id => ({ id, full_name: 'owner/repo', name: 'repo', owner: { login: 'owner' }, archived: false, has_issues: true })),
  ]) {
    const client = new GitHubClient({ apiBase: 'https://api.github.com', token: SYNTHETIC_TOKEN,
      repo: { owner: 'owner', name: 'repo', full: 'owner/repo' },
      fetchImpl: async () => new Response(JSON.stringify(entries)),
    });
    await assert.rejects(() => client.listRepositories(), GitHubError);
  }
});

test('unknown repository after an expired failed discovery still causes zero upstream calls', async () => {
  let now = 1_700_000_000_000;
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  fake.setDiscoveryFailure(true);
  const board = await startBoard(fake, { now: () => now });
  try {
    const client = await signedIn(board.url);
    now += 61_000;
    const before = fake.requests.length;
    const response = await client.request('/api/repos/fabricated/name/issues/1/status', {
      method: 'POST', body: { status: 'status:done', fingerprint: 'a'.repeat(64) },
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.error, 'repository_not_allowed');
    assert.equal(fake.requests.length, before);
  } finally { await board.app.close(); await fake.close(); }
});

test('no-issue capability, unavailable aggregate members and concurrent aggregate coalescing are disclosed', async () => {
  let now = 1_700_000_000_000;
  const { fake, board, close } = await multiFixture({
    repositories: [repoFixture('owner/alpha', [makeIssue()]), repoFixture('owner/no-issues', [], { hasIssues: false })],
    board: { now: () => now }, fake: { listDelayMs: 50 },
  });
  try {
    const client = await signedIn(board.url);
    const empty = await client.request('/api/repos/owner/no-issues/board');
    assert.equal(empty.json.repository.hasIssues, false);
    assert.equal(empty.json.complete, true);
    assert.equal(empty.json.issues.length, 0);
    assert.equal(fake.requests.some(r => r.path === '/repos/owner/no-issues/issues'), false);
    const before = fake.requests.filter(r => r.path === '/repos/owner/alpha/issues').length;
    const combined = await Promise.all([client.request('/api/combined/board'), client.request('/api/combined/board')]);
    assert.equal(combined.every(r => r.json.complete), true);
    assert.equal(fake.requests.filter(r => r.path === '/repos/owner/alpha/issues').length, before + 1);
    fake.setRepoAccessible('owner/alpha', false); now += 61_000;
    const lost = await client.request('/api/combined/board');
    assert.equal(lost.json.partial, true); assert.equal(lost.json.complete, false);
    assert.equal(lost.json.failures[0].repository.full, 'owner/alpha');
    assert.equal(lost.json.failures[0].message, 'Unavailable');
  } finally { await close(); }
});

test('a malformed later discovery never publishes its first page as a complete allowlist', async () => {
  let calls = 0;
  const client = new GitHubClient({ apiBase: 'https://api.github.com', token: SYNTHETIC_TOKEN,
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify([{ id: 1, full_name: 'owner/alpha', owner: { login: 'owner' }, name: 'alpha', archived: false, has_issues: true }]),
        { headers: { link: '<https://api.github.com/user/repos?page=2>; rel="next"' } });
      return new Response(JSON.stringify({ message: 'malformed later page' }));
    },
  });
  await assert.rejects(() => client.listRepositories(), GitHubError);
  assert.equal(calls, 2);
});
