// ==========================================
// GitHub REST client (server-side only).
//
// The token lives in this process and is only ever sent in the Authorization
// header. Every URL is built from the configured repository; no caller can
// change which repository is addressed.
// ==========================================

export type GitHubErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'invalid';

export class GitHubError extends Error {
  status: number;
  kind: GitHubErrorKind;

  constructor(kind: GitHubErrorKind, status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.kind = kind;
    this.status = status;
  }
}

export interface GitHubRepoRef {
  owner: string;
  name: string;
  full: string;
}

export interface GitHubClientOptions {
  apiBase: string;
  token: string;
  repo: GitHubRepoRef;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxPages?: number;
  perPage?: number;
}

export interface IssueRead {
  item: any;
  etag: string | null;
}

export interface IssueList {
  items: any[];
  pages: number;
  truncated: boolean;
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function kindForStatus(status: number, headers?: Headers, data?: any): GitHubErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) {
    const remaining = headers?.get('x-ratelimit-remaining');
    const msg = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
    if (remaining === '0' || msg.includes('rate limit')) {
      return 'rate_limited';
    }
    return 'forbidden';
  }
  if (status === 404) return 'not_found';
  if (status === 422) return 'invalid';
  if (status === 429) return 'rate_limited';
  return 'server';
}

export class GitHubClient {
  private readonly apiBase: string;
  private readonly token: string;
  private readonly repo: GitHubRepoRef;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxPages: number;
  private readonly perPage: number;

  constructor(options: GitHubClientOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, '');
    this.token = options.token;
    this.repo = options.repo;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxPages = options.maxPages ?? 10;
    this.perPage = options.perPage ?? 100;
  }

  get repository(): GitHubRepoRef {
    return this.repo;
  }

  private issuesBase(): string {
    return `${this.apiBase}/repos/${encodeURIComponent(this.repo.owner)}/${encodeURIComponent(this.repo.name)}`;
  }

  private async request(
    url: string,
    options: { method?: string; body?: unknown; etag?: string | null; accept?: string } = {},
  ): Promise<{ status: number; headers: Headers; data: any }> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
      accept: options.accept ?? 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'openchamber-task-board-web',
    };
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options.etag) {
      headers['if-match'] = options.etag;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new GitHubError('network', 0, 'GitHub request failed before a response arrived');
    }

    const text = await response.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const kind = kindForStatus(response.status, response.headers, data);
      const message =
        kind === 'unauthorized'
          ? 'GitHub rejected the stored token'
          : kind === 'forbidden'
            ? 'GitHub refused access to the requested resource'
            : kind === 'not_found'
              ? 'GitHub resource not found'
              : kind === 'rate_limited'
                ? 'GitHub rate limit reached'
                : kind === 'invalid'
                  ? (typeof data?.message === 'string' ? data.message : 'GitHub rejected the request as invalid')
                  : `GitHub responded with status ${response.status}`;
      throw new GitHubError(kind, response.status, message);
    }

    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      throw new GitHubError('server', response.status, 'GitHub response exceeded the safe size');
    }

    return { status: response.status, headers: response.headers, data };
  }

  async getAuthenticatedUser(): Promise<{ login: string }> {
    const { data } = await this.request(`${this.apiBase}/user`);
    const login = data && typeof data.login === 'string' ? data.login : '';
    if (!login) {
      throw new GitHubError('server', 200, 'GitHub /user returned no account login');
    }
    return { login };
  }

  async getRepository(): Promise<any> {
    const { data } = await this.request(this.issuesBase());
    if (!data || typeof data.full_name !== 'string') {
      throw new GitHubError('server', 200, 'GitHub repository response was malformed');
    }
    return data;
  }

  async listIssues(): Promise<IssueList> {
    const items: any[] = [];
    const seenNumbers = new Set<number>();
    let pages = 0;
    let truncated = false;
    let nextUrl: string | null =
      `${this.issuesBase()}/issues?state=all&per_page=${this.perPage}&page=1`;
    const apiOrigin = new URL(this.apiBase).origin;

    while (nextUrl) {
      if (pages >= this.maxPages) {
        truncated = true;
        break;
      }
      const { data, headers } = await this.request(nextUrl);
      if (!Array.isArray(data)) {
        throw new GitHubError('server', 200, 'GitHub issues response was not a list');
      }

      let newCount = 0;
      for (const item of data) {
        const num = item?.number;
        if (typeof num === 'number') {
          if (!seenNumbers.has(num)) {
            seenNumbers.add(num);
            items.push(item);
            newCount += 1;
          }
        } else {
          items.push(item);
          newCount += 1;
        }
      }
      pages += 1;

      if (data.length > 0 && newCount === 0) {
        // Page added nothing new; stop pagination to avoid duplicate loops
        break;
      }

      const link = headers.get('link') ?? '';
      const nextMatch = /<([^>]+)>\s*;\s*rel="next"/i.exec(link);
      if (nextMatch) {
        let parsedNext: URL;
        try {
          parsedNext = new URL(nextMatch[1], this.apiBase);
        } catch {
          throw new GitHubError('server', 200, 'GitHub pagination Link header URL was malformed');
        }
        if (parsedNext.origin !== apiOrigin) {
          throw new GitHubError('server', 200, 'GitHub pagination left the configured API origin');
        }
        nextUrl = parsedNext.toString();
      } else if (data.length >= this.perPage) {
        nextUrl = `${this.issuesBase()}/issues?state=all&per_page=${this.perPage}&page=${pages + 1}`;
      } else {
        nextUrl = null;
      }
    }

    return { items, pages, truncated };
  }

  async getIssue(number: unknown): Promise<IssueRead> {
    const safeNumber = parseIssueNumber(number);
    const { data, headers } = await this.request(`${this.issuesBase()}/issues/${safeNumber}`);
    if (!data || typeof data.number !== 'number') {
      throw new GitHubError('server', 200, 'GitHub issue response was malformed');
    }
    return { item: data, etag: headers.get('etag') };
  }

  async updateIssue(
    number: unknown,
    patch: Record<string, unknown>,
    options: { etag?: string | null } = {},
  ): Promise<IssueRead> {
    const safeNumber = parseIssueNumber(number);
    const allowed = new Set(['body', 'labels']);
    for (const key of Object.keys(patch)) {
      if (!allowed.has(key)) {
        throw new GitHubError('invalid', 0, `Refusing to write unsupported field ${key}`);
      }
    }
    const { data, headers } = await this.request(`${this.issuesBase()}/issues/${safeNumber}`, {
      method: 'PATCH',
      body: patch,
      etag: options.etag,
    });
    if (!data || typeof data.number !== 'number') {
      throw new GitHubError('server', 200, 'GitHub issue response was malformed');
    }
    return { item: data, etag: headers.get('etag') };
  }
}

export function parseIssueNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d{1,10}$/.test(value)) {
    const parsed = Number(value);
    if (parsed > 0) return parsed;
  }
  throw new GitHubError('invalid', 0, 'Issue number must be a positive integer');
}
