import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createTestApp } from './test-app-harness.js';
import {
  parseGitdirContent,
  extractParentRepoRootFromGitdir,
  resolveParentRemoteFromGitdir,
  normalizeFileSystemPath,
  isAbsoluteFileSystemPath,
  joinFileSystemPath,
  resolveGitdirPath,
  resolveCommonGitDir,
} from '../panel/git.ts';
import {
  isSafeGitDirectory,
  sanitizeRemoteUrl,
  parseGitHubRemote,
  resolveGitRemote,
} from '../service/git-remote.ts';

export {
  parseGitdirContent,
  extractParentRepoRootFromGitdir,
  resolveParentRemoteFromGitdir,
  normalizeFileSystemPath,
  isAbsoluteFileSystemPath,
  joinFileSystemPath,
  resolveGitdirPath,
  resolveCommonGitDir,
};

const CREDENTIAL_TOKEN = 'ghp_SUPERSECRET123';
const REMOTE_URL_WITH_TOKEN = `https://x-access-token:${CREDENTIAL_TOKEN}@github.com/Workflows-Accelerator/sample.git`;

function createTempGitFixture(prefix = 'board-git-remote-') {
  const baseDir = fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir();
  const root = fs.mkdtempSync(path.join(baseDir, prefix));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Board Test');
  fs.writeFileSync(path.join(repo, 'README.md'), '# sample\n');
  fs.appendFileSync(
    path.join(repo, '.git', 'config'),
    `[remote "origin"]\n\turl = ${REMOTE_URL_WITH_TOKEN}\n`
  );
  git('add', '.');
  git('commit', '-qm', 'init');
  const worktree = path.join(root, 'worktree');
  git('worktree', 'add', '-q', worktree, '-b', 'board-test-worktree');
  return { root, repo, worktree };
}

function cleanupFixture(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {}
}

async function waitForCondition(predicate, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((err) => (err ? reject(err) : resolve(address.port)));
    });
    server.on('error', reject);
  });
}

function postJson(port, requestPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: raw }));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}


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

test('manifest validates declared capabilities under openchamber.contributes', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { parseManifest } = await import('/workspace/extensions/github-task-board/node_modules/@openchamber/sdk/dist/parse.js');
  const pkgPath = path.resolve(import.meta.dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const parsed = parseManifest(pkg);
  assert.equal(parsed.ok, true, 'parseManifest must succeed');
  assert.equal(pkg.version, '1.2.1');
  assert.deepEqual(pkg.openchamber.contributes.capabilities, ['sessions', 'prompt', 'files']);
});

test('fallback repository resolution discovers repo from currentDirectory when workspace projects list fails or is empty', async () => {
  const mockFiles = new Map();
  const mockConfig = `
[core]
\trepositoryformatversion = 0
\tfilemode = true
[remote "origin"]
\turl = git@github.com:fallback-owner/fallback-repo.git
`;
  mockFiles.set('/workspace/fallback-dir/.git/config', mockConfig);

  const { app, emitDirectory } = createTestApp({
    onRequest: (payload) => {
      // Simulate host.listProjects() (workspace-read) throwing capability or scan error
      if (payload && payload.kind === 'projects') {
        throw new Error('The user has not allowed this capability for the extension.');
      }
      if (payload && payload.path) {
        if (mockFiles.has(payload.path)) {
          return { path: payload.path, content: mockFiles.get(payload.path) };
        }
        throw new Error('File not found');
      }
      return { status: 200, body: '[]' };
    },
  });

  // Mock global fetch so issue loading does not stall or attempt network
  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => [],
    text: async () => '[]',
  });

  try {
    // Avoid background fetchIssues network attempt in test
    app.fetchIssues = async () => {};

    // Trigger directory change to /workspace/fallback-dir where git config exists
    await emitDirectory('/workspace/fallback-dir');

    // Wait for autoResolveRepoForActiveContext to finish
    await new Promise((r) => setTimeout(r, 60));

    // Verify that even with listProjects() failing, repo resolves from currentDirectory
    assert.equal(app.getState().currentRepo, 'fallback-owner/fallback-repo');
  } finally {
    global.fetch = origFetch;
  }
});

