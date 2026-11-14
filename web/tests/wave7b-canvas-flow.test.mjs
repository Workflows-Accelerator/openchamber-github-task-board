// Wave 7b — Canvas Flow Overhaul.
//
// The canvas stops being a wall of status columns: cards are grouped by
// repository and parent issue, every group starts collapsed with honest counts,
// and the dependency flow is laid out by `arrangeFlowGraph` in LR or TD.
// Everything the user arranges (direction, expanded groups, dragged positions)
// is local layout state: it goes to /api/layout and never to GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { arrangeFlowGraph } from '../public/flow-layout.js';
import { parseOrderMarker } from '../server/board.ts';
import { startFakeGitHub, makeIssue } from './fake-github.mjs';
import { startBoard, HttpSession, SYNTHETIC_TOKEN } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'web/public');
const INDEX_HTML_PATH = path.join(PUBLIC_DIR, 'index.html');
const THEME_CSS_PATH = path.join(PUBLIC_DIR, 'theme.css');
const APP_JS_PATH = path.join(PUBLIC_DIR, 'app.js');
const SW_PATH = path.join(PUBLIC_DIR, 'sw.js');

const REPO = 'Workflows-Accelerator/openchamber-github-task-board';
const OTHER_REPO = 'Workflows-Accelerator/chambervoice';

function readPublic(name) {
  return fs.readFileSync(path.join(PUBLIC_DIR, name), 'utf8');
}

function card(number, extra = {}) {
  return {
    id: `${extra.repo || REPO}#${number}`,
    number,
    repo: extra.repo || REPO,
    parentKey: extra.parentKey ?? null,
    parentTitle: extra.parentTitle ?? null,
    stage: extra.stage || 'todo',
    activeSession: Boolean(extra.activeSession),
    priority: extra.priority || 'normal',
    createdAt: extra.createdAt || `2026-10-${String(number).padStart(2, '0')}T09:00:00Z`,
    dependencies: extra.dependencies || [],
    w: 280,
    h: 150,
  };
}

// ==========================================
// 1. arrangeFlowGraph integration
// ==========================================

test('W7b flow graph: groups by repository and parent issue, collapsed by default with counts', () => {
  const cards = [
    card(1, { parentKey: `${REPO}#100`, parentTitle: 'Epic: Canvas' }),
    card(2, { parentKey: `${REPO}#100`, parentTitle: 'Epic: Canvas', stage: 'needs-human', activeSession: true }),
    card(3, { parentKey: `${REPO}#100`, parentTitle: 'Epic: Canvas', stage: 'done' }),
    card(4),
    card(5, { repo: OTHER_REPO, parentKey: `${OTHER_REPO}#7`, parentTitle: 'Voice epic' }),
  ];

  const layout = arrangeFlowGraph(cards, { direction: 'LR' });
  assert.equal(layout.groups.length, 3, 'one group per repo + parent pair');

  const epic = layout.groups.find((group) => group.groupKey === `${REPO}::${REPO}#100`);
  assert.ok(epic, 'epic group exists');
  assert.equal(epic.collapsed, true, 'groups start collapsed');
  assert.equal(epic.total, 3);
  assert.equal(epic.running, 1, 'active session counts as running');
  assert.equal(epic.needsMe, 1);
  assert.equal(epic.done, 1);
  assert.equal(epic.title, 'Epic: Canvas');
  assert.deepEqual(Object.keys(layout.positions), [], 'collapsed groups expose no card positions');

  const standalone = layout.groups.find((group) => group.groupKey === `${REPO}::standalone`);
  assert.ok(standalone, 'unparented bucket per repository');
  assert.equal(standalone.collapsed, true);
  assert.equal(standalone.total, 1);
  assert.equal(standalone.parentKey, null);
});

