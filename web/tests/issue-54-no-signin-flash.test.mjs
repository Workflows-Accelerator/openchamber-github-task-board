import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const INDEX_HTML_PATH = 'web/public/index.html';
const APP_JS_PATH = 'web/public/app.js';

function createMockBrowser(storage = {}, initialHidden = {}) {
  const nodes = new Map();
  const store = new Map(Object.entries(storage));
  const calls = [];
  const mutations = [];

  function createNode(tag = 'div', id = '') {
    const attrs = {};
    let textValue = '';
    let isHidden = initialHidden[id] !== undefined ? initialHidden[id] : false;

    const n = {
      tagName: String(tag).toUpperCase(),
      id: id,
      value: '',
      get textContent() {
        return textValue;
      },
      set textContent(v) {
        textValue = String(v);
        if (textValue === '') this.children = [];
      },
      children: [],
      get hidden() {
        return isHidden;
      },
      set hidden(v) {
        const boolVal = Boolean(v);
        if (isHidden !== boolVal) {
          mutations.push({ id, prop: 'hidden', from: isHidden, to: boolVal, timestamp: Date.now() });
          isHidden = boolVal;
        }
      },
      disabled: false,
      checked: false,
      className: '',
      style: {},
      scrollHeight: 0,
      attrs,
      listeners: {},
      setAttribute(key, value) {
        attrs[key] = String(value);
        if (key === 'hidden') this.hidden = true;
        else this[key] = value;
      },
      removeAttribute(key) {
        delete attrs[key];
        if (key === 'hidden') this.hidden = false;
        else delete this[key];
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
    };
    return n;
  }

  const get = (id) => {
    if (!nodes.has(id)) {
      nodes.set(id, createNode('div', id));
    }
    return nodes.get(id);
  };

  // Pre-seed known views with default visibility matching index.html
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const loginHiddenInHtml = /<section[^>]*id="login-view"[^>]*hidden/.test(html);
  const boardHiddenInHtml = /<section[^>]*id="board-view"[^>]*hidden/.test(html);
  const toolbarHiddenInHtml = /<div[^>]*id="board-toolbar"[^>]*hidden/.test(html);

  get('login-view').hidden = initialHidden['login-view'] !== undefined ? initialHidden['login-view'] : loginHiddenInHtml;
  get('board-view').hidden = initialHidden['board-view'] !== undefined ? initialHidden['board-view'] : boardHiddenInHtml;
  get('board-toolbar').hidden = initialHidden['board-toolbar'] !== undefined ? initialHidden['board-toolbar'] : toolbarHiddenInHtml;
  get('detail-view').hidden = initialHidden['detail-view'] !== undefined ? initialHidden['detail-view'] : true;
  get('drawer-backdrop').hidden = true;

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
      crypto: {
        subtle: {
          digest: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        },
      },
    },
    localStorage,
    navigator: { onLine: true },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responder(url, options);
    },
  };

  const appSource = fs.readFileSync(APP_JS_PATH, 'utf8');
  // Strip automatic boot() invocation at bottom so tests control boot execution
  const strippedSource = appSource.replace(/\bboot\(\);(?=\s*\(\)\s*;\s*$|$)/m, '');
  vm.runInNewContext(strippedSource, context);

  return {
    app: context.window.__taskBoard,
    context,
    get,
    store,
    calls,
    mutations,
    setResponder(fn) {
      responder = fn;
    },
  };
}

const sampleBoard = {
  repo: 'owner/test-repo',
  repository: { full: 'owner/test-repo', owner: 'owner', name: 'test-repo', hasIssues: true, archived: false },
  issues: [
    {
      number: 101,
      key: 'owner/test-repo#101',
      title: 'Cached Task One',
      state: 'open',
      statusLabel: 'status:todo',
      labels: ['status:todo', 'priority:high'],
      attention: 'none',
      repository: { full: 'owner/test-repo', owner: 'owner', name: 'test-repo' },
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
      counts: { humanTasks: { total: 0, open: 0 }, openQuestions: { total: 0, open: 0 } },
    },
  ],
  count: 1,
  statusOptions: [{ label: 'status:todo', name: 'To do' }],
};

