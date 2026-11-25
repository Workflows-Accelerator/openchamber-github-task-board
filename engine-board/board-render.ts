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
  type ReadProvenance,
  type RestState,
  type TreeModel,
  type TreeRow,
} from './model.ts';
import {
  LANE_ORDER,
  STATE_WORDS,
  containment,
  engineDisagreement,
  focusCounts,
  laneGroups,
  lanePlan,
  progress,
  progressText,
} from './rollup.ts';
import { scopeHref, type BoardView } from './scope.ts';

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
  // The first screen: what it is, its state in human words, what it waits for
  // by title, what is doing it, and when it last changed.
  primary: DetailField[];
  // Everything machine-shaped, behind the panel's More disclosure.
  more: DetailField[];
  // The plain sentence that replaces a column of `not reported` rows.
  notes: string[];
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
  } else if (
    row.attempts.length === 0 &&
    row.runner_id === null &&
    row.phase === null
  ) {
    notes.push('This task has no run yet.');
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
  return { primary, more, notes };
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
  return `<header class="top">
    <p class="brand">Engine board</p>
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
  lanes: { state: string; tasks: string[] }[];
  // Vocabulary lanes that hold nothing, stated once under the level.
  empty: number;
  // The row that owns this scope, for its own `Details` control. null for the
  // tree's top scope, which no task owns.
  details: { dialog: string; task: string } | null;
}

export interface BoardRowData {
  dialog: string;
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
        state: lane.state,
        tasks: lane.cards.map((card) => card.task_id),
      })),
      empty: plan.empty,
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
      <span class="row-state">${archived}<span class="here-tag" data-here="${esc(
        row.node_key,
      )}" hidden>Here</span><span class="dot" aria-hidden="true"></span>${esc(
        stateWord(row.rest_state),
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
[data-state="draft"] { --state: var(--faint); }
[data-state="ready"] { --state: var(--accent); }
[data-state="waiting"] { --state: var(--warning); }
[data-state="blocked"] { --state: var(--warning); }
[data-state="done"] { --state: var(--ink); }
[data-state="failed"] { --state: var(--warning); }
[data-state="cancelled"] { --state: var(--faint); }
[data-state="skipped"] { --state: var(--faint); }
[data-state="unknown"] { --state: var(--faint); }
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
.brand { font-family: var(--serif); font-size: 1.02rem; color: var(--muted); }
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
  min-width: 0; font-size: 0.84rem; color: var(--muted);
}
.crumbs a { text-decoration: none; border-bottom: 1px solid transparent; }
.crumbs a:hover, .crumbs a:focus-visible { color: var(--accent); border-color: currentColor; }
.crumbs .sep { color: var(--faint); }
.crumbs [aria-current="page"] { color: var(--ink); }
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
[data-state="draft"] .dot { background: transparent; border: 1.5px solid var(--faint); }
.level {
  margin: 20px 0 12px; color: var(--muted); font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.level strong { color: var(--ink); font-weight: 700; }
.focus-line {
  margin: 0 0 16px; color: var(--muted); font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
}
.lanes { display: flex; align-items: flex-start; gap: 18px; }
.lane { flex: 1 1 0; min-width: 0; }
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
/* The lane already names the state, except for the row a worker is on: that
   one says so, because the lane word would read as untouched. */
.card-state[data-running='1'] {
  display: flex; color: var(--accent); font-weight: 600;
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
  var WORDS = ${JSON.stringify(STATE_WORDS)};
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

  function topIsSection() {
    return treeRows().filter(function (row) {
      return row.getAttribute('data-root') === '1';
    }).length !== 1;
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

  function stateWord(state) {
    if (state === 'unknown') return 'Unknown state';
    return WORDS[state] || 'Unknown state';
  }

  function stateLine(state, className, text) {
    var line = document.createElement('p');
    line.className = className;
    line.setAttribute('data-state', state);
    var dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    line.appendChild(dot);
    line.appendChild(document.createTextNode(text || stateWord(state)));
    return line;
  }

  // A task a worker is on still reads ready in the engine, so its state word
  // alone would read like work nobody has picked up. The card says the plain
  // fact instead, and the header counts the same rows.
  function isRunning(row) {
    var phase = row.getAttribute('data-phase');
    return (
      phase === 'claimed' ||
      phase === 'launching' ||
      phase === 'live' ||
      phase === 'ending'
    );
  }

  function separator() {
    var sep = document.createElement('span');
    sep.className = 'sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '›';
    return sep;
  }

  function crumbs(scope, byTask) {
    var trail = document.createElement('p');
    trail.className = 'crumbs';
    if (scope === null) {
      var currentPage = document.createElement('span');
      currentPage.setAttribute('aria-current', 'page');
      currentPage.textContent = 'All work';
      trail.appendChild(currentPage);
      return trail;
    }
    if (topIsSection()) {
      var all = document.createElement('a');
      all.href = '#board';
      all.textContent = 'All work';
      trail.appendChild(all);
    } else {
      var root = document.createElement('span');
      root.textContent = 'All work';
      trail.appendChild(root);
    }
    var chain = [];
    var parent = scope.getAttribute('data-parent');
    while (parent && byTask[parent]) {
      var ancestor = byTask[parent];
      chain.unshift(ancestor);
      parent = ancestor.getAttribute('data-parent');
    }
    chain.forEach(function (row) {
      trail.appendChild(separator());
      var link = document.createElement('a');
      link.href = '#board' + encodeKey(row.getAttribute('data-key'));
      appendTitle(link, row);
      trail.appendChild(link);
    });
    return trail;
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
      main.appendChild(stateLine(scope.getAttribute('data-state'), 'scope-state'));
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
    line.textContent =
      counts.canStart + ' ' + WORDS.ready.toLowerCase() + ' · ' +
      counts.waiting + ' ' + WORDS.waiting.toLowerCase() +
      ' or ' + WORDS.blocked.toLowerCase() + ' · ' +
      counts.inProgress + ' in progress';
    return line;
  }

  function cardFor(row) {
    var state = row.getAttribute('data-state');
    var card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-state', state);

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

    var running = isRunning(row);
    var stateText = running ? 'In progress' : null;
    var stateLineEl = stateLine(state, 'card-state', stateText);
    if (running) {
      card.setAttribute('data-running', '1');
      stateLineEl.setAttribute('data-running', '1');
    }
    card.appendChild(stateLineEl);
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
    plan.lanes.forEach(function (lane) {
      var rows = lane.tasks
        .map(function (id) { return byTask[id]; })
        .filter(function (row) { return !!row; });
      // Work already moving leads the lane: it is the answer to "what is
      // happening now" and it must be visible without scrolling.
      rows = rows.slice().sort(function (a, b) {
        return (isRunning(a) ? 0 : 1) - (isRunning(b) ? 0 : 1);
      });
      if (rows.length === 0) return;
      var section = document.createElement('section');
      section.className = 'lane';
      section.setAttribute('data-state', lane.state);
      section.setAttribute('aria-label', stateWord(lane.state));
      var head = document.createElement('h2');
      head.className = 'lane-head';
      head.setAttribute('data-state', lane.state);
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.setAttribute('aria-hidden', 'true');
      head.appendChild(dot);
      var name = document.createElement('span');
      name.className = 'lane-name';
      name.textContent = stateWord(lane.state);
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
    var plan = SCOPES[scopeKey] || { lanes: [], empty: LANES.length };
    var rows = treeRows();
    var cards = childrenOf(scope, rows);
    var byTask = rowsByTask();
    root.textContent = '';
    if (scope !== null) root.appendChild(crumbs(scope, byTask));
    root.appendChild(header(scope, cards));
    root.appendChild(level(cards, plan));
    root.appendChild(focusLine(cards));
    if (cards.length > 0) root.appendChild(lanesNode(plan, byTask));
    root.setAttribute('data-scope', scopeKey);
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

    if (row) inner.appendChild(stateLine(row.getAttribute('data-state'), 'sheet-state'));
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
    pageTitle: 'Engine board',
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
    pageTitle: 'Engine board — everything',
    body,
    defaultKey,
  });
}
