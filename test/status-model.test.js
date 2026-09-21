import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS_DRAFT,
  STATUS_BACKLOG,
  STATUS_TODO,
  STATUS_PLANNED,
  STATUS_IN_PROGRESS,
  STATUS_NEEDS_HUMAN,
  STATUS_IN_REVIEW,
  STATUS_DONE,
  STATUS_LABELS,
  STATUS_METADATA,
  resolveIssueColumn,
  resolveDefaultTab,
  groupIssuesBy,
  StatusReconciler,
} from '../panel/labels.ts';

test('8-stage status label constants and metadata exist', () => {
  assert.equal(STATUS_DRAFT, 'status:draft');
  assert.equal(STATUS_BACKLOG, 'status:backlog');
  assert.equal(STATUS_TODO, 'status:todo');
  assert.equal(STATUS_PLANNED, 'status:planned');
  assert.equal(STATUS_IN_PROGRESS, 'status:in-progress');
  assert.equal(STATUS_NEEDS_HUMAN, 'status:needs-human');
  assert.equal(STATUS_IN_REVIEW, 'status:in-review');
  assert.equal(STATUS_DONE, 'status:done');

  assert.equal(STATUS_LABELS.length, 8);
  assert.deepEqual(STATUS_LABELS, [
    'status:draft',
    'status:backlog',
    'status:todo',
    'status:planned',
    'status:in-progress',
    'status:needs-human',
    'status:in-review',
    'status:done',
  ]);

  const expectedColumns = [
    'draft',
    'backlog',
    'todo',
    'planned',
    'in-progress',
    'needs-human',
    'in-review',
    'done',
  ];

  for (const col of expectedColumns) {
    const meta = STATUS_METADATA[col];
    assert.ok(meta, `Metadata should exist for column: ${col}`);
    assert.equal(meta.id, col);
    assert.equal(meta.label, `status:${col}`);
    assert.ok(typeof meta.name === 'string' && meta.name.length > 0);
    assert.ok(typeof meta.color === 'string' && meta.color.length > 0);
    assert.ok(typeof meta.description === 'string' && meta.description.length > 0);
  }
});

test('a) All 8 columns resolve correctly according to labels and session states', () => {
  // 1. Closed or status:done -> 'done'
  const closedIssue = { number: 1, state: 'closed', labels: [] };
  const doneLabeledIssue = { number: 2, state: 'open', labels: [{ name: 'status:done' }] };
  const runningSession = { id: 's-run', title: '#1 task', activity: 'running' };
  assert.equal(resolveIssueColumn(closedIssue, runningSession), 'done');
  assert.equal(resolveIssueColumn(doneLabeledIssue), 'done');

  // 2. status:in-review -> 'in-review'
  const inReviewIssue = { number: 3, state: 'open', labels: [{ name: 'status:in-review' }] };
  assert.equal(resolveIssueColumn(inReviewIssue), 'in-review');

  // 3. status:needs-human -> 'needs-human'
  const needsHumanIssue = { number: 4, state: 'open', labels: [{ name: 'status:needs-human' }] };
  assert.equal(resolveIssueColumn(needsHumanIssue), 'needs-human');

  // 4. status:in-progress
  const inProgressIssue = { number: 5, state: 'open', labels: [{ name: 'status:in-progress' }] };
  assert.equal(resolveIssueColumn(inProgressIssue), 'in-progress');
  assert.equal(resolveIssueColumn(inProgressIssue, runningSession), 'in-progress');
  const idleSession = { id: 's-idle', title: '#5 task', activity: 'idle' };
  assert.equal(resolveIssueColumn(inProgressIssue, idleSession), 'in-review');

  // 5. status:planned
  const plannedIssue = { number: 6, state: 'open', labels: [{ name: 'status:planned' }] };
  assert.equal(resolveIssueColumn(plannedIssue), 'planned');
  assert.equal(resolveIssueColumn(plannedIssue, runningSession), 'in-progress');

  // 6. status:todo
  const todoIssue = { number: 7, state: 'open', labels: [{ name: 'status:todo' }] };
  assert.equal(resolveIssueColumn(todoIssue), 'todo');
  assert.equal(resolveIssueColumn(todoIssue, runningSession), 'in-progress');

  // 7. status:backlog
  const backlogIssue = { number: 8, state: 'open', labels: [{ name: 'status:backlog' }] };
  assert.equal(resolveIssueColumn(backlogIssue), 'backlog');
  assert.equal(resolveIssueColumn(backlogIssue, runningSession), 'in-progress');

  // 8. status:draft
  const draftIssue = { number: 9, state: 'open', labels: [{ name: 'status:draft' }] };
  assert.equal(resolveIssueColumn(draftIssue), 'draft');
  assert.equal(resolveIssueColumn(draftIssue, runningSession), 'in-progress');

  // Session-derived for unlabelled well-formed issue
  const wellFormedUnlabelled = {
    number: 10,
    state: 'open',
    title: 'Implement detailed user authentication flow with JWT and refresh tokens',
    body: 'This is a long well-formed issue description that provides clear instructions and requirements for the engineering team to follow.',
    labels: [],
    subtasks: [{ text: 'Implement JWT signing', completed: false }],
  };
  // Default for unlabelled well-formed issue -> 'todo'
  assert.equal(resolveIssueColumn(wellFormedUnlabelled), 'todo');
  // Session running -> 'in-progress'
  assert.equal(resolveIssueColumn(wellFormedUnlabelled, runningSession), 'in-progress');
  // Session idle -> 'in-review'
  assert.equal(resolveIssueColumn(wellFormedUnlabelled, idleSession), 'in-review');
});

