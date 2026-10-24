import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOptimisticQuestionAnswer } from '../panel/core.ts';
import { createTestApp } from './test-app-harness.js';

test('Path (a) reproduction: wrong-question fallback in resolveOptimisticQuestionAnswer', () => {
  const body = [
    '### Open Questions:',
    '- [x] Has the database schema been approved?',
    '- [ ] Which cache backend should we use?',
  ].join('\n');

  // Attempting to answer Question 1 which was marked completed
  const result = resolveOptimisticQuestionAnswer(body, 'Has the database schema been approved?', 'No');

  // Expected: Question 1 is already completed, so found must be false and Question 2 must NOT be modified
  assert.equal(result.found, false, 'Must not claim found for completed question fallback');
  assert.equal(result.updatedBody, body, 'Must not modify another question on fallback');
  assert.ok(!result.updatedBody.includes('Which cache backend should we use? *(Answer: No)*'), 'Question 2 must not be answered');
});

test('Path (b) reproduction: Questions view must not show success toast without result.found', async () => {
  const mockIssue = {
    number: 101,
    title: 'Test Issue 101',
    repo: 'test-owner/test-repo',
    body: '### Open Questions:\n- [ ] Initial question?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Initial question?', completed: false, lineIndex: 1 }],
  };

  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        // Remotely the question was changed / removed
        return {
          status: 200,
          body: JSON.stringify({
            number: 101,
            body: '### Open Questions:\n- [ ] Completely different question remotely?',
            updated_at: '2026-10-24T12:00:00Z',
          }),
        };
      }
      if (req.method === 'PATCH') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 101,
            body: '### Open Questions:\n- [ ] Completely different question remotely?',
          }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  app.renderQuestionsView([mockIssue]);

  const container = elements.get('questionsViewContainer');
  const btnAnswer = container.querySelector('.btn-inline-answer');
  assert.ok(btnAnswer, 'btnAnswer should exist in Questions view');
  btnAnswer.click();

  const answerInput = container.querySelector('.input-inline-answer');
  const btnSave = container.querySelector('.btn-submit-inline-answer');
  assert.ok(answerInput, 'answer input should exist');
  assert.ok(btnSave, 'save button should exist');

  answerInput.value = 'My Answer';
  btnSave.click();

  // Poll until toast or PATCH occurs or timeout
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question')) {
      break;
    }
  }

  const successToasts = hostCalls.filter(
    (c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question'
  );
  assert.equal(successToasts.length, 0, 'Must not show success toast when question was not found in fresh body');
});

test('Path (b) reproduction: Drawer must not show success toast without result.found', async () => {
  const mockIssue = {
    number: 102,
    title: 'Test Issue 102',
    repo: 'test-owner/test-repo',
    body: '### Open Questions:\n- [ ] Drawer question?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Drawer question?', completed: false, lineIndex: 1 }],
  };

  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        // Remotely the question was changed / removed
        return {
          status: 200,
          body: JSON.stringify({
            number: 102,
            body: '### Open Questions:\n- [ ] Remotely changed drawer question?',
            updated_at: '2026-10-24T12:00:00Z',
          }),
        };
      }
      if (req.method === 'PATCH') {
        return {
          status: 200,
          body: JSON.stringify({ number: 102 }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  app.openDrawer(mockIssue);

  const container = elements.get('drawerQuestionsContainer');
  const btnAnswer = container.querySelector('.btn-inline-answer');
  assert.ok(btnAnswer, 'btnAnswer should exist in Drawer questions');
  btnAnswer.click();

  const answerInput = container.querySelector('.input-inline-answer');
  const btnSave = container.querySelector('.btn-submit-inline-answer');
  assert.ok(answerInput, 'answer input should exist in Drawer');
  assert.ok(btnSave, 'save button should exist in Drawer');

  answerInput.value = 'My Drawer Answer';
  btnSave.click();

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question')) {
      break;
    }
  }

  const successToasts = hostCalls.filter(
    (c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question'
  );
  assert.equal(successToasts.length, 0, 'Must not show success toast when question was not found in fresh body');
});

