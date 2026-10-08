import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFriendlyTitle,
  resolveSimplifiedViewTitle,
  parseHumanTasks,
  parseOpenQuestions,
  collectHumanTodos,
  formatTaskTextWithLinks,
} from '../panel/core.ts';
import { createTestApp } from './test-app-harness.js';

// Verbatim shapes from live GitHub issues #23 and #24
const LIVE_ISSUE_23 = {
  number: 23,
  title: 'feat(board): Human Tasks, All Tasks, and Questions views',
  body: `### Friendly Title:
Add Simplified Task Views

**Overview:**
Introduce three simplified task views to the task board: Human Tasks, All Tasks, and Questions. These views provide fast, friendly-title-first scanning for intake, triage, and human execution on top of the contract v1 extraction API without touching contract frontier files.

### Acceptance Criteria:
- [ ] Three view modes render correctly from real issue state and honor existing filters
- [ ] Human Tasks view renders collectHumanTodos output per needs-human issue with working checkbox write-back through the existing checkbox mutation path
- [ ] All Tasks view shows friendly titles only (no technical titles except at most a quiet mono subtitle) grouped by status with counts
- [ ] Questions view lists every unanswered open question across all statuses grouped by issue
- [ ] Empty states are clear and quiet without emojis
- [ ] Keyboard accessible and visual hierarchy is clean and generous
- [ ] Full test suite green and bundle regenerated
- [ ] Every claim in summary carries a file:line anchor

### Human Tasks:
- [ ] Open Human Tasks in OpenChamber, select the task linked to issue 23 "Add Simplified Task Views", and confirm it opens this issue rather than another repository's issue with the same number. Report any missing task or wrong link in the managing session.
- [ ] After the view repair is available in the running preview, compare List with All Tasks and confirm the checklist icon is distinct and All Tasks displays "Add Simplified Task Views" instead of the technical title. Report pass or the problem in the managing session.
- [ ] Open Questions and confirm the unanswered list below appears under "Add Simplified Task Views" and opens this issue. Answer the question in the managing session; do not check it off until you have answered.

### Open Questions:
- [ ] When you manually select a repository and then switch to a session in another repository, should the board follow the new session automatically, or keep your manual selection until you choose "Current session"? The goal is to show the current session repository by default while keeping deliberate cross-repository review possible.

## Human review feedback — 2026-10-08
The human reports indistinguishable List/All Tasks icons, technical titles in the simplified list, empty human/question queues, and difficult or incomplete repository loading when switching sessions. Not accepted as Done. Checklist icon and friendly-title corrections approved; repository default/current-session workflow approved in principle, override lifetime awaiting answer. Human Tasks are real outstanding review actions; questions are real unresolved decisions, not demo filler.`,
};

const LIVE_ISSUE_24 = {
  number: 24,
  title: 'fix(board): load the current session repository and make switching reliable',
  body: `### Friendly Title:
Find and Switch Repositories

## Overview
Human review on 2026-10-08 found that the board is hard to switch to other repositories from another session, and another user saw no issues for their repository. Diagnose session directory, repository discovery, selection persistence, authentication, cache scoping, and request races before changing code. The approved goal is to default to the current session repository while retaining deliberate repository switching and All Projects.

### Acceptance Criteria:
- [ ] The current session repository is available and is the default when no deliberate override is active.
- [ ] A permitted repository with issues does not silently appear empty because of discovery, loading, or cache errors.
- [ ] Explicit switching remains easy and never shows another repositorys cached issues.
- [ ] Authentication, missing bindings, empty repositories, and failed loading remain distinguishable.
- [ ] The manual selection lifetime follows the human answer below.
- [ ] Production-path tests and populated browser evidence cover session and repository switches.

### Actionable Subtasks Checklist:
- [ ] Reproduce missing repositories and identify the failed boundary.
- [ ] Trace session directory, project binding, repo list, selected scope, and cache ownership.
- [ ] Repair proven defects without removing single-project or All Projects features.
- [ ] Run hostile review and present the repaired preview for human validation.

### Open Questions:
- [ ] When you manually select a repository and then switch to a session in another repository, should the board follow the new session automatically, or keep your manual selection until you choose Current session? The board should use the current session repository by default, but deliberate cross-repository review must remain possible.

### Human Tasks:
- [ ] Open Questions in the task board, open Find and Switch Repositories, and answer the manual-selection question in the managing session. Report if the question or issue link is missing.

## Test Plan (Issue)
- [ ] Open sessions in two different repositories, including a worktree, and verify repository discovery and issue loading.
- [ ] Switch repositories while requests are delayed and verify that old results do not overwrite the selected scope.
- [ ] Verify empty, inaccessible, and failed repositories have distinct visible outcomes.

## Coordination
Shares panel/main.ts with https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/23; one board application worker handles this frontier to avoid conflicting edits. No issue closure or publishing is authorized.`,
};

