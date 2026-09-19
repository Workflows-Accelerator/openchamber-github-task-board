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

test('appendSubtaskToMarkdown appends to existing body cleanly', () => {
  const body = `Initial text`;
  const res = appendSubtaskToMarkdown(body, 'New item');
  assert.equal(res, `Initial text\n- [ ] New item`);
});
