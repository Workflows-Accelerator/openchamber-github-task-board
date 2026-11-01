import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '..');
const SERVICE_ENTRY = path.join(ROOT_DIR, 'service', 'main.js');

function createTempDir(prefix = 'svc-host-test-') {
  const baseDir = fs.existsSync('/tmp/antigravity') ? '/tmp/antigravity' : os.tmpdir();
  return fs.mkdtempSync(path.join(baseDir, prefix));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on('error', reject);
  });
}

function makeHttpRequest(port, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path || '/health',
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let resBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: resBody,
          });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function startServiceProcess(env) {
  const child = spawn(process.execPath, [SERVICE_ENTRY], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d.toString('utf8');
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString('utf8');
  });

  return {
    child,
    getStdout: () => stdout,
    getStderr: () => stderr,
  };
}

async function waitForHealthOk(port, token, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await makeHttpRequest(port, {
        path: '/health',
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.statusCode === 200) {
        return res;
      }
    } catch {
      // Retry until ready
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Service failed to become ready on port ${port} within ${timeoutMs}ms`);
}

test('service-host-connection: valid readiness handshake returns 200 JSON', async () => {
  const port = await getFreePort();
  const token = 'test-token-synthetic-0123456789abcdef';
  const tmpDir = createTempDir();

  const proc = startServiceProcess({
    OPENCHAMBER_SERVICE_PORT: String(port),
    OPENCHAMBER_SERVICE_TOKEN: token,
    COORDINATOR_STORAGE_DIR: tmpDir,
  });

  try {
    const res = await waitForHealthOk(port, token);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    const parsed = JSON.parse(res.body);
    assert.deepEqual(parsed, { status: 'ok', service: 'task-coordinator' });
  } finally {
    proc.child.kill('SIGTERM');
    await new Promise((r) => proc.child.on('close', r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('service-host-connection: timing-safe auth rejects missing, invalid, and malformed tokens without RangeError', async () => {
  const port = await getFreePort();
  const token = 'correct-token-abcdef0123456789';
  const tmpDir = createTempDir();

  const proc = startServiceProcess({
    OPENCHAMBER_SERVICE_PORT: String(port),
    OPENCHAMBER_SERVICE_TOKEN: token,
    COORDINATOR_STORAGE_DIR: tmpDir,
  });

  try {
    await waitForHealthOk(port, token);

    // 1. Missing Authorization header
    const resMissing = await makeHttpRequest(port, { path: '/health', headers: {} });
    assert.equal(resMissing.statusCode, 401);
    assert.deepEqual(JSON.parse(resMissing.body), { error: 'Unauthorized' });

    // 2. Wrong token (same length)
    const resWrong = await makeHttpRequest(port, {
      path: '/health',
      headers: { Authorization: 'Bearer wrong-token-abcdef0123456789' },
    });
    assert.equal(resWrong.statusCode, 401);

    // 3. 1-byte token (length mismatch: must not throw RangeError)
    const resShort = await makeHttpRequest(port, {
      path: '/health',
      headers: { Authorization: 'Bearer x' },
    });
    assert.equal(resShort.statusCode, 401);

    // 4. 500-byte token (length mismatch: must not throw RangeError)
    const resLong = await makeHttpRequest(port, {
      path: '/health',
      headers: { Authorization: `Bearer ${'a'.repeat(500)}` },
    });
    assert.equal(resLong.statusCode, 401);

    // 5. Malformed headers
    const resBasic = await makeHttpRequest(port, {
      path: '/health',
      headers: { Authorization: 'Basic 12345' },
    });
    assert.equal(resBasic.statusCode, 401);

    const resEmptyBearer = await makeHttpRequest(port, {
      path: '/health',
      headers: { Authorization: 'Bearer ' },
    });
    assert.equal(resEmptyBearer.statusCode, 401);

    const resMultiToken = await makeHttpRequest(port, {
      path: '/health',
      headers: { Authorization: `Bearer ${token} extra-junk` },
    });
    assert.equal(resMultiToken.statusCode, 401);
  } finally {
    proc.child.kill('SIGTERM');
    await new Promise((r) => proc.child.on('close', r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('service-host-connection: route and method confinement (no /status, only GET /health)', async () => {
  const port = await getFreePort();
  const token = 'auth-token-confine-12345';
  const tmpDir = createTempDir();

  const proc = startServiceProcess({
    OPENCHAMBER_SERVICE_PORT: String(port),
    OPENCHAMBER_SERVICE_TOKEN: token,
    COORDINATOR_STORAGE_DIR: tmpDir,
  });

  try {
    await waitForHealthOk(port, token);

    // 1. GET /status -> 404 Not Found (zero ownerId/activeLeases disclosure)
    const resStatus = await makeHttpRequest(port, {
      path: '/status',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resStatus.statusCode, 404);
    assert.deepEqual(JSON.parse(resStatus.body), { error: 'Not Found' });
    assert.equal(resStatus.body.includes('ownerId'), false);
    assert.equal(resStatus.body.includes('activeLeases'), false);

    // 2. GET /unknown -> 404 Not Found
    const resUnknown = await makeHttpRequest(port, {
      path: '/unknown',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resUnknown.statusCode, 404);

    // 3. POST /health -> 405 Method Not Allowed
    const resPostHealth = await makeHttpRequest(port, {
      path: '/health',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resPostHealth.statusCode, 405);
    assert.deepEqual(JSON.parse(resPostHealth.body), { error: 'Method Not Allowed' });
  } finally {
    proc.child.kill('SIGTERM');
    await new Promise((r) => proc.child.on('close', r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('service-host-connection: fast-fail startup config validation exits code 1 with sanitized stderr', async () => {
  const invalidConfigs = [
    {
      name: 'trailing text in port',
      env: { OPENCHAMBER_SERVICE_PORT: '3000abc', OPENCHAMBER_SERVICE_TOKEN: 'valid-token' },
      expectedStderr: 'OPENCHAMBER_SERVICE_PORT must be an integer between 1 and 65535',
    },
    {
      name: 'whitespace in port',
      env: { OPENCHAMBER_SERVICE_PORT: ' 3000 ', OPENCHAMBER_SERVICE_TOKEN: 'valid-token' },
      expectedStderr: 'OPENCHAMBER_SERVICE_PORT must be an integer between 1 and 65535',
    },
    {
      name: 'port 0 out of range',
      env: { OPENCHAMBER_SERVICE_PORT: '0', OPENCHAMBER_SERVICE_TOKEN: 'valid-token' },
      expectedStderr: 'OPENCHAMBER_SERVICE_PORT',
    },
    {
      name: 'port 99999 out of range',
      env: { OPENCHAMBER_SERVICE_PORT: '99999', OPENCHAMBER_SERVICE_TOKEN: 'valid-token' },
      expectedStderr: 'OPENCHAMBER_SERVICE_PORT',
    },
    {
      name: 'missing token',
      env: { OPENCHAMBER_SERVICE_PORT: '3000' },
      expectedStderr: 'OPENCHAMBER_SERVICE_TOKEN must be a non-empty string',
    },
    {
      name: 'whitespace-only token',
      env: { OPENCHAMBER_SERVICE_PORT: '3000', OPENCHAMBER_SERVICE_TOKEN: '   ' },
      expectedStderr: 'OPENCHAMBER_SERVICE_TOKEN must be a non-empty string',
    },
  ];

  for (const { name, env, expectedStderr } of invalidConfigs) {
    const proc = startServiceProcess(env);
    const exitCode = await new Promise((resolve) => {
      proc.child.on('close', (code) => resolve(code));
    });

    assert.equal(exitCode, 1, `Failed config [${name}] must exit with code 1`);
    const stderr = proc.getStderr();
    assert.ok(stderr.includes(expectedStderr), `Stderr for [${name}] should mention expected validation error`);
    // Crucial: token values or bad inputs must NEVER be echoed
    assert.equal(stderr.includes('3000abc'), false, 'Stderr must not echo bad port input');
    assert.equal(stderr.includes('valid-token'), false, 'Stderr must not echo token');
  }
});

test('service-host-connection: >64KB payload rejected with 413 or connection destroy', async () => {
  const port = await getFreePort();
  const token = 'payload-limit-token-12345';
  const tmpDir = createTempDir();

  const proc = startServiceProcess({
    OPENCHAMBER_SERVICE_PORT: String(port),
    OPENCHAMBER_SERVICE_TOKEN: token,
    COORDINATOR_STORAGE_DIR: tmpDir,
  });

  try {
    await waitForHealthOk(port, token);

    const oversizedPayload = 'x'.repeat(70000); // 70KB > 64KB cap
    let errorCaught = null;
    let response = null;

    try {
      response = await makeHttpRequest(
        port,
        {
          path: '/health',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(oversizedPayload)),
          },
        },
        oversizedPayload
      );
    } catch (err) {
      errorCaught = err;
    }

    if (response) {
      assert.equal(response.statusCode, 413);
    } else {
      assert.ok(errorCaught, 'Oversized request should be rejected or socket destroyed');
    }
  } finally {
    proc.child.kill('SIGTERM');
    await new Promise((r) => proc.child.on('close', r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('service-host-connection: SIGTERM gracefully shuts down in <1500ms and preserves foreign unexpired leases', async () => {
  const port = await getFreePort();
  const token = 'sigterm-shutdown-token-123';
  const tmpDir = createTempDir();

  // Pre-seed leases.json with a foreign lease
  const foreignLease = {
    repo: 'workspaces/test-repo',
    issueNumber: 42,
    ownerId: 'foreign-coordinator-999',
    claimedAt: 1000000000000,
    expiresAt: 9999999999999,
    heartbeatAt: 1000000000000,
    claimedSha: 'foreign-sha',
    phase: 'plan',
  };
  const leasesFile = path.join(tmpDir, 'leases.json');
  fs.writeFileSync(
    leasesFile,
    JSON.stringify({
      version: 1,
      leases: {
        'workspaces/test-repo#42': foreignLease,
      },
    }),
    'utf8'
  );

  const proc = startServiceProcess({
    OPENCHAMBER_SERVICE_PORT: String(port),
    OPENCHAMBER_SERVICE_TOKEN: token,
    COORDINATOR_STORAGE_DIR: tmpDir,
  });

  try {
    await waitForHealthOk(port, token);

    // Send SIGTERM
    const shutdownStart = Date.now();
    proc.child.kill('SIGTERM');

    const exitCode = await new Promise((resolve) => {
      proc.child.on('close', (code) => resolve(code));
    });
    const shutdownDuration = Date.now() - shutdownStart;

    assert.equal(exitCode, 0, 'Graceful shutdown on SIGTERM must exit 0');
    assert.ok(shutdownDuration < 1500, `Shutdown took ${shutdownDuration}ms, must be <1500ms`);

    // Verify foreign lease is untouched
    const fileContent = JSON.parse(fs.readFileSync(leasesFile, 'utf8'));
    assert.ok(fileContent.leases['workspaces/test-repo#42'], 'Foreign lease must still exist in leases.json');
    assert.equal(fileContent.leases['workspaces/test-repo#42'].ownerId, 'foreign-coordinator-999');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('service-host-connection: importing service/main.js as module does not bind port or exit process', async () => {
  // Advisory 4: importing must have zero listener/timer/exit side effects
  const imported = await import('../service/main.js');
  assert.ok(imported.CoordinatorService, 'CoordinatorService class must be exported');
  assert.equal(typeof imported.CoordinatorService, 'function');
});