test('1.a Static web/public/index.html markup: #login-view has hidden by default, #board-view does not', () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // #login-view must have hidden attribute in static HTML
  assert.match(
    html,
    /<section[^>]*id="login-view"[^>]*\bhidden\b/,
    '#login-view must statically carry the hidden attribute',
  );

  // #board-view must NOT have hidden attribute in static HTML
  const boardMatch = html.match(/<section[^>]*id="board-view"([^>]*)>/);
  assert.ok(boardMatch, '#board-view section must exist');
  assert.doesNotMatch(
    boardMatch[1],
    /\bhidden\b/,
    '#board-view must NOT statically carry the hidden attribute',
  );
});

test('1.b In boot() when GET /api/session resolves authenticated:true while /api/repos and /api/combined/board are pending, #login-view remains hidden and #board-view is visible immediately', async () => {
  const { app, get, setResponder } = createMockBrowser();

  let resolveRepos;
  const reposPromise = new Promise((resolve) => {
    resolveRepos = resolve;
  });

  setResponder(async (url) => {
    if (url === '/api/session') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ authenticated: true, csrfToken: 'test-csrf-123' }),
      };
    }
    if (url === '/api/repos') {
      await reposPromise;
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            repositories: [{ full: 'owner/test-repo', owner: 'owner', name: 'test-repo', available: true, archived: false, hasIssues: true }],
            visibleCount: 1,
            discoveryFailed: false,
          }),
      };
    }
    if (url.includes('/board')) {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify(sampleBoard),
      };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });

  // Verify before boot starts
  assert.equal(get('login-view').hidden, true, '#login-view must be hidden initially');
  assert.equal(get('board-view').hidden, false, '#board-view must be visible initially');

  const bootPromise = app.boot();

  // Allow microtasks to run so /api/session resolves
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setImmediate(r));
  }

  // At this checkpoint, /api/session has resolved authenticated:true, but /api/repos is STILL pending!
  assert.equal(get('login-view').hidden, true, '#login-view must remain hidden while repos load');
  assert.equal(get('board-view').hidden, false, '#board-view must be visible immediately on session resolution');
  assert.equal(app.state.csrf, 'test-csrf-123', 'state.csrf must be populated');

  // Now resolve repos and finish boot
  resolveRepos();
  await bootPromise;

  assert.equal(get('login-view').hidden, true, '#login-view must remain hidden after boot completes');
  assert.equal(get('board-view').hidden, false, '#board-view must remain visible after boot completes');
});

