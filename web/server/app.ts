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
import { GitHubClient, GitHubError, parseIssueNumber, type IssueRead, type RateLimitInfo } from './github.ts';
import { RepositoryRegistry, RepositoryNotAllowedError, DiscoveryUnavailableError, type RepositoryEntry } from './repositories.ts';
import { STATUS_METADATA } from '../../panel/labels.ts';
import { findSections, replaceSectionText, SectionError } from './sections.ts';
import {
  BoardError,
  hasUnfencedOrderMarkerComment, parseOrderMarker, stripOrderMarker, setOrderMarker, midpointOrder,
  setCanvasMarker, parseCanvasMarker,
  applyQuestionAnswer,
  applySectionEdit,
  applyStatusChange,
  buildBoardList,
  buildBoardListItem,
  buildIssueDetail,
  issueFingerprint,
  issueKey,
  labelNames,
  parseWebHumanTasks,
  statusLabelOf,
  toggleHumanTaskInMarkdown,
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
  aggregateConcurrency?: number;
  aggregateTimeoutMs?: number;
  boardCacheTtlMs?: number;
  perRepoTimeoutMs?: number;
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

function computeWeakEtag(payload: unknown): string {
  let content = payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const { rateLimit, fetchedAt, ...rest } = payload as Record<string, unknown>;
    content = rest;
  }
  const hash = createHash('sha1').update(JSON.stringify(content)).digest('hex').slice(0, 16);
  return `W/"${hash}"`;
}

