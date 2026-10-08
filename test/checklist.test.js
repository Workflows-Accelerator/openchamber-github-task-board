import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSubtasks,
  updateSubtaskInMarkdown,
  appendSubtaskToMarkdown,
  serializeDraftSubtasks,
  isVagueIdea,
  parseOpenQuestions,
  updateOpenQuestionInMarkdown,
  appendOpenQuestionToMarkdown,
  serializeDraftQuestions,
  formatQuestionBadge,
  answerOpenQuestionInMarkdown,
} from '../panel/core.ts';

const explicitQuestionPrefixRegex = /^(\s*(?:\?|[-*+]\s*\[\s*[?xX ]\s*\]|\d+\.)\s*(?:\?|Q:|Question:)\s*)(.+)$/i;

function isQuestionLine(line, inQuestionsSection) {
  if (inQuestionsSection) {
    return checklistRegex.test(line);
  }
  return explicitQuestionPrefixRegex.test(line);
}

test('parseSubtasks parses standard and mixed list formats', () => {
  const body = `
Header
- [ ] Task one
* [x] Task two
+ [ ] Task three
1. [x] Ordered task four
Some regular text
  `;
  const subtasks = parseSubtasks(body);
  assert.equal(subtasks.length, 4);
  assert.equal(subtasks[0].completed, false);
  assert.equal(subtasks[0].text, 'Task one');
  assert.equal(subtasks[1].completed, true);
  assert.equal(subtasks[1].text, 'Task two');
  assert.equal(subtasks[2].completed, false);
  assert.equal(subtasks[2].text, 'Task three');
  assert.equal(subtasks[3].completed, true);
  assert.equal(subtasks[3].text, 'Ordered task four');
});

test('updateSubtaskInMarkdown toggles specific line index without touching duplicate texts', () => {
  const body = `- [ ] Duplicate name\n- [ ] Duplicate name`;
  const updated = updateSubtaskInMarkdown(body, 1, true);
  assert.equal(updated, `- [ ] Duplicate name\n- [x] Duplicate name`);
});

test('serializeDraftSubtasks formats interactive draft items into markdown checklist', () => {
  const tasks = ['Define contract in test', 'Implement UI', 'Run test suite'];
  const res = serializeDraftSubtasks('Fix auth flow properly.', tasks);
  assert.ok(res.includes('Fix auth flow properly.'));
  assert.ok(res.includes('### Actionable Subtasks Checklist:'));
  assert.ok(res.includes('- [ ] Define contract in test'));
  assert.ok(res.includes('- [ ] Implement UI'));
  assert.ok(res.includes('- [ ] Run test suite'));
});

test('isVagueIdea accurately identifies sparse issues and explicit alignment labels', () => {
  // 1. Explicit needs-alignment label is always vague
  assert.equal(isVagueIdea({ labels: [{ name: 'status:needs-alignment' }], body: 'Long description...' }), true);
  // 2. Empty description and 0 subtasks
  assert.equal(isVagueIdea({ body: '', subtasks: [] }), true);
  // 3. Short description (< 20 words) with 0 subtasks
  assert.equal(isVagueIdea({ body: 'We need to make it faster somehow.', subtasks: [] }), true);
  // 4. Issue with subtasks is NOT vague
  assert.equal(isVagueIdea({ body: 'Short', subtasks: [{ text: 'Step 1' }] }), false);
  // 5. Issue with detailed body (> 20 words) is NOT vague
  const longBody = 'This is a well detailed issue description explaining the background, motivations, architecture impacts, and steps for how the developer should proceed with implementation cleanly.';
  assert.equal(isVagueIdea({ body: longBody, subtasks: [] }), false);
});

test('appendSubtaskToMarkdown appends to existing body cleanly', () => {
  const body = `Initial text`;
  const res = appendSubtaskToMarkdown(body, 'New item');
  assert.equal(res, `Initial text\n- [ ] New item`);
});

test('parseOpenQuestions parses questions under Open Questions section and question prefixes', () => {
  const body = `
### Background
Some details here.

### Actionable Subtasks Checklist:
- [ ] Implement backend endpoint
- [x] Write schema tests

### Open Questions:
- [ ] Should we support SQLite or PostgreSQL first?
- [x] Do we need token expiration? (Yes, 24h)
`;

  const questions = parseOpenQuestions(body);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].completed, false);
  assert.equal(questions[0].text, 'Should we support SQLite or PostgreSQL first?');
  assert.equal(questions[1].completed, true);
  assert.equal(questions[1].text, 'Do we need token expiration? (Yes, 24h)');

  // Subtasks should only contain the 2 subtasks, not the questions
  const subtasks = parseSubtasks(body);
  assert.equal(subtasks.length, 2);
  assert.equal(subtasks[0].text, 'Implement backend endpoint');
  assert.equal(subtasks[1].text, 'Write schema tests');
});

