import fs from 'node:fs';
import path from 'node:path';
import type { TaskLease, LeaseStoreState, ClaimResult } from './types.js';

export const DEFAULT_LEASE_TTL_MS = 60000;
export const DEFAULT_STORAGE_DIR = '.openchamber-data/task-coordinator';

/**
 * Resolves the coordinator storage directory relative to /workspace if present,
 * or relative to the current working directory / repo root.
 */
export function resolveLeaseStorageDir(rawDir?: string): string {
  const envDir = rawDir || process.env.COORDINATOR_STORAGE_DIR;
  if (envDir && envDir.trim()) {
    const trimmed = envDir.trim();
    if (path.isAbsolute(trimmed)) {
      return trimmed;
    }
    if (fs.existsSync('/workspace') && fs.statSync('/workspace').isDirectory()) {
      return path.resolve('/workspace', trimmed);
    }
    return path.resolve(process.cwd(), trimmed);
  }

  if (process.env.OPENCHAMBER_DATA_DIR && process.env.OPENCHAMBER_DATA_DIR.trim()) {
    return path.resolve(process.env.OPENCHAMBER_DATA_DIR.trim(), 'task-coordinator');
  }

  if (fs.existsSync('/workspace') && fs.statSync('/workspace').isDirectory()) {
    return path.resolve('/workspace', DEFAULT_STORAGE_DIR);
  }

  return path.resolve(process.cwd(), DEFAULT_STORAGE_DIR);
}

export function getDefaultLeasesFilePath(): string {
  return path.join(resolveLeaseStorageDir(), 'leases.json');
}

/**
 * Isolated single-writer lease store managing operational task claims.
 * Persists state atomically to disk via temporary file writes and atomic renames.
 */
export class LeaseStore {
  private filePath: string;
  private defaultTtlMs: number;
  private leases: Record<string, TaskLease> = {};
  private queue: Promise<unknown> = Promise.resolve();
  private backupBlocked = false;

  constructor(filePath?: string, defaultTtlMs: number = DEFAULT_LEASE_TTL_MS) {
    this.filePath = filePath || getDefaultLeasesFilePath();
    this.defaultTtlMs = defaultTtlMs > 0 ? defaultTtlMs : DEFAULT_LEASE_TTL_MS;
  }

  public getFilePath(): string {
    return this.filePath;
  }

  public getDefaultTtlMs(): number {
    return this.defaultTtlMs;
  }

  /**
   * Helper to compute consistent lease lookup key.
   */
  public getLeaseKey(repo: string, issueNumber: number): string {
    return `${repo.trim()}#${Number(issueNumber)}`;
  }

