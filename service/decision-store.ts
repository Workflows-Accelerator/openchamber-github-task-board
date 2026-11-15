/**
 * The pending-decision store (D53, spec §3, §5, §7).
 *
 * One entry per `(sessionId, kind, askId)`, in memory only. The store is fed by
 * the session events the extension already receives and by the existing
 * `sessions.status` poll; it is never fed by an issue body, a comment, a URL or
 * a client-supplied session id (§3.2, §7.4).
 *
 * Two rules shape every method here:
 *
 * 1. Nothing is invented. An entry exists only because the host announced a
 *    `question-asked`; it disappears only on an observation (a turn event, a
 *    status poll, a host 404), never on a timer or a guess.
 * 2. Answering is at-most-once. The entry is marked `answering` before the host
 *    call, so a second request gets `409` and makes no host call at all (§7.3).
 */

import { clampFormFields, validateFormAnswer, type FormField, type FormValues } from './decision-form.ts';
import type { SessionEventRequest } from './session-event.ts';

export const DECISIONS_MAX = 50;
export const DECISIONS_BODY_MAX = 64 * 1024;
export const DECISION_STALENESS_MS = 10 * 60_000;
/**
 * Thirty minutes from the entry's own first observation, never re-armed. The
 * staleness window above measures silence about a session, and a `waiting`
 * poll or a re-delivery of the same ask re-arms it, so a form superseded by a
 * newer ask stayed answerable. This bound is the form's age; past it the
 * service refuses (`DECISION_EXPIRED`) and the owner answers in the session.
 * The panel enforces the same constant (`panel/decisions.ts`).
 */
export const DECISION_MAX_AGE_MS = 30 * 60_000;
/** Ids removed after the host said they were gone; bounded like the store itself. */
export const DECISION_TOMBSTONES_MAX = 200;
export const DECISION_MESSAGE_MAX = 2000;
export const DECISION_TITLE_MAX = 200;
export const LINKED_MAX = 8;

export type DecisionKind = 'form' | 'page';
export type DecisionState = 'pending' | 'answering' | 'answered-unconfirmed';

export interface LinkedItem {
  id: string;
  number: number | null;
  url: string;
}

export interface PageMeta {
  hasHtml: boolean;
  hasUi: boolean;
  htmlChars: number;
  mode: 'wait' | 'later' | null;
}

export interface DecisionEntry {
  id: string;
  kind: DecisionKind;
  sessionId: string;
  parentId: string | null;
  directory: string | null;
  askId: string;
  title: string | null;
  sessionTitle: string | null;
  askedAt: number;
  state: DecisionState;
  confirmedAt: number;
  /** When the store first saw this decision; a re-delivery never moves it. */
  firstSeenAt: number;
  answeredAt: number | null;
  linked: LinkedItem[];
  fields: FormField[] | null;
  page: PageMeta | null;
  /** Fields or options the caps dropped, so the block can say how many. */
  droppedFields: number;
  droppedOptions: number;
}

/** The host call the answer route needs, structurally typed to avoid a cycle. */
export interface DecisionAnswerHost {
  answerForm(
    sessionId: string,
    formId: string,
    values: FormValues | null,
    message?: string
  ): Promise<{ answered?: boolean }>;
}

export interface DecisionStoreOptions {
  now?: () => number;
  host?: DecisionAnswerHost;
  maxEntries?: number;
  stalenessMs?: number;
  /** Absolute maximum age from first observation; defaults to `DECISION_MAX_AGE_MS`. */
  maxAgeMs?: number;
  /**
   * The board's project directory. When set, an event from another directory is
   * not stored, and an entry outside the scope is never answered. The panel
   * registers its project through `POST /snapshot`; until then the store cannot
   * tell projects apart and accepts what the host sends.
   */
  projectDirectory?: string | null;
  log?: (line: string) => void;
}

export interface DecisionAnswerRequest {
  id?: unknown;
  values?: unknown;
  message?: unknown;
}

export interface DecisionAnswerResult {
  status: number;
  body: Record<string, unknown>;
}

