import http from 'node:http';
import assert from 'node:assert/strict';
import { loadConfig, describeConfig } from '../../../../../web/server/config.ts';
import { createBoardServer } from '../../../../../web/server/app.ts';
import { GitHubClient, GitHubError } from '../../../../../web/server/github.ts';

console.log('=== Recheck 1: BOARD_GITHUB_API_BASE Token Protection ===\n');

// Part A: Config ignores BOARD_GITHUB_API_BASE
const env = {
  BOARD_GITHUB_TOKEN: 'ghp_synthetic_token_12345678901234567890',
  BOARD_GITHUB_LOGIN: 'test-login',
  BOARD_REPO: 'test-owner/test-repo',
  BOARD_PASSWORD: 'test-password-12345',
  BOARD_SESSION_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  BOARD_GITHUB_API_BASE: 'http://127.0.0.1:9999',
};

const config = loadConfig(env);
console.log('config.githubApiBase:', config.githubApiBase);
assert.equal(config.githubApiBase, 'https://api.github.com');

const details = describeConfig(config);
console.log('describeConfig has githubApiBase:', 'githubApiBase' in details);
assert.equal('githubApiBase' in details, false);

// Part B: Startup request targets https://api.github.com, never attacker port 9999
let attackerHit = false;
const attackerServer = http.createServer((req, res) => {
  attackerHit = true;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end('{}');
});
await new Promise(resolve => attackerServer.listen(9999, '127.0.0.1', resolve));

const outboundUrls = [];
const spyFetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  outboundUrls.push(url);
  if (url.endsWith('/user')) {
    return new Response(JSON.stringify({ login: 'test-login' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.includes('/repos/')) {
    return new Response(JSON.stringify({ full_name: 'test-owner/test-repo' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
};

const app = await createBoardServer({
  config,
  fetchImpl: spyFetch,
});
await app.close();
await new Promise(resolve => attackerServer.close(resolve));

console.log('Attacker server hit on 9999:', attackerHit);
assert.equal(attackerHit, false);
console.log('Outbound URLs called count:', outboundUrls.length);
for (const u of outboundUrls) {
  console.log('  -> Outbound URL:', u);
  assert.ok(u.startsWith('https://api.github.com/'));
}

// Part C: Redirect rejection in GitHubClient
console.log('\n=== Recheck 1C: Upstream Redirect Rejection ===');
for (const status of [301, 302, 307, 308]) {
  const client = new GitHubClient({
    apiBase: 'https://api.github.com',
    token: 'ghp_secret_token_never_redirect',
    repo: { owner: 'test-owner', name: 'test-repo', full: 'test-owner/test-repo' },
    fetchImpl: async (url) => {
      return new Response('', {
        status,
        headers: { location: 'http://attacker.example.com/exfiltrate' },
      });
    },
  });

  await assert.rejects(
    async () => {
      await client.getAuthenticatedUser();
    },
    (err) => {
      assert.ok(err instanceof GitHubError);
      assert.equal(err.kind, 'server');
      assert.equal(err.status, status);
      assert.ok(err.message.includes('redirects are not permitted'));
      return true;
    },
  );
  console.log(`Redirect status ${status} successfully blocked before following.`);
}

console.log('\nResult: Finding 1 CONFIRMED CLOSED. Token cannot be redirected.');
