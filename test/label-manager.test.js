import test from 'node:test';
import assert from 'node:assert/strict';

export function addLabelToIssue(currentLabels, newLabel) {
  const clean = newLabel.trim();
  if (!clean) return currentLabels;
  const existingNames = currentLabels.map((l) => (typeof l === 'string' ? l : l.name));
  if (existingNames.some((n) => n.toLowerCase() === clean.toLowerCase())) {
    return currentLabels;
  }
  return [...existingNames, clean];
}

export function removeLabelFromIssue(currentLabels, labelToRemove) {
  const target = labelToRemove.trim().toLowerCase();
  return currentLabels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((name) => name.toLowerCase() !== target);
}

test('addLabelToIssue adds unique label preserving existing', () => {
  const initial = [{ name: 'bug', color: 'ff0000' }, { name: 'status:todo' }];
  const updated = addLabelToIssue(initial, 'frontend');
  assert.deepEqual(updated, ['bug', 'status:todo', 'frontend']);
});

test('addLabelToIssue prevents duplicate labels case-insensitively', () => {
  const initial = [{ name: 'Bug' }];
  const updated = addLabelToIssue(initial, 'bug');
  assert.deepEqual(updated, initial);
});

test('removeLabelFromIssue removes target label while keeping status', () => {
  const initial = ['bug', 'status:in-progress', 'frontend'];
  const updated = removeLabelFromIssue(initial, 'bug');
  assert.deepEqual(updated, ['status:in-progress', 'frontend']);
});