test('b) isVagueIdea issues automatically route to draft', () => {
  // Empty body and no subtasks
  const emptyIssue = {
    number: 20,
    state: 'open',
    title: 'maybe add dark mode',
    body: '',
    labels: [],
    subtasks: [],
  };
  assert.equal(resolveIssueColumn(emptyIssue), 'draft');

  // Short body (<20 words) and no subtasks
  const shortIssue = {
    number: 21,
    state: 'open',
    title: 'quick idea',
    body: 'need to fix things soon',
    labels: [],
    subtasks: [],
  };
  assert.equal(resolveIssueColumn(shortIssue), 'draft');

  // Has status:needs-alignment label
  const alignmentIssue = {
    number: 22,
    state: 'open',
    title: 'Architecture redesign',
    body: 'A very long explanation about redesigning the database architecture and migration pathways across all microservices.',
    labels: [{ name: 'status:needs-alignment' }],
    subtasks: [{ text: 'Step 1', completed: false }],
  };
  assert.equal(resolveIssueColumn(alignmentIssue), 'draft');

  // Has open questions
  const questionsIssue = {
    number: 23,
    state: 'open',
    title: 'Payment Integration',
    body: 'Detailed description of payment gateways.\n\n### Open Questions\n- [ ] Which provider should we support first?',
    labels: [],
    openQuestions: [{ text: 'Which provider should we support first?', completed: false }],
  };
  assert.equal(resolveIssueColumn(questionsIssue), 'draft');

  // But if a session is actively running on a vague idea, it routes to 'in-progress'
  const runningSession = { id: 's-run', title: '#20 task', activity: 'running' };
  assert.equal(resolveIssueColumn(emptyIssue, runningSession), 'in-progress');
});

test('c) waiting-permission and waiting-question map to needs-human', () => {
  const waitingPermSession = { id: 's-perm', title: '#30 task', activity: 'waiting-permission' };
  const waitingQuestSession = { id: 's-quest', title: '#31 task', activity: 'waiting-question' };

  // Planned issue with waiting session -> needs-human
  const plannedIssue = { number: 30, state: 'open', labels: [{ name: 'status:planned' }] };
  assert.equal(resolveIssueColumn(plannedIssue, waitingPermSession), 'needs-human');
  assert.equal(resolveIssueColumn(plannedIssue, waitingQuestSession), 'needs-human');

  // Todo issue with waiting session -> needs-human
  const todoIssue = { number: 31, state: 'open', labels: [{ name: 'status:todo' }] };
  assert.equal(resolveIssueColumn(todoIssue, waitingPermSession), 'needs-human');
  assert.equal(resolveIssueColumn(todoIssue, waitingQuestSession), 'needs-human');

  // Backlog issue with waiting session -> needs-human
  const backlogIssue = { number: 32, state: 'open', labels: [{ name: 'status:backlog' }] };
  assert.equal(resolveIssueColumn(backlogIssue, waitingPermSession), 'needs-human');
  assert.equal(resolveIssueColumn(backlogIssue, waitingQuestSession), 'needs-human');

  // In-progress issue with waiting session -> needs-human
  const inProgressIssue = { number: 33, state: 'open', labels: [{ name: 'status:in-progress' }] };
  assert.equal(resolveIssueColumn(inProgressIssue, waitingPermSession), 'needs-human');
  assert.equal(resolveIssueColumn(inProgressIssue, waitingQuestSession), 'needs-human');

  // Unlabelled issue with waiting session -> needs-human
  const unlabelledIssue = {
    number: 34,
    state: 'open',
    title: 'Valid comprehensive task title',
    body: 'Valid comprehensive task body with full descriptions for testing purposes.',
    labels: [],
  };
  assert.equal(resolveIssueColumn(unlabelledIssue, waitingPermSession), 'needs-human');
  assert.equal(resolveIssueColumn(unlabelledIssue, waitingQuestSession), 'needs-human');
});

