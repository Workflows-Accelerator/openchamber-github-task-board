import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeCards } from '../public/arrange.js';

function checkNoOverlaps(positions) {
  const list = Array.isArray(positions)
    ? positions
    : positions instanceof Map
      ? Array.from(positions.values())
      : Object.values(positions);

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const wA = a.w || 250;
      const hA = a.h || 150;
      const wB = b.w || 250;
      const hB = b.h || 150;

      const overlapX = a.x < b.x + wB && a.x + wA > b.x;
      const overlapY = a.y < b.y + hB && a.y + hA > b.y;

      assert.ok(
        !(overlapX && overlapY),
        `Card ${a.id} at (${a.x}, ${a.y}) overlaps with Card ${b.id} at (${b.x}, ${b.y})`,
      );
    }
  }
}

test('arrangeCards: empty and invalid inputs return empty result', () => {
  const res1 = arrangeCards([]);
  assert.equal(res1.size, 0);
  assert.deepEqual(res1.bands, []);

  const res2 = arrangeCards(null);
  assert.equal(res2.size, 0);
});

test('arrangeCards: linear chain of cards (A -> B -> C -> D) ranks horizontally left to right', () => {
  const cards = [
    { id: '1', number: 1, blockers: [] },
    { id: '2', number: 2, blockers: ['1'] },
    { id: '3', number: 3, blockers: ['2'] },
    { id: '4', number: 4, blockers: ['3'] },
  ];

  const res = arrangeCards(cards);
  assert.equal(res.size, 4);

  const p1 = res.get('1');
  const p2 = res.get('2');
  const p3 = res.get('3');
  const p4 = res.get('4');

  assert.equal(p1.rank, 0);
  assert.equal(p2.rank, 1);
  assert.equal(p3.rank, 2);
  assert.equal(p4.rank, 3);

  assert.ok(p1.x < p2.x, 'p1 is left of p2');
  assert.ok(p2.x < p3.x, 'p2 is left of p3');
  assert.ok(p3.x < p4.x, 'p3 is left of p4');

  checkNoOverlaps(res);
});

test('arrangeCards: diamond dependency DAG (A -> B, A -> C, B -> D, C -> D)', () => {
  const cards = [
    { id: 'A', blockers: [] },
    { id: 'B', blockers: ['A'] },
    { id: 'C', blockers: ['A'] },
    { id: 'D', blockers: ['B', 'C'] },
  ];

  const res = arrangeCards(cards);
  const pA = res.get('A');
  const pB = res.get('B');
  const pC = res.get('C');
  const pD = res.get('D');

  assert.equal(pA.rank, 0);
  assert.equal(pB.rank, 1);
  assert.equal(pC.rank, 1);
  assert.equal(pD.rank, 2);

  assert.equal(pB.x, pC.x, 'B and C share the same rank column');
  assert.notEqual(pB.y, pC.y, 'B and C do not collide vertically');
  assert.ok(pA.x < pB.x);
  assert.ok(pB.x < pD.x);

  checkNoOverlaps(res);
});

test('arrangeCards: cycles are broken deterministically without infinite loop or overlap', () => {
  const cards = [
    { id: '10', blockers: ['30'] },
    { id: '20', blockers: ['10'] },
    { id: '30', blockers: ['20'] },
  ];

  const res = arrangeCards(cards);
  assert.equal(res.size, 3);
  for (const c of cards) {
    const pos = res.get(c.id);
    assert.ok(Number.isFinite(pos.x));
    assert.ok(Number.isFinite(pos.y));
  }
  checkNoOverlaps(res);
});

test('arrangeCards: isolated cards stack in column 0 without overlap', () => {
  const cards = [
    { id: '1', blockers: [] },
    { id: '2', blockers: [] },
    { id: '3', blockers: [] },
    { id: '4', blockers: [] },
  ];

  const res = arrangeCards(cards);
  assert.equal(res.size, 4);

  const yPositions = new Set();
  cards.forEach((c) => {
    const pos = res.get(c.id);
    assert.equal(pos.rank, 0);
    yPositions.add(pos.y);
  });

  assert.equal(yPositions.size, 4, 'All isolated cards have distinct row positions');
  checkNoOverlaps(res);
});

test('arrangeCards: multi-project bands stacked vertically with band metadata', () => {
  const cards = [
    { id: 'A1', project: 'Alpha', blockers: [] },
    { id: 'A2', project: 'Alpha', blockers: ['A1'] },
    { id: 'B1', project: 'Beta', blockers: [] },
    { id: 'B2', project: 'Beta', blockers: ['B1'] },
    { id: 'B3', project: 'Beta', blockers: ['B2'] },
  ];

  const res = arrangeCards(cards);
  assert.equal(res.bands.length, 2);
  assert.equal(res.bands[0].project, 'Alpha');
  assert.equal(res.bands[1].project, 'Beta');

  assert.ok(res.bands[0].y < res.bands[1].y, 'Alpha band is above Beta band');

  const pA1 = res.get('A1');
  const pB1 = res.get('B1');
  assert.ok(pA1.y < pB1.y, 'Alpha cards are placed strictly above Beta cards');

  checkNoOverlaps(res);
});

test('arrangeCards: determinism check across repeated runs and shuffled input', () => {
  const makeDataset = () => [
    { id: '1', number: 1, blockers: [] },
    { id: '2', number: 2, blockers: ['1'] },
    { id: '3', number: 3, blockers: ['1'] },
    { id: '4', number: 4, blockers: ['2', '3'] },
    { id: '5', number: 5, blockers: [] },
    { id: '6', number: 6, blockers: ['5'] },
  ];

  const run1 = arrangeCards(makeDataset());
  const run2 = arrangeCards(makeDataset().reverse());
  const run3 = arrangeCards(makeDataset().sort(() => Math.random() - 0.5));

  for (let i = 1; i <= 6; i++) {
    const id = String(i);
    assert.deepEqual(run1.get(id).x, run2.get(id).x, `x must match for ${id}`);
    assert.deepEqual(run1.get(id).y, run2.get(id).y, `y must match for ${id}`);
    assert.deepEqual(run1.get(id).x, run3.get(id).x, `x must match for ${id}`);
    assert.deepEqual(run1.get(id).y, run3.get(id).y, `y must match for ${id}`);
  }
});

