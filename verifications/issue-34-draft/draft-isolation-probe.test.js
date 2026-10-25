import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../test/test-app-harness.js';

test('Hypothesis A1: Cross-repo draft leakage and deletion with identical question text', async () => {
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

  // Verify repoForIssue correctly identifies both repositories
  assert.equal(app.repoForIssue(issueA), 'owner/repo-a');
  assert.equal(app.repoForIssue(issueB), 'owner/repo-b');

  // 1. User opens Issue A in Drawer and types a distinctive draft
  app.setState({ issues: [issueA, issueB], currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  const btnAnswerA = drawerContainer.querySelector('.btn-inline-answer');
  assert.ok(btnAnswerA, 'btnAnswer should exist on Issue A');
  btnAnswerA.click();

  const inputA = drawerContainer.querySelector('.input-inline-answer');
  assert.ok(inputA, 'input should exist on Issue A');
  inputA.value = 'Distinctive draft for Repo A';
  inputA.dispatchEvent({ type: 'input', target: inputA });

  // 2. Switch to Repo B or open Issue B in Drawer
  app.setState({ currentRepo: 'owner/repo-b' });
  app.openDrawer(issueB);

  const inputB = drawerContainer.querySelector('.input-inline-answer');
  const answerRowB = drawerContainer.querySelector('.inline-answer-row');

  // Check if Issue B was contaminated with Issue A's draft
  const leakedToB = inputB?.value === 'Distinctive draft for Repo A';
  const rowMountedOnB = answerRowB && answerRowB.style.display !== 'none';

  console.log('[Hypothesis A1] Leaked to Repo B input:', leakedToB, 'value:', inputB?.value);
  console.log('[Hypothesis A1] Answer row mounted open on Repo B:', rowMountedOnB);

  assert.equal(
    inputB?.value,
    'Distinctive draft for Repo A',
    'PROOF OF BUG: Issue B #1 populated with draft typed on Issue A #1 due to missing repo qualification in cache key'
  );

  // 3. User on Repo B clicks "Cancel" (clearing their draft)
  const btnCancelB = drawerContainer.querySelector('.btn-cancel-inline-answer');
  assert.ok(btnCancelB, 'Cancel button should exist on Issue B');
  btnCancelB.click();

  // 4. Return to Issue A in Drawer
  app.setState({ currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);

  const inputAReturned = drawerContainer.querySelector('.input-inline-answer');
  console.log('[Hypothesis A1] Issue A input value after Repo B cancelled:', inputAReturned?.value);

  assert.equal(
    inputAReturned?.value || '',
    '',
    'PROOF OF BUG: Issue A draft was deleted when Issue B cancelled/cleared'
  );
});

test('Hypothesis A2: Cross-repo draft leakage with DIFFERENT question text via issue::number fallback', async () => {
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

  // Type draft on Repo A Issue 2
  app.setState({ issues: [issueA, issueB], currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  drawerContainer.querySelector('.btn-inline-answer').click();

  const inputA = drawerContainer.querySelector('.input-inline-answer');
  inputA.value = 'Secret answer for Repo A';
  inputA.dispatchEvent({ type: 'input', target: inputA });

  // Open Issue B in Drawer (different repo, same number, DIFFERENT question text)
  app.setState({ currentRepo: 'owner/repo-b' });
  app.openDrawer(issueB);

  const inputB = drawerContainer.querySelector('.input-inline-answer');
  console.log('[Hypothesis A2] Issue B different question prefilled value:', inputB?.value);

  assert.equal(
    inputB?.value,
    'Secret answer for Repo A',
    'PROOF OF BUG: Issue B Question Beta prefilled with Issue A Question Alpha draft via issue::2 fallback'
  );
});

test('Hypothesis B1: Single issue with unrelated Q1 and Q2 (issue fallback leakage)', async () => {
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

  // Now, what happens if drawer is re-rendered or Q2 is rendered?
  app.openDrawer(multiQuestionIssue);

  const itemsAfter = drawerContainer.querySelectorAll('.check-item');
  const q2Row = itemsAfter[1].querySelector('.inline-answer-row');
  const q2Input = itemsAfter[1].querySelector('.input-inline-answer');

  console.log('[Hypothesis B1] Q2 input value:', q2Input?.value);
  console.log('[Hypothesis B1] Q2 row display style:', q2Row?.style?.display);

  assert.equal(
    q2Input?.value,
    'Postgres 16',
    'PROOF OF BUG: Q2 ("What is the launch date?") prefilled with Q1 draft ("Postgres 16") via issue::10 fallback'
  );

  // Now user cancels on Q2
  const q2Cancel = itemsAfter[1].querySelector('.btn-cancel-inline-answer');
  q2Cancel.click();

  // Now suppose Q1 is modified remotely
  const modifiedBody = [
    '### Open Questions:',
    '- [ ] Q1: Which database engine (Postgres vs MySQL)?',
    '- [ ] Q2: What is the launch date?',
  ].join('\n');
  multiQuestionIssue.body = modifiedBody;
  multiQuestionIssue.openQuestions = [
    { text: 'Q1: Which database engine (Postgres vs MySQL)?', completed: false, lineIndex: 1 },
    { text: 'Q2: What is the launch date?', completed: false, lineIndex: 2 },
  ];

  app.openDrawer(multiQuestionIssue);
  const itemsAfterMod = drawerContainer.querySelectorAll('.check-item');
  const q1ModInput = itemsAfterMod[0].querySelector('.input-inline-answer');

  console.log('[Hypothesis B1] Q1 modified input value after Q2 cancelled fallback:', q1ModInput?.value);
  assert.equal(
    q1ModInput?.value || '',
    '',
    'PROOF OF BUG: Q1 modified question lost its draft because Q2 cancel cleared issue::10 fallback'
  );
});

test('Hypothesis B2: Q2 success clearing Q1 fallback while retaining stale exact entry', async () => {
  const issue = {
    number: 11,
    title: 'Issue 11',
    repo: 'owner/repo-main',
    body: [
      '### Open Questions:',
      '- [ ] Q1: Architecture choice?',
      '- [ ] Q2: Budget allocation?',
    ].join('\n'),
    labels: [],
    subtasks: [],
    openQuestions: [
      { text: 'Q1: Architecture choice?', completed: false, lineIndex: 1 },
      { text: 'Q2: Budget allocation?', completed: false, lineIndex: 2 },
    ],
  };

  let patchCompleted = false;
  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 11, body: issue.body, updated_at: '2026-10-24T12:00:00Z' }) };
      }
      if (req.method === 'PATCH') {
        patchCompleted = true;
        return { status: 200, body: JSON.stringify({ number: 11, updated_at: '2026-10-24T12:00:01Z' }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [issue], currentRepo: 'owner/repo-main' });
  app.openDrawer(issue);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  const items = drawerContainer.querySelectorAll('.check-item');

  // Type draft for Q1
  items[0].querySelector('.btn-inline-answer').click();
  const q1Input = items[0].querySelector('.input-inline-answer');
  q1Input.value = 'Microservices';
  q1Input.dispatchEvent({ type: 'input', target: q1Input });

  // Answer Q2
  items[1].querySelector('.btn-inline-answer').click();
  const q2Input = items[1].querySelector('.input-inline-answer');
  q2Input.value = '$10k';
  const q2Save = items[1].querySelector('.btn-submit-inline-answer');
  q2Save.click();

  // Poll until success toast arrives
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question')) break;
  }

  assert.ok(patchCompleted, 'PATCH for Q2 must succeed');

  const issueAfter = {
    ...issue,
    body: [
      '### Open Questions:',
      '- [ ] Q1: Architecture choice (revised)?',
      '- [x] Q2: Budget allocation? *(Answer: $10k)*',
    ].join('\n'),
    openQuestions: [
      { text: 'Q1: Architecture choice (revised)?', completed: false, lineIndex: 1 },
      { text: 'Q2: Budget allocation?', completed: true, lineIndex: 2 },
    ],
  };

  app.openDrawer(issueAfter);
  const itemsRevised = drawerContainer.querySelectorAll('.check-item');
  const q1RevInput = itemsRevised[0].querySelector('.input-inline-answer');
  console.log('[Hypothesis B2] q1RevInput value after settled PATCH:', q1RevInput?.value);

  assert.equal(
    q1RevInput?.value || '',
    '',
    'PROOF OF BUG: Answering Q2 wiped issue::11 fallback, so Q1 draft is lost when Q1 is revised'
  );
});

test('Hypothesis C: Changed / disappeared original question & orphan draft behavior', async () => {
  const issue = {
    number: 20,
    title: 'Issue 20',
    repo: 'owner/repo-main',
    body: '### Open Questions:\n- [ ] What is the timeout threshold?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'What is the timeout threshold?', completed: false, lineIndex: 1 }],
  };

  // Case 1: Question text changed remotely, refusal occurs
  const changedBody = '### Open Questions:\n- [ ] What is the retry interval?';
  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 20, body: changedBody, updated_at: '2026-10-24T12:00:00Z' }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [issue], currentRepo: 'owner/repo-main', isManualRepoOverride: true });
  app.renderQuestionsView([issue]);

  const qvContainer = elements.get('questionsViewContainer');
  qvContainer.querySelector('.btn-inline-answer').click();
  const input = qvContainer.querySelector('.input-inline-answer');
  input.value = '30 seconds';
  qvContainer.querySelector('.btn-submit-inline-answer').click();

  // Gate on arrival of refusal toast
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'toast' && c.payload?.kind === 'error')) break;
  }

  const restoredInput = qvContainer.querySelector('.input-inline-answer');
  const restoredQuestionText = qvContainer.querySelector('.question-view-text');

  console.log('[Hypothesis C] Question displayed innerHTML:', restoredQuestionText?.innerHTML);
  console.log('[Hypothesis C] Input value:', restoredInput?.value);

  // 1. Is there any orphan indicator in the DOM?
  const html = qvContainer.innerHTML;
  const hasOrphanIndicator = html.includes('orphan') || html.includes('previous question') || html.includes('draft from');
  console.log('[Hypothesis C] Has orphan indicator:', hasOrphanIndicator);

  assert.equal(hasOrphanIndicator, false, 'Current behavior: No orphan draft indicator or identification exists');
  assert.ok(
    restoredQuestionText?.innerHTML?.includes('What is the retry interval?'),
    'Current behavior: The new question is displayed'
  );
  assert.equal(
    restoredInput?.value,
    '30 seconds',
    'Current behavior: The answer typed for "timeout threshold" is silently pre-filled into "retry interval"'
  );

  // Case 2: What if ALL questions were deleted remotely?
  const zeroQuestionsBody = '### Open Questions:\n(No questions)';
  const { app: appZero, elements: elementsZero } = createTestApp({
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

  appZero.setState({ issues: [issueZero], currentRepo: 'owner/repo-main', isManualRepoOverride: true });
  appZero.renderQuestionsView([issueZero]);

  const qvContainerZero = elementsZero.get('questionsViewContainer');
  qvContainerZero.querySelector('.btn-inline-answer').click();
  const inputZero = qvContainerZero.querySelector('.input-inline-answer');
  inputZero.value = 'Answer for deleted question';
  qvContainerZero.querySelector('.btn-submit-inline-answer').click();

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (qvContainerZero.querySelector('.empty-box')) break;
  }

  const zeroHtml = qvContainerZero.innerHTML;
  console.log('[Hypothesis C - zero questions] Container shows empty-box:', zeroHtml.includes('empty-box'));
  console.log('[Hypothesis C - zero questions] Does draft appear anywhere in DOM:', zeroHtml.includes('Answer for deleted question'));

  assert.ok(zeroHtml.includes('empty-box'), 'When questions are deleted, container shows empty-box');
  assert.equal(
    zeroHtml.includes('Answer for deleted question'),
    false,
    'Current behavior: When question disappears completely, draft is silently trapped in memory and nowhere in DOM'
  );
});