test('1.c Non-secret client auth hint (localStorage key tb_auth_hint = 1): set on authenticated GET/POST session, cleared on showLogin/unauthenticated/401/signout', async () => {
  // Check 1: set when GET /api/session in boot() returns authenticated: true
  const browserA = createMockBrowser({}, { 'login-view': true, 'board-view': false });
  browserA.setResponder(async (url) => {
    if (url === '/api/session') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ authenticated: true, csrfToken: 'tok-abc' }),
      };
    }
    if (url === '/api/repos') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ repositories: [], visibleCount: 0, discoveryFailed: false }),
      };
    }
    if (url.includes('/board')) {
      return { status: 200, ok: true, text: async () => JSON.stringify(sampleBoard) };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });
  await browserA.app.boot();
  assert.equal(browserA.store.get('tb_auth_hint'), '1', 'tb_auth_hint must be set to 1 when authenticated');

  // Check 2: set when login form submission (POST /api/session) succeeds
  const browserB = createMockBrowser({}, { 'login-view': false, 'board-view': true });
  browserB.setResponder(async (url, opts) => {
    if (url === '/api/session' && (!opts || opts.method === 'GET')) {
      return { status: 200, ok: true, text: async () => JSON.stringify({ authenticated: false }) };
    }
    if (url === '/api/session' && opts?.method === 'POST') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ authenticated: true, csrfToken: 'tok-post' }),
      };
    }
    if (url === '/api/repos') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ repositories: [], visibleCount: 0, discoveryFailed: false }),
      };
    }
    if (url.includes('/board')) {
      return { status: 200, ok: true, text: async () => JSON.stringify(sampleBoard) };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });
  await browserB.app.boot();
  const form = browserB.get('login-form');
  browserB.get('password').value = 'secret';
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(browserB.store.get('tb_auth_hint'), '1', 'tb_auth_hint must be set to 1 after login submit');

  // Check 3: cleared when signOut runs
  browserB.setResponder(async (url, opts) => {
    if (url === '/api/session' && opts?.method === 'DELETE') {
      return { status: 204, ok: true, text: async () => '' };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });
  await browserB.app.signOut();
  assert.equal(browserB.store.get('tb_auth_hint'), undefined, 'tb_auth_hint must be cleared after signOut');
  // Even if signoutBtn wasn't directly wired with click listener in mock, verify showLogin clears tb_auth_hint:
  const browserC = createMockBrowser({ tb_auth_hint: '1' }, { 'login-view': true, 'board-view': false });
  browserC.setResponder(async (url) => {
    if (url === '/api/session') {
      return { status: 200, ok: true, text: async () => JSON.stringify({ authenticated: false }) };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });
  await browserC.app.boot();
  assert.equal(browserC.store.get('tb_auth_hint'), undefined, 'tb_auth_hint must be cleared when session is unauthenticated');

  // Check 4: cleared when an API call returns 401
  const browserD = createMockBrowser({ tb_auth_hint: '1' }, { 'login-view': true, 'board-view': false });
  browserD.setResponder(async (url) => {
    if (url === '/api/session') {
      return { status: 401, ok: false, text: async () => JSON.stringify({ error: 'unauthenticated' }) };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });
  await browserD.app.boot();
  assert.equal(browserD.store.get('tb_auth_hint'), undefined, 'tb_auth_hint must be cleared when /api/session returns 401');
});

test('1.d When tb_auth_hint === 1 and cached board data exists in localStorage, boot() renders cached board shell/tasks immediately before network calls finish', async () => {
  const { app, get, setResponder } = createMockBrowser(
    {
      tb_auth_hint: '1',
      tb_cached_board: JSON.stringify(sampleBoard),
    },
    { 'login-view': true, 'board-view': false },
  );

  let resolveSession;
  const sessionPromise = new Promise((resolve) => {
    resolveSession = resolve;
  });

  setResponder(async (url) => {
    if (url === '/api/session') {
      await sessionPromise;
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ authenticated: true, csrfToken: 'tok-cached' }),
      };
    }
    if (url === '/api/repos') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ repositories: [], visibleCount: 0, discoveryFailed: false }),
      };
    }
    if (url.includes('/board')) {
      return { status: 200, ok: true, text: async () => JSON.stringify(sampleBoard) };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });

  // Start boot with pending session
  const bootPromise = app.boot();

  // Microtask tick
  await new Promise((r) => setImmediate(r));

  // Before network calls finish: cached board MUST already be rendered
  assert.equal(get('board-view').hidden, false, '#board-view must be visible');
  assert.equal(get('login-view').hidden, true, '#login-view must be hidden');
  assert.ok(app.state.board, 'state.board must be populated from cache');
  assert.equal(app.state.board.issues.length, 1, 'cached issues must be loaded');
  assert.ok(get('task-list').children.length >= 1, 'task-list must render cached tasks immediately');

  // Complete session network call
  resolveSession();
  await bootPromise;

  assert.equal(get('board-view').hidden, false);
  assert.equal(get('login-view').hidden, true);
});

test('1.e When GET /api/session returns authenticated: false, boot() reveals #login-view, hides #board-view, and clears tb_auth_hint', async () => {
  const { app, get, store, setResponder } = createMockBrowser(
    { tb_auth_hint: '1' },
    { 'login-view': true, 'board-view': false },
  );

  setResponder(async (url) => {
    if (url === '/api/session') {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ authenticated: false }),
      };
    }
    return { status: 404, ok: false, text: async () => '{}' };
  });

  await app.boot();

  assert.equal(get('login-view').hidden, false, '#login-view must be revealed when unauthenticated');
  assert.equal(get('board-view').hidden, true, '#board-view must be hidden when unauthenticated');
  assert.equal(store.get('tb_auth_hint'), undefined, 'tb_auth_hint must be cleared');
});

