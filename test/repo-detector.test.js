import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGitdirContent,
  extractParentRepoRootFromGitdir,
  resolveParentRemoteFromGitdir,
} from '../panel/git.ts';

export { parseGitdirContent, extractParentRepoRootFromGitdir, resolveParentRemoteFromGitdir };

export function parseGitHubRemoteUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const val = raw.trim();
  const scpMatch = val.match(/^(?:git@|ssh:\/\/git@)github\.com[:/]([^\s/]+)\/([^\s/.]+?)(\.git)?$/);
  if (scpMatch) return { owner: scpMatch[1], repo: scpMatch[2] };
  try {
    const url = new URL(val);
    if (url.hostname === 'github.com') {
      const parts = url.pathname.replace(/^\/+|\.git$/g, '').split('/');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { owner: parts[0], repo: parts[1] };
      }
    }
  } catch {}
  return null;
}

export function parseGitRemoteFromConfig(configContent) {
  if (!configContent || typeof configContent !== 'string') return null;
  const match = configContent.match(/\[remote\s+["\w-]+\][^\[]*?url\s*=\s*([^\r\n]+)/);
  if (match) {
    return parseGitHubRemoteUrl(match[1]);
  }
  return null;
}

export function sanitizeHexColor(color) {
  if (!color || typeof color !== 'string') return null;
  const clean = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3,8}$/.test(clean)) {
    return `#${clean}`;
  }
  return null;
}

test('parseGitHubRemoteUrl parses various GitHub remote patterns', () => {
  assert.deepEqual(
    parseGitHubRemoteUrl('git@github.com:Workflows-Accelerator/devops-cockpit.git'),
    { owner: 'Workflows-Accelerator', repo: 'devops-cockpit' }
  );
  assert.deepEqual(
    parseGitHubRemoteUrl('https://x-access-token:ghp_12345@github.com/Workflows-Accelerator/case-management-platform.git'),
    { owner: 'Workflows-Accelerator', repo: 'case-management-platform' }
  );
  assert.deepEqual(
    parseGitHubRemoteUrl('https://github.com/openchamber/openchamber'),
    { owner: 'openchamber', repo: 'openchamber' }
  );
  assert.deepEqual(
    parseGitHubRemoteUrl('ssh://git@github.com/my-org/my-repo.git'),
    { owner: 'my-org', repo: 'my-repo' }
  );
  assert.equal(parseGitHubRemoteUrl('https://gitlab.com/other/project.git'), null);
});

test('parseGitRemoteFromConfig extracts remote url from git config', () => {
  const sampleConfig = `
[core]
	repositoryformatversion = 0
	filemode = true
[remote "origin"]
	url = https://x-access-token:secret@github.com/owner-test/repo-test.git
	fetch = +refs/heads/*:refs/remotes/origin/*
`;
  assert.deepEqual(parseGitRemoteFromConfig(sampleConfig), {
    owner: 'owner-test',
    repo: 'repo-test',
  });
});

test('sanitizeHexColor enforces valid hex colors and strips injection', () => {
  assert.equal(sanitizeHexColor('ff0000'), '#ff0000');
  assert.equal(sanitizeHexColor('#3b82f6'), '#3b82f6');
  assert.equal(sanitizeHexColor('red; background: url(x)'), null);
  assert.equal(sanitizeHexColor('"><script>alert(1)</script>'), null);
});

test('verifying gitdir parsing with /.git/worktrees/ resolves parent remote', () => {
  const gitdirContent = 'gitdir: /workspace/main-project/.git/worktrees/task-execution-issue-6-graph-delete-and-repo-detect\n';
  const parsedPath = parseGitdirContent(gitdirContent);
  assert.equal(parsedPath, '/workspace/main-project/.git/worktrees/task-execution-issue-6-graph-delete-and-repo-detect');

  const parentRepoRoot = extractParentRepoRootFromGitdir(parsedPath);
  assert.equal(parentRepoRoot, '/workspace/main-project');

  const mockParentConfig = `
[core]
\trepositoryformatversion = 0
\tfilemode = true
[remote "origin"]
\turl = git@github.com:Workflows-Accelerator/openchamber-github-task-board.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
`;

  const remote = resolveParentRemoteFromGitdir(gitdirContent, (filePath) => {
    if (filePath === '/workspace/main-project/.git/config') {
      return mockParentConfig;
    }
    return null;
  });

  assert.deepEqual(remote, {
    owner: 'Workflows-Accelerator',
    repo: 'openchamber-github-task-board',
  });
});

