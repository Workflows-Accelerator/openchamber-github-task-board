import test from 'node:test';
import assert from 'node:assert/strict';

export function matchProjectByDirectory(projects, targetDir) {
  if (!targetDir || !projects || projects.length === 0) return null;
  // Longest-prefix match: sort by directory path length descending
  const sorted = [...projects].sort((a, b) => (b.directory?.length || 0) - (a.directory?.length || 0));
  return sorted.find((p) => {
    if (!p.directory) return false;
    const cleanP = p.directory.replace(/\/+$/, '');
    const cleanT = targetDir.replace(/\/+$/, '');
    return cleanP === cleanT || cleanT.startsWith(cleanP + '/');
  }) || null;
}

test('longest-prefix match prioritizes child project over root /workspace', () => {
  const projects = [
    { id: 'root', name: 'workspace', directory: '/workspace' },
    { id: 'cmp', name: 'cmp', directory: '/workspace/clients/PARRIS/cmp' },
    { id: 'cfg', name: 'opencode-config', directory: '/workspace/opencode-config' },
  ];

  assert.equal(matchProjectByDirectory(projects, '/workspace/clients/PARRIS/cmp')?.id, 'cmp');
  assert.equal(matchProjectByDirectory(projects, '/workspace/clients/PARRIS/cmp/subfolder')?.id, 'cmp');
  assert.equal(matchProjectByDirectory(projects, '/workspace/opencode-config')?.id, 'cfg');
  assert.equal(matchProjectByDirectory(projects, '/workspace')?.id, 'root');
  assert.equal(matchProjectByDirectory(projects, '/workspace/unmatched-dir')?.id, 'root');
});

test('issue cache returns cached issues within TTL and expires after TTL', () => {
  const cache = new Map();
  const now = Date.now();

  function getCachedIssues(repo, currentTime) {
    const entry = cache.get(repo);
    if (!entry) return null;
    if (currentTime - entry.timestamp > 60000) {
      cache.delete(repo);
      return null;
    }
    return entry.issues;
  }

  cache.set('owner/repo', { issues: [{ number: 1, title: 'Test' }], timestamp: now });

  assert.deepEqual(getCachedIssues('owner/repo', now + 10000), [{ number: 1, title: 'Test' }]);
  assert.equal(getCachedIssues('owner/repo', now + 70000), null);
});

export function extractWorktreeName(wt) {
  if (!wt) return '';
  if (typeof wt === 'string') return wt;
  if (typeof wt === 'object') {
    return wt.name || wt.branch || wt.directory || '';
  }
  return '';
}

test('extractWorktreeName safely handles string, object, null, and undefined worktrees', () => {
  assert.equal(extractWorktreeName('issue-42-feat'), 'issue-42-feat');
  assert.equal(extractWorktreeName({ name: 'issue-42-feat', branch: 'issue-42-feat' }), 'issue-42-feat');
  assert.equal(extractWorktreeName({ branch: 'issue-99' }), 'issue-99');
  assert.equal(extractWorktreeName({ directory: '/workspace/worktree/test' }), '/workspace/worktree/test');
  assert.equal(extractWorktreeName(null), '');
  assert.equal(extractWorktreeName(undefined), '');
  assert.equal(extractWorktreeName(false), '');
});

test('session worktree matching handles object worktree without throwing s.worktree.includes error', () => {
  const sessions = [
    { id: '1', title: 'Session 1', worktree: { name: 'issue-12-bugfix', branch: 'issue-12-bugfix' } },
    { id: '2', title: 'Session 2', worktree: null },
    { id: '3', title: 'Session 3', worktree: 'issue-15-feature' },
  ];

  function matchSession(issueNum) {
    return sessions.find((s) => {
      const wtName = extractWorktreeName(s.worktree);
      return wtName && wtName.includes(`issue-${issueNum}`);
    }) || null;
  }

  assert.equal(matchSession(12)?.id, '1');
  assert.equal(matchSession(15)?.id, '3');
  assert.equal(matchSession(999), null);
});

export function buildIssueAttachPayload(issue) {
  const numStr = String(issue.number);
  const title = `#${issue.number} ${issue.title || ''}`.slice(0, 150);
  const url = (issue.html_url || '').slice(0, 1000);
  const text = `Context from GitHub Issue #${issue.number}: ${issue.title || ''}\n\n${issue.body || ''}`.slice(0, 15000);
  return {
    providerId: 'github-task-board',
    id: numStr,
    title,
    url,
    text,
    ...(issue.user?.login ? { author: String(issue.user.login) } : {}),
    data: {
      issueNumber: issue.number,
    },
  };
}