test('windows drive and UNC worktree gitdir paths resolve the parent common dir', () => {
  const forward = 'gitdir: C:/Users/dev/repo/.git/worktrees/wt\r\n';
  const parsed = parseGitdirContent(forward);
  assert.equal(parsed, 'C:/Users/dev/repo/.git/worktrees/wt');
  assert.equal(extractParentRepoRootFromGitdir(parsed), 'C:/Users/dev/repo');
  assert.equal(resolveCommonGitDir(parsed), 'C:/Users/dev/repo/.git');
  assert.equal(
    joinFileSystemPath(resolveCommonGitDir(parsed), 'config'),
    'C:/Users/dev/repo/.git/config'
  );

  assert.equal(
    normalizeFileSystemPath('C:\\Users\\dev\\repo\\.git\\worktrees\\wt'),
    'C:/Users/dev/repo/.git/worktrees/wt'
  );
  assert.equal(
    resolveGitdirPath('gitdir: C:\\Users\\dev\\repo\\.git\\worktrees\\wt', 'C:/Users/dev/elsewhere'),
    'C:/Users/dev/repo/.git/worktrees/wt'
  );
  assert.equal(resolveCommonGitDir(parsed, '../..'), 'C:/Users/dev/repo/.git');

  assert.equal(
    extractParentRepoRootFromGitdir('//server/share/repo/.git/worktrees/wt'),
    '//server/share/repo'
  );
  assert.equal(
    resolveCommonGitDir('//server/share/repo/.git/worktrees/wt'),
    '//server/share/repo/.git'
  );
  assert.equal(
    extractParentRepoRootFromGitdir('\\\\server\\share\\repo\\.git\\worktrees\\wt'),
    '//server/share/repo'
  );

  const reads = [];
  const remote = resolveParentRemoteFromGitdir(forward, (filePath) => {
    reads.push(filePath);
    return filePath === 'C:/Users/dev/repo/.git/config'
      ? '[remote "origin"]\n\turl = git@github.com:Windows-Owner/windows-repo.git\n'
      : null;
  });
  assert.deepEqual(remote, { owner: 'Windows-Owner', repo: 'windows-repo' });
  assert.ok(reads.includes('C:/Users/dev/repo/.git/config'));
  assert.ok(
    reads.every((filePath) => !filePath.startsWith('C:/Users/dev/repo/.git/worktrees/wt/')),
    'the worktree directory must never be prepended to the parent config path'
  );
});

test('sanitizeRemoteUrl removes embedded credentials and keeps GitHub remotes usable', () => {
  const sanitized = sanitizeRemoteUrl(REMOTE_URL_WITH_TOKEN);
  assert.equal(sanitized, 'https://github.com/Workflows-Accelerator/sample.git');
  assert.ok(!sanitized.includes(CREDENTIAL_TOKEN));
  assert.ok(!sanitized.includes('x-access-token'));

  assert.equal(
    sanitizeRemoteUrl(`https://${CREDENTIAL_TOKEN}@github.com/Workflows-Accelerator/sample.git`),
    'https://github.com/Workflows-Accelerator/sample.git'
  );
  assert.equal(
    sanitizeRemoteUrl('git@github.com:Workflows-Accelerator/sample.git'),
    'git@github.com:Workflows-Accelerator/sample.git'
  );
  assert.equal(sanitizeRemoteUrl('https://user:pass@github.com/o/r.git'), 'https://github.com/o/r.git');
  assert.equal(sanitizeRemoteUrl(`x-access-token:${CREDENTIAL_TOKEN}@github.com:o/r.git`), null);
  assert.deepEqual(parseGitHubRemote(sanitized), { owner: 'Workflows-Accelerator', repo: 'sample' });
});

test('isSafeGitDirectory accepts absolute paths only and refuses option-like values', () => {
  assert.equal(isSafeGitDirectory('/workspace/repo'), true);
  assert.equal(isSafeGitDirectory('C:/Users/dev/repo'), true);
  assert.equal(isSafeGitDirectory('C:\\Users\\dev\\repo'), true);
  assert.equal(isSafeGitDirectory('//server/share/repo'), true);
  assert.equal(isSafeGitDirectory('\\\\server\\share\\repo'), true);
  assert.equal(isSafeGitDirectory('relative/repo'), false);
  assert.equal(isSafeGitDirectory('-C'), false);
  assert.equal(isSafeGitDirectory('/tmp/bad\0dir'), false);
  assert.equal(isSafeGitDirectory(''), false);
  assert.equal(isSafeGitDirectory(null), false);
});

test('resolveGitRemote resolves a real linked worktree and never returns credentials', async () => {
  const fixture = createTempGitFixture();
  try {
    const fromRepo = await resolveGitRemote(fixture.repo);
    assert.equal(fromRepo.status, 'ok');
    assert.equal(fromRepo.hasGit, true);
    assert.deepEqual(
      { owner: fromRepo.remote.owner, repo: fromRepo.remote.repo, remoteUrl: fromRepo.remote.remoteUrl },
      {
        owner: 'Workflows-Accelerator',
        repo: 'sample',
        remoteUrl: 'https://github.com/Workflows-Accelerator/sample.git',
      }
    );

    const fromWorktree = await resolveGitRemote(fixture.worktree);
    assert.equal(fromWorktree.status, 'ok');
    assert.deepEqual(fromWorktree.remote, fromRepo.remote);
    const serialized = JSON.stringify(fromWorktree);
    assert.ok(!serialized.includes(CREDENTIAL_TOKEN));
    assert.ok(!serialized.includes('x-access-token'));

    const notGitDir = path.join(fixture.root, 'plain');
    fs.mkdirSync(notGitDir, { recursive: true });
    const notGit = await resolveGitRemote(notGitDir);
    assert.equal(notGit.status, 'not_git');
    assert.equal(notGit.hasGit, false);

    const invalid = await resolveGitRemote('-C');
    assert.equal(invalid.status, 'error');
    assert.equal(invalid.reason, 'invalid_path');
  } finally {
    cleanupFixture(fixture.root);
  }
});

