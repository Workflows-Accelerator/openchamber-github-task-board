// ==========================================
// GitHub REST client (server-side only).
//
// The token lives in this process and is only ever sent in the Authorization
// header. Each client is bound to a server-resolved repository; routes must
// resolve the token-visible allowlist before constructing a client.
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
  jsonParsed: boolean;
  data: any;

  constructor(
    kind: GitHubErrorKind,
    status: number,
    message: string,
    options: { jsonParsed?: boolean; data?: any } = {},
  ) {
    super(message);
    this.name = 'GitHubError';
    this.kind = kind;
    this.status = status;
    this.jsonParsed = options.jsonParsed ?? false;
    this.data = options.data ?? null;
  }
}

export interface GitHubRepoRef {
  owner: string;
  name: string;
  full: string;
}

export interface GitHubRepositorySummary {
  id: number | null;
  owner: string;
  name: string;
  full: string;
  archived: boolean;
  hasIssues: boolean;
  disabled: boolean;
  private: boolean;
}

export interface RepositoryList {
  repositories: GitHubRepositorySummary[];
  pages: number;
  truncated: boolean;
}

export interface GitHubClientOptions {
  apiBase: string;
  token: string;
  repo?: GitHubRepoRef | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxPages?: number;
  perPage?: number;
}

export interface IssueRead {
  item: any;
  etag: string | null;
}

export interface TransferredIssueResult {
  id: string;
  number: number;
  url: string;
  repositoryFullName: string;
}

const TRANSFER_ISSUE_MUTATION = `
  mutation TransferIssue($issueId: ID!, $repositoryId: ID!) {
    transferIssue(input: { issueId: $issueId, repositoryId: $repositoryId }) {
      issue {
        id
        number
        url
        repository {
          nameWithOwner
        }
      }
    }
  }
`;

export interface IssueList {
  items: any[];
  pages: number;
  truncated: boolean;
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function kindForStatus(
  status: number,
  headers?: Headers,
  data?: any,
  jsonParsed = false,
  method = 'GET',
): GitHubErrorKind {
  if (!jsonParsed || !data || typeof data !== 'object') {
    return 'server';
  }
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
  if (status === 422) {
    if (method === 'GET' && typeof data.message === 'string' && data.message.toLowerCase() === 'validation failed') {
      return 'invalid';
    }
    // A gateway can return JSON, errors[] or validation words after committing
    // a write. Only the recognisable GitHub validation contract is definitive.
    if (
      data.message === 'Validation Failed' &&
      Array.isArray(data.errors) && data.errors.length > 0 &&
      data.errors.every((error: any) =>
        error && typeof error === 'object' && !Array.isArray(error) &&
        typeof error.resource === 'string' && error.resource.length > 0 &&
        typeof error.field === 'string' && error.field.length > 0 &&
        ['missing', 'missing_field', 'invalid', 'already_exists', 'unprocessable', 'custom'].includes(error.code),
      )
    ) {
      return 'invalid';
    }
    return 'server';
  }
  if (status === 429) return 'rate_limited';
  return 'server';
}

export class GitHubClient {
  private readonly apiBase: string;
  private readonly token: string;
  private readonly repo: GitHubRepoRef | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxPages: number;
  private readonly perPage: number;

  constructor(options: GitHubClientOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, '');
    this.token = options.token;
    this.repo = options.repo ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxPages = options.maxPages ?? 10;
    this.perPage = options.perPage ?? 100;
  }

  get repository(): GitHubRepoRef | null {
    return this.repo;
  }

  private issuesBase(): string {
    if (!this.repo) throw new GitHubError('invalid', 0, 'Repository has not been resolved');
    return `${this.apiBase}/repos/${encodeURIComponent(this.repo.owner)}/${encodeURIComponent(this.repo.name)}`;
  }

