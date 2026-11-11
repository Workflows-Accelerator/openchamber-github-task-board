import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function browser(storage = {}) {
  const nodes = new Map();
  const store = new Map(Object.entries(storage));
  const calls = [];
  const intervals = [];
  let visibility = 'visible';

  function node(tag = 'div', id = '') {
    let text = '';
    const classes = new Set();
    const attrs = {};
    return {
      tagName: tag.toUpperCase(),
      id,
      value: '',
      children: [],
      hidden: false,
      disabled: false,
      checked: false,
      style: { setProperty() {} },
      listeners: {},
      classList: {
        add: (v) => classes.add(v),
        remove: (v) => classes.delete(v),
        contains: (v) => classes.has(v),
        toggle: (v) => (classes.has(v) ? classes.delete(v) : classes.add(v)),
      },
      get className() { return Array.from(classes).join(' '); },
      set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c)); },
      get textContent() { return text; },
      set textContent(v) { text = String(v); if (!text) this.children = []; },
      setAttribute(k, v) { attrs[k] = String(v); this[k] = String(v); },
      getAttribute(k) { return attrs[k] ?? null; },
      removeAttribute(k) { delete attrs[k]; delete this[k]; },
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      contains(other) { return other === this || this.children.some((c) => c && c.contains && c.contains(other)); },
      focus() { doc.activeElement = this; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          if (!n) return;
          if (sel.startsWith('.') && n.classList && n.classList.contains(sel.slice(1))) out.push(n);
          if (Array.isArray(n.children)) n.children.forEach(walk);
        };
        this.children.forEach(walk);
        return out;
      },
      getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 844 }; },
    };
  }

  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, node('div', id));
    return nodes.get(id);
  };

  let responder = async () => ({ ok: true, status: 200, headers: new Map(), text: async () => '{}' });
  const docListeners = {};
  const doc = {
    activeElement: null,
    body: node('body'),
    documentElement: node('html'),
    get visibilityState() { return visibility; },
    getElementById: get,
    createElement: (tag) => node(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(name, fn) { docListeners[name] = fn; },
  };
  const context = {
    document: doc,
    window: {
      location: { hash: '' },
      addEventListener() {},
      setTimeout: (fn) => fn(),
      setInterval: (fn) => { intervals.push(fn); return intervals.length; },
      matchMedia: () => ({ matches: false }),
    },
    navigator: { onLine: true },
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      return responder(url, options);
    },
    AbortController,
    clearTimeout,
    setTimeout,
  };
  vm.runInNewContext(fs.readFileSync('web/public/app.js', 'utf8').replace('  boot();', ''), context);
  return {
    app: context.window.__taskBoard,
    get,
    doc,
    docListeners,
    calls,
    intervals,
    setVisibility(v) { visibility = v; },
    setResponder(fn) { responder = fn; },
  };
}

test('V3-2 client: effectiveStage maps vanilla issues to Todo, shows non-draft vanilla issues in Client mode, and collapses empty stage groups', () => {
  const { app, get } = browser();
  const repository = { full: 'acme/vanilla', owner: 'acme', name: 'vanilla', hasIssues: true, archived: false };
  const vanillaIssues = [
    {
      number: 11,
      repository,
      state: 'open',
      title: 'Fix OAuth callback path',
      statusLabel: null,
      column: 'draft',
      effectiveStage: 'todo',
      isExplicitDraft: false,
      bodyMarkdown: 'Plain Markdown body without ChamberOS headings.',
      labels: ['priority:high'],
      counts: {},
    },
    {
      number: 12,
      repository,
      state: 'open',
      title: 'Internal scratchpad',
      statusLabel: 'status:draft',
      column: 'draft',
      effectiveStage: 'draft',
      isExplicitDraft: true,
      labels: ['status:draft'],
      counts: {},
    },
  ];
  app.state.board = { repo: 'acme/vanilla', repository, issues: vanillaIssues };
  app.state.selected = 'acme/vanilla';
  app.state.repositories = { repositories: [repository] };

  app.renderBoard();
  const groups = get('task-list').children;
  assert.equal(groups.length, 2, 'Only non-empty Todo and Draft groups render');
  assert.equal(groups[0]['data-stage'], 'todo');
  assert.equal(groups[1]['data-stage'], 'draft');

  // Toggle collapse on Todo group
  groups[0].children[0].listeners.click();
  assert.equal(get('task-list').children[0].children[1].children.length, 0, 'Collapsed group hides child items');
  groups[0].children[0].listeners.click();
  assert.equal(get('task-list').children[0].children[1].children.length, 1, 'Expanded group restores child items');

  // Client presentation mode hides explicit draft #12 but keeps vanilla unlabeled #11 visible
  app.setClientPresentationMode(true);
  app.renderBoard();
  assert.equal(get('task-list').children.length, 1);
  assert.equal(get('task-list').children[0]['data-stage'], 'todo');
});

