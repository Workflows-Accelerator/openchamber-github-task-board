import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ATTEMPT_PHASES,
  EDGE_KINDS,
  REST_STATES,
  buildTree,
  flattenTree,
} from '../engine-board/model.ts';
import {
  LANE_ORDER,
  containment,
  engineDisagreement,
  focusCounts,
  laneGroups,
  laneOf,
  lanePlan,
  levelEdges,
  progress,
  progressText,
} from '../engine-board/rollup.ts';
import {
  boardData,
  conversationStatement,
  detailFields,
  detailSections,
  historyLines,
  humanMoment,
  humanTime,
  renderBoardPage,
  renderListPage,
  sheetFieldsHtml,
  sourceLabel,
} from '../engine-board/board-render.ts';
import {
  parseHash,
  scopeChildren,
  scopeHref,
  scopePath,
} from '../engine-board/scope.ts';
import { createCliSource, createLiveSource, fixtureRequest } from '../engine-board/live-source.ts';
import {
  createFixtureSource,
  loadFixtureSnapshot,
  readFixtureMeta,
} from './fixtures-source.ts';

const here = dirname(fileURLToPath(import.meta.url));
const board = join(here, '..', 'engine-board');
const fixtures = join(board, 'fixtures');

function readJson(name) {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8'));
}

function node(task_id, node_key, rest_state, parent_task_id, extra = {}) {
  return { task_id, node_key, rest_state, parent_task_id, ...extra };
}

function statusOf(task_id, rest_state, extra = {}) {
  return {
    task_id,
    rest_state,
    phase: null,
    slot: null,
    wait: null,
    hold: null,
    handoff_revision: 1,
    ...extra,
  };
}

function provenance(overrides = {}) {
  return {
    source_kind: 'live',
    read_at: '2026-01-01T00:00:00Z',
    engine_commit: 'test-rev',
    schema_revision: 7,
    operations: ['task graph --project p --json'],
    port_only_steps: [],
    unobserved_states: [],
    ...overrides,
  };
}

// A hand-written snapshot: the live source's shape, so a renderer defect is
// testable without a capture and without the engine.
function snapshotOf({
  nodes,
  edges = [],
  statuses = [],
  project = {},
  runners = [],
  runnersAvailable = true,
  treeKey = 'tree',
  rootTaskId = 'root',
  prov = provenance(),
} = {}) {
  return {
    provenance: prov,
    project: { project_id: 'p', config_revision: 1, ...project },
    runners,
    runners_available: runnersAvailable,
    graph: { nodes, edges },
    statuses,
    tree_key: treeKey,
    root_task_id: rootTaskId,
  };
}

function fixtureModel() {
  return buildTree(loadFixtureSnapshot(fixtures, readFixtureMeta(fixtures)));
}

test('the frozen graph, status, project and runner payloads keep the engine keys', () => {
  const graph = readJson('graph.json');
  const statuses = readJson('status.json');
  const project = readJson('project.json');
  const runners = readJson('runners.json');

  assert.deepEqual(Object.keys(graph).sort(), ['edges', 'next_cursor', 'nodes']);
  for (const node of graph.nodes) {
    assert.deepEqual(Object.keys(node).sort(), [
      'archived_at',
      'contract_digest',
      'created_at',
      'node_key',
      'parent_task_id',
      'priority',
      'requires',
      'rest_state',
      'root_task_id',
      'sequence',
      'tags',
      'task_id',
      'title',
      'tree_key',
      'updated_at',
    ]);
  }
  for (const edge of graph.edges) {
    assert.deepEqual(Object.keys(edge).sort(), [
      'blocked_task_id',
      'blocker_task_id',
      'edge_id',
      'input_name',
      'kind',
      'required',
      'satisfied_by',
    ]);
  }

  assert.deepEqual(Object.keys(project).sort(), [
    'config_revision',
    'max_concurrency',
    'project_id',
  ]);
  assert.equal(runners.runners.length, 2);
  for (const runner of runners.runners) {
    assert.deepEqual(Object.keys(runner).sort(), [
      'capacity',
      'created_at',
      'enabled',
      'endpoint',
      'heartbeat_at',
      'kind',
      'project_id',
      'runner_id',
      'tags',
    ]);
  }
  assert.deepEqual(
    runners.runners.map((runner) => runner.kind).sort(),
    ['engine', 'stub'],
  );

  assert.equal(statuses.tasks.length, graph.nodes.length);
  for (const status of statuses.tasks) {
    assert.deepEqual(Object.keys(status).sort(), [
      'approved_by',
      'archived_at',
      'attempts',
      'body',
      'close_reason',
      'contract_digest',
      'created_at',
      'ended_attempt',
      'handoff_revision',
      'hold',
      'max_concurrency',
      'node_key',
      'outcome',
      'parent_task_id',
      'phase',
      'priority',
      'requires',
      'rest_state',
      'root_task_id',
      'runner_id',
      'runner_slot',
      'self_approved',
      'sequence',
      'skip',
      'slot',
      'slot_limit',
      'tags',
      'task_id',
      'title',
      'tree_key',
      'tree_state',
      'updated_at',
      'wait',
    ]);
  }
  const waiting = statuses.tasks.find((status) => status.rest_state === 'waiting');
  assert.ok(waiting, 'the capture must contain a waiting task');
  assert.deepEqual(Object.keys(waiting.wait).sort(), [
    'cause',
    'ended_by',
    'escalation_level',
    'expires_at',
    'opened_at',
    'opened_by_attempt',
    'owner',
    'reason',
    'resume_at',
  ]);
  assert.equal(waiting.wait.reason, 'review');
  assert.equal(waiting.wait.cause, 'none');
});

test('the fixture is pinned to the engine revision and schema the slice targets', () => {
  const meta = readFixtureMeta(fixtures);
  // One pin: capture.sh refuses to run against another revision, so the test
  // reads that default instead of keeping a second copy that drifts.
  const capture = readFileSync(join(fixtures, 'capture.sh'), 'utf8');
  const pin = capture.match(/EXPECTED_COMMIT="\$\{EXPECTED_COMMIT:-([0-9a-f]{7})\}"/);
  assert.ok(pin, 'capture.sh has no EXPECTED_COMMIT default');
  assert.equal(meta.engine.commit, pin[1]);
  // The schema revision is engine-owned and moves with the engine; the fixture
  // records it and the page must repeat it, which the golden test checks.
  assert.ok(Number.isInteger(meta.engine.schema_revision));
  assert.ok(meta.engine.schema_revision > 0);
  assert.equal(meta.project_id, 'engine-board');
  assert.equal(meta.tree_key, 'incident-9');
  assert.equal(meta.container_node_key, '$root');
  // No store-port writes. Every payload is a read verb's own answer, so the
  // capture no longer has to mark a shape the CLI could not produce.
  assert.deepEqual(meta.port_only_steps, []);
  assert.ok(meta.notes.some((note) => note.includes('17 of the 18')));
  assert.ok(meta.notes.some((note) => note.includes('playbook.yaml:23')));
  assert.ok(
    meta.read_verbs.some((verb) => verb.startsWith('task runner list')),
    'the capture reads the runner list',
  );
});

test('every captured state, phase and edge kind is a frozen INTERFACE §2 value', () => {
  assert.deepEqual(REST_STATES, [
    'draft',
    'blocked',
    'ready',
    'waiting',
    'done',
    'failed',
    'cancelled',
    'skipped',
  ]);
  assert.deepEqual(ATTEMPT_PHASES, ['claimed', 'launching', 'live', 'ending', 'ended']);
  assert.deepEqual(EDGE_KINDS, ['blocked_by', 'after']);

  const graph = readJson('graph.json');
  const statuses = readJson('status.json');
  for (const node of graph.nodes) {
    assert.ok(REST_STATES.includes(node.rest_state), node.rest_state);
  }
  for (const edge of graph.edges) {
    assert.ok(EDGE_KINDS.includes(edge.kind), edge.kind);
  }
  for (const status of statuses.tasks) {
    assert.ok(REST_STATES.includes(status.rest_state), status.rest_state);
    if (status.phase !== null) {
      assert.ok(ATTEMPT_PHASES.includes(status.phase), status.phase);
    }
  }
});

test('the capture covers the run states, and the second shape covers both edge kinds', () => {
  const graph = readJson('graph.json');
  const states = new Set(graph.nodes.map((node) => node.rest_state));
  assert.deepEqual([...states].sort(), ['blocked', 'done', 'ready', 'waiting']);
  assert.deepEqual(
    [...new Set(graph.edges.map((edge) => edge.kind))].sort(),
    ['blocked_by'],
  );

  const second = readJson(join('second-shape', 'graph.json'));
  assert.deepEqual(
    [...new Set(second.nodes.map((node) => node.rest_state))].sort(),
    ['blocked', 'done', 'ready'],
  );
  assert.deepEqual(
    [...new Set(second.edges.map((edge) => edge.kind))].sort(),
    ['after', 'blocked_by'],
  );
});

test('buildTree hides the tree container and nests by parent_task_id', () => {
  const meta = readFixtureMeta(fixtures);
  const graph = readJson('graph.json');
  const model = fixtureModel();

  // A playbook creates every node under the root, so the capture is flat: one
  // hidden container, one reserved `$emit` row, and six work rows. A missing
  // parent would mean the tree read truncated, not an orphan.
  const ids = new Set(graph.nodes.map((node) => node.task_id));
  for (const node of graph.nodes) {
    if (node.task_id === meta.root_task_id) continue;
    assert.equal(node.parent_task_id, meta.root_task_id, node.node_key);
  }

  assert.equal(model.total, 6);
  assert.ok(model.hidden_container);
  assert.equal(model.hidden_container.task_id, meta.root_task_id);
  assert.equal(model.hidden_container.node_key, '$root');
  assert.deepEqual(model.engine_steps, [{ node_key: '$emit', count: 1 }]);
  assert.equal(model.roots.length, 6);
  assert.equal(model.total, flattenTree(model.roots).length);
  assert.equal(model.nodes_read, 6);
  assert.equal(model.unplaced, 0);
  assert.deepEqual(model.defects, []);

  const flat = flattenTree(model.roots);
  const byKey = new Map(flat.map((row) => [row.node_key, row]));
  assert.deepEqual(
    [...byKey.keys()].sort(),
    ['call', 'diag-db', 'diag-host', 'diag-net', 'remediate', 'summarise'],
  );
  for (const row of flat) {
    assert.equal(row.depth, 0, row.node_key);
    assert.equal(row.rerooted, null, row.node_key);
    assert.equal(row.children.length, 0, row.node_key);
  }
  assert.equal(byKey.get('summarise').rest_state, 'done');
  assert.equal(byKey.get('call').rest_state, 'waiting');
  assert.equal(byKey.get('remediate').rest_state, 'blocked');
});

test('the tree reads rest_state, attempts, runner slots and dependency directions without renaming them', () => {
  const model = fixtureModel();
  const byKey = new Map(flattenTree(model.roots).map((row) => [row.node_key, row]));

  const summary = byKey.get('summarise');
  assert.equal(summary.rest_state, 'done');
  assert.equal(summary.phase, 'ended');
  assert.equal(summary.slot, 0);
  assert.equal(summary.slot_limit, 2);
  assert.equal(summary.attempts.length, 1);
  assert.equal(summary.attempts[0].phase, 'ended');
  assert.equal(summary.runner_slot, 0);
  assert.equal(summary.runner_slot_reported, true);
  assert.ok(summary.runner_id !== null);
  assert.equal(summary.runner_id_reported, true);
  assert.equal(summary.body, 'Rank the causes across the three diagnostics and write the incident summary.');
  assert.deepEqual(
    summary.blocked_by.map((ref) => ref.node_key).sort(),
    ['diag-db', 'diag-host', 'diag-net'],
  );
  assert.deepEqual(summary.after, []);

  const gate = byKey.get('call');
  assert.equal(gate.rest_state, 'waiting');
  assert.equal(gate.phase, null);
  assert.equal(gate.slot, null);
  assert.equal(gate.wait.reason, 'review');
  assert.equal(gate.wait.cause, 'none');
  assert.equal(gate.wait.owner, null);
  assert.equal(gate.attempts.length, 0);

  const remediation = byKey.get('remediate');
  assert.equal(remediation.rest_state, 'blocked');
  assert.deepEqual(
    remediation.blocked_by.map((ref) => ref.node_key),
    ['call'],
  );

  // The reserved `$emit` row is engine machinery. It is in the read, and the
  // model names it once, but it is not a task row, a card or a count.
  assert.equal(byKey.has('$emit'), false);
  assert.deepEqual(model.engine_steps, [{ node_key: '$emit', count: 1 }]);
});

