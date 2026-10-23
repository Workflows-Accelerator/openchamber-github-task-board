import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from './test-app-harness.js';
import { StatusReconciler } from '../panel/labels.ts';
import { DEFAULT_AI_ISSUE_PROMPT } from '../panel/core.ts';

test('1. Reproduction investigation: issue with phase:done or phase:archive in body does not close on pre-fix code (missing condition)', async () => {
  const patches = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      if (payload.method === 'PATCH') patches.push(payload);
      return { status: 200, body: '{}' };
    },
  });

  const issuePhaseDone = {
    number: 101,
    repo: 'test-owner/test-repo',
    title: 'Phase Done Task',
    body: 'phase:done\nSome work done',
    state: 'open',
    labels: [{ name: 'status:in-progress' }],
  };

  const session = {
    id: 's-101',
    activity: 'idle',
    items: [{ id: '101', data: { issueNumber: 101, repo: 'test-owner/test-repo' } }],
  };

  app.setState({
    issues: [issuePhaseDone],
    currentRepo: 'test-owner/test-repo',
    sessionIndex: new Map([[101, session]]),
    sessionIndexByRepo: new Map([['test-owner/test-repo', new Map([[101, session]])]]),
  });

  const result = await app.statusReconciler.reconcile([issuePhaseDone]);
  assert.equal(result.length, 0, 'Reconciler does not reconcile phase:done in body to done');
  assert.equal(patches.length, 0, 'No closure patch emitted for body phase:done');
});

test('2. Automatic closure path cut: un-signaled updateIssueStatus(issue, "done") is blocked', async () => {
  const patches = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      if (payload.method === 'PATCH') patches.push(payload);
      return { status: 200, body: '{}' };
    },
  });

  const issue = {
    number: 201,
    repo: 'test-owner/test-repo',
    title: 'Task 201',
    state: 'open',
    labels: [{ name: 'status:in-progress' }],
  };

  // Calling updateIssueStatus without { isHumanGesture: true } must NOT close the issue
  await app.updateIssueStatus(issue, 'done');
  assert.equal(
    patches.length,
    0,
    'Un-signaled updateIssueStatus("done") must not produce a PATCH request'
  );
  assert.equal(issue.state, 'open', 'Issue state in memory must remain open');
});

test('3. Reconciler guard cut: StatusReconciler never requests done or closes an issue', async () => {
  const patchCalls = [];
  const session = { id: 's-301', activity: 'idle' };

  const reconciler = new StatusReconciler({
    updateStatus: async (issue, targetCol) => {
      patchCalls.push({ issue: issue.number, targetCol });
    },
    getSession: () => session,
  });

  // Issue carrying legacy 'done' label that resolves to 'done' in resolveIssueColumn
  const legacyDoneIssue = {
    number: 301,
    repo: 'test-owner/test-repo',
    state: 'open',
    labels: [{ name: 'done' }],
  };

  const res = await reconciler.reconcile([legacyDoneIssue]);
  assert.equal(
    res.length,
    0,
    'StatusReconciler must ignore targetCol === "done" and not reconcile it'
  );
  assert.equal(
    patchCalls.length,
    0,
    'StatusReconciler must never call updateStatus with "done"'
  );
});

test('4. Human actions preserve legitimate closure: updateIssueStatus with isHumanGesture closes', async () => {
  const patches = [];
  const { app } = createTestApp({
    onRequest: (payload) => {
      if (payload.method === 'PATCH') patches.push(payload);
      return { status: 200, body: '{}' };
    },
  });

  const issue = {
    number: 401,
    repo: 'test-owner/test-repo',
    title: 'Task 401',
    state: 'open',
    labels: [{ name: 'status:in-progress' }],
  };

  await app.updateIssueStatus(issue, 'done', { isHumanGesture: true });
  assert.equal(patches.length, 1, 'Human gesture must produce a PATCH request');
  const patch = JSON.parse(patches[0].body);
  assert.equal(patch.state, 'closed', 'PATCH payload must set state: closed');
  assert.equal(issue.state, 'closed', 'Issue in memory must transition to closed');
});

test('5. Agent instruction guard: DEFAULT_AI_ISSUE_PROMPT contains autonomous closure prohibition', () => {
  assert.ok(
    DEFAULT_AI_ISSUE_PROMPT.includes(
      'An agent never sets phase:done, phase:archive or status:done and never closes an issue.'
    ),
    'DEFAULT_AI_ISSUE_PROMPT must explicitly forbid agents from closing or setting terminal status'
  );
});

test('6. Preservation: non-terminal automatic status reconciliation remains active', async () => {
  const transitions = [];
  const session = { id: 's-601', activity: 'running' };

  const reconciler = new StatusReconciler({
    updateStatus: async (issue, targetCol) => {
      transitions.push({ issue: issue.number, targetCol });
    },
    getSession: () => session,
  });

  const issue = {
    number: 601,
    repo: 'test-owner/test-repo',
    state: 'open',
    labels: [{ name: 'status:todo' }],
  };

  const res = await reconciler.reconcile([issue]);
  assert.equal(res.length, 1, 'Non-terminal running session must reconcile to in-progress');
  assert.equal(res[0].target, 'in-progress');
  assert.deepEqual(transitions, [{ issue: 601, targetCol: 'in-progress' }]);
});
