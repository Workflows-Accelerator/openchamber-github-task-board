// ==========================================
// Standalone single-user board server.
//
// - reads and edits one configured GitHub repository
// - GitHub credentials never leave this process
// - browser auth is a password session + CSRF token
// - no agent control, no session launch, no background polling
// ==========================================

import http from 'node:http';
import { readFileSync } from 'node:fs';
import {
  ConfigError,
  verifyPassword,
  type BoardConfig,
} from './config.ts';
import {
  SESSION_COOKIE,
  SessionStore,
  LoginRateLimiter,
  buildClearCookie,
  buildSessionCookie,
  csrfMatches,
  parseCookieHeader,
} from './auth.ts';
import { GitHubClient, GitHubError, parseIssueNumber } from './github.ts';
import { STATUS_METADATA } from '../../panel/labels.ts';
import {
  BoardError,
  applyQuestionAnswer,
  applySectionEdit,
  applyStatusChange,
  buildBoardList,
  buildIssueDetail,
  issueFingerprint,
} from './board.ts';

export interface BoardServerOptions {
  config: BoardConfig;
  githubApiBase?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sessionTtlMs?: number;
  idleTtlMs?: number;
  logger?: (line: string) => void;
}

export interface BoardServer {
  config: BoardConfig;
  logs: string[];
  listen(port?: number): Promise<{ port: number }>;
  close(): Promise<void>;
}

interface HandlerResponse {
  status: number;
  body?: unknown;
  text?: string;
  type?: string;
  headers?: Record<string, string>;
}

class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const MAX_BODY_BYTES = 64 * 1024;
const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
};
const FORBIDDEN_QUERY_KEYS = ['repo', 'repository', 'owner', 'name', 'org', 'organization'];

function loadStatic(name: string): string {
  return readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
}

function redactLine(line: string, secrets: string[]): string {
  let output = line;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) output = output.split(secret).join('[redacted]');
  }
  return output
    .replace(/gh[pousr]_[A-Za-z0-9_]{8,}/g, '[redacted-token]')
    .replace(/github_pat_[A-Za-z0-9_]{8,}/g, '[redacted-token]')
    .replace(/board_session=[^;\s]+/g, 'board_session=[redacted]');
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new HttpError(413, 'payload_too_large', 'The request body is too large'));
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'invalid_json', 'The request body must be JSON'));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'invalid_request', 'The request could not be read')));
  });
}

function mapGitHubError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof GitHubError) {
    if (error.kind === 'not_found') {
      throw new HttpError(404, 'not_found', 'That issue was not found in the configured repository');
    }
    if (error.kind === 'invalid') {
      throw new HttpError(400, 'invalid_request', 'The issue reference is not valid');
    }
    if (error.kind === 'rate_limited') {
      throw new HttpError(503, 'github_rate_limited', 'GitHub is rate limiting the board; try again later');
    }
    throw new HttpError(502, 'github_unavailable', 'GitHub could not be reached');
  }
  throw error;
}