test('buildIssueAttachPayload constructs valid OpenChamber attach payload', () => {
  const issue = {
    number: 8,
    title: 'Quick attach chip feature',
    body: 'Details about the attach chip',
    html_url: 'https://github.com/owner/repo/issues/8',
    user: { login: 'octocat' },
  };

  const payload = buildIssueAttachPayload(issue);
  assert.equal(payload.providerId, 'github-task-board');
  assert.equal(payload.id, '8');
  assert.equal(payload.title, '#8 Quick attach chip feature');
  assert.equal(payload.url, 'https://github.com/owner/repo/issues/8');
  assert.ok(payload.text.includes('Context from GitHub Issue #8'));
  assert.ok(payload.text.includes('Details about the attach chip'));
  assert.equal(payload.author, 'octocat');
  assert.deepEqual(payload.data, { issueNumber: 8 });
});

export function isIssueClosed(issue) {
  if (!issue) return false;
  if (typeof issue.state === 'string' && issue.state.toLowerCase() === 'closed') {
    return true;
  }
  if (issue.state_reason === 'completed') {
    return true;
  }
  const labelNames = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (
    labelNames.includes('status:done') ||
    labelNames.includes('status:closed') ||
    labelNames.includes('closed') ||
    labelNames.includes('done')
  ) {
    return true;
  }
  return false;
}

test('isIssueClosed identifies closed issues via state, state_reason, and labels', () => {
  assert.equal(isIssueClosed({ state: 'closed', labels: [] }), true);
  assert.equal(isIssueClosed({ state: 'CLOSED', labels: [] }), true);
  assert.equal(isIssueClosed({ state: 'open', state_reason: 'completed', labels: [] }), true);
  assert.equal(isIssueClosed({ state: 'open', labels: [{ name: 'status:done' }] }), true);
  assert.equal(isIssueClosed({ state: 'open', labels: [{ name: 'closed' }] }), true);
  assert.equal(isIssueClosed({ state: 'open', labels: [{ name: 'status:todo' }] }), false);
  assert.equal(isIssueClosed(null), false);
});

export function resolveIssueColumn(issue, sessions = []) {
  if (isIssueClosed(issue)) {
    return 'done';
  }

  const labelNames = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labelNames.includes('status:in-review')) return 'in-review';

  // Check attached session
  const issueNumStr = String(issue.number);
  const session = sessions.find((s) => {
    if (s.items && s.items.some((it) => it.id === issueNumStr || it.data?.issueNumber === issue.number)) {
      return true;
    }
    if (s.title && s.title.includes(`#${issue.number}`)) {
      return true;
    }
    const wtName = extractWorktreeName(s.worktree);
    if (wtName && wtName.includes(`issue-${issue.number}`)) {
      return true;
    }
    return false;
  }) || null;

  // Explicit status:in-progress label
  if (labelNames.includes('status:in-progress')) {
    if (session && session.activity === 'idle') {
      return 'in-review';
    }
    return 'in-progress';
  }

  // Explicit status:todo label
  if (labelNames.includes('status:todo')) {
    if (session && (session.activity === 'running' || session.activity.startsWith('waiting'))) {
      return 'in-progress';
    }
    return 'todo';
  }

  // Explicit status:backlog label
  if (labelNames.includes('status:backlog')) {
    if (session && (session.activity === 'running' || session.activity.startsWith('waiting'))) {
      return 'in-progress';
    }
    return 'backlog';
  }

  // Explicit status:done label
  if (labelNames.includes('status:done')) {
    return 'done';
  }

  // Dynamic session detection for issues without explicit status labels
  if (session) {
    if (session.activity === 'running' || session.activity.startsWith('waiting')) {
      return 'in-progress';
    }
    if (session.activity === 'idle') {
      return 'in-review';
    }
  }

  // Unknown status (only show in 'all' view)
  return null;
}

