import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubClient, GitHubError } from '../server/github.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';

const TOKEN = 'ghp_synthetic_client_token';

async function withFake(options, run) {
  const fake = await startFakeGitHub({ token: TOKEN, ...options });
  try {
    await run(fake);
  } finally {
    await fake.close();
  }
}

function clientFor(fake, overrides = {}) {
  return new GitHubClient({
    apiBase: fake.url,
    token: fake.token,
    repo: { owner: 'owner', name: 'repo', full: 'owner/repo' },
    ...overrides,
  });
}

test('listIssues follows pagination and returns every raw item', async () => {
  const issues = Array.from({ length: 120 }, (_, index) => makeIssue({ number: index + 1 }));
  await withFake({ issues, perPage: 50 }, async (fake) => {
    const client = clientFor(fake);
    const result = await client.listIssues();
    assert.equal(result.items.length, 120);
    assert.equal(result.pages, 2);
    assert.equal(result.truncated, false);
    assert.deepEqual(
      fake.requests.filter((request) => request.path.endsWith('/issues')).map((request) => request.query),
      ['?state=all&per_page=100&page=1', '?per_page=100&page=2'],
    );
  });
});

test('listIssues stops at the page cap and reports truncation', async () => {
  const issues = Array.from({ length: 30 }, (_, index) => makeIssue({ number: index + 1 }));
  await withFake({ issues, perPage: 5 }, async (fake) => {
    const client = clientFor(fake, { maxPages: 3, perPage: 5 });
    const result = await client.listIssues();
    assert.equal(result.pages, 3);
    assert.equal(result.truncated, true);
    assert.equal(result.items.length, 15);
  });
});

test('getIssue returns the item and its ETag', async () => {
  const issue = makeIssue({ number: 7, title: 'Seven', body: 'Body seven' });
  await withFake({ issues: [issue] }, async (fake) => {
    const client = clientFor(fake);
    const result = await client.getIssue(7);
    assert.equal(result.item.title, 'Seven');
    assert.match(result.etag, /^".+"$/);
  });
});

test('updateIssue sends a conditional PATCH with the token only in the header', async () => {
  const issue = makeIssue({ number: 9, body: 'Before' });
  await withFake({ issues: [issue] }, async (fake) => {
    const client = clientFor(fake);
    const read = await client.getIssue(9);
    const written = await client.updateIssue(9, { body: 'After' }, { etag: read.etag });
    assert.equal(written.item.body, 'After');
    assert.equal(fake.patchCalls.length, 1);
    assert.equal(fake.patchCalls[0].payload.body, 'After');
    assert.equal(fake.patchCalls[0].ifMatch, read.etag);
    assert.equal(
      fake.requests.every((request) => !request.query.includes(TOKEN) && !request.path.includes(TOKEN)),
      true,
    );
  });
});

test('getIssue refuses non-numeric issue references', async () => {
  await withFake({}, async (fake) => {
    const client = clientFor(fake);
    for (const number of [0, -1, 1.5, 'abc', '../repos/evil/repo/issues/1']) {
      await assert.rejects(
        () => client.getIssue(number),
        (err) => err instanceof GitHubError && err.kind === 'invalid',
      );
    }
  });
});

test('an inaccessible repository is reported as not_found', async () => {
  await withFake({ repoAccessible: false }, async (fake) => {
    const client = clientFor(fake);
    await assert.rejects(
      () => client.getRepository(),
      (err) => err instanceof GitHubError && (err.kind === 'not_found' || err.kind === 'unauthorized'),
    );
  });
});

test('a rejected token is reported as unauthorized and never echoed', async () => {
  await withFake({ token: 'ghp_a_different_token' }, async (fake) => {
    const client = clientFor(fake, { token: TOKEN });
    await assert.rejects(
      () => client.getAuthenticatedUser(),
      (err) => {
        assert.ok(err instanceof GitHubError);
        assert.equal(err.kind, 'unauthorized');
        assert.equal(err.message.includes(TOKEN), false);
        return true;
      },
    );
  });
});

test('unknown repository paths are never requested', async () => {
  const issue = makeIssue({ number: 1 });
  await withFake({ issues: [issue] }, async (fake) => {
    const client = clientFor(fake);
    await client.listIssues();
    await client.getIssue(1);
    assert.deepEqual(fake.state.unknownRepoHits, []);
  });
});