test('W7b flow graph: expanding one group exposes its cards, keeps others collapsed and wires dependencies', () => {
  const cards = [
    card(1, { parentKey: `${REPO}#100`, parentTitle: 'Epic' }),
    card(2, { parentKey: `${REPO}#100`, parentTitle: 'Epic', dependencies: [1] }),
    card(3),
  ];
  const expanded = new Set([`${REPO}::${REPO}#100`]);
  const layout = arrangeFlowGraph(cards, { direction: 'LR', expandedGroups: expanded });

  assert.equal(layout.groups.find((group) => group.total === 2).collapsed, false);
  assert.ok(layout.positions[`${REPO}#1`], 'expanded card has a position');
  assert.ok(layout.positions[`${REPO}#2`]);
  assert.equal(layout.positions[`${REPO}#3`], undefined, 'collapsed group still hides its card');

  assert.equal(layout.edges.length, 1, 'dependency inside the expanded group stays a card wire');
  assert.equal(layout.edges[0].from, `${REPO}#1`);
  assert.equal(layout.edges[0].to, `${REPO}#2`);
  assert.ok(Array.isArray(layout.edges[0].points) && layout.edges[0].points.length >= 2);
});

test('W7b flow graph: a dependency into a collapsed group ends on the group box, not a hidden card', () => {
  const epicA = `${REPO}#100`;
  const groupB = `${OTHER_REPO}::${OTHER_REPO}#7`;
  const cards = [
    card(1, { parentKey: epicA, parentTitle: 'Epic A' }),
    card(2, { repo: OTHER_REPO, parentKey: `${OTHER_REPO}#7`, parentTitle: 'Epic B' }),
    card(3, { repo: OTHER_REPO, parentKey: `${OTHER_REPO}#7`, parentTitle: 'Epic B', dependencies: [1] }),
  ];
  const layout = arrangeFlowGraph(cards, {
    direction: 'LR',
    expandedGroups: [`${REPO}::${epicA}`],
  });

  const wire = layout.edges.find((edge) => edge.from === `${REPO}#1` && edge.to === groupB);
  assert.ok(wire, 'the visible card is wired to the collapsed group');
  assert.equal(wire.crossGroup, true);
  const target = layout.groups.find((group) => group.groupKey === groupB);
  assert.ok(target, 'collapsed group box exists');
  const end = wire.points[wire.points.length - 1];
  assert.deepEqual({ x: end.x, y: end.y }, { x: target.x, y: target.y + target.h / 2 }, 'wire terminates on the group box');
  assert.equal(layout.positions[`${OTHER_REPO}#3`], undefined, 'the hidden card has no position');
});

test('W7b flow graph: LR and TD change the primary axis and stay deterministic across input order', () => {
  const epic = `${REPO}#100`;
  const cards = [
    card(1, { parentKey: epic, parentTitle: 'Epic' }),
    card(2, { parentKey: epic, parentTitle: 'Epic', dependencies: [1] }),
    card(3, { parentKey: epic, parentTitle: 'Epic', dependencies: [2] }),
  ];
  const expandedGroups = new Set([`${REPO}::${epic}`]);
  const lr = arrangeFlowGraph(cards, { direction: 'LR', expandedGroups });
  const td = arrangeFlowGraph(cards, { direction: 'TD', expandedGroups });
  assert.ok(lr.width > lr.height, 'LR grows along the horizontal axis');
  assert.ok(td.height > td.width, 'TD grows along the vertical axis');

  const shuffled = arrangeFlowGraph(cards.slice().reverse(), { direction: 'LR', expandedGroups });
  assert.deepEqual(
    shuffled.groups.map((group) => group.groupKey),
    lr.groups.map((group) => group.groupKey),
    'group order does not depend on input order',
  );
});

// ==========================================
// 2. Serving /flow-layout.js
// ==========================================

test('W7b serving: /flow-layout.js is served with a JavaScript content type before sign-in', async () => {
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repo: REPO, issues: [makeIssue({ number: 1 })] });
  const board = await startBoard(fake);
  try {
    const response = await fetch(`${board.url}/flow-layout.js`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/javascript/);
    const body = await response.text();
    assert.match(body, /export function arrangeFlowGraph/);
    assert.match(body, /globalThis\.arrangeFlowGraph = arrangeFlowGraph/);
    assert.match(response.headers.get('content-security-policy') || '', /script-src 'self'/);
  } finally {
    await board.app.close();
    await fake.close();
  }
});

