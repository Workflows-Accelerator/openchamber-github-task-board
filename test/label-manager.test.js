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

export function getIssuePriority(issue) {
  if (!issue || !issue.labels) return null;
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    if (name === 'priority:critical') return 'critical';
    if (name === 'priority:important') return 'important';
    if (name === 'priority:useful') return 'useful';
    if (name === 'priority:optional') return 'optional';
  }
  return null;
}

export function updatePriorityLabels(currentLabels, newPriority) {
  const cleanExisting = currentLabels
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter((name) => !name.toLowerCase().startsWith('priority:'));

  if (newPriority && typeof newPriority === 'string' && newPriority.trim().toLowerCase() !== 'none') {
    cleanExisting.push(`priority:${newPriority.trim().toLowerCase()}`);
  }
  return cleanExisting;
}

export function isSystemLabel(labelName) {
  if (!labelName || typeof labelName !== 'string') return false;
  const lower = labelName.trim().toLowerCase();
  return (
    lower.startsWith('status:') ||
    lower.startsWith('priority:') ||
    lower.startsWith('complexity:') ||
    lower.startsWith('theme:') ||
    lower === 'archived' ||
    lower === 'archive'
  );
}

export function filterDisplayLabels(labels) {
  if (!labels || !Array.isArray(labels)) return [];
  return labels.filter((l) => !isSystemLabel(typeof l === 'string' ? l : l.name || ''));
}

export function getIssueTheme(issue) {
  if (!issue || !issue.labels || issue.labels.length === 0) return 'No Theme';
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    if (name.toLowerCase().startsWith('theme:')) {
      const themeName = name.slice(6).trim();
      if (themeName) return themeName;
    }
  }
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    const lower = name.toLowerCase();
    if (
      name &&
      !lower.startsWith('status:') &&
      !lower.startsWith('priority:') &&
      !lower.startsWith('complexity:') &&
      !lower.startsWith('theme:') &&
      !['archived', 'archive'].includes(lower)
    ) {
      return name;
    }
  }
  return 'No Theme';
}

export function groupIssuesBy(issuesList, groupBy) {
  if (groupBy === 'priority') {
    const groups = [
      { id: 'critical', title: 'Critical', issues: [] },
      { id: 'important', title: 'Important', issues: [] },
      { id: 'useful', title: 'Useful', issues: [] },
      { id: 'optional', title: 'Optional', issues: [] },
      { id: 'none', title: 'No Priority', issues: [] },
    ];
    const map = new Map(groups.map((g) => [g.id, g]));
    for (const issue of issuesList) {
      const p = getIssuePriority(issue) || 'none';
      map.get(p)?.issues.push(issue);
    }
    return groups;
  }

  if (groupBy === 'theme' || groupBy === 'tag') {
    const map = new Map();
    for (const issue of issuesList) {
      const theme = getIssueTheme(issue);
      if (!map.has(theme)) {
        map.set(theme, { id: theme, title: theme, issues: [] });
      }
      map.get(theme).issues.push(issue);
    }
    if (map.size === 0) {
      map.set('No Theme', { id: 'No Theme', title: 'No Theme', issues: [] });
    }
    return Array.from(map.values());
  }

  // Default: groupBy === 'status'
  const groups = [
    { id: 'backlog', title: 'Backlog', issues: [] },
    { id: 'todo', title: 'To Do', issues: [] },
    { id: 'in-progress', title: 'In Progress', issues: [] },
    { id: 'in-review', title: 'In Review', issues: [] },
    { id: 'done', title: 'Done', issues: [] },
  ];
  const map = new Map(groups.map((g) => [g.id, g]));
  for (const issue of issuesList) {
    const statusLabel = (issue.labels || []).find((l) => (typeof l === 'string' ? l : l.name || '').startsWith('status:'));
    const col = statusLabel ? (typeof statusLabel === 'string' ? statusLabel : statusLabel.name || '').replace('status:', '') : 'backlog';
    if (map.has(col)) {
      map.get(col)?.issues.push(issue);
    }
  }
  return groups;
}

test('updatePriorityLabels replaces or removes priority labels', () => {
  const initial = ['status:todo', 'priority:useful', 'theme:voice-supervisor'];
  // Change to critical
  const toCritical = updatePriorityLabels(initial, 'critical');
  assert.deepEqual(toCritical, ['status:todo', 'theme:voice-supervisor', 'priority:critical']);
  // Remove priority with 'none'
  const cleared = updatePriorityLabels(toCritical, 'none');
  assert.deepEqual(cleared, ['status:todo', 'theme:voice-supervisor']);
});

test('groupIssuesBy groups issues correctly by priority', () => {
  const issues = [
    { number: 1, title: 'Bug A', labels: [{ name: 'priority:critical' }] },
    { number: 2, title: 'Bug B', labels: [{ name: 'priority:important' }] },
    { number: 3, title: 'Bug C', labels: [] },
  ];
  const groups = groupIssuesBy(issues, 'priority');
  assert.equal(groups[0].id, 'critical');
  assert.equal(groups[0].issues.length, 1);
  assert.equal(groups[0].issues[0].number, 1);

  assert.equal(groups[1].id, 'important');
  assert.equal(groups[1].issues.length, 1);

  assert.equal(groups[4].id, 'none');
  assert.equal(groups[4].issues.length, 1);
  assert.equal(groups[4].issues[0].number, 3);
});

test('getIssueTheme and groupIssuesBy group by theme with tag fallback', () => {
  const issues = [
    { number: 1, title: 'Auth Bug', labels: [{ name: 'theme:authentication' }, { name: 'priority:critical' }] },
    { number: 2, title: 'UI Alignment', labels: [{ name: 'frontend' }] },
    { number: 3, title: 'General Task', labels: [{ name: 'priority:useful' }] },
  ];

  assert.equal(getIssueTheme(issues[0]), 'authentication');
  assert.equal(getIssueTheme(issues[1]), 'frontend');
  assert.equal(getIssueTheme(issues[2]), 'No Theme');

  const groups = groupIssuesBy(issues, 'theme');
  assert.equal(groups.length, 3);
  assert.equal(groups[0].id, 'authentication');
  assert.equal(groups[0].issues[0].number, 1);
  assert.equal(groups[1].id, 'frontend');
  assert.equal(groups[1].issues[0].number, 2);
  assert.equal(groups[2].id, 'No Theme');
  assert.equal(groups[2].issues[0].number, 3);
});

test('filterDisplayLabels excludes extension system tags (status, priority, complexity, theme, archived)', () => {
  const mixedLabels = [
    { name: 'status:todo' },
    { name: 'priority:critical' },
    { name: 'complexity:M' },
    { name: 'theme:voice-supervisor' },
    { name: 'archived' },
    { name: 'bug' },
    { name: 'frontend' },
  ];

  const visible = filterDisplayLabels(mixedLabels);
  assert.equal(visible.length, 2);
  assert.equal(visible[0].name, 'bug');
  assert.equal(visible[1].name, 'frontend');
});
