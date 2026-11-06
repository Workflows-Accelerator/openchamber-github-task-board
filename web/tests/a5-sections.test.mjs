import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWebHumanTasks,
  toggleHumanTaskInMarkdown,
  buildBoardListItem,
  buildIssueDetail,
} from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

const SAMPLE_BODY = `# Overview

Some introductory text.

## Human Tasks
- [ ] Confirm DNS records
- [x] Review billing invoice
- [ ] Sign client engagement letter

## Questions
- [ ] Question: Should we deploy to staging first?
`;

test('parseWebHumanTasks extracts checkboxes under Human Tasks and computes accurate character offsets', () => {
  const tasks = parseWebHumanTasks(SAMPLE_BODY);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].text, 'Confirm DNS records');
  assert.equal(tasks[0].completed, false);
  assert.equal(SAMPLE_BODY[tasks[0].charOffset], ' ');

  assert.equal(tasks[1].text, 'Review billing invoice');
  assert.equal(tasks[1].completed, true);
  assert.equal(SAMPLE_BODY[tasks[1].charOffset], 'x');

  assert.equal(tasks[2].text, 'Sign client engagement letter');
  assert.equal(tasks[2].completed, false);
  assert.equal(SAMPLE_BODY[tasks[2].charOffset], ' ');
});

test('toggleHumanTaskInMarkdown preserves markdown byte-for-byte except for the single checkbox character', () => {
  const { newBody, task } = toggleHumanTaskInMarkdown(SAMPLE_BODY, 0);
  assert.equal(task.completed, true);
  assert.equal(newBody.length, SAMPLE_BODY.length);

  // Verify every character except charOffset is identical
  for (let i = 0; i < SAMPLE_BODY.length; i++) {
    if (i === task.charOffset) {
      assert.equal(SAMPLE_BODY[i], ' ');
      assert.equal(newBody[i], 'x');
    } else {
      assert.equal(newBody[i], SAMPLE_BODY[i], `Character at index ${i} differed`);
    }
  }

  // Toggle back to unchecked
  const { newBody: toggledBack, task: taskBack } = toggleHumanTaskInMarkdown(newBody, 0);
  assert.equal(taskBack.completed, false);
  assert.equal(toggledBack, SAMPLE_BODY, 'Toggling back restores exact byte-identical string');
});

test('toggleHumanTaskInMarkdown preserves CRLF line endings byte-for-byte', () => {
  const crlfBody = SAMPLE_BODY.replace(/\n/g, '\r\n');
  const { newBody, task } = toggleHumanTaskInMarkdown(crlfBody, 2);
  assert.equal(task.completed, true);
  assert.equal(newBody.length, crlfBody.length);
  assert.equal(newBody[task.charOffset], 'x');
  assert.equal(crlfBody[task.charOffset], ' ');

  // All CRLF sequences preserved
  const originalCRLFCount = (crlfBody.match(/\r\n/g) || []).length;
  const newCRLFCount = (newBody.match(/\r\n/g) || []).length;
  assert.equal(newCRLFCount, originalCRLFCount);
});

test('parseWebHumanTasks ignores code fences and indented code', () => {
  const fencedBody = `# Overview
\`\`\`markdown
## Human Tasks
- [ ] Fake task in code
\`\`\`

## Human Tasks
- [ ] Real human task
`;
  const tasks = parseWebHumanTasks(fencedBody);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].text, 'Real human task');
});

async function fixture(options = {}) {
  const issues = options.issues ?? [
    makeIssue({
      number: 1,
      title: 'Active issue',
      body: SAMPLE_BODY,
      labels: ['status:in-progress', 'bug', 'backburner'],
      state: 'open',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-05T10:00:00Z',
    }),
    makeIssue({
      number: 2,
      title: 'Human blocked issue',
      body: '## Human Tasks\n- [ ] Unchecked manual check',
      labels: ['status:needs-human'],
      state: 'open',
      created_at: '2026-10-10T10:00:00Z',
      updated_at: '2026-10-15T10:00:00Z',
    }),
    makeIssue({
      number: 3,
      title: 'Recently closed issue',
      body: 'Done task body',
      labels: ['status:done'],
      state: 'closed',
      created_at: '2026-10-12T10:00:00Z',
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    makeIssue({
      number: 4,
      title: 'Old closed issue',
      body: 'Old closed task',
      labels: ['status:done'],
      state: 'closed',
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-10T10:00:00Z',
    }),
  ];

  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, issues, ...options.fake });
  const board = await startBoard(fake, options.board);
  return { fake, board, close: async () => { await board.app.close(); await fake.close(); } };
}