  private graphqlUrl(): string {
    if (this.apiBase.endsWith('/api/v3')) {
      return `${this.apiBase.slice(0, -3)}graphql`;
    }
    return `${this.apiBase}/graphql`;
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
    let text = '';
    try {
      response = await this.fetchImpl(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'manual',
      });
      text = await response.text();
    } catch (error) {
      if (error instanceof GitHubError) throw error;
      throw new GitHubError('network', 0, 'GitHub request failed before completion');
    }

    if (response.status >= 300 && response.status < 400) {
      throw new GitHubError(
        'server',
        response.status,
        `GitHub redirected with status ${response.status}; redirects are not permitted`,
      );
    }

    let data: any = null;
    let jsonParsed = false;
    if (text) {
      try {
        data = JSON.parse(text);
        jsonParsed = true;
      } catch {
        data = null;
        jsonParsed = false;
      }
    }

    if (!response.ok) {
      const kind = kindForStatus(response.status, response.headers, data, jsonParsed, options.method);
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
      throw new GitHubError(kind, response.status, message, { jsonParsed, data });
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

  private repositoriesUrl(page: number): string {
    const query = new URLSearchParams({
      per_page: String(this.perPage),
      page: String(page),
      affiliation: 'owner,collaborator,organization_member',
      sort: 'full_name',
      direction: 'asc',
    });
    return `${this.apiBase}/user/repos?${query.toString()}`;
  }

  async listRepositories(): Promise<RepositoryList> {
    const repositories: GitHubRepositorySummary[] = [];
    const seen = new Map<string, number | null>();
    let pages = 0;
    let nextUrl: string | null = this.repositoriesUrl(1);
    const apiOrigin = new URL(this.apiBase).origin;
    const expectedPath = new URL(`${this.apiBase}/user/repos`).pathname;

    while (nextUrl) {
      if (pages >= this.maxPages) {
        throw new GitHubError('server', 200, 'GitHub repository discovery exceeded the page bound');
      }
      const { data, headers } = await this.request(nextUrl);
      if (!Array.isArray(data)) {
        throw new GitHubError('server', 200, 'GitHub repository list response was not a list');
      }

      for (const item of data) {
        const summary = parseRepositorySummary(item);
        if (seen.has(summary.full)) {
          throw new GitHubError('server', 200, 'GitHub repository discovery repeated an identity');
        }
        seen.set(summary.full, summary.id);
        repositories.push(summary);
      }
      pages += 1;

      const link = headers.get('link') ?? '';
      const nextMatch = /<([^>]+)>\s*;\s*rel="next"/i.exec(link);
      if (nextMatch) {
        let parsedNext: URL;
        try {
          parsedNext = new URL(nextMatch[1], this.apiBase);
        } catch {
          throw new GitHubError('server', 200, 'GitHub repository pagination Link header URL was malformed');
        }
        if (parsedNext.origin !== apiOrigin) {
          throw new GitHubError('server', 200, 'GitHub repository pagination left the configured API origin');
        }
        if (parsedNext.pathname !== expectedPath) {
          throw new GitHubError('server', 200, 'GitHub repository pagination left the repository list path');
        }
        nextUrl = parsedNext.toString();
      } else if (data.length >= this.perPage) {
        nextUrl = this.repositoriesUrl(pages + 1);
      } else {
        nextUrl = null;
      }
    }

    return { repositories, pages, truncated: false };
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
        // Page added nothing new; stop pagination to avoid duplicate loops, but
        // report truncation because any later issues were not read.
        truncated = true;
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
        const expectedPath = `${new URL(this.issuesBase()).pathname}/issues`;
        if (parsedNext.pathname !== expectedPath) {
          throw new GitHubError('server', 200, 'GitHub pagination left the configured repository path');
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
    const allowed = new Set(['title', 'body', 'labels', 'state']);
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

  async transferIssue(input: { issueId: string; repositoryId: string }): Promise<TransferredIssueResult> {
    if (!input.issueId || !input.repositoryId) {
      throw new GitHubError('invalid', 0, 'Both issueId and repositoryId are required for transferIssue');
    }
    const { data } = await this.request(this.graphqlUrl(), {
      method: 'POST',
      body: {
        query: TRANSFER_ISSUE_MUTATION,
        variables: {
          issueId: input.issueId,
          repositoryId: input.repositoryId,
        },
      },
    });
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new GitHubError('server', 200, 'GitHub GraphQL response was malformed');
    }
    const transferred = data?.data?.transferIssue?.issue;
    if (!transferred) {
      const errors = Array.isArray(data.errors) ? data.errors : [];
      if (
        errors.length > 0 &&
        errors.every((entry: any) => entry && typeof entry === 'object' && typeof entry.type === 'string')
      ) {
        const types = errors.map((entry: any) => String(entry.type).toUpperCase());
        if (types.every((t: string) => ['FORBIDDEN', 'INSUFFICIENT_SCOPES', 'NOT_FOUND', 'UNPROCESSABLE', 'BAD_USER_INPUT'].includes(t))) {
          const message = typeof errors[0].message === 'string' && errors[0].message.trim()
            ? errors[0].message
            : 'GitHub refused to transfer this issue';
          if (types.some((t: string) => t === 'FORBIDDEN' || t === 'INSUFFICIENT_SCOPES')) {
            throw new GitHubError('forbidden', 403, message, { jsonParsed: true, data });
          }
          throw new GitHubError('invalid', 422, message, { jsonParsed: true, data });
        }
      }
      throw new GitHubError('server', 200, 'GitHub GraphQL transfer outcome was ambiguous', { jsonParsed: true, data });
    }
    if (
      typeof transferred.id !== 'string' || !transferred.id ||
      !Number.isSafeInteger(transferred.number) || transferred.number <= 0 ||
      typeof transferred.url !== 'string' || !/^https?:\/\//i.test(transferred.url) ||
      typeof transferred.repository?.nameWithOwner !== 'string' || !transferred.repository.nameWithOwner.includes('/')
    ) {
      throw new GitHubError('server', 200, 'GitHub GraphQL transfer response was incomplete', { jsonParsed: true, data });
    }
    return {
      id: transferred.id,
      number: transferred.number,
      url: transferred.url,
      repositoryFullName: transferred.repository.nameWithOwner,
    };
  }

  async createIssue(payload: {
    title: string;
    body?: string;
    labels?: string[];
  }): Promise<IssueRead> {
    const allowed = new Set(['title', 'body', 'labels']);
    for (const key of Object.keys(payload)) {
      if (!allowed.has(key)) {
        throw new GitHubError('invalid', 0, `Refusing to write unsupported field ${key}`);
      }
    }
    const { data, headers } = await this.request(this.issuesBase() + '/issues', {
      method: 'POST',
      body: payload,
    });
    if (!data || typeof data.number !== 'number') {
      throw new GitHubError('server', 200, 'GitHub issue response was malformed');
    }
    return { item: data, etag: headers.get('etag') };
  }
}

export function parseRepositorySummary(item: any): GitHubRepositorySummary {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new GitHubError('server', 200, 'GitHub repository response was malformed');
  }
  const full: string = typeof item.full_name === 'string' ? item.full_name : '';
  const parts = full.split('/');
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..') ||
      item.name !== parts[1] || item.owner?.login !== parts[0] ||
      typeof item.archived !== 'boolean' || typeof item.has_issues !== 'boolean' ||
      (item.id !== undefined && (!Number.isSafeInteger(item.id) || item.id <= 0))) {
    throw new GitHubError('server', 200, 'GitHub repository response was malformed');
  }
  const id = typeof item.id === 'number' && Number.isInteger(item.id) && item.id > 0 ? item.id : null;
  return {
    id,
    owner: parts[0],
    name: parts[1],
    full,
    archived: item.archived === true,
    hasIssues: item.has_issues !== false,
    disabled: item.disabled === true,
    private: item.private === true,
  };
}

export function parseIssueNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d{1,10}$/.test(value)) {
    const parsed = Number(value);
    if (parsed > 0) return parsed;
  }
  throw new GitHubError('invalid', 0, 'Issue number must be a positive integer');
}