test('resolveIssueColumn correctly resolves status and transitions idle sessions to in-review', () => {
  const idleSession = [{ id: 's1', title: 'Task #10', activity: 'idle' }];
  const runningSession = [{ id: 's2', title: 'Task #11', activity: 'running' }];

  // Issue with idle session goes to in-review rather than backlog
  const issueWithIdle = { number: 10, state: 'open', labels: [] };
  assert.equal(resolveIssueColumn(issueWithIdle, idleSession), 'in-review');

  // Issue marked status:in-progress with idle session goes to in-review
  const issueProgressIdle = { number: 10, state: 'open', labels: [{ name: 'status:in-progress' }] };
  assert.equal(resolveIssueColumn(issueProgressIdle, idleSession), 'in-review');

  // Issue with running session goes to in-progress
  const issueRunning = { number: 11, state: 'open', labels: [] };
  assert.equal(resolveIssueColumn(issueRunning, runningSession), 'in-progress');

  // Closed issue always goes to done
  const closedWithRunning = { number: 11, state: 'closed', labels: [] };
  assert.equal(resolveIssueColumn(closedWithRunning, runningSession), 'done');

  // Explicit todo label with idle session stays in todo
  const todoWithIdle = { number: 10, state: 'open', labels: [{ name: 'status:todo' }] };
  assert.equal(resolveIssueColumn(todoWithIdle, idleSession), 'todo');

  // Explicit backlog issue with status:backlog
  const backlogIssue = { number: 98, state: 'open', labels: [{ name: 'status:backlog' }] };
  assert.equal(resolveIssueColumn(backlogIssue, []), 'backlog');

  // Plain issue without status label or session has unknown status (null)
  const plain = { number: 99, state: 'open', labels: [] };
  assert.equal(resolveIssueColumn(plain, []), null);
});

export function resolveDefaultTab(issues, sessions = []) {
  if (!issues || issues.length === 0) return 'all';

  const hasReview = issues.some((i) => resolveIssueColumn(i, sessions) === 'in-review');
  if (hasReview) return 'in-review';

  const hasProgress = issues.some((i) => resolveIssueColumn(i, sessions) === 'in-progress');
  if (hasProgress) return 'in-progress';

  const hasTodo = issues.some((i) => resolveIssueColumn(i, sessions) === 'todo');
  if (hasTodo) return 'todo';

  const hasBacklog = issues.some((i) => resolveIssueColumn(i, sessions) === 'backlog');
  if (hasBacklog) return 'backlog';

  return 'all';
}

test('resolveDefaultTab prioritizes in-review > in-progress > todo > backlog > all', () => {
  const inReviewIssue = { number: 1, state: 'open', labels: [{ name: 'status:in-review' }] };
  const inProgressIssue = { number: 2, state: 'open', labels: [{ name: 'status:in-progress' }] };
  const todoIssue = { number: 3, state: 'open', labels: [{ name: 'status:todo' }] };
  const backlogIssue = { number: 4, state: 'open', labels: [{ name: 'status:backlog' }] };
  const doneIssue = { number: 5, state: 'closed', labels: [] };

  // 1. In review takes top priority
  assert.equal(resolveDefaultTab([doneIssue, backlogIssue, todoIssue, inProgressIssue, inReviewIssue]), 'in-review');

  // 2. In progress if no review
  assert.equal(resolveDefaultTab([doneIssue, backlogIssue, todoIssue, inProgressIssue]), 'in-progress');

  // 3. To do if no review or progress
  assert.equal(resolveDefaultTab([doneIssue, backlogIssue, todoIssue]), 'todo');

  // 4. Backlog if no review, progress, or todo
  assert.equal(resolveDefaultTab([doneIssue, backlogIssue]), 'backlog');

  // 5. All if only done issues or empty
  assert.equal(resolveDefaultTab([doneIssue]), 'all');
  assert.equal(resolveDefaultTab([]), 'all');
});

export function getNextColumn(current) {
  switch (current) {
    case 'backlog':
      return 'todo';
    case 'todo':
      return 'in-progress';
    case 'in-progress':
      return 'in-review';
    case 'in-review':
      return 'done';
    case 'done':
      return 'todo';
    default:
      return 'todo';
  }
}

export function getNextColumnAction(current) {
  switch (current) {
    case 'backlog':
      return { label: 'To Do', target: 'todo', icon: '→' };
    case 'todo':
      return { label: 'In Progress', target: 'in-progress', icon: '▶' };
    case 'in-progress':
      return { label: 'In Review', target: 'in-review', icon: '→' };
    case 'in-review':
      return { label: 'Done', target: 'done', icon: '✓' };
    case 'done':
      return { label: 'Reopen', target: 'todo', icon: '↺' };
    default:
      return { label: 'Next', target: 'todo', icon: '→' };
  }
}

export function isIssueArchived(issue) {
  if (!issue || !issue.labels) return false;
  return issue.labels.some((l) => {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    return name === 'archived' || name === 'archive' || name === 'status:archived';
  });
}

