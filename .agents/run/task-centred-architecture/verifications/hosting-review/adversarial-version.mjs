import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBoardServer } from '../../../../../web/server/app.ts';
import { loadConfig } from '../../../../../web/server/config.ts';
import { startFakeGitHub } from '../../../../../web/tests/fake-github.mjs';
import { SYNTHETIC_TOKEN, BOARD_PASSWORD, SESSION_SECRET } from '../../../../../web/tests/helpers.mjs';

console.log('=== Proof: Brittle Version Handling and Silent Fallback ===');

const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN });

const config = loadConfig({
  BOARD_GITHUB_TOKEN: SYNTHETIC_TOKEN,
  BOARD_GITHUB_LOGIN: fake.login,
  BOARD_REPO: fake.repo,
  BOARD_PASSWORD: BOARD_PASSWORD,
  BOARD_SESSION_SECRET: SESSION_SECRET,
});

const app = await createBoardServer({
  config,
  githubApiBase: fake.url,
});

const { port } = await app.listen(0, '127.0.0.1');

try {
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await res.json();
  console.log('Normal /health response version:', body.version);
  assert.equal(body.version, '1.2.1');

  // Verify that package.json version in root matches
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log('package.json actual version:', rootPkg.version);
  assert.equal(rootPkg.version, '1.2.1');

  // Read app.ts source and verify the hardcoded fallback
  const appSource = fs.readFileSync('web/server/app.ts', 'utf8');
  assert.match(appSource, /cachedVersion = '1\.2\.1';/);
  console.log('web/server/app.ts contains hardcoded fallback literal: cachedVersion = \'1.2.1\'');

  // Read web/tests/hosting.test.mjs source and count frozen literals
  const testSource = fs.readFileSync('web/tests/hosting.test.mjs', 'utf8');
  const matches = [...testSource.matchAll(/'1\.2\.1'/g)];
  console.log('web/tests/hosting.test.mjs contains frozen version literal occurrences:', matches.length);
  assert.ok(matches.length >= 3, 'hosting.test.mjs has at least 3 frozen literals');

  console.log('\nResult: Health endpoint contains silent hardcoded fallback; tests assert duplicated literal.');
} finally {
  await app.close();
  await fake.close();
}
