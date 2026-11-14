import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeFlowGraph } from '../public/flow-layout.js';

const REPO = 'acme/board';
const GROUP = `${REPO}::standalone`;

function card(overrides = {}) {
  return {
    id: 'c1',
    key: `${REPO}#1`,
    repo: REPO,
    number: 1,
    title: 'Card',
    stage: 'todo',
    priority: null,
    order: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    parentKey: null,
    parentTitle: null,
    dependencies: [],
    w: 250,
    h: 150,
    notes: [],
    activeSession: null,
    ...overrides,
  };
}

function extentsOf(pos) {
  const e = pos.extents || {};
  return {
    x: pos.x - (e.left || 0),
    y: pos.y - (e.top || 0),
    w: pos.w + (e.left || 0) + (e.right || 0),
    h: pos.h + (e.top || 0) + (e.bottom || 0),
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function assertNoCardOverlaps(positions) {
  const list = Object.entries(positions).map(([id, pos]) => ({ id, rect: extentsOf(pos) }));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      assert.ok(
        !overlaps(list[i].rect, list[j].rect),
        `cards ${list[i].id} and ${list[j].id} overlap`,
      );
    }
  }
}

function assertNoGroupOverlaps(groups) {
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      assert.ok(
        !overlaps(groups[i], groups[j]),
        `groups ${groups[i].groupKey} and ${groups[j].groupKey} overlap`,
      );
    }
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

test('arrangeFlowGraph: empty and invalid input yields empty result', () => {
  const res = arrangeFlowGraph([]);
  assert.deepEqual(res.groups, []);
  assert.deepEqual(res.positions, {});
  assert.deepEqual(res.edges, []);

  const invalid = arrangeFlowGraph(null);
  assert.deepEqual(invalid.groups, []);
  assert.deepEqual(invalid.positions, {});
  assert.deepEqual(invalid.edges, []);

  assert.equal(typeof globalThis.arrangeFlowGraph, 'function');
});

test('arrangeFlowGraph: LR ranks dependencies on x, TD ranks them on y', () => {
  const cards = [
    card({ id: 'a', key: `${REPO}#1`, number: 1 }),
    card({ id: 'b', key: `${REPO}#2`, number: 2, dependencies: ['a'] }),
    card({ id: 'c', key: `${REPO}#3`, number: 3, dependencies: ['b'] }),
  ];

  const lr = arrangeFlowGraph(cards, { direction: 'LR', expandedGroups: [GROUP] });
  assert.equal(lr.groups.length, 1);
  assert.equal(lr.groups[0].collapsed, false);
  assert.ok(lr.positions.a.x < lr.positions.b.x);
  assert.ok(lr.positions.b.x < lr.positions.c.x);
  assert.equal(lr.positions.a.y, lr.positions.b.y);
  assert.equal(lr.positions.b.y, lr.positions.c.y);
  assert.equal(lr.edges.length, 2);
  assert.ok(lr.edges.every((edge) => edge.crossGroup === false));
  assert.ok(lr.edges.every((edge) => edge.points.length >= 2));

  const td = arrangeFlowGraph(cards, { direction: 'TD', expandedGroups: [GROUP] });
  assert.ok(td.positions.a.y < td.positions.b.y);
  assert.ok(td.positions.b.y < td.positions.c.y);
  assert.equal(td.positions.a.x, td.positions.b.x);
  assert.equal(td.positions.b.x, td.positions.c.x);
});

test('arrangeFlowGraph: within a layer order beats priority beats createdAt', () => {
  const cards = [
    card({ id: 'a', number: 1, order: 2, priority: 'urgent', createdAt: '2026-01-02T00:00:00.000Z' }),
    card({ id: 'b', number: 2, order: 1, priority: 'low', createdAt: '2026-01-05T00:00:00.000Z' }),
    card({ id: 'c', number: 3, order: 2, priority: 'high', createdAt: '2026-01-01T00:00:00.000Z' }),
    card({ id: 'd', number: 4, order: 2, priority: 'urgent', createdAt: '2026-01-04T00:00:00.000Z' }),
    card({ id: 'e', number: 5, priority: 'urgent', createdAt: '2025-12-01T00:00:00.000Z' }),
  ];

  const res = arrangeFlowGraph(cards, { direction: 'LR', expandedGroups: [GROUP] });
  const byY = ['a', 'b', 'c', 'd', 'e'].sort((x, y) => res.positions[x].y - res.positions[y].y);
  assert.deepEqual(byY, ['b', 'a', 'd', 'c', 'e']);
});

test('arrangeFlowGraph: cyclic dependencies are broken deterministically', () => {
  const cycle = [
    card({ id: 'a', number: 1, dependencies: ['c'] }),
    card({ id: 'b', number: 2, dependencies: ['a'] }),
    card({ id: 'c', number: 3, dependencies: ['b'] }),
  ];

  const res = arrangeFlowGraph(cycle, { direction: 'LR', expandedGroups: [GROUP] });
  assert.equal(Object.keys(res.positions).length, 3);
  assert.equal(res.edges.length, 3);
  assert.ok(res.edges.some((edge) => edge.points[0].x > edge.points[edge.points.length - 1].x));

  const reversed = arrangeFlowGraph(cycle.slice().reverse(), { direction: 'LR', expandedGroups: [GROUP] });
  assert.deepEqual(reversed.positions, res.positions);
  assert.deepEqual(reversed.edges, res.edges);
});