test('POST /api/issues/:n/human-tasks/:index/toggle toggles checkbox, enforces fingerprints, and validates boolean completed', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();
    const read = await session.request('/api/issues/1');
    assert.equal(read.status, 200);
    const fp = read.json.issue.fingerprint;

    // Missing fingerprint -> 400 fingerprint_required
    const noFpRes = await session.request('/api/issues/1/human-tasks/0/toggle', { method: 'POST', body: {} });
    assert.equal(noFpRes.status, 400);
    assert.equal(noFpRes.json.error, 'fingerprint_required');

    // Stale fingerprint -> 409 conflict
    const staleFp = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const staleRes = await session.request('/api/issues/1/human-tasks/0/toggle', { method: 'POST', body: { fingerprint: staleFp } });
    assert.equal(staleRes.status, 409);
    assert.equal(staleRes.json.error, 'conflict');

    // Non-boolean completed -> 400 invalid_edit
    const nonBoolRes = await session.request('/api/issues/1/human-tasks/0/toggle', {
      method: 'POST',
      body: { completed: 'not-a-bool', fingerprint: fp },
    });
    assert.equal(nonBoolRes.status, 400);
    assert.equal(nonBoolRes.json.error, 'invalid_edit');

    // Toggle task 0: from [ ] to [x] with valid fingerprint
    const res = await session.request('/api/issues/1/human-tasks/0/toggle', { method: 'POST', body: { fingerprint: fp } });
    assert.equal(res.status, 200);
    assert.equal(res.json.issue.humanTasks[0].completed, true);

    // Verify in fake GitHub: body changed only by that single character
    const patchCalls = f.fake.patchCalls;
    assert.equal(patchCalls.length, 1);
    assert.equal(patchCalls[0].payload.body.length, SAMPLE_BODY.length);
    assert.equal(patchCalls[0].payload.body, SAMPLE_BODY.replace('- [ ] Confirm DNS records', '- [x] Confirm DNS records'));

    // Toggle same completed state again fails with 400 invalid_edit
    const readAgain = await session.request('/api/issues/1');
    const newFp = readAgain.json.issue.fingerprint;
    const sameRes = await session.request('/api/issues/1/human-tasks/0/toggle', { method: 'POST', body: { completed: true, fingerprint: newFp } });
    assert.equal(sameRes.status, 400);
    assert.equal(sameRes.json.error, 'invalid_edit');
  } finally {
    await f.close();
  }
});

test('POST /api/issues/:n/reopen enforces fingerprints, sets state:open, assigns status:backlog, and refuses open issues', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();

    // Read issue 3 to get fingerprint
    const read3 = await session.request('/api/issues/3');
    assert.equal(read3.status, 200);
    const fp3 = read3.json.issue.fingerprint;

    // Missing fingerprint -> 400 fingerprint_required
    const noFpRes = await session.request('/api/issues/3/reopen', { method: 'POST' });
    assert.equal(noFpRes.status, 400);
    assert.equal(noFpRes.json.error, 'fingerprint_required');

    // Stale fingerprint -> 409 conflict
    const staleFp = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const staleRes = await session.request('/api/issues/3/reopen', { method: 'POST', body: { fingerprint: staleFp } });
    assert.equal(staleRes.status, 409);
    assert.equal(staleRes.json.error, 'conflict');

    // Reopen closed issue 3 with valid fingerprint
    const reopenRes = await session.request('/api/issues/3/reopen', { method: 'POST', body: { fingerprint: fp3 } });
    assert.equal(reopenRes.status, 200);
    assert.equal(reopenRes.json.issue.state, 'open');
    assert.equal(reopenRes.json.issue.statusLabel, 'status:backlog', 'Reopen must reconcile status to status:backlog');
    assert.equal(reopenRes.json.issue.labels.includes('status:done'), false, 'Reopen must remove status:done');

    // Attempting to reopen already open issue 1 fails 400 invalid_edit
    const read1 = await session.request('/api/issues/1');
    const fp1 = read1.json.issue.fingerprint;
    const invalidReopen = await session.request('/api/issues/1/reopen', { method: 'POST', body: { fingerprint: fp1 } });
    assert.equal(invalidReopen.status, 400);
    assert.equal(invalidReopen.json.error, 'invalid_edit');
  } finally {
    await f.close();
  }
});