test('getNextColumn advances columns in proper pipeline sequence', () => {
  assert.equal(getNextColumn('backlog'), 'todo');
  assert.equal(getNextColumn('todo'), 'in-progress');
  assert.equal(getNextColumn('in-progress'), 'in-review');
  assert.equal(getNextColumn('in-review'), 'done');
  assert.equal(getNextColumn('done'), 'todo');
});

test('getNextColumnAction provides correct labels, icons, and targets', () => {
  assert.deepEqual(getNextColumnAction('backlog'), { label: 'To Do', target: 'todo', icon: '→' });
  assert.deepEqual(getNextColumnAction('todo'), { label: 'In Progress', target: 'in-progress', icon: '▶' });
  assert.deepEqual(getNextColumnAction('in-progress'), { label: 'In Review', target: 'in-review', icon: '→' });
  assert.deepEqual(getNextColumnAction('in-review'), { label: 'Done', target: 'done', icon: '✓' });
  assert.deepEqual(getNextColumnAction('done'), { label: 'Reopen', target: 'todo', icon: '↺' });
});

test('isIssueArchived accurately detects archived labels', () => {
  assert.equal(isIssueArchived({ labels: [{ name: 'archived' }] }), true);
  assert.equal(isIssueArchived({ labels: [{ name: 'archive' }] }), true);
  assert.equal(isIssueArchived({ labels: [{ name: 'status:archived' }] }), true);
  assert.equal(isIssueArchived({ labels: [{ name: 'bug' }] }), false);
  assert.equal(isIssueArchived({ labels: [] }), false);
  assert.equal(isIssueArchived(null), false);
});

export function prepareArchiveLabels(issue, sessions = []) {
  const currentCategory = resolveIssueColumn(issue, sessions) || 'todo';
  const existingNames = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || ''));
  const clean = existingNames.filter(
    (n) => !['archived', 'archive', 'status:archived'].includes(n.toLowerCase())
  );
  if (!clean.some((n) => n.startsWith('status:'))) {
    clean.push(`status:${currentCategory}`);
  }
  clean.push('archived');
  return {
    state: 'closed',
    labels: clean,
    fromCategory: currentCategory,
  };
}

export function prepareUnarchiveLabels(issue) {
  const existingNames = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || ''));
  const clean = existingNames.filter(
    (n) => !['archived', 'archive', 'status:archived'].includes(n.toLowerCase())
  );
  const statusLabel = clean.find((n) => n.startsWith('status:'));
  let targetCategory = 'todo';
  if (statusLabel) {
    targetCategory = statusLabel.replace('status:', '').trim() || 'todo';
  } else {
    clean.push('status:todo');
  }
  const state = targetCategory === 'done' ? 'closed' : 'open';
  return {
    state,
    labels: clean,
    targetCategory,
  };
}