test('a reserved $emit row changes no count, and the fold still names it', () => {
  const work = [
    node('r', '$root', 'ready', null),
    node('a', 'diag', 'done', 'r'),
    node('b', 'summarise', 'done', 'r'),
  ];
  const without = buildTree(snapshotOf({ nodes: work, rootTaskId: 'r' }));
  const emit = node('e', '$emit', 'done', 'r');
  const withEmit = buildTree(
    snapshotOf({
      nodes: [...work, emit],
      rootTaskId: 'r',
      statuses: [statusOf('e', 'done')],
    }),
  );

  // The reserved row is read, but it is not a task: no card, no lane, no
  // count, no progress denominator. The two trees render the same numbers.
  assert.deepEqual(withEmit.counts, without.counts);
  assert.equal(withEmit.total, without.total);
  assert.equal(withEmit.nodes_read, without.nodes_read);
  assert.equal(withEmit.engine_steps.length, 1);
  assert.equal(
    renderBoardPage(withEmit).includes('data-key="$emit"'),
    false,
  );
  assert.ok(renderBoardPage(withEmit).includes('engine step'));
  assert.ok(renderBoardPage(withEmit).includes('$emit'));
});

test('the second shape reads after edges beside blocked_by edges', () => {
  const source = createFixtureSource(join(fixtures, 'second-shape'));
  const meta = readFixtureMeta(join(fixtures, 'second-shape'));
  return source
    .load({
      project_id: meta.project_id,
      tree_key: meta.tree_key,
      root_task_id: meta.root_task_id,
    })
    .then((snapshot) => {
      const model = buildTree(snapshot);
      const byKey = new Map(
        flattenTree(model.roots).map((row) => [row.node_key, row]),
      );
      const pick = byKey.get('pick');
      assert.equal(pick.rest_state, 'blocked');
      assert.deepEqual(
        pick.after.map((ref) => ref.node_key).sort(),
        ['probe-a', 'probe-b', 'probe-c'],
      );
      assert.deepEqual(
        byKey.get('fix').blocked_by.map((ref) => ref.node_key),
        ['pick'],
      );
      assert.deepEqual(
        byKey.get('verify').blocked_by.map((ref) => ref.node_key),
        ['fix'],
      );
      // The edge that carried `satisfied_by` is the engine's own answer; the
      // model kept it rather than re-deriving "done".
      assert.deepEqual(
        snapshot.graph.edges.map((edge) => edge.satisfied_by).sort(),
        [
          ['done'],
          ['done'],
          ['done', 'failed', 'cancelled', 'skipped'],
          ['done', 'failed', 'cancelled', 'skipped'],
          ['done', 'failed', 'cancelled', 'skipped'],
        ],
      );
    });
});

test('counts are the rest_state enum in order, zero included', () => {
  const model = fixtureModel();
  assert.deepEqual(model.counts, {
    draft: 0,
    blocked: 1,
    ready: 0,
    waiting: 1,
    done: 4,
    failed: 0,
    cancelled: 0,
    skipped: 0,
  });
  assert.deepEqual(Object.keys(model.counts), [...REST_STATES]);
  assert.equal(model.unknown_rest_states, 0);
  assert.equal(
    Object.values(model.counts).reduce((sum, count) => sum + count, 0),
    model.total,
  );
});

test('every fixture row has a status and graph and status agree', () => {
  const model = fixtureModel();
  for (const row of flattenTree(model.roots)) {
    assert.equal(row.status_missing, false, row.node_key);
    assert.equal(row.rest_state_mismatch, false, row.node_key);
  }
});

test('the fixture read model reports which fields the payloads do not carry', () => {
  const model = fixtureModel();
  assert.deepEqual(model.capabilities, {
    runner_slot: true,
    runner_id: true,
    task_title: true,
    task_priority: true,
    task_tags: true,
    task_requires: true,
    tree_key_from_read: true,
    slot_limit: true,
    ended_attempt: true,
    task_body: true,
    contract_conditions: false,
    mirror_link: false,
  });
  const statuses = readJson('status.json');
  for (const status of statuses.tasks) {
    assert.ok(Object.hasOwn(status, 'runner_slot'));
    assert.ok(Object.hasOwn(status, 'runner_id'));
    assert.ok(Object.hasOwn(status, 'body'));
    assert.ok(Object.hasOwn(status, 'attempts'));
    assert.equal(Object.hasOwn(status, 'conditions'), false);
  }
  const graph = readJson('graph.json');
  for (const node of graph.nodes) {
    assert.ok(Object.hasOwn(node, 'title'));
    assert.ok(Object.hasOwn(node, 'tree_key'));
    assert.equal(Object.hasOwn(node, 'conditions'), false);
  }
});

test('the page escapes node keys and titles', () => {
  const snapshot = snapshotOf({
    nodes: [
      node('t1', '<script>alert(1)</script>', 'ready', null, {
        title: '<b>title</b>',
      }),
    ],
    statuses: [statusOf('t1', 'ready')],
  });
  const html = renderBoardPage(buildTree(snapshot));
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;b&gt;title&lt;/b&gt;'));
});

test('an unknown rest_state is escaped and counted apart from zero', () => {
  const restState = '"><script>alert(2)</script>';
  const snapshot = snapshotOf({
    nodes: [node('t1', 'task', restState, null)],
  });
  const model = buildTree(snapshot);
  const html = renderBoardPage(model);

  assert.equal(model.unknown_rest_states, 1);
  assert.equal(model.roots[0].rest_state_known, false);
  assert.equal(html.includes(restState), false);
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;'));
  // Slice 6: the raw engine string is an attribute for the panel, never a
  // sentence on the card. The card says the plain fact.
  assert.ok(html.includes('The engine reported a state this page does not know.'));
  assert.equal(
    html.includes('a state this board does not know: <span class="mono">'),
    false,
  );
  assert.equal(
    Object.values(model.counts).reduce((sum, count) => sum + count, 0),
    0,
  );
});

test('an opaque wait member renders as missing instead of throwing', () => {
  const snapshot = snapshotOf({
    nodes: [node('t1', 'task', 'waiting', null)],
    statuses: [
      statusOf('t1', 'waiting', {
        wait: { reason: 5, cause: null, owner: '' },
        hold: { cause: 'shape changed' },
      }),
    ],
  });
  const model = buildTree(snapshot);
  const sections = detailSections(model.roots[0], model);
  const html = renderBoardPage(model);
  // Slice 6: missing members are one sentence, not a column of rows.
  assert.equal(html.includes('not reported'), false);
  assert.ok(
    sections.notes.some((note) => note.includes('did not report a reason')),
    sections.notes.join(' / '),
  );
  assert.equal(
    sections.primary.some((field) => field.value === 'not reported'),
    false,
  );
  // The raw hold is still on the page, behind the panel's More disclosure.
  assert.ok(html.includes('Raw hold'));
  assert.ok(html.includes('shape changed'));
  assert.ok(html.includes("summary.textContent = 'More'"));
});

// ---------------------------------------------------------------------------
// Slice 2: placement defects, data-driven capabilities, real provenance.
// ---------------------------------------------------------------------------

test('a parent cycle is a stated defect, never an empty tree', () => {
  const snapshot = snapshotOf({
    nodes: [
      node('root', '$root', 'ready', null),
      node('a', 'alpha', 'ready', 'b'),
      node('b', 'beta', 'draft', 'c'),
      node('c', 'gamma', 'done', 'a'),
    ],
  });
  const model = buildTree(snapshot);

  assert.equal(model.nodes_read, 3);
  assert.equal(model.total, 0);
  assert.equal(model.unplaced, 3);
  assert.deepEqual(model.defects, [
    { kind: 'cycle', tasks: 3, keys: ['alpha', 'beta', 'gamma'] },
  ]);

  const html = renderBoardPage(model);
  assert.ok(html.includes('Parent cycle'));
  assert.ok(html.includes('3 tasks could not be placed'));
  for (const key of ['alpha', 'beta', 'gamma']) {
    assert.ok(html.includes(key), key);
  }
  assert.ok(html.includes('3 tasks in this read could not be placed'));
});

test('a self-parent is a cycle of one', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('a', 'alpha', 'ready', 'a'),
      ],
    }),
  );
  assert.deepEqual(model.defects, [
    { kind: 'cycle', tasks: 1, keys: ['alpha'] },
  ]);
  assert.equal(model.total, 0);
  const html = renderBoardPage(model);
  assert.ok(html.includes('1 task could not be placed'));
});

test('a component hanging below a cycle is reported as disconnected', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('a', 'alpha', 'ready', 'b'),
        node('b', 'beta', 'ready', 'a'),
        node('d', 'delta', 'done', 'a'),
      ],
    }),
  );
  assert.deepEqual(model.defects, [
    { kind: 'cycle', tasks: 2, keys: ['alpha', 'beta'] },
    { kind: 'unreachable', tasks: 1, keys: ['delta'] },
  ]);
  assert.equal(model.total, 0);
  assert.equal(model.unplaced, 3);
  const html = renderBoardPage(model);
  assert.ok(html.includes('Disconnected'));
  assert.ok(html.includes('1 task below a cycle could not be placed'));
  assert.ok(html.includes('delta'));
});

test('a reachable row renders beside a cycle defect', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('ok', 'ok', 'done', 'root'),
        node('a', 'alpha', 'ready', 'b'),
        node('b', 'beta', 'ready', 'a'),
      ],
    }),
  );
  assert.equal(model.total, 1);
  assert.equal(model.unplaced, 2);
  assert.deepEqual(model.defects, [
    { kind: 'cycle', tasks: 2, keys: ['alpha', 'beta'] },
  ]);

  const html = renderBoardPage(model);
  assert.ok(html.includes('data-key="ok"'));
  assert.ok(html.includes('2 tasks could not be placed'));
});

test('a subtree under an outside parent is flagged as a whole, not just its top', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('x', 'x', 'ready', 'gone'),
        node('y', 'x/y', 'draft', 'x'),
        node('z', 'x/z', 'ready', 'x'),
      ],
    }),
  );
  assert.equal(model.total, 3);
  assert.equal(model.roots.length, 1);
  assert.deepEqual(model.roots[0].rerooted, {
    parent_task_id: 'gone',
    subtree_tasks: 3,
  });
  assert.deepEqual(model.defects, [
    { kind: 'rerooted', tasks: 3, keys: ['x'] },
  ]);
  const html = renderBoardPage(model);
  assert.ok(html.includes('Re-rooted'));
  assert.ok(html.includes('1 task with a parent outside this read'));
  assert.ok(html.includes('<span class="mono">x</span>'));
});

test('every reserved $ row is folded, so a second tree keeps no $root card', () => {
  const snapshot = snapshotOf({
    nodes: [
      node('r2', '$root', 'ready', null),
      node('r', '$root', 'ready', null),
      node('a', 'alpha', 'ready', 'r'),
      node('b', 'beta', 'draft', 'r2'),
    ],
    rootTaskId: 'r',
  });
  const model = buildTree(snapshot);

  // The requested container is hidden as before; the other tree's container is
  // reserved machinery too and is folded the same way. Its children take its
  // place rather than disappearing with it.
  assert.equal(model.hidden_container.task_id, 'r');
  const keys = flattenTree(model.roots).map((row) => row.node_key);
  assert.deepEqual(keys, ['alpha', 'beta']);
  assert.deepEqual(model.engine_steps, [{ node_key: '$root', count: 1 }]);

  const html = renderBoardPage(model);
  assert.equal(html.includes('data-key="$root"'), false);
});

test('the pages escape phase', () => {
  const phase = '"><script>alert(9)</script>';
  const snapshot = snapshotOf({
    nodes: [node('t1', 'task', 'ready', null)],
    statuses: [
      statusOf('t1', 'ready', {
        phase,
        slot: 0,
      }),
    ],
  });
  const model = buildTree(snapshot);
  assert.equal(model.roots[0].phase, phase);
  const html = renderBoardPage(model);
  assert.equal(html.includes(phase), false);
  // The inline JSON block cannot be broken out of: `<` is escaped in the data.
  assert.ok(html.includes('\\u003cscript>alert(9)\\u003c/script>'));
});

