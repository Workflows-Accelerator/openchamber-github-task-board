import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Core from '../panel/core.ts';
import { renderMarkdown } from '../panel/markdown.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(__dirname, '../panel/index.html'), 'utf8');

// ==========================================
// 1. Clickable File Paths in Tasks and Markdown
// ==========================================
test('formatTaskTextWithLinks: detects file paths and converts to clickable links with data-path', () => {
  const currentRepo = 'Workflows-Accelerator/openchamber-github-task-board';

  // Backticked file path
  const backticked = 'Check `panel/main.ts` and `package.json` for details.';
  const backtickedHtml = Core.formatTaskTextWithLinks(backticked, currentRepo);
  assert.ok(
    backtickedHtml.includes('<a href="#" class="task-link task-file-path-link" data-path="panel/main.ts" title="Click to view file: panel/main.ts"><code>panel/main.ts</code></a>'),
    'backticked panel/main.ts converted to clickable file link'
  );
  assert.ok(
    backtickedHtml.includes('<a href="#" class="task-link task-file-path-link" data-path="package.json" title="Click to view file: package.json"><code>package.json</code></a>'),
    'backticked package.json converted to clickable file link'
  );

  // Absolute workspace path
  const absPath = 'Author the issue-lifecycle skill in the shared skills library (/workspace/config/opencode/.agents/skills/meta/orchestration/issue-lifecycle/).';
  const absHtml = Core.formatTaskTextWithLinks(absPath, currentRepo);
  assert.ok(
    absHtml.includes('<a href="#" class="task-link task-file-path-link" data-path="/workspace/config/opencode/.agents/skills/meta/orchestration/issue-lifecycle/" title="Click to view file: /workspace/config/opencode/.agents/skills/meta/orchestration/issue-lifecycle/">/workspace/config/opencode/.agents/skills/meta/orchestration/issue-lifecycle/</a>'),
    'absolute workspace directory path converted to clickable file link'
  );

  // Relative code path
  const relPath = 'Run test in test/status-model.test.js to verify.';
  const relHtml = Core.formatTaskTextWithLinks(relPath, currentRepo);
  assert.ok(
    relHtml.includes('<a href="#" class="task-link task-file-path-link" data-path="test/status-model.test.js" title="Click to view file: test/status-model.test.js">test/status-model.test.js</a>'),
    'relative file path converted to clickable file link'
  );

  // Standard config files
  const cfgPath = 'Update tsconfig.json and README.md with instructions.';
  const cfgHtml = Core.formatTaskTextWithLinks(cfgPath, currentRepo);
  assert.ok(
    cfgHtml.includes('<a href="#" class="task-link task-file-path-link" data-path="tsconfig.json" title="Click to view file: tsconfig.json">tsconfig.json</a>'),
    'tsconfig.json linked'
  );
  assert.ok(
    cfgHtml.includes('<a href="#" class="task-link task-file-path-link" data-path="README.md" title="Click to view file: README.md">README.md</a>'),
    'README.md linked'
  );

  // Prose with code that is NOT a path
  const codeNotPath = 'Call `isVagueIdea` with `true`.';
  const codeNotPathHtml = Core.formatTaskTextWithLinks(codeNotPath, currentRepo);
  assert.ok(!codeNotPathHtml.includes('task-file-path-link'), 'non-path code is not linkified as a file');
  assert.ok(codeNotPathHtml.includes('<code>isVagueIdea</code>'), 'regular code remains code');
});

test('renderMarkdown: detects file paths in inline code and prose', () => {
  const md = 'Inspect `panel/core.ts` or read `/workspace/package.json` for details.';
  const html = renderMarkdown(md);
  assert.ok(html.includes('task-file-path-link'), 'renderMarkdown emits task-file-path-link');
  assert.ok(html.includes('data-path="panel/core.ts"'), 'data-path for panel/core.ts preserved');
});