test('d) reconciler updates status labels without loops or race conditions', async () => {
  const patchedCalls = [];

  const mockUpdateStatus = async (issue, targetColumn) => {
    patchedCalls.push({ issueNumber: issue.number, targetColumn });
    // Simulate updating issue labels locally
    issue.labels = [{ name: `status:${targetColumn}` }];
  };

  const sessionsMap = new Map();
  const reconciler = new StatusReconciler({
    debounceMs: 20,
    updateStatus: mockUpdateStatus,
    getSession: (issue) => sessionsMap.get(issue.number) || null,
  });

  const issue1 = {
    number: 101,
    state: 'open',
    title: 'Task 101',
    body: 'Long description for task 101',
    labels: [{ name: 'status:todo' }],
  };

  const issue2 = {
    number: 102,
    state: 'open',
    title: 'Task 102',
    body: 'Long description for task 102',
    labels: [{ name: 'status:in-progress' }],
  };

  // 1. Session running on issue 1 -> implies transition from todo to in-progress
  sessionsMap.set(101, { id: 's-101', activity: 'running' });
  // Session waiting on issue 2 -> implies transition from in-progress to needs-human
  sessionsMap.set(102, { id: 's-102', activity: 'waiting-permission' });

  const result1 = await reconciler.reconcile([issue1, issue2]);
  assert.equal(result1.length, 2);
  assert.deepEqual(patchedCalls, [
    { issueNumber: 101, targetColumn: 'in-progress' },
    { issueNumber: 102, targetColumn: 'needs-human' },
  ]);

  // 2. Loop prevention: Running reconcile again immediately with same state must NOT re-PATCH
  patchedCalls.length = 0;
  const result2 = await reconciler.reconcile([issue1, issue2]);
  assert.equal(result2.length, 0);
  assert.equal(patchedCalls.length, 0);

  // 3. Debounce behavior: Multiple schedule calls within debounce period collapse to 1 execution
  sessionsMap.set(101, { id: 's-101', activity: 'idle' }); // implies in-review
  reconciler.schedule([issue1]);
  reconciler.schedule([issue1]);
  reconciler.schedule([issue1]);

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(patchedCalls.length, 1);
  assert.deepEqual(patchedCalls[0], { issueNumber: 101, targetColumn: 'in-review' });

  // 4. Race condition prevention: In-flight requests lock the issue
  patchedCalls.length = 0;
  let resolveSlowPatch;
  const slowPromise = new Promise((resolve) => {
    resolveSlowPatch = resolve;
  });

  const issue3 = {
    number: 103,
    state: 'open',
    title: 'Task 103',
    body: 'Long description for task 103',
    labels: [{ name: 'status:in-progress' }],
  };

  const slowReconciler = new StatusReconciler({
    updateStatus: async (issue, targetColumn) => {
      patchedCalls.push({ issueNumber: issue.number, targetColumn });
      await slowPromise;
      issue.labels = [{ name: `status:${targetColumn}` }];
    },
    getSession: (issue) => sessionsMap.get(issue.number) || null,
  });

  sessionsMap.set(103, { id: 's-103', activity: 'waiting-question' });
  const p1 = slowReconciler.reconcile([issue3]);
  const p2 = slowReconciler.reconcile([issue3]); // Concurrent call while p1 is in-flight

  resolveSlowPatch();
  await Promise.all([p1, p2]);

  // Only 1 call dispatched despite 2 concurrent reconcile passes
  assert.equal(patchedCalls.length, 1);
  assert.deepEqual(patchedCalls[0], { issueNumber: 103, targetColumn: 'needs-human' });
});

