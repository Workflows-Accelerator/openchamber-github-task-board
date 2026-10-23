import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBoardList,
  buildIssueDetail,
  issueFingerprint,
  applySectionEdit,
  applyQuestionAnswer,
  applyStatusChange,
  BoardError,
} from '../server/board.ts';
import { makeIssue } from './fake-github.mjs';

const BODY = [
  'Overview prose.',
  '',
  '## Acceptance Criteria',
  '- [ ] A person can open the board',
  '',
  '### Open Questions',
  '- [ ] Which port should the board use?',
  '- [x] Is the session cookie HttpOnly?',
  '- [ ] Who approves rollout?',
  '',
  '## Human Tasks',
  '- [ ] Approve the rollout',
  '',
  '## Test Plan (Issue)',
  '- [ ] node --test web/tests/*.test.mjs',
  '',
].join('\n');

test('buildBoardList normalizes issues and drops pull requests', () => {
  const raw = [
    makeIssue({ number: 1, title: 'Real issue', body: BODY, labels: ['status:todo', 'phase:planning', 'bug'] }),
    makeIssue({ number: 2, title: 'A PR', pull_request: true }),
    makeIssue({ number: 3, title: 'Closed issue', state: 'closed', labels: ['status:done'] }),
  ];
  const { issues, excluded } = buildBoardList(raw);
  assert.equal(excluded, 1);
  assert.deepEqual(
    issues.map((issue) => issue.number),
    [1, 3],
  );
  const first = issues[0];
  assert.equal(first.statusLabel, 'status:todo');
  assert.equal(first.state, 'open');
  assert.equal(typeof first.phase, 'string');
  assert.equal(typeof first.attention, 'string');
  assert.equal(typeof first.column, 'string');
  assert.equal(first.labels.includes('bug'), true);
  assert.equal(first.counts.openQuestions.total, 3);
  assert.equal(first.counts.openQuestions.open, 2);
});

test('issueFingerprint binds body, labels and state, not timestamps', () => {
  const base = makeIssue({ number: 5, body: 'Body', labels: ['status:todo'] });
  const same = { ...base, updated_at: '2027-01-01T00:00:00Z' };
  assert.equal(issueFingerprint(base), issueFingerprint(same));

  assert.notEqual(issueFingerprint(base), issueFingerprint({ ...base, body: 'Body changed' }));
  assert.notEqual(issueFingerprint(base), issueFingerprint({ ...base, labels: [{ name: 'status:done' }] }));
  assert.notEqual(issueFingerprint(base), issueFingerprint({ ...base, state: 'closed' }));
});

test('buildIssueDetail exposes the editable overview and answerable questions', () => {
  const raw = makeIssue({
    number: 10,
    body: BODY,
    labels: ['status:needs-human', 'phase:execution', 'attention:needs-decision'],
  });
  const detail = buildIssueDetail(raw);
  assert.equal(detail.number, 10);
  assert.equal(detail.fingerprint, issueFingerprint(raw));
  assert.equal(detail.statusLabel, 'status:needs-human');
  assert.equal(detail.editableSections.length, 1);
  assert.equal(detail.editableSections[0].id, 'overview');
  assert.equal(detail.editableSections[0].text, 'Overview prose.');

  const unresolved = detail.openQuestions.filter((question) => !question.completed);
  assert.equal(unresolved.length, 2);
  assert.deepEqual(
    unresolved.map((question) => question.answerIndex),
    [0, 1],
  );
  assert.equal(detail.openQuestions.filter((question) => question.completed).length, 1);
  assert.equal(detail.humanTasks.length, 1);
  assert.equal(detail.humanTasks[0].text, 'Approve the rollout');
});

test('buildIssueDetail refuses pull requests', () => {
  const raw = makeIssue({ number: 11, pull_request: true });
  assert.throws(
    () => buildIssueDetail(raw),
    (err) => err instanceof BoardError && err.code === 'not_an_issue',
  );
});

test('applySectionEdit only rewrites the overview', () => {
  const raw = makeIssue({ number: 12, body: BODY });
  const next = applySectionEdit(raw, 'overview', 'New prose.');
  assert.equal(next, BODY.replace('Overview prose.', 'New prose.'));
  const beforeTail = BODY.slice(BODY.indexOf('## Acceptance Criteria'));
  assert.equal(next.slice(next.indexOf('## Acceptance Criteria')), beforeTail);
});

test('applySectionEdit refuses protected sections', () => {
  const raw = makeIssue({ number: 13, body: BODY });
  assert.throws(
    () => applySectionEdit(raw, 'open-questions', 'x'),
    (err) => err instanceof BoardError && err.code === 'not_editable',
  );
});

test('applyQuestionAnswer marks the question and preserves all other bytes', () => {
  const raw = makeIssue({ number: 14, body: BODY });
  const next = applyQuestionAnswer(raw, 1, 'Approved by the owner');
  assert.match(next, /- \[x\] Who approves rollout\? \*\(Answer: Approved by the owner\)\*$/m);
  assert.equal(next.includes('- [ ] Which port should the board use?'), true);
  assert.equal(next.includes('- [ ] Approve the rollout'), true);
  assert.equal(next.includes('## Test Plan (Issue)'), true);
  // Only the answered line differs.
  const before = BODY.split('\n');
  const after = next.split('\n');
  assert.equal(before.length, after.length);
  const differing = before.filter((line, index) => line !== after[index]);
  assert.equal(differing.length, 1);
});

test('applyQuestionAnswer refuses an out-of-range or empty answer', () => {
  const raw = makeIssue({ number: 15, body: BODY });
  assert.throws(() => applyQuestionAnswer(raw, 9, 'x'), (err) => err instanceof BoardError);
  assert.throws(() => applyQuestionAnswer(raw, 0, '   '), (err) => err instanceof BoardError);
});

test('applyStatusChange preserves non-status labels', () => {
  const raw = makeIssue({ number: 16, labels: ['priority:high', 'status:todo', 'bug'] });
  assert.deepEqual(applyStatusChange(raw, 'status:in-review'), ['priority:high', 'bug', 'status:in-review']);
  assert.deepEqual(applyStatusChange(raw, null), ['priority:high', 'bug']);
});

test('applyStatusChange refuses labels outside the agreed set', () => {
  const raw = makeIssue({ number: 17, labels: ['status:todo'] });
  assert.throws(
    () => applyStatusChange(raw, 'status:closed'),
    (err) => err instanceof BoardError && err.code === 'not_editable',
  );
});
