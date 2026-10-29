import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shortName,
  normalizeProjectNameOverrides,
  parseOrderMarker,
  stripOrderMarker,
  setOrderMarker,
  midpointOrder,
  compareManualOrder,
  sortByManualOrder,
  nextAppendOrder,
  computeMove,
  DEFAULT_VIEW_STATE,
  defaultViewState,
  normalizeViewState,
  toggleFilter,
  isQuickCaptureMode,
  applyFilters,
  applySort,
} from '../panel/viewstate.ts';

// ==========================================
// Short project names
// ==========================================
test('shortName: contract example Workflows-Accelerator/openchamber-github-task-board -> Task Board', () => {
  assert.equal(shortName('Workflows-Accelerator/openchamber-github-task-board'), 'Task Board');
});

test('shortName: splits on - _ . and Title Cases each token', () => {
  assert.equal(shortName('acme/my_cool.service-api'), 'My Cool Service Api');
  assert.equal(shortName('acme/WEB-APP'), 'Web App');
  assert.equal(shortName('acme/web--app__x'), 'Web App X');
});

test('shortName: drops openchamber, github, gh, repo case-insensitively', () => {
  assert.equal(shortName('o/GitHub-Gh-REPO-Notes'), 'Notes');
  assert.equal(shortName('o/OpenChamber.Extensions'), 'Extensions');
  assert.equal(shortName('o/ghost'), 'Ghost', 'only whole tokens are dropped');
});

test('shortName: when every token is dropped, Title Case the whole repo part', () => {
  assert.equal(shortName('o/github-repo'), 'Github-repo');
  assert.equal(shortName('o/openchamber'), 'Openchamber');
  assert.equal(shortName('o/gh'), 'Gh');
});

test('shortName: edge cases (no owner, empty, trailing slash, whitespace)', () => {
  assert.equal(shortName('task-board'), 'Task Board');
  assert.equal(shortName(''), '');
  assert.equal(shortName(null), '');
  assert.equal(shortName('  acme/data-pipeline  '), 'Data Pipeline');
  assert.equal(shortName('acme/'), 'acme/');
});

test('shortName: user rename overrides the rule (case-insensitive key), blank rename ignored', () => {
  const overrides = normalizeProjectNameOverrides({
    'Workflows-Accelerator/OpenChamber-GitHub-Task-Board': '  Board  ',
    'acme/x': '   ',
    'acme/y': 42,
  });
  assert.deepEqual(overrides, { 'workflows-accelerator/openchamber-github-task-board': 'Board' });
  assert.equal(shortName('Workflows-Accelerator/openchamber-github-task-board', overrides), 'Board');
  assert.equal(shortName('acme/x-y', overrides), 'X Y');
  assert.deepEqual(normalizeProjectNameOverrides(null), {});
  assert.deepEqual(normalizeProjectNameOverrides(['a']), {});
});

// ==========================================
// Draft order marker
// ==========================================
test('parseOrderMarker: reads the marker on its own line, last one wins', () => {
  assert.equal(parseOrderMarker('Body\n\n<!-- board-order: 2500 -->'), 2500);
  assert.equal(parseOrderMarker('<!-- board-order: -1000 -->'), -1000);
  assert.equal(parseOrderMarker('x\n<!--board-order:12.5-->\n'), 12.5);
  assert.equal(parseOrderMarker('a\n<!-- board-order: 1 -->\nb\n<!-- board-order: 7 -->'), 7);
  assert.equal(parseOrderMarker('no marker'), null);
  assert.equal(parseOrderMarker(''), null);
  assert.equal(parseOrderMarker(null), null);
  assert.equal(parseOrderMarker('inline <!-- board-order: 5 --> text'), null, 'must be on its own line');
  assert.equal(parseOrderMarker('<!-- board-order: abc -->'), null);
});

test('stripOrderMarker: removes marker lines and keeps the rest of the body', () => {
  assert.equal(stripOrderMarker('Hello\n\n<!-- board-order: 1000 -->'), 'Hello');
  assert.equal(stripOrderMarker('<!-- board-order: 1000 -->'), '');
  assert.equal(stripOrderMarker('Plain body\n'), 'Plain body\n', 'body without marker is untouched');
  assert.equal(stripOrderMarker('A\n<!-- board-order: 1 -->\nB'), 'A\n<!-- board-order: 1 -->\nB', 'non-terminal marker inside body is untouched');
  assert.equal(stripOrderMarker(null), '');
});

