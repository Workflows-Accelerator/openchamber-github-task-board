import path from 'node:path';

/**
 * The board snapshot the panel publishes after a successful load.
 *
 * The wire carries data only: five bounded integers, one absolute directory and
 * at most one issue reference. Every label, tone, row id and note the Work
 * Status section shows is built by the service (`service/status-view.ts`), so a
 * forged snapshot can change numbers and one title, never markup or an action.
 *
 * State is in memory only, keyed by the exact project directory. A service
 * restart therefore shows the truthful empty state instead of data older than
 * any panel load (D47.1).
 */

/**
 * Age at which the section stops presenting its numbers as current, and warns
 * instead. Owner-delegated parameter (D50): 10 minutes.
 */
export const STALE_MS = 10 * 60 * 1000;

/** One snapshot body may be this large; the route refuses anything longer. */
export const SNAPSHOT_MAX_BYTES = 16_384;

/** Oldest accepted `at`, relative to receipt: 90 seconds. */
export const SNAPSHOT_MAX_AGE_MS = 90_000;

/** Newest accepted `at`, relative to receipt: 5 seconds (clock skew allowance). */
export const SNAPSHOT_MAX_FUTURE_MS = 5_000;

/** Highest value a count may carry. */
export const COUNT_MAX = 9_999;

export interface SnapshotTop {
  repo: string;
  number: number;
  title: string;
}

export interface SnapshotCounts {
  needsMe: number;
  running: number;
  blocked: number;
  done: number;
  total: number;
}

export interface BoardSnapshot {
  directory: string;
  at: number;
  complete: true;
  counts: SnapshotCounts;
  top: SnapshotTop | null;
}

export type SnapshotParseResult =
  | { ok: true; snapshot: BoardSnapshot }
  | { ok: false; reason: 'invalid_snapshot' };

const ROOT_KEYS = ['v', 'directory', 'at', 'complete', 'counts', 'top'] as const;
const COUNT_KEYS = ['needsMe', 'running', 'blocked', 'done', 'total'] as const;
const TOP_KEYS = ['repo', 'number', 'title'] as const;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const DIRECTORY_MAX = 1024;
const TITLE_MAX = 2048;
/** C0/C1 controls, bidi overrides and isolates: never accepted on the wire. */
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
/** Credential shapes the threat model refuses in any string we keep. */
const CREDENTIAL_PATTERNS = [/gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /Bearer\s+\S+/];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (Object(value) !== value || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  if (own.length !== keys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
};

const isBoundedInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

const containsForbiddenKey = (value: Record<string, unknown>): boolean =>
  Object.keys(value).some((key) => FORBIDDEN_KEYS.has(key));

const looksLikeCredential = (value: string): boolean => CREDENTIAL_PATTERNS.some((pattern) => pattern.test(value));

/**
 * Normalizes a project directory into the exact lookup key: absolute, no `..`
 * segment, no control character, at most 1024 characters, no trailing slash.
 * Returns `null` when the value cannot name a project folder.
 */
export function normalizeDirectory(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > DIRECTORY_MAX) return null;
  if (!path.isAbsolute(value)) return null;
  if (FORBIDDEN_CHARS.test(value)) return null;
  if (value.split('/').some((segment) => segment === '..')) return null;
  const normalized = path.normalize(value);
  if (!path.isAbsolute(normalized)) return null;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

/**
 * Parses and validates one `POST /snapshot` body. Every rejection reason maps
 * to the same fixed answer (`invalid_snapshot`); the offending value is never
 * echoed, logged or stored.
 */
export function parseSnapshotBody(raw: string, receivedAt: number): SnapshotParseResult {
  let wire: unknown;
  try {
    wire = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid_snapshot' };
  }
  if (!isPlainObject(wire) || containsForbiddenKey(wire)) return { ok: false, reason: 'invalid_snapshot' };
  if (!hasExactKeys(wire, ROOT_KEYS)) return { ok: false, reason: 'invalid_snapshot' };
  if (wire.v !== 1 || wire.complete !== true) return { ok: false, reason: 'invalid_snapshot' };

  const directory = normalizeDirectory(wire.directory);
  if (!directory) return { ok: false, reason: 'invalid_snapshot' };

  if (!isBoundedInteger(wire.at, 0, Number.MAX_SAFE_INTEGER)) return { ok: false, reason: 'invalid_snapshot' };
  const at = wire.at;
  if (at < receivedAt - SNAPSHOT_MAX_AGE_MS || at > receivedAt + SNAPSHOT_MAX_FUTURE_MS) {
    return { ok: false, reason: 'invalid_snapshot' };
  }

  const counts = wire.counts;
  if (!isPlainObject(counts) || containsForbiddenKey(counts)) return { ok: false, reason: 'invalid_snapshot' };
  if (!hasExactKeys(counts, COUNT_KEYS)) return { ok: false, reason: 'invalid_snapshot' };
  for (const key of COUNT_KEYS) {
    if (!isBoundedInteger(counts[key], 0, COUNT_MAX)) return { ok: false, reason: 'invalid_snapshot' };
  }
  const parsedCounts: SnapshotCounts = {
    needsMe: counts.needsMe as number,
    running: counts.running as number,
    blocked: counts.blocked as number,
    done: counts.done as number,
    total: counts.total as number,
  };
  if (parsedCounts.done > parsedCounts.total) return { ok: false, reason: 'invalid_snapshot' };

  let top: SnapshotTop | null = null;
  if (wire.top !== null) {
    const candidate = wire.top;
    if (!isPlainObject(candidate) || containsForbiddenKey(candidate)) return { ok: false, reason: 'invalid_snapshot' };
    if (!hasExactKeys(candidate, TOP_KEYS)) return { ok: false, reason: 'invalid_snapshot' };
    if (typeof candidate.repo !== 'string' || !REPO_PATTERN.test(candidate.repo)) return { ok: false, reason: 'invalid_snapshot' };
    if (!isBoundedInteger(candidate.number, 1, 1_000_000_000)) return { ok: false, reason: 'invalid_snapshot' };
    if (typeof candidate.title !== 'string') return { ok: false, reason: 'invalid_snapshot' };
    const title = candidate.title.trim();
    if (title.length === 0 || title.length > TITLE_MAX) return { ok: false, reason: 'invalid_snapshot' };
    if (FORBIDDEN_CHARS.test(title) || looksLikeCredential(title) || looksLikeCredential(candidate.repo)) {
      return { ok: false, reason: 'invalid_snapshot' };
    }
    top = { repo: candidate.repo, number: candidate.number, title };
  }

  // A zero "needs me" with a task attached is internally inconsistent: the
  // panel computes both from the same list, so one of them is forged.
  if (top !== null && parsedCounts.needsMe === 0) return { ok: false, reason: 'invalid_snapshot' };

  return {
    ok: true,
    snapshot: { directory, at, complete: true, counts: parsedCounts, top },
  };
}

/**
 * The last accepted snapshot per project directory, in memory only.
 * A rejected body never reaches this store, so the previous entry stays
 * byte-identical.
 */
export class SnapshotStore {
  private snapshots: Map<string, BoardSnapshot> = new Map();

  public set(snapshot: BoardSnapshot): void {
    this.snapshots.set(snapshot.directory, snapshot);
  }

  /** The snapshot for exactly this directory, or `undefined`. Never another project's. */
  public get(directory: unknown): BoardSnapshot | undefined {
    const key = normalizeDirectory(directory);
    if (!key) return undefined;
    return this.snapshots.get(key);
  }

  public size(): number {
    return this.snapshots.size;
  }

  public clear(): void {
    this.snapshots.clear();
  }
}
