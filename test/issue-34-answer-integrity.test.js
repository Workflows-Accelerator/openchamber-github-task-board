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

test('Finding 1: Post-send 5xx/gateway/timeout/abort errors treated as UNKNOWN; 4xx pre-commit treated as definitive rejection', async () => {
  // 1. Test 500 server error (post-send unknown outcome)
  const issue500 = {
    number: 500,
    title: 'Issue 500',
    repo: 'test-owner/test-repo',
    body: 'Original 500 body',
    labels: [],
    subtasks: [],
    openQuestions: [],
  };
  const { app: app500, hostCalls: hostCalls500 } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') return { status: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
      return { status: 200, body: '{}' };
    },
  });
  app500.setState({ issues: [issue500], currentRepo: 'test-owner/test-repo' });
  const ok500 = await app500.updateIssueBody(issue500, 'Attempted body 500');
  assert.equal(ok500, false);
  const toasts500 = hostCalls500.filter((c) => c.type === 'toast');
  assert.ok(toasts500.some((t) => t.payload?.message?.includes('outcome unknown — check the issue on GitHub')), '500 must toast outcome unknown');
  assert.ok(!toasts500.some((t) => t.payload?.message?.includes('Failed to update')), '500 must not claim definite failure');
  assert.equal(issue500.unconfirmed, true, '500 must mark issue unconfirmed');

  // 2. Test 502 gateway error
  const issue502 = {
    number: 502,
    title: 'Issue 502',
    repo: 'test-owner/test-repo',
    body: 'Original 502 body',
    labels: [],
    subtasks: [],
    openQuestions: [],
  };
  const { app: app502, hostCalls: hostCalls502 } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') return { status: 502, body: 'Bad Gateway' };
      return { status: 200, body: '{}' };
    },
  });
  app502.setState({ issues: [issue502], currentRepo: 'test-owner/test-repo' });
  const ok502 = await app502.updateIssueBody(issue502, 'Attempted body 502');
  assert.equal(ok502, false);
  const toasts502 = hostCalls502.filter((c) => c.type === 'toast');
  assert.ok(toasts502.some((t) => t.payload?.message?.includes('outcome unknown — check the issue on GitHub')));
  assert.ok(!toasts502.some((t) => t.payload?.message?.includes('Failed to update')));

  // 3. Test 408 timeout error
  const issue408 = {
    number: 408,
    title: 'Issue 408',
    repo: 'test-owner/test-repo',
    body: 'Original 408 body',
    labels: [],
    subtasks: [],
    openQuestions: [],
  };
  const { app: app408, hostCalls: hostCalls408 } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') return { status: 408, body: 'Request Timeout' };
      return { status: 200, body: '{}' };
    },
  });
  app408.setState({ issues: [issue408], currentRepo: 'test-owner/test-repo' });
  const ok408 = await app408.updateIssueBody(issue408, 'Attempted body 408');
  assert.equal(ok408, false);
  const toasts408 = hostCalls408.filter((c) => c.type === 'toast');
  assert.ok(toasts408.some((t) => t.payload?.message?.includes('outcome unknown — check the issue on GitHub')));
  assert.ok(!toasts408.some((t) => t.payload?.message?.includes('Failed to update')));

  // 4. Test 422 definitive pre-commit rejection
  const issue422 = {
    number: 422,
    title: 'Issue 422',
    repo: 'test-owner/test-repo',
    body: 'Original 422 body',
    labels: [],
    subtasks: [],
    openQuestions: [],
  };
  const { app: app422, hostCalls: hostCalls422 } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') return { status: 422, body: JSON.stringify({ message: 'Validation Failed' }) };
      return { status: 200, body: '{}' };
    },
  });
  app422.setState({ issues: [issue422], currentRepo: 'test-owner/test-repo' });
  const ok422 = await app422.updateIssueBody(issue422, 'Attempted body 422');
  assert.equal(ok422, false);
  const toasts422 = hostCalls422.filter((c) => c.type === 'toast');
  assert.ok(toasts422.some((t) => t.payload?.message?.includes('Failed to update #422 on GitHub')), '422 must report failure');
  assert.ok(!toasts422.some((t) => t.payload?.message?.includes('outcome unknown')), '422 must not report unknown');
  assert.notEqual(issue422.unconfirmed, true, '422 must not mark unconfirmed');
});

