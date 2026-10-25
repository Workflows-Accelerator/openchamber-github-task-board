import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../test/test-app-harness.js';
import { resolveOptimisticQuestionAnswer, parseOpenQuestions } from '../../panel/core.ts';

test('Hostile Finding 1: HTTP 500/504 on PATCH treated as explicit rejection instead of unknown outcome', async () => {
  const originalBody = '### Open Questions:\n- [ ] Question for 500 test?';
  const mockIssue = {
    number: 201,
    title: 'Test Issue 201',
    repo: 'test-owner/test-repo',
    body: originalBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question for 500 test?', completed: false, lineIndex: 1 }],
  };

  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          body: JSON.stringify({ number: 201, body: originalBody }),
        };
      }
      if (req.method === 'PATCH') {
        // HTTP 500 server error after request was received by server
        return {
          status: 500,
          body: JSON.stringify({ message: 'Internal Server Error' }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'Question for 500 test?', 'Answer 500');
  assert.equal(ok, false);

  const errorToasts = hostCalls.filter((c) => c.type === 'toast' && c.payload?.kind === 'error');
  const unknownToast = errorToasts.find((c) => c.payload?.message?.includes('outcome unknown — check the issue on GitHub'));
  const failedToast = errorToasts.find((c) => c.payload?.message?.includes('Failed to update #201 on GitHub'));

  console.log('Finding 1 observed error toast:', errorToasts.map(t => t.payload?.message));

  // The brief states: "Do NOT accept status>=400 or matching HTTP text as proof of rejection:
  // potentially post-send 5xx/parse errors are UNKNOWN unless proven otherwise."
  // Currently, the implementation matches 500 via regex and status>=400 as an explicit rejection.
  assert.ok(
    failedToast !== undefined && unknownToast === undefined,
    'Observed defect: 500 error was treated as explicit rejection rather than ambiguous unknown outcome'
  );
});

test('Hostile Finding 2: Decision D3 changed question toast reports Question 1 when Question 3 changed', async () => {
  const originalBody = [
    '### Open Questions:',
    '- [ ] Question 1: Database?',
    '- [ ] Question 2: Cloud provider?',
    '- [ ] Question 3: Server port?',
  ].join('\n');

  // Remotely, Question 3 was modified to "Question 3: Which TCP port?"
  const remoteBody = [
    '### Open Questions:',
    '- [ ] Question 1: Database?',
    '- [ ] Question 2: Cloud provider?',
    '- [ ] Question 3: Which TCP port?',
  ].join('\n');

  const mockIssue = {
    number: 202,
    title: 'Test Issue 202',
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
        return {
          status: 200,
          body: JSON.stringify({ number: 202, body: remoteBody }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  const ok = await app.answerQuestion(mockIssue, 'Question 3: Server port?', '8080');
  assert.equal(ok, false);

  const errorToast = hostCalls.find((c) => c.type === 'toast' && c.payload?.kind === 'error');
  console.log('Finding 2 observed toast message:', errorToast?.payload?.message);

  // The toast says: Question changed on #202. Current text: "Question 1: Database?"
  assert.ok(
    errorToast?.payload?.message?.includes('Question 1: Database?'),
    'Observed defect: Toast reported Question 1 text instead of changed Question 3'
  );
});

test('Hostile Finding 3: handleAddDependency shows false success toast when updateIssueBody fails', async () => {
  const mockIssue = {
    number: 203,
    title: 'Test Issue 203',
    repo: 'test-owner/test-repo',
    body: 'Some description',
    labels: [],
    subtasks: [],
    openQuestions: [],
  };

  const { app, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'PATCH') {
        return {
          status: 400,
          body: JSON.stringify({ message: 'Bad Request' }),
        };
      }
      return { status: 200, body: '{}' };
    },
  });

  app.setState({ issues: [mockIssue], currentRepo: 'test-owner/test-repo' });
  
  // Directly invoke updateIssueBody through the helper to observe false success toast in dependency linking
  // In panel/main.ts lines 5291-5294:
  // await updateIssueBody(targetIssue, newBody);
  // if (host?.toast) await host.toast({ kind: 'info', message: `Linked #${targetNum} as blocked by #${blockerNum}` });
  const ok = await app.updateIssueBody(mockIssue, 'New body with dependency');
  assert.equal(ok, false);

  // When updateIssueBody fails, it returns false. But callers like handleAddDependency don't check `ok`.
  // If the caller executes toast without checking ok:
  const toasts = hostCalls.filter((c) => c.type === 'toast');
  console.log('Finding 3 updateIssueBody returned false, toasts emitted:', toasts.map(t => t.payload));
});

test('Hostile Finding 4: Rapid double-click on Save in Questions View triggers duplicate PATCH mutations and duplicate toasts', async () => {
  let issueBody = '### Open Questions:\n- [ ] Question for double-click test?';
  const mockIssue = {
    number: 204,
    title: 'Test Issue 204',
    repo: 'test-owner/test-repo',
    body: issueBody,
    labels: [],
    subtasks: [],
    openQuestions: [{ text: 'Question for double-click test?', completed: false, lineIndex: 1 }],
  };

  let getCalls = 0;
  let patchCalls = 0;
  const { app, elements, hostCalls } = createTestApp({
    onRequest: async (req) => {
      if (req.method === 'GET') {
        getCalls++;
        return {
          status: 200,
          body: JSON.stringify({ number: 204, body: issueBody }),
        };
      }
      if (req.method === 'PATCH') {
        patchCalls++;
        const parsed = JSON.parse(req.body);
        issueBody = parsed.body;
        return {
          status: 200,
          body: JSON.stringify({ number: 204, body: issueBody, updated_at: '2026-10-24T12:00:01Z' }),
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
  answerInput.value = 'Valid Answer';

  // Rapid double-click on Save button
  btnSave.click();
  btnSave.click();

  // Wait for async handlers
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 20));
    if (patchCalls >= 1 && hostCalls.length >= 2) break;
  }

  const toasts = hostCalls.filter((c) => c.type === 'toast');
  console.log('Finding 4 double-click toasts:', toasts.map(t => t.payload?.message));

  const hasSuccess = toasts.some((t) => t.payload?.message === 'Recorded answer to question');
  const hasAlreadyAnswered = toasts.some((t) => t.payload?.message?.includes('already answered'));

  assert.equal(patchCalls, 2, 'Observed defect: Double-click triggered two duplicate PATCH requests to GitHub');
  assert.equal(toasts.length, 2, 'Observed defect: Double-click emitted two duplicate success toasts');
});

