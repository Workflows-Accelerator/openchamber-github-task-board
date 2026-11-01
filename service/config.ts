import fs from 'node:fs';
import path from 'node:path';
import type { CoordinatorConfig } from './types.js';

export const DEFAULT_HOST_ORIGIN = 'http://127.0.0.1:3000';
export const DEFAULT_POLL_INTERVAL_MS = 15000;
export const DEFAULT_LEASE_TTL_MS = 60000;
export const DEFAULT_STORAGE_DIR = '.openchamber-data/task-coordinator';
export const DEFAULT_DRY_RUN = false;

/**
 * Resolves the coordinator storage directory relative to /workspace if present,
 * or relative to the current working directory / repo root.
 */
export function resolveStorageDir(rawDir?: string): string {
  const envDir = rawDir || process.env.COORDINATOR_STORAGE_DIR;
  if (envDir && envDir.trim()) {
    const trimmed = envDir.trim();
    if (path.isAbsolute(trimmed)) {
      return trimmed;
    }
    // Relative path specified: resolve against /workspace if available, else cwd
    if (fs.existsSync('/workspace') && fs.statSync('/workspace').isDirectory()) {
      return path.resolve('/workspace', trimmed);
    }
    return path.resolve(process.cwd(), trimmed);
  }

  // Default directory: .openchamber-data/task-coordinator
  if (process.env.OPENCHAMBER_DATA_DIR && process.env.OPENCHAMBER_DATA_DIR.trim()) {
    return path.resolve(process.env.OPENCHAMBER_DATA_DIR.trim(), 'task-coordinator');
  }

  if (fs.existsSync('/workspace') && fs.statSync('/workspace').isDirectory()) {
    return path.resolve('/workspace', DEFAULT_STORAGE_DIR);
  }

  return path.resolve(process.cwd(), DEFAULT_STORAGE_DIR);
}

/**
 * Load coordinator configuration from environment variables or supplied overrides.
 */
export function loadCoordinatorConfig(overrides?: Partial<CoordinatorConfig>): CoordinatorConfig {
  const hostOrigin = overrides?.hostOrigin || process.env.OPENCHAMBER_HOST_ORIGIN || DEFAULT_HOST_ORIGIN;

  let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  const pollEnv = overrides?.pollIntervalMs ?? process.env.COORDINATOR_POLL_INTERVAL_MS;
  if (pollEnv !== undefined) {
    const parsed = typeof pollEnv === 'number' ? pollEnv : parseInt(String(pollEnv), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      pollIntervalMs = parsed;
    }
  }

  let leaseTtlMs = DEFAULT_LEASE_TTL_MS;
  const ttlEnv = overrides?.leaseTtlMs ?? process.env.COORDINATOR_LEASE_TTL_MS;
  if (ttlEnv !== undefined) {
    const parsed = typeof ttlEnv === 'number' ? ttlEnv : parseInt(String(ttlEnv), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      leaseTtlMs = parsed;
    }
  }

  const storageDir = overrides?.storageDir ? resolveStorageDir(overrides.storageDir) : resolveStorageDir();

  const dryRunEnv = overrides?.dryRun !== undefined
    ? overrides.dryRun
    : process.env.COORDINATOR_DRY_RUN === 'true' || process.env.COORDINATOR_DRY_RUN === '1';

  return {
    hostOrigin: hostOrigin.replace(/\/+$/, ''),
    pollIntervalMs,
    leaseTtlMs,
    storageDir,
    dryRun: Boolean(dryRunEnv),
  };
}

/**
 * Strict fast-fail validation for OpenChamber guest service environment variables.
 * Validates OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN BEFORE any
 * storage, leaseStore, or service initialization.
 */
export function validateServiceHostEnv(): { port: number; token: string } {
  const rawPort = process.env.OPENCHAMBER_SERVICE_PORT;
  if (!rawPort || !/^[0-9]+$/.test(rawPort)) {
    process.stderr.write(
      '[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_PORT must be an integer between 1 and 65535.\n'
    );
    process.exit(1);
  }
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(
      '[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_PORT out of valid range (1..65535).\n'
    );
    process.exit(1);
  }

  const token = process.env.OPENCHAMBER_SERVICE_TOKEN;
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    process.stderr.write(
      '[Coordinator Service] Startup error: OPENCHAMBER_SERVICE_TOKEN must be a non-empty string.\n'
    );
    process.exit(1);
  }

  return { port, token };
}
