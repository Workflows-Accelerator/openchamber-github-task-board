import type { BoardSnapshot } from './snapshot.ts';
import { STALE_MS } from './snapshot.ts';

/**
 * The Work Status view: six rows, built entirely here from a snapshot's numbers
 * and one title (design `697a173` §2-§3, D48).
 *
 * Every string is clamped before it goes on the wire. The host parses the whole
 * answer with a strict schema, so one over-limit field would replace the entire
 * section with "invalid"; the clamps below make that unreachable.
 */

/** Host limits: row label, row value, content/tooltip text, note text. */
export const CLAMP = { label: 60, value: 80, content: 200, note: 300 } as const;

/** How the `top` value is shortened when the title does not fit. */
const ELLIPSIS = '...';

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
/** Half of a UTF-16 pair: never valid text, and a slice can cut one in two. */
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const dropLoneSurrogates = (value: string): string => value.replace(LONE_SURROGATES, '');

/**
 * Collapses control characters and runs of whitespace, then cuts to `max`
 * characters with the design's `...` marker. A GitHub title is arbitrary text;
 * it is only ever sent as a plain string in `value` or `text`.
 *
 * A cut can land between the two halves of an emoji. Both halves are dropped
 * rather than sent, so the row never carries half a character.
 */
export function clampText(value: unknown, max: number): string {
  const raw = typeof value === 'string' ? value : '';
  const clean = dropLoneSurrogates(raw.replace(CONTROL_CHARS, ' ')).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  if (max <= ELLIPSIS.length) return dropLoneSurrogates(clean.slice(0, max));
  return dropLoneSurrogates(`${clean.slice(0, max - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`);
}

/** French when the tag starts with `fr` (case-insensitive), English otherwise. */
export function isFrenchLocale(locale: string | null | undefined): boolean {
  return typeof locale === 'string' && /^fr/i.test(locale.trim());
}

export type StatusTone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'error' | 'info';

export interface StatusLineRow {
  kind: 'line';
  id: string;
  label: string;
  value: string;
  dot?: StatusTone;
  content?: { kind: 'bar'; value: number } | { kind: 'chips'; chips: Array<{ id: string; label: string; url?: string }> };
}

export interface StatusNoteRow {
  kind: 'note';
  id: string;
  text: string;
  tone?: 'muted' | 'info' | 'warning' | 'error';
}

export type StatusRow = StatusLineRow | StatusNoteRow;
export interface StatusView {
  rows: StatusRow[];
}

interface Copy {
  needsMe: string;
  top: string;
  progress: string;
  running: string;
  blocked: string;
  task: (n: number) => string;
  nothingWaiting: string;
  noTask: string;
  noTasksYet: string;
  done: (done: number, total: number) => string;
  runningCount: (n: number) => string;
  none: string;
  noneFeminine: string;
  loadedJustNow: string;
  loadedMinutes: (n: number) => string;
  staleMinutes: (n: number) => string;
  staleHours: (n: number) => string;
  empty: string;
}

const EN: Copy = {
  needsMe: 'Needs me',
  top: 'Next task',
  progress: 'Progress',
  running: 'Running agents',
  blocked: 'Blocked by dependencies',
  task: (n) => (n === 1 ? '1 task' : `${n} tasks`),
  nothingWaiting: 'Nothing waiting',
  noTask: 'No task needs you',
  noTasksYet: 'No tasks yet',
  done: (done, total) => `${done} of ${total} done`,
  runningCount: (n) => `${n} running`,
  none: 'None',
  noneFeminine: 'None',
  loadedJustNow: 'Loaded just now',
  loadedMinutes: (n) => `Loaded ${n} min ago`,
  staleMinutes: (n) => `Data loaded ${n} min ago. Open the board to refresh.`,
  staleHours: (n) => `Data loaded ${n} h ago. Open the board to refresh.`,
  empty: 'No board data yet. Open the board once to load it.',
};

const FR: Copy = {
  needsMe: 'À traiter',
  top: 'Prochaine tâche',
  progress: 'Avancement',
  running: 'Agents en cours',
  blocked: 'Bloquées par des dépendances',
  task: (n) => (n === 1 ? '1 tâche' : `${n} tâches`),
  nothingWaiting: 'Rien en attente',
  noTask: 'Aucune tâche ne vous attend',
  noTasksYet: 'Aucune tâche',
  done: (done, total) => `${done} sur ${total} terminées`,
  runningCount: (n) => `${n} en cours`,
  none: 'Aucun',
  noneFeminine: 'Aucune',
  loadedJustNow: 'Chargé à l\'instant',
  loadedMinutes: (n) => `Chargé il y a ${n} min`,
  staleMinutes: (n) => `Données chargées il y a ${n} min. Ouvrez le tableau pour actualiser.`,
  staleHours: (n) => `Données chargées il y a ${n} h. Ouvrez le tableau pour actualiser.`,
  empty: "Aucune donnée du tableau pour l'instant. Ouvrez le tableau une fois pour le charger.",
};