test('W7b serving: index.html loads flow-layout.js as a module before the deferred app bundle', () => {
  const html = readPublic('index.html');
  const flowPos = html.indexOf('src="/flow-layout.js"');
  const appPos = html.indexOf('src="/app.js"');
  assert.ok(flowPos > 0, 'flow-layout.js is referenced');
  assert.match(html, /<script type="module" src="\/flow-layout\.js"><\/script>/);
  assert.ok(appPos > flowPos, 'module scripts run before the deferred classic bundle');
  assert.match(html, /<script src="\/app\.js" defer><\/script>/);
  assert.match(html, /<script type="module" src="\/arrange\.js"><\/script>/, 'existing modules stay');
  assert.doesNotMatch(html, /\sstyle="/, 'strict CSP: no inline style attributes');
});

test('W7b serving: the service worker pre-caches and network-firsts flow-layout.js', () => {
  const sw = readPublic('sw.js');
  assert.match(sw, /var SHELL_ASSETS = \[[^\]]*'\/flow-layout\.js'/s);
  assert.match(sw, /pathname === '\/flow-layout\.js'/);
});

// ==========================================
// 3. Layout persistence, direction and drag
// ==========================================

async function layoutFixture(t, options = {}) {
  const issues = [
    makeIssue({ number: 1, title: 'Epic parent', body: '## Overview\n\nParent.\n', labels: ['status:todo'], repo: REPO }),
    makeIssue({ number: 2, title: 'Child task', body: '## Overview\n\nChild.\n', labels: ['status:todo'], repo: REPO }),
    makeIssue({ number: 3, title: 'Loose task', body: '## Overview\n\nLoose.\n', labels: ['status:in-progress'], repo: REPO }),
  ];
  const fake = await startFakeGitHub({ token: SYNTHETIC_TOKEN, repo: REPO, issues, ...options });
  const board = await startBoard(fake);
  t.after(async () => {
    await board.app.close();
    await fake.close();
  });
  const session = new HttpSession(board.url);
  await session.login();
  return { fake, board, session };
}

test('W7b layout: expanded groups and direction persist through PATCH /api/layout and the board payload', async (t) => {
  const { fake, session } = await layoutFixture(t);
  const patch = await session.request('/api/layout', {
    method: 'PATCH',
    body: {
      scope: REPO,
      direction: 'TD',
      expandedGroups: [`${REPO}::${REPO}#1`],
    },
  });
  assert.equal(patch.status, 200, patch.text);
  assert.equal(patch.json.direction, 'TD');
  assert.deepEqual(patch.json.expandedGroups, [`${REPO}::${REPO}#1`]);

  const board = await session.request('/api/board');
  assert.equal(board.status, 200);
  assert.equal(board.json.layout.direction, 'TD');
  assert.deepEqual(board.json.layout.expandedGroups, [`${REPO}::${REPO}#1`]);
  assert.equal(fake.patchCalls.length, 0, 'layout state never writes GitHub');
});

test('W7b layout: dragging a card saves coordinates to /api/layout with zero GitHub writes', async (t) => {
  const { fake, session } = await layoutFixture(t);
  const before = fake.findIssue(2).body;

  const moved = await session.request('/api/layout', {
    method: 'PATCH',
    body: { scope: 'all', setPositions: { [`${REPO}#2`]: { x: 412, y: 268 } } },
  });
  assert.equal(moved.status, 200, moved.text);
  assert.deepEqual(moved.json.positions[`${REPO}#2`], { x: 412, y: 268 });
  assert.equal(fake.patchCalls.length, 0, 'no GitHub PATCH on drag-position');
  assert.equal(fake.findIssue(2).body, before, 'issue body is untouched by a drag');

  // Arrange clears every manual position and stays local too.
  const arranged = await session.request('/api/layout', {
    method: 'PATCH',
    body: { scope: 'all', resetPositions: true },
  });
  assert.equal(arranged.status, 200);
  assert.deepEqual(arranged.json.positions, {});
  assert.equal(fake.patchCalls.length, 0, 'Arrange never writes GitHub');
});

test('W7b layout: the client drag path persists through /api/layout, not the GitHub canvas endpoint', () => {
  const js = readPublic('app.js');
  const start = js.indexOf('function saveCardPosition(');
  assert.ok(start > 0, 'saveCardPosition exists');
  const end = js.indexOf('\n  function ', start + 10);
  const body = js.slice(start, end > start ? end : start + 4000);
  assert.match(body, /persistCanvasLayout\(\s*\{\s*setPositions:/, 'drag saves to the layout store');
  assert.doesNotMatch(body, /saveIssueCanvas\(/, 'drag never writes the issue body');
  assert.doesNotMatch(body, /'\/canvas'/, 'drag never calls the GitHub canvas endpoint');

  assert.match(js, /api\('\/api\/layout',\s*\{\s*method:\s*'PATCH'/, 'one layout PATCH helper');
  assert.match(js, /resetPositions:\s*true/, 'Arrange resets manual positions');
  assert.match(js, /window\.arrangeFlowGraph/, 'layout comes from flow-layout.js');
});

// ==========================================
// 4. Manual order override and reset to auto
// ==========================================

test('W7b order: numeric order sets board-order, order: null resets the task to automatic order', async (t) => {
  const { fake, session } = await layoutFixture(t);
  const originalBody = fake.findIssue(2).body;

  async function fingerprintOf(number) {
    const board = await session.request('/api/board?refresh=1');
    return board.json.issues.find((issue) => issue.number === number).fingerprint;
  }

  const set = await session.request('/api/issues/2', {
    method: 'PATCH',
    body: { order: 2400, fingerprint: await fingerprintOf(2) },
  });
  assert.equal(set.status, 200, set.text);
  assert.equal(parseOrderMarker(fake.findIssue(2).body), 2400);

  const board = await session.request('/api/board?refresh=1');
  assert.equal(board.json.issues.find((issue) => issue.number === 2).order, 2400);

  const reset = await session.request('/api/issues/2', {
    method: 'PATCH',
    body: { order: null, fingerprint: await fingerprintOf(2) },
  });
  assert.equal(reset.status, 200, reset.text);
  const resetBody = fake.findIssue(2).body;
  assert.equal(parseOrderMarker(resetBody), null, 'board-order marker removed');
  assert.match(resetBody, /## Overview/, 'heading survives the reset');
  assert.match(resetBody, /Child\./, 'body text survives the reset');
  assert.doesNotMatch(resetBody, /board-order/i, 'no order marker remains');
  assert.equal(resetBody.trim(), originalBody.trim(), 'reset changes no body content, only a trailing separator');
  assert.equal(reset.json.issue.order, null);

  const reread = await session.request('/api/board?refresh=1');
  assert.equal(reread.json.issues.find((issue) => issue.number === 2).order, null);
});

test('W7b order: the drawer exposes a numeric order control and an auto reset', () => {
  const html = readPublic('index.html');
  assert.match(html, /id="order-input"/);
  assert.match(html, /id="order-apply"/);
  assert.match(html, /id="order-auto"/);

  const js = readPublic('app.js');
  assert.match(js, /saveIssueOrder\([^)]*,\s*null\)/, 'auto reset clears the order');
  assert.match(js, /function saveIssueOrder\(/, 'one order save helper');
});

// ==========================================
// 5. Active session ring vs idle in-progress
// ==========================================

test('W7b status: active session gets the rotating ring, idle in-progress a steady border', () => {
  const js = readPublic('app.js');
  assert.match(js, /activeSession\.active\s*===\s*true/, 'only a live session is treated as running');
  assert.match(js, /canvas-card-agent-active/, 'active card class applied');
  assert.match(js, /canvas-card-in-progress-idle/, 'idle in-progress class applied');
  assert.match(js, /dict\.canvas_agent_running/, 'localized running indicator');

  const css = readPublic('theme.css');
  assert.match(css, /@keyframes canvas-agent-rotate/, 'rotating border animation defined');
  assert.match(css, /\.canvas-card-agent-active/, 'active card styled');
  assert.match(css, /animation:\s*canvas-agent-rotate/, 'active card uses the rotation');
  assert.match(css, /\.canvas-card-in-progress-idle/, 'idle in-progress styled');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}canvas-agent-rotate/, 'reduced motion stops the rotation');

  const idleRule = css.match(/\.canvas-card-in-progress-idle\s*\{[^}]*\}/s);
  assert.ok(idleRule, 'idle rule exists');
  assert.doesNotMatch(idleRule[0], /animation/, 'idle in-progress never animates');
});

// ==========================================
// 6. Client flow helpers (vm harness)
// ==========================================

function selectorMatches(node, selector) {
  if (selector.startsWith('.')) return String(node.className).split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  const attribute = /^\[([^=]+)="([^"]*)"\]$/.exec(selector);
  if (attribute) return node.getAttribute(attribute[1]) === attribute[2];
  return false;
}

function clientHarness(viewportWidth = 1280) {
  const elements = new Map();
  function node() {
    let text = '';
    const attributes = {};
    const classes = new Set();
    const created = {
      children: [], value: '', hidden: false, disabled: false, className: '', id: '', parentNode: null,
      clientWidth: 0, clientHeight: 0, offsetWidth: 280, offsetHeight: 150, offsetLeft: 0, offsetTop: 0,
      style: {},
      get textContent() { return text; },
      set textContent(value) { text = value; this.children = []; },
      setAttribute(key, value) { attributes[key] = value; if (key === 'id') { this.id = value; elements.set(value, this); } },
      getAttribute(key) { return Object.prototype.hasOwnProperty.call(attributes, key) ? attributes[key] : null; },
      removeAttribute(key) { delete attributes[key]; },
      appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
      append() {}, addEventListener() {}, removeEventListener() {}, focus() {}, remove() {},
      classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, contains(name) { return classes.has(name); }, toggle() {} },
      querySelector(selector) {
        for (const child of this.children) {
          if (selectorMatches(child, selector)) return child;
          const nested = child.querySelector(selector);
          if (nested) return nested;
        }
        return null;
      },
      querySelectorAll(selector) {
        const found = [];
        const walk = (current) => {
          for (const child of current.children) {
            if (selectorMatches(child, selector)) found.push(child);
            walk(child);
          }
        };
        walk(this);
        return found;
      },
      closest() { return null; },
    };
    return created;
  }
  const get = (id) => { if (!elements.has(id)) { const created = node(); created.id = id; elements.set(id, created); } return elements.get(id); };
  const context = vm.createContext({
    console,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      getElementById: get,
      createElement: () => node(),
      createElementNS: () => node(),
      querySelector: () => null,
      querySelectorAll: () => [],
      documentElement: { setAttribute() {}, removeAttribute() {}, lang: '' },
      body: { classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} } },
      addEventListener() {},
    },
    window: {
      innerWidth: viewportWidth,
      setTimeout: (fn) => { fn(); return 0; },
      clearTimeout() {}, setInterval() {}, clearInterval() {},
      addEventListener() {}, removeEventListener() {},
      location: { hash: '' },
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      arrangeFlowGraph,
    },
    fetch: async () => ({ ok: true, status: 200, text: async () => '{}' }),
  });
  const source = readPublic('app.js').replace(
    '  boot();',
    '  window.__app = { state, I18N, resolveFlowDirection, flowGroupKeyOf, effectiveExpandedGroups, computeFlowLayout, applyServerLayout, getLanguage, renderCanvasIssues, updateCanvasTransform, renderBoard };',
  );
  vm.runInContext(source, context);
  const app = context.window.__app;
  app.__elements = elements;
  app.__get = get;
  return app;
}