test('archive and unarchive preserves and restores the original category', () => {
  // 1. Archiving an issue from in-progress preserves status:in-progress and closes issue
  const inProgressIssue = { number: 42, state: 'open', labels: [{ name: 'status:in-progress' }, { name: 'bug' }] };
  const archived = prepareArchiveLabels(inProgressIssue);
  assert.equal(archived.state, 'closed');
  assert.equal(archived.fromCategory, 'in-progress');
  assert.ok(archived.labels.includes('archived'));
  assert.ok(archived.labels.includes('status:in-progress'));

  // 2. Unarchiving restores the exact category it was in (in-progress) and opens issue
  const archivedIssueObj = { number: 42, state: 'closed', labels: archived.labels.map((n) => ({ name: n })) };
  const unarchived = prepareUnarchiveLabels(archivedIssueObj);
  assert.equal(unarchived.state, 'open');
  assert.equal(unarchived.targetCategory, 'in-progress');
  assert.ok(!unarchived.labels.includes('archived'));
  assert.ok(unarchived.labels.includes('status:in-progress'));

  // 3. Archiving and unarchiving an issue from backlog
  const backlogIssue = { number: 43, state: 'open', labels: [{ name: 'status:backlog' }] };
  const unarchivedBacklog = prepareUnarchiveLabels({
    number: 43,
    state: 'closed',
    labels: prepareArchiveLabels(backlogIssue).labels.map((n) => ({ name: n })),
  });
  assert.equal(unarchivedBacklog.targetCategory, 'backlog');
  assert.equal(unarchivedBacklog.state, 'open');
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

export function getIssueComplexity(issue) {
  if (!issue || !issue.labels) return null;
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    if (name === 'complexity:xl') return 'XL';
    if (name === 'complexity:l') return 'L';
    if (name === 'complexity:m') return 'M';
    if (name === 'complexity:s') return 'S';
    if (name === 'complexity:xs') return 'XS';
  }
  return null;
}

const PRIORITY_WEIGHTS = { critical: 4, important: 3, useful: 2, optional: 1 };
const COMPLEXITY_WEIGHTS = { XL: 5, L: 4, M: 3, S: 2, XS: 1 };

export function sortIssues(list, sortKey) {
  const copy = [...list];
  switch (sortKey) {
    case 'newest':
      return copy.sort((a, b) => b.number - a.number);
    case 'oldest':
      return copy.sort((a, b) => a.number - b.number);
    case 'priority':
      return copy.sort((a, b) => {
        const pA = PRIORITY_WEIGHTS[getIssuePriority(a)] || 0;
        const pB = PRIORITY_WEIGHTS[getIssuePriority(b)] || 0;
        return pB !== pA ? pB - pA : b.number - a.number;
      });
    case 'complexity':
      return copy.sort((a, b) => {
        const cA = COMPLEXITY_WEIGHTS[getIssueComplexity(a)] || 0;
        const cB = COMPLEXITY_WEIGHTS[getIssueComplexity(b)] || 0;
        return cB !== cA ? cB - cA : b.number - a.number;
      });
    case 'subtasks':
      return copy.sort((a, b) => {
        const remA = (a.subtasks || []).filter((s) => !s.completed).length;
        const remB = (b.subtasks || []).filter((s) => !s.completed).length;
        return remB !== remA ? remB - remA : b.number - a.number;
      });
    case 'title':
      return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    default:
      return copy;
  }
}

export function filterIssues(list, { query = '', priority = 'all', tag = 'all', showArchivedOnly = false }) {
  const q = query.toLowerCase().trim();
  return list.filter((issue) => {
    const isArch = isIssueArchived(issue);
    if (showArchivedOnly ? !isArch : isArch) return false;

    if (priority !== 'all') {
      const p = getIssuePriority(issue);
      if (p !== priority) return false;
    }

    if (tag !== 'all') {
      const hasTag = (issue.labels || []).some((l) => {
        const name = typeof l === 'string' ? l : l.name || '';
        return name === tag;
      });
      if (!hasTag) return false;
    }

    if (q) {
      const matchTitle = (issue.title || '').toLowerCase().includes(q);
      const matchNum = String(issue.number).includes(q);
      const matchLabel = (issue.labels || []).some((l) => {
        const name = typeof l === 'string' ? l : l.name || '';
        return name.toLowerCase().includes(q);
      });
      if (!matchTitle && !matchNum && !matchLabel) return false;
    }

    return true;
  });
}

test('sorting issues by newest, oldest, priority, and complexity', () => {
  const i1 = { number: 1, title: 'B', labels: [{ name: 'priority:optional' }, { name: 'complexity:XS' }] };
  const i2 = { number: 2, title: 'A', labels: [{ name: 'priority:critical' }, { name: 'complexity:XL' }] };
  const i3 = { number: 3, title: 'C', labels: [{ name: 'priority:important' }, { name: 'complexity:M' }] };

  assert.deepEqual(sortIssues([i1, i2, i3], 'newest').map((i) => i.number), [3, 2, 1]);
  assert.deepEqual(sortIssues([i1, i2, i3], 'oldest').map((i) => i.number), [1, 2, 3]);
  assert.deepEqual(sortIssues([i1, i2, i3], 'priority').map((i) => i.number), [2, 3, 1]);
  assert.deepEqual(sortIssues([i1, i2, i3], 'complexity').map((i) => i.number), [2, 3, 1]);
  assert.deepEqual(sortIssues([i1, i2, i3], 'title').map((i) => i.number), [2, 1, 3]);
});

test('filtering issues by priority, tag, and query', () => {
  const i1 = { number: 1, title: 'Fix bug', labels: [{ name: 'priority:critical' }, { name: 'frontend' }] };
  const i2 = { number: 2, title: 'Add feature', labels: [{ name: 'priority:useful' }, { name: 'backend' }] };
  const i3 = { number: 3, title: 'Archive me', labels: [{ name: 'archived' }] };

  // Filter priority
  assert.deepEqual(filterIssues([i1, i2, i3], { priority: 'critical' }).map((i) => i.number), [1]);
  // Filter tag
  assert.deepEqual(filterIssues([i1, i2, i3], { tag: 'backend' }).map((i) => i.number), [2]);
  // Archive filter
  assert.deepEqual(filterIssues([i1, i2, i3], { showArchivedOnly: true }).map((i) => i.number), [3]);
  assert.deepEqual(filterIssues([i1, i2, i3], { showArchivedOnly: false }).map((i) => i.number), [1, 2]);
});

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function getIssuePrimaryTag(issue) {
  if (!issue || !issue.labels) return 'task';
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    if (
      name &&
      !name.startsWith('status:') &&
      !name.startsWith('priority:') &&
      !name.startsWith('complexity:') &&
      !name.startsWith('theme:') &&
      !['archived', 'archive'].includes(name.toLowerCase())
    ) {
      return name;
    }
  }
  // Fallback to theme if present
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    if (name.startsWith('theme:')) {
      return name.replace('theme:', '');
    }
  }
  return 'task';
}