  /**
   * Serialize internal mutating operations to prevent in-process race conditions.
   */
  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const resultPromise = this.queue.then(() => fn());
    this.queue = resultPromise.catch(() => {});
    return resultPromise;
  }

  /**
   * Initialize the store: loads existing state or creates empty structure with version: 1.
   * Any load failure (read error, unparseable JSON, valid-JSON-but-wrong-shape) is backed up
   * forensically before the store is reset (ADV-2C-03).
   */
  public async init(): Promise<void> {
    return this.runExclusive(async () => {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      try {
        const raw = await fs.promises.readFile(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as LeaseStoreState;
        if (parsed && typeof parsed.leases === 'object' && parsed.leases !== null) {
          this.leases = { ...parsed.leases };
          this.backupBlocked = false;
          return;
        }
        // Valid JSON but wrong shape (null, 42, {"leases":null}, ...)
        await this.resetPreservingPriorState('unexpected store shape');
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          this.leases = {};
          this.backupBlocked = false;
          await this.saveToDisk();
          return;
        }
        const reason = err instanceof SyntaxError || err?.name === 'SyntaxError'
          ? 'unparseable JSON'
          : `read error (${err?.code || err?.message || 'unknown'})`;
        await this.resetPreservingPriorState(reason);
      }
    });
  }

  /**
   * Preserve a forensic copy of the on-disk state before it can be overwritten.
   * Returns true when there is nothing to preserve (no file) or the backup succeeded.
   * On failure, logs the error and returns false (ADV-2C-07): callers must not
   * perform destructive writes without a successful backup.
   */
  private async backupPriorState(reason: string): Promise<boolean> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return true;
      }
      const backupPath = `${this.filePath}.corrupted.${Date.now()}.bak`;
      await fs.promises.copyFile(this.filePath, backupPath);
      return true;
    } catch (err) {
      console.error(`[LeaseStore] Failed to back up prior lease state (${reason}):`, err);
      return false;
    }
  }

  /**
   * Reset in-memory state after a load failure. The prior file is backed up first;
   * when the backup fails the destructive reset write is skipped entirely
   * (ADV-2C-07) — the unreadable file stays on disk untouched and later writes
   * are refused until a backup succeeds.
   */
  private async resetPreservingPriorState(reason: string): Promise<void> {
    const backedUp = await this.backupPriorState(reason);
    this.leases = {};
    this.backupBlocked = !backedUp;
    if (backedUp) {
      await this.saveToDisk();
    }
  }

  /**
   * Reload state from disk to synchronize with any external writes.
   * On load failures the prior file is backed up before any later write can
   * overwrite it (ADV-2C-03); in-memory state is kept on transient read errors.
   */
  public async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as LeaseStoreState;
      if (parsed && typeof parsed.leases === 'object' && parsed.leases !== null) {
        this.leases = { ...parsed.leases };
        this.backupBlocked = false;
        return;
      }
      this.backupBlocked = !(await this.backupPriorState('unexpected store shape'));
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return;
      }
      // Keep in-memory state on read/parse failures; preserve forensic backup
      // before any later write can overwrite unreadable prior state.
      this.backupBlocked = !(await this.backupPriorState(
        `read error (${err?.code || err?.message || 'unknown'})`
      ));
    }
  }

  /**
   * Acquire a lease on a task.
   * - If an active unexpired lease exists owned by another worker, acquisition fails.
   * - If lease does not exist, is expired, or is held by the same owner, a lease is granted.
   */
  public async acquireLease(
    repo: string,
    issueNumber: number,
    ownerId: string,
    bodySha: string,
    phase: string,
    ttlMs?: number
  ): Promise<ClaimResult> {
    return this.runExclusive(async () => {
      await this.loadFromDisk();

      const key = this.getLeaseKey(repo, issueNumber);
      const existing = this.leases[key];
      const now = Date.now();

      // Check mutual exclusion against other active owners
      if (existing && existing.expiresAt > now && existing.ownerId !== ownerId) {
        return {
          acquired: false,
          conflictReason: 'Task is currently leased by ' + existing.ownerId,
        };
      }

      const ttl = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : this.defaultTtlMs;
      const isSameOwnerActive = existing && existing.ownerId === ownerId && existing.expiresAt > now;
      const claimedAt = isSameOwnerActive ? existing.claimedAt : now;

      const lease: TaskLease = {
        issueNumber: Number(issueNumber),
        repo: repo.trim(),
        ownerId,
        claimedAt,
        expiresAt: now + ttl,
        heartbeatAt: now,
        claimedSha: bodySha,
        phase,
      };

      this.leases[key] = lease;
      await this.saveToDisk();

      return {
        acquired: true,
        lease: { ...lease },
      };
    });
  }

  /**
   * Renew the heartbeat of an existing active lease.
   * Refreshes heartbeatAt and extends expiresAt.
   * Returns true if renewed, false if lease not found, expired, or owned by someone else.
   */
  public async renewHeartbeat(
    repo: string,
    issueNumber: number,
    ownerId: string,
    ttlExtensionMs?: number
  ): Promise<boolean> {
    return this.runExclusive(async () => {
      await this.loadFromDisk();

      const key = this.getLeaseKey(repo, issueNumber);
      const existing = this.leases[key];
      const now = Date.now();

      if (!existing) {
        return false;
      }

      if (existing.ownerId !== ownerId) {
        return false;
      }

      if (existing.expiresAt <= now) {
        return false;
      }

      const extension = typeof ttlExtensionMs === 'number' && ttlExtensionMs > 0
        ? ttlExtensionMs
        : this.defaultTtlMs;

      existing.heartbeatAt = now;
      existing.expiresAt = now + extension;

      await this.saveToDisk();
      return true;
    });
  }

  /**
   * Release an acquired lease if owned by the caller.
   * Removes lease and atomically saves to disk.
   */
  public async releaseLease(repo: string, issueNumber: number, ownerId: string): Promise<boolean> {
    return this.runExclusive(async () => {
      await this.loadFromDisk();

      const key = this.getLeaseKey(repo, issueNumber);
      const existing = this.leases[key];

      if (!existing) {
        return false;
      }

      if (existing.ownerId !== ownerId) {
        return false;
      }

      delete this.leases[key];
      await this.saveToDisk();
      return true;
    });
  }

  /**
   * Retrieve active unexpired lease for a task, or null if expired/absent.
   */
  public getLease(repo: string, issueNumber: number): TaskLease | null {
    const key = this.getLeaseKey(repo, issueNumber);
    const existing = this.leases[key];

    if (!existing) {
      return null;
    }

    const now = Date.now();
    if (existing.expiresAt <= now) {
      return null;
    }

    return { ...existing };
  }

  /**
   * List all currently active (unexpired) leases.
   */
  public listActiveLeases(): TaskLease[] {
    const now = Date.now();
    return Object.values(this.leases)
      .filter((lease) => lease.expiresAt > now)
      .map((lease) => ({ ...lease }));
  }

  /**
   * Clean up expired leases from memory and disk. Returns count of pruned leases.
   */
  public async pruneExpired(): Promise<number> {
    return this.runExclusive(async () => {
      await this.loadFromDisk();

      const now = Date.now();
      let prunedCount = 0;

      for (const [key, lease] of Object.entries(this.leases)) {
        if (lease.expiresAt <= now) {
          delete this.leases[key];
          prunedCount++;
        }
      }

      if (prunedCount > 0) {
        await this.saveToDisk();
      }

      return prunedCount;
    });
  }

  /**
   * Reset all leases (useful for test teardown).
   */
  public async clearAllLeases(): Promise<void> {
    return this.runExclusive(async () => {
      this.leases = {};
      await this.saveToDisk();
    });
  }

  /**
   * Atomically save state to disk via temp file write and atomic rename.
   * Refuses to overwrite when prior state could not be read or backed up
   * (ADV-2C-03, ADV-2C-07): never destroy prior state without a successful backup.
   */
  private async saveToDisk(): Promise<void> {
    if (this.backupBlocked) {
      const backedUp = await this.backupPriorState('prior state unreadable before overwrite');
      if (!backedUp) {
        throw new Error('Refusing to overwrite lease store: prior state could not be read or backed up');
      }
      this.backupBlocked = false;
    }

    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const baseName = path.basename(this.filePath);
    const tmpFile = path.join(
      dir,
      `.${baseName}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`
    );

    const state: LeaseStoreState = {
      version: 1,
      leases: this.leases,
    };

    const content = JSON.stringify(state, null, 2);
    try {
      await fs.promises.writeFile(tmpFile, content, 'utf8');
      await fs.promises.rename(tmpFile, this.filePath);
    } catch (err) {
      try {
        await fs.promises.unlink(tmpFile);
      } catch {
        // Ignore unlink cleanup error
      }
      throw err;
    }
  }
}
