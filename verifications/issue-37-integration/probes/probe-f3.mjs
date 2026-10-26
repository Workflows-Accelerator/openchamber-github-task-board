import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildIssueDetail } from '/workspace/extensions/github-task-board/web/server/board.ts';
import { makeIssue } from '/workspace/extensions/github-task-board/web/tests/fake-github.mjs';

const repository = (name, id) => ({
  owner: 'owner',
  name,
  full: 'owner/' + name,
  id,
  archived: false,
  hasIssues: true,
  available: true,
});

const alpha = repository('alpha', 101);
const raw = makeIssue({
  number: 1,
  title: 'Alpha: Task 1',
  body: '## Overview\nOriginal\n\n## Open Questions\n- [ ] Decide?\n',
  labels: ['status:todo'],
});
const detail = buildIssueDetail(raw, alpha);
const options = [
  { value: 'status:todo', label: 'Todo' },
  { value: 'status:done', label: 'Done' },
];

function browser(handler) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  function node() {
    let text = '';
    return {
      children: [],
      value: '',
      hidden: false,
      disabled: false,
      get textContent() {
        return text;
      },
      set textContent(v) {
        text = v;
        this.children = [];
      },
      setAttribute(k, v) {
        this[k] = v;
        if (k === 'id') elements.set(v, this);
      },
      removeAttribute(k) {
        delete this[k];
      },
      appendChild(c) {
        this.children.push(c);
      },
      addEventListener() {},
      focus() {},
      querySelector() {
        return get('empty-p');
      },
    };
  }
  const calls = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: node },
    window: {
      setTimeout: (f) => f(),
      setInterval() {},
      addEventListener() {},
      location: { hash: '' },
    },
    fetch: async (path, request) => {
      calls.push({ path, request });
      const payload = await handler(path, request);
      if (payload && payload.__httpStatus !== undefined) {
        return {
          ok: payload.__httpStatus < 400,
          status: payload.__httpStatus,
          text: async () => JSON.stringify(payload.body),
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    },
  });
  const source = readFileSync('/workspace/extensions/github-task-board/web/public/app.js', 'utf8').replace(
    '  boot();',
    '  window.__app = { state, renderDetail, renderBoard, openIssue, saveOverview, saveAnswer, saveStatus, rememberDraft, loadBoard };'
  );
  vm.runInContext(source, context);
  const app = context.window.__app;
  app.state.detail = detail;
  app.state.statusOptions = options;
  app.renderDetail(false);
  get('overview-text').value = 'Alpha draft';
  get('answer-0').value = 'Alpha answer';
  get('status-select').value = 'status:done';
  return { app, get, calls };
}

async function run() {
  console.log('Running F3 probe...');

  // 1. Definite refusal: 503 with error: discovery_unavailable across section, status, answer
  for (const kind of ['section', 'status', 'question']) {
    const { app, get, calls } = browser(() => ({
      __httpStatus: 503,
      body: { error: 'discovery_unavailable', message: 'Discovery failed; nothing was sent. Refresh to try again.' },
    }));

    const beforeDetail = app.state.detail;
    if (kind === 'section') await app.saveOverview();
    else if (kind === 'status') await app.saveStatus();
    else if (kind === 'question') await app.saveAnswer(0, get('answer-0'));

    assert.equal(calls.length, 1, `${kind}: exactly one request dispatched, no retries`);
    assert.equal(app.state.detail, beforeDetail, `${kind}: detail preserved`);
    assert.equal(app.state.uncertain.size, 0, `${kind}: uncertain set is empty`);
    assert.equal(app.state.uncertain.has('owner/alpha#1'), false);

    const message = get(kind === 'section' ? 'save-status' : 'notice').textContent;
    assert.match(message, /nothing was sent/i);
    assert.doesNotMatch(message, /outcome unknown/i);
  }

  // 2. Ambiguous outcomes: verify boundary is strictly preserved (they MUST be marked UNKNOWN)
  const ambiguousCases = [
    { name: '502 write_outcome_unknown', resp: { __httpStatus: 502, body: { error: 'write_outcome_unknown' } } },
    { name: '502 github_unavailable', resp: { __httpStatus: 502, body: { error: 'github_unavailable' } } },
    { name: 'generic 503 without error code', resp: { __httpStatus: 503, body: { error: 'gateway_timeout' } } },
  ];

  for (const { name, resp } of ambiguousCases) {
    const { app, get, calls } = browser(() => resp);
    await app.saveOverview();
    assert.equal(calls.length, 1);
    assert.equal(app.state.uncertain.has('owner/alpha#1'), true, `${name} must mark uncertain`);
    const message = get('save-status').textContent;
    assert.match(message, /outcome unknown/i);
  }

  console.log('F3 probe: PASS');
}

run().catch((err) => {
  console.error('F3 probe: FAIL', err);
  process.exit(1);
});
