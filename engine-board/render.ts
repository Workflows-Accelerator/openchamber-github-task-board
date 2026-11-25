// ==========================================
// Engine board renderer
//
// Static, read-only HTML. No script, no button, no request. The page is the
// model written out: engine words, engine order, one row per task.
//
// Everything the page says about its own limits is read from the model: the
// capabilities are derived from the payloads, and the provenance comes from the
// source. Nothing here assumes a fixture capture.
// ==========================================

import {
  REST_STATES,
  flattenTree,
  type ReadModelCapabilities,
  type RestState,
  type TreeDefect,
  type TreeEdgeRef,
  type TreeModel,
  type TreeRow,
} from './model.ts';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Null is not a string and must not throw: an engine field that arrives null is
// a missing value the page flags, not a crash in the build.
function esc(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function mono(value: string): string {
  return `<span class="mono">${esc(value)}</span>`;
}

function monoList(values: readonly string[]): string {
  return values.map(mono).join(', ');
}

function anchorId(taskId: string): string {
  return `task-${taskId}`;
}

// `wait` is opaque JSON (GAPS G9). A member that is not a non-empty string is
// reported as missing rather than crashing the page on a shape change.
function waitText(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'not reported';
}

function pair(label: string, value: string, className = ''): string {
  const name = className === '' ? 'pair' : `pair ${className}`;
  return `<span class="${name}"><span class="label">${esc(label)}</span> <span class="value">${value}</span></span>`;
}

function missingPair(label: string): string {
  return `<span class="pair missing"><span class="label">${esc(label)}</span> <span class="value">not reported</span></span>`;
}

// A present edge ref links to the row it names, so the task id is reachable by
// keyboard and not only through a hover title. A ref to a task this read could
// not place says so in text, for the same reason.
function edgeRef(ref: TreeEdgeRef, present: ReadonlySet<string>): string {
  const name = ref.node_key ?? ref.task_id;
  if (ref.node_key !== null && present.has(ref.task_id)) {
    return `<a class="ref" href="#${esc(anchorId(ref.task_id))}" title="${esc(ref.task_id)}">${esc(name)}</a>`;
  }
  if (ref.node_key === null) {
    return `<span class="ref outside" title="${esc(ref.task_id)}">${esc(name)}<span class="visually-hidden"> (outside this tree, ${esc(ref.task_id)})</span></span>`;
  }
  return `<span class="ref" title="${esc(ref.task_id)}">${esc(name)}<span class="visually-hidden"> (not placed, ${esc(ref.task_id)})</span></span>`;
}

function runtime(row: TreeRow, model: TreeModel): string {
  const parts: string[] = [];
  if (row.phase !== null) {
    parts.push(pair('phase', esc(row.phase)));
  }
  if (row.slot !== null) {
    const limit =
      model.slot_limit === null ? '' : ` of ${model.slot_limit}`;
    parts.push(pair('slot', `${row.slot}${limit}`));
    if (model.slot_limit === null) {
      parts.push(missingPair('slot limit'));
    }
  }
  if (row.runner_slot_reported) {
    parts.push(
      pair('runner_slot', row.runner_slot === null ? 'none' : String(row.runner_slot)),
    );
  } else if (row.phase !== null) {
    parts.push(missingPair('runner_slot'));
  }
  if (row.runner_id_reported) {
    parts.push(
      pair('runner_id', row.runner_id === null ? 'none' : esc(row.runner_id)),
    );
  }
  if (row.handoff_revision !== null && row.handoff_revision > 1) {
    parts.push(pair('handoff', String(row.handoff_revision)));
  }
  if (row.wait !== null) {
    parts.push(pair('wait reason', esc(waitText(row.wait.reason)), 'wait'));
    parts.push(pair('cause', esc(waitText(row.wait.cause)), 'wait'));
    parts.push(pair('owner', esc(waitText(row.wait.owner)), 'wait'));
  }
  if (row.hold !== null) {
    parts.push(pair('hold', esc(JSON.stringify(row.hold)), 'hold'));
  }
  return parts.join('');
}

function keyNotes(
  row: TreeRow,
  present: ReadonlySet<string>,
): string {
  const notes: string[] = [];
  if (row.blocked_by.length > 0) {
    notes.push(
      `<p class="edge"><span class="edge-kind">blocked_by</span> ${row.blocked_by
        .map((ref) => edgeRef(ref, present))
        .join('')}</p>`,
    );
  }
  if (row.after.length > 0) {
    notes.push(
      `<p class="edge"><span class="edge-kind">after</span> ${row.after
        .map((ref) => edgeRef(ref, present))
        .join('')}</p>`,
    );
  }
  if (row.rerooted !== null) {
    notes.push(
      `<p class="flag">re-rooted subtree, ${plural(
        row.rerooted.subtree_tasks,
        'task',
      )}, parent ${mono(row.rerooted.parent_task_id)} is outside this read</p>`,
    );
  }
  if (!row.rest_state_known) {
    notes.push('<p class="flag">unrecognized rest_state</p>');
  }
  if (row.status_missing) {
    notes.push('<p class="flag">task status row missing</p>');
  }
  if (row.rest_state_mismatch) {
    notes.push('<p class="flag">graph and status disagree on rest_state</p>');
  }
  return notes.join('');
}

function renderRow(
  row: TreeRow,
  present: ReadonlySet<string>,
  model: TreeModel,
): string {
  return `<div class="node-row" role="row" aria-level="${row.depth + 1}" data-depth="${row.depth}" id="${esc(anchorId(row.task_id))}">
  <div class="key" role="gridcell" data-depth="${row.depth}">
    <span class="node-key">${esc(row.node_key)}</span>
    <span class="task-id">${esc(row.task_id)}</span>
    ${keyNotes(row, present)}
  </div>
  <div class="state-word" role="gridcell" data-state="${esc(row.rest_state)}"><span class="dot" aria-hidden="true"></span><span class="word">${esc(row.rest_state)}</span></div>
  <div class="runtime" role="gridcell">${runtime(row, model)}</div>
</div>`;
}

function stateCounts(model: TreeModel): string {
  const unobserved = new Set(model.provenance.unobserved_states);
  return REST_STATES.map((state: RestState) => {
    const count = model.counts[state];
    const notCaptured = count === 0 && unobserved.has(state);
    return `<li class="state" data-state="${esc(state)}" data-zero="${count === 0}" data-observed="${!notCaptured}"><span class="dot" aria-hidden="true"></span><span class="word">${esc(state)}</span><span class="count">${count}</span>${
      notCaptured ? '<span class="unobserved">not captured</span>' : ''
    }</li>`;
  }).join('');
}

function runnerLine(model: TreeModel): string {
  if (!model.runners_available) {
    return '<span class="pair missing"><span class="label">runner</span> <span class="value">list not read</span></span>';
  }
  if (model.runners.length === 0) {
    return pair('runner', 'none');
  }
  return model.runners
    .map(
      (runner) =>
        `<span class="pair"><span class="label">runner</span> <span class="value">${esc(runner.kind)}</span> <span class="label">capacity</span> <span class="value">${runner.capacity}</span>${
          runner.enabled ? '' : ' <span class="flag">disabled</span>'
        }</span>`,
    )
    .join('');
}

function defectBlock(model: TreeModel): string {
  if (model.defects.length === 0) {
    return '';
  }
  const items = model.defects
    .map((defect: TreeDefect) => {
      const keys = defect.keys.map(mono).join(', ');
      if (defect.kind === 'cycle') {
        return `<li class="defect" data-kind="cycle"><span class="defect-kind">Parent cycle</span> ${plural(
          defect.tasks,
          'task',
        )} could not be placed: ${keys}</li>`;
      }
      if (defect.kind === 'unreachable') {
        return `<li class="defect" data-kind="unreachable"><span class="defect-kind">Disconnected</span> ${plural(
          defect.tasks,
          'task',
        )} below a cycle could not be placed: ${keys}</li>`;
      }
      return `<li class="defect" data-kind="rerooted"><span class="defect-kind">Re-rooted</span> ${plural(
        defect.keys.length,
        'subtree',
      )} (${plural(defect.tasks, 'task')}) with a parent outside this read, shown at depth 0: ${keys}</li>`;
    })
    .join('');
  return `<section class="defects" aria-label="Placement defects">
    <h2>Placement defects</h2>
    <ul role="list">${items}</ul>
  </section>`;
}

// The page's own limits, written from the flags rather than asserted.
function limitItems(model: TreeModel): string[] {
  const caps: ReadModelCapabilities = model.capabilities;
  const items: string[] = [];

  const runnerFields: string[] = [];
  if (!caps.runner_slot) runnerFields.push('runner_slot');
  if (!caps.runner_id) runnerFields.push('runner_id');
  if (runnerFields.length > 0) {
    items.push(
      `${monoList(runnerFields)} ${runnerFields.length === 1 ? 'is' : 'are'} in INTERFACE §2's attempt table, but no ${mono('--json')} read prints ${
        runnerFields.length === 1 ? 'it' : 'them'
      }.`,
    );
  }
  if (!caps.slot_limit) {
    items.push(
      `The ${mono('slot')} shown is the project slot; its limit is not printed, so it has no denominator.`,
    );
  }

  const taskFields: string[] = [];
  if (!caps.task_title) taskFields.push('title');
  if (!caps.task_priority) taskFields.push('priority');
  if (!caps.task_tags) taskFields.push('tags');
  if (!caps.task_requires) taskFields.push('requires');
  if (taskFields.length > 0) {
    let sentence = `${monoList(taskFields)} ${taskFields.length === 1 ? 'is' : 'are'} not printed by any read verb.`;
    if (!caps.task_tags || !caps.task_requires) {
      sentence += ` ${mono('tags')} and ${mono('requires')} exist in ${mono(
        'task.created',
      )} payloads, but ${mono('task watch')} prints no payload.`;
    }
    items.push(sentence);
  }

  if (!caps.tree_key_from_read) {
    items.push(
      `${mono('tree_key')} is not printed by any read verb. The key above is the value passed to ${mono(
        'task create --tree-key',
      )}.`,
    );
  }

  if (model.provenance.unobserved_states.length > 0) {
    items.push(
      `${monoList(model.provenance.unobserved_states)} need paths this slice does not have. Their counts are zero above because the read could not produce them, not because the tree never reaches them.`,
    );
  }

  if (model.unknown_rest_states > 0) {
    items.push(
      `${plural(model.unknown_rest_states, 'task')} outside the frozen ${mono(
        'rest_state',
      )} enum; ${model.unknown_rest_states === 1 ? 'it is' : 'they are'} not counted in the strip.`,
    );
  }

  let attemptSentence = `${mono('phase')} and ${mono('slot')} are the live attempt only.`;
  if (!caps.ended_attempt) {
    attemptSentence += ` A ${mono('done')}, ${mono('failed')}, ${mono(
      'cancelled',
    )} or ${mono(
      'skipped',
    )} task shows no attempt because the ended attempt is not readable; that is not a claim that no attempt ran.`;
  }
  items.push(attemptSentence);

  for (const step of model.provenance.port_only_steps) {
    items.push(`Not from a CLI verb: ${esc(step)}`);
  }

  return items;
}

// Indentation is generated from the deepest row in the read, so a tree deeper
// than the old four-level stylesheet still has a visible hierarchy.
function depthCss(maxDepth: number): string {
  const rules = [
    '.key { position: relative; min-width: 0; }',
    '.key[data-depth]:not([data-depth="0"])::before { content: ""; position: absolute; top: 0.78rem; width: 0.5rem; border-top: 1px solid var(--rule); }',
  ];
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const indent = (depth * 1.15).toFixed(2);
    rules.push(
      `.key[data-depth="${depth}"] { padding-left: ${indent}rem; }`,
      `.key[data-depth="${depth}"]::before { left: ${(depth * 1.15 - 0.85).toFixed(2)}rem; }`,
    );
  }
  return rules.join('\n');
}

