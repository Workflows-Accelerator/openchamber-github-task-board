import test from 'node:test';
import assert from 'node:assert/strict';

const checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;
const questionsSectionRegex = /^#{1,4}\s*(?:open\s+)?questions(?:\s*:)?/i;
const headingRegex = /^#{1,4}\s+/;
const explicitQuestionPrefixRegex = /^(\s*(?:\?|[-*+]\s*\[\s*[?xX ]\s*\]|\d+\.)\s*(?:\?|Q:|Question:)\s*)(.+)$/i;

function isQuestionLine(line, inQuestionsSection) {
  if (inQuestionsSection) {
    return checklistRegex.test(line);
  }
  return explicitQuestionPrefixRegex.test(line);
}

function parseOpenQuestions(body) {
  if (!body) return [];
  const lines = body.split('\n');
  const questions = [];
  let inQuestionsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headingRegex.test(line)) {
      inQuestionsSection = questionsSectionRegex.test(line);
      continue;
    }
    if (inQuestionsSection) {
      const match = line.match(checklistRegex);
      if (match) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed: match[2].toLowerCase() === 'x',
          text: match[4].trim(),
          rawLine: line,
        });
      }
    } else {
      const match = line.match(checklistRegex);
      if (match && /^\s*\[[ xX]\]\s*(?:\?|Q:|Question:)/i.test(line)) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed: match[2].toLowerCase() === 'x',
          text: match[4].replace(/^(?:\?|Q:|Question:)\s*/i, '').trim(),
          rawLine: line,
        });
      }
    }
  }
  return questions;
}

function parseSubtasks(body) {
  if (!body) return [];
  const lines = body.split('\n');
  const subtasks = [];
  let inQuestionsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headingRegex.test(line)) {
      inQuestionsSection = questionsSectionRegex.test(line);
      continue;
    }
    if (inQuestionsSection) {
      continue;
    }
    const match = line.match(checklistRegex);
    if (match) {
      // Don't treat explicit questions as subtasks
      if (/^\s*(?:[-*+]|\d+\.)\s*\[[ xX]\]\s*(?:\?|Q:|Question:)/i.test(line)) {
        continue;
      }
      subtasks.push({
        id: `task-${i}`,
        lineIndex: i,
        completed: match[2].toLowerCase() === 'x',
        text: match[4].trim(),
        rawLine: line,
      });
    }
  }
  return subtasks;
}

function updateSubtaskInMarkdown(body, lineIndex, completed) {
  const lines = body.split('\n');
  if (lineIndex >= 0 && lineIndex < lines.length) {
    const match = lines[lineIndex].match(checklistRegex);
    if (match) {
      const mark = completed ? 'x' : ' ';
      lines[lineIndex] = `${match[1]}${mark}${match[3]}${match[4]}`;
    }
  }
  return lines.join('\n');
}

function updateOpenQuestionInMarkdown(body, lineIndex, completed) {
  return updateSubtaskInMarkdown(body, lineIndex, completed);
}

function appendSubtaskToMarkdown(body, text) {
  const cleanText = text.trim();
  if (!cleanText) return body;
  const suffix = `\n- [ ] ${cleanText}`;
  return body ? `${body.trimEnd()}${suffix}` : `- [ ] ${cleanText}`;
}

function appendOpenQuestionToMarkdown(body, text) {
  const cleanText = text.trim();
  if (!cleanText) return body;
  if (!body) {
    return `### Open Questions:\n- [ ] ${cleanText}`;
  }
  const lines = body.split('\n');
  let qHeaderIndex = -1;
  let nextHeaderIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (questionsSectionRegex.test(lines[i])) {
      qHeaderIndex = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (headingRegex.test(lines[j])) {
          nextHeaderIndex = j;
          break;
        }
      }
      break;
    }
  }

  if (qHeaderIndex !== -1) {
    if (nextHeaderIndex !== -1) {
      // Insert right before next heading
      lines.splice(nextHeaderIndex, 0, `- [ ] ${cleanText}`);
      return lines.join('\n');
    } else {
      // Append at end of questions section
      return `${body.trimEnd()}\n- [ ] ${cleanText}`;
    }
  }
  return `${body.trimEnd()}\n\n### Open Questions:\n- [ ] ${cleanText}`;
}

export function serializeDraftQuestions(body, questionTexts) {
  const cleanBody = (body || '').trim();
  const cleanQuestions = (questionTexts || [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);
  if (cleanQuestions.length === 0) return cleanBody;
  const questionsBlock = cleanQuestions.map((q) => `- [ ] ${q}`).join('\n');
  if (!cleanBody) {
    return `### Open Questions:\n\n${questionsBlock}`;
  }
  if (questionsSectionRegex.test(cleanBody)) {
    return `${cleanBody}\n${questionsBlock}`;
  }
  return `${cleanBody}\n\n### Open Questions:\n\n${questionsBlock}`;
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

export function serializeDraftSubtasks(body, subtaskTexts) {
  const cleanBody = (body || '').trim();
  const cleanTasks = (subtaskTexts || [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);

  if (cleanTasks.length === 0) {
    return cleanBody;
  }

  const checklistBlock = cleanTasks.map((t) => `- [ ] ${t}`).join('\n');
  if (!cleanBody) {
    return `### Actionable Subtasks Checklist:\n\n${checklistBlock}`;
  }
  if (cleanBody.includes('### Actionable Subtasks Checklist:')) {
    // Replace or append to existing section
    return `${cleanBody}\n${checklistBlock}`;
  }
  return `${cleanBody}\n\n### Actionable Subtasks Checklist:\n\n${checklistBlock}`;
}

export function isVagueIdea(issue) {
  if (!issue) return true;
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labels.includes('status:needs-alignment')) {
    return true;
  }
  const openQuestions = issue.openQuestions || [];
  if (openQuestions.some((q) => !q.completed)) {
    return true;
  }
  const subtaskCount = (issue.subtasks || []).length;
  const bodyText = (issue.body || '').trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  return subtaskCount === 0 && wordCount < 20;
}

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

export function formatQuestionBadge(openQuestions) {
  const list = openQuestions || [];
  const total = list.length;
  if (total === 0) {
    return { total: 0, resolved: 0, open: 0, label: '', className: '', html: '' };
  }
  const resolved = list.filter((q) => q.completed).length;
  const open = total - resolved;
  const isOpen = open > 0;
  const label = isOpen ? `${open} open` : `${total} Qs resolved`;
  const className = isOpen ? 'questions-prog is-open' : 'questions-prog is-resolved';
  const html = `<div class="${className}" title="${open} open, ${resolved} resolved"><span>${label}</span></div>`;
  return { total, resolved, open, label, className, html };
}

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