test('W7b client: Auto direction resolves by viewport width, explicit direction always wins', () => {
  const wide = clientHarness(1280);
  assert.equal(wide.resolveFlowDirection('auto', 1280), 'LR');
  assert.equal(wide.resolveFlowDirection('auto', 390), 'TD');
  assert.equal(wide.resolveFlowDirection('TD', 1280), 'TD', 'explicit TD overrides a wide viewport');
  assert.equal(wide.resolveFlowDirection('LR', 390), 'LR', 'explicit LR overrides a narrow viewport');
  assert.equal(wide.resolveFlowDirection('nonsense', 390), 'TD', 'unknown values fall back to auto');
});

test('W7b client: search auto-expands matching groups without clobbering the saved set', () => {
  const app = clientHarness(1280);
  app.state.canvasExpandedGroups = new Set([`${REPO}::standalone`]);
  app.state.searchQuery = 'canvas';
  const issues = [
    { number: 1, repository: { full: REPO }, parentKey: `${REPO}#100`, parentTitle: 'Epic', state: 'open', statusLabel: 'status:todo' },
  ];
  const expanded = app.effectiveExpandedGroups(issues);
  assert.ok(expanded.has(`${REPO}::${REPO}#100`), 'matching group is auto-expanded');
  assert.ok(expanded.has(`${REPO}::standalone`), 'saved expansion is kept');
  assert.deepEqual([...app.state.canvasExpandedGroups], [`${REPO}::standalone`], 'saved set is untouched');

  app.state.searchQuery = '';
  const collapsedAgain = app.effectiveExpandedGroups(issues);
  assert.deepEqual([...collapsedAgain], [`${REPO}::standalone`], 'without a search the group collapses again');
});

