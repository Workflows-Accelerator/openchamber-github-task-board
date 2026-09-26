import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHumanTasks,
  collectHumanTodos,
  normalizeGithubIssues,
} from '../panel/core.ts';

test('(a) parseHumanTasks parses unchecked and checked checkboxes under ### Human Tasks:', () => {
  const body = `
### Overview
Human tasks overview text.

### Human Tasks:
- [ ] Approve database migration
- [x] Review security audit report
* [ ] Grant access to staging bucket
+ [X] Deploy canary release
1. [ ] Run integration smoke tests

### Next Steps
Some trailing text.
`;

  const tasks = parseHumanTasks(body);
  assert.equal(tasks.length, 5);
  assert.equal(tasks[0].text, 'Approve database migration');
  assert.equal(tasks[0].completed, false);
  assert.equal(tasks[1].text, 'Review security audit report');
  assert.equal(tasks[1].completed, true);
  assert.equal(tasks[2].text, 'Grant access to staging bucket');
  assert.equal(tasks[2].completed, false);
  assert.equal(tasks[3].text, 'Deploy canary release');
  assert.equal(tasks[3].completed, true);
  assert.equal(tasks[4].text, 'Run integration smoke tests');
  assert.equal(tasks[4].completed, false);
});

test('(a) parseHumanTasks accepts heading spellings family and no others', () => {
  const headings = [
    '# Human Tasks:',
    '## Human Tasks',
    '### Human Tasks:',
    '#### Human Task:',
    '### Human Task',
  ];

  for (const h of headings) {
    const md = `${h}\n- [ ] Action item\n\n### Other\n- [ ] Not a human task`;
    const parsed = parseHumanTasks(md);
    assert.equal(parsed.length, 1, `Failed to parse under heading "${h}"`);
    assert.equal(parsed[0].text, 'Action item');
  }

  // Non-matching headings must not be parsed
  const nonHeadings = [
    '##### Human Tasks:', // level 5 heading exceeds 1-4
    '### Other Tasks:',
    '### Actionable Subtasks Checklist:',
    '### Human Todos:',
  ];
  for (const nh of nonHeadings) {
    const md = `${nh}\n- [ ] Action item`;
    const parsed = parseHumanTasks(md);
    assert.equal(parsed.length, 0, `Should not parse under heading "${nh}"`);
  }
});

test('(a) parseHumanTasks handles hostile edge cases: empty, null, undefined, CRLF, trailing header, checked-only', () => {
  assert.deepEqual(parseHumanTasks(null), []);
  assert.deepEqual(parseHumanTasks(undefined), []);
  assert.deepEqual(parseHumanTasks(''), []);
  assert.deepEqual(parseHumanTasks('   \n  \n'), []);

  // Header with no items
  assert.deepEqual(parseHumanTasks('### Human Tasks:\n\n### Next Section\n- [ ] Task'), []);

  // Header at very end of body
  assert.deepEqual(parseHumanTasks('Some text\n### Human Tasks:'), []);

  // Windows CRLF line endings
  const crlfBody = '### Human Tasks:\r\n- [ ] CRLF item 1\r\n- [x] CRLF item 2\r\n';
  const crlfParsed = parseHumanTasks(crlfBody);
  assert.equal(crlfParsed.length, 2);
  assert.equal(crlfParsed[0].text, 'CRLF item 1');
  assert.equal(crlfParsed[0].completed, false);
  assert.equal(crlfParsed[1].text, 'CRLF item 2');
  assert.equal(crlfParsed[1].completed, true);

  // Checked-only items
  const checkedOnly = '### Human Tasks:\n- [x] Done item 1\n- [X] Done item 2';
  const checkedParsed = parseHumanTasks(checkedOnly);
  assert.equal(checkedParsed.length, 2);
  assert.ok(checkedParsed.every((t) => t.completed));
});

test('(b) collectHumanTodos extracts explicit unchecked human tasks first in body order', () => {
  const issue = {
    number: 1,
    body: `
### Human Tasks:
- [ ] Approve PR #42
- [x] Already approved PR #41
- [ ] Deploy to production
- [ ] Approve PR #42

### Open Questions:
- [ ] Should we bump major version?
`,
  };

  const todos = collectHumanTodos(issue, { id: 's1', activity: 'waiting-permission' });
  // Should only extract unchecked human tasks, deduplicated, ignoring open questions and session-waiting
  assert.deepEqual(todos, [
    { text: 'Approve PR #42', source: 'human-task', done: false },
    { text: 'Deploy to production', source: 'human-task', done: false },
  ]);
});

test('(b) collectHumanTodos falls back to unanswered open questions when human tasks are empty or all checked', () => {
  // Case 1: No Human Tasks section at all
  const issueNoHumanTasks = {
    number: 2,
    body: `
### Open Questions:
- [ ] Which database should we use?
- [x] Resolved question *(Answer: PostgreSQL)*
- [ ] Which region to deploy to?
- [ ] Which database should we use?
`,
  };

  const todos1 = collectHumanTodos(issueNoHumanTasks);
  assert.deepEqual(todos1, [
    { text: 'Which database should we use?', source: 'open-question', done: false },
    { text: 'Which region to deploy to?', source: 'open-question', done: false },
  ]);

  // Case 2: Human Tasks section present but all items are checked
  const issueCheckedHumanTasks = {
    number: 3,
    body: `
### Human Tasks:
- [x] Grant AWS access
- [x] Review architectural diagram

### Open Questions:
- [ ] Confirm OAuth redirect URL?
`,
  };

  const todos2 = collectHumanTodos(issueCheckedHumanTasks);
  assert.deepEqual(todos2, [
    { text: 'Confirm OAuth redirect URL?', source: 'open-question', done: false },
  ]);
});

