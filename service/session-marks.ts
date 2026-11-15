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
  /** Mark changes allowed per minute; the host refuses past 60. */
  changesPerMinute?: number;
}

interface Entry {
  state: SessionMarkState;
  timer: NodeJS.Timeout | null;
  delay: number;
}

export class SessionMarks {
  private entries: Map<string, Entry> = new Map();
  /** French before the section has ever polled: the owner's language (D49.2). */
  private language: MarkLanguage = 'fr';
  private changeTimes: number[] = [];
  private readonly pollMs: number;
  private readonly now: () => number;
  private readonly changesPerMinute: number;
  private host: MarkHost;

  constructor(host: MarkHost, options: SessionMarksOptions = {}) {
    this.host = host;
    this.pollMs = options.pollMs ?? MARK_POLL_MS;
    this.now = options.now ?? Date.now;
    this.changesPerMinute = options.changesPerMinute ?? MARK_CHANGES_PER_MINUTE;
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
    for (const [sessionId, entry] of this.entries) {
      this.send(sessionId, entry.state);
    }
  }

  /** The current mark state of a session, for tests and diagnostics. */
  public stateOf(sessionId: string): SessionMarkState | undefined {
    return this.entries.get(sessionId)?.state;
  }

  public languageOf(): MarkLanguage {
    return this.language;
  }

  /** Stops every poll. Marks themselves die with the process. */
  public stop(): void {
    for (const entry of this.entries.values()) this.stopTimer(entry);
    this.entries.clear();
  }

  private apply(sessionId: string, state: SessionMarkState): void {
    const current = this.entries.get(sessionId);
    if (current && current.state === state) return;
    if (current) this.stopTimer(current);
    const entry: Entry = { state, timer: null, delay: this.pollMs };
    this.entries.set(sessionId, entry);
    this.send(sessionId, state);
    if (state === 'waiting') this.schedulePoll(sessionId);
  }

  private clear(sessionId: string): void {
    const current = this.entries.get(sessionId);
    if (!current) return;
    this.stopTimer(current);
    this.entries.delete(sessionId);
    this.send(sessionId, null);
  }

  private send(sessionId: string, state: SessionMarkState | null): void {
    if (!this.takeChangeSlot()) return;
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

  private takeChangeSlot(): boolean {
    const now = this.now();
    while (this.changeTimes.length > 0 && now - this.changeTimes[0] >= 60_000) this.changeTimes.shift();
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
