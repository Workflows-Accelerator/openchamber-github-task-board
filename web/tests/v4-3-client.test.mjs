import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The shipped client runs in a minimal DOM, exactly as it ships. These tests
// prove what a reader actually sees for each waiting state, not a re-render.
function browser(storage = {}) {
  const nodes = new Map(), store = new Map(Object.entries(storage));
  function node(tag = 'div') {
    const attrs = {};
    let textValue = '';
    return { tagName: String(tag).toUpperCase(), value: '', children: [], hidden: false, disabled: false, checked: false,
      className: '', style: {}, attrs, listeners: {},
      get textContent() { return textValue; },
      set textContent(v) { textValue = String(v); if (textValue === '') this.children = []; },
      setAttribute(key, value) { attrs[key] = String(value); this[key] = value; },
      removeAttribute(key) { delete attrs[key]; delete this[key]; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(event, callback) { this.listeners[event] = callback; },
      focus() { context.document.activeElement = this; },
      querySelector() { return node(); },
      querySelectorAll() { return []; } };
  }
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const localStorage = { getItem: (key) => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) };
  const context = {
    document: { activeElement: null, getElementById: get, createElement: node, querySelector() { return null; }, querySelectorAll() { return []; } },
    window: { setTimeout: (fn) => fn(), addEventListener() {}, location: { hash: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    localStorage,
    navigator: { onLine: true },
    fetch: async () => ({ ok: true, status: 200, text: async () => '{}', headers: { get: () => null } }),
  };
  vm.runInNewContext(fs.readFileSync('web/public/app.js', 'utf8').replace('  boot();', ''), context);
  return { app: context.window.__taskBoard, context, get, store };
}

function all(node, predicate, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (predicate(node)) found.push(node);
  (node.children || []).forEach((child) => all(child, predicate, found));
  return found;
}
function textOf(node) {
  if (!node || typeof node !== 'object') return '';
  return String(node.textContent || '') + (node.children || []).map(textOf).join(' ');
}
const links = (node) => all(node, (child) => child.tagName === 'A');
const buttons = (node) => all(node, (child) => child.tagName === 'BUTTON');
const byClass = (node, className) => all(node, (child) => String(child.className || '').split(/\s+/).includes(className));

function detail(number, overrides = {}) {
  const repoFull = 'owner/alpha';
  const [owner, name] = repoFull.split('/');
  return Object.assign({
    number,
    key: repoFull + '#' + number,
    repository: { owner, name, full: repoFull, id: 101, archived: false, hasIssues: true, available: true },
    title: 'Task ' + number,
    friendlyTitle: null,
    state: 'open',
    htmlUrl: 'https://github.com/' + repoFull + '/issues/' + number,
    body: '## Overview\nOriginal\n',
    description: '## Overview\nOriginal',
    order: 1000,
    fingerprint: 'fp-' + number,
    labels: ['status:needs-human'],
    statusLabel: 'status:needs-human',
    phase: 'execution',
    attention: 'needs-decision',
    column: 'needs-human',
    updatedAt: '2026-11-01T00:00:00Z',
    createdAt: '2026-11-01T00:00:00Z',
    editableSections: [{ id: 'overview', title: 'Overview', text: 'Original' }],
    openQuestions: [],
    humanTasks: [],
    acceptanceCriteria: [],
    subtasks: [],
    humanReview: {
      state: 'ready', kind: 'image', url: 'https://example.com/screenshots/login-empty.png',
      instruction: 'Compare the empty state with the approved mockup.',
      question: null, reason: null, message: 'This task waits for one click you can settle.',
    },
  }, overrides);
}

function render(app, issue) {
  app.state.detail = issue;
  app.state.statusOptions = [{ value: 'status:needs-human', label: 'Waiting for you' }];
  app.state.board = { repo: 'owner/alpha', issues: [issue] };
  app.renderDetail(false);
}

test('V4-3 client: a ready image artifact renders inline with exactly one primary action', () => {
  const { app, get } = browser();
  render(app, detail(1));
  const panel = get('human-review-body');
  assert.equal(get('human-review').hidden, false);
  assert.equal(get('human-review-title').textContent, 'Waiting for you');
  const images = all(panel, (child) => child.tagName === 'IMG');
  assert.equal(images.length, 1);
  assert.equal(images[0].attrs.src, 'https://example.com/screenshots/login-empty.png');
  assert.ok(images[0].attrs.alt.length > 0, 'the artifact must carry alt text');
  assert.match(textOf(panel), /Compare the empty state with the approved mockup\./);
  const actions = links(panel).filter((link) => String(link.className).includes('human-review-action'));
  assert.equal(actions.length, 1, 'exactly one primary action');
  assert.equal(actions[0].textContent, 'Open screenshot');
  assert.equal(actions[0].attrs.href, 'https://example.com/screenshots/login-empty.png');
  assert.equal(actions[0].attrs.rel, 'noopener noreferrer');
  assert.equal(buttons(panel).length, 0, 'an image gate asks for one click, not a form');
});

test('V4-3 client: video and link gates carry their own single action and instruction', () => {
  const { app, get } = browser();
  render(app, detail(2, { humanReview: { state: 'ready', kind: 'video', url: 'https://example.com/clips/flow.mp4', instruction: 'Watch the first ten seconds.', question: null, reason: null, message: '' } }));
  let actions = links(get('human-review-body')).filter((link) => String(link.className).includes('human-review-action'));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].textContent, 'Watch the video');
  assert.match(textOf(get('human-review-body')), /Watch the first ten seconds\./);
  assert.equal(all(get('human-review-body'), (child) => child.tagName === 'VIDEO').length, 0, 'no inline media element: the action opens the clip');

  render(app, detail(3, { humanReview: { state: 'ready', kind: 'link', url: 'https://example.com/preview/login', instruction: 'Open the preview and confirm the label.', question: null, reason: null, message: '' } }));
  actions = links(get('human-review-body')).filter((link) => String(link.className).includes('human-review-action'));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].textContent, 'Open the link');
});

