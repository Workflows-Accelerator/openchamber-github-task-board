import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildIssueDetail } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/server/board.ts';
import { makeIssue } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/tests/fake-github.mjs';
const repo = { owner: 'owner', name: 'alpha', full: 'owner/alpha', id: 101, archived: false, hasIssues: true };
const detail = buildIssueDetail(makeIssue({ number: 1, title: 'Alpha', body: '## Overview\nOriginal\n', labels: ['status:todo'] }), repo);
const options = [{ value: 'status:todo', label: 'Todo' }, { value: 'status:done', label: 'Done' }];
const elements = new Map();
const get = (id) => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
function node() {
  let text = '';
  return { children: [], value: '', hidden: false, disabled: false,
    get textContent() { return text; }, set textContent(v) { text = v; this.children = []; },
    setAttribute(k, v) { this[k] = v; if (k === 'id') elements.set(v, this); }, removeAttribute(k) { delete this[k]; },
    appendChild(c) { this.children.push(c); }, addEventListener() {}, focus() {}, querySelector() { return get('empty-p'); } };
}
const calls = [];
const context = vm.createContext({
  document: { getElementById: get, createElement: node },
  window: { setTimeout: (f) => f(), setInterval() {}, addEventListener() {}, location: { hash: '' }, localStorage: { getItem: () => null, setItem() {} } },
  fetch: async (path, request) => { calls.push({ path, method: request.method });
    return { ok: false, status: 503, text: async () => JSON.stringify({ error: 'discovery_unavailable', message: 'Repository discovery failed; no operation was dispatched' }) };
  },
});
const source = readFileSync('/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/public/app.js', 'utf8')
  .replace('  boot();', '  window.__app = { state, renderDetail, saveStatus };');
vm.runInContext(source, context);
const app = context.window.__app;
app.state.detail = detail; app.state.statusOptions = options; app.renderDetail(false); get('status-select').value = 'status:done';
await app.saveStatus();
console.log(JSON.stringify({ uncertain: Array.from(app.state.uncertain), notice: get('notice').textContent, calls }));
