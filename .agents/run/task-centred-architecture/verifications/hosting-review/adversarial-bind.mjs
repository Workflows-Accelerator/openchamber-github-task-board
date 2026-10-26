import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { startFakeGitHub } from '../../../../../web/tests/fake-github.mjs';
import { SYNTHETIC_TOKEN, BOARD_PASSWORD, SESSION_SECRET } from '../../../../../web/tests/helpers.mjs';

console.log('=== Proof: Bind Host Correctness & Edge Cases ===');

const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });

async function runWithHost(host, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['web/server.ts'], {
      env: {
        PATH: process.env.PATH,
        BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
        BOARD_GITHUB_LOGIN: fake.login,
        BOARD_REPO: fake.repo,
        BOARD_PASSWORD: BOARD_PASSWORD,
        BOARD_SESSION_SECRET: SESSION_SECRET,
        BOARD_PORT: options.port ?? '18992',
        BOARD_HOST: host,
        BOARD_GITHUB_API_BASE: fake.url,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ code: 'TIMEOUT', stdout, stderr });
    }, options.timeoutMs ?? 5000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

// 1. Unresolvable hostname
console.log('Case 1: Unresolvable hostname');
const unres = await runWithHost('unresolvable-domain-name-404.test');
console.log('Unresolvable exit code:', unres.code);
console.log('Unresolvable stderr:', unres.stderr.trim());
assert.equal(unres.code, 1);
assert.match(unres.stderr, /BOARD_HOST "unresolvable-domain-name-404\.test" could not be resolved/);

// 2. Unavailable IP
console.log('\nCase 2: Unavailable IP address (EADDRNOTAVAIL)');
const unavail = await runWithHost('192.0.2.1');
console.log('Unavailable exit code:', unavail.code);
console.log('Unavailable stderr:', unavail.stderr.trim());
assert.equal(unavail.code, 1);
assert.match(unavail.stderr, /BOARD_HOST "192\.0\.2\.1" is not available to bind/);

// 3. Syntax error host (caught during config load)
console.log('\nCase 3: Invalid host syntax');
const invalid = await runWithHost('invalid host with spaces');
console.log('Invalid syntax exit code:', invalid.code);
console.log('Invalid syntax stderr:', invalid.stderr.trim());
assert.equal(invalid.code, 1);
assert.match(invalid.stderr, /BOARD_HOST must be a valid host or IP address/);

// 4. Successful bind and log formatting
console.log('\nCase 4: Successful bind log format');
const successChild = spawn(process.execPath, ['web/server.ts'], {
  env: {
    PATH: process.env.PATH,
    BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
    BOARD_GITHUB_LOGIN: fake.login,
    BOARD_REPO: fake.repo,
    BOARD_PASSWORD: BOARD_PASSWORD,
    BOARD_SESSION_SECRET: SESSION_SECRET,
    BOARD_PORT: '18993',
    BOARD_HOST: '127.0.0.1',
    BOARD_GITHUB_API_BASE: fake.url,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let successStdout = '';
successChild.stdout.on('data', (d) => (successStdout += d));

await new Promise((r) => setTimeout(r, 800));
console.log('Bind stdout line:', successStdout.trim());
assert.match(successStdout, /board: listening on http:\/\/127\.0\.0\.1:18993/);

successChild.kill('SIGTERM');
await fake.close();

console.log('\nResult: Bind failures fail startup with exit 1 and actionable messages; no hanging.');
