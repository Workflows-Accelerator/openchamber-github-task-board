import assert from 'node:assert/strict';
import { startFakeGitHub, makeIssue } from '/workspace/extensions/github-task-board/web/tests/fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD, SYNTHETIC_TOKEN } from '/workspace/extensions/github-task-board/web/tests/helpers.mjs';
import { GitHubClient } from '/workspace/extensions/github-task-board/web/server/github.ts';

function repoFixture(repository, issues, extra = {}) {
  return { repo: repository, issues, ...extra };
}

async function signedIn(url, password = BOARD_PASSWORD) {
  const client = new HttpSession(url);
  const login = await client.login(password);
  assert.equal(login.status, 200);
  return client;
}

const generateIssues = (count, prefix) =>
  Array.from({ length: count }, (_, idx) =>
    makeIssue({
      number: idx + 1,
      title: `${prefix} Issue ${idx + 1}`,
      body: `## Overview\nBody ${idx + 1}\n`,
      labels: ['status:todo'],
    })
  );

async function run() {
  console.log('Running F4 probe...');

  // --- Part 1A: Exactly 500 issues across repos (250 + 250) ---
  {
    const fake = await startFakeGitHub({
      token: SYNTHETIC_TOKEN,
      repositories: [
        repoFixture('owner/alpha', generateIssues(250, 'Alpha'), { id: 101 }),
        repoFixture('owner/beta', generateIssues(250, 'Beta'), { id: 102 }),
      ],
    });
    const board = await startBoard(fake);
    try {
      const client = await signedIn(board.url);
      const res = await client.request('/api/combined/board');
      assert.equal(res.status, 200);
      assert.equal(res.json.issues.length, 500);
      assert.equal(res.json.issueCap, 500);
      assert.equal(res.json.truncatedByIssueCap, false, 'Exactly 500 is NOT truncated by cap');
      assert.equal(res.json.truncated, false);
      assert.equal(res.json.partial, false);
      assert.equal(res.json.complete, true);
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // --- Part 1B: 501 issues across repos (251 + 250) ---
  {
    const fake = await startFakeGitHub({
      token: SYNTHETIC_TOKEN,
      repositories: [
        repoFixture('owner/alpha', generateIssues(251, 'Alpha'), { id: 101 }),
        repoFixture('owner/beta', generateIssues(250, 'Beta'), { id: 102 }),
      ],
    });
    const board = await startBoard(fake);
    try {
      const client = await signedIn(board.url);
      const res = await client.request('/api/combined/board');
      assert.equal(res.status, 200);
      assert.equal(res.json.issues.length, 500, 'Issues capped at 500');
      assert.equal(res.json.issueCap, 500);
      assert.equal(res.json.truncatedByIssueCap, true, '501 issues causes truncatedByIssueCap=true');
      assert.equal(res.json.truncated, true);
      assert.equal(res.json.partial, true);
      assert.equal(res.json.complete, false);

      const keys = new Set(res.json.issues.map((i) => i.key));
      assert.equal(keys.size, 500, 'All 500 capped issues have unique keys');
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // --- Part 2: Duplicate page causes truncated = true in GitHubClient.listIssues ---
  {
    let callCount = 0;
    const mockFetch = async () => {
      callCount += 1;
      return new Response(JSON.stringify([{ number: 1, title: 'Issue 1' }, { number: 2, title: 'Issue 2' }]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          link: '<https://api.github.com/repos/owner/repo/issues?page=2>; rel="next"',
        },
      });
    };

    const client = new GitHubClient({
      apiBase: 'https://api.github.com',
      token: SYNTHETIC_TOKEN,
      repo: { owner: 'owner', name: 'repo', full: 'owner/repo' },
      fetchImpl: mockFetch,
      maxPages: 10,
    });

    const result = await client.listIssues();
    assert.equal(result.items.length, 2);
    assert.deepEqual(result.items.map((i) => i.number), [1, 2]);
    assert.equal(callCount, 2, 'Stops at page 2 upon encountering duplicate-only page');
    assert.equal(result.truncated, true, 'Result is marked truncated because later pages were left unread');
  }

  console.log('F4 probe: PASS');
}

run().catch((err) => {
  console.error('F4 probe: FAIL', err);
  process.exit(1);
});