test('updateOpenQuestionInMarkdown toggles question resolution mark cleanly', () => {
  const body = `
### Open Questions:
- [ ] Can users have multiple accounts?
- [ ] Do we send email notifications?
`;
  const questions = parseOpenQuestions(body);
  assert.equal(questions.length, 2);

  const updated = updateOpenQuestionInMarkdown(body, questions[0].lineIndex, true);
  const reParsed = parseOpenQuestions(updated);
  assert.equal(reParsed[0].completed, true);
  assert.equal(reParsed[1].completed, false);
});

test('appendOpenQuestionToMarkdown appends under existing section or creates new section', () => {
  const bodyWithout = `### Description\nSome feature details.`;
  const res1 = appendOpenQuestionToMarkdown(bodyWithout, 'Which DB should we choose?');
  assert.ok(res1.includes('### Open Questions:'));
  assert.ok(res1.includes('- [ ] Which DB should we choose?'));

  const bodyWith = `### Description\nDetails.\n\n### Open Questions:\n- [ ] First question?`;
  const res2 = appendOpenQuestionToMarkdown(bodyWith, 'Second question?');
  assert.ok(res2.includes('- [ ] First question?'));
  assert.ok(res2.includes('- [ ] Second question?'));
  // Ensure not creating duplicate headers
  const headerCount = (res2.match(/### Open Questions:/g) || []).length;
  assert.equal(headerCount, 1);
});

test('serializeDraftQuestions formats draft questions into markdown section', () => {
  const questions = ['Is this backwards compatible?', 'What is the fallback UI?'];
  const res = serializeDraftQuestions('Feature overview text.', questions);
  assert.ok(res.includes('Feature overview text.'));
  assert.ok(res.includes('### Open Questions:'));
  assert.ok(res.includes('- [ ] Is this backwards compatible?'));
  assert.ok(res.includes('- [ ] What is the fallback UI?'));
});

test('isVagueIdea flags issues with unresolved open questions even if long description', () => {
  const longBodyWithQuestions = `This is a long description with lots of words exceeding the twenty word threshold clearly explaining the overall architecture.`;
  const issueWithQuestions = {
    body: longBodyWithQuestions,
    subtasks: [{ text: 'Step 1', completed: false }],
    openQuestions: [{ text: 'Open question?', completed: false }],
  };
  assert.equal(isVagueIdea(issueWithQuestions), true);

  const issueWithResolvedQuestions = {
    body: longBodyWithQuestions,
    subtasks: [{ text: 'Step 1', completed: false }],
    openQuestions: [{ text: 'Resolved question?', completed: true }],
  };
  assert.equal(isVagueIdea(issueWithResolvedQuestions), false);
});

test('formatQuestionBadge generates accurate badge states for open vs resolved questions', () => {
  assert.equal(formatQuestionBadge([]).html, '');

  const mixed = [
    { text: 'Q1', completed: true },
    { text: 'Q2', completed: false },
    { text: 'Q3', completed: false },
  ];
  const mixedBadge = formatQuestionBadge(mixed);
  assert.equal(mixedBadge.total, 3);
  assert.equal(mixedBadge.open, 2);
  assert.equal(mixedBadge.resolved, 1);
  assert.equal(mixedBadge.label, '2 open');
  assert.ok(mixedBadge.html.includes('is-open'));

  const allResolved = [
    { text: 'Q1', completed: true },
    { text: 'Q2', completed: true },
  ];
  const resolvedBadge = formatQuestionBadge(allResolved);
  assert.equal(resolvedBadge.open, 0);
  assert.equal(resolvedBadge.resolved, 2);
  assert.equal(resolvedBadge.label, '2 Qs resolved');
  assert.ok(resolvedBadge.html.includes('is-resolved'));
});

test('drafting prompt asks for a parseable Open Questions section', async () => {
  const { DEFAULT_AI_ISSUE_PROMPT, parseOpenQuestions } = await import('../panel/core.ts');
  assert.ok(DEFAULT_AI_ISSUE_PROMPT.includes('### Open Questions:'));
  // the wording the model is told to emit must round-trip through the parser
  const emitted = '### Open Questions:\n- [ ] Which database?\n- [ ] Auth model?';
  assert.equal(parseOpenQuestions(emitted).length, 2);
});

test('serializeDraftQuestions output round-trips back through parseOpenQuestions', async () => {
  const { serializeDraftQuestions, parseOpenQuestions } = await import('../panel/core.ts');
  const body = serializeDraftQuestions(serializeDraftQuestions('Overview text.', ['First?', 'Second?']), []);
  const parsed = parseOpenQuestions(body);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, 'First?');
  assert.equal(parsed[1].text, 'Second?');
  assert.equal(parsed.every((q) => q.completed === false), true);
});

test('answerOpenQuestionInMarkdown replaces target question with - [x] and *(Answer: ...)* note without corrupting other markdown', () => {
  const body = [
    '# Feature RFC',
    '',
    'Initial description of the task.',
    '',
    '### Actionable Subtasks Checklist:',
    '- [ ] Implement schema',
    '- [x] Write docs',
    '',
    '### Open Questions:',
    '- [ ] Should we use SQLite or PostgreSQL?',
    '- [x] Already resolved question *(Answer: Keep existing)*',
    '  - [ ] Indented question about migrations?',
    '',
    '### Next Steps',
    'Final notes.',
  ].join('\n');

  // Answer first unresolved question (idx 0)
  const answered0 = answerOpenQuestionInMarkdown(body, 0, 'PostgreSQL');
  assert.ok(answered0.includes('- [x] Should we use SQLite or PostgreSQL? *(Answer: PostgreSQL)*'));
  assert.ok(answered0.includes('# Feature RFC'));
  assert.ok(answered0.includes('### Actionable Subtasks Checklist:\n- [ ] Implement schema\n- [x] Write docs'));
  assert.ok(answered0.includes('  - [ ] Indented question about migrations?'));
  assert.ok(answered0.includes('### Next Steps\nFinal notes.'));

  // Answer second unresolved question (idx 1) - tests preservation of indentation
  const answered1 = answerOpenQuestionInMarkdown(body, 1, 'Run at startup');
  assert.ok(answered1.includes('  - [x] Indented question about migrations? *(Answer: Run at startup)*'));
  assert.ok(answered1.includes('- [ ] Should we use SQLite or PostgreSQL?'));
  assert.ok(answered1.includes('- [x] Already resolved question *(Answer: Keep existing)*'));

  // Handles whitespace trimming on answerText
  const answeredTrim = answerOpenQuestionInMarkdown(body, 0, '   Use Postgres with SSL   \n');
  assert.ok(answeredTrim.includes('- [x] Should we use SQLite or PostgreSQL? *(Answer: Use Postgres with SSL)*'));

  // Handles duplicate question texts: targets exact unresolved index
  const duplicateBody = '### Open Questions:\n- [ ] Duplicate question?\n- [ ] Duplicate question?';
  const answeredDup1 = answerOpenQuestionInMarkdown(duplicateBody, 1, 'Second answer');
  assert.equal(answeredDup1, '### Open Questions:\n- [ ] Duplicate question?\n- [x] Duplicate question? *(Answer: Second answer)*');

  // Re-answering a question updates cleanly without stacking *(Answer: ...)* notes
  const reAnswered = answerOpenQuestionInMarkdown(answeredDup1, 0, 'First answer');
  assert.equal(reAnswered, '### Open Questions:\n- [x] Duplicate question? *(Answer: First answer)*\n- [x] Duplicate question? *(Answer: Second answer)*');
  const updatedAnswer = answerOpenQuestionInMarkdown(
    '### Open Questions:\n- [ ] Duplicate question? *(Answer: First answer)*',
    0,
    'Updated answer'
  );
  assert.equal(updatedAnswer, '### Open Questions:\n- [x] Duplicate question? *(Answer: Updated answer)*');

  // Special characters and multiline answers
  const specialChars = answerOpenQuestionInMarkdown(
    '### Open Questions:\n- [ ] How to query?',
    0,
    'Use `SELECT * FROM tbl WHERE a > 1 & b < 2` (tested)'
  );
  assert.equal(
    specialChars,
    '### Open Questions:\n- [x] How to query? *(Answer: Use `SELECT * FROM tbl WHERE a > 1 & b < 2` (tested))*'
  );

  // Multiline answer is flattened to single line
  const multiline = answerOpenQuestionInMarkdown(
    '### Open Questions:\n- [ ] How to configure?',
    0,
    'Line one\nLine two\n\nLine three'
  );
  assert.equal(
    multiline,
    '### Open Questions:\n- [x] How to configure? *(Answer: Line one Line two Line three)*'
  );

  // Edge cases: out of bounds, null, undefined, empty
  assert.equal(answerOpenQuestionInMarkdown(body, -1, 'X'), body);
  assert.equal(answerOpenQuestionInMarkdown(body, 99, 'X'), body);
  assert.equal(answerOpenQuestionInMarkdown(null, 0, 'X'), '');
  assert.equal(answerOpenQuestionInMarkdown(undefined, 0, 'X'), '');
  assert.equal(answerOpenQuestionInMarkdown('', 0, 'X'), '');
});

test('parseOpenQuestions correctly parses answered questions and recognizes their completed state', () => {
  const markdown = [
    '### Open Questions:',
    '- [x] Which framework should we use? *(Answer: Preact)*',
    '- [ ] What is the auth timeout?',
    '- [x] Will this support dark mode? *(Answer: Yes via CSS variables)*',
  ].join('\n');

  const parsed = parseOpenQuestions(markdown);
  assert.equal(parsed.length, 3);

  // Question 0
  assert.equal(parsed[0].completed, true);
  assert.equal(parsed[0].text, 'Which framework should we use? *(Answer: Preact)*');

  // Question 1
  assert.equal(parsed[1].completed, false);
  assert.equal(parsed[1].text, 'What is the auth timeout?');

  // Question 2
  assert.equal(parsed[2].completed, true);
  assert.equal(parsed[2].text, 'Will this support dark mode? *(Answer: Yes via CSS variables)*');

  // Verification with badge formatting
  const badge = formatQuestionBadge(parsed);
  assert.equal(badge.total, 3);
  assert.equal(badge.open, 1);
  assert.equal(badge.resolved, 2);
  assert.equal(badge.label, '1 open');
});
