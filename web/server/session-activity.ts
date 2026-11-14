// ==========================================
// Active agent-session tracking for the board.
//
// A card marked `status:in-progress` is not proof that an agent is working.
// This module reads optional local sources — OpenChamber's session status and
// the `openchamber-triggers` `/state` snapshot — and answers one question per
// issue: is a session genuinely busy right now?
//
// Fail-safe by design: a missing, slow, failing or malformed source yields an
// empty snapshot with `degraded: true`. It never throws, never blocks longer
// than `timeoutMs`, and never puts a URL or credential in a returned string.
// ==========================================

export type SessionActivitySource = 'openchamber' | 'triggers';

export interface ActiveIssueSession {
  active: boolean;
  sessionId: string | null;
  source: SessionActivitySource;
  updatedAt: string | null;
}

export interface SessionActivitySnapshot {
  fetchedAt: string | null;
  available: boolean;
  degraded: boolean;
  activeByIssue: Record<string, ActiveIssueSession>;
}

export interface SessionActivityOptions {
  openchamberUrl?: string;
  triggersUrl?: string;
  repoByDirectory?: Record<string, string>;
  ttlMs?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export const DEFAULT_SESSION_ACTIVITY_TTL_MS = 5_000;
export const DEFAULT_SESSION_ACTIVITY_TIMEOUT_MS = 1_200;

// States a source may use for "an agent is working". Anything else — including
// a missing field — is not evidence of activity.
const ACTIVE_STATES = new Set(['busy', 'active', 'running', 'working', 'in_progress']);
const IDLE_STATES = new Set(['idle', 'inactive', 'done', 'stopped', 'completed', 'finished']);

const REPO_SEGMENT = '[A-Za-z0-9_.-]+';
const REPO_PATTERN = new RegExp(`^(${REPO_SEGMENT})\/(${REPO_SEGMENT})$`);
const ISSUE_REF_PATTERN = /(?:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+))?#([1-9][0-9]{0,9})(?!\d)/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRepo(value: string): boolean {
  const match = REPO_PATTERN.exec(value);
  if (!match) return false;
  return match[1] !== '.' && match[1] !== '..' && match[2] !== '.' && match[2] !== '..';
}

function isActiveStatus(value: unknown): boolean {
  if (typeof value === 'string') return ACTIVE_STATES.has(value.toLowerCase());
  if (!isRecord(value)) return false;
  if (value.active === true || value.busy === true || value.running === true) return true;
  for (const key of ['type', 'status', 'state', 'sessionStatus']) {
    const state = value[key];
    if (typeof state === 'string' && ACTIVE_STATES.has(state.toLowerCase())) return true;
  }
  return false;
}

function isIdleStatus(value: unknown): boolean {
  if (typeof value === 'string') return IDLE_STATES.has(value.toLowerCase());
  if (!isRecord(value)) return false;
  if (value.active === false || value.busy === false || value.running === false) return true;
  for (const key of ['type', 'status', 'state', 'sessionStatus']) {
    const state = value[key];
    if (typeof state === 'string' && IDLE_STATES.has(state.toLowerCase())) return true;
  }
  return false;
}

/**
 * Read `owner/repo#123` (and `#123` when `defaultRepo` is known) from free
 * text. Keys are lowercase, deduplicated and keep their first-seen order.
 * Issue 0, non-numeric refs and refs with no repository are dropped.
 */
