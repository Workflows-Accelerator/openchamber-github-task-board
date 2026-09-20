import test from 'node:test';
import assert from 'node:assert/strict';

const checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;

function parseSubtasks(body) {
  if (!body) return [];
  const lines = body.split('\n');
  const subtasks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(checklistRegex);
    if (match) {
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

function appendSubtaskToMarkdown(body, text) {
  const cleanText = text.trim();
  if (!cleanText) return body;
  const suffix = `\n- [ ] ${cleanText}`;
  return body ? `${body.trimEnd()}${suffix}` : `- [ ] ${cleanText}`;
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