function etagMatches(clientEtag: string | string[] | undefined, serverEtag: string): boolean {
  const raw = Array.isArray(clientEtag) ? clientEtag[0] : clientEtag;
  if (!raw) return false;
  const normServer = serverEtag.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  return raw.split(',').some((part) => {
    const normClient = part.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
    return normClient === normServer || normClient === '*';
  });
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

  const sharedRateLimit: { current: RateLimitInfo } = {
    current: {
      limit: null,
      remaining: null,
      reset: null,
      resource: null,
      updatedAt: null,
    },
  };

  function currentRateLimit(): RateLimitInfo {
    return { ...sharedRateLimit.current };
  }

  const github = new GitHubClient({
    apiBase: options.githubApiBase ?? config.githubApiBase,
    token: config.githubToken,
    repo: config.repo,
    fetchImpl: options.fetchImpl,
    rateLimitRef: sharedRateLimit,
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
  function clientFor(repository: RepositoryEntry, timeoutMs?: number): GitHubClient {
    return new GitHubClient({
      apiBase: options.githubApiBase ?? config.githubApiBase,
      token: config.githubToken,
      repo: repository,
      fetchImpl: options.fetchImpl,
      timeoutMs: timeoutMs ?? 15_000,
      rateLimitRef: sharedRateLimit,
    });
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
    '/markdown.js': { body: loadStatic('markdown.js'), type: 'text/javascript; charset=utf-8' },
    '/arrange.js': { body: loadStatic('arrange.js'), type: 'text/javascript; charset=utf-8' },
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
        } else if (error instanceof DiscoveryUnavailableError) {
          response = {
            status: 502,
            body: { error: 'discovery_unavailable', message: 'Repository discovery failed; no operation was dispatched' },
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
      if (response.status === 304) {
        res.end();
      } else if (response.buffer !== undefined) {
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
      const forceRefresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';
      const discovery = await repositories.view({ forceRefresh });
      const payload = { ...discovery, projectNames: projectNames(), rateLimit: currentRateLimit() };
      const etag = computeWeakEtag(payload);
      if (!forceRefresh && etagMatches(req.headers['if-none-match'], etag)) {
        return {
          status: 304,
          headers: {
            etag,
            'cache-control': 'no-cache',
          },
        };
      }
      return {
        status: 200,
        body: payload,
        headers: {
          etag,
          'cache-control': 'no-cache',
        },
      };
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
      const forceRefresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';
      const board = (await combinedBoard({ forceRefresh })) as Record<string, unknown>;
      const payload = { ...board, rateLimit: currentRateLimit() };
      const etag = computeWeakEtag(payload);
      if (!forceRefresh && etagMatches(req.headers['if-none-match'], etag)) {
        return {
          status: 304,
          headers: {
            etag,
            'cache-control': 'no-cache',
          },
        };
      }
      return {
        status: 200,
        body: payload,
        headers: {
          etag,
          'cache-control': 'no-cache',
        },
      };
    }
    if (url.pathname === '/api/combined/archive' || (url.pathname === '/api/archive' && !config.repo)) {
      if (method !== 'GET') return methodNotAllowed('GET');
      return { status: 200, body: await archiveData(null, url) };
    }
    if (url.pathname === '/api/combined/operations' || (url.pathname === '/api/operations' && !config.repo)) {
      if (method !== 'GET') return methodNotAllowed('GET');
      return { status: 200, body: await operationsData(null) };
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
    } else if (
      route === '/api/board' ||
      route === '/api/archive' ||
      route === '/api/operations' ||
      route === '/api/issues' ||
      route.startsWith('/api/issues/')
    ) {
      if (!config.repo) throw new HttpError(400, 'repository_not_allowed', 'Select a discovered repository');
      repository = await resolveRepository(config.repo.owner, config.repo.name);
    }
    const scopedGithub = repository ? clientFor(repository) : null;
    if (route === '/api/board') {
      if (method !== 'GET') return methodNotAllowed('GET');
      const forceRefresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';
      const board = (await repositoryBoard(repository!, undefined, { forceRefresh })) as Record<string, unknown>;
      const payload = { ...board, rateLimit: currentRateLimit() };
      const etag = computeWeakEtag(payload);
      if (!forceRefresh && etagMatches(req.headers['if-none-match'], etag)) {
        return {
          status: 304,
          headers: {
            etag,
            'cache-control': 'no-cache',
          },
        };
      }
      return {
        status: 200,
        body: payload,
        headers: {
          etag,
          'cache-control': 'no-cache',
        },
      };
    }
    if (route === '/api/archive') {
      if (method !== 'GET') return methodNotAllowed('GET');
      return { status: 200, body: await archiveData(repository, url) };
    }
    if (route === '/api/operations') {
      if (method !== 'GET') return methodNotAllowed('GET');
      return { status: 200, body: await operationsData(repository) };
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
      let created: any;
      let labelFallback = false;
      try {
        created = await scopedGithub!.createIssue({
          title,
          body: issueBody,
          labels,
        });
      } catch (err: any) {
        if (
          err instanceof GitHubError &&
          (err.status === 403 || err.status === 422) &&
          labels &&
          labels.length > 0
        ) {
          created = await scopedGithub!.createIssue({
            title,
            body: issueBody,
            labels: [],
          }).catch(mapGitHubError);
          labelFallback = true;
        } else {
          mapGitHubError(err);
        }
      }
      if (repository) {
        repoBoardCache.delete(repository.full);
        repoClosedCache.delete(repository.full);
      }

      return {
        status: 201,
        body: {
          ok: true,
          issue: buildBoardListItem(created.item, repository),
          ...(labelFallback ? { labelFallback: true } : {}),
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
        const [read, deps] = await Promise.all([
          scopedGithub!.getIssue(number).catch(mapGitHubError),
          scopedGithub!.getIssueDependencies(number).catch(() => ({ blockedBy: [], blocking: [] })),
        ]);
        if (read.item.pull_request) {
          throw new HttpError(404, 'not_found', 'That number is a pull request, not an issue');
        }
        read.item.blockedBy = deps.blockedBy;
        read.item.blocking = deps.blocking;
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

    const canvasMatch = /^\/api\/issues\/([^/]+)\/canvas$/.exec(route);
    if (canvasMatch) {
      if (method !== 'PUT') return methodNotAllowed('PUT');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(canvasMatch[1]);
      const body = await readJsonBody(req);
      let targetRepo = repository;
      if (body && typeof body.repo === 'string' && body.repo.includes('/')) {
        const [o, n] = body.repo.split('/');
        targetRepo = await resolveRepository(o, n);
      }
      return writeIssue(targetRepo!, number, body, {
        kind: 'canvas',
        data: body,
      });
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

    const humanTaskToggleMatch = /^\/api\/issues\/([^/]+)\/human-tasks\/([^/]+)\/toggle$/.exec(route);
    if (humanTaskToggleMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(humanTaskToggleMatch[1]);
      if (!/^\d{1,4}$/.test(humanTaskToggleMatch[2])) {
        throw new HttpError(400, 'invalid_request', 'The human task index is not valid');
      }
      const index = Number(humanTaskToggleMatch[2]);
      const body = await readJsonBody(req);
      if (body && body.completed !== undefined && typeof body.completed !== 'boolean') {
        throw new HttpError(400, 'invalid_edit', 'Completed must be a boolean');
      }
      return writeIssue(repository!, number, body, {
        kind: 'human-task',
        index,
        completed: typeof body?.completed === 'boolean' ? body.completed : undefined,
      });
    }

    const reopenMatch = /^\/api\/issues\/([^/]+)\/reopen$/.exec(route);
    if (reopenMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(reopenMatch[1]);
      const body = await readJsonBody(req);
      return writeIssue(repository!, number, body, {
        kind: 'reopen',
      });
    }

    const removeLabelPostMatch = /^\/api\/issues\/([^/]+)\/labels\/remove$/.exec(route);
    if (removeLabelPostMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(removeLabelPostMatch[1]);
      const body = await readJsonBody(req);
      const label = typeof body?.label === 'string' ? body.label.trim() : '';
      if (!label) {
        throw new HttpError(400, 'invalid_edit', 'A label name is required');
      }
      return writeIssue(repository!, number, body, {
        kind: 'remove-label',
        label,
      });
    }

    const removeLabelDeleteMatch = /^\/api\/issues\/([^/]+)\/labels\/([^/]+)$/.exec(route);
    if (removeLabelDeleteMatch) {
      if (method !== 'DELETE') return methodNotAllowed('DELETE');
      requireCsrf(req, record);
      const number = parseIssueNumberOrThrow(removeLabelDeleteMatch[1]);
      let label = '';
      try {
        label = decodeURIComponent(removeLabelDeleteMatch[2]).trim();
      } catch {
        throw new HttpError(400, 'invalid_request', 'Invalid label encoding');
      }
      if (!label) {
        throw new HttpError(400, 'invalid_edit', 'A label name is required');
      }
      const body = (await readJsonBody(req)) || {};
      if (typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpError(400, 'invalid_json', 'The request body must be JSON');
      }
      if (!body.fingerprint && url.searchParams.get('fingerprint')) {
        body.fingerprint = url.searchParams.get('fingerprint');
      }
      return writeIssue(repository!, number, body, {
        kind: 'remove-label',
        label,
      });
    }

    const depsMatch = /^\/api\/issues\/([^/]+)\/dependencies$/.exec(route);
    if (depsMatch) {
      if (method !== 'GET') return methodNotAllowed('GET');
      const number = parseIssueNumberOrThrow(depsMatch[1]);
      const [read, deps] = await Promise.all([
        scopedGithub!.getIssue(number).catch(mapGitHubError),
        scopedGithub!.getIssueDependencies(number).catch(mapGitHubError),
      ]);
      const detail = buildIssueDetail(read.item, repository);
      return {
        status: 200,
        body: {
          blockedBy: deps.blockedBy,
          blocking: deps.blocking,
          textDependencies: detail.textDependencies || [],
        },
      };
    }

    const depAddMatch = /^\/api\/issues\/([^/]+)\/dependencies\/blocked_by$/.exec(route);
    if (depAddMatch) {
      if (method !== 'POST') return methodNotAllowed('POST');
      requireCsrf(req, record);
      const targetNumber = parseIssueNumberOrThrow(depAddMatch[1]);
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpError(400, 'invalid_request', 'A JSON object payload is required');
      }

      let sourceRepo = repository!;
      if (typeof body.repo === 'string' && body.repo.includes('/')) {
        const [o, n] = body.repo.split('/');
        sourceRepo = await resolveRepository(o, n);
      }

      let sourceIssue: any = null;
      if (typeof body.issue_number === 'number' || (typeof body.issue_number === 'string' && /^\d+$/.test(body.issue_number))) {
        const sourceNum = Number(body.issue_number);
        const sourceRead = await clientFor(sourceRepo).getIssue(sourceNum).catch(mapGitHubError);
        sourceIssue = sourceRead.item;
      } else if (typeof body.issue_id === 'number') {
        const sourceList = await clientFor(sourceRepo).listIssues().catch(mapGitHubError);
        sourceIssue = sourceList.items.find((i: any) => i.id === body.issue_id);
        if (!sourceIssue) {
          sourceIssue = { id: body.issue_id, number: body.issue_number ?? 0 };
        }
      }

      if (!sourceIssue || !sourceIssue.id) {
        throw new HttpError(400, 'invalid_request', 'Could not resolve the blocker issue');
      }

      if (repository!.full.toLowerCase() === sourceRepo.full.toLowerCase() && targetNumber === sourceIssue.number) {
        throw new HttpError(400, 'self_link', 'An issue cannot be blocked by itself');
      }

      const targetDeps = await scopedGithub!.getIssueDependencies(targetNumber).catch(mapGitHubError);
      const already = targetDeps.blockedBy.some((b: any) => {
        const bRepo = (b.repository?.nameWithOwner ?? repository!.full).toLowerCase();
        return (b.id === sourceIssue.id || b.number === sourceIssue.number) && bRepo === sourceRepo.full.toLowerCase();
      });
      if (already) {
        throw new HttpError(400, 'duplicate_dependency', 'That dependency link already exists');
      }

      const createsCycle = await checkDependencyCycle(sourceIssue.number, sourceRepo, targetNumber, repository!);
      if (createsCycle) {
        throw new HttpError(400, 'cycle_refused', 'Cannot add dependency: this would create a circular dependency');
      }

      await scopedGithub!.addIssueDependency(targetNumber, sourceIssue.id).catch((err) => {
        if (err instanceof GitHubError && (err.status === 422 || err.status === 400)) {
          const msg = typeof err.data?.message === 'string' ? err.data.message : 'Invalid dependency request';
          throw new HttpError(422, 'invalid_dependency', msg);
        }
        mapGitHubError(err);
      });

      repoBoardCache.delete(repository!.full);
      repoClosedCache.delete(repository!.full);
      if (sourceRepo.full !== repository!.full) {
        repoBoardCache.delete(sourceRepo.full);
        repoClosedCache.delete(sourceRepo.full);
      }

      const [freshTarget, updatedDeps] = await Promise.all([
        scopedGithub!.getIssue(targetNumber).catch(mapGitHubError),
        scopedGithub!.getIssueDependencies(targetNumber).catch(mapGitHubError),
      ]);
      const detail = buildIssueDetail(freshTarget.item, repository);
      detail.blockedBy = updatedDeps.blockedBy;
      detail.blocking = updatedDeps.blocking;
      const listItem = buildBoardListItem(freshTarget.item, repository);
      listItem.blockedBy = updatedDeps.blockedBy;
      listItem.blocking = updatedDeps.blocking;

      return {
        status: 201,
        body: {
          success: true,
          issue: detail,
          listItem,
          blockedBy: updatedDeps.blockedBy,
          blocking: updatedDeps.blocking,
          statusOptions: statusOptions(),
          blockedNumber: targetNumber,
          blockerNumber: sourceIssue.number,
          blockerId: sourceIssue.id,
          blockerRepo: sourceRepo.full,
        },
      };
    }

    const depDeleteMatch = /^\/api\/issues\/([^/]+)\/dependencies\/blocked_by\/([^/]+)$/.exec(route);
    if (depDeleteMatch) {
      if (method !== 'DELETE') return methodNotAllowed('DELETE');
      requireCsrf(req, record);
      const targetNumber = parseIssueNumberOrThrow(depDeleteMatch[1]);
      const targetParam = depDeleteMatch[2];
      if (!/^\d+$/.test(targetParam)) {
        throw new HttpError(400, 'invalid_request', 'Invalid dependency ID');
      }
      const rawTargetId = Number(targetParam);

      const targetDeps = await scopedGithub!.getIssueDependencies(targetNumber).catch(mapGitHubError);
      const matchDep = targetDeps.blockedBy.find((b: any) => b.id === rawTargetId || b.number === rawTargetId);
      const issueIdToDelete = matchDep?.id ?? rawTargetId;

      await scopedGithub!.removeIssueDependency(targetNumber, issueIdToDelete).catch((err) => {
        if (err instanceof GitHubError && err.status === 404) {
          throw new HttpError(404, 'not_found', 'Dependency link not found');
        }
        mapGitHubError(err);
      });

      repoBoardCache.delete(repository!.full);
      repoClosedCache.delete(repository!.full);

      const [freshTarget, updatedDeps] = await Promise.all([
        scopedGithub!.getIssue(targetNumber).catch(mapGitHubError),
        scopedGithub!.getIssueDependencies(targetNumber).catch(mapGitHubError),
      ]);
      const detail = buildIssueDetail(freshTarget.item, repository);
      detail.blockedBy = updatedDeps.blockedBy;
      detail.blocking = updatedDeps.blocking;
      const listItem = buildBoardListItem(freshTarget.item, repository);
      listItem.blockedBy = updatedDeps.blockedBy;
      listItem.blocking = updatedDeps.blocking;

      return {
        status: 200,
        body: {
          success: true,
          issue: detail,
          listItem,
          blockedBy: updatedDeps.blockedBy,
          blocking: updatedDeps.blocking,
          statusOptions: statusOptions(),
          number: targetNumber,
          removedId: issueIdToDelete,
        },
      };
    }

    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        return methodNotAllowed('GET, POST, PUT, DELETE, PATCH');
      }
      return { status: 404, body: { error: 'not_found', message: 'Not found' } };
    }
    return { status: 404, body: { error: 'not_found', message: 'Not found' } };
  }

  interface CachedRepoBoard {
    issues: ReturnType<typeof buildBoardList>['issues'];
    excluded: number;
    truncated: boolean;
    cachedAt: number;
    dependenciesDegraded?: boolean;
    etag?: string | null;
  }
  const repoBoardCache = new Map<string, CachedRepoBoard>();
  interface CachedRepoClosed {
    issues: ReturnType<typeof buildBoardList>['issues'];
    truncated: boolean;
    cachedAt: number;
    etag?: string | null;
  }
  const repoClosedCache = new Map<string, CachedRepoClosed>();
  const defaultBoardCacheTtlMs = options.boardCacheTtlMs ?? (options.repositoryTtlMs === 0 ? 0 : 30_000);

  const inFlightBoards = new Map<string, Promise<any>>();
  const inFlightClosed = new Map<string, Promise<CachedRepoClosed>>();

  async function checkDependencyCycle(
    startNumber: number,
    startRepo: RepositoryEntry,
    targetNumber: number,
    targetRepo: RepositoryEntry,
  ): Promise<boolean> {
    const queue: Array<{ number: number; repo: RepositoryEntry }> = [{ number: startNumber, repo: startRepo }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.repo.full.toLowerCase()}#${current.number}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (current.number === targetNumber && current.repo.full.toLowerCase() === targetRepo.full.toLowerCase()) {
        return true;
      }

      try {
        const client = clientFor(current.repo);
        const deps = await client.getIssueDependencies(current.number);
        for (const blocker of deps.blockedBy) {
          const blockerRepoName = blocker.repository?.nameWithOwner ?? current.repo.full;
          let blockerRepo = current.repo;
          if (blockerRepoName.toLowerCase() !== current.repo.full.toLowerCase()) {
            const [o, n] = blockerRepoName.split('/');
            blockerRepo = await resolveRepository(o, n);
          }
          const nextKey = `${blockerRepo.full.toLowerCase()}#${blocker.number}`;
          if (!visited.has(nextKey)) {
            queue.push({ number: blocker.number, repo: blockerRepo });
          }
        }
      } catch {
        // Fallback or ignore if unable to query a node
      }
    }
    return false;
  }

  async function repositoryBoard(
    repository: RepositoryEntry,
    timeoutMs?: number,
    boardOpts: { forceRefresh?: boolean } = {},
  ) {
    if (!repository.hasIssues) {
      return {
        scope: 'repo',
        repository,
        repo: repository.full,
        login: config.githubLogin,
        fetchedAt: new Date(now()).toISOString(),
        truncated: false,
        complete: true,
        partial: false,
        excludedPullRequests: 0,
        issues: [],
        dependenciesDegraded: false,
      };
    }

    const key = repository.full;
    if (!boardOpts.forceRefresh) {
      const existingInFlight = inFlightBoards.get(key);
      if (existingInFlight) {
        return existingInFlight;
      }
      const cached = repoBoardCache.get(key);
      if (cached && defaultBoardCacheTtlMs > 0 && now() - cached.cachedAt < defaultBoardCacheTtlMs) {
        return {
          scope: 'repo',
          repository,
          repo: repository.full,
          login: config.githubLogin,
          fetchedAt: new Date(cached.cachedAt).toISOString(),
          truncated: cached.truncated,
          complete: !cached.truncated,
          partial: cached.truncated,
          excludedPullRequests: cached.excluded,
          issues: cached.issues,
          dependenciesDegraded: Boolean(cached.dependenciesDegraded),
        };
      }
    }

    const run = async () => {
      const cached = repoBoardCache.get(key);
      const client = clientFor(repository, timeoutMs);
      const ifNoneMatch = boardOpts.forceRefresh ? undefined : cached?.etag;

      const listed = await client.listIssues({ ifNoneMatch }).catch(mapGitHubError);
      if (listed.notModified && cached) {
        cached.cachedAt = now();
        return {
          scope: 'repo',
          repository,
          repo: repository.full,
          login: config.githubLogin,
          fetchedAt: new Date(cached.cachedAt).toISOString(),
          truncated: cached.truncated,
          complete: !cached.truncated,
          partial: cached.truncated,
          excludedPullRequests: cached.excluded,
          issues: cached.issues,
          dependenciesDegraded: Boolean(cached.dependenciesDegraded),
        };
      }

      let dependenciesDegraded = false;
      let repoDeps = new Map<number, any[]>();
      const hasOpenIssues = (repository.openIssuesCount !== 0) && listed.items.some((i: any) => i.state === 'open');
      if (hasOpenIssues) {
        try {
          repoDeps = await client.listRepositoryDependencies();
        } catch {
          dependenciesDegraded = true;
        }
      }

      if (repoDeps.size > 0) {
        for (const item of listed.items) {
          if (repoDeps.has(item.number)) {
            item.blockedBy = repoDeps.get(item.number);
          }
        }
      }

      const { issues, excluded } = buildBoardList(listed.items, repository);
      repoBoardCache.set(key, {
        issues,
        excluded,
        truncated: listed.truncated,
        cachedAt: now(),
        dependenciesDegraded,
        etag: listed.etag,
      });

      return {
        scope: 'repo',
        repository,
        repo: repository.full,
        login: config.githubLogin,
        fetchedAt: new Date(now()).toISOString(),
        truncated: listed.truncated,
        complete: !listed.truncated,
        partial: listed.truncated,
        excludedPullRequests: excluded,
        issues,
        dependenciesDegraded,
      };
    };

    const promise = run();
    inFlightBoards.set(key, promise);
    try {
      return await promise;
    } finally {
      if (inFlightBoards.get(key) === promise) {
        inFlightBoards.delete(key);
      }
    }
  }

  async function repositoryClosedIssues(
    repository: RepositoryEntry,
    timeoutMs?: number,
    closedOpts: { forceRefresh?: boolean } = {},
  ): Promise<CachedRepoClosed> {
    const key = repository.full;
    if (!closedOpts.forceRefresh) {
      const existingInFlight = inFlightClosed.get(key);
      if (existingInFlight) {
        return existingInFlight;
      }
      const cached = repoClosedCache.get(key);
      if (cached && defaultBoardCacheTtlMs > 0 && now() - cached.cachedAt < defaultBoardCacheTtlMs) {
        return cached;
      }
    }

    const run = async (): Promise<CachedRepoClosed> => {
      const cached = repoClosedCache.get(key);
      const client = clientFor(repository, timeoutMs);
      const ifNoneMatch = closedOpts.forceRefresh ? undefined : cached?.etag;

      const listed = await client.listIssues({ state: 'closed', ifNoneMatch }).catch(mapGitHubError);
      if (listed.notModified && cached) {
        cached.cachedAt = now();
        return cached;
      }

      const { issues } = buildBoardList(listed.items, repository);
      const result: CachedRepoClosed = {
        issues,
        truncated: listed.truncated,
        cachedAt: now(),
        etag: listed.etag,
      };
      repoClosedCache.set(key, result);
      return result;
    };

    const promise = run();
    inFlightClosed.set(key, promise);
    try {
      return await promise;
    } finally {
      if (inFlightClosed.get(key) === promise) {
        inFlightClosed.delete(key);
      }
    }
  }

  let aggregateInFlight: Promise<unknown> | null = null;
  function combinedBoard(combinedOpts: { forceRefresh?: boolean } = {}): Promise<unknown> {
    if (combinedOpts.forceRefresh) {
      return aggregate({ forceRefresh: true });
    }
    if (aggregateInFlight) return aggregateInFlight;
    aggregateInFlight = aggregate().finally(() => { aggregateInFlight = null; });
    return aggregateInFlight;
  }
  async function aggregate(aggregateOpts: { forceRefresh?: boolean } = {}) {
    const discovery = await repositories.view({ forceRefresh: aggregateOpts.forceRefresh });
    const issues: ReturnType<typeof buildBoardList>['issues'] = [];
    const failures: Array<{ repository: RepositoryEntry; message: string }> = [];
    const repoFetchedTimestamps: number[] = [];
    let cursor = 0;
    let loaded = 0;
    let truncated = false;
    let excluded = 0;
    let dependenciesDegraded = false;
    const aggregateStart = now();
    const aggregateTimeoutMs = options.aggregateTimeoutMs ?? 12_000;
    const perRepoTimeoutMs = options.perRepoTimeoutMs ?? 5_000;
    let rateLimitedUntil = 0;

    async function worker() {
      while (cursor < discovery.repositories.length) {
        const repository = discovery.repositories[cursor++];
        if (!repository.available || discovery.discoveryFailed) {
          failures.push({ repository, message: discovery.discoveryFailed ? 'Discovery failed; not refreshed' : 'Unavailable' });
          continue;
        }

        // Bounded total time check
        if (now() - aggregateStart >= aggregateTimeoutMs) {
          const cached = repoBoardCache.get(repository.full);
          if (cached) {
            issues.push(...cached.issues);
            excluded += cached.excluded;
            repoFetchedTimestamps.push(cached.cachedAt);
            failures.push({ repository, message: 'Aggregation time bound reached; showing cached tasks' });
            loaded++;
          } else {
            failures.push({ repository, message: 'Aggregation time bound reached; skipped' });
          }
          continue;
        }

        // Rate limit backoff check
        if (now() < rateLimitedUntil) {
          const cached = repoBoardCache.get(repository.full);
          if (cached) {
            issues.push(...cached.issues);
            excluded += cached.excluded;
            repoFetchedTimestamps.push(cached.cachedAt);
            failures.push({ repository, message: 'Rate limited by GitHub; showing cached tasks' });
            loaded++;
          } else {
            failures.push({ repository, message: 'Rate limited by GitHub; refresh backed off' });
          }
          continue;
        }

        try {
          const board = await repositoryBoard(repository, perRepoTimeoutMs, { forceRefresh: aggregateOpts.forceRefresh });
          issues.push(...board.issues);
          excluded += board.excludedPullRequests;
          truncated ||= board.truncated;
          dependenciesDegraded ||= Boolean((board as any).dependenciesDegraded);
          if (board.fetchedAt) {
            const parsed = Date.parse(board.fetchedAt);
            if (!Number.isNaN(parsed)) repoFetchedTimestamps.push(parsed);
          }
          if (board.truncated) failures.push({ repository, message: 'Issue page bound reached; incomplete' });
          loaded++;
        } catch (error: any) {
          const isRateLimited = error instanceof HttpError && error.status === 503 && error.code === 'github_rate_limited';
          if (isRateLimited) {
            rateLimitedUntil = now() + 60_000;
          }
          const cached = repoBoardCache.get(repository.full);
          if (cached) {
            issues.push(...cached.issues);
            excluded += cached.excluded;
            repoFetchedTimestamps.push(cached.cachedAt);
            failures.push({ repository, message: isRateLimited ? 'Rate limited by GitHub; showing cached tasks' : 'Unavailable or refresh failed; showing cached tasks' });
            loaded++;
          } else {
            failures.push({ repository, message: isRateLimited ? 'Rate limited by GitHub' : 'Unavailable or refresh failed' });
          }
        }
      }
    }
    const concurrency = options.aggregateConcurrency ?? (discovery.repositories.length <= 5 ? 3 : 6);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const truncatedByIssueCap = issues.length > MAX_AGGREGATE_ISSUES;
    if (truncatedByIssueCap) issues.length = MAX_AGGREGATE_ISSUES;
    const limited = truncated || truncatedByIssueCap;
    const partial = discovery.discoveryFailed || failures.length > 0 || limited;
    const oldestTimestamp = repoFetchedTimestamps.length > 0 ? Math.min(...repoFetchedTimestamps) : aggregateStart;
    const fetchedAt = new Date(oldestTimestamp).toISOString();
    return { scope: 'all', repo: 'All repositories', ...discovery, issues, failures,
      fetchedAt, partial, complete: !partial, truncated: limited,
      truncatedByIssueCap, issueCap: MAX_AGGREGATE_ISSUES,
      repositoriesRequested: discovery.repositories.length, repositoriesLoaded: loaded,
      concurrency, maxPagesPerRepository: 10, excludedPullRequests: excluded, dependenciesDegraded };
  }

  async function archiveData(repository: RepositoryEntry | null, requestUrl: URL) {
    let allIssues: ReturnType<typeof buildBoardList>['issues'] = [];
    let board: any = null;
    let closedIssues: ReturnType<typeof buildBoardList>['issues'] = [];
    let closedTruncated = false;
    let closedPartial = false;
    const closedFailures: Array<{ repository: RepositoryEntry; message: string }> = [];

    if (repository) {
      board = await repositoryBoard(repository);
      allIssues = board.issues;
      try {
        const closedRes = await repositoryClosedIssues(repository);
        closedIssues = closedRes.issues;
        closedTruncated = closedRes.truncated;
      } catch (err: any) {
        closedPartial = true;
        closedFailures.push({ repository, message: err?.message || 'Could not fetch closed issues' });
      }
    } else {
      const discovery = await repositories.view();
      if (discovery.discoveryFailed) {
        throw new DiscoveryUnavailableError();
      }
      board = (await combinedBoard()) as any;
      if (discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) === 0) {
        throw new DiscoveryUnavailableError();
      }
      allIssues = board.issues || [];
      for (const repo of discovery.repositories) {
        if (!repo.available) continue;
        try {
          const closedRes = await repositoryClosedIssues(repo);
          closedIssues.push(...closedRes.issues);
          closedTruncated ||= closedRes.truncated;
        } catch (err: any) {
          closedPartial = true;
          closedFailures.push({ repository: repo, message: err?.message || 'Could not fetch closed issues' });
        }
      }
    }

    let limit = Number(requestUrl.searchParams.get('limit') ?? 100);
    if (!Number.isFinite(limit) || limit < 1) limit = 100;
    limit = Math.min(200, Math.floor(limit));

    let offset = Number(requestUrl.searchParams.get('offset') ?? 0);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    offset = Math.floor(offset);

    const backburner = allIssues.filter(
      (issue) => issue.state === 'open' && (issue.labels || []).some((l) => l.toLowerCase() === 'backburner')
    );

    const closedMap = new Map<string, (typeof allIssues)[0]>();
    for (const issue of closedIssues) {
      const key = issue.key || `${issue.repository?.full || ''}#${issue.number}`;
      closedMap.set(key, issue);
    }
    for (const issue of allIssues) {
      if (issue.state === 'closed') {
        const key = issue.key || `${issue.repository?.full || ''}#${issue.number}`;
        if (!closedMap.has(key)) {
          closedMap.set(key, issue);
        }
      }
    }
    const closed = Array.from(closedMap.values());

    // Stable newest-closed sorting: closedAt desc, then updatedAt desc, then number desc
    closed.sort((a, b) => {
      const timeA = a.closedAt ? Date.parse(a.closedAt) : (a.updatedAt ? Date.parse(a.updatedAt) : 0);
      const timeB = b.closedAt ? Date.parse(b.closedAt) : (b.updatedAt ? Date.parse(b.updatedAt) : 0);
      if (timeB !== timeA) return timeB - timeA;
      return b.number - a.number;
    });

    const pagedClosed = closed.slice(offset, offset + limit);
    const failures = [...(board?.failures || []), ...closedFailures];
    const isTruncated = Boolean(board?.truncated || board?.truncatedByIssueCap || closedTruncated);
    const isPartial = Boolean(board?.partial || closedPartial || failures.length > 0);

    return {
      scope: repository ? 'repo' : 'all',
      repository: repository ? repository.full : null,
      backburner,
      closed: pagedClosed,
      totalBackburner: backburner.length,
      totalClosed: closed.length,
      limit,
      offset,
      hasMore: offset + limit < closed.length,
      fetchedAt: board?.fetchedAt || new Date(now()).toISOString(),
      truncated: isTruncated,
      partial: isPartial,
      failures,
    };
  }

  async function operationsData(repository: RepositoryEntry | null) {
    let allIssues: ReturnType<typeof buildBoardList>['issues'] = [];
    let repos: Array<{ full: string; name: string }> = [];
    let board: any = null;

    if (repository) {
      board = await repositoryBoard(repository);
      allIssues = board.issues;
      repos = [{ full: repository.full, name: repository.name }];
    } else {
      const discovery = await repositories.view();
      if (discovery.discoveryFailed) {
        throw new DiscoveryUnavailableError();
      }
      board = (await combinedBoard()) as any;
      if (discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) === 0) {
        throw new DiscoveryUnavailableError();
      }
      allIssues = board.issues || [];
      repos = discovery.repositories.map((r) => ({ full: r.full, name: r.name }));
    }

    const currentTime = now();
    const sevenDaysAgo = currentTime - 7 * 24 * 60 * 60 * 1000;

    let openCount = 0;
    let closedCount = 0;
    let needsHumanCount = 0;
    let blockedCount = 0;
    let closed7DaysCount = 0;

    type OldestInProgress = {
      number: number;
      title: string;
      repository: string;
      createdAt: string;
      ageDays: number;
    } | null;

    let oldestInProgress: OldestInProgress = null;
    let oldestInProgressTimestamp = Infinity;

    // All 8 standard status columns
    const standardColumns = ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'];
    const statusPerProject: Record<string, Record<string, number>> = {};

    for (const repo of repos) {
      statusPerProject[repo.full] = {};
      for (const col of standardColumns) {
        statusPerProject[repo.full][col] = 0;
      }
    }

    for (const issue of allIssues) {
      const repoFull = issue.repository?.full || (repository ? repository.full : 'unknown');
      if (!statusPerProject[repoFull]) {
        statusPerProject[repoFull] = {};
        for (const col of standardColumns) {
          statusPerProject[repoFull][col] = 0;
        }
      }

      const isOpen = issue.state === 'open';
      if (isOpen) {
        openCount++;
      } else {
        closedCount++;
      }

      let stage = (issue.statusLabel?.replace(/^status:/i, '') || issue.column || 'draft').toLowerCase();
      if (stage === 'review') stage = 'in-review';
      if (!standardColumns.includes(stage)) {
        stage = isOpen ? 'draft' : 'done';
      }
      statusPerProject[repoFull][stage] = (statusPerProject[repoFull][stage] || 0) + 1;

      const labels = (issue.labels || []).map((l) => l.toLowerCase());
      const isNeedsHuman =
        isOpen &&
        (labels.includes('status:needs-human') ||
          labels.includes('needs-human') ||
          (issue.counts?.humanTasks?.open ?? 0) > 0);

      if (isNeedsHuman) {
        needsHumanCount++;
      }

      const hasOpenBlockers =
        isOpen &&
        Array.isArray(issue.blockedBy) &&
        issue.blockedBy.some((dep: any) => dep.state === 'open' || dep.state === undefined);

      const isBlocked = isOpen && (hasOpenBlockers || isNeedsHuman || issue.attention === 'blocked');

      if (isBlocked) {
        blockedCount++;
      }

      // closed7Days: based STRICTLY on closedAt, never updatedAt!
      if (!isOpen && issue.closedAt) {
        const closedTime = Date.parse(issue.closedAt);
        if (!Number.isNaN(closedTime) && closedTime >= sevenDaysAgo) {
          closed7DaysCount++;
        }
      }

      if (isOpen && (stage === 'in-progress' || labels.includes('status:in-progress'))) {
        const createdStr = issue.createdAt;
        if (createdStr) {
          const createdTime = Date.parse(createdStr);
          if (!Number.isNaN(createdTime) && createdTime < oldestInProgressTimestamp) {
            oldestInProgressTimestamp = createdTime;
            const ageDays = Math.max(0, Math.floor((currentTime - createdTime) / (24 * 60 * 60 * 1000)));
            oldestInProgress = {
              number: issue.number,
              title: issue.friendlyTitle || issue.title,
              repository: repoFull,
              createdAt: createdStr,
              ageDays,
            };
          }
        }
      }
    }

    return {
      scope: repository ? 'repo' : 'all',
      repository: repository ? repository.full : null,
      openClosed: {
        open: openCount,
        closed: closedCount,
        total: openCount + closedCount,
      },
      needsHuman: needsHumanCount,
      blocked: blockedCount,
      closed7Days: closed7DaysCount,
      oldestOpenInProgress: oldestInProgress,
      statusPerProject,
      fetchedAt: board?.fetchedAt || new Date(currentTime).toISOString(),
      truncated: Boolean(board?.truncated || board?.truncatedByIssueCap),
      partial: Boolean(board?.partial),
      failures: board?.failures || [],
    };
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
    | { kind: 'canvas'; data: any }
    | { kind: 'section'; sectionId: unknown; text: unknown }
    | { kind: 'question'; index: number; answer: unknown }
    | { kind: 'human-task'; index: number; completed?: boolean }
    | { kind: 'reopen' }
    | { kind: 'remove-label'; label: string }
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
    if (supplied) {
      if (!/^[a-f0-9]{64}$/.test(supplied)) {
        throw new HttpError(
          400,
          'invalid_request',
          'The provided fingerprint is not valid',
        );
      }
    } else {
      throw new HttpError(
        400,
        'fingerprint_required',
        'Reload the task and retry; the board needs the fingerprint from a current read',
      );
    }

    const runLocked = async (): Promise<HandlerResponse> => {
      // A queued write must re-resolve freshness before any issue request.
      repository = await resolveRepository(repository.owner, repository.name);
      const github = clientFor(repository);
      const fresh = await github.getIssue(number).catch(mapGitHubError);
      if (fresh.item.pull_request) {
        throw new HttpError(404, 'not_found', 'That number is a pull request, not an issue');
      }

      const currentFingerprint = issueFingerprint(fresh.item, repository);
      if (supplied && currentFingerprint !== supplied) {
        throw new HttpError(409, 'conflict', 'This task changed on GitHub after you opened it; nothing was written', {
          issue: buildIssueDetail(fresh.item, repository),
          statusOptions: statusOptions(),
        });
      }

      let baseSectionId = '';
      let baseText = '';
      let targetText = '';
      let baseQuestionIndex = -1;
      let baseQuestionText = '';
      let targetAnswer = '';
      let baseStatus: string | null = null;
      let targetStatus = '';
      let baseHumanTaskIndex = -1;
      let targetHumanTaskCompleted: boolean | undefined = undefined;
      let baseRemoveLabel = '';

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
      } else if (op.kind === 'human-task') {
        const tasks = parseWebHumanTasks(fresh.item.body ?? '');
        if (op.index < 0 || op.index >= tasks.length) {
          throw new HttpError(400, 'invalid_edit', 'That human task is no longer available');
        }
        const currentTask = tasks[op.index];
        if (op.completed !== undefined && op.completed === currentTask.completed) {
          throw new HttpError(400, 'invalid_edit', 'That change would leave the issue unchanged');
        }
        baseHumanTaskIndex = op.index;
        targetHumanTaskCompleted = op.completed !== undefined ? op.completed : !currentTask.completed;
      } else if (op.kind === 'reopen') {
        if (fresh.item.state === 'open') {
          throw new HttpError(400, 'invalid_edit', 'That change would leave the issue unchanged');
        }
      } else if (op.kind === 'remove-label') {
        const targetLabelNorm = op.label.trim().toLowerCase();
        const existingLabels = labelNames(fresh.item);
        const hasLabel = existingLabels.some((l) => l.trim().toLowerCase() === targetLabelNorm);
        if (!hasLabel) {
          throw new HttpError(400, 'invalid_edit', `Label "${op.label}" is not present on this issue`);
        }
        baseRemoveLabel = targetLabelNorm;
      } else if (op.kind === 'canvas') {
        if (!op.data || typeof op.data !== 'object' || Array.isArray(op.data)) {
          throw new HttpError(400, 'invalid_canvas', 'Canvas data must be a JSON object');
        }
        if (op.data.x !== undefined && (typeof op.data.x !== 'number' || !Number.isFinite(op.data.x))) {
          throw new HttpError(400, 'invalid_canvas', 'Canvas x coordinate must be a finite number');
        }
        if (op.data.y !== undefined && (typeof op.data.y !== 'number' || !Number.isFinite(op.data.y))) {
          throw new HttpError(400, 'invalid_canvas', 'Canvas y coordinate must be a finite number');
        }
        if (op.data.clearPosition !== undefined && op.data.clearPosition !== true) {
          throw new HttpError(400, 'invalid_canvas', 'clearPosition must be true when present');
        }
        if (op.data.x === undefined && op.data.y === undefined && op.data.notes === undefined && op.data.clearPosition !== true) {
          throw new HttpError(400, 'invalid_canvas', 'Canvas data must include coordinates, notes or clearPosition');
        }
        if (op.data.notes !== undefined) {
          if (!Array.isArray(op.data.notes)) {
            throw new HttpError(400, 'invalid_canvas', 'Canvas notes must be an array');
          }
          for (const note of op.data.notes) {
            if (!note || typeof note !== 'object' || Array.isArray(note)) {
              throw new HttpError(400, 'invalid_canvas', 'Canvas note must be an object');
            }
            if (typeof note.text === 'string' && note.text.length > 4000) {
              throw new HttpError(400, 'note_too_long', 'Note cannot exceed 4,000 characters');
            }
          }
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
            if (Array.isArray(op.data?.updates)) {
              const rawUpdates = op.data.updates;
              const rawNeighbours = Array.isArray(op.data.neighbours) ? op.data.neighbours : [];
              if (rawUpdates.length < 1 || rawUpdates.length > 200 || rawNeighbours.length > 200) {
                throw new HttpError(400, 'invalid_order', 'Order update list is invalid');
              }
              interface PreparedOrderItem {
                key: string;
                repo: RepositoryEntry;
                number: number;
                fingerprint: string;
                order: number | null;
                isUpdate: boolean;
                isPrimary: boolean;
                read: IssueRead;
              }
              const preparedMap = new Map<string, PreparedOrderItem>();
              const updateSequence: PreparedOrderItem[] = [];
              let prevOrderVal: number | null = null;
              let includesPrimary = false;

              for (const entry of rawUpdates) {
                if (!entry || typeof entry !== 'object') {
                  throw new HttpError(400, 'invalid_order', 'Order update entry is invalid');
                }
                const repoStr = typeof entry.repo === 'string' && entry.repo ? entry.repo : repository.full;
                if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repoStr)) {
                  throw new HttpError(400, 'invalid_order', 'Order update repository is invalid');
                }
                const itemNum = parseIssueNumberOrThrow(String(entry.number ?? ''));
                const itemFp = typeof entry.fingerprint === 'string' ? entry.fingerprint : '';
                if (!/^[a-f0-9]{64}$/.test(itemFp)) {
                  throw new HttpError(400, 'fingerprint_required', 'Each reordered draft requires a valid fingerprint');
                }
                if (typeof entry.order !== 'number' || !Number.isFinite(entry.order)) {
                  throw new HttpError(400, 'invalid_order', 'Each reordered draft requires a finite numeric order');
                }
                if (prevOrderVal !== null && !(entry.order > prevOrderVal)) {
                  throw new HttpError(409, 'invalid_order', 'Order updates must be strictly increasing');
                }
                prevOrderVal = entry.order;
                const [uOwner, uName] = repoStr.split('/');
                const uRepo = uOwner.toLowerCase() === repository.owner.toLowerCase() && uName.toLowerCase() === repository.name.toLowerCase()
                  ? repository
                  : await resolveRepository(uOwner, uName);
                const k = issueKey(uRepo, itemNum);
                if (preparedMap.has(k)) {
                  throw new HttpError(400, 'invalid_order', 'Duplicate draft in order updates');
                }
                const isPrimary = uRepo.full.toLowerCase() === repository.full.toLowerCase() && itemNum === number;
                if (isPrimary) {
                  if (itemFp !== supplied) {
                    throw new HttpError(409, 'conflict', 'This task changed on GitHub after you opened it; nothing was written');
                  }
                  includesPrimary = true;
                }
                const itemRead = isPrimary ? fresh : await clientFor(uRepo).getIssue(itemNum).catch(mapGitHubError);
                if (itemRead.item.pull_request || itemRead.item.state !== 'open' || statusLabelOf(labelNames(itemRead.item)) !== 'status:draft') {
                  throw new HttpError(400, 'not_draft', 'Only open drafts can be reordered');
                }
                if (issueFingerprint(itemRead.item, uRepo) !== itemFp) {
                  throw new HttpError(409, 'conflict', 'A draft in this order changed on GitHub; refresh and try again', {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions(),
                  });
                }
                const prepared: PreparedOrderItem = {
                  key: k,
                  repo: uRepo,
                  number: itemNum,
                  fingerprint: itemFp,
                  order: entry.order,
                  isUpdate: true,
                  isPrimary,
                  read: itemRead,
                };
                preparedMap.set(k, prepared);
                updateSequence.push(prepared);
              }

              if (!includesPrimary) {
                throw new HttpError(400, 'invalid_order', 'Order updates must include the target draft');
              }

              for (const entry of rawNeighbours) {
                if (!entry || typeof entry !== 'object') {
                  throw new HttpError(400, 'invalid_order', 'Order neighbour entry is invalid');
                }
                const repoStr = typeof entry.repo === 'string' && entry.repo ? entry.repo : repository.full;
                if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repoStr)) {
                  throw new HttpError(400, 'invalid_order', 'Order neighbour repository is invalid');
                }
                const itemNum = parseIssueNumberOrThrow(String(entry.number ?? ''));
                const itemFp = typeof entry.fingerprint === 'string' ? entry.fingerprint : '';
                if (!/^[a-f0-9]{64}$/.test(itemFp)) {
                  throw new HttpError(400, 'fingerprint_required', 'Each neighbour draft requires a valid fingerprint');
                }
                const [nOwner, nName] = repoStr.split('/');
                const nRepo = nOwner.toLowerCase() === repository.owner.toLowerCase() && nName.toLowerCase() === repository.name.toLowerCase()
                  ? repository
                  : await resolveRepository(nOwner, nName);
                const k = issueKey(nRepo, itemNum);
                if (preparedMap.has(k)) continue;
                const nRead = await clientFor(nRepo).getIssue(itemNum).catch(mapGitHubError);
                if (nRead.item.pull_request || nRead.item.state !== 'open' || statusLabelOf(labelNames(nRead.item)) !== 'status:draft') {
                  throw new HttpError(409, 'conflict', 'A neighbouring draft is no longer an open draft; refresh and try again');
                }
                if (issueFingerprint(nRead.item, nRepo) !== itemFp) {
                  throw new HttpError(409, 'conflict', 'A neighbouring draft changed on GitHub; nothing was written', {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions(),
                  });
                }
                preparedMap.set(k, {
                  key: k,
                  repo: nRepo,
                  number: itemNum,
                  fingerprint: itemFp,
                  order: parseOrderMarker(nRead.item.body ?? ''),
                  isUpdate: false,
                  isPrimary: false,
                  read: nRead,
                });
              }

              const updatedDetails: Array<ReturnType<typeof buildIssueDetail>> = [];
              let primaryDetail: ReturnType<typeof buildIssueDetail> | null = null;
              let writesCompleted = 0;

              for (const item of updateSequence) {
                const nextBody = setOrderMarker(item.read.item.body ?? '', item.order as number);
                if (nextBody === (item.read.item.body ?? '')) {
                  const detail = buildIssueDetail(item.read.item, item.repo);
                  updatedDetails.push(detail);
                  if (item.isPrimary) primaryDetail = detail;
                  continue;
                }
                const itemClient = clientFor(item.repo);
                try {
                  await itemClient.updateIssue(item.number, { body: nextBody }, { etag: item.read.etag });
                } catch (error) {
                  if (error instanceof GitHubError && error.status === 412) {
                    if (writesCompleted > 0) {
                      throw new HttpError(
                        409,
                        'partial_order',
                        'Order was only partially updated because another draft changed concurrently; refresh to reconcile the current order.',
                        { updatedIssues: updatedDetails, statusOptions: statusOptions() },
                      );
                    }
                    const reread = await github.getIssue(number).catch(mapGitHubError);
                    throw new HttpError(409, 'conflict', 'This task changed on GitHub while saving; nothing was written', {
                      issue: buildIssueDetail(reread.item, repository),
                      statusOptions: statusOptions(),
                    });
                  }
                  if (writesCompleted > 0) {
                    throw new HttpError(
                      502,
                      'write_outcome_unknown',
                      'Order was partially written before a GitHub error; refresh the board to reconcile before retrying.',
                      { updatedIssues: updatedDetails, statusOptions: statusOptions() },
                    );
                  }
                  if (error instanceof GitHubError && (error.kind === 'network' || error.kind === 'server')) {
                    throw new HttpError(502, 'write_outcome_unknown', 'Outcome unknown \u2014 check the issue on GitHub');
                  }
                  mapGitHubError(error);
                }

                let rereadItem: IssueRead;
                try {
                  rereadItem = await itemClient.getIssue(item.number);
                } catch {
                  throw new HttpError(
                    502,
                    'write_outcome_unknown',
                    'Outcome unknown \u2014 check the issue on GitHub',
                    { updatedIssues: updatedDetails, statusOptions: statusOptions() },
                  );
                }
                if ((rereadItem.item.body ?? '') !== nextBody) {
                  throw new HttpError(
                    502,
                    'write_outcome_unknown',
                    'Outcome unknown \u2014 check the issue on GitHub',
                    { updatedIssues: updatedDetails, statusOptions: statusOptions() },
                  );
                }
                writesCompleted += 1;
                const detail = buildIssueDetail(rereadItem.item, item.repo);
                updatedDetails.push(detail);
                if (item.isPrimary) primaryDetail = detail;
              }

              log(`write order issue=${number} count=${writesCompleted}`);
              return {
                status: 200,
                body: {
                  issue: primaryDetail ?? buildIssueDetail(fresh.item, repository),
                  updatedIssues: updatedDetails,
                  savedAt: new Date(now()).toISOString(),
                  statusOptions: statusOptions(),
                },
              };
            }

            const previous = op.data.previous;
            const next = op.data.next;
            if (![previous, next].every((value) => value === null || (typeof value === 'number' && Number.isFinite(value)))) {
              throw new HttpError(400, 'invalid_order', 'Order neighbours must be finite numbers or null');
            }
            if (previous !== null && next !== null && previous > next) {
              throw new HttpError(409, 'invalid_order', 'Order neighbours must be in ascending order');
            }
            const hasExplicitNeighbours = Array.isArray(op.data.neighbours);
            if (hasExplicitNeighbours) {
              if (op.data.neighbours.length > 200) {
                throw new HttpError(400, 'invalid_order', 'Order neighbour list is invalid');
              }
              for (const entry of op.data.neighbours) {
                if (!entry || typeof entry !== 'object') {
                  throw new HttpError(400, 'invalid_order', 'Order neighbour entry is invalid');
                }
                const repoStr = typeof entry.repo === 'string' && entry.repo ? entry.repo : repository.full;
                if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repoStr)) {
                  throw new HttpError(400, 'invalid_order', 'Order neighbour repository is invalid');
                }
                const itemNum = parseIssueNumberOrThrow(String(entry.number ?? ''));
                const itemFp = typeof entry.fingerprint === 'string' ? entry.fingerprint : '';
                if (!/^[a-f0-9]{64}$/.test(itemFp)) {
                  throw new HttpError(400, 'fingerprint_required', 'Each neighbour draft requires a valid fingerprint');
                }
                const [nOwner, nName] = repoStr.split('/');
                const nRepo = nOwner.toLowerCase() === repository.owner.toLowerCase() && nName.toLowerCase() === repository.name.toLowerCase()
                  ? repository
                  : await resolveRepository(nOwner, nName);
                const nRead = await clientFor(nRepo).getIssue(itemNum).catch(mapGitHubError);
                if (nRead.item.pull_request || nRead.item.state !== 'open' || statusLabelOf(labelNames(nRead.item)) !== 'status:draft') {
                  throw new HttpError(409, 'conflict', 'A neighbouring draft is no longer an open draft; refresh and try again');
                }
                if (issueFingerprint(nRead.item, nRepo) !== itemFp) {
                  throw new HttpError(409, 'conflict', 'A neighbouring draft changed on GitHub; nothing was written', {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions(),
                  });
                }
                if (entry.order !== undefined && parseOrderMarker(nRead.item.body ?? '') !== entry.order) {
                  throw new HttpError(409, 'conflict', 'A neighbouring draft changed order on GitHub; refresh the board and try again', {
                    issue: buildIssueDetail(fresh.item, repository),
                    statusOptions: statusOptions(),
                  });
                }
              }
            }

            const listed = repository.hasIssues
              ? await github.listIssues().catch(mapGitHubError)
              : { items: [], truncated: false };
            const otherDrafts = (listed.items || []).filter(
              (item: any) =>
                !item.pull_request &&
                item.state === 'open' &&
                item.number !== number &&
                statusLabelOf(labelNames(item)) === 'status:draft',
            );
            const otherOrders = otherDrafts
              .map((item: any) => parseOrderMarker(item.body ?? ''))
              .filter((val): val is number => val !== null);

            if (previous !== null && next !== null && otherOrders.some((val) => val > previous && val < next)) {
              throw new HttpError(409, 'conflict', 'Another draft moved into that position; refresh the board and try again', {
                issue: buildIssueDetail(fresh.item, repository),
                statusOptions: statusOptions(),
              });
            }
            if (!hasExplicitNeighbours && otherOrders.length > 0) {
              const prevKnown = previous !== null && otherOrders.includes(previous);
              const nextKnown = next !== null && otherOrders.includes(next);
              if ((prevKnown || nextKnown) && ((previous !== null && !prevKnown) || (next !== null && !nextKnown))) {
                throw new HttpError(409, 'conflict', 'A neighbouring draft changed order on GitHub; refresh the board and try again', {
                  issue: buildIssueDetail(fresh.item, repository),
                  statusOptions: statusOptions(),
                });
              }
            }

            let order = midpointOrder(previous, next);
            const midpointUsable = Number.isFinite(order) && (previous === null || order > previous) && (next === null || order < next);
            if (midpointUsable && otherOrders.includes(order)) {
              throw new HttpError(409, 'conflict', 'Another draft already occupies that order position; refresh the board and try again', {
                issue: buildIssueDetail(fresh.item, repository),
                statusOptions: statusOptions(),
              });
            }
            if (!Number.isFinite(order) || (previous !== null && next !== null && !(order > previous && order < next))) {
              const baseOrder = previous ?? 0;
              order = baseOrder + 1000;
              const trailingDrafts = otherDrafts
                .map((item: any) => ({ item, order: parseOrderMarker(item.body ?? '') }))
                .filter((entry): entry is { item: any; order: number } => entry.order !== null && entry.order >= (next ?? order))
                .sort((a, b) => a.order - b.order || a.item.number - b.item.number);
              let step = 2;
              for (const trailing of trailingDrafts) {
                const trailingRead = await github.getIssue(trailing.item.number).catch(mapGitHubError);
                const rebalancedBody = setOrderMarker(trailingRead.item.body ?? '', baseOrder + step * 1000);
                step += 1;
                await github.updateIssue(trailing.item.number, { body: rebalancedBody }, { etag: trailingRead.etag }).catch(mapGitHubError);
              }
            }
            patch = { body: setOrderMarker(fresh.item.body ?? '', order) };
          } else {
            if (op.data?.confirmed !== true) {
              throw new HttpError(400, 'confirmation_required', 'Confirm moving this draft before transferring it on GitHub');
            }
            if (typeof op.data.target !== 'string' || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(op.data.target)) {
              throw new HttpError(400, 'invalid_target', 'Select a discovered target project');
            }
            const [owner, name] = op.data.target.split('/');
            const target = await resolveRepository(owner, name);
            if (target.full.toLowerCase() === repository.full.toLowerCase() || target.archived || !target.hasIssues) {
              throw new HttpError(400, 'invalid_target', 'Select a different writable project');
            }
            const targetClient = clientFor(target);
            const targetRepoRaw = await targetClient.getRepository().catch(mapGitHubError);
            if (targetRepoRaw.archived || targetRepoRaw.has_issues === false || targetRepoRaw.disabled) {
              throw new HttpError(400, 'invalid_target', 'Select a different writable project');
            }
            const issueNodeId = typeof fresh.item.node_id === 'string' ? fresh.item.node_id.trim() : '';
            const targetRepoNodeId = typeof targetRepoRaw.node_id === 'string' ? targetRepoRaw.node_id.trim() : '';
            if (!issueNodeId || !targetRepoNodeId) {
              throw new HttpError(502, 'github_unavailable', 'GitHub did not provide GraphQL node identifiers; the draft remains in its current project');
            }
            const sourceKey = issueKey(repository, number);
            let transferred;
            try {
              transferred = await github.transferIssue({
                issueId: issueNodeId,
                repositoryId: targetRepoNodeId,
              });
            } catch (error) {
              if (error instanceof GitHubError) {
                if (error.kind === 'forbidden' || error.kind === 'unauthorized') {
                  throw new HttpError(
                    403,
                    'transfer_forbidden',
                    `GitHub refused permission to transfer this draft to ${target.full} with the configured token; the draft remains in ${repository.full}.`,
                  );
                }
                if (error.kind === 'invalid') {
                  throw new HttpError(
                    422,
                    'transfer_rejected',
                    `GitHub rejected transferring this draft to ${target.full}; the draft remains in ${repository.full}.`,
                  );
                }
                if (error.kind === 'rate_limited') {
                  mapGitHubError(error);
                }
              }
              throw new HttpError(
                502,
                'write_outcome_unknown',
                'Transfer outcome could not be confirmed from GitHub; refresh the board to reconcile before editing or retrying.',
                { sourceKey, targetRepo: target.full },
              );
            }
            if (transferred.repositoryFullName.toLowerCase() !== target.full.toLowerCase()) {
              throw new HttpError(
                502,
                'write_outcome_unknown',
                'Transfer destination did not match the selected project; refresh the board to reconcile.',
                { sourceKey, targetRepo: target.full, targetUrl: transferred.url },
              );
            }
            let targetRead: IssueRead;
            try {
              targetRead = await targetClient.getIssue(transferred.number);
            } catch {
              throw new HttpError(
                502,
                'write_outcome_unknown',
                'Draft transfer completed or is in progress, but reading the moved issue failed; refresh the board to reconcile.',
                { sourceKey, targetRepo: target.full, targetNumber: transferred.number, targetUrl: transferred.url },
              );
            }
            if (
              targetRead.item.pull_request ||
              targetRead.item.number !== transferred.number ||
              targetRead.item.state !== 'open' ||
              targetRead.item.title !== fresh.item.title ||
              (targetRead.item.body ?? '') !== (fresh.item.body ?? '')
            ) {
              throw new HttpError(
                502,
                'write_outcome_unknown',
                'Transferred issue state could not be verified in the target project; refresh the board to reconcile.',
                { sourceKey, targetRepo: target.full, targetNumber: transferred.number, targetUrl: transferred.url },
              );
            }
            const canonicalUrl = targetRead.item.html_url || transferred.url;
            log(`transfer source=${sourceKey} target=${issueKey(target, transferred.number)}`);
            return {
              status: 200,
              body: {
                issue: buildIssueDetail(targetRead.item, target),
                listItem: buildBoardListItem(targetRead.item, target),
                sourceKey,
                sourceRepository: repository.full,
                sourceNumber: number,
                targetRepository: target.full,
                targetNumber: transferred.number,
                targetUrl: canonicalUrl,
                savedAt: new Date(now()).toISOString(),
                statusOptions: statusOptions(),
              },
            };
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
        } else if (op.kind === 'human-task') {
          const toggled = toggleHumanTaskInMarkdown(fresh.item.body ?? '', baseHumanTaskIndex, targetHumanTaskCompleted);
          patch = { body: toggled.newBody };
        } else if (op.kind === 'reopen') {
          patch = { state: 'open', labels: applyStatusChange(fresh.item, 'status:backlog') };
        } else if (op.kind === 'remove-label') {
          patch = { labels: labelNames(fresh.item).filter((l) => l.trim().toLowerCase() !== baseRemoveLabel) };
        } else if (op.kind === 'patch') {
          patch = {};
          if (typeof op.body === 'string') {
            const order = parseOrderMarker(fresh.item.body ?? '');
            const canvas = parseCanvasMarker(fresh.item.body ?? '');
            let b = op.body;
            if (canvas !== null && parseCanvasMarker(b) === null) {
              b = setCanvasMarker(b, canvas);
            }
            if (order !== null && parseOrderMarker(b) === null) {
              b = setOrderMarker(b, order);
            }
            patch.body = b;
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
        } else if (op.kind === 'canvas') {
          const { fingerprint: _fp, repo: _repo, ...canvasData } = (op.data ?? {}) as any;
          patch = { body: setCanvasMarker(fresh.item.body ?? '', canvasData) };
        }
      } catch (error) {
        if (error instanceof BoardError) {
          const code = error.code === 'body_too_long' || error.code === 'note_too_long' ? error.code : 'invalid_edit';
          throw new HttpError(400, code, error.message);
        }
        if (error instanceof SectionError) throw new HttpError(400, 'invalid_edit', error.message);
        throw error;
      }

      try {
        await github.updateIssue(number, patch, { etag: fresh.etag });
      } catch (error) {
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
        throw new HttpError(502, 'write_outcome_unknown', 'Outcome unknown \u2014 check the issue on GitHub');
      }

      const currentItem = reread.item;
      let verified = false;

      if (op.kind === 'draft' || op.kind === 'order' || op.kind === 'canvas') {
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
      } else if (op.kind === 'human-task') {
        const curTasks = parseWebHumanTasks(currentItem.body ?? '');
        const curTask = curTasks[baseHumanTaskIndex];
        if (curTask && curTask.completed === targetHumanTaskCompleted) {
          verified = true;
        }
      } else if (op.kind === 'reopen') {
        const curStatus = statusLabelOf(labelNames(currentItem));
        if (currentItem.state === 'open' && curStatus === 'status:backlog') {
          verified = true;
        }
      } else if (op.kind === 'remove-label') {
        const curLabels = labelNames(currentItem);
        if (!curLabels.some((l) => l.trim().toLowerCase() === baseRemoveLabel)) {
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
        repoBoardCache.delete(repository.full);
        repoClosedCache.delete(repository.full);
        log(`write issue=${number} fields=${Object.keys(patch).join(',')}`);
        return {
          status: 200,
          body: {
            issue: buildIssueDetail(currentItem, repository),
            listItem: buildBoardListItem(currentItem, repository),
            savedAt: new Date(now()).toISOString(),
            statusOptions: statusOptions(),
          },
        };
      }

      throw new HttpError(
        502,
        'write_outcome_unknown',
        'Outcome unknown \u2014 check the issue on GitHub',
        {
          issue: buildIssueDetail(currentItem, repository),
          statusOptions: statusOptions(),
        },
      );
    };

    if (op.kind === 'order') {
      return withIssueLock('board:order', () => withIssueLock(issueKey(repository, number), runLocked));
    }
    return withIssueLock(issueKey(repository, number), runLocked);
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