test('1.f When GET /api/session fails with network error and no cached board exists, showLogin reveals #login-view with message; if cached board exists, offline board view remains visible', async () => {
  // Scenario 1: Network error + NO cached board -> reveals #login-view with error message
  const browserNoCache = createMockBrowser({}, { 'login-view': true, 'board-view': false });
  browserNoCache.setResponder(async () => {
    throw new Error('Network failure: connection refused');
  });

  await browserNoCache.app.boot();

  assert.equal(browserNoCache.get('login-view').hidden, false, '#login-view must be shown when network fails with no cache');
  assert.equal(browserNoCache.get('board-view').hidden, true, '#board-view must be hidden when network fails with no cache');
  const errorElem = browserNoCache.get('login-error');
  assert.equal(errorElem.hidden, false, 'login-error must be shown');
  assert.match(errorElem.textContent, /The board could not be reached\. Reload to try again\./);

  // Scenario 2: Network error + cached board exists -> offline board view remains visible
  const browserWithCache = createMockBrowser(
    {
      tb_auth_hint: '1',
      tb_cached_board: JSON.stringify(sampleBoard),
    },
    { 'login-view': true, 'board-view': false },
  );
  browserWithCache.setResponder(async () => {
    throw new Error('Network failure: connection refused');
  });

  await browserWithCache.app.boot();

  assert.equal(browserWithCache.get('board-view').hidden, false, '#board-view must remain visible when cached board exists');
  assert.equal(browserWithCache.get('login-view').hidden, true, '#login-view must NOT be revealed when cached board exists');
  assert.ok(browserWithCache.app.state.board, 'state.board should have cached board');
  assert.equal(browserWithCache.app.state.board.issues.length, 1);
});

test('2.a Hostile 1: Static HTML noscript fallback reveals #login-view, and #board-toolbar is hidden until auth confirms', async () => {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // Must include a noscript style ensuring login-view displays and board-view is hidden if JS is disabled
  assert.match(
    html,
    /<noscript>[\s\S]*#login-view[\s\S]*display:\s*block[\s\S]*#board-view[\s\S]*display:\s*none[\s\S]*<\/noscript>/,
    'static HTML must provide a noscript fallback that reveals login-view when JS is disabled',
  );

  // #board-toolbar must have the hidden attribute in static index.html
  assert.match(
    html,
    /<div[^>]*id="board-toolbar"[^>]*\bhidden\b/,
    '#board-toolbar must statically carry the hidden attribute',
  );

  // When boot() runs with unauthenticated user: #board-toolbar remains hidden
  const unauthBrowser = createMockBrowser({}, { 'login-view': true, 'board-view': false, 'board-toolbar': true });
  unauthBrowser.setResponder(async (url) => {
    if (url === '/api/session') return { status: 200, ok: true, text: async () => JSON.stringify({ authenticated: false }) };
    return { status: 404, ok: false, text: async () => '{}' };
  });
  await unauthBrowser.app.boot();
  assert.equal(unauthBrowser.get('board-toolbar').hidden, true, '#board-toolbar must remain hidden when unauthenticated');

  // When boot() runs with authenticated user: #board-toolbar is revealed
  const authBrowser = createMockBrowser({}, { 'login-view': true, 'board-view': false, 'board-toolbar': true });
  authBrowser.setResponder(async (url) => {
    if (url === '/api/session') return { status: 200, ok: true, text: async () => JSON.stringify({ authenticated: true, csrfToken: 'csrf-1' }) };
    if (url === '/api/repos') return { status: 200, ok: true, text: async () => JSON.stringify({ repositories: [], visibleCount: 0, discoveryFailed: false }) };
    if (url.includes('/board')) return { status: 200, ok: true, text: async () => JSON.stringify(sampleBoard) };
    return { status: 404, ok: false, text: async () => '{}' };
  });
  await authBrowser.app.boot();
  assert.equal(authBrowser.get('board-toolbar').hidden, false, '#board-toolbar must be revealed when authenticated');

  // When showLogin() runs: #board-toolbar is re-hidden
  authBrowser.app.showLogin();
  assert.equal(authBrowser.get('board-toolbar').hidden, true, '#board-toolbar must be hidden when showLogin runs');
});

