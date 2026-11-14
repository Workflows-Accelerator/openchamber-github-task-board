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
  // Only the reset carried by the failing response itself. Never a value the
  // client remembered from an earlier response, which would make a headerless
  // secondary rate limit claim a stale refresh time.
  rateLimitReset: number | null;

  constructor(
    kind: GitHubErrorKind,
    status: number,
    message: string,
    options: { jsonParsed?: boolean; data?: any; rateLimitReset?: number | null } = {},
  ) {
    super(message);
    this.name = 'GitHubError';
    this.kind = kind;
    this.status = status;
    this.jsonParsed = options.jsonParsed ?? false;
    this.data = options.data ?? null;
    this.rateLimitReset = options.rateLimitReset ?? null;
  }
}

export interface GitHubRepoRef {
  id?: number | null;
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
  openIssuesCount?: number | null;
  pushedAt?: string | null;
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
  resource: string | null;
  updatedAt: string | null;
}

export interface RepositoryList {
  repositories: GitHubRepositorySummary[];
  pages: number;
  truncated: boolean;
  notModified?: boolean;
  etag?: string | null;
}

export interface GitHubClientOptions {
  apiBase: string;
  token: string;
  repo?: GitHubRepoRef | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxPages?: number;
  perPage?: number;
  rateLimitRef?: { current: RateLimitInfo };
  now?: () => number;
  dependencyCacheRef?: DependencyCacheRef;
  parentCapabilityRef?: ParentCapabilityRef;
}

export interface IssueRead {
  item: any;
  etag: string | null;
  // True only when the caller sent If-None-Match and GitHub answered 304. The
  // caller must then reuse its own cached copy; `item` is null.
  notModified?: boolean;
}

export interface IssueParent {
  number: number;
  title: string | null;
  repository: string | null;
}

export interface IssueDependencies {
  blockedBy: any[];
  blocking: any[];
  parent: IssueParent | null;
}

export interface DependencyCacheEntry {
  blockedBy: any[];
  blocking: any[];
  // Absent when the read deliberately skipped the parent.
  parent?: IssueParent | null;
  fetchedAt: number;
}

// Shared between clients so the 60s TTL survives the per-request clients the
// board server constructs. A fresh client gets its own empty cache.
export interface DependencyCacheRef {
  entries: Map<string, DependencyCacheEntry>;
}

// Whether the GitHub schema accepts the native `parent` sub-issue field. Probed
// once, then remembered, so an older schema or mock is never queried twice for a
// field it does not have.
export interface ParentCapabilityRef {
  supported: boolean | null;
}

export const DEPENDENCY_CACHE_TTL_MS = 60_000;

export interface PageCache {
  etags: string[];
  pages: any[][];
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

// The native sub-issue link. `blockedBy`/`blocking` stay on REST because the
// dependency routes and their error contract are REST-shaped; this query adds
// only the parent. It is read on dependency routes, where a batched query is
// already in flight; the drawer uses the REST parent endpoint instead so a
// read-only drawer never issues a POST.
const ISSUE_PARENT_QUERY = `
  query IssueDependencies($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        parent {
          number
          title
          repository {
            nameWithOwner
          }
        }
      }
    }
  }
`;

// Same operation without the parent field. Used once a schema has refused
// `parent`, so an older GitHub schema or mock is never asked twice.
const ISSUE_PARENT_FALLBACK_QUERY = `
  query IssueDependencies($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        number
      }
    }
  }
`;

function rejectsParentField(data: any): boolean {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  return errors.some(
    (entry: any) => entry && typeof entry === 'object' &&
      typeof entry.message === 'string' && /parent/i.test(entry.message),
  );
}

function parseIssueParent(node: any): IssueParent | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const number = node.number;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0) return null;
  const repository = typeof node.repository?.nameWithOwner === 'string' && node.repository.nameWithOwner.includes('/')
    ? node.repository.nameWithOwner
    : null;
  return {
    number,
    title: typeof node.title === 'string' && node.title ? node.title : null,
    repository,
  };
}