test('Finding 2: Ambiguous outcome marks issue unconfirmed, blocks dependent writes until refresh reconciles it', async () => {
  const originalBody = 'Original body for unconfirmed test';
  const mockIssue = {
    number: 222,
    title: 'Issue 222',
    repo: 'test-owner/test-repo',
    body: originalBody,
    labels: [],
    subtasks: [],
    openQuestions: [],
  };

  let patchCount = 0;
  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') {
        patchCount++;
        return { status: 500, body: JSON.stringify({ message: 'Server error' }) };
      }
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({ number: 222, body: 'Authoritative refreshed body', updated_at: '2026-10-24T12:00:00Z' }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });

  // 1. Initial write triggers ambiguous 500 outcome
  const ok1 = await app.updateIssueBody(mockIssue, 'Attempt 1');
  assert.equal(ok1, false);
  assert.equal(mockIssue.unconfirmed, true, 'Issue must be marked unconfirmed after ambiguous outcome');
  assert.equal(patchCount, 1);

  // 2. Dependent write while unconfirmed must be blocked (no PATCH sent)
  const ok2 = await app.updateIssueBody(mockIssue, 'Attempt 2 while unconfirmed');
  assert.equal(ok2, false, 'Must block write on unconfirmed issue');
  assert.equal(patchCount, 1, 'Must not send PATCH when blocked by unconfirmed state');
  const blockedToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.message?.includes('unconfirmed'));
  assert.ok(blockedToast, 'Must toast that issue state is unconfirmed');

  // 3. Successful refresh reconciles issue and clears unconfirmed marker
  const fresh = await app.reloadIssueBeforeMutation(mockIssue);
  assert.ok(fresh, 'Fresh reload must succeed');
  assert.notEqual(mockIssue.unconfirmed, true, 'Successful reload must clear unconfirmed marker');
  assert.equal(mockIssue.body, 'Authoritative refreshed body');
});

test('Finding 3: handleAddDependency and handleRemoveDependency honor updateIssueBody result without false success toast', async () => {
  const issueA = {
    number: 301,
    title: 'Issue 301',
    repo: 'test-owner/test-repo',
    body: 'Issue 301 body',
    labels: [],
    subtasks: [],
    openQuestions: [],
  };
  const issueB = {
    number: 302,
    title: 'Issue 302',
    repo: 'test-owner/test-repo',
    body: 'Issue 302 body',
    labels: [],
    subtasks: [],
    openQuestions: [],
  };

  let failPatch = true;
  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') {
        if (failPatch) {
          return { status: 403, body: JSON.stringify({ message: 'Forbidden' }) };
        }
        return { status: 200, body: JSON.stringify({ number: 301 }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [issueA, issueB], currentRepo: 'test-owner/test-repo' });

  // 1. handleAddDependency when PATCH fails
  await app.handleAddDependency(301, 302);
  const successAddToast = hostCalls.find(
    (c) => c.type === 'toast' && c.payload?.message?.includes('Linked #301 as blocked by #302')
  );
  assert.equal(successAddToast, undefined, 'Must not show success toast when handleAddDependency fails');

  // 2. handleRemoveDependency when PATCH fails
  issueA.body = 'Issue 301 body\n- Blocked by #302';
  await app.handleRemoveDependency(301, 302);
  const successRemoveToast = hostCalls.find(
    (c) => c.type === 'toast' && c.payload?.message?.includes('Removed dependency')
  );
  assert.equal(successRemoveToast, undefined, 'Must not show success toast when handleRemoveDependency fails');

  // 3. Success cases when PATCH succeeds
  failPatch = false;
  issueA.body = 'Issue 301 body';
  await app.handleAddDependency(301, 302);
  const okAddToast = hostCalls.find(
    (c) => c.type === 'toast' && c.payload?.message?.includes('Linked #301 as blocked by #302')
  );
  assert.ok(okAddToast, 'Must show success toast when handleAddDependency succeeds');
});