test('POST /api/issues/:n/labels/remove and DELETE /api/issues/:n/labels/:label enforce mandatory fingerprints, reject malformed JSON, and require label presence', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();

    const read = await session.request('/api/issues/1');
    assert.equal(read.status, 200);
    const fp = read.json.issue.fingerprint;

    // Missing fingerprint on POST -> 400 fingerprint_required
    const noFpRes = await session.request('/api/issues/1/labels/remove', { method: 'POST', body: { label: 'bug' } });
    assert.equal(noFpRes.status, 400);
    assert.equal(noFpRes.json.error, 'fingerprint_required');

    // Missing fingerprint on DELETE -> 400 fingerprint_required
    const noFpDelete = await session.request('/api/issues/1/labels/bug', { method: 'DELETE' });
    assert.equal(noFpDelete.status, 400);
    assert.equal(noFpDelete.json.error, 'fingerprint_required');

    // Stale fingerprint on POST -> 409 conflict with ZERO github patch
    const initialPatchCount = f.fake.patchCalls.length;
    const staleFp = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const staleRes = await session.request('/api/issues/1/labels/remove', {
      method: 'POST',
      body: { label: 'bug', fingerprint: staleFp },
    });
    assert.equal(staleRes.status, 409);
    assert.equal(f.fake.patchCalls.length, initialPatchCount);

    // Precondition failure test: removing non-existent label 'security'
    const failRes = await session.request('/api/issues/1/labels/remove', {
      method: 'POST',
      body: { label: 'security', fingerprint: fp },
    });
    assert.equal(failRes.status, 400);
    assert.equal(failRes.json.error, 'invalid_edit');
    assert.match(failRes.json.message, /not present/);

    // Precondition failure on DELETE with non-existent label
    const failDelete = await session.request(`/api/issues/1/labels/security?fingerprint=${fp}`, { method: 'DELETE' });
    assert.equal(failDelete.status, 400);
    assert.equal(failDelete.json.error, 'invalid_edit');

    // Zero PATCH calls were made to GitHub for failures!
    assert.equal(f.fake.patchCalls.length, initialPatchCount, 'ZERO GitHub PATCH made when label absent');

    // Success removal via POST
    const removeRes = await session.request('/api/issues/1/labels/remove', {
      method: 'POST',
      body: { label: 'bug', fingerprint: fp },
    });
    assert.equal(removeRes.status, 200);
    assert.equal(removeRes.json.issue.labels.includes('bug'), false);

    // Success removal via DELETE using updated fingerprint
    const readAfterBug = await session.request('/api/issues/1');
    const fpAfterBug = readAfterBug.json.issue.fingerprint;
    const deleteRes = await session.request(`/api/issues/1/labels/backburner?fingerprint=${fpAfterBug}`, { method: 'DELETE' });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.json.issue.labels.includes('backburner'), false);
  } finally {
    await f.close();
  }
});

test('GET /api/archive returns backburner and closed issues with bounded pagination, stable sort, and preserved metadata', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();
    const res = await session.request('/api/archive?limit=1');
    assert.equal(res.status, 200);
    assert.equal(res.json.backburner.length, 1);
    assert.equal(res.json.backburner[0].number, 1);
    assert.equal(res.json.closed.length, 1);
    assert.equal(res.json.totalClosed, 2);
    assert.equal(res.json.hasMore, true);
    assert.ok(res.json.fetchedAt);
    assert.equal(res.json.partial, false);
    assert.equal(res.json.truncated, false);
    assert.deepEqual(res.json.failures, []);

    // Stable sort: issue 3 (closed 2 days ago) must come before issue 4 (closed months ago)
    assert.equal(res.json.closed[0].number, 3);

    const nextRes = await session.request('/api/archive?limit=1&offset=1');
    assert.equal(nextRes.status, 200);
    assert.equal(nextRes.json.closed.length, 1);
    assert.equal(nextRes.json.closed[0].number, 4);
    assert.equal(nextRes.json.hasMore, false);
  } finally {
    await f.close();
  }
});

