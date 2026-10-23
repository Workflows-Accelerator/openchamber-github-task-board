import type { TaskLease, ReconciliationAction } from './types.js';
import { inspectSessionLiveness } from './session-watcher.ts';

/**
 * Reconciles a task's 4-axis metadata state against the liveness of its linked agent session.
 * Guard order (applies to EVERY liveness state, ADV-2C-01):
 * 1. Missing/empty issue data -> poll ('No issue data').
 * 2. Terminal ('done'/'archive' phase, or issue closed) -> release ('Task is complete').
 * 3. Awaiting human ('verification' phase or any non-'none' attention) -> poll
 *    ('Awaiting human verification'); no liveness state may overwrite a human flag.
 * Liveness mapping (only reached when the task is actionable and awaiting nobody):
 * - 'blocked-permission' -> escalate to attention: 'needs-permission'
 * - 'blocked-question'   -> escalate to attention: 'needs-decision'
 * - 'completed'          -> advance phase ('exploration' -> 'planning', 'execution' -> 'verification') with attention: 'needs-review'
 *                           Advance is only reachable from 'exploration'/'execution' with attention: 'none'.
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

  if (!issue || typeof issue !== 'object') {
    return {
      action: 'poll',
      reason: 'No issue data',
    };
  }

  const rawIssuePhase = issue.v2Metadata?.phase || issue.phase;
  const rawLeasePhase = lease?.phase;
  const issuePhase = typeof rawIssuePhase === 'string' ? rawIssuePhase.trim().toLowerCase() : '';
  const leasePhase = typeof rawLeasePhase === 'string' ? rawLeasePhase.trim().toLowerCase() : '';

  const rawAttention = issue.v2Metadata?.attention || issue.attention || 'none';
  const currentAttention = typeof rawAttention === 'string' ? rawAttention.trim().toLowerCase() : 'none';

  // ADV-2C-02: live issue metadata always outranks the lease's claim-time snapshot
  const currentPhase = issuePhase || leasePhase;

  const isClosed =
    (typeof issue.state === 'string' && issue.state.toLowerCase() === 'closed') ||
    issue.closed === true ||
    Boolean(issue.closed_at);

  // ADV-2C-01, ADV-2C-08: terminal protection for EVERY liveness state
  if (isClosed || currentPhase === 'done' || currentPhase === 'archive') {
    return {
      action: 'release',
      reason: 'Task is complete',
    };
  }

  // ADV-2C-08: without any phase information the task cannot be transitioned safely
  if (!currentPhase) {
    return {
      action: 'poll',
      reason: 'No issue data',
    };
  }

  // ADV-2C-01, ADV-2C-05: awaiting-human protection for EVERY liveness state
  if (currentPhase === 'verification' || currentAttention !== 'none') {
    return {
      action: 'poll',
      reason: 'Awaiting human verification',
    };
  }

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
      // ADV-2C-05: advance is only reachable with attention: 'none' (guarded above)
      if (currentAttention === 'none' && currentPhase === 'exploration') {
        return {
          action: 'advance',
          targetPhase: 'planning',
          targetAttention: 'needs-review',
          reason: 'Worker completed execution cleanly',
        };
      }

      if (currentAttention === 'none' && currentPhase === 'execution') {
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
