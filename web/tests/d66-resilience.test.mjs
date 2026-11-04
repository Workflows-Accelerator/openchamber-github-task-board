import test from 'node:test';
import assert from 'node:assert/strict';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

function create26Repos() {
  return Array.from({ length: 26 }, (_, i) => ({
    repo: `org/repo-${i + 1}`,
    id: 100 + i,
    issues: [
      makeIssue({
        number: 1,
        title: `Task in repo ${i + 1}`,
        body: '## Overview\n\nTask details\n',
        repo: `org/repo-${i + 1}`,
        labels: ['status:in-progress'],
      }),
    ],
  }));
}

async function signedIn(url) {
  const client = new HttpSession(url);
  const login = await client.login('correct horse battery staple');
  assert.equal(login.status, 200);
  return client;
}

test('D66 resilience: one failing repo among 26 does not fail the board, returns partial results', async () => {
  const repositories = create26Repos();
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories,
  });

  const board = await startBoard(fake, {
    aggregateConcurrency: 6,
    aggregateTimeoutMs: 15_000,
  });

  try {
    const client = await signedIn(board.url);

    // Break repo-13
    fake.setRepoFailing('org/repo-13', true);

    const response = await client.request('/api/combined/board');
    assert.equal(response.status, 200);
    assert.equal(response.json.scope, 'all');
    assert.equal(response.json.repositoriesRequested, 26);
    assert.equal(response.json.repositoriesLoaded, 25);
    assert.equal(response.json.partial, true);
    assert.equal(response.json.complete, false);
    assert.equal(response.json.failures.length, 1);
    assert.equal(response.json.failures[0].repository.full, 'org/repo-13');
    assert.equal(response.json.issues.length, 25);
    assert.equal(response.json.issues.some((issue) => issue.repository.full === 'org/repo-13'), false);
    assert.equal(response.json.issues.some((issue) => issue.repository.full === 'org/repo-1'), true);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('D66 resilience: slow repos do not exceed the time bound; partial results are flagged', async () => {
  const repositories = create26Repos();
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories,
    listDelayMs: 300, // 300ms per repo: 26 repos with concurrency 6 would normally take ~1.5s
  });

  // Strict aggregate timeout of 800ms
  const board = await startBoard(fake, {
    aggregateConcurrency: 6,
    aggregateTimeoutMs: 800,
    perRepoTimeoutMs: 400,
  });

  try {
    const client = await signedIn(board.url);

    const startTime = Date.now();
    const response = await client.request('/api/combined/board');
    const elapsed = Date.now() - startTime;

    assert.equal(response.status, 200);
    // Elapsed time is strictly bounded and far below the 30s gateway timeout
    assert.ok(elapsed < 2000, `Elapsed ${elapsed}ms should be strictly bounded (<2000ms)`);
    assert.equal(response.json.partial, true);
    assert.equal(response.json.complete, false);
    assert.ok(response.json.failures.length > 0, 'Failures should report skipped/timed out repos');
    assert.ok(response.json.repositoriesLoaded > 0, 'Loaded repos should still return issues');
    assert.ok(response.json.issues.length > 0, 'Issues from loaded repos are returned');
    assert.ok(
      response.json.failures.some((f) => f.message.includes('Aggregation time bound reached')),
      'Failures indicate aggregation time bound reached',
    );
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('D66 resilience: in-memory board cache accelerates subsequent refreshes and serves fallback on failure', async () => {
  const repositories = create26Repos();
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories,
  });

  const board = await startBoard(fake, {
    aggregateConcurrency: 6,
    boardCacheTtlMs: 30_000,
  });

  try {
    const client = await signedIn(board.url);

    // Initial load
    const firstRes = await client.request('/api/combined/board');
    assert.equal(firstRes.status, 200);
    assert.equal(firstRes.json.repositoriesLoaded, 26);
    assert.equal(firstRes.json.complete, true);

    // Now fail repo-5
    fake.setRepoFailing('org/repo-5', true);

    // Second load hits cache or uses cached fallback
    const secondRes = await client.request('/api/combined/board');
    assert.equal(secondRes.status, 200);
    // Cached issues for all 26 repos are preserved
    assert.equal(secondRes.json.issues.length, 26);
  } finally {
    await board.app.close();
    await fake.close();
  }
});
