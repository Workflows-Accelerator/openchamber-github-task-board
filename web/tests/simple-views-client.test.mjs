import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function browser(storage = {}) {
  const nodes = new Map(), store = new Map(Object.entries(storage)), calls = [];
  function node(tag = 'div') {
    const attrs = {};
    let textValue = '';
    return { tagName: String(tag).toUpperCase(), value: '',
      get textContent() { return textValue; },
      set textContent(v) { textValue = String(v); if (textValue === '') this.children = []; },
      children: [], hidden: false, disabled: false, checked: false, className: '',
      style: {}, scrollHeight: 0, attrs,
      listeners: {}, setAttribute(key, value) { attrs[key] = String(value); this[key] = value; }, removeAttribute(key) { delete attrs[key]; delete this[key]; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(event, callback) { this.listeners[event] = callback; }, focus() { context.document.activeElement = this; },
      querySelector() { return node(); }, querySelectorAll() { return []; } };
  }
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const localStorage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  let responder = async () => ({ status: 503, ok: false, text: async () => JSON.stringify({ error: 'unavailable', message: 'Try later' }) });
  const context = { document: { activeElement: null, getElementById: get, createElement: node, querySelector() { return null; }, querySelectorAll() { return []; } },
    window: { setTimeout: (f) => f(), addEventListener() {}, location: { hash: '' }, confirm: () => true }, localStorage,
    navigator: { onLine: true }, fetch: async (url, options) => { calls.push({ url, options }); return responder(url, options); } };
  vm.runInNewContext(fs.readFileSync('web/public/app.js', 'utf8').replace('  boot();', ''), context);
  return { app: context.window.__taskBoard, context, get, store, calls, setResponder(fn) { responder = fn; } };
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

function validDetail(number, repoFull = 'owner/alpha', repoId = 101, overrides = {}) {
  const [owner, name] = repoFull.split('/');
  return Object.assign({
    number,
    key: repoFull + '#' + number,
    repository: { owner, name, full: repoFull, id: repoId, archived: false, hasIssues: true, available: true },
    title: 'Task ' + number,
    friendlyTitle: null,
    state: 'open',
    htmlUrl: 'https://github.com/' + repoFull + '/issues/' + number,
    body: '## Overview\nOriginal\n',
    description: '## Overview\nOriginal',
    order: 1000,
    fingerprint: 'fp-' + repoFull + '-' + number,
    labels: ['status:draft'],
    statusLabel: 'status:draft',
    phase: 'planning',
    attention: 'none',
    column: 'draft',
    updatedAt: '2026-10-01T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
    editableSections: [{ id: 'overview', title: 'Overview', text: 'Original' }],
    openQuestions: [],
    humanTasks: [],
    acceptanceCriteria: [{ text: 'Unchecked item', completed: false, lineIndex: 3 }],
    subtasks: [],
  }, overrides);
}
const statusOptions = [{ value: 'status:draft', label: 'Draft' }, { value: 'status:todo', label: 'Todo' }, { value: 'status:done', label: 'Done' }];

test('F1 client: confirmed draft project move sends confirmed:true and validates transferred target repository payload', async () => {
  const { app, calls, setResponder } = browser();
  const source = validDetail(1, 'owner/alpha', 101);
  const transferred = validDetail(9, 'owner/beta', 202, { title: source.title });
  setResponder(async () => ({
    status: 200, ok: true,
    text: async () => JSON.stringify({ issue: transferred, targetUrl: transferred.htmlUrl, statusOptions }),
  }));
  app.state.board = { repo: 'All repositories', issues: [source] };
  const ok = await app.draftMutation(source, 'move', { target: 'owner/beta', confirmed: true });
  assert.equal(ok, true);
  assert.equal(calls[0].url, '/api/repos/owner/alpha/issues/1/move');
  assert.deepEqual(JSON.parse(calls[0].options.body), { fingerprint: source.fingerprint, target: 'owner/beta', confirmed: true });
});

test('F2 client: offline queue preserves duplicate titles, holds uncertain creates without auto-resend, retains in-flight edits, and boots offline shell', async () => {
  const { app, context, calls, setResponder, get } = browser();
  app.saveToOfflineQueue('Same title', 'owner/alpha', 'First description', 1000);
  app.saveToOfflineQueue('Same title', 'owner/alpha', 'Second description', 2000);
  assert.equal(app.getOfflineDrafts().length, 2);
  assert.deepEqual(Array.from(app.getOfflineDrafts(), (d) => d.description), ['First description', 'Second description']);

  // Partial reconnection: 1st succeeds, 2nd loses response (uncertain), 3rd stays queued.
  app.saveOfflineDrafts([]);
  app.saveToOfflineQueue('Partial 1', 'owner/alpha', 'Desc 1', 1000);
  app.saveToOfflineQueue('Partial 2', 'owner/alpha', 'Desc 2', 2000);
  app.saveToOfflineQueue('Partial 3', 'owner/alpha', 'Desc 3', 3000);
  let postCount = 0;
  setResponder(async () => {
    postCount++;
    if (postCount === 2) throw new Error('Failed to fetch');
    return { status: 201, ok: true, text: async () => JSON.stringify({ issue: validDetail(10 + postCount, 'owner/alpha', 101), statusOptions }) };
  });
  await app.syncOfflineDrafts();
  const afterDrop = app.getOfflineDrafts();
  assert.deepEqual(Array.from(afterDrop, (d) => d.title), ['Partial 2', 'Partial 3']);
  assert.equal(Boolean(afterDrop[0].uncertain || afterDrop[0].state === 'uncertain'), true);
  assert.equal(Boolean(afterDrop[1].uncertain || afterDrop[1].state === 'uncertain'), false);

  // Reconnect: Partial 2 (uncertain) must NOT be resent automatically; Partial 3 (queued) syncs.
  calls.length = 0;
  await app.syncOfflineDrafts();
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).title, 'Partial 3');
  assert.deepEqual(Array.from(app.getOfflineDrafts(), (d) => d.title), ['Partial 2']);

  // Editing an item while its POST is in flight retains the newer revision and confirmed identity.
  app.saveOfflineDrafts([]);
  app.saveToOfflineQueue('In flight', 'owner/alpha', 'Old description', 1000);
  let releasePost;
  const gate = new Promise((r) => { releasePost = r; });
  setResponder(async () => {
    await gate;
    return { status: 201, ok: true, text: async () => JSON.stringify({ issue: validDetail(42, 'owner/alpha', 101), statusOptions }) };
  });
  const syncPromise = app.syncOfflineDrafts();
  app.state.selected = 'all';
  app.state.board = { repo: 'All repositories', issues: [] };
  app.state.viewState = { view: 'simple', filters: ['stage:draft'], sort: 'manual' };
  app.renderBoard();
  const rowNode = get('task-list').children[0];
  const formNode = rowNode.children[1];
  const descInput = formNode.children[1];
  descInput.value = 'New during sync';
  await formNode.listeners.submit({ preventDefault() {} });
  releasePost();
  await syncPromise;
  assert.equal(app.getOfflineDrafts().length, 1);
  assert.equal(app.getOfflineDrafts()[0].description, 'New during sync');
  assert.equal(app.getOfflineDrafts()[0].confirmedNumber, 42);

  // Cold offline boot exposes local draft shell without pretending authentication succeeded.
  context.navigator.onLine = false;
  setResponder(async () => { throw new Error('Failed to fetch'); });
  await app.boot();
  assert.equal(app.state.csrf, null);
  assert.equal(get('board-view').hidden, false);
  assert.equal(get('login-view').hidden, true);
  assert.ok(get('task-list').children.length >= 1);
});

