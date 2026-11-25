// ==========================================
// Board and List pages
//
// Two static pages over one read model. The Board shows one scope at a time;
// the List shows every level at once. Both are complete without script: every
// card and row is in the HTML, and no section is hidden until the inline
// script marks the document `js`. Script adds scope entry, the Here marker
// and the detail dialog, and nothing else.
//
// The board computes no state. Every state word is the engine's `rest_state`;
// where the engine's word and its own edges disagree, both are printed.
// ==========================================

import {
  flattenTree,
  type ContractCondition,
  type ReadProvenance,
  type RestState,
  type TreeModel,
  type TreeRow,
} from './model.ts';
import {
  LANE_ORDER,
  LANE_WORDS,
  STATE_WORDS,
  containment,
  engineDisagreement,
  focusCounts,
  laneGroups,
  laneOf,
  lanePlan,
  levelEdges,
  progress,
  progressText,
  type LaneId,
  type LevelEdge,
} from './rollup.ts';
import { findRowByKey, scopeHref, type BoardView } from './scope.ts';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function stateWord(state: string): string {
  if (state === 'unknown') {
    return 'Unknown state';
  }
  // A state this build does not know is named as unknown, never blank and
  // never silently renamed to a known word.
  return STATE_WORDS[state as RestState] ?? 'Unknown state';
}

// The reader's word for a lane. A lane this build does not know is named as
// unknown rather than borrowing a word that means something else.
export function laneWord(lane: string): string {
  return LANE_WORDS[lane as LaneId] ?? LANE_WORDS.unknown;
}

export function viewFile(view: BoardView): string {
  return view === 'board' ? 'index.html' : 'list.html';
}

// Ruling 7: a read that cannot name its engine revision and its read time has
// not declared provenance. It is unknown, and never "Live read".
export function sourceLabel(provenance: ReadProvenance | null | undefined): string {
  if (
    !provenance ||
    typeof provenance.read_at !== 'string' ||
    provenance.read_at === '' ||
    typeof provenance.engine_commit !== 'string' ||
    provenance.engine_commit === ''
  ) {
    return 'Unknown source';
  }
  if (provenance.source_kind === 'live') {
    return 'Live read';
  }
  if (provenance.source_kind === 'fixture') {
    return 'Fixture capture';
  }
  return 'Unknown source';
}

function titleOf(row: TreeRow): string {
  return row.title ?? row.node_key;
}

// A key is not a title. When the payload carried no title the page still shows
// the key, but says what it is; the `task_title` capability is what makes this
// visible instead of silently reading as a name.
function titleHtml(row: TreeRow): string {
  const text = esc(titleOf(row));
  return row.title === null
    ? `${text} <span class="title-missing">title not read</span>`
    : text;
}

export function dialogId(row: TreeRow): string {
  return `d-${row.task_id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

function byId(model: TreeModel): Map<string, TreeRow> {
  return new Map(flattenTree(model.roots).map((row) => [row.task_id, row]));
}

// A blocker the read can name is named by its title. One the read did not
// return is never printed as an id on the default surface: it is a task the
// read could not see.
function refLabel(
  ref: { task_id: string; node_key: string | null },
  rows: ReadonlyMap<string, TreeRow>,
): string {
  const row = rows.get(ref.task_id);
  if (row !== undefined) {
    return row.title === null ? `${titleOf(row)} (title not read)` : titleOf(row);
  }
  return ref.node_key === null ? 'a task outside this read' : ref.node_key;
}

function blockerLabels(
  row: TreeRow,
  rows: ReadonlyMap<string, TreeRow>,
): string[] {
  return row.blocked_by.map((ref) => refLabel(ref, rows));
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) {
    return words[0] ?? '';
  }
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export interface DetailField {
  label: string;
  value: string;
  mono?: boolean;
  // The exact machine timestamp, kept in a title so the reading surface can
  // say "4 minutes ago" without losing the fact underneath it.
  title?: string;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const ACTIVE_PHASES = new Set(['claimed', 'launching', 'live', 'ending']);

function utcDay(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      86_400_000,
  );
}

function calendarDay(date: Date, now: Date | null): string {
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  if (now !== null && now.getUTCFullYear() === date.getUTCFullYear()) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${date.getUTCFullYear()}`;
}

// Ruling 2: the reading surface says "4 minutes ago", "yesterday", "20 Nov",
// and only reaches for a year when the year differs. Relative wording is
// measured against the read, not the machine clock, so a saved page keeps the
// sentence it was built with.
export function humanTime(
  value: string | null | undefined,
  nowValue: string | null | undefined,
): string {
  if (typeof value !== 'string' || value === '') {
    return '';
  }
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) {
    return '';
  }
  const now =
    typeof nowValue === 'string' && nowValue !== ''
      ? new Date(nowValue)
      : null;
  const usableNow = now !== null && !Number.isNaN(now.getTime()) ? now : null;
  if (usableNow !== null) {
    const diff = usableNow.getTime() - then.getTime();
    if (diff >= 0) {
      const minutes = Math.floor(diff / 60_000);
      if (minutes < 1) return 'just now';
      if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      }
      const dayDiff = utcDay(usableNow) - utcDay(then);
      if (dayDiff === 1) return 'yesterday';
      if (dayDiff > 1 && dayDiff < 7) {
        return `${dayDiff} days ago`;
      }
      if (dayDiff === 0) {
        const hours = Math.floor(diff / 3_600_000);
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      }
    }
  }
  return calendarDay(then, usableNow);
}