test('W7b client: computeFlowLayout follows the resolved direction and applies dragged positions', () => {
  const app = clientHarness(390);
  const issues = [
    { number: 1, repository: { full: REPO }, parentKey: `${REPO}#100`, parentTitle: 'Epic', state: 'open', statusLabel: 'status:todo', createdAt: '2026-10-01T09:00:00Z' },
    { number: 2, repository: { full: REPO }, parentKey: `${REPO}#100`, parentTitle: 'Epic', state: 'open', statusLabel: 'status:todo', createdAt: '2026-10-02T09:00:00Z' },
  ];
  app.state.canvasExpandedGroups = new Set([`${REPO}::${REPO}#100`]);
  app.state.canvasDirectionMode = 'auto';
  app.state.canvasManualPositions = { [`${REPO}#2`]: { x: 640, y: 320 } };

  const layout = app.computeFlowLayout(issues);
  assert.equal(layout.direction, 'TD', 'narrow viewport resolves to TD');
  const manual = layout.positions[`${REPO}#2`];
  assert.equal(manual.x, 640, 'the dragged x wins');
  assert.equal(manual.y, 320, 'the dragged y wins');
  assert.equal(manual.w, 280, 'the card keeps its real width');
  assert.equal(manual.h, 150, 'the card keeps its real height');
  assert.equal(manual.groupKey, `${REPO}::${REPO}#100`, 'the card keeps its real group');
  assert.equal(layout.groups.length, 1);
  assert.equal(layout.groups[0].collapsed, false);

  app.state.canvasDirectionMode = 'LR';
  assert.equal(app.computeFlowLayout(issues).direction, 'LR', 'explicit LR wins on a phone');
});

