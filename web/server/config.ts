// ==========================================
// Environment-only configuration for the standalone board server.
//
// Every failure names the offending variable and never echoes its value.
// There is no config file, no CLI flag and no client-supplied repository.
// ==========================================

import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 32 } as const;
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_SESSION_SECRET_LENGTH = 32;
export const DEFAULT_PORT = 8787;
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_GITHUB_API_BASE = 'https://api.github.com';

export interface RepoRef {
  owner: string;
  name: string;
  full: string;
}

export interface BoardConfig {
  githubToken: string;
  githubLogin: string;
  repo: RepoRef;
  passwordHash: string;
  passwordWasGenerated: boolean;
  sessionSecret: string;
  port: number;
  host: string;
  baseUrl: string | null;
  githubApiBase: string;
}

export class ConfigError extends Error {
  variable: string;

  constructor(variable: string, message: string) {
    super(message);
    this.name = 'ConfigError';
    this.variable = variable;
  }
}

const loginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const repoPattern = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;

function read(env: Record<string, string | undefined>, variable: string): string | undefined {
  const value = env[variable];
  if (typeof value !== 'string') return undefined;
  return value;
}

function requireValue(
  env: Record<string, string | undefined>,
  variable: string,
  invalidMessage: string,
  validate: (value: string) => boolean,
): string {
  const raw = read(env, variable);
  if (raw === undefined || raw.trim() === '') {
    throw new ConfigError(variable, `${variable} is required`);
  }
  if (!validate(raw)) {
    throw new ConfigError(variable, invalidMessage);
  }
  return raw;
}

function parseRepo(value: string): RepoRef {
  const match = repoPattern.exec(value);
  if (!match) {
    throw new ConfigError('BOARD_REPO', 'BOARD_REPO must look like owner/name');
  }
  const owner = match[1];
  const name = match[2];
  if (owner === '.' || owner === '..' || name === '.' || name === '..') {
    throw new ConfigError('BOARD_REPO', 'BOARD_REPO must look like owner/name');
  }
  return { owner, name, full: `${owner}/${name}` };
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_PORT;
  if (!/^\d{1,5}$/.test(value.trim())) {
    throw new ConfigError('BOARD_PORT', 'BOARD_PORT must be an integer between 1 and 65535');
  }
  const port = Number(value.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('BOARD_PORT', 'BOARD_PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseHost(value: string | undefined): string {
  if (value === undefined || value.trim() === '') return DEFAULT_HOST;
  const host = value.trim();
  if (isIP(host)) {
    return host;
  }
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    throw new ConfigError('BOARD_HOST', 'BOARD_HOST must be a valid host or IP address');
  }
  const hostnamePattern = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)*(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;
  if (!hostnamePattern.test(host)) {
    throw new ConfigError('BOARD_HOST', 'BOARD_HOST must be a valid host or IP address');
  }
  return host;
}

function parseBaseUrl(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError('BOARD_BASE_URL', 'BOARD_BASE_URL must be an absolute http(s) URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConfigError('BOARD_BASE_URL', 'BOARD_BASE_URL must be an absolute http(s) URL');
  }
  if (url.search || url.hash) {
    throw new ConfigError('BOARD_BASE_URL', 'BOARD_BASE_URL must not contain a query or fragment');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

const HASH_PREFIX = 'scrypt';

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

export function parsePasswordHash(stored: string): ParsedHash | null {
  if (typeof stored !== 'string') return null;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !isPowerOfTwo(N) || N < 1 << 14 || N > 1 << 20) return null;
  if (!Number.isInteger(r) || r < 1 || r > 16) return null;
  if (!Number.isInteger(p) || p < 1 || p > 16) return null;
  let salt: Buffer;
  let key: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    key = Buffer.from(parts[5], 'base64');
  } catch {
    return null;
  }
  if (salt.length < 16 || key.length < 32) return null;
  return { N, r, p, salt, key };
}

export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const { N, r, p, keylen } = SCRYPT_PARAMS;
  const key = scryptSync(password, salt, keylen, { N, r, p });
  return [HASH_PREFIX, N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  if (typeof password !== 'string' || password.length === 0) return false;
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  try {
    const derived = scryptSync(password, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });
    if (derived.length !== parsed.key.length) return false;
    return timingSafeEqual(derived, parsed.key);
  } catch {
    return false;
  }
}