test('POST /git-remote returns a sanitized lookup and refuses unsafe directories', async () => {
  const fixture = createTempGitFixture();
  const imported = await import('../service/main.ts');
  const server = imported.createCoordinatorHostServer('git-remote-test-token');
  const port = await getFreePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  try {
    const res = await postJson(port, '/git-remote', { directory: fixture.worktree }, 'git-remote-test-token');
    assert.equal(res.statusCode, 200);
    assert.ok(!res.body.includes(CREDENTIAL_TOKEN), 'response must not leak the token');
    assert.ok(!res.body.includes('x-access-token'), 'response must not leak userinfo');
    const payload = JSON.parse(res.body);
    assert.equal(payload.status, 'ok');
    assert.equal(payload.hasGit, true);
    assert.deepEqual(payload.remote, {
      owner: 'Workflows-Accelerator',
      repo: 'sample',
      remoteUrl: 'https://github.com/Workflows-Accelerator/sample.git',
    });

    const unauthorized = await postJson(port, '/git-remote', { directory: fixture.worktree });
    assert.equal(unauthorized.statusCode, 401);

    const relative = await postJson(port, '/git-remote', { directory: 'relative/repo' }, 'git-remote-test-token');
    assert.equal(relative.statusCode, 400);
    assert.equal(JSON.parse(relative.body).reason, 'invalid_path');

    const optionLike = await postJson(port, '/git-remote', { directory: '-C' }, 'git-remote-test-token');
    assert.equal(optionLike.statusCode, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    cleanupFixture(fixture.root);
  }
});

test('worktree outside the open project resolves its repo through the host service when readFile is refused', async () => {
  const fixture = createTempGitFixture('board-git-fallback-');
  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => [],
    text: async () => '[]',
  });

  try {
    const { app, emitDirectory } = createTestApp({
      onRequest: async (payload) => {
        if (payload && payload.path === '/git-remote') {
          const directory = JSON.parse(payload.body).directory;
          return { status: 200, body: JSON.stringify(await resolveGitRemote(directory)) };
        }
        if (payload && payload.path) {
          throw new Error('400 BAD_PATH: File path leaves the open project');
        }
        if (payload && payload.kind === 'projects') {
          throw new Error('The user has not allowed this capability for the extension.');
        }
        return { status: 200, body: '[]' };
      },
    });
    app.fetchIssues = async () => {};

    await emitDirectory(fixture.worktree);
    const resolved = await waitForCondition(
      () => app.getState().currentRepo === 'Workflows-Accelerator/sample'
    );

    assert.equal(resolved, true, 'worktree repo must resolve through the host service');
    assert.equal(app.getState().currentRepo, 'Workflows-Accelerator/sample');
  } finally {
    global.fetch = origFetch;
    cleanupFixture(fixture.root);
  }
});

test('a refused or unreachable service lookup is not cached in dirGitCache', async () => {
  const fixture = createTempGitFixture('board-git-cache-');
  let worktreeServiceCalls = 0;

  try {
    const { app } = createTestApp({
      onRequest: async (payload) => {
        if (payload && payload.path === '/git-remote') {
          const directory = JSON.parse(payload.body).directory;
          if (directory === fixture.worktree) {
            worktreeServiceCalls += 1;
            if (worktreeServiceCalls === 1) {
              throw new Error('NO_SERVICE');
            }
          }
          return { status: 200, body: JSON.stringify(await resolveGitRemote(directory)) };
        }
        if (payload && payload.path) {
          throw new Error('400 BAD_PATH: File path leaves the open project');
        }
        return { status: 200, body: '[]' };
      },
    });

    const first = await app.inspectGitConfigInDir(fixture.worktree);
    assert.equal(first, null, 'an unavailable service must not resolve a repo');
    assert.equal(app.__getDirGitCache().has(fixture.worktree), false, 'a refused read must not be cached');

    const second = await app.inspectGitConfigInDir(fixture.worktree);
    assert.deepEqual(second, { owner: 'Workflows-Accelerator', repo: 'sample' });
    assert.equal(worktreeServiceCalls, 2, 'the second call must retry the service');
    assert.deepEqual(app.__getDirGitCache().get(fixture.worktree), {
      owner: 'Workflows-Accelerator',
      repo: 'sample',
    });
  } finally {
    cleanupFixture(fixture.root);
  }
});


