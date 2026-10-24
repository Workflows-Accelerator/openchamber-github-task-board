// ==========================================
// Password sessions, CSRF binding and a small in-memory login limiter.
//
// The browser never receives the GitHub token. The session cookie is opaque,
// signed with BOARD_SESSION_SECRET, HttpOnly, Secure and SameSite=Strict.
// ==========================================

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'board_session';
export const DEFAULT_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
export const DEFAULT_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_MAX_SESSIONS = 50;

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

interface SessionStoreOptions {
  secret: string;
  absoluteTtlMs?: number;
  idleTtlMs?: number;
  maxSessions?: number;
  now?: () => number;
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
  private readonly absoluteTtlMs: number;
  private readonly idleTtlMs: number;
  private readonly maxSessions: number;
  private readonly now: () => number;
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(options: SessionStoreOptions) {
    this.secret = options.secret;
    this.absoluteTtlMs = options.absoluteTtlMs ?? DEFAULT_ABSOLUTE_TTL_MS;
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.now = options.now ?? Date.now;
  }

  get maxAgeSeconds(): number {
    return Math.max(1, Math.floor(this.absoluteTtlMs / 1000));
  }

  get size(): number {
    this.sweep();
    return this.sessions.size;
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
    const csrfToken = randomBytes(32).toString('hex');
    this.sessions.set(id, {
      id,
      csrfToken,
      ip,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + this.absoluteTtlMs,
    });
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

    const record = this.sessions.get(id);
    if (!record) return null;

    const now = this.now();
    if (now >= record.expiresAt || now - record.lastSeenAt >= this.idleTtlMs) {
      this.sessions.delete(id);
      return null;
    }
    record.lastSeenAt = now;
    return record;
  }

  destroy(cookieValue: string | null | undefined): void {
    if (!cookieValue) return;
    const dot = cookieValue.lastIndexOf('.');
    if (dot > 0) this.sessions.delete(cookieValue.slice(0, dot));
  }

  sweep(): void {
    const now = this.now();
    for (const [id, record] of this.sessions) {
      if (now >= record.expiresAt || now - record.lastSeenAt >= this.idleTtlMs) {
        this.sessions.delete(id);
      }
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