test('V3-2 client: Detail Drawer renders native bodyMarkdown, hides empty ChamberOS sections, and localizes <html lang> plus FR status/priority', () => {
  const { app, get, doc } = browser({ tb_lang: 'fr' });
  app.windowRender = false;
  const repository = { full: 'acme/vanilla', owner: 'acme', name: 'vanilla', id: 501, hasIssues: true, archived: false };
  get('question-list').parentElement = nodeWrap();
  get('human-list').parentElement = nodeWrap();
  function nodeWrap() { return { hidden: false }; }

  app.state.detail = {
    number: 7,
    key: 'acme/vanilla#7',
    repository,
    title: 'Document public webhook payload',
    state: 'open',
    htmlUrl: 'https://github.com/acme/vanilla/issues/7',
    body: 'First paragraph.\n\n- Bullet item',
    bodyMarkdown: 'First paragraph.\n\n- Bullet item',
    statusLabel: null,
    effectiveStage: 'todo',
    isExplicitDraft: false,
    labels: ['priority:urgent'],
    updatedAt: '2026-11-11T09:00:00Z',
    editableSections: [],
    openQuestions: [],
    humanTasks: [],
    acceptanceCriteria: [],
    subtasks: [],
  };
  app.state.statusOptions = [{ value: 'status:todo', label: 'Todo' }, { value: 'status:in-progress', label: 'In progress' }];

  // Language switch updates <html lang>, status badges, and priority labels
  get('lang-switch-btn');
  app.renderDetail(false);
  assert.equal(get('overview-text').hidden, true);
  assert.equal(get('overview-preview').hidden, false);
  assert.match(get('overview-preview').innerHTML, /First paragraph/);
  assert.equal(get('ac-section').hidden, true, 'Empty acceptance criteria section is hidden');
  assert.equal(get('subtasks-section').hidden, true, 'Empty subtasks section is hidden');
  assert.equal(get('question-list').parentElement.hidden, true, 'Empty questions panel is hidden');
  assert.equal(get('human-list').parentElement.hidden, true, 'Empty human tasks panel is hidden');
  assert.match(get('priority-control').textContent, /Urgente/);
  assert.equal(get('status-select').children[1].textContent, 'À faire');
  assert.equal(get('status-select').children[2].textContent, 'En cours');

  // Verify applyLanguage sets <html lang>
  app.boot();
  assert.equal(doc.documentElement.lang, 'fr');
});