// ==========================================
// 2. Question Options and Context Extraction
// ==========================================
test('extractQuestionOptions: extracts options from issue markdown tables and inline phrasing', () => {
  const tableBody = `
## Overview
Channel mechanisms for review gates.

| Channel | Mechanism |
|---|---|
| **A. Parent-session injection** | The board notifies the session that dispatched the work. |
| **B. Board event -> notification** | The board raises an event. |
| **C. Scheduled sweep** | A scheduled task re-checks needs-human issues. |
| **D. Board -> issue comment** | The board posts a comment. |

### Open Questions
- [ ] Channel A, B, or A+D?
  `;

  const tableOpts = Core.extractQuestionOptions('Channel A, B, or A+D?', tableBody);
  assert.ok(tableOpts.length >= 4, 'extracts table options');
  assert.ok(tableOpts.includes('A. Parent-session injection'), 'contains option A');
  assert.ok(tableOpts.includes('B. Board event -> notification'), 'contains option B');
  assert.ok(tableOpts.includes('A + D (Combination)'), 'contains combination A+D');

  // Inline "X or Y"
  const inlineOpts = Core.extractQuestionOptions('Should we use React or Vue?');
  assert.deepEqual(inlineOpts, ['React', 'Vue'], 'extracts simple binary choices');

  // Multi-item inline
  const multiInline = Core.extractQuestionOptions('Which layout should we default to: List, Board, or Graph?');
  assert.deepEqual(multiInline, ['List', 'Board', 'Graph'], 'extracts comma-separated choices');
});

test('extractQuestionContext: extracts relevant snippet and section headings', () => {
  const body = `
### Friendly Title: Notification Pipeline

## Overview
The batch human review gate (#12) parks issues on status:needs-human.

### Design Options
We need to determine the primary notification mechanism.

### Open Questions
- [ ] Channel A, B, or A+D?
  `;

  const contextWithLine = Core.extractQuestionContext(body, 10);
  assert.ok(contextWithLine.includes('Design Options') || contextWithLine.includes('primary notification'), 'extracts preceding section context');

  const overviewContext = Core.extractQuestionContext(body);
  assert.ok(overviewContext.includes('batch human review gate'), 'extracts overview context');
});

// ==========================================
// 3. UI Structure in panel/index.html
// ==========================================
test('panel/index.html defines categorized view dropdown and file preview modal', () => {
  // Dropdown button and popover
  assert.ok(INDEX_HTML.includes('id="btnViewSelect"'), 'btnViewSelect exists in index.html');
  assert.ok(INDEX_HTML.includes('id="viewSelectPopover"'), 'viewSelectPopover exists in index.html');
  assert.ok(INDEX_HTML.includes('id="viewOptHuman"'), 'viewOptHuman exists in index.html');
  assert.ok(INDEX_HTML.includes('id="viewOptQuestions"'), 'viewOptQuestions exists in index.html');
  assert.ok(INDEX_HTML.includes('id="viewOptKanban"'), 'viewOptKanban exists in index.html');
  assert.ok(INDEX_HTML.includes('id="viewOptList"'), 'viewOptList exists in index.html');
  assert.ok(INDEX_HTML.includes('id="viewOptGraph"'), 'viewOptGraph exists in index.html');
  assert.ok(INDEX_HTML.includes('TASKS'), 'TASKS category header exists');
  assert.ok(INDEX_HTML.includes('ISSUES'), 'ISSUES category header exists');

  // File Preview Modal
  assert.ok(INDEX_HTML.includes('id="filePreviewModalBackdrop"'), 'filePreviewModalBackdrop exists');
  assert.ok(INDEX_HTML.includes('id="filePreviewTitle"'), 'filePreviewTitle exists');
  assert.ok(INDEX_HTML.includes('id="filePreviewContent"'), 'filePreviewContent exists');
  assert.ok(INDEX_HTML.includes('id="btnCloseFilePreview"'), 'btnCloseFilePreview exists');
  assert.ok(INDEX_HTML.includes('id="btnCopyPreviewPath"'), 'btnCopyPreviewPath exists');
  assert.ok(INDEX_HTML.includes('id="btnDoneFilePreview"'), 'btnDoneFilePreview exists');

  // CSS classes
  assert.ok(INDEX_HTML.includes('.task-file-path-link'), 'css for .task-file-path-link defined');
  assert.ok(INDEX_HTML.includes('.human-completed-section'), 'css for .human-completed-section defined');
  assert.ok(INDEX_HTML.includes('.human-done-tasks-group'), 'css for .human-done-tasks-group defined');
  assert.ok(INDEX_HTML.includes('.question-icon-badge'), 'css for .question-icon-badge defined');
  assert.ok(INDEX_HTML.includes('.question-context-box'), 'css for .question-context-box defined');
  assert.ok(INDEX_HTML.includes('.question-options-group'), 'css for .question-options-group defined');
});

