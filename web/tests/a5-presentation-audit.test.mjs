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
    const classSet = new Set();
    const cls = {
      add: value => classSet.add(value),
      remove: value => classSet.delete(value),
      contains: value => classSet.has(value),
      toggle: value => classSet.has(value) ? classSet.delete(value) : classSet.add(value),
    };
    return {
      tagName: tag.toUpperCase(), children: [], value: '', hidden: false, disabled: false,
      classList: cls,
      get className() { return Array.from(classSet).join(' '); },
      set className(v) { classSet.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classSet.add(c)); },
      style: { setProperty() {} }, listeners: {},
      get textContent() { return text; },
      set textContent(value) { text = String(value); if (!text) this.children = []; },
      setAttribute(name, value) { this[name] = String(value); }, removeAttribute(name) { delete this[name]; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(name, callback) { this.listeners[name] = callback; }, focus() {},
      querySelector() { return node(); },
      querySelectorAll(selector) {
        const matches = [];
        const walk = n => {
          if (selector.startsWith('.') && n.classList && n.classList.contains(selector.slice(1))) matches.push(n);
          if (n.children) n.children.forEach(walk);
        };
        if (this.children) this.children.forEach(walk);
        return matches;
      },
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
    console: console,
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

test('audit A5 blocked/decisions predicate: excludes closed issues and separates question-only items', () => {
  const { app, get } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const closedWithQuestionsAndTasks = {
    number: 1, state: 'closed', repository,
    openQuestions: [{ text: 'Which date?', completed: false }],
    humanTasks: [{ text: 'Review contract', completed: false }],
    statusLabel: 'status:needs-human',
  };
  const openQuestionOnly = {
    number: 2, state: 'open', repository,
    openQuestions: [{ text: 'Which date?', completed: false }],
    humanTasks: [],
    statusLabel: 'status:todo',
  };
  const openBlockedByHuman = {
    number: 3, state: 'open', repository,
    humanTasks: [{ text: 'Sign agreement', completed: false }],
    statusLabel: 'status:needs-human',
  };
  const openBlockedByDep = {
    number: 4, state: 'open', repository,
    blockedBy: [{ number: 99, state: 'open' }],
    statusLabel: 'status:todo',
  };

  assert.equal(app.isIssueDecision(closedWithQuestionsAndTasks), false, 'Closed issue must not be in decisions');
  assert.equal(app.isIssueBlocked(closedWithQuestionsAndTasks), false, 'Closed issue must not be in blocked');

  assert.equal(app.isIssueDecision(openQuestionOnly), true, 'Open question-only must be in decisions');
  assert.equal(app.isIssueBlocked(openQuestionOnly), false, 'Open question-only must NOT be in blocked');

  assert.equal(app.isIssueBlocked(openBlockedByHuman), true, 'Open needs-human must be blocked');
  assert.equal(app.isIssueBlocked(openBlockedByDep), true, 'Open with blocker must be blocked');

  app.state.board = { repo: 'owner/repo', issues: [closedWithQuestionsAndTasks, openQuestionOnly, openBlockedByHuman, openBlockedByDep] };
  app.updateSidebarBadges();
  assert.equal(get('decisions-nav-badge').textContent, '1');
  assert.equal(get('blocked-nav-badge').textContent, '2');
});

test('audit A5 human task rapid toggle: queues toggles and adopts updated fingerprint without 409', async () => {
  const { app, context } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const issue = {
    number: 1, repository, fingerprint: 'fp-1', state: 'open',
    statusLabel: 'status:needs-human',
    humanTasks: [
      { text: 'Task 1', completed: false },
      { text: 'Task 2', completed: false },
    ],
  };
  app.state.board = { repo: 'owner/repo', issues: [issue] };

  const requests = [];
  context.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    requests.push({ url, body });
    const newFp = 'fp-' + (requests.length + 1);
    const updated = {
      ...issue,
      fingerprint: newFp,
      title: 'Issue 1',
      state: 'open',
      statusLabel: 'status:needs-human',
      updatedAt: '2026-11-06T00:00:00Z',
      phase: 'build',
      attention: 'human',
      editableSections: [],
      openQuestions: [],
      humanTasks: issue.humanTasks.map((t, idx) => ({
        ...t,
        completed: idx === 0 ? true : t.completed,
      })),
      acceptanceCriteria: [],
      subtasks: [],
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        issue: updated,
        listItem: updated,
        statusOptions: [{ value: 'status:todo', label: 'Todo' }],
      }),
    };
  };

  const card = app.renderBlockedCard(issue, 'human', { blocked_human_tasks_title: 'Human Tasks' });
  const checkboxes = card.querySelectorAll('.human-task-checkbox');
  assert.equal(checkboxes.length, 2);

  // Trigger both changes rapidly
  checkboxes[0].checked = true;
  checkboxes[0].listeners.change();
  checkboxes[1].checked = true;
  checkboxes[1].listeners.change();

  await new Promise(r => setTimeout(r, 60));

  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.fingerprint, 'fp-1');
  assert.equal(requests[1].body.fingerprint, 'fp-2', 'Second rapid toggle must send the updated fingerprint from first toggle');
});
