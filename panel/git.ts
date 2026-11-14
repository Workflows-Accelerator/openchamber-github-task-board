// ==========================================
// Git Remote & Token Parser
// ==========================================

export function parseGitHubRemoteUrl(raw: string): { owner: string; repo: string } | null {
  if (!raw || typeof raw !== 'string') return null;
  const val = raw.trim();

  // SCP format: git@github.com:OWNER/REPO.git
  const scpMatch = val.match(/^(?:git@|ssh:\/\/git@)github\.com[:/]([^\s/]+)\/([^\s/.]+?)(\.git)?$/);
  if (scpMatch) return { owner: scpMatch[1], repo: scpMatch[2] };

  // HTTPS or standard URL format
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

export function parseGitRemoteFromConfig(configContent: string): { owner: string; repo: string } | null {
  if (!configContent || typeof configContent !== 'string') return null;
  const match = configContent.match(/\[remote\s+["\w-]+\][^\[]*?url\s*=\s*([^\r\n]+)/);
  if (match) {
    return parseGitHubRemoteUrl(match[1]);
  }
  return null;
}

export function extractGitHubTokenFromCredentials(content: string | null | undefined): string | null {
  if (!content || typeof content !== 'string') return null;
  const match = content.match(/https:\/\/(?:[^:]+?:)?(gh[pousr]_[A-Za-z0-9_]+)@github\.com/);
  if (match) return match[1];
  const generic = content.match(/gh[pousr]_[A-Za-z0-9_]+/);
  return generic ? generic[0] : null;
}

export function parseGitdirContent(content: string | null | undefined): string | null {
  if (!content || typeof content !== 'string') return null;
  const match = content.match(/^gitdir:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Normalize a filesystem path without touching the disk, so linked worktrees
 * inside or outside the open project compare and join consistently.
 * Accepts POSIX (`/...`), Windows drive (`C:/...`, `C:\\...`) and UNC
 * (`//server/share`, `\\\\server\\share`) paths; returns forward slashes and
 * collapses `.` / `..` segments. Paths that are not absolute stay relative.
 */
export function normalizeFileSystemPath(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const value = input.replace(/\\/g, '/');
  if (!value) return null;

  const unc = value.startsWith('//');
  const driveMatch = value.match(/^([A-Za-z]:)(?:\/|$)/);
  let prefix = '';
  let rest = value;

  if (driveMatch) {
    prefix = `${driveMatch[1]}/`;
    rest = value.slice(driveMatch[0].length);
  } else if (unc) {
    prefix = '//';
    rest = value.replace(/^\/+/, '');
  } else if (value.startsWith('/')) {
    prefix = '/';
    rest = value.replace(/^\/+/, '');
  }

  const segments: string[] = [];
  for (const segment of rest.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments[segments.length - 1] !== '..') {
        segments.pop();
      } else if (!prefix) {
        segments.push('..');
      }
      continue;
    }
    segments.push(segment);
  }

  const joined = segments.join('/');
  if (prefix === '//') return `//${joined}`;
  return `${prefix}${joined}`;
}

export function isAbsoluteFileSystemPath(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const normalized = value.replace(/\\/g, '/');
  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized);
}

export function joinFileSystemPath(baseDir: string, target: string): string {
  if (isAbsoluteFileSystemPath(target)) {
    return normalizeFileSystemPath(target) || target;
  }
  return normalizeFileSystemPath(`${baseDir}/${target}`) || target;
}

/** Resolve a `gitdir:` pointer against the directory that contains the `.git` file. */
export function resolveGitdirPath(gitdirContent: string | null | undefined, baseDir: string): string | null {
  const gitdir = parseGitdirContent(gitdirContent);
  if (!gitdir) return null;
  return joinFileSystemPath(baseDir, gitdir);
}

/**
 * The common Git directory holding `config`. Linked worktrees keep their
 * per-worktree directory under `<repo>/.git/worktrees/<name>`, while the
 * remote lives in `<repo>/.git`; a worktree's `commondir` file states it
 * explicitly when the layout differs.
 */
export function resolveCommonGitDir(gitdirPath: string, commondirContent?: string | null): string {
  const normalizedGitdir = normalizeFileSystemPath(gitdirPath) || gitdirPath;
  const rawCommonDir = typeof commondirContent === 'string' ? commondirContent.trim() : '';
  if (rawCommonDir) {
    return joinFileSystemPath(normalizedGitdir, rawCommonDir);
  }
  const markerIndex = normalizedGitdir.lastIndexOf('/.git/worktrees/');
  if (markerIndex >= 0) {
    return normalizeFileSystemPath(`${normalizedGitdir.slice(0, markerIndex)}/.git`) || normalizedGitdir;
  }
  return normalizedGitdir;
}

export function extractParentRepoRootFromGitdir(gitdirPath: string | null | undefined): string | null {
  const normalized = normalizeFileSystemPath(gitdirPath || '');
  if (!normalized) return null;
  const markerIndex = normalized.lastIndexOf('/.git/worktrees/');
  if (markerIndex < 0) return null;
  return normalized.slice(0, markerIndex) || null;
}

export function resolveParentRemoteFromGitdir(
  gitdirContent: string | null | undefined,
  readConfigFileFn: (path: string) => string | null
): { owner: string; repo: string } | null {
  const gitdir = parseGitdirContent(gitdirContent);
  if (!gitdir) return null;
  const path = isAbsoluteFileSystemPath(gitdir)
    ? (normalizeFileSystemPath(gitdir) || gitdir)
    : gitdir;
  const parentRepoRoot = extractParentRepoRootFromGitdir(path);
  if (!parentRepoRoot) return null;
  const configPath = joinFileSystemPath(resolveCommonGitDir(path), 'config');
  const config = readConfigFileFn(configPath) || readConfigFileFn(`${parentRepoRoot}/.git/config`);
  if (!config) return null;
  return parseGitRemoteFromConfig(config);
}