test('Finding 4: Question change toast in multi-question issue does not falsely attribute unrelated question text', async () => {
  const originalBody = [
    '### Open Questions:',
    '- [ ] Question 1: Database?',
    '- [ ] Question 2: Cloud provider?',
    '- [ ] Question 3: Server port?',
  ].join('\n');

  const remoteBody = [
    '### Open Questions:',
    '- [ ] Question 1: Database?',
    '- [ ] Question 2: Cloud provider?',
    '- [ ] Question 3: Which TCP port?',
  ].join('\n');

  const mockIssue = {
    number: 404,
    title: 'Issue 404',
    repo: 'test-owner/test-repo',
    body: originalBody,
    labels: [],
    subtasks: [],
    openQuestions: [
      { text: 'Question 1: Database?', completed: false, lineIndex: 1 },
      { text: 'Question 2: Cloud provider?', completed: false, lineIndex: 2 },
      { text: 'Question 3: Server port?', completed: false, lineIndex: 3 },
    ],
  };

  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 404, body: remoteBody }) };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'Question 3: Server port?', '8080');
  assert.equal(ok, false);

  const errorToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.kind === 'error');
  assert.ok(errorToast, 'Error toast must be emitted');
  assert.ok(!errorToast.payload?.message?.includes('Question 1: Database?'), 'Must NOT attribute Question 1 text');
  assert.ok(errorToast.payload?.message?.includes('Question changed on #404; refreshed.'));
});

test('Finding 5: In-flight disabling on Save prevents duplicate PATCH mutations and toasts on double-click', async () => {
  let issueBody = '### Open Questions:\n- [ ] Question for double-click test?';
  const mockIssue = {
    number: 505,
    title: 'Issue 505',
    repo: 'test-owner/test-repo',
    body: issueBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question for double-click test?', completed: false, lineIndex: 1 }],
  };

  let patchCalls = 0;
  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return { status: 200, body: JSON.stringify({ number: 505, body: issueBody }) };
      }
      if (req.method === 'PATCH') {
        patchCalls++;
        await new Promise((r) => setTimeout(r, 20));
        const parsed = JSON.parse(req.body);
        issueBody = parsed.body;
        return { status: 200, body: JSON.stringify({ number: 505, body: issueBody, updated_at: '2026-10-24T12:00:01Z' }) };
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
  answerInput.value = 'Valid Answer';

  // Rapid double-click on Save button
  btnSave.click();
  btnSave.click();

  // Wait for submission to settle
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 20));
    if (patchCalls >= 1 && hostCalls.some((c) => c.type === 'toast')) break;
  }

  assert.equal(patchCalls, 1, 'Double-click must send exactly 1 PATCH request');
  const successToasts = hostCalls.filter((c) => c.type === 'toast' && c.payload?.message === 'Recorded answer to question');
  assert.equal(successToasts.length, 1, 'Double-click must emit exactly 1 success toast');
});

