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
      setSelectionRange() {},
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
      },
      querySelectorAll(selector) {
        const matches = [];
        const parts = selector.trim().split(/\s+/);
        const targetPart = parts[parts.length - 1];
        const matchSingle = (n, sel) => {
          if (!sel) return false;
          if (sel.startsWith('.')) {
            const classes = sel.slice(1).split('.');
            return classes.every(c => n.classList && n.classList.contains(c));
          }
          if (sel.includes('.')) {
            const [tag, ...classes] = sel.split('.');
            if (tag && n.tagName !== tag.toUpperCase()) return false;
            return classes.every(c => n.classList && n.classList.contains(c));
          }
          return n.tagName === sel.toUpperCase();
        };
        const walk = n => {
          if (matchSingle(n, targetPart)) matches.push(n);
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
    setTimeout: (fn, ms) => setTimeout(fn, ms),
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

test('audit A5 note 409 conflict recovery: extracts fingerprint from error payload and prompts on remote change', async () => {
  const { app, context } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const note = { id: 'note-1', text: 'Initial text', x: 10, y: 20 };
  const issue = {
    number: 1, repository, fingerprint: 'fp-initial', state: 'open',
    title: 'Issue 1', statusLabel: 'status:todo',
    canvas: { notes: [note] },
  };
  app.state.board = { repo: 'owner/repo', issues: [issue] };

  let callCount = 0;
  context.fetch = async (url, opts) => {
    callCount++;
    const body = JSON.parse(opts.body);
    if (callCount === 1) {
      assert.equal(body.fingerprint, 'fp-initial');
      // Return 409 with updated fingerprint in issue.fingerprint and changed remote note text
      return {
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          error: 'stale_fingerprint',
          message: 'Conflict',
          issue: {
            ...issue,
            fingerprint: 'fp-remote-updated',
            canvas: { notes: [{ id: 'note-1', text: 'Remote edited text', x: 10, y: 20 }] },
          },
        }),
      };
    }
    // Second call: user clicked overwrite with the new fingerprint
    assert.equal(body.fingerprint, 'fp-remote-updated');
    const finalItem = {
      ...issue,
      fingerprint: 'fp-final',
      title: 'Issue 1',
      state: 'open',
      statusLabel: 'status:todo',
      updatedAt: '2026-11-06T00:00:00Z',
      phase: 'build',
      attention: 'human',
      canvas: { notes: body.notes },
      editableSections: [],
      openQuestions: [],
      humanTasks: [],
      acceptanceCriteria: [],
      subtasks: [],
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        issue: finalItem,
        listItem: finalItem,
        statusOptions: [{ value: 'status:todo', label: 'Todo' }],
      }),
    };
  };

  const noteEl = app.createStickyNoteElement(note, issue);
  // Enter edit mode
  const ev = { stopPropagation() {}, preventDefault() {} };
  noteEl.querySelector('.btn-edit').listeners.click(ev);
  const textarea = noteEl.querySelector('.canvas-note-textarea');
  textarea.value = 'My local draft text';
  textarea.listeners.input();

  // Draft must be preserved
  const draftKey = 'owner/repo#1:note-1';
  assert.equal(app.activeNoteDrafts.get(draftKey).draftText, 'My local draft text');

  // Trigger save
  const saveBtn = noteEl.querySelector('.canvas-note-editor-actions button.button.primary');
  saveBtn.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));

  // 409 happened: local draft must be retained on conflict
  assert.equal(app.activeNoteDrafts.get(draftKey).draftText, 'My local draft text', 'Local draft must be retained on conflict');

  // Conflict banner should appear with overwrite option
  const conflictBanner = noteEl.querySelector('.canvas-note-conflict-banner');
  assert.equal(conflictBanner.hidden, false);
  const overwriteBtn = conflictBanner.querySelector('.conflict-overwrite');
  assert.ok(overwriteBtn);

  // Click overwrite
  overwriteBtn.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));

  assert.equal(callCount, 2);
  assert.equal(issue.fingerprint, 'fp-final');
  assert.equal(app.activeNoteDrafts.has(draftKey), false, 'Draft cleared after successful overwrite');
});

