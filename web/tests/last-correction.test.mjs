import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildIssueDetail } from '../server/board.ts';
import { makeIssue } from './fake-github.mjs';

const source = readFileSync('web/public/app.js', 'utf8').replace(
  '  boot();',
  '  window.__app = { state, renderDetail, saveOverview, saveAnswer, saveStatus };',
);
const detail = () => buildIssueDetail(makeIssue({
  number: 1,
  body: '## Overview\nOriginal\n\n## Open Questions\n- [x] Done? *(Answer: yes)*\n- [ ] Current?\n\n## Human Tasks\n- [ ] Keep\n',
  labels: ['status:todo', 'phase:execution', 'attention:needs-decision'],
}));
const options = [{ value: 'status:todo', label: 'Todo' }, { value: 'status:in-review', label: 'In review' }];
const issueField = (key, value) => (payload) => { payload.issue[key] = value; };
const missing = (key) => (payload) => { delete payload.issue[key]; };
const invalidDetails = [
  ['null option', (p) => { p.statusOptions = [null]; }],
  ['partial option', (p) => { p.statusOptions = [{}]; }],
  ['non-string option value', (p) => { p.statusOptions[0].value = {}; }],
  ['non-string option label', (p) => { p.statusOptions[0].label = null; }],
  ['missing top-level options despite nested fallback', (p) => { p.issue.statusOptions = p.statusOptions; delete p.statusOptions; }],
  ['null section', issueField('editableSections', [null])],
  ['partial section', issueField('editableSections', [{}])],
  ...['id', 'title', 'text'].flatMap((key) => [
    [`missing section ${key}`, (p) => { delete p.issue.editableSections[0][key]; }],
    [`non-string section ${key}`, (p) => { p.issue.editableSections[0][key] = {}; }],
  ]),
  ['null question', issueField('openQuestions', [null])],
  ['scalar question', issueField('openQuestions', [42])],
  ['partial question', issueField('openQuestions', [{}])],
  ...['index', 'answerIndex', 'text', 'completed'].map((key) => [
    `missing question ${key}`, (p) => { delete p.issue.openQuestions[1][key]; },
  ]),
  ['non-string question text', (p) => { p.issue.openQuestions[1].text = {}; }],
  ['non-boolean question completed', (p) => { p.issue.openQuestions[1].completed = 'false'; }],
  ['fractional answer index', (p) => { p.issue.openQuestions[1].answerIndex = 0.5; }],
  ['negative answer index', (p) => { p.issue.openQuestions[1].answerIndex = -1; }],
  ['string answer index', (p) => { p.issue.openQuestions[1].answerIndex = '0'; }],
  ['misrouted answer index', (p) => { p.issue.openQuestions[1].answerIndex = 1; }],
  ['completed answer index', (p) => { p.issue.openQuestions[0].answerIndex = 0; }],
  ['unresolved null index', (p) => { p.issue.openQuestions[1].answerIndex = null; }],
  ['wrong source index', (p) => { p.issue.openQuestions[1].index = 0; }],
  ...['humanTasks', 'acceptanceCriteria', 'subtasks'].flatMap((key) => [
    [`null ${key} entry`, issueField(key, [null])],
    [`partial ${key} entry`, issueField(key, [{}])],
    [`non-string ${key} text`, issueField(key, [{ text: {}, completed: false }])],
    [`non-boolean ${key} completed`, issueField(key, [{ text: '', completed: 'false' }])],
  ]),
  ['wrong identity', issueField('number', 2)],
  ['missing fingerprint', missing('fingerprint')],
  ['empty fingerprint', issueField('fingerprint', '')],
  ['missing title', missing('title')],
  ['non-string title', issueField('title', {})],
  ['missing state', missing('state')],
  ['invalid state', issueField('state', 'gateway')],
  ...['statusLabel', 'updatedAt', 'phase', 'attention'].flatMap((key) => [
    [`missing ${key}`, missing(key)],
    [`wrong ${key}`, issueField(key, {})],
  ]),
];

function browser(payload) {
  const elements = new Map();
  function node(tag = 'div') {
    let text = '';
    return {
      tagName: tag, children: [], value: '', hidden: false, disabled: false,
      get textContent() { return text; },
      set textContent(value) { text = value; this.children = []; },
      setAttribute(key, value) { this[key] = value; if (key === 'id') elements.set(value, this); },
      removeAttribute(key) { delete this[key]; },
      appendChild(child) { this.children.push(child); },
      addEventListener() {}, focus() {},
    };
  }
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  };
  const calls = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: node },
    window: { setTimeout: (fn) => fn(), setInterval() {}, addEventListener() {}, location: { hash: '' } },
    fetch: async (path, request) => {
      calls.push({ path, request });
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    },
  });
  vm.runInContext(source, context);
  const app = context.window.__app;
  app.state.detail = detail();
  app.state.statusOptions = structuredClone(options);
  app.renderDetail(false);
  get('overview-text').value = 'Typed overview draft';
  get('answer-0').value = 'Typed answer draft';
  get('status-select').value = 'status:in-review';
  return { app, get, calls };
}

for (const kind of ['section', 'question', 'status']) {
  for (const [name, damage] of invalidDetails) {
    test(`R1 ${kind}: ${name} is UNKNOWN before assignment and preserves both drafts`, async () => {
      const payload = { issue: detail(), statusOptions: structuredClone(options) };
      damage(payload);
      const { app, get, calls } = browser(payload);
      const before = app.state.detail;
      const statusBefore = app.state.statusOptions;
      const questionNodes = get('question-list').children;
      const humanNodes = get('human-list').children;
      if (kind === 'section') await app.saveOverview();
      else if (kind === 'question') await app.saveAnswer(0, get('answer-0'));
      else await app.saveStatus();
      assert.equal(app.state.detail, before, 'last valid detail retained');
      assert.equal(app.state.statusOptions, statusBefore, 'last valid options retained');
      assert.equal(get('overview-text').value, 'Typed overview draft');
      assert.equal(get('answer-0').value, 'Typed answer draft');
      assert.equal(get('question-list').children, questionNodes, 'question DOM untouched');
      assert.equal(get('human-list').children, humanNodes, 'human task DOM untouched');
      const feedback = get(kind === 'section' ? 'save-status' : 'notice').textContent;
      assert.match(feedback, /outcome unknown/i);
      assert.match(feedback, /refresh/i);
      assert.equal(calls.length, 1, 'one request, no repeat');
    });
  }
  for (const empty of [false, true]) {
    test(`R1 ${kind}: valid ${empty ? 'null/empty' : 'populated'} detail succeeds`, async () => {
      const issue = detail();
      if (empty) Object.assign(issue, {
        title: '', statusLabel: null, updatedAt: null, phase: '', attention: '',
        editableSections: [], openQuestions: [], humanTasks: [], acceptanceCriteria: [], subtasks: [],
      });
      const payload = { issue, statusOptions: empty ? [] : options };
      const { app, get, calls } = browser(payload);
      if (kind === 'section') await app.saveOverview();
      else if (kind === 'question') await app.saveAnswer(0, get('answer-0'));
      else await app.saveStatus();
      assert.equal(app.state.detail.fingerprint, issue.fingerprint);
      assert.equal(app.state.detail.title, issue.title);
      assert.equal(get('announcer').textContent, kind === 'section' ? 'Overview saved.' : kind === 'question' ? 'Answer saved.' : 'Status updated.');
      assert.equal(calls.length, 1);
    });
  }
}
