import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../test/test-app-harness.js';

test('Desired A1: Cross-repo draft isolation with identical question text', async () => {
  const issueA = {
    number: 1,
    title: 'Issue 1 on Repo A',
    repo: 'owner/repo-a',
    body: '### Open Questions:\n- [ ] Which database should we use?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Which database should we use?', completed: false, lineIndex: 1 }],
  };

  const issueB = {
    number: 1,
    title: 'Issue 1 on Repo B',
    repo: 'owner/repo-b',
    body: '### Open Questions:\n- [ ] Which database should we use?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Which database should we use?', completed: false, lineIndex: 1 }],
  };

  const { app, elements } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 1, body: issueA.body }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  // 1. User opens Issue A in Drawer and types a draft
  app.setState({ issues: [issueA, issueB], currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  const btnAnswerA = drawerContainer.querySelector('.btn-inline-answer');
  btnAnswerA.click();

  const inputA = drawerContainer.querySelector('.input-inline-answer');
  inputA.value = 'Distinctive draft for Repo A';
  inputA.dispatchEvent({ type: 'input', target: inputA });

  // 2. Switch to Repo B and open Issue B in Drawer
  app.setState({ currentRepo: 'owner/repo-b' });
  app.openDrawer(issueB);

  const inputB = drawerContainer.querySelector('.input-inline-answer');
  const answerRowB = drawerContainer.querySelector('.inline-answer-row');

  // Issue B must NOT be contaminated with Issue A's draft
  assert.equal(
    inputB?.value || '',
    '',
    'Repo B #1 must not be prefilled with draft from Repo A #1'
  );
  assert.ok(
    !answerRowB || answerRowB.style?.display === 'none',
    'Answer row on Repo B must not mount open with Repo A draft'
  );

  // 3. User cancels on Repo B
  const btnAnswerB = drawerContainer.querySelector('.btn-inline-answer');
  btnAnswerB.click();
  const btnCancelB = drawerContainer.querySelector('.btn-cancel-inline-answer');
  btnCancelB.click();

  // 4. Return to Issue A in Drawer
  app.setState({ currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);

  const inputAReturned = drawerContainer.querySelector('.input-inline-answer');
  assert.equal(
    inputAReturned?.value,
    'Distinctive draft for Repo A',
    'Issue A draft must remain intact when Issue B is cancelled'
  );
});

test('Desired A2: Cross-repo draft isolation with different question text', async () => {
  const issueA = {
    number: 2,
    title: 'Issue 2 on Repo A',
    repo: 'owner/repo-a',
    body: '### Open Questions:\n- [ ] Question Alpha on Repo A?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question Alpha on Repo A?', completed: false, lineIndex: 1 }],
  };

  const issueB = {
    number: 2,
    title: 'Issue 2 on Repo B',
    repo: 'owner/repo-b',
    body: '### Open Questions:\n- [ ] Question Beta on Repo B?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question Beta on Repo B?', completed: false, lineIndex: 1 }],
  };

  const { app, elements } = createTestApp({
    onRequest: async () => ({ status: 200, body: '{}' }),
  });

  app.setState({ issues: [issueA, issueB], currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  drawerContainer.querySelector('.btn-inline-answer').click();

  const inputA = drawerContainer.querySelector('.input-inline-answer');
  inputA.value = 'Secret answer for Repo A';
  inputA.dispatchEvent({ type: 'input', target: inputA });

  // Open Issue B in Drawer (different repo, same number, different question)
  app.setState({ currentRepo: 'owner/repo-b' });
  app.openDrawer(issueB);

  const inputB = drawerContainer.querySelector('.input-inline-answer');
  assert.equal(
    inputB?.value || '',
    '',
    'Repo B #2 must not be prefilled with Repo A #2 draft via issue fallback'
  );
});

