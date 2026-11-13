// V4-3-L4 follow-up probe: the five attack checks that failed or needed a
// cleaner fixture. Records resulting state instead of asserting a guess.
//
//   node scripts/followup.mjs

import { startFakeGitHub, makeIssue } from '../../../../../../web/tests/fake-github.mjs';
import { startBoard, browserConfig, HttpSession, SYNTHETIC_TOKEN } from '../../../../../../web/tests/helpers.mjs';

const IMAGE = [
  '## Overview', '', 'Review.', '',
  '### Human Review:', '- Artifact: image',
  '- URL: https://example.com/screenshots/login-empty.png',
  '- Instruction: Compare the empty state with the approved mockup.',
].join('\n');
const noArtifact = '## Overview\n\nNothing to click.\n';
const malformed = '### Human Review:\n- Artifact: image\n- URL: javascript:alert(1)\n- Instruction: Look.\n';
const QUESTION = [
  '## Overview', '', 'Pick one.', '',
  '### Open Questions:', '- [ ] Which spacing should the list use?',
  '  - Compact :: Dense rows :: Best for scanning.',
  '  - Comfortable :: Roomier rows :: Easier on a phone.', '',
  '### Human Review:', '- Artifact: question',
].join('\n');

const fake = await startFakeGitHub({
  token: SYNTHETIC_TOKEN,
  issues: [
    makeIssue({ number: 1, body: malformed, labels: ['status:todo'] }),
    makeIssue({ number: 2, body: IMAGE, labels: ['status:needs-human'] }),
    makeIssue({ number: 3, body: QUESTION, labels: ['status:done'] }),
    makeIssue({ number: 4, body: noArtifact, labels: ['status:todo'] }),
  ],
});
const board = await startBoard(fake, { config: browserConfig(fake, {}) });
const out = {};
try {
  const session = new HttpSession(board.url);
  await session.login();
  const read = async (number) => (await session.request(`/api/issues/${number}`)).json.issue;
  const writes = () => fake.requests.filter((request) => request.method !== 'GET').length;
  const stored = (number) => fake.issues.find((issue) => issue.number === number);

  // A. Status entry with a malformed artifact on a task that is not waiting yet.
  {
    const current = await read(1);
    const before = writes();
    const response = await session.request('/api/issues/1', {
      method: 'PATCH', body: { status: 'status:needs-human', fingerprint: current.fingerprint },
    });
    out.malformedStatusEntry = { status: response.status, error: response.json?.error, writes: writes() - before, storedLabels: stored(1).labels.map((l) => l.name) };
  }

  // B. Section edit injects a broken Human Review heading into a waiting task.
  {
    const current = await read(2);
    const before = writes();
    const response = await session.request('/api/issues/2/section', {
      method: 'PUT', body: { fingerprint: current.fingerprint, sectionId: 'overview', text: 'Review.\n\n### Human Review:\n' },
    });
    const after = await read(2);
    out.sectionInject = {
      status: response.status,
      error: response.json?.error,
      writes: writes() - before,
      storedBody: stored(2).body,
      statusLabel: after.statusLabel,
      humanReviewState: after.humanReview?.state,
      humanReviewReason: after.humanReview?.reason,
      humanReviewKind: after.humanReview?.kind,
      column: after.column,
    };
  }

  // C. Answering a gated question on a done task.
  {
    const current = await read(3);
    const response = await session.request('/api/issues/3/questions/0/answer', {
      method: 'POST', body: { fingerprint: current.fingerprint, answer: 'Comfortable' },
    });
    out.answerOnDone = { status: response.status, statusLabel: response.json?.issue?.statusLabel, labels: response.json?.issue?.labels, humanReview: response.json?.issue?.humanReview?.state };
  }

  // D. Creation with two status labels: the waiting label is present but not
  //    first, so statusLabelOf and the board column can disagree.
  {
    const response = await session.request('/api/issues', {
      method: 'POST',
      body: { title: 'Two status labels', body: noArtifact, labels: ['status:todo', 'status:needs-human'] },
    });
    const created = response.json?.issue;
    const boardRow = created ? (await session.request('/api/board?refresh=1')).json.issues.find((issue) => issue.number === created.number) : null;
    out.createTwoStatusLabels = {
      status: response.status,
      error: response.json?.error,
      storedLabels: created?.number ? stored(created.number).labels.map((l) => l.name) : null,
      statusLabel: created?.statusLabel,
      column: boardRow?.column,
      humanReviewState: boardRow?.humanReview?.state,
      note: 'statusLabel drives the client gate panel; column drives the waiting column',
    };
  }

  // E. External writer adds the waiting label to a task that has no other
  //    status label (the real F5 case).
  {
    const external = stored(4);
    external.labels = [{ name: 'status:needs-human', color: 'ededed' }];
    const detail = await read(4);
    const row = (await session.request('/api/board?refresh=1')).json.issues.find((issue) => issue.number === 4);
    const before = writes();
    const escape = await session.request('/api/issues/4/status', {
      method: 'POST', body: { status: 'status:in-progress', fingerprint: detail.fingerprint },
    });
    out.externalWaiting = {
      statusLabel: detail.statusLabel,
      column: detail.column,
      humanReviewState: detail.humanReview?.state,
      humanReviewReason: detail.humanReview?.reason,
      listColumn: row?.column,
      listHumanReviewState: row?.humanReview?.state,
      escapeStatus: escape.status,
      escapeError: escape.json?.error,
      escapeWrites: writes() - before,
      statusAfterEscape: (await read(4)).statusLabel,
    };
  }
} finally {
  await board.app.close();
  await fake.close();
}
console.log(JSON.stringify(out, null, 2));