// ==========================================
// 4. Runtime App Harness Verification
// ==========================================
import { createTestApp } from './test-app-harness.js';

test('Toolbar: categorized dropdown provides Tasks and Issues navigation', () => {
  const { elements, app } = createTestApp();

  const btnViewSelect = elements.get('btnViewSelect');
  const viewSelectPopover = elements.get('viewSelectPopover');
  const viewOptHuman = elements.get('viewOptHuman');
  const viewOptQuestions = elements.get('viewOptQuestions');
  const viewOptKanban = elements.get('viewOptKanban');
  const viewOptList = elements.get('viewOptList');
  const viewOptGraph = elements.get('viewOptGraph');
  const currentLabel = elements.get('viewSelectCurrentLabel');

  assert.ok(btnViewSelect, '#btnViewSelect exists in runtime DOM');
  assert.ok(viewSelectPopover, '#viewSelectPopover exists in runtime DOM');
  assert.ok(viewOptHuman, '#viewOptHuman exists');
  assert.ok(viewOptQuestions, '#viewOptQuestions exists');
  assert.ok(viewOptKanban, '#viewOptKanban exists');
  assert.ok(viewOptList, '#viewOptList exists');
  assert.ok(viewOptGraph, '#viewOptGraph exists');

  // Toggle popover
  assert.equal(viewSelectPopover.style.display, 'none', 'popover initially hidden');
  btnViewSelect.click();
  assert.equal(viewSelectPopover.style.display, 'flex', 'popover visible on click');
  assert.equal(btnViewSelect.getAttribute('aria-expanded'), 'true');

  // Select Human Tasks view
  viewOptHuman.click();
  assert.equal(currentLabel.textContent, 'Human Tasks', 'current label updated to Human Tasks');
  assert.equal(viewSelectPopover.style.display, 'none', 'popover closes after selection');
  assert.equal(btnViewSelect.getAttribute('aria-expanded'), 'false');

  // Select Questions view
  btnViewSelect.click();
  viewOptQuestions.click();
  assert.equal(currentLabel.textContent, 'Questions', 'current label updated to Questions');

  // Select Board (Kanban) view
  btnViewSelect.click();
  viewOptKanban.click();
  assert.equal(currentLabel.textContent, 'Board', 'current label updated to Board');
});

