import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

console.log('=== Proof: start:web Script Prerequisites & Test Isolation ===');

// Temporarily move web/dist aside if it exists
const distPath = path.resolve('web/dist');
const backupPath = path.resolve('web/.dist-backup');

let distExisted = false;
if (fs.existsSync(distPath)) {
  distExisted = true;
  fs.cpSync(distPath, backupPath, { recursive: true });
  fs.rmSync(distPath, { recursive: true });
}

try {
  // Test running npm run start:web without pre-building
  const runResult = spawnSync('npm', ['run', 'start:web'], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });

  console.log('npm run start:web without build exit code:', runResult.status);
  console.log('npm run start:web error snippet:', runResult.stderr.slice(0, 300).trim());
  assert.notEqual(runResult.status, 0);
  assert.match(runResult.stderr, /MODULE_NOT_FOUND|Cannot find module/);

  // Run Test 9 in isolation
  const isolatedTestResult = spawnSync(
    process.execPath,
    ['--test', '--test-name-pattern=npm run start:web', 'web/tests/hosting.test.mjs'],
    {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    },
  );

  console.log('\nIsolated Test 9 exit code without prior build:', isolatedTestResult.status);
  assert.notEqual(isolatedTestResult.status, 0, 'Test 9 should fail without prior build');
  assert.match(isolatedTestResult.stdout + isolatedTestResult.stderr, /Cannot find module/);

  console.log('\nResult: start:web strictly depends on unbuilt web/dist/server.mjs; Test 9 has inter-test dependency.');
} finally {
  if (distExisted && fs.existsSync(backupPath)) {
    fs.cpSync(backupPath, distPath, { recursive: true });
    fs.rmSync(backupPath, { recursive: true, force: true });
  }
}