test('arrangeCards: 300 cards across multiple projects executes in <50ms with zero overlaps', () => {
  const cards = [];
  const projects = ['Backend', 'Frontend', 'Platform'];

  for (let i = 0; i < 300; i++) {
    const project = projects[i % 3];
    const blockers = [];
    if (i > 3 && i % 4 !== 0) {
      // Connect to an earlier card in the same project
      blockers.push(String(i - 3));
    }
    cards.push({
      id: String(i),
      number: i,
      project,
      blockers,
    });
  }

  const start = performance.now();
  const res = arrangeCards(cards);
  const elapsed = performance.now() - start;

  assert.ok(elapsed < 50, `Arranging 300 cards took ${elapsed.toFixed(2)}ms (expected <50ms)`);
  assert.equal(res.size, 300);
  assert.equal(res.bands.length, 3);

  checkNoOverlaps(res);
});

test('hostile arrange: variable card dimensions and attached note extents prevent overlap', () => {
  const cards = [
    {
      id: 'core#101',
      number: 101,
      project: 'core',
      w: 260,
      h: 160,
      notes: [
        { id: 'n1', x: 80, y: 260, w: 240, h: 175 }, // note extends from y=260 to y=435 (195px below card)
      ],
      blockers: [],
    },
    {
      id: 'core#104',
      number: 104,
      project: 'core',
      w: 250,
      h: 150,
      blockers: [],
    },
  ];

  const res = arrangeCards(cards);
  assert.equal(res.size, 2);

  const p101 = res.get('core#101');
  const p104 = res.get('core#104');

  // Both are rank 0 (column 0), but p104 must be placed below p101 AND its note
  assert.equal(p101.rank, 0);
  assert.equal(p104.rank, 0);
  assert.ok(p104.y > p101.y, 'p104 is placed below p101');

  // Note on 101: card is at p101.y. Note extends to p101.y + 160 + (435 - 160) = p101.y + 275px
  // p104 must start strictly below the bottom of note 101
  const noteBottom = p101.y + 160 + (435 - 160);
  assert.ok(
    p104.y >= noteBottom,
    `Card 104 top (${p104.y}) must be >= Card 101 note bottom (${noteBottom}) to prevent overlap`,
  );

  checkNoOverlaps(res);
});

test('hostile arrange: duplicate issue numbers in different repos resolve scoped to project band', () => {
  const cards = [
    { id: 'repoA#1', number: 1, project: 'repoA', blockers: [] },
    { id: 'repoA#2', number: 2, project: 'repoA', blockers: ['1'] }, // blocks on repoA#1
    { id: 'repoB#1', number: 1, project: 'repoB', blockers: [] },
    { id: 'repoB#2', number: 2, project: 'repoB', blockers: ['1'] }, // blocks on repoB#1, NOT repoA#1
  ];

  const res = arrangeCards(cards);
  assert.equal(res.bands.length, 2);

  const a1 = res.get('repoA#1');
  const a2 = res.get('repoA#2');
  const b1 = res.get('repoB#1');
  const b2 = res.get('repoB#2');

  assert.equal(a1.rank, 0);
  assert.equal(a2.rank, 1);
  assert.equal(b1.rank, 0);
  assert.equal(b2.rank, 1);

  assert.ok(a1.x < a2.x);
  assert.ok(b1.x < b2.x);

  checkNoOverlaps(res);
});

test('hostile arrange: cross-project dependencies do not distort intra-project ranks', () => {
  const cards = [
    { id: 'Alpha#10', number: 10, project: 'Alpha', blockers: [] },
    { id: 'Alpha#20', number: 20, project: 'Alpha', blockers: ['Beta#99'] }, // cross-project blocker
    { id: 'Beta#99', number: 99, project: 'Beta', blockers: [] },
  ];

  const res = arrangeCards(cards);
  assert.equal(res.bands.length, 2);

  // Cross-project blocker Beta#99 does not affect Alpha#20's internal rank within Alpha
  const a10 = res.get('Alpha#10');
  const a20 = res.get('Alpha#20');
  const b99 = res.get('Beta#99');

  assert.equal(a10.rank, 0);
  assert.equal(a20.rank, 0);
  assert.equal(b99.rank, 0);

  checkNoOverlaps(res);
});

test('hostile arrange: shuffled inputs yield byte-for-byte identical coordinate mapping', () => {
  const baseCards = [
    { id: 'c1', number: 1, project: 'P', blockers: [] },
    { id: 'c2', number: 2, project: 'P', blockers: ['c1'] },
    { id: 'c3', number: 3, project: 'P', blockers: ['c1'] },
    { id: 'c4', number: 4, project: 'P', blockers: ['c2', 'c3'] },
    { id: 'c5', number: 5, project: 'P', blockers: [] },
  ];

  const normalRes = arrangeCards(baseCards);
  const reversedCards = baseCards.slice().reverse();
  const reversedRes = arrangeCards(reversedCards);

  for (const c of baseCards) {
    const p1 = normalRes.get(c.id);
    const p2 = reversedRes.get(c.id);
    assert.deepEqual(p1, p2, `Coordinates for ${c.id} must be strictly deterministic regardless of input order`);
  }
});