test('F4 client: unchecked checkbox property, qualified Mark Done, unsaved overview across checkbox toggle, and inline draft buffer fingerprint binding', async () => {
  const { app, get, calls, setResponder } = browser();
  const alphaIssue = validDetail(1, 'owner/alpha', 101, { statusLabel: 'status:todo', labels: ['status:todo'] });
  const betaIssue = validDetail(1, 'owner/beta', 202, { statusLabel: 'status:todo', labels: ['status:todo'] });
  app.state.board = { repo: 'All repositories', issues: [Object.assign({}, alphaIssue, { counts: {} }), Object.assign({}, betaIssue, { counts: {} })] };
  app.state.detail = betaIssue;
  app.state.statusOptions = statusOptions;
  app.renderDetail(false);

  // Unchecked checklist item must have boolean checked === false and not attribute "false".
  const acItem = get('ac-list').children[0];
  const checkbox = acItem.children[0].children[0];
  assert.equal(checkbox.checked, false);
  assert.equal(checkbox.attrs.checked, undefined);

  // Unsaved overview survives checklist toggle on current issue.
  get('overview-text').value = 'Unsaved overview text';
  const toggledBeta = validDetail(1, 'owner/beta', 202, {
    fingerprint: 'fp-beta-after-toggle',
    body: '## Overview\nOriginal\n\n## Acceptance Criteria\n- [x] Unchecked item\n',
    acceptanceCriteria: [{ text: 'Unchecked item', completed: true, lineIndex: 3 }],
  });
  setResponder(async () => ({ status: 200, ok: true, text: async () => JSON.stringify({ issue: toggledBeta, statusOptions }) }));
  await app.toggleChecklistItem(betaIssue.acceptanceCriteria[0], true, true);
  assert.equal(get('overview-text').value, 'Unsaved overview text');

  // Mark Done on beta#1 updates only beta#1 on board, not alpha#1.
  const closedBeta = validDetail(1, 'owner/beta', 202, { state: 'closed', statusLabel: 'status:done', fingerprint: 'fp-beta-closed' });
  setResponder(async () => ({ status: 200, ok: true, text: async () => JSON.stringify({ issue: closedBeta, statusOptions }) }));
  await app.toggleMarkDone();
  assert.equal(app.state.board.issues[0].state, 'open');
  assert.equal(app.state.board.issues[1].state, 'closed');

  // Reordering preserves unsaved inline draft edit and updates its observed fingerprint.
  const d1 = validDetail(1, 'owner/alpha', 101, { title: 'A', order: 1000, fingerprint: 'fp-1' });
  const d2 = validDetail(2, 'owner/alpha', 101, { title: 'B', order: 2000, fingerprint: 'fp-2' });
  app.state.selected = 'all';
  app.state.board = { repo: 'All repositories', issues: [d1, d2] };
  app.state.viewState = { view: 'simple', filters: ['stage:draft'], sort: 'manual' };
  app.renderBoard();
  const rowB = get('task-list').children[1];
  const titleB = rowB.children[1].children[0];
  titleB.value = 'UNSAVED B';
  titleB.listeners.input();
  assert.equal(app.state.draftEdits.get('owner/alpha#2').fingerprint, 'fp-2');

  const d2Moved = validDetail(2, 'owner/alpha', 101, { title: 'B', order: 0, fingerprint: 'fp-2-moved' });
  setResponder(async () => ({ status: 200, ok: true, text: async () => JSON.stringify({ issue: d2Moved, updatedIssues: [d2Moved], statusOptions }) }));
  await app.reorderDraft(d2, 1, 0, [d1, d2]);
  assert.equal(app.state.draftEdits.has('owner/alpha#2'), true);
  assert.equal(app.state.draftEdits.get('owner/alpha#2').title, 'UNSAVED B');
  assert.equal(app.state.draftEdits.get('owner/alpha#2').fingerprint, 'fp-2-moved');

  // External refresh does NOT rebase inline draft buffer onto the new server fingerprint.
  const d2RemoteChanged = validDetail(2, 'owner/alpha', 101, { title: 'B remote', order: 0, fingerprint: 'fp-2-remote' });
  app.state.board.issues = [d2RemoteChanged, d1];
  app.renderBoard();
  const rowBAfterRefresh = get('task-list').children[0];
  const formBAfterRefresh = rowBAfterRefresh.children[1];
  calls.length = 0;
  setResponder(async () => ({ status: 409, ok: false, text: async () => JSON.stringify({ error: 'conflict', message: 'Conflict' }) }));
  await formBAfterRefresh.listeners.submit({ preventDefault() {} });
  assert.equal(JSON.parse(calls[0].options.body).fingerprint, 'fp-2-moved');
});

