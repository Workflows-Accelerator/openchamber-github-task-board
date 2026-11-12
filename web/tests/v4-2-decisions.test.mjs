import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWebOpenQuestions, buildIssueDetail, buildBoardListItem, applyQuestionAnswer } from '../server/board.ts';
import { renderMarkdown } from '../public/markdown.js';
import { makeIssue, startFakeGitHub } from './fake-github.mjs';
import { startBoard, HttpSession } from './helpers.mjs';

export const DECISION_BODY = [
  '## Overview', 'Choose the durable storage for the audit trail.', '',
  '## Open Questions',
  '- [ ] ### Choose **storage** with `history` and [retention](https://example.com/retention)?',
  '  - PostgreSQL :: Mature and familiar :: **Operations stay unchanged** with `pg_dump`.',
  '  - SQLite :: Zero operations :: Read the [limits](https://example.com/limits) before choosing.',
  '- [ ] Which **owner** approves rollout? (Anne | Lucas)',
].join('\n');

test('V4-2 one option convention projects identically into drawer and Decisions', () => {
  const raw = makeIssue({ number: 1, body: DECISION_BODY });
  const parsed = parseWebOpenQuestions(raw.body);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0].options, [
    { label: 'PostgreSQL', gist: 'Mature and familiar', details: '**Operations stay unchanged** with `pg_dump`.' },
    { label: 'SQLite', gist: 'Zero operations', details: 'Read the [limits](https://example.com/limits) before choosing.' },
  ]);
  assert.ok(!Object.hasOwn(parsed[1], 'options'));
  assert.deepEqual(buildIssueDetail(raw).openQuestions, buildBoardListItem(raw).openQuestions);
});
for (const ending of ['\n\n  - Not an option', '\n    - Code, not an option', '\n  - [ ] Nested checklist', '\n## Human Tasks\n- [ ] Task']) {
  test(`V4-2 option boundary ${JSON.stringify(ending)}`, () => {
    const result = parseWebOpenQuestions('## Open Questions\n- [ ] Choice?\n  - One :: Gist :: Details' + ending);
    assert.equal(result[0].options.length, 1);
  });
}
test('V4-2 limits options and preserves later field separators', () => {
  const result = parseWebOpenQuestions('## Open Questions\n- [ ] Choice?\n' + Array.from({ length: 10 }, (_, i) => `  - ${i} :: gist :: details :: kept`).join('\n'));
  assert.equal(result[0].options.length, 8);
  assert.equal(result[0].options[0].details, 'details :: kept');
});
test('V4-2 malformed option lines degrade instead of breaking the question', () => {
  const long = 'L'.repeat(121);
  const result = parseWebOpenQuestions(['## Open Questions', '- [ ] Pick **one?', '  - ', '  -  :: only gist', `  - ${long} :: too long`,
    '  - **Unclosed :: `open code :: [link(http://x', '  - Good :: fine'].join('\n'));
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'Pick **one?');
  assert.deepEqual(result[0].options.map((option) => option.label), ['**Unclosed', 'Good']);
  for (const option of result[0].options) {
    for (const field of [option.label, option.gist, option.details]) assert.doesNotMatch(renderMarkdown(field), /<(?!\/?p>)/);
  }
  const allInvalid = makeIssue({ number: 1, body: ['## Open Questions', '- [ ] Only bad?', '  - ', '  -  :: gist', `  - ${long}`].join('\n') });
  assert.deepEqual(buildIssueDetail(allInvalid).openQuestions, [{ index: 0, answerIndex: 0, text: 'Only bad?', completed: false }]);
});
test('V4-2 selected label uses unchanged answer flow; keeps options and other questions', () => {
  const raw = makeIssue({ number: 1, body: DECISION_BODY });
  const next = applyQuestionAnswer(raw, 0, 'PostgreSQL');
  assert.ok(next.includes('*(Answer: PostgreSQL)*'));
  assert.ok(next.includes('  - SQLite :: Zero operations'));
  const questions = buildIssueDetail({ ...raw, body: next }).openQuestions;
  assert.equal(questions[0].completed, true);
  assert.equal(questions[1].answerIndex, 0);
  assert.equal(questions[0].options.length, 2);
});
test('V4-2 legacy question shape and free text remain answerable', () => {
  const raw = makeIssue({ number: 1, body: '## Open Questions\n- [ ] Which **owner**?\n' });
  assert.deepEqual(buildIssueDetail(raw).openQuestions, [{ index: 0, answerIndex: 0, text: 'Which **owner**?', completed: false }]);
  assert.ok(applyQuestionAnswer(raw, 0, 'A considered free-text answer').includes('*(Answer: A considered free-text answer)*'));
});
test('V4-2 existing renderer supports heading/list/code/link/emphasis without raw markers', () => {
  const html = renderMarkdown('### Choose **storage**\n- Use `history`\n- Read [policy](https://example.com)');
  for (const tag of ['<h3>', '<ul>', '<li>', '<code>', '<a ', '<strong>']) assert.ok(html.includes(tag), tag);
  assert.doesNotMatch(html, /\*\*|`|\n- /);
  assert.doesNotMatch(renderMarkdown('<script>alert(1)</script> [bad](javascript:alert(1))'), /<script>|href="javascript:/);
});
test('V4-2 both question surfaces share Markdown/radio/disclosure/submission implementation', () => {
  const source = readFileSync('web/public/app.js', 'utf8');
  assert.match(source, /node.innerHTML = safeRenderMarkdown\(text/);
  assert.match(source, /questionAnswerBlock\(question, issue, true\)/);
  assert.match(source, /questionAnswerBlock\(q, issue, false\)/);
  assert.match(source, /role: 'radiogroup'/);
  assert.match(source, /'aria-expanded': 'false'/);
  assert.match(source, /'aria-controls': prefix \+ '-details-'/);
  assert.match(source, /question-submit-status small', role: 'status'/);
});
test('V4-2 preset and legacy free-text answers persist through server API', async () => {
  const fake = await startFakeGitHub({ issues: [makeIssue({ number: 1, body: DECISION_BODY, labels: ['status:needs-human'] })] });
  const board = await startBoard(fake);
  try {
    const session = new HttpSession(board.url); await session.login();
    let read = await session.request('/api/issues/1');
    let response = await session.request('/api/issues/1/questions/0/answer', { method: 'POST', body: { answer: 'PostgreSQL', fingerprint: read.json.issue.fingerprint } });
    assert.equal(response.status, 200);
    assert.equal(response.json.issue.openQuestions[0].completed, true);
    response = await session.request('/api/issues/1/questions/0/answer', { method: 'POST', body: { answer: 'Lucas, after review', fingerprint: response.json.issue.fingerprint } });
    assert.equal(response.status, 200);
    read = await session.request('/api/issues/1');
    assert.ok(read.json.issue.openQuestions.every((q) => q.completed));
    assert.ok(fake.findIssue(1).body.includes('*(Answer: Lucas, after review)*'));
  } finally { await board.app.close(); await fake.close(); }
});