test('Desired B1: Single issue with multiple questions isolation (Q1 and Q2)', async () => {
  const multiQuestionIssue = {
    number: 10,
    title: 'Issue 10 with multiple questions',
    repo: 'owner/repo-main',
    body: [
      '### Open Questions:',
      '- [ ] Q1: Which database engine?',
      '- [ ] Q2: What is the launch date?',
    ].join('\n'),
    labels: [],
    subtasks: [],
    openQuestions: [
      { text: 'Q1: Which database engine?', completed: false, lineIndex: 1 },
      { text: 'Q2: What is the launch date?', completed: false, lineIndex: 2 },
    ],
  };

  const { app, elements } = createTestApp({
    onRequest: async () => ({ status: 200, body: '{}' }),
  });

  app.setState({ issues: [multiQuestionIssue], currentRepo: 'owner/repo-main' });
  app.openDrawer(multiQuestionIssue);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  const items = drawerContainer.querySelectorAll('.check-item');
  assert.equal(items.length, 2, 'Should render 2 questions in drawer');

  // User opens Q1 and types draft "Postgres 16"
  const q1BtnAnswer = items[0].querySelector('.btn-inline-answer');
  q1BtnAnswer.click();
  const q1Input = items[0].querySelector('.input-inline-answer');
  q1Input.value = 'Postgres 16';
  q1Input.dispatchEvent({ type: 'input', target: q1Input });

  // Re-open drawer or render Q2
  app.openDrawer(multiQuestionIssue);

  const itemsAfter = drawerContainer.querySelectorAll('.check-item');
  const q2Input = itemsAfter[1].querySelector('.input-inline-answer');
  const q2Row = itemsAfter[1].querySelector('.inline-answer-row');

  assert.equal(
    q2Input?.value || '',
    '',
    'Q2 must NOT be prefilled with Q1 draft ("Postgres 16")'
  );
  assert.ok(
    !q2Row || q2Row.style?.display === 'none',
    'Q2 row must NOT mount open with Q1 draft'
  );

  // User opens and cancels Q2
  itemsAfter[1].querySelector('.btn-inline-answer').click();
  itemsAfter[1].querySelector('.btn-cancel-inline-answer').click();

  // Q1 draft must remain preserved
  app.openDrawer(multiQuestionIssue);
  const itemsAfterCancel = drawerContainer.querySelectorAll('.check-item');
  const q1InputAfter = itemsAfterCancel[0].querySelector('.input-inline-answer');
  assert.equal(
    q1InputAfter?.value,
    'Postgres 16',
    'Q1 draft must remain intact when Q2 is cancelled'
  );
});

test('Desired C1: Emptying an input field deletes the draft and does not resurrect it on re-render', async () => {
  const issue = {
    number: 15,
    title: 'Issue 15',
    repo: 'owner/repo-main',
    body: '### Open Questions:\n- [ ] Question 15?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question 15?', completed: false, lineIndex: 1 }],
  };

  const { app, elements } = createTestApp({
    onRequest: async () => ({ status: 200, body: '{}' }),
  });

  app.setState({ issues: [issue], currentRepo: 'owner/repo-main' });
  app.openDrawer(issue);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  drawerContainer.querySelector('.btn-inline-answer').click();

  const input = drawerContainer.querySelector('.input-inline-answer');
  input.value = 'Temporary draft';
  input.dispatchEvent({ type: 'input', target: input });

  // User clears input (e.g. backspace to empty)
  input.value = '';
  input.dispatchEvent({ type: 'input', target: input });

  // Re-render drawer
  app.openDrawer(issue);
  const inputAfter = drawerContainer.querySelector('.input-inline-answer');
  assert.equal(
    inputAfter?.value || '',
    '',
    'Cleared draft must NOT resurrect old cached value on re-render'
  );
});