test('H2: order marker helpers ignore fenced code blocks and preserve CRLF, blank lines, and hard-break spaces', () => {
  const fencedOnly = 'Sample:\r\n```html\r\n<!-- board-order: 777 -->\r\n```\r\n';
  assert.equal(parseOrderMarker(fencedOnly), null);
  assert.equal(stripOrderMarker(fencedOnly), fencedOnly);

  const fencedWithTrailing = 'Sample:\r\n```html\r\n<!-- board-order: 777 -->\r\n```\r\n\r\n\r\n### Human Tasks:\r\n- [ ] Keep this\r\n\r\n<!-- board-order: 1000 -->';
  const expectedStripped = 'Sample:\r\n```html\r\n<!-- board-order: 777 -->\r\n```\r\n\r\n\r\n### Human Tasks:\r\n- [ ] Keep this';
  assert.equal(parseOrderMarker(fencedWithTrailing), 1000);
  assert.equal(stripOrderMarker(fencedWithTrailing), expectedStripped);
  assert.equal(
    setOrderMarker(fencedWithTrailing, 2000),
    `${expectedStripped}\r\n\r\n<!-- board-order: 2000 -->`
  );

  const tildeFence = '~~~\n<!-- board-order: 555 -->\n~~~';
  assert.equal(parseOrderMarker(tildeFence), null);
  assert.equal(stripOrderMarker(tildeFence), tildeFence);

  const hardBreak = 'Line one  \nLine two  \n\n<!-- board-order: 1000 -->';
  assert.equal(stripOrderMarker(hardBreak), 'Line one  \nLine two  ');
  assert.equal(setOrderMarker(hardBreak, 2500), 'Line one  \nLine two  \n\n<!-- board-order: 2500 -->');
});

test('setOrderMarker: appends one marker on its own line at the end, replacing any old one', () => {
  assert.equal(setOrderMarker('Idea', 1000), 'Idea\n\n<!-- board-order: 1000 -->');
  assert.equal(setOrderMarker('', 1000), '<!-- board-order: 1000 -->', 'draft with no description');
  assert.equal(setOrderMarker(null, -500), '<!-- board-order: -500 -->');
  const rewritten = setOrderMarker('Idea\n\n<!-- board-order: 1000 -->', 1500);
  assert.equal(rewritten, 'Idea\n\n<!-- board-order: 1500 -->');
  assert.equal(parseOrderMarker(rewritten), 1500);
  assert.equal(setOrderMarker('Idea', 1250.5), 'Idea\n\n<!-- board-order: 1250.5 -->');
  assert.ok(!setOrderMarker('x', 1e-7).includes('e-'), 'never writes exponent notation');
});

test('midpointOrder: midpoint between neighbours, first/last use -/+ 1000', () => {
  assert.equal(midpointOrder(1000, 2000), 1500);
  assert.equal(midpointOrder(null, 1000), 0);
  assert.equal(midpointOrder(3000, null), 4000);
  assert.equal(midpointOrder(null, null), 1000);
});

const draft = (number, order, created) => ({
  number,
  body: order === null ? `Draft ${number}` : `Draft ${number}\n\n<!-- board-order: ${order} -->`,
  created_at: created,
});

test('manual order: marked first by number, then unmarked oldest created first', () => {
  const items = [
    draft(1, null, '2026-01-03T00:00:00Z'),
    draft(2, 2000, '2026-01-01T00:00:00Z'),
    draft(3, null, '2026-01-02T00:00:00Z'),
    draft(4, 1000, '2026-01-05T00:00:00Z'),
  ];
  assert.deepEqual(sortByManualOrder(items).map((i) => i.number), [4, 2, 3, 1]);
  assert.ok(compareManualOrder(items[1], items[0]) < 0);
  assert.equal(nextAppendOrder(items), 3000);
  assert.equal(nextAppendOrder([draft(9, null, '')]), 1000);
});

const applyMoveWrites = (list, writes) => {
  assert.ok(Array.isArray(writes) && writes.length > 0, 'expected non-empty write plan');
  const next = list.map((item) => ({ ...item }));
  for (const write of writes) {
    next[write.index].body = setOrderMarker(next[write.index].body, write.order);
  }
  return sortByManualOrder(next);
};