// The REST issue object names its repository by URL rather than by
// `nameWithOwner`, so the same parent is derived from `repository_url` (or the
// issue's html_url) and only falls back to the client's own repository.
function parseRestIssueParent(data: any, fallbackRepository: string | null): IssueParent | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const number = data.number;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0) return null;
  let repository: string | null = null;
  if (typeof data.repository_url === 'string') {
    const match = /\/repos\/([^/]+)\/([^/]+)$/.exec(data.repository_url);
    if (match) repository = `${match[1]}/${match[2]}`;
  }
  if (!repository && typeof data.html_url === 'string') {
    const match = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/issues\/\d+$/.exec(data.html_url);
    if (match) repository = `${match[1]}/${match[2]}`;
  }
  return {
    number,
    title: typeof data.title === 'string' && data.title ? data.title : null,
    repository: repository ?? fallbackRepository,
  };
}

export interface IssueList {
  items: any[];
  pages: number;
  truncated: boolean;
  notModified?: boolean;
  etag?: string | null;
  excludedPullRequests?: number;
  // Per-page validators and the raw items each one covers, so a multi-page
  // repository revalidates every page instead of trusting page 1 alone.
  pageEtags?: string[];
  pageItems?: any[][];
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function kindForStatus(
  status: number,
  headers?: Headers,
  data?: any,
  jsonParsed = false,
  method = 'GET',
): GitHubErrorKind {
  // Status decides first. A gateway's HTML 401 or plain-text 429 still means
  // what its status says; bailing out on a non-JSON body turned every such
  // refusal into an unexplained server error.
  const remaining = headers?.get('x-ratelimit-remaining');
  const message = jsonParsed && data && typeof data === 'object' && typeof data.message === 'string'
    ? data.message.toLowerCase()
    : '';
  if (status === 401) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status === 403) {
    if (remaining === '0' || message.includes('rate limit')) return 'rate_limited';
    return 'forbidden';
  }
  if (!jsonParsed || !data || typeof data !== 'object') {
    return 'server';
  }
  if (status === 404) return 'not_found';
  // 410 Gone is a definite refusal: the issue or the repository's issues are no
  // longer available (GitHub answers 410 when issues are disabled). Without this
  // it fell through to 'server', so a refused comment was reported as an unknown
  // write outcome and the user was told to check whether it had been saved.
  if (status === 410) return 'not_found';
  // GitHub answers a malformed or precondition-carrying request with 400 before
  // it applies anything, so this is a definite refusal, never an unknown write
  // outcome. Reporting it as 'server' turned every rejected write into a 502
  // "Outcome unknown" that hid the real cause from the user.
  if (status === 400) return 'invalid';
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
  private readonly rateLimitRef: { current: RateLimitInfo };
  private readonly now: () => number;
  private readonly dependencyCache: DependencyCacheRef;
  private readonly parentCapability: ParentCapabilityRef;

