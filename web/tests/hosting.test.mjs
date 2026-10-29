import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { loadConfig, describeConfig } from '../server/config.ts';
import { createBoardServer, getPackageVersion } from '../server/app.ts';
import {
  startBoard,
  browserConfig,
  HttpSession,
  BOARD_PASSWORD,
  SESSION_SECRET,
  SYNTHETIC_TOKEN,
} from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const pkg = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'package.json'), 'utf8'));
const EXPECTED_VERSION = pkg.version;

function ensureBundleBuilt() {
  const distServer = path.resolve(ROOT, 'web/dist/server.mjs');
  if (fs.existsSync(distServer)) return;
  const buildResult = spawnSync(
    'npx',
    [
      'esbuild',
      'web/server.ts',
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--target=node20',
      '--packages=external',
      '--outfile=web/dist/server.mjs',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(buildResult.status, 0, `esbuild failed: ${buildResult.stderr}`);
}

const PRELOAD_FETCH = `
const origFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (typeof url === 'string' && url.startsWith('https://api.github.com')) {
    const target = url.replace('https://api.github.com', process.env.__TEST_FAKE_GITHUB_URL);
    return origFetch(target, opts);
  }
  return origFetch(url, opts);
};
`;
const PRELOAD_FETCH_DATA_URI = `data:text/javascript;base64,${Buffer.from(PRELOAD_FETCH).toString('base64')}`;

function runServerEntry(env) {
  const sessionFile = env.BOARD_SESSION_FILE ?? path.join(os.tmpdir(), `test-board-sessions-${randomBytes(8).toString('hex')}.json`);
  try {
    return spawnSync(process.execPath, ['web/server.ts'], {
      cwd: ROOT,
      env: { PATH: process.env.PATH, BOARD_SESSION_FILE: sessionFile, ...env },
      encoding: 'utf8',
      timeout: 10_000,
    });
  } finally {
    try {
      if (!env.BOARD_SESSION_FILE && fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
    } catch {}
  }
}

test('default bind host is loopback (127.0.0.1)', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const board = await startBoard(fake);
  try {
    assert.equal(board.config.host, '127.0.0.1');
    assert.equal(board.host, '127.0.0.1');
    const res = await fetch(`http://127.0.0.1:${board.port}/health`);
    assert.equal(res.status, 200);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('a configured host is honoured (0.0.0.0)', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const board = await startBoard(fake, {
    env: { BOARD_HOST: '0.0.0.0' },
  });
  try {
    assert.equal(board.config.host, '0.0.0.0');
    assert.equal(board.host, '0.0.0.0');
    const res = await fetch(`http://127.0.0.1:${board.port}/health`);
    assert.equal(res.status, 200);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('an invalid host fails startup with a non-zero exit and one actionable message', () => {
  const cases = [
    'invalid host with spaces',
    '999.999.999.999',
    '127.0.0.256',
    '-invalid-leading-dash',
    'http://localhost',
  ];
  for (const invalidHost of cases) {
    const result = runServerEntry({
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'owner/repo',
      BOARD_PASSWORD: BOARD_PASSWORD,
      BOARD_SESSION_SECRET: SESSION_SECRET,
      BOARD_HOST: invalidHost,
    });
    assert.equal(result.status, 1, `expected status 1 for host: ${invalidHost}`);
    assert.match(
      result.stderr,
      /board: refusing to start: BOARD_HOST must be a valid host or IP address/,
      `expected actionable message for host: ${invalidHost}`,
    );
  }
});

test('/health returns 200 with the expected keys (status, version, uptime)', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const board = await startBoard(fake);
  try {
    const res = await fetch(`${board.url}/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.version, EXPECTED_VERSION);
    assert.equal(typeof body.uptime, 'number');
    assert.ok(body.uptime >= 0);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('/health requires no credentials and rejects non-GET methods with 405', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const board = await startBoard(fake);
  try {
    // No cookie, no headers -> 200
    const getRes = await fetch(`${board.url}/health`, { method: 'GET' });
    assert.equal(getRes.status, 200);

    // Non-GET methods -> 405
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
      const res = await fetch(`${board.url}/health`, { method });
      assert.equal(res.status, 405, `expected 405 for ${method}`);
      assert.equal(res.headers.get('allow'), 'GET');
    }
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('/health returns version "unknown" when package.json cannot be read', async () => {
  assert.equal(getPackageVersion(new URL('./nonexistent-package.json', import.meta.url)), 'unknown');
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const board = await startBoard(fake, {
    packageJsonUrl: new URL('./nonexistent-package.json', import.meta.url),
  });
  try {
    const res = await fetch(`${board.url}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.version, 'unknown');
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('BOARD_GITHUB_API_BASE in environment is ignored and upstream defaults to api.github.com', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-board-'));
  const sessionFile = path.join(tempDir, 'sessions.json');
  const env = {
    BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
    BOARD_GITHUB_LOGIN: 'board-owner',
    BOARD_REPO: 'owner/repo',
    BOARD_PASSWORD: BOARD_PASSWORD,
    BOARD_SESSION_SECRET: SESSION_SECRET,
    BOARD_SESSION_FILE: sessionFile,
    BOARD_GITHUB_API_BASE: 'http://attacker-controlled.invalid:8888',
  };
  const config = loadConfig(env);
  assert.equal(config.githubApiBase, 'https://api.github.com');
  const details = describeConfig(config);
  assert.equal('githubApiBase' in details, false);

  const requestedUrls = [];
  const spyFetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    requestedUrls.push(url);
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

  const app = await createBoardServer({
    config,
    fetchImpl: spyFetch,
    sessionFilePath: sessionFile,
  });
  try {
    assert.ok(requestedUrls.length >= 2, 'expected GitHubClient to make startup verification requests');
    for (const requestedUrl of requestedUrls) {
      assert.ok(
        requestedUrl.startsWith('https://api.github.com/'),
        `expected request to target https://api.github.com/, got: ${requestedUrl}`,
      );
      assert.equal(requestedUrl.includes('attacker-controlled.invalid'), false);
    }
  } finally {
    await app.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
});

test('/health leaks no secret or repository value even when those variables are set', async () => {
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    login: 'secret-owner-name',
    repo: 'secret-org/secret-repo',
  });
  const board = await startBoard(fake);
  try {
    const res = await fetch(`${board.url}/health`);
    assert.equal(res.status, 200);
    const text = await res.text();
    const headersText = JSON.stringify(Object.fromEntries(res.headers.entries()));

    const forbidden = [
      SYNTHETIC_TOKEN,
      BOARD_PASSWORD,
      SESSION_SECRET,
      'secret-owner-name',
      'secret-org/secret-repo',
      'secret-repo',
    ];

    for (const secret of forbidden) {
      assert.equal(text.includes(secret), false, `response body leaked: ${secret}`);
      assert.equal(headersText.includes(secret), false, `response headers leaked: ${secret}`);
    }
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('existing authenticated routes still require the password', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const board = await startBoard(fake);
  try {
    const session = new HttpSession(board.url);

    // Unauthenticated GET /api/board -> 401
    const boardRes = await session.request('/api/board');
    assert.equal(boardRes.status, 401);

    // Unauthenticated GET /api/issues/1 -> 401
    const issueRes = await session.request('/api/issues/1');
    assert.equal(issueRes.status, 401);

    // Wrong password -> 401
    const wrongLogin = await session.login('wrong password here');
    assert.equal(wrongLogin.status, 401);

    // Correct password -> 200
    const correctLogin = await session.login(BOARD_PASSWORD);
    assert.equal(correctLogin.status, 200);

    // Now authenticated -> 200
    const authedBoard = await session.request('/api/board');
    assert.equal(authedBoard.status, 200);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('the start command serves /health', async () => {
  ensureBundleBuilt();
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-board-'));
  const sessionFile = path.join(tempDir, 'sessions.json');
  let child = null;
  try {
    // Choose an available port
    const testPort = 18788;
    const env = {
      PATH: process.env.PATH,
      NODE_OPTIONS: `--import ${PRELOAD_FETCH_DATA_URI}`,
      __TEST_FAKE_GITHUB_URL: fake.url,
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
      BOARD_GITHUB_LOGIN: fake.login,
      BOARD_REPO: fake.repo,
      BOARD_PASSWORD: BOARD_PASSWORD,
      BOARD_SESSION_SECRET: SESSION_SECRET,
      BOARD_SESSION_FILE: sessionFile,
      BOARD_PORT: String(testPort),
      BOARD_HOST: '127.0.0.1',
    };

    // Run using the built bundle command: node web/dist/server.mjs
    child = spawn(process.execPath, ['web/dist/server.mjs'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    // Wait for the server to be listening and answer /health
    let healthy = false;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${testPort}/health`);
        if (res.status === 200) {
          const body = await res.json();
          if (body.status === 'ok' && body.version === EXPECTED_VERSION) {
            healthy = true;
            break;
          }
        }
      } catch {
        // Wait and retry
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    assert.ok(healthy, `server did not become healthy in time. stdout: ${stdout}, stderr: ${stderr}`);
  } finally {
    if (child && child.pid) {
      child.kill('SIGTERM');
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await fake.close();
  }
});

test('npm run start:web package script serves /health', async () => {
  ensureBundleBuilt();
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-board-'));
  const sessionFile = path.join(tempDir, 'sessions.json');
  let child = null;
  try {
    const testPort = 18789;
    const env = {
      PATH: process.env.PATH,
      NODE_OPTIONS: `--import ${PRELOAD_FETCH_DATA_URI}`,
      __TEST_FAKE_GITHUB_URL: fake.url,
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
      BOARD_GITHUB_LOGIN: fake.login,
      BOARD_REPO: fake.repo,
      BOARD_PASSWORD: BOARD_PASSWORD,
      BOARD_SESSION_SECRET: SESSION_SECRET,
      BOARD_SESSION_FILE: sessionFile,
      BOARD_PORT: String(testPort),
      BOARD_HOST: '127.0.0.1',
    };

    child = spawn('npm', ['run', 'start:web'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    let healthy = false;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${testPort}/health`);
        if (res.status === 200) {
          const body = await res.json();
          if (body.status === 'ok' && body.version === EXPECTED_VERSION) {
            healthy = true;
            break;
          }
        }
      } catch {
        // Wait and retry
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    assert.ok(healthy, `server did not become healthy via npm run start:web. stdout: ${stdout}, stderr: ${stderr}`);
  } finally {
    if (child && child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await fake.close();
  }
});

test('finding E behavioural regression: hosting server constructor isolates session store from default path', async () => {
  const standInDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standin-data-'));
  const standInBoardDir = path.join(standInDir, 'board');
  fs.mkdirSync(standInBoardDir, { recursive: true });
  const standInSessionFile = path.join(standInBoardDir, 'sessions.json');

  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isolated-sessions-'));
  const isolatedSessionFile = path.join(isolatedDir, 'sessions.json');

  // Sentinel data placed into the private stand-in default store
  const sentinelIdHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const sentinelPayload = {
    version: 1,
    sessions: {
      [sentinelIdHash]: {
        passwordFingerprint: 'sentinel-password-fingerprint-original',
        createdAt: 1000000,
        lastSeenAt: 1000000,
        expiresAt: Date.now() + 86400000,
        ip: '10.0.0.1',
      },
    },
  };
  const sentinelRaw = JSON.stringify(sentinelPayload, null, 2);
  fs.writeFileSync(standInSessionFile, sentinelRaw, { mode: 0o600 });

  const spyFetch = async (input) => {
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

  try {
    // 1. BEHAVIOURAL DISCRIMINATION: Demonstrate the previous buggy setup
    // When BOARD_SESSION_FILE is omitted, loadConfig resolves sessionFilePath to the default store path
    const buggyEnv = {
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'owner/repo',
      BOARD_PASSWORD: BOARD_PASSWORD,
      BOARD_SESSION_SECRET: SESSION_SECRET,
      OPENCHAMBER_DATA_DIR: standInDir, // defaults to stand-in store
    };
    const buggyConfig = loadConfig(buggyEnv);
    assert.equal(buggyConfig.sessionFilePath, standInSessionFile);

    // Buggy constructor flow: createBoardServer without explicit sessionFilePath
    // loads and touches the stand-in default store
    const buggyApp = await createBoardServer({
      config: buggyConfig,
      fetchImpl: spyFetch,
    });
    try {
      const { port: buggyPort, host: buggyHost } = await buggyApp.listen(0, '127.0.0.1');
      // With buggy setup, login mutates the stand-in default store
      const buggyLoginRes = await fetch(`http://${buggyHost}:${buggyPort}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: BOARD_PASSWORD }),
      });
      assert.equal(buggyLoginRes.status, 200);

      // Verify buggy setup DID leak to and alter the stand-in default store
      const buggyContent = fs.readFileSync(standInSessionFile, 'utf8');
      assert.notEqual(
        buggyContent,
        sentinelRaw,
        'buggy setup must leak and alter the default store (discriminating old buggy behavior)',
      );
      const parsedBuggy = JSON.parse(buggyContent);
      assert.equal(
        sentinelIdHash in parsedBuggy.sessions,
        false,
        'sentinel session was pruned/overwritten by buggy setup',
      );
    } finally {
      await buggyApp.close();
    }

    // Reset sentinel back to original state
    fs.writeFileSync(standInSessionFile, sentinelRaw, { mode: 0o600 });
    assert.equal(fs.readFileSync(standInSessionFile, 'utf8'), sentinelRaw);

    // 2. BEHAVIOURAL PROOF: Repaired setup isolates the session store
    const repairedEnv = {
      BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
      BOARD_GITHUB_LOGIN: 'board-owner',
      BOARD_REPO: 'owner/repo',
      BOARD_PASSWORD: BOARD_PASSWORD,
      BOARD_SESSION_SECRET: SESSION_SECRET,
      BOARD_SESSION_FILE: isolatedSessionFile,
      OPENCHAMBER_DATA_DIR: standInDir, // stand-in default store still present
    };
    const repairedConfig = loadConfig(repairedEnv);
    assert.equal(repairedConfig.sessionFilePath, isolatedSessionFile);

    const repairedApp = await createBoardServer({
      config: repairedConfig,
      fetchImpl: spyFetch,
      sessionFilePath: isolatedSessionFile,
    });
    try {
      const { port: repairedPort, host: repairedHost } = await repairedApp.listen(0, '127.0.0.1');
      const loginRes = await fetch(`http://${repairedHost}:${repairedPort}/api/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: BOARD_PASSWORD }),
      });
      assert.equal(loginRes.status, 200);

      // Verify the sentinel in the stand-in default store remains 100% UNTOUCHED
      const standInContentAfter = fs.readFileSync(standInSessionFile, 'utf8');
      assert.equal(
        standInContentAfter,
        sentinelRaw,
        'sentinel in stand-in default store must remain completely unchanged',
      );

      // Verify the isolated store was created and used
      assert.ok(fs.existsSync(isolatedSessionFile), 'isolated session store file must exist');
      const isolatedContent = JSON.parse(fs.readFileSync(isolatedSessionFile, 'utf8'));
      assert.equal(isolatedContent.version, 1);
      assert.equal(Object.keys(isolatedContent.sessions).length, 1);
      assert.equal(
        sentinelIdHash in isolatedContent.sessions,
        false,
        'isolated store must contain only the newly created session',
      );
    } finally {
      await repairedApp.close();
    }
  } finally {
    fs.rmSync(standInDir, { recursive: true, force: true });
    fs.rmSync(isolatedDir, { recursive: true, force: true });
  }
});
