import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, hashPassword } from '../../../../web/server/config.ts';
import { createBoardServer } from '../../../../web/server/app.ts';

const SYNTHETIC_SECRET = 's'.repeat(48);
const SYNTHETIC_PASSWORD = 'correct-horse-battery-staple-synthetic';
const SYNTHETIC_TOKEN = 'ghp_synthetic_token_do_not_use_000000000000';

function redact(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(new RegExp(SYNTHETIC_SECRET, 'g'), '[REDACTED_SECRET]')
    .replace(new RegExp(SYNTHETIC_PASSWORD, 'g'), '[REDACTED_PASSWORD]')
    .replace(new RegExp(SYNTHETIC_TOKEN, 'g'), '[REDACTED_TOKEN]')
    .replace(/board_session=[^;\s]+/g, 'board_session=[REDACTED_COOKIE]')
    .replace(/"csrfToken":\s*"[^"]+"/g, '"csrfToken": "[REDACTED_CSRF]"');
}

function log(msg) {
  console.log(redact(msg));
}

const mockFetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.endsWith('/user')) {
    return new Response(JSON.stringify({ login: 'board-owner' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.includes('/repos/')) {
    return new Response(JSON.stringify({ full_name: 'owner/repo' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
};

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-http-restart-'));
  const sessionFile = path.join(tempDir, 'sessions.json');

  const baseEnv = {
    BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
    BOARD_GITHUB_LOGIN: 'board-owner',
    BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD: SYNTHETIC_PASSWORD,
    BOARD_SESSION_SECRET: SYNTHETIC_SECRET,
    BOARD_SESSION_FILE: sessionFile,
  };

  try {
    log('=== STEP 1: Start Server 1 with real loadConfig & POST /api/session login ===');
    const cfg1 = loadConfig(baseEnv);
    const server1 = await createBoardServer({
      config: cfg1,
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: port1, host: host1 } = await server1.listen(0, '127.0.0.1');
    const baseUrl1 = `http://${host1}:${port1}`;

    const loginRes = await fetch(`${baseUrl1}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: SYNTHETIC_PASSWORD }),
    });
    assert.equal(loginRes.status, 200);

    const setCookie = loginRes.headers.get('set-cookie');
    assert.ok(setCookie, 'set-cookie header present');
    assert.match(setCookie, /board_session=/);
    assert.match(setCookie, /Max-Age=2592000/);
    assert.match(setCookie, /Path=\//);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);

    const sessionCookie = setCookie.split(';')[0];
    const loginJson = await loginRes.json();
    assert.equal(loginJson.authenticated, true);
    assert.ok(typeof loginJson.csrfToken === 'string' && loginJson.csrfToken.length >= 32);
    const csrfToken1 = loginJson.csrfToken;
    log('PASS: Login issued 30-day cookie and derived CSRF token');

    log('=== STEP 2: Authenticated GET /api/session on Server 1 ===');
    const getSession1 = await fetch(`${baseUrl1}/api/session`, {
      headers: { cookie: sessionCookie },
    });
    assert.equal(getSession1.status, 200);
    const getJson1 = await getSession1.json();
    assert.equal(getJson1.authenticated, true);
    assert.equal(getJson1.csrfToken, csrfToken1);
    log('PASS: GET /api/session authenticated on Server 1');

    log('=== STEP 3: Stop Server 1 and verify sessions.json mode 0600 & no secrets ===');
    await server1.close();
    assert.ok(fs.existsSync(sessionFile));
    const stat = fs.statSync(sessionFile);
    assert.equal(stat.mode & 0o777, 0o600);
    const rawContent = fs.readFileSync(sessionFile, 'utf8');
    assert.equal(rawContent.includes(SYNTHETIC_PASSWORD), false);
    assert.equal(rawContent.includes(SYNTHETIC_SECRET), false);
    assert.equal(rawContent.includes(sessionCookie), false);
    assert.equal(rawContent.includes(csrfToken1), false);
    log('PASS: Server 1 shutdown cleanly, session file safe on disk (mode 0600)');

    log('=== STEP 4: Start Server 2 with independent loadConfig and restore session ===');
    const cfg2 = loadConfig(baseEnv);
    const server2 = await createBoardServer({
      config: cfg2,
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: port2, host: host2 } = await server2.listen(0, '127.0.0.1');
    const baseUrl2 = `http://${host2}:${port2}`;

    const getSession2 = await fetch(`${baseUrl2}/api/session`, {
      headers: { cookie: sessionCookie },
    });
    assert.equal(getSession2.status, 200);
    const getJson2 = await getSession2.json();
    assert.equal(getJson2.authenticated, true, 'session survived server restart');
    assert.equal(getJson2.csrfToken, csrfToken1, 'CSRF token identical on Server 2');
    log('PASS: Server 2 restored authenticated session and identical CSRF token');

    log('=== STEP 5: CSRF validation & rejection on write endpoints ===');
    // POST /api/session without CSRF token (re-login or write)
    // Note: DELETE /api/session requires CSRF token
    const logoutNoCsrf = await fetch(`${baseUrl2}/api/session`, {
      method: 'DELETE',
      headers: { cookie: sessionCookie },
    });
    assert.equal(logoutNoCsrf.status, 403, 'mutation without CSRF token must receive 403');
    const logoutNoCsrfJson = await logoutNoCsrf.json();
    assert.equal(logoutNoCsrfJson.error, 'csrf_rejected');
    log('PASS: Request without CSRF token received HTTP 403 csrf_rejected');

    log('=== STEP 6: Successful logout with CSRF token (HTTP 204) and purge ===');
    const logoutRes = await fetch(`${baseUrl2}/api/session`, {
      method: 'DELETE',
      headers: {
        cookie: sessionCookie,
        'x-csrf-token': csrfToken1,
      },
    });
    assert.equal(logoutRes.status, 204);

    const getAfterLogout = await fetch(`${baseUrl2}/api/session`, {
      headers: { cookie: sessionCookie },
    });
    const afterLogoutJson = await getAfterLogout.json();
    assert.equal(afterLogoutJson.authenticated, false);
    log('PASS: Logout destroyed session immediately');
    await server2.close();

    log('=== STEP 7: Password rotation rejects old session across restart ===');
    // Start temporary server to issue a new session
    const server3 = await createBoardServer({
      config: loadConfig(baseEnv),
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: port3, host: host3 } = await server3.listen(0, '127.0.0.1');
    const loginRes3 = await fetch(`http://${host3}:${port3}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: SYNTHETIC_PASSWORD }),
    });
    const sessionCookie3 = loginRes3.headers.get('set-cookie').split(';')[0];
    await server3.close();

    // Start server with rotated password
    const rotatedEnv = {
      ...baseEnv,
      BOARD_PASSWORD: 'different-password-value-1234',
    };
    const serverRotated = await createBoardServer({
      config: loadConfig(rotatedEnv),
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: portRot, host: hostRot } = await serverRotated.listen(0, '127.0.0.1');
    const getRotated = await fetch(`http://${hostRot}:${portRot}/api/session`, {
      headers: { cookie: sessionCookie3 },
    });
    const rotJson = await getRotated.json();
    assert.equal(rotJson.authenticated, false, 'rotated password rejected old session');
    await serverRotated.close();
    log('PASS: Rotated password invalidates sessions on next startup');

    log('=== STEP 8: BOARD_PASSWORD_HASH lifecycle across restart & rotation ===');
    const hash1 = hashPassword('test-hash-pass-1');
    const hashEnv1 = {
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'owner/repo',
      BOARD_PASSWORD_HASH: hash1,
      BOARD_SESSION_SECRET: SYNTHETIC_SECRET,
      BOARD_SESSION_FILE: sessionFile,
    };
    const serverHash1 = await createBoardServer({
      config: loadConfig(hashEnv1),
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: portH1, host: hostH1 } = await serverHash1.listen(0, '127.0.0.1');
    const loginHash = await fetch(`http://${hostH1}:${portH1}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test-hash-pass-1' }),
    });
    assert.equal(loginHash.status, 200);
    const hashCookie = loginHash.headers.get('set-cookie').split(';')[0];
    await serverHash1.close();

    // Restart server with same BOARD_PASSWORD_HASH
    const serverHash2 = await createBoardServer({
      config: loadConfig(hashEnv1),
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: portH2, host: hostH2 } = await serverHash2.listen(0, '127.0.0.1');
    const getHash2 = await fetch(`http://${hostH2}:${portH2}/api/session`, {
      headers: { cookie: hashCookie },
    });
    const getHash2Json = await getHash2.json();
    assert.equal(getHash2Json.authenticated, true, 'BOARD_PASSWORD_HASH session survived restart');
    await serverHash2.close();

    // Restart with rotated BOARD_PASSWORD_HASH
    const hash2 = hashPassword('test-hash-pass-2');
    const hashEnv2 = { ...hashEnv1, BOARD_PASSWORD_HASH: hash2 };
    const serverHashRot = await createBoardServer({
      config: loadConfig(hashEnv2),
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: portHR, host: hostHR } = await serverHashRot.listen(0, '127.0.0.1');
    const getHashRot = await fetch(`http://${hostHR}:${portHR}/api/session`, {
      headers: { cookie: hashCookie },
    });
    const getHashRotJson = await getHashRot.json();
    assert.equal(getHashRotJson.authenticated, false, 'rotated BOARD_PASSWORD_HASH rejected session');
    await serverHashRot.close();
    log('PASS: BOARD_PASSWORD_HASH valid across restart and rejected after rotation');

    log('=== STEP 9: Finding A audit (form-urlencoded POST receives HTTP 400 invalid_json) ===');
    const serverFormAudit = await createBoardServer({
      config: loadConfig(baseEnv),
      fetchImpl: mockFetch,
      sessionFilePath: sessionFile,
    });
    const { port: portForm, host: hostForm } = await serverFormAudit.listen(0, '127.0.0.1');
    const formPostRes = await fetch(`http://${hostForm}:${portForm}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'password=somepassword',
    });
    assert.equal(formPostRes.status, 400);
    const formPostJson = await formPostRes.json();
    assert.equal(formPostJson.error, 'invalid_json');
    log('PASS: Finding A confirmed (native form POST returns HTTP 400 invalid_json)');
    await serverFormAudit.close();

    log('ALL L3 HTTP SERVER LIFECYCLE INVARIANTS VERIFIED SUCCESSFULLY (exit 0)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('L3 HTTP LIFECYCLE HARNESS FAILURE:', err);
  process.exit(1);
});