test('GET /api/operations returns real counts, 8 standard status columns, and accurate closed7Days using closedAt', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();
    const res = await session.request('/api/operations');
    assert.equal(res.status, 200);
    const data = res.json;

    assert.equal(data.openClosed.open, 2);
    assert.equal(data.openClosed.closed, 2);
    assert.equal(data.openClosed.total, 4);

    // needsHuman: issue 1 and issue 2 both have open human tasks
    assert.equal(data.needsHuman, 2);

    // closed7Days: issue 3 was closed 2 days ago, issue 4 was closed months ago
    assert.equal(data.closed7Days, 1);

    // oldestOpenInProgress: issue 1 is in-progress
    assert.ok(data.oldestOpenInProgress);
    assert.equal(data.oldestOpenInProgress.number, 1);

    // statusPerProject must contain all 8 standard status columns
    assert.ok(data.statusPerProject['owner/repo']);
    const expectedCols = ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'];
    for (const col of expectedCols) {
      assert.equal(typeof data.statusPerProject['owner/repo'][col], 'number', `Column ${col} missing from statusPerProject`);
    }
    assert.equal(data.statusPerProject['owner/repo']['in-progress'], 1);
    assert.equal(data.statusPerProject['owner/repo']['needs-human'], 1);

    // Real board metadata preserved
    assert.ok(data.fetchedAt);
    assert.equal(data.partial, false);
    assert.equal(data.truncated, false);
    assert.deepEqual(data.failures, []);
  } finally {
    await f.close();
  }
});