test('2.b Hostile 2: Security & Privacy: showLogin() thoroughly scrubs sensitive task data from all DOM nodes', () => {
  const browser = createMockBrowser();
  const get = browser.get;

  // Seed sensitive data into DOM elements
  get('task-list').textContent = '<li>Sensitive task row</li>';
  get('ac-list').textContent = '<li>Private acceptance criteria</li>';
  get('subtasks-list').textContent = '<li>Private subtask item</li>';
  get('detail-title').textContent = 'Confidential Issue Title';
  get('detail-subtitle').textContent = 'private-org/secret-repo #42';
  get('detail-freshness').textContent = 'Loaded 2 minutes ago';
  get('recoverable-drafts').textContent = 'Unsaved draft text with secrets';
  get('filter-chips').textContent = '<button>project:private/repo</button>';
  get('repo-options-list').textContent = '<div>private-org/secret-repo</div>';
  get('status-select').textContent = '<option>Draft</option>';
  get('overview-text').value = 'Confidential overview details';
  get('board-count').textContent = '42 tasks';
  get('save-status').textContent = 'Saved';
  get('scope-status').textContent = 'Scope status for secret-repo';

  browser.app.showLogin();

  assert.equal(get('task-list').textContent, '', 'task-list must be emptied');
  assert.equal(get('ac-list').textContent, '', 'ac-list must be emptied');
  assert.equal(get('subtasks-list').textContent, '', 'subtasks-list must be emptied');
  assert.equal(get('detail-title').textContent, '', 'detail-title must be emptied');
  assert.equal(get('detail-subtitle').textContent, '', 'detail-subtitle must be emptied');
  assert.equal(get('detail-freshness').textContent, '', 'detail-freshness must be emptied');
  assert.equal(get('recoverable-drafts').textContent, '', 'recoverable-drafts must be emptied');
  assert.equal(get('filter-chips').textContent, '', 'filter-chips must be emptied');
  assert.equal(get('repo-options-list').textContent, '', 'repo-options-list must be emptied');
  assert.equal(get('status-select').textContent, '', 'status-select must be emptied');
  assert.equal(get('overview-text').value, '', 'overview-text must be emptied');
  assert.equal(get('board-count').textContent, '', 'board-count must be emptied');
  assert.equal(get('save-status').textContent, '', 'save-status must be emptied');
  assert.equal(get('scope-status').textContent, '', 'scope-status must be emptied');
});

test('2.c Hostile 3: Concurrency & CSRF: mutations fired while cached board is rendered await in-flight /api/session check', async () => {
  const browser = createMockBrowser(
    {
      tb_auth_hint: '1',
      tb_cached_board: JSON.stringify(sampleBoard),
    },
    { 'login-view': true, 'board-view': false },
  );

  let resolveSession;
  const sessionPromise = new Promise((resolve) => {
    resolveSession = resolve;
  });

  browser.setResponder(async (url, opts) => {
    if (url === '/api/session') {
      await sessionPromise;
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ authenticated: true, csrfToken: 'tok-concurrency-csrf-777' }),
      };
    }
    if (url === '/api/repos') {
      return { status: 200, ok: true, text: async () => JSON.stringify({ repositories: [], visibleCount: 0, discoveryFailed: false }) };
    }
    if (url === '/api/repos/owner/test-repo/issues/101/status' && opts?.method === 'POST') {
      // Must receive the CSRF token!
      if (!opts.headers || opts.headers['x-csrf-token'] !== 'tok-concurrency-csrf-777') {
        return {
          status: 403,
          ok: false,
          text: async () => JSON.stringify({ error: 'csrf_rejected', message: 'Missing valid CSRF token' }),
        };
      }
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            issue: {
              ...sampleBoard.issues[0],
              fingerprint: 'fp-101-abc',
              phase: 'todo',
              attention: 'none',
              editableSections: [],
              openQuestions: [],
              humanTasks: [],
              acceptanceCriteria: [],
              subtasks: [],
              statusLabel: 'status:done',
            },
            statusOptions: [{ value: 'status:todo', label: 'To do' }, { value: 'status:done', label: 'Done' }],
          }),
      };
    }
    if (url.includes('/board')) return { status: 200, ok: true, text: async () => JSON.stringify(sampleBoard) };
    return { status: 404, ok: false, text: async () => '{}' };
  });

  // Start boot - cached board renders immediately, but /api/session is still pending
  const bootPromise = browser.app.boot();
  await new Promise((r) => setImmediate(r));

  // Verify cached board is rendered and state.csrf is not yet set
  assert.equal(browser.get('board-view').hidden, false);

  // Now simulate a mutation initiated by user clicking while /api/session is still in flight
  const mutationPromise = browser.app.api('/api/repos/owner/test-repo/issues/101/status', {
    method: 'POST',
    body: { status: 'status:done' },
    expected: 101,
  });

  // Release the pending session
  resolveSession();
  await bootPromise;

  // The mutation MUST await the session promise and succeed with the csrf token
  const mutationResult = await mutationPromise;
  assert.ok(mutationResult, 'mutation must succeed');
  assert.equal(mutationResult.issue.statusLabel, 'status:done');

  // Verify the mutation call included the x-csrf-token
  const mutationCall = browser.calls.find((c) => c.url.includes('/status'));
  assert.ok(mutationCall, 'mutation call must have been made');
  assert.equal(mutationCall.options.headers['x-csrf-token'], 'tok-concurrency-csrf-777');
});