test('Path (c) reproduction: failed fresh read continuing on cached body', async () => {
  const mockIssue = {
    number: 103,
    title: 'Test Issue 103',
    repo: 'test-owner/test-repo',
    body: '### Open Questions:\n- [ ] Cached question?',
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Cached question?', completed: false, lineIndex: 1 }],
  };

  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        // Failed fresh reload: simulate server 500 error
        return {
          status: 500,
          body: JSON.stringify({ message: 'Internal Server Error' }),
        };
      }
      if (req.method === 'PATCH') {
        return {
          status: 200,
          body: JSON.stringify({ number: 103 }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  app.renderQuestionsView([mockIssue]);

  const container = elements.get('questionsViewContainer');
  const btnAnswer = container.querySelector('.btn-inline-answer');
  btnAnswer.click();

  const answerInput = container.querySelector('.input-inline-answer');
  const btnSave = container.querySelector('.btn-submit-inline-answer');
  answerInput.value = 'My Answer';
  btnSave.click();

  // Poll until PATCH occurs or wait finishes
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'request' && c.payload?.method === 'PATCH')) {
      break;
    }
  }

  const patchRequests = hostCalls.filter(
    (c) => c.type === 'request' && c.payload?.method === 'PATCH'
  );
  assert.equal(patchRequests.length, 0, 'Must abort write and never send PATCH if fresh read failed');
});

test('Path (d) reproduction: failed PATCH keeping the new local body', async () => {
  const originalBody = '### Open Questions:\n- [ ] Question to fail PATCH?\nOriginal cached body';
  const mockIssue = {
    number: 104,
    title: 'Test Issue 104',
    repo: 'test-owner/test-repo',
    body: originalBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question to fail PATCH?', completed: false, lineIndex: 1 }],
  };

  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 104,
            body: originalBody,
            updated_at: '2026-10-24T12:00:00Z',
          }),
        };
      }
      if (req.method === 'PATCH') {
        // Explicit HTTP rejection from GitHub
        return {
          status: 500,
          body: JSON.stringify({ message: 'GitHub write error' }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  app.renderQuestionsView([mockIssue]);

  const container = elements.get('questionsViewContainer');
  const btnAnswer = container.querySelector('.btn-inline-answer');
  btnAnswer.click();

  const answerInput = container.querySelector('.input-inline-answer');
  const btnSave = container.querySelector('.btn-submit-inline-answer');
  answerInput.value = 'Failed answer';
  btnSave.click();

  // Poll until PATCH failure is processed
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'toast' && c.payload?.kind === 'error')) {
      break;
    }
  }

  // The local issue body must be restored to originalBody, NOT kept as the modified body
  assert.equal(mockIssue.body, originalBody, 'Failed PATCH must restore previous issue body');
});

test('Decision D3: changed question refuses answer and shows new text', async () => {
  const initialBody = '### Open Questions:\n- [ ] Should we use SQLite or Postgres?';
  const remoteChangedBody = '### Open Questions:\n- [ ] Which cloud region should we deploy to?';
  const mockIssue = {
    number: 105,
    title: 'Test Issue 105',
    repo: 'test-owner/test-repo',
    body: initialBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Should we use SQLite or Postgres?', completed: false, lineIndex: 1 }],
  };

  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 105,
            body: remoteChangedBody,
            updated_at: '2026-10-24T12:05:00Z',
          }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'Should we use SQLite or Postgres?', 'Postgres');
  assert.equal(ok, false, 'Must refuse to answer changed question');

  // Verify toast alerted about changed question with new text
  const errorToast = hostCalls.find(
    (c) => c.type === 'toast' && c.payload?.kind === 'error' && c.payload?.message?.includes('Which cloud region should we deploy to?')
  );
  assert.ok(errorToast, 'Toast must report the changed question with current text (D3)');

  // Verify no PATCH was sent
  const patchCalls = hostCalls.filter((c) => c.type === 'request' && c.payload?.method === 'PATCH');
  assert.equal(patchCalls.length, 0, 'No PATCH must be sent when question changed');
});

