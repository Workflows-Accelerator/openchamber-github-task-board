import test from 'node:test';
import assert from 'node:assert/strict';

export function resolveRepoForProjectOrSession({
  currentDirectory,
  session,
  workspaceProjects,
  storedProjectRepos = {},
}) {
  // 1. Direct project match by directory
  const matchedProject = workspaceProjects.find(
    (p) => p.directory === currentDirectory || (currentDirectory && currentDirectory.startsWith(p.directory + '/'))
  );

  // 2. Check if the project has a detected git repo
  if (matchedProject && matchedProject.gitRepo) {
    return {
      project: matchedProject,
      repo: `${matchedProject.gitRepo.owner}/${matchedProject.gitRepo.repo}`,
      source: 'project-git-remote',
    };
  }

  // 3. Check if the project has a user-linked repo in storage
  if (matchedProject && storedProjectRepos[matchedProject.id]) {
    return {
      project: matchedProject,
      repo: storedProjectRepos[matchedProject.id],
      source: 'project-stored-link',
    };
  }

  // 4. Check if session has linked items or URL
  if (session && session.items) {
    for (const item of session.items) {
      if (item.url && item.url.includes('github.com/')) {
        const m = item.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (m) {
          return {
            project: matchedProject || null,
            repo: `${m[1]}/${m[2]}`,
            source: 'session-attached-item',
          };
        }
      }
    }
  }

  // 5. Unresolved: current project has no git repo or link
  return {
    project: matchedProject || null,
    repo: null,
    source: 'unresolved',
  };
}

test('resolves git repo automatically for git-backed project', () => {
  const projects = [
    { id: 'p1', name: 'cmp', directory: '/workspace/clients/PARRIS/cmp', gitRepo: { owner: 'Workflows-Accelerator', repo: 'cmp-repo' } },
    { id: 'p2', name: 'opencode-config', directory: '/workspace/opencode-config', gitRepo: null },
  ];
  const res = resolveRepoForProjectOrSession({
    currentDirectory: '/workspace/clients/PARRIS/cmp',
    session: null,
    workspaceProjects: projects,
  });
  assert.equal(res.repo, 'Workflows-Accelerator/cmp-repo');
  assert.equal(res.source, 'project-git-remote');
});

test('resolves stored linked repo for project without native git repo (e.g. opencode-config)', () => {
  const projects = [
    { id: 'p1', name: 'cmp', directory: '/workspace/clients/PARRIS/cmp', gitRepo: { owner: 'Workflows-Accelerator', repo: 'cmp-repo' } },
    { id: 'p2', name: 'opencode-config', directory: '/workspace/opencode-config', gitRepo: null },
  ];
  const res = resolveRepoForProjectOrSession({
    currentDirectory: '/workspace/opencode-config',
    session: null,
    workspaceProjects: projects,
    storedProjectRepos: {
      p2: 'Workflows-Accelerator/case-management-platform',
    },
  });
  assert.equal(res.repo, 'Workflows-Accelerator/case-management-platform');
  assert.equal(res.source, 'project-stored-link');
});

test('deduplicates project list by id and normalizes directory', () => {
  const list = [
    { id: 'p1', name: 'cmp', directory: '/workspace/clients/PARRIS/cmp' },
    { id: 'p1', name: 'cmp', directory: '/workspace/clients/PARRIS/cmp' },
    { id: 'p2', name: 'opencode-config', directory: '/workspace/opencode-config' },
  ];
  const unique = Array.from(new Map(list.map((p) => [p.id, p])).values());
  assert.equal(unique.length, 2);
  assert.equal(unique[0].name, 'cmp');
  assert.equal(unique[1].name, 'opencode-config');
});