test('Hypothesis D: Side effects of userLayoutPreference assignments in renderHumanTasksView/renderQuestionsView', async () => {
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

  // 1. Initial renderViews
  app.renderViews();
  const initialLayoutAttr = global.document.body.getAttribute('data-layout');
  console.log('[Hypothesis D] Initial data-layout:', initialLayoutAttr);

  // 2. Call renderQuestionsView directly (e.g. from another module or test)
  app.renderQuestionsView([mockIssue]);
  const layoutAfterQuestionsView = global.document.body.getAttribute('data-layout');
  console.log('[Hypothesis D] data-layout after renderQuestionsView:', layoutAfterQuestionsView);

  assert.equal(
    layoutAfterQuestionsView,
    'questions',
    'renderQuestionsView forced document.body data-layout to "questions"'
  );

  // 3. Now call renderViews() without user switching layout
  app.renderViews();
  const layoutAfterRenderViews = global.document.body.getAttribute('data-layout');
  console.log('[Hypothesis D] data-layout after subsequent renderViews():', layoutAfterRenderViews);

  assert.equal(
    layoutAfterRenderViews,
    'questions',
    'PROOF OF SIDE EFFECT: Direct call to renderQuestionsView permanently shifted user layout to "questions"'
  );

  // 4. Test renderHumanTasksView side effect
  app.renderHumanTasksView([mockIssue]);
  const layoutAfterHuman = global.document.body.getAttribute('data-layout');
  console.log('[Hypothesis D] data-layout after renderHumanTasksView:', layoutAfterHuman);

  assert.equal(
    layoutAfterHuman,
    'human',
    'renderHumanTasksView forced document.body data-layout to "human"'
  );

  app.renderViews();
  assert.equal(
    global.document.body.getAttribute('data-layout'),
    'human',
    'PROOF OF SIDE EFFECT: Direct call to renderHumanTasksView permanently shifted user layout to "human"'
  );
});
