import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../..');

console.log('=== Recheck 3 & 4: Start Script Independence & Build Prerequisite ===\n');

// 1. Remove web/dist
const distDir = path.resolve(ROOT, 'web/dist');
fs.rmSync(distDir, { recursive: true, force: true });
assert.equal(fs.existsSync(distDir), false);
console.log('web/dist removed cleanly.');

// 2. Direct run without build fails with MODULE_NOT_FOUND
const failRun = spawnSync('npm', ['run', 'start:web'], { cwd: ROOT, encoding: 'utf8' });
console.log('Run without bundle exit code:', failRun.status);
assert.notEqual(failRun.status, 0);
assert.ok(failRun.stderr.includes('MODULE_NOT_FOUND') || failRun.stderr.includes('Cannot find module'));
console.log('Run without bundle fails with expected MODULE_NOT_FOUND.');

// 3. Execute exact documented build command from README:
// npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs
const buildRun = spawnSync(
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
console.log('Documented build exit code:', buildRun.status);
assert.equal(buildRun.status, 0);
assert.ok(fs.existsSync(path.resolve(distDir, 'server.mjs')));
console.log('Documented build command succeeded and created web/dist/server.mjs.');

// 4. Run test 9 in isolation to confirm ensureBundleBuilt works independently
const test9Run = spawnSync(
  'node',
  ['--test', '--test-name-pattern=npm run start:web package script serves /health', 'web/tests/hosting.test.mjs'],
  { cwd: ROOT, encoding: 'utf8' },
);
console.log('Test 9 isolated run exit code:', test9Run.status);
assert.equal(test9Run.status, 0);
console.log('Test 9 passed in complete isolation.');

console.log('\nResult: Findings 3 & 4 CONFIRMED CLOSED. Documented prerequisite is exact and test isolation is complete.');
