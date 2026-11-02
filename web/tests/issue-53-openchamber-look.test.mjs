import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'web/public/index.html');
const THEME_CSS_PATH = path.join(ROOT_DIR, 'web/public/theme.css');
const APP_JS_PATH = path.join(ROOT_DIR, 'web/public/app.js');

function createMockBrowser(storage = {}) {
  const nodes = new Map();
  const store = new Map(Object.entries(storage));
  const calls = [];

  function createNode(tag = 'div', id = '') {
    const attrs = {};
    let textValue = '';
    const classSet = new Set();
    const n = {
      tagName: String(tag).toUpperCase(),
      id,
      value: '',
      get textContent() {
        return textValue;
      },
      set textContent(v) {
        textValue = String(v);
        if (textValue === '') this.children = [];
      },
      children: [],
      hidden: false,
      disabled: false,
      checked: false,
      get className() {
        return Array.from(classSet).join(' ');
      },
      set className(v) {
        classSet.clear();
        String(v).split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
      },
      classList: {
        add: (...classes) => {
          classes.forEach((c) => classSet.add(c));
        },
        remove: (...classes) => {
          classes.forEach((c) => classSet.delete(c));
        },
        contains: (c) => classSet.has(c),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classSet.has(c)) classSet.delete(c);
            else classSet.add(c);
          } else if (force) {
            classSet.add(c);
          } else {
            classSet.delete(c);
          }
        },
      },
      style: {},
      scrollHeight: 0,
      attrs,
      listeners: {},
      setAttribute(key, value) {
        attrs[key] = String(value);
        if (key === 'hidden') this.hidden = true;
        else if (key === 'class') this.className = value;
        else this[key] = value;
      },
      removeAttribute(key) {
        delete attrs[key];
        if (key === 'hidden') this.hidden = false;
        else delete this[key];
      },
      getAttribute(key) {
        return attrs[key] !== undefined ? attrs[key] : (this[key] !== undefined ? String(this[key]) : null);
      },
      hasAttribute(key) {
        return attrs[key] !== undefined || this[key] !== undefined;
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      addEventListener(event, callback) {
        this.listeners[event] = callback;
      },
      focus() {
        context.document.activeElement = this;
      },
      querySelector() {
        return createNode();
      },
      querySelectorAll() {
        return [];
      },
      closest() {
        return null;
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
    };
    return n;
  }

  const get = (id) => {
    if (!nodes.has(id)) {
      nodes.set(id, createNode('div', id));
    }
    return nodes.get(id);
  };

  const docEl = createNode('html');
  const bodyEl = createNode('body');

  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };

  let responder = async () => ({
    status: 503,
    ok: false,
    text: async () => JSON.stringify({ error: 'unavailable', message: 'Try later' }),
  });

  const context = {
    document: {
      documentElement: docEl,
      body: bodyEl,
      activeElement: null,
      title: '',
      getElementById: get,
      createElement: (tag) => createNode(tag),
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: {
      setTimeout: (fn) => {
        fn();
        return 1;
      },
      clearTimeout: () => {},
      addEventListener: () => {},
      location: { hash: '' },
      confirm: () => true,
    },
    localStorage,
    navigator: { onLine: true },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responder(url, options);
    },
  };

  const appSource = fs.readFileSync(APP_JS_PATH, 'utf8');
  const strippedSource = appSource.replace(/\bboot\(\);(?=\s*\(\)\s*;\s*$|$)/m, '');
  vm.runInNewContext(strippedSource, context);

  return {
    app: context.window.__taskBoard,
    context,
    get,
    docEl,
    bodyEl,
    store,
    calls,
    setResponder(fn) {
      responder = fn;
    },
  };
}

const mockIssues = [
  {
    number: 1,
    title: 'Alpha task',
    body: '## Overview\nAlpha task description.\n',
    state: 'open',
    statusLabel: 'status:draft',
    labels: ['status:draft', 'priority:high'],
    user: 'board-owner',
    repository: { full: 'owner/alpha', owner: 'owner', name: 'alpha' },
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
    counts: {},
  },
  {
    number: 2,
    title: 'Beta task',
    body: '## Overview\nBeta task description.\n\n### Acceptance Criteria\n- [ ] AC 1\n',
    state: 'open',
    statusLabel: 'status:todo',
    labels: ['status:todo', 'priority:medium'],
    user: 'board-owner',
    repository: { full: 'owner/alpha', owner: 'owner', name: 'alpha' },
    createdAt: '2026-10-02T00:00:00Z',
    updatedAt: '2026-10-03T00:00:00Z',
    counts: { humanTasks: { total: 1, open: 1 } },
  },
];