export async function createBoardServer(options: BoardServerOptions): Promise<BoardServer> {
  const { config } = options;
  const now = options.now ?? Date.now;
  const logs: string[] = [];
  const sink = options.logger ?? (() => {});
  const secrets = [config.githubToken, config.sessionSecret];

  const log = (line: string) => {
    const safe = redactLine(line, secrets);
    logs.push(safe);
    sink(safe);
  };

  const github = new GitHubClient({
    apiBase: options.githubApiBase ?? config.githubApiBase,
    token: config.githubToken,
    repo: config.repo,
    fetchImpl: options.fetchImpl,
  });

  // --- startup identity enforcement -------------------------------------
  let account: { login: string };
  try {
    account = await github.getAuthenticatedUser();
  } catch (error) {
    if (error instanceof GitHubError && error.kind === 'unauthorized') {
      throw new ConfigError('BOARD_GITHUB_TOKEN', 'BOARD_GITHUB_TOKEN was rejected by GitHub');
    }
    throw new ConfigError('BOARD_GITHUB_TOKEN', 'BOARD_GITHUB_TOKEN could not be verified with GitHub');
  }
  if (account.login.toLowerCase() !== config.githubLogin.toLowerCase()) {
    throw new ConfigError(
      'BOARD_GITHUB_LOGIN',
      'BOARD_GITHUB_LOGIN does not match the account that owns BOARD_GITHUB_TOKEN',
    );
  }
  try {
    await github.getRepository();
  } catch (error) {
    if (error instanceof GitHubError && error.kind === 'unauthorized') {
      throw new ConfigError('BOARD_REPO', 'BOARD_REPO is not accessible to the stored GitHub token');
    }
    throw new ConfigError('BOARD_REPO', 'BOARD_REPO could not be verified with GitHub');
  }

  const sessions = new SessionStore({
    secret: config.sessionSecret,
    absoluteTtlMs: options.sessionTtlMs,
    idleTtlMs: options.idleTtlMs,
    now,
  });
  const limiter = new LoginRateLimiter({ now });

  const assets: Record<string, { body: string; type: string }> = {
    '/': { body: loadStatic('index.html'), type: 'text/html; charset=utf-8' },
    '/index.html': { body: loadStatic('index.html'), type: 'text/html; charset=utf-8' },
    '/app.js': { body: loadStatic('app.js'), type: 'text/javascript; charset=utf-8' },
    '/theme.css': { body: loadStatic('theme.css'), type: 'text/css; charset=utf-8' },
  };

  const server = http.createServer((req, res) => {
    const startedAt = Date.now();
    void (async () => {
      let response: HandlerResponse = { status: 204 };
      try {
        response = await handle(req);
      } catch (error) {
        if (error instanceof HttpError) {
          response = {
            status: error.status,
            body: { error: error.code, message: error.message, ...error.extra },
          };
        } else {
          response = {
            status: 500,
            body: { error: 'server_error', message: 'The board could not complete that request' },
          };
        }
      }

      for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
      if (config.baseUrl && config.baseUrl.startsWith('https:')) {
        res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
      }
      for (const [name, value] of Object.entries(response.headers ?? {})) {
        res.setHeader(name, value);
      }
      res.statusCode = response.status;
      if (response.text !== undefined) {
        res.setHeader('content-type', response.type ?? 'text/plain; charset=utf-8');
        res.end(response.text);
      } else if (response.body !== undefined) {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(response.body));
      } else {
        res.end();
      }

      const pathname = (req.url ?? '/').split('?')[0];
      log(`${req.method ?? 'GET'} ${pathname} ${response.status} ${Date.now() - startedAt}ms`);
    })();
  });

  function assertRepoAllowed(url: URL): void {
    for (const key of FORBIDDEN_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        throw new HttpError(
          400,
          'repository_not_allowed',
          'The repository is fixed by the server configuration and cannot be supplied by the client',
        );
      }
    }
    if (/^\/repos(\/|$)/i.test(url.pathname) || /another[-_]?repo/i.test(url.pathname)) {
      throw new HttpError(
        400,
        'repository_not_allowed',
        'The repository is fixed by the server configuration and cannot be supplied by the client',
      );
    }
  }

  function requireSession(req: http.IncomingMessage) {
    const cookies = parseCookieHeader(req.headers.cookie);
    const record = sessions.get(cookies[SESSION_COOKIE]);
    if (!record) {
      throw new HttpError(401, 'unauthenticated', 'Sign in to use this board');
    }
    return record;
  }

  function requireCsrf(req: http.IncomingMessage, record: { csrfToken: string }): void {
    const provided = req.headers['x-csrf-token'];
    const token = Array.isArray(provided) ? provided[0] : provided;
    if (!csrfMatches(record.csrfToken, token)) {
      throw new HttpError(403, 'csrf_rejected', 'That request is missing a valid CSRF token');
    }
  }

  async function handle(req: http.IncomingMessage): Promise<HandlerResponse> {
    const url = new URL(req.url ?? '/', 'http://board.local');
    const method = req.method ?? 'GET';
    assertRepoAllowed(url);

    if (method === 'GET' && assets[url.pathname]) {
      const asset = assets[url.pathname];
      return { status: 200, text: asset.body, type: asset.type };
    }
    if (method !== 'GET' && assets[url.pathname]) {
      return { status: 405, body: { error: 'method_not_allowed', message: 'That method is not allowed' }, headers: { allow: 'GET' } };
    }

    if (url.pathname === '/api/session') {
      if (method === 'POST') return login(req);
      if (method === 'GET') {
        const cookies = parseCookieHeader(req.headers.cookie);
        const record = sessions.get(cookies[SESSION_COOKIE]);
        if (!record) return { status: 200, body: { authenticated: false } };
        return {
          status: 200,
          body: { authenticated: true, csrfToken: record.csrfToken, expiresAt: new Date(record.expiresAt).toISOString() },
        };
      }
      if (method === 'DELETE') {
        const record = requireSession(req);
        requireCsrf(req, record);
        sessions.destroy(parseCookieHeader(req.headers.cookie)[SESSION_COOKIE]);
        return { status: 204, headers: { 'set-cookie': buildClearCookie() } };
      }
      return { status: 405, body: { error: 'method_not_allowed', message: 'That method is not allowed' }, headers: { allow: 'GET, POST, DELETE' } };
    }

    if (!url.pathname.startsWith('/api/')) {
      return { status: 404, body: { error: 'not_found', message: 'Not found' } };
    }

    const record = requireSession(req);

    if (url.pathname === '/api/board' && method !== 'GET') {
      return methodNotAllowed('GET');
    }
    if (method === 'GET' && url.pathname === '/api/board') {
      const { items, truncated } = await github.listIssues().catch(mapGitHubError);
      const { issues, excluded } = buildBoardList(items);
      return {
        status: 200,
        body: {
          repo: config.repo.full,
          login: config.githubLogin,
          fetchedAt: new Date(now()).toISOString(),
          truncated,
          excludedPullRequests: excluded,
          issues,
        },
      };
    }

    const detailMatch = /^\/api\/issues\/([^/]+)$/.exec(url.pathname);
    if (method === 'GET' && detailMatch) {
      const number = parseIssueNumberOrThrow(detailMatch[1]);
      const read = await github.getIssue(number).catch(mapGitHubError);
      if (read.item.pull_request) {
        throw new HttpError(404, 'not_found', 'That number is a pull request, not an issue');
      }
      return {
        status: 200,
        body: {
          issue: buildIssueDetail(read.item),
          fetchedAt: new Date(now()).toISOString(),
          statusOptions: statusOptions(),
        },
      };
    }

    const sectionMatch = /^\/api\/issues\/([^/]+)\/section$/.exec(url.pathname);
    if (sectionMatch) {
      if (method !== 'PUT') return methodNotAllowed('PUT');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(sectionMatch[1]);
      const body = await readJsonBody(req);
      return writeIssue(number, body, (fresh) => ({
        body: applySectionEdit(fresh, body?.sectionId, body?.text),
      }));
    }

    const answerMatch = /^\/api\/issues\/([^/]+)\/questions\/([^/]+)\/answer$/.exec(url.pathname);
    if (answerMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(answerMatch[1]);
      const index = Number(answerMatch[2]);
      if (!/^\d{1,4}$/.test(answerMatch[2])) {
        throw new HttpError(400, 'invalid_request', 'The question index is not valid');
      }
      const body = await readJsonBody(req);
      return writeIssue(number, body, (fresh) => ({
        body: applyQuestionAnswer(fresh, index, body?.answer),
      }));
    }

    const statusMatch = /^\/api\/issues\/([^/]+)\/status$/.exec(url.pathname);
    if (statusMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(statusMatch[1]);
      const body = await readJsonBody(req);
      if (!body || typeof body.status !== 'string') {
        throw new HttpError(400, 'invalid_request', 'A status label is required');
      }
      return writeIssue(number, body, (fresh) => ({
        labels: applyStatusChange(fresh, body.status),
      }));
    }

    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
        return methodNotAllowed('GET, POST, PUT, DELETE');
      }
      return { status: 404, body: { error: 'not_found', message: 'Not found' } };
    }
    return { status: 404, body: { error: 'not_found', message: 'Not found' } };
  }

  function methodNotAllowed(allow: string): HandlerResponse {
    return {
      status: 405,
      body: { error: 'method_not_allowed', message: 'That method is not allowed' },
      headers: { allow },
    };
  }

  function parseIssueNumberOrThrow(value: string): number {
    try {
      return parseIssueNumber(value);
    } catch {
      throw new HttpError(400, 'invalid_request', 'The issue number is not valid');
    }
  }

  async function login(req: http.IncomingMessage): Promise<HandlerResponse> {
    const ip = req.socket.remoteAddress ?? 'unknown';
    const verdict = limiter.check(ip);
    const body = await readJsonBody(req).catch((error) => {
      throw error instanceof HttpError ? error : new HttpError(400, 'invalid_json', 'The request body must be JSON');
    });
    const password = body && typeof body.password === 'string' ? body.password : '';
    const valid = verifyPassword(password, config.passwordHash);

    if (!valid) {
      if (!verdict.allowed) {
        limiter.recordFailure(ip);
        return {
          status: 429,
          body: {
            error: 'rate_limited',
            message: 'Too many failed sign-ins; wait a moment and try again',
            retryAfterSeconds: verdict.retryAfterSeconds,
          },
          headers: { 'retry-after': String(verdict.retryAfterSeconds) },
        };
      }
      limiter.recordFailure(ip);
      return { status: 401, body: { error: 'invalid_credentials', message: 'That password is not correct' } };
    }

    limiter.recordSuccess(ip);
    const created = sessions.create(ip);
    return {
      status: 200,
      body: {
        authenticated: true,
        csrfToken: created.csrfToken,
        expiresAt: new Date(now() + created.maxAgeSeconds * 1000).toISOString(),
      },
      headers: { 'set-cookie': buildSessionCookie(created.cookieValue, created.maxAgeSeconds) },
    };
  }

  async function writeIssue(
    number: number,
    body: any,
    computePatch: (fresh: any) => Record<string, unknown>,
  ): Promise<HandlerResponse> {
    const supplied = body && typeof body.fingerprint === 'string' ? body.fingerprint : '';
    if (!/^[a-f0-9]{64}$/.test(supplied)) {
      throw new HttpError(
        400,
        'fingerprint_required',
        'Reload the task and retry; the board needs the fingerprint from a current read',
      );
    }

    const fresh = await github.getIssue(number).catch(mapGitHubError);
    if (fresh.item.pull_request) {
      throw new HttpError(404, 'not_found', 'That number is a pull request, not an issue');
    }

    const currentFingerprint = issueFingerprint(fresh.item);
    if (currentFingerprint !== supplied) {
      throw new HttpError(409, 'conflict', 'This task changed on GitHub after you opened it; nothing was written', {
        issue: buildIssueDetail(fresh.item),
        statusOptions: statusOptions(),
      });
    }

    let patch: Record<string, unknown>;
    try {
      patch = computePatch(fresh.item);
    } catch (error) {
      if (error instanceof BoardError) {
        throw new HttpError(400, 'invalid_edit', error.message);
      }
      throw error;
    }

    for (const [key, value] of Object.entries(patch)) {
      if (key === 'body' && typeof fresh.item.body === 'string' && value === fresh.item.body) {
        throw new HttpError(400, 'invalid_edit', 'That change would leave the issue unchanged');
      }
    }

    let updated: Awaited<ReturnType<GitHubClient['updateIssue']>> | null = null;
    try {
      updated = await github.updateIssue(number, patch, { etag: fresh.etag });
    } catch (error) {
      if (error instanceof GitHubError && error.status === 412) {
        const reread = await github.getIssue(number).catch(mapGitHubError);
        throw new HttpError(409, 'conflict', 'This task changed on GitHub while saving; nothing was written', {
          issue: buildIssueDetail(reread.item),
          statusOptions: statusOptions(),
        });
      }
      mapGitHubError(error);
    }

    if (!updated) throw new HttpError(502, 'github_unavailable', 'GitHub could not be reached');
    log(`write issue=${number} fields=${Object.keys(patch).join(',')}`);
    return {
      status: 200,
      body: {
        issue: buildIssueDetail(updated.item),
        savedAt: new Date(now()).toISOString(),
        statusOptions: statusOptions(),
      },
    };
  }

  return {
    config,
    logs,
    listen(port = config.port) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          const address = server.address();
          resolve({ port: typeof address === 'object' && address ? address.port : port });
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    },
  };
}

export function statusOptions(): Array<{ value: string; label: string }> {
  return STATUS_OPTIONS;
}

const STATUS_OPTIONS = (['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'] as const).map(
  (id) => ({ value: STATUS_METADATA[id].label, label: STATUS_METADATA[id].displayName }),
);
