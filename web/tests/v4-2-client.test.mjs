import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The shipped client is loaded in a minimal VM with a real localStorage map.
// This proves the offline snapshot rule, not a re-implementation of it.
function browser(storage = {}) {
  const nodes = new Map();
  const store = new Map(Object.entries(storage));
  function node(tag = 'div') {
    const attrs = {};
    let textValue = '';
    return {
      tagName: String(tag).toUpperCase(), value: '', children: [], hidden: false, disabled: false,
      className: '', style: {}, listeners: {}, attrs,
      get textContent() { return textValue; },
      set textContent(value) { textValue = String(value); if (textValue === '') this.children = []; },
      setAttribute(key, value) { attrs[key] = String(value); this[key] = value; },
      removeAttribute(key) { delete attrs[key]; delete this[key]; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(event, callback) { this.listeners[event] = callback; },
      focus() { context.document.activeElement = this; },
      querySelector() { return node(); },
      querySelectorAll() { return []; },
    };
  }
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const context = {
    document: { activeElement: null, getElementById: get, createElement: node, querySelector() { return null; }, querySelectorAll() { return []; } },
    window: { setTimeout: (fn) => fn(), addEventListener() {}, location: { hash: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    localStorage,
    navigator: { onLine: true },
    fetch: async () => ({ ok: true, status: 200, text: async () => '{}', headers: { get: () => null } }),
  };
  vm.runInNewContext(fs.readFileSync('web/public/app.js', 'utf8').replace('  boot();', ''), context);
  return { app: context.window.__taskBoard, store };
}

const snapshotOf = (store) => JSON.parse(store.get('tb_cached_board'));

test('V4-2 offline snapshot drops agent notes but keeps canvas stickies and counts', () => {
  const { app, store } = browser();
  const canvas = { x: 80, y: 90, notes: [{ id: 'sticky-1', x: 100, y: 300, w: 240, h: 120, text: 'Canvas planning only', color: 'yellow' }] };
  app.saveCachedBoard({
    repo: 'owner/repo',
    issues: [{
      number: 1,
      title: 'Task',
      canvas,
      commentCount: 4,
      noteCount: 2,
      noteCountPartial: false,
      notes: [{ id: 11, text: 'Agent note that belongs on GitHub', author: 'owner', createdAt: '2026-11-12T12:00:00Z', url: null }],
    }],
  });
  const saved = snapshotOf(store);
  assert.equal(saved.issues[0].notes, undefined);
  assert.deepEqual(saved.issues[0].canvas, canvas);
  assert.equal(saved.issues[0].commentCount, 4);
  assert.equal(saved.issues[0].noteCount, 2);
  assert.equal(saved.repo, 'owner/repo');
});
