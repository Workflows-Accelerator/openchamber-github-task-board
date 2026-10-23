/**
 * Types and interfaces for the OpenChamber Github Task Board Host Background Service.
 */

export type SessionLivenessState =
  | 'idle'
  | 'running'
  | 'waiting-permission'
  | 'waiting-question'
  | 'blocked-permission'
  | 'blocked-question'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'unknown';

export interface SessionLivenessInfo {
  sessionId?: string;
  state: SessionLivenessState;
  updatedAt?: number;
  reason?: string;
  details?: string;
}

export interface TaskLease {
  issueNumber: number;
  repo: string;
  ownerId: string;
  claimedAt: number;
  expiresAt: number;
  heartbeatAt: number;
  claimedSha: string;
  phase: string;
}

export interface LeaseStoreState {
  version: number;
  leases: Record<string, TaskLease>;
}

export interface ClaimResult {
  acquired: boolean;
  lease?: TaskLease;
  conflictReason?: string;
}

export interface ReconciliationAction {
  action: 'advance' | 'escalate' | 'poll' | 'release';
  targetPhase?: string;
  targetAttention?: string;
  reason: string;
}

export interface CoordinatorConfig {
  hostOrigin: string;
  pollIntervalMs: number;
  leaseTtlMs: number;
  storageDir: string;
  dryRun: boolean;
}

export type CoordinatorStatus = 'stopped' | 'starting' | 'running' | 'stopping';