export function extractIssueRefs(text: string, defaultRepo?: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const fallback =
    typeof defaultRepo === 'string' && isValidRepo(defaultRepo.trim())
      ? defaultRepo.trim().toLowerCase()
      : null;
  const pattern = new RegExp(ISSUE_REF_PATTERN.source, 'g');
  const seen = new Set<string>();
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const owner = match[1];
    const repo = match[2];
    const number = Number(match[3]);
    if (!Number.isSafeInteger(number) || number <= 0) continue;
    const repoFull =
      owner !== undefined && repo !== undefined && isValidRepo(`${owner}/${repo}`)
        ? `${owner}/${repo}`.toLowerCase()
        : fallback;
    if (!repoFull) continue;
    const key = `${repoFull}#${number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(key);
  }
  return refs;
}

function normalizeHttpUrl(value: string | undefined): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;
  // Drop query, fragment and userinfo: a credential must never become part of
  // a request URL or a snapshot.
  return (url.origin + url.pathname).replace(/\/+$/, '');
}

function normalizeDirectoryRepos(
  input: Record<string, string> | undefined,
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  if (!isRecord(input)) return entries;
  for (const [directory, repo] of Object.entries(input)) {
    if (typeof directory !== 'string' || typeof repo !== 'string') continue;
    const normalizedDirectory = directory.trim().replace(/\/+$/, '');
    const normalizedRepo = repo.trim();
    if (!normalizedDirectory.startsWith('/')) continue;
    if (!isValidRepo(normalizedRepo)) continue;
    entries.push([normalizedDirectory, normalizedRepo.toLowerCase()]);
  }
  // Longest directory first, so a worktree under a mapped project wins over a
  // broader parent mapping.
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
}

function emptySnapshot(): SessionActivitySnapshot {
  return { fetchedAt: null, available: false, degraded: false, activeByIssue: {} };
}

interface SessionEntry {
  sessionId: string | null;
  status: unknown;
  record: Record<string, unknown> | null;
}

interface TriggerEntry {
  sessionId: string | null;
  refs: string[];
  explicitActive: boolean;
}

function readOpenChamberSessions(data: unknown): SessionEntry[] {
  if (!isRecord(data)) return [];
  const containers: unknown[] = [];
  if (isRecord(data.sessions) || Array.isArray(data.sessions)) containers.push(data.sessions);
  if (isRecord(data.statuses)) containers.push(data.statuses);
  if (isRecord(data.status)) containers.push(data.status);
  if (containers.length === 0) containers.push(data);

  const entries: SessionEntry[] = [];
  for (const container of containers) {
    if (Array.isArray(container)) {
      for (const item of container) {
        if (!isRecord(item)) continue;
        const id =
          typeof item.id === 'string' && item.id
            ? item.id
            : typeof item.sessionId === 'string' && item.sessionId
              ? item.sessionId
              : null;
        entries.push({ sessionId: id, status: item, record: item });
      }
    } else if (isRecord(container)) {
      for (const [key, value] of Object.entries(container)) {
        if (!key) continue;
        entries.push({
          sessionId: key,
          status: value,
          record: isRecord(value) ? value : null,
        });
      }
    }
  }
  return entries;
}

function readTriggers(
  data: unknown,
  repoForDirectory: (directory: string | null) => string | null,
): TriggerEntry[] {
  if (!isRecord(data) || !Array.isArray(data.triggers)) return [];
  const entries: TriggerEntry[] = [];
  for (const item of data.triggers) {
    if (!isRecord(item)) continue;
    const action = isRecord(item.action) ? item.action : null;
    const directory =
      typeof action?.directory === 'string' && action.directory
        ? action.directory
        : typeof item.directory === 'string' && item.directory
          ? item.directory
          : null;
    const defaultRepo = repoForDirectory(directory) ?? undefined;
    const texts: string[] = [];
    for (const key of ['id', 'name', 'title', 'summary', 'planSummary']) {
      const value = item[key];
      if (typeof value === 'string' && value) texts.push(value);
    }
    if (action) {
      for (const key of ['title', 'directory', 'publishDir']) {
        const value = action[key];
        if (typeof value === 'string' && value) texts.push(value);
      }
    }
    if (directory) texts.push(directory);
    entries.push({
      sessionId: typeof item.sessionId === 'string' && item.sessionId ? item.sessionId : null,
      refs: extractIssueRefs(texts.join(' '), defaultRepo),
      explicitActive: isActiveStatus(item),
    });
  }
  return entries;
}

function directoryOf(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  for (const key of ['directory', 'cwd', 'worktree', 'worktreePath', 'path']) {
    const value = record[key];
    if (typeof value === 'string' && value.startsWith('/')) return value;
  }
  return null;
}

function structuredRef(record: Record<string, unknown>): string | null {
  const rawNumber = record.number ?? record.issueNumber;
  if (typeof rawNumber !== 'number' || !Number.isInteger(rawNumber) || rawNumber <= 0) return null;
  const owner = record.owner;
  const repo = record.repo;
  if (typeof owner === 'string' && typeof repo === 'string' && isValidRepo(`${owner}/${repo}`)) {
    return `${owner}/${repo}`.toLowerCase() + `#${rawNumber}`;
  }
  const repository = record.repository;
  if (typeof repository === 'string' && isValidRepo(repository)) {
    return `${repository.toLowerCase()}#${rawNumber}`;
  }
  return null;
}

function refsFromRecord(
  record: Record<string, unknown>,
  defaultRepo: string | undefined,
): string[] {
  const texts: string[] = [];
  const addStrings = (source: Record<string, unknown>) => {
    for (const key of [
      'issueRef',
      'issue',
      'issueUrl',
      'title',
      'name',
      'summary',
      'description',
      'directory',
      'cwd',
      'worktree',
      'worktreePath',
      'path',
      'repo',
      'repository',
    ]) {
      const value = source[key];
      if (typeof value === 'string' && value) texts.push(value);
    }
  };
  addStrings(record);
  for (const key of ['metadata', 'context', 'session']) {
    const nested = record[key];
    if (isRecord(nested)) addStrings(nested);
  }
  const refs = new Set(extractIssueRefs(texts.join(' '), defaultRepo));
  const structured = structuredRef(record);
  if (structured) refs.add(structured);
  return Array.from(refs);
}