test('Already-answered question refuses write and does not overwrite', async () => {
  const initialBody = '### Open Questions:\n- [ ] Database choice?';
  const remoteAnsweredBody = '### Open Questions:\n- [x] Database choice? *(Answer: PostgreSQL)*';
  const mockIssue = {
    number: 106,
    title: 'Test Issue 106',
    repo: 'test-owner/test-repo',
    body: initialBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Database choice?', completed: false, lineIndex: 1 }],
  };

  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 106,
            body: remoteAnsweredBody,
            updated_at: '2026-10-24T12:06:00Z',
          }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'Database choice?', 'MySQL');
  assert.equal(ok, false, 'Must refuse to overwrite already-answered question');

  const errorToast = hostCalls.find(
    (c) => c.type === 'toast' && c.payload?.kind === 'error' && c.payload?.message?.includes('already answered')
  );
  assert.ok(errorToast, 'Toast must report question was already answered');

  const patchCalls = hostCalls.filter((c) => c.type === 'request' && c.payload?.method === 'PATCH');
  assert.equal(patchCalls.length, 0, 'Must not send PATCH for already-answered question');
});

test('Ambiguous duplicate unresolved questions refuse write rather than guess', async () => {
  const bodyWithDuplicates = [
    '### Open Questions:',
    '- [ ] What is the deadline?',
    '- [ ] What is the deadline?',
  ].join('\n');

  const mockIssue = {
    number: 107,
    title: 'Test Issue 107',
    repo: 'test-owner/test-repo',
    body: bodyWithDuplicates,
    labels: [],
    subtasks: [],
    openQuestions: [
      { text: 'What is the deadline?', completed: false, lineIndex: 1 },
      { text: 'What is the deadline?', completed: false, lineIndex: 2 },
    ],
  };

  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 107,
            body: bodyWithDuplicates,
            updated_at: '2026-10-24T12:07:00Z',
          }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'What is the deadline?', 'Tomorrow');
  assert.equal(ok, false, 'Must refuse ambiguity when multiple identical questions exist');

  const errorToast = hostCalls.find(
    (c) => c.type === 'toast' && c.payload?.kind === 'error' && c.payload?.message?.includes('identical open questions')
  );
  assert.ok(errorToast, 'Toast must report ambiguity error');
});

test('Exact identity compares Markdown link destinations and case without stripping', async () => {
  const bodyWithLinks = '### Open Questions:\n- [ ] Should we adopt [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)?';
  const mockIssue = {
    number: 108,
    title: 'Test Issue 108',
    repo: 'test-owner/test-repo',
    body: bodyWithLinks,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Should we adopt [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)?', completed: false, lineIndex: 1 }],
  };

  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 108,
            body: bodyWithLinks,
            updated_at: '2026-10-24T12:08:00Z',
          }),
        };
      }
      if (req.method === 'PATCH') {
        return {
          status: 200,
          body: JSON.stringify({ number: 108, updated_at: '2026-10-24T12:08:05Z' }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });

  // 1. Stripped link text must fail
  const strippedFail = await app.answerQuestion(mockIssue, 'Should we adopt RFC 9110?', 'Yes');
  assert.equal(strippedFail, false, 'Must refuse match on stripped link text');

  // 2. Exact source text including Markdown link destination succeeds
  const exactPass = await app.answerQuestion(
    mockIssue,
    'Should we adopt [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)?',
    'Yes, approved'
  );
  assert.equal(exactPass, true, 'Must succeed when matching exact source text with link');
  assert.ok(mockIssue.body.includes('- [x] Should we adopt [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)? *(Answer: Yes, approved)*'));
});

