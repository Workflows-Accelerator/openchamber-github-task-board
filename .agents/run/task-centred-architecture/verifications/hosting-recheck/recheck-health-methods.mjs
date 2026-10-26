import assert from 'node:assert/strict';
import { createBoardServer } from '../../../../../web/server/app.ts';
import { loadConfig } from '../../../../../web/server/config.ts';

console.log('=== Recheck 5: /health Methods & Security Isolation ===\n');

const env = {
  BOARD_GITHUB_TOKEN: 'ghp_secret_token_1234567890abcdef',
  BOARD_GITHUB_LOGIN: 'test-user',
  BOARD_REPO: 'test-owner/test-repo',
  BOARD_PASSWORD: 'test-super-secret-password-123',
  BOARD_SESSION_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
const config = loadConfig(env);
const fakeFetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.endsWith('/user')) return new Response(JSON.stringify({ login: 'test-user' }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/repos/')) return new Response(JSON.stringify({ full_name: 'test-owner/test-repo' }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
};

const app = await createBoardServer({
  config,
  fetchImpl: fakeFetch,
});
const { port } = await app.listen(0, '127.0.0.1');
const baseUrl = `http://127.0.0.1:${port}`;

// 1. GET /health
const getRes = await fetch(`${baseUrl}/health`);
console.log('GET /health status:', getRes.status);
assert.equal(getRes.status, 200);
const body = await getRes.json();
console.log('GET /health body:', body);
assert.equal(body.status, 'ok');
assert.equal(body.version, '1.2.1');
assert.equal(typeof body.uptime, 'number');
assert.equal(getRes.headers.get('set-cookie'), null);

// 2. HEAD /health
const headRes = await fetch(`${baseUrl}/health`, { method: 'HEAD' });
console.log('HEAD /health status:', headRes.status);
console.log('HEAD /health allow header:', headRes.headers.get('allow'));
assert.equal(headRes.status, 405);
assert.equal(headRes.headers.get('allow'), 'GET');
const headText = await headRes.text();
console.log('HEAD /health body length:', headText.length);
assert.equal(headText.length, 0);

// 3. Other non-GET methods
for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
  const res = await fetch(`${baseUrl}/health`, { method });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET');
}
console.log('POST, PUT, DELETE, PATCH all return 405 with Allow: GET');

// 4. Secret leakage inspection
const serialized = JSON.stringify(body) + JSON.stringify(Object.fromEntries(getRes.headers.entries()));
assert.equal(serialized.includes(env.BOARD_GITHUB_TOKEN), false);
assert.equal(serialized.includes(env.BOARD_PASSWORD), false);
assert.equal(serialized.includes(env.BOARD_SESSION_SECRET), false);
assert.equal(serialized.includes(env.BOARD_REPO), false);
console.log('Zero secrets, repos, or tokens present in /health response.');

// 5. Existing authenticated routes still protected
const unauthBoardRes = await fetch(`${baseUrl}/api/board`);
console.log('GET /api/board without session status:', unauthBoardRes.status);
assert.equal(unauthBoardRes.status, 401);

await app.close();
console.log('\nResult: Finding 5 CONFIRMED CLOSED. /health method contract and security boundary verified.');
