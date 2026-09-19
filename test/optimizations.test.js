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