test('W7b client: a collapsed group does not leave its sticky notes floating without their card', () => {
  const app = clientHarness(1280);
  app.state.canvasHasSavedState = true;
  const issues = [
    {
      number: 1, repository: { full: REPO }, parentKey: `${REPO}#100`, parentTitle: 'Epic',
      state: 'open', statusLabel: 'status:todo', createdAt: '2026-10-01T09:00:00Z',
      canvas: { x: 40, y: 40, notes: [{ id: 'n1', x: 60, y: 200, w: 220, h: 130, text: 'first' }] },
    },
    {
      number: 2, repository: { full: REPO }, parentKey: `${REPO}#100`, parentTitle: 'Epic',
      state: 'open', statusLabel: 'status:todo', createdAt: '2026-10-02T09:00:00Z',
      canvas: { x: 400, y: 40, notes: [{ id: 'n2', x: 420, y: 200, w: 220, h: 130, text: 'second' }] },
    },
  ];
  app.state.canvasExpandedGroups = new Set();
  app.renderCanvasIssues(issues);
  const notesLayer = app.__elements.get('canvas-notes');
  assert.equal(
    notesLayer.querySelectorAll('.canvas-sticky-note').length,
    0,
    'no sticky note is drawn for a card hidden inside a collapsed group',
  );

  app.state.canvasExpandedGroups = new Set([`${REPO}::${REPO}#100`]);
  app.renderCanvasIssues(issues);
  assert.equal(
    notesLayer.querySelectorAll('.canvas-sticky-note').length,
    2,
    'expanding the group brings both notes back with their cards',
  );
});

// ==========================================
// 7. Invariants: I18N parity, forbidden tokens, CSP
// ==========================================

test('W7b client: 345 issues across 27 repositories render group cards only while collapsed', () => {
  const app = clientHarness(1280);
  app.state.canvasHasSavedState = true;
  app.state.canvasExpandedGroups = new Set();
  const issues = [];
  for (let repoIndex = 0; repoIndex < 27; repoIndex += 1) {
    const repo = `Workflows-Accelerator/repo-${String(repoIndex + 1).padStart(2, '0')}`;
    const perRepo = repoIndex < 21 ? 13 : 12;
    for (let index = 0; index < perRepo; index += 1) {
      const number = issues.length + 1;
      issues.push({
        number,
        repository: { full: repo },
        parentKey: index < 4 ? `${repo}#${100 + repoIndex}` : null,
        parentTitle: index < 4 ? `Epic ${repoIndex + 1}` : null,
        state: 'open',
        statusLabel: index % 7 === 0 ? 'status:needs-human' : 'status:todo',
        priority: 'normal',
        createdAt: `2026-10-${String((index % 28) + 1).padStart(2, '0')}T09:00:00Z`,
        blockedBy: [],
      });
    }
  }
  assert.equal(issues.length, 345);

  app.renderCanvasIssues(issues);
  const cardsLayer = app.__elements.get('canvas-cards');
  assert.equal(cardsLayer.querySelectorAll('.canvas-card').length, 0, 'no card element is built for a collapsed group');
  assert.equal(cardsLayer.querySelectorAll('.canvas-group-frame').length, 0, 'collapsed groups are not frames');
  assert.equal(cardsLayer.querySelectorAll('.canvas-group-card').length, 54, 'one group card per repository/parent pair');
});

