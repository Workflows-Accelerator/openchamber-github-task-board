import assert from 'node:assert/strict';
import { startBoard } from '../../../../../web/tests/helpers.mjs';
import { startFakeGitHub } from '../../../../../web/tests/fake-github.mjs';
import { SYNTHETIC_TOKEN, BOARD_PASSWORD, SESSION_SECRET } from '../../../../../web/tests/helpers.mjs';

console.log('=== Proof: Health Endpoint Methods, Headers, and Boundary Behavior ===');

const fake = await startFakeGitHub({
  token: SYNTHETIC_TOKEN,
  login: 'target-login',
  repo: 'target-owner/target-repo',
});

const board = await startBoard(fake);

try {
  // 1. GET /health
  const getRes = await fetch(`${board.url}/health`);
  console.log('GET /health status:', getRes.status);
  assert.equal(getRes.status, 200);
  const getBody = await getRes.json();
  console.log('GET /health body:', JSON.stringify(getBody));
  assert.equal(getBody.status, 'ok');
  assert.equal(typeof getBody.uptime, 'number');

  // Check cache-control
  const cacheControl = getRes.headers.get('cache-control');
  console.log('GET /health cache-control header:', cacheControl);
  assert.equal(cacheControl, 'no-store');

  // 2. HEAD /health
  const headRes = await fetch(`${board.url}/health`, { method: 'HEAD' });
  console.log('HEAD /health status:', headRes.status);
  console.log('HEAD /health allow header:', headRes.headers.get('allow'));
  assert.equal(headRes.status, 405);
  assert.equal(headRes.headers.get('allow'), 'GET');

  // 3. Other methods
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const res = await fetch(`${board.url}/health`, { method: m });
    assert.equal(res.status, 405, `expected 405 for ${m}`);
    assert.equal(res.headers.get('allow'), 'GET');
  }
  console.log('All non-GET methods returned 405 with Allow: GET');

  // 4. Query parameter injection (e.g. ?repo=evil)
  const queryRes = await fetch(`${board.url}/health?repo=evil/repo`);
  console.log('GET /health?repo=evil/repo status:', queryRes.status);
  assert.equal(queryRes.status, 400);
  const queryBody = await queryRes.json();
  console.log('GET /health?repo=evil/repo error code:', queryBody.error);
  assert.equal(queryBody.error, 'repository_not_allowed');

  console.log('\nResult: /health properly guarded; HEAD returns 405; cache-control is no-store; query params enforced.');
} finally {
  await board.app.close();
  await fake.close();
}
