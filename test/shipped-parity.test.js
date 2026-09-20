import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as Core from '../panel/core.ts';

// The panel ships panel/main.js (a classic script, self-contained: it cannot
// import core.ts at runtime because the host renders the panel in an opaque-
// origin sandboxed iframe). So the pure logic exists twice: in core.ts (what
// the tests and main.ts use) and inlined in main.js (what actually ships).
// This suite executes the *shipped* function bodies and asserts they behave
// identically to core.ts, so drift between them fails the build.

const here = path.dirname(fileURLToPath(import.meta.url));
const MAIN_JS = fs.readFileSync(path.join(here, '..', 'panel', 'main.js'), 'utf8');

function scanDecl(src, start) {
  let i = start, depth = 0, paren = 0, inS = null, inT = false, inLC = false, inBC = false, inRe = false;
  let started = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inLC) { if (c === '\n') inLC = false; i++; continue; }
    if (inBC) { if (c === '*' && n === '/') { inBC = false; i += 2; continue; } i++; continue; }
    if (inT) { if (c === '\\') { i += 2; continue; } if (c === '`') inT = false; i++; continue; }
    if (inS) { if (c === '\\') { i += 2; continue; } if (c === inS) inS = null; i++; continue; }
    if (inRe) { if (c === '\\') { i += 2; continue; } if (c === '[') { let j = i + 1; while (j < src.length && src[j] !== ']') { if (src[j] === '\\') j++; j++; } i = j + 1; continue; } if (c === '/') { inRe = false; i++; continue; } i++; continue; }
    if (c === '/' && n === '/') { inLC = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBC = true; i += 2; continue; }
    if (c === '`') { inT = true; i++; continue; }
    if (c === '"' || c === "'") { inS = c; i++; continue; }
    if (c === '/') { let p = i - 1; while (p >= 0 && /\s/.test(src[p])) p--; if ('=(,:![&|?{;'.includes(src[p])) { inRe = true; i++; continue; } i++; continue; }
    if (c === '(') { paren++; i++; continue; }
    if (c === ')') { paren--; i++; continue; }
    if (paren > 0) { i++; continue; }
    if (c === '{') { depth++; started = true; i++; continue; }
    if (c === '}') { depth--; i++; if (started && depth === 0) return src.slice(start, i); continue; }
    if (c === ';' && depth === 0 && !started) return src.slice(start, i + 1);
    i++;
  }
  throw new Error('unterminated declaration at ' + start);
}

const JS_FUNCS = [
  'parseOpenQuestions', 'parseSubtasks', 'updateSubtaskInMarkdown', 'updateOpenQuestionInMarkdown',
  'appendSubtaskToMarkdown', 'appendOpenQuestionToMarkdown', 'serializeDraftQuestions',
  'isVagueIdea', 'formatQuestionBadge', 'getIssueTheme', 'extractTaskThemes', 'parseScratchPadThemes',
  'resolveAiIssuePrompt', 'resolveAiAlignmentPrompt', 'buildIssueAttachPayload',
  'buildMultiIssueAttachPayload', 'buildConsolidatedIssuePrompt', 'serializeDraftSubtasks',
];
const JS_CONSTS = ['checklistRegex', 'questionsSectionRegex', 'headingRegex', 'DEFAULT_AI_ISSUE_PROMPT', 'DEFAULT_AI_ALIGNMENT_PROMPT'];

function extract(marker) {
  const idx = MAIN_JS.indexOf(marker);
  if (idx < 0) throw new Error('marker missing from shipped main.js: ' + marker);
  return scanDecl(MAIN_JS, idx);
}

const shippedSrc = [
  ...JS_CONSTS.map((n) => extract('var ' + n + ' =')),
  ...JS_FUNCS.map((n) => extract('function ' + n + '(')),
].join('\n');

const Shipped = new Function(shippedSrc + '\nreturn { ' + [...JS_FUNCS, ...JS_CONSTS].join(', ') + ' };')();

test('shipped main.js is readable: every core-owned declaration is present', () => {
  assert.equal(JS_FUNCS.length + JS_CONSTS.length, 23);
  for (const n of JS_FUNCS) assert.equal(typeof Shipped[n], 'function', n + ' missing from bundle');
});

test('parseSubtasks / parseOpenQuestions: shipped == core', () => {
  const bodies = [
    '### Actionable Subtasks Checklist:\n- [ ] A\n- [x] B',
    '### Open Questions\n- [ ] Q1?\n- [x] Q2?\n## Next\n- [ ] C',
    '# Questions about auth\n- [ ] D',
    '## Question\n- [ ] E',
    'no checklist at all',
    '',
  ];
  for (const b of bodies) {
    assert.deepEqual(Shipped.parseSubtasks(b), Core.parseSubtasks(b), 'subtasks: ' + JSON.stringify(b));
    assert.deepEqual(Shipped.parseOpenQuestions(b), Core.parseOpenQuestions(b), 'questions: ' + JSON.stringify(b));
  }
});

