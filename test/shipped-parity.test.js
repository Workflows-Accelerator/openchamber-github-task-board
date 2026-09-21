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
  'parseIssueDependencies', 'addDependencyToMarkdown', 'removeDependencyFromMarkdown',
  'extractIssueReferences', 'buildDependencyGraph', 'calculateEdgePath', 'detectCycle',
  'buildSessionIndex',
  'scopeDoneIssues',
  'normalizeGithubIssues',
  'mergeIssuePages',
  'parseFriendlyTitle',
];
const JS_CONSTS = ['checklistRegex', 'questionsSectionRegex', 'headingRegex', 'DEFAULT_AI_ISSUE_PROMPT', 'DEFAULT_AI_ALIGNMENT_PROMPT', 'DEPENDENCY_LINE_REGEX'];

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
  assert.equal(JS_FUNCS.length + JS_CONSTS.length, 36);
  for (const n of JS_FUNCS) assert.equal(typeof Shipped[n], 'function', n + ' missing from bundle');
});

test('parseFriendlyTitle: shipped == core', () => {
  const cases = [
    { body: '### Friendly Title: My Nice Title\n\n### Overview', defaultTitle: 'feat(core): do something' },
    { body: '## Friendly Title: Another Title', defaultTitle: 'fix: bug' },
    { body: '**Friendly Title:** Bold Title', defaultTitle: 'chore: update' },
    { body: '### Friendly Title:\nNext Line Title', defaultTitle: 'refactor: code' },
    { body: 'Regular description without friendly title', defaultTitle: 'feat: regular' },
    { body: '', defaultTitle: 'feat: empty body' },
    { body: null, defaultTitle: 'feat: null body' },
    { body: undefined, defaultTitle: 'feat: undefined body' },
    { body: '### Friendly Title: Standalone Title', defaultTitle: undefined },
  ];
  for (const c of cases) {
    assert.deepEqual(
      Shipped.parseFriendlyTitle(c.body, c.defaultTitle),
      Core.parseFriendlyTitle(c.body, c.defaultTitle),
      'parseFriendlyTitle parity: ' + JSON.stringify(c)
    );
  }
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

test('dependency helpers: shipped == core', () => {
  const cases = [
    'Blocked by #1, #2',
    'Depends on #42\nBlocked by #5',
    '- [ ] Requires: #100',
    'No dependencies here',
    '',
  ];
  for (const c of cases) {
    assert.deepEqual(Shipped.parseIssueDependencies(c), Core.parseIssueDependencies(c), 'parseIssueDependencies: ' + c);
    assert.equal(Shipped.addDependencyToMarkdown(c, 99), Core.addDependencyToMarkdown(c, 99));
    assert.equal(Shipped.removeDependencyFromMarkdown(c, 1), Core.removeDependencyFromMarkdown(c, 1));
    assert.deepEqual(Shipped.extractIssueReferences(c, 5), Core.extractIssueReferences(c, 5));
  }
  const testIssues = [
    { number: 1, title: 'A', body: 'Blocked by #2', state: 'open', labels: [{ name: 'theme:core' }] },
    { number: 2, title: 'B', body: '', state: 'open', labels: [{ name: 'theme:ui' }] },
  ];
  const sGraph = Shipped.buildDependencyGraph(testIssues);
  const cGraph = Core.buildDependencyGraph(testIssues);
  assert.equal(sGraph.layers.length, cGraph.layers.length);
  assert.equal(sGraph.edges.length, cGraph.edges.length);
  assert.deepEqual(Array.from(sGraph.nodes.keys()), Array.from(cGraph.nodes.keys()));
});

test('session index: shipped == core', () => {
  const dummySessions = [
    { id: '1', title: 'Task #10', activity: 'idle', items: [{ id: '10' }] },
    { id: '2', title: 'Fix bug', activity: 'running', worktree: 'issue-20-fix' },
  ];
  const sIdx = Shipped.buildSessionIndex(dummySessions);
  const cIdx = Core.buildSessionIndex(dummySessions);
  assert.equal(sIdx.get(10)?.id, cIdx.get(10)?.id);
  assert.equal(sIdx.get(20)?.id, cIdx.get(20)?.id);
});

test('scopeDoneIssues: shipped == core', () => {
  const dummy = [{ number: 1 }, { number: 2 }, { number: 3 }];
  assert.deepEqual(Shipped.scopeDoneIssues(dummy, 2, false), Core.scopeDoneIssues(dummy, 2, false));
  assert.deepEqual(Shipped.scopeDoneIssues(dummy, 2, true), Core.scopeDoneIssues(dummy, 2, true));
});

test('normalizeGithubIssues and mergeIssuePages: shipped == core', () => {
  const raw = [
    { number: 1, title: 'Bug', body: '- [ ] task', state: 'open' },
    { number: 2, title: 'PR', pull_request: {} },
  ];
  assert.deepEqual(Shipped.normalizeGithubIssues(raw), Core.normalizeGithubIssues(raw));
  const p1 = [{ number: 10, title: 'A' }];
  const p2 = [{ number: 10, title: 'A updated' }, { number: 5, title: 'B' }];
  assert.deepEqual(Shipped.mergeIssuePages(p1, p2), Core.mergeIssuePages(p1, p2));
});
