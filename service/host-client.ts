/**
 * The service's way back into OpenChamber, without importing the SDK.
 *
 * A bundled host service cannot import `@openchamber/sdk` (the bundle leaves
 * packages external and the host runs the file with no `node_modules`), so this
 * mirrors the three calls this extension uses from the SDK 2.7.1 wire:
 * `POST {OPENCHAMBER_HOST_CALLBACK_URL}/service/call` with the service bearer
 * and `{ method, input }`, answering `{ result }` or `{ error: { code } }`.
 */

export const HOST_CALLBACK_URL_ENV = 'OPENCHAMBER_HOST_CALLBACK_URL';
export const SERVICE_HOST_PATH = '/service/call';
export const SERVICE_HOST_TIMEOUT_MS = 30_000;

export class HostCallError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'HostCallError';
    this.code = code;
    this.status = status;
  }
}

export type SessionStatus = 'idle' | 'busy' | 'waiting';

export interface MarkTarget {
  sessionId: string;
}

export interface MarkPayload {
  icon: string;
  tone: 'info' | 'warning';
  text: string;
}

export interface ServiceHostClient {
  setInstructions(directory: string | null, text: string): Promise<void>;
  setMark(target: MarkTarget, mark: MarkPayload | null): Promise<void>;
  sessionStatus(sessionId: string): Promise<SessionStatus>;
}

type HostEnv = Record<string, string | undefined>;

/** Creates the callback client. A missing callback address or token fails every call with `HOST_UNAVAILABLE`. */
export function createHostClient(env: HostEnv): ServiceHostClient {
  const call = async (method: string, input: unknown): Promise<unknown> => {
    const base = env[HOST_CALLBACK_URL_ENV];
    const token = env.OPENCHAMBER_SERVICE_TOKEN;
    if (!base || !token) {
      throw new HostCallError('This service was not started by OpenChamber.', 'HOST_UNAVAILABLE', 0);
    }
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/+$/, '')}${SERVICE_HOST_PATH}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, input }),
        signal: AbortSignal.timeout(SERVICE_HOST_TIMEOUT_MS),
      });
    } catch {
      throw new HostCallError('OpenChamber did not answer.', 'HOST_UNAVAILABLE', 0);
    }
    const body = (await response.json().catch(() => null)) as
      | { result?: unknown; error?: { code?: string; message?: string } }
      | null;
    if (response.ok && body?.result !== undefined) return body.result;
    throw new HostCallError(
      body?.error?.message ?? `OpenChamber answered HTTP ${response.status}.`,
      body?.error?.code ?? 'HOST_UNAVAILABLE',
      response.status
    );
  };

  return {
    setInstructions: async (directory, text) => {
      await call('instructions.set', { directory, text });
    },
    setMark: async (target, mark) => {
      await call('marks.set', { target, mark });
    },
    sessionStatus: async (sessionId) => {
      const result = (await call('sessions.status', { sessionId })) as { status?: unknown } | null;
      const status = result?.status;
      if (status === 'idle' || status === 'busy' || status === 'waiting') return status;
      throw new HostCallError('OpenChamber answered an unknown session status.', 'HOST_UNAVAILABLE', 0);
    },
  };
}