test('computeMove: rewrites only the moved item with the neighbour midpoint when neighbours are marked', () => {
  const ordered = [draft(1, 1000, 'a'), draft(2, 2000, 'b'), draft(3, 3000, 'c')];
  assert.deepEqual(computeMove(ordered, 2, 0), [{ index: 2, order: 0 }], 'to first: next - 1000');
  assert.deepEqual(computeMove(ordered, 0, 2), [{ index: 0, order: 4000 }], 'to last: prev + 1000');
  assert.deepEqual(computeMove(ordered, 0, 1), [{ index: 0, order: 2500 }], 'one step down');
  assert.deepEqual(computeMove(ordered, 2, 1), [{ index: 2, order: 1500 }], 'one step up');
  assert.equal(computeMove(ordered, 1, 1), null, 'no-op');
  assert.equal(computeMove(ordered, 5, 0), null, 'out of range');
});

test('computeMove: moving down past unmarked items lazily assigns ORDER_GAP markers up to target slot', () => {
  const ordered = [draft(1, 1000, '2026-01-01'), draft(2, null, '2026-01-02'), draft(3, null, '2026-01-03')];
  const original = structuredClone(ordered);
  const moveOne = computeMove(ordered, 0, 1);
  assert.deepEqual(moveOne, [{ index: 1, order: 1000 }, { index: 0, order: 2000 }]);
  assert.deepEqual(ordered, original, 'input array is not mutated');
  assert.deepEqual(applyMoveWrites(ordered, moveOne).map((i) => i.number), [2, 1, 3]);

  const moveTwo = computeMove(ordered, 0, 2);
  assert.deepEqual(moveTwo, [{ index: 1, order: 1000 }, { index: 2, order: 2000 }, { index: 0, order: 3000 }]);
  assert.deepEqual(applyMoveWrites(ordered, moveTwo).map((i) => i.number), [2, 3, 1]);
});

test('computeMove: unmarked lists lazily initialize only prefix up to toIndex for any upward or downward move', () => {
  const ordered = [draft(1, 1000, '2026-01-01'), draft(2, null, '2026-01-02'), draft(3, null, '2026-01-03')];
  const move = computeMove(ordered, 2, 1);
  assert.deepEqual(move, [{ index: 2, order: 2000 }]);
  assert.deepEqual(applyMoveWrites(ordered, move).map((i) => i.number), [1, 3, 2]);

  const allUnmarked = [draft(1, null, '2026-01-01'), draft(2, null, '2026-01-02'), draft(3, null, '2026-01-03')];
  const top = computeMove(allUnmarked, 2, 0);
  assert.deepEqual(top, [{ index: 2, order: 1000 }]);
  assert.deepEqual(applyMoveWrites(allUnmarked, top).map((i) => i.number), [3, 1, 2]);

  const down = computeMove(allUnmarked, 0, 1);
  assert.deepEqual(down, [{ index: 1, order: 1000 }, { index: 0, order: 2000 }]);
  assert.deepEqual(applyMoveWrites(allUnmarked, down).map((i) => i.number), [2, 1, 3]);

  const mid = computeMove(allUnmarked, 2, 1);
  assert.deepEqual(mid, [{ index: 0, order: 1000 }, { index: 2, order: 2000 }]);
  assert.deepEqual(applyMoveWrites(allUnmarked, mid).map((i) => i.number), [1, 3, 2]);

  const four = [draft(1, null, '2026-01-01'), draft(2, null, '2026-01-02'), draft(3, null, '2026-01-03'), draft(4, null, '2026-01-04')];
  const m = computeMove(four, 3, 1);
  assert.deepEqual(m, [{ index: 0, order: 1000 }, { index: 3, order: 2000 }]);
  assert.deepEqual(applyMoveWrites(four, m).map((i) => i.number), [1, 4, 2, 3]);
});

