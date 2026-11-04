import test from 'node:test';
import assert from 'node:assert/strict';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession } from './helpers.mjs';

test('dependencies API: list, add, remove, duplicate, cycle refusal, and error paths', async (t) => {
  const issue1 = makeIssue({
    number: 1,
    title: 'Blocker task 1',
    body: '## Overview\r\nBlocker\r\n',
    labels: ['status:in-progress'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const issue2 = makeIssue({
    number: 2,
    title: 'Dependent task 2',
    body: '## Overview\r\nDepends on 1\r\n- [ ] Blocked by #99\r\n',
    labels: ['status:planned'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });
  const issue3 = makeIssue({
    number: 3,
    title: 'Downstream task 3',
    body: '## Overview\r\nDownstream\r\n',
    labels: ['status:planned'],
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
  });

  const fake = await startFakeGitHub({
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    issues: [issue1, issue2, issue3],
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  // 1. Initial list: issue 2 has text link #99, 0 native dependencies
  const initialDepsRes = await session.request('/api/issues/2/dependencies');
  assert.equal(initialDepsRes.status, 200);
  assert.deepEqual(initialDepsRes.json.blockedBy, []);
  assert.deepEqual(initialDepsRes.json.textDependencies, [99]);

  // 2. Reject CSRF-free POST
  const noCsrfRes = await session.request('/api/issues/2/dependencies/blocked_by', {
    method: 'POST',
    csrf: false,
    body: { issue_number: 1 },
  });
  assert.equal(noCsrfRes.status, 403, 'CSRF token required for adding dependency');

  // 3. Self-link refusal
  const selfRes = await session.request('/api/issues/2/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 2 },
  });
  assert.equal(selfRes.status, 400);
  assert.equal(selfRes.json.error, 'self_link');
  assert.match(selfRes.json.message, /cannot be blocked by itself/i);

  // 4. Add native dependency: 2 is blocked by 1
  const addRes = await session.request('/api/issues/2/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 1 },
  });
  assert.equal(addRes.status, 201);
  assert.equal(addRes.json.success, true);
  assert.equal(addRes.json.blockedNumber, 2);
  assert.equal(addRes.json.blockerNumber, 1);
  assert.ok(addRes.json.issue, 'addRes includes full issue detail');
  assert.equal(addRes.json.issue.number, 2);
  assert.ok(addRes.json.listItem, 'addRes includes full listItem');
  assert.ok(Array.isArray(addRes.json.blockedBy), 'addRes includes blockedBy array');
  assert.ok(Array.isArray(addRes.json.statusOptions), 'addRes includes statusOptions array');

  // 5. Board payload includes native dependency without N+1 calls
  const boardRes = await session.request('/api/board');
  assert.equal(boardRes.status, 200);
  const boardItem2 = boardRes.json.issues.find((i) => i.number === 2);
  assert.ok(boardItem2, 'Issue 2 found in board payload');
  assert.ok(boardItem2.blockedBy && boardItem2.blockedBy.length === 1, 'Issue 2 has 1 blockedBy item');
  assert.equal(boardItem2.blockedBy[0].number, 1);
  assert.deepEqual(boardItem2.textDependencies, [99], 'Text dependencies preserved alongside native');

  // 6. Duplicate refusal
  const dupRes = await session.request('/api/issues/2/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 1 },
  });
  assert.equal(dupRes.status, 400);
  assert.equal(dupRes.json.error, 'duplicate_dependency');
  assert.match(dupRes.json.message, /already exists/i);

  // 7. Direct cycle refusal: 1 is already blocking 2; making 1 blocked by 2 must fail!
  const cycleDirectRes = await session.request('/api/issues/1/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 2 },
  });
  assert.equal(cycleDirectRes.status, 400);
  assert.equal(cycleDirectRes.json.error, 'cycle_refused');
  assert.match(cycleDirectRes.json.message, /circular dependency/i);

  // 8. Indirect cycle refusal: add 3 blocked by 2 (1 -> 2 -> 3), then try 1 blocked by 3
  const add3 = await session.request('/api/issues/3/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 2 },
  });
  assert.equal(add3.status, 201);

  const cycleIndirectRes = await session.request('/api/issues/1/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 3 },
  });
  assert.equal(cycleIndirectRes.status, 400);
  assert.equal(cycleIndirectRes.json.error, 'cycle_refused');
  assert.match(cycleIndirectRes.json.message, /circular dependency/i);

  // 9. 404 path: add blocker for non-existent issue
  const nonExistentAdd = await session.request('/api/issues/999/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 1 },
  });
  assert.equal(nonExistentAdd.status, 404);

  // 10. 404 path: delete non-existent dependency link
  const nonExistentDel = await session.request('/api/issues/2/dependencies/blocked_by/99999', {
    method: 'DELETE',
  });
  assert.equal(nonExistentDel.status, 404);

  // 11. Delete dependency: remove 1 from 2
  const delRes = await session.request('/api/issues/2/dependencies/blocked_by/1', {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.json.success, true);
  assert.ok(delRes.json.issue, 'delRes includes full issue detail');
  assert.equal(delRes.json.issue.number, 2);
  assert.ok(delRes.json.listItem, 'delRes includes full listItem');
  assert.ok(Array.isArray(delRes.json.blockedBy), 'delRes includes blockedBy array');
  assert.ok(Array.isArray(delRes.json.statusOptions), 'delRes includes statusOptions array');

  // 12. Verify dependency is removed from board payload
  const boardAfterDel = await session.request('/api/board');
  const issue2After = boardAfterDel.json.issues.find((i) => i.number === 2);
  assert.deepEqual(issue2After.blockedBy, [], 'Dependency removed after delete');

  // 13. 403 Forbidden / Permission error path
  fake.setDependencyHook(async () => {
    return { status: 403, payload: { message: 'Must have push access to repository' } };
  });

  const forbiddenAdd = await session.request('/api/issues/2/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 1 },
  });
  assert.equal(forbiddenAdd.status, 502);
  assert.equal(forbiddenAdd.json.error, 'github_forbidden');

  fake.setDependencyHook(null);

  // 14. 422 Invalid request path (e.g. invalid issue reference from GitHub)
  fake.setDependencyHook(async ({ method }) => {
    if (method === 'POST') {
      return {
        status: 422,
        payload: {
          message: 'Validation Failed',
          errors: [{ resource: 'IssueDependency', field: 'issue_id', code: 'invalid' }],
        },
      };
    }
  });

  const invalidAdd = await session.request('/api/issues/2/dependencies/blocked_by', {
    method: 'POST',
    body: { issue_number: 1 },
  });
  assert.equal(invalidAdd.status, 422);
  assert.equal(invalidAdd.json.error, 'invalid_dependency');
});

