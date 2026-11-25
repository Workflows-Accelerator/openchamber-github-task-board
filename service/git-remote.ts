import { execFile } from 'node:child_process';

/**
 * Host-side Git remote lookup for the task board.
 *
 * The panel reads `.git/config` through the guest `files` capability, which is
 * confined to the open project. Linked worktrees keep their remote in the
 * parent repository, so a worktree outside the open project is refused with
 * `BAD_PATH`. This service performs the same lookup with `git -C <dir>` and
 * never returns raw configuration, so an embedded token cannot leave the
 * service.
 */

export type GitRemoteStatus = 'ok' | 'no_remote' | 'not_git' | 'error';

export interface GitRemoteInfo {
  owner: string;
  repo: string;
  /** Credential-free remote URL (`userinfo` removed). */
  remoteUrl: string;
}

export interface GitRemoteLookup {
  /** `ok` when a GitHub `owner/repo` was resolved; `no_remote` includes non-GitHub remotes. */
  status: GitRemoteStatus;
  hasGit: boolean;
  remote: GitRemoteInfo | null;
  /** Stable, non-secret diagnostic for `error`; never command output. */
  reason?: string;
}

const MAX_DIRECTORY_CHARS = 4096;
const GIT_TIMEOUT_MS = 3000;
const GIT_MAX_BUFFER = 65536;

/**
 * A directory accepted by the lookup: absolute POSIX, Windows drive or UNC
 * path. Relative paths, empty values, NUL bytes and values starting with `-`
 * are refused so they can never become a `git` option or a shell injection.
 */
export function isSafeGitDirectory(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_DIRECTORY_CHARS) return false;
  if (value.includes('\0')) return false;
  if (value.startsWith('-')) return false;
  return /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\]|\/\/[^/])/.test(value);
}

const CREDENTIAL_PATTERN = /gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]+|x-access-token|:\/\/[^/@\s]+:[^/@\s]+@/i;

/**
 * Remove credentials from a remote URL. Handles URL forms (`url.username` and
 * `url.password` cleared, plus a strict userinfo regex as a second line of
 * defence) and SCP forms (`git@github.com:Owner/Repo.git`, which keeps only the
 * standard SSH user and refuses password-bearing userinfo).
 */
export function sanitizeRemoteUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /[\0\r\n]/.test(trimmed)) return null;

  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }
    if (!parsed.hostname) return null;
    parsed.username = '';
    parsed.password = '';
    // Belt and braces: URL serialization must not keep a userinfo segment.
    const serialized = parsed.toString().replace(/^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/@]*@/, '$1');
    if (/(?:\/\/)[^/@]*@/.test(serialized)) return null;
    if (CREDENTIAL_PATTERN.test(serialized)) return null;
    return serialized;
  }

  const scpMatch = trimmed.match(/^(?:([^@\s/]+)@)?([^@\s/:]+):(.+)$/);
  if (scpMatch) {
    const [, userinfo, host, path] = scpMatch;
    // A colon before `@` means a password, not an SSH user.
    if (userinfo && userinfo.includes(':')) return null;
    const candidate = `${userinfo ? `${userinfo}@` : ''}${host}:${path}`;
    if (CREDENTIAL_PATTERN.test(candidate)) return null;
    return candidate;
  }

  // A bare local path or unknown syntax: no credentials to preserve, but do
  // not hand back anything that looks like userinfo.
  if (trimmed.includes('@')) return null;
  if (CREDENTIAL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** Parse a sanitized remote URL into a GitHub `owner/repo`, if it is one. */
export function parseGitHubRemote(remoteUrl: unknown): { owner: string; repo: string } | null {
  if (typeof remoteUrl !== 'string' || !remoteUrl) return null;
  const value = remoteUrl.trim();

  const scpMatch = value.match(/^(?:[^@\s/]+@)?github\.com:([^\s/]+)\/([^\s/]+?)(?:\.git)?$/i);
  if (scpMatch) {
    return cleanOwnerRepo(scpMatch[1], scpMatch[2]);
  }

  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const parts = url.pathname.replace(/^\/+/, '').replace(/\.git$/, '').split('/');
    if (parts.length < 2) return null;
    return cleanOwnerRepo(parts[0], parts[1]);
  } catch {
    return null;
  }
}

function cleanOwnerRepo(owner: string, repo: string): { owner: string; repo: string } | null {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim().replace(/\.git$/, '');
  if (!cleanOwner || !cleanRepo) return null;
  if (cleanOwner === '.' || cleanOwner === '..' || cleanRepo === '.' || cleanRepo === '..') return null;
  return { owner: cleanOwner, repo: cleanRepo };
}

interface GitCommandResult {
  code: number | null;
  stdout: string;
  timedOut: boolean;
  unavailable: boolean;
}

function runGit(args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: GIT_MAX_BUFFER,
        windowsHide: true,
        encoding: 'utf8',
        shell: false,
      },
      (error, stdout) => {
        if (!error) {
          resolve({ code: 0, stdout: String(stdout || ''), timedOut: false, unavailable: false });
          return;
        }
        const err = error as NodeJS.ErrnoException & { code?: number | string | null; killed?: boolean; signal?: string | null };
        const timedOut = Boolean(err.killed) || err.signal === 'SIGTERM';
        const unavailable = err.code === 'ENOENT' || err.code === 'EACCES';
        const numericCode = typeof err.code === 'number' ? err.code : null;
        resolve({
          code: numericCode,
          stdout: String(stdout || ''),
          timedOut,
          unavailable,
        });
      }
    );
  });
}

/**
 * Resolve `{ hasGit, remote, status }` for a directory using `git -C <dir>`
 * with no shell and a 3 second deadline.
 */
export async function resolveGitRemote(directory: string): Promise<GitRemoteLookup> {
  if (!isSafeGitDirectory(directory)) {
    return { status: 'error', hasGit: false, remote: null, reason: 'invalid_path' };
  }

  const probe = await runGit(['-C', directory, 'rev-parse', '--git-dir']);

  if (probe.timedOut) {
    return { status: 'error', hasGit: false, remote: null, reason: 'timeout' };
  }
  if (probe.unavailable) {
    return { status: 'error', hasGit: false, remote: null, reason: 'git_unavailable' };
  }
  if (probe.code !== 0) {
    // `rev-parse` exits 128 outside a repository (including a missing directory).
    return { status: 'not_git', hasGit: false, remote: null, reason: 'not_git' };
  }

  const result = await runGit(['-C', directory, 'config', '--get', 'remote.origin.url']);

  if (result.timedOut) {
    return { status: 'error', hasGit: false, remote: null, reason: 'timeout' };
  }
  if (result.unavailable) {
    return { status: 'error', hasGit: false, remote: null, reason: 'git_unavailable' };
  }
  if (result.code === 0) {
    const remoteUrl = sanitizeRemoteUrl(result.stdout);
    const parsed = remoteUrl ? parseGitHubRemote(remoteUrl) : null;
    if (remoteUrl && parsed) {
      return {
        status: 'ok',
        hasGit: true,
        remote: { owner: parsed.owner, repo: parsed.repo, remoteUrl },
      };
    }
    // Git repository with a remote that is not a usable GitHub remote.
    return {
      status: 'no_remote',
      hasGit: true,
      remote: null,
      reason: remoteUrl ? 'unsupported_remote' : 'unreadable_remote',
    };
  }
  if (result.code === 1) {
    // `git config --get` exit 1: repository exists, key absent.
    return { status: 'no_remote', hasGit: true, remote: null, reason: 'no_origin' };
  }
  return { status: 'error', hasGit: true, remote: null, reason: 'git_failed' };
}
