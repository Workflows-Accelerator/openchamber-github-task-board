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

test('POST /api/issues/:n/human-tasks/:index/toggle toggles checkbox and preserves body byte-for-byte', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();
    const read = await session.request('/api/issues/1');
    assert.equal(read.status, 200);
    const fp = read.json.fingerprint;

    // Toggle task 0: from [ ] to [x]
    const res = await session.request('/api/issues/1/human-tasks/0/toggle', { method: 'POST', body: { fingerprint: fp } });
    assert.equal(res.status, 200);
    assert.equal(res.json.issue.humanTasks[0].completed, true);

    // Verify in fake GitHub: body changed only by that single character
    const patchCalls = f.fake.patchCalls;
    assert.equal(patchCalls.length, 1);
    assert.equal(patchCalls[0].payload.body.length, SAMPLE_BODY.length);
    assert.equal(patchCalls[0].payload.body, SAMPLE_BODY.replace('- [ ] Confirm DNS records', '- [x] Confirm DNS records'));

    // Toggle same completed state again fails with 400 invalid_edit
    const sameRes = await session.request('/api/issues/1/human-tasks/0/toggle', { method: 'POST', body: { completed: true } });
    assert.equal(sameRes.status, 400);
    assert.equal(sameRes.json.error, 'invalid_edit');
  } finally {
    await f.close();
  }
});

test('POST /api/issues/:n/reopen reopens a closed issue and refuses already open issues', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();

    // Reopen closed issue 3
    const reopenRes = await session.request('/api/issues/3/reopen', { method: 'POST' });
    assert.equal(reopenRes.status, 200);
    assert.equal(reopenRes.json.issue.state, 'open');

    // Attempting to reopen already open issue 1 fails 400 invalid_edit
    const invalidReopen = await session.request('/api/issues/1/reopen', { method: 'POST' });
    assert.equal(invalidReopen.status, 400);
    assert.equal(invalidReopen.json.error, 'invalid_edit');
  } finally {
    await f.close();
  }
});

test('POST /api/issues/:n/labels/remove and DELETE /api/issues/:n/labels/:label enforce precondition check failing 400 with ZERO GitHub PATCH if label absent', async () => {
  const f = await fixture();
  try {
    const session = new HttpSession(f.board.url);
    await session.login();

    // Precondition failure test: removing non-existent label 'security'
    const initialPatchCount = f.fake.patchCalls.length;
    const failRes = await session.request('/api/issues/1/labels/remove', { method: 'POST', body: { label: 'security' } });
    assert.equal(failRes.status, 400);
    assert.equal(failRes.json.error, 'invalid_edit');
    assert.match(failRes.json.message, /not present/);

    // Precondition failure on DELETE as well
    const failDelete = await session.request('/api/issues/1/labels/security', { method: 'DELETE' });
    assert.equal(failDelete.status, 400);
    assert.equal(failDelete.json.error, 'invalid_edit');

    // Zero PATCH calls were made to GitHub!
    const postFailPatchCount = f.fake.patchCalls.length;
    assert.equal(postFailPatchCount, initialPatchCount, 'ZERO GitHub PATCH made when label absent');

    // Success removal via POST
    const removeRes = await session.request('/api/issues/1/labels/remove', { method: 'POST', body: { label: 'bug' } });
    assert.equal(removeRes.status, 200);
    assert.equal(removeRes.json.issue.labels.includes('bug'), false);

    // Success removal via DELETE
    const deleteRes = await session.request('/api/issues/1/labels/backburner', { method: 'DELETE' });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.json.issue.labels.includes('backburner'), false);
  } finally {
    await f.close();
  }
});

test('GET /api/archive returns backburner and closed issues with bounded pagination', async () => {
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

    const nextRes = await session.request('/api/archive?limit=1&offset=1');
    assert.equal(nextRes.status, 200);
    assert.equal(nextRes.json.closed.length, 1);
    assert.equal(nextRes.json.hasMore, false);
  } finally {
    await f.close();
  }
});

test('GET /api/operations returns real counts with zero invented metrics', async () => {
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

    // statusPerProject
    assert.ok(data.statusPerProject['owner/repo']);
    assert.equal(data.statusPerProject['owner/repo']['in-progress'], 1);
    assert.equal(data.statusPerProject['owner/repo']['needs-human'], 1);
  } finally {
    await f.close();
  }
});