test('Desired C2: Remotely changed question leaves current input empty and renders recoverable draft labelled with original question', async () => {
  const issue = {
    number: 20,
    title: 'Issue 20',
    repo: 'owner/repo-main',
    body: '### Open Questions:\n- [ ] What is the timeout threshold?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'What is the timeout threshold?', completed: false, lineIndex: 1 }],
  };

  const changedBody = '### Open Questions:\n- [ ] What is the retry interval?';
  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 20, body: changedBody, updated_at: '2026-10-24T12:00:00Z' }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({
    issues: [issue],
    currentRepo: 'owner/repo-main',
    isManualRepoOverride: true,
    userLayoutPreference: 'questions',
  });
  app.applyLayoutMode();
  app.renderViews();

  const qvContainer = elements.get('questionsViewContainer');
  qvContainer.querySelector('.btn-inline-answer').click();
  const input = qvContainer.querySelector('.input-inline-answer');
  input.value = '30 seconds';
  qvContainer.querySelector('.btn-submit-inline-answer').click();

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'toast' && c.payload?.kind === 'error')) break;
  }

  const restoredInput = qvContainer.querySelector('.input-inline-answer');
  assert.equal(
    restoredInput?.value || '',
    '',
    'New question input must remain empty after refusal'
  );

  const html = qvContainer.innerHTML;
  assert.ok(
    html.includes('What is the timeout threshold?'),
    'Container must display original source question text'
  );
  assert.ok(
    html.includes('30 seconds'),
    'Container must display the typed recoverable draft'
  );

  const btnDiscard = qvContainer.querySelector('.btn-discard-draft');
  assert.ok(btnDiscard, 'Discard button must exist on recoverable draft');
  btnDiscard.click();

  const htmlAfterDiscard = qvContainer.innerHTML;
  assert.ok(
    !htmlAfterDiscard.includes('30 seconds'),
    'Clicking discard must remove the recoverable draft'
  );
});

test('Desired C3: Remotely deleted questions renders issue with recoverable draft rather than empty-box', async () => {
  const zeroQuestionsBody = '### Open Questions:\n(No questions)';
  const { app, elements } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 21, body: zeroQuestionsBody, updated_at: '2026-10-24T12:00:00Z' }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  const issueZero = {
    number: 21,
    title: 'Issue 21',
    repo: 'owner/repo-main',
    body: '### Open Questions:\n- [ ] Question to be deleted?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question to be deleted?', completed: false, lineIndex: 1 }],
  };

  app.setState({
    issues: [issueZero],
    currentRepo: 'owner/repo-main',
    isManualRepoOverride: true,
    userLayoutPreference: 'questions',
  });
  app.applyLayoutMode();
  app.renderViews();

  const qvContainer = elements.get('questionsViewContainer');
  qvContainer.querySelector('.btn-inline-answer').click();
  const inputZero = qvContainer.querySelector('.input-inline-answer');
  inputZero.value = 'Answer for deleted question';
  qvContainer.querySelector('.btn-submit-inline-answer').click();

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (qvContainer.innerHTML.includes('Answer for deleted question')) break;
  }

  const zeroHtml = qvContainer.innerHTML;
  assert.ok(
    zeroHtml.includes('Answer for deleted question'),
    'Draft for deleted question must be displayed in recoverable draft UI'
  );
  assert.ok(
    zeroHtml.includes('Question to be deleted?'),
    'Original question text must be displayed'
  );

  const btnDiscard = qvContainer.querySelector('.btn-discard-draft');
  assert.ok(btnDiscard, 'Discard button must be present');
  btnDiscard.click();

  const afterHtml = qvContainer.innerHTML;
  assert.ok(
    afterHtml.includes('empty-box') || afterHtml.includes('No open questions'),
    'After discarding draft, empty-box must appear when no questions remain'
  );
});

test('Desired D1: Direct renderers do not mutate userLayoutPreference or data-layout', async () => {
  const { app } = createTestApp({
    onRequest: async () => ({ status: 200, body: '{}' }),
  });

  const mockIssue = {
    number: 30,
    title: 'Issue 30',
    repo: 'owner/repo-main',
    body: '### Open Questions:\n- [ ] Test question?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Test question?', completed: false, lineIndex: 1 }],
  };

  app.setState({ issues: [mockIssue], currentRepo: 'owner/repo-main', isManualRepoOverride: true });

  // Initial render
  app.renderViews();
  const initialLayout = global.document.body.getAttribute('data-layout');

  // Direct call to renderQuestionsView
  app.renderQuestionsView([mockIssue]);
  const layoutAfterQ = global.document.body.getAttribute('data-layout');
  assert.equal(layoutAfterQ, initialLayout, 'renderQuestionsView must NOT mutate document.body data-layout');

  // Direct call to renderHumanTasksView
  app.renderHumanTasksView([mockIssue]);
  const layoutAfterH = global.document.body.getAttribute('data-layout');
  assert.equal(layoutAfterH, initialLayout, 'renderHumanTasksView must NOT mutate document.body data-layout');
});
