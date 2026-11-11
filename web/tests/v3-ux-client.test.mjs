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
      appendChild(child) { this.children.push(child); return child; },
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