// Stale cache fixture reproducing issues #1-#5 without Friendly Title headers
const STALE_CACHED_ISSUE = {
  number: 5,
  title: 'feat(board): theme-scoped worktree reuse and additive issue-session attachment',
  body: `## Overview\n\nBranch naming predates both themes and batches. Launching an issue creates a fresh issue worktree.`,
};

// ==========================================
// 1. Live Issue Parsing Verification
// ==========================================
test('Live issues #23 and #24 parse Friendly Titles and queues successfully', () => {
  const resolved23 = resolveSimplifiedViewTitle(LIVE_ISSUE_23);
  assert.equal(resolved23.displayTitle, 'Add Simplified Task Views');
  assert.equal(resolved23.displaySubtitle, 'feat(board): Human Tasks, All Tasks, and Questions views');
  assert.equal(resolved23.isPlaceholder, false);

  const humanTasks23 = parseHumanTasks(LIVE_ISSUE_23.body);
  assert.equal(humanTasks23.length, 3);
  const openQuestions23 = parseOpenQuestions(LIVE_ISSUE_23.body);
  assert.equal(openQuestions23.length, 1);
  const todos23 = collectHumanTodos(LIVE_ISSUE_23);
  assert.equal(todos23.length, 3);

  const resolved24 = resolveSimplifiedViewTitle(LIVE_ISSUE_24);
  assert.equal(resolved24.displayTitle, 'Find and Switch Repositories');
  assert.equal(resolved24.displaySubtitle, 'fix(board): load the current session repository and make switching reliable');
  assert.equal(resolved24.isPlaceholder, false);

  const humanTasks24 = parseHumanTasks(LIVE_ISSUE_24.body);
  assert.equal(humanTasks24.length, 1);
  const openQuestions24 = parseOpenQuestions(LIVE_ISSUE_24.body);
  assert.equal(openQuestions24.length, 1);
  const todos24 = collectHumanTodos(LIVE_ISSUE_24);
  assert.equal(todos24.length, 1);
});

// ==========================================
// 2. Decision D14: Eliminate "(No friendly title)" Placeholder
// ==========================================
test('D14: resolveSimplifiedViewTitle falls back to issue.title without subtitle duplication', () => {
  const resolved = resolveSimplifiedViewTitle(STALE_CACHED_ISSUE);
  // D14 contract: never emit "(No friendly title)"; fall back directly to issue title
  assert.equal(
    resolved.displayTitle,
    'feat(board): theme-scoped worktree reuse and additive issue-session attachment'
  );
  // Must NOT duplicate technical title as subtitle
  assert.equal(resolved.displaySubtitle, null);
  assert.equal(resolved.isPlaceholder, false);
});

test('D14: resolveSimplifiedViewTitle falls back to Issue #N when title is empty', () => {
  const emptyIssue = { number: 42, title: '', body: 'No title provided.' };
  const resolved = resolveSimplifiedViewTitle(emptyIssue);
  assert.equal(resolved.displayTitle, 'Issue #42');
  assert.equal(resolved.displaySubtitle, null);
  assert.equal(resolved.isPlaceholder, false);
});

// ==========================================
// 3. Decision D15: Repo Picker Session Repo, Picked State, and Honest Status
// ==========================================
test('D15: Popover shows session linked repo inline and highlights active session default', async () => {
  const { app, elements, emitSession } = createTestApp();
  await emitSession({
    id: 'ses_main',
    title: 'Main Session',
    items: [{ id: '23', data: { repo: 'Workflows-Accelerator/openchamber-github-task-board' } }],
  });
  app.renderRepoPopoverList();
  const listEl = elements.get('detectedReposList');
  assert.ok(
    listEl.innerHTML.includes('Session repo: Workflows-Accelerator/openchamber-github-task-board'),
    'must display linked session repo inline'
  );
  const currentSessionOpt = listEl.querySelector('.current-session-option');
  assert.ok(currentSessionOpt, 'current session option exists');
  assert.ok(currentSessionOpt.classList.contains('is-active'), 'current session option must have is-active class');
  assert.ok(currentSessionOpt.classList.contains('selected-repo'), 'current session option must have selected-repo class');
  assert.ok(currentSessionOpt.innerHTML.includes('[active default]'), 'renders [active default] status');
});

test('D15: Popover shows "Session repo: none linked" when session has no linked repo', () => {
  const { app, elements } = createTestApp();
  app.setState({ currentSessionRepo: null, currentRepo: '', isManualRepoOverride: true });
  app.renderRepoPopoverList();
  const listEl = elements.get('detectedReposList');
  assert.ok(
    listEl.innerHTML.includes('Session repo: none linked'),
    'must display Session repo: none linked'
  );
});