test('capabilities come from the payloads, and the panel reads them', () => {
  const snapshot = snapshotOf({
    project: { max_concurrency: 2 },
    nodes: [
      node('t1', 'task', 'ready', null, {
        title: 'Do the thing',
        priority: 2,
        tags: ['x'],
        requires: ['y'],
        tree_key: 'tree',
      }),
    ],
    statuses: [
      statusOf('t1', 'ready', {
        phase: 'live',
        slot: 0,
        runner_slot: 3,
        runner_id: 'runner-1',
        attempts: [],
      }),
    ],
  });
  const model = buildTree(snapshot);

  assert.deepEqual(model.capabilities, {
    runner_slot: true,
    runner_id: true,
    task_title: true,
    task_priority: true,
    task_tags: true,
    task_requires: true,
    tree_key_from_read: true,
    slot_limit: true,
    ended_attempt: true,
    task_body: false,
    contract_conditions: false,
    mirror_link: false,
  });

  const fields = detailFields(model.roots[0], model);
  const value = (label) => fields.find((field) => field.label === label).value;
  assert.equal(value('Slot'), '0 of 2');
  assert.equal(value('Runner'), 'runner-1 (slot 3)');
});

test('provenance is printed from the snapshot, not from a fixture', () => {
  const fixture = fixtureModel();
  assert.equal(fixture.provenance.source_kind, 'fixture');
  const fixtureHtml = renderBoardPage(fixture);
  assert.ok(fixtureHtml.includes('Fixture capture'));
  assert.ok(fixtureHtml.includes(readFixtureMeta(fixtures).captured_at));

  const live = buildTree(
    snapshotOf({
      nodes: [node('t1', 'task', 'ready', null)],
      prov: provenance({
        source_kind: 'live',
        read_at: '2026-02-02T00:00:00Z',
        engine_commit: 'live-1',
        operations: ['task graph', 'task status'],
      }),
    }),
  );
  const liveHtml = renderListPage(live);
  assert.ok(liveHtml.includes('Live read'));
  assert.ok(liveHtml.includes('2026-02-02T00:00:00Z'));
  assert.ok(liveHtml.includes('live-1'));
  assert.equal(liveHtml.includes('Fixture capture'), false);
});

test('an empty read is the only case that says the tree has no tasks', () => {
  const model = buildTree(
    snapshotOf({ nodes: [node('root', '$root', 'ready', null)] }),
  );
  assert.equal(model.nodes_read, 0);
  assert.equal(model.total, 0);
  const html = renderBoardPage(model);
  assert.ok(html.includes('No tasks in this tree'));
  assert.equal(html.includes('could not be placed'), false);
});

test('a task without a status row is flagged as missing a status', () => {
  const model = buildTree(
    snapshotOf({ nodes: [node('a', 'alpha', 'ready', null)] }),
  );
  assert.equal(model.roots[0].status_missing, true);
  const html = renderBoardPage(model);
  assert.ok(html.includes('No status row came back for this task.'));
});

test('a graph/status rest_state disagreement is flagged', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('a', 'alpha', 'ready', null)],
      statuses: [statusOf('a', 'done')],
    }),
  );
  assert.equal(model.roots[0].rest_state, 'done');
  assert.equal(model.roots[0].rest_state_mismatch, true);
  const html = renderBoardPage(model);
  assert.ok(html.includes("graph and the status read disagree on this task's state"));
});

test('a null rest_state is a flagged missing value, not a crash', () => {
  const model = buildTree(
    snapshotOf({ nodes: [node('a', 'alpha', null, null)] }),
  );
  const html = renderBoardPage(model);
  assert.equal(model.unknown_rest_states, 1);
  // Slice 6: the raw engine string is an attribute for the panel, never a
  // sentence on the card. The card says the plain fact.
  assert.ok(html.includes('The engine reported a state this page does not know.'));
  assert.equal(
    html.includes('a state this board does not know: <span class="mono">'),
    false,
  );
  assert.equal(
    Object.values(model.counts).reduce((sum, count) => sum + count, 0),
    0,
  );
});

test('the committed pages are the Board and List pages of the capture', () => {
  // The owner opens the real tree, not the demo. The committed pages are built
  // from the same capture this suite reads, so the no-JS page and the capture
  // cannot drift into two trees. The provenance line says which source it was
  // and when, without pinning the page to a literal.
  const index = readFileSync(join(board, 'index.html'), 'utf8');
  const list = readFileSync(join(board, 'list.html'), 'utf8');
  const capture = fixtureModel();

  assert.ok(index.includes('<body data-page="board">'), 'index.html is the Board');
  assert.ok(list.includes('<body data-page="list">'), 'list.html is the List');
  for (const html of [index, list]) {
    assert.equal(/<script[^>]+src=/.test(html), false, 'no external script');
    assert.equal(/(src|href)="https?:/.test(html), false, 'no network request');
    assert.ok(html.includes('Where this page came from'));
    assert.ok(html.includes(capture.provenance.engine_commit));
    // Shape, not a literal: a live read or a fixture capture, dated.
    assert.match(html, /(Live read|Fixture capture) on <time datetime="[^"]+">/);
    assert.match(html, /Engine <span class="mono">[^<]+<\/span>, schema \d+\./);
  }
  assert.ok(list.includes('Showing everything'));
  assert.equal(capture.total, 6);
  assert.equal(capture.max_depth, 0);
  // Every placed row is in the no-JS list, so the page really carries the tree
  // the capture names and not a smaller sample.
  assert.equal(
    (index.match(/<li data-task="/g) ?? []).length,
    capture.total,
  );
  assert.ok(index.includes('data-key="summarise"'));
  assert.ok(index.includes('4 of 6</strong> done'));
});

// ---------------------------------------------------------------- slice 3

test('containment is the rollup over children on a three-level tree', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('a', 'alpha', 'ready', null),
        node('b', 'alpha/beta', 'ready', 'a'),
        node('c', 'alpha/beta/gamma', 'done', 'b'),
        node('d', 'alpha/delta', 'draft', 'a'),
      ],
    }),
  );
  const byKey = new Map(flattenTree(model.roots).map((row) => [row.node_key, row]));

  assert.deepEqual(containment(byKey.get('alpha')), {
    inside: 3,
    done: 1,
    archived: 0,
  });
  assert.deepEqual(containment(byKey.get('alpha/beta')), {
    inside: 1,
    done: 1,
    archived: 0,
  });
  assert.deepEqual(containment(byKey.get('alpha/beta/gamma')), {
    inside: 0,
    done: 0,
    archived: 0,
  });
  assert.deepEqual(progress(model.roots), {
    done: 1,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    total: 4,
    archived: 0,
  });
  // The renderer prints the same numbers the rollup returns.
  const html = renderBoardPage(model);
  assert.ok(html.includes('3 inside · 1 done'));
  assert.ok(html.includes('1 inside · 1 done'));
  // The panel's Inside field uses the same rollup, not the level's row count.
  assert.equal(
    detailFields(byKey.get('alpha'), model).find((field) => field.label === 'Inside')
      .value,
    '3 inside · 1 done',
  );
});

test('an empty lane is not drawn; the rest are counted once', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', 'root', 'ready', null),
        node('c', 'root/only', 'draft', 'r'),
      ],
    }),
  );
  const plan = lanePlan(model.roots[0].children);
  assert.equal(plan.lanes.length, 1);
  assert.equal(plan.lanes[0].lane, 'not-started');
  assert.equal(plan.empty, LANE_ORDER.length - 1);

  const html = renderBoardPage(model);
  // The page ships the plan as data, so the script draws the plan the tests
  // check instead of a second copy of the lane rules.
  assert.ok(html.includes(`"empty":${LANE_ORDER.length - 1}`));
  assert.equal(html.includes('class="lane is-empty"'), false);
  assert.equal(html.includes('Empty.'), false);
});

test('a genuinely empty scope says it has no subtasks, not "lanes empty"', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', 'root', 'ready', null),
        node('c', 'root/leaf', 'draft', 'r'),
      ],
    }),
  );
  const html = renderBoardPage(model);
  assert.ok(html.includes('No subtasks. Nothing sits under this task.'));
  // The leaf's own scope is empty and must not claim eight empty lanes.
  assert.equal(boardData(model).scopes['root/leaf'].lanes.length, 0);
  assert.equal(boardData(model).scopes['root/leaf'].empty, LANE_ORDER.length);
  // B-3: emptiness is never announced anywhere on the page.
  assert.equal((html.match(/lanes empty/g) ?? []).length, 0);
});

test('the lane map is total over the engine states and has one many-to-one entry', () => {
  // The exact table R1 names. A new engine state that is not added here fails
  // the first assertion; a state that is added to the wrong lane fails the
  // expected comparison. That is the mutation this test kills.
  const expected = {
    draft: 'not-started',
    ready: 'can-start',
    waiting: 'waiting-for-someone',
    blocked: 'waiting-for-other-work',
    failed: 'needs-attention',
    done: 'done',
    skipped: 'set-aside',
    cancelled: 'set-aside',
  };
  for (const state of REST_STATES) {
    assert.equal(laneOf(state, null), expected[state], `${state} has a lane`);
    assert.ok(LANE_ORDER.includes(laneOf(state, null)), `${state} is a lane word`);
  }
  // Only Set aside takes two engine states. Every other lane is one-to-one.
  const grouped = new Map();
  for (const state of REST_STATES) {
    const lane = laneOf(state, null);
    grouped.set(lane, [...(grouped.get(lane) ?? []), state]);
  }
  const many = [...grouped.entries()]
    .filter(([, states]) => states.length > 1)
    .map(([lane, states]) => [lane, states.slice().sort()]);
  assert.deepEqual(many, [['set-aside', ['cancelled', 'skipped']]]);

  // An active attempt wins over the rest state: the row is in progress.
  for (const phase of ['claimed', 'launching', 'live', 'ending']) {
    assert.equal(laneOf('ready', phase), 'in-progress');
  }
  assert.equal(laneOf('ready', 'ended'), 'can-start');
  // A state this build does not know is not allowed to borrow a lane.
  assert.equal(laneOf('mystery', null), 'unknown');
});

test('the lane plan groups by the map, and unknown has its own lane', () => {
  // A done child lands in the done lane, not in a lane chosen by document order.
  const done = laneGroups(['done'], LANE_ORDER);
  assert.deepEqual(done.lanes, ['done']);
  assert.equal(done.empty, LANE_ORDER.length - 1);

  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', 'root', 'ready', null),
        node('c', 'root/child', 'done', 'r'),
      ],
    }),
  );
  const plan = lanePlan(model.roots[0].children);
  assert.deepEqual(plan.lanes.map((group) => group.lane), ['done']);
  assert.deepEqual(plan.lanes[0].cards.map((row) => row.node_key), ['root/child']);

  // A state this build does not know gets one lane of its own; the vocabulary
  // lanes stay empty and the unknown lane is not counted as one.
  const bogus = laneGroups(['mystery'], LANE_ORDER);
  assert.deepEqual(bogus.lanes, ['unknown']);
  assert.equal(bogus.empty, LANE_ORDER.length);

  const unknown = buildTree(
    snapshotOf({
      nodes: [
        node('r', 'root', 'ready', null),
        node('c', 'root/odd', 'mystery', 'r'),
      ],
    }),
  );
  const scopes = boardData(unknown).scopes;
  assert.deepEqual(scopes.root.lanes, [{ lane: 'unknown', tasks: ['c'] }]);
  assert.equal(scopes.root.empty, LANE_ORDER.length);
});

test('an unknown state is named Unknown state with the engine string, before script', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', 'root', 'ready', null),
        node('c', 'root/odd', 'mystery', 'r'),
      ],
    }),
  );
  const row = flattenTree(model.roots).find(
    (candidate) => candidate.node_key === 'root/odd',
  );
  assert.equal(row.rest_state_known, false);
  const html = renderListPage(model);
  // The row's state is a label, never blank: a state this build does not know
  // reads `Unknown state`, with the engine's raw string named beside it.
  assert.ok(
    html.includes('<span class="dot" aria-hidden="true"></span>Unknown state</span>'),
  );
  // Slice 6: the engine's raw string left the reading surface. It is in the
  // row's data attributes and behind the panel's More, where a diagnosis lives.
  assert.equal(
    html.includes('a state this board does not know: <span class="mono">mystery</span>'),
    false,
  );
  const sections = detailSections(row, model);
  // The state line under the title says Unknown state; the engine string is
  // only in the data attribute and behind More.
  assert.equal(
    sections.primary.some((field) => field.value === 'mystery'),
    false,
  );
  assert.equal(
    sections.more.find((field) => field.label === 'Engine state').value,
    'mystery',
  );
});