test('Ambiguous write outcome (network error after send) reports outcome unknown and never auto-repeats', async () => {
  const originalBody = '### Open Questions:\n- [ ] Network test question?';
  const mockIssue = {
    number: 109,
    title: 'Test Issue 109',
    repo: 'test-owner/test-repo',
    body: originalBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Network test question?', completed: false, lineIndex: 1 }],
  };

  let patchAttempts = 0;
  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 109,
            body: originalBody,
            updated_at: '2026-10-24T12:09:00Z',
          }),
        };
      }
      if (req.method === 'PATCH') {
        patchAttempts++;
        // Simulate transport loss / network drop after sending
        throw new Error('TypeError: fetch failed');
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'Network test question?', 'Answered');
  assert.equal(ok, false, 'Must return false on ambiguous transport failure');

  // Toast must explicitly state: "outcome unknown — check the issue on GitHub"
  const unknownToast = hostCalls.find(
    (c) => c.type === 'toast' && c.payload?.message?.includes('outcome unknown — check the issue on GitHub')
  );
  assert.ok(unknownToast, 'Must report "outcome unknown — check the issue on GitHub"');

  // No automatic repeat: exactly 1 attempt made
  assert.equal(patchAttempts, 1, 'Must never repeat automatically after ambiguous network outcome');

  // Optimistic answer must be reconciled/restored, not displayed as confirmed
  assert.equal(mockIssue.body, originalBody, 'Optimistic answer must be reconciled, not shown as confirmed');
});

test('Human Tasks entry point shares answer path and executes clean write-back', async () => {
  const body = '### Open Questions:\n- [ ] Human task question?';
  const mockIssue = {
    number: 110,
    title: 'Test Issue 110',
    repo: 'test-owner/test-repo',
    body,
    labels: [{ name: 'status:needs-human' }],
    status: 'needs-human',
    subtasks: [],
    openQuestions: [{ text: 'Human task question?', completed: false, lineIndex: 1 }],
    humanTasks: [],
  };

  let receivedPatchBody = '';
  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 110,
            body,
            updated_at: '2026-10-24T12:10:00Z',
          }),
        };
      }
      if (req.method === 'PATCH') {
        receivedPatchBody = JSON.parse(req.body).body;
        return {
          status: 200,
          body: JSON.stringify({ number: 110, updated_at: '2026-10-24T12:10:05Z' }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  app.renderHumanTasksView([mockIssue]);

  const container = elements.get('humanViewContainer');
  const btnAnswer = container.querySelector('.btn-answer-action');
  assert.ok(btnAnswer, 'btnAnswer must exist in Human Tasks view');
  btnAnswer.click();

  const answerInput = container.querySelector('.input-human-answer');
  const btnSave = container.querySelector('.btn-submit-human-answer');
  assert.ok(answerInput, 'input must exist in Human Tasks');
  assert.ok(btnSave, 'save button must exist in Human Tasks');

  answerInput.value = 'Human Decision';
  btnSave.click();

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (hostCalls.some((c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question')) {
      break;
    }
  }

  const successToasts = hostCalls.filter(
    (c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question'
  );
  assert.equal(successToasts.length, 1, 'Must show success toast on successful answer via Human Tasks');
  assert.ok(receivedPatchBody.includes('- [x] Human task question? *(Answer: Human Decision)*'));
});

test('Answering a question preserves workflow phase and does not close issue (#36 guards intact)', async () => {
  const body = '### Open Questions:\n- [ ] Planning question?';
  const mockIssue = {
    number: 111,
    title: 'Test Issue 111',
    repo: 'test-owner/test-repo',
    body,
    labels: [{ name: 'phase:planning' }, { name: 'status:in-progress' }],
    status: 'in-progress',
    subtasks: [],
    openQuestions: [{ text: 'Planning question?', completed: false, lineIndex: 1 }],
  };

  let patchSentLabels = null;
  const { app } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({
            number: 111,
            body,
            updated_at: '2026-10-24T12:11:00Z',
          }),
        };
      }
      if (req.method === 'PATCH') {
        const parsed = JSON.parse(req.body);
        patchSentLabels = parsed.labels;
        return {
          status: 200,
          body: JSON.stringify({ number: 111, updated_at: '2026-10-24T12:11:05Z' }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'Planning question?', 'Planning resolved');
  assert.equal(ok, true);

  // Status and phase must be unaltered
  assert.equal(mockIssue.status, 'in-progress');
  assert.equal(patchSentLabels, undefined, 'Answering must only patch body, never alter labels or status');
});
