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

export function sourceLine(provenance: ReadProvenance | null | undefined): string {
  const label = sourceLabel(provenance);
  if (label === 'Unknown source' || !provenance) {
    return label;
  }
  return `${label} · read at ${provenance.read_at} · task-engine@${provenance.engine_commit} · schema ${provenance.schema_revision}`;
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
}

const NOT_REPORTED = 'not reported';

// The technical surface: every machine word the read carries, and nothing the
// default page says twice.
export function detailFields(row: TreeRow, model: TreeModel): DetailField[] {
  const rows = byId(model);
  const contained = containment(row);
  const inside = containedText(contained);
  const limit = row.slot_limit ?? model.slot_limit;
  const slot =
    row.slot === null
      ? 'none'
      : limit !== null
        ? `${row.slot} of ${limit}`
        : `${row.slot} (limit not read)`;
  const runner =
    row.runner_id === null
      ? row.runner_id_reported
        ? 'none'
        : NOT_REPORTED
      : `${row.runner_id}${
          row.runner_slot === null ? '' : ` (runner slot ${row.runner_slot})`
        }`;
  const lastAttempt =
    row.attempts.length === 0 ? null : row.attempts[row.attempts.length - 1];
  const lastWord =
    lastAttempt === null
      ? 'none readable'
      : [
          lastAttempt.phase ?? 'phase not read',
          lastAttempt.end_reason ?? lastAttempt.outcome ?? null,
        ]
          .filter((part): part is string => part !== null)
          .join(', ');
  const fields: DetailField[] = [
    { label: 'State', value: `${stateWord(row.rest_state)} (${row.rest_state})` },
    { label: 'Node key', value: row.node_key, mono: true },
    { label: 'Task id', value: row.task_id, mono: true },
    { label: 'Inside', value: inside },
    { label: 'Phase', value: row.phase ?? 'none' },
    { label: 'Slot', value: slot },
    { label: 'Runner', value: runner },
    { label: 'Created', value: row.created_at ?? NOT_REPORTED },
    { label: 'Updated', value: row.updated_at ?? NOT_REPORTED },
    { label: 'Archived', value: row.archived_at ?? 'no' },
    { label: 'Attempt id', value: lastAttempt?.attempt_id ?? NOT_REPORTED, mono: true },
    { label: 'Attempts', value: `${row.attempts.length}; last ${lastWord}` },
    {
      label: 'Blocked by',
      value:
        row.blocked_by.length === 0
          ? 'nothing'
          : joinWords(blockerLabels(row, rows)),
    },
    {
      label: 'Starts after',
      value:
        row.after.length === 0
          ? 'nothing'
          : joinWords(row.after.map((ref) => refLabel(ref, rows))),
    },
  ];
  if (row.wait !== null) {
    fields.push(
      { label: 'Wait reason', value: row.wait.reason || NOT_REPORTED, mono: true },
      { label: 'Wait cause', value: row.wait.cause || NOT_REPORTED, mono: true },
      { label: 'Wait owner', value: row.wait.owner || NOT_REPORTED, mono: true },
      { label: 'Wait opened', value: row.wait.opened_at || NOT_REPORTED },
    );
  }
  return fields;
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
  fields: DetailField[];
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
  source: string;
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
    const data: BoardRowData = {
      dialog: dialogId(row),
      fields: detailFields(row, model),
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
    source: sourceLine(model.provenance),
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
        )} is ${esc(defectRow.rest_state)}.</p>`;
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
    : `<p class="card-defect">The engine reported a state this board does not know: <span class="mono">${esc(
        row.rest_state,
      )}</span>.</p>`;
  const archived =
    row.archived_at === null
      ? ''
      : '<span class="archived-tag">Archived</span>';
  return `<li data-task="${esc(row.task_id)}" data-parent="${esc(
    row.parent_task_id ?? '',
  )}" data-key="${esc(row.node_key)}" data-state="${esc(
    row.rest_state,
  )}" data-title="${esc(titleOf(row))}" data-title-missing="${
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
  --paper: #f3f5f3;
  --surface: #ffffff;
  --ink: #1b2521;
  --muted: #5c6862;
  --faint: #8a958f;
  --line: #dae1dc;
  --line-strong: #c2cdc6;
  --accent: #1f5c4a;
  --accent-soft: #e5efe9;
  --warning: #8a5200;
  --warning-soft: #f7eede;
  --sans: -apple-system, "Segoe UI", "Helvetica Neue", system-ui, sans-serif;
  --serif: "Iowan Old Style", "Source Serif 4", Georgia, serif;
  --mono: "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #111714;
    --surface: #18211c;
    --ink: #e7ede8;
    --muted: #a1ada6;
    --faint: #7d8982;
    --line: #29352f;
    --line-strong: #3a4840;
    --accent: #8acbb0;
    --accent-soft: #1c3028;
    --warning: #e2aa52;
    --warning-soft: #332616;
  }
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
  cursor: pointer;
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
  top: 1rem; bottom: 1rem; left: 0; right: 0;
  z-index: 20;
  margin: 0 auto;
  display: flex; flex-direction: column;
  width: min(34rem, calc(100vw - 2rem));
  padding: 0; border: 1px solid var(--line-strong); border-radius: 14px;
  background: var(--surface); color: var(--ink);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}
.sheet:not([open]) { display: none; }
.sheet::backdrop { background: transparent; }
.sheet-inner {
  flex: 1 1 auto; min-height: 0; overflow: auto;
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
.facts { display: grid; gap: 0; margin-top: 16px; border-top: 1px solid var(--line); }
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

  function stateLine(state, className) {
    var line = document.createElement('p');
    line.className = className;
    line.setAttribute('data-state', state);
    var dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    line.appendChild(dot);
    line.appendChild(document.createTextNode(stateWord(state)));
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

    card.appendChild(stateLine(state, 'card-state'));
    var parts = row.querySelectorAll(
      '.node-main > .row-count, .node-main > .card-wait, .node-main > .card-defect',
    );
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
    root.appendChild(crumbs(scope, byTask));
    root.appendChild(header(scope, cards));
    root.appendChild(level(cards, plan));
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
    facts.className = 'facts';
    facts.innerHTML = sheetFieldsHtml(data.fields || []);
    inner.appendChild(facts);
    rawSection(inner, data);
    var source = document.createElement('p');
    source.className = 'sheet-source';
    source.textContent = DATA.source || 'Unknown source';
    inner.appendChild(source);
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
  <footer class="foot">
    <p>${esc(sourceLine(model.provenance))}</p>
    <p>Reads: ${model.provenance.operations.map(esc).join(', ')}</p>
    <p>The board renders the engine's words. It computes no state; counts are the rollup over children.</p>
  </footer>
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