test('a blocked card names a blocker outside its own level by title', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('b', 'beta', 'ready', null, { title: 'Check the unit tests' }),
        node('c', 'beta/child', 'blocked', 'b'),
      ],
      edges: [{ from: 'b', to: 'c', kind: 'blocked_by' }],
    }),
  );
  const html = renderBoardPage(model);
  assert.ok(
    html.includes('Waiting for: Check the unit tests'),
    'the scope node is not a card in its own level, so the title must be read from the tree',
  );
  assert.equal(/Waiting for [^<]*tsk_/.test(html), false, 'no task id on a card');
});

test('a ready card with an unsatisfied blocked_by carries the engine defect notice', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('a', 'alpha', 'ready', null, { title: 'Wire the read model' }),
        node('b', 'beta', 'waiting', null, { title: 'Check the unit tests' }),
      ],
      edges: [
        {
          from: 'b',
          to: 'a',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
      ],
    }),
  );
  const byId = new Map(flattenTree(model.roots).map((row) => [row.task_id, row]));
  const blocker = engineDisagreement(byId.get('a'), byId);
  assert.equal(blocker?.task_id, 'b');

  const html = renderBoardPage(model);
  assert.ok(html.includes('Engine defect'));
  assert.ok(html.includes('recorded ready, but Check the unit tests is waiting'));
  // The unfolded List uses the reader's lane word too; the engine's word lives
  // in the data attributes and behind the panel's More.
  assert.ok(html.includes('Can start now'));
});

test('a blocker the edge accepts is not a disagreement, whatever its state', () => {
  const cases = [
    ['failed', ['done', 'failed']],
    ['skipped', ['done', 'skipped']],
  ];
  for (const [state, satisfiedBy] of cases) {
    const model = buildTree(
      snapshotOf({
        nodes: [
          node('a', 'alpha', 'ready', null, { title: 'Ship the thing' }),
          node('b', 'beta', state, null, { title: 'Optional check' }),
        ],
        edges: [
          {
            from: 'b',
            to: 'a',
            kind: 'blocked_by',
            satisfied_by: satisfiedBy,
          },
        ],
      }),
    );
    const byId = new Map(flattenTree(model.roots).map((row) => [row.task_id, row]));
    assert.equal(
      engineDisagreement(byId.get('a'), byId),
      null,
      `a dependency satisfied by ${state} must not accuse the engine`,
    );
    const html = renderBoardPage(model);
    assert.equal(html.includes('Engine defect'), false, state);
  }
});

test('an edge that did not carry satisfied_by cannot accuse the engine', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('a', 'alpha', 'ready', null, { title: 'Ship the thing' }),
        node('b', 'beta', 'waiting', null, { title: 'Check the unit tests' }),
      ],
      // Schema 7's fixture predates `satisfied_by`; absent is "not read", and
      // not a licence to assume `done` and invent a defect.
      edges: [{ from: 'b', to: 'a', kind: 'blocked_by' }],
    }),
  );
  const byId = new Map(flattenTree(model.roots).map((row) => [row.task_id, row]));
  assert.equal(engineDisagreement(byId.get('a'), byId), null);
  assert.equal(renderBoardPage(model).includes('Engine defect'), false);
});

test('scope survives a URL round trip and the breadcrumb is the path', () => {
  assert.equal(scopeHref('board', null), '#board');
  assert.equal(scopeHref('list', 'build/render'), '#list/build/render');
  const spaced = scopeHref('board', 'build/render legend');
  assert.equal(spaced, '#board/build/render%20legend');
  assert.deepEqual(parseHash(spaced), {
    view: 'board',
    node_key: 'build/render legend',
  });
  assert.deepEqual(parseHash('#list'), { view: 'list', node_key: null });
  assert.deepEqual(parseHash('#unknown/x'), { view: null, node_key: 'x' });
  assert.deepEqual(parseHash(''), { view: null, node_key: null });
  // A malformed escape is a scope the page cannot name, not a crash.
  assert.doesNotThrow(() => parseHash('#board/%'));
  assert.deepEqual(parseHash('#board/%'), { view: 'board', node_key: null });

  const model = buildTree(
    snapshotOf({
      nodes: [
        node('tsk_root', '$root', 'ready', null),
        node('tsk_build', 'build', 'ready', 'tsk_root'),
        node('tsk_render', 'build/render', 'ready', 'tsk_build'),
        node('tsk_legend', 'build/render/legend', 'draft', 'tsk_render'),
        node('tsk_spec', 'build/spec', 'done', 'tsk_build'),
      ],
      rootTaskId: 'tsk_root',
    }),
  );
  assert.deepEqual(
    scopePath(model.roots, 'build/render/legend').map((row) => row.node_key),
    ['build', 'build/render', 'build/render/legend'],
  );
  assert.deepEqual(
    scopeChildren(model.roots, 'build/render').map((row) => row.node_key),
    ['build/render/legend'],
  );

  const data = boardData(model);
  assert.deepEqual(Object.keys(data.scopes).sort(), [
    '',
    'build',
    'build/render',
    'build/render/legend',
    'build/spec',
  ]);
  assert.deepEqual(
    data.scopes['build/render'].lanes.flatMap((lane) => lane.tasks),
    ['tsk_legend'],
  );

  const html = renderBoardPage(model);
  assert.ok(html.includes('"build/render"'));
  assert.ok(html.includes("addEventListener('hashchange'"));
});

test('the detail panel leads with the plain facts and folds the machine record', () => {
  const wait = {
    reason: 'rejected:condition:check:unit',
    cause: 'settle_rejected',
    owner: 'person:local',
    opened_at: '2026-11-25T13:17:50Z',
    expires_at: null,
    opened_by_attempt: 'att_1',
    escalation_level: 0,
    resume_at: null,
    ended_by: null,
  };
  const model = buildTree(
    snapshotOf({
      project: { max_concurrency: 2 },
      prov: provenance({ read_at: '2026-11-25T13:20:00Z' }),
      nodes: [
        node('t1', 'build/verify', 'waiting', null, {
          title: 'Check the unit tests',
        }),
      ],
      statuses: [
        statusOf('t1', 'waiting', {
          title: 'Check the unit tests',
          phase: 'ended',
          slot: 0,
          slot_limit: 2,
          runner_id: 'rnr_1',
          runner_slot: 0,
          created_at: '2026-11-25T13:00:00Z',
          updated_at: '2026-11-25T13:17:00Z',
          attempts: [
            {
              attempt_id: 'att_1',
              phase: 'ended',
              end_reason: 'ok',
              launched_at: '2026-11-25T13:16:00Z',
              ended_at: '2026-11-25T13:17:00Z',
            },
          ],
          wait,
        }),
      ],
    }),
  );
  const row = model.roots[0];
  const sections = detailSections(row, model);
  const primary = (label) =>
    sections.primary.find((field) => field.label === label);
  const more = (label) => sections.more.find((field) => field.label === label);

  // The first screen: state, who is on it, when it last changed, since when it
  // waits. No id, key, raw state, phase or slot.
  assert.deepEqual(
    sections.primary.map((field) => field.label),
    ['Doing it', 'Last change', 'Waiting since'],
  );
  assert.equal(primary('Doing it').value, 'No worker is on it');
  assert.equal(primary('Last change').value, '3 minutes ago');
  assert.equal(primary('Last change').title, '2026-11-25T13:17:00Z');
  assert.equal(primary('Waiting since').value, '2 minutes ago');

  // The machine record is all there, one disclosure down.
  assert.deepEqual(
    sections.more.map((field) => field.label),
    [
      'Task id',
      'Node key',
      'Engine state',
      'Description',
      'Contract',
      'Conversation',
      'Phase',
      'Slot',
      'Runner',
      'Created',
      'Updated',
      'Attempts',
      'Attempt id',
      'Wait reason',
      'Wait cause',
      'Wait owner',
      'Wait opened',
    ],
  );
  assert.equal(more('Engine state').value, 'waiting');
  // Ruling 2: the unread description and contract are machine facts, so they
  // moved behind More instead of being first-screen empty sections.
  assert.equal(
    more('Description').value,
    "The description was not read through this engine's read commands.",
  );
  assert.equal(
    more('Contract').value,
    "The pinned contract is not readable through this engine's read commands.",
  );
  assert.equal(
    more('Conversation').value,
    "The mirror link was not read through this engine's read commands.",
  );
  assert.equal(more('Slot').value, '0 of 2');
  assert.equal(more('Runner').value, 'rnr_1 (slot 0)');
  assert.equal(more('Created').value, '2026-11-25T13:00:00Z');
  assert.equal(more('Attempt id').value, 'att_1');
  assert.equal(more('Wait reason').value, 'rejected:condition:check:unit');

  const html = renderBoardPage(model);
  // The dialog is built on click; no inert <dialog> is shipped.
  assert.equal((html.match(/<dialog/g) ?? []).length, 0);
  const primaryFacts = sheetFieldsHtml(sections.primary);
  const moreFacts = sheetFieldsHtml(sections.more);
  assert.equal(primaryFacts.includes('not reported'), false);
  assert.equal(/tsk_|rest_state|slot \d/.test(primaryFacts), false);
  for (const field of [...sections.primary, ...sections.more]) {
    const facts = sections.primary.includes(field) ? primaryFacts : moreFacts;
    assert.ok(
      facts.includes(`<dt>${field.label}</dt>`),
      `missing <dt>${field.label}</dt>`,
    );
  }
  assert.ok(html.includes('aria-labelledby'));
  assert.ok(html.includes('Close details'));
  assert.ok(html.includes("summary.textContent = 'More'"));
  assert.ok(html.includes('<details class="provenance">'));
  assert.equal(/<details class="provenance" open/.test(html), false);
  assert.ok(html.includes('Where this page came from'));
  // The raw hold stays one disclosure down.
  assert.ok(html.includes('Raw wait'));
  assert.ok(html.includes('settle_rejected'));
  assert.ok(html.includes('Check the unit tests'));
  assert.ok(html.includes("event.key === 'Escape'"));
  assert.ok(html.includes("event.key !== 'Tab'"));
  assert.ok(html.includes("close.focus()"));
});

test('a source with no revision or read time is unknown, never Live read', () => {
  assert.equal(sourceLabel(null), 'Unknown source');
  assert.equal(
    sourceLabel(provenance({ read_at: '', engine_commit: '' })),
    'Unknown source',
  );
  for (const html of [
    renderBoardPage(
      buildTree(
        snapshotOf({
          nodes: [node('a', 'alpha', 'ready', null)],
          prov: provenance({ engine_commit: '' }),
        }),
      ),
    ),
    renderListPage(
      buildTree(
        snapshotOf({
          nodes: [node('a', 'alpha', 'ready', null)],
          prov: provenance({ read_at: '' }),
        }),
      ),
    ),
  ]) {
    assert.ok(html.includes('Unknown source'));
    assert.equal(html.includes('Live read'), false);
    assert.equal(html.includes('Fixture capture'), false);
  }
});

test('the no-JS page is the whole tree, and no dialog is shipped', () => {
  const model = fixtureModel();
  const rows = flattenTree(model.roots);
  for (const html of [renderBoardPage(model), renderListPage(model)]) {
    for (const row of rows) {
      assert.ok(html.includes(`data-key="${row.node_key}"`), `missing ${row.node_key}`);
      assert.ok(
        html.includes(`data-task="${row.task_id}"`),
        `missing row ${row.node_key}`,
      );
    }
    // The tree is hidden only by the class the inline script adds.
    assert.ok(html.includes('html.js .nojs-tree { display: none; }'));
    assert.equal(/(^|\n)\.nojs-tree \{ display: none; \}/.test(html), false);
    // No inert dialog per task; the one dialog is built on click.
    assert.equal((html.match(/<dialog/g) ?? []).length, 0);
    assert.equal(/<script[^>]+src=/.test(html), false);
  }
  const boardHtml = renderBoardPage(model);
  // The board's no-JS floor is the List body: one stacked tree, not one
  // section per scope.
  assert.ok(boardHtml.includes('<div class="nojs-tree" id="tree-source">'));
  assert.equal((boardHtml.match(/class="scope-view"/g) ?? []).length, 0);
  assert.equal((boardHtml.match(/<ul class="tree">/g) ?? []).length, 1);
  // A task id is never a label.
  assert.equal(/>tsk_[A-Za-z0-9]+</.test(boardHtml), false);
});

