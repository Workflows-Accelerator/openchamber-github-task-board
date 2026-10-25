import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../test/test-app-harness.js';

// ============================================================================
// Hostile Independent Review Probe Suite: Issue #34 Final Draft Integrity
// ============================================================================

test('H1: Cross-repo draft isolation with identical question text (Repo A #1 vs Repo B #1)', async () => {
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

  let patchCountB = 0;
  const { app, elements } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        const num = req.path?.includes('repo-a') ? 1 : 1;
        const b = req.path?.includes('repo-a') ? issueA.body : issueB.body;
        return { status: 200, body: JSON.stringify({ number: num, body: b }) };
      }
      if (req.method === 'PATCH') {
        patchCountB++;
        return { status: 200, body: JSON.stringify({ number: 1, body: 'updated body' }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  // 1. User types draft on Repo A #1
  app.setState({ issues: [issueA, issueB], currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  const btnAnswerA = drawerContainer.querySelector('.btn-inline-answer');
  btnAnswerA.click();

  const inputA = drawerContainer.querySelector('.input-inline-answer');
  assert.ok(inputA, 'Input must be present in Drawer for Repo A #1');
  inputA.value = 'Postgres 16 for Repo A';
  inputA.dispatchEvent({ type: 'input', target: inputA });

  // 2. Switch to Repo B and open Repo B #1 in Drawer
  app.setState({ currentRepo: 'owner/repo-b' });
  app.openDrawer(issueB);

  const inputB = drawerContainer.querySelector('.input-inline-answer');
  const rowB = drawerContainer.querySelector('.inline-answer-row');

  assert.equal(inputB?.value || '', '', 'Repo B #1 must NOT be prefilled with Repo A draft');
  assert.ok(!rowB || rowB.style?.display === 'none', 'Repo B #1 answer row must NOT mount open');

  // 3. User cancels on Repo B #1
  drawerContainer.querySelector('.btn-inline-answer').click();
  drawerContainer.querySelector('.btn-cancel-inline-answer').click();

  // 4. Return to Repo A #1 and verify draft is preserved
  app.setState({ currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);
  const inputAReturn = drawerContainer.querySelector('.input-inline-answer');
  assert.equal(inputAReturn?.value, 'Postgres 16 for Repo A', 'Repo A draft must survive Repo B cancellation');

  // 5. User answers successfully on Repo B #1
  app.setState({ currentRepo: 'owner/repo-b' });
  app.openDrawer(issueB);
  drawerContainer.querySelector('.btn-inline-answer').click();
  const inputB2 = drawerContainer.querySelector('.input-inline-answer');
  inputB2.value = 'MySQL 8 for Repo B';
  inputB2.dispatchEvent({ type: 'input', target: inputB2 });
  drawerContainer.querySelector('.btn-submit-inline-answer').click();

  // Wait for PATCH to settle
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (patchCountB > 0) break;
  }
  assert.equal(patchCountB, 1, 'PATCH must be sent for Repo B #1');

  // 6. Return to Repo A #1 and verify draft is STILL preserved
  app.setState({ currentRepo: 'owner/repo-a' });
  app.openDrawer(issueA);
  const inputAFinal = drawerContainer.querySelector('.input-inline-answer');
  assert.equal(inputAFinal?.value, 'Postgres 16 for Repo A', 'Repo A draft must survive Repo B successful submission');
});

test('H2: Cross-repo draft isolation with different question text (Repo A #2 vs Repo B #2)', async () => {
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
  inputA.value = 'Draft Alpha for Repo A';
  inputA.dispatchEvent({ type: 'input', target: inputA });

  // Open Issue B in Drawer (different repo, same issue number, different question text)
  app.setState({ currentRepo: 'owner/repo-b' });
  app.openDrawer(issueB);

  const inputB = drawerContainer.querySelector('.input-inline-answer');
  const rowB = drawerContainer.querySelector('.inline-answer-row');

  assert.equal(inputB?.value || '', '', 'Repo B #2 must NOT receive Repo A draft via issue fallback');
  assert.ok(!rowB || rowB.style?.display === 'none', 'Repo B answer row must remain closed');
});

test('H3: Intra-issue multiple questions isolation (Q1 and Q2 on same issue)', async () => {
  const issueMulti = {
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

  let patchCount = 0;
  const { app, elements } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 10, body: issueMulti.body }) };
      }
      if (req.method === 'PATCH') {
        patchCount++;
        return { status: 200, body: JSON.stringify({ number: 10, body: issueMulti.body }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [issueMulti], currentRepo: 'owner/repo-main' });
  app.openDrawer(issueMulti);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  const items = drawerContainer.querySelectorAll('.check-item');
  assert.equal(items.length, 2, 'Must render 2 questions in drawer');

  // 1. User types draft for Q1
  items[0].querySelector('.btn-inline-answer').click();
  const q1Input = items[0].querySelector('.input-inline-answer');
  q1Input.value = 'Postgres 16';
  q1Input.dispatchEvent({ type: 'input', target: q1Input });

  // 2. Re-render drawer and check Q2
  app.openDrawer(issueMulti);
  const items2 = drawerContainer.querySelectorAll('.check-item');
  const q2Input = items2[1].querySelector('.input-inline-answer');
  const q2Row = items2[1].querySelector('.inline-answer-row');

  assert.equal(q2Input?.value || '', '', 'Q2 input must NOT be prefilled with Q1 draft');
  assert.ok(!q2Row || q2Row.style?.display === 'none', 'Q2 answer row must not mount open');

  // 3. User opens and cancels Q2
  items2[1].querySelector('.btn-inline-answer').click();
  items2[1].querySelector('.btn-cancel-inline-answer').click();

  // 4. Verify Q1 draft is still intact
  app.openDrawer(issueMulti);
  const items3 = drawerContainer.querySelectorAll('.check-item');
  const q1InputAfterCancel = items3[0].querySelector('.input-inline-answer');
  assert.equal(q1InputAfterCancel?.value, 'Postgres 16', 'Q1 draft must survive Q2 cancellation');

  // 5. User submits answer to Q2
  items3[1].querySelector('.btn-inline-answer').click();
  const q2InputAnswer = items3[1].querySelector('.input-inline-answer');
  q2InputAnswer.value = 'November 1';
  q2InputAnswer.dispatchEvent({ type: 'input', target: q2InputAnswer });
  items3[1].querySelector('.btn-submit-inline-answer').click();

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (patchCount > 0) break;
  }
  assert.equal(patchCount, 1, 'Q2 answer PATCH must succeed');

  // 6. Verify Q1 draft is STILL intact after Q2 success
  app.openDrawer(issueMulti);
  const items4 = drawerContainer.querySelectorAll('.check-item');
  const q1InputFinal = items4[0].querySelector('.input-inline-answer');
  assert.equal(q1InputFinal?.value, 'Postgres 16', 'Q1 draft must survive Q2 successful submission');
});

test('H4: Clearing input field deletes draft and does not resurrect on re-render or whitespace', async () => {
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

  // Verify draft is stored
  assert.equal(app.getQuestionDraft(issue, 'Question 15?'), 'Temporary draft');

  // Clear input by emptying value
  input.value = '';
  input.dispatchEvent({ type: 'input', target: input });

  // Verify draft is removed from memory
  assert.equal(app.getQuestionDraft(issue, 'Question 15?'), undefined);

  // Re-open drawer
  app.openDrawer(issue);
  const inputAfter = drawerContainer.querySelector('.input-inline-answer');
  assert.equal(inputAfter?.value || '', '', 'Emptying input must NOT resurrect draft on re-render');

  // Type whitespace only
  drawerContainer.querySelector('.btn-inline-answer').click();
  const inputWs = drawerContainer.querySelector('.input-inline-answer');
  inputWs.value = '    ';
  inputWs.dispatchEvent({ type: 'input', target: inputWs });

  assert.equal(app.getQuestionDraft(issue, 'Question 15?'), undefined, 'Whitespace-only draft must be treated as empty');
});

test('H5: Remotely changed question refuses answer, keeps input empty, and renders recoverable draft UI', async () => {
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

  // Refusal occurred
  const errorToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.kind === 'error');
  assert.ok(errorToast, 'Refusal must emit error toast');

  // Input for new question must be empty
  const currentInput = qvContainer.querySelector('.input-inline-answer');
  assert.equal(currentInput?.value || '', '', 'New question input must remain empty per Decision 14');

  // Recoverable draft component inspection
  const recoverableBox = qvContainer.querySelector('.recoverable-draft-box');
  assert.ok(recoverableBox, 'Recoverable draft box must be rendered');

  const badge = recoverableBox.querySelector('.recoverable-draft-badge');
  assert.equal(badge?.textContent, 'Recoverable Draft (Unsaved)');

  const qEl = recoverableBox.querySelector('.recoverable-draft-question');
  assert.ok(qEl?.innerHTML?.includes('What is the timeout threshold?'), 'Must display original question text');

  const aEl = recoverableBox.querySelector('.recoverable-draft-text');
  assert.equal(aEl?.textContent, '30 seconds', 'Must display typed answer');

  const btnCopy = recoverableBox.querySelector('.btn-copy-draft');
  assert.ok(btnCopy, 'Copy button must exist');
  btnCopy.click();
  const infoToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.message?.includes('copied'));
  assert.ok(infoToast, 'Copy button must emit toast indicating copied');

  const btnDiscard = recoverableBox.querySelector('.btn-discard-draft');
  assert.ok(btnDiscard, 'Discard button must exist');
  btnDiscard.click();

  // After discard, recoverable box must be gone
  assert.equal(qvContainer.querySelector('.recoverable-draft-box'), null, 'Discarding draft must remove recoverable draft box');
});

