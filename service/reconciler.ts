import type { TaskLease, ReconciliationAction, SessionLivenessInfo } from './types.js';

/**
 * Inspects session state for reconciliation.
 */
function inspectSession(session: any): SessionLivenessInfo {
  if (!session) {
    return { state: 'idle', details: 'No session provided', reason: 'No session provided' };
  }

  if (typeof session === 'string') {
    const norm = session.trim().toLowerCase();
    if (norm === 'blocked-permission' || norm === 'waiting-permission') {
      return { state: 'blocked-permission', details: 'Session blocked on permissions', reason: 'Session blocked on permissions' };
    }
    if (norm === 'blocked-question' || norm === 'waiting-question') {
      return { state: 'blocked-question', details: 'Session waiting for human decision', reason: 'Session waiting for human decision' };
    }
    if (norm === 'completed' || norm === 'done' || norm === 'success') {
      return { state: 'completed', details: 'Session completed successfully', reason: 'Session completed successfully' };
    }
    if (norm === 'failed' || norm === 'error') {
      return { state: 'failed', details: 'Session failed', reason: 'Session failed' };
    }
    if (norm === 'running' || norm === 'busy') {
      return { state: 'running', details: 'Session is running', reason: 'Session is running' };
    }
    return { state: 'idle', details: 'Session is idle', reason: 'Session is idle' };
  }

  // 1. Pending permissions
  const hasPendingPermissions =
    (Array.isArray(session.pendingPermissions) && session.pendingPermissions.length > 0) ||
    (Array.isArray(session.permissionRequests) && session.permissionRequests.length > 0) ||
    (Array.isArray(session.permissions) && session.permissions.length > 0) ||
    session.waitingForPermission === true ||
    session.hasPendingPermissions === true ||
    session.activity === 'waiting-permission' ||
    session.activity === 'blocked-permission' ||
    session.status === 'waiting-permission' ||
    session.status === 'blocked-permission' ||
    session.state === 'waiting-permission' ||
    session.state === 'blocked-permission';

  if (hasPendingPermissions) {
    return {
      state: 'blocked-permission',
      details: session.reason || 'Session waiting on tool permissions',
      reason: session.reason || 'Session waiting on tool permissions',
    };
  }

  // 2. Pending questions
  const hasPendingQuestions =
    (Array.isArray(session.pendingQuestions) && session.pendingQuestions.length > 0) ||
    (Array.isArray(session.questions) && session.questions.some((q: any) => !q.answered && !q.completed)) ||
    session.waitingForQuestion === true ||
    session.hasPendingQuestions === true ||
    session.activity === 'waiting-question' ||
    session.activity === 'blocked-question' ||
    session.status === 'waiting-question' ||
    session.status === 'blocked-question' ||
    session.state === 'waiting-question' ||
    session.state === 'blocked-question';

  if (hasPendingQuestions) {
    return {
      state: 'blocked-question',
      details: session.reason || 'Session waiting on human response',
      reason: session.reason || 'Session waiting on human response',
    };
  }

  // 3. Error / Failure
  const isFailed =
    Boolean(session.error) ||
    (typeof session.exitCode === 'number' && session.exitCode !== 0) ||
    session.failed === true ||
    session.status === 'failed' ||
    session.status === 'error' ||
    session.state === 'failed' ||
    session.state === 'error' ||
    session.activity === 'failed' ||
    session.activity === 'error';

  if (isFailed) {
    let details = 'Session failed';
    if (session.error) {
      details = typeof session.error === 'object'
        ? session.error.message || JSON.stringify(session.error)
        : String(session.error);
    } else if (typeof session.exitCode === 'number' && session.exitCode !== 0) {
      details = `Session process exited with error code ${session.exitCode}`;
    } else if (session.reason) {
      details = String(session.reason);
    }
    return { state: 'failed', details, reason: details };
  }

  // 4. Completed
  const isCompleted =
    session.status === 'completed' ||
    session.status === 'done' ||
    session.status === 'success' ||
    session.state === 'completed' ||
    session.state === 'done' ||
    session.state === 'success' ||
    session.activity === 'completed' ||
    session.activity === 'done' ||
    session.completed === true ||
    session.exitCode === 0;

  if (isCompleted) {
    return {
      state: 'completed',
      details: session.reason || 'Session completed successfully',
      reason: session.reason || 'Session completed successfully',
    };
  }

  // 5. Running
  const isRunning =
    session.status === 'running' ||
    session.status === 'busy' ||
    session.state === 'running' ||
    session.state === 'busy' ||
    session.activity === 'running' ||
    session.busy === true ||
    session.active === true;

  if (isRunning) {
    return {
      state: 'running',
      details: session.reason || 'Session is actively running',
      reason: session.reason || 'Session is actively running',
    };
  }

  return {
    state: 'idle',
    details: session.reason || 'Session is idle',
    reason: session.reason || 'Session is idle',
  };
}

/**
 * Reconciles a task's 4-axis metadata state against the liveness of its linked agent session.
 * Maps session states into concrete workflow transitions:
 * - 'blocked-permission' -> escalate to attention: 'needs-permission'
 * - 'blocked-question'   -> escalate to attention: 'needs-decision'
 * - 'completed'          -> advance phase ('exploration' -> 'planning', 'execution' -> 'verification') with attention: 'needs-review'
 * - 'failed'             -> escalate to attention: 'needs-decision' with error details
 * - 'running'            -> poll
 * - 'idle'               -> poll
 */
export function reconcileTaskState(
  issue: any,
  session: any,
  lease?: TaskLease
): ReconciliationAction {
  const liveness = inspectSession(session);

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
      const currentPhase = (lease?.phase || issue?.v2Metadata?.phase || issue?.phase || 'exploration')
        .trim()
        .toLowerCase();

      let targetPhase = 'verification';
      if (currentPhase === 'exploration') {
        targetPhase = 'planning';
      } else if (currentPhase === 'execution') {
        targetPhase = 'verification';
      } else if (currentPhase === 'planning') {
        targetPhase = 'execution';
      } else if (currentPhase === 'verification') {
        targetPhase = 'done';
      }

      return {
        action: 'advance',
        targetPhase,
        targetAttention: 'needs-review',
        reason: 'Worker completed execution cleanly',
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