test('the progress line and no Map tab are on both views', () => {
  const model = fixtureModel();
  for (const html of [renderBoardPage(model), renderListPage(model)]) {
    assert.ok(html.includes('4 of 6</strong> done'));
    assert.ok(html.includes('class="progress-fill'));
    assert.equal(html.includes('>Map<'), false);
    assert.equal(html.includes('data-view-link="map"'), false);
  }
});

test('the live source refuses a status read that omits a tree task', async () => {
  const source = createLiveSource({
    enginePath: '/engine',
    dbPath: '/db.sqlite3',
    command: async (args) => {
      if (args[0] === 'graph') {
        return JSON.stringify({
          nodes: [
            { task_id: 'tsk_root', node_key: '$root', rest_state: 'ready', parent_task_id: null },
            { task_id: 'tsk_a', node_key: 'build', rest_state: 'ready', parent_task_id: 'tsk_root' },
          ],
          edges: [],
          next_cursor: null,
        });
      }
      if (args[0] === 'status') {
        return JSON.stringify({
          tasks: [
            { task_id: 'tsk_root', rest_state: 'ready', phase: null, wait: null, hold: null },
          ],
        });
      }
      throw new Error(`unexpected ${args[0]}`);
    },
    readCommit: async () => 'abc1234',
  });
  await assert.rejects(
    source.load({
      project_id: 'p',
      tree_key: 'tree-1',
      root_task_id: 'tsk_root',
    }),
    /status read omitted 1 tree task/,
  );
});

test('the live source reads the CLI, normalizes the edge shape and declares provenance', async () => {
  const seen = [];
  const payloads = {
    graph: JSON.stringify({
      nodes: [
        {
          task_id: 'tsk_root',
          node_key: '$root',
          rest_state: 'ready',
          parent_task_id: null,
          tree_key: 'tree-1',
        },
        {
          task_id: 'tsk_a',
          node_key: 'build',
          rest_state: 'ready',
          parent_task_id: 'tsk_root',
          tree_key: 'tree-1',
          title: 'Build the board',
        },
        {
          task_id: 'tsk_b',
          node_key: 'build/check',
          rest_state: 'blocked',
          parent_task_id: 'tsk_a',
          tree_key: 'tree-1',
          title: 'Check the unit tests',
        },
      ],
      edges: [
        {
          blocker_task_id: 'tsk_b',
          blocked_task_id: 'tsk_a',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
      ],
      next_cursor: null,
    }),
    status: JSON.stringify({
      tasks: [
        { task_id: 'tsk_root', rest_state: 'ready', phase: null, slot: null, wait: null, hold: null, handoff_revision: 0 },
        { task_id: 'tsk_a', rest_state: 'ready', phase: null, slot: null, wait: null, hold: null, handoff_revision: 1 },
        { task_id: 'tsk_b', rest_state: 'blocked', phase: null, slot: null, wait: null, hold: null, handoff_revision: 1 },
      ],
    }),
    project: JSON.stringify({ project_id: 'p', config_revision: 3, max_concurrency: 2 }),
    runners: JSON.stringify({
      runners: [
        {
          runner_id: 'rnr_1',
          project_id: 'p',
          kind: 'stub',
          endpoint: null,
          tags: ['exec:ai'],
          capacity: 2,
          enabled: true,
          heartbeat_at: null,
          created_at: '2026-06-01T00:00:00Z',
        },
      ],
    }),
    store: JSON.stringify({ schema_revision: 7, indexes: {}, checks: {} }),
  };
  const source = createLiveSource({
    enginePath: '/engine',
    dbPath: '/db.sqlite3',
    command: async (args) => {
      seen.push(args);
      if (args[0] === 'graph') return payloads.graph;
      if (args[0] === 'status') return payloads.status;
      if (args[0] === 'project') return payloads.project;
      if (args[0] === 'runner') return payloads.runners;
      return payloads.store;
    },
    readCommit: async () => 'abc1234',
    now: () => new Date('2026-06-01T00:00:00Z'),
  });

  const snapshot = await source.load({
    project_id: 'p',
    tree_key: 'tree-1',
    root_task_id: 'tsk_root',
  });

  assert.equal(snapshot.provenance.source_kind, 'live');
  assert.equal(snapshot.provenance.engine_commit, 'abc1234');
  assert.equal(snapshot.provenance.schema_revision, 7);
  assert.equal(snapshot.provenance.read_at, '2026-06-01T00:00:00.000Z');
  assert.deepEqual(snapshot.provenance.port_only_steps, []);
  // The graph holds only `ready` and `blocked`, and the read says so.
  assert.deepEqual(snapshot.provenance.unobserved_states, [
    'draft',
    'waiting',
    'done',
    'failed',
    'cancelled',
    'skipped',
  ]);
  assert.ok(
    snapshot.provenance.operations.some((operation) =>
      operation.startsWith('task runner list --project p'),
    ),
  );
  assert.deepEqual(snapshot.graph.edges, [
    { from: 'tsk_b', to: 'tsk_a', kind: 'blocked_by', satisfied_by: ['done'] },
  ]);
  assert.equal(snapshot.runners_available, true);
  assert.deepEqual(snapshot.runners.map((runner) => runner.runner_id), ['rnr_1']);
  assert.equal(snapshot.tree_key, 'tree-1');

  const graphCall = seen.find((args) => args[0] === 'graph');
  assert.ok(graphCall.includes('--tree'));
  assert.ok(graphCall.includes('tsk_root'));
  const statusCall = seen.find((args) => args[0] === 'status');
  assert.ok(statusCall.includes('tsk_a') && statusCall.includes('tsk_b'));
  const runnerCall = seen.find((args) => args[0] === 'runner');
  assert.deepEqual(runnerCall, ['runner', 'list', '--project', 'p', '--json']);

  const model = buildTree(snapshot);
  assert.equal(model.roots[0].node_key, 'build');
  assert.equal(model.roots[0].title, 'Build the board');
});

test('the live source accepts the single-id status shape and refuses a wrong tree', async () => {
  const graph = JSON.stringify({
    nodes: [
      { task_id: 'tsk_root', node_key: '$root', rest_state: 'ready', parent_task_id: null },
    ],
    edges: [],
    next_cursor: null,
  });
  const source = createLiveSource({
    enginePath: '/engine',
    dbPath: '/db.sqlite3',
    command: async (args) => {
      if (args[0] === 'graph') return graph;
      if (args[0] === 'status') {
        // G10a: one id prints the object itself, not `{tasks}`.
        return JSON.stringify({
          task_id: 'tsk_root',
          rest_state: 'ready',
          phase: null,
          slot: null,
          wait: null,
          hold: null,
          handoff_revision: 0,
        });
      }
      if (args[0] === 'project') {
        return JSON.stringify({ project_id: 'p', config_revision: 1 });
      }
      if (args[0] === 'runner') {
        return JSON.stringify({ runners: [] });
      }
      return JSON.stringify({ schema_revision: 7 });
    },
    readCommit: async () => 'abc1234',
  });
  const snapshot = await source.load({
    project_id: 'p',
    tree_key: 'tree-1',
    root_task_id: 'tsk_root',
  });
  assert.equal(snapshot.statuses.length, 1);

  await assert.rejects(
    source.load({ project_id: 'p', tree_key: 'tree-1', root_task_id: 'tsk_other' }),
    /not in the graph read/,
  );
});


// ---------------------------------------------------------------- slice 4

function liveSourceWith(graphPayload) {
  return createLiveSource({
    enginePath: '/engine',
    dbPath: '/db.sqlite3',
    command: async (args) => {
      if (args[0] === 'graph') return JSON.stringify(graphPayload);
      if (args[0] === 'status') {
        return JSON.stringify({
          tasks: graphPayload.nodes.map((entry) => ({
            task_id: entry.task_id,
            rest_state: entry.rest_state,
            phase: null,
            slot: null,
            wait: null,
            hold: null,
            handoff_revision: 0,
          })),
        });
      }
      if (args[0] === 'project') {
        return JSON.stringify({ project_id: 'p', config_revision: 1 });
      }
      if (args[0] === 'runner') {
        return JSON.stringify({ runners: [] });
      }
      return JSON.stringify({ schema_revision: 7 });
    },
    readCommit: async () => 'abc1234',
  });
}

test('a tree read that cannot prove it is whole is refused', async () => {
  const nodes = [
    {
      task_id: 'tsk_root',
      node_key: '$root',
      rest_state: 'ready',
      parent_task_id: null,
      tree_key: 'tree-1',
    },
    {
      task_id: 'tsk_a',
      node_key: 'build',
      rest_state: 'ready',
      parent_task_id: 'tsk_root',
      tree_key: 'tree-1',
    },
  ];
  const request = { project_id: 'p', tree_key: 'tree-1', root_task_id: 'tsk_root' };

  await assert.rejects(
    liveSourceWith({
      nodes,
      edges: [],
      next_cursor: null,
      truncated: true,
      omitted: 1,
    }).load(request),
    /truncated: 1 tasks omitted/,
  );

  await assert.rejects(
    liveSourceWith({ nodes, edges: [], next_cursor: 'cur_1' }).load(request),
    /graph tree read is paged \(next_cursor cur_1\); this is not a whole tree/,
  );

  // A payload that does not carry the key at all has not declared completeness;
  // that is a different failure from a paged read, and it says which.
  await assert.rejects(
    liveSourceWith({ nodes, edges: [] }).load(request),
    /did not declare completeness: next_cursor is missing/,
  );

  const whole = await liveSourceWith({
    nodes,
    edges: [],
    next_cursor: null,
  }).load(request);
  assert.equal(whole.graph.nodes.length, 2);
});

test('duplicate task_id rows in a graph payload are one row, not two roots', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('a', 'alpha', 'ready', 'root', { title: 'First read' }),
        node('a', 'alpha', 'done', 'root', { title: 'Second read' }),
        node('b', 'beta', 'ready', 'root'),
      ],
    }),
  );
  assert.equal(model.total, 2);
  assert.deepEqual(
    flattenTree(model.roots).map((row) => row.node_key),
    ['alpha', 'beta'],
  );
  assert.equal(model.roots.length, 2, 'the duplicate is not a second root');
  // First row wins, so the duplicate's `done` does not change the counts.
  assert.equal(model.roots[0].rest_state, 'ready');
  assert.deepEqual(progress(model.roots), {
    done: 0,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    total: 2,
    archived: 0,
  });
  // The difference is stated, not silent: one defective read, named.
  assert.deepEqual(model.defects, [
    { kind: 'duplicate', tasks: 1, keys: ['alpha'] },
  ]);
  const html = renderBoardPage(model);
  assert.ok(html.includes('aria-label="Read defects"'));
  assert.ok(
    html.includes(
      '<li data-kind="duplicate"><span class="defect-kind">Duplicate rows</span>: 1 task id was read twice; the first read of each was kept (<span class="mono">alpha</span>).</li>',
    ),
  );
});

test('archived rows stay in the tree, labelled, and out of the live count', () => {
  const archivedAt = '2026-11-01T00:00:00Z';
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('container', '$root', 'ready', null, { archived_at: archivedAt }),
        node('alpha', 'alpha', 'done', 'container'),
        node('a1', 'alpha/old', 'done', 'alpha', { archived_at: archivedAt }),
        node('a2', 'alpha/live', 'ready', 'alpha'),
        node('beta', 'beta', 'done', 'container', { archived_at: archivedAt }),
      ],
      rootTaskId: 'container',
    }),
  );
  assert.equal(model.tree_state, 'archived');
  assert.equal(model.roots[0].archived_at, null);
  assert.equal(model.roots[0].children[0].archived_at, archivedAt);

  // Never `of N`: archived work is named beside the live count.
  assert.deepEqual(progress(model.roots), {
    done: 1,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    total: 2,
    archived: 2,
  });
  const byKey = new Map(flattenTree(model.roots).map((row) => [row.node_key, row]));
  // Archived descendants are their own bucket, not live `inside` work.
  assert.deepEqual(containment(byKey.get('alpha')), {
    inside: 1,
    done: 0,
    archived: 1,
  });

  const html = renderBoardPage(model);
  assert.ok(html.includes('1 of 2</strong> done'));
  assert.ok(html.includes('· 2 archived'));
  assert.ok(html.includes('data-tree-state="archived"'));
  assert.ok(html.includes("DATA.tree_state === 'archived'"));
  // Labelled, never hidden.
  assert.ok(html.includes('data-key="beta"'));
  assert.ok(html.includes('data-archived-self="1"'));
  assert.ok(html.includes('<span class="archived-tag">Archived</span>'));
  assert.ok(html.includes("archivedChip.textContent = 'Archived'"));
});

