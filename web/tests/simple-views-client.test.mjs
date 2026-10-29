import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function browser(storage = {}) {
  const nodes = new Map(), store = new Map(Object.entries(storage)), calls = [];
  function node() {
    return { value: '', textContent: '', children: [], hidden: false, disabled: false, className: '',
      listeners: {}, setAttribute(key, value) { this[key] = value; }, removeAttribute(key) { delete this[key]; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(event, callback) { this.listeners[event] = callback; }, focus() {}, querySelector() { return node(); } };
  }
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const localStorage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  const context = { document: { getElementById: get, createElement: node, querySelector() { return null; } },
    window: { setTimeout: (f) => f(), addEventListener() {}, location: { hash: '' } }, localStorage,
    navigator: { onLine: true }, fetch: async (url, options) => { calls.push({ url, options }); return { status: 503, ok: false, text: async () => JSON.stringify({ error: 'unavailable', message: 'Try later' }) }; } };
  vm.runInNewContext(fs.readFileSync('web/public/app.js', 'utf8').replace('  boot();', ''), context);
  return { app: context.window.__taskBoard, context, get, store, calls };
}
const row = (number, stage, priority, repository = 'owner/alpha', human = 0, questions = 0) => ({
  number, key: repository + '#' + number, title: 'Task ' + number, state: 'open', statusLabel: 'status:' + stage,
  labels: ['priority:' + priority], attention: 'none', repository: { full: repository, owner: 'owner', name: repository.split('/')[1] },
  createdAt: '2026-10-0' + number + 'T00:00:00Z', updatedAt: '2026-10-0' + (6 - number) + 'T00:00:00Z',
  counts: { humanTasks: { total: human, open: human }, openQuestions: { total: questions, open: questions } },
});
const numbers = (items) => Array.from(items, (item) => item.number);
test('defaults, validation and remembered device state', () => {
  const { app } = browser();
  assert.equal(app.state.viewState.view, 'simple'); assert.equal(app.state.viewState.sort, 'priority'); assert.equal(app.state.viewState.filters.length, 0);
  const saved = browser({ openchamber_web_view_state: JSON.stringify({ view: 'graph', sort: 'manual', filters: ['stage:draft', 'unknown', 'stage:draft'] }) });
  assert.equal(saved.app.state.viewState.view, 'graph'); assert.equal(saved.app.state.viewState.sort, 'manual');
  assert.deepEqual(Array.from(saved.app.state.viewState.filters), ['stage:draft']);
});
test('client short names and overrides match shared contract', () => {
  const { app } = browser();
  assert.equal(app.shortName('Workflows-Accelerator/openchamber-github-task-board'), 'Task Board');
  app.state.projectNames['owner/alpha'] = 'Personal'; assert.equal(app.shortName('Owner/Alpha'), 'Personal');
  assert.equal(app.shortName('owner/GH_repo.github'), 'Gh_repo.github');
});
test('filter groups combine OR within groups and AND across groups with all sorts', () => {
  const { app } = browser();
  const rows = [row(1, 'draft', 'low'), row(2, 'needs-human', 'high', 'owner/alpha', 2), row(3, 'todo', 'urgent', 'owner/beta', 0, 1), row(4, 'todo', 'medium', 'owner/alpha', 1, 1)];
  assert.deepEqual(numbers(app.filterSort(rows, { filters: [], sort: 'priority' })), [3, 2, 4, 1]);
  assert.deepEqual(numbers(app.filterSort(rows, { filters: ['human', 'questions', 'stage:todo', 'project:owner/alpha'], sort: 'priority' })), [4]);
  assert.deepEqual(numbers(app.filterSort(rows, { filters: ['stage:todo', 'stage:draft'], sort: 'created' })), [4, 3, 1]);
  assert.deepEqual(numbers(app.filterSort(rows, { filters: ['needs-me'], sort: 'updated' })), [2, 3, 4]);
  rows[0].order = 2000; rows[3].order = 1000;
  assert.deepEqual(numbers(app.filterSort(rows, { filters: [], sort: 'manual' })), [4, 1, 2, 3]);
  const unmarked = [row(3, 'draft', 'low'), row(1, 'draft', 'high'), row(2, 'draft', 'medium')];
  assert.deepEqual(numbers(app.filterSort(unmarked, { filters: [], sort: 'manual' })), [1, 2, 3]);
});
test('offline drafts render in quick capture, preserve description and local reorder markers', async () => {
  const { app, get } = browser();
  app.saveToOfflineQueue('One', 'owner/alpha', 'Idea one', 1000);
  app.saveToOfflineQueue('Two', 'owner/alpha', 'Idea two', 2000);
  app.state.selected = 'all'; app.state.board = { repo: 'All repositories', issues: [] };
  app.state.viewState = { view: 'simple', filters: ['stage:draft'], sort: 'manual' };
  app.renderBoard();
  assert.equal(get('quick-add-form').hidden, false);
  assert.equal(get('task-list').children.length, 2);
  const drafts = app.getOfflineDrafts();
  await app.reorderDraft({ offline: true, id: drafts[1].id, title: 'Two' }, 1, 0, drafts.map((draft) => ({ ...draft, offline: true })));
  assert.equal(app.getOfflineDrafts()[1].order, 0);
  assert.equal(app.getOfflineDrafts()[1].description, 'Idea two');
});
test('offline sync retains drafts on definite server refusal instead of deleting local work', async () => {
  const { app } = browser();
  app.saveToOfflineQueue('Keep me', 'owner/alpha');
  await app.syncOfflineDrafts();
  assert.equal(app.getOfflineDrafts().length, 1);
});
test('existing GitHub drafts cannot silently queue reorder while offline', async () => {
  const { app, context, calls, get } = browser();
  context.navigator.onLine = false;
  const first = { ...row(1, 'draft', 'high'), order: 1000, fingerprint: 'f' };
  const second = { ...row(2, 'draft', 'high'), order: 2000, fingerprint: 'g' };
  await app.reorderDraft(second, 1, 0, [first, second]);
  assert.equal(calls.length, 0); assert.match(get('notice').textContent, /cannot be changed offline/);
});
test('Align Drafts and old preset tabs absent; controls, native modal and bottom capture present', () => {
  const html = fs.readFileSync('web/public/index.html', 'utf8');
  assert.doesNotMatch(html, /Align Drafts|align-drafts-btn|view-tab|tab-running/);
  for (const id of ['view-btn', 'filter-btn', 'sort-btn', 'filter-chips', 'settings-btn']) assert.ok(html.includes('id="' + id + '"'));
  assert.match(html, /<dialog id="board-sheet"/);
  assert.ok(html.indexOf('id="quick-add-form"') > html.indexOf('id="task-list"'));
});
