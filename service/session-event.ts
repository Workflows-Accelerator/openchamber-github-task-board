/**
 * The body OpenChamber posts to `SESSION_EVENTS_PATH`, read without the SDK.
 *
 * This mirrors `readSessionEventRequest` from `@openchamber/sdk` 2.7.1 (which a
 * bundled service cannot import): same envelope checks, same fields, `null` for
 * a body that is not a session event of this wire version. A test compares it
 * with the real SDK reader on valid and malformed fixtures.
 */

export const SESSION_EVENTS_WIRE_VERSION = 1;
export const SESSION_EVENTS_PATH = '/session-events';

export const SESSION_EVENT_TYPES = [
  'turn-finished',
  'turn-failed',
  'permission-asked',
  'question-asked',
  'turn-started',
  'session-created',
  'session-archived',
  'session-deleted',
] as const;

export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];

export interface SessionEventRequest {
  v: typeof SESSION_EVENTS_WIRE_VERSION;
  requestId: string;
  event: {
    id: string;
    type: SessionEventType;
    at: number;
    session: { id: string; parentId: string | null };
    project: { directory: string | null };
    linked: unknown[];
    permission?: { requestId: string };
    question?: { kind: 'form' | 'page'; id: string };
  };
}

const isSessionEventType = (value: string): value is SessionEventType =>
  (SESSION_EVENT_TYPES as readonly string[]).includes(value);

const isObject = (value: unknown): value is Record<string, unknown> => Object(value) === value;

/** `null` when the body is not a session event of this wire version. */
export function readSessionEvent(body: string): SessionEventRequest | null {
  let wire: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isObject(parsed) || parsed === null || Array.isArray(parsed)) return null;
    wire = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const { v, requestId, event } = wire;
  if (v !== SESSION_EVENTS_WIRE_VERSION) return null;
  if (typeof requestId !== 'string' || requestId.length === 0) return null;
  if (!isObject(event) || event === undefined) return null;

  const { id, type, at, session, project, linked, permission, question } = event as Record<string, unknown>;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof type !== 'string' || !isSessionEventType(type)) return null;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (!isObject(session) || session === undefined) return null;

  const sessionId = (session as Record<string, unknown>).id;
  if (typeof sessionId !== 'string' || sessionId.length === 0) return null;
  const parentId = (session as Record<string, unknown>).parentId;
  if (parentId !== null && (typeof parentId !== 'string' || parentId.length === 0)) return null;
  if (!isObject(project) || project === undefined) return null;

  const directory = (project as Record<string, unknown>).directory;
  if (directory !== null && (typeof directory !== 'string' || directory.length === 0)) return null;
  if (!Array.isArray(linked)) return null;

  const request: SessionEventRequest = {
    v: SESSION_EVENTS_WIRE_VERSION,
    requestId,
    event: {
      id,
      type,
      at,
      session: { id: sessionId, parentId },
      project: { directory },
      linked,
    },
  };

  if (permission !== undefined) {
    if (!isObject(permission)) return null;
    const permissionRequestId = (permission as Record<string, unknown>).requestId;
    if (typeof permissionRequestId !== 'string' || permissionRequestId.length === 0) return null;
    request.event.permission = { requestId: permissionRequestId };
  }

  if (question !== undefined) {
    if (!isObject(question)) return null;
    const kind = (question as Record<string, unknown>).kind;
    const questionId = (question as Record<string, unknown>).id;
    if (kind !== 'form' && kind !== 'page') return null;
    if (typeof questionId !== 'string' || questionId.length === 0) return null;
    request.event.question = { kind, id: questionId };
  }

  return request;
}