test('computeMove: rebalances minimal contiguous span when markers are equal or precision is exhausted', () => {
  const ordered = [draft(1, 1000, '2026-01-01'), draft(2, 1000, '2026-01-02'), draft(3, 1000, '2026-01-03'), draft(4, 1000, '2026-01-04')];
  const move = computeMove(ordered, 3, 1);
  assert.ok(move && move.length >= 2);
  assert.deepEqual(applyMoveWrites(ordered, move).map((i) => i.number), [1, 4, 2, 3]);

  const swap = computeMove(ordered.slice(0, 3), 2, 1);
  assert.ok(swap && swap.length >= 2);
  assert.deepEqual(applyMoveWrites(ordered.slice(0, 3), swap).map((i) => i.number), [1, 3, 2]);

  const exhausted = [draft(1, 1000, '2026-01-01'), draft(2, 1000 + Number.EPSILON * 1000, '2026-01-02'), draft(3, 2000, '2026-01-03')];
  const tightMove = computeMove(exhausted, 2, 1);
  assert.ok(tightMove && tightMove.length >= 1);
  assert.deepEqual(applyMoveWrites(exhausted, tightMove).map((i) => i.number), [1, 3, 2]);

  const scenarios = [
    [draft(1, null, '2026-01-01'), draft(2, null, '2026-01-02'), draft(3, null, '2026-01-03'), draft(4, null, '2026-01-04')],
    [draft(1, 1000, '2026-01-01'), draft(2, null, '2026-01-02'), draft(3, null, '2026-01-03'), draft(4, null, '2026-01-04')],
    [draft(1, 1000, '2026-01-01'), draft(2, 1000, '2026-01-02'), draft(3, null, '2026-01-03'), draft(4, null, '2026-01-04')],
    [draft(1, 1000, '2026-01-01'), draft(2, 1000, '2026-01-02'), draft(3, 1000, '2026-01-03'), draft(4, 1000, '2026-01-04')],
    [draft(1, 0, '2026-01-01'), draft(2, Number.MIN_VALUE, '2026-01-02'), draft(3, 1000, '2026-01-03')],
  ];
  for (const list of scenarios) {
    for (let from = 0; from < list.length; from++) {
      for (let to = 0; to < list.length; to++) {
        if (from === to) continue;
        const writes = computeMove(list, from, to);
        assert.ok(writes && writes.length > 0, `expected writes for from=${from} to=${to}`);
        const expected = list.map((i) => i.number);
        const [movedNum] = expected.splice(from, 1);
        expected.splice(to, 0, movedNum);
        assert.deepEqual(applyMoveWrites(list, writes).map((i) => i.number), expected, `from=${from} to=${to}`);
      }
    }
  }
});

// ==========================================
// View / Filter / Sort state
// ==========================================
test('default state: View = Simple list, Filter = none, Sort = priority', () => {
  assert.deepEqual({ ...DEFAULT_VIEW_STATE, filters: [...DEFAULT_VIEW_STATE.filters] }, { view: 'simple', filters: [], sort: 'priority' });
  assert.deepEqual(defaultViewState(), { view: 'simple', filters: [], sort: 'priority' });
  assert.ok(Object.isFrozen(DEFAULT_VIEW_STATE));
});

test('normalizeViewState: invalid or missing stored values fall back to defaults', () => {
  assert.deepEqual(normalizeViewState(undefined), { view: 'simple', filters: [], sort: 'priority' });
  assert.deepEqual(normalizeViewState({ view: 'attention', sort: 'newest', filters: 'x' }), { view: 'simple', filters: [], sort: 'priority' });
  assert.deepEqual(
    normalizeViewState({ view: 'kanban', sort: 'manual', filters: ['needs-me', 'stage:draft', 'stage:bogus', 'project:a/b', 'needs-me', 7] }),
    { view: 'kanban', filters: ['needs-me', 'stage:draft', 'project:a/b'], sort: 'manual' }
  );
});

test('toggleFilter and quick-capture mode', () => {
  let f = toggleFilter([], 'stage:draft');
  assert.deepEqual(f, ['stage:draft']);
  assert.equal(isQuickCaptureMode({ view: 'simple', filters: f, sort: 'manual' }), true);
  assert.equal(isQuickCaptureMode({ view: 'cards', filters: f, sort: 'manual' }), false);
  f = toggleFilter(f, 'stage:draft');
  assert.deepEqual(f, []);
  assert.deepEqual(toggleFilter(['human'], 'nonsense'), ['human']);
});