export function buildWorktreeBranchName({ issue, mode = 'issue', customTag }) {
  if (mode === 'tag') {
    const tag = customTag || getIssuePrimaryTag(issue);
    return `worktree-tag-${slugify(tag || 'task')}`.slice(0, 80);
  }
  const branchSlug = slugify(issue.title || 'task');
  return `issue-${issue.number}-${branchSlug}`.slice(0, 80);
}

export function buildLaunchSessionPayload({
  issue,
  projectId,
  useWorktree = false,
  branchName,
  baseBranch,
  prompt,
}) {
  const cleanBranch = branchName
    ? branchName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
    : undefined;

  return {
    projectId,
    worktree: useWorktree && cleanBranch ? { kind: 'new', name: cleanBranch, baseBranch } : false,
    providerId: 'github-task-board',
    id: String(issue.number),
    title: `#${issue.number} ${issue.title || ''}`.slice(0, 150),
    url: (issue.html_url || '').slice(0, 1000),
    text: prompt,
    data: {
      issueNumber: issue.number,
      ...(useWorktree && cleanBranch ? { branch: cleanBranch } : {}),
    },
  };
}

test('buildWorktreeBranchName generates tag-based and issue-based branch slugs', () => {
  const issueWithTag = {
    number: 12,
    title: 'Launch tasks directly in workspace with optional tag or issue worktree',
    labels: [{ name: 'frontend' }, { name: 'priority:critical' }],
  };
  // Tag-based
  assert.equal(buildWorktreeBranchName({ issue: issueWithTag, mode: 'tag' }), 'worktree-tag-frontend');
  // Issue-based
  assert.equal(
    buildWorktreeBranchName({ issue: issueWithTag, mode: 'issue' }),
    'issue-12-launch-tasks-directly-in-workspace-with-optional-tag-or-issue-worktree'
  );
  // Custom tag override
  assert.equal(
    buildWorktreeBranchName({ issue: issueWithTag, mode: 'tag', customTag: 'auth-flow' }),
    'worktree-tag-auth-flow'
  );
  // Issue with theme tag fallback
  const issueTheme = {
    number: 5,
    title: 'Session naming',
    labels: [{ name: 'theme:voice-supervisor' }, { name: 'priority:useful' }],
  };
  assert.equal(buildWorktreeBranchName({ issue: issueTheme, mode: 'tag' }), 'worktree-tag-voice-supervisor');
});

test('buildLaunchSessionPayload defaults to worktree: false (workspace-first)', () => {
  const issue = { number: 12, title: 'Test issue', html_url: 'https://github.com/test/issue/12' };
  const payloadDefault = buildLaunchSessionPayload({
    issue,
    projectId: 'proj-1',
    useWorktree: false,
    branchName: 'issue-12-test-issue',
    prompt: 'Implement feature',
  });
  // Must be false by default
  assert.equal(payloadDefault.worktree, false);
  assert.equal(payloadDefault.data.branch, undefined);
  assert.equal(payloadDefault.projectId, 'proj-1');

  // When worktree is opted-in
  const payloadWorktree = buildLaunchSessionPayload({
    issue,
    projectId: 'proj-1',
    useWorktree: true,
    branchName: 'worktree-tag-frontend',
    baseBranch: 'main',
    prompt: 'Implement feature in worktree',
  });
  assert.deepEqual(payloadWorktree.worktree, {
    kind: 'new',
    name: 'worktree-tag-frontend',
    baseBranch: 'main',
  });
  assert.equal(payloadWorktree.data.branch, 'worktree-tag-frontend');
});


