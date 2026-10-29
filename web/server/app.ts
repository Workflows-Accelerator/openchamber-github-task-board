// ==========================================
// Standalone single-user board server.
//
// - reads and edits exact token-visible GitHub repositories
// - GitHub credentials never leave this process
// - browser auth is a password session + CSRF token
// - no agent control, no session launch, no background polling
// ==========================================

import http from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ConfigError,
  verifyPassword,
  verifyPasswordAsync,
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
import { GitHubClient, GitHubError, parseIssueNumber, type IssueRead } from './github.ts';
import { RepositoryRegistry, RepositoryNotAllowedError, DiscoveryUnavailableError, type RepositoryEntry } from './repositories.ts';
import { STATUS_METADATA } from '../../panel/labels.ts';
import { findSections, replaceSectionText, SectionError } from './sections.ts';
import {
  BoardError,
  hasUnfencedOrderMarkerComment, parseOrderMarker, stripOrderMarker, setOrderMarker, midpointOrder,
  applyQuestionAnswer,
  applySectionEdit,
  applyStatusChange,
  buildBoardList,
  buildBoardListItem,
  buildIssueDetail,
  issueFingerprint,
  issueKey,
  labelNames,
  statusLabelOf,
} from './board.ts';

export interface BoardServerOptions {
  config: BoardConfig;
  githubApiBase?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sessionTtlMs?: number;
  idleTtlMs?: number;
  sessionFilePath?: string;
  versionStamp?: string;
  loginTimeoutMs?: number;
  logger?: (line: string) => void;
  packageJsonUrl?: URL | string;
  repositoryTtlMs?: number;
}

export interface BoardServer {
  config: BoardConfig;
  logs: string[];
  listen(port?: number, host?: string): Promise<{ port: number; host: string }>;
  close(): Promise<void>;
}

interface HandlerResponse {
  status: number;
  body?: unknown;
  text?: string;
  buffer?: Buffer;
  type?: string;
  headers?: Record<string, string>;
}

class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  headers: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.headers = headers;
  }
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_AGGREGATE_ISSUES = 500;
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

function loadStaticBuffer(name: string): Buffer {
  return readFileSync(new URL(`../public/${name}`, import.meta.url));
}

let cachedVersion: string | null = null;
export function getPackageVersion(packageJsonUrl: URL | string = new URL('../../package.json', import.meta.url)): string {
  const isDefault = packageJsonUrl.toString() === new URL('../../package.json', import.meta.url).toString();
  if (isDefault && cachedVersion !== null) return cachedVersion;
  try {
    const raw = readFileSync(packageJsonUrl, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.version === 'string' && parsed.version) {
      if (isDefault) cachedVersion = parsed.version;
      return parsed.version;
    }
  } catch {}
  return 'unknown';
}

export function getVersionStamp(
  packageJsonUrl: URL | string = new URL('../../package.json', import.meta.url),
): string {
  const pkgVersion = getPackageVersion(packageJsonUrl);
  try {
    const hash = createHash('sha256');
    const shellAssets = ['index.html', 'app.js', 'theme.css', 'manifest.json'];
    for (const name of shellAssets) {
      const content = readFileSync(new URL(`../public/${name}`, import.meta.url));
      hash.update(name);
      hash.update(content);
    }
    const digest = hash.digest('hex').slice(0, 10);
    return `${pkgVersion}-${digest}`;
  } catch {
    return pkgVersion;
  }
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

function readJsonBody(req: http.IncomingMessage, timeoutMs = 10_000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (req.destroyed || req.closed) {
      reject(new HttpError(400, 'invalid_request', 'The request was aborted'));
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    let done = false;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('close', onClose);
    };

    const finishReject = (error: Error) => {
      if (done) return;
      done = true;
      cleanup();
      reject(error);
    };

    const finishResolve = (val: any) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(val);
    };

    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    };

    const onEnd = () => {
      if (tooLarge) {
        finishReject(new HttpError(413, 'payload_too_large', 'The request body is too large'));
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return finishResolve(null);
      try {
        finishResolve(JSON.parse(raw));
      } catch {
        finishReject(new HttpError(400, 'invalid_json', 'The request body must be JSON'));
      }
    };

    const onError = () => {
      finishReject(new HttpError(400, 'invalid_request', 'The request could not be read'));
    };

    const onClose = () => {
      if (!req.readableEnded) {
        finishReject(new HttpError(400, 'invalid_request', 'The request connection was closed prematurely'));
      }
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        req.destroy();
        finishReject(new HttpError(408, 'request_timeout', 'Request body timed out'));
      }, timeoutMs);
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
  });
}