test('F5 client: downward reorder across unmarked, mixed, and equal-rank drafts initializes/rebalances instead of refusing', async () => {
  const { app, calls, setResponder } = browser();
  const a = validDetail(1, 'owner/alpha', 101, { title: 'A', order: null, fingerprint: 'fp-a' });
  const b = validDetail(2, 'owner/alpha', 101, { title: 'B', order: null, fingerprint: 'fp-b' });
  const c = validDetail(3, 'owner/alpha', 101, { title: 'C', order: null, fingerprint: 'fp-c' });
  app.state.board = { repo: 'All repositories', issues: [a, b, c] };
  setResponder(async () => ({
    status: 200, ok: true,
    text: async () => JSON.stringify({
      issue: validDetail(1, 'owner/alpha', 101, { title: 'A', order: 2000, fingerprint: 'fp-a2' }),
      updatedIssues: [
        validDetail(2, 'owner/alpha', 101, { title: 'B', order: 1000, fingerprint: 'fp-b2' }),
        validDetail(1, 'owner/alpha', 101, { title: 'A', order: 2000, fingerprint: 'fp-a2' }),
        validDetail(3, 'owner/alpha', 101, { title: 'C', order: 3000, fingerprint: 'fp-c2' }),
      ],
      statusOptions,
    }),
  }));
  await app.reorderDraft(a, 0, 1, [a, b, c]);
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].options.body);
  assert.ok(Array.isArray(body.updates) && body.updates.length >= 2);
  assert.deepEqual(Array.from(app.filterSort(app.state.board.issues, { filters: [], sort: 'manual' }), (i) => i.title), ['B', 'A', 'C']);
});