test('audit A5 presentation mode: hides all questions and human tasks in Decisions and Blocked without leaking text', () => {
  const { app, get } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const issueWithQuestions = {
    number: 1, state: 'open', repository,
    title: 'Plan release', statusLabel: 'status:todo',
    openQuestions: [{ text: 'Which cloud provider?', completed: false }],
    humanTasks: [],
  };
  const issueWithHumanTasks = {
    number: 2, state: 'open', repository,
    title: 'Deploy release', statusLabel: 'status:needs-human',
    openQuestions: [],
    humanTasks: [{ text: 'Sign off production deploy', completed: false }],
  };
  app.state.board = { repo: 'owner/repo', issues: [issueWithQuestions, issueWithHumanTasks] };

  app.setClientPresentationMode(true);
  app.updateSidebarBadges();

  assert.equal(get('decisions-nav-badge').textContent, '0', 'Decisions count must be 0 in presentation mode');
  assert.equal(get('blocked-nav-badge').textContent, '1', 'Blocked count must still reflect blocked issue');

  app.renderDecisionsView();
  assert.equal(get('decisions-list').children.length, 0, 'No questions rendered in decisions in presentation mode');
  assert.equal(get('decisions-empty').hidden, false);
  assert.match(get('decisions-empty').textContent, /presentation mode/i);

  app.renderBlockedView();
  const blockedList = get('blocked-list');
  const allText = JSON.stringify(blockedList);
  assert.equal(allText.includes('Sign off production deploy'), false, 'Raw human task text must NOT leak into blocked view');
  assert.match(allText, /presentation mode/i, 'Blocked view must show presentation notice');
});

test('audit A5 note overwrite preserves remote card geometry and concurrent changes to other notes', async () => {
  const { app, context } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const noteA = { id: 'note-a', text: 'Base text A', x: 10, y: 10 };
  const noteB = { id: 'note-b', text: 'Base text B', x: 20, y: 20 };
  const issue = {
    number: 1, repository, fingerprint: 'fp-base', state: 'open',
    title: 'Issue 1', statusLabel: 'status:todo',
    canvas: { x: 100, y: 200, notes: [noteA, noteB] },
  };
  app.state.board = { repo: 'owner/repo', issues: [issue] };

  let callCount = 0;
  context.fetch = async (url, opts) => {
    callCount++;
    const body = JSON.parse(opts.body);
    if (callCount === 1) {
      assert.equal(body.fingerprint, 'fp-base');
      return {
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          error: 'stale_fingerprint',
          message: 'Conflict',
          issue: {
            ...issue,
            fingerprint: 'fp-remote',
            canvas: {
              x: 300, y: 400,
              notes: [
                { id: 'note-a', text: 'Remote updated A', x: 10, y: 10 },
                { id: 'note-b', text: 'Remote updated B', x: 20, y: 20 },
              ],
            },
          },
        }),
      };
    }
    assert.equal(body.fingerprint, 'fp-remote');
    assert.equal(body.x, 300, 'Must preserve remote card position x');
    assert.equal(body.y, 400, 'Must preserve remote card position y');
    const savedNoteB = body.notes.find(n => n.id === 'note-b');
    assert.equal(savedNoteB.text, 'Remote updated B', 'Must preserve remote concurrent edit to note B');
    const savedNoteA = body.notes.find(n => n.id === 'note-a');
    assert.equal(savedNoteA.text, 'My new local draft A', 'Must overwrite note A with user draft');

    const finalItem = {
      ...issue,
      fingerprint: 'fp-final',
      title: 'Issue 1',
      state: 'open',
      statusLabel: 'status:todo',
      updatedAt: '2026-11-06T00:00:00Z',
      phase: 'build',
      attention: 'none',
      canvas: { x: body.x, y: body.y, notes: body.notes },
      editableSections: [],
      openQuestions: [],
      humanTasks: [],
      acceptanceCriteria: [],
      subtasks: [],
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, issue: finalItem, listItem: finalItem }),
    };
  };

  const noteEl = app.createStickyNoteElement(noteA, issue);
  const ev = { stopPropagation() {}, preventDefault() {} };
  noteEl.querySelector('.btn-edit').listeners.click(ev);
  const textarea = noteEl.querySelector('.canvas-note-textarea');
  textarea.value = 'My new local draft A';
  textarea.listeners.input();

  const saveBtn = noteEl.querySelector('.canvas-note-editor-actions button.button.primary');
  saveBtn.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));

  const conflictBanner = noteEl.querySelector('.canvas-note-conflict-banner');
  assert.equal(conflictBanner.hidden, false);
  const overwriteBtn = conflictBanner.querySelector('.conflict-overwrite');
  overwriteBtn.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));

  assert.equal(callCount, 2);
});

