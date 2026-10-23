import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCoordinatorConfig, resolveStorageDir } from './config.js';
import { LeaseStore } from './lease-store.js';
import type { CoordinatorConfig, CoordinatorStatus } from './types.js';

export class CoordinatorService {
  private config: CoordinatorConfig;
  private status: CoordinatorStatus = 'stopped';
  private timer: NodeJS.Timeout | null = null;
  private heldLeases: Set<string> = new Set();
  private leaseStore: LeaseStore;

  constructor(config?: Partial<CoordinatorConfig>, leaseStore?: LeaseStore) {
    this.config = loadCoordinatorConfig(config);
    this.leaseStore = leaseStore || new LeaseStore(undefined, this.config.leaseTtlMs);
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

  private async releaseHeldLeases(): Promise<void> {
    if (this.heldLeases.size === 0) {
      return;
    }
    console.log(`[Coordinator Service] Releasing ${this.heldLeases.size} held leases...`);
    this.heldLeases.clear();
  }
}

export * from './types.js';
export * from './config.js';
export * from './cas.js';
export { LeaseStore, resolveLeaseStorageDir, getDefaultLeasesFilePath } from './lease-store.js';
export * from './task-claim.js';
export * from './session-watcher.js';
export * from './reconciler.js';

// If executed directly, run the coordinator service
if (process.argv[1] && import.meta.url) {
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    if (process.argv[1] === currentFilePath) {
      const service = new CoordinatorService();

      const shutdown = async (signal: string) => {
        console.log(`[Coordinator Service] Received ${signal}, initiating graceful shutdown...`);
        try {
          await service.stop();
        } catch (err) {
          console.error('[Coordinator Service] Error during shutdown:', err);
        } finally {
          process.exit(0);
        }
      };

      process.on('SIGINT', () => void shutdown('SIGINT'));
      process.on('SIGTERM', () => void shutdown('SIGTERM'));

      service.start().catch((err) => {
        console.error('[Coordinator Service] Fatal startup error:', err);
        process.exit(1);
      });
    }
  } catch {
    // Ignore resolution errors when not running from file URL
  }
}