test('a tree with only archived rows says no live tasks, not no tasks', () => {
  const archivedAt = '2026-11-01T00:00:00Z';
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('container', '$root', 'ready', null, { archived_at: archivedAt }),
        node('alpha', 'alpha', 'done', 'container', { archived_at: archivedAt }),
      ],
      rootTaskId: 'container',
    }),
  );
  assert.deepEqual(progress(model.roots), {
    done: 0,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    total: 0,
    archived: 1,
  });
  const html = renderBoardPage(model);
  assert.ok(html.includes('No live tasks'));
  assert.ok(html.includes('· 1 archived'));
  assert.equal(html.includes('No tasks in this tree'), false);
});

test('a row whose payload carried no title says so instead of passing the key off as one', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('a', 'alpha', 'ready', null)],
      statuses: [statusOf('a', 'ready')],
    }),
  );
  assert.equal(model.roots[0].title, null);
  assert.equal(model.capabilities.task_title, false);
  const html = renderBoardPage(model);
  assert.ok(
    html.includes('alpha <span class="title-missing">title not read</span>'),
  );
  assert.equal(html.includes('>alpha</button>'), false);
});

// ---------------------------------------------------------------- slice 5

function allSettled(model) {
  const terminal = new Set(['done', 'failed', 'cancelled', 'skipped']);
  let settled = true;
  const walk = (rows) => {
    for (const row of rows) {
      if (row.archived_at === null && !terminal.has(row.rest_state)) settled = false;
      walk(row.children);
    }
  };
  walk(model.roots);
  return settled;
}

test('progress is done plus the settled states, never one word for both', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'ready', null),
        node('a', 'alpha', 'skipped', 'r'),
        node('b', 'beta', 'ready', 'r'),
      ],
    }),
  );
  const p = progress(model.roots);
  assert.deepEqual(p, {
    done: 0,
    failed: 0,
    cancelled: 0,
    skipped: 1,
    total: 2,
    archived: 0,
  });
  // The denominator includes skipped work; the numerator does not absorb it.
  const html = renderBoardPage(model);
  assert.ok(html.includes('0 of 2</strong> done · 1 skipped'));
});

test('every settled row is accounted for, and every open row is visibly left over', () => {
  const settled = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'done', null),
        node('a', 'alpha', 'done', 'r'),
        node('b', 'beta', 'failed', 'r'),
        node('c', 'gamma', 'cancelled', 'r'),
        node('d', 'delta', 'skipped', 'r'),
      ],
    }),
  );
  const open = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'ready', null),
        node('a', 'alpha', 'done', 'r'),
        node('b', 'beta', 'failed', 'r'),
        node('c', 'gamma', 'skipped', 'r'),
      ],
    }),
  );
  const archived = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'ready', null),
        node('a', 'alpha', 'done', 'r', { archived_at: '2026-11-01T00:00:00Z' }),
        node('b', 'beta', 'skipped', 'r'),
      ],
    }),
  );
  for (const model of [settled, open, archived]) {
    const p = progress(model.roots);
    assert.equal(
      p.done + p.failed + p.cancelled + p.skipped === p.total,
      allSettled(model),
      'the settled buckets account for every live row iff no live row is open',
    );
    if (!allSettled(model)) {
      assert.ok(p.done + p.failed + p.cancelled + p.skipped < p.total);
    }
  }
});

test('one text builder prints the same buckets on the Board and the List', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'ready', null),
        node('a', 'alpha', 'done', 'r'),
        node('b', 'beta', 'failed', 'r'),
        node('c', 'gamma', 'cancelled', 'r'),
        node('d', 'delta', 'skipped', 'r'),
      ],
    }),
  );
  const p = progress(model.roots);
  const line = '1 of 4 done · 1 failed · 1 cancelled · 1 skipped';
  assert.equal(progressText(p), line);
  assert.ok(renderBoardPage(model).includes(line));
  assert.ok(renderListPage(model).includes(line));
});

test('a container with only archived work leads with the archived count', () => {
  const archivedAt = '2026-11-01T00:00:00Z';
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'ready', null),
        node('box', 'box', 'done', 'r'),
        node('a', 'box/old-a', 'done', 'box', { archived_at: archivedAt }),
        node('b', 'box/old-b', 'done', 'box', { archived_at: archivedAt }),
      ],
    }),
  );
  const row = flattenTree(model.roots).find(
    (candidate) => candidate.node_key === 'box',
  );
  assert.equal(containment(row).inside, 0);
  assert.equal(
    detailFields(row, model).find((field) => field.label === 'Inside').value,
    '2 archived inside · no live work',
  );
  assert.equal(
    boardData(model).rows.box.contained,
    '2 archived inside · no live work',
  );
  const html = renderBoardPage(model);
  assert.ok(
    html.includes('>2 archived inside · no live work</button>'),
  );
});

test('the container counts line is a facts button, named for what it opens', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'ready', null),
        node('box', 'box', 'ready', 'r', { title: 'Box of work' }),
        node('a', 'box/alpha', 'done', 'box'),
        node('b', 'box/beta', 'ready', 'box'),
      ],
    }),
  );
  const html = renderBoardPage(model);
  assert.ok(
    html.includes(
      '<button type="button" class="row-count" data-dialog="d-box" data-task="box" aria-label="Facts for Box of work, 2 inside · 1 done">2 inside · 1 done</button>',
    ),
  );
  // A title that was read costs no page bytes and no flag.
  assert.equal(boardData(model).rows.box.title_missing, undefined);
});

test('the page data carries the title fact and the scope facts target', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('r', '$root', 'ready', null),
        node('box', 'box', 'ready', 'r'),
        node('a', 'box/alpha', 'ready', 'box'),
      ],
    }),
  );
  const data = boardData(model);
  // A missing title is a fact in the data, not an attribute the script reads.
  assert.equal(data.rows.a.title_missing, true);
  assert.equal(data.rows.box.title_missing, true);
  // The reserved `$root` row is not a card, so it is not in the page data.
  assert.equal('r' in data.rows, false);
  // The scope's own row is where its Details control points.
  assert.deepEqual(data.scopes.box.details, { dialog: 'd-box', task: 'box' });
  assert.deepEqual(data.scopes['box/alpha'].details, {
    dialog: 'd-a',
    task: 'a',
  });
  assert.equal(data.scopes[''].details, null);
  assert.equal(data.rows.box.contained, '1 inside · 0 done');
  // A leaf draws no counts line, so it carries no contained string.
  assert.equal('contained' in data.rows.a, false);
});


// ---------------------------------------------------------------- slice 6

test('human timestamps say minutes, yesterday, a day, and a year only when it differs', () => {
  const now = '2026-11-25T12:00:00Z';
  assert.equal(humanTime('2026-11-25T11:56:00Z', now), '4 minutes ago');
  assert.equal(humanTime('2026-11-25T11:59:30Z', now), 'just now');
  assert.equal(humanTime('2026-11-25T09:00:00Z', now), '3 hours ago');
  assert.equal(humanTime('2026-11-24T18:00:00Z', now), 'yesterday');
  assert.equal(humanTime('2026-11-22T18:00:00Z', now), '3 days ago');
  assert.equal(humanTime('2026-11-14T18:00:00Z', now), '14 Nov');
  assert.equal(humanTime('2025-11-20T18:00:00Z', now), '20 Nov 2025');
  assert.equal(humanTime('', now), '');
  assert.equal(humanTime('not a date', now), '');
  assert.equal(humanMoment('2026-11-25T12:00:00Z'), '25 Nov 2026, 12:00');
});

test('the on-page timestamp carries the exact ISO value in its title, never as text', () => {
  const model = buildTree(
    snapshotOf({
      prov: provenance({ read_at: '2026-11-25T12:00:00Z' }),
      nodes: [node('t1', 'task', 'ready', null, { title: 'Do the thing' })],
      statuses: [
        statusOf('t1', 'ready', {
          title: 'Do the thing',
          updated_at: '2026-11-25T11:56:00Z',
        }),
      ],
    }),
  );
  const sections = detailSections(model.roots[0], model);
  const lastChange = sections.primary.find((field) => field.label === 'Last change');
  assert.equal(lastChange.value, '4 minutes ago');
  assert.equal(lastChange.title, '2026-11-25T11:56:00Z');
  const facts = sheetFieldsHtml(sections.primary);
  assert.equal(/<dd[^>]*>[^<]*2026-11-25T11:56:00Z/.test(facts), false);
  assert.ok(facts.includes('title="2026-11-25T11:56:00Z"'));
});

test('the header counts are the lanes, split by running and ready', () => {
  assert.deepEqual(
    focusCounts([
      { rest_state: 'ready', phase: 'live' },
      { rest_state: 'ready', phase: null },
      { rest_state: 'ready', phase: 'ended' },
      { rest_state: 'waiting', phase: null },
      { rest_state: 'blocked', phase: null },
      { rest_state: 'done', phase: null },
      { rest_state: 'draft', phase: null },
    ]),
    { canStart: 2, waiting: 2, inProgress: 1 },
  );
});

test('the provenance details is closed and the reading surface carries no ISO text', () => {
  const html = renderBoardPage(fixtureModel());
  assert.ok(html.includes('<details class="provenance">'));
  assert.equal(/<details class="provenance"[^>]*\sopen/.test(html), false);
  assert.ok(html.includes('<summary>Where this page came from</summary>'));
  // The exact value exists, but only as a datetime/title attribute.
  assert.equal(
    (html.match(/>[^<]*\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ[^<]*</g) ?? []).length,
    0,
  );
});

// ---------------------------------------------------------------- slice 8
// The reading half: what is inside a task, and how tasks connect.

test('the breadcrumb has a name and sits above the level title', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('b', 'build', 'ready', 'root', { title: 'Build the engine' }),
        node('r', 'build/render', 'ready', 'b', { title: 'Render the tree' }),
      ],
      treeKey: 'tree',
      rootTaskId: 'root',
    }),
  );
  const html = renderBoardPage(model);
  // The trail is a named navigation, built on every scope render.
  assert.ok(html.includes("nav.setAttribute('aria-label', 'Breadcrumb')"));
  assert.ok(html.includes("nav.className = 'crumbs'"));
  assert.ok(html.includes('aria-current'));
  // Every ancestor is an anchor to that scope; the current level is text.
  assert.ok(html.includes("anchor.href = '#board' + encodeKey(key)"));
  assert.ok(html.includes("mark.setAttribute('aria-current', 'page')"));
});

test('the top-left word is a link home on both views', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('b', 'build', 'ready', null, { title: 'Build the engine' })],
    }),
  );
  for (const html of [renderBoardPage(model), renderListPage(model)]) {
    assert.ok(
      html.includes('<a class="brand" href="index.html#board" data-home-link="board">Engine board</a>'),
    );
  }
});

test('the document title follows the default scope', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('b', 'build', 'ready', null, { title: 'Build the engine' })],
    }),
  );
  assert.ok(
    renderBoardPage(model).includes('<title>Build the engine · Engine board</title>'),
  );
  assert.ok(
    renderListPage(model).includes(
      '<title>Build the engine · Engine board — everything</title>',
    ),
  );
  // The inline script rewrites it when the hash changes.
  const html = renderBoardPage(model);
  assert.ok(html.includes("var suffix = page === 'list' ? 'Engine board — everything' : 'Engine board'"));
  assert.ok(html.includes('document.title = name + \' · \' + suffix'));
});

test('only an edge with both ends in the level is drawable', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('p', 'plan', 'ready', null),
        node('a', 'plan/a', 'done', 'p'),
        node('b', 'plan/b', 'blocked', 'p'),
        node('c', 'plan/c', 'blocked', 'p'),
        node('outside', 'other', 'done', null),
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'blocked_by' },
        { from: 'p', to: 'c', kind: 'blocked_by' },
        { from: 'b', to: 'c', kind: 'after' },
        { from: 'outside', to: 'a', kind: 'blocked_by' },
      ],
    }),
  );
  // The level's own edges are the two that connect a, b and c.
  assert.deepEqual(levelEdges(model.roots[0].children), [
    { from: 'a', to: 'b', kind: 'blocked_by' },
    { from: 'b', to: 'c', kind: 'after' },
  ]);
  assert.deepEqual(boardData(model).scopes.plan.edges, [
    { from: 'a', to: 'b', kind: 'blocked_by' },
    { from: 'b', to: 'c', kind: 'after' },
  ]);
  // The boundary edge is absent from the data the page draws from, so it
  // cannot become a line to nothing.
  assert.equal(
    boardData(model).scopes.plan.edges.some((edge) => edge.to === 'a'),
    false,
  );
  // The sentence for a boundary dependency is still the card's.
  assert.ok(renderBoardPage(model).includes("path.setAttribute('data-kind', edge.kind)"));
});

