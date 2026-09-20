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

export function updateComplexityLabel(currentLabels, newComplexity) {
  const cleanExisting = currentLabels
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter((name) => !name.toLowerCase().startsWith('complexity:'));

  if (newComplexity && typeof newComplexity === 'string' && newComplexity.trim() !== 'none') {
    cleanExisting.push(`complexity:${newComplexity.trim().toUpperCase()}`);
  }
  return cleanExisting;
}

export function findRelatedIssues(targetIssue, allIssues, limit = 4) {
  if (!targetIssue || !allIssues) return [];
  const targetNum = targetIssue.number;
  const targetLabels = new Set(
    (targetIssue.labels || [])
      .map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase())
      .filter((n) => !n.startsWith('status:') && n !== 'archived')
  );
  const targetWords = new Set(
    (targetIssue.title || '')
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter((w) => w.length > 3)
  );

  const scored = [];
  for (const other of allIssues) {
    if (other.number === targetNum) continue;

    let score = 0;
    const otherLabels = (other.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
    for (const l of otherLabels) {
      if (targetLabels.has(l)) score += 3;
    }

    // Check explicit mentions
    const otherText = `${other.title || ''} ${other.body || ''}`;
    if (otherText.includes(`#${targetNum}`)) score += 5;
    const targetText = `${targetIssue.title || ''} ${targetIssue.body || ''}`;
    if (targetText.includes(`#${other.number}`)) score += 5;

    // Check title keywords
    const otherWords = (other.title || '').toLowerCase().split(/[^a-z0-9_-]+/);
    for (const w of otherWords) {
      if (w.length > 3 && targetWords.has(w)) score += 1;
    }

    if (score > 0) {
      scored.push({ issue: other, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.issue.number - a.issue.number);
  return scored.slice(0, limit).map((s) => s.issue);
}

test('updateComplexityLabel safely replaces or clears complexity label', () => {
  const initial = ['status:todo', 'complexity:S', 'enhancement'];
  // Update to M
  const toM = updateComplexityLabel(initial, 'M');
  assert.deepEqual(toM, ['status:todo', 'enhancement', 'complexity:M']);
  // Clear complexity with 'none' or null
  const cleared = updateComplexityLabel(toM, 'none');
  assert.deepEqual(cleared, ['status:todo', 'enhancement']);
});

test('findRelatedIssues ranks issues by shared tags, mentions, and keyword overlap', () => {
  const target = {
    number: 10,
    title: 'optimize live call token usage with VAD silence gate',
    body: 'Related to #4',
    labels: [{ name: 'theme:voice-supervisor' }, { name: 'priority:critical' }],
  };

  const otherIssues = [
    { number: 4, title: 'custom live system prompt', labels: [{ name: 'theme:voice-supervisor' }] },
    { number: 11, title: 'extended thinking for live calls', labels: [{ name: 'theme:voice-supervisor' }] },
    { number: 2, title: 'unrelated task board test', labels: [{ name: 'theme:issue-lifecycle' }] },
  ];

  const related = findRelatedIssues(target, otherIssues);
  assert.equal(related.length, 2);
  // #4 has shared tag + explicit mention #4 -> top score
  assert.equal(related[0].number, 4);
  assert.equal(related[1].number, 11);
});
