import assert from 'node:assert/strict';
import { startFakeGitHub, makeIssue } from '/workspace/extensions/github-task-board/web/tests/fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD, SYNTHETIC_TOKEN } from '/workspace/extensions/github-task-board/web/tests/helpers.mjs';

function repoFixture(repository, issues, extra = {}) {
  return { repo: repository, issues, ...extra };
}

async function signedIn(url, password = BOARD_PASSWORD) {
  const client = new HttpSession(url);
  const login = await client.login(password);
  assert.equal(login.status, 200);
  return client;
}

async function run() {
  console.log('Running F1 probe...');
  let now = 1_700_000_000_000;
  const fake = await startFakeGitHub({
    token: SYNTHETIC_TOKEN,
    repositories: [
      repoFixture('owner/alpha', [makeIssue({ number: 1, title: 'Alpha Issue', body: '## Overview\n\nAlpha body\n', labels: ['status:todo'] })], { id: 101 }),
      repoFixture('owner/beta', [makeIssue({ number: 1, title: 'Beta Issue', body: '## Overview\n\nBeta body\n', labels: ['status:todo'] })], { id: 102 }),
    ],
  });

  let releaseDiscovery = () => {};
  let discoveryGate = null;
  let discoveryEntered = false;
  let gateRefresh = false;

  const fetchImpl = async (input, init) => {
    if (gateRefresh && String(input).includes('/user/repos')) {
      discoveryEntered = true;
      await discoveryGate;
    }
    return fetch(input, init);
  };

  const board = await startBoard(fake, { now: () => now, fetchImpl });
  try {
    const client = await signedIn(board.url);
    const reposRes = await client.request('/api/repos');
    assert.equal(reposRes.status, 200);

    const alphaRead = await client.request('/api/repos/owner/alpha/issues/1');
    assert.equal(alphaRead.status, 200);
    const alphaFingerprint = alphaRead.json.issue.fingerprint;

    // Revoke alpha in fake github
    fake.setRepoAccessible('owner/alpha', false);
    now += 61_000; // past 60s cache TTL

    gateRefresh = true;
    discoveryGate = new Promise((resolve) => { releaseDiscovery = resolve; });

    // Start discovery refresh
    const refreshPromise = client.request('/api/repos');
    while (!discoveryEntered) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    const beforePatchCalls = fake.patchCalls.length;
    const beforeRequestCount = fake.requests.length;

    // Issue write to revoked repository alpha while refresh is held
    const writePromise = client.request('/api/repos/owner/alpha/issues/1/status', {
      method: 'POST',
      body: { status: 'status:done', fingerprint: alphaFingerprint },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    releaseDiscovery();

    const [refreshed, writeResult] = await Promise.all([refreshPromise, writePromise]);

    assert.equal(refreshed.status, 200);
    assert.equal(writeResult.status, 400);
    assert.equal(writeResult.json.error, 'repository_not_allowed');

    // Assert zero PATCH calls sent upstream
    const afterPatchCalls = fake.patchCalls.length;
    assert.equal(afterPatchCalls - beforePatchCalls, 0, 'Zero PATCH calls sent upstream for revoked repository');

    // Assert zero calls to /repos/owner/alpha upstream during/after revoked write
    const alphaCalls = fake.requests.slice(beforeRequestCount).filter((r) => r.path.startsWith('/repos/owner/alpha'));
    assert.deepEqual(alphaCalls, [], 'Zero upstream calls to /repos/owner/alpha');

    // Beta (which remained accessible) still functions
    const betaRead = await client.request('/api/repos/owner/beta/issues/1');
    assert.equal(betaRead.status, 200);
    const betaWrite = await client.request('/api/repos/owner/beta/issues/1/section', {
      method: 'PUT',
      body: { sectionId: 'overview', text: 'Beta update', fingerprint: betaRead.json.issue.fingerprint },
    });
    assert.equal(betaWrite.status, 200);
    assert.equal(fake.patchCalls.length, 1);
    assert.equal(fake.patchCalls[0].repo, 'owner/beta');

    console.log('F1 probe: PASS');
  } finally {
    releaseDiscovery();
    await board.app.close();
    await fake.close();
  }
}

run().catch((err) => {
  console.error('F1 probe: FAIL', err);
  process.exit(1);
});
