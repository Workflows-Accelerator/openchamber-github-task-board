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