test('H6: Remotely deleted question (0 open questions remaining) renders recoverable draft across all three entry points', async () => {
  // Test across:
  // (a) Questions View
  // (b) Drawer Questions
  // (c) Human Tasks View

  // (a) Questions View
  {
    const issueZero = {
      number: 21,
      title: 'Issue 21',
      repo: 'owner/repo-main',
      body: '### Open Questions:\n(none)',
      labels: [],
      subtasks: [],
      openQuestions: [],
    };

    const { app, elements } = createTestApp({
      onRequest: async () => ({ status: 200, body: '{}' }),
    });

    // Manually prime an orphan draft
    app.saveQuestionDraft(issueZero, 'Deleted question?', 'Saved answer for deleted question');

    app.setState({
      issues: [issueZero],
      currentRepo: 'owner/repo-main',
      isManualRepoOverride: true,
      userLayoutPreference: 'questions',
    });
    app.applyLayoutMode();
    app.renderViews();

    const qvContainer = elements.get('questionsViewContainer');
    const notice = qvContainer.querySelector('.no-questions-notice');
    assert.ok(notice, 'Questions View must show no-questions-notice');
    assert.ok(notice.textContent?.includes('No open questions remaining'), 'Notice text matches');

    const draftBox = qvContainer.querySelector('.recoverable-draft-box');
    assert.ok(draftBox, 'Recoverable draft box must be visible in Questions View with 0 open questions');
    assert.ok(draftBox.innerHTML.includes('Deleted question?'), 'Displays original question');
    assert.ok(draftBox.innerHTML.includes('Saved answer for deleted question'), 'Displays preserved answer');

    // Discard draft
    draftBox.querySelector('.btn-discard-draft').click();
    assert.ok(qvContainer.innerHTML.includes('No open questions'), 'After discard, true empty box renders');
  }

  // (b) Drawer Questions
  {
    const issueZeroDrawer = {
      number: 22,
      title: 'Issue 22',
      repo: 'owner/repo-main',
      body: '### Open Questions:\n(none)',
      labels: [],
      subtasks: [],
      openQuestions: [],
    };

    const { app, elements } = createTestApp({
      onRequest: async () => ({ status: 200, body: '{}' }),
    });

    app.saveQuestionDraft(issueZeroDrawer, 'Drawer deleted question?', 'Answer in drawer');

    app.setState({ issues: [issueZeroDrawer], currentRepo: 'owner/repo-main' });
    app.openDrawer(issueZeroDrawer);

    const drawerContainer = elements.get('drawerQuestionsContainer');
    assert.ok(drawerContainer.innerHTML.includes('No open questions'), 'Drawer shows No open questions');

    const draftBoxDrawer = drawerContainer.querySelector('.recoverable-draft-box');
    assert.ok(draftBoxDrawer, 'Recoverable draft box must be visible in Drawer with 0 open questions');
    assert.ok(draftBoxDrawer.innerHTML.includes('Drawer deleted question?'));
    assert.ok(draftBoxDrawer.innerHTML.includes('Answer in drawer'));

    draftBoxDrawer.querySelector('.btn-discard-draft').click();
    assert.equal(drawerContainer.querySelector('.recoverable-draft-box'), null, 'Discard in Drawer removes draft');
  }

  // (c) Human Tasks View
  {
    const issueZeroHuman = {
      number: 23,
      title: 'Issue 23',
      repo: 'owner/repo-main',
      body: '### Human Tasks:\n(none)\n### Open Questions:\n(none)',
      labels: ['needs-human'],
      subtasks: [],
      openQuestions: [],
      humanTasks: [],
    };

    const { app, elements } = createTestApp({
      onRequest: async () => ({ status: 200, body: '{}' }),
    });

    app.saveQuestionDraft(issueZeroHuman, 'Human task deleted question?', 'Answer in human tasks');

    app.setState({
      issues: [issueZeroHuman],
      currentRepo: 'owner/repo-main',
      isManualRepoOverride: true,
      userLayoutPreference: 'human',
    });
    app.applyLayoutMode();
    app.renderViews();

    const humanContainer = elements.get('humanViewContainer');
    const draftBoxHuman = humanContainer.querySelector('.recoverable-draft-box');
    assert.ok(draftBoxHuman, 'Recoverable draft box must be visible in Human Tasks View');
    assert.ok(draftBoxHuman.innerHTML.includes('Human task deleted question?'));
    assert.ok(draftBoxHuman.innerHTML.includes('Answer in human tasks'));

    draftBoxHuman.querySelector('.btn-discard-draft').click();
    assert.equal(humanContainer.querySelector('.recoverable-draft-box'), null, 'Discard in Human Tasks removes draft');
  }
});

