import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCoordinatorConfig, resolveStorageDir, validateServiceHostEnv } from './config.ts';
import { LeaseStore } from './lease-store.ts';
import type { ClaimResult, CoordinatorConfig, CoordinatorStatus } from './types.js';

interface HeldLeaseEntry {
  repo: string;
  issueNumber: number;
  ownerId: string;
}

export class CoordinatorService {
  private config: CoordinatorConfig;
  private status: CoordinatorStatus = 'stopped';
  private timer: NodeJS.Timeout | null = null;
  private ownerId: string;
  private heldLeases: Map<string, HeldLeaseEntry> = new Map();
  private leaseStore: LeaseStore;

  constructor(config?: Partial<CoordinatorConfig>, leaseStore?: LeaseStore) {
    this.config = loadCoordinatorConfig(config);
    this.leaseStore = leaseStore || new LeaseStore(undefined, this.config.leaseTtlMs);
    this.ownerId = `coordinator-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  public getConfig(): CoordinatorConfig {
    return { ...this.config };
  }

  public getStatus(): CoordinatorStatus {
    return this.status;
  }

  public getLeaseStore(): LeaseStore {
    return this.leaseStore;
  }

  public getOwnerId(): string {
    return this.ownerId;
  }

  /**
   * Acquire a lease on behalf of this coordinator instance and track it so
   * clean shutdown can release it (PLAN-STAGE2B invariant 4).
   */
  public async acquireLease(
    repo: string,
    issueNumber: number,
    bodySha: string,
    phase: string,
    ttlMs?: number
  ): Promise<ClaimResult> {
    const result = await this.leaseStore.acquireLease(
      repo,
      issueNumber,
      this.ownerId,
      bodySha,
      phase,
      ttlMs ?? this.config.leaseTtlMs
    );
    if (result.acquired) {
      this.heldLeases.set(this.leaseStore.getLeaseKey(repo, issueNumber), {
        repo: repo.trim(),
        issueNumber: Number(issueNumber),
        ownerId: this.ownerId,
      });
    }
    return result;
  }

  public async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      return;
    }
    this.status = 'starting';

    console.log('[Coordinator Service] ========================================');
    console.log('[Coordinator Service] Starting OpenChamber Task Coordinator');
    console.log(`[Coordinator Service] Host origin: ${this.config.hostOrigin}`);
    console.log(`[Coordinator Service] Poll interval: ${this.config.pollIntervalMs}ms`);
    console.log(`[Coordinator Service] Lease TTL: ${this.config.leaseTtlMs}ms`);
    console.log(`[Coordinator Service] Storage dir: ${this.config.storageDir}`);
    console.log(`[Coordinator Service] Dry run: ${this.config.dryRun}`);
    console.log('[Coordinator Service] ========================================');

    try {
      if (!fs.existsSync(this.config.storageDir)) {
        fs.mkdirSync(this.config.storageDir, { recursive: true });
      }
    } catch (err) {
      console.error(`[Coordinator Service] Failed to create storage dir ${this.config.storageDir}:`, err);
      this.status = 'stopped';
      throw err;
    }

    // ADV-2C-03: load lease state through init() before the first tick so prior
    // state is backed up forensically instead of silently overwritten.
    try {
      await this.leaseStore.init();
    } catch (err) {
      console.error('[Coordinator Service] Failed to initialize lease store:', err);
      this.status = 'stopped';
      throw err;
    }

    this.status = 'running';
    this.startReconciliationLoop();
  }

  public async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return;
    }
    this.status = 'stopping';
    console.log('[Coordinator Service] Stopping coordinator service...');

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.releaseHeldLeases();

    this.status = 'stopped';
    console.log('[Coordinator Service] Coordinator service stopped cleanly.');
  }

  private startReconciliationLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      try {
        await this.reconcileOnce();
      } catch (err) {
        console.error('[Coordinator Service] Error in reconciliation tick:', err);
      }
    }, this.config.pollIntervalMs);

    void this.reconcileOnce().catch((err) => {
      console.error('[Coordinator Service] Error in initial reconciliation tick:', err);
    });
  }

  public async reconcileOnce(): Promise<void> {
    if (this.status !== 'running') {
      return;
    }
    try {
      await this.leaseStore.pruneExpired();
    } catch (err) {
      console.error('[Coordinator Service] Error pruning expired leases:', err);
    }
    if (this.config.dryRun) {
      // Dry run tick
    }
  }

  /**
   * Release every lease this instance holds on shutdown (PLAN-STAGE2B invariant 4):
   * tracked acquisitions plus any store lease still owned by this instance.
   * Other owners' leases are never touched (single-writer safety).
   */
  private async releaseHeldLeases(): Promise<void> {
    const pending = new Map<string, HeldLeaseEntry>(this.heldLeases);
    for (const lease of this.leaseStore.listActiveLeases()) {
      if (lease.ownerId === this.ownerId) {
        pending.set(this.leaseStore.getLeaseKey(lease.repo, lease.issueNumber), {
          repo: lease.repo,
          issueNumber: lease.issueNumber,
          ownerId: lease.ownerId,
        });
      }
    }

    if (pending.size === 0) {
      return;
    }

    console.log(`[Coordinator Service] Releasing ${pending.size} held leases...`);
    for (const [key, entry] of pending) {
      try {
        await this.leaseStore.releaseLease(entry.repo, entry.issueNumber, entry.ownerId);
      } catch (err) {
        console.error(`[Coordinator Service] Failed to release lease ${key} on shutdown:`, err);
      }
    }
    this.heldLeases.clear();
  }
}

export * from './types.ts';
export * from './config.ts';
export * from './cas.ts';
export { LeaseStore, resolveLeaseStorageDir, getDefaultLeasesFilePath } from './lease-store.ts';
export * from './task-claim.ts';
export * from './session-watcher.ts';
export * from './reconciler.ts';

/**
 * Timing-safe Bearer token authentication using SHA-256 digests.
 * Pre-hashing guarantees fixed 32-byte buffers, preventing Node.js RangeError
 * on input length mismatches and eliminating timing side channels.
 */
export function authenticateRequest(authHeader: string | undefined, expectedToken: string): boolean {
  if (!authHeader || typeof authHeader !== 'string') return false;
  const match = /^Bearer\s+(\S+)$/.exec(authHeader.trim());
  if (!match) return false;
  const presentedToken = match[1];

  const expectedHash = crypto.createHash('sha256').update(expectedToken, 'utf8').digest();
  const presentedHash = crypto.createHash('sha256').update(presentedToken, 'utf8').digest();

  return crypto.timingSafeEqual(expectedHash, presentedHash);
}

/**
 * Creates the minimal HTTP server adapter for the OpenChamber guest service runner.
 * Enforces loopback binding, 15s socket timeout, 64KB body cap, and strict route confinement.
 */
export function createCoordinatorHostServer(
  token: string,
  getStatus?: () => CoordinatorStatus
): http.Server {
  const MAX_BODY_BYTES = 65536;

  const server = http.createServer((req, res) => {
    // 15-second socket timeout
    req.socket.setTimeout(15000, () => {
      req.socket.destroy();
    });

    // Constant-time Bearer authentication: verify first before body buffering or route disclosure
    const authHeader = req.headers.authorization;
    if (!authenticateRequest(authHeader, token)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      req.resume(); // drain incoming bytes without buffering
      return;
    }

    // Request body cap: 64KB (65,536 bytes) for authenticated requests
    const contentLength = req.headers['content-length'] ? Number(req.headers['content-length']) : null;
    if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength > MAX_BODY_BYTES)) {
      res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Payload Too Large' }));
      req.destroy();
      return;
    }

    let bytesRead = 0;
    req.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      if (bytesRead > MAX_BODY_BYTES) {
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Payload Too Large' }));
        }
        req.destroy();
      }
    });

    // Route confinement: ONLY authenticated GET /health returns 200
    // Normalize path by stripping trailing slashes while preserving root /
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    if (normalizedPath === '/health') {
      if (req.method === 'GET') {
        if (getStatus && getStatus() !== 'running') {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Service Unavailable' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', service: 'task-coordinator' }));
        return;
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
    }

    // All other paths (including /status) return 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

/**
 * Direct-run entry guard with realpath normalization (Advisory 4).
 * Ensures module imports in test runners or unit suites have zero side effects,
 * while host runner direct invocation always starts the service.
 */
function isDirectExecution(): boolean {
  if (!process.argv[1] || !import.meta.url) return false;
  try {
    const entryPath = fileURLToPath(import.meta.url);
    if (process.argv[1] === entryPath) return true;
    try {
      if (fs.realpathSync(process.argv[1]) === entryPath) return true;
    } catch {
      // Safe fallback if realpathSync throws
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Starts the coordinator HTTP host adapter server and the background CoordinatorService.
 * Validates configuration fast before initializing storage or coordinator.
 */
export async function startHostServiceServer(): Promise<void> {
  // Fast-fail startup config validation strictly BEFORE storage/coordinator initialization
  const { port, token } = validateServiceHostEnv();

  const coordinatorService = new CoordinatorService();
  const server = createCoordinatorHostServer(token, () => coordinatorService.getStatus());

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Coordinator Service] Received ${signal}, initiating graceful shutdown...`);

