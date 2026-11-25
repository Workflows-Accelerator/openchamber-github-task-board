// ==========================================
// The demo fixtures must stay the demo the brief asked for.
//
// These assertions read the committed generated files, not the generator's
// intent. A fixture edit that drops the blocked chain, the fan-out, the
// running pair or the volume tree fails here before a screenshot can hide it.
// ==========================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTree, flattenTree } from '../engine-board/model.ts';
import { laneOf, lanePlan } from '../engine-board/rollup.ts';
import {
  readFixtureMeta,
  loadFixtureSnapshot,
} from './fixtures-source.ts';

const here = dirname(fileURLToPath(import.meta.url));
const board = join(here, '..', 'engine-board');
const fixtures = join(board, 'fixtures');

function modelFor(name) {
  const directory = join(fixtures, name);
  return buildTree(loadFixtureSnapshot(directory, readFixtureMeta(directory)));
}

function byKey(model) {
  return new Map(flattenTree(model.roots).map((row) => [row.node_key, row]));
}

const ACTIVE = new Set(['claimed', 'launching', 'live', 'ending']);

function tally(model) {
  let live = 0;
  let archived = 0;
  const walk = (rows) => {
    for (const row of rows) {
      if (row.archived_at !== null) archived += 1;
      else live += 1;
      walk(row.children);
    }
  };
  walk(model.roots);
  return { live, archived };
}

test('the demo tree is at least 45 live tasks over four levels', () => {
  const model = modelFor('demo');
  const { live, archived } = tally(model);
  assert.equal(live >= 45, true, `${live} live demo tasks`);
  assert.equal(archived, 4, 'the archived subtree is counted apart');
  assert.equal(model.max_depth + 1, 4, 'four levels');
  assert.equal(model.defects.length, 0);
  assert.ok(existsSync(join(board, 'demo', 'generate.ts')), 'committed generator');
  const meta = readFixtureMeta(join(fixtures, 'demo'));
  assert.ok(
    meta.notes.some((note) => note.includes('engine-board/demo/generate.ts')),
    'the fixture says it is generated, not typed',
  );
  // The container row is hidden by task_id. A root id that matches no node
  // shows the container as a card; that regression is cheap to catch here.
  const snapshot = loadFixtureSnapshot(
    join(fixtures, 'demo'),
    readFixtureMeta(join(fixtures, 'demo')),
  );
  assert.ok(
    snapshot.graph.nodes.some((node) => node.task_id === snapshot.root_task_id),
    'root_task_id names the container row',
  );
});

test('the demo has the dependency shapes the brief names', () => {
  const model = modelFor('demo');
  const row = byKey(model);
  // The top level is a portfolio: five processes, each with work inside, so a
  // reader sees a portfolio instead of loose tasks beside containers.
  assert.equal(model.roots.length, 5, 'five processes at the top');
  for (const root of model.roots) {
    assert.ok(root.children.length > 0, `${root.node_key} carries work`);
  }
  const build = row.get('build');
  const buildPlan = lanePlan(build.children);
  const canStart = buildPlan.lanes.find((group) => group.lane === 'can-start');
  assert.ok(canStart, 'Build has a can-start lane');
  assert.equal(canStart.cards.length, 12, 'twelve cards in one crowded lane');
  assert.equal(
    canStart.cards.every((item) => item.phase === null),
    true,
    'the crowded lane is startable work, not running work',
  );

  // Three-deep blocked chain: 01 waits for 02, 02 for 03, 03 for 04.
  for (const [from, to] of [
    ['chain-01', 'chain-02'],
    ['chain-02', 'chain-03'],
    ['chain-03', 'chain-04'],
  ]) {
    const item = row.get(from);
    assert.ok(item, `${from} exists`);
    assert.equal(item.rest_state, 'blocked');
    assert.equal(item.blocked_by.length, 1, from);
    assert.equal(
      row.get(to).task_id,
      item.blocked_by[0].task_id,
      `${from} waits for ${to}`,
    );
  }
  assert.equal(row.get('chain-04').rest_state, 'waiting');

  // One task blocks six.
  const source = row.get('fan-source');
  const blockedBySource = flattenTree(model.roots).filter((item) =>
    item.blocked_by.some((ref) => ref.task_id === source.task_id),
  );
  assert.equal(blockedBySource.length, 6);
  assert.ok(blockedBySource.every((item) => item.rest_state === 'blocked'));

  // The optional dependency resolved as skipped, and its edge accepts it.
  const optional = row.get('research-b');
  assert.equal(optional.after.length, 1);
  assert.equal(row.get('research-a').rest_state, 'skipped');
  assert.ok(optional.after[0].satisfied_by.includes('skipped'));

  // Two workers are on it, one task failed after a retry.
  const running = flattenTree(model.roots).filter(
    (item) => item.phase !== null && ACTIVE.has(item.phase),
  );
  assert.equal(running.length, 2);
  const failed = row.get('failed-task');
  assert.equal(failed.rest_state, 'failed');
  assert.equal(failed.attempts.length, 2, 'a retry is visible');

  // A nested subtree three rows below the top, and an archived subtree.
  assert.equal(row.get('build-spec').depth, 1);
  assert.equal(row.get('build-spec-review').depth, 2);
  assert.equal(row.get('build-spec-review-check').depth, 3);
  const archived = row.get('archive-old');
  assert.notEqual(archived.archived_at, null);
  assert.equal(archived.children.length, 3);
  assert.ok(archived.children.every((child) => child.archived_at !== null));

  // The header at the top counts processes by the reader's lanes.
  assert.deepEqual(
    lanePlan(model.roots).lanes.map((group) => [group.lane, group.cards.length]),
    [
      ['not-started', 2],
      ['can-start', 1],
      ['waiting-for-someone', 1],
      ['waiting-for-other-work', 1],
    ],
  );
  assert.equal(laneOf('blocked', null), 'waiting-for-other-work');
});