// The read time is a fact about the page, not a task timestamp: name the day
// and minute once, and keep the ISO value in the element's datetime attribute.
export function humanMoment(value: string | null | undefined): string {
  if (typeof value !== 'string' || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${calendarDay(date, null)}, ${hours}:${minutes}`;
}

export interface DetailSections {
  // Ruling 4: the task's own words, split into plain paragraphs. No markdown
  // is interpreted; a blank line is the only paragraph boundary.
  body: BodyContent;
  // Ruling 5: the pinned contract's conditions in plain language. `unread`
  // means no read verb printed the contract, which is not the same as a
  // contract that pins nothing.
  conditions: ConditionsContent;
  // Ruling 6: attempt count, how the last one ended, and any note the engine
  // recorded. Plain sentences; the raw enums stay behind More.
  history: string[];
  // Ruling 7: where a conversation lives, or that this task has none.
  conversation: string;
  // The first screen: what it is, its state in human words, what it waits for
  // by title, what is doing it, and when it last changed.
  primary: DetailField[];
  // Everything machine-shaped, behind the panel's More disclosure.
  more: DetailField[];
  // The plain sentence that replaces a column of `not reported` rows.
  notes: string[];
}

export interface BodyContent {
  state: 'ok' | 'empty' | 'unread' | 'not-read';
  paragraphs: string[];
}

export interface ConditionsContent {
  state: 'ok' | 'empty' | 'unread';
  lines: string[];
}

// A blank line separates paragraphs; a single newline does not. Nothing else
// is syntax on this surface.
export function bodyParagraphs(text: string | null): string[] {
  if (text === null) {
    return [];
  }
  return text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

export function bodyContent(row: TreeRow): BodyContent {
  if (!row.body_read) {
    return { state: 'not-read', paragraphs: [] };
  }
  if (row.body === null) {
    return { state: 'unread', paragraphs: [] };
  }
  const paragraphs = bodyParagraphs(row.body);
  return paragraphs.length === 0
    ? { state: 'empty', paragraphs: [] }
    : { state: 'ok', paragraphs };
}

// One condition, one sentence a reader can act on. An unknown kind is named as
// undescribable rather than hidden.
export function conditionText(condition: ContractCondition): string {
  switch (condition.kind) {
    case 'check':
      return condition.name === null
        ? 'A recorded check passes'
        : `A check passes: ${condition.name}`;
    case 'verdict':
      return 'A person approves it';
    case 'answer': {
      let line =
        condition.field === null
          ? 'An answer is recorded'
          : `An answer is recorded for ${condition.field}`;
      const equals = condition.equals;
      if (
        equals !== undefined &&
        equals !== null &&
        typeof equals !== 'object'
      ) {
        line += ` (${String(equals)})`;
      }
      return line;
    }
    case 'child':
      return condition.settle === 'all_terminal'
        ? 'All of its child tasks have finished'
        : 'All of its child tasks are done';
    case 'evidence':
      return condition.evidence_kind === null
        ? 'Evidence is attached'
        : `Evidence is attached: ${condition.evidence_kind}`;
    default:
      return `A condition this page cannot describe (${condition.kind})`;
  }
}

export function conditionsContent(row: TreeRow): ConditionsContent {
  if (!row.conditions_read) {
    return { state: 'unread', lines: [] };
  }
  if (row.conditions.length === 0) {
    return { state: 'empty', lines: [] };
  }
  return { state: 'ok', lines: row.conditions.map(conditionText) };
}

// Counts in words on the first screen: "Attempted twice" reads, "2 attempts"
// is a metric.
function attemptCount(count: number): string {
  if (count === 1) return 'Attempted once.';
  if (count === 2) return 'Attempted twice.';
  return `Attempted ${count} times.`;
}

export function historyLines(row: TreeRow): string[] {
  if (row.status_missing) {
    return ['No attempt history came back for this task.'];
  }
  if (row.attempts.length === 0) {
    return ['Not attempted yet.'];
  }
  const lines: string[] = [attemptCount(row.attempts.length)];
  const last = row.attempts[row.attempts.length - 1];
  switch (last.end_reason) {
    case 'ok':
      lines.push('The last attempt ended well.');
      break;
    case 'failed':
      lines.push('The last attempt failed.');
      break;
    case 'skipped':
      lines.push('The last attempt was skipped.');
      break;
    case 'cancelled':
      lines.push('The last attempt was cancelled.');
      break;
    case 'launch_refused':
      lines.push('The last attempt could not start.');
      break;
    case null:
      lines.push('How the last attempt ended was not recorded.');
      break;
    default:
      // The enum itself is a machine word; More prints it. The first screen
      // says only that a reason exists.
      lines.push('The last attempt ended for a recorded reason.');
  }
  if (last.end_evidence !== null) {
    lines.push(`The engine recorded: ${last.end_evidence}.`);
  }
  if (last.outcome !== null && last.outcome !== last.end_reason) {
    lines.push(`Its recorded verdict was ${last.outcome}.`);
  }
  if (last.attested_by !== null) {
    lines.push(`The last attempt was attested by ${last.attested_by}.`);
  }
  if (last.approved_by !== null) {
    lines.push(`It was approved by ${last.approved_by}.`);
  }
  return lines;
}

// Ruling 7: the engine has no comment store. The panel says where a
// conversation does live, or that none is linked, and offers no box that would
// go nowhere.
export function conversationStatement(row: TreeRow): string {
  if (row.mirror !== null) {
    return `The conversation lives on the issue mirror: ${row.mirror}. The engine itself keeps no comments.`;
  }
  return 'Comments and discussions live on the issue mirror, not in the engine. This task has no conversation linked to it.';
}

// A value the read actually carried. An opaque member (a number where the
// engine promised a string) is not printed as if it were readable.
function readable(value: unknown): string {
  return typeof value === 'string' && value !== '' ? value : '';
}

// The panel is not a field dump. It leads with the useful facts and keeps ids,
// keys, machine state names, slot numbers and raw wait payloads behind More.
export function detailSections(
  row: TreeRow,
  model: TreeModel,
): DetailSections {
  const rows = byId(model);
  const now = model.provenance.read_at;
  // The state is already the dot and word under the panel title. Repeating it
  // as a field would make the first screen say the same thing twice.
  const primary: DetailField[] = [];
  if (row.children.length > 0) {
    primary.push({ label: 'Inside', value: containedText(containment(row)) });
  }
  // Both edge kinds are dependencies the reader recognizes by title. The raw
  // ids stay out of the first screen; the full edge list is not repeated.
  if (row.blocked_by.length > 0) {
    primary.push({
      label: 'Waiting for',
      value: joinWords(blockerLabels(row, rows)),
    });
  }
  if (row.after.length > 0) {
    primary.push({
      label: 'Starts after',
      value: joinWords(row.after.map((ref) => refLabel(ref, rows))),
    });
  }
  const active = row.phase !== null && ACTIVE_PHASES.has(row.phase);
  if (active) {
    primary.push({ label: 'Doing it', value: 'A worker is on it' });
  } else if (row.attempts.length > 0) {
    primary.push({ label: 'Doing it', value: 'No worker is on it' });
  }
  if (row.updated_at !== null) {
    primary.push({
      label: 'Last change',
      value: humanTime(row.updated_at, now),
      title: row.updated_at,
    });
  }
  const waitOpened = row.wait === null ? '' : readable(row.wait.opened_at);
  if (waitOpened) {
    primary.push({
      label: 'Waiting since',
      value: humanTime(waitOpened, now),
      title: waitOpened,
    });
  }

  const limit = row.slot_limit ?? model.slot_limit;
  const more: DetailField[] = [
    { label: 'Task id', value: row.task_id, mono: true },
    { label: 'Node key', value: row.node_key, mono: true },
    { label: 'Engine state', value: row.rest_state, mono: true },
  ];
  if (row.phase !== null) {
    more.push({ label: 'Phase', value: row.phase, mono: true });
  }
  if (row.slot !== null) {
    more.push({
      label: 'Slot',
      value:
        limit === null ? String(row.slot) : `${row.slot} of ${limit}`,
      mono: true,
    });
  }
  if (row.runner_id !== null) {
    more.push({
      label: 'Runner',
      value: `${row.runner_id}${
        row.runner_slot === null ? '' : ` (slot ${row.runner_slot})`
      }`,
      mono: true,
    });
  }
  // Inside More the exact machine value is the point, so the ISO string is
  // printed as it came rather than formatted a second time.
  if (row.created_at !== null) {
    more.push({ label: 'Created', value: row.created_at, mono: true });
  }
  if (row.updated_at !== null) {
    more.push({ label: 'Updated', value: row.updated_at, mono: true });
  }
  if (row.archived_at !== null) {
    more.push({ label: 'Archived', value: row.archived_at, mono: true });
  }
  if (row.attempts.length > 0) {
    const last = row.attempts[row.attempts.length - 1];
    more.push({
      label: 'Attempts',
      value: `${row.attempts.length} ${
        row.attempts.length === 1 ? 'run' : 'runs'
      }${last === undefined ? '' : `; last ${last.end_reason ?? last.outcome ?? 'ended'}`}`,
    });
    if (last?.attempt_id) {
      more.push({ label: 'Attempt id', value: last.attempt_id, mono: true });
    }
    if (last?.ordinal !== null && last?.ordinal !== undefined) {
      more.push({
        label: 'Attempt number',
        value: String(last.ordinal),
        mono: true,
      });
    }
    if (last?.end_evidence) {
      more.push({
        label: 'End evidence',
        value: last.end_evidence,
        mono: true,
      });
    }
    if (last?.outcome) {
      more.push({ label: 'Outcome', value: last.outcome, mono: true });
    }
    if (last?.principal) {
      more.push({ label: 'Principal', value: last.principal, mono: true });
    }
    if (last?.attested_by) {
      more.push({
        label: 'Attested by',
        value: last.attested_by,
        mono: true,
      });
    }
    if (last?.approved_by) {
      more.push({
        label: 'Approved by',
        value: last.approved_by,
        mono: true,
      });
    }
  }
  const wait = row.wait;
  let waitOpenedRaw = '';
  if (wait !== null) {
    const reason = readable(wait.reason);
    const cause = readable(wait.cause);
    const owner = readable(wait.owner);
    waitOpenedRaw = readable(wait.opened_at);
    if (reason) {
      more.push({ label: 'Wait reason', value: reason, mono: true });
    }
    if (cause) {
      more.push({ label: 'Wait cause', value: cause, mono: true });
    }
    if (owner) {
      more.push({ label: 'Wait owner', value: owner, mono: true });
    }
    if (waitOpenedRaw) {
      more.push({ label: 'Wait opened', value: waitOpenedRaw, mono: true });
    }
  }

  const notes: string[] = [];
  if (row.status_missing) {
    notes.push('No status row came back for this task.');
  }
  if (wait !== null) {
    const missing: string[] = [];
    if (!readable(wait.reason)) missing.push('a reason');
    if (!readable(wait.cause)) missing.push('a cause');
    if (!readable(wait.owner)) missing.push('an owner');
    if (!waitOpenedRaw) missing.push('when it started');
    if (missing.length > 0) {
      notes.push(
        `The engine did not report ${joinWords(missing)} for this wait.`,
      );
    }
  }
  return {
    body: bodyContent(row),
    conditions: conditionsContent(row),
    history: historyLines(row),
    conversation: conversationStatement(row),
    primary,
    more,
    notes,
  };
}

// Kept for callers that need one flat list; the page uses the two sections.
export function detailFields(row: TreeRow, model: TreeModel): DetailField[] {
  const sections = detailSections(row, model);
  return [...sections.primary, ...sections.more];
}

// ---------------------------------------------------------------- pieces

function progressBlock(model: TreeModel): string {
  const p = progress(model.roots);
  const pct = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
  const text = progressText(p);
  const line =
    p.total === 0
      ? text
      : text.replace(
          `${p.done} of ${p.total}`,
          `<strong>${p.done} of ${p.total}</strong>`,
        );
  return `<section class="progress" aria-label="Whole tree progress">
    <p class="progress-line">${line}</p>
    <span class="progress-track" role="progressbar" aria-label="Done share" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}"><span class="progress-fill pct-${pct}"></span></span>
  </section>`;
}

function topBar(view: BoardView, defaultKey: string | null): string {
  const boardHref = `${viewFile('board')}${scopeHref('board', defaultKey)}`;
  const listHref = `${viewFile('list')}${scopeHref('list', defaultKey)}`;
  // Ruling 2: the word at the top left is the way home on every view. It is a
  // link to the root scope even when the page is already there, so the control
  // never depends on where the reader happens to be.
  const homeHref = `${viewFile('board')}${scopeHref('board', null)}`;
  return `<header class="top">
    <a class="brand" href="${homeHref}" data-home-link="board">Engine board</a>
    <nav class="views" aria-label="View">
      <a class="view${view === 'board' ? ' is-on' : ''}" href="${boardHref}" data-view-link="board"${
        view === 'board' ? ' aria-current="page"' : ''
      }>Board</a>
      <a class="view${view === 'list' ? ' is-on' : ''}" href="${listHref}" data-view-link="list"${
        view === 'list' ? ' aria-current="page"' : ''
      }>List</a>
    </nav>
  </header>`;
}

function defectBlock(model: TreeModel): string {
  if (model.defects.length === 0 && model.unplaced === 0) {
    return '';
  }
  const items = model.defects
    .map((defect) => {
      const keys = defect.keys.map((key) => `<span class="mono">${esc(key)}</span>`).join(', ');
      if (defect.kind === 'duplicate') {
        return `<li data-kind="duplicate"><span class="defect-kind">Duplicate rows</span>: ${
          defect.tasks === 1 ? '1 task id was' : `${defect.tasks} task ids were`
        } read twice; the first read of each was kept (${keys}).</li>`;
      }
      if (defect.kind === 'cycle') {
        return `<li data-kind="cycle"><span class="defect-kind">Parent cycle</span>: ${plural(
          defect.tasks,
          'task',
        )} could not be placed (${keys}).</li>`;
      }
      if (defect.kind === 'unreachable') {
        return `<li data-kind="unreachable"><span class="defect-kind">Disconnected</span>: ${plural(
          defect.tasks,
          'task',
        )} below a cycle could not be placed (${keys}).</li>`;
      }
      return `<li data-kind="rerooted"><span class="defect-kind">Re-rooted</span>: ${plural(
        defect.keys.length,
        'task',
      )} with a parent outside this read ${defect.keys.length === 1 ? 'is' : 'are'} shown at the top (${keys}).</li>`;
    })
    .join('');
  const unplaced =
    model.unplaced > 0
      ? `<p class="defect-line">${plural(
          model.unplaced,
          'task',
        )} in this read could not be placed; the count above covers placed rows only.</p>`
      : '';
  return `<section class="defects" aria-label="Read defects">
    <h2>Read defects</h2>
    <ul>${items}</ul>
    ${unplaced}
  </section>`;
}

function provenanceBlock(model: TreeModel): string {
  const provenance = model.provenance;
  const label = sourceLabel(provenance);
  const known = label !== 'Unknown source';
  const read = known ? humanMoment(provenance.read_at) : '';
  const commands =
    provenance.operations.length > 0
      ? provenance.operations
          .map((operation) => `<span class="mono">${esc(operation)}</span>`)
          .join(', ')
      : '';
  const portOnly =
    provenance.port_only_steps.length > 0
      ? `<p>Fixture steps: ${provenance.port_only_steps
          .map((step) => `<span class="mono">${esc(step)}</span>`)
          .join(', ')}</p>`
      : '';
  const unobserved =
    provenance.unobserved_states.length > 0
      ? `<p>Not reached in this read: ${provenance.unobserved_states
          .map((state) => esc(stateWord(state).toLowerCase()))
          .join(', ')}.</p>`
      : '';
  return `<footer class="foot">
  <details class="provenance">
    <summary>Where this page came from</summary>
    <p>${esc(label)}${
      read
        ? ` on <time datetime="${esc(provenance.read_at)}">${esc(read)}</time>`
        : ''
    }.</p>
    ${
      known
        ? `<p>Engine <span class="mono">${esc(
            provenance.engine_commit,
          )}</span>, schema ${provenance.schema_revision}.</p>`
        : ''
    }
    ${commands ? `<p>Read with: ${commands}</p>` : ''}
    ${portOnly}
    ${unobserved}
  </details>
</footer>`;
}

// The facts list, as markup. It is written with concatenation and carries its
// own escaping because the page embeds this function's source: the dialog is
// built on click from the inline JSON block instead of shipping one inert
// `<dialog>` per task. The tests call this function directly, so the labels in
// the dialog are the labels `detailFields` returns.
export function sheetFieldsHtml(fields: readonly DetailField[]): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  const escape = (value: unknown): string =>
    typeof value === 'string'
      ? value.replace(/[&<>"']/g, (character) => entities[character] ?? character)
      : '';
  return fields
    .map(
      (field) =>
        '<div class="fact"><dt>' +
        escape(field.label) +
        '</dt><dd' +
        (field.mono ? ' class="mono"' : '') +
        (field.title ? ' title="' + escape(field.title) + '"' : '') +
        '>' +
        escape(field.value) +
        '</dd></div>',
    )
    .join('');
}

export interface BoardScopeData {
  // Only the lanes that hold a task, in LANE_ORDER; an `unknown` lane is last.
  lanes: { lane: string; tasks: string[] }[];
  // Vocabulary lanes that hold nothing, stated once under the level.
  empty: number;
  // Ruling 3: the read's own edges whose two ends are both drawn in this
  // level. Boundary edges are absent; the card keeps its sentence.
  edges: LevelEdge[];
  // The row that owns this scope, for its own `Details` control. null for the
  // tree's top scope, which no task owns.
  details: { dialog: string; task: string } | null;
}

export interface BoardRowData {
  dialog: string;
  // Rulings 4-7: the reading half of the panel. Each is computed once so the
  // page and the tests read the same words.
  body: BodyContent;
  conditions: ConditionsContent;
  history: string[];
  conversation: string;
  // The first screen and the folded rest, computed once so the page and the
  // tests read the same split.
  primary: DetailField[];
  more: DetailField[];
  notes: string[];
  wait: unknown;
  hold: unknown;
  // The same phrase the panel's Inside field prints, so the card's counts
  // button and the panel cannot disagree. Present only for a row that has
  // children, because only a container draws the line.
  contained?: string;
  // True when the payload carried no title; the page then says so instead of
  // passing the node key off as one. Absent means the title was read.
  title_missing?: boolean;
}

export interface BoardData {
  tree_state: string;
  scopes: Record<string, BoardScopeData>;
  rows: Record<string, BoardRowData>;
}

// Everything the inline script needs to draw a scope or a dialog, as data. No
// scope is pre-rendered and no dialog is pre-built, so the page carries one
// tree and one JSON block whatever the tree size.
export function boardData(model: TreeModel): BoardData {
  const scopes: Record<string, BoardScopeData> = {};
  const rows: Record<string, BoardRowData> = {};
  const record = (
    key: string,
    children: readonly TreeRow[],
    owner: TreeRow | null,
  ): void => {
    const plan = lanePlan(children);
    scopes[key] = {
      lanes: plan.lanes.map((lane) => ({
        lane: lane.lane,
        tasks: lane.cards.map((card) => card.task_id),
      })),
      empty: plan.empty,
      edges: levelEdges(children),
      details:
        owner === null
          ? null
          : { dialog: dialogId(owner), task: owner.task_id },
    };
  };
  record('', model.roots, null);
  for (const row of flattenTree(model.roots)) {
    const sections = detailSections(row, model);
    const data: BoardRowData = {
      dialog: dialogId(row),
      body: sections.body,
      conditions: sections.conditions,
      history: sections.history,
      conversation: sections.conversation,
      primary: sections.primary,
      more: sections.more,
      notes: sections.notes,
      wait: row.wait,
      hold: row.hold,
    };
    // Only the exceptional values take bytes in the page: a row with no
    // children draws no counts line, and a title that was read needs no flag.
    if (row.children.length > 0) {
      data.contained = containedText(containment(row));
    }
    if (row.title === null) {
      data.title_missing = true;
    }
    rows[row.task_id] = data;
    record(row.node_key, row.children, row);
  }
  return {
    tree_state: model.tree_state,
    scopes,
    rows,
  };
}

// ---------------------------------------------------------------- pages

function defaultKeyOf(model: TreeModel): string | null {
  return model.roots.length === 1 ? model.roots[0].node_key : null;
}

// Ruling 2: a person with three tabs open can tell them apart. The static title
// names the default scope; the inline script rewrites it as the hash changes.
function pageTitleOf(
  model: TreeModel,
  view: BoardView,
  defaultKey: string | null,
): string {
  const word = view === 'list' ? 'Engine board — everything' : 'Engine board';
  const row = findRowByKey(model.roots, defaultKey);
  return row === null ? word : `${titleOf(row)} · ${word}`;
}

function containedText(contained: {
  inside: number;
  done: number;
  archived: number;
}): string {
  // A container whose live work is empty and whose archived work is not should
  // lead with the fact that matters; otherwise the reader sees two zeroes and
  // stops before the only non-zero number.
  if (contained.inside === 0 && contained.done === 0 && contained.archived > 0) {
    return `${contained.archived} archived inside · no live work`;
  }
  return (
    `${contained.inside} inside · ${contained.done} done` +
    (contained.archived > 0 ? ` · ${contained.archived} archived` : '')
  );
}

function listRow(row: TreeRow, rows: ReadonlyMap<string, TreeRow>): string {
  const contained = containment(row);
  const counts = containedText(contained);
  const hasChildren = row.children.length > 0;
  const blockers = blockerLabels(row, rows);
  const wait =
    row.rest_state === 'blocked' && blockers.length > 0
      ? `<p class="card-wait">Waiting for ${esc(joinWords(blockers))}</p>`
      : '';
  const defectRow = engineDisagreement(row, rows);
  const disagreement =
    defectRow === null
      ? ''
      : `<p class="card-defect"><span class="defect-kind">Engine defect</span>: recorded ready, but ${esc(
          titleOf(defectRow),
        )} is ${esc(stateWord(defectRow.rest_state).toLowerCase())}.</p>`;
  const missing =
    row.status_missing
      ? '<p class="card-defect">No status row came back for this task.</p>'
      : '';
  const mismatch =
    row.rest_state_mismatch
      ? '<p class="card-defect">The graph and the status read disagree on this task\'s state.</p>'
      : '';
  const unknown = row.rest_state_known
    ? ''
    : '<p class="card-defect">The engine reported a state this page does not know.</p>';
  const archived =
    row.archived_at === null
      ? ''
      : '<span class="archived-tag">Archived</span>';
  return `<li data-task="${esc(row.task_id)}" data-parent="${esc(
    row.parent_task_id ?? '',
  )}" data-key="${esc(row.node_key)}" data-state="${esc(
    row.rest_state,
  )}" data-phase="${esc(row.phase ?? '')}" data-title="${esc(titleOf(row))}" data-title-missing="${
    row.title === null ? '1' : '0'
  }" data-inside="${contained.inside}" data-done="${contained.done}" data-archived="${
    contained.archived
  }" data-archived-self="${row.archived_at === null ? '0' : '1'}" data-has-children="${
    hasChildren ? '1' : '0'
  }" data-dialog="${esc(dialogId(row))}"${
    row.depth === 0 ? ' data-root="1"' : ''
  }>
    <div class="node-row${hasChildren ? '' : ' is-leaf'}" data-state="${esc(
      row.rest_state,
    )}">
      <div class="node-main">
        <button class="enter" type="button" data-dialog="${esc(dialogId(row))}">${titleHtml(
          row,
        )}</button>
        ${hasChildren
          ? `<button type="button" class="row-count" data-dialog="${esc(
              dialogId(row),
            )}" data-task="${esc(row.task_id)}" aria-label="Facts for ${esc(
              titleOf(row),
            )}, ${esc(counts)}">${esc(counts)}</button>`
          : ''}
        ${wait}
        ${disagreement}
        ${missing}
        ${mismatch}
        ${unknown}
      </div>
      <span class="row-state" data-lane="${esc(
        laneOf(row.rest_state, row.phase),
      )}">${archived}<span class="here-tag" data-here="${esc(
        row.node_key,
      )}" hidden>Here</span><span class="dot" aria-hidden="true"></span>${esc(
        laneWord(laneOf(row.rest_state, row.phase)),
      )}</span>
    </div>
    ${
      hasChildren
        ? `<ul class="children">${row.children
            .map((child) => listRow(child, rows))
            .join('')}</ul>`
        : ''
    }
  </li>`;
}

// The list body is the page's no-JS floor and the data source the board's
// inline script projects into lanes. Everything a card needs is an attribute or
// a child of the row, so the script never asks the network for anything.
function listBody(model: TreeModel): string {
  const p = progress(model.roots);
  const rows = byId(model);
  const levels = model.max_depth + 1;
  return `<header class="list-head">
    <div>
      <h1>Everything, unfolded</h1>
      <p class="list-bar"><strong>Showing everything</strong><span>·</span><span>${plural(
        p.total,
        'task',
      )}, ${plural(levels, 'level')}</span><span>·</span><span>${progressText(p)}</span></p>
    </div>
  </header>
  <ul class="tree">${model.roots
    .map((row) => listRow(row, rows))
    .join('')}</ul>`;
}

const CSS = `
:root {
  --paper: #ffffff;
  --surface: #ffffff;
  --ink: #17211c;
  --muted: #4d5a53;
  --faint: #68756e;
  --line: #e3e8e4;
  --line-strong: #c8d2cb;
  --accent: #176b4d;
  --accent-soft: #e8f2ed;
  --warning: #7a4a00;
  --warning-soft: #fbf3e6;
  --sans: -apple-system, "Segoe UI", "Helvetica Neue", system-ui, sans-serif;
  --serif: "Iowan Old Style", "Source Serif 4", Georgia, serif;
  --mono: "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
}
[data-lane="not-started"], [data-state="draft"] { --state: var(--faint); }
[data-lane="can-start"], [data-state="ready"] { --state: var(--accent); }
[data-lane="in-progress"] { --state: var(--accent); }
[data-lane="waiting-for-someone"], [data-state="waiting"] { --state: var(--warning); }
[data-lane="waiting-for-other-work"], [data-state="blocked"] { --state: var(--warning); }
[data-lane="needs-attention"], [data-state="failed"] { --state: var(--warning); }
[data-lane="done"], [data-state="done"] { --state: var(--ink); }
[data-lane="set-aside"], [data-state="cancelled"], [data-state="skipped"] { --state: var(--faint); }
[data-lane="unknown"], [data-state="unknown"] { --state: var(--faint); }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { background: var(--paper); }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.55 var(--sans);
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, p, ul, dl, dd, figure { margin: 0; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* The page is its own stacking context. Some engines paint the text of an
   element that has no stacking context above later overlays; naming the page
   as one layer keeps the sheet above everything it covers. */
.page {
  position: relative; z-index: 0; isolation: isolate;
  max-width: 78rem; margin: 0 auto; padding: 30px 28px 56px;
}
.top {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px 18px; flex-wrap: wrap; margin-bottom: 24px;
}
.brand {
  font-family: var(--serif); font-size: 1.02rem; color: var(--muted);
  text-decoration: none; padding-bottom: 1px;
  border-bottom: 1px solid var(--line-strong);
}
.brand:hover, .brand:focus-visible {
  color: var(--accent); border-color: currentColor;
}
.views {
  display: inline-flex; gap: 2px; padding: 3px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--surface);
}
.views a {
  padding: 5px 12px; border-radius: 999px; color: var(--muted);
  font-size: 0.8rem; text-decoration: none; white-space: nowrap;
}
.views a.is-on { background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.progress { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
.progress-line {
  color: var(--muted); font-size: 0.85rem;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.progress-line strong { color: var(--ink); font-weight: 700; }
.progress-track {
  flex: 1 1 8rem; height: 4px; border-radius: 999px;
  background: var(--line); overflow: hidden;
}
.progress-fill { display: block; height: 100%; border-radius: 999px; background: var(--accent); }
.crumbs {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px;
  min-width: 0; margin: 0 0 10px; font-size: 0.95rem; color: var(--muted);
}
.crumbs ol {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px;
  list-style: none; margin: 0; padding: 0;
}
.crumbs li { display: inline-flex; align-items: center; gap: 8px; }
.crumbs a {
  color: var(--accent); text-decoration: underline;
  text-decoration-thickness: 1px; text-underline-offset: 0.18em;
  padding: 2px 0;
}
.crumbs a:hover, .crumbs a:focus-visible { color: var(--ink); }
.crumbs .sep { color: var(--faint); }
.crumbs [aria-current="page"] { color: var(--ink); font-weight: 400; }
.scope-view { padding-top: 22px; }
.scope-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 14px 24px; flex-wrap: wrap; margin-top: 8px;
  padding-bottom: 20px; border-bottom: 1px solid var(--line);
}
.scope-main h1 {
  font-family: var(--serif); font-weight: 400;
  font-size: clamp(1.7rem, 3.4vw, 2.3rem); line-height: 1.08;
  letter-spacing: -0.015em; overflow-wrap: anywhere;
}
.scope-state {
  display: inline-flex; align-items: center; gap: 7px;
  margin-top: 8px; color: var(--muted); font-size: 0.9rem;
}
.scope-side { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; }
.chip {
  display: inline-flex; align-items: center; padding: 3px 10px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--surface);
  color: var(--muted); font-size: 0.78rem;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.details {
  padding: 3px 0; border: 0; border-bottom: 1px solid var(--line-strong);
  background: none; color: var(--muted); font: inherit; font-size: 0.8rem; cursor: pointer;
}
.details:hover, .details:focus-visible { color: var(--accent); border-color: currentColor; }
.dot {
  width: 8px; height: 8px; border-radius: 50%; flex: none;
  display: inline-block; background: var(--state, var(--faint));
}
[data-lane="not-started"] .dot, [data-state="draft"] .dot {
  background: transparent; border: 1.5px solid var(--faint);
}
.level {
  margin: 20px 0 12px; color: var(--muted); font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.level strong { color: var(--ink); font-weight: 700; }
.focus-line {
  margin: 0 0 16px; color: var(--muted); font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.lanes { position: relative; display: flex; align-items: flex-start; gap: 18px; }
.edge-layer {
  position: absolute; left: 0; top: 0; z-index: 0;
  pointer-events: none; overflow: visible;
}
.edge-layer path {
  fill: none; stroke: var(--line-strong); stroke-width: 1.6;
}
.edge-layer path[data-kind="after"] { stroke-dasharray: 4 4; }
.edge-layer path[data-kind="blocked_by"] { stroke: #9aa9a0; }
.lane { position: relative; z-index: 1; flex: 1 1 0; min-width: 0; }
.lane-head {
  display: flex; align-items: center; gap: 7px; padding-bottom: 8px;
  border-bottom: 1px solid var(--line); font-size: 0.86rem; font-weight: 700; line-height: 1.3;
}
.lane-name { min-width: 0; }
.lane-count {
  margin-left: auto; color: var(--faint); font-size: 0.78rem;
  font-weight: 400; font-variant-numeric: tabular-nums;
}
.lane-cards { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; }
.card {
  padding: 12px 13px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 1px 2px rgba(23, 33, 28, 0.04);
}
.card-title { font-size: 0.94rem; font-weight: 700; line-height: 1.32; }
.card-title .enter {
  display: inline; padding: 0; border: 0; background: none; color: inherit;
  font: inherit; text-align: left; text-decoration: none;
  overflow-wrap: anywhere; cursor: pointer;
}
.card-title .enter:hover, .card-title .enter:focus-visible {
  color: var(--accent); text-decoration: underline; text-underline-offset: 0.16em;
}
.card-state {
  display: none; align-items: center; gap: 6px; margin-top: 5px;
  color: var(--muted); font-size: 0.78rem;
}
.card-count {
  margin-top: 5px; color: var(--faint); font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
.card .row-count { width: 100%; white-space: normal; }
.card-wait {
  margin-top: 5px; color: var(--muted); font-size: 0.76rem;
  line-height: 1.4; overflow-wrap: anywhere;
}
.card-defect {
  margin-top: 7px; padding: 5px 8px; border-left: 2px solid var(--warning);
  background: var(--warning-soft); color: var(--warning);
  font-size: 0.75rem; line-height: 1.4;
}
.title-missing {
  color: var(--faint); font-size: 0.72rem; font-weight: 400;
  white-space: nowrap;
}
.archived-tag {
  display: inline-flex; padding: 0 6px; border: 1px dashed var(--line-strong);
  border-radius: 999px; color: var(--muted); font-size: 0.66rem;
  vertical-align: 1px; white-space: nowrap;
}
.card-archived {
  margin-top: 5px; color: var(--faint); font-size: 0.72rem;
}
.defect-kind { font-weight: 700; }
.defects {
  margin: 22px 0 0; padding: 12px 14px; border-left: 3px solid var(--warning);
  background: var(--warning-soft); color: var(--warning);
}
.defects h2 { font-size: 0.8rem; letter-spacing: 0.02em; text-transform: uppercase; }
.defects ul { margin: 6px 0 0; padding-left: 1.1rem; font-size: 0.8rem; line-height: 1.5; }
.defect-line { margin-top: 6px; font-size: 0.8rem; }
.tree { margin-top: 6px; }
.tree ul { list-style: none; margin: 0; padding: 0; }
.tree li { list-style: none; }
.node-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; }
.node-main { flex: 1 1 auto; min-width: 0; }
.node-main .enter {
  display: block; width: 100%;
  padding: 0; border: 0; background: none; color: inherit; font: inherit;
  font-size: 1rem; font-weight: 700; line-height: 1.35; text-align: left;
  text-decoration: none; overflow-wrap: anywhere; cursor: pointer;
}
.node-main .enter:hover, .node-main .enter:focus-visible {
  color: var(--accent); text-decoration: underline; text-underline-offset: 0.16em;
}
.node-row.is-leaf .enter { font-weight: 400; font-size: 0.96rem; }
.here-tag {
  display: inline-flex; padding: 1px 7px;
  border: 1px solid currentColor; border-radius: 999px; color: var(--accent);
  font-size: 0.68rem; font-weight: 400; vertical-align: 2px; white-space: nowrap;
}
.row-count {
  display: block; margin-top: 3px; padding: 0; border: 0; background: none;
  color: var(--muted); font: inherit;
  font-size: 0.78rem; font-variant-numeric: tabular-nums; text-align: left;
  white-space: nowrap; cursor: pointer;
}
.row-count:hover, .row-count:focus-visible {
  color: var(--accent); text-decoration: underline; text-underline-offset: 0.16em;
}
.row-state {
  display: inline-flex; align-items: center; gap: 7px; flex: none;
  margin-top: 3px; color: var(--muted); font-size: 0.84rem; white-space: nowrap;
}
.tree ul.children { margin-left: 6px; padding-left: 22px; border-left: 1px solid var(--line); }
.list-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px 18px; flex-wrap: wrap; margin-top: 22px; padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.list-head h1 {
  font-family: var(--serif); font-weight: 400;
  font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1.1;
}
.list-bar {
  display: flex; align-items: baseline; gap: 8px 14px; flex-wrap: wrap;
  margin-top: 6px; color: var(--muted); font-size: 0.84rem;
}
.list-bar strong { color: var(--ink); font-weight: 700; }
.foot {
  margin-top: 48px; padding-top: 14px; border-top: 1px solid var(--line);
  color: var(--muted); font-size: 0.76rem; line-height: 1.6;
}
.provenance summary {
  cursor: pointer; color: var(--muted); font-size: 0.78rem;
}
.provenance summary:hover, .provenance summary:focus-visible {
  color: var(--accent);
}
.provenance[open] summary { margin-bottom: 8px; }
.provenance p { margin: 3px 0; }
.foot .mono, .defect-line .mono { font-family: var(--mono); }
/* The dimming layer is an element, not a backdrop pseudo-element: not every
   engine paints that pseudo-element, and a missing backdrop leaves the sheet
   floating on an undimmed page. The dialog sits in the top layer, above this. */
.scrim {
  position: fixed; inset: 0; z-index: 10;
  background: rgba(12, 18, 15, 0.45);
}
.sheet {
  position: fixed;
  top: 4vh; bottom: auto; left: 0; right: 0;
  z-index: 20;
  margin: 0 auto;
  display: flex; flex-direction: column;
  width: min(34rem, calc(100vw - 2rem));
  max-height: 92vh;
  padding: 0; border: 1px solid var(--line-strong); border-radius: 14px;
  background: var(--surface); color: var(--ink);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}
.sheet:not([open]) { display: none; }
.sheet::backdrop { background: transparent; }
.sheet-inner {
  flex: 1 1 auto; min-height: 0; max-height: 92vh; overflow: auto;
  background: var(--surface); border-radius: inherit; padding: 20px 22px 24px;
}
.sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.sheet-head h2 {
  font-family: var(--serif); font-weight: 400; font-size: 1.35rem;
  line-height: 1.2; overflow-wrap: anywhere;
}
.sheet-close {
  flex: none; padding: 3px 0; border: 0; border-bottom: 1px solid var(--line-strong);
  background: none; color: var(--muted); font: inherit; font-size: 0.8rem; cursor: pointer;
}
.sheet-close:hover, .sheet-close:focus-visible { color: var(--accent); border-color: currentColor; }
.sheet-state {
  display: flex; align-items: center; gap: 7px; margin-top: 8px;
  color: var(--muted); font-size: 0.86rem;
}
.sheet-state .mono { font-family: var(--mono); font-size: 0.78rem; }
.sheet-section { margin-top: 18px; }
.sheet-section h3 {
  margin: 0 0 6px; color: var(--muted); font-size: 0.72rem;
  font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
}
.sheet-description { margin-top: 16px; }
.sheet-description .sheet-paragraph {
  margin: 0 0 0.7em; color: var(--ink); font-size: 0.95rem; line-height: 1.6;
}
.sheet-description .sheet-paragraph:last-child { margin-bottom: 0; }
.sheet-empty { color: var(--muted); font-size: 0.9rem; }
.sheet-muted { color: var(--muted); font-size: 0.84rem; line-height: 1.5; }
.sheet-list { margin: 0; padding-left: 1.15rem; }
.sheet-list li {
  margin: 0 0 0.35em; color: var(--ink); font-size: 0.9rem; line-height: 1.5;
}
.sheet-history p {
  margin: 0 0 0.35em; color: var(--ink); font-size: 0.86rem; line-height: 1.5;
}
.sheet-history p:last-child { margin-bottom: 0; }
.facts { display: grid; gap: 0; margin-top: 14px; border-top: 1px solid var(--line); }
.facts-primary .fact { padding: 8px 0; font-size: 0.84rem; }
.sheet-note {
  margin-top: 10px; color: var(--muted); font-size: 0.82rem;
}
.sheet-more {
  margin-top: 16px; padding-top: 10px; border-top: 1px solid var(--line);
}
.sheet-more summary {
  cursor: pointer; color: var(--muted); font-size: 0.82rem;
}
.sheet-more summary:hover, .sheet-more summary:focus-visible {
  color: var(--accent);
}
.sheet-more[open] summary { margin-bottom: 6px; }
.fact {
  display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line);
  font-size: 0.8rem; line-height: 1.45;
}
.fact dt { flex: 0 0 7rem; color: var(--muted); }
.fact dd { flex: 1 1 0; min-width: 0; margin: 0; overflow-wrap: anywhere; }
.fact .mono { font-family: var(--mono); font-size: 0.76rem; }
.raw { margin-top: 18px; }
.raw h3 {
  margin: 14px 0 6px; color: var(--muted); font-size: 0.72rem;
  font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
}
.raw pre {
  margin: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--paper); color: var(--ink); font-family: var(--mono);
  font-size: 0.72rem; line-height: 1.5; overflow-x: auto;
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.sheet-source { margin-top: 18px; color: var(--faint); font-size: 0.72rem; line-height: 1.5; }
@media (max-width: 900px) {
  .lanes { flex-wrap: wrap; }
  .lane { flex: 1 1 46%; }
}
@media (max-width: 640px) {
  .page { padding: 20px 18px 44px; }
  .top { margin-bottom: 18px; }
  .scope-head { align-items: flex-start; }
  .scope-side { width: 100%; }
  .crumbs { font-size: 0.92rem; }
  .edge-layer { display: none; }
  .lanes { display: block; }
  .lane { margin-bottom: 6px; }
  .lane-head { display: none; }
  .card-state { display: flex; }
  .node-row { flex-wrap: wrap; }
  .row-state { flex: 0 0 100%; margin-left: 0; margin-top: 2px; }
  .fact dt { flex-basis: 6rem; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`;

// No-JS floor: every scope section is visible until script marks the document.
// The media queries and the `js` rules are the only things that hide a section,
// and the first is the one script adds.
const SCRIPT = `(function () {
  var FILES = { board: 'index.html', list: 'list.html' };
  var LANES = ${JSON.stringify(LANE_ORDER)};
  var LANE_WORDS = ${JSON.stringify(LANE_WORDS)};
  // A page whose data block is missing or unreadable must not quietly draw an
  // empty board: it keeps the no-JS tree and says why the interactive view
  // could not start.
  var DATA = null;
  var FAILED = '';
  var node = document.getElementById('board-data');
  if (!node) {
    FAILED = 'the data block is missing';
  } else {
    try {
      DATA = JSON.parse(node.textContent || '');
    } catch (error) {
      FAILED = 'the data block could not be read';
    }
  }
  if (!FAILED && (!DATA || typeof DATA !== 'object' || Array.isArray(DATA))) {
    FAILED = 'the data block is not a tree read';
  }
  var ROWS = (DATA && DATA.rows) || {};
  var SCOPES = (DATA && DATA.scopes) || {};

  ${laneGroups.toString()}

  ${laneOf.toString()}

  ${sheetFieldsHtml.toString()}

  function current() {
    var raw = location.hash.replace(/^#/, '');
    var parts = raw.split('/');
    var view = parts[0] === 'board' || parts[0] === 'list' ? parts[0] : null;
    var rest = parts.slice(1).filter(function (part) { return part !== ''; });
    var key = null;
    if (rest.length > 0) {
      try {
        key = rest.map(decodeURIComponent).join('/');
      } catch (error) {
        key = null;
      }
    }
    return { view: view, key: key };
  }

  function encodeKey(key) {
    if (!key) return '';
    return '/' + key.split('/').map(encodeURIComponent).join('/');
  }

  function treeRows() {
    var source = document.getElementById('tree-source') || document;
    return Array.prototype.slice.call(
      source.querySelectorAll('li[data-task]'),
    );
  }

  function scopeNode(key) {
    if (!key) return null;
    var rows = treeRows();
    for (var index = 0; index < rows.length; index += 1) {
      if (rows[index].getAttribute('data-key') === key) return rows[index];
    }
    return null;
  }

  function rowsByTask() {
    var map = {};
    treeRows().forEach(function (row) {
      map[row.getAttribute('data-task')] = row;
    });
    return map;
  }

  function childrenOf(scope, rows) {
    if (scope === null) {
      return rows.filter(function (row) {
        return row.getAttribute('data-root') === '1';
      });
    }
    var id = scope.getAttribute('data-task');
    return rows.filter(function (row) {
      return row.getAttribute('data-parent') === id;
    });
  }

  function titleOf(row) {
    return row.getAttribute('data-title') || row.getAttribute('data-key');
  }

  function appendTitle(parent, row) {
    parent.appendChild(document.createTextNode(titleOf(row)));
    var data = ROWS[row.getAttribute('data-task')];
    if (data && data.title_missing) {
      parent.appendChild(document.createTextNode(' '));
      var mark = document.createElement('span');
      mark.className = 'title-missing';
      mark.textContent = 'title not read';
      parent.appendChild(mark);
    }
  }

  function laneWord(lane) {
    return LANE_WORDS[lane] || LANE_WORDS.unknown;
  }

  function stateLine(lane, className, text) {
    var line = document.createElement('p');
    line.className = className;
    line.setAttribute('data-lane', lane);
    var dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    line.appendChild(dot);
    line.appendChild(document.createTextNode(text || laneWord(lane)));
    return line;
  }

  function separator() {
    var sep = document.createElement('span');
    sep.className = 'sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '›';
    return sep;
  }

  function crumbs(scope, byTask) {
    // Ruling 1: a nav with its own name, directly above the level title. The
    // ancestors are links; the current level is the last crumb in normal
    // weight. The trail includes the current level so a reader who lands deep
    // sees the whole path in one line.
    var nav = document.createElement('nav');
    nav.className = 'crumbs';
    nav.setAttribute('aria-label', 'Breadcrumb');
    var list = document.createElement('ol');
    function entry() {
      var item = document.createElement('li');
      list.appendChild(item);
      return item;
    }
    function current(text) {
      var item = entry();
      var mark = document.createElement('span');
      mark.setAttribute('aria-current', 'page');
      mark.textContent = text;
      item.appendChild(mark);
    }
    function link(text, key) {
      var item = entry();
      item.appendChild(separator());
      var anchor = document.createElement('a');
      anchor.href = '#board' + encodeKey(key);
      anchor.textContent = text;
      item.appendChild(anchor);
    }
    if (scope === null) {
      current('All work');
    } else {
      var home = entry();
      var homeLink = document.createElement('a');
      homeLink.href = '#board';
      homeLink.textContent = 'All work';
      home.appendChild(homeLink);
      var chain = [];
      var parent = scope.getAttribute('data-parent');
      while (parent && byTask[parent]) {
        var ancestor = byTask[parent];
        chain.unshift(ancestor);
        parent = ancestor.getAttribute('data-parent');
      }
      chain.forEach(function (row) {
        link(titleOf(row), row.getAttribute('data-key'));
      });
      var here = entry();
      here.appendChild(separator());
      var mark = document.createElement('span');
      mark.setAttribute('aria-current', 'page');
      appendTitle(mark, scope);
      here.appendChild(mark);
    }
    nav.appendChild(list);
    return nav;
  }

  function header(scope, cards) {
    var head = document.createElement('header');
    head.className = 'scope-head';
    var main = document.createElement('div');
    main.className = 'scope-main';
    var heading = document.createElement('h1');
    if (scope === null) {
      heading.textContent = 'All work';
    } else {
      appendTitle(heading, scope);
    }
    main.appendChild(heading);
    if (scope !== null) {
      main.appendChild(
        stateLine(
          laneOf(
            scope.getAttribute('data-state'),
            scope.getAttribute('data-phase') || null,
          ),
          'scope-state',
        ),
      );
    }
    head.appendChild(main);

    var side = document.createElement('div');
    side.className = 'scope-side';
    if (scope !== null) {
      var scopeKey = scope.getAttribute('data-key');
      var scopePlan = SCOPES[scopeKey];
      var owner = scopePlan && scopePlan.details;
      var ownerData = owner ? ROWS[owner.task] : null;
      if (ownerData && ownerData.contained) {
        var chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = ownerData.contained;
        side.appendChild(chip);
      }
      if (owner) {
        var details = document.createElement('button');
        details.type = 'button';
        details.className = 'details';
        details.setAttribute('data-dialog', owner.dialog);
        details.setAttribute('data-task', owner.task);
        details.textContent = 'Details';
        side.appendChild(details);
      }
    }
    if (DATA.tree_state === 'archived') {
      var archivedChip = document.createElement('span');
      archivedChip.className = 'chip archived-chip';
      archivedChip.textContent = 'Archived';
      side.appendChild(archivedChip);
    }
    head.appendChild(side);
    return head;
  }

  function level(cards, plan) {
    var line = document.createElement('p');
    line.className = 'level';
    if (cards.length === 0) {
      line.textContent = 'No subtasks. Nothing sits under this task.';
      return line;
    }
    var archived = 0;
    cards.forEach(function (card) {
      if (card.getAttribute('data-archived-self') === '1') archived += 1;
    });
    var live = cards.length - archived;
    var strong = document.createElement('strong');
    strong.textContent = String(live);
    line.appendChild(strong);
    line.appendChild(
      document.createTextNode(
        ' live' +
          (archived > 0 ? ' · ' + archived + ' archived' : '') +
          ' in this level' +
          (plan.empty > 0 ? ' · ' + plan.empty + ' lanes empty' : ''),
      ),
    );
    return line;
  }

  ${focusCounts.toString()}

  // The answer to "where do I start", in counts and in the lanes' own words.
  // A running task is not also "ready to start", so the three counts never
  // double-count a row. The wording reuses the lane vocabulary instead of
  // naming a state the page does not have.
  function focusLine(cards) {
    var counts = focusCounts(cards.map(function (row) {
      return {
        rest_state: row.getAttribute('data-state'),
        phase: row.getAttribute('data-phase') || null,
      };
    }));
    var line = document.createElement('p');
    line.className = 'focus-line';
    line.setAttribute('data-can-start', String(counts.canStart));
    line.setAttribute('data-in-progress', String(counts.inProgress));
    line.setAttribute('data-waiting', String(counts.waiting));
    // Three clauses, in the order a reader can act on them. A zero clause is
    // omitted rather than printed as "0 waiting".
    var parts = [];
    if (counts.canStart > 0) parts.push(counts.canStart + ' can start');
    if (counts.inProgress > 0) parts.push(counts.inProgress + ' in progress');
    if (counts.waiting > 0) parts.push(counts.waiting + ' waiting');
    line.textContent = parts.join(' · ');
    return line;
  }

  function cardFor(row) {
    var state = row.getAttribute('data-state');
    var lane = laneOf(state, row.getAttribute('data-phase') || null);
    var card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-task', row.getAttribute('data-task'));
    card.setAttribute('data-state', state);
    card.setAttribute('data-lane', lane);
    card.setAttribute('data-phase', row.getAttribute('data-phase') || '');

    var title = document.createElement('h3');
    title.className = 'card-title';
    var enter;
    if (row.getAttribute('data-has-children') === '1') {
      enter = document.createElement('a');
      enter.href = '#board' + encodeKey(row.getAttribute('data-key'));
    } else {
      enter = document.createElement('button');
      enter.type = 'button';
      enter.setAttribute('data-dialog', row.getAttribute('data-dialog'));
      enter.setAttribute('data-task', row.getAttribute('data-task'));
    }
    enter.className = 'enter';
    appendTitle(enter, row);
    title.appendChild(enter);
    card.appendChild(title);

    // The lane already names the state at wide widths; at phone width the lane
    // head is gone, so the card carries the lane word itself.
    card.appendChild(stateLine(lane, 'card-state'));
    // Only this row's own facts. A descendant's counts or wait line belongs to
    // the descendant's card, not this container's.
    var ownRow = row.firstElementChild;
    var ownMain = ownRow ? ownRow.querySelector('.node-main') : null;
    var parts = ownMain
      ? Array.prototype.filter.call(ownMain.children, function (part) {
          return (
            part.classList.contains('row-count') ||
            part.classList.contains('card-wait') ||
            part.classList.contains('card-defect')
          );
        })
      : [];
    Array.prototype.forEach.call(parts, function (part) {
      card.appendChild(part.cloneNode(true));
    });
    if (row.getAttribute('data-archived-self') === '1') {
      var archived = document.createElement('p');
      archived.className = 'card-archived';
      archived.textContent = 'Archived';
      card.appendChild(archived);
    }
    return card;
  }

  function lanesNode(plan, byTask) {
    var wrap = document.createElement('div');
    wrap.className = 'lanes';
    plan.lanes.forEach(function (group) {
      var rows = group.tasks
        .map(function (id) { return byTask[id]; })
        .filter(function (row) { return !!row; });
      if (rows.length === 0) return;
      var section = document.createElement('section');
      section.className = 'lane';
      section.setAttribute('data-lane', group.lane);
      section.setAttribute('aria-label', laneWord(group.lane));
      var head = document.createElement('h2');
      head.className = 'lane-head';
      head.setAttribute('data-lane', group.lane);
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.setAttribute('aria-hidden', 'true');
      head.appendChild(dot);
      var name = document.createElement('span');
      name.className = 'lane-name';
      name.textContent = laneWord(group.lane);
      head.appendChild(name);
      var count = document.createElement('span');
      count.className = 'lane-count';
      count.textContent = String(rows.length);
      head.appendChild(count);
      section.appendChild(head);
      var body = document.createElement('div');
      body.className = 'lane-cards';
      rows.forEach(function (row) {
        body.appendChild(cardFor(row));
      });
      section.appendChild(body);
      wrap.appendChild(section);
    });
    return wrap;
  }

  // Ruling 3: only an edge whose two ends are cards in this level is drawn.
  // The line starts at the blocker and ends at the blocked card; it does not
  // care which lanes they sit in. At phone width the lines are dropped and the
  // card's own sentence carries the dependency.
  function drawEdges(wrap, plan) {
    var old = wrap.querySelector('.edge-layer');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!plan || !plan.edges || plan.edges.length === 0) return;
    if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) return;
    var cards = {};
    Array.prototype.forEach.call(wrap.querySelectorAll('.card[data-task]'), function (card) {
      cards[card.getAttribute('data-task')] = card;
    });
    var box = wrap.getBoundingClientRect();
    var width = wrap.offsetWidth;
    var height = wrap.offsetHeight;
    if (width === 0 || height === 0) return;
    // One task may block six others. Spreading the attachment points along the
    // card edges keeps those six lines readable instead of collapsing into a
    // single bundle that reads as a border.
    var outCount = {};
    var inCount = {};
    plan.edges.forEach(function (edge) {
      outCount[edge.from] = (outCount[edge.from] || 0) + 1;
      inCount[edge.to] = (inCount[edge.to] || 0) + 1;
    });
    var outSeen = {};
    var inSeen = {};
    function port(top, bottom, slot, count) {
      if (count <= 1) return (top + bottom) / 2;
      var low = top + (bottom - top) * 0.22;
      var high = bottom - (bottom - top) * 0.22;
      return low + ((high - low) * (slot + 1)) / (count + 1);
    }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'edge-layer');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    var drawn = 0;
    plan.edges.forEach(function (edge) {
      var from = cards[edge.from];
      var to = cards[edge.to];
      if (!from || !to) return;
      var a = from.getBoundingClientRect();
      var b = to.getBoundingClientRect();
      var aLeft = a.left - box.left;
      var aRight = a.right - box.left;
      var aTop = a.top - box.top;
      var aBottom = a.bottom - box.top;
      var bLeft = b.left - box.left;
      var bRight = b.right - box.left;
      var bTop = b.top - box.top;
      var bBottom = b.bottom - box.top;
      outSeen[edge.from] = outSeen[edge.from] || 0;
      inSeen[edge.to] = inSeen[edge.to] || 0;
      var outSlot = outSeen[edge.from];
      var inSlot = inSeen[edge.to];
      outSeen[edge.from] += 1;
      inSeen[edge.to] += 1;
      var x1, y1, x2, y2, c1x, c1y, c2x, c2y, gap;
      if (bLeft >= aRight - 4) {
        // The blocked card is to the right: leave the blocker's right edge
        // and arrive at the blocked card's left edge.
        x1 = aRight;
        y1 = port(aTop, aBottom, outSlot, outCount[edge.from]);
        x2 = bLeft;
        y2 = port(bTop, bBottom, inSlot, inCount[edge.to]);
        gap = Math.max(16, Math.min(80, (x2 - x1) / 2));
        c1x = x1 + gap; c1y = y1;
        c2x = x2 - gap; c2y = y2;
      } else if (bTop >= aBottom - 4) {
        // Same column or to the left and below: go down from the blocker and
        // into the top of the blocked card.
        x1 = port(aLeft, aRight, outSlot, outCount[edge.from]);
        y1 = aBottom;
        x2 = port(bLeft, bRight, inSlot, inCount[edge.to]);
        y2 = bTop;
        gap = Math.max(14, Math.min(60, (y2 - y1) / 2));
        c1x = x1; c1y = y1 + gap;
        c2x = x2; c2y = y2 - gap;
      } else if (aTop >= bBottom - 4) {
        x1 = port(aLeft, aRight, outSlot, outCount[edge.from]);
        y1 = aTop;
        x2 = port(bLeft, bRight, inSlot, inCount[edge.to]);
        y2 = bBottom;
        gap = Math.max(14, Math.min(60, (y1 - y2) / 2));
        c1x = x1; c1y = y1 - gap;
        c2x = x2; c2y = y2 + gap;
      } else {
        x1 = port(aLeft, aRight, outSlot, outCount[edge.from]);
        y1 = port(aTop, aBottom, outSlot, outCount[edge.from]);
        x2 = port(bLeft, bRight, inSlot, inCount[edge.to]);
        y2 = port(bTop, bBottom, inSlot, inCount[edge.to]);
        c1x = x1; c1y = y1; c2x = x2; c2y = y2;
      }
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute(
        'd',
        'M ' + x1 + ' ' + y1 + ' C ' + c1x + ' ' + c1y + ', ' +
          c2x + ' ' + c2y + ', ' + x2 + ' ' + y2,
      );
      path.setAttribute('data-kind', edge.kind);
      path.setAttribute('data-from', edge.from);
      path.setAttribute('data-to', edge.to);
      svg.appendChild(path);
      drawn += 1;
    });
    if (drawn > 0) wrap.insertBefore(svg, wrap.firstChild);
  }

  function refreshEdges() {
    var root = document.getElementById('board-root');
    if (!root) return;
    var lanes = root.querySelector('.lanes');
    if (!lanes) return;
    drawEdges(lanes, SCOPES[root.getAttribute('data-scope') || '']);
  }

  var edgeTimer = null;
  window.addEventListener('resize', function () {
    if (edgeTimer) clearTimeout(edgeTimer);
    edgeTimer = setTimeout(refreshEdges, 120);
  });

  function setDocumentTitle(scope) {
    var page = document.body.getAttribute('data-page');
    var suffix = page === 'list' ? 'Engine board — everything' : 'Engine board';
    var name = scope === null ? 'All work' : titleOf(scope);
    document.title = name + ' · ' + suffix;
  }

  function renderScope(key) {
    var root = document.getElementById('board-root');
    if (!root || !document.getElementById('tree-source')) return;
    var wanted = key === null || key === undefined ? root.getAttribute('data-default') || null : key;
    var scope = wanted === null ? null : scopeNode(wanted);
    if (wanted !== null && scope === null) {
      var fallback = root.getAttribute('data-default') || null;
      scope = fallback === null ? null : scopeNode(fallback);
    }
    var scopeKey = scope === null ? '' : scope.getAttribute('data-key');
    var plan = SCOPES[scopeKey] || { lanes: [], empty: LANES.length, edges: [] };
    var rows = treeRows();
    var cards = childrenOf(scope, rows);
    var byTask = rowsByTask();
    root.textContent = '';
    if (scope !== null) root.appendChild(crumbs(scope, byTask));
    root.appendChild(header(scope, cards));
    root.appendChild(level(cards, plan));
    root.appendChild(focusLine(cards));
    if (cards.length > 0) {
      var lanes = lanesNode(plan, byTask);
      root.appendChild(lanes);
      drawEdges(lanes, plan);
    }
    root.setAttribute('data-scope', scopeKey);
    setDocumentTitle(scope);
  }

  function markHere(key) {
    var tags = document.querySelectorAll('.here-tag');
    Array.prototype.forEach.call(tags, function (tag) {
      tag.hidden = tag.getAttribute('data-here') !== (key || '');
    });
  }

  function syncViews(key) {
    var links = document.querySelectorAll('[data-view-link]');
    Array.prototype.forEach.call(links, function (link) {
      var view = link.getAttribute('data-view-link');
      link.setAttribute('href', FILES[view] + '#' + view + encodeKey(key));
    });
  }

  // Same weight as a read defect, not a red banner: the page has no colour
  // language for an apology. Removing the js class is what brings the no-JS
  // tree back, so the reader keeps every row and every count.
  function fail(why) {
    document.documentElement.classList.remove('js');
    var line = document.getElementById('board-failure');
    if (!line) return;
    line.textContent =
      'The interactive board could not start: ' + why +
      '. The full list is shown instead.';
    line.hidden = false;
  }

  function showScrim() {
    var scrim = document.getElementById('scrim');
    if (scrim) scrim.hidden = false;
  }

  function hideScrim() {
    var scrim = document.getElementById('scrim');
    if (scrim) scrim.hidden = true;
  }

  function rawSection(inner, data) {
    var parts = [];
    if (data.wait !== null && data.wait !== undefined) parts.push(['Raw wait', data.wait]);
    if (data.hold !== null && data.hold !== undefined) parts.push(['Raw hold', data.hold]);
    if (parts.length === 0) return;
    var section = document.createElement('section');
    section.className = 'raw';
    parts.forEach(function (part) {
      var heading = document.createElement('h3');
      heading.textContent = part[0];
      var pre = document.createElement('pre');
      pre.textContent = JSON.stringify(part[1], null, 2);
      section.appendChild(heading);
      section.appendChild(pre);
    });
    inner.appendChild(section);
  }

  function closeSheet(sheet) {
    if (typeof sheet.close === 'function') {
      sheet.close();
    } else {
      hideScrim();
      sheet.remove();
    }
  }

  function wireSheet(sheet) {
    sheet.addEventListener('close', function () {
      hideScrim();
      sheet.remove();
    });
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet) closeSheet(sheet);
    });
    sheet.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet(sheet);
        return;
      }
      if (event.key !== 'Tab') return;
      var items = Array.prototype.filter.call(
        sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        function (item) { return !item.disabled; },
      );
      if (items.length === 0) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    var close = sheet.querySelector('.sheet-close');
    if (close) {
      close.addEventListener('click', function () {
        closeSheet(sheet);
      });
    }
  }

  function sectionNode(title, className) {
    var section = document.createElement('section');
    section.className = 'sheet-section ' + className;
    var heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  function textNode(className, text) {
    var node = document.createElement('p');
    node.className = className;
    node.textContent = text;
    return node;
  }

  // Ruling 4: the body is the reader's words, as paragraphs. No markdown is
  // interpreted, and empty is a sentence rather than white space.
  function appendDescription(inner, data) {
    var body = data.body || { state: 'empty', paragraphs: [] };
    var section = sectionNode('Description', 'sheet-description');
    if (body.state === 'ok') {
      body.paragraphs.forEach(function (text) {
        section.appendChild(textNode('sheet-paragraph', text));
      });
    } else if (body.state === 'empty') {
      section.appendChild(textNode('sheet-empty', 'No description yet'));
    } else if (body.state === 'unread') {
      section.appendChild(
        textNode('sheet-muted', 'The description could not be read.'),
      );
    } else {
      section.appendChild(
        textNode(
          'sheet-muted',
          "The description was not read through this engine's read commands.",
        ),
      );
    }
    inner.appendChild(section);
  }

  // Ruling 5: the pinned contract in plain language, or the honest statement
  // that this read cannot see it.
  function appendConditions(inner, data) {
    var conditions = data.conditions || { state: 'unread', lines: [] };
    var section = sectionNode('Done when', 'sheet-conditions');
    if (conditions.state === 'ok') {
      var list = document.createElement('ul');
      list.className = 'sheet-list';
      conditions.lines.forEach(function (line) {
        var item = document.createElement('li');
        item.textContent = line;
        list.appendChild(item);
      });
      section.appendChild(list);
    } else if (conditions.state === 'empty') {
      section.appendChild(
        textNode('sheet-muted', "This task's contract pins no conditions."),
      );
    } else {
      section.appendChild(
        textNode(
          'sheet-muted',
          "The pinned contract is not readable through this engine's read commands.",
        ),
      );
    }
    inner.appendChild(section);
  }

  // Ruling 6: what has happened, in sentences. The raw enums stay behind More.
  function appendHistory(inner, data) {
    var section = sectionNode('What has happened', 'sheet-history');
    (data.history || []).forEach(function (line) {
      section.appendChild(textNode('sheet-history-line', line));
    });
    inner.appendChild(section);
  }

  // Ruling 7: where a conversation lives, or that none is linked. No box.
  function appendConversation(inner, data) {
    var section = sectionNode('Conversation', 'sheet-conversation');
    section.appendChild(
      textNode('sheet-muted', data.conversation || ''),
    );
    inner.appendChild(section);
  }

  function buildSheet(taskId) {
    var data = ROWS[taskId];
    if (!data) return null;
    var row = rowsByTask()[taskId];
    var id = data.dialog;
    var sheet = document.createElement('dialog');
    sheet.className = 'sheet';
    sheet.id = id;
    sheet.setAttribute('aria-labelledby', 't-' + id);

    var inner = document.createElement('div');
    inner.className = 'sheet-inner';
    var head = document.createElement('header');
    head.className = 'sheet-head';
    var title = document.createElement('h2');
    title.id = 't-' + id;
    if (row) appendTitle(title, row);
    else title.textContent = taskId;
    head.appendChild(title);
    var close = document.createElement('button');
    close.className = 'sheet-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close details');
    close.textContent = 'Close';
    head.appendChild(close);
    inner.appendChild(head);

    if (row) {
      inner.appendChild(
        stateLine(
          laneOf(
            row.getAttribute('data-state'),
            row.getAttribute('data-phase') || null,
          ),
          'sheet-state',
        ),
      );
    }
    appendDescription(inner, data);
    appendConditions(inner, data);
    var facts = document.createElement('dl');
    facts.className = 'facts facts-primary';
    facts.innerHTML = sheetFieldsHtml(data.primary || []);
    inner.appendChild(facts);
    (data.notes || []).forEach(function (text) {
      var note = document.createElement('p');
      note.className = 'sheet-note';
      note.textContent = text;
      inner.appendChild(note);
    });
    appendHistory(inner, data);
    appendConversation(inner, data);
    var hasMore =
      (data.more && data.more.length > 0) ||
      (data.wait !== null && data.wait !== undefined) ||
      (data.hold !== null && data.hold !== undefined);
    if (hasMore) {
      var more = document.createElement('details');
      more.className = 'sheet-more';
      var summary = document.createElement('summary');
      summary.textContent = 'More';
      more.appendChild(summary);
      var moreFacts = document.createElement('dl');
      moreFacts.className = 'facts';
      moreFacts.innerHTML = sheetFieldsHtml(data.more || []);
      more.appendChild(moreFacts);
      rawSection(more, data);
      inner.appendChild(more);
    }
    sheet.appendChild(inner);
    wireSheet(sheet);
    return sheet;
  }

  function openSheet(taskId) {
    var data = ROWS[taskId];
    if (!data) return;
    var sheet = document.getElementById(data.dialog);
    if (!sheet) {
      sheet = buildSheet(taskId);
    }
    if (!sheet) return;
    if (!sheet.parentNode) document.body.appendChild(sheet);
    showScrim();
    if (typeof sheet.showModal === 'function') {
      sheet.showModal();
    } else {
      sheet.setAttribute('open', '');
    }
    var close = sheet.querySelector('.sheet-close');
    if (close) close.focus();
  }

  document.addEventListener('click', function (event) {
    var trigger =
      event.target && event.target.closest
        ? event.target.closest('[data-dialog]')
        : null;
    if (!trigger) return;
    var taskId = trigger.getAttribute('data-task');
    if (!taskId) {
      var host = trigger.closest('li[data-task]');
      taskId = host ? host.getAttribute('data-task') : null;
    }
    if (taskId) openSheet(taskId);
  });

  function apply() {
    var here = current();
    renderScope(here.key);
    // The List has no board root; it still follows the scope in its title.
    if (!document.getElementById('board-root')) {
      setDocumentTitle(here.key === null ? null : scopeNode(here.key));
    }
    markHere(here.key);
    syncViews(here.key);
  }

  var boardRoot = document.getElementById('board-root');
  var stopped = FAILED;
  if (boardRoot && !stopped && !document.getElementById('tree-source')) {
    stopped = 'the tree it draws from is missing';
  }
  if (boardRoot && stopped) {
    fail(stopped);
  } else {
    window.addEventListener('hashchange', apply);
    apply();
  }
})();`;

function shell(
  model: TreeModel,
  options: {
    view: BoardView;
    pageTitle: string;
    body: string;
    defaultKey: string | null;
  },
): string {
  const { done, total } = progress(model.roots);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(options.pageTitle)}</title>
<style>${CSS}
.pct-${pct} { width: ${pct}%; }
.board-scope { display: none; }
.nojs-tree { display: block; }
html.js .board-scope { display: block; }
html.js .nojs-tree { display: none; }
.board-failure { margin: 14px 0 0; font-size: 0.8rem; color: var(--muted); }
</style>
<script>document.documentElement.classList.add('js');</script>
</head>
<body data-page="${options.view}">
<main class="page">
  ${topBar(options.view, options.defaultKey)}
  ${progressBlock(model)}
  ${defectBlock(model)}
  <p class="board-failure" id="board-failure" hidden></p>
  ${options.body}
  ${provenanceBlock(model)}
</main>
<div class="scrim" id="scrim" hidden></div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

export function renderBoardPage(model: TreeModel): string {
  const defaultKey = defaultKeyOf(model);
  const data = JSON.stringify(boardData(model)).replace(/</g, '\\u003c');
  const body = `<div class="board-scope" id="board-root" data-default="${esc(
    defaultKey ?? '',
  )}" data-tree-state="${esc(model.tree_state)}"></div>
  <div class="nojs-tree" id="tree-source">${listBody(model)}</div>
  <script type="application/json" id="board-data">${data}</script>`;
  return shell(model, {
    view: 'board',
    pageTitle: pageTitleOf(model, 'board', defaultKey),
    body,
    defaultKey,
  });
}

export function renderListPage(model: TreeModel): string {
  const defaultKey = defaultKeyOf(model);
  const data = JSON.stringify(boardData(model)).replace(/</g, '\\u003c');
  const body = `${listBody(model)}
  <script type="application/json" id="board-data">${data}</script>`;
  return shell(model, {
    view: 'list',
    pageTitle: pageTitleOf(model, 'list', defaultKey),
    body,
    defaultKey,
  });
}
