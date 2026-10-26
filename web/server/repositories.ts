// Token-visible registry: complete discoveries only, 60s freshness, retained
// unavailable identities, coalesced refresh and failed-refresh backoff.
import { GitHubClient, type GitHubRepositorySummary } from './github.ts';

export interface RepositoryEntry extends GitHubRepositorySummary {
  available: boolean;
  lastSeenAt: string;
}

export interface RepositoryView {
  fetchedAt: string | null;
  freshnessMs: number;
  stale: boolean;
  discoveryFailed: boolean;
  error: string | null;
  visibleCount: number;
  repositories: RepositoryEntry[];
}

export class RepositoryNotAllowedError extends Error {
  constructor() {
    super('That repository is not available to this board token');
  }
}
export class DiscoveryUnavailableError extends Error {}

export class RepositoryRegistry {
  private readonly client: GitHubClient;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private known = new Map<string, RepositoryEntry>();
  private fetchedAt: number | null = null;
  private attemptedAt: number | null = null;
  private failed = false;
  private inFlight: Promise<RepositoryView> | null = null;

  constructor(options: { client: GitHubClient; now?: () => number; ttlMs?: number }) {
    this.client = options.client;
    this.now = options.now ?? Date.now;
    this.ttlMs = Math.max(0, options.ttlMs ?? 60_000);
  }

  async view(): Promise<RepositoryView> {
    // A refresh marks attemptedAt before the list request completes. Await that
    // refresh first so authorisation can never use the pre-refresh allowlist.
    if (this.inFlight) return this.inFlight;
    if (this.attemptedAt !== null && this.now() - this.attemptedAt < this.ttlMs) return this.snapshot();
    this.inFlight = this.refresh().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async resolve(owner: string, name: string): Promise<RepositoryEntry> {
    const full = `${owner}/${name}`;
    // A warmed registry rejects fabricated names without even a discovery call.
    if (!this.known.has(full)) throw new RepositoryNotAllowedError();
    const view = await this.view();
    const found = view.repositories.find(repository => repository.full === full && repository.available);
    if (!found) throw new RepositoryNotAllowedError();
    if (view.discoveryFailed) throw new DiscoveryUnavailableError();
    return found;
  }

  private async refresh(): Promise<RepositoryView> {
    this.attemptedAt = this.now();
    try {
      const listed = await this.client.listRepositories();
      const at = this.now();
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
    } catch {
      this.failed = true;
    }
    return this.snapshot();
  }

  private snapshot(): RepositoryView {
    const repositories = Array.from(this.known.values());
    return {
      fetchedAt: this.fetchedAt === null ? null : new Date(this.fetchedAt).toISOString(),
      freshnessMs: this.ttlMs,
      stale: this.failed,
      discoveryFailed: this.failed,
      error: this.failed ? 'Repository discovery failure; refresh later. Last known identities retained.' : null,
      visibleCount: repositories.filter(repository => repository.available).length,
      repositories,
    };
  }
}