test('a body is plain paragraphs, and empty is a sentence', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('full', 'full', 'ready', null, { title: 'Has a body' }),
        node('blank', 'blank', 'ready', null, { title: 'Empty body' }),
        node('missing', 'missing', 'ready', null, { title: 'Body not read' }),
      ],
      statuses: [
        statusOf('full', 'ready', {
          // Two blank lines do not make an empty paragraph; one newline does
          // not make a new paragraph.
          body: 'The first paragraph is a sentence someone wrote.\nIt continues on the next line.\n\n\nA second paragraph says why it matters.',
        }),
        statusOf('blank', 'ready', { body: '' }),
        statusOf('missing', 'ready', {}),
      ],
    }),
  );
  const rows = model.roots;
  const full = detailSections(rows[0], model).body;
  assert.equal(full.state, 'ok');
  assert.deepEqual(full.paragraphs, [
    'The first paragraph is a sentence someone wrote.\nIt continues on the next line.',
    'A second paragraph says why it matters.',
  ]);
  const blank = detailSections(rows[1], model).body;
  assert.equal(blank.state, 'empty');
  assert.deepEqual(blank.paragraphs, []);
  const missing = detailSections(rows[2], model).body;
  assert.equal(missing.state, 'not-read');
  // No markdown machinery: a `#` or `**` is just characters.
  const html = renderBoardPage(model);
  // Ruling 2: an absent description is not a `No description yet` section.
  assert.equal(html.includes('No description yet'), false);
  assert.equal(html.includes('marked'), false);
});

test('a body is text, never markup', () => {
  const longWord = 'x'.repeat(160);
  const body =
    'A <b>bold</b> claim and a </script> end.\n\nThen one word: ' + longWord + '.';
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('html', 'html', 'ready', 'root', { title: 'Has brackets' }),
      ],
      statuses: [statusOf('html', 'ready', { body })],
    }),
  );
  const data = boardData(model);
  assert.deepEqual(data.rows.html.body.paragraphs, [
    'A <b>bold</b> claim and a </script> end.',
    'Then one word: ' + longWord + '.',
  ]);
  const page = renderBoardPage(model);
  // The data block escapes every `<`, so a body can never close the script
  // element it is carried in.
  assert.ok(page.includes('\\u003c'), 'the data block escapes <');
  assert.equal(page.includes('</b>'), false, 'no raw tag reaches the document');
  assert.ok(
    page.includes("textNode('sheet-paragraph', text)"),
    'a paragraph is a text node, not markup',
  );
});

test('an after edge keeps its sentence on the card the line would leave', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('root', '$root', 'ready', null),
        node('a', 'a', 'skipped', 'root', { title: 'Try the optional provider' }),
        node('b', 'b', 'ready', 'root', { title: 'Adopt it when it lands' }),
      ],
      edges: [{ from: 'a', to: 'b', kind: 'after' }],
      statuses: [statusOf('a', 'skipped'), statusOf('b', 'ready')],
    }),
  );
  // The line is only drawn above 640 px. The list body is what the card
  // clones, so the sentence has to be there for the layer to be droppable.
  const list = renderListPage(model);
  assert.ok(list.includes('card-after'), 'the card carries the after sentence');
  assert.ok(
    list.includes('Starts after: Try the optional provider'),
    'the sentence names the task it follows',
  );
});

test('each contract condition kind reads in plain words', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('t', 'task', 'ready', null)],
      statuses: [
        statusOf('t', 'ready', {
          conditions: [
            { kind: 'check', name: 'tests-pass' },
            { kind: 'verdict' },
            { kind: 'answer', field: 'ok', equals: true },
            { kind: 'child', settle: 'all_done' },
            { kind: 'evidence', evidence_kind: 'signed-build' },
            { kind: 'mystery' },
          ],
        }),
      ],
    }),
  );
  const conditions = detailSections(model.roots[0], model).conditions;
  assert.equal(conditions.state, 'ok');
  assert.deepEqual(conditions.lines, [
    'A check passes: tests-pass',
    'A person approves it',
    'An answer is recorded for ok (true)',
    'All of its child tasks are done',
    'Evidence is attached: signed-build',
    // An unknown kind is named as undescribable rather than hidden. The kind
    // itself is an engine word, so it stays behind More.
    'A condition this page cannot describe',
  ]);
  const more = detailSections(model.roots[0], model).more;
  const raw = more.find((field) => field.label === 'Contract conditions');
  assert.ok(raw, 'More carries the raw condition kinds');
  assert.ok(raw.value.includes('mystery'), raw.value);
});

test('an unreadable contract says so instead of showing an empty list', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('t', 'task', 'ready', null)],
      statuses: [statusOf('t', 'ready', {})],
    }),
  );
  const conditions = detailSections(model.roots[0], model).conditions;
  assert.equal(conditions.state, 'unread');
  assert.deepEqual(conditions.lines, []);
  assert.ok(
    renderBoardPage(model).includes(
      "The pinned contract is not readable through this engine's read commands.",
    ),
  );
});

test('the history says how many attempts and how the last one ended', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('t', 'task', 'failed', null)],
      statuses: [
        statusOf('t', 'failed', {
          attempts: [
            {
              attempt_id: 'att_1',
              ordinal: 1,
              phase: 'ended',
              end_reason: 'failed',
              end_evidence: 'exit 1: the lock was still held',
              outcome: 'failed',
            },
            {
              attempt_id: 'att_2',
              ordinal: 2,
              phase: 'ended',
              end_reason: 'failed',
              end_evidence: 'exit 1: the lock was still held',
              outcome: 'failed',
              attested_by: 'person:local',
              approved_by: 'person:lead',
            },
          ],
        }),
      ],
    }),
  );
  assert.deepEqual(historyLines(model.roots[0]), [
    'Attempted twice.',
    'The last attempt failed.',
    // The engine's `exit 1:` prefix is a machine shape; the reason is the
    // fact a reader needs, and the raw string stays in More.
    'It stopped with an error: the lock was still held.',
    'The last attempt was attested by person:local.',
    'It was approved by person:lead.',
  ]);
  const more = detailSections(model.roots[0], model).more;
  const raw = more.find((field) => field.label === 'End evidence');
  assert.equal(raw.value, 'exit 1: the lock was still held');
  const render = renderBoardPage(model);
  assert.ok(render.includes("sectionNode('What has happened', 'sheet-history')"));
  // The machine enums are folded into More, not the history sentence.
  assert.equal(
    historyLines(model.roots[0]).some((line) => line.includes('end_reason')),
    false,
  );
});

test('the conversation names the mirror, or says none is linked', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('linked', 'linked', 'ready', null),
        node('quiet', 'quiet', 'ready', null),
      ],
      statuses: [
        statusOf('linked', 'ready', { mirror: 'issue #482' }),
        statusOf('quiet', 'ready', {}),
      ],
    }),
  );
  assert.equal(
    conversationStatement(model.roots[0]),
    'The conversation lives on the issue mirror: issue #482. The engine itself keeps no comments.',
  );
  assert.equal(
    conversationStatement(model.roots[1]),
    'Comments and discussions live on the issue mirror, not in the engine. This task has no conversation linked to it.',
  );
  // Ruling 2: the task with no mirror has no Conversation section at all; the
  // sentence above is the text the panel would show if it had one.
  assert.equal(detailSections(model.roots[1], model).conversation, '');
  assert.equal(
    renderBoardPage(model).includes("if (!data.conversation) return;"),
    true,
  );
  const render = renderBoardPage(model);
  assert.ok(render.includes("sectionNode('Conversation', 'sheet-conversation')"));
  // The authoring decision changed: a note is an append to the body, and a
  // served page builds the note box on click. The file:// artefact's markup
  // still carries no textarea and no form of any kind.
  assert.equal(/<textarea/.test(render.replace(/<script[\s\S]*?<\/script>/g, '')), false);
  assert.equal(/<form/.test(render.replace(/<script[\s\S]*?<\/script>/g, '')), false);
});

test('capabilities report the reading fields the payloads carry', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [node('t', 'task', 'ready', null)],
      statuses: [
        statusOf('t', 'ready', {
          body: 'A description.',
          conditions: [{ kind: 'check', name: 'tests-pass' }],
          mirror: 'issue #1',
        }),
      ],
    }),
  );
  assert.equal(model.capabilities.task_body, true);
  assert.equal(model.capabilities.contract_conditions, true);
  assert.equal(model.capabilities.mirror_link, true);
  assert.equal(model.roots[0].body, 'A description.');
  assert.equal(model.roots[0].conditions.length, 1);
  assert.equal(model.roots[0].mirror, 'issue #1');
});

// ---------------------------------------------------------------- slice 9

test('the panel names both dependency directions, and only the edge says satisfied', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('hold', 'hold', 'ready', null, { title: 'Hold the gate' }),
        node('done-blocker', 'done-blocker', 'done', null, {
          title: 'Approve the pricing copy',
        }),
        node('waiting-blocker', 'waiting-blocker', 'waiting', null, {
          title: 'Check the release notes',
        }),
        node('after-blocker', 'after-blocker', 'skipped', null, {
          title: 'Draft the pricing model',
        }),
        node('silent-blocker', 'silent-blocker', 'done', null, {
          title: 'A done row with no accepted edge',
        }),
        node('row', 'row', 'blocked', null, {
          title: 'Sign off the pricing claims',
        }),
      ],
      statuses: [
        statusOf('hold', 'ready', { title: 'Hold the gate' }),
        statusOf('done-blocker', 'done', {
          title: 'Approve the pricing copy',
        }),
        statusOf('waiting-blocker', 'waiting', {
          title: 'Check the release notes',
        }),
        statusOf('after-blocker', 'skipped', {
          title: 'Draft the pricing model',
        }),
        statusOf('silent-blocker', 'done', {
          title: 'A done row with no accepted edge',
        }),
        statusOf('row', 'blocked', {
          title: 'Sign off the pricing claims',
        }),
      ],
      edges: [
        {
          from: 'done-blocker',
          to: 'row',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
        {
          from: 'waiting-blocker',
          to: 'row',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
        {
          from: 'after-blocker',
          to: 'row',
          kind: 'after',
          satisfied_by: ['done', 'failed', 'cancelled', 'skipped'],
        },
        // The row is done, but the read's edge accepts nothing: state alone
        // must not turn this into "Waited for".
        { from: 'silent-blocker', to: 'row', kind: 'blocked_by' },
        // The reverse direction: `row` holds `hold` up.
        {
          from: 'row',
          to: 'hold',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
      ],
    }),
  );
  const row = model.roots.find((candidate) => candidate.node_key === 'row');
  assert.ok(row, 'the blocked row is in the tree');
  const sections = detailSections(row, model);
  const waits = sections.primary.find((field) => field.label === 'Waits for');
  assert.ok(waits, 'the first screen has a Waits for field');
  assert.equal(
    waits.value,
    'Approve the pricing copy (done), Check the release notes, ' +
      'A done row with no accepted edge and Draft the pricing model (skipped).',
  );
  const holds = sections.primary.find((field) => field.label === 'Holds up');
  assert.ok(holds, 'the first screen has a Holds up field');
  assert.equal(holds.value, '1 task: Hold the gate.');
  // The satisfied and the still-waiting blocker are in one sentence, before
  // More: this is why the panel was opened.
  assert.equal(
    sections.more.some((field) => /Waits for|Holds up/.test(field.label)),
    false,
    'dependencies are not folded into More',
  );
});