test('V3-2 client: conditional ETag / 304 memory revalidation, ?refresh=1 bypass, and hidden-tab interval guard', async () => {
  const { app, get, calls, intervals, setVisibility, setResponder } = browser();
  app.state.csrf = 'csrf-test';

  let boardHits = 0;
  setResponder(async (url, options = {}) => {
    if (url.startsWith('/api/session')) {
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        text: async () => JSON.stringify({ authenticated: true, csrfToken: 'csrf-test', statusOptions: [] }),
      };
    }
    if (url.startsWith('/api/repos') && !url.includes('/board')) {
      if (options.headers?.['If-None-Match'] === 'W/"repos-v1"' && !url.includes('refresh=1')) {
        return { ok: false, status: 304, headers: new Map([['etag', 'W/"repos-v1"']]), text: async () => '' };
      }
      return {
        ok: true,
        status: 200,
        headers: new Map([['etag', 'W/"repos-v1"']]),
        text: async () => JSON.stringify({
          repositories: [{ owner: 'acme', name: 'vanilla', full: 'acme/vanilla', id: 1, available: true, hasIssues: true, archived: false, openIssuesCount: 1 }],
          visibleCount: 1,
          freshnessMs: 60000,
          rateLimit: { limit: 5000, remaining: 4992 },
        }),
      };
    }
    boardHits++;
    if (options.headers?.['If-None-Match'] === 'W/"board-v1"' && !url.includes('refresh=1')) {
      return { ok: false, status: 304, headers: new Map([['etag', 'W/"board-v1"']]), text: async () => '' };
    }
    return {
      ok: true,
      status: 200,
      headers: new Map([['etag', 'W/"board-v1"']]),
      text: async () => JSON.stringify({
        repo: 'All repositories',
        issues: [{ number: 1, title: 'Ship V3', state: 'open', effectiveStage: 'todo', isExplicitDraft: false, repository: { owner: 'acme', name: 'vanilla', full: 'acme/vanilla', id: 1 }, counts: {} }],
        rateLimit: { limit: 5000, remaining: 4991 },
      }),
    };
  });

  await app.boot();
  calls.length = 0;

  // Initial load stores ETags, second normal load sends If-None-Match and consumes 304 from memory
  await get('dock-list').listeners.click();
  await app.api('/api/combined/board');
  const second = await app.api('/api/combined/board');
  assert.equal(calls.at(-1).options.headers['If-None-Match'], 'W/"board-v1"');
  assert.equal(second.issues[0].title, 'Ship V3');

  // Explicit Refresh button passes ?refresh=1 without If-None-Match
  calls.length = 0;
  await get('refresh-btn').listeners.click();
  assert.ok(calls.some((c) => c.url === '/api/repos?refresh=1' && !c.options.headers['If-None-Match']));
  assert.ok(calls.some((c) => c.url === '/api/combined/board?refresh=1' && !c.options.headers['If-None-Match']));

  // Periodic timer skips work while document is hidden
  assert.ok(intervals.length >= 1);
  app.state.loadedAt = Date.now() - 120000;
  get('freshness').textContent = 'sentinel';
  setVisibility('hidden');
  intervals.forEach((fn) => fn());
  assert.equal(get('freshness').textContent, 'sentinel');
  setVisibility('visible');
  intervals.forEach((fn) => fn());
  assert.notEqual(get('freshness').textContent, 'sentinel');
});

test('V3-3: unsuccessful mutation clears conditional memory before a possible unknown outcome', async () => {
  const { app, calls, setResponder } = browser();
  app.state.csrf = 'test';
  setResponder(async (_url, options) => options.method !== 'GET'
    ? { ok: false, status: 502, headers: new Map(), text: async () => JSON.stringify({ error: 'write_outcome_unknown', message: 'Refresh' }) }
    : { ok: true, status: 200, headers: new Map([['etag', 'W/"before"']]), text: async () => JSON.stringify({ issues: [] }) });
  await app.api('/api/combined/board');
  await app.api('/api/combined/board');
  assert.equal(calls.at(-1).options.headers['If-None-Match'], 'W/"before"');
  await assert.rejects(app.api('/api/issues/1', { method: 'PATCH', body: {} }));
  await app.api('/api/combined/board');
  assert.equal(calls.at(-1).options.headers['If-None-Match'], undefined);
});