test('D15: Actively picked repository is visibly distinct with [picked] badge and selected-repo class', () => {
  const { app, elements } = createTestApp();
  app.setState({
    currentRepo: 'owner/picked-repo',
    isManualRepoOverride: true,
    allProjects: [
      { id: 'p1', name: 'Picked Project', directory: '/workspace/p1', linkedRepo: 'owner/picked-repo' },
      { id: 'p2', name: 'Other Project', directory: '/workspace/p2', linkedRepo: 'owner/other-repo' },
    ],
  });
  app.renderRepoPopoverList();
  const listEl = elements.get('detectedReposList');
  const pickedItem = listEl.querySelector('.popover-item[data-repo="owner/picked-repo"]');
  assert.ok(pickedItem, 'picked repo item exists');
  assert.ok(pickedItem.classList.contains('is-active'), 'picked repo item has is-active class');
  assert.ok(pickedItem.classList.contains('selected-repo'), 'picked repo item has selected-repo class');
  assert.ok(pickedItem.innerHTML.includes('[picked]'), 'picked repo item displays [picked] badge');

  const otherItem = listEl.querySelector('.popover-item[data-repo="owner/other-repo"]');
  assert.ok(otherItem, 'other repo item exists');
  assert.ok(!otherItem.classList.contains('is-active'), 'other repo item is not is-active');
  assert.ok(!otherItem.innerHTML.includes('[picked]'), 'other repo item does not have [picked] badge');
});

test('D15: Popover renders honest rate-limit and offline status notices', () => {
  const { app, elements } = createTestApp();
  // Rate-limited notice
  app.setState({
    lastSyncErrorState: {
      kind: 'rate-limited',
      message: 'GitHub rate limit exceeded',
      timestamp: Date.now(),
    },
  });
  app.renderRepoPopoverList();
  let listEl = elements.get('detectedReposList');
  assert.ok(listEl.innerHTML.includes('popover-status-notice rate-limited'), 'renders rate-limited popover notice');
  assert.ok(listEl.innerHTML.includes('API Rate-Limited (Showing Cached Issues)'), 'renders rate-limited header');
  assert.ok(listEl.innerHTML.includes('Personal Access Token'), 'includes PAT action guidance');

  // Offline notice
  app.setState({
    lastSyncErrorState: {
      kind: 'offline',
      message: 'Network unreachable',
      timestamp: Date.now(),
    },
  });
  app.renderRepoPopoverList();
  listEl = elements.get('detectedReposList');
  assert.ok(listEl.innerHTML.includes('popover-status-notice offline'), 'renders offline popover notice');
  assert.ok(listEl.innerHTML.includes('Offline / Cached State'), 'renders offline header');
});

test('D15: renderEmptyState renders rate-limited kind with actionable token guidance', () => {
  const { app, elements } = createTestApp();
  app.renderEmptyState('GitHub API rate limit exceeded for owner/repo. Add a GitHub Personal Access Token to increase limits.', 'rate-limited');
  const container = elements.get('listViewContainer');
  assert.ok(container.innerHTML.includes('empty-state-rate-limited'), 'includes empty-state-rate-limited class');
  assert.ok(container.innerHTML.includes('API Rate-Limited'), 'renders API Rate-Limited title');
  assert.ok(container.innerHTML.includes('Personal Access Token'), 'renders token guidance');
});