test('the demo bodies read like work and the conditions span the kinds', () => {
  const model = modelFor('demo');
  const row = byKey(model);

  // A paragraph someone would write, with a blank line between paragraphs.
  const build = row.get('build');
  assert.ok(build.body.includes('\n\n'), 'the body has more than one paragraph');
  assert.ok(build.body.split(/\n\s*\n/).length >= 2);
  assert.ok(row.get('build-engine').body.includes("engine's own verbs"));

  // One task deliberately has no description, so the empty state is exercised.
  assert.equal(row.get('release-support').body, '');
  assert.equal(row.get('release-support').body_read, true);

  // Every condition kind the panel knows appears at least once.
  const kinds = new Set(
    flattenTree(model.roots).flatMap((item) =>
      item.conditions.map((condition) => condition.kind),
    ),
  );
  for (const kind of ['check', 'verdict', 'answer', 'child', 'evidence']) {
    assert.ok(kinds.has(kind), `the demo carries a ${kind} condition`);
  }

  // The conditions the brief names: a check, an approval, an answer, a child.
  assert.deepEqual(
    row.get('build-tests').conditions.map((condition) => condition.kind),
    ['check', 'verdict'],
  );
  assert.deepEqual(
    row.get('chain-02').conditions.map((condition) => condition.kind),
    ['verdict'],
  );
  assert.deepEqual(
    row.get('chain-04').conditions.map((condition) => condition.kind),
    ['answer'],
  );
  assert.deepEqual(
    row.get('build-spec').conditions.map((condition) => condition.kind),
    ['child', 'check'],
  );

  // The failed task carries the engine's recorded reason, not just a count.
  assert.equal(
    row.get('failed-task').attempts[1].end_evidence,
    'exit 1: the index lock was still held',
  );
});

test('the volume fixture is the ~200 task proof, not a second small demo', () => {
  const model = modelFor('demo-volume');
  const { live } = tally(model);
  assert.equal(live >= 190, true, `${live} volume tasks`);
  assert.equal(model.max_depth + 1, 4);
  assert.equal(model.roots.length, 16, 'ten workstreams and six tasks to act on');
  assert.equal(model.defects.length, 0);
  const failed = flattenTree(model.roots).filter(
    (item) => item.rest_state === 'failed',
  );
  assert.equal(failed.length, 3, 'three failures, not twenty-four');
  assert.ok(
    failed.some((item) => item.attempts.length > 1),
    'one failure carries a retry',
  );
  assert.ok(existsSync(join(board, 'demo', 'volume', 'index.html')));
  assert.ok(existsSync(join(board, 'demo', 'volume', 'list.html')));
});