test('(b) collectHumanTodos falls back to synthesized session-waiting item when human tasks and open questions yield nothing', () => {
  const issue = {
    number: 4,
    body: `
### Overview
Everything is in progress.

### Human Tasks:
- [x] Completed task

### Open Questions:
- [x] Resolved question *(Answer: Yes)*
`,
  };

  // Waiting with explicit reason
  const sessionWithReason = {
    id: 's-waiting-1',
    activity: 'waiting-permission',
    waitingReason: 'Allow bash command execution',
  };
  const todosWithReason = collectHumanTodos(issue, sessionWithReason);
  assert.deepEqual(todosWithReason, [
    {
      text: 'Agent waiting for permission: Allow bash command execution',
      source: 'session-waiting',
      done: false,
    },
  ]);

  // Waiting-question activity with reason
  const sessionQuestion = {
    id: 's-waiting-2',
    activity: 'waiting-question',
    waitingReason: 'Need choice between Redis and Memcached',
  };
  const todosQuestion = collectHumanTodos(issue, sessionQuestion);
  assert.deepEqual(todosQuestion, [
    {
      text: 'Agent waiting for question: Need choice between Redis and Memcached',
      source: 'session-waiting',
      done: false,
    },
  ]);

  // Waiting without explicit reason
  const sessionNoReason = {
    id: 's-waiting-3',
    activity: 'waiting-permission',
  };
  const todosNoReason = collectHumanTodos(issue, sessionNoReason);
  assert.deepEqual(todosNoReason, [
    {
      text: 'Agent waiting for permission',
      source: 'session-waiting',
      done: false,
    },
  ]);

  // Non-waiting session yields nothing
  const sessionIdle = { id: 's-idle', activity: 'idle' };
  assert.deepEqual(collectHumanTodos(issue, sessionIdle), []);

  const sessionRunning = { id: 's-run', activity: 'running' };
  assert.deepEqual(collectHumanTodos(issue, sessionRunning), []);

  // Null/missing session yields nothing
  assert.deepEqual(collectHumanTodos(issue, null), []);
  assert.deepEqual(collectHumanTodos(issue), []);
});

test('(c) Issue type exposes parsed human tasks alongside subtasks/queries', () => {
  const rawApiItems = [
    {
      number: 10,
      title: 'feat(core): add human tasks',
      body: `
### Actionable Subtasks Checklist:
- [ ] Agent step 1
- [x] Agent step 2

### Open Questions:
- [ ] Open question 1?

### Human Tasks:
- [ ] Human approval step
- [x] Human reviewed spec
`,
    },
  ];

  const normalized = normalizeGithubIssues(rawApiItems);
  assert.equal(normalized.length, 1);
  const issue = normalized[0];

  assert.ok(Array.isArray(issue.humanTasks), 'issue.humanTasks should be an array');
  assert.equal(issue.humanTasks.length, 2);
  assert.equal(issue.humanTasks[0].text, 'Human approval step');
  assert.equal(issue.humanTasks[0].completed, false);
  assert.equal(issue.humanTasks[1].text, 'Human reviewed spec');
  assert.equal(issue.humanTasks[1].completed, true);

  // Subtasks should not include human tasks or questions
  assert.equal(issue.subtasks.length, 2);
  assert.equal(issue.subtasks[0].text, 'Agent step 1');
  assert.equal(issue.subtasks[1].text, 'Agent step 2');

  // Open questions should not include human tasks or subtasks
  assert.equal(issue.openQuestions.length, 1);
  assert.equal(issue.openQuestions[0].text, 'Open question 1?');
});

test('hostile review edge cases: cross-section isolation, CRLF in subtasks/questions, null issue with waiting session', async () => {
  const { parseSubtasks, parseOpenQuestions } = await import('../panel/core.ts');

  // 1. CRLF in parseSubtasks and parseOpenQuestions
  const crlfBody = '### Actionable Subtasks Checklist:\r\n- [ ] Task CRLF\r\n\r\n### Open Questions:\r\n- [ ] Question CRLF?\r\n';
  const subtasks = parseSubtasks(crlfBody);
  assert.equal(subtasks.length, 1);
  assert.equal(subtasks[0].text, 'Task CRLF');

  const questions = parseOpenQuestions(crlfBody);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].text, 'Question CRLF?');

  // 2. parseOpenQuestions does not bleed into ### Human Tasks: even if item has question syntax
  const mixedBody = `
### Human Tasks:
- [ ] ? Approve schema change
- [ ] Q: Review PR #10
- [ ] Question: Verify credentials

### Open Questions:
- [ ] Real question 1?
`;
  const parsedQuestions = parseOpenQuestions(mixedBody);
  assert.equal(parsedQuestions.length, 1);
  assert.equal(parsedQuestions[0].text, 'Real question 1?');

  const parsedHumanTasks = parseHumanTasks(mixedBody);
  assert.equal(parsedHumanTasks.length, 3);

  // 3. collectHumanTodos with null/undefined issue but waiting session
  const waitingSession = { id: 's-waiting', activity: 'waiting-permission', reason: 'Access to prod' };
  const todosNullIssue = collectHumanTodos(null, waitingSession);
  assert.deepEqual(todosNullIssue, [
    { text: 'Agent waiting for permission: Access to prod', source: 'session-waiting', done: false },
  ]);

  // 4. collectHumanTodos with empty array session
  assert.deepEqual(collectHumanTodos(null, []), []);
  assert.deepEqual(collectHumanTodos({ number: 99, body: '' }, []), []);
});
