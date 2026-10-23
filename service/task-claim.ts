import { computeIssueSha } from './cas.ts';
import type { LeaseStore } from './lease-store.js';
import type { ClaimResult } from './types.js';

/**
 * Determines whether an issue is eligible for autonomous coordinator pilot claiming.
 * Eligibility rules:
 * - Must not be null or invalid.
 * - Must not be closed (state === 'closed', closed === true, closed_at present).
 * - Must not be in terminal phase ('done', 'archive').
 * - Must not have active human attention required (attention !== 'none' && attention !== '').
 * - Must either:
 *   a) Have explicit pilot label ('coordinator:pilot' or 'pilot'), OR
 *   b) Have explicit v2 metadata (isExplicitV2 === true) with active phase ('exploration' or 'execution') and attention 'none'.
 * Legacy unmigrated issues without explicit v2 or pilot labels are strictly rejected.
 */
export function isTaskEligibleForPilot(issue: any): boolean {
  if (!issue || typeof issue !== 'object') {
    return false;
  }

  // 1. Closed state guard
  if (
    issue.state === 'closed' ||
    (typeof issue.state === 'string' && issue.state.toLowerCase() === 'closed') ||
    issue.closed === true ||
    Boolean(issue.closed_at)
  ) {
    return false;
  }

  // 2. Terminal phase guard
  const rawPhase = issue.v2Metadata?.phase ?? issue.phase ?? '';
  const phase = typeof rawPhase === 'string' ? rawPhase.trim().toLowerCase() : '';
  if (phase === 'done' || phase === 'archive') {
    return false;
  }

  // 3. Human attention guard
  const rawAttention = issue.v2Metadata?.attention ?? issue.attention ?? 'none';
  const attention = typeof rawAttention === 'string' ? rawAttention.trim().toLowerCase() : 'none';
  if (attention !== 'none' && attention !== '') {
    return false;
  }

  // 4. Label inspection
  const rawLabels = Array.isArray(issue.labels) ? issue.labels : [];
  const labelNames = rawLabels.map((l: any) =>
    (typeof l === 'string' ? l : l?.name || '').trim().toLowerCase()
  );
  const hasPilotLabel = labelNames.includes('coordinator:pilot') || labelNames.includes('pilot');

  // 5. Active workflow phases with explicit opt-in
  const isExplicitV2 = issue.v2Metadata?.isExplicitV2 === true;
  const isEligiblePhase = (phase === 'exploration' || phase === 'execution') && attention === 'none';

  return hasPilotLabel || (isEligiblePhase && isExplicitV2);
}

/**
 * Claims a task for automated coordinator execution.
 * Verifies eligibility, computes baseline SHA-256 digest of issue body,
 * and requests lease acquisition from the LeaseStore.
 */
export async function claimPilotTask(
  issue: any,
  repo: string,
  leaseStore: LeaseStore,
  workerId: string,
  ttlMs?: number
): Promise<ClaimResult> {
  if (!issue || typeof issue !== 'object') {
    return {
      acquired: false,
      conflictReason: 'Invalid issue object provided',
    };
  }

  if (!isTaskEligibleForPilot(issue)) {
    return {
      acquired: false,
      conflictReason: 'Task is not eligible for coordinator pilot',
    };
  }

  const issueNumber = Number(issue.number);
  if (!issueNumber || Number.isNaN(issueNumber)) {
    return {
      acquired: false,
      conflictReason: 'Issue must have a valid issue number',
    };
  }

  const claimedSha = computeIssueSha(issue.body);
  const rawPhase = issue.v2Metadata?.phase ?? issue.phase ?? 'exploration';
  const phase = typeof rawPhase === 'string' && rawPhase.trim() ? rawPhase.trim().toLowerCase() : 'exploration';

  return await leaseStore.acquireLease(repo, issueNumber, workerId, claimedSha, phase, ttlMs);
}

/**
 * Object-oriented wrapper for managing pilot task claims against a LeaseStore.
 */
export class TaskClaimEngine {
  private leaseStore: LeaseStore;
  private workerId: string;
  private defaultTtlMs?: number;

  constructor(leaseStore: LeaseStore, workerId: string, defaultTtlMs?: number) {
    this.leaseStore = leaseStore;
    this.workerId = workerId;
    this.defaultTtlMs = defaultTtlMs;
  }

  public isEligible(issue: any): boolean {
    return isTaskEligibleForPilot(issue);
  }

  public async claim(issue: any, repo: string, ttlMs?: number): Promise<ClaimResult> {
    return claimPilotTask(issue, repo, this.leaseStore, this.workerId, ttlMs ?? this.defaultTtlMs);
  }
}