test('audit A5 note 409 safe retry: adopts remote fingerprint without conflict prompt when target note was not modified remotely', async () => {
  const { app, context } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const note = { id: 'note-1', text: 'Unchanged note text', x: 10, y: 10 };
  const issue = {
    number: 1, repository, fingerprint: 'fp-1', state: 'open',
    title: 'Issue 1', statusLabel: 'status:todo',
    canvas: { notes: [note] },
  };
  app.state.board = { repo: 'owner/repo', issues: [issue] };

  let callCount = 0;
  context.fetch = async (url, opts) => {
    callCount++;
    const body = JSON.parse(opts.body);
    if (callCount === 1) {
      assert.equal(body.fingerprint, 'fp-1');
      return {
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          error: 'stale_fingerprint',
          message: 'Conflict',
          issue: {
            ...issue,
            fingerprint: 'fp-2-non-note',
            title: 'Issue 1 renamed',
            canvas: { notes: [{ id: 'note-1', text: 'Unchanged note text', x: 10, y: 10 }] },
          },
        }),
      };
    }
    assert.equal(body.fingerprint, 'fp-2-non-note');
    const finalItem = {
      ...issue,
      fingerprint: 'fp-3',
      title: 'Issue 1 renamed',
      state: 'open',
      statusLabel: 'status:todo',
      updatedAt: '2026-11-06T00:00:00Z',
      phase: 'build',
      attention: 'none',
      canvas: { notes: body.notes },
      editableSections: [],
      openQuestions: [],
      humanTasks: [],
      acceptanceCriteria: [],
      subtasks: [],
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        issue: finalItem,
        listItem: finalItem,
        statusOptions: [{ value: 'status:todo', label: 'Todo' }],
      }),
    };
  };

  const noteEl = app.createStickyNoteElement(note, issue);
  const ev = { stopPropagation() {}, preventDefault() {} };
  noteEl.querySelector('.btn-edit').listeners.click(ev);
  const textarea = noteEl.querySelector('.canvas-note-textarea');
  textarea.value = 'User edit to note';
  textarea.listeners.input();

  const saveBtn = noteEl.querySelector('.canvas-note-editor-actions button.button.primary');
  saveBtn.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));

  const conflictBanner = noteEl.querySelector('.canvas-note-conflict-banner');
  assert.equal(conflictBanner.hidden, true);
  assert.ok(saveBtn.classList.contains('is-retry'));

  saveBtn.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));

  assert.equal(callCount, 2);
  assert.equal(issue.fingerprint, 'fp-3');
});

test('audit A5 presentation draft filtering: non-draft status issues without priority label stay visible when column is draft', () => {
  const { app, get } = browser({ chamberos_client_presentation_mode: '1' });
  app.setClientPresentationMode(true);
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  app.state.board = {
    repo: 'owner/repo',
    issues: [
      { number: 1, repository, state: 'open', title: 'Secret draft', column: 'draft', statusLabel: 'status:draft', labels: ['status:draft'], counts: {} },
      { number: 2, repository, state: 'open', title: 'Unprioritized todo task', friendlyTitle: 'Client friendly release title', column: 'draft', statusLabel: 'status:todo', labels: ['status:todo'], overview: 'Safe overview prose', counts: {} },
      { number: 3, repository, state: 'open', title: 'Cancelled task', column: 'backlog', statusLabel: 'status:cancelled', labels: ['status:cancelled'], counts: {} },
    ],
  };
  app.state.viewState = { view: 'simple', filters: [], sort: 'priority' };
  app.renderBoard();
  assert.equal(get('task-list').children.length, 1, 'Open todo issue without priority label must remain visible in presentation mode');
});

