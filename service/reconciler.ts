import type { TaskLease, ReconciliationAction } from './types.js';
import { inspectSessionLiveness } from './session-watcher.ts';

/**
 * Reconciles a task's 4-axis metadata state against the liveness of its linked agent session.
 * Maps session states into concrete workflow transitions:
 * - 'blocked-permission' -> escalate to attention: 'needs-permission'
 * - 'blocked-question'   -> escalate to attention: 'needs-decision'
 * - 'completed'          -> advance phase ('exploration' -> 'planning', 'execution' -> 'verification') with attention: 'needs-review'
 *                           If already in 'verification' or attention: 'needs-review', poll for human review (ADV-2B-01 idempotency).
 *                           If already in 'done', release lease.
 * - 'failed'             -> escalate to attention: 'needs-decision' with error details
 * - 'running'            -> poll
 * - 'idle'               -> poll
 */
export function reconcileTaskState(
  issue: any,
  session: any,
  lease?: TaskLease
): ReconciliationAction {
  const liveness = inspectSessionLiveness(session);

  switch (liveness.state) {
    case 'blocked-permission':
      return {
        action: 'escalate',
        targetAttention: 'needs-permission',
        reason: 'Linked session blocked on tool permissions',
      };

    case 'blocked-question':
      return {
        action: 'escalate',
        targetAttention: 'needs-decision',
        reason: 'Linked session waiting for human response',
      };

    case 'completed': {
      const rawIssuePhase = issue?.v2Metadata?.phase || issue?.phase;
      const rawLeasePhase = lease?.phase;
      const issuePhase = typeof rawIssuePhase === 'string' ? rawIssuePhase.trim().toLowerCase() : '';
      const leasePhase = typeof rawLeasePhase === 'string' ? rawLeasePhase.trim().toLowerCase() : '';

      const rawAttention = issue?.v2Metadata?.attention || issue?.attention || 'none';
      const currentAttention = typeof rawAttention === 'string' ? rawAttention.trim().toLowerCase() : 'none';

      // ADV-2B-01: Terminal done guard
      if (issuePhase === 'done' || leasePhase === 'done') {
        return {
          action: 'release',
          reason: 'Task is complete',
        };
      }

      // ADV-2B-01: Verification / needs-review guard (idempotent, await human review)
      if (issuePhase === 'verification' || leasePhase === 'verification' || currentAttention === 'needs-review') {
        return {
          action: 'poll',
          reason: 'Awaiting human review',
        };
      }

      // Determine active current phase for advancing
      const currentPhase = leasePhase || issuePhase || 'exploration';

      if (currentPhase === 'exploration') {
        return {
          action: 'advance',
          targetPhase: 'planning',
          targetAttention: 'needs-review',
          reason: 'Worker completed execution cleanly',
        };
      }

      if (currentPhase === 'execution') {
        return {
          action: 'advance',
          targetPhase: 'verification',
          targetAttention: 'needs-review',
          reason: 'Worker completed execution cleanly',
        };
      }

      return {
        action: 'poll',
        reason: 'Awaiting human review',
      };
    }

    case 'failed': {
      let errReason = 'unknown error';
      if (session?.error) {
        errReason = typeof session.error === 'object'
          ? session.error.message || JSON.stringify(session.error)
          : String(session.error);
      } else if (liveness.details) {
        errReason = liveness.details;
      }

      return {
        action: 'escalate',
        targetAttention: 'needs-decision',
        reason: 'Worker session failed or crashed: ' + errReason,
      };
    }

    case 'running':
      return {
        action: 'poll',
        reason: 'Worker session actively progressing',
      };

    case 'idle':
    default:
      return {
        action: 'poll',
        reason: 'Worker session is idle',
      };
  }
}

/**
 * Lifecycle coordinator reconciler connecting task phases and attention states
 * to agent session outcomes.
 */
export class CoordinatorReconciler {
  public reconcile(issue: any, session: any, lease?: TaskLease): ReconciliationAction {
    return reconcileTaskState(issue, session, lease);
  }
}