// ============================================================================
// 1. Full-Width Edge-to-Edge Layout (D63.1)
// ============================================================================
test('1.a D63.1 theme.css removes 860px max-width on main/shell for full-width layout', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  assert.ok(
    !/main\s*\{[^}]*max-width:\s*860px/m.test(css),
    'theme.css must not constrain main to 860px centered column'
  );
  assert.ok(
    /main[^{]*\{[^}]*(?:max-width:\s*(?:100%|none)|width:\s*100%)/m.test(css),
    'theme.css must specify full-width layout (width: 100% or max-width: 100%/none)'
  );
});

test('1.b D63.1 index.html hides verbose diagnostic nodes by default', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  assert.ok(
    /<p[^>]*id="discovery-status"[^>]*hidden/.test(html) ||
    /id="discovery-status"[^>]*class="[^"]*sr-only/.test(html),
    '#discovery-status must be hidden by default'
  );
  assert.ok(
    /<p[^>]*id="refresh-policy"[^>]*hidden/.test(html) ||
    /id="refresh-policy"[^>]*class="[^"]*sr-only/.test(html),
    '#refresh-policy must be hidden by default'
  );
});

// ============================================================================
// 2. Unified Compact OpenChamber Toolbar (D63.2)
// ============================================================================
test('2.a D63.2 index.html markup contains unified toolbar elements and sub-header status strip', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const requiredIds = [
    'repo-select-btn',
    'repo-label',
    'board-search',
    'view-btn',
    'filter-btn',
    'sort-btn',
    'refresh-btn',
    'settings-btn',
    'signout-btn',
    'scope-status',
    'board-count',
    'freshness',
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `index.html must include id="${id}"`);
  }
});

test('2.b D63.2 Search input filters task list dynamically', () => {
  const { app, get } = createMockBrowser();
  app.state.board = {
    repo: 'owner/alpha',
    repository: { full: 'owner/alpha', owner: 'owner', name: 'alpha', hasIssues: true, archived: false },
    issues: mockIssues,
  };
  app.state.repositories = { repositories: [{ full: 'owner/alpha', available: true, archived: false, hasIssues: true }] };
  app.state.selected = 'owner/alpha';
  app.state.viewState = { view: 'simple', filters: [], sort: 'priority' };

  app.renderBoard();
  const initialCount = get('task-list').children.length;
  assert.equal(initialCount, 2, 'Initial list renders both tasks');

  // Set search query and re-render
  app.setSearchQuery('Beta');
  assert.equal(get('task-list').children.length, 1, 'Search for Beta leaves 1 item');
  app.setSearchQuery('');
  assert.equal(get('task-list').children.length, 2, 'Clearing search restores 2 items');
});

// ============================================================================
// 3. Linear-Style Compact Simple List Rows (D63.3)
// ============================================================================
test('3.a D63.3 Simple list rows render in compact Linear style with status dot, title, and description preview', () => {
  const { app, get } = createMockBrowser();
  app.state.board = {
    repo: 'owner/alpha',
    repository: { full: 'owner/alpha', owner: 'owner', name: 'alpha', hasIssues: true, archived: false },
    issues: mockIssues,
  };
  app.state.repositories = { repositories: [{ full: 'owner/alpha', available: true, archived: false, hasIssues: true }] };
  app.state.selected = 'owner/alpha';
  app.state.viewState = { view: 'simple', filters: [], sort: 'priority' };

  app.renderBoard();
  const list = get('task-list');
  assert.equal(list.children.length, 2);

  const row0 = list.children[0].children[0] || list.children[0];
  assert.ok(
    row0.classList.contains('simple-row') && row0.classList.contains('task-row'),
    'Row element must carry both .simple-row and .task-row classes for compatibility'
  );

  // Status dot check
  const hasDot = row0.children.some((c) => c.classList.contains('simple-dot') || c.classList.contains('simple-status-dot'));
  assert.ok(hasDot, 'Simple row must have a status dot element');

  // Title check
  const hasTitle = row0.children.some((c) =>
    c.classList.contains('simple-row-title') ||
    c.classList.contains('simple-title') ||
    (c.children && c.children.some((sc) => sc.classList.contains('simple-row-title') || sc.classList.contains('simple-title')))
  );
  assert.ok(hasTitle, 'Simple row must render task title');
});