test('Finding 6: Typed answer is preserved across refusal in Questions View, Drawer, and Human Tasks as recoverable draft (Decision 14)', async () => {
  // Decision 14: Drafts never auto-reassign to changed/replaced questions.
  // Instead, the changed question input remains empty and the original draft
  // is preserved and rendered in a separately labelled recoverable draft component.

  // 1. Entry Point: Questions View
  {
    const originalBody = '### Open Questions:\n- [ ] Questions view question?';
    const changedBody = '### Open Questions:\n- [ ] Questions view question remotely changed?';
    const issueQV = {
      number: 601,
      title: 'Issue 601',
      repo: 'test-owner/test-repo',
      body: originalBody,
      labels: [],
      subtasks: [],
      openQuestions: [{ text: 'Questions view question?', completed: false, lineIndex: 1 }],
    };

    const { app, elements, hostCalls } = createTestApp({
      onRequest: async (req) => {
        if (req.method === 'GET') {
          return { status: 200, body: JSON.stringify({ number: 601, body: changedBody }) };
        }
        return { status: 200, body: '{}' };
      },
    });

    app.setState({
      issues: [issueQV],
      currentRepo: 'test-owner/test-repo',
      isManualRepoOverride: true,
      viewState: { view: 'simple', filters: ['questions'], sort: 'priority' },
    });
    app.applyLayoutMode();
    app.renderViews();

    const container = elements.get('questionsViewContainer');
    const btnAnswer = container.querySelector('.btn-inline-answer');
    btnAnswer.click();

    const input = container.querySelector('.input-inline-answer');
    const btnSave = container.querySelector('.btn-submit-inline-answer');
    input.value = 'Preserve this Questions View answer';
    btnSave.click();

    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 10));
      if (hostCalls.some((c) => c.type === 'toast' && c.payload?.kind === 'error')) break;
    }

    const currentInput = container.querySelector('.input-inline-answer');
    assert.equal(currentInput?.value || '', '', 'New question input must remain empty per Decision 14');

    const html = container.innerHTML;
    assert.ok(html.includes('Questions view question?'), 'Original question text must be displayed');
    assert.ok(html.includes('Preserve this Questions View answer'), 'Typed draft must be preserved in recoverable draft UI');

    const btnDiscard = container.querySelector('.btn-discard-draft');
    assert.ok(btnDiscard, 'Discard button must exist');
    btnDiscard.click();

    assert.ok(!container.innerHTML.includes('Preserve this Questions View answer'), 'Discard must remove draft');
  }

  // 2. Entry Point: Drawer Questions
  {
    const originalBody = '### Open Questions:\n- [ ] Drawer question?';
    const changedBody = '### Open Questions:\n- [ ] Drawer question remotely changed?';
    const issueDrawer = {
      number: 602,
      title: 'Issue 602',
      repo: 'test-owner/test-repo',
      body: originalBody,
      labels: [],
      subtasks: [],
      openQuestions: [{ text: 'Drawer question?', completed: false, lineIndex: 1 }],
    };

    const { app, elements, hostCalls } = createTestApp({
      onRequest: async (req) => {
        if (req.method === 'GET') {
          return { status: 200, body: JSON.stringify({ number: 602, body: changedBody }) };
        }
        return { status: 200, body: '{}' };
      },
    });

    app.setState({ issues: [issueDrawer], currentRepo: 'test-owner/test-repo' });
    app.openDrawer(issueDrawer);

    const container = elements.get('drawerQuestionsContainer');
    const btnAnswer = container.querySelector('.btn-inline-answer');
    btnAnswer.click();

    const input = container.querySelector('.input-inline-answer');
    const btnSave = container.querySelector('.btn-submit-inline-answer');
    input.value = 'Preserve this Drawer answer';
    btnSave.click();

    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 10));
      if (hostCalls.some((c) => c.type === 'toast' && c.payload?.kind === 'error')) break;
    }

    const currentInput = container.querySelector('.input-inline-answer');
    assert.equal(currentInput?.value || '', '', 'Drawer new question input must remain empty');

    const html = container.innerHTML;
    assert.ok(html.includes('Drawer question?'), 'Drawer must display original question');
    assert.ok(html.includes('Preserve this Drawer answer'), 'Drawer must display recoverable draft');

    const btnDiscard = container.querySelector('.btn-discard-draft');
    assert.ok(btnDiscard, 'Discard button must exist in Drawer');
    btnDiscard.click();

    assert.ok(!container.innerHTML.includes('Preserve this Drawer answer'), 'Discard in Drawer must remove draft');
  }

  // 3. Entry Point: Human Tasks View
  {
    const originalBody = '### Open Questions:\n- [ ] Human task question?';
    const changedBody = '### Open Questions:\n- [ ] Human task question remotely changed?';
    const issueHuman = {
      number: 603,
      title: 'Issue 603',
      repo: 'test-owner/test-repo',
      body: originalBody,
      labels: [{ name: 'status:needs-human' }],
      status: 'needs-human',
      subtasks: [],
      openQuestions: [{ text: 'Human task question?', completed: false, lineIndex: 1 }],
      humanTasks: [],
    };

    const { app, elements, hostCalls } = createTestApp({
      onRequest: async (req) => {
        if (req.method === 'GET') {
          return { status: 200, body: JSON.stringify({ number: 603, body: changedBody }) };
        }
        return { status: 200, body: '{}' };
      },
    });

    app.setState({
      issues: [issueHuman],
      currentRepo: 'test-owner/test-repo',
      isManualRepoOverride: true,
      viewState: { view: 'pending', filters: [], sort: 'priority' },
    });
    app.applyLayoutMode();
    app.renderViews();

    const container = elements.get('humanViewContainer');
    const btnAnswer = container.querySelector('.btn-answer-action');
    btnAnswer.click();

    const input = container.querySelector('.input-human-answer');
    const btnSave = container.querySelector('.btn-submit-human-answer');
    input.value = 'Preserve this Human Tasks answer';
    btnSave.click();

    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 10));
      if (hostCalls.some((c) => c.type === 'toast' && c.payload?.kind === 'error')) break;
    }

    const currentInput = container.querySelector('.input-human-answer');
    assert.equal(currentInput?.value || '', '', 'Human Tasks new question input must remain empty');

    const html = container.innerHTML;
    assert.ok(html.includes('Human task question?'), 'Human Tasks must display original question');
    assert.ok(html.includes('Preserve this Human Tasks answer'), 'Human Tasks must display recoverable draft');

    const btnDiscard = container.querySelector('.btn-discard-draft');
    assert.ok(btnDiscard, 'Discard button must exist in Human Tasks');
    btnDiscard.click();

    assert.ok(!container.innerHTML.includes('Preserve this Human Tasks answer'), 'Discard in Human Tasks must remove draft');
  }
});