test('two edges to one task: one unaccepted edge keeps it waiting', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('approve', 'approve', 'done', null, {
          title: 'Approve the pricing copy',
        }),
        node('row', 'row', 'blocked', null, {
          title: 'Sign off the pricing claims',
        }),
      ],
      statuses: [
        statusOf('approve', 'done', { title: 'Approve the pricing copy' }),
        statusOf('row', 'blocked', { title: 'Sign off the pricing claims' }),
      ],
      // The blocked_by edge accepts done; the after edge accepts only skipped.
      // The task is done, so one edge cleared and one did not. The row still
      // waits, and the panel must not say "Waited for ... done".
      edges: [
        {
          from: 'approve',
          to: 'row',
          kind: 'blocked_by',
          satisfied_by: ['done'],
        },
        {
          from: 'approve',
          to: 'row',
          kind: 'after',
          satisfied_by: ['skipped'],
        },
      ],
    }),
  );
  const row = model.roots.find((candidate) => candidate.node_key === 'row');
  const approves = model.roots.find(
    (candidate) => candidate.node_key === 'approve',
  );
  const waits = detailSections(row, model).primary.find(
    (field) => field.label === 'Waits for',
  );
  assert.equal(waits.value, 'Approve the pricing copy.');
  const holds = detailSections(approves, model).primary.find(
    (field) => field.label === 'Holds up',
  );
  assert.equal(holds.value, '1 task: Sign off the pricing claims.');
});

test('a task that holds up six names all six', () => {
  const blockers = ['one', 'two', 'three', 'four', 'five', 'six'];
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('fan', 'fan', 'waiting', null, { title: 'Publish the shared API' }),
        ...blockers.map((key) =>
          node(`fan-${key}`, `fan-${key}`, 'blocked', null, {
            title: `Uses the API ${key}`,
          }),
        ),
      ],
      statuses: [
        statusOf('fan', 'waiting', { title: 'Publish the shared API' }),
        ...blockers.map((key) =>
          statusOf(`fan-${key}`, 'blocked', { title: `Uses the API ${key}` }),
        ),
      ],
      edges: blockers.map((key) => ({
        from: 'fan',
        to: `fan-${key}`,
        kind: 'blocked_by',
        satisfied_by: ['done'],
      })),
    }),
  );
  const fan = model.roots.find((candidate) => candidate.node_key === 'fan');
  const sections = detailSections(fan, model);
  const holds = sections.primary.find((field) => field.label === 'Holds up');
  assert.ok(holds, 'the fan names what it holds up');
  assert.equal(
    holds.value,
    '6 tasks: Uses the API one, Uses the API two, Uses the API three, ' +
      'Uses the API four, Uses the API five and Uses the API six.',
  );
  assert.equal(
    detailSections(model.roots[1], model).primary.some(
      (field) => field.label === 'Waits for',
    ),
    true,
    'the other end of the same edge waits for the fan',
  );
});

test('an empty section is not drawn, and its machine fact moves to More', () => {
  const model = buildTree(
    snapshotOf({
      nodes: [
        node('quiet', 'quiet', 'ready', null, { title: 'Quiet task' }),
        node('unread', 'unread', 'ready', null, { title: 'Unread task' }),
      ],
      // Quiet carries every field the read can report, all of them empty. The
      // unread task has no status row at all.
      statuses: [
        statusOf('quiet', 'ready', {
          title: 'Quiet task',
          body: '',
          conditions: [],
          attempts: [],
          mirror: null,
          handoff_revision: 1,
        }),
      ],
    }),
  );
  const quiet = model.roots.find((candidate) => candidate.node_key === 'quiet');
  const quietSections = detailSections(quiet, model);
  assert.equal(quietSections.body.state, 'empty');
  assert.equal(quietSections.conditions.state, 'empty');
  assert.deepEqual(quietSections.history, []);
  assert.equal(quietSections.conversation, '');
  assert.deepEqual(quietSections.primary, [], 'nothing to lead with');
  const contract = quietSections.more.find((field) => field.label === 'Contract');
  assert.equal(contract.value, "This task's contract pins no conditions.");
  const attempts = quietSections.more.find((field) => field.label === 'Attempts');
  assert.equal(attempts.value, '0 runs');
  assert.equal(
    quietSections.more.some((field) => field.label === 'Description'),
    false,
    'an empty description has no fact worth printing',
  );

  const unread = model.roots.find((candidate) => candidate.node_key === 'unread');
  const unreadSections = detailSections(unread, model);
  assert.equal(unreadSections.conditions.state, 'unread');
  assert.equal(unreadSections.body.state, 'not-read');
  const unreadFacts = Object.fromEntries(
    unreadSections.more.map((field) => [field.label, field.value]),
  );
  assert.equal(
    unreadFacts.Description,
    "The description was not read through this engine's read commands.",
  );
  assert.equal(
    unreadFacts.Contract,
    "The pinned contract is not readable through this engine's read commands.",
  );

  // When no status anywhere carries a mirror, the missing Conversation
  // section is a read limit, and More carries that limit.
  const noMirrorRead = buildTree(
    snapshotOf({
      nodes: [node('x', 'x', 'ready', null, { title: 'X' })],
      statuses: [statusOf('x', 'ready', { title: 'X' })],
    }),
  );
  const limitFacts = Object.fromEntries(
    detailSections(noMirrorRead.roots[0], noMirrorRead).more.map((field) => [
      field.label,
      field.value,
    ]),
  );
  assert.equal(
    limitFacts.Conversation,
    "The mirror link was not read through this engine's read commands.",
  );

  // The client-side panel draws a section only when it has content.
  const render = renderBoardPage(model);
  assert.ok(
    render.includes("if (conditions.state !== 'ok') return;"),
    'the Done when heading is guarded',
  );
  assert.ok(
    render.includes("if (body.state !== 'ok') return;"),
    'the Description heading is guarded',
  );
  assert.ok(
    render.includes('if (lines.length === 0) return;'),
    'the What has happened heading is guarded',
  );
  assert.ok(
    render.includes('if (!data.conversation) return;'),
    'the Conversation heading is guarded',
  );
});

// ---------------------------------------------------------------- live fallback

test('a build with no store answers from the committed capture', async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'board-no-store-'));
  const source = createCliSource({
    enginePath: join(scratch, 'no-engine'),
    dbPath: join(scratch, 'no-store.sqlite3'),
    fallbackDirectory: fixtures,
  });

  const snapshot = await source.load(fixtureRequest(fixtures));
  assert.equal(snapshot.provenance.source_kind, 'fixture');
  assert.equal(snapshot.provenance.engine_commit, 'c4ccf1e');
  assert.equal(snapshot.provenance.schema_revision, 8);

  // One renderer, two sources: the fallback must paint the committed pages'
  // tree exactly, not a smaller or differently-sourced one.
  const fallback = buildTree(snapshot);
  const capture = fixtureModel();
  assert.equal(renderBoardPage(fallback), renderBoardPage(capture));
  assert.equal(renderListPage(fallback), renderListPage(capture));
});

test('a build whose store exists but cannot be read fails instead of falling back', async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'board-broken-store-'));
  const engine = join(scratch, 'engine');
  mkdirSync(join(engine, 'bin'), { recursive: true });
  const task = join(engine, 'bin', 'task');
  writeFileSync(task, '#!/bin/sh\nexit 9\n');
  chmodSync(task, 0o755);
  writeFileSync(join(scratch, 'store.sqlite3'), '');

  const source = createCliSource({
    enginePath: engine,
    dbPath: join(scratch, 'store.sqlite3'),
    fallbackDirectory: fixtures,
  });
  await assert.rejects(source.load(fixtureRequest(fixtures)), /exit|failed|code 9/i);
});

test('the live read and the committed capture render the same page', async () => {
  const meta = readFixtureMeta(fixtures);
  const payloads = {
    graph: readFileSync(join(fixtures, 'graph.json'), 'utf8'),
    status: readFileSync(join(fixtures, 'status.json'), 'utf8'),
    project: readFileSync(join(fixtures, 'project.json'), 'utf8'),
    runners: readFileSync(join(fixtures, 'runners.json'), 'utf8'),
    store: JSON.stringify({ schema_revision: meta.engine.schema_revision }),
  };
  const source = createLiveSource({
    enginePath: '/engine',
    dbPath: '/store.sqlite3',
    command: async (args) => {
      if (args[0] === 'graph') return payloads.graph;
      if (args[0] === 'status') return payloads.status;
      if (args[0] === 'project') return payloads.project;
      if (args[0] === 'runner') return payloads.runners;
      return payloads.store;
    },
    readCommit: async () => meta.engine.commit,
    now: () => new Date(meta.captured_at),
  });

  const snapshot = await source.load(fixtureRequest(fixtures));
  const capture = fixtureModel();
  const live = buildTree({
    ...snapshot,
    // Provenance is the one honest difference: a live read names itself live,
    // its own clock and the exact project it read. Everything the Board and
    // List draw comes from the payloads, which are identical here.
    provenance: capture.provenance,
  });

  assert.equal(snapshot.provenance.source_kind, 'live');
  assert.deepEqual(
    snapshot.provenance.unobserved_states,
    capture.provenance.unobserved_states,
    'a live read names the states this tree did not reach',
  );
  assert.deepEqual(live.counts, capture.counts);
  assert.equal(live.total, capture.total);
  assert.deepEqual(
    flattenTree(live.roots).map((row) => [row.node_key, row.rest_state]),
    flattenTree(capture.roots).map((row) => [row.node_key, row.rest_state]),
  );
  assert.equal(renderBoardPage(live), renderBoardPage(capture));
  assert.equal(renderListPage(live), renderListPage(capture));
});

// ---------------------------------------------------------- snapshot handover

test('a snapshot builds both served pages into --out and leaves the repo alone', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'board-snapshot-'));
  const snapshot = loadFixtureSnapshot(fixtures, readFixtureMeta(fixtures));
  const target = snapshot.graph.nodes.find(
    (node) => !node.node_key.startsWith('$'),
  );
  assert.ok(target, 'the capture has a work node to serve an action for');
  // The serve layer's two additions to the live shape: `served` on the file
  // and the actions it computed for a row.
  target.actions = [
    {
      verb: 'complete',
      label: 'Mark done',
      path: `/api/tasks/${target.task_id}/complete`,
      fields: { outcome: 'approve' },
    },
  ];
  const snapshotPath = join(scratch, 'snapshot.json');
  writeFileSync(snapshotPath, JSON.stringify({ ...snapshot, served: true }));

  const repoBefore = {
    index: readFileSync(join(board, 'index.html')),
    list: readFileSync(join(board, 'list.html')),
  };
  // A nested path that does not exist yet: --out creates it.
  const out = join(scratch, 'pages', 'nested');
  const run = spawnSync(
    process.execPath,
    [join(board, 'main.ts'), '--snapshot', snapshotPath, '--out', out],
    { encoding: 'utf8' },
  );

  assert.equal(run.status, 0, run.stderr);
  const index = readFileSync(join(out, 'index.html'), 'utf8');
  const list = readFileSync(join(out, 'list.html'), 'utf8');
  for (const html of [index, list]) {
    assert.ok(html.includes('function wireAuthoring'), 'the authoring client is on');
    assert.ok(html.includes('class="add-line"'), 'the add line is drawn');
    assert.ok(html.includes('.page-line {'), 'the authoring styles are drawn');
    assert.ok(
      html.includes(`"/api/tasks/${target.task_id}/complete"`),
      'the server action reaches the page data',
    );
    assert.ok(html.includes('"outcome":"approve"'), 'the declared field reaches it too');
  }
  // Served pages differ from the committed artefact, and the artefact is
  // byte-for-byte what it was before the run.
  assert.notEqual(index, repoBefore.index.toString('utf8'));
  assert.deepEqual(readFileSync(join(board, 'index.html')), repoBefore.index);
  assert.deepEqual(readFileSync(join(board, 'list.html')), repoBefore.list);
});

test('a missing snapshot exits non-zero, names the path, and writes nothing', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'board-snapshot-missing-'));
  const missing = join(scratch, 'not-here.json');
  const out = join(scratch, 'pages');
  const run = spawnSync(
    process.execPath,
    [join(board, 'main.ts'), '--snapshot', missing, '--out', out],
    { encoding: 'utf8' },
  );

  assert.notEqual(run.status, 0, 'a missing snapshot is not a build');
  const lines = run.stderr
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  assert.equal(lines.length, 1, `one line naming the path, got: ${run.stderr}`);
  assert.ok(lines[0].includes(missing), 'the path is named');
  assert.equal(run.stdout, '', 'nothing claims a page was written');
  assert.equal(existsSync(out), false, 'no output directory is created');
  assert.equal(existsSync(join(out, 'index.html')), false);
});
