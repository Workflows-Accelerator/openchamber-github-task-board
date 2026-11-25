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
  type TreeModel,
  type TreeRow,
} from './model.ts';
import {
  STATE_WORDS,
  containment,
  engineDisagreement,
  lanePlan,
  progress,
  type LanePlan,
  type LaneState,
} from './rollup.ts';
import { scopeHref, scopePath, type BoardView } from './scope.ts';

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

export function stateWord(state: LaneState): string {
  if (state === 'unknown') {
    return 'Unknown state';
  }
  return STATE_WORDS[state];
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
    return titleOf(row);
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
    { label: 'Inside', value: `${contained.inside} inside · ${contained.done} done` },
    { label: 'Phase', value: row.phase ?? 'none' },
    { label: 'Slot', value: slot },
    { label: 'Runner', value: runner },
    { label: 'Created', value: row.created_at ?? NOT_REPORTED },
    { label: 'Updated', value: row.updated_at ?? NOT_REPORTED },
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

function rawJson(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return JSON.stringify(value, null, 2);
}

// ---------------------------------------------------------------- pieces

function progressBlock(model: TreeModel): string {
  const { done, total } = progress(model.roots);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const line =
    total === 0
      ? 'No tasks in this tree'
      : `<strong>${done} of ${total}</strong> finished`;
  return `<section class="progress" aria-label="Progress">
    <p class="progress-line">${line}</p>
    <span class="progress-track" aria-hidden="true"><span class="progress-fill pct-${pct}"></span></span>
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

function crumbs(
  path: readonly TreeRow[],
  view: BoardView,
  topIsSection: boolean,
): string {
  if (path.length === 0) {
    return '<p class="crumbs"><span aria-current="page">All work</span></p>';
  }
  const parts: string[] = [];
  parts.push(
    topIsSection
      ? `<a href="${scopeHref(view, null)}">All work</a>`
      : '<span>All work</span>',
  );
  // The trail is the ancestors; the scope's own title is the heading below, so
  // printing it twice would only repeat the h1.
  for (const row of path.slice(0, -1)) {
    parts.push(`<a href="${scopeHref(view, row.node_key)}">${esc(titleOf(row))}</a>`);
  }
  return `<p class="crumbs">${parts.join(
    '<span class="sep" aria-hidden="true">›</span>',
  )}</p>`;
}

function defectBlock(model: TreeModel): string {
  if (model.defects.length === 0 && model.unplaced === 0) {
    return '';
  }
  const items = model.defects
    .map((defect) => {
      const keys = defect.keys.map((key) => `<span class="mono">${esc(key)}</span>`).join(', ');
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
  return `<section class="defects" aria-label="Placement defects">
    <h2>Placement defects</h2>
    <ul>${items}</ul>
    ${unplaced}
  </section>`;
}

function stateLine(row: TreeRow, className: string): string {
  return `<p class="${className}" data-state="${esc(row.rest_state)}"><span class="dot" aria-hidden="true"></span>${esc(
    stateWord(row.rest_state),
  )}</p>`;
}

function card(
  row: TreeRow,
  rows: ReadonlyMap<string, TreeRow>,
): string {
  const contained = containment(row);
  const hasChildren = row.children.length > 0;
  const title = esc(titleOf(row));
  const enter = hasChildren
    ? `<a class="enter" href="${scopeHref('board', row.node_key)}">${title}</a>`
    : `<button class="enter" type="button" data-dialog="${esc(dialogId(row))}">${title}</button>`;
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
        )} is not done.</p>`;
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
  const count = hasChildren
    ? `<p class="card-count">${contained.inside} inside · ${contained.done} done</p>`
    : '';
  return `<article class="card" data-state="${esc(row.rest_state)}">
      <h3 class="card-title">${enter}</h3>
      ${stateLine(row, 'card-state')}
      ${count}
      ${wait}
      ${disagreement}
      ${missing}
      ${mismatch}
      ${unknown}
    </article>`;
}

function lanes(plan: LanePlan, rows: ReadonlyMap<string, TreeRow>): string {
  if (plan.lanes.length === 0) {
    return '';
  }
  const parts = plan.lanes
    .map(
      (lane) => `<section class="lane" data-state="${esc(lane.state)}" aria-label="${esc(
        stateWord(lane.state),
      )}">
        <h2 class="lane-head" data-state="${esc(lane.state)}"><span class="dot" aria-hidden="true"></span><span class="lane-name">${esc(
          stateWord(lane.state),
        )}</span><span class="lane-count">${lane.cards.length}</span></h2>
        <div class="lane-cards">${lane.cards
          .map((cardRow) => card(cardRow, rows))
          .join('\n')}</div>
      </section>`,
    )
    .join('\n');
  return `<div class="lanes">${parts}</div>`;
}

function scopeBoard(
  section: {
    key: string | null;
    title: string;
    row: TreeRow | null;
    rows: TreeRow[];
    path: TreeRow[];
  },
  rows: ReadonlyMap<string, TreeRow>,
  isDefault: boolean,
  topIsSection: boolean,
): string {
  const plan = lanePlan(section.rows);
  const count = section.rows.length;
  let level: string;
  if (count === 0) {
    level =
      '<p class="level">No subtasks. Nothing sits under this task.</p>';
  } else {
    level = `<p class="level"><strong>${count}</strong> in this level${
      plan.empty > 0 ? ` · ${plan.empty} lanes empty` : ''
    }</p>`;
  }
  const header =
    section.row === null
      ? `<header class="scope-head">
      <div class="scope-main"><h1>${esc(section.title)}</h1></div>
      <div class="scope-side"><span class="chip">${plural(count, 'task')}</span></div>
    </header>`
      : `<header class="scope-head">
      <div class="scope-main">
        <h1>${esc(section.title)}</h1>
        ${stateLine(section.row, 'scope-state')}
      </div>
      <div class="scope-side">
        <span class="chip">${containment(section.row).inside} inside · ${
          containment(section.row).done
        } done</span>
        <button class="details" type="button" data-dialog="${esc(
          dialogId(section.row),
        )}">Details</button>
      </div>
    </header>`;
  return `<section class="scope-view" data-scope="${esc(section.key ?? '')}"${
    isDefault ? ' data-default="true"' : ''
  } aria-label="${esc(section.title)}">
      ${crumbs(section.path, 'board', topIsSection)}
      ${header}
      ${level}
      ${lanes(plan, rows)}
    </section>`;
}

function sheet(row: TreeRow, model: TreeModel): string {
  const fields = detailFields(row, model)
    .map(
      (field) =>
        `<div class="fact"><dt>${esc(field.label)}</dt><dd${
          field.mono ? ' class="mono"' : ''
        }>${esc(field.value)}</dd></div>`,
    )
    .join('');
  const wait = rawJson(row.wait);
  const hold = rawJson(row.hold);
  const raw =
    wait === null && hold === null
      ? ''
      : `<section class="raw">
        ${wait === null ? '' : `<h3>Raw wait</h3><pre>${esc(wait)}</pre>`}
        ${hold === null ? '' : `<h3>Raw hold</h3><pre>${esc(hold)}</pre>`}
      </section>`;
  return `<dialog class="sheet" id="${esc(dialogId(row))}" aria-labelledby="t-${esc(
    dialogId(row),
  )}">
      <div class="sheet-inner">
        <header class="sheet-head">
          <h2 id="t-${esc(dialogId(row))}">${esc(titleOf(row))}</h2>
          <button class="sheet-close" type="button" aria-label="Close details">Close</button>
        </header>
        ${stateLine(row, 'sheet-state')}
        <dl class="facts">${fields}</dl>
        ${raw}
        <p class="sheet-source">${esc(sourceLine(model.provenance))}</p>
      </div>
    </dialog>`;
}

// ---------------------------------------------------------------- pages

interface Section {
  key: string | null;
  title: string;
  row: TreeRow | null;
  rows: TreeRow[];
  path: TreeRow[];
}

function sectionsOf(model: TreeModel): { sections: Section[]; defaultKey: string | null } {
  const sections: Section[] = [];
  const treeSection: Section = {
    key: null,
    title: 'All work',
    row: null,
    rows: [...model.roots],
    path: [],
  };
  if (model.roots.length !== 1) {
    sections.push(treeSection);
  }
  for (const row of flattenTree(model.roots)) {
    sections.push({
      key: row.node_key,
      title: titleOf(row),
      row,
      rows: row.children,
      path: scopePath(model.roots, row.node_key),
    });
  }
  if (sections.length === 0) {
    sections.push(treeSection);
  }
  const defaultKey =
    model.roots.length === 1 ? model.roots[0].node_key : null;
  return { sections, defaultKey };
}

function listRow(row: TreeRow, rows: ReadonlyMap<string, TreeRow>): string {
  const contained = containment(row);
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
        )} is not done.</p>`;
  return `<li>
    <div class="node-row${hasChildren ? '' : ' is-leaf'}" data-state="${esc(
      row.rest_state,
    )}">
      <div class="node-main">
        <button class="enter" type="button" data-dialog="${esc(dialogId(row))}">${esc(
          titleOf(row),
        )}</button>
        ${hasChildren ? `<span class="row-count">${contained.inside} inside · ${contained.done} done</span>` : ''}
        ${wait}
        ${disagreement}
      </div>
      <span class="row-state"><span class="here-tag" data-here="${esc(
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
  display: block; margin-top: 3px; color: var(--muted);
  font-size: 0.78rem; font-variant-numeric: tabular-nums;
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

  function showScope(key) {
    var sections = Array.prototype.slice.call(document.querySelectorAll('.scope-view'));
    if (sections.length === 0) return;
    var fallback = null;
    var target = null;
    sections.forEach(function (section) {
      if (section.hasAttribute('data-default')) fallback = section;
      if (section.getAttribute('data-scope') === (key || '')) target = section;
    });
    target = target || fallback;
    sections.forEach(function (section) {
      section.classList.toggle('is-current', section === target);
    });
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

  function apply() {
    var here = current();
    showScope(here.key);
    markHere(here.key);
    syncViews(here.key);
  }

  function showScrim() {
    var scrim = document.getElementById('scrim');
    if (scrim) scrim.hidden = false;
  }

  function hideScrim() {
    var scrim = document.getElementById('scrim');
    if (scrim) scrim.hidden = true;
  }

  window.addEventListener('hashchange', apply);
  apply();

  Array.prototype.forEach.call(document.querySelectorAll('[data-dialog]'), function (button) {
    button.addEventListener('click', function () {
      var sheet = document.getElementById(button.getAttribute('data-dialog'));
      if (!sheet) return;
      if (typeof sheet.showModal === 'function') {
        sheet.showModal();
      } else {
        sheet.setAttribute('open', '');
      }
      showScrim();
      var close = sheet.querySelector('.sheet-close');
      if (close) close.focus();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('dialog.sheet'), function (sheet) {
    sheet.addEventListener('close', hideScrim);
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet) sheet.close();
    });
    sheet.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        sheet.close();
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
        sheet.close();
      });
    }
  });
})();`;

function shell(
  model: TreeModel,
  options: {
    view: BoardView;
    pageTitle: string;
    body: string;
    sheets: string;
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
.scope-view { display: block; }
html.js .scope-view { display: none; }
html.js .scope-view.is-current { display: block; }
</style>
<script>document.documentElement.classList.add('js');</script>
</head>
<body data-page="${options.view}">
<main class="page">
  ${topBar(options.view, options.defaultKey)}
  ${progressBlock(model)}
  ${defectBlock(model)}
  ${options.body}
  <footer class="foot">
    <p>${esc(sourceLine(model.provenance))}</p>
    <p>Reads: ${model.provenance.operations.map(esc).join(', ')}</p>
    <p>The board renders the engine's words. It computes no state; counts are the rollup over children.</p>
  </footer>
</main>
${options.sheets}
<div class="scrim" id="scrim" hidden></div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

export function renderBoardPage(model: TreeModel): string {
  const { sections, defaultKey } = sectionsOf(model);
  const rows = byId(model);
  const body = sections
    .map((section) =>
      scopeBoard(
        section,
        rows,
        section.key === defaultKey,
        model.roots.length !== 1,
      ),
    )
    .join('\n');
  const sheets = flattenTree(model.roots).map((row) => sheet(row, model)).join('\n');
  return shell(model, {
    view: 'board',
    pageTitle: 'Engine board',
    body,
    sheets,
    defaultKey,
  });
}

export function renderListPage(model: TreeModel): string {
  const { defaultKey } = sectionsOf(model);
  const { done, total } = progress(model.roots);
  const rows = byId(model);
  const levels = model.max_depth + 1;
  const body = `<header class="list-head">
    <div>
      <h1>Everything, unfolded</h1>
      <p class="list-bar"><strong>Showing everything</strong><span>·</span><span>${plural(
        total,
        'task',
      )}, ${plural(levels, 'level')}</span><span>·</span><span>${done} done</span></p>
    </div>
  </header>
  <ul class="tree">${model.roots.map((row) => listRow(row, rows)).join('')}</ul>`;
  const sheets = flattenTree(model.roots).map((row) => sheet(row, model)).join('\n');
  return shell(model, {
    view: 'list',
    pageTitle: 'Engine board — everything',
    body,
    sheets,
    defaultKey,
  });
}