function mapGitHubError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof GitHubError) {
    if (error.kind === 'unauthorized') {
      throw new HttpError(502, 'github_unauthorized', 'GitHub rejected credentials or token expired');
    }
    if (error.kind === 'forbidden') {
      throw new HttpError(502, 'github_forbidden', 'GitHub refused access to the repository');
    }
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

class ScryptQueue {
  private active = 0;
  private readonly maxConcurrent: number;
  private readonly maxQueue: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxConcurrent = 2, maxQueue = 4) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new HttpError(
          429,
          'rate_limited',
          'The sign-in service is busy; try again in a moment',
          { retryAfterSeconds: 2 },
          { 'retry-after': '2' },
        );
      }
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

function getClientIp(req: http.IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

function assertOriginAllowed(req: http.IncomingMessage, baseUrl: string | null): void {
  if (!baseUrl) return;
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(baseUrl).origin;
  } catch {
    return;
  }
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.trim()) {
    let parsedOrigin: string;
    try {
      parsedOrigin = new URL(origin).origin;
    } catch {
      throw new HttpError(403, 'cross_origin_rejected', 'Cross-origin write requests are not allowed');
    }
    if (parsedOrigin !== expectedOrigin) {
      throw new HttpError(403, 'cross_origin_rejected', 'Cross-origin write requests are not allowed');
    }
    return;
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.trim()) {
    let parsedRefererOrigin: string;
    try {
      parsedRefererOrigin = new URL(referer).origin;
    } catch {
      throw new HttpError(403, 'cross_origin_rejected', 'Cross-origin write requests are not allowed');
    }
    if (parsedRefererOrigin !== expectedOrigin) {
      throw new HttpError(403, 'cross_origin_rejected', 'Cross-origin write requests are not allowed');
    }
  }
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
    if (error instanceof GitHubError && (error.kind === 'unauthorized' || error.kind === 'forbidden')) {
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
  const repositories = new RepositoryRegistry({ client: github, now, ttlMs: options.repositoryTtlMs });
  await repositories.view(); // Nonfatal: sign-in can disclose discovery failure distinctly.
  function clientFor(repository: RepositoryEntry): GitHubClient {
    return new GitHubClient({ apiBase: options.githubApiBase ?? config.githubApiBase,
      token: config.githubToken, repo: repository, fetchImpl: options.fetchImpl });
  }
  async function resolveRepository(owner: string, name: string): Promise<RepositoryEntry> {
    try { return await repositories.resolve(owner, name); }
    catch (error) {
      if (error instanceof RepositoryNotAllowedError) throw new HttpError(400, 'repository_not_allowed', error.message);
      if (error instanceof DiscoveryUnavailableError) throw new HttpError(503, 'discovery_unavailable', 'Repository discovery failed; no operation was dispatched');
      throw error;
    }
  }

  const sessionFilePath = options.sessionFilePath !== undefined
    ? (options.sessionFilePath || undefined)
    : config.sessionFilePath;

  // Fixed filename beside board data. Repository/name input never becomes a path.
  const namesPath = path.join(path.dirname(sessionFilePath || config.sessionFilePath), 'project-names.json');
  function projectNames(): Record<string, string> {
    try {
      const parsed = JSON.parse(readFileSync(namesPath, 'utf8'));
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
      return Object.fromEntries(Object.entries(parsed).filter(([key, value]) =>
        /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(key) && typeof value === 'string' && value.length <= 60)) as Record<string, string>;
    } catch (error: any) {
      if (error.code === 'ENOENT') return {};
      throw new HttpError(500, 'names_unavailable', 'Project names could not be read; nothing was changed');
    }
  }

  const sessions = new SessionStore({
    secret: config.sessionSecret,
    passwordHash: config.passwordHash,
    filePath: sessionFilePath,
    absoluteTtlMs: options.sessionTtlMs,
    idleTtlMs: options.idleTtlMs,
    now,
  });
  const limiter = new LoginRateLimiter({ now });

  const versionStamp = options.versionStamp ?? getVersionStamp(options.packageJsonUrl);
  const rawSw = loadStatic('sw.js');
  let swBody = rawSw;
  if (/var CACHE_VERSION\s*=\s*['"][^'"]*['"]/.test(rawSw)) {
    swBody = rawSw.replace(
      /var CACHE_VERSION\s*=\s*['"][^'"]*['"]/,
      `var CACHE_VERSION = ${JSON.stringify(versionStamp)}`,
    );
  } else if (/var CACHE_NAME\s*=\s*['"][^'"]*['"]/.test(rawSw)) {
    swBody = rawSw.replace(
      /var CACHE_NAME\s*=\s*['"][^'"]*['"]/,
      `var CACHE_NAME = 'workflows-board-' + ${JSON.stringify(versionStamp)}`,
    );
  }

  const assets: Record<string, { body: string | Buffer; type: string; headers?: Record<string, string> }> = {
    '/': { body: loadStatic('index.html'), type: 'text/html; charset=utf-8' },
    '/index.html': { body: loadStatic('index.html'), type: 'text/html; charset=utf-8' },
    '/app.js': { body: loadStatic('app.js'), type: 'text/javascript; charset=utf-8' },
    '/theme.css': { body: loadStatic('theme.css'), type: 'text/css; charset=utf-8' },
    '/manifest.json': { body: loadStatic('manifest.json'), type: 'application/manifest+json; charset=utf-8' },
    '/sw.js': {
      body: swBody,
      type: 'application/javascript; charset=utf-8',
      headers: {
        'service-worker-allowed': '/',
        'cache-control': 'no-cache',
      },
    },
    '/icon.svg': { body: loadStatic('icon.svg'), type: 'image/svg+xml; charset=utf-8' },
    '/icon-192.png': { body: loadStaticBuffer('icon-192.png'), type: 'image/png' },
    '/icon-512.png': { body: loadStaticBuffer('icon-512.png'), type: 'image/png' },
    '/apple-touch-icon.png': { body: loadStaticBuffer('apple-touch-icon.png'), type: 'image/png' },
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
            headers: error.headers,
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
      if (response.buffer !== undefined) {
        res.setHeader('content-type', response.type ?? 'application/octet-stream');
        res.end(response.buffer);
      } else if (response.text !== undefined) {
        res.setHeader('content-type', response.type ?? 'text/plain; charset=utf-8');
        res.end(response.text);
      } else if (response.body !== undefined) {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(response.body));
      } else {
        res.end();
      }

      const pathname = (req.url ?? '/').split('?')[0];
      log(`${req.method ?? 'GET'} ${pathname.replace(/\/api\/repos\/[^/]+\/[^/]+/, '/api/repos/:owner/:name')} ${response.status} ${Date.now() - startedAt}ms`);
    })();
  });

  function assertRepoAllowed(url: URL): void {
    for (const key of FORBIDDEN_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        throw new HttpError(
          400,
          'repository_not_allowed',
          'Repository query overrides are not allowed; use an exact discovered repository route',
        );
      }
    }
    if (/^\/repos(\/|$)/i.test(url.pathname) || /another[-_]?repo/i.test(url.pathname)) {
      throw new HttpError(
        400,
        'repository_not_allowed',
        'Repository query overrides are not allowed; use an exact discovered repository route',
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
    assertOriginAllowed(req, config.baseUrl);
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

    if (url.pathname === '/health') {
      if (method !== 'GET') {
        return methodNotAllowed('GET');
      }
      return {
        status: 200,
        body: {
          status: 'ok',
          version: getPackageVersion(options.packageJsonUrl),
          uptime: Math.floor(process.uptime()),
        },
      };
    }

    if (method === 'GET' && assets[url.pathname]) {
      const asset = assets[url.pathname];
      if (Buffer.isBuffer(asset.body)) {
        return { status: 200, buffer: asset.body, type: asset.type, headers: asset.headers };
      }
      return { status: 200, text: asset.body, type: asset.type, headers: asset.headers };
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

    if (url.pathname === '/api/repos') {
      if (method !== 'GET') return methodNotAllowed('GET');
      return { status: 200, body: { ...await repositories.view(), projectNames: projectNames() } };
    }
    if (url.pathname === '/api/project-names') {
      if (method === 'GET') return { status: 200, body: { projectNames: projectNames() } };
      if (method !== 'PUT') return methodNotAllowed('GET, PUT');
      requireCsrf(req, record);
      const body = await readJsonBody(req);
      if (typeof body?.repository !== 'string' || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(body.repository) ||
          typeof body?.name !== 'string' || body.name.trim().length > 60 || /[\x00-\x1f\x7f<>]/.test(body.name)) {
        throw new HttpError(400, 'invalid_name', 'Use a project name of 1–60 characters (empty resets); no control characters or angle brackets');
      }
      const [owner, name] = body.repository.split('/');
      const repository = await resolveRepository(owner, name);
      const names = projectNames();
      const key = repository.full.toLowerCase();
      if (body.name.trim()) names[key] = body.name.trim(); else delete names[key];
      mkdirSync(path.dirname(namesPath), { recursive: true, mode: 0o700 });
      writeFileSync(namesPath + '.tmp', JSON.stringify(names, null, 2) + '\n', { mode: 0o600 });
      renameSync(namesPath + '.tmp', namesPath);
      return { status: 200, body: { projectNames: names } };
    }
    if (url.pathname === '/api/combined/board') {
      if (method !== 'GET') return methodNotAllowed('GET');
      return { status: 200, body: await combinedBoard() };
    }

    // Legacy single-repository routes resolve the same allowlist. No fallback.
    let route = url.pathname;
    let repository: RepositoryEntry | null = null;
    const qualified = /^\/api\/repos\/([^/]+)\/([^/]+)(\/.*)$/.exec(route);
    if (qualified) {
      repository = await resolveRepository(qualified[1], qualified[2]);
      route = '/api' + qualified[3];
    } else if (route.startsWith('/api/repos/')) {
      throw new HttpError(400, 'repository_not_allowed', 'An exact discovered owner/name is required');
    } else if (route === '/api/board' || route === '/api/issues' || route.startsWith('/api/issues/')) {
      if (!config.repo) throw new HttpError(400, 'repository_not_allowed', 'Select a discovered repository');
      repository = await resolveRepository(config.repo.owner, config.repo.name);
    }
    const scopedGithub = repository ? clientFor(repository) : null;
    if (route === '/api/board') {
      if (method !== 'GET') return methodNotAllowed('GET');
      return { status: 200, body: await repositoryBoard(repository!) };
    }

    if (route === '/api/issues' && method === 'POST') {
      requireCsrf(req, record);
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpError(400, 'invalid_request', 'Body must be a JSON object');
      }
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 256) {
        throw new HttpError(400, 'invalid_request', 'Issue title is required and cannot be empty');
      }
      const title = body.title.trim();
      let issueBody: string | undefined = undefined;
      if (body.body !== undefined) {
        if (typeof body.body !== 'string') {
          throw new HttpError(400, 'invalid_request', 'Issue body must be a string');
        }
        issueBody = body.body;
      }
      let labels: string[] = ['status:draft'];
      if (body.labels !== undefined) {
        if (!Array.isArray(body.labels) || !body.labels.every((l: unknown) => typeof l === 'string')) {
          throw new HttpError(400, 'invalid_request', 'Labels must be an array of strings');
        }
        labels = body.labels;
      }
      const created = await scopedGithub!.createIssue({
        title,
        body: issueBody,
        labels,
      }).catch(mapGitHubError);

      return {
        status: 201,
        body: {
          ok: true,
          issue: buildBoardListItem(created.item, repository),
        },
      };
    }

    if (route === '/api/issues/batch-align') {
      throw new HttpError(404, 'not_found', 'Not found');
    }

    const draftMatch = /^\/api\/issues\/([^/]+)\/(draft|order|move)$/.exec(route);
    if (draftMatch) {
      if (method !== 'PUT') return methodNotAllowed('PUT');
      requireCsrf(req, record);
      const body = await readJsonBody(req);
      return writeIssue(repository!, parseIssueNumberOrThrow(draftMatch[1]), body, {
        kind: draftMatch[2] as 'draft' | 'order' | 'move', data: body,
      });
    }

    const detailMatch = /^\/api\/issues\/([^/]+)$/.exec(route);
    if (detailMatch) {
      if (method === 'GET') {
        const number = parseIssueNumberOrThrow(detailMatch[1]);
        const read = await scopedGithub!.getIssue(number).catch(mapGitHubError);
        if (read.item.pull_request) {
          throw new HttpError(404, 'not_found', 'That number is a pull request, not an issue');
        }
        return {
          status: 200,
          body: {
            issue: buildIssueDetail(read.item, repository),
            fetchedAt: new Date(now()).toISOString(),
            statusOptions: statusOptions(),
          },
        };
      }
      if (method === 'PATCH') {
        requireCsrf(req, record);
        const number = parseIssueNumberOrThrow(detailMatch[1]);
        const body = await readJsonBody(req);
        return writeIssue(repository!, number, body, {
          kind: 'patch',
          body: body?.body,
          status: body?.status,
          state: body?.state,
        });
      }
      return methodNotAllowed('GET, PATCH');
    }

    const sectionMatch = /^\/api\/issues\/([^/]+)\/section$/.exec(route);
    if (sectionMatch) {
      if (method !== 'PUT') return methodNotAllowed('PUT');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(sectionMatch[1]);
      const body = await readJsonBody(req);
      return writeIssue(repository!, number, body, {
        kind: 'section',
        sectionId: body?.sectionId,
        text: body?.text,
      });
    }

    const answerMatch = /^\/api\/issues\/([^/]+)\/questions\/([^/]+)\/answer$/.exec(route);
    if (answerMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(answerMatch[1]);
      const index = Number(answerMatch[2]);
      if (!/^\d{1,4}$/.test(answerMatch[2])) {
        throw new HttpError(400, 'invalid_request', 'The question index is not valid');
      }
      const body = await readJsonBody(req);
      return writeIssue(repository!, number, body, {
        kind: 'question',
        index,
        answer: body?.answer,
      });
    }

    const statusMatch = /^\/api\/issues\/([^/]+)\/status$/.exec(route);
    if (statusMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(statusMatch[1]);
      const body = await readJsonBody(req);
      if (!body || typeof body.status !== 'string') {
        throw new HttpError(400, 'invalid_request', 'A status label is required');
      }
      return writeIssue(repository!, number, body, {
        kind: 'status',
        status: body.status,
      });
    }

    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        return methodNotAllowed('GET, POST, PUT, DELETE, PATCH');
      }
      return { status: 404, body: { error: 'not_found', message: 'Not found' } };
    }
    return { status: 404, body: { error: 'not_found', message: 'Not found' } };
  }

  async function repositoryBoard(repository: RepositoryEntry) {
    const listed = repository.hasIssues ? await clientFor(repository).listIssues().catch(mapGitHubError) : { items: [], truncated: false };
    const { issues, excluded } = buildBoardList(listed.items, repository);
    return { scope: 'repo', repository, repo: repository.full, login: config.githubLogin,
      fetchedAt: new Date(now()).toISOString(), truncated: listed.truncated,
      complete: !listed.truncated, partial: listed.truncated, excludedPullRequests: excluded, issues };
  }

  let aggregateInFlight: Promise<unknown> | null = null;
  function combinedBoard(): Promise<unknown> {
    if (aggregateInFlight) return aggregateInFlight;
    aggregateInFlight = aggregate().finally(() => { aggregateInFlight = null; });
    return aggregateInFlight;
  }
  async function aggregate() {
    const discovery = await repositories.view();
    const issues: ReturnType<typeof buildBoardList>['issues'] = [];
    const failures: Array<{ repository: RepositoryEntry; message: string }> = [];
    let cursor = 0;
    let loaded = 0;
    let truncated = false;
    let excluded = 0;
    async function worker() {
      while (cursor < discovery.repositories.length) {
        const repository = discovery.repositories[cursor++];
        if (!repository.available || discovery.discoveryFailed) {
          failures.push({ repository, message: discovery.discoveryFailed ? 'Discovery failed; not refreshed' : 'Unavailable' });
          continue;
        }
        try {
          const board = await repositoryBoard(repository);
          issues.push(...board.issues);
          excluded += board.excludedPullRequests;
          truncated ||= board.truncated;
          if (board.truncated) failures.push({ repository, message: 'Issue page bound reached; incomplete' });
          loaded++;
        } catch {
          failures.push({ repository, message: 'Unavailable or refresh failed' });
        }
      }
    }
    await Promise.all(Array.from({ length: 3 }, () => worker()));
    const truncatedByIssueCap = issues.length > MAX_AGGREGATE_ISSUES;
    if (truncatedByIssueCap) issues.length = MAX_AGGREGATE_ISSUES;
    const limited = truncated || truncatedByIssueCap;
    const partial = discovery.discoveryFailed || failures.length > 0 || limited;
    return { scope: 'all', repo: 'All repositories', ...discovery, issues, failures,
      fetchedAt: new Date(now()).toISOString(), partial, complete: !partial, truncated: limited,
      truncatedByIssueCap, issueCap: MAX_AGGREGATE_ISSUES,
      repositoriesRequested: discovery.repositories.length, repositoriesLoaded: loaded,
      concurrency: 3, maxPagesPerRepository: 10, excludedPullRequests: excluded };
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

  type WriteOp =
    | { kind: 'draft' | 'order' | 'move'; data: any }
    | { kind: 'section'; sectionId: unknown; text: unknown }
    | { kind: 'question'; index: number; answer: unknown }
    | { kind: 'status'; status: unknown }
    | { kind: 'patch'; body?: unknown; status?: unknown; state?: unknown };

  const MAX_IN_FLIGHT_LOGINS = 10;
  const LOGIN_BODY_TIMEOUT_MS = 2_000;
  const LOGIN_SLOT_TIMEOUT_MS = 3_000;
  const inFlightLogins = new Set<string>();
  const scryptQueue = new ScryptQueue(2, 4);
  const issueLocks = new Map<string, Promise<void>>();

  async function withIssueLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (issueLocks.has(key)) {
      try {
        await issueLocks.get(key);
      } catch {
        // ignore errors from prior lock holders
      }
    }
    let release = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    issueLocks.set(key, lockPromise);
    try {
      return await fn();
    } finally {
      issueLocks.delete(key);
      release();
    }
  }

  async function login(req: http.IncomingMessage): Promise<HandlerResponse> {
    const ip = getClientIp(req);
    const verdict = limiter.check(ip);
    if (!verdict.allowed) {
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

    if (inFlightLogins.has(ip)) {
      return {
        status: 429,
        body: {
          error: 'rate_limited',
          message: 'A login request is already in progress for this client; try again in a moment',
          retryAfterSeconds: 1,
        },
        headers: { 'retry-after': '1' },
      };
    }

    if (inFlightLogins.size >= MAX_IN_FLIGHT_LOGINS) {
      return {
        status: 429,
        body: {
          error: 'rate_limited',
          message: 'Too many concurrent sign-in attempts; try again in a moment',
          retryAfterSeconds: 2,
        },
        headers: { 'retry-after': '2' },
      };
    }

    inFlightLogins.add(ip);
    const slotTimer = setTimeout(() => {
      inFlightLogins.delete(ip);
    }, LOGIN_SLOT_TIMEOUT_MS);
    let valid = false;
    try {
      const body = await readJsonBody(req, LOGIN_BODY_TIMEOUT_MS).catch((error) => {
        throw error instanceof HttpError ? error : new HttpError(400, 'invalid_json', 'The request body must be JSON');
      });
      const password = body && typeof body.password === 'string' ? body.password : '';
      valid = await scryptQueue.run(() => verifyPasswordAsync(password, config.passwordHash));
    } finally {
      clearTimeout(slotTimer);
      inFlightLogins.delete(ip);
    }

    if (!valid) {
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
    repository: RepositoryEntry,
    number: number,
    body: any,
    op: WriteOp,
  ): Promise<HandlerResponse> {
    const supplied = body && typeof body.fingerprint === 'string' ? body.fingerprint : '';
    if (!/^[a-f0-9]{64}$/.test(supplied)) {
      throw new HttpError(
        400,
        'fingerprint_required',
        'Reload the task and retry; the board needs the fingerprint from a current read',
      );
    }

    return withIssueLock(issueKey(repository, number), async () => {
      // A queued write must re-resolve freshness before any issue request.
      repository = await resolveRepository(repository.owner, repository.name);
      const github = clientFor(repository);
      const fresh = await github.getIssue(number).catch(mapGitHubError);
      if (fresh.item.pull_request) {
        throw new HttpError(404, 'not_found', 'That number is a pull request, not an issue');
      }

      const currentFingerprint = issueFingerprint(fresh.item, repository);
      if (currentFingerprint !== supplied) {
        throw new HttpError(409, 'conflict', 'This task changed on GitHub after you opened it; nothing was written', {
          issue: buildIssueDetail(fresh.item, repository),
          statusOptions: statusOptions(),
        });
      }

      let movedTo: string | null = null;
      let baseSectionId = '';
      let baseText = '';
      let targetText = '';
      let baseQuestionIndex = -1;
      let baseQuestionText = '';
      let targetAnswer = '';
      let baseStatus: string | null = null;
      let targetStatus = '';

      if (op.kind === 'section') {
        if (typeof op.sectionId !== 'string') {
          throw new HttpError(400, 'invalid_edit', 'A section id is required');
        }
        if (typeof op.text !== 'string') {
          throw new HttpError(400, 'invalid_edit', 'Section text must be a string');
        }
        baseSectionId = op.sectionId;
        const baseSection = findSections(fresh.item.body ?? '').find((s) => s.id === op.sectionId);
        if (!baseSection || !baseSection.editable) {
          throw new HttpError(400, 'invalid_edit', 'That section cannot be edited from the board');
        }
        baseText = baseSection.text;
        targetText = op.text;
        if (targetText === baseText) {
          throw new HttpError(400, 'invalid_edit', 'That change would leave the issue unchanged');
        }
      } else if (op.kind === 'question') {
        if (typeof op.answer !== 'string' || op.answer.trim() === '') {
          throw new HttpError(400, 'invalid_edit', 'An answer is required');
        }
        if (op.answer.length > 2000) {
          throw new HttpError(400, 'invalid_edit', 'The answer is too long');
        }
        const baseDetail = buildIssueDetail(fresh.item, repository);
        const baseQ = baseDetail.openQuestions.find((q) => q.answerIndex === op.index);
        if (!baseQ || baseQ.completed) {
          throw new HttpError(400, 'invalid_edit', 'That open question is no longer answerable');
        }
        baseQuestionIndex = baseQ.index;
        baseQuestionText = baseQ.text;
        targetAnswer = op.answer;
      } else if (op.kind === 'status') {
        if (typeof op.status !== 'string' || !op.status) {
          throw new HttpError(400, 'invalid_edit', 'A status label is required');
        }
        baseStatus = statusLabelOf(labelNames(fresh.item)) ?? '';
        targetStatus = op.status;
        if (targetStatus === baseStatus) {
          throw new HttpError(400, 'invalid_edit', 'That change would leave the issue unchanged');
        }
      } else if (op.kind === 'patch') {
        if (op.body === undefined && op.status === undefined && op.state === undefined) {
          throw new HttpError(400, 'invalid_edit', 'At least one field (body, status, or state) is required');
        }
        if (op.body !== undefined && typeof op.body !== 'string') {
          throw new HttpError(400, 'invalid_edit', 'Body must be a string');
        }
        if (op.status !== undefined) {
          if (typeof op.status !== 'string' || !op.status) {
            throw new HttpError(400, 'invalid_edit', 'A status label must be a non-empty string');
          }
          baseStatus = statusLabelOf(labelNames(fresh.item)) ?? '';
          targetStatus = op.status;
        }
        if (op.state !== undefined && op.state !== 'open' && op.state !== 'closed') {
          throw new HttpError(400, 'invalid_edit', 'State must be open or closed');
        }
      }

      let patch: Record<string, unknown> = {};
      try {
        if (op.kind === 'draft' || op.kind === 'order' || op.kind === 'move') {
          if (fresh.item.state !== 'open' || statusLabelOf(labelNames(fresh.item)) !== 'status:draft') {
            throw new HttpError(400, 'not_draft', 'Only open drafts can be edited, moved or reordered here');
          }
          if (op.kind === 'draft') {
            if (typeof op.data.title !== 'string' || !op.data.title.trim() || op.data.title.trim().length > 256 ||
                typeof op.data.description !== 'string' || op.data.description.length > 50000 || hasUnfencedOrderMarkerComment(op.data.description)) {
              throw new HttpError(400, 'invalid_draft', 'Use a title of 1–256 characters and a description up to 50,000 characters');
            }
            const order = parseOrderMarker(fresh.item.body ?? '');
            patch = { title: op.data.title.trim(), body: order === null ? op.data.description : setOrderMarker(op.data.description, order) };
          } else if (op.kind === 'order') {
            const previous = op.data.previous;
            const next = op.data.next;
            if (![previous, next].every((value) => value === null || (typeof value === 'number' && Number.isFinite(value)))) {
              throw new HttpError(400, 'invalid_order', 'Order neighbours must be finite numbers or null');
            }
            const order = midpointOrder(previous, next);
            if (!Number.isFinite(order) || (previous !== null && next !== null && !(order > previous && order < next))) {
              throw new HttpError(409, 'order_precision', 'No space between these neighbours; choose another position');
            }
            patch = { body: setOrderMarker(fresh.item.body ?? '', order) };
          } else {
            if (typeof op.data.target !== 'string' || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(op.data.target)) {
              throw new HttpError(400, 'invalid_target', 'Select a discovered target project');
            }
            const [owner, name] = op.data.target.split('/');
            const target = await resolveRepository(owner, name);
            if (target.full.toLowerCase() === repository.full.toLowerCase() || target.archived || !target.hasIssues) {
              throw new HttpError(400, 'invalid_target', 'Select a different writable project');
            }
            const created = await clientFor(target).createIssue({ title: fresh.item.title,
              body: fresh.item.body ?? '', labels: labelNames(fresh.item) }).catch(mapGitHubError);
            if (!Number.isSafeInteger(created.item.number) || created.item.number <= 0) {
              throw new HttpError(502, 'write_outcome_unknown', 'Target creation outcome unknown; source was not closed. Inspect target project before retrying.');
            }
            movedTo = `https://github.com/${target.full}/issues/${created.item.number}`;
            if (created.item.title !== fresh.item.title || (created.item.body ?? '') !== (fresh.item.body ?? '') || created.item.state !== 'open') {
              throw new HttpError(409, 'partial_move', 'Target creation response did not match the draft; source was not closed. Do not repeat move.', { targetUrl: movedTo });
            }
            // Never close source unless creation and its link comment both succeeded.
            try { await github.addComment(number, `Moved to ${movedTo}`); }
            catch { throw new HttpError(409, 'partial_move', 'Target created, source remains open. Do not repeat move; inspect both issues.', { targetUrl: movedTo }); }
            // Comment creation may change GitHub's ETag; re-read and compare content.
            const afterComment = await github.getIssue(number).catch(() => {
              throw new HttpError(409, 'partial_move', 'Target created; source refresh failed, so source was not closed. Do not repeat move.', { targetUrl: movedTo });
            });
            if (issueFingerprint(afterComment.item, repository) !== supplied) {
              throw new HttpError(409, 'partial_move', 'Target created, source changed and was not closed. Do not repeat move.', { targetUrl: movedTo });
            }
            fresh.etag = afterComment.etag;
            patch = { state: 'closed' };
          }
        } else if (op.kind === 'section') {
          patch = { body: replaceSectionText(stripOrderMarker(fresh.item.body ?? ''), baseSectionId, op.text) };
          const order = parseOrderMarker(fresh.item.body ?? '');
          if (order !== null) patch.body = setOrderMarker(patch.body as string, order);
        } else if (op.kind === 'question') {
          const curDetail = buildIssueDetail(fresh.item, repository);
          const curQView = curDetail.openQuestions[baseQuestionIndex];
          const answerIdx = curQView?.answerIndex ?? op.index;
          patch = { body: applyQuestionAnswer(fresh.item, answerIdx, op.answer) };
        } else if (op.kind === 'status') {
          patch = { labels: applyStatusChange(fresh.item, op.status) };
        } else if (op.kind === 'patch') {
          patch = {};
          if (typeof op.body === 'string') {
            const order = parseOrderMarker(fresh.item.body ?? '');
            patch.body = order !== null ? setOrderMarker(op.body, order) : op.body;
          }
          if (typeof op.status === 'string') {
            patch.labels = applyStatusChange(fresh.item, op.status);
          }
          if (typeof op.state === 'string') {
            patch.state = op.state;
          }
          const currentBodyNorm = (fresh.item.body ?? '').replace(/\r\n/g, '\n');
          const targetBodyNorm = typeof op.body === 'string' ? (patch.body as string).replace(/\r\n/g, '\n') : currentBodyNorm;
          const bodyChanged = typeof op.body === 'string' && currentBodyNorm !== targetBodyNorm;
          const statusChanged = typeof op.status === 'string' && targetStatus !== baseStatus;
          const stateChanged = typeof op.state === 'string' && op.state !== fresh.item.state;
          if (!bodyChanged && !statusChanged && !stateChanged) {
            throw new HttpError(400, 'invalid_edit', 'That change would leave the issue unchanged');
          }
        }
      } catch (error) {
        if (error instanceof BoardError) throw new HttpError(400, 'invalid_edit', error.message);
        if (error instanceof SectionError) throw new HttpError(400, 'invalid_edit', error.message);
        throw error;
      }

      try {
        await github.updateIssue(number, patch, { etag: fresh.etag });
      } catch (error) {
        if (movedTo) throw new HttpError(409, 'partial_move', 'Target created; source close failed or is uncertain. Do not repeat move; inspect both issues.', { targetUrl: movedTo });
        if (error instanceof GitHubError && error.status === 412) {
          const reread = await github.getIssue(number).catch(mapGitHubError);
          throw new HttpError(409, 'conflict', 'This task changed on GitHub while saving; nothing was written', {
            issue: buildIssueDetail(reread.item, repository),
            statusOptions: statusOptions(),
          });
        }
        if (error instanceof GitHubError && (error.kind === 'network' || error.kind === 'server')) {
          throw new HttpError(502, 'write_outcome_unknown', 'Outcome unknown \u2014 check the issue on GitHub');
        }
        mapGitHubError(error);
      }

      let reread: IssueRead;
      try {
        reread = await github.getIssue(number);
      } catch {
        if (movedTo) throw new HttpError(409, 'partial_move', 'Target created; source close could not be verified. Do not repeat move.', { targetUrl: movedTo });
        throw new HttpError(502, 'write_outcome_unknown', 'Outcome unknown \u2014 check the issue on GitHub');
      }

      const currentItem = reread.item;
      let verified = false;

      if (op.kind === 'draft' || op.kind === 'order' || op.kind === 'move') {
        verified = Object.entries(patch).every(([key, value]) => currentItem[key] === value);
      } else if (op.kind === 'section') {
        const curSec = findSections(currentItem.body ?? '').find((s) => s.id === op.sectionId);
        const expectedSec = findSections((patch.body as string) ?? '').find((s) => s.id === op.sectionId);
        if (curSec && expectedSec) {
          const canonicalCur = curSec.text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
          const canonicalExpected = expectedSec.text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
          if (canonicalCur === canonicalExpected) {
            verified = true;
          }
        }
      } else if (op.kind === 'question') {
        const curDetail = buildIssueDetail(currentItem, repository);
        const curQ = curDetail.openQuestions[baseQuestionIndex];
        const cleanAnswer = targetAnswer.trim().replace(/\r?\n+/g, ' ');
        if (curQ && curQ.completed && curQ.text.includes(cleanAnswer)) {
          verified = true;
        }
      } else if (op.kind === 'status') {
        const curStatus = statusLabelOf(labelNames(currentItem));
        if (curStatus === targetStatus) {
          verified = true;
        }
      } else if (op.kind === 'patch') {
        let matches = true;
        if (typeof op.body === 'string') {
          const normCur = (currentItem.body ?? '').replace(/\r\n/g, '\n');
          const normTarget = (patch.body as string).replace(/\r\n/g, '\n');
          if (normCur !== normTarget) matches = false;
        }
        if (typeof op.status === 'string') {
          if (statusLabelOf(labelNames(currentItem)) !== op.status) matches = false;
        }
        if (typeof op.state === 'string') {
          if (currentItem.state !== op.state) matches = false;
        }
        if (matches) {
          verified = true;
        }
      }

      if (verified) {
        log(`write issue=${number} fields=${Object.keys(patch).join(',')}`);
        return {
          status: 200,
          body: {
            issue: buildIssueDetail(currentItem, repository),
            savedAt: new Date(now()).toISOString(),
            ...(movedTo ? { targetUrl: movedTo } : {}),
            statusOptions: statusOptions(),
          },
        };
      }

      if (movedTo) throw new HttpError(409, 'partial_move', 'Target created; source close could not be verified. Do not repeat move.', { targetUrl: movedTo });
      throw new HttpError(
        502,
        'write_outcome_unknown',
        'Outcome unknown \u2014 check the issue on GitHub',
        {
          issue: buildIssueDetail(currentItem, repository),
          statusOptions: statusOptions(),
        },
      );
    });
  }

  return {
    config,
    logs,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        const onError = (err: Error) => {
          server.removeListener('listening', onListening);
          const code = (err as any).code;
          if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
            reject(new Error(`BOARD_HOST "${host}" could not be resolved: ${err.message}`));
          } else if (code === 'EADDRNOTAVAIL') {
            reject(new Error(`BOARD_HOST "${host}" is not available to bind: ${err.message}`));
          } else {
            reject(err);
          }
        };
        const onListening = () => {
          server.removeListener('error', onError);
          const address = server.address();
          if (typeof address === 'object' && address) {
            resolve({ port: address.port, host: address.address });
          } else {
            resolve({ port, host });
          }
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
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
