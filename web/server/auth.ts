// ==========================================
// Password sessions, CSRF binding and a small in-memory login limiter.
//
// The browser never receives the GitHub token. The session cookie is opaque,
// signed with BOARD_SESSION_SECRET, HttpOnly, Secure and SameSite=Strict.
// ==========================================

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SESSION_COOKIE = 'board_session';
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_ABSOLUTE_TTL_MS = THIRTY_DAYS_MS;
export const DEFAULT_IDLE_TTL_MS = THIRTY_DAYS_MS;
export const DEFAULT_MAX_SESSIONS = 50;
export const DEFAULT_LAST_SEEN_THROTTLE_MS = 60_000;

export interface SessionRecord {
  id: string;
  csrfToken: string;
  ip: string | null;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

export interface CreatedSession {
  id: string;
  cookieValue: string;
  csrfToken: string;
  maxAgeSeconds: number;
}

interface StoredSession {
  passwordFingerprint: string;
  ip: string | null;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  lastSavedAt?: number;
}

interface PersistedSessionsData {
  version: 1;
  sessions: Record<
    string,
    {
      passwordFingerprint: string;
      ip: string | null;
      createdAt: number;
      lastSeenAt: number;
      expiresAt: number;
    }
  >;
}

export interface SessionStoreOptions {
  secret: string;
  passwordHash?: string;
  passwordFingerprint?: string;
  filePath?: string;
  absoluteTtlMs?: number;
  idleTtlMs?: number;
  maxSessions?: number;
  lastSeenThrottleMs?: number;
  now?: () => number;
}

export function deriveCsrfToken(secret: string, id: string): string {
  return createHmac('sha256', secret).update(`csrf:${id}`).digest('hex');
}

export function computePasswordFingerprint(secret: string, passwordOrHash: string): string {
  return createHmac('sha256', secret).update(`board_pwd_fp:${passwordOrHash}`).digest('hex');
}

function sign(secret: string, id: string): string {
  return createHmac('sha256', secret).update(`session:${id}`).digest('base64url');
}

function safeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export class SessionStore {
  private readonly secret: string;
  private readonly passwordFingerprint: string;
  private readonly filePath?: string;
  private readonly absoluteTtlMs: number;
  private readonly idleTtlMs: number;
  private readonly maxSessions: number;
  private readonly lastSeenThrottleMs: number;
  private readonly now: () => number;
  private readonly sessions = new Map<string, StoredSession>();

  constructor(options: SessionStoreOptions) {
    this.secret = options.secret;
    this.passwordFingerprint =
      options.passwordFingerprint ??
      (options.passwordHash
        ? computePasswordFingerprint(this.secret, options.passwordHash)
        : computePasswordFingerprint(this.secret, 'none'));
    this.filePath = options.filePath;
    this.absoluteTtlMs = options.absoluteTtlMs ?? DEFAULT_ABSOLUTE_TTL_MS;
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.lastSeenThrottleMs = options.lastSeenThrottleMs ?? DEFAULT_LAST_SEEN_THROTTLE_MS;
    this.now = options.now ?? Date.now;

    this.load();
  }

  get maxAgeSeconds(): number {
    return Math.max(1, Math.floor(this.absoluteTtlMs / 1000));
  }

  get size(): number {
    this.sweep();
    return this.sessions.size;
  }

  private hashId(id: string): string {
    return createHash('sha256').update(id).digest('hex');
  }

  private load(): void {
    if (!this.filePath) return;
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || typeof data.sessions !== 'object' || Array.isArray(data.sessions)) {
        return;
      }
      const now = this.now();
      let pruned = false;
      for (const [idHash, rawEntry] of Object.entries(data.sessions)) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
          pruned = true;
          continue;
        }
        const entry = rawEntry as Partial<StoredSession>;
        if (
          typeof entry.createdAt !== 'number' ||
          typeof entry.expiresAt !== 'number' ||
          typeof entry.lastSeenAt !== 'number'
        ) {
          pruned = true;
          continue;
        }
        if (!/^[a-f0-9]{64}$/.test(idHash)) {
          pruned = true;
          continue;
        }
        if (
          typeof entry.passwordFingerprint !== 'string' ||
          !safeEqualStrings(entry.passwordFingerprint, this.passwordFingerprint)
        ) {
          pruned = true;
          continue;
        }

        if (now >= entry.expiresAt || now - entry.lastSeenAt >= this.idleTtlMs) {
          pruned = true;
          continue;
        }