test('Finding 7: Post-mutation notification/toast failure does not cause write rollback', async () => {
  const originalBody = '### Open Questions:\n- [ ] Question 701?';
  const newBody = '### Open Questions:\n- [x] Question 701? *(Answer: Solved)*';
  const mockIssue = {
    number: 701,
    title: 'Issue 701',
    repo: 'test-owner/test-repo',
    body: originalBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question 701?', completed: false, lineIndex: 1 }],
  };

  let patchCalls = 0;
  const { app } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') {
        patchCalls++;
        return { status: 200, body: JSON.stringify({ number: 701, body: newBody, updated_at: '2026-10-24T12:00:00Z' }) };
      }
      return { status: 200, body: '{}' };
    },
    onPostMessage: (data) => {
      // Simulate toast failure throwing an error
      if (data && data.type === 'toast') {
        throw new Error('Host toast RPC communication failure');
      }
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.updateIssueBody(mockIssue, newBody);

  // Must return true because the write succeeded on GitHub
  assert.equal(ok, true, 'Write outcome must be true despite toast exception');
  assert.equal(mockIssue.body, newBody, 'Local issue body must NOT roll back on notification failure');
  assert.equal(patchCalls, 1, 'PATCH was sent and succeeded');
});

test('Decision 14 Isolation A1: Cross-repo draft isolation with identical question text', async () => {
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

test('Decision 14 Isolation A2: Cross-repo draft isolation with different question text', async () => {
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

test('Decision 14 Isolation B1: Single issue with multiple questions isolation (Q1 and Q2)', async () => {
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

test('Decision 14 Isolation C1: Emptying an input field deletes the draft and does not resurrect it on re-render', async () => {
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

test('Decision 14 Isolation C2: Remotely changed question leaves current input empty and renders recoverable draft labelled with original question', async () => {
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
    viewState: { view: 'simple', filters: ['questions'], sort: 'priority' },
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

test('Decision 14 Isolation C3: Remotely deleted questions renders issue with recoverable draft rather than empty-box', async () => {
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
    viewState: { view: 'simple', filters: ['questions'], sort: 'priority' },
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

test('Decision 14 Layout D1: Direct renderers do not mutate viewState or data-layout', async () => {
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