test('markdown mutators: shipped == core', () => {
  const body = '### Open Questions\n- [ ] Q1?\n- [ ] Q2?\n### Tasks\n- [ ] T1';
  for (const [li, done] of [[0, true], [1, true], [3, true], [9, true]]) {
    assert.equal(Shipped.updateSubtaskInMarkdown(body, li, done), Core.updateSubtaskInMarkdown(body, li, done));
    assert.equal(Shipped.updateOpenQuestionInMarkdown(body, li, done), Core.updateOpenQuestionInMarkdown(body, li, done));
  }
  for (const t of ['', '  ', 'New task', 'Q?']) {
    assert.equal(Shipped.appendSubtaskToMarkdown(body, t), Core.appendSubtaskToMarkdown(body, t));
    assert.equal(Shipped.appendOpenQuestionToMarkdown(body, t), Core.appendOpenQuestionToMarkdown(body, t));
  }
  assert.equal(Shipped.appendOpenQuestionToMarkdown('', 'first?'), Core.appendOpenQuestionToMarkdown('', 'first?'));
  assert.equal(Shipped.serializeDraftQuestions('body', ['a', 'b']), Core.serializeDraftQuestions('body', ['a', 'b']));
  assert.equal(Shipped.serializeDraftQuestions('', []), Core.serializeDraftQuestions('', []));
  assert.equal(Shipped.serializeDraftSubtasks('body', ['x']), Core.serializeDraftSubtasks('body', ['x']));
});

test('isVagueIdea and formatQuestionBadge: shipped == core', () => {
  const cases = [
    { body: '', subtasks: [] },
    { body: 'short', subtasks: [], openQuestions: [] },
    { body: 'long '.repeat(30), subtasks: [], openQuestions: [] },
    { body: 'long '.repeat(30), subtasks: [{ text: 'x' }], openQuestions: [{ text: 'q', completed: false }] },
    { body: 'long '.repeat(30), subtasks: [{ text: 'x' }], openQuestions: [{ text: 'q', completed: true }] },
    { labels: [{ name: 'status:needs-alignment' }] },
    null,
  ];
  for (const c of cases) {
    assert.equal(Shipped.isVagueIdea(c), Core.isVagueIdea(c), 'isVagueIdea: ' + JSON.stringify(c));
  }
  for (const q of [[], [{ completed: false }], [{ completed: true }], [{ completed: false }, { completed: true }, { completed: true }]]) {
    assert.deepEqual(Shipped.formatQuestionBadge(q), Core.formatQuestionBadge(q));
  }
});

test('theme helpers: shipped == core', () => {
  const issues = [
    { labels: [{ name: 'theme:auth' }] },
    { labels: [{ name: 'theme:auth' }] },
    { labels: [{ name: 'frontend' }] },
    { labels: [{ name: 'priority:high' }] },
    { labels: [] },
  ];
  for (const i of issues) assert.equal(Shipped.getIssueTheme(i), Core.getIssueTheme(i));
  assert.deepEqual(Shipped.extractTaskThemes(issues), Core.extractTaskThemes(issues));
  const pad = '## [Theme: A]\n- [ ] one\n- ? q?\n\n## [Theme: B]\n- [ ] two';
  assert.deepEqual(Shipped.parseScratchPadThemes(pad), Core.parseScratchPadThemes(pad));
  assert.deepEqual(Shipped.parseScratchPadThemes('raw idea\nis x supported?'), Core.parseScratchPadThemes('raw idea\nis x supported?'));
});

test('prompt builders: shipped == core', () => {
  assert.equal(Shipped.DEFAULT_AI_ISSUE_PROMPT, Core.DEFAULT_AI_ISSUE_PROMPT);
  assert.equal(Shipped.DEFAULT_AI_ALIGNMENT_PROMPT, Core.DEFAULT_AI_ALIGNMENT_PROMPT);
  assert.equal(
    Shipped.resolveAiIssuePrompt({ repo: 'o/r', userInput: 'x' }),
    Core.resolveAiIssuePrompt({ repo: 'o/r', userInput: 'x' }),
  );
  assert.equal(
    Shipped.resolveAiAlignmentPrompt({ repo: 'o/r', userInput: 'x' }),
    Core.resolveAiAlignmentPrompt({ repo: 'o/r', userInput: 'x' }),
  );
});

test('attach payloads: shipped == core', () => {
  const one = { number: 8, title: 'T', body: 'B', html_url: 'u', user: { login: 'octocat' } };
  assert.deepEqual(Shipped.buildIssueAttachPayload(one), Core.buildIssueAttachPayload(one));
  const many = [
    { number: 1, title: 'A', body: 'a', html_url: 'u1', labels: [{ name: 'x' }] },
    { number: 2, title: 'B', body: 'b', html_url: 'u2', subtasks: [{ text: 's', completed: true }] },
  ];
  assert.deepEqual(Shipped.buildMultiIssueAttachPayload(many, 'o/r'), Core.buildMultiIssueAttachPayload(many, 'o/r'));
  assert.deepEqual(Shipped.buildMultiIssueAttachPayload([], 'o/r'), Core.buildMultiIssueAttachPayload([], 'o/r'));
  assert.deepEqual(Shipped.buildMultiIssueAttachPayload([one], 'o/r'), Core.buildMultiIssueAttachPayload([one], 'o/r'));
  assert.deepEqual(Shipped.buildConsolidatedIssuePrompt(many), Core.buildConsolidatedIssuePrompt(many));
});
