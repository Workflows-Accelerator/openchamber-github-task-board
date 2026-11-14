// Wave 7c — one count, visible progress, legible questions.
//
// Closes the 2026-11-13 usability audit findings #2–#16 and the carried P2
// notes from wave7b-canvas-L4 and discovery-legibility-L4b. The assertions are
// behavioural: they render a surface and read what a person would see.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { setOrderMarker, stripOrderMarker } from '../server/board.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(HERE, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'web/public');
const readPublic = (name) => fs.readFileSync(path.join(PUBLIC_DIR, name), 'utf8');

const REPO = 'owner/alpha';

function selectorMatches(node, selector) {
  if (selector.startsWith('.')) return String(node.className).split(/\s+/).includes(selector.slice(1));
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  const attribute = /^\[([^=]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (attribute) {
    const value = node.getAttribute(attribute[1]);
    return attribute[2] === undefined ? value !== null : value === attribute[2];
  }
  return false;
}

function browser() {
  const elements = new Map();
  function node(tag = 'div') {
    let ownText = '';
    const attributes = {};
    const classes = new Set();
    const listeners = {};
    const created = {
      tagName: String(tag).toUpperCase(),
      children: [],
      parentNode: null,
      id: '',
      className: '',
      value: '',
      hidden: false,
      disabled: false,
      checked: false,
      style: {},
      clientWidth: 0,
      clientHeight: 0,
      offsetWidth: 280,
      offsetHeight: 150,
      offsetLeft: 0,
      offsetTop: 0,
      scrollHeight: 0,
      get textContent() {
        return ownText + this.children.map((child) => child.textContent).join('');
      },
      set textContent(value) {
        ownText = String(value);
        this.children = [];
      },
      setAttribute(key, value) {
        attributes[key] = String(value);
        if (key === 'id') {
          this.id = String(value);
          elements.set(this.id, this);
        }
        if (key === 'class') this.className = String(value);
      },
      getAttribute(key) {
        return Object.prototype.hasOwnProperty.call(attributes, key) ? attributes[key] : null;
      },
      removeAttribute(key) { delete attributes[key]; },
      appendChild(child) {
        if (!child) return child;
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      insertBefore(child) { return this.appendChild(child); },
      append() {},
      addEventListener(event, callback) { listeners[event] = callback; },
      removeEventListener() {},
      focus() {},
      remove() {},
      closest() { return null; },
      getClientRects() { return []; },
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
        toggle() {},
      },
      querySelector(selector) {
        for (const child of this.children) {
          if (selectorMatches(child, selector)) return child;
          const nested = child.querySelector(selector);
          if (nested) return nested;
        }
        return null;
      },
      querySelectorAll(selector) {
        const found = [];
        const walk = (current) => {
          for (const child of current.children) {
            if (selectorMatches(child, selector)) found.push(child);
            walk(child);
          }
        };
        walk(this);
        return found;
      },
    };
    return created;
  }

  const get = (id) => {
    if (!elements.has(id)) {
      const created = node();
      created.id = id;
      elements.set(id, created);
    }
    return elements.get(id);
  };

  // A real store: setLanguage writes `tb_lang` and getLanguage reads it back,
  // so a language switch in the test reaches the code under test.
  const storage = new Map();
  const context = vm.createContext({
    console,
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => { storage.set(key, String(value)); },
      removeItem: (key) => { storage.delete(key); },
    },
    navigator: { onLine: true, serviceWorker: null },
    document: {
      getElementById: get,
      createElement: (tag) => node(tag),
      createElementNS: (_ns, tag) => node(tag),
      querySelector: () => null,
      querySelectorAll: () => [],
      documentElement: { setAttribute() {}, removeAttribute() {}, lang: '', classList: { add() {}, remove() {}, contains() { return false; } } },
      body: { classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} } },
      addEventListener() {},
    },
    window: {
      innerWidth: 1280,
      setTimeout: (fn) => { fn(); return 0; },
      clearTimeout() {},
      setInterval() {},
      clearInterval() {},
      addEventListener() {},
      removeEventListener() {},
      location: { hash: '' },
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      scrollTo() {},
    },
    fetch: async () => ({ ok: true, status: 200, text: async () => '{}' }),
  });
  // The canvas layout lives in a module; strip the export keyword and expose
  // the function where the client looks for it.
  vm.runInContext(readPublic('flow-layout.js').replace('export function arrangeFlowGraph', 'function arrangeFlowGraph'), context);
  context.window.arrangeFlowGraph = vm.runInContext('arrangeFlowGraph', context);
  vm.runInContext(readPublic('app.js').replace('  boot();', ''), context);
  const app = context.window.__taskBoard;
  app.__elements = elements;
  return app;
}

