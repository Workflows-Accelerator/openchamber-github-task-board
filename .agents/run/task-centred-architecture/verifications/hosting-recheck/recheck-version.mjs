import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPackageVersion, createBoardServer } from '../../../../../web/server/app.ts';
import { loadConfig } from '../../../../../web/server/config.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../..');
const pkg = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'package.json'), 'utf8'));

console.log('=== Recheck 2: Version Fallback & Dynamic Package Read ===\n');

// 1. Normal resolution matches root package.json
const defaultVersion = getPackageVersion();
console.log('Default getPackageVersion():', defaultVersion);
assert.equal(defaultVersion, pkg.version);

// 2. Nonexistent file returns 'unknown'
const missingVersion = getPackageVersion(new URL('./does-not-exist.json', import.meta.url));
console.log('Non-existent package file version:', missingVersion);
assert.equal(missingVersion, 'unknown');

// 3. Corrupt JSON returns 'unknown'
const corruptFile = path.resolve(HERE, 'temp-corrupt.json');
fs.writeFileSync(corruptFile, '{ invalid json content');
const corruptVersion = getPackageVersion(new URL(`file://${corruptFile}`));
fs.unlinkSync(corruptFile);
console.log('Corrupt JSON file version:', corruptVersion);
assert.equal(corruptVersion, 'unknown');

// 4. Empty / non-string version returns 'unknown'
const emptyVersionFile = path.resolve(HERE, 'temp-empty-ver.json');
fs.writeFileSync(emptyVersionFile, JSON.stringify({ version: '' }));
const emptyVersion = getPackageVersion(new URL(`file://${emptyVersionFile}`));
fs.unlinkSync(emptyVersionFile);
console.log('Empty string version returns:', emptyVersion);
assert.equal(emptyVersion, 'unknown');

// 5. /health endpoint integration
const env = {
  BOARD_GITHUB_TOKEN: 'ghp_0123456789abcdef0123456789abcdef',
  BOARD_GITHUB_LOGIN: 'test-user',
  BOARD_REPO: 'test-owner/test-repo',
  BOARD_PASSWORD: 'test-password-12345',
  BOARD_SESSION_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
const config = loadConfig(env);
const fakeFetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.endsWith('/user')) return new Response(JSON.stringify({ login: 'test-user' }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/repos/')) return new Response(JSON.stringify({ full_name: 'test-owner/test-repo' }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
};

// Start board with bad packageJsonUrl
const app = await createBoardServer({
  config,
  fetchImpl: fakeFetch,
  packageJsonUrl: new URL('./does-not-exist.json', import.meta.url),
});
const { port } = await app.listen(0, '127.0.0.1');

const res = await fetch(`http://127.0.0.1:${port}/health`);
assert.equal(res.status, 200);
const body = await res.json();
console.log('/health with missing package.json response body:', body);
assert.equal(body.status, 'ok');
assert.equal(body.version, 'unknown');
assert.equal(typeof body.uptime, 'number');

await app.close();
console.log('\nResult: Finding 2 CONFIRMED CLOSED. Version is dynamic and fallback is honest.');