function buildActiveByIssue(
  openchamber: unknown,
  triggers: unknown,
  repoForDirectory: (directory: string | null) => string | null,
  updatedAt: string,
): Record<string, ActiveIssueSession> {
  const active: Record<string, ActiveIssueSession> = {};
  const mark = (refs: string[], sessionId: string | null, source: SessionActivitySource) => {
    for (const ref of refs) {
      const existing = active[ref];
      if (existing) {
        // OpenChamber's own busy reading outranks a trigger's self-report.
        if (existing.source === 'openchamber' || source !== 'openchamber') continue;
      }
      active[ref] = { active: true, sessionId, source, updatedAt };
    }
  };

  const triggerEntries = readTriggers(triggers, repoForDirectory);
  const triggerRefsBySession = new Map<string, string[]>();
  for (const trigger of triggerEntries) {
    if (trigger.sessionId && trigger.refs.length > 0) {
      triggerRefsBySession.set(trigger.sessionId, trigger.refs);
    }
  }

  // One status per session id; an active reading wins over an idle one when a
  // payload repeats the same session.
  const bySession = new Map<string, SessionEntry>();
  const anonymous: SessionEntry[] = [];
  for (const entry of readOpenChamberSessions(openchamber)) {
    if (entry.sessionId === null) {
      anonymous.push(entry);
      continue;
    }
    const existing = bySession.get(entry.sessionId);
    if (!existing || isActiveStatus(entry.status)) bySession.set(entry.sessionId, entry);
  }

  const busySessions = new Set<string>();
  const idleSessions = new Set<string>();
  for (const [sessionId, entry] of bySession) {
    if (isActiveStatus(entry.status)) busySessions.add(sessionId);
    else if (isIdleStatus(entry.status)) idleSessions.add(sessionId);
  }

  for (const entry of bySession.values()) {
    if (!isActiveStatus(entry.status)) continue;
    const defaultRepo = repoForDirectory(directoryOf(entry.record)) ?? undefined;
    const refs = new Set(entry.record ? refsFromRecord(entry.record, defaultRepo) : []);
    // A trigger records the session it started, so it can name the issue even
    // when the session payload carries no metadata of its own.
    for (const ref of triggerRefsBySession.get(entry.sessionId ?? '') ?? []) refs.add(ref);
    mark(Array.from(refs), entry.sessionId, 'openchamber');
  }
  for (const entry of anonymous) {
    if (!isActiveStatus(entry.status)) continue;
    const defaultRepo = repoForDirectory(directoryOf(entry.record)) ?? undefined;
    mark(entry.record ? refsFromRecord(entry.record, defaultRepo) : [], null, 'openchamber');
  }

  for (const trigger of triggerEntries) {
    if (!trigger.explicitActive) continue;
    // OpenChamber already answered for this session, and an idle answer means
    // the trigger's flag is stale.
    if (trigger.sessionId && (busySessions.has(trigger.sessionId) || idleSessions.has(trigger.sessionId))) {
      continue;
    }
    mark(trigger.refs, trigger.sessionId, 'triggers');
  }

  return active;
}

export class SessionActivityTracker {
  private readonly openchamberStatusUrls: string[];
  private readonly triggersStateUrl: string | null;
  private readonly directoryRepos: Array<[string, string]>;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  private attemptedAt: number | null = null;
  private fetchedAt: number | null = null;
  private available = false;
  private degraded = false;
  private activeByIssue: Record<string, ActiveIssueSession> = {};
  private inFlight: Promise<SessionActivitySnapshot> | null = null;

  constructor(options: SessionActivityOptions = {}) {
    const openchamberUrl = normalizeHttpUrl(options.openchamberUrl);
    const triggersUrl = normalizeHttpUrl(options.triggersUrl);
    this.openchamberStatusUrls = openchamberStatusUrls(openchamberUrl);
    this.triggersStateUrl =
      triggersUrl === null ? null : triggersUrl.endsWith('/state') ? triggersUrl : `${triggersUrl}/state`;
    this.directoryRepos = normalizeDirectoryRepos(options.repoByDirectory);
    this.ttlMs =
      typeof options.ttlMs === 'number' && Number.isFinite(options.ttlMs)
        ? Math.max(0, options.ttlMs)
        : DEFAULT_SESSION_ACTIVITY_TTL_MS;
    this.timeoutMs =
      typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
        ? Math.max(1, options.timeoutMs)
        : DEFAULT_SESSION_ACTIVITY_TIMEOUT_MS;
    this.fetchImpl = options.fetchFn ?? fetch;
  }