function allText(node) {
  if (!node) return '';
  return node.textContent;
}

const issue = (number, overrides = {}) => Object.assign({
  number,
  key: `${REPO}#${number}`,
  title: `Task ${number}`,
  state: 'open',
  statusLabel: 'status:todo',
  labels: ['status:todo'],
  attention: 'none',
  repository: { full: REPO, owner: 'owner', name: 'alpha' },
  createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-02T09:00:00Z',
  counts: {},
}, overrides);

// ==========================================
// 1. One count for "what needs me"
// ==========================================

test('W7c counts: needsHumanAttention is the single predicate and needsMe delegates', () => {
  const app = browser();
  assert.equal(app.needsHumanAttention(issue(1, { statusLabel: 'status:needs-human' })), true, 'needs-human waits for you');
  assert.equal(app.needsHumanAttention(issue(2, { counts: { openQuestions: { total: 1, open: 1 } } })), true, 'an open question waits for you');
  assert.equal(app.needsHumanAttention(issue(3, { counts: { humanTasks: { total: 2, open: 1 } } })), true, 'an open human task waits for you');
  assert.equal(app.needsHumanAttention(issue(4, { statusLabel: 'status:done' })), false, 'done never waits');
  assert.equal(app.needsHumanAttention(issue(5, { state: 'closed' })), false, 'closed never waits');
  assert.equal(app.needsHumanAttention(issue(6, { counts: { openQuestions: { total: 2, open: 0 } } })), false, 'an answered question does not wait');
  assert.equal(app.needsMe(issue(1, { statusLabel: 'status:needs-human' })), true, 'needsMe is the same answer');
  app.state.clientPresentationMode = true;
  assert.equal(app.needsHumanAttention(issue(7, { statusLabel: 'status:draft', labels: ['status:draft'] })), false, 'a draft is hidden in presentation mode');
});

test('W7c counts: sidebar badges count cards, not questions, and dedupe blocked', () => {
  const app = browser();
  app.state.board = { issues: [
    issue(1, { statusLabel: 'status:needs-human', counts: { openQuestions: { total: 2, open: 2 } } }),
    issue(2, { counts: { openQuestions: { total: 1, open: 1 } } }),
    issue(3, { statusLabel: 'status:needs-human', counts: { humanTasks: { total: 1, open: 1 } }, blockedBy: [{ number: 99, state: 'open' }] }),
    issue(4, { blockedBy: [{ number: 99, state: 'open' }] }),
  ] };
  app.updateSidebarBadges();
  const el = (id) => app.__elements.get(id);
  assert.equal(el('decisions-nav-badge').textContent, '2', 'two issues carry open questions');
  assert.equal(el('decisions-count-badge').textContent, '2', 'the Decisions page badge counts the same two cards');
  assert.equal(el('blocked-nav-badge').textContent, '3', 'three unique issues are blocked');
  assert.equal(el('list-nav-badge').textContent, '3', 'three issues need attention');
});

test('W7c counts: a canvas group counts "needs me" with the same rule as the sidebar', () => {
  const app = browser();
  const issues = [
    issue(1, { counts: { openQuestions: { total: 1, open: 1 } } }),
    issue(2, { statusLabel: 'status:needs-human' }),
    issue(3, { counts: { humanTasks: { total: 1, open: 1 } } }),
    issue(4, { statusLabel: 'status:done' }),
  ];
  app.state.board = { issues };
  app.state.canvasHasSavedState = true;
  app.state.canvasExpandedGroups = new Set();
  app.renderCanvasIssues(issues);
  app.updateSidebarBadges();

  const expected = issues.filter((it) => app.needsHumanAttention(it)).length;
  assert.equal(expected, 3, 'an open question, a needs-human stage and an open human task all need you');
  assert.equal(app.__elements.get('list-nav-badge').textContent, String(expected), 'the sidebar states the canonical count');
  // The group header is a summary surface: it must use the same predicate, not
  // the narrower "stage is needs-human" rule the layout module can see.
  const group = app.__elements.get('canvas-cards').querySelectorAll('.canvas-group-card')[0];
  const needsMeCount = group.querySelectorAll('.canvas-group-count')
    .find((el) => String(el.className).split(/\s+/).includes('is-needs-me'));
  assert.ok(needsMeCount, 'the group header carries a needs-me count');
  assert.equal(
    needsMeCount.textContent.replace(/\s+/g, ' ').trim(),
    `${expected} needs me`,
    'a collapsed group counts the same tasks as the sidebar',
  );
});

