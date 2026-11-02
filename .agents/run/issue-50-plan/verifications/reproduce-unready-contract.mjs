import net from 'node:net';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const baseDir = fs.existsSync('/tmp/antigravity') ? '/tmp/antigravity' : os.tmpdir();
const tempStorage = fs.mkdtempSync(path.join(baseDir, 'issue-50-repro-'));

async function reservePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    s.on('error', reject);
  });
}

async function run() {
  const port = await reservePort();
  const syntheticToken = '0123456789abcdef0123456789abcdef0123456789abcdef';

  const child = spawn(process.execPath, ['service/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      OPENCHAMBER_SERVICE_PORT: String(port),
      OPENCHAMBER_SERVICE_TOKEN: syntheticToken,
      COORDINATOR_STORAGE_DIR: tempStorage,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });

  let probeStatus = 'none';
  let probeError = null;

  // Poll 3 times over 450ms
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer [REDACTED_SYNTHETIC_TOKEN]',
        },
        signal: AbortSignal.timeout(300),
      });
      probeStatus = String(res.status);
      break;
    } catch (err) {
      probeError = err.code || err.cause?.code || err.message;
    }
  }

  // Gracefully terminate child
  const exitPromise = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });

  child.kill('SIGTERM');
  const exitResult = await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ code: null, signal: 'SIGKILL' });
    }, 2000)),
  ]);

  // Clean temp storage
  try {
    fs.rmSync(tempStorage, { recursive: true, force: true });
  } catch {}

  console.log(JSON.stringify({
    port,
    probeStatus,
    probeError,
    exitResult,
    stdoutSample: stdout.trim().split('\n').slice(0, 3),
    stderrSample: stderr.trim().split('\n').filter(Boolean),
  }, null, 2));
}

run().catch((err) => {
  console.error('Reproducer failed:', err);
  process.exit(1);
});