test('resolveDefaultTab prioritizes needs-human > in-review > in-progress > todo > planned > backlog > draft > all', () => {
  const draftIssue = { number: 1, state: 'open', labels: [{ name: 'status:draft' }] };
  const backlogIssue = { number: 2, state: 'open', labels: [{ name: 'status:backlog' }] };
  const plannedIssue = { number: 3, state: 'open', labels: [{ name: 'status:planned' }] };
  const todoIssue = { number: 4, state: 'open', labels: [{ name: 'status:todo' }] };
  const inProgressIssue = { number: 5, state: 'open', labels: [{ name: 'status:in-progress' }] };
  const inReviewIssue = { number: 6, state: 'open', labels: [{ name: 'status:in-review' }] };
  const needsHumanIssue = { number: 7, state: 'open', labels: [{ name: 'status:needs-human' }] };

  assert.equal(
    resolveDefaultTab([draftIssue, backlogIssue, plannedIssue, todoIssue, inProgressIssue, inReviewIssue, needsHumanIssue]),
    'needs-human'
  );
  assert.equal(
    resolveDefaultTab([draftIssue, backlogIssue, plannedIssue, todoIssue, inProgressIssue, inReviewIssue]),
    'in-review'
  );
  assert.equal(
    resolveDefaultTab([draftIssue, backlogIssue, plannedIssue, todoIssue, inProgressIssue]),
    'in-progress'
  );
  assert.equal(
    resolveDefaultTab([draftIssue, backlogIssue, plannedIssue, todoIssue]),
    'todo'
  );
  assert.equal(
    resolveDefaultTab([draftIssue, backlogIssue, plannedIssue]),
    'planned'
  );
  assert.equal(
    resolveDefaultTab([draftIssue, backlogIssue]),
    'backlog'
  );
  assert.equal(
    resolveDefaultTab([draftIssue]),
    'draft'
  );
  assert.equal(
    resolveDefaultTab([]),
    'all'
  );
});

test('groupIssuesBy organizes issues into all 8 columns in order', () => {
  const issuesList = [
    { number: 1, state: 'open', labels: [{ name: 'status:draft' }] },
    { number: 2, state: 'open', labels: [{ name: 'status:backlog' }] },
    { number: 3, state: 'open', labels: [{ name: 'status:todo' }] },
    { number: 4, state: 'open', labels: [{ name: 'status:planned' }] },
    { number: 5, state: 'open', labels: [{ name: 'status:in-progress' }] },
    { number: 6, state: 'open', labels: [{ name: 'status:needs-human' }] },
    { number: 7, state: 'open', labels: [{ name: 'status:in-review' }] },
    { number: 8, state: 'closed', labels: [] },
  ];

  const groups = groupIssuesBy(issuesList, 'status');
  assert.equal(groups.length, 8);
  assert.deepEqual(
    groups.map((g) => g.id),
    ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done']
  );
  for (let i = 0; i < 8; i++) {
    assert.equal(groups[i].issues.length, 1);
    assert.equal(groups[i].issues[0].number, i + 1);
  }
});

test('index.html and main.ts adhere strictly to 8-stage layout and reconciler contract', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const here = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');
  const mainTs = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

  // Order: Draft | Backlog | To Do | Planned | In Progress | Needs Human | Review | Done
  const tabMatches = [...html.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabMatches, [
    'all',
    'draft',
    'backlog',
    'todo',
    'planned',
    'in-progress',
    'needs-human',
    'in-review',
    'done',
  ]);

  // Tab badge counts exist in html
  assert.ok(html.includes('id="tabCountDraft"'));
  assert.ok(html.includes('id="tabCountPlanned"'));
  assert.ok(html.includes('id="tabCountNeedsHuman"'));

  // Kanban columns exist in html in order
  const colMatches = [...html.matchAll(/data-column="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(colMatches, [
    'draft',
    'backlog',
    'todo',
    'planned',
    'in-progress',
    'needs-human',
    'in-review',
    'done',
  ]);

  // Kanban badge counts and card containers exist in html
  assert.ok(html.includes('id="kCountDraft"'));
  assert.ok(html.includes('id="kCardsDraft"'));
  assert.ok(html.includes('id="kCountPlanned"'));
  assert.ok(html.includes('id="kCardsPlanned"'));
  assert.ok(html.includes('id="kCountNeedsHuman"'));
  assert.ok(html.includes('id="kCardsNeedsHuman"'));

  // main.ts defines statusReconciler and hooks it up
  assert.ok(mainTs.includes('statusReconciler = new StatusReconciler'));
  assert.ok(mainTs.includes('statusReconciler.schedule(issues)'));
});
