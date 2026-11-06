import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function browser(storage = {}) {
  const nodes = new Map();
  const store = new Map(Object.entries(storage));
  const classes = () => {
    const values = new Set();
    return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value), toggle: value => values.has(value) ? values.delete(value) : values.add(value) };
  };
  function node(tag = 'div') {
    let text = '';
    return {
      tagName: tag.toUpperCase(), children: [], value: '', hidden: false, disabled: false,
      classList: classes(), style: { setProperty() {} }, listeners: {},
      get textContent() { return text; },
      set textContent(value) { text = String(value); if (!text) this.children = []; },
      setAttribute(name, value) { this[name] = String(value); }, removeAttribute(name) { delete this[name]; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(name, callback) { this.listeners[name] = callback; }, focus() {},
      querySelector() { return node(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 900 }; },
    };
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const context = {
    document: { body: node('body'), documentElement: node('html'), getElementById: get, createElement: node, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {} },
    window: { addEventListener() {}, setTimeout() {}, location: { hash: '' }, matchMedia() { return { matches: false }; } },
    navigator: { onLine: true },
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) },
    fetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ authenticated: false }) }),
  };
  vm.runInNewContext(fs.readFileSync('web/public/app.js', 'utf8').replace('  boot();', ''), context);
  return { app: context.window.__taskBoard, context, get, store };
}

for (const language of ['en', 'fr']) {
  test(`audit A5 presentation ${language}: saved toggle restores global body mode and filters draft rows without altering board data`, async () => {
    const { app, context, get, store } = browser({ chamberos_client_presentation_mode: '1', tb_lang: language });
    await app.boot();
    assert.equal(app.state.clientPresentationMode, true);
    assert.equal(context.document.body.classList.contains('client-presentation-active'), true);
    assert.equal(get('client-presentation-banner').hidden, false);
    const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
    app.state.board = { repo: 'owner/repo', issues: [
      { number: 1, repository, title: 'Draft', column: 'draft', statusLabel: 'status:draft', labels: ['status:draft'], counts: {} },
      { number: 2, repository, title: 'Active', column: 'in-progress', statusLabel: 'status:in-progress', labels: ['status:in-progress'], counts: {} },
    ] };
    app.state.viewState = { view: 'simple', filters: [], sort: 'priority' };
    app.renderBoard();
    assert.equal(get('task-list').children.length, 1);
    assert.equal(app.state.board.issues.length, 2, 'presentation must not mutate fetched issue data');
    get('client-banner-exit-btn').listeners.click();
    assert.equal(app.state.clientPresentationMode, false);
    assert.equal(store.get('chamberos_client_presentation_mode'), '0');
    assert.equal(get('task-list').children.length, 2);
  });
}