    // Arm 3,500ms safety timer: if graceful shutdown hangs, force exit before host's 5s SIGKILL
    const safetyTimer = setTimeout(() => {
      console.warn('[Coordinator Service] Graceful shutdown deadline exceeded; forcing exit.');
      server.closeAllConnections?.();
      process.exit(1);
    }, 3500);
    safetyTimer.unref();

    const closeServerPromise = new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    server.closeIdleConnections?.();

    try {
      await Promise.all([
        coordinatorService.stop(),
        closeServerPromise,
      ]);
    } catch (err) {
      console.error('[Coordinator Service] Error during shutdown:', err);
    } finally {
      clearTimeout(safetyTimer);
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  server.on('error', (err) => {
    console.error('[Coordinator Service] Server error:', err);
    process.exit(1);
  });

  // Start coordinatorService strictly BEFORE opening the HTTP server socket
  // Ensures /health never returns 200 while startup is pending or if it fails
  try {
    await coordinatorService.start();
  } catch (err) {
    console.error('[Coordinator Service] Fatal startup error:', err);
    process.exit(1);
  }

  // Open HTTP server socket on loopback
  try {
    await new Promise<void>((resolve, reject) => {
      server.listen(port, '127.0.0.1', () => {
        console.log(`[Coordinator Service] Host adapter listening on http://127.0.0.1:${port}`);
        resolve();
      });
      server.once('error', reject);
    });
  } catch (err) {
    console.error('[Coordinator Service] Server bind error:', err);
    await coordinatorService.stop().catch(() => {});
    process.exit(1);
  }
}

if (isDirectExecution()) {
  startHostServiceServer().catch((err) => {
    console.error('[Coordinator Service] Fatal startup error:', err);
    process.exit(1);
  });
}