// ==========================================
// 4. Decision D16: All Projects Grouping and Plain Full-URL Cross-Repo Links
// ==========================================
test('D16: formatTaskTextWithLinks converts cross-repo shorthand and full URLs to plain full URLs, leaving same-repo prose', () => {
  const currentRepo = 'Workflows-Accelerator/openchamber-github-task-board';

  // Cross-repo reference -> converted to plain full URL link
  const crossText = 'Review findings in other-org/other-repo#42 before starting.';
  const crossHtml = formatTaskTextWithLinks(crossText, currentRepo);
  assert.ok(
    crossHtml.includes('<a href="https://github.com/other-org/other-repo/issues/42" target="_blank" rel="noopener noreferrer" class="task-link cross-repo-link">https://github.com/other-org/other-repo/issues/42</a>'),
    'cross-repo shorthand converted to full URL link'
  );

  // Same-repo reference -> kept as self-contained prose
  const sameText = `Review fix in ${currentRepo}#23 before merging.`;
  const sameHtml = formatTaskTextWithLinks(sameText, currentRepo);
  assert.equal(sameHtml, sameText, 'same-repo reference remains self-contained prose');

  // Local reference (#23) -> kept as self-contained prose
  const localText = 'Check checklist in #23.';
  const localHtml = formatTaskTextWithLinks(localText, currentRepo);
  assert.equal(localHtml, localText, 'local reference remains self-contained prose');

  // Full issue URL -> converted to link with full URL visible text
  const urlText = 'Follow progress at https://github.com/owner/repo/issues/100 today.';
  const urlHtml = formatTaskTextWithLinks(urlText, currentRepo);
  assert.ok(
    urlHtml.includes('<a href="https://github.com/owner/repo/issues/100" target="_blank" rel="noopener noreferrer" class="task-link cross-repo-link">https://github.com/owner/repo/issues/100</a>'),
    'full GitHub issue URL converted to link'
  );

  // Markdown link -> converted to standard task link
  const mdText = 'Read [API Spec](https://example.com/spec) for details.';
  const mdHtml = formatTaskTextWithLinks(mdText, currentRepo);
  assert.ok(
    mdHtml.includes('<a href="https://example.com/spec" target="_blank" rel="noopener noreferrer" class="task-link">API Spec</a>'),
    'markdown link parsed to task-link'
  );

  // XSS sanitization
  const xssText = 'Dangerous <script>alert(1)</script> and "quotes" & ampersands';
  const xssHtml = formatTaskTextWithLinks(xssText, currentRepo);
  assert.ok(!xssHtml.includes('<script>'), 'strips dangerous raw tags');
  assert.ok(xssHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escapes html entities');
});

test('D16: In All Projects mode, Human Tasks and Questions group by repository', () => {
  const { app, elements } = createTestApp();
  app.setState({
    isAllProjectsMode: true,
  });

  const testIssues = [
    {
      number: 1,
      repo: 'repo-alpha/service',
      title: 'Alpha Human Issue',
      body: '### Friendly Title:\nAlpha Task\n### Human Tasks:\n- [ ] Task for alpha repo\n',
      labels: [{ name: 'status:needs-human' }],
    },
    {
      number: 2,
      repo: 'repo-beta/client',
      title: 'Beta Human Issue',
      body: '### Friendly Title:\nBeta Task\n### Human Tasks:\n- [ ] Task referencing repo-alpha/service#1\n',
      labels: [{ name: 'status:needs-human' }],
    },
    {
      number: 3,
      repo: 'repo-alpha/service',
      title: 'Alpha Question Issue',
      body: '### Friendly Title:\nAlpha Question\n### Open Questions:\n- [ ] Should alpha do X?\n',
      labels: [{ name: 'status:backlog' }],
    },
    {
      number: 4,
      repo: 'repo-beta/client',
      title: 'Beta Question Issue',
      body: '### Friendly Title:\nBeta Question\n### Open Questions:\n- [ ] Should beta reference repo-alpha/service#1?\n',
      labels: [{ name: 'status:backlog' }],
    },
  ];

  // 1. Human Tasks view in All Projects mode
  app.renderHumanTasksView(testIssues);
  const humanContainer = elements.get('humanViewContainer');
  assert.ok(humanContainer.innerHTML.includes('human-repo-group'), 'renders human-repo-group');
  assert.ok(humanContainer.innerHTML.includes('repo-alpha/service'), 'groups repo-alpha/service');
  assert.ok(humanContainer.innerHTML.includes('repo-beta/client'), 'groups repo-beta/client');
  assert.ok(
    humanContainer.innerHTML.includes('https://github.com/repo-alpha/service/issues/1'),
    'cross-repo task text converted to full URL'
  );

  // 2. Questions view in All Projects mode
  app.renderQuestionsView(testIssues);
  const questionsContainer = elements.get('questionsViewContainer');
  assert.ok(questionsContainer.innerHTML.includes('questions-repo-group'), 'renders questions-repo-group');
  assert.ok(questionsContainer.innerHTML.includes('repo-alpha/service'), 'groups repo-alpha/service');
  assert.ok(questionsContainer.innerHTML.includes('repo-beta/client'), 'groups repo-beta/client');
  assert.ok(
    questionsContainer.innerHTML.includes('https://github.com/repo-alpha/service/issues/1'),
    'cross-repo question text converted to full URL'
  );
});

// ==========================================
// 5. Decision SV-01: Switching Session from All Projects Mode Exits to That Session's Repo
// ==========================================
test('SV-01: Switching session while in All Projects mode exits to that session repo', async () => {
  const { app, emitSession } = createTestApp();
  app.setState({
    activeSessionId: 'ses_initial',
    isAllProjectsMode: true,
    isManualRepoOverride: true,
    currentRepo: '',
  });

  // Switch to session with a specific repo
  await emitSession({
    id: 'ses_targeted',
    title: 'Targeted Session',
    items: [{ id: '10', data: { repo: 'org/session-repo' } }],
  });

  assert.equal(app.getState().isAllProjectsMode, false, 'must exit All Projects mode');
  assert.equal(app.getState().isManualRepoOverride, false, 'must reset manual repo override');
  assert.equal(app.getState().currentRepo, 'org/session-repo', 'must follow session repository');
});