export function renderBoard(model: TreeModel): string {
  const provenance = model.provenance;
  const sourceLabel = provenance.source_kind === 'fixture' ? 'Fixture capture' : 'Live read';
  const present = new Set(flattenIds(model.roots));
  // Every row in the tree, not only the roots: a nested task is a row in the
  // same ledger, with its own depth.
  const renderedRows = flattenTree(model.roots)
    .map((row) => renderRow(row, present, model))
    .join('');
  const empty =
    model.total > 0
      ? ''
      : model.nodes_read === 0
        ? '<p class="empty">No tasks in this tree.</p>'
        : '<p class="empty defect-empty">No task could be placed. The placement defects above name every affected key.</p>';
  const hidden = model.hidden_container
    ? `<p class="source">The tree container is one task row with ${mono(
        'node_key "$root"',
      )}; it is hidden here because it is not a node of the work tree.</p>`
    : '';
  const limits = limitItems(model);
  const unplacedNote =
    model.unplaced > 0
      ? `<p class="states-note">${plural(
          model.unplaced,
          'task',
        )} in this read could not be placed; see the placement defects.</p>`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tree ${esc(model.tree_key)}</title>
<style>
:root {
  --paper: #f6f7f8;
  --ink: #15181c;
  --muted: #5c646e;
  --rule: #d5d9de;
  --rule-soft: #e3e6ea;
  --defect: #9f1239;
  --defect-soft: #fbeff2;
  --sans: "Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif;
  --mono: "SFMono-Regular", "JetBrains Mono", "Cascadia Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0f1113;
    --ink: #e9ecef;
    --muted: #a5adb7;
    --rule: #2b3036;
    --rule-soft: #20242a;
    --defect: #ff9db0;
    --defect-soft: #2a1519;
  }
}
[data-state="draft"] { --state: #68707b; }
[data-state="blocked"] { --state: #b42318; }
[data-state="ready"] { --state: #1d4ed8; }
[data-state="waiting"] { --state: #9a5b00; }
[data-state="done"] { --state: #15703a; }
[data-state="failed"] { --state: #9f1239; }
[data-state="cancelled"] { --state: #68707b; }
[data-state="skipped"] { --state: #5f5a54; }
@media (prefers-color-scheme: dark) {
  [data-state="draft"] { --state: #9aa3ae; }
  [data-state="blocked"] { --state: #ff8a80; }
  [data-state="ready"] { --state: #8ab4ff; }
  [data-state="waiting"] { --state: #e0a44a; }
  [data-state="done"] { --state: #6fcf97; }
  [data-state="failed"] { --state: #ff9db0; }
  [data-state="cancelled"] { --state: #9aa3ae; }
  [data-state="skipped"] { --state: #b0a99f; }
}
* { box-sizing: border-box; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
html { background: var(--paper); }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.55 var(--sans);
  -webkit-font-smoothing: antialiased;
}
.mono, .node-key, .task-id, .ref, .state-word, .runtime, .source .mono { font-family: var(--mono); }
.sheet {
  max-width: 74rem;
  margin: 0 auto;
  padding: clamp(1.25rem, 4vw, 3rem);
  padding-bottom: calc(clamp(1.25rem, 4vw, 3rem) + env(safe-area-inset-bottom));
}
.masthead { border-bottom: 1px solid var(--rule); padding-bottom: 1.15rem; }
.provenance {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0 0 1rem;
  color: var(--muted);
  font-size: 0.78rem;
}
h1 {
  margin: 0;
  font-size: clamp(1.55rem, 3.8vw, 2.35rem);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
h1 .mono { font-weight: 500; letter-spacing: -0.03em; }
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.1rem;
  margin: 0.8rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
}
.meta .value { color: var(--ink); }
.states {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 1.35rem;
  margin: 0;
  padding: 1rem 0;
  list-style: none;
  border-bottom: 1px solid var(--rule);
}
.state, .state-word {
  display: inline-flex;
  align-items: baseline;
  gap: 0.42rem;
}
.state .dot, .state-word .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--state);
  flex: none;
  transform: translateY(-1px);
}
.state .word, .state-word .word {
  color: var(--state);
  font-family: var(--mono);
  font-size: 0.8rem;
}
.state .count {
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}
.state[data-zero="true"] .dot {
  background: transparent;
  border: 1px solid var(--state);
}
.state[data-zero="true"] .word,
.state[data-zero="true"] .count { color: var(--muted); }
.states-note {
  margin: 0.4rem 0 0;
  color: var(--muted);
  font-size: 0.78rem;
}
.state[data-observed="false"] .count { color: var(--muted); }
.unobserved {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.64rem;
  letter-spacing: 0.01em;
}
.defects {
  margin: 1.15rem 0 0;
  padding: 0.75rem 0.9rem;
  border-left: 3px solid var(--defect);
  background: var(--defect-soft);
}
.defects h2 {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--defect);
}
.defects ul {
  margin: 0;
  padding-left: 1.05rem;
  font-size: 0.8rem;
  line-height: 1.55;
}
.defects li { margin-bottom: 0.25rem; }
.defect-kind {
  font-weight: 600;
  color: var(--defect);
  margin-right: 0.35rem;
}
.ledger { padding-top: 1.35rem; }
.treegrid { display: block; }
.columns, .node-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8.5rem 17rem;
  gap: 1.25rem;
}
.columns {
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--rule);
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.7rem;
}
.node-row {
  padding: 0.62rem 0 0.7rem;
  border-bottom: 1px solid var(--rule-soft);
  align-items: start;
}
${depthCss(model.max_depth)}
.node-key {
  display: block;
  font-size: 0.87rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.task-id {
  display: block;
  margin-top: 0.12rem;
  color: var(--muted);
  font-size: 0.67rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.edge, .flag {
  margin: 0.32rem 0 0;
  color: var(--muted);
  font-size: 0.73rem;
  line-height: 1.45;
}
.edge-kind {
  margin-right: 0.35rem;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.7rem;
}
.edge .ref {
  display: inline-block;
  margin-right: 0.55rem;
  color: var(--muted);
  font-size: 0.72rem;
}
a.ref { text-decoration: underline; text-underline-offset: 0.16em; }
a.ref:hover, a.ref:focus-visible { color: var(--ink); }
.edge .ref.outside { text-decoration: underline dotted; }
.flag { color: var(--muted); }
.state-word { padding-top: 0.08rem; }
.state-word .word { font-size: 0.79rem; }
.runtime {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem 0.9rem;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.6;
}
.runtime .pair { display: inline-flex; gap: 0.32rem; min-width: 0; }
.runtime .label { color: var(--muted); }
.runtime .value {
  min-width: 0;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.runtime .pair.missing .value { color: var(--muted); }
.runtime .pair.wait .value { color: var(--state); }
.runtime .pair.hold .value { color: var(--state); }
.empty {
  margin: 1.5rem 0;
  color: var(--muted);
}
.defect-empty { color: var(--defect); }
.limits {
  margin-top: 2.5rem;
  padding-top: 1.15rem;
  border-top: 1px solid var(--rule);
}
.limits h2 {
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
  font-weight: 600;
}
.limits ul {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.6;
}
.limits li { margin-bottom: 0.3rem; }
.source {
  margin: 1rem 0 0;
  color: var(--muted);
  font-size: 0.73rem;
  line-height: 1.5;
}
@media (max-width: 720px) {
  /* Hidden visually, not removed: a screen reader still needs the column names. */
  .columns {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .node-row { grid-template-columns: minmax(0, 1fr) auto; gap: 0.55rem 1rem; }
  .runtime { grid-column: 1 / -1; margin-top: 0.15rem; }
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto; }
}
</style>
</head>
<body>
<main class="sheet">
  <header class="masthead">
    <p class="provenance">
      <span>${esc(sourceLabel)}</span>
      <span>read at ${esc(provenance.read_at)}</span>
      <span>task-engine@${esc(provenance.engine_commit)}</span>
      <span>schema ${esc(String(provenance.schema_revision))}</span>
    </p>
    <h1>Tree <span class="mono">${esc(model.tree_key)}</span></h1>
    <p class="meta">
      <span><span class="label">project</span> <span class="value mono">${esc(model.project_id)}</span></span>
      <span><span class="value">${plural(model.total, 'task')}</span></span>
      ${runnerLine(model)}
    </p>
  </header>

  <section aria-label="rest_state counts">
    <ul class="states" role="list">${stateCounts(model)}</ul>
    ${unplacedNote}
  </section>

  ${defectBlock(model)}

  <section class="ledger" aria-labelledby="tree-heading">
    <h2 id="tree-heading" class="visually-hidden">Task tree</h2>
    <div class="treegrid" role="treegrid" aria-labelledby="tree-heading" aria-readonly="true">
      <div class="columns" role="row">
        <span role="columnheader">node_key</span><span role="columnheader">rest_state</span><span role="columnheader">attempt and wait</span>
      </div>
      <div role="rowgroup">${renderedRows}</div>
    </div>
    ${empty}
  </section>

  <footer class="limits">
    <h2>Read model limits</h2>
    <ul role="list">
      ${limits.map((item) => `<li>${item}</li>`).join('\n      ')}
    </ul>
    <p class="source">
      <span>Reads:</span> ${provenance.operations.map(mono).join(', ')}
    </p>
    ${hidden}
    <p class="source">${esc(sourceLabel)}. Read at ${esc(provenance.read_at)} from <span class="mono">task-engine@${esc(
      provenance.engine_commit,
    )}</span>. Every rest_state and phase above is engine output; no state is computed by this page.</p>
  </footer>
</main>
</body>
</html>
`;
}

function flattenIds(rows: readonly TreeRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    ids.push(row.task_id, ...flattenIds(row.children));
  }
  return ids;
}