const copyFor = (locale: string | null | undefined): Copy => (isFrenchLocale(locale) ? FR : EN);

/**
 * The `top` value: `owner/repo#N Title`, cut so the whole string stays within
 * the host's 80-character `value` limit. The repository is never shortened
 * unless `owner/repo#N` alone already overflows; then its last path segment is
 * used (design §2).
 */
export function topValue(top: NonNullable<BoardSnapshot['top']>, max: number): string {
  let prefix = `${top.repo}#${top.number}`;
  if (prefix.length > max) {
    const shortRepo = top.repo.split('/').pop() || top.repo;
    prefix = `${shortRepo}#${top.number}`;
  }
  if (prefix.length > max) prefix = `#${top.number}`;
  if (prefix.length >= max) return clampText(prefix, max);
  const title = clampText(top.title, max - prefix.length - 1);
  return title ? `${prefix} ${title}` : prefix;
}

/** The age note of the live and stale states (design §3.2-§3.3). */
export function ageNoteText(copy: Copy, age: number): string {
  const minutes = Math.floor(age / 60_000);
  if (age < STALE_MS) {
    return age < 60_000 ? copy.loadedJustNow : copy.loadedMinutes(minutes);
  }
  if (age < 3_600_000) return copy.staleMinutes(minutes);
  return copy.staleHours(Math.floor(age / 3_600_000));
}

/**
 * Builds the answer to `GET /status` for one snapshot.
 *
 * Three states, never a fourth:
 * - no snapshot for this exact directory: one muted note, no counts, no zeros;
 * - `age < STALE_MS`: the six rows and a muted age note;
 * - `age >= STALE_MS`: the same six rows with their last values and a warning
 *   age note. A stale count is never rewritten to zero.
 */
export function buildStatusView(
  snapshot: BoardSnapshot | null | undefined,
  locale: string | null | undefined,
  now: number
): StatusView {
  const copy = copyFor(locale);
  if (!snapshot) {
    return { rows: [{ kind: 'note', id: 'empty', text: clampText(copy.empty, CLAMP.note), tone: 'muted' }] };
  }

  // A snapshot whose `at` is not a finite number cannot be dated. The parser
  // refuses it, so this only guards a programming error: the section shows the
  // stale warning with the last values, never "NaN" and never a silent zero.
  const elapsed = now - snapshot.at;
  const age = Number.isFinite(elapsed) ? Math.max(0, elapsed) : STALE_MS;
  const { needsMe, running, blocked, done, total } = snapshot.counts;
  const rows: StatusRow[] = [
    {
      kind: 'line',
      id: 'needs-me',
      label: clampText(copy.needsMe, CLAMP.label),
      value: clampText(needsMe === 0 ? copy.nothingWaiting : copy.task(needsMe), CLAMP.value),
      dot: needsMe > 0 ? 'warning' : 'success',
    },
    {
      kind: 'line',
      id: 'top',
      label: clampText(copy.top, CLAMP.label),
      value: clampText(snapshot.top ? topValue(snapshot.top, CLAMP.value) : copy.noTask, CLAMP.value),
      dot: snapshot.top ? 'warning' : 'success',
      ...(snapshot.top
        ? {
            content: {
              kind: 'chips' as const,
              chips: [
                {
                  id: 'issue',
                  label: clampText(`#${snapshot.top.number}`, CLAMP.label),
                  url: `https://github.com/${snapshot.top.repo}/issues/${snapshot.top.number}`,
                },
              ],
            },
          }
        : {}),
    },
    {
      kind: 'line',
      id: 'progress',
      label: clampText(copy.progress, CLAMP.label),
      value: clampText(total === 0 ? copy.noTasksYet : copy.done(done, total), CLAMP.value),
      dot: 'default',
      content: {
        kind: 'bar',
        value: total === 0 ? 0 : Math.min(100, Math.max(0, Math.round((done / total) * 100))),
      },
    },
    {
      kind: 'line',
      id: 'running',
      label: clampText(copy.running, CLAMP.label),
      value: clampText(running === 0 ? copy.none : copy.runningCount(running), CLAMP.value),
      dot: running > 0 ? 'success' : 'muted',
    },
    {
      kind: 'line',
      id: 'blocked',
      label: clampText(copy.blocked, CLAMP.label),
      value: clampText(blocked === 0 ? copy.noneFeminine : copy.task(blocked), CLAMP.value),
      dot: blocked > 0 ? 'error' : 'success',
    },
    {
      kind: 'note',
      id: 'age',
      text: clampText(ageNoteText(copy, age), CLAMP.note),
      tone: age >= STALE_MS ? 'warning' : 'muted',
    },
  ];

  return { rows };
}
