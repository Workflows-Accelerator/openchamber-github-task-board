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