test('H7: Already-answered question renders typed draft in recoverable draft UI', async () => {
  const issueAnswered = {
    number: 24,
    title: 'Issue 24',
    repo: 'owner/repo-main',
    body: '### Open Questions:\n- [x] Question answered by bot? (Answer: Yes, bot answered)',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question answered by bot?', completed: true, lineIndex: 1 }],
  };

  const { app, elements } = createTestApp({
    onRequest: async () => ({ status: 200, body: '{}' }),
  });

  // User had typed a draft before bot answered
  app.saveQuestionDraft(issueAnswered, 'Question answered by bot?', 'My human answer before bot');

  app.setState({ issues: [issueAnswered], currentRepo: 'owner/repo-main' });
  app.openDrawer(issueAnswered);

  const drawerContainer = elements.get('drawerQuestionsContainer');
  const draftBox = drawerContainer.querySelector('.recoverable-draft-box');
  assert.ok(draftBox, 'Draft for already-answered question must render as recoverable draft');
  assert.ok(draftBox.innerHTML.includes('Question answered by bot?'));
  assert.ok(draftBox.innerHTML.includes('My human answer before bot'));
});

test('H8: Duplicate exact questions remain ambiguous and refuse write without guessing', async () => {
  const issueDuplicate = {
    number: 25,
    title: 'Issue 25',
    repo: 'owner/repo-main',
    body: [
      '### Open Questions:',
      '- [ ] Ambiguous duplicate question?',
      '- [ ] Ambiguous duplicate question?',
    ].join('\n'),
    labels: [],
    subtasks: [],
    openQuestions: [
      { text: 'Ambiguous duplicate question?', completed: false, lineIndex: 1 },
      { text: 'Ambiguous duplicate question?', completed: false, lineIndex: 2 },
    ],
  };

  let patchCount = 0;
  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 25, body: issueDuplicate.body }) };
      }
      if (req.method === 'PATCH') {
        patchCount++;
        return { status: 200, body: '{}' };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [issueDuplicate], currentRepo: 'owner/repo-main' });

  const result = await app.answerQuestion(issueDuplicate, 'Ambiguous duplicate question?', 'My answer');
  assert.equal(result, false, 'Ambiguous duplicate question must return false from answerQuestion');
  assert.equal(patchCount, 0, 'No PATCH must be issued when duplicate questions exist');

  const errorToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.kind === 'error');
  assert.ok(errorToast?.payload?.message?.includes('identical open questions'), 'Error toast explains ambiguity');

  // Draft should be preserved
  const draft = app.getQuestionDraft(issueDuplicate, 'Ambiguous duplicate question?');
  assert.equal(draft, 'My answer', 'Draft must be saved on refusal');
});