test('W7b invariants: new UI strings exist in both languages and forbidden tokens stay absent', () => {
  const js = readPublic('app.js');
  for (const key of [
    'canvas_direction_auto', 'canvas_direction_lr', 'canvas_direction_td',
    'canvas_group_standalone', 'canvas_group_expand', 'canvas_group_collapse',
    'canvas_group_running', 'canvas_group_needs_me', 'canvas_group_done',
    'canvas_agent_running', 'canvas_agent_idle',
    'drawer_order_label', 'drawer_order_apply', 'drawer_order_auto',
  ]) {
    const occurrences = (js.match(new RegExp(`\\b${key}:`, 'g')) || []).length;
    assert.equal(occurrences, 2, `${key} must exist in the English and French dictionaries`);
  }
  for (const [name, content] of [['index.html', readPublic('index.html')], ['theme.css', readPublic('theme.css')], ['app.js', js]]) {
    assert.doesNotMatch(content, /\bn8n\b/i, `forbidden token "n8n" in ${name}`);
    assert.doesNotMatch(content, /\bmobile\b/i, `forbidden token "mobile" in ${name}`);
    assert.doesNotMatch(content, /\p{Extended_Pictographic}/u, `no emoji in ${name}`);
  }
});

test('W7b invariants: dot grid, note layer and flow controls stay in place', () => {
  const html = readPublic('index.html');
  assert.match(html, /id="canvas-direction-auto"/);
  assert.match(html, /id="canvas-direction-lr"/);
  assert.match(html, /id="canvas-direction-td"/);
  assert.match(html, /id="canvas-show-all"/);
  assert.match(html, /id="canvas-arrange"/);

  // Behaviour, not source text: the dot grid actually changes step with zoom.
  const app = clientHarness(1280);
  const sizeAt = (scale) => {
    app.state.canvasScale = scale;
    app.updateCanvasTransform();
    // The node is created on first lookup by the code under test.
    return app.__elements.get('canvas-viewport').style.backgroundSize;
  };
  assert.equal(sizeAt(0.2), '19.20px 19.20px', 'far zoom uses the 4x grid (24 * 4 * 0.2)');
  assert.equal(sizeAt(0.5), '24.00px 24.00px', 'mid zoom uses the 2x grid (24 * 2 * 0.5)');
  assert.equal(sizeAt(1), '24.00px 24.00px', 'normal zoom uses the base grid (24 * 1)');

  // A null board is a failure state, not an empty render: the list is untouched.
  app.state.board = null;
  const list = app.__get('task-list');
  list.textContent = 'kept';
  app.renderBoard();
  assert.equal(list.textContent, 'kept', 'renderBoard leaves the list untouched when there is no board');

  // The notes layer still receives a card's sticky note.
  app.state.canvasHasSavedState = true;
  app.state.canvasExpandedGroups = new Set([`${REPO}::standalone`]);
  app.renderCanvasIssues([{
    number: 1, repository: { full: REPO }, state: 'open', statusLabel: 'status:todo',
    canvas: { notes: [{ id: 'n1', x: 60, y: 200, w: 220, h: 130, text: 'note' }] },
  }]);
  assert.equal(
    app.__elements.get('canvas-notes').querySelectorAll('.canvas-sticky-note').length,
    1,
    'a note is drawn in the notes layer',
  );

  const css = readPublic('theme.css');
  assert.match(css, /\.canvas-group-card/);
  assert.match(css, /\.canvas-group-frame/);
  assert.match(css, /\.canvas-direction-btn/);
});
