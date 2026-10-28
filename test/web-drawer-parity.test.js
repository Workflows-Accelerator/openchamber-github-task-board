import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = fs.readFileSync(path.join(__dirname, '../web/public/app.js'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(__dirname, '../web/public/index.html'), 'utf8');
const THEME_CSS = fs.readFileSync(path.join(__dirname, '../web/public/theme.css'), 'utf8');

function setupTestEnvironment() {
  const elements = new Map();
  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        tagName: 'DIV',
        hidden: false,
        disabled: false,
        value: '',
        textContent: '',
        children: [],
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, v) { if (v !== undefined ? v : !this.classes.has(c)) this.classes.add(c); else this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
        },
        appendChild(child) { this.children.push(child); return child; },
        setAttribute() {},
        removeAttribute() {},
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        focus() {},
      });
    }
    return elements.get(id);
  }

  const documentMock = {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        toggle(c, v) { if (v !== undefined ? v : !this.classes.has(c)) this.classes.add(c); else this.classes.delete(c); },
        contains(c) { return this.classes.has(c); },
      },
      appendChild(child) { if (!this.children) this.children = []; this.children.push(child); return child; },
      setAttribute() {},
      removeAttribute() {},
      addEventListener() {},
    }),
    addEventListener: () => {},
  };

  const ctx = {
    window: null,
    document: documentMock,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0 },
    navigator: { onLine: true },
    fetch: async () => ({ status: 200, ok: true, text: async () => '{}', json: async () => ({}) }),
    setInterval: () => {},
    setTimeout: () => {},
    crypto: { subtle: { digest: async () => new Uint8Array(32).buffer } },
  };
  ctx.window = { ...ctx, location: { hash: '#/' }, addEventListener: () => {} };

  vm.createContext(ctx);
  vm.runInContext(APP_JS, ctx);

  return ctx.window.__taskBoard;
}

test('DOM structure: standalone web board has drawer modal elements and removes align drafts', () => {
  assert.ok(INDEX_HTML.includes('id="drawer-backdrop"'), 'index.html must have #drawer-backdrop');
  assert.ok(INDEX_HTML.includes('class="drawer-backdrop"'), '#drawer-backdrop must have drawer-backdrop class');
  assert.ok(INDEX_HTML.includes('class="view task-drawer"'), '#detail-view must have task-drawer class');
  assert.ok(INDEX_HTML.includes('id="ac-section"'), 'index.html must have #ac-section');
  assert.ok(INDEX_HTML.includes('id="ac-list"'), 'index.html must have #ac-list');
  assert.ok(INDEX_HTML.includes('id="subtasks-section"'), 'index.html must have #subtasks-section');
  assert.ok(INDEX_HTML.includes('id="subtasks-list"'), 'index.html must have #subtasks-list');
  assert.ok(INDEX_HTML.includes('id="mark-done-btn"'), 'index.html must have #mark-done-btn');
  assert.ok(INDEX_HTML.includes('id="detail-subtitle"'), 'index.html must have #detail-subtitle');

  // Standalone web board MUST NOT expose #align-drafts-btn
  assert.ok(!INDEX_HTML.includes('align-drafts-btn'), 'index.html must not include align-drafts-btn');
  assert.ok(!INDEX_HTML.includes('Align Drafts'), 'index.html must not include Align Drafts button');
});

test('Touch targets & CSS: drawer backdrop, touch targets >= 44px, and checklists styled in theme.css', () => {
  assert.ok(THEME_CSS.includes('.drawer-backdrop'), 'theme.css must style .drawer-backdrop');
  assert.ok(THEME_CSS.includes('.task-drawer'), 'theme.css must style .task-drawer');
  assert.ok(THEME_CSS.includes('.checklist-item'), 'theme.css must style .checklist-item');
  assert.ok(THEME_CSS.includes('min-height: 44px'), 'theme.css must provide >= 44px touch targets');
  assert.ok(THEME_CSS.includes('.checklist-checkbox'), 'theme.css must style .checklist-checkbox');
  assert.ok(THEME_CSS.includes('.badge.badge-offline'), 'theme.css must style .badge-offline');
});