export async function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length === 0) return false;
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  return new Promise<boolean>((resolve) => {
    scrypt(
      password,
      parsed.salt,
      parsed.key.length,
      { N: parsed.N, r: parsed.r, p: parsed.p },
      (err, derived) => {
        if (err || !derived || derived.length !== parsed.key.length) {
          resolve(false);
          return;
        }
        resolve(timingSafeEqual(derived, parsed.key));
      },
    );
  });
}

export function loadConfig(env: Record<string, string | undefined>): BoardConfig {
  const githubToken = requireValue(
    env,
    'BOARD_GITHUB_TOKEN',
    'BOARD_GITHUB_TOKEN must be a single token with no whitespace',
    (value) => value.trim().length >= 10 && !/\s/.test(value.trim()),
  );

  const githubLogin = requireValue(
    env,
    'BOARD_GITHUB_LOGIN',
    'BOARD_GITHUB_LOGIN must be a GitHub account name',
    (value) => loginPattern.test(value.trim()),
  );

  const repoRaw = requireValue(
    env,
    'BOARD_REPO',
    'BOARD_REPO must look like owner/name',
    (value) => repoPattern.test(value.trim()),
  );

  const sessionSecret = requireValue(
    env,
    'BOARD_SESSION_SECRET',
    `BOARD_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`,
    (value) => value.length >= MIN_SESSION_SECRET_LENGTH,
  );

  const passwordHashRaw = read(env, 'BOARD_PASSWORD_HASH');
  const passwordRaw = read(env, 'BOARD_PASSWORD');

  let passwordHash: string;
  let passwordWasGenerated = false;
  if (passwordHashRaw !== undefined && passwordHashRaw.trim() !== '') {
    if (!parsePasswordHash(passwordHashRaw.trim())) {
      throw new ConfigError(
        'BOARD_PASSWORD_HASH',
        'BOARD_PASSWORD_HASH must be a scrypt hash produced by web/tools/hash-password.mjs',
      );
    }
    passwordHash = passwordHashRaw.trim();
  } else if (passwordRaw !== undefined && passwordRaw !== '') {
    if (passwordRaw.length < MIN_PASSWORD_LENGTH) {
      throw new ConfigError(
        'BOARD_PASSWORD',
        `BOARD_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    passwordHash = hashPassword(passwordRaw);
    passwordWasGenerated = true;
  } else {
    throw new ConfigError(
      'BOARD_PASSWORD_HASH',
      'BOARD_PASSWORD_HASH or BOARD_PASSWORD is required',
    );
  }

  const port = parsePort(read(env, 'BOARD_PORT'));
  const host = parseHost(read(env, 'BOARD_HOST'));
  const baseUrl = parseBaseUrl(read(env, 'BOARD_BASE_URL'));
  const githubApiBase = read(env, 'BOARD_GITHUB_API_BASE') ?? DEFAULT_GITHUB_API_BASE;

  return {
    githubToken: githubToken.trim(),
    githubLogin: githubLogin.trim(),
    repo: parseRepo(repoRaw.trim()),
    passwordHash,
    passwordWasGenerated,
    sessionSecret,
    port,
    host,
    baseUrl,
    githubApiBase,
  };
}

export function describeConfig(config: BoardConfig): Record<string, unknown> {
  return {
    repo: config.repo.full,
    login: config.githubLogin,
    host: config.host,
    port: config.port,
    baseUrl: config.baseUrl,
    githubApiBase: config.githubApiBase,
    passwordSource: config.passwordWasGenerated ? 'BOARD_PASSWORD (hashed at startup)' : 'BOARD_PASSWORD_HASH',
  };
}