const items = [
  { number: 1, stage: 'draft', repo: 'a/one', me: false, human: false, q: false, prio: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z', body: 'x\n<!-- board-order: 2000 -->' },
  { number: 2, stage: 'needs-human', repo: 'b/two', me: true, human: true, q: false, prio: 3, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-05T00:00:00Z', body: '' },
  { number: 3, stage: 'in-review', repo: 'a/one', me: true, human: false, q: true, prio: 2, created_at: '2026-01-03T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', body: '' },
  { number: 4, stage: 'draft', repo: 'B/Two', me: false, human: false, q: true, prio: 0, created_at: '2026-01-04T00:00:00Z', body: 'y\n<!-- board-order: 1000 -->' },
];
const acc = {
  stageOf: (i) => i.stage,
  repoOf: (i) => i.repo,
  needsMe: (i) => i.me,
  hasHumanTasks: (i) => i.human,
  hasOpenQuestions: (i) => i.q,
};
const nums = (list) => list.map((i) => i.number);

test('applyFilters: none returns all; groups AND, tokens within a group OR', () => {
  assert.deepEqual(nums(applyFilters(items, [], acc)), [1, 2, 3, 4]);
  assert.deepEqual(nums(applyFilters(items, ['stage:draft'], acc)), [1, 4]);
  assert.deepEqual(nums(applyFilters(items, ['stage:draft', 'stage:in-review'], acc)), [1, 3, 4]);
  assert.deepEqual(nums(applyFilters(items, ['needs-me'], acc)), [2, 3]);
  assert.deepEqual(nums(applyFilters(items, ['human', 'questions'], acc)), [2, 3, 4]);
  assert.deepEqual(nums(applyFilters(items, ['questions', 'stage:draft'], acc)), [4]);
  assert.deepEqual(nums(applyFilters(items, ['project:b/two'], acc)), [2, 4], 'project match is case-insensitive');
  assert.deepEqual(nums(applyFilters(items, ['project:a/one', 'needs-me', 'stage:in-review'], acc)), [3]);
  assert.deepEqual(nums(applyFilters(items, ['project:none/none'], acc)), []);
});

test('applySort: priority, recently updated, recently created, manual', () => {
  const w = (i) => i.prio;
  assert.deepEqual(nums(applySort(items, 'priority', w)), [2, 3, 1, 4]);
  assert.deepEqual(nums(applySort(items, 'updated', w)), [1, 3, 2, 4], 'missing updated_at falls back to created_at');
  assert.deepEqual(nums(applySort(items, 'created', w)), [4, 3, 2, 1]);
  assert.deepEqual(nums(applySort(items, 'manual', w)), [4, 1, 2, 3]);
  assert.deepEqual(nums(items), [1, 2, 3, 4], 'input is not mutated');
});

test('filter + sort combine: drafts in manual order, needs-me by priority', () => {
  const w = (i) => i.prio;
  assert.deepEqual(nums(applySort(applyFilters(items, ['stage:draft'], acc), 'manual', w)), [4, 1]);
  assert.deepEqual(nums(applySort(applyFilters(items, ['needs-me'], acc), 'priority', w)), [2, 3]);
  assert.deepEqual(nums(applySort(applyFilters(items, ['questions'], acc), 'created', w)), [4, 3]);
});

test('board-order marker never renders in issue body views', async () => {
  const { renderMarkdown, getIssueDescriptionPreview } = await import('../panel/markdown.ts');
  const body = 'Short idea\n\n<!-- board-order: 1500 -->';
  const html = renderMarkdown(body);
  assert.ok(!html.includes('board-order'), 'renderMarkdown strips the marker');
  assert.ok(html.includes('Short idea'));
  assert.equal(getIssueDescriptionPreview(body), 'Short idea');
  assert.equal(getIssueDescriptionPreview('<!-- board-order: 1500 -->'), '', 'draft with no description has no preview');
  assert.ok(!renderMarkdown('<!-- board-order: 1500 -->').includes('board-order'));
});

test('order markers round-trip tiny and huge positions without rounding a midpoint into its neighbour', () => {
  for (const value of [1e-20, -1e-30, 1e22, Number.MAX_VALUE]) {
    assert.equal(parseOrderMarker(setOrderMarker('', value)), value);
    assert.equal(/[eE][+-]?\d+/.test(setOrderMarker('', value)), false);
  }
  const ordered = [draft(1, 1e-15, ''), draft(2, 2e-15, ''), draft(3, 1000, '')];
  const move = computeMove(ordered, 2, 1);
  assert.equal(move[0].index, 2);
  const persisted = parseOrderMarker(setOrderMarker('', move[0].order));
  assert.ok(persisted > 1e-15 && persisted < 2e-15);
});

test('M3: compareManualOrder and applySort break ties by repo before issue number', () => {
  const crossRepo = [
    { number: 1, repo: 'b/two', prio: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', body: '<!-- board-order: 1000 -->' },
    { number: 1, repo: 'a/one', prio: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', body: '<!-- board-order: 1000 -->' },
  ];
  assert.deepEqual(sortByManualOrder(crossRepo).map((i) => i.repo), ['a/one', 'b/two']);
  for (const sort of ['priority', 'updated', 'created', 'manual']) {
    assert.deepEqual(applySort(crossRepo, sort, (i) => i.prio).map((i) => i.repo), ['a/one', 'b/two']);
  }
});
