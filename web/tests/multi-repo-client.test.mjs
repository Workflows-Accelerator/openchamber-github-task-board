import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildIssueDetail, buildBoardList } from '../server/board.ts';
import { makeIssue } from './fake-github.mjs';

const repository = (name, id) => ({ owner: 'owner', name, full: 'owner/' + name, id, archived: false, hasIssues: true });
const alpha = repository('alpha', 101), beta = repository('beta', 102);
const raw = (title = 'Same number') => makeIssue({ number: 1, title, body: '## Overview\nOriginal\n\n## Open Questions\n- [ ] Decide?\n', labels: ['status:todo'] });
const detail = repo => buildIssueDetail(raw(), repo);
const options = [{ value: 'status:todo', label: 'Todo' }, { value: 'status:done', label: 'Done' }];
function browser(handler) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
  function node() {
    let text = '';
    return { children: [], value: '', hidden: false, disabled: false,
      get textContent() { return text; }, set textContent(v) { text = v; this.children = []; },
      setAttribute(k, v) { this[k] = v; if (k === 'id') elements.set(v, this); }, removeAttribute(k) { delete this[k]; },
      appendChild(c) { this.children.push(c); }, addEventListener() {}, focus() {}, querySelector() { return get('empty-p'); },
    };
  }
  const calls = [];
  const context = vm.createContext({ document: { getElementById: get, createElement: node },
    window: { setTimeout: f => f(), setInterval() {}, addEventListener() {}, location: { hash: '' } },
    fetch: async (path, request) => { calls.push({ path, request }); const payload = await handler(path, request);
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) }; },
  });
  const source = readFileSync('web/public/app.js', 'utf8').replace('  boot();',
    '  window.__app = { state, renderDetail, renderBoard, openIssue, saveOverview, saveAnswer, saveStatus, rememberDraft, loadBoard };');
  vm.runInContext(source, context);
  const app = context.window.__app;
  app.state.detail = detail(alpha); app.state.statusOptions = options; app.renderDetail(false);
  get('overview-text').value = 'Alpha draft'; get('answer-0').value = 'Alpha answer'; get('status-select').value = 'status:done';
  return { app, get, calls };
}
for (const kind of ['section', 'question', 'status']) test(`qualified ${kind}: same-number wrong-repository response is UNKNOWN and retains draft`, async () => {
  const { app, get, calls } = browser(() => ({ issue: detail(beta), statusOptions: options }));
  const before = app.state.detail;
  if (kind === 'section') await app.saveOverview();
  else if (kind === 'question') await app.saveAnswer(0, get('answer-0'));
  else await app.saveStatus();
  assert.equal(app.state.detail, before);
  assert.equal(get('overview-text').value, 'Alpha draft');
  assert.equal(get('answer-0').value, 'Alpha answer');
  assert.match(get(kind === 'section' ? 'save-status' : 'notice').textContent, /outcome unknown/i);
  assert.match(calls[0].path, /^\/api\/repos\/owner\/alpha\/issues\/1\//);
  assert.equal(calls.length, 1);
});

test('qualified overview drafts survive navigation without crossing same-number repositories', async () => {
  const { app, get } = browser(path => ({ issue: detail(path.includes('/beta/') ? beta : alpha), statusOptions: options }));
  await app.openIssue({ number: 1, repository: beta, key: 'owner/beta#1' });
  assert.equal(get('overview-text').value, 'Original');
  get('overview-text').value = 'Beta draft';
  await app.openIssue({ number: 1, repository: alpha, key: 'owner/alpha#1' });
  assert.equal(get('overview-text').value, 'Alpha draft');
  assert.equal(get('answer-0').value, 'Alpha answer');
  await app.openIssue({ number: 1, repository: beta, key: 'owner/beta#1' });
  assert.equal(get('overview-text').value, 'Beta draft');
});

test('observed revision change never rebinds an old answer; original question draft is recoverable', async () => {
  const changed = buildIssueDetail({ ...raw(), body: '## Overview\nChanged\n\n## Open Questions\n- [ ] Replacement?\n' }, alpha);
  const { app, get } = browser(() => ({ issue: changed, statusOptions: options }));
  await app.openIssue({ number: 1, repository: alpha, key: 'owner/alpha#1' });
  assert.equal(get('answer-0').value, '');
  assert.match(get('recoverable-drafts').textContent, /Decide\?/);
  assert.match(get('recoverable-drafts').textContent, /Alpha answer/);
});

test('same-number combined row update replaces only the written repository', async () => {
  const updated = buildIssueDetail({ ...raw('Alpha updated') }, alpha);
  const { app } = browser(() => ({ issue: updated, statusOptions: options }));
  app.state.board = { repo: 'All repositories', issues: [...buildBoardList([raw('Alpha')], alpha).issues, ...buildBoardList([raw('Beta')], beta).issues] };
  await app.saveOverview();
  assert.equal(app.state.board.issues[0].title, 'Alpha updated');
  assert.equal(app.state.board.issues[1].title, 'Beta');
});

test('older detail read cannot replace a newer confirmed mutation', async () => {
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const updated = buildIssueDetail({ ...raw('Confirmed new') }, alpha);
  const { app } = browser((path, request) => request.method === 'GET' ? deferred : { issue: updated, statusOptions: options });
  const reading = app.openIssue({ number: 1, repository: alpha, key: 'owner/alpha#1' });
  await app.saveOverview();
  release({ issue: detail(alpha), statusOptions: options }); await reading;
  assert.equal(app.state.detail.title, 'Confirmed new');
});

test('a detail refresh started during a write cannot clear the later UNKNOWN outcome', async () => {
  let releaseRead, rejectWrite;
  const read = new Promise(resolve => { releaseRead = resolve; });
  const write = new Promise((resolve, reject) => { rejectWrite = reject; });
  const { app, get, calls } = browser((path, request) => request.method === 'GET' ? read : write);
  const saving = app.saveOverview();
  const reading = app.openIssue({ number: 1, repository: alpha, key: 'owner/alpha#1' });
  rejectWrite(new Error('connection lost')); await saving;
  releaseRead({ issue: detail(alpha), statusOptions: options }); await reading;
  await app.saveOverview();
  assert.equal(calls.length, 2, 'no repeat after UNKNOWN without a newer explicit refresh');
});
