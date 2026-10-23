import type { SessionLivenessInfo, SessionLivenessState } from './types.js';

/**
 * Inspects an OpenChamber agent session to determine its current operational liveness.
 * Categorizes the session into one of:
 * - 'blocked-permission': pending user approvals for tools/actions
 * - 'blocked-question': waiting for human clarification or decision
 * - 'completed': finished execution with clean status / exitCode 0
 * - 'failed': crashed, errored, or exited with non-zero exit code
 * - 'running': actively processing prompt or tools
 * - 'idle': dormant or unassigned
 */
export function inspectSessionLiveness(session: any): SessionLivenessInfo {
  if (!session) {
    return {
      state: 'idle',
      details: 'No session provided',
      reason: 'No session provided',
    };
  }

  // Support string input directly
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

  const sessionId: string | undefined = session.id || session.sessionId || undefined;
  const updatedAt: number | undefined = session.updatedAt || session.lastActivityAt || undefined;

  // 1. Pending permissions check (highest priority: session is paused waiting for user approval)
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
    const permList = Array.isArray(session.pendingPermissions)
      ? session.pendingPermissions
      : Array.isArray(session.permissionRequests)
      ? session.permissionRequests
      : Array.isArray(session.permissions)
      ? session.permissions
      : [];

    const details = permList.length > 0
      ? `Pending permissions: ${permList.map((p: any) => (typeof p === 'string' ? p : p.name || p.id || JSON.stringify(p))).join(', ')}`
      : (session.reason || 'Session waiting on tool permissions');

    return {
      sessionId,
      state: 'blocked-permission',
      details,
      reason: details,
      updatedAt,
    };
  }

  // 2. Pending questions check (waiting for user answer/decision)
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
    const qList = Array.isArray(session.pendingQuestions)
      ? session.pendingQuestions
      : Array.isArray(session.questions)
      ? session.questions.filter((q: any) => !q.answered && !q.completed)
      : [];

    const firstQ = qList[0];
    const details = firstQ
      ? `Pending question: ${typeof firstQ === 'string' ? firstQ : firstQ.text || firstQ.question || JSON.stringify(firstQ)}`
      : (session.reason || 'Session waiting on user response');

    return {
      sessionId,
      state: 'blocked-question',
      details,
      reason: details,
      updatedAt,
    };
  }

  // 3. Error / Failure check
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

    return {
      sessionId,
      state: 'failed',
      details,
      reason: details,
      updatedAt,
    };
  }

  // 4. Clean completion check
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
    const details = session.reason || 'Session completed successfully';
    return {
      sessionId,
      state: 'completed',
      details,
      reason: details,
      updatedAt,
    };
  }

  // 5. Active running check
  const isRunning =
    session.status === 'running' ||
    session.status === 'busy' ||
    session.state === 'running' ||
    session.state === 'busy' ||
    session.activity === 'running' ||
    session.busy === true ||
    session.active === true;

  if (isRunning) {
    const details = session.reason || 'Session is actively running';
    return {
      sessionId,
      state: 'running',
      details,
      reason: details,
      updatedAt,
    };
  }

  // 6. Default idle fallback
  const details = session.reason || 'Session is idle';
  return {
    sessionId,
    state: 'idle',
    details,
    reason: details,
    updatedAt,
  };
}

/**
 * Watcher helper class for session inspection.
 */
export class SessionWatcher {
  public inspectSession(session: any): SessionLivenessInfo {
    return inspectSessionLiveness(session);
  }
}