export interface DecisionListView {
  v: 1;
  at: number;
  startedAt: number;
  decisions: DecisionEntry[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Object(value) === value && !Array.isArray(value);

const cut = (value: string, max: number): string => (value.length <= max ? value : value.slice(0, max));

/** Keeps the repo-qualified id, the number and the url; caps the list at 8 (§3.3). */
export function normalizeLinked(raw: unknown): LinkedItem[] {
  if (!Array.isArray(raw)) return [];
  const items: LinkedItem[] = [];
  for (const candidate of raw) {
    if (!isObject(candidate)) continue;
    const id = candidate.id;
    if (typeof id !== 'string' || id.length === 0) continue;
    const number = typeof candidate.number === 'number' && Number.isFinite(candidate.number) ? candidate.number : null;
    const url = typeof candidate.url === 'string' ? candidate.url : '';
    items.push({ id: cut(id, 300), number, url: cut(url, 500) });
    if (items.length >= LINKED_MAX) break;
  }
  return items;
}

/** The agent's ask, read defensively. Anything malformed yields `null`, never a guess. */
function readAsk(content: SessionEventRequest['content'], askId: string): Record<string, unknown> | null {
  if (!content || content.type !== 'question-asked') return null;
  const ask = content.ask;
  if (!isObject(ask)) return null;
  if (ask.id !== askId) return null;
  return ask;
}

export class DecisionStore {
  private readonly entries: Map<string, DecisionEntry> = new Map();
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly stalenessMs: number;
  private readonly maxAgeMs: number;
  private readonly log: (line: string) => void;
  private readonly projects: Set<string> = new Set();
  /** A decision removed after the host said it was gone never comes back as live. */
  private readonly removed: Set<string> = new Set();
  private readonly removedOrder: string[] = [];
  private host: DecisionAnswerHost | undefined;
  public readonly startedAt: number;

  constructor(options: DecisionStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? DECISIONS_MAX;
    this.stalenessMs = options.stalenessMs ?? DECISION_STALENESS_MS;
    this.maxAgeMs = options.maxAgeMs ?? DECISION_MAX_AGE_MS;
    this.log = options.log ?? (() => {});
    this.host = options.host;
    if (options.projectDirectory) this.registerProject(options.projectDirectory);
    this.startedAt = this.now();
  }

  /** Set once the host client exists, or replaced in a test. */
  public setHost(host: DecisionAnswerHost | undefined): void {
    this.host = host;
  }

  /**
   * Adds one project directory the board owns. Called from `POST /snapshot`
   * (the panel's own project) and from the constructor. A worktree under the
   * project is still the project, so a subdirectory matches.
   */
  public registerProject(directory: string | null | undefined): void {
    if (typeof directory !== 'string' || directory.length === 0) return;
    this.projects.add(directory.replace(/\/+$/, ''));
  }

  /** True when the store has no project scope, or `directory` is inside it. */
  private inScope(directory: string | null): boolean {
    if (this.projects.size === 0) return true;
    if (typeof directory !== 'string' || directory.length === 0) return false;
    const normalized = directory.replace(/\/+$/, '');
    for (const project of this.projects) {
      if (normalized === project || normalized.startsWith(`${project}/`)) return true;
    }
    return false;
  }

  private rememberRemoved(id: string): void {
    if (this.removed.has(id)) return;
    this.removed.add(id);
    this.removedOrder.push(id);
    while (this.removedOrder.length > DECISION_TOMBSTONES_MAX) {
      const oldest = this.removedOrder.shift();
      if (oldest) this.removed.delete(oldest);
    }
  }

  public size(): number {
    return this.entries.size;
  }

  public get(id: string): DecisionEntry | undefined {
    return this.entries.get(id);
  }

  public entriesOf(sessionId: string): DecisionEntry[] {
    return [...this.entries.values()].filter((entry) => entry.sessionId === sessionId);
  }

  /**
   * Applies one session event.
   *
   * - `question-asked` creates or refreshes one entry (§3.1).
   * - `turn-finished` / `turn-failed` close every entry of the session: the
   *   host's own definition of idle is "nothing waiting" (§3.5).
   * - `session-archived` / `session-deleted` remove every entry of the session.
   * - `turn-started` clears nothing: answering a form resumes the turn without
   *   a new `turn-started` (§3.5).
   * - `permission-asked` is out of scope for this release (D53 scope decision).
   */
  public handleEvent(request: SessionEventRequest): void {
    const { event } = request;
    const sessionId = event.session.id;
    switch (event.type) {
      case 'question-asked':
        this.createFromQuestion(request);
        break;
      case 'turn-finished':
      case 'turn-failed':
        this.removeSession(sessionId);
        break;
      case 'session-archived':
      case 'session-deleted':
        this.removeSession(sessionId);
        break;
      default:
        break;
    }
  }

  /**
   * One `sessions.status` answer, shared with the marks poll (§7.1). `waiting`
   * confirms every entry of the session; `idle`/`busy` closes them.
   */
  public observeStatus(sessionId: string, status: 'idle' | 'busy' | 'waiting'): void {
    if (status === 'waiting') {
      const at = this.now();
      for (const entry of this.entriesOf(sessionId)) entry.confirmedAt = at;
      return;
    }
    this.removeSession(sessionId);
  }

  /** True when the last positive observation is older than the staleness window. */
  public isUnconfirmed(entry: DecisionEntry): boolean {
    return this.now() - entry.confirmedAt > this.stalenessMs;
  }

  /**
   * True when the decision is older than its absolute maximum age. Measured
   * from `firstSeenAt`, so neither a `waiting` poll nor a re-delivery re-arms it.
   */
  public isExpired(entry: DecisionEntry): boolean {
    return this.now() - entry.firstSeenAt > this.maxAgeMs;
  }

  /**
   * `GET /decisions` (§3.8). Sorted per §3.4 and capped at 64 KB: when the
   * projection is too large, the oldest entries are dropped first.
   */
  public list(): DecisionListView {
    const at = this.now();
    let decisions = this.sorted();
    let view: DecisionListView = { v: 1, at, startedAt: this.startedAt, decisions };
    while (decisions.length > 0 && Buffer.byteLength(JSON.stringify(view), 'utf8') > DECISIONS_BODY_MAX) {
      const oldest = [...decisions].sort((a, b) => a.askedAt - b.askedAt)[0];
      decisions = decisions.filter((entry) => entry !== oldest);
      view = { v: 1, at, startedAt: this.startedAt, decisions };
      this.log(`[decisions] projection over ${DECISIONS_BODY_MAX} bytes; dropped ${oldest.id}`);
    }
    return view;
  }

  /**
   * `POST /decision/answer` (§5.1). The client sends a decision id and values;
   * the service resolves session, form id and kind from its own entry, so a
   * compromised panel can only answer decisions the service already knows.
   */
  public async answer(request: DecisionAnswerRequest): Promise<DecisionAnswerResult> {
    const id = request.id;
    if (typeof id !== 'string' || id.length === 0) {
      return { status: 400, body: { v: 1, code: 'ANSWER_INVALID', detail: [] } };
    }
    const entry = this.entries.get(id);
    if (!entry) return { status: 404, body: { v: 1, code: 'DECISION_UNKNOWN' } };
    if (entry.state !== 'pending') {
      // The panel needs the entry's real state to tell an answer still running
      // from one that already completed; both are 409 but they are not the same.
      return { status: 409, body: { v: 1, code: 'DECISION_NOT_PENDING', state: entry.state } };
    }
    // A decision the host linked to nothing is shown as UNBOUND and answered in
    // the session, never through the board: the board cannot prove it owns it.
    if (entry.linked.length === 0) return { status: 409, body: { v: 1, code: 'DECISION_NOT_LINKED' } };
    if (!this.inScope(entry.directory)) {
      return { status: 409, body: { v: 1, code: 'DECISION_FOREIGN_PROJECT' } };
    }
    // §5.1 step 2: past the staleness window is a refusal, not an answer. The
    // entry stays `pending`; only an observation deletes it (§7.2).
    if (this.isUnconfirmed(entry)) return { status: 409, body: { v: 1, code: 'DECISION_STALE' } };
    // The form's own age, independent of any re-arming. A superseded ask stays
    // in the store while the session reports waiting; past this bound the board
    // cannot prove it is still the ask the session waits on.
    if (this.isExpired(entry)) return { status: 409, body: { v: 1, code: 'DECISION_EXPIRED' } };
    if (entry.kind !== 'form') {
      // S2 answers forms only. A page is answered by a message, which S3 ships.
      return { status: 400, body: { v: 1, code: 'ANSWER_INVALID', detail: [] } };
    }

    const values = request.values;
    const message = request.message;
    let answerValues: FormValues | null = null;
    let answerMessage: string | undefined;

    if (values === null || values === undefined) {
      // Dismissal is a real answer: `answerForm(..., null, message)` cancels
      // the form and tells the agent why (§0.3.6).
      if (typeof message !== 'string') {
        return { status: 400, body: { v: 1, code: 'ANSWER_INVALID', detail: ['message'] } };
      }
      const trimmed = message.trim();
      if (trimmed.length === 0 || trimmed.length > DECISION_MESSAGE_MAX) {
        return { status: 400, body: { v: 1, code: 'ANSWER_INVALID', detail: ['message'] } };
      }
      answerValues = null;
      answerMessage = trimmed;
    } else {
      if (message !== null && message !== undefined) {
        return { status: 400, body: { v: 1, code: 'ANSWER_INVALID', detail: ['message'] } };
      }
      const validation = validateFormAnswer(entry.fields ?? [], values);
      if (!validation.ok) {
        return { status: 400, body: { v: 1, code: validation.code, detail: validation.detail } };
      }
      if (Object.keys(validation.values).length === 0) {
        // `{}` is not "no answer": the host's `answerForm` would take the reply
        // path with nothing in it (§5.1).
        return { status: 400, body: { v: 1, code: 'ANSWER_INVALID', detail: [] } };
      }
      answerValues = validation.values;
    }

    const host = this.host;
    if (!host) {
      return { status: 503, body: { v: 1, code: 'HOST_UNAVAILABLE' } };
    }

    // At-most-once: the marker goes down before the call, never after (§7.3).
    entry.state = 'answering';

    try {
      const result = await host.answerForm(entry.sessionId, entry.askId, answerValues, answerMessage);
      if (result?.answered !== true) {
        entry.state = 'pending';
        return { status: 400, body: { v: 1, code: 'ANSWER_REFUSED' } };
      }
      entry.state = 'answered-unconfirmed';
      entry.answeredAt = this.now();
      entry.confirmedAt = entry.answeredAt;
      return { status: 200, body: { v: 1, state: 'answered-unconfirmed' } };
    } catch (error) {
      return this.mapHostError(entry, error);
    }
  }

  /** Maps one host failure to the wire answer and the entry state, no retry (§5.1). */
  private mapHostError(entry: DecisionEntry, error: unknown): DecisionAnswerResult {
    const status = isObject(error) || typeof error === 'object'
      ? Number((error as { status?: unknown } | null)?.status ?? 0)
      : 0;
    const message = typeof (error as { message?: unknown } | null)?.message === 'string'
      ? String((error as { message: string }).message)
      : undefined;

    if (status === 404) {
      // Already closed in the session, by the chat or by another device. The
      // tombstone stops a duplicate delivery from resurrecting it as live.
      this.entries.delete(entry.id);
      this.rememberRemoved(entry.id);
      return { status: 404, body: { v: 1, code: 'DECISION_GONE' } };
    }
    if (status === 403) {
      entry.state = 'pending';
      return { status: 403, body: { v: 1, code: 'PERMISSION_MISSING', message: message ?? null } };
    }
    if (status === 400) {
      entry.state = 'pending';
      return { status: 400, body: { v: 1, code: 'ANSWER_REFUSED', message: message ?? null } };
    }
    if (status === 429) {
      entry.state = 'pending';
      return { status: 429, body: { v: 1, code: 'RATE_LIMITED' } };
    }
    // Unknown outcome: the host may have taken the answer before the connection
    // died, so the entry stays `answering` and is never re-armed or retried.
    return { status: 502, body: { v: 1, code: 'UNKNOWN', message: message ?? null } };
  }

  private createFromQuestion(request: SessionEventRequest): void {
    const { event } = request;
    const question = event.question;
    if (!question) return;
    const sessionId = event.session.id;
    const askId = question.id;
    const id = `${sessionId}:${question.kind}:${askId}`;
    const ask = readAsk(request.content, askId);
    const now = this.now();

    // The host said this decision was gone. A retried delivery is not a new
    // question, and re-creating it would make it answerable again.
    if (this.removed.has(id)) return;

    const existing = this.entries.get(id);
    if (existing) {
      // A duplicate delivery is a confirmation, not a second entry (§3.4).
      existing.askedAt = Math.min(existing.askedAt, event.at);
      existing.confirmedAt = now;
      if (ask) {
        this.applyAsk(existing, ask);
      }
      return;
    }

    if (!sessionId) return;
    if (!this.inScope(event.project.directory)) return;

    const entry: DecisionEntry = {
      id,
      kind: question.kind,
      sessionId,
      parentId: event.session.parentId,
      directory: event.project.directory,
      askId,
      title: null,
      sessionTitle: typeof request.content?.sessionTitle === 'string' ? request.content.sessionTitle : null,
      askedAt: event.at,
      state: 'pending',
      confirmedAt: now,
      firstSeenAt: now,
      answeredAt: null,
      linked: normalizeLinked(event.linked),
      fields: null,
      page: question.kind === 'page' ? { hasHtml: false, hasUi: false, htmlChars: 0, mode: null } : null,
      droppedFields: 0,
      droppedOptions: 0,
    };
    if (ask) this.applyAsk(entry, ask);
    this.entries.set(id, entry);
    this.enforceCap();
  }

  /** Reads title/fields from an ask. Without `transcript` the ask is absent and the entry stays blind. */
  private applyAsk(entry: DecisionEntry, ask: Record<string, unknown>): void {
    const title = ask.title;
    if (typeof title === 'string' && title.length > 0) entry.title = cut(title, DECISION_TITLE_MAX);
    if (entry.kind !== 'form') return;
    if (!Array.isArray(ask.fields)) return;
    const clamped = clampFormFields(ask.fields);
    entry.fields = clamped.fields;
    entry.droppedFields = clamped.droppedFields;
    entry.droppedOptions = clamped.droppedOptions;
  }

  private removeSession(sessionId: string): void {
    for (const [id, entry] of this.entries) {
      if (entry.sessionId === sessionId) {
        this.entries.delete(id);
        this.rememberRemoved(id);
      }
    }
  }

  /** §7.6: at most 50 entries; answered entries are evicted before waiting ones. */
  private enforceCap(): void {
    while (this.entries.size > this.maxEntries) {
      const all = [...this.entries.values()];
      const answered = all
        .filter((entry) => entry.state === 'answered-unconfirmed')
        .sort((a, b) => (a.answeredAt ?? a.askedAt) - (b.answeredAt ?? b.askedAt));
      const victim = answered[0] ?? all.sort((a, b) => a.askedAt - b.askedAt)[0];
      if (!victim) return;
      this.entries.delete(victim.id);
      this.rememberRemoved(victim.id);
      this.log(`[decisions] store at ${this.maxEntries}; dropped ${victim.id}`);
    }
  }

  /** §3.4: waiting before confirming, then newest first, then ask id descending. */
  private sorted(): DecisionEntry[] {
    return [...this.entries.values()].sort((a, b) => {
      const aWaiting = a.state === 'answered-unconfirmed' ? 1 : 0;
      const bWaiting = b.state === 'answered-unconfirmed' ? 1 : 0;
      if (aWaiting !== bWaiting) return aWaiting - bWaiting;
      if (a.askedAt !== b.askedAt) return b.askedAt - a.askedAt;
      return a.askId < b.askId ? 1 : a.askId > b.askId ? -1 : 0;
    });
  }
}