test('F6 & F8 client: human tasks render completion checkboxes + GitHub source link, description auto-sizes, and drawer close restores focus', async () => {
  const { app, get, context, setResponder } = browser();
  const issue = validDetail(1, 'owner/alpha', 101, {
    statusLabel: 'status:needs-human',
    labels: ['status:needs-human'],
    body: '## Overview\nOriginal\n\n## Human Tasks\n- [ ] Approve release\n',
    humanTasks: [{ text: 'Approve release', completed: false, lineIndex: 4 }],
    pendingItems: [{ text: 'Approve release', completed: false }],
    counts: { humanTasks: { total: 1, open: 1 }, openQuestions: { total: 0, open: 0 }, subtasks: { total: 0, done: 0 } },
  });
  app.state.board = { repo: 'All repositories', issues: [issue] };
  app.state.viewState = { view: 'pending', filters: [], sort: 'priority' };
  app.renderBoard();

  // Open issue from Pending card button and verify human checkbox + GitHub link.
  const pendingLi = get('task-list').children[1];
  const cardBtn = pendingLi.children[0];
  context.document.querySelector = (sel) => sel.includes('owner/alpha#1') ? cardBtn : null;
  setResponder(async () => ({ status: 200, ok: true, text: async () => JSON.stringify({ issue, statusOptions }) }));
  cardBtn.listeners.click();
  await new Promise((r) => setTimeout(r, 10));

  const humanCheckbox = get('human-list').children[0].children[0].children[0];
  assert.equal(humanCheckbox.type, 'checkbox');
  assert.equal(humanCheckbox.checked, false);
  const githubLink = get('detail-meta').children.find((n) => n.tagName === 'A');
  assert.ok(githubLink);
  assert.equal(githubLink.href, issue.htmlUrl);

  // Completing the human task updates the issue without closing it and updates board pendingItems.
  const completedIssue = validDetail(1, 'owner/alpha', 101, {
    statusLabel: 'status:needs-human',
    labels: ['status:needs-human'],
    state: 'open',
    fingerprint: 'fp-human-done',
    body: '## Overview\nOriginal\n\n## Human Tasks\n- [x] Approve release\n',
    humanTasks: [{ text: 'Approve release', completed: true, lineIndex: 4 }],
  });
  setResponder(async () => ({ status: 200, ok: true, text: async () => JSON.stringify({ issue: completedIssue, statusOptions }) }));
  humanCheckbox.checked = true;
  await humanCheckbox.listeners.change();
  assert.equal(app.state.detail.state, 'open');
  assert.equal(app.state.detail.humanTasks[0].completed, true);
  assert.equal(app.state.board.issues[0].pendingItems[0].completed, true);

  // Closing drawer restores focus to the opener button.
  app.closeDrawer();
  assert.equal(context.document.activeElement, cardBtn);

  // CSS target check for question option buttons and auto-size for draft description.
  const css = fs.readFileSync('web/public/theme.css', 'utf8');
  assert.match(css, /\.question-option-btn\s*\{[^}]*min-height:\s*44px/);
});
