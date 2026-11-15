import { isFrenchLocale } from './status-view.ts';
import type { SessionEventRequest } from './session-event.ts';

/**
 * Sidebar marks for the Work Status wave (D49.3, D50.1).
 *
 * A mark says one of two things about a session row and nothing else:
 * - `running`: the agent is working;
 * - `waiting`: the agent asked the person something and only they can move on.
 *
 * A mark never carries a snapshot value, an issue title, a repository name or a
 * URL. It is drawn on rows the owner did not open, in every chat and on a screen
 * share, so the text is a fixed phrase in the owner's language.
 *
 * Answering a question resumes the same turn without a new `turn-started`, so a
 * waiting mark is polled with `sessions.status` until it resolves. A failed
 * poll keeps the mark and retries slower: an unreachable service is not an
 * answered question, and a false all-clear is the failure this rule exists to
 * prevent.
 */

export const MARK_POLL_MS = 30_000;
export const MARK_POLL_MAX_MS = 300_000;
export const MARK_CHANGES_PER_MINUTE = 60;
/** Most sessions that may carry a mark at once (threat model 0fd4f44 invariant 15). */
export const MARK_MAX = 200;

export const MARK_TEXT = {
  running: { en: 'Agent running', fr: 'Agent en cours' },
  waiting: { en: 'Waiting for your answer', fr: 'En attente de votre réponse' },
} as const;

export type MarkLanguage = 'en' | 'fr';
export type SessionMarkState = 'running' | 'waiting';

export interface MarkHost {
  setMark(target: { sessionId: string }, mark: { icon: string; tone: 'info' | 'warning'; text: string } | null): Promise<unknown>;
  sessionStatus(sessionId: string): Promise<'idle' | 'busy' | 'waiting'>;
}

export interface SessionMarksOptions {
  /** Poll interval while a waiting mark exists. 30 s in production. */
  pollMs?: number;
  /** Clock, for tests. */
  now?: () => number;
  /** Mark changes allowed per window; the host refuses past 60. */
  changesPerMinute?: number;
  /** Length of that window. One minute in production; short in tests. */
  windowMs?: number;
  /**
   * Every positive `sessions.status` answer, for the decision store (§7.1:
   * one poll serves both features). Never called on a failed poll: a failed
   * poll is not an observation.
   */
  onStatus?: (sessionId: string, status: 'idle' | 'busy' | 'waiting') => void;
}

interface Entry {
  state: SessionMarkState;
  timer: NodeJS.Timeout | null;
  delay: number;
}

/** What the host currently shows for a session, as far as we know. */
interface Delivered {
  state: SessionMarkState;
  lang: MarkLanguage;
}

export class SessionMarks {
  private entries: Map<string, Entry> = new Map();
  /** French before the section has ever polled: the owner's language (D49.2). */
  private language: MarkLanguage = 'fr';
  private changeTimes: number[] = [];
  /** Sessions whose desired mark differs from the delivered one but had no slot yet. */
  private pending: Set<string> = new Set();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly pollMs: number;
  private readonly now: () => number;
  private readonly changesPerMinute: number;
  private readonly windowMs: number;
  private readonly onStatus: ((sessionId: string, status: 'idle' | 'busy' | 'waiting') => void) | undefined;
  private host: MarkHost;
  /** What the host currently shows per session; absence means no mark. */
  private delivered: Map<string, Delivered> = new Map();

  constructor(host: MarkHost, options: SessionMarksOptions = {}) {
    this.host = host;
    this.pollMs = options.pollMs ?? MARK_POLL_MS;
    this.now = options.now ?? Date.now;
    this.changesPerMinute = options.changesPerMinute ?? MARK_CHANGES_PER_MINUTE;
    this.windowMs = options.windowMs ?? 60_000;
    this.onStatus = options.onStatus;
  }

  /** Applies one session event. A subagent's row is ignored: its parent's turn is the one to watch. */
  public handleEvent(request: SessionEventRequest): void {
    const { session, type } = request.event;
    if (session.parentId) return;
    switch (type) {
      case 'turn-started':
        this.apply(session.id, 'running');
        break;
      case 'permission-asked':
      case 'question-asked':
        this.apply(session.id, 'waiting');
        break;
      case 'turn-finished':
      case 'turn-failed':
      // An archived or deleted session can no longer answer, so its mark must
      // not outlive it (design §4.3). Clearing stops the poll with the entry.
      case 'session-archived':
      case 'session-deleted':
        this.clear(session.id);
        break;
      default:
        break;
    }
  }

  /** Remembers the language of the most recent `GET /status` and re-sets live marks when it changes. */
  public noteLocale(locale: string | null | undefined): void {
    const next: MarkLanguage = isFrenchLocale(locale) ? 'fr' : 'en';
    if (next === this.language) return;
    this.language = next;
    for (const sessionId of this.entries.keys()) {
      this.request(sessionId);
    }
  }

