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

function findTaskRows(root) {
  const rows = [];
  const walk = (node) => {
    if (!node) return;
    if (node.classList && node.classList.contains('task-row')) rows.push(node);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(root);
  return rows;
}

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
  const initialRows = findTaskRows(get('task-list'));
  assert.equal(initialRows.length, 2, 'Initial list renders both tasks');
  assert.equal(get('task-list').children.length, 2, 'Initial list renders 2 non-empty stage groups');

  // Set search query and re-render
  app.setSearchQuery('Beta');
  assert.equal(findTaskRows(get('task-list')).length, 1, 'Search for Beta leaves 1 item');
  assert.equal(get('task-list').children.length, 1, 'Search for Beta leaves 1 stage group');
  app.setSearchQuery('');
  assert.equal(findTaskRows(get('task-list')).length, 2, 'Clearing search restores 2 items');
  assert.equal(get('task-list').children.length, 2, 'Clearing search restores 2 stage groups');
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
  const rows = findTaskRows(list);
  assert.equal(rows.length, 2);
  assert.equal(list.children.length, 2);

  const row0 = rows[0];
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

test('4.b D63.4 theme.css styles slide-over drawer with 480-540px width on desktop', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  const match = /\.task-drawer\s*\{[^}]*width:\s*min\((\d+)px,\s*100(?:vw|%)\)/s.exec(css);
  assert.ok(match, 'theme.css must declare .task-drawer { width: min(<px>, 100vw) }');
  const width = Number(match[1]);
  assert.ok(width >= 480 && width <= 540, `drawer width ${width}px must stay within 480-540px`);
});

// ============================================================================
// 5. OpenChamber Color Tokens & Theme Mode Auto / Dark / Light (D64)
// ============================================================================
test('5.a D64 theme.css defines V3 architectural studio dark and light color tokens and removes V1 muddy tokens', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  // Dark tokens
  assert.ok(css.includes('#0B0D11'), 'theme.css must declare dark --bg #0B0D11');
  assert.ok(css.includes('#101318'), 'theme.css must declare dark chrome #101318');
  assert.ok(css.includes('#161A22'), 'theme.css must declare dark card --surf #161A22');
  assert.ok(css.includes('#1E2430'), 'theme.css must declare dark raised #1E2430');
  assert.ok(css.includes('#F1F5F9'), 'theme.css must declare dark --fg #F1F5F9');
  assert.ok(css.includes('#94A3B8'), 'theme.css must declare dark secondary #94A3B8');
  assert.ok(css.includes('rgba(255, 255, 255, 0.08)'), 'theme.css must declare dark hairline rgba(255, 255, 255, 0.08)');

  // Light tokens
  assert.ok(css.includes('#F7F8FA'), 'theme.css must declare light --bg #F7F8FA');
  assert.ok(css.includes('#FFFFFF'), 'theme.css must declare light card --surf #FFFFFF');
  assert.ok(css.includes('#F1F3F6'), 'theme.css must declare light chrome #F1F3F6');
  assert.ok(css.includes('#0F172A'), 'theme.css must declare light --fg #0F172A');
  assert.ok(css.includes('#475569'), 'theme.css must declare light secondary #475569');
  assert.ok(css.includes('#64748B'), 'theme.css must declare muted #64748B');
  assert.ok(css.includes('#1E293B'), 'theme.css must declare light --prim #1E293B');
  assert.ok(css.includes('#2563EB'), 'theme.css must declare accent #2563EB');
  assert.ok(css.includes('rgba(15, 23, 42, 0.08)'), 'theme.css must declare light hairline rgba(15, 23, 42, 0.08)');

  // Legacy V1 tokens removed
  assert.ok(!css.toLowerCase().includes('#f6f4ee'), 'theme.css must remove V1 cream #f6f4ee');
  assert.ok(!css.toLowerCase().includes('#151412'), 'theme.css must remove V1 brown-black #151412');
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

// ============================================================================
// 6. Hostile Review Regression Checks (Blockers 1–6)
// ============================================================================
test('6.a Blocker 1: all inline SVGs in index.html have explicit width="14" height="14" and theme.css constrains svg/.icon/.icon-sm to 14px', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const svgTags = html.match(/<svg\b[^>]*>/g) || [];
  assert.ok(svgTags.length >= 3, 'index.html should contain toolbar SVG icons');
  for (const tag of svgTags) {
    assert.match(tag, /\bwidth="14"/, `SVG tag must have width="14": ${tag}`);
    assert.match(tag, /\bheight="14"/, `SVG tag must have height="14": ${tag}`);
  }

  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  assert.match(
    css,
    /svg,\s*\.icon,\s*\.icon-sm\s*\{[^}]*width:\s*14px;[^}]*height:\s*14px;[^}]*flex-shrink:\s*0;/s,
    'theme.css must size svg, .icon, .icon-sm to 14px x 14px with flex-shrink: 0'
  );

  const { app, get } = createMockBrowser();
  app.state.repositories = {
    freshnessMs: 60000,
    visibleCount: 2,
    discoveryFailed: false,
    repositories: [
      { full: 'owner/alpha', available: true, archived: false, hasIssues: true },
      { full: 'owner/beta', available: true, archived: false, hasIssues: true },
    ],
  };
  app.state.selected = 'all';
  app.renderPicker();
  assert.equal(get('repo-label').textContent, 'All Projects');
  app.state.selected = 'owner/alpha';
  app.renderPicker();
  assert.equal(get('repo-label').textContent, 'Alpha');
});