  get configured(): boolean {
    return this.openchamberStatusUrls.length > 0 || this.triggersStateUrl !== null;
  }

  async getSnapshot(options: { forceRefresh?: boolean } = {}): Promise<SessionActivitySnapshot> {
    // Singleflight: every concurrent board render shares one local read.
    if (this.inFlight) return this.inFlight;
    if (!this.configured) return emptySnapshot();
    if (
      !options.forceRefresh &&
      this.attemptedAt !== null &&
      Date.now() - this.attemptedAt < this.ttlMs
    ) {
      return this.snapshot();
    }
    const pending = this.refresh().finally(() => {
      this.inFlight = null;
    });
    this.inFlight = pending;
    return pending;
  }

  private repoForDirectory(directory: string | null): string | null {
    if (!directory) return null;
    const normalized = directory.replace(/\/+$/, '');
    for (const [mapped, repo] of this.directoryRepos) {
      if (normalized === mapped || normalized.startsWith(`${mapped}/`)) return repo;
    }
    return null;
  }

  private async refresh(): Promise<SessionActivitySnapshot> {
    this.attemptedAt = Date.now();
    const [openchamber, triggers] = await Promise.all([
      this.openchamberStatusUrls.length > 0 ? this.fetchOpenChamber() : Promise.resolve(null),
      this.triggersStateUrl === null ? Promise.resolve(null) : this.requestJson(this.triggersStateUrl),
    ]);

    const configuredSources =
      (this.openchamberStatusUrls.length > 0 ? 1 : 0) + (this.triggersStateUrl === null ? 0 : 1);
    const healthySources = (openchamber?.ok ? 1 : 0) + (triggers?.ok ? 1 : 0);
    const observedAt = Date.now();
    const updatedAt = new Date(observedAt).toISOString();

    this.available = healthySources > 0;
    // Any configured source that did not answer truthfully makes the picture
    // incomplete, even when another source still works.
    this.degraded = healthySources < configuredSources;
    if (healthySources > 0) this.fetchedAt = observedAt;
    this.activeByIssue = buildActiveByIssue(
      openchamber?.ok ? openchamber.data : null,
      triggers?.ok ? triggers.data : null,
      (directory) => this.repoForDirectory(directory),
      updatedAt,
    );
    return this.snapshot();
  }

  private async fetchOpenChamber(): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
    let last: { ok: true; data: unknown } | { ok: false; status: number } = { ok: false, status: 0 };
    for (const url of this.openchamberStatusUrls) {
      last = await this.requestJson(url);
      if (last.ok || last.status !== 404) return last;
    }
    return last;
  }

  private async requestJson(
    url: string,
  ): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The race is the real guarantee: an injected fetch that ignores the abort
    // signal still cannot hold the board past `timeoutMs`.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('session activity request timed out'));
      }, this.timeoutMs);
    });
    try {
      const response = await Promise.race([
        this.fetchImpl(url, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal: controller.signal,
          redirect: 'manual',
        }),
        timeout,
      ]);
      if (!response.ok) {
        try {
          await Promise.race([response.text(), timeout]);
        } catch {
          // A body that never arrives does not change the failed status.
        }
        return { ok: false, status: response.status };
      }
      const text = await Promise.race([response.text(), timeout]);
      try {
        const data: unknown = JSON.parse(text);
        if (data === null || data === undefined) return { ok: false, status: response.status };
        return { ok: true, data };
      } catch {
        return { ok: false, status: response.status };
      }
    } catch {
      return { ok: false, status: 0 };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private snapshot(): SessionActivitySnapshot {
    return {
      fetchedAt: this.fetchedAt === null ? null : new Date(this.fetchedAt).toISOString(),
      available: this.available,
      degraded: this.degraded,
      activeByIssue: { ...this.activeByIssue },
    };
  }
}

function openchamberStatusUrls(base: string | null): string[] {
  if (base === null) return [];
  if (/\/session\/status$/.test(base)) return [base];
  // A base that already ends in /api is the OpenChamber API root.
  if (/\/api$/.test(base)) return [`${base}/session/status`];
  return [`${base}/api/session/status`, `${base}/session/status`];
}

export function createSessionActivityTracker(
  options: SessionActivityOptions = {},
): SessionActivityTracker {
  return new SessionActivityTracker(options);
}