test('arrangeFlowGraph: groups collapse by default and report counts', () => {
  const cards = [
    card({ id: 'a1', key: `${REPO}#1`, number: 1, stage: 'done' }),
    card({ id: 'a2', key: `${REPO}#2`, number: 2, stage: 'needs-human' }),
    card({ id: 'a3', key: `${REPO}#3`, number: 3, stage: 'in-progress', activeSession: 'sess-1' }),
    card({
      id: 'b1',
      key: 'acme/other#1',
      repo: 'acme/other',
      number: 1,
      dependencies: [`${REPO}#1`],
    }),
  ];

  const res = arrangeFlowGraph(cards);
  assert.equal(res.groups.length, 2);
  assert.deepEqual(res.positions, {});
  assert.ok(res.groups.every((group) => group.collapsed === true));

  const board = res.groups.find((group) => group.repo === REPO);
  assert.equal(board.groupKey, GROUP);
  assert.equal(board.total, 3);
  assert.equal(board.done, 1);
  assert.equal(board.needsMe, 1);
  assert.equal(board.running, 1);
  assert.deepEqual(board.cardIds.slice().sort(), ['a1', 'a2', 'a3']);

  assert.equal(res.edges.length, 1);
  assert.equal(res.edges[0].crossGroup, true);
  assert.ok(res.edges[0].points.length >= 2);
  assertNoGroupOverlaps(res.groups);
});

test('arrangeFlowGraph: expanded groups keep card and note extents apart', () => {
  const notes = [
    { id: 'n1', w: 220, h: 130, dx: -30, dy: -20 },
    { id: 'n2', w: 260, h: 140, dx: 40, dy: 200 },
    { id: 'n3', w: 180, h: 120, dx: 260, dy: 40 },
  ];
  const cards = Array.from({ length: 8 }, (_, index) => card({
    id: `c${index}`,
    key: `${REPO}#${index + 1}`,
    number: index + 1,
    w: 240 + (index % 3) * 20,
    h: 140 + (index % 2) * 30,
    notes: index < notes.length ? [notes[index]] : [],
    dependencies: index === 3 ? ['c0'] : index === 6 ? ['c3'] : [],
  }));

  const res = arrangeFlowGraph(cards, { direction: 'TD', expandedGroups: [GROUP] });
  assert.equal(Object.keys(res.positions).length, 8);
  assert.ok(Object.values(res.positions).some((pos) => pos.extents.bottom > 0 || pos.extents.top > 0));
  assertNoCardOverlaps(res.positions);
  assertNoGroupOverlaps(res.groups);
});

test('arrangeFlowGraph: shuffled input produces identical output', () => {
  const random = mulberry32(7);
  const repos = ['acme/a', 'acme/b', 'acme/c'];
  const cards = [];
  for (let index = 0; index < 40; index++) {
    const repo = repos[index % repos.length];
    const number = Math.floor(index / repos.length) + 1;
    const parentKey = index % 4 === 0 ? `epic-${index % 3}` : null;
    cards.push(card({
      id: `card-${index}`,
      key: `${repo}#${number}`,
      repo,
      number,
      parentKey,
      parentTitle: parentKey ? `Epic ${parentKey}` : null,
      order: index % 5 === 0 ? index : null,
      priority: ['urgent', 'high', 'normal', 'low'][index % 4],
      dependencies: index > 5 ? [`card-${Math.floor(random() * index)}`] : [],
    }));
  }

  const groupKeys = [...new Set(cards.map((item) => `${item.repo}::${item.parentKey || 'standalone'}`))];
  const options = { direction: 'LR', expandedGroups: groupKeys };

  const baseline = arrangeFlowGraph(cards, options);
  assertNoCardOverlaps(baseline.positions);
  for (let attempt = 0; attempt < 4; attempt++) {
    const shuffled = arrangeFlowGraph(shuffle(cards, random), options);
    assert.deepEqual(shuffled.groups, baseline.groups);
    assert.deepEqual(shuffled.positions, baseline.positions);
    assert.deepEqual(shuffled.edges, baseline.edges);
  }
});

test('arrangeFlowGraph: 345 cards across 27 repos lay out under 100ms', () => {
  const random = mulberry32(42);
  const repos = Array.from({ length: 27 }, (_, index) => `acme/repo-${index}`);
  const cards = [];
  for (let index = 0; index < 345; index++) {
    const repo = repos[index % repos.length];
    const number = Math.floor(index / repos.length) + 1;
    const parentKey = index % 5 === 0 ? `epic-${index % 4}` : null;
    const dependencies = [];
    if (index > 3) {
      const candidate = Math.floor(random() * index);
      if (cards[candidate].repo === repo) dependencies.push(cards[candidate].id);
    }
    cards.push(card({
      id: `card-${index}`,
      key: `${repo}#${number}`,
      repo,
      number,
      parentKey,
      parentTitle: parentKey ? `Epic ${parentKey}` : null,
      priority: ['urgent', 'high', 'normal', 'low'][index % 4],
      dependencies,
      notes: index % 9 === 0 ? [{ id: `note-${index}`, w: 200, h: 120, dy: 170 }] : [],
    }));
  }

  const groupKeys = [...new Set(cards.map((item) => `${item.repo}::${item.parentKey || 'standalone'}`))];
  const options = { direction: 'LR', expandedGroups: groupKeys.filter((_, index) => index % 4 === 0) };

  arrangeFlowGraph(cards, options);
  const started = performance.now();
  const res = arrangeFlowGraph(cards, options);
  const elapsed = performance.now() - started;

  assert.ok(elapsed < 100, `layout took ${elapsed.toFixed(1)}ms`);
  assert.equal(new Set(res.groups.map((group) => group.repo)).size, 27);
  assert.ok(res.groups.length >= 27);
  assertNoCardOverlaps(res.positions);
  assertNoGroupOverlaps(res.groups);

  const shuffled = arrangeFlowGraph(shuffle(cards, random), options);
  assert.deepEqual(shuffled.positions, res.positions);
  assert.deepEqual(shuffled.groups, res.groups);
  assert.deepEqual(shuffled.edges, res.edges);
});
