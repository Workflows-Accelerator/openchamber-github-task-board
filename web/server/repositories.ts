// Token-visible registry: complete discoveries only, 60s freshness, retained
// unavailable identities, coalesced refresh and failed-refresh backoff.
import { GitHubClient, GitHubError, type GitHubRepositorySummary } from './github.ts';

export interface RepositoryEntry extends GitHubRepositorySummary {
  available: boolean;
  lastSeenAt: string;
}

// What a failed discovery actually was, in the vocabulary the client switches
// on. 'server' is the honest bucket for everything that is not a refused
// credential, a rate limit or an unreachable GitHub.
export type DiscoveryFailureKind = 'auth' | 'rate_limited' | 'network' | 'server';

// Short, fixed reasons only: never the token, never a raw upstream body.
const DISCOVERY_FAILURE_REASONS: Record<DiscoveryFailureKind, string> = {
  auth: 'GitHub refused the board token or its permissions',
  rate_limited: 'GitHub rate limit reached',
  network: 'GitHub was unreachable from the server',
  server: 'GitHub returned an unexpected response',
};

export function discoveryFailureKind(error: unknown): DiscoveryFailureKind {
  if (error instanceof GitHubError) {
    // A 403 scope, fine-grained PAT, SAML SSO or IP allowlist refusal is a
    // credential/permission problem: refreshing can never fix it, so it must
    // not hide inside the generic server sentence.
    if (error.kind === 'unauthorized' || error.kind === 'forbidden') return 'auth';
    if (error.kind === 'rate_limited') return 'rate_limited';
    if (error.kind === 'network') return 'network';
  }
  return 'server';
}

export interface RepositoryView {
  fetchedAt: string | null;
  freshnessMs: number;
  stale: boolean;
  discoveryFailed: boolean;
  error: string | null;
  errorKind: DiscoveryFailureKind | null;
  errorReason: string | null;
  errorResetAt: string | null;
  visibleCount: number;
  repositories: RepositoryEntry[];
}

export class RepositoryNotAllowedError extends Error {
  constructor() {
    super('That repository is not available to this board token');
  }
}
export class DiscoveryUnavailableError extends Error {
  errorKind: DiscoveryFailureKind | null;
  errorResetAt: string | null;

  constructor(view?: { errorKind?: DiscoveryFailureKind | null; errorResetAt?: string | null } | null) {
    super('Repository discovery failed; no operation was dispatched');
    this.name = 'DiscoveryUnavailableError';
    this.errorKind = view?.errorKind ?? null;
    this.errorResetAt = view?.errorResetAt ?? null;
  }
}

export class RepositoryRegistry {
  private readonly client: GitHubClient;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private known = new Map<string, RepositoryEntry>();
  private fetchedAt: number | null = null;
  private attemptedAt: number | null = null;
  private failed = false;
  private failureKind: DiscoveryFailureKind | null = null;
  private failureReason: string | null = null;
  private failureResetAt: string | null = null;
  private inFlight: Promise<RepositoryView> | null = null;
  private cachedEtag: string | null = null;

  constructor(options: { client: GitHubClient; now?: () => number; ttlMs?: number }) {
    this.client = options.client;
    this.now = options.now ?? Date.now;
    this.ttlMs = Math.max(0, options.ttlMs ?? 60_000);
  }

  async view(options: { forceRefresh?: boolean } = {}): Promise<RepositoryView> {
    // A refresh marks attemptedAt before the list request completes. Await that
    // refresh first so authorisation can never use the pre-refresh allowlist.
    if (this.inFlight) return this.inFlight;
    if (!options.forceRefresh && this.attemptedAt !== null && this.now() - this.attemptedAt < this.ttlMs) {
      return this.snapshot();
    }
    this.inFlight = this.refresh(options).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async resolve(owner: string, name: string, options: { forceRefresh?: boolean } = {}): Promise<RepositoryEntry> {
    const full = `${owner}/${name}`;
    // A warmed registry rejects fabricated names without even a discovery call.
    // A forced refresh must run first: the name may have been created since.
    if (!options.forceRefresh && !this.known.has(full)) throw new RepositoryNotAllowedError();
    const view = await this.view(options);
    const found = view.repositories.find(repository => repository.full === full && repository.available);
    if (!found) throw new RepositoryNotAllowedError();
    if (view.discoveryFailed) throw new DiscoveryUnavailableError(view);
    return found;
  }

  private async refresh(options: { forceRefresh?: boolean } = {}): Promise<RepositoryView> {
    this.attemptedAt = this.now();
    try {
      const ifNoneMatch = options.forceRefresh ? undefined : this.cachedEtag;
      const listed = await this.client.listRepositories({ ifNoneMatch });
      const at = this.now();
      if (listed.notModified) {
        this.fetchedAt = at;
        this.failed = false;
        this.clearFailure();
        return this.snapshot();
      }
      // A page-1 ETag only proves page 1 is unchanged; trust it for single-page lists only.
      this.cachedEtag = listed.pages === 1 && !listed.truncated ? (listed.etag || null) : null;
      const next = new Map<string, RepositoryEntry>();
      for (const repository of listed.repositories) {
        next.set(repository.full, { ...repository, available: !repository.disabled, lastSeenAt: new Date(at).toISOString() });
      }
      for (const [full, entry] of this.known) {
        if (!next.has(full)) next.set(full, { ...entry, available: false });
      }
      // Never silently truncate the known picker or publish a partial allowlist.
      if (next.size > 10_000) throw new Error('Repository history bound reached');
      this.known = next;
      this.fetchedAt = at;
      this.failed = false;
      this.clearFailure();
    } catch (error) {
      // Keep what actually happened instead of discarding it. The reason is a
      // fixed sentence per kind, so no token or upstream body can leak.
      this.failed = true;
      this.failureKind = discoveryFailureKind(error);
      this.failureReason = DISCOVERY_FAILURE_REASONS[this.failureKind];
      this.failureResetAt = this.failureKind === 'rate_limited' ? this.rateLimitResetAt(error) : null;
    }
    return this.snapshot();
  }

  private clearFailure(): void {
    this.failureKind = null;
    this.failureReason = null;
    this.failureResetAt = null;
  }

  private rateLimitResetAt(error: unknown): string | null {
    // Only the failing response's own header. A remembered reset from an
    // earlier successful call would be stale, and a headerless secondary rate
    // limit would then promise a refresh time it never received.
    const reset = error instanceof GitHubError ? error.rateLimitReset : null;
    if (typeof reset !== 'number' || !Number.isFinite(reset) || reset <= 0) return null;
    if (reset * 1000 <= this.now()) return null;
    return new Date(reset * 1000).toISOString();
  }

  private snapshot(): RepositoryView {
    const repositories = Array.from(this.known.values());
    return {
      fetchedAt: this.fetchedAt === null ? null : new Date(this.fetchedAt).toISOString(),
      freshnessMs: this.ttlMs,
      stale: this.failed,
      discoveryFailed: this.failed,
      error: this.failed ? 'Repository discovery failure; refresh later. Last known identities retained.' : null,
      errorKind: this.failed ? this.failureKind : null,
      errorReason: this.failed ? this.failureReason : null,
      errorResetAt: this.failed ? this.failureResetAt : null,
      visibleCount: repositories.filter(repository => repository.available).length,
      repositories,
    };
  }
}