  /** The current mark state of a session, for tests and diagnostics. */
  public stateOf(sessionId: string): SessionMarkState | undefined {
    return this.entries.get(sessionId)?.state;
  }

  public languageOf(): MarkLanguage {
    return this.language;
  }

  /** Stops every poll and every deferred change. Marks themselves die with the process. */
  public stop(): void {
    for (const entry of this.entries.values()) this.stopTimer(entry);
    this.entries.clear();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pending.clear();
    this.delivered.clear();
  }

  private apply(sessionId: string, state: SessionMarkState): void {
    const current = this.entries.get(sessionId);
    if (current && current.state === state) {
      // The state did not change, so there is nothing to send: a change that was
      // held back for the rate limit is now moot.
      this.pending.delete(sessionId);
      return;
    }
    // A page that can reach this route can name any session id. Past the mark
    // cap a new session is ignored rather than polled forever: no mark is the
    // truthful state, and the cap bounds the timers (invariant 15).
    if (!current && this.entries.size >= MARK_MAX) return;
    if (current) this.stopTimer(current);
    const entry: Entry = { state, timer: null, delay: this.pollMs };
    this.entries.set(sessionId, entry);
    this.request(sessionId);
    if (state === 'waiting') this.schedulePoll(sessionId);
  }

  private clear(sessionId: string): void {
    const current = this.entries.get(sessionId);
    if (!current) return;
    this.stopTimer(current);
    this.entries.delete(sessionId);
    this.request(sessionId);
  }

  /**
   * Sends the desired mark of one session when it differs from what the host
   * already shows. A change the rate limit refuses is remembered and delivered
   * when the window frees: dropping it would leave a stale "waiting" mark that
   * no later event ever clears.
   */
  private request(sessionId: string): void {
    const desired = this.entries.get(sessionId)?.state ?? null;
    const shown = this.delivered.get(sessionId);
    const upToDate = desired === null
      ? shown === undefined
      : shown !== undefined && shown.state === desired && shown.lang === this.language;
    if (upToDate) {
      this.pending.delete(sessionId);
      return;
    }
    if (!this.takeChangeSlot()) {
      this.pending.add(sessionId);
      this.armFlush();
      return;
    }
    this.pending.delete(sessionId);
    this.deliver(sessionId, desired);
  }

  private deliver(sessionId: string, state: SessionMarkState | null): void {
    if (state === null) this.delivered.delete(sessionId);
    else this.delivered.set(sessionId, { state, lang: this.language });
    const mark = state === null
      ? null
      : {
          icon: state === 'running' ? 'time' : 'question',
          tone: state === 'running' ? ('info' as const) : ('warning' as const),
          text: MARK_TEXT[state][this.language],
        };
    void Promise.resolve()
      .then(() => this.host.setMark({ sessionId }, mark))
      .catch(() => {
        // A refused or unreachable mark call changes nothing locally; the next
        // event or poll re-establishes the truth.
      });
  }

  /** Delivers the changes held back by the rate limit, once the window frees a slot. */
  private armFlush(): void {
    if (this.flushTimer) return;
    const oldest = this.changeTimes[0];
    const wait = oldest === undefined ? 1 : oldest + this.windowMs - this.now() + 1;
    const timer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, Math.max(1, wait));
    timer.unref?.();
    this.flushTimer = timer;
  }

  private flush(): void {
    for (const sessionId of [...this.pending]) {
      if (!this.pending.has(sessionId)) continue;
      this.request(sessionId);
      if (this.pending.has(sessionId)) {
        // Still no slot: wait for the next window rather than spin.
        this.armFlush();
        return;
      }
    }
  }

  private takeChangeSlot(): boolean {
    const now = this.now();
    while (this.changeTimes.length > 0 && now - this.changeTimes[0] >= this.windowMs) this.changeTimes.shift();
    if (this.changeTimes.length >= this.changesPerMinute) return false;
    this.changeTimes.push(now);
    return true;
  }

  private schedulePoll(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry || entry.state !== 'waiting') return;
    const timer = setTimeout(() => {
      void this.poll(sessionId);
    }, entry.delay);
    timer.unref?.();
    entry.timer = timer;
  }

  private async poll(sessionId: string): Promise<void> {
    const entry = this.entries.get(sessionId);
    if (!entry || entry.state !== 'waiting') return;
    entry.timer = null;

    try {
      const status = await this.host.sessionStatus(sessionId);
      this.onStatus?.(sessionId, status);
      if (status === 'busy') {
        this.apply(sessionId, 'running');
        return;
      }
      if (status === 'idle') {
        this.clear(sessionId);
        return;
      }
      entry.delay = this.pollMs;
    } catch {
      // Keep the mark and retry slower: the question may still be open.
      entry.delay = Math.min(Math.max(entry.delay * 2, this.pollMs), MARK_POLL_MAX_MS);
    }

    const after = this.entries.get(sessionId);
    if (after && after.state === 'waiting') this.schedulePoll(sessionId);
  }

  private stopTimer(entry: Entry): void {
    if (!entry.timer) return;
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}