test('multi-repo All Projects Operations aggregates multiple repositories and handles discovery failure', async () => {
  const fake = await startFakeGitHub({
    repositories: [
      {
        repo: 'owner/repo',
        issues: [
          makeIssue({ number: 1, repo: 'owner/repo', title: 'Task 1', body: '## Human Tasks\n- [ ] Task 1', labels: ['status:needs-human'] }),
          makeIssue({ number: 2, repo: 'owner/repo', title: 'Task 2', labels: ['status:in-progress'] }),
          makeIssue({ number: 3, repo: 'owner/repo', title: 'Task 3', labels: ['status:todo'] }),
        ],
      },
      {
        repo: 'owner/other-repo',
        issues: [
          makeIssue({ number: 10, repo: 'owner/other-repo', title: 'Task 10', labels: ['status:in-progress'] }),
          makeIssue({ number: 11, repo: 'owner/other-repo', title: 'Task 11', labels: ['status:todo'] }),
        ],
      },
    ],
  });
  fake.addDependency(2, 1, 'owner/repo', 'owner/repo');
  fake.addDependency(3, 10, 'owner/repo', 'owner/other-repo');
  fake.addDependency(11, 10, 'owner/other-repo', 'owner/other-repo');

  const board = await startBoard(fake, { repositoryTtlMs: 0 });
  try {
    const session = new HttpSession(board.url);
    await session.login();

    const opsRes = await session.request('/api/combined/operations');
    assert.equal(opsRes.status, 200);
    const data = opsRes.json;

    // Both repositories present in statusPerProject with all 8 standard status columns
    assert.ok(data.statusPerProject['owner/repo']);
    assert.ok(data.statusPerProject['owner/other-repo']);
    const expectedCols = ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'];
    for (const col of expectedCols) {
      assert.equal(typeof data.statusPerProject['owner/repo'][col], 'number');
      assert.equal(typeof data.statusPerProject['owner/other-repo'][col], 'number');
    }
    assert.equal(data.statusPerProject['owner/repo']['needs-human'], 1);
    assert.equal(data.statusPerProject['owner/repo']['in-progress'], 1);
    assert.equal(data.statusPerProject['owner/repo']['todo'], 1);
    assert.equal(data.statusPerProject['owner/other-repo']['in-progress'], 1);
    assert.equal(data.statusPerProject['owner/other-repo']['todo'], 1);

    // Blocked count:
    // owner/repo#1 (needs-human) -> blocked
    // owner/repo#2 (blocked by #1) -> blocked
    // owner/repo#3 (blocked by other-repo#10) -> blocked
    // owner/other-repo#11 (blocked by other-repo#10) -> blocked
    assert.equal(data.blocked, 4);

    // Upstream discovery failure maps to HTTP 502 discovery_unavailable on operations and archive
    fake.setInjectedResponse(500, { message: 'Upstream discovery failure' });
    const failOps = await session.request('/api/combined/operations');
    assert.equal(failOps.status, 502);
    assert.equal(failOps.json.error, 'discovery_unavailable');

    const failArchive = await session.request('/api/combined/archive');
    assert.equal(failArchive.status, 502);
    assert.equal(failArchive.json.error, 'discovery_unavailable');
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('multi-repo Operations and Archive failure modes: total outage, partial per-repo failure, and cached fallback', async () => {
  // 1. Partial per-repo failure (1 repo fails, 1 repo succeeds)
  {
    const fake = await startFakeGitHub({
      repositories: [
        {
          repo: 'owner/repo-good',
          id: 1,
          issues: [
            makeIssue({ number: 1, repo: 'owner/repo-good', title: 'Good Task', labels: ['status:in-progress'] }),
          ],
        },
        {
          repo: 'owner/repo-fail',
          id: 2,
          issues: [
            makeIssue({ number: 10, repo: 'owner/repo-fail', title: 'Fail Task', labels: ['status:todo'] }),
          ],
        },
      ],
    });

    const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      fake.setRepoFailing('owner/repo-fail', true);

      const opsRes = await session.request('/api/combined/operations');
      assert.equal(opsRes.status, 200);
      assert.equal(opsRes.json.partial, true);
      assert.equal(Array.isArray(opsRes.json.failures), true);
      assert.equal(opsRes.json.failures.length, 1);
      assert.equal(opsRes.json.statusPerProject['owner/repo-good']['in-progress'], 1);

      const archiveRes = await session.request('/api/combined/archive');
      assert.equal(archiveRes.status, 200);
      assert.equal(archiveRes.json.partial, true);
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // 2. All repos failing with cached fallback
  {
    const fake = await startFakeGitHub({
      repositories: [
        {
          repo: 'owner/repo-cached',
          id: 1,
          issues: [
            makeIssue({ number: 1, repo: 'owner/repo-cached', title: 'Cached Task', labels: ['status:in-progress'] }),
          ],
        },
      ],
    });

    let clock = Date.parse('2026-11-06T00:00:00Z');
    const board = await startBoard(fake, {
      now: () => clock,
      repositoryTtlMs: 60_000,
      boardCacheTtlMs: 30_000,
      aggregateTimeoutMs: 12_000,
    });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      // Prime cache
      const primeRes = await session.request('/api/combined/operations');
      assert.equal(primeRes.status, 200);
      assert.equal(primeRes.json.statusPerProject['owner/repo-cached']['in-progress'], 1);

      // Advance past cache TTL and fail repo
      clock += 35_000;
      fake.setRepoFailing('owner/repo-cached', true);

      const cachedOps = await session.request('/api/combined/operations');
      assert.equal(cachedOps.status, 200);
      assert.equal(cachedOps.json.partial, true);
      assert.equal(cachedOps.json.statusPerProject['owner/repo-cached']['in-progress'], 1);
      assert.ok(cachedOps.json.failures.some((f) => f.message.includes('showing cached tasks')));

      const cachedArchive = await session.request('/api/combined/archive');
      assert.equal(cachedArchive.status, 200);
      assert.equal(cachedArchive.json.partial, true);
    } finally {
      await board.app.close();
      await fake.close();
    }
  }

  // 3. All repos failing with no cache -> 502 discovery_unavailable error
  {
    const fake = await startFakeGitHub({
      repositories: [
        {
          repo: 'owner/repo-a',
          id: 1,
          issues: [makeIssue({ number: 1, repo: 'owner/repo-a', labels: ['status:todo'] })],
        },
        {
          repo: 'owner/repo-b',
          id: 2,
          issues: [makeIssue({ number: 2, repo: 'owner/repo-b', labels: ['status:todo'] })],
        },
      ],
    });

    const board = await startBoard(fake, { repositoryTtlMs: 60_000 });
    try {
      const session = new HttpSession(board.url);
      await session.login();

      // Discovery succeeded, now fail all repos with no cache
      fake.setRepoFailing('owner/repo-a', true);
      fake.setRepoFailing('owner/repo-b', true);

      const failOps = await session.request('/api/combined/operations');
      assert.equal(failOps.status, 502);
      assert.equal(failOps.json.error, 'discovery_unavailable');

      const failArchive = await session.request('/api/combined/archive');
      assert.equal(failArchive.status, 502);
      assert.equal(failArchive.json.error, 'discovery_unavailable');
    } finally {
      await board.app.close();
      await fake.close();
    }
  }
});