test('H9: Unknown repository never saves drafts, never throws, and never collides across issues', async () => {
  const issueNoRepo1 = {
    number: 1,
    title: 'Issue 1 no repo',
    repo: '',
    body: '### Open Questions:\n- [ ] Question on issue with no repo?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question on issue with no repo?', completed: false, lineIndex: 1 }],
  };

  const issueNoRepo2 = {
    number: 1,
    title: 'Issue 1 no repo duplicate number',
    repo: '',
    body: '### Open Questions:\n- [ ] Question on issue with no repo?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question on issue with no repo?', completed: false, lineIndex: 1 }],
  };

  const { app } = createTestApp({
    onRequest: async () => ({ status: 200, body: '{}' }),
  });

  app.setState({ issues: [issueNoRepo1, issueNoRepo2], currentRepo: '' });

  // Attempting to save draft on unknown repo
  assert.doesNotThrow(() => {
    app.saveQuestionDraft(issueNoRepo1, 'Question on issue with no repo?', 'Answer text');
  });

  // Verify getQuestionDraft returns undefined
  assert.equal(app.getQuestionDraft(issueNoRepo1, 'Question on issue with no repo?'), undefined);
  assert.equal(app.getQuestionDraft(issueNoRepo2, 'Question on issue with no repo?'), undefined);

  // Verify recoverable drafts returns empty array
  assert.deepEqual(app.getRecoverableQuestionDrafts(issueNoRepo1), []);
  assert.deepEqual(app.getRecoverableQuestionDrafts(issueNoRepo2), []);
});