test('6.b Blocker 2: Simple list row strips markdown headings/checklists from description preview and theme.css sets flex-direction: row on .simple-row', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  assert.match(
    css,
    /\.simple-row,\s*\.view-simple\s+\.task-row\s*\{[^}]*flex-direction:\s*row;/s,
    'theme.css must explicitly set flex-direction: row on .simple-row, .view-simple .task-row'
  );
  assert.match(
    css,
    /\.simple-row-main\s*\{[^}]*flex-direction:\s*column;/s,
    'theme.css must set flex-direction: column on .simple-row-main'
  );

  const { app, get } = createMockBrowser();
  const issueWithMarkdown = {
    number: 53,
    title: 'Match OpenChamber UI',
    description: '## Overview\nUpdate the standalone web board to match the OpenChamber extension UI.\n\n### Acceptance Criteria\n- [ ] Match colors\n',
    body: '## Overview\nUpdate the standalone web board to match the OpenChamber extension UI.\n\n### Acceptance Criteria\n- [ ] Match colors\n',
    state: 'open',
    statusLabel: 'status:todo',
    labels: ['status:todo', 'priority:high'],
    user: 'board-owner',
    repository: { full: 'owner/alpha', owner: 'owner', name: 'alpha' },
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
    counts: {},
  };
  app.state.board = {
    repo: 'owner/alpha',
    repository: { full: 'owner/alpha', owner: 'owner', name: 'alpha', hasIssues: true, archived: false },
    issues: [issueWithMarkdown],
  };
  app.state.repositories = { repositories: [{ full: 'owner/alpha', available: true, archived: false, hasIssues: true }] };
  app.state.selected = 'owner/alpha';
  app.state.viewState = { view: 'simple', filters: [], sort: 'priority' };

  app.renderBoard();
  const row = findTaskRows(get('task-list'))[0];
  const mainCol = row.children.find((c) => c.classList.contains('simple-row-main'));
  assert.ok(mainCol, 'Row must contain .simple-row-main');
  const descEl = mainCol.children.find((c) => c.classList.contains('simple-row-desc'));
  assert.ok(descEl, 'Row must contain .simple-row-desc');
  assert.equal(descEl.textContent, 'Update the standalone web board to match the OpenChamber extension UI.');
  assert.ok(!descEl.textContent.includes('##'), 'Description preview must not include markdown heading markers');
});

test('6.c Blocker 3: theme.css enforces display: none !important on closed dialog:not([open]), .board-sheet:not([open]), .view[hidden], and [hidden]', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  assert.match(
    css,
    /dialog:not\(\[open\]\),\s*\.board-sheet:not\(\[open\]\),\s*\.view\[hidden\],\s*\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/s,
    'theme.css must enforce display: none !important on closed dialogs and hidden elements'
  );
});

test('6.d Blocker 4: theme.css places explicit [data-theme="dark"] and [data-theme="light"] rules AFTER @media (prefers-color-scheme: light) and index.html sets V3 theme-color #0B0D11', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  const mediaIdx = css.indexOf('@media (prefers-color-scheme: light)');
  const darkIdx = css.indexOf(':root[data-theme="dark"]');
  const lightIdx = css.indexOf(':root[data-theme="light"]');
  assert.ok(mediaIdx >= 0, 'theme.css must contain @media (prefers-color-scheme: light)');
  assert.ok(darkIdx > mediaIdx, ':root[data-theme="dark"] must appear AFTER @media (prefers-color-scheme: light)');
  assert.ok(lightIdx > mediaIdx, ':root[data-theme="light"] must appear AFTER @media (prefers-color-scheme: light)');

  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  assert.match(html, /<meta name="theme-color" content="#0B0D11">/, 'index.html must set theme-color to #0B0D11');
});

test('6.e Blocker 5: theme.css positions #drawer-backdrop at z-index 900 and #detail-view at z-index 1000 and constrains body.drawer-open #board-view', () => {
  const css = fs.readFileSync(THEME_CSS_PATH, 'utf8');
  assert.match(css, /#drawer-backdrop[\s\S]*?z-index:\s*900/, '#drawer-backdrop must have z-index: 900');
  assert.match(css, /#detail-view[\s\S]*?z-index:\s*1000/, '#detail-view must have z-index: 1000');
  assert.match(css, /body\.drawer-open\s+#board-view/, 'theme.css must constrain body.drawer-open #board-view');
});

test('6.f Blocker 6: #quick-add-form is visible in Simple list view even without stage:draft filter, and hidden in non-simple views', () => {
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
  assert.equal(get('quick-add-form').hidden, false, '#quick-add-form must be visible in simple list view');

  app.state.viewState = { view: 'cards', filters: [], sort: 'priority' };
  app.renderBoard();
  assert.equal(get('quick-add-form').hidden, true, '#quick-add-form must be hidden in cards view');

  app.state.viewState = { view: 'kanban', filters: [], sort: 'priority' };
  app.renderBoard();
  assert.equal(get('quick-add-form').hidden, true, '#quick-add-form must be hidden in kanban view');
});

