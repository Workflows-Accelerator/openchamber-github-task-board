import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = fs.readFileSync(path.join(__dirname, '../web/public/app.js'), 'utf8');

function setupTestEnvironment(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const storageListeners = [];
  const eventListeners = new Map();

  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] || null,
  };

  const elements = new Map();
  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        tagName: 'DIV',
        hidden: false,
        disabled: false,
        value: '',
        textContent: '',
        children: [],
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, v) { if (v !== undefined ? v : !this.classes.has(c)) this.classes.add(c); else this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
        },
        appendChild(child) { this.children.push(child); return child; },
        setAttribute() {},
        removeAttribute() {},
        addEventListener(event, fn) {
          if (!this._listeners) this._listeners = {};
          if (!this._listeners[event]) this._listeners[event] = [];
          this._listeners[event].push(fn);
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        focus() {},
      });
    }
    return elements.get(id);
  }

  const documentMock = {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        toggle(c, v) { if (v !== undefined ? v : !this.classes.has(c)) this.classes.add(c); else this.classes.delete(c); },
        contains(c) { return this.classes.has(c); },
      },
      appendChild(child) { if (!this.children) this.children = []; this.children.push(child); return child; },
      setAttribute() {},
      removeAttribute() {},
      addEventListener() {},
    }),
    addEventListener: (event, handler) => {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event).push(handler);
    },
  };

  const networkCalls = [];
  let networkHandler = async (url, opts) => ({ status: 200, json: async () => ({ authenticated: false }) });

  const ctx = {
    window: null,
    document: documentMock,
    localStorage,
    navigator: { onLine: true },
    fetch: async (url, opts) => {
      networkCalls.push({ url, opts });
      return networkHandler(url, opts);
    },
    setInterval: () => {},
    setTimeout: () => {},
    crypto: {
      subtle: {
        digest: async () => new Uint8Array(32).buffer,
      },
    },
  };
  ctx.window = {
    ...ctx,
    location: { hash: '#/' },
    addEventListener: (event, handler) => {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event).push(handler);
    },
  };

  vm.createContext(ctx);
  vm.runInContext(APP_JS, ctx);

  return {
    ctx,
    taskBoard: ctx.window.__taskBoard,
    localStorage,
    networkCalls,
    setNetworkHandler: (fn) => { networkHandler = fn; },
    triggerWindow: (event, arg) => {
      const handlers = eventListeners.get(event) || [];
      for (const h of handlers) h(arg);
    },
  };
}

test('offline drafts: zero localStorage items at boot when no drafts exist', () => {
  const env = setupTestEnvironment();
  assert.equal(env.localStorage.length, 0);
  assert.equal(env.localStorage.getItem('openchamber_offline_drafts'), null);
  const drafts = env.taskBoard.getOfflineDrafts();
  assert.equal(drafts.length, 0);
  assert.equal(env.localStorage.length, 0);
});

test('offline drafts: queueing persists draft with required properties', () => {
  const env = setupTestEnvironment();
  env.taskBoard.saveToOfflineQueue('Support mobile offline mode', 'octocat/hello-world');

  assert.equal(env.localStorage.length, 1);
  const raw = env.localStorage.getItem('openchamber_offline_drafts');
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'Support mobile offline mode');
  assert.equal(parsed[0].repo, 'octocat/hello-world');
  assert.equal(parsed[0].offline, true);
  assert.deepEqual(parsed[0].labels, ['status:draft']);
  assert.ok(parsed[0].createdAt);
  assert.ok(parsed[0].id.startsWith('offline-'));
});

test('offline drafts: duplicate drafts with identical title and repo are deduplicated', () => {
  const env = setupTestEnvironment();
  env.taskBoard.saveToOfflineQueue('Identical draft', 'octocat/repo');
  env.taskBoard.saveToOfflineQueue('Identical draft', 'octocat/repo');

  const drafts = env.taskBoard.getOfflineDrafts();
  assert.equal(drafts.length, 1);
});

test('offline drafts: sync drains queue and removes localStorage key on completion', async () => {
  const env = setupTestEnvironment();
  env.taskBoard.saveToOfflineQueue('Task 1', 'owner/repo');
  env.taskBoard.saveToOfflineQueue('Task 2', 'owner/repo');
  assert.equal(env.taskBoard.getOfflineDrafts().length, 2);

  const posted = [];
  env.setNetworkHandler(async (url, opts) => {
    if (opts && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      posted.push({ url, body });
      const resPayload = JSON.stringify({ issue: { number: 99, title: body.title } });
      return {
        status: 201,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => resPayload,
        json: async () => JSON.parse(resPayload),
      };
    }
    return {
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ authenticated: true }),
      json: async () => ({ authenticated: true }),
    };
  });

  await env.taskBoard.syncOfflineDrafts();

  assert.equal(posted.length, 2);
  assert.equal(posted[0].body.title, 'Task 1');
  assert.equal(posted[1].body.title, 'Task 2');
  assert.equal(env.taskBoard.getOfflineDrafts().length, 0);
  assert.equal(env.localStorage.getItem('openchamber_offline_drafts'), null);
  assert.equal(env.localStorage.length, 0);
});

test('offline drafts: network failure during sync retains uncommitted drafts', async () => {
  const env = setupTestEnvironment();
  env.taskBoard.saveToOfflineQueue('Will succeed', 'owner/repo');
  env.taskBoard.saveToOfflineQueue('Will fail', 'owner/repo');

  let callCount = 0;
  env.setNetworkHandler(async (url, opts) => {
    if (opts && opts.method === 'POST') {
      callCount++;
      if (callCount === 1) {
        const resPayload = JSON.stringify({ issue: { number: 101, title: 'Will succeed' } });
        return {
          status: 201,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => resPayload,
          json: async () => JSON.parse(resPayload),
        };
      }
      throw new Error('Failed to fetch');
    }
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ authenticated: true }),
      json: async () => ({ authenticated: true }),
    };
  });

  await env.taskBoard.syncOfflineDrafts();

  const remaining = env.taskBoard.getOfflineDrafts();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].title, 'Will fail');
  assert.ok(env.localStorage.getItem('openchamber_offline_drafts'));
});

test('offline drafts: online window event triggers syncOfflineDrafts', async () => {
  const env = setupTestEnvironment();
  env.taskBoard.saveToOfflineQueue('Queued offline', 'owner/repo');

  let syncInvoked = false;
  env.setNetworkHandler(async (url, opts) => {
    if (opts && opts.method === 'POST') {
      syncInvoked = true;
      const resPayload = JSON.stringify({ issue: { number: 102 } });
      return {
        status: 201,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => resPayload,
        json: async () => JSON.parse(resPayload),
      };
    }
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({}),
      json: async () => ({}),
    };
  });

  env.triggerWindow('online');
  // allow microtasks to settle
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(syncInvoked, true);
  assert.equal(env.taskBoard.getOfflineDrafts().length, 0);
});