test('cross-repo dependencies: add, list on both boards, and delete across repository boundaries', async (t) => {
  const issueA = makeIssue({
    number: 101,
    title: 'Alpha task',
    body: '## Overview\r\nAlpha\r\n',
    labels: ['status:planned'],
    repo: 'chamberos/alpha',
  });
  const issueB = makeIssue({
    number: 201,
    title: 'Beta blocker task',
    body: '## Overview\r\nBeta\r\n',
    labels: ['status:in-progress'],
    repo: 'chamberos/beta',
  });

  const fake = await startFakeGitHub({
    repositories: [
      { repo: 'chamberos/alpha', issues: [issueA] },
      { repo: 'chamberos/beta', issues: [issueB] },
    ],
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  // 1. Add cross-repo dependency: alpha #101 is blocked by beta #201
  const addRes = await session.request('/api/repos/chamberos/alpha/issues/101/dependencies/blocked_by', {
    method: 'POST',
    body: { repo: 'chamberos/beta', issue_number: 201 },
  });
  assert.equal(addRes.status, 201);
  assert.equal(addRes.json.success, true);
  assert.equal(addRes.json.blockedNumber, 101);
  assert.equal(addRes.json.blockerNumber, 201);
  assert.equal(addRes.json.blockerRepo, 'chamberos/beta');

  // 2. Alpha board: issue 101 has blockedBy entry with beta repository
  const alphaBoard = await session.request('/api/repos/chamberos/alpha/board');
  assert.equal(alphaBoard.status, 200);
  const alphaIssue = alphaBoard.json.issues.find((i) => i.number === 101);
  assert.ok(alphaIssue.blockedBy && alphaIssue.blockedBy.length === 1);
  assert.equal(alphaIssue.blockedBy[0].number, 201);
  assert.equal(alphaIssue.blockedBy[0].repository, 'chamberos/beta');

  // 3. Delete cross-repo dependency
  const delRes = await session.request('/api/repos/chamberos/alpha/issues/101/dependencies/blocked_by/201', {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.json.success, true);

  // 4. Alpha board reflects removal
  const alphaAfterDel = await session.request('/api/repos/chamberos/alpha/board');
  const alphaIssueAfter = alphaAfterDel.json.issues.find((i) => i.number === 101);
  assert.deepEqual(alphaIssueAfter.blockedBy, []);
});

test('GraphQL degradation: board loads issues cleanly with degraded status when dependencies query fails', async (t) => {
  const issue = makeIssue({
    number: 1,
    title: 'Resilient issue',
    body: '## Overview\r\nContent\r\n',
    labels: ['status:in-progress'],
    repo: 'chamberos/core',
  });
  const fake = await startFakeGitHub({
    repo: 'chamberos/core',
    issues: [issue],
  });
  fake.setGraphqlHook(() => {
    return { status: 502, payload: { message: 'Upstream GraphQL Gateway Timeout' } };
  });

  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  const boardRes = await session.request('/api/board');
  assert.equal(boardRes.status, 200, 'Board load succeeds despite GraphQL failure');
  assert.equal(boardRes.json.dependenciesDegraded, true, 'Board flags degraded dependencies');
  assert.equal(boardRes.json.issues.length, 1, 'All issues returned on degraded board');
  assert.equal(boardRes.json.issues[0].number, 1);
});

test('multi-repo board batching: 26 repositories load with exactly 1 REST and 1 GraphQL query each (52 total)', async (t) => {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const repos = letters.map((letter, idx) => ({
    repo: `chamberos/repo-${letter}`,
    issues: [
      makeIssue({ number: 1, title: `Task in repo ${letter} A`, labels: ['status:planned'], repo: `chamberos/repo-${letter}` }),
      makeIssue({ number: 2, title: `Task in repo ${letter} B`, labels: ['status:in-progress'], repo: `chamberos/repo-${letter}` }),
    ],
  }));

  const fake = await startFakeGitHub({
    repositories: repos,
  });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });

  const session = new HttpSession(board.url);
  await session.login();

  // Reset requests log prior to combined board fetch
  fake.requests.length = 0;

  const combinedRes = await session.request('/api/combined/board');
  assert.equal(combinedRes.status, 200);
  assert.equal(combinedRes.json.issues.length, 52); // 26 repos * 2 issues

  const restIssuesQueries = fake.requests.filter((r) => r.path.endsWith('/issues'));
  const graphqlQueries = fake.requests.filter((r) => r.path === '/graphql');

  assert.equal(restIssuesQueries.length, 26, 'Exactly 26 REST issue queries (1 per repo)');
  assert.equal(graphqlQueries.length, 26, 'Exactly 26 batched GraphQL queries (1 per repo)');
  assert.equal(restIssuesQueries.length + graphqlQueries.length, 52, 'Exactly 52 queries total for 26 repos (zero N+1)');
});