test('audit A5 note 409 conflict across refresh: ordinary Retry after board refresh does not overwrite remote note without explicit Overwrite', async () => {
  const { app, context } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const note = { id: 'note-1', text: 'Initial canvas note', x: 10, y: 20 };
  const issue = {
    number: 1, repository, fingerprint: 'fp-initial', state: 'open',
    title: 'Issue 1', statusLabel: 'status:todo',
    canvas: { notes: [note] },
  };
  app.state.board = { repo: 'owner/repo', issues: [issue] };

  let putCalls = 0;
  context.fetch = async (url, opts) => {
    putCalls++;
    const body = JSON.parse(opts.body);
    if (putCalls === 1) {
      assert.equal(body.fingerprint, 'fp-initial');
      return {
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          error: 'conflict',
          message: 'Conflict',
          issue: {
            ...issue,
            fingerprint: 'fp-remote-after-edit',
            canvas: { notes: [{ id: 'note-1', text: 'REMOTE_NOTE', x: 10, y: 20 }] },
          },
        }),
      };
    }
    const finalItem = {
      ...issue,
      fingerprint: 'fp-final',
      title: 'Issue 1',
      state: 'open',
      statusLabel: 'status:todo',
      updatedAt: '2026-11-06T00:00:00Z',
      phase: 'build',
      attention: 'none',
      canvas: { notes: body.notes },
      editableSections: [],
      openQuestions: [],
      humanTasks: [],
      acceptanceCriteria: [],
      subtasks: [],
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        issue: finalItem,
        listItem: finalItem,
        statusOptions: [{ value: 'status:todo', label: 'Todo' }],
      }),
    };
  };

  const ev = { stopPropagation() {}, preventDefault() {} };
  const noteEl1 = app.createStickyNoteElement(note, issue);
  noteEl1.querySelector('.btn-edit').listeners.click(ev);
  const textarea1 = noteEl1.querySelector('.canvas-note-textarea');
  textarea1.value = 'LOCAL_DRAFT';
  textarea1.listeners.input();

  const saveBtn1 = noteEl1.querySelector('.canvas-note-editor-actions button.button.primary');
  saveBtn1.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(putCalls, 1);

  // Simulate board refresh updating issue.fingerprint and note.text to REMOTE_NOTE
  const refreshedNote = { id: 'note-1', text: 'REMOTE_NOTE', x: 10, y: 20 };
  const refreshedIssue = {
    ...issue,
    fingerprint: 'fp-remote-after-edit',
    canvas: { notes: [refreshedNote] },
  };
  app.state.board = { repo: 'owner/repo', issues: [refreshedIssue] };
  const noteEl2 = app.createStickyNoteElement(refreshedNote, refreshedIssue);

  const textarea2 = noteEl2.querySelector('.canvas-note-textarea');
  assert.equal(textarea2.value, 'LOCAL_DRAFT', 'Local draft must survive refresh');
  const retryBtn = noteEl2.querySelector('.canvas-note-editor-actions button.button.primary');
  assert.ok(retryBtn.classList.contains('is-retry'), 'Retry button must remain visible after refresh');

  // Clicking ordinary Retry must NOT send a PUT overwriting REMOTE_NOTE
  retryBtn.listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(putCalls, 1, 'Ordinary Retry after refresh must not overwrite remote note');

  // Explicit Overwrite sends the PUT with the remote fingerprint
  const conflictBanner = noteEl2.querySelector('.canvas-note-conflict-banner');
  assert.equal(conflictBanner.hidden, false);
  conflictBanner.querySelector('.conflict-overwrite').listeners.click(ev);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(putCalls, 2, 'Explicit Overwrite must send the reconciled PUT');
});

test('audit A5 combined-mode openIssue: resolves repository argument for section cards and cross-repo dependencies', async () => {
  const { app, context } = browser();
  app.state.selected = 'all';
  app.state.repositories = {
    repositories: [
      { owner: 'owner', name: 'repo-a', full: 'owner/repo-a' },
      { owner: 'owner', name: 'repo-b', full: 'owner/repo-b' },
    ],
  };
  const requestedUrls = [];
  context.fetch = async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        issue: {
          number: 7,
          repository: { owner: 'owner', name: 'repo-b', full: 'owner/repo-b' },
          fingerprint: 'fp-7',
          title: 'Cross-repo issue',
          state: 'open',
          statusLabel: 'status:todo',
          updatedAt: '2026-11-06T00:00:00Z',
          phase: 'build',
          attention: 'none',
          editableSections: [],
          openQuestions: [],
          humanTasks: [],
          acceptanceCriteria: [],
          subtasks: [],
        },
        statusOptions: [{ value: 'status:todo', label: 'Todo' }],
      }),
    };
  };

  await app.openIssue(7, 'owner/repo-b');
  assert.equal(requestedUrls.length, 1);
  assert.match(requestedUrls[0], /\/api\/repos\/owner\/repo-b\/issues\/7$/);
});

test('audit A4 note poll/refresh: blur on detached note element does not trigger premature save', async () => {
  const { app, context } = browser();
  const repository = { full: 'owner/repo', owner: 'owner', name: 'repo' };
  const note = { id: 'note-poll', text: 'Original note', x: 10, y: 20 };
  const issue = {
    number: 1, repository, fingerprint: 'fp-1', state: 'open',
    title: 'Issue 1', statusLabel: 'status:todo',
    canvas: { notes: [note] },
  };
  app.state.board = { repo: 'owner/repo', issues: [issue] };

  let putCalls = 0;
  context.fetch = async () => {
    putCalls++;
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
  };

  const ev = { stopPropagation() {}, preventDefault() {} };
  const noteEl = app.createStickyNoteElement(note, issue);
  // Attach then detach to simulate renderCanvasNotes() replacing notesLayer contents
  const parent = { removeChild() {} };
  noteEl.parentNode = parent;
  noteEl.querySelector('.btn-edit').listeners.click(ev);
  const textarea = noteEl.querySelector('.canvas-note-textarea');
  textarea.value = 'In-progress draft during poll';
  textarea.listeners.input();

  // Detach before blur timeout fires
  noteEl.parentNode = null;
  if (textarea.listeners.blur) textarea.listeners.blur(ev);
  await new Promise(r => setTimeout(r, 160));

  assert.equal(putCalls, 0, 'Detached note element blur must not auto-save during refresh/poll');
});