test('friendly titles: parseFriendlyTitle extracts title from markdown heading or bold syntax', () => {
  const taskBoard = setupTestEnvironment();

  const markdownHeading = `
## Overview
Some overview prose.

### Friendly Title: Ship mobile drawer
More content.
`;
  const parsed1 = taskBoard.parseFriendlyTitle(markdownHeading, 'Technical issue title');
  assert.equal(parsed1.title, 'Ship mobile drawer');
  assert.equal(parsed1.subtitle, 'Technical issue title');

  const markdownBold = `
**Friendly Title:** Offline Sync Support
`;
  const parsed2 = taskBoard.parseFriendlyTitle(markdownBold, 'Issue 42');
  assert.equal(parsed2.title, 'Offline Sync Support');
  assert.equal(parsed2.subtitle, 'Issue 42');

  const placeholder = `
### Friendly Title: <3-6 words plain English title>
`;
  const parsedPlaceholder = taskBoard.parseFriendlyTitle(placeholder, 'Real Title');
  assert.equal(parsedPlaceholder.title, 'Real Title');
  assert.equal(parsedPlaceholder.subtitle, null);
});

test('friendly titles: resolveFriendlyTitle returns friendly display and technical subtitle', () => {
  const taskBoard = setupTestEnvironment();

  const issueWithFriendly = {
    number: 10,
    title: 'feat(mobile): add drawer parity and offline sync',
    body: '## Overview\n### Friendly Title: Mobile Task Drawer & Offline\nDetails here',
  };
  const resolved = taskBoard.resolveFriendlyTitle(issueWithFriendly);
  assert.equal(resolved.title, 'Mobile Task Drawer & Offline');
  assert.equal(resolved.subtitle, 'feat(mobile): add drawer parity and offline sync');

  const plainIssue = {
    number: 11,
    title: 'Fix typo in README',
    body: 'Just a readme fix',
  };
  const resolvedPlain = taskBoard.resolveFriendlyTitle(plainIssue);
  assert.equal(resolvedPlain.title, 'Fix typo in README');
  assert.equal(resolvedPlain.subtitle, null);
});

test('interactive checklists: updateChecklistInMarkdown toggles checkbox at exact lineIndex', () => {
  const taskBoard = setupTestEnvironment();

  const body = [
    '## Acceptance Criteria',
    '- [ ] Drawer opens on click',
    '- [x] Offline drafts queue locally',
    '',
    '## Actionable Subtasks',
    '- [ ] Generate crisp PWA icons',
  ].join('\n');

  // Toggle first item (lineIndex 1) from [ ] to [x]
  const updated1 = taskBoard.updateChecklistInMarkdown(body, 1, 'Drawer opens on click', true);
  const lines1 = updated1.split('\n');
  assert.equal(lines1[1], '- [x] Drawer opens on click');
  assert.equal(lines1[2], '- [x] Offline drafts queue locally');
  assert.equal(lines1[5], '- [ ] Generate crisp PWA icons');

  // Toggle second item (lineIndex 2) from [x] to [ ]
  const updated2 = taskBoard.updateChecklistInMarkdown(body, 2, 'Offline drafts queue locally', false);
  const lines2 = updated2.split('\n');
  assert.equal(lines2[2], '- [ ] Offline drafts queue locally');

  // CRLF preservation
  const crlfBody = '## Subtasks\r\n- [ ] Task A\r\n- [ ] Task B\r\n';
  const updatedCrlf = taskBoard.updateChecklistInMarkdown(crlfBody, 1, 'Task A', true);
  assert.ok(updatedCrlf.includes('- [x] Task A\r\n'));
});

test('inline questions: parseQuestionOptions parses options in brackets, parens, or choice chips', () => {
  const taskBoard = setupTestEnvironment();

  // Pattern 1: [A] Option A [B] Option B
  const q1 = 'Which storage engine should we use? [A] LocalStorage [B] IndexedDB [C] Cache API';
  const opts1 = [...taskBoard.parseQuestionOptions(q1)];
  assert.deepEqual(opts1, ['LocalStorage', 'IndexedDB', 'Cache API']);

  // Pattern 2: (1) Option 1 (2) Option 2
  const q2 = 'Select target release: (1) Alpha (2) Beta (3) General Availability';
  const opts2 = [...taskBoard.parseQuestionOptions(q2)];
  assert.deepEqual(opts2, ['Alpha', 'Beta', 'General Availability']);

  // Pattern 3: [Yes] / [No]
  const q3 = 'Should we prompt for notification permission on first launch? [Yes] / [No]';
  const opts3 = [...taskBoard.parseQuestionOptions(q3)];
  assert.deepEqual(opts3, ['Yes', 'No']);

  // Free text question has no option chips
  const q4 = 'What is the root cause of the memory leak on reconnect?';
  const opts4 = [...taskBoard.parseQuestionOptions(q4)];
  assert.deepEqual(opts4, []);
});