test('2.d Hostile 4: Corrupted cache resilience: malformed / non-object entries in tb_cached_board do not crash boot()', async () => {
  // Scenario 1: parsed.issues contains null, strings, or numbers
  const browserA = createMockBrowser(
    {
      tb_auth_hint: '1',
      tb_cached_board: JSON.stringify({
        repo: 'owner/test-repo',
        issues: [null, 42, 'invalid', { notAnIssue: true }],
      }),
    },
    { 'login-view': true, 'board-view': false },
  );

  browserA.setResponder(async (url) => {
    if (url === '/api/session') return { status: 200, ok: true, text: async () => JSON.stringify({ authenticated: false }) };
    return { status: 404, ok: false, text: async () => '{}' };
  });

  // boot() must NOT throw an unhandled TypeError when encountering corrupt cache items
  await assert.doesNotReject(async () => {
    await browserA.app.boot();
  });

  // Scenario 2: malformed JSON syntax in tb_cached_board
  const browserB = createMockBrowser(
    {
      tb_auth_hint: '1',
      tb_cached_board: '<<<MALFORMED JSON>>>{corrupted',
    },
    { 'login-view': true, 'board-view': false },
  );

  browserB.setResponder(async (url) => {
    if (url === '/api/session') return { status: 200, ok: true, text: async () => JSON.stringify({ authenticated: false }) };
    return { status: 404, ok: false, text: async () => '{}' };
  });

  await assert.doesNotReject(async () => {
    await browserB.app.boot();
  });
});

test('2.e Hostile 5: Cache freshness on mutations: publishMutation updates tb_cached_board immediately', async () => {
  const browser = createMockBrowser(
    {
      tb_auth_hint: '1',
      tb_cached_board: JSON.stringify(sampleBoard),
    },
    { 'login-view': true, 'board-view': false },
  );

  browser.setResponder(async (url) => {
    if (url === '/api/session') return { status: 200, ok: true, text: async () => JSON.stringify({ authenticated: true, csrfToken: 'tok-1' }) };
    if (url === '/api/repos') return { status: 200, ok: true, text: async () => JSON.stringify({ repositories: [], visibleCount: 0, discoveryFailed: false }) };
    if (url.includes('/board')) return { status: 200, ok: true, text: async () => JSON.stringify(sampleBoard) };
    return { status: 404, ok: false, text: async () => '{}' };
  });

  await browser.app.boot();

  const mutatedIssue = {
    ...sampleBoard.issues[0],
    title: 'Updated Task Title via Mutation',
    statusLabel: 'status:in-progress',
    subtasks: [],
    openQuestions: [],
    humanTasks: [],
  };

  browser.app.publishMutation(
    { issue: mutatedIssue, statusOptions: sampleBoard.statusOptions },
    sampleBoard.issues[0],
    browser.app.state.readGeneration,
    'status',
    null,
  );

  const cached = JSON.parse(browser.store.get('tb_cached_board'));
  assert.ok(cached, 'tb_cached_board must exist in store');
  const target = cached.issues.find((i) => i.number === 101);
  assert.ok(target, 'issue 101 must be in cached board');
  assert.equal(target.title, 'Updated Task Title via Mutation', 'cached board must reflect mutated title');
});
