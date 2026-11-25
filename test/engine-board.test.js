import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ATTEMPT_PHASES,
  EDGE_KINDS,
  REST_STATES,
  buildTree,
  flattenTree,
} from '../engine-board/model.ts';
import { renderBoard } from '../engine-board/render.ts';
import {
  createFixtureSource,
  loadFixtureSnapshot,
  readFixtureMeta,
} from '../engine-board/fixtures/source.ts';

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

  assert.deepEqual(Object.keys(graph).sort(), ['edges', 'nodes']);
  for (const node of graph.nodes) {
    assert.deepEqual(Object.keys(node).sort(), [
      'node_key',
      'parent_task_id',
      'rest_state',
      'task_id',
    ]);
  }
  for (const edge of graph.edges) {
    assert.deepEqual(Object.keys(edge).sort(), ['from', 'kind', 'to']);
  }

  assert.deepEqual(Object.keys(project).sort(), ['config_revision', 'project_id']);
  assert.equal(runners.runners.length, 1);
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

  assert.equal(statuses.tasks.length, graph.nodes.length);
  for (const status of statuses.tasks) {
    assert.deepEqual(Object.keys(status).sort(), [
      'handoff_revision',
      'hold',
      'phase',
      'rest_state',
      'slot',
      'task_id',
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
  assert.equal(meta.tree_key, 'engine-board-slice-1');
  assert.equal(meta.container_node_key, '$root');
  assert.ok(meta.port_only_steps.length >= 2);
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

test('the capture covers more than one rest_state and both edge kinds', () => {
  const graph = readJson('graph.json');
  const states = new Set(graph.nodes.map((node) => node.rest_state));
  assert.ok(states.size >= 5, [...states].join(','));
  assert.ok(states.has('draft'));
  assert.ok(states.has('blocked'));
  assert.ok(states.has('ready'));
  assert.ok(states.has('waiting'));
  assert.ok(states.has('done'));
  assert.deepEqual(
    [...new Set(graph.edges.map((edge) => edge.kind))].sort(),
    ['after', 'blocked_by'],
  );
});

test('buildTree hides the tree container and nests by parent_task_id', () => {
  const meta = readFixtureMeta(fixtures);
  const graph = readJson('graph.json');
  const model = fixtureModel();

  // At 41b2170 the top-level node names the root as its parent. A missing
  // parent would mean the tree read truncated, not an orphan.
  const ids = new Set(graph.nodes.map((node) => node.task_id));
  assert.equal(
    graph.nodes.find((node) => node.node_key === 'build').parent_task_id,
    meta.root_task_id,
  );
  for (const node of graph.nodes) {
    if (node.task_id === meta.root_task_id) continue;
    assert.ok(ids.has(node.parent_task_id), `${node.node_key} parent missing`);
  }

  assert.equal(model.total, 7);
  assert.ok(model.hidden_container);
  assert.equal(model.hidden_container.task_id, meta.root_task_id);
  assert.equal(model.hidden_container.node_key, '$root');
  assert.equal(model.roots.length, 1);
  assert.equal(model.roots[0].node_key, 'build');
  assert.equal(model.roots[0].rerooted, null);
  assert.equal(model.total, flattenTree(model.roots).length);
  assert.equal(model.nodes_read, 7);
  assert.equal(model.unplaced, 0);
  assert.deepEqual(model.defects, []);

  const flat = flattenTree(model.roots);
  const byKey = new Map(flat.map((row) => [row.node_key, row]));
  assert.equal(byKey.get('build/render/legend').depth, 2);
  assert.equal(byKey.get('build/render/legend').rest_state, 'draft');
  assert.equal(byKey.get('build/render').children.length, 1);
});

test('the tree reads rest_state, phase, slot, wait and blocked_by without renaming them', () => {
  const model = fixtureModel();
  const byKey = new Map(flattenTree(model.roots).map((row) => [row.node_key, row]));

  const readModel = byKey.get('build/read-model');
  assert.equal(readModel.rest_state, 'done');
  assert.equal(readModel.phase, null);
  assert.equal(readModel.slot, null);

  const render = byKey.get('build/render');
  assert.equal(render.rest_state, 'ready');
  assert.equal(render.phase, 'live');
  assert.equal(render.slot, 0);
  assert.equal(render.runner_slot, null);
  assert.equal(render.runner_slot_reported, false);
  assert.equal(render.runner_id, null);
  assert.equal(render.runner_id_reported, false);

  const verify = byKey.get('build/verify');
  assert.equal(verify.rest_state, 'waiting');
  assert.equal(verify.wait.cause, 'settle_rejected');
  assert.equal(verify.wait.reason, 'rejected:condition:check:unit');

  const integration = byKey.get('build/integration');
  assert.equal(integration.rest_state, 'blocked');
  assert.deepEqual(
    integration.blocked_by.map((ref) => ref.node_key),
    ['build/verify'],
  );
  assert.deepEqual(
    integration.after.map((ref) => ref.node_key),
    ['build/render'],
  );
});

test('counts are the rest_state enum in order, zero included', () => {
  const model = fixtureModel();
  assert.deepEqual(model.counts, {
    draft: 2,
    blocked: 1,
    ready: 2,
    waiting: 1,
    done: 1,
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
    runner_slot: false,
    runner_id: false,
    task_title: false,
    task_priority: false,
    task_tags: false,
    task_requires: false,
    tree_key_from_read: false,
    slot_limit: false,
    ended_attempt: false,
  });
  const statuses = readJson('status.json');
  for (const status of statuses.tasks) {
    assert.ok(!Object.hasOwn(status, 'runner_slot'));
    assert.ok(!Object.hasOwn(status, 'runner_id'));
  }
  const graph = readJson('graph.json');
  for (const node of graph.nodes) {
    assert.ok(!Object.hasOwn(node, 'title'));
    assert.ok(!Object.hasOwn(node, 'tree_key'));
  }
});

test('the fixture source is the one seam and refuses a different request', async () => {
  const meta = readFixtureMeta(fixtures);
  const source = createFixtureSource(fixtures);
  const snapshot = await source.load({
    project_id: meta.project_id,
    tree_key: meta.tree_key,
    root_task_id: meta.root_task_id,
  });
  assert.equal(snapshot.project.project_id, meta.project_id);
  assert.equal(snapshot.tree_key, meta.tree_key);
  assert.equal(snapshot.root_task_id, meta.root_task_id);
  assert.equal(snapshot.graph.nodes.length, readJson('graph.json').nodes.length);
  assert.equal(snapshot.runners_available, true);
  assert.equal(snapshot.provenance.source_kind, 'fixture');
  assert.equal(snapshot.provenance.read_at, meta.captured_at);
  assert.deepEqual(snapshot.provenance.operations, meta.read_verbs);

  await assert.rejects(
    source.load({
      project_id: 'some-other-project',
      tree_key: meta.tree_key,
      root_task_id: meta.root_task_id,
    }),
    /fixture project/,
  );
});

test('the rendered page is read-only, carries the engine words and states its gaps', () => {
  const html = renderBoard(fixtureModel());

  assert.match(html, /<html lang="en">/);
  for (const state of REST_STATES) {
    assert.ok(html.includes(`>${state}<`), state);
  }
  assert.ok(html.includes('rest_state'));
  assert.ok(html.includes('runner_slot'));
  assert.ok(html.includes('not reported'));
  assert.ok(html.includes('blocked_by'));
  assert.ok(html.includes('build/verify'));
  assert.ok(html.includes('tree_key'));
  assert.ok(html.includes('Read model limits'));
  assert.ok(html.includes('because the ended attempt is not readable'));
  // The row's state word carries the palette hook, not only the strip entry.
  assert.ok(html.includes('<div class="state-word" role="gridcell" data-state="ready">'));

  // The three states the capture cannot produce are marked at the strip, not
  // only in the footer.
  assert.deepEqual(readFixtureMeta(fixtures).unobserved_states, [
    'failed',
    'cancelled',
    'skipped',
  ]);
  assert.equal((html.match(/>not captured</g) ?? []).length, 3);

  assert.equal(html.includes('<button'), false);
  assert.equal(html.includes('<input'), false);
  assert.equal(html.includes('onclick='), false);
  assert.equal(html.includes(' style='), false);
});

test('the renderer escapes node keys and the tree key', () => {
  const snapshot = snapshotOf({
    nodes: [
      node('t1', '<script>alert(1)</script>', 'ready', null),
    ],
    statuses: [statusOf('t1', 'ready')],
    treeKey: '<b>tree</b>',
    rootTaskId: 'root',
  });
  const html = renderBoard(buildTree(snapshot));
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;b&gt;tree&lt;/b&gt;'));
});

test('the renderer escapes an unknown rest_state and counts it apart from zero', () => {
  const restState = '"><script>alert(2)</script>';
  const snapshot = snapshotOf({
    nodes: [node('t1', 'task', restState, null)],
  });
  const model = buildTree(snapshot);
  const html = renderBoard(model);

  assert.equal(model.unknown_rest_states, 1);
  assert.equal(model.roots[0].rest_state_known, false);
  assert.equal(html.includes(restState), false);
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;'));
  assert.ok(html.includes('unrecognized rest_state'));
  assert.ok(html.includes('1 task outside the frozen'));
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
  const html = renderBoard(buildTree(snapshot));
  assert.ok(html.includes('not reported'));
  assert.ok(html.includes('hold'));
  assert.ok(html.includes('shape changed'));
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

  const html = renderBoard(model);
  assert.ok(html.includes('Parent cycle'));
  assert.ok(html.includes('3 tasks could not be placed'));
  for (const key of ['alpha', 'beta', 'gamma']) {
    assert.ok(html.includes(key), key);
  }
  assert.equal(html.includes('No tasks in this tree.'), false);
  assert.ok(html.includes('No task could be placed.'));
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
  const html = renderBoard(model);
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
  const html = renderBoard(model);
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

  const html = renderBoard(model);
  assert.ok(html.includes('<span class="node-key">ok</span>'));
  assert.ok(html.includes('2 tasks could not be placed'));
  assert.equal(html.includes('No tasks in this tree.'), false);
  assert.equal(html.includes('No task could be placed.'), false);
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
  const html = renderBoard(model);
  assert.ok(html.includes('Re-rooted'));
  assert.ok(html.includes('re-rooted subtree, 3 tasks'));
  assert.ok(html.includes('parent <span class="mono">gone</span> is outside this read'));
  assert.ok(html.includes('1 subtree (3 tasks)'));
});

test('the container is hidden by task_id, so a second tree keeps its own $root row', () => {
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

  assert.equal(model.hidden_container.task_id, 'r');
  const keys = flattenTree(model.roots).map((row) => row.node_key);
  assert.deepEqual(keys, ['$root', 'beta', 'alpha']);
  assert.equal(flattenTree(model.roots)[0].task_id, 'r2');

  const html = renderBoard(model);
  assert.equal(html.split('class="node-key">$root<').length - 1, 1);
});

test('the renderer escapes phase', () => {
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
  const html = renderBoard(model);
  assert.equal(html.includes(phase), false);
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;alert(9)&lt;/script&gt;'));
});

test('capabilities come from the payloads, and the renderer reads them', () => {
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
  });

  const html = renderBoard(model);
  assert.ok(html.includes('<span class="label">slot</span> <span class="value">0 of 2</span>'));
  assert.ok(html.includes('<span class="value">3</span>'));
  assert.ok(html.includes('<span class="value">runner-1</span>'));
  assert.equal(html.includes('not reported'), false);
  assert.equal(html.includes("INTERFACE §2's attempt table"), false);
  assert.equal(html.includes('are not printed by any read verb'), false);
  assert.equal(html.includes('task create --tree-key'), false);
  assert.equal(html.includes('its limit is not printed'), false);
  assert.equal(html.includes('because the ended attempt is not readable'), false);
});

test('provenance is printed from the snapshot, not from a fixture', () => {
  const fixture = fixtureModel();
  assert.equal(fixture.provenance.source_kind, 'fixture');
  const fixtureHtml = renderBoard(fixture);
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
  const liveHtml = renderBoard(live);
  assert.ok(liveHtml.includes('Live read'));
  assert.ok(liveHtml.includes('2026-02-02T00:00:00Z'));
  assert.ok(liveHtml.includes('live-1'));
  assert.equal(liveHtml.includes('Fixture capture'), false);
  assert.equal(liveHtml.includes('Read-only capture'), false);
});

test('an unread runner list is not the same value as no runners', () => {
  const unread = renderBoard(
    buildTree(
      snapshotOf({
        nodes: [node('t1', 'task', 'ready', null)],
        runnersAvailable: false,
      }),
    ),
  );
  assert.ok(unread.includes('list not read'));
  assert.equal(unread.includes('<span class="value">none</span>'), false);

  const empty = renderBoard(
    buildTree(
      snapshotOf({
        nodes: [node('t1', 'task', 'ready', null)],
        runners: [],
      }),
    ),
  );
  assert.ok(empty.includes('<span class="value">none</span>'));
});

test('an empty read is the only case that says the tree has no tasks', () => {
  const model = buildTree(
    snapshotOf({ nodes: [node('root', '$root', 'ready', null)] }),
  );
  assert.equal(model.nodes_read, 0);
  assert.equal(model.total, 0);
  const html = renderBoard(model);
  assert.ok(html.includes('No tasks in this tree.'));
  assert.equal(html.includes('could not be placed'), false);
});

test('indentation is generated past depth four', () => {
  const nodes = [node('root', '$root', 'ready', null)];
  let parent = 'root';
  for (let index = 0; index < 6; index += 1) {
    nodes.push(node(`n${index}`, `n${index}`, 'ready', parent));
    parent = `n${index}`;
  }
  const model = buildTree(snapshotOf({ nodes }));
  assert.equal(model.max_depth, 5);
  const html = renderBoard(model);
  assert.ok(html.includes('data-depth="5"'));
  assert.ok(html.includes('.key[data-depth="5"] { padding-left: 5.75rem; }'));
});

test('the ledger exposes treegrid and column roles', () => {
  const html = renderBoard(fixtureModel());
  assert.equal((html.match(/role="treegrid"/g) ?? []).length, 1);
  assert.equal((html.match(/role="columnheader"/g) ?? []).length, 3);
  assert.equal((html.match(/role="gridcell"/g) ?? []).length, 21);
  assert.equal((html.match(/role="row"/g) ?? []).length, 8);
  assert.ok((html.match(/role="list"/g) ?? []).length >= 2);
  // Narrow screens keep the column headers for assistive tech.
  assert.equal(html.includes('.columns { display: none; }'), false);
});

test('an edge ref links to the row it names, and an outside ref says so', () => {
  const fixtureHtml = renderBoard(fixtureModel());
  const href = fixtureHtml.match(/href="#(task-[A-Za-z0-9_]+)"/);
  assert.ok(href, 'a present edge ref must be a link');
  assert.ok(fixtureHtml.includes(`id="${href[1]}"`));

  const outside = renderBoard(
    buildTree(
      snapshotOf({
        nodes: [node('a', 'alpha', 'ready', null)],
        edges: [{ from: 'ghost', to: 'a', kind: 'blocked_by' }],
      }),
    ),
  );
  assert.ok(outside.includes('outside this tree'));
  assert.ok(outside.includes('ghost'));
  assert.equal(outside.includes('href="#task-ghost"'), false);

  const unplaced = renderBoard(
    buildTree(
      snapshotOf({
        nodes: [
          node('a', 'alpha', 'ready', null),
          node('c', 'gamma', 'ready', 'c'),
        ],
        edges: [{ from: 'c', to: 'a', kind: 'blocked_by' }],
      }),
    ),
  );
  assert.ok(unplaced.includes('(not placed, c)'));
  assert.equal(unplaced.includes('href="#task-c"'), false);
});

test('a task without a status row is flagged as missing a status', () => {
  const model = buildTree(
    snapshotOf({ nodes: [node('a', 'alpha', 'ready', null)] }),
  );
  assert.equal(model.roots[0].status_missing, true);
  const html = renderBoard(model);
  assert.ok(html.includes('task status row missing'));
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
  const html = renderBoard(model);
  assert.ok(html.includes('graph and status disagree on rest_state'));
});

test('a null rest_state is a flagged missing value, not a crash', () => {
  const model = buildTree(
    snapshotOf({ nodes: [node('a', 'alpha', null, null)] }),
  );
  const html = renderBoard(model);
  assert.equal(model.unknown_rest_states, 1);
  assert.ok(html.includes('unrecognized rest_state'));
  assert.equal(
    Object.values(model.counts).reduce((sum, count) => sum + count, 0),
    0,
  );
});

test('the committed index.html is the fixture rendered now through the seam', async () => {
  const meta = readFixtureMeta(fixtures);
  const snapshot = await createFixtureSource(fixtures).load({
    project_id: meta.project_id,
    tree_key: meta.tree_key,
    root_task_id: meta.root_task_id,
  });
  const expected = renderBoard(buildTree(snapshot));
  const shipped = readFileSync(join(board, 'index.html'), 'utf8');
  assert.equal(
    shipped,
    expected,
    'run `node engine-board/main.ts` to regenerate the committed page',
  );
});