  constructor(options: GitHubClientOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, '');
    this.token = options.token;
    this.repo = options.repo ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxPages = options.maxPages ?? 10;
    this.perPage = options.perPage ?? 100;
    this.now = options.now ?? Date.now;
    this.dependencyCache = options.dependencyCacheRef ?? { entries: new Map() };
    this.parentCapability = options.parentCapabilityRef ?? { supported: null };
    this.rateLimitRef = options.rateLimitRef ?? {
      current: {
        limit: null,
        remaining: null,
        reset: null,
        resource: null,
        updatedAt: null,
      },
    };
  }

  getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitRef.current };
  }

  private recordRateLimitHeaders(headers?: Headers): void {
    if (!headers) return;
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const resource = headers.get('x-ratelimit-resource');
    if (limit !== null || remaining !== null || reset !== null || resource !== null) {
      this.rateLimitRef.current = {
        limit: limit !== null ? Number(limit) : this.rateLimitRef.current.limit,
        remaining: remaining !== null ? Number(remaining) : this.rateLimitRef.current.remaining,
        reset: reset !== null ? Number(reset) : this.rateLimitRef.current.reset,
        resource: resource !== null ? resource : this.rateLimitRef.current.resource,
        updatedAt: new Date().toISOString(),
      };
    }
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
    options: {
      method?: string;
      body?: unknown;
      ifNoneMatch?: string | null;
      accept?: string;
    } = {},
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
    // GitHub rejects unsafe requests that carry conditional headers with
    // 400 "Conditional request headers are not allowed in unsafe requests
    // unless supported by the endpoint", and issue updates do not support
    // them. If-Match must never be sent here: it aborts every write before
    // GitHub applies it. Conditional reads below use If-None-Match, which is
    // supported.
    if (options.ifNoneMatch) {
      headers['if-none-match'] = options.ifNoneMatch;
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

    this.recordRateLimitHeaders(response.headers);

    if (response.status === 304) {
      return { status: 304, headers: response.headers, data: null };
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
      const rawReset = response.headers.get('x-ratelimit-reset');
      const failingReset = rawReset !== null && rawReset.trim() !== '' ? Number(rawReset) : NaN;
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
      throw new GitHubError(kind, response.status, message, {
        jsonParsed,
        data,
        rateLimitReset: Number.isFinite(failingReset) && failingReset > 0 ? failingReset : null,
      });
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

  async listRepositories(options: { ifNoneMatch?: string | null } = {}): Promise<RepositoryList> {
    const repositories: GitHubRepositorySummary[] = [];
    const seen = new Map<string, number | null>();
    let pages = 0;
    let nextUrl: string | null = this.repositoriesUrl(1);
    const apiOrigin = new URL(this.apiBase).origin;
    const expectedPath = new URL(`${this.apiBase}/user/repos`).pathname;
    let page1Etag: string | null = null;

    while (nextUrl) {
      if (pages >= this.maxPages) {
        throw new GitHubError('server', 200, 'GitHub repository discovery exceeded the page bound');
      }
      const { data, headers, status } = await this.request(nextUrl, {
        ifNoneMatch: pages === 0 ? options.ifNoneMatch : undefined,
      });
      if (pages === 0 && status === 304) {
        return {
          repositories: [],
          pages: 0,
          truncated: false,
          notModified: true,
          etag: headers.get('etag') || options.ifNoneMatch || null,
        };
      }
      if (pages === 0) {
        page1Etag = headers.get('etag') || null;
      }
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

    return { repositories, pages, truncated: false, notModified: false, etag: page1Etag };
  }

  async listIssues(
    stateOrOptions?:
      | 'all'
      | 'open'
      | 'closed'
      | {
          state?: 'all' | 'open' | 'closed';
          maxPages?: number;
          ifNoneMatch?: string | null;
          pageCache?: PageCache;
        },
    options?: { maxPages?: number; ifNoneMatch?: string | null; pageCache?: PageCache },
  ): Promise<IssueList> {
    const opts = typeof stateOrOptions === 'string'
      ? { state: stateOrOptions, ...options }
      : (stateOrOptions ?? {});
    const items: any[] = [];
    const seenNumbers = new Set<number>();
    const pageEtags: string[] = [];
    const pageItems: any[][] = [];
    let pages = 0;
    let truncated = false;
    let allPagesNotModified = true;
    const stateFilter = opts.state ?? 'all';
    const effectiveMaxPages = opts.maxPages ?? this.maxPages;
    const ifNoneMatch = opts.ifNoneMatch;
    const pageCache = opts.pageCache;
    let nextUrl: string | null =
      `${this.issuesBase()}/issues?state=${encodeURIComponent(stateFilter)}&per_page=${this.perPage}&page=1`;
    const apiOrigin = new URL(this.apiBase).origin;
    let page1Etag: string | null = null;

    while (nextUrl) {
      if (pages >= effectiveMaxPages) {
        truncated = true;
        allPagesNotModified = false;
        break;
      }
      const cachedEtag = pageCache?.etags[pages] ?? (pages === 0 ? ifNoneMatch : undefined);
      const { data, headers, status } = await this.request(nextUrl, { ifNoneMatch: cachedEtag });

      let pageData: any[];
      if (status === 304) {
        const cachedPage = pageCache?.pages[pages];
        if (!Array.isArray(cachedPage)) {
          if (pages === 0 && !pageCache) {
            // Legacy single-page revalidation: the caller's cached body is
            // still valid and it owns it.
            return {
              items: [],
              pages: 0,
              truncated: false,
              notModified: true,
              etag: headers.get('etag') || ifNoneMatch || null,
              excludedPullRequests: 0,
              pageEtags: [],
              pageItems: [],
            };
          }
          // A 304 with no cached body proves nothing; refuse to invent a page.
          truncated = true;
          allPagesNotModified = false;
          break;
        }
        // Clone: the caller mutates the returned items, and the cached page it
        // handed in must stay pristine for the next revalidation.
        pageData = structuredClone(cachedPage);
        pageEtags.push(cachedEtag ?? headers.get('etag') ?? '');
        pageItems.push(pageData);
      } else {
        allPagesNotModified = false;
        if (!Array.isArray(data)) {
          throw new GitHubError('server', 200, 'GitHub issues response was not a list');
        }
        pageData = data;
        pageEtags.push(headers.get('etag') ?? '');
        pageItems.push(pageData);
        if (pages === 0) {
          page1Etag = headers.get('etag') || null;
        }
      }

      let newCount = 0;
      for (const item of pageData) {
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

      if (pageData.length > 0 && newCount === 0) {
        // Page added nothing new; stop pagination to avoid duplicate loops, but
        // report truncation because any later issues were not read.
        truncated = true;
        allPagesNotModified = false;
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
        const expectedNamedPath = `${new URL(this.issuesBase()).pathname}/issues`;
        const expectedNumericPath = typeof this.repo?.id === 'number' && this.repo.id > 0
          ? `/repositories/${this.repo.id}/issues`
          : null;
        const isNamedMatch = parsedNext.pathname === expectedNamedPath;
        const isNumericMatch = expectedNumericPath !== null
          ? parsedNext.pathname === expectedNumericPath
          : /^\/repositories\/\d+\/issues$/.test(parsedNext.pathname);
        if (!isNamedMatch && !isNumericMatch) {
          throw new GitHubError('server', 200, 'GitHub pagination left the configured repository path');
        }
        nextUrl = parsedNext.toString();
      } else if (pageData.length >= this.perPage) {
        nextUrl = `${this.issuesBase()}/issues?state=${encodeURIComponent(stateFilter)}&per_page=${this.perPage}&page=${pages + 1}`;
      } else {
        nextUrl = null;
      }
    }

    return {
      items,
      pages,
      truncated,
      notModified: allPagesNotModified && pages > 0 && !truncated,
      etag: pageEtags[0] || page1Etag,
      pageEtags,
      pageItems,
    };
  }

  async getIssue(number: unknown, options: { ifNoneMatch?: string | null } = {}): Promise<IssueRead> {
    const safeNumber = parseIssueNumber(number);
    const { status, data, headers } = await this.request(`${this.issuesBase()}/issues/${safeNumber}`, {
      ifNoneMatch: options.ifNoneMatch ?? null,
    });
    if (status === 304) {
      // The caller owns the cached body; nothing was re-downloaded.
      return {
        item: null,
        etag: options.ifNoneMatch ?? headers.get('etag') ?? null,
        notModified: true,
      };
    }
    if (!data || typeof data.number !== 'number') {
      throw new GitHubError('server', 200, 'GitHub issue response was malformed');
    }
    return { item: data, etag: headers.get('etag'), notModified: false };
  }

  async updateIssue(
    number: unknown,
    patch: Record<string, unknown>,
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

  // Issue comments are the transport for the board's quick notes. The read is
  // conditional so reopening a task never re-downloads an unchanged page, and
  // an unchanged page costs no rate-limit budget on GitHub.
  async listIssueComments(
    number: unknown,
    options: { ifNoneMatch?: string | null; perPage?: number; page?: number } = {},
  ): Promise<{ items: any[]; etag: string | null; notModified: boolean }> {
    const safeNumber = parseIssueNumber(number);
    const requested = Number(options.perPage ?? 50);
    const perPage = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 50;
    const { status, headers, data } = await this.request(
      `${this.issuesBase()}/issues/${safeNumber}/comments?per_page=${perPage}&page=${Math.max(1, Math.trunc(options.page ?? 1))}`,
      { ifNoneMatch: options.ifNoneMatch ?? null },
    );
    if (status === 304) {
      return { items: [], etag: options.ifNoneMatch ?? null, notModified: true };
    }
    if (!Array.isArray(data)) {
      throw new GitHubError('server', 200, 'GitHub comment response was malformed');
    }
    return { items: data, etag: headers.get('etag'), notModified: false };
  }

  // A note is an append-only comment: no field of the issue is rewritten, so
  // no fingerprint precondition applies and no existing comment is touched.
  async createIssueComment(
    number: unknown,
    body: string,
  ): Promise<{ item: any; etag: string | null }> {
    const safeNumber = parseIssueNumber(number);
    if (typeof body !== 'string' || !body.trim()) {
      throw new GitHubError('invalid', 0, 'A comment body is required');
    }
    const { data, headers } = await this.request(`${this.issuesBase()}/issues/${safeNumber}/comments`, {
      method: 'POST',
      body: { body },
    });
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'number') {
      throw new GitHubError('server', 200, 'GitHub comment response was malformed');
    }
    return { item: data, etag: headers.get('etag') };
  }

  // The drawer reads the parent over REST. GitHub exposes the same native
  // sub-issue link at GET /repos/{owner}/{repo}/issues/{n}/parent, and a
  // read-only drawer must not issue a POST. The GraphQL field stays on the
  // dependency routes, where a batched query is already in flight.
  async getIssueParent(number: unknown): Promise<IssueParent | null> {
    const safeNumber = parseIssueNumber(number);
    try {
      const { data } = await this.request(`${this.issuesBase()}/issues/${safeNumber}/parent`);
      return parseRestIssueParent(data, this.repo?.full ?? null);
    } catch (err) {
      // No parent, or a schema/endpoint that predates sub-issues: the issue is
      // simply unparented.
      if (err instanceof GitHubError && (err.status === 404 || err.status === 410)) return null;
      throw err;
    }
  }

  private async readIssueParent(number: number): Promise<IssueParent | null> {
    if (!this.repo) return null;
    const variables = { owner: this.repo.owner, name: this.repo.name, number };
    const query = this.parentCapability.supported === false ? ISSUE_PARENT_FALLBACK_QUERY : ISSUE_PARENT_QUERY;
    const first = await this.request(this.graphqlUrl(), {
      method: 'POST',
      body: { query, variables },
    });
    if (query === ISSUE_PARENT_QUERY && rejectsParentField(first.data)) {
      this.parentCapability.supported = false;
      const fallback = await this.request(this.graphqlUrl(), {
        method: 'POST',
        body: { query: ISSUE_PARENT_FALLBACK_QUERY, variables },
      });
      if (!fallback.data || typeof fallback.data !== 'object' || Array.isArray(fallback.data)) {
        throw new GitHubError('server', 200, 'GitHub GraphQL response was malformed');
      }
      return null;
    }
    if (!first.data || typeof first.data !== 'object' || Array.isArray(first.data)) {
      throw new GitHubError('server', 200, 'GitHub GraphQL response was malformed');
    }
    if (query === ISSUE_PARENT_QUERY) this.parentCapability.supported = true;
    return parseIssueParent(first.data.data?.repository?.issue?.parent);
  }

  // Dependency context is read at most once per 60s per issue. The cache is
  // shared between clients (a board server builds one client per request), so a
  // drawer re-open costs nothing while a mutation can still invalidate it.
  // `includeParent: false` skips the GraphQL parent query (the drawer reads the
  // parent over REST) and leaves the cached parent untouched.
  async getIssueDependencies(
    number: unknown,
    options: { forceRefresh?: boolean; includeParent?: boolean } = {},
  ): Promise<IssueDependencies> {
    const safeNumber = parseIssueNumber(number);
    const includeParent = options.includeParent !== false;
    const key = `${this.repo?.full?.toLowerCase() ?? ''}#${safeNumber}`;
    const cached = this.dependencyCache.entries.get(key);
    if (!options.forceRefresh && cached && this.now() - cached.fetchedAt < DEPENDENCY_CACHE_TTL_MS) {
      return {
        blockedBy: cached.blockedBy,
        blocking: cached.blocking,
        parent: cached.parent ?? null,
      };
    }
    const [blockedByRes, blockingRes, parent] = await Promise.all([
      this.request(`${this.issuesBase()}/issues/${safeNumber}/dependencies/blocked_by`).catch((err) => {
        if (err instanceof GitHubError && err.status === 404) return { data: [] };
        throw err;
      }),
      this.request(`${this.issuesBase()}/issues/${safeNumber}/dependencies/blocking`).catch((err) => {
        if (err instanceof GitHubError && err.status === 404) return { data: [] };
        throw err;
      }),
      // A parent read never fails the dependency read: an older schema or a
      // transient GraphQL error leaves the issue unparented.
      includeParent ? this.readIssueParent(safeNumber).catch(() => null) : Promise.resolve(null),
    ]);
    const blockedBy = Array.isArray(blockedByRes?.data) ? blockedByRes.data : [];
    const blocking = Array.isArray(blockingRes?.data) ? blockingRes.data : [];
    const entry: DependencyCacheEntry = {
      blockedBy,
      blocking,
      fetchedAt: this.now(),
      // A skipped parent keeps whatever the cache already knew rather than
      // claiming the issue is unparented.
      ...(includeParent ? { parent } : (cached?.parent !== undefined ? { parent: cached.parent } : {})),
    };
    this.dependencyCache.entries.set(key, entry);
    return { blockedBy, blocking, parent: entry.parent ?? null };
  }

  async addIssueDependency(number: unknown, issueId: number): Promise<any> {
    const safeNumber = parseIssueNumber(number);
    if (!Number.isSafeInteger(issueId) || issueId <= 0) {
      throw new GitHubError('invalid', 0, 'Target issue ID must be a positive integer');
    }
    const { data } = await this.request(
      `${this.issuesBase()}/issues/${safeNumber}/dependencies/blocked_by`,
      {
        method: 'POST',
        body: { issue_id: issueId },
      },
    );
    return data;
  }

  async removeIssueDependency(number: unknown, issueId: number): Promise<void> {
    const safeNumber = parseIssueNumber(number);
    if (!Number.isSafeInteger(issueId) || issueId <= 0) {
      throw new GitHubError('invalid', 0, 'Target issue ID must be a positive integer');
    }
    await this.request(
      `${this.issuesBase()}/issues/${safeNumber}/dependencies/blocked_by/${issueId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async listRepositoryDependencies(): Promise<{
    blockedBy: Map<number, any[]>;
    parents: Map<number, IssueParent>;
  }> {
    const blockedBy = new Map<number, any[]>();
    const parents = new Map<number, IssueParent>();
    if (!this.repo) return { blockedBy, parents };

    const buildQuery = (includeParent: boolean) => `
      query ListRepoDependencies($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          issues(first: 100, states: [OPEN, CLOSED]) {
            nodes {
              id
              number
              blockedBy(first: 50) {
                nodes {
                  id
                  databaseId
                  number
                  title
                  state
                  repository {
                    nameWithOwner
                  }
                }
              }${includeParent ? `
              parent {
                number
                title
                repository {
                  nameWithOwner
                }
              }` : ''}
            }
          }
        }
      }
    `;
    const variables = { owner: this.repo.owner, name: this.repo.name };
    const run = (includeParent: boolean) => this.request(this.graphqlUrl(), {
      method: 'POST',
      body: { query: buildQuery(includeParent), variables },
    });

    const includeParent = this.parentCapability.supported !== false;
    let response = await run(includeParent);
    if (includeParent && rejectsParentField(response.data)) {
      this.parentCapability.supported = false;
      response = await run(false);
    } else if (includeParent && response.data && typeof response.data === 'object') {
      this.parentCapability.supported = true;
    }

    const nodes = response.data?.data?.repository?.issues?.nodes;
    if (Array.isArray(nodes)) {
      for (const item of nodes) {
        if (typeof item?.number !== 'number') continue;
        if (Array.isArray(item.blockedBy?.nodes)) {
          blockedBy.set(
            item.number,
            item.blockedBy.nodes.map((n: any) => ({
              id: typeof n.databaseId === 'number' ? n.databaseId : n.id,
              databaseId: n.databaseId,
              number: n.number,
              title: n.title,
              state: typeof n.state === 'string' ? n.state.toLowerCase() : 'open',
              repository: n.repository?.nameWithOwner,
            })),
          );
        }
        const parent = parseIssueParent(item.parent);
        if (parent) parents.set(item.number, parent);
      }
    }
    return { blockedBy, parents };
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
  const openIssuesCount = typeof item.open_issues_count === 'number' && Number.isFinite(item.open_issues_count)
    ? item.open_issues_count
    : (typeof item.open_issues === 'number' && Number.isFinite(item.open_issues) ? item.open_issues : null);
  const pushedAt = typeof item.pushed_at === 'string' && item.pushed_at ? item.pushed_at : null;
  return {
    id,
    owner: parts[0],
    name: parts[1],
    full,
    archived: item.archived === true,
    hasIssues: item.has_issues !== false,
    disabled: item.disabled === true,
    private: item.private === true,
    openIssuesCount,
    pushedAt,
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