test('V4-3 client: legacy waiting without an artifact names the defect and offers nothing to click', () => {
  const { app, get } = browser();
  render(app, detail(4, { humanReview: { state: 'missing', kind: null, url: null, instruction: null, question: null, reason: 'no_section', message: 'The body has no "### Human Review:" section.' } }));
  const panel = get('human-review-body');
  assert.equal(get('human-review-title').textContent, 'Waiting for an artifact');
  assert.match(textOf(panel), /carries nothing you can click/);
  assert.match(textOf(panel), /no "### Human Review:" section/, 'the precise reason is shown, not a generic wait');
  assert.equal(links(panel).length, 0);
  assert.equal(buttons(panel).length, 0);
});

test('V4-3 client: a malformed artifact is reported with its precise reason', () => {
  const { app, get } = browser();
  render(app, detail(5, { humanReview: { state: 'malformed', kind: 'link', url: 'javascript:alert(1)', instruction: null, question: null, reason: 'invalid_url', message: 'bad' } }));
  assert.equal(get('human-review-title').textContent, 'Waiting for an artifact');
  assert.match(textOf(get('human-review-body')), /must start with http:\/\/ or https:\/\//);
  assert.equal(links(get('human-review-body')).length, 0);
});

test('V4-3 client: in-review reads as agent review and asks nothing', () => {
  const { app, get } = browser();
  render(app, detail(6, { statusLabel: 'status:in-review', labels: ['status:in-review'], humanReview: { state: 'ready', kind: 'link', url: 'https://example.com/x', instruction: 'Look.', question: null, reason: null, message: '' } }));
  const panel = get('human-review-body');
  assert.equal(get('human-review').hidden, false);
  assert.equal(get('human-review-title').textContent, 'Agent reviewing');
  assert.match(textOf(panel), /Nothing is asked of you\./);
  assert.equal(links(panel).length, 0, 'the agent review gate carries no action');
});

test('V4-3 client: the gated question uses the V4-2 renderer once and is skipped by the questions list', () => {
  const { app, get } = browser();
  const question = { index: 0, answerIndex: 0, text: 'Which spacing should the list use?', options: [
    { label: 'Compact', gist: 'Dense rows', details: '' },
    { label: 'Comfortable', gist: 'Roomier rows', details: '' },
  ] };
  render(app, detail(7, {
    humanReview: { state: 'ready', kind: 'question', url: null, instruction: null, question, reason: null, message: '' },
    openQuestions: [{ index: 0, answerIndex: 0, completed: false, text: question.text, options: question.options }],
  }));
  const panel = get('human-review-body');
  assert.equal(get('human-review-title').textContent, 'Waiting for you');
  const answerInputs = all(panel, (child) => child.attrs && child.attrs.id === 'answer-0');
  assert.equal(answerInputs.length, 1, 'one answer form, with the V4-2 id');
  const submit = buttons(panel).filter((button) => String(button.className).includes('primary'));
  assert.equal(submit.length, 1, 'exactly one primary action for a question');
  assert.equal(submit[0].textContent, 'Answer');
  assert.equal(all(panel, (child) => String(child.className || '').includes('question-option-card')).length, 2, 'presets use the shared option cards');
  assert.equal(all(panel, (child) => String(child.className || '').includes('question-other-answer')).length, 1, 'free-text fallback is kept');
  assert.equal(get('question-list').children.length, 0, 'the gated question is not rendered twice');
  assert.equal(get('no-questions').hidden, true);
});

test('V4-3 client: French labels are exact for the gate, its actions and its reasons', () => {
  const { app, get } = browser();
  app.setLanguage('fr');
  render(app, detail(8));
  assert.equal(get('human-review-title').textContent, 'En attente de vous');
  const actions = links(get('human-review-body')).filter((link) => String(link.className).includes('human-review-action'));
  assert.equal(actions[0].textContent, 'Ouvrir la capture');

  render(app, detail(9, { humanReview: { state: 'missing', kind: null, url: null, instruction: null, question: null, reason: 'missing_url', message: '' } }));
  assert.equal(get('human-review-title').textContent, 'En attente d’un élément à valider');
  assert.match(textOf(get('human-review-body')), /pas de ligne « - URL: »/);
});

test('V4-3 client: the compact list row summarizes the gate without nesting an action in its button', () => {
  const { app } = browser();
  const ready = app.simpleTaskRow(detail(10));
  assert.match(textOf(ready), /Screenshot/);
  assert.equal(all(ready, (child) => child.tagName === 'A').length, 0, 'a row button cannot nest a link');
  const legacy = app.simpleTaskRow(detail(11, { humanReview: { state: 'missing', kind: null, url: null, instruction: null, question: null, reason: 'no_section', message: '' } }));
  assert.match(textOf(legacy), /Waiting for an artifact/);
  const badges = byClass(legacy, 'human-review-badge');
  assert.equal(badges.length, 1);
  assert.match(String(badges[0].attrs.title || ''), /no "### Human Review:" section/);
});

test('V4-3 client: the canvas card carries the instruction and the defect, never a second action', () => {
  const { app } = browser();
  const ready = app.createIssueCanvasCard(detail(12), { x: 40, y: 40 });
  assert.match(textOf(ready), /Screenshot/);
  assert.match(textOf(ready), /Compare the empty state with the approved mockup\./);
  assert.equal(all(ready, (child) => child.tagName === 'A').length, 0);
  const legacy = app.createIssueCanvasCard(detail(13, { humanReview: { state: 'missing', kind: null, url: null, instruction: null, question: null, reason: 'no_section', message: '' } }), { x: 40, y: 40 });
  assert.match(textOf(legacy), /Waiting for an artifact/);
  const inReview = app.createIssueCanvasCard(detail(14, { statusLabel: 'status:in-review', labels: ['status:in-review'] }), { x: 40, y: 40 });
  assert.match(textOf(inReview), /Agent reviewing/);
});

test('V4-3 client: an attention-driven waiting stage without the status label is not shown as an artifact defect', () => {
  const { app, get } = browser();
  // The server enforces the gate on the canonical label only; a task that merely
  // looks waiting (attention or session state) must not be accused of a missing
  // artifact it was never required to carry.
  render(app, detail(16, { statusLabel: 'status:todo', labels: ['status:todo', 'attention:needs-decision'], effectiveStage: 'needs-human', humanReview: { state: 'missing', kind: null, url: null, instruction: null, question: null, reason: 'no_section', message: '' } }));
  assert.equal(get('human-review').hidden, true);
  const row = app.simpleTaskRow(detail(17, { statusLabel: 'status:todo', labels: ['status:todo'], effectiveStage: 'needs-human', humanReview: { state: 'missing', kind: null, url: null, instruction: null, question: null, reason: 'no_section', message: '' } }));
  assert.equal(byClass(row, 'human-review-badge').length, 0);
});

test('V4-3 client: presentation mode shows the gated question read-only instead of an answer form', () => {  const { app, get } = browser();
  app.state.clientPresentationMode = true;
  const question = { index: 0, answerIndex: 0, text: 'Which spacing should the list use?', options: [{ label: 'Compact', gist: 'Dense', details: '' }] };
  render(app, detail(15, {
    humanReview: { state: 'ready', kind: 'question', url: null, instruction: null, question, reason: null, message: '' },
    openQuestions: [{ index: 0, answerIndex: 0, completed: false, text: question.text, options: question.options }],
  }));
  const panel = get('human-review-body');
  assert.equal(get('human-review-title').textContent, 'Waiting for you');
  assert.equal(all(panel, (child) => child.attrs && child.attrs.id === 'answer-0').length, 0, 'no write form in a read-only view');
  assert.match(textOf(panel), /Compact/);
  assert.match(textOf(panel), /Read-only view/);
  app.state.clientPresentationMode = false;
});

test('V4-3 client: English and French dictionaries stay key-for-key equal', () => {
  const source = fs.readFileSync('web/public/app.js', 'utf8');
  const start = source.indexOf('  var I18N = {');
  const enStart = source.indexOf('    en: {', start);
  const frStart = source.indexOf('    fr: {', start);
  const end = source.indexOf('\n  };', frStart);
  assert.ok(start >= 0 && enStart > start && frStart > enStart && end > frStart, 'I18N must keep its en/fr blocks');
  const keys = (text) => new Set([...text.matchAll(/^\s{6}([a-z0-9_]+):/gm)].map((match) => match[1]));
  const en = keys(source.slice(enStart, frStart));
  const fr = keys(source.slice(frStart, end));
  assert.deepEqual([...en].filter((key) => !fr.has(key)), [], 'French is missing keys');
  assert.deepEqual([...fr].filter((key) => !en.has(key)), [], 'English is missing keys');
  for (const key of ['human_review_title', 'human_review_open_image', 'human_review_watch_video', 'human_review_open_link', 'human_review_answer', 'human_review_missing', 'human_review_reason_missing_question']) {
    assert.ok(en.has(key), 'missing human review key ' + key);
  }
});

test('V4-3 client: a settled question is not presented as a waiting artifact', () => {
  const { app, get } = browser();
  const settled = {
    state: 'settled', kind: 'question', url: null, instruction: null, question: null,
    reason: 'question_answered', message: 'The open question for this artifact is already answered.',
  };
  const answeredQuestion = { index: 0, answerIndex: null, completed: true, text: 'Which spacing should the list use?' };
  render(app, detail(18, { humanReview: settled, openQuestions: [answeredQuestion] }));
  const panel = get('human-review-body');
  assert.equal(get('human-review-title').textContent, 'Answer received');
  assert.match(textOf(panel), /The agent has to pick this task up again/);
  assert.equal(links(panel).length, 0);
  assert.equal(buttons(panel).length, 0);

  const row = app.simpleTaskRow(detail(19, { humanReview: settled, openQuestions: [answeredQuestion] }));
  assert.match(textOf(row), /Answer received/);
  assert.doesNotMatch(textOf(row), /Waiting for an artifact/);
  assert.equal(byClass(row, 'human-review-badge').length, 1);

  const canvas = app.createIssueCanvasCard(detail(20, { humanReview: settled, openQuestions: [answeredQuestion] }), { x: 40, y: 40 });
  assert.match(textOf(canvas), /Answer received/);
  assert.doesNotMatch(textOf(canvas), /Waiting for an artifact/);
});

test('V4-3 client: a settled question reads honestly in French too', () => {
  const { app, get } = browser();
  app.setLanguage('fr');
  const settled = {
    state: 'settled', kind: 'question', url: null, instruction: null, question: null,
    reason: 'question_answered', message: '',
  };
  render(app, detail(21, { humanReview: settled, openQuestions: [{ index: 0, answerIndex: null, completed: true, text: 'Quel espacement ?' }] }));
  assert.equal(get('human-review-title').textContent, 'Réponse reçue');
  assert.match(textOf(get('human-review-body')), /L’agent doit reprendre cette tâche/);
});

test('V4-3 client: an insecure image URL is reported precisely in English and French', () => {
  const { app, get } = browser();
  const review = {
    state: 'malformed', kind: 'image', url: 'http://example.com/a.png', instruction: null,
    question: null, reason: 'insecure_url', message: 'An image artifact needs an https:// URL.',
  };
  render(app, detail(22, { humanReview: review }));
  assert.equal(get('human-review-title').textContent, 'Waiting for an artifact');
  assert.match(textOf(get('human-review-body')), /https:\/\//);
  assert.equal(links(get('human-review-body')).length, 0);
  app.setLanguage('fr');
  render(app, detail(23, { humanReview: review }));
  assert.match(textOf(get('human-review-body')), /https:\/\//);
});

test('V4-3 client: a question gate without presets names the missing presets in English and French', () => {
  const { app, get } = browser();
  const review = {
    state: 'malformed', kind: 'question', url: null, instruction: null, question: null,
    reason: 'missing_options', message: 'A question artifact needs at least one preset answer line.',
  };
  render(app, detail(25, { humanReview: review }));
  assert.equal(get('human-review-title').textContent, 'Waiting for an artifact');
  assert.match(textOf(get('human-review-body')), /preset answer/);
  assert.equal(links(get('human-review-body')).length, 0);
  app.setLanguage('fr');
  render(app, detail(26, { humanReview: review }));
  assert.match(textOf(get('human-review-body')), /réponse proposée/);
});

test('V4-3 client: a review image that fails to load says so instead of showing a broken artifact', () => {
  const { app, get } = browser();
  render(app, detail(24));
  const panel = get('human-review-body');
  const image = all(panel, (child) => child.tagName === 'IMG')[0];
  assert.ok(image, 'the artifact image is rendered');
  assert.equal(typeof image.listeners.error, 'function', 'the image must observe a load failure');
  image.listeners.error();
  assert.equal(image.hidden, true, 'the broken image is hidden');
  const fallback = byClass(panel, 'human-review-image-error')[0];
  assert.ok(fallback, 'a fallback message is rendered');
  assert.equal(fallback.hidden, false);
  assert.match(textOf(fallback), /could not be loaded/);
  const actions = links(panel).filter((link) => String(link.className).includes('human-review-action'));
  assert.equal(actions.length, 1, 'the link stays available as the way forward');
});