test('W7c counts: the Decisions page lists one card per issue and names its question count', () => {
  const app = browser();
  app.state.board = { issues: [
    issue(1, { counts: { openQuestions: { total: 2, open: 2 } }, openQuestions: [{ text: 'A', completed: false }, { text: 'B', completed: false }] }),
    issue(2, { counts: { openQuestions: { total: 1, open: 1 } }, openQuestions: [{ text: 'C', completed: false }] }),
  ] };
  app.renderDecisionsView();
  const list = app.__elements.get('decisions-list');
  assert.equal(list.querySelectorAll('.section-card').length, 2, 'one card per issue, not per question');
  assert.equal(app.__elements.get('decisions-count-badge').textContent, '2');
  assert.match(allText(list), /2 questions/, 'the first card still says how many questions it carries');
});

test('W7c counts: the Blocked page renders a task once and keeps its dependency chips', () => {
  const app = browser();
  app.state.board = { issues: [
    issue(1, { statusLabel: 'status:needs-human', counts: { humanTasks: { total: 1, open: 1 } }, blockedBy: [{ number: 99, state: 'open' }] }),
    issue(2, { blockedBy: [{ number: 99, state: 'open' }] }),
  ] };
  app.renderBlockedView();
  const list = app.__elements.get('blocked-list');
  assert.equal(list.querySelectorAll('.section-card').length, 2, 'issue #1 appears once, not in both groups');
  assert.equal(app.__elements.get('blocked-count-badge').textContent, '2');
  assert.match(allText(list), /#99/, 'the human card still shows what blocks it');
});

test('W7c counts: "Blocked" names three different scopes with three labels', () => {
  const app = browser();
  assert.equal(app.filterLabel('blocked'), 'Blocked by dependencies', 'the filter is dependency-only');
  const html = readPublic('index.html');
  const js = readPublic('app.js');
  assert.match(html, /data-i18n="nav_blocked"/);
  assert.match(js, /nav_blocked: 'Blocked & waiting'/, 'the view includes human waits');
  assert.match(js, /blocked_group_dependencies: 'Waiting on other tasks'/);
  assert.match(js, /nav_blocked: 'Bloquées et en attente'/, 'French is distinct too');
});

// ==========================================
// 2. Progress as a ratio everywhere
// ==========================================

test('W7c progress: progressOf reads server counts and falls back to arrays', () => {
  const app = browser();
  // Values cross the vm boundary, so compare plain host objects.
  const plain = (ratio) => ({ done: ratio.done, total: ratio.total, open: ratio.open });
  const counted = app.progressOf(issue(1, { counts: { subtasks: { total: 5, done: 2 }, openQuestions: { total: 3, open: 1 }, humanTasks: { total: 2, open: 1 } } }));
  assert.deepEqual(plain(counted.checklist), { done: 2, total: 5, open: 3 });
  assert.deepEqual(plain(counted.questions), { done: 2, total: 3, open: 1 });
  assert.deepEqual(plain(counted.human), { done: 1, total: 2, open: 1 });

  const arrays = app.progressOf(issue(2, {
    subtasks: [{ completed: true }, { completed: false }],
    openQuestions: [{ completed: false }],
    humanTasks: [{ completed: true }, { completed: true }],
  }));
  assert.deepEqual(plain(arrays.checklist), { done: 1, total: 2, open: 1 });
  assert.deepEqual(plain(arrays.questions), { done: 0, total: 1, open: 1 });
  assert.deepEqual(plain(arrays.human), { done: 2, total: 2, open: 0 });
  assert.deepEqual(plain(app.ratioOf({ total: 4, done: 9 }, [])), { done: 4, total: 4, open: 0 }, 'done is clamped to total');
});

test('W7c progress: a list row states done/total for checklists and questions', () => {
  const app = browser();
  const row = app.simpleTaskRow(issue(11, { counts: { subtasks: { total: 5, done: 2 }, openQuestions: { total: 3, done: 1, open: 2 } } }));
  const text = allText(row);
  assert.match(text, /2\/5/, 'checklist ratio is visible');
  assert.match(text, /1\/3/, 'question ratio is visible');
});

test('W7c progress: a canvas card shows answered/total and never dresses answered work as pending', () => {
  const app = browser();
  const answered = app.createIssueCanvasCard(issue(12, { counts: { openQuestions: { total: 2, done: 2, open: 0 } } }), { x: 0, y: 0 });
  const answeredBadges = answered.querySelectorAll('.canvas-card-questions');
  assert.equal(answeredBadges.length, 1);
  assert.equal(answeredBadges[0].textContent, '2/2', 'answered/total, not "2 q"');
  assert.equal(answeredBadges[0].getAttribute('data-pending'), '0');
  assert.doesNotMatch(allText(answered), /\bq\b/, 'no "1 q" shorthand');

  const pending = app.createIssueCanvasCard(issue(13, { counts: { openQuestions: { total: 3, done: 1, open: 2 } } }), { x: 0, y: 0 });
  const pendingBadge = pending.querySelectorAll('.canvas-card-questions')[0];
  assert.equal(pendingBadge.textContent, '1/3');
  assert.equal(pendingBadge.getAttribute('data-pending'), '2');
});

test('W7c progress: a collapsed group aggregates the ratios of the cards it hides', () => {
  const app = browser();
  const issues = [
    issue(20, { parentKey: `${REPO}#100`, counts: { subtasks: { total: 2, done: 1 }, openQuestions: { total: 1, done: 0, open: 1 } } }),
    issue(21, { parentKey: `${REPO}#100`, counts: { subtasks: { total: 3, done: 2 }, openQuestions: { total: 2, done: 1, open: 1 } } }),
  ];
  const groupProgress = app.groupProgressOf(`${REPO}::${REPO}#100`, issues);
  assert.deepEqual(
    {
      checklist: { done: groupProgress.checklist.done, total: groupProgress.checklist.total },
      questions: { done: groupProgress.questions.done, total: groupProgress.questions.total },
    },
    {
      checklist: { done: 3, total: 5 },
      questions: { done: 1, total: 3 },
    },
  );
  app.state.canvasHasSavedState = true;
  app.state.canvasExpandedGroups = new Set();
  app.renderCanvasIssues(issues);
  const counts = allText(app.__elements.get('canvas-cards').querySelectorAll('.canvas-group-card')[0]);
  assert.match(counts, /3\/5/, 'the collapsed group shows checklist progress');
  assert.match(counts, /1\/3/, 'the collapsed group shows question progress');
});

test('W7c progress: the drawer states checklist progress beside each heading', () => {
  const app = browser();
  app.state.detail = issue(30, {
    acceptanceCriteria: [{ text: 'A', completed: true }, { text: 'B', completed: false }],
    subtasks: [{ text: 'C', completed: true }, { text: 'D', completed: true }, { text: 'E', completed: false }],
    editableSections: [{ title: '(overview)', text: 'Body' }],
  });
  app.state.board = { repo: 'owner/alpha', issues: [app.state.detail] };
  app.renderDetail(false);
  const ac = app.__elements.get('ac-progress');
  const subtasks = app.__elements.get('subtasks-progress');
  assert.equal(ac.hidden, false);
  assert.equal(ac.textContent, '1/2');
  assert.equal(subtasks.textContent, '2/3');
});

// ==========================================
// 3. Question legibility
// ==========================================

test('W7c questions: missing and malformed are two distinct titles with two helps', () => {
  const app = browser();
  const render = (review) => {
    app.state.detail = issue(40, { statusLabel: 'status:needs-human', humanReview: review });
    app.state.board = { repo: REPO, issues: [app.state.detail] };
    app.renderDetail(false);
    return {
      title: app.__elements.get('human-review-title').textContent,
      body: allText(app.__elements.get('human-review-body')),
    };
  };
  const missing = render({ state: 'missing', kind: null, url: null, instruction: null, question: null, reason: 'no_section', message: '' });
  const malformed = render({ state: 'malformed', kind: 'link', url: 'javascript:alert(1)', instruction: null, question: null, reason: 'invalid_url', message: '' });
  assert.equal(missing.title, 'Waiting for an artifact');
  assert.equal(malformed.title, 'The review item is broken');
  assert.notEqual(missing.title, malformed.title, 'the two failures never share a label');
  assert.match(missing.body, /carries nothing you can click/);
  assert.match(malformed.body, /cannot use it/);
});

test('W7c questions: every reason is plain prose with no Markdown schema syntax', () => {
  const app = browser();
  const dict = app.I18N.en;
  const reasons = Object.keys(dict).filter((key) => key.startsWith('human_review_reason_'));
  assert.ok(reasons.length >= 12, 'all reason keys are present');
  for (const key of reasons) {
    const text = dict[key];
    assert.doesNotMatch(text, /###|- URL:|- Artifact:|- Instruction:/, `${key} leaks schema syntax: ${text}`);
  }
  const fr = app.I18N.fr;
  for (const key of reasons) {
    assert.ok(typeof fr[key] === 'string' && fr[key].length > 0, `French is missing ${key}`);
    assert.doesNotMatch(fr[key], /###|- URL:|- Artifact:|- Instruction:/, `${key} leaks schema syntax in French`);
  }
  assert.match(dict.human_review_reason_invalid_url, /2048/);
  assert.match(dict.human_review_reason_invalid_url, /no spaces/);
  assert.match(dict.human_review_reason_missing_options, /preset answer/);
  assert.match(dict.human_review_reason_insecure_url, /https:\/\//);
  assert.match(fr.human_review_reason_invalid_url, /2048/);
  assert.match(fr.human_review_reason_invalid_url, /sans espaces/);
  assert.match(fr.human_review_reason_missing_options, /réponse proposée/);
});

test('W7c questions: drawer badges localize phase and attention and drop duplicates', () => {
  const app = browser();
  app.state.detail = issue(41, { statusLabel: 'status:needs-human', phase: 'execution', attention: 'needs-decision', humanReview: { state: 'ready', kind: 'link', url: 'https://example.com/x', instruction: 'Look.', question: null, reason: null } });
  app.state.board = { repo: REPO, issues: [app.state.detail] };
  app.renderDetail(false);
  const meta = allText(app.__elements.get('detail-meta'));
  assert.match(meta, /execution phase/, 'phase is a sentence, not "phase: execution"');
  assert.doesNotMatch(meta, /phase:/, 'no schema colon');
  assert.match(meta, /Needs a decision/);
  assert.doesNotMatch(meta, /needs-decision/);
  assert.doesNotMatch(meta, /Waiting for you/, 'the gate heading already states the status');
  assert.doesNotMatch(meta, /Agent reviewing/);

  app.setLanguage('fr');
  app.state.detail = issue(42, { statusLabel: 'status:needs-human', phase: 'execution', attention: 'needs-decision' });
  app.state.board = { repo: REPO, issues: [app.state.detail] };
  app.renderDetail(false);
  const frMeta = allText(app.__elements.get('detail-meta'));
  // Corrected expectation: this line used to assert "Phase : execution", which
  // locked the English value into the French drawer (audit #10).
  assert.match(frMeta, /Phase : exécution/);
  assert.match(frMeta, /Décision attendue/);
  assert.doesNotMatch(frMeta, /needs decision/);
});

test('W7c questions: a French drawer carries no English workflow vocabulary', () => {
  // Audit #10 lists "phase: execution" among the untranslated strings. Localising
  // the word "Phase :" while keeping the English value only moves the mix.
  const app = browser();
  const phases = {
    draft: 'Phase : brouillon',
    exploration: 'Phase : exploration',
    alignment: 'Phase : alignement',
    planning: 'Phase : planification',
    execution: 'Phase : exécution',
    verification: 'Phase : vérification',
    human_verification: 'Phase : vérification humaine',
    publication: 'Phase : publication',
    done: 'Phase : terminé',
    archive: 'Phase : archivé',
  };
  app.setLanguage('fr');
  Object.keys(phases).forEach((phase) => {
    app.state.detail = issue(60, { statusLabel: 'status:in-progress', phase });
    app.state.board = { repo: REPO, issues: [app.state.detail] };
    app.renderDetail(false);
    const meta = allText(app.__elements.get('detail-meta'));
    assert.ok(meta.includes(phases[phase]), `French must translate the phase "${phase}", saw: ${meta}`);
  });
  // The attention vocabulary had the same gap: only "needs decision" was
  // translated, so "Attention : review" stayed half English.
  [['needs-decision', 'Décision attendue'], ['needs-review', 'Revue attendue'], ['needs-permission', 'Autorisation attendue']].forEach(([value, label]) => {
    app.state.detail = issue(61, { statusLabel: 'status:todo', attention: value });
    app.state.board = { repo: REPO, issues: [app.state.detail] };
    app.renderDetail(false);
    const meta = allText(app.__elements.get('detail-meta'));
    assert.ok(meta.includes(label), `French must translate "${value}", saw: ${meta}`);
    assert.doesNotMatch(meta, /needs review|needs permission|needs decision/i, `no English attention vocabulary: ${meta}`);
  });
});

test('W7c questions: the Answer action stays pinned inside the scrolling drawer', () => {
  // A source assertion, and deliberately labelled as one: the real proof is the
  // 390x844 browser measurement (Answer at 760-804 with Details and the free-text
  // field open). This guards the rule that measurement depends on.
  const css = readPublic('theme.css');
  const rule = /\.human-review \.question-actions\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the question actions must carry their own rule');
  assert.match(rule[1], /position:\s*sticky/, 'the primary action is pinned, not pushed below the fold');
  assert.match(rule[1], /bottom:\s*0/, 'it pins to the bottom edge of the drawer scrollport');
  assert.match(rule[1], /background:/, 'it carries a backing so it never sits on top of readable text');
});

test('W7c questions: the human count has one label in both languages', () => {
  const app = browser();
  assert.equal(app.humanCountLabel(1), '1 human action');
  assert.equal(app.humanCountLabel(3), '3 human actions');
  assert.equal(app.questionCountLabel(1), '1 question');
  app.setLanguage('fr');
  assert.equal(app.humanCountLabel(1), '1 action humaine');
  assert.equal(app.humanCountLabel(3), '3 actions humaines');
});

test('W7c questions: the Reviewable link filter finds a ready review artifact', () => {
  const app = browser();
  assert.equal(app.matchesExtraFilter(issue(50, { humanReview: { state: 'ready', kind: 'image', url: 'https://example.com/a.png', instruction: '', question: null, reason: null } }), 'artifact'), true);
  assert.equal(app.matchesExtraFilter(issue(51, { humanReview: { state: 'ready', kind: 'video', url: 'https://example.com/a.mp4', instruction: '', question: null, reason: null } }), 'artifact'), true);
  assert.equal(app.matchesExtraFilter(issue(52, { humanReview: { state: 'ready', kind: 'link', url: 'https://example.com/x', instruction: '', question: null, reason: null } }), 'artifact'), true);
  assert.equal(app.matchesExtraFilter(issue(53, { humanReview: { state: 'malformed', kind: 'link', url: 'javascript:alert(1)', instruction: null, question: null, reason: 'invalid_url' } }), 'artifact'), false, 'a broken link is not reviewable');
});

// ==========================================
// 4. Carried P2 notes
// ==========================================

test('W7c P2: an older layout PATCH response cannot overwrite a newer one', () => {
  const app = browser();
  app.applyServerLayout({ direction: 'LR', expandedGroups: [], positions: {} });
  const newer = { direction: 'TD', expandedGroups: ['g'], positions: { a: { x: 1, y: 2 } } };
  const older = { direction: 'LR', expandedGroups: [], positions: {} };
  assert.equal(app.applyLayoutPatch(2, newer), true);
  assert.equal(app.applyLayoutPatch(1, older), false, 'the stale answer is ignored');
  assert.equal(app.state.canvasDirectionMode, 'TD');
  assert.deepEqual(Array.from(app.state.canvasExpandedGroups), ['g']);
  assert.equal(app.applyLayoutPatch(3, older), true, 'a genuinely newer answer still applies');
});

test('W7c P2: setOrderMarker does not grow a body that ends in one newline', () => {
  const body = '## Overview\nKeep\n';
  const marked = setOrderMarker(body, 1000);
  assert.equal(stripOrderMarker(marked), body, 'set then strip is byte-identical');
  assert.equal(stripOrderMarker(setOrderMarker(stripOrderMarker(marked), 2000)), body, 'a second save stays stable');
  // A body ending in a blank line keeps its separator.
  const spaced = 'Keep this hard break  \r\n\r\n';
  assert.equal(setOrderMarker(spaced, 1000), spaced + '<!-- board-order: 1000 -->');
  assert.equal(stripOrderMarker(setOrderMarker(spaced, 1000)), spaced);
});

test('W7c P2: the no-JS fallback, shell assets and settings note are in place', () => {
  const html = readPublic('index.html');
  const css = readPublic('theme.css');
  const sw = readPublic('sw.js');
  const app = readPublic('app.js');
  assert.match(html, /<html[^>]*class="no-js"/);
  assert.match(html, /<script src="\/js-enabled\.js"><\/script>/);
  assert.match(css, /html\.no-js #login-view\s*\{[^}]*display:\s*block/);
  assert.match(css, /html\.no-js #board-view\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(html, /<noscript>\s*<style/);
  assert.ok(sw.includes("'/js-enabled.js'"));
  assert.ok(sw.includes("'/flow-layout.js'"));
  assert.match(app, /Parent grouping reads the first 100 issues of each project/);
  assert.match(app, /Le regroupement par parent lit les 100 premières tâches/);
  assert.doesNotMatch(app, /canvasProjectBands/, 'the dead column-era branch is gone');
});

// ==========================================
// 5. Invariants
// ==========================================

test('W7c P2: the compact dock keeps a short label that fits a 390 phone', () => {
  // Measured in Chromium at 390x844: "Blocked & waiting" plus its badge was
  // 111 px wide in a 94 px dock cell, so the label spilled into the Decisions
  // tab ("Décisions0Bloquées et en attent"). The dock gets its own short label,
  // and the cell refuses to spill even if a future label grows.
  const app = browser();
  assert.ok(app.I18N.en.nav_blocked_short.length <= 12, `EN dock label too long: ${app.I18N.en.nav_blocked_short}`);
  assert.ok(app.I18N.fr.nav_blocked_short.length <= 12, `FR dock label too long: ${app.I18N.fr.nav_blocked_short}`);

  const html = readPublic('index.html');
  const dock = /<nav id="compact-nav-dock"[\s\S]*?<\/nav>/.exec(html);
  assert.ok(dock, 'the compact dock exists');
  assert.match(dock[0], /data-i18n="nav_blocked_short"/, 'the dock binds the short label');
  assert.doesNotMatch(dock[0], /data-i18n="nav_blocked"/, 'the long view title stays out of the dock');

  const css = readPublic('theme.css');
  const rule = /#compact-nav-dock button \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the dock button carries its own rule');
  assert.match(rule[1], /overflow:\s*hidden/, 'a long label clips instead of spilling into the next tab');
  assert.match(rule[1], /min-width:\s*0/, 'a grid cell may shrink its content');
});

test('W7c invariants: EN and FR dictionaries keep exact key parity', () => {
  const app = browser();
  const en = new Set(Object.keys(app.I18N.en));
  const fr = new Set(Object.keys(app.I18N.fr));
  assert.deepEqual([...en].filter((key) => !fr.has(key)), [], 'French is missing keys');
  assert.deepEqual([...fr].filter((key) => !en.has(key)), [], 'English is missing keys');
  for (const key of ['human_review_malformed', 'human_review_malformed_help', 'progress_checklist_title', 'progress_questions_title', 'needs_me', 'canvas_group_checklist', 'canvas_group_questions']) {
    assert.ok(en.has(key), `missing ${key}`);
  }
});

test('W7c invariants: strict CSP, no inline styles, no forbidden tokens or emoji', () => {
  const files = ['app.js', 'index.html', 'theme.css'];
  for (const name of files) {
    const content = readPublic(name);
    assert.doesNotMatch(content, /\sstyle="/, `inline style attribute in ${name}`);
    assert.doesNotMatch(content, /\bn8n\b/i, `forbidden token "n8n" in ${name}`);
    assert.doesNotMatch(content, /\bmobile\b/i, `forbidden token "mobile" in ${name}`);
    assert.doesNotMatch(content, /\p{Extended_Pictographic}/u, `emoji in ${name}`);
  }
  const html = readPublic('index.html');
  assert.match(html, /<script type="module" src="\/flow-layout\.js"><\/script>/);
  assert.match(html, /<script src="\/app\.js" defer><\/script>/);
});