        this.sessions.set(idHash, {
          passwordFingerprint: entry.passwordFingerprint,
          ip: typeof entry.ip === 'string' ? entry.ip : null,
          createdAt: entry.createdAt,
          lastSeenAt: entry.lastSeenAt,
          expiresAt: entry.expiresAt,
          lastSavedAt: entry.lastSeenAt,
        });
      }
      if (pruned) {
        this.persist();
      }
    } catch {
      this.sessions.clear();
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    try {
      const data: PersistedSessionsData = {
        version: 1,
        sessions: {},
      };
      for (const [idHash, record] of this.sessions) {
        data.sessions[idHash] = {
          passwordFingerprint: record.passwordFingerprint,
          ip: record.ip,
          createdAt: record.createdAt,
          lastSeenAt: record.lastSeenAt,
          expiresAt: record.expiresAt,
        };
      }
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      const json = JSON.stringify(data, null, 2);
      const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomBytes(6).toString('hex')}.tmp`;
      fs.writeFileSync(tmpPath, json, { mode: 0o600 });
      try {
        fs.chmodSync(tmpPath, 0o600);
      } catch {}
      fs.renameSync(tmpPath, this.filePath);
    } catch {
      // Do not crash on disk errors
    }
  }

  create(ip: string | null = null): CreatedSession {
    this.sweep();
    while (this.sessions.size >= this.maxSessions) {
      const oldestKey = this.sessions.keys().next().value;
      if (!oldestKey) break;
      this.sessions.delete(oldestKey);
    }
    const now = this.now();
    const id = randomBytes(24).toString('base64url');
    const csrfToken = deriveCsrfToken(this.secret, id);
    const idHash = this.hashId(id);
    this.sessions.set(idHash, {
      passwordFingerprint: this.passwordFingerprint,
      ip,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + this.absoluteTtlMs,
      lastSavedAt: now,
    });
    this.persist();
    return {
      id,
      cookieValue: `${id}.${sign(this.secret, id)}`,
      csrfToken,
      maxAgeSeconds: this.maxAgeSeconds,
    };
  }

  get(cookieValue: string | null | undefined): SessionRecord | null {
    if (!cookieValue || typeof cookieValue !== 'string') return null;
    const dot = cookieValue.lastIndexOf('.');
    if (dot <= 0) return null;
    const id = cookieValue.slice(0, dot);
    const signature = cookieValue.slice(dot + 1);
    if (!safeEqualStrings(signature, sign(this.secret, id))) return null;

    const idHash = this.hashId(id);
    const record = this.sessions.get(idHash);
    if (!record) return null;

    if (
      !record.passwordFingerprint ||
      !safeEqualStrings(record.passwordFingerprint, this.passwordFingerprint)
    ) {
      this.sessions.delete(idHash);
      this.persist();
      return null;
    }

    const now = this.now();
    if (now >= record.expiresAt || now - record.lastSeenAt >= this.idleTtlMs) {
      this.sessions.delete(idHash);
      this.persist();
      return null;
    }

    record.lastSeenAt = now;
    this.sessions.delete(idHash);
    this.sessions.set(idHash, record);

    if (!record.lastSavedAt || now - record.lastSavedAt >= this.lastSeenThrottleMs) {
      record.lastSavedAt = now;
      this.persist();
    }

    return {
      id,
      csrfToken: deriveCsrfToken(this.secret, id),
      ip: record.ip,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
      expiresAt: record.expiresAt,
    };
  }

  destroy(cookieValue: string | null | undefined): void {
    if (!cookieValue) return;
    const dot = cookieValue.lastIndexOf('.');
    if (dot <= 0) return;
    const id = cookieValue.slice(0, dot);
    const signature = cookieValue.slice(dot + 1);
    if (!safeEqualStrings(signature, sign(this.secret, id))) return;
    const idHash = this.hashId(id);
    if (this.sessions.has(idHash)) {
      this.sessions.delete(idHash);
      this.persist();
    }
  }

  sweep(): void {
    const now = this.now();
    let removed = false;
    for (const [idHash, record] of this.sessions) {
      if (
        now >= record.expiresAt ||
        now - record.lastSeenAt >= this.idleTtlMs ||
        !record.passwordFingerprint ||
        !safeEqualStrings(record.passwordFingerprint, this.passwordFingerprint)
      ) {
        this.sessions.delete(idHash);
        removed = true;
      }
    }
    if (removed) {
      this.persist();
    }
  }
}

export function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ].join('; ');
}

export function buildClearCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=0',
  ].join('; ');
}

export function parseCookieHeader(header: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    const raw = part.slice(index + 1).trim();
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
    if (!(name in out)) out[name] = value;
  }
  return out;
}

export function csrfMatches(expected: string | undefined, provided: string | undefined): boolean {
  if (!expected || !provided) return false;
  return safeEqualStrings(provided, expected);
}

export interface LimiterVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

export const DEFAULT_MAX_LIMITER_ENTRIES = 1000;

interface LoginRateLimiterOptions {
  maxFailures?: number;
  windowMs?: number;
  maxEntries?: number;
  now?: () => number;
}

/**
 * Sliding-window limiter for failed logins.
 *
 * Blocked clients are refused early with 429 before password verification
 * occurs. Cooldown is bounded to at most 60 seconds without permanent lockout.
 */
export class LoginRateLimiter {
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly failures = new Map<string, number[]>();

  constructor(options: LoginRateLimiterOptions = {}) {
    this.maxFailures = options.maxFailures ?? 5;
    this.windowMs = Math.min(options.windowMs ?? 60_000, 60_000);
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_LIMITER_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.failures.size;
  }

  private prune(key: string): number[] {
    const list = this.failures.get(key);
    if (!list) return [];
    const now = this.now();
    const cutoff = now - this.windowMs;
    let firstValid = 0;
    while (firstValid < list.length && list[firstValid] <= cutoff) {
      firstValid += 1;
    }
    if (firstValid === list.length) {
      this.failures.delete(key);
      return [];
    }
    const recent = firstValid === 0 ? list : list.slice(firstValid);
    this.failures.set(key, recent);
    return recent;
  }

  check(key: string): LimiterVerdict {
    const recent = this.prune(key);
    if (recent.length < this.maxFailures) return { allowed: true, retryAfterSeconds: 0 };
    const oldest = recent[0];
    const waitMs = Math.max(0, oldest + this.windowMs - this.now());
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.min(60, Math.ceil(waitMs / 1000))) };
  }

  recordFailure(key: string): void {
    const recent = this.prune(key);
    if (!this.failures.has(key) && this.failures.size >= this.maxEntries) {
      const oldestKey = this.failures.keys().next().value;
      if (oldestKey) this.failures.delete(oldestKey);
    }
    recent.push(this.now());
    this.failures.delete(key);
    this.failures.set(key, recent);
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }

  reset(): void {
    this.failures.clear();
  }
}