// ============================================================================
// 4. Slide-Over Detail Drawer (D63.4)
// ============================================================================
test('4.a D63.4 Opening task detail keeps #board-view visible underneath and marks body.drawer-open', () => {
  const { app, get, bodyEl } = createMockBrowser();
  app.state.board = {
    repo: 'owner/alpha',
    repository: { full: 'owner/alpha', owner: 'owner', name: 'alpha', hasIssues: true, archived: false },
    issues: mockIssues,
  };
  app.state.repositories = { repositories: [{ full: 'owner/alpha', available: true, archived: false, hasIssues: true }] };
  app.state.selected = 'owner/alpha';
  app.state.viewState = { view: 'simple', filters: [], sort: 'priority' };

  app.showBoard();
  assert.equal(get('board-view').hidden, false);
  assert.equal(get('detail-view').hidden, true);
  assert.equal(bodyEl.classList.contains('drawer-open'), false);

  // Show detail view
  app.showView('detail');
  assert.equal(get('board-view').hidden, false, '#board-view must stay visible under slide-over drawer');
  assert.equal(get('detail-view').hidden, false, '#detail-view must be visible');
  assert.equal(get('drawer-backdrop').hidden, false, '#drawer-backdrop must be visible');
  assert.equal(bodyEl.classList.contains('drawer-open'), true, 'body must receive .drawer-open');

  // Close drawer
  app.showBoard();
  assert.equal(get('board-view').hidden, false);
  assert.equal(get('detail-view').hidden, true);
  assert.equal(get('drawer-backdrop').hidden, true);
  assert.equal(bodyEl.classList.contains('drawer-open'), false, 'body must remove .drawer-open');
});

test('4.b D63.4 theme.css styles slide-over drawer with 480px width on desktop', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  assert.ok(
    /min\(480px,\s*100(?:vw|%)\)|(?:width|max-width):\s*480px/.test(css),
    'theme.css must style slide-over drawer width to 480px / min(480px, 100vw)'
  );
});

// ============================================================================
// 5. OpenChamber Color Tokens & Theme Mode Auto / Dark / Light (D64)
// ============================================================================
test('5.a D64 theme.css defines OpenChamber dark and light color tokens', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  // Dark tokens
  assert.ok(css.includes('#0f1012'), 'theme.css must declare dark --bg #0f1012');
  assert.ok(css.includes('#16181b'), 'theme.css must declare dark --surf #16181b');
  assert.ok(css.includes('#1c1f24'), 'theme.css must declare dark --surf-muted #1c1f24');
  assert.ok(css.includes('#f0f2f5'), 'theme.css must declare dark --fg #f0f2f5');

  // Light tokens
  assert.ok(css.includes('#f4f5f7'), 'theme.css must declare light --bg #f4f5f7');
  assert.ok(css.includes('#ffffff'), 'theme.css must declare light --surf #ffffff');
  assert.ok(css.includes('#eaedf0'), 'theme.css must declare light --surf-muted #eaedf0');
  assert.ok(css.includes('#d0d5dd'), 'theme.css must declare light --border #d0d5dd');
  assert.ok(css.includes('#1f2328'), 'theme.css must declare light --fg #1f2328');
});

test('5.b D64 app.js supports Theme mode Auto / Dark / Light persisted to localStorage tb_theme_mode', () => {
  const { app, docEl, store } = createMockBrowser({ tb_theme_mode: 'light' });

  // Boot should read stored light theme
  app.applyThemeMode();
  assert.equal(docEl.getAttribute('data-theme'), 'light');

  // Switch to dark
  app.setThemeMode('dark');
  assert.equal(docEl.getAttribute('data-theme'), 'dark');
  assert.equal(store.get('tb_theme_mode'), 'dark');

  // Switch to auto
  app.setThemeMode('auto');
  assert.equal(store.get('tb_theme_mode'), 'auto');
  assert.ok(
    docEl.getAttribute('data-theme') === 'auto' || docEl.getAttribute('data-theme') === null,
    'Auto mode removes data-theme or sets data-theme="auto"'
  );
});