test('Human Tasks View: completed tasks remain visible for review and unchecking; all-done issues move to bottom', () => {
  const { elements, app } = createTestApp();

  const sampleIssues = [
    {
      number: 1,
      title: 'Active Issue with Mixed Tasks',
      body: `
## Checklist
- [ ] Incomplete task 1
- [x] Completed task 2
      `,
      labels: [{ name: 'status:needs-human' }],
      state: 'open',
    },
    {
      number: 2,
      title: 'Issue With All Tasks Completed',
      body: `
## Checklist
- [x] Step A done
- [x] Step B done
      `,
      labels: [{ name: 'status:needs-human' }],
      state: 'open',
    },
    {
      number: 3,
      title: 'Issue with Open Question',
      body: `
### Open Questions
- [ ] Should we use A or B?
      `,
      labels: [{ name: 'status:needs-human' }],
      state: 'open',
    },
  ];

  app.setState({ issues: sampleIssues, currentRepo: 'owner/repo' });

  // Switch to Human Tasks view
  const humanBtn = elements.get('btnViewHuman');
  humanBtn.click();

  const humanContainer = elements.get('humanViewContainer');
  assert.ok(humanContainer, 'humanViewContainer exists');

  // Check that completed tasks group exists in mixed issue card
  const doneGroups = humanContainer.querySelectorAll('.human-done-tasks-group');
  assert.ok(doneGroups.length >= 1, 'human-done-tasks-group rendered for completed tasks');

  // Completed issues section at bottom
  const completedSection = humanContainer.querySelectorAll('.human-completed-section');
  assert.ok(completedSection.length >= 1, 'human-completed-section rendered for all-completed issue');
  const completedHeader = completedSection[0].querySelector('.human-completed-header');
  assert.ok(completedHeader, 'human-completed-header exists for collapse toggle');

  // Check that questions are NOT rendered with checkboxes
  const questionBadges = humanContainer.querySelectorAll('.question-icon-badge');
  assert.ok(questionBadges.length >= 1, 'question rendered with .question-icon-badge');
  const answerButtons = humanContainer.querySelectorAll('.btn-answer-action');
  assert.ok(answerButtons.length >= 1, 'question rendered with .btn-answer-action');
});

test('Questions View: renders question icon, context box, quick choices, and NO checkbox', () => {
  const { elements, app } = createTestApp();

  const issueWithTableQuestion = {
    number: 14,
    title: 'Notify Agent When Tasks Done',
    body: `
### Friendly Title: Notification Architecture

## Overview
The batch human review gate (#12) parks issues on status:needs-human.

| Channel | Mechanism |
|---|---|
| **A. Parent-session injection** | The board notifies the session that dispatched the work. |
| **B. Board event -> notification** | The board raises an event. |
| **C. Scheduled sweep** | A scheduled task re-checks needs-human issues. |
| **D. Board -> issue comment** | The board posts a comment. |

### Open Questions
- [ ] Channel A, B, or A+D?
    `,
    labels: [{ name: 'status:needs-human' }],
    state: 'open',
  };

  app.setState({ issues: [issueWithTableQuestion], currentRepo: 'owner/repo' });

  // Switch to Questions view
  const questionsBtn = elements.get('btnViewQuestions');
  questionsBtn.click();

  const questionsContainer = elements.get('questionsViewContainer');
  assert.ok(questionsContainer, 'questionsViewContainer exists');

  // Must have question badge and NO checkboxes
  const qBadges = questionsContainer.querySelectorAll('.question-icon-badge');
  assert.ok(qBadges.length >= 1, 'question badge rendered');
  const checkboxes = questionsContainer.querySelectorAll('.human-todo-checkbox');
  assert.equal(checkboxes.length, 0, 'questions view must NEVER have checkboxes on questions');

  // Context box rendered
  const contextBoxes = questionsContainer.querySelectorAll('.question-context-box');
  assert.ok(contextBoxes.length >= 1, 'question context box rendered');

  // Quick choice buttons rendered
  const optionButtons = questionsContainer.querySelectorAll('.question-option-btn');
  assert.ok(optionButtons.length >= 4, 'quick choice option buttons rendered from table');
  const optTexts = optionButtons.map((b) => b.textContent);
  assert.ok(optTexts.includes('A. Parent-session injection'), 'contains option A');
  assert.ok(optTexts.includes('B. Board event -> notification'), 'contains option B');
  assert.ok(optTexts.includes('A + D (Combination)'), 'contains option A + D');
});