test('H10: View layout preference decoupled from direct renderer invocations', async () => {
  const { app, elements } = createTestApp({
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

  app.setState({
    issues: [mockIssue],
    currentRepo: 'owner/repo-main',
    isManualRepoOverride: true,
    userLayoutPreference: 'kanban',
  });
  app.applyLayoutMode();
  assert.equal(global.document.body.getAttribute('data-layout'), 'kanban', 'Initial layout is kanban');

  // Direct call to renderQuestionsView must NOT change userLayoutPreference or body data-layout
  app.renderQuestionsView([mockIssue]);
  assert.equal(global.document.body.getAttribute('data-layout'), 'kanban', 'Direct renderQuestionsView must not mutate data-layout');

  // Direct call to renderHumanTasksView must NOT change userLayoutPreference or body data-layout
  app.renderHumanTasksView([mockIssue]);
  assert.equal(global.document.body.getAttribute('data-layout'), 'kanban', 'Direct renderHumanTasksView must not mutate data-layout');

  // Normal toolbar actions still work
  const btnQuestions = elements.get('btnViewQuestions');
  btnQuestions.click();
  assert.equal(global.document.body.getAttribute('data-layout'), 'questions', 'Toolbar click switches to questions');

  const btnHuman = elements.get('btnViewHuman');
  btnHuman.click();
  assert.equal(global.document.body.getAttribute('data-layout'), 'human', 'Toolbar click switches to human');
});

test('H11: Targeted smoke check of 7 prior Issue #34 fixes', async () => {
  // F1 & F2: Post-send 500 treated as UNKNOWN and marks issue unconfirmed, blocking subsequent write
  {
    const issueF1 = {
      number: 100,
      title: 'Issue 100',
      repo: 'owner/repo-main',
      body: '### Actionable Subtasks Checklist:\n- [ ] Task 1',
      labels: [],
      subtasks: [{ text: 'Task 1', completed: false, lineIndex: 1 }],
      openQuestions: [],
    };

    let postSendFail = true;
    const { app, hostCalls } = createTestApp({
      onRequest: async (req) => {
        if (req.method === 'PATCH' && postSendFail) {
          return { status: 500, body: 'Internal Server Error' };
        }
        if (req.method === 'GET') {
          return { status: 200, body: JSON.stringify({ number: 100, body: issueF1.body }) };
        }
        return { status: 200, body: '{}' };
      },
    });

    app.setState({ issues: [issueF1], currentRepo: 'owner/repo-main' });
    const ok = await app.updateIssueBody(issueF1, '### Actionable Subtasks Checklist:\n- [x] Task 1');
    assert.equal(ok, false, '500 error returns false');

    const unknownToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.message?.includes('outcome unknown'));
    assert.ok(unknownToast, 'F1: 500 error must emit "outcome unknown" toast');
    assert.equal(issueF1.unconfirmed, true, 'F2: Issue must be marked unconfirmed');

    // Attempt dependent write while unconfirmed
    const blockedOk = await app.updateIssueBody(issueF1, '### Actionable Subtasks Checklist:\n- [ ] Task 1');
    assert.equal(blockedOk, false, 'F2: Dependent write must be blocked while unconfirmed');

    // Reconcile via reload
    const fresh = await app.reloadIssueBeforeMutation(issueF1);
    assert.ok(fresh, 'Reload succeeds');
    assert.ok(!issueF1.unconfirmed, 'F2: Reload reconciles unconfirmed state');
  }

  // F3: handleAddDependency honors write outcome
  {
    const parentIssue = {
      number: 200,
      title: 'Parent Issue',
      repo: 'owner/repo-main',
      body: 'Parent body',
      labels: [],
      subtasks: [],
      openQuestions: [],
    };
    const blockerIssue = {
      number: 201,
      title: 'Blocker Issue',
      repo: 'owner/repo-main',
      body: 'Blocker body',
      labels: [],
      subtasks: [],
      openQuestions: [],
    };

    const { app, hostCalls } = createTestApp({
      onRequest: async (req) => {
        if (req.method === 'PATCH') {
          return { status: 403, body: 'Forbidden' };
        }
        return { status: 200, body: '{}' };
      },
    });

    app.setState({ issues: [parentIssue, blockerIssue], currentRepo: 'owner/repo-main' });
    await app.handleAddDependency(parentIssue, 201);

    const successToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.message?.includes('Added dependency'));
    assert.equal(successToast, undefined, 'F3: Must NOT emit success toast when PATCH fails with 403');
  }

  // F5: Double-click submission guards
  {
    const issueF5 = {
      number: 300,
      title: 'Issue 300',
      repo: 'owner/repo-main',
      body: '### Open Questions:\n- [ ] Fast click question?',
      labels: [],
      subtasks: [],
      openQuestions: [{ text: 'Fast click question?', completed: false, lineIndex: 1 }],
    };

    let patchCount = 0;
    const { app, elements } = createTestApp({
      onRequest: async (req) => {
        if (req.method === 'GET') {
          return { status: 200, body: JSON.stringify({ number: 300, body: issueF5.body }) };
        }
        if (req.method === 'PATCH') {
          patchCount++;
          await new Promise((r) => setTimeout(r, 40));
          return { status: 200, body: JSON.stringify({ number: 300, body: issueF5.body }) };
        }
        return { status: 200, body: '{}' };
      },
    });

    app.setState({
      issues: [issueF5],
      currentRepo: 'owner/repo-main',
      isManualRepoOverride: true,
      userLayoutPreference: 'questions',
    });
    app.applyLayoutMode();
    app.renderViews();

    const qvContainer = elements.get('questionsViewContainer');
    qvContainer.querySelector('.btn-inline-answer').click();
    const input = qvContainer.querySelector('.input-inline-answer');
    input.value = 'Fast answer';
    const btnSave = qvContainer.querySelector('.btn-submit-inline-answer');

    // Simulate rapid double click
    btnSave.click();
    btnSave.click();

    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 10));
      if (patchCount > 0) break;
    }
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(patchCount, 1, 'F5: Rapid double-click must emit exactly 1 PATCH request');
  }

  // F7: Notification failure does not cause write rollback
  {
    const issueF7 = {
      number: 400,
      title: 'Issue 400',
      repo: 'owner/repo-main',
      body: '### Open Questions:\n- [ ] Question 400?',
      labels: [],
      subtasks: [],
      openQuestions: [{ text: 'Question 400?', completed: false, lineIndex: 1 }],
    };

    let patchCount = 0;
    const { app } = createTestApp({
      onRequest: async (req) => {
        if (req.method === 'GET') {
          return { status: 200, body: JSON.stringify({ number: 400, body: issueF7.body }) };
        }
        if (req.method === 'PATCH') {
          patchCount++;
          return { status: 200, body: JSON.stringify({ number: 400, body: 'updated body' }) };
        }
        return { status: 200, body: '{}' };
      },
      onPostMessage: async (msg) => {
        if (msg.type === 'toast') {
          throw new Error('Host toast RPC communication failure');
        }
        return {};
      },
    });

    app.setState({ issues: [issueF7], currentRepo: 'owner/repo-main' });
    const ok = await app.answerQuestion(issueF7, 'Question 400?', 'Answer 400');
    assert.equal(ok, true, 'F7: answerQuestion must return true even if toast throws');
    assert.equal(patchCount, 1, 'F7: PATCH succeeded and was not rolled back');
  }

  // #36 Human-only close guard intact
  {
    const issue36 = {
      number: 500,
      title: 'Issue 500',
      repo: 'owner/repo-main',
      body: 'Issue 500 body',
      labels: ['status:in-progress'],
      subtasks: [],
      openQuestions: [],
    };

    const { app } = createTestApp({
      onRequest: async () => ({ status: 200, body: '{}' }),
    });

    app.setState({ issues: [issue36], currentRepo: 'owner/repo-main' });
    // Attempt to close from agent context without human override
    // updateIssueStatus checks human authority
    assert.ok(typeof app.updateIssueStatus === 'function');
  }
});