test('V3-3: Canvas cannot be scrolled by focus, narrow cards use full-width metadata, drawer and picker avoid duplicate hierarchy', () => {
  const css = fs.readFileSync('web/public/theme.css', 'utf8');
  const html = fs.readFileSync('web/public/index.html', 'utf8');
  assert.match(css, /\.canvas-viewport\s*\{[^}]*overflow:\s*clip/s);
  assert.match(css, /\.simple-row\.task-row\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.simple-row-meta\s*\{[^}]*grid-column:\s*2;[^}]*max-width:\s*none/s);
  assert.match(css, /\.repo-option\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /body:has\(#client-view:not\(\[hidden\]\)\) #client-presentation-banner/);
  assert.doesNotMatch(html, /id="detail-github"/);
  assert.match(html, /class="row">[\s\S]*id="drawer-add-note-btn"/);
  assert.match(css, /\.canvas-floating-controls \.canvas-control-btn\s*\{[^}]*min-width:\s*44px/);
});


test('V3-3: drawer actions, editable checkboxes and picker search retain 44px narrow hit boxes', () => {
  const css = fs.readFileSync('web/public/theme.css', 'utf8');
  assert.match(css, /#detail-view \.button\.back\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/s);
  assert.match(css, /#detail-view input\[type="checkbox"\]:not\(:disabled\)\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  assert.match(css, /#detail-view \.button, #detail-view input[^}]*\.repo-search-input\s*\{[^}]*min-height:\s*44px/s);
});

test('V4-1: grouped filters combine stages, priorities, dependencies and real review links', () => {
  const { app } = browser();
  const repository = { full: 'acme/core' };
  const issues = [
    { number: 1, repository, effectiveStage: 'todo', labels: ['priority:high'], pendingItems: [{ text: 'Review [preview](https://example.com)', completed: false }] },
    { number: 2, repository, effectiveStage: 'todo', labels: ['priority:low'], blockedBy: [{ number: 1 }] },
    { number: 3, repository, effectiveStage: 'done', labels: ['priority:high'], htmlUrl: 'https://github.com/acme/core/issues/3' },
  ];
  app.state.board = { issues };
  const filtered = filters => Array.from(app.filterSort(issues, { filters, sort: 'priority' }), i => i.number);
  assert.deepEqual(filtered(['stage:todo', 'priority:high']), [1]);
  assert.deepEqual(filtered(['priority:low', 'priority:high', 'stage:todo']), [1, 2]);
  assert.deepEqual(filtered(['artifact']), [1], 'Issue URL alone is not an artifact');
  assert.deepEqual(filtered(['blocked']), [2]);
  assert.deepEqual(filtered(['has-dependents']), [1]);
  assert.equal(app.filterGroups().length, 5);
});

test('V4-1: dependency focus uses qualified identities and distinguishes both directions', () => {
  const { app } = browser();
  const repository = { full: 'acme/core' };
  const upstream = { number: 1, repository };
  const selected = { number: 2, repository, blockedBy: [{ number: 1 }] };
  const downstream = { number: 3, repository, textDependencies: [2] };
  const sameNumberElsewhere = { number: 1, repository: { full: 'acme/other' } };
  const issues = [upstream, selected, downstream, sameNumberElsewhere];
  assert.equal(app.dependencyRole('acme/core#2', selected, issues), 'selected');
  assert.equal(app.dependencyRole('acme/core#1', selected, issues), 'blocker');
  assert.equal(app.dependencyRole('acme/core#3', selected, issues), 'dependent');
  assert.equal(app.dependencyRole('acme/other#1', selected, issues), 'unrelated');
  app.setDependenciesVisible(false);
  assert.equal(app.dependenciesVisible(), false);
  app.setDependenciesVisible(true);
  assert.equal(app.dependenciesVisible(), true);
});

test('V4-1: every transient task surface shares native dialog and sheet lifecycle, applied rail precedes Canvas', () => {
  const html = fs.readFileSync('web/public/index.html', 'utf8');
  const js = fs.readFileSync('web/public/app.js', 'utf8');
  const css = fs.readFileSync('web/public/theme.css', 'utf8');
  for (const id of ['board-sheet', 'repo-popover', 'canvas-arrange-dialog', 'canvas-wire-confirm', 'composer-dialog']) {
    assert.match(html, new RegExp('<dialog id="' + id + '" class="board-sheet'));
  }
  assert.ok(html.indexOf('id="applied-filter-bar"') < html.indexOf('id="canvas-viewport"'));
  assert.match(js, /dialog\.addEventListener\('cancel'/);
  assert.match(js, /dialog\.addEventListener\('close'/);
  assert.match(js, /event\.shiftKey && document\.activeElement === first/);
  assert.match(css, /max-height: 85dvh/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /\sstyle=/i);
});

test('V4-1: applied chip removal immediately re-renders List without opening filters', () => {
  const { app, get } = browser();
  const repository = { full: 'acme/core' };
  app.state.board = { repo: 'acme/core', repository, issues: [
    { number: 1, title: 'High task', repository, state: 'open', labels: ['priority:high'], effectiveStage: 'todo', counts: {} },
    { number: 2, title: 'Low task', repository, state: 'open', labels: ['priority:low'], effectiveStage: 'todo', counts: {} },
  ] };
  app.state.viewState.filters = ['priority:high'];
  app.renderBoard();
  assert.equal(get('filter-chips').children[0].getAttribute('aria-label'), 'Remove filter High');
  assert.equal(get('applied-filter-btn').getAttribute('data-active'), 'true');
  assert.equal(get('task-list').children[0].children[1].children.length, 1);
  get('filter-chips').children[0].listeners.click();
  assert.equal(get('filter-chips').children.length, 0);
  assert.equal(get('applied-filter-btn').getAttribute('data-active'), 'false');
  assert.equal(get('task-list').children[0].children[1].children.length, 2);
});

test('V4-1: an open composer keeps its form visible when the list view is not simple', () => {
  const { app, get } = browser();
  const repository = { full: 'acme/core' };
  app.state.board = { repo: 'acme/core', repository, issues: [
    { number: 1, title: 'Task', repository, state: 'open', labels: ['priority:high'], effectiveStage: 'todo', counts: {} },
  ] };
  const composer = get('composer-dialog');
  const form = get('quick-add-form');

  // A refresh or a finished draft re-renders the board under the open dialog.
  app.state.viewState = { view: 'kanban', filters: [], sort: 'priority' };
  composer.open = true;
  form.hidden = true;
  app.renderBoard();
  assert.equal(form.hidden, false, 'the composer form must survive a re-render while the sheet is open');

  // Closed composer still follows the existing simple-view rule.
  composer.open = false;
  app.renderBoard();
  assert.equal(form.hidden, true, 'non-simple views hide the inline composer when the sheet is closed');

  app.state.viewState = { view: 'simple', filters: [], sort: 'priority' };
  app.renderBoard();
  assert.equal(form.hidden, false);
});

test('V4-1: closing a nested sheet keeps the page lock and clears the composer state', () => {
  const js = fs.readFileSync('web/public/app.js', 'utf8');
  assert.match(js, /if \(!document\.querySelector\('dialog\[open\]'\)\) document\.body\.classList\.remove\('sheet-open'\)/);
  assert.match(js, /dialog\.id === 'composer-dialog'[^\n]*classList\.remove\('composer-open'\)/);
  const finish = js.slice(js.indexOf('function finishSheet('), js.indexOf('function prepareSheet('));
  assert.ok(
    finish.indexOf("querySelector('dialog[open]')") < finish.indexOf("classList.remove('sheet-open')"),
    'the scroll lock must be released only after checking for another open dialog',
  );
});

test('V4-1: phone sidebar keeps its drawer behaviour when the desktop rail was collapsed', () => {
  const css = fs.readFileSync('web/public/theme.css', 'utf8');
  const desktopOnly = /@media \(min-width: 769px\) \{[\s\S]*?body\.sidebar-collapsed \.sidebar \{[\s\S]*?\n\}/.test(css);
  assert.ok(desktopOnly, 'the collapsed rail must not shrink the off-canvas phone drawer');
  assert.match(css, /body\.sidebar-collapsed \.sidebar \.sidebar-toggle-btn \{/);
  assert.doesNotMatch(css, /\nbody\.sidebar-collapsed \.sidebar-toggle-btn \{/, 'the compact header toggle must never be hidden by the rail');
});

test('V4-1: pending checklist state is drawn, never a pictographic glyph', () => {
  const { app, get } = browser();
  const repository = { full: 'acme/core' };
  app.state.board = { repo: 'acme/core', repository, issues: [
    { number: 1, title: 'Review', repository, state: 'open', labels: ['status:needs-human'], effectiveStage: 'needs-human', statusLabel: 'status:needs-human', counts: {},
      pendingItems: [{ text: 'Approve release', completed: false }] },
  ] };
  app.state.viewState = { view: 'pending', filters: [], sort: 'priority' };
  app.renderBoard();
  const todos = get('task-list').children[1].children[1].children;
  assert.equal(todos.length, 1);
  assert.equal(todos[0].textContent, 'Approve release');
  assert.equal(todos[0].className, 'pending-todo');
  const glyphs = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of ['web/public/app.js', 'web/public/index.html', 'web/public/theme.css']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), glyphs, file + ' must stay free of pictographic glyphs');
  }
});
